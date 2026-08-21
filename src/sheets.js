// ============================================================================
//  Sổ Sạch → Google Sheets — il motore, senza il trasporto.
//
//  Design in docs/SHEETS_SPEC.md. Qui vive tutto ciò che è PURO e testabile:
//  la validazione dell'URL, la costruzione del payload, la logica di debounce.
//  Il fetch e le rotte stanno in server.js — così questo file si testa senza
//  accendere un server e senza mai parlare con Google.
// ============================================================================
import { totals, quarterOf, partsOf } from "./tax.js";
import { buildDeclaration } from "./declaration.js";
import { todayVN } from "./vndate.js";

// ---- URL del deployment Apps Script -----------------------------------------
// SOLO host Google Script: l'URL lo digita l'utente e finisce in una fetch dal
// server → senza questa lista un URL ostile trasforma il push in una SSRF
// verso la rete interna di Render.
const HOSTS = new Set(["script.google.com", "script.googleusercontent.com"]);
// Porta di servizio SOLO per l'e2e: il finto Apps Script del test gira su
// 127.0.0.1, che la whitelist (giustamente) rifiuterebbe. Host extra via env,
// mai impostata in produzione — su Render la variabile non esiste.
const TEST_HOSTS = new Set(
  (process.env.SHEETS_TEST_HOSTS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

export function validateSheetsUrl(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return { ok: false, error: "URL không hợp lệ" }; }
  if (TEST_HOSTS.has(u.hostname)) return { ok: true, url: u.toString() }; // solo e2e
  if (u.protocol !== "https:") return { ok: false, error: "Chỉ chấp nhận https" };
  if (!HOSTS.has(u.hostname)) return { ok: false, error: "Chỉ chấp nhận đường dẫn Google Apps Script (script.google.com)" };
  if (u.port && u.port !== "443") return { ok: false, error: "Cổng không hợp lệ" };
  return { ok: true, url: u.toString() };
}

// ---- Payload ----------------------------------------------------------------
// Numeri come NUMERI (il foglio deve poter sommare), date ISO, righe ordinate
// per data ASC come il CSV. La tab "Tổng hợp" usa GLI STESSI motori della
// dichiarazione: mai ricalcolare a mano ciò che il prodotto già calcola.
const vnType = (t) => (t === "thu" ? "Thu" : "Chi");

export function buildSheetsPayload(book, { now = new Date() } = {}) {
  const entries = [...(book.entries || [])].sort((a, z) => String(a.date).localeCompare(String(z.date)));
  const ledger = [["Ngày", "Loại", "Số tiền (VND)", "Đối tác", "Mô tả", "Nguồn", "Gốc"]];
  for (const e of entries) {
    ledger.push([e.date, vnType(e.type), Number(e.amount) || 0,
                 e.counterparty || "", e.description || "", e.source || "", e.provenance || ""]);
  }

  const { year } = quarterOf(now);
  const perQ = [1, 2, 3, 4].map((q) => totals(entries, { year, q }));
  const yearT = totals(entries, { year });
  const decl = buildDeclaration(book, { now });

  const summary = [
    ["", "Q1", "Q2", "Q3", "Q4", `Năm ${year}`],
    ["Thu", ...perQ.map((t) => t.revenue), yearT.revenue],
    ["Chi", ...perQ.map((t) => t.expenses), yearT.expenses],
    ["Lãi gộp", ...perQ.map((t) => t.net), yearT.net],
    ["Thuế tạm tính (quý hiện tại)", "", "", "", "", decl.total],
    ["Dự kiến cả năm", "", "", "", "", decl.projection],
    ["Hạn nộp tờ khai", "", "", "", "", decl.deadline],
    ["Cập nhật", "", "", "", "", todayVN(now)],
  ];

  return { sheets: { "Sổ thu chi": ledger, "Tổng hợp": summary } };
}

// ---- Trasporto: push verso l'Apps Script ------------------------------------
// Apps Script ha un tempo massimo di esecuzione di 6 minuti: un libro con anni
// di storico non deve mai far scadere il ricevitore. Si tengono le 5.000 righe
// PIÙ RECENTI (ordinamento ASC ⇒ la coda) e una riga finale spiega il taglio.
const MAX_LEDGER_ROWS = 5000;

function capLedger(sheets) {
  const rows = sheets["Sổ thu chi"];
  if (!Array.isArray(rows) || rows.length - 1 <= MAX_LEDGER_ROWS) return sheets;
  const dropped = rows.length - 1 - MAX_LEDGER_ROWS;
  const kept = rows.slice(rows.length - MAX_LEDGER_ROWS);
  const notice = [
    `… đã lược bớt ${dropped.toLocaleString("vi-VN")} dòng cũ hơn — xuất CSV trong Sổ Sạch để xem toàn bộ lịch sử`,
    "", "", "", "", "", "",
  ];
  return { ...sheets, "Sổ thu chi": [rows[0], ...kept, notice] };
}

// Push di un payload verso il deployment dell'utente.
// ⚠️ Trappola confermata: /exec risponde SEMPRE 302 verso
// script.googleusercontent.com. redirect:"error" ucciderebbe ogni push;
// redirect:"follow" cieco riaprirebbe la SSRF che la whitelist chiude.
// Quindi: redirect:"manual", si segue ESATTAMENTE un hop, e l'host dell'hop
// viene ri-validato contro la stessa whitelist.
export async function pushToSheet(url, secret, payload) {
  const first = validateSheetsUrl(url);
  if (!first.ok) return { ok: false, error: first.error };
  const body = JSON.stringify({ secret, sheets: capLedger(payload?.sheets || {}) });

  let res = await fetch(first.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status >= 300 && res.status < 400) {
    let hopUrl;
    try { hopUrl = new URL(res.headers.get("location") || "", first.url).toString(); }
    catch { return { ok: false, error: "Chuyển hướng không hợp lệ từ Apps Script" }; }
    const hop = validateSheetsUrl(hopUrl);
    if (!hop.ok) return { ok: false, error: "Chuyển hướng ra ngoài Google — đã chặn vì an toàn" };
    // Il 302 di Apps Script significa "la risposta si legge QUI": il secondo
    // passo è un GET senza corpo, come farebbe un browser dopo un POST→302.
    res = await fetch(hop.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000) });
    if (res.status >= 300 && res.status < 400)
      return { ok: false, error: "Quá nhiều bước chuyển hướng từ Apps Script" };
  }

  const text = await res.text();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status} từ Apps Script` };
  let out = null;
  try { out = JSON.parse(text); } catch {}
  if (!out || typeof out !== "object")
    return { ok: false, error: "Phản hồi không hợp lệ từ Apps Script — kiểm tra lại đường dẫn /exec" };
  // { ok:true, at } oppure { ok:false, error } — l'errore del foglio in chiaro
  return out;
}

// ---- Debounce per-uid -------------------------------------------------------
// Un fiume di foto non deve produrre un fiume di push: 30 s di quiete dopo
// l'ULTIMA mutazione, un solo timer per uid. Iniettabile per i test
// (schedule/clear), così non si aspettano 30 secondi veri.
export function makePushQueue(pushFn, { delayMs = 30_000, schedule = setTimeout, clear = clearTimeout } = {}) {
  const timers = new Map();
  return {
    touch(uid) {
      if (timers.has(uid)) clear(timers.get(uid));
      timers.set(uid, schedule(() => {
        timers.delete(uid);
        // async-IIFE, non Promise.resolve(fn()): un throw SINCRONO in pushFn
        // scoppierebbe prima che la Promise esista — dentro un timer è
        // un'eccezione non catturata che ammazza il processo.
        (async () => pushFn(uid))().catch(() => {});   // il libro non aspetta il foglio
      }, delayMs));
    },
    pending: () => timers.size,
  };
}
