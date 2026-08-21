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

export function validateSheetsUrl(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return { ok: false, error: "URL không hợp lệ" }; }
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
