// ============================================================================
//  Sổ Sạch — server. Sổ sách kế toán AI cho hộ kinh doanh.
//  Foto scontrino → voce di sổ → soglie fiscali → tờ khai trimestrale.
//  Near-final: account (SĐT+PIN), ruoli hộ/đại lý thuế, storage JSON↔Postgres,
//  billing payOS (env-gated, pilot mode senza chiavi), export CSV, Zalo OA.
// ============================================================================
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  THRESHOLDS, CATEGORIES, totals, projectAnnual, quarterlyTax,
  thresholdStatus, quarterOf, nextDeadline, partsOf,
} from "./src/tax.js";
import { extractReceipt, extractionMode } from "./src/extract.js";
import { zaloEnabled, verifyWebhook, sendText, fetchImageBase64, formatEntryMessage, formatQuarterMessage, tokenStatus, vnDate } from "./src/zalo.js";
import { matchCommand, menuText, parseKhaiCommand } from "./src/commands.js";
import { buildDeclaration } from "./src/declaration.js";
import { bootstrapFromEnv, exchangeOaCode } from "./src/zalo_token.js";
import { initStore, storeMode, books, accounts, leads, getBook, persistBook, persistAccount, persistLead, removeBook } from "./src/store.js";
import { register, login, publicAccount, findAgentByCode, findAccountByZaloId, createLinkCode, consumeLinkCode, authOptional, requireAuth, normalizePhone } from "./src/auth.js";
import { PLANS, payosEnabled, createPaymentLink, verifyPayosWebhook, activateSub, subActive } from "./src/billing.js";
import { sosachScore } from "./src/score.js";
import { parseMoneyCommand } from "./src/amount.js";
import { todayVN } from "./src/vndate.js";
import { applyOpening, openingOf, declaredRevenue, latestCorrectable } from "./src/opening.js";
import { sampleEntries, SAMPLE_PROFILE } from "./src/sample.js";
import { demoAgency } from "./src/demo_agency.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// Dietro il proxy di Render req.ip sarebbe l'IP del proxy per tutti — senza
// questo il rate limit sotto sarebbe un unico secchio globale.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3500;
const DATA_DIR = join(__dirname, "data");

// ---- Rate limit (finestra scorrevole in memoria, zero dipendenze) --------------
// /api/extract è pubblico E spende crediti Anthropic a ogni chiamata: senza
// limite chiunque abbia l'URL può prosciugare il budget API. Doppio argine:
// per-IP (abuso singolo) + tetto globale giornaliero (protegge la bolletta).
const buckets = new Map();
let globalDay = "", globalCount = 0;

function rateLimit({ windowMs, max, globalMax, name }) {
  return (req, res, next) => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    if (today !== globalDay) { globalDay = today; globalCount = 0; }
    if (globalMax && globalCount >= globalMax) {
      return res.status(429).json({ error: "Hôm nay đã đạt giới hạn dùng thử. Vui lòng thử lại ngày mai." });
    }
    const key = name + ":" + (req.ip || "?");
    const b = buckets.get(key);
    if (!b || now > b.reset) buckets.set(key, { n: 1, reset: now + windowMs });
    else if (b.n >= max) {
      res.setHeader("Retry-After", Math.ceil((b.reset - now) / 1000));
      return res.status(429).json({ error: "Bạn thao tác hơi nhanh. Vui lòng thử lại sau ít phút." });
    } else b.n++;
    if (globalMax) globalCount++;
    // potatura opportunistica: la mappa non deve crescere all'infinito
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    next();
  };
}

// uid del libro: account autenticato → "u:<phone>"; altrimenti demo pubblico.
const uidFor = (req) => (req.phone ? "u:" + req.phone : String(req.query.uid || "demo"));

// Libro per un utente Zalo: se il suo zaloId è collegato a un account →
// "u:<phone>" (visibile su web e all'đại lý thuế); altrimenti "zalo:<id>".
const zaloBookUid = (zaloId) => {
  const acct = findAccountByZaloId(zaloId);
  return acct ? "u:" + acct.phone : "zalo:" + zaloId;
};

// Fonde il libro Zalo pre-collegamento nell'account e rimuove l'orfano.
function mergeZaloBook(zaloId, phone) {
  const src = books["zalo:" + zaloId];
  if (!src || !src.entries?.length) return 0;
  const dst = getBook("u:" + phone);
  const n = src.entries.length;
  dst.entries.push(...src.entries);
  removeBook("zalo:" + zaloId);
  persistBook("u:" + phone);
  return n;
}

// ---- Zalo webhook (raw body PRIMA del json parser, per la firma) ---------------
// Deduplica gli eventi Zalo. "Webhook Retry" è ATTIVO lato Zalo: se non
// rispondiamo in fretta, lo stesso messaggio arriva 2-3 volte e la stessa
// ricevuta finisce nel sổ due o tre volte — davanti a un cliente sembra che il
// prodotto conti male. La finestra dei retry è di minuti, quindi basta una
// mappa in memoria con TTL (un riavvio la svuota: è accettabile).
const seenEvents = new Map();
const EVENT_TTL_MS = 10 * 60 * 1000;
function alreadyHandled(key) {
  if (!key) return false;                       // senza id non possiamo dedurre: meglio processare
  const now = Date.now();
  for (const [k, t] of seenEvents) if (now - t > EVENT_TTL_MS) seenEvents.delete(k);
  if (seenEvents.has(key)) return true;
  seenEvents.set(key, now);
  return false;
}

app.post("/webhooks/zalo", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  const raw = req.body.toString("utf8");
  const mac = req.headers["x-zevent-signature"];
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "bad json" }); }
  // Traccia di ricezione PRIMA di qualunque logica: durante i test di Zalo la
  // domanda è sempre "l'evento è arrivato?" e senza questa riga non è
  // distinguibile da "arrivato ma ignorato".
  console.log(`zalo webhook ← ${event?.event_name || "(no event_name)"} ` +
              `sender=${event?.sender?.id || "-"} sig=${mac ? "present" : "absent"}`);
  const check = verifyWebhook(raw, event.timestamp, mac);
  if (!check.ok && zaloEnabled()) return res.status(401).json({ error: "invalid signature" });

  // ACK SUBITO, poi lavora. Leggere l'immagine e chiamare Claude vision prende
  // secondi; se l'ACK aspettasse la fine, Zalo considererebbe l'endpoint lento
  // e rispedirebbe l'evento. L'elaborazione prosegue dopo la risposta.
  res.json({ ok: true });
  const msgId = event?.message?.msg_id || event?.msg_id || null;
  if (alreadyHandled(msgId)) {
    console.log(`zalo webhook ↺ duplicate msg_id=${msgId} — ignorato`);
    return;
  }
  handleZaloEvent(event).catch((e) => console.error("zalo webhook:", e.message));
});

async function handleZaloEvent(event) {
  try {
    const uid = event?.sender?.id || "zalo-unknown";
    // NIENTE risposta al "follow": ci pensa Zalo. Il benvenuto è configurato
    // nell'OA Manager (Thiết lập tương tác → Tin nhắn chào mừng) e arriva come
    // scheda ricca — immagine, titolo, pulsante — senza dipendere dal nostro
    // webhook. Rispondere anche qui darebbe a ogni nuovo utente TRE messaggi
    // di fila. La barra menu persistente (Thanh menu) resta sempre visibile
    // sotto la chat, quindi l'elenco dei comandi non serve ripeterlo subito.
    // ⚠️ Se un giorno si spegne "Tin nhắn chào mừng" nell'OA Manager, il primo
    //    contatto torna muto: riattivare questo ramo, non solo il toggle.
    if (event.event_name === "user_send_image") {
      const url = event?.message?.attachments?.[0]?.payload?.url;
      // Zalo consegna i dati utente COMPLETI solo a IP vietnamiti (policy dal
      // 29/02/2024, confermata dal BQT il 03/08/2026). I campi elencati sono di
      // profilo — che non usiamo — ma se anche l'URL dell'allegato venisse
      // tagliato su un IP estero, il loop centrale muore. Prima qui non c'era
      // un ramo "else": nessun log, nessuna risposta, indistinguibile da un bot
      // morto. Ora l'evento senza URL si vede e l'utente riceve una risposta.
      if (!url) {
        console.error(
          "zalo image: NESSUN url nell'allegato — payload ricevuto: " +
          JSON.stringify(event?.message?.attachments || null).slice(0, 400) +
          "  ⚠️ se è vuoto o privo di 'url' è il filtro IP non-Vietnam: serve un IP VN."
        );
        await sendText(uid,
          "😕 Mình nhận được ảnh nhưng chưa tải về được. Bạn thử gửi lại giúp mình nhé — " +
          "hoặc gõ số tiền để mình ghi tay.");
        return;
      }
      {
        const bookUid = zaloBookUid(uid); // account collegato o libro Zalo
        // Ogni passo qui può fallire (URL CDN scaduto, foto illeggibile, quota
        // Claude). Prima il fallimento era muto: l'utente mandava la foto e il
        // bot non rispondeva NULLA — indistinguibile da "il prodotto è rotto".
        let entry;
        try {
          const { base64, mediaType } = await fetchImageBase64(url);
          const extracted = await extractReceipt(base64, mediaType);
          // `source` dice DA DOVE è arrivata la voce, `provenance` QUANTO
          // fidarsene: sono due domande diverse e un prestatore compra solo la
          // seconda. Valori previsti: manual | photo | bank | pos | einvoice.
          entry = { id: "e" + Date.now(), ...extracted, source: "zalo", provenance: "photo", createdAt: new Date().toISOString() };
        } catch (e) {
          console.error("zalo image pipeline:", e.message);
          await sendText(uid,
            "😕 Mình chưa đọc được hoá đơn này. Bạn chụp lại rõ hơn (đủ ánh sáng, thấy rõ số tiền) " +
            "rồi gửi lại giúp mình nhé. Hoặc gõ số tiền để mình ghi tay.");
          return;
        }
        const b = getBook(bookUid);
        b.entries.push(entry);
        persistBook(bookUid);
        await sendText(uid, formatEntryMessage(entry));
      }
    } else if (event.event_name === "user_send_text") {
      const rawText = (event?.message?.text || "").trim();
      const txt = rawText.toLowerCase();
      // 1) È un codice di collegamento valido? → collega l'account e fondi il sổ.
      const linkPhone = /^[A-Z0-9]{6}$/.test(rawText.toUpperCase())
        ? consumeLinkCode(rawText, uid) : null;
      if (linkPhone) {
        const moved = mergeZaloBook(uid, linkPhone);
        const acct = accounts[linkPhone];
        await sendText(uid,
          `✅ Đã kết nối với tài khoản ${acct?.name || linkPhone}.\n` +
          (moved ? `Đã chuyển ${moved} bút toán từ Zalo vào sổ của bạn.\n` : "") +
          `Từ giờ sổ trên Zalo và trên web là một — đại lý thuế cũng xem được.`);
      } else if (matchCommand(rawText) === "fix") {
        // "sửa" era promesso in OGNI conferma di registrazione («Trả lời
        // "sửa" nếu cần chỉnh») e non instradato: chi lo digitava riceveva il
        // menu. Chỉnh = cancella l'ultima voce e invita a rimandarla — molto
        // più robusto di un editor via chat.
        const bookUid = zaloBookUid(uid);
        const b = getBook(bookUid);
        const i = latestCorrectable(b.entries);
        if (!b.entries.length) {
          await sendText(uid,
            `Sổ của bạn chưa có bút toán nào để sửa.\n` +
            `Gửi ảnh hoá đơn hoặc gõ "thu 2tr4" / "chi 500k" để bắt đầu nhé.`);
        } else if (i === -1) {
          // solo aperture dichiarate: si correggono ri-dichiarando, non cancellando
          await sendText(uid,
            `Sổ của bạn chỉ có số liệu tự khai, không có bút toán nào để sửa.\n` +
            `Muốn chỉnh số tự khai, gõ "khai" để xem cách khai lại.`);
        } else {
          const gone = b.entries.splice(i, 1)[0];
          persistBook(bookUid);
          const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
          await sendText(uid,
            `🗑️ Đã xoá bút toán gần nhất:\n` +
            `${gone.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(gone.amount)}\n` +
            (gone.counterparty ? `${gone.counterparty}\n` : "") +
            `Ngày: ${vnDate(gone.date)}\n\n` +
            `Bạn gửi lại ảnh hoá đơn hoặc gõ lại số tiền đúng nhé.`);
        }
      } else if (parseKhaiCommand(rawText)) {
        // ⚠️ ORDINE: PRIMA di parseMoneyCommand. "khai quý 1 thu 360tr"
        // contiene "thu <importo>" e il parser dei soldi lo registrerebbe come
        // incasso di OGGI — l'esatto contrario di un saldo di apertura.
        const k = parseKhaiCommand(rawText);
        const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
        if (k.help) {
          await sendText(uid,
            `📥 Khai thu chi các quý trước\n\n` +
            `Bạn mới dùng Sổ Sạch giữa năm? Hãy khai thu chi các quý trước, ` +
            `nếu không những tháng chưa ghi sẽ bị tính như không bán được gì ` +
            `và thuế cả năm sẽ sai.\n\n` +
            `Cách gõ:\n` +
            `• khai quý 1 thu 360tr\n` +
            `• khai quý 2 thu 360tr chi 90tr\n` +
            `• khai quý 1 thu 0 — xoá số đã khai\n\n` +
            `Số tự khai được ghi riêng (chưa có chứng từ) và không được cộng Điểm Sổ Sạch.`);
        } else {
          const bookUid = zaloBookUid(uid);
          const b = getBook(bookUid);
          const now = new Date();
          const { year } = quarterOf(now);
          const res = applyOpening(b, { year, quarters: { [k.q]: { revenue: k.revenue, expenses: k.expenses } } });
          if (res.error || res.skipped?.length) {
            // un'apertura scartata in silenzio è il bug d'origine di opening.js:
            // il motivo del rifiuto arriva fino all'utente, in vietnamita
            const why = res.error || res.skipped[0]?.why || "";
            await sendText(uid, `⛔ Chưa ghi được số tự khai.\n` + (
              /future/.test(why)
                ? `Quý ${k.q}/${year} chưa tới — chỉ khai được các quý đã qua hoặc quý hiện tại.`
                : /1-4/.test(why)
                  ? `Quý phải từ 1 đến 4 (bạn gõ quý ${k.q}).`
                  : `Bạn kiểm tra lại cú pháp giúp mình: "khai quý 1 thu 360tr".`));
          } else {
            persistBook(bookUid);
            const t = totals(b.entries, { year });
            const st = thresholdStatus(projectAnnual(t.revenue, now));
            const left = Math.max(0, st.taxFree.limit - st.projection);
            const head = res.entries === 0
              ? (res.replaced > 0
                  ? `✅ Đã xoá số tự khai của Quý ${k.q}/${year}.`
                  : `Quý ${k.q}/${year} chưa có số tự khai nào — không có gì để xoá.`)
              : `✅ Đã ghi số tự khai cho Quý ${k.q}/${year}:\n` +
                `📈 Thu: ${k.revenue > 0 ? vnd(k.revenue) : "0đ (đã xoá)"}` +
                (k.hasChi ? `\n📉 Chi: ${k.expenses > 0 ? vnd(k.expenses) : "0đ (đã xoá)"}` : "") +
                `\n(tự khai, chưa có chứng từ)`;
            await sendText(uid,
              head + `\n\n` +
              `Dự kiến cả năm: ${vnd(st.projection)}\n` +
              (st.taxFree.crossed
                ? `⚠️ Đã vượt ngưỡng 1 tỷ — quý này phải nộp thuế. Gõ "quý" để xem số.`
                : `✅ Còn ${vnd(left)} nữa mới tới ngưỡng 1 tỷ.`) +
              `\n\n💡 Số tự khai không được cộng Điểm Sổ Sạch — điểm chỉ tính trên chứng từ thật.`);
          }
        }
      } else if (matchCommand(rawText) === "year") {
        const b = getBook(zaloBookUid(uid));
        const now = new Date();
        const { year } = quarterOf(now);
        const t = totals(b.entries, { year });
        const st = thresholdStatus(projectAnnual(t.revenue, now));
        const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
        const left = Math.max(0, st.taxFree.limit - st.projection);
        await sendText(uid,
          `📒 Sổ năm ${year}\n\n` +
          `Thu:      ${vnd(t.revenue)}\n` +
          `Chi:      ${vnd(t.expenses)}\n` +
          `Lãi gộp:  ${vnd(t.net)}\n\n` +
          `Dự kiến cả năm: ${vnd(st.projection)}\n` +
          (st.taxFree.crossed
            ? `⚠️ Đã vượt ngưỡng 1 tỷ — quý này phải nộp thuế. Gõ "quý" để xem số.`
            : `✅ Còn ${vnd(left)} nữa mới tới ngưỡng 1 tỷ.`) +
          `\n\nGõ "quý" để xem quý này và hạn nộp tờ khai.`);
      } else if (matchCommand(rawText) === "quarter") {
        // La domanda che il prodotto esiste per rispondere: la 01/CNKD si
        // deposita per TRIMESTRE, e finora sul canale dove vive il cliente
        // questa era l'unica cosa che non si poteva chiedere.
        const b = getBook(zaloBookUid(uid));
        await sendText(uid, formatQuarterMessage(buildDeclaration(b)));
      } else if (matchCommand(rawText) === "menu") {
        await sendText(uid, menuText({ linked: !!findAccountByZaloId(uid) }));
      } else if (parseMoneyCommand(rawText)) {
        // Il totale di fine giornata scritto a mano: la via principale per il
        // FATTURATO di un quán, dove le foto funzionano solo per le spese.
        const cmd = parseMoneyCommand(rawText);
        const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
        if (cmd.needsType) {
          // Non si indovina: per un quán sarebbe quasi sempre incasso, ma
          // "quasi sempre" in un registro fiscale è una voce sbagliata che
          // sembra giusta. Una domanda costa un messaggio.
          await sendText(uid,
            `Bạn muốn ghi ${vnd(cmd.amount)} là khoản nào?\n` +
            `• Gõ "thu ${cmd.amount}" nếu là tiền bán hàng\n` +
            `• Gõ "chi ${cmd.amount}" nếu là tiền mua/chi phí`);
        } else {
          const bookUid = zaloBookUid(uid);
          const entry = {
            id: "e" + Date.now(),
            type: cmd.type,
            amount: cmd.amount,
            date: todayVN(),
            counterparty: cmd.type === "thu" ? "Khách lẻ" : "",
            description: cmd.type === "thu" ? "Tổng bán trong ngày" : "Ghi tay",
            source: "zalo",
            provenance: "manual",
            createdAt: new Date().toISOString(),
          };
          const b = getBook(bookUid);
          b.entries.push(entry);
          persistBook(bookUid);
          await sendText(uid, formatEntryMessage(entry));
        }
      } else {
        await sendText(uid, menuText({ linked: !!findAccountByZaloId(uid) }));
      }
    }
  } catch (e) { console.error("zalo webhook:", e.message); }
}

app.use(express.json({ limit: "12mb" }));
app.use(authOptional);

// ---- Zalo domain ownership -------------------------------------------------------
// Zalo offre due prove: meta tag nell'index e file HTML alla radice. Le serviamo
// ENTRAMBE: il crawler dichiara di leggere solo i primi 512kb e di poter metterci
// fino a 72 ore, quindi due strade indipendenti riducono i giri a vuoto.
// Il token non è un segreto — è un valore pubblico di proprietà del dominio.
//
// ⚠️ Zalo emette un token DIVERSO per ogni dominio, e lo stesso servizio risponde
// su PIÙ domini (sosach.com.vn e so-sach.onrender.com). Un token solo non basta:
// scrivendo quello nuovo si romperebbe la verifica del dominio già approvato —
// e quello vecchio è il dominio su cui gira l'app in revisione. Quindi il token
// si sceglie in base all'Host della richiesta.
//
//   ZALO_VERIFY_TOKENS = "sosach.com.vn:TOKEN_A,so-sach.onrender.com:TOKEN_B"
//   ZALO_VERIFY_TOKEN  = "TOKEN"   ← forma vecchia, vale per ogni host
//
const ZALO_VERIFY_DEFAULT = "OixcA-RyFGWdzfqtmVCCBa3ntIgiXmTmE3Kv";

const VERIFY_BY_HOST = new Map();
for (const pair of (process.env.ZALO_VERIFY_TOKENS || "").split(",")) {
  const i = pair.indexOf(":");
  if (i < 1) continue;
  const host = pair.slice(0, i).trim().toLowerCase();
  const token = pair.slice(i + 1).trim();
  if (host && token) VERIFY_BY_HOST.set(host, token);
}
if (process.env.ZALO_VERIFY_TOKEN) {
  VERIFY_BY_HOST.set("*", process.env.ZALO_VERIFY_TOKEN.trim());
}
const ALL_VERIFY_TOKENS = new Set([ZALO_VERIFY_DEFAULT, ...VERIFY_BY_HOST.values()]);
if (VERIFY_BY_HOST.size) {
  console.log("zalo: token di verifica per host →",
    [...VERIFY_BY_HOST].map(([h, t]) => `${h}=${t.slice(0, 8)}…`).join(" "));
}

function verifyTokenFor(req) {
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();
  return VERIFY_BY_HOST.get(host) || VERIFY_BY_HOST.get("*") || ZALO_VERIFY_DEFAULT;
}

// Serviamo il file di verifica per OGNI token conosciuto: il crawler lo chiede
// sul proprio dominio, e rispondere solo all'ultimo configurato è ciò che
// romperebbe il dominio precedente.
app.use((req, res, next) => {
  const m = req.path.match(/^\/zalo_verifier(.+)\.html$/);
  if (m && ALL_VERIFY_TOKENS.has(m[1])) return res.type("html").send(m[1]);
  next();
});

// Il meta tag vive in public/index.html con il token di default; per gli altri
// host lo riscriviamo al volo. Il file si legge una volta, le varianti si
// costruiscono una volta per token.
const INDEX_PATH = join(__dirname, "public", "index.html");
let indexRaw = null;
try {
  indexRaw = readFileSync(INDEX_PATH, "utf8");
} catch (e) {
  console.error("zalo verify meta:", e.message);     // si ricade sul file statico
}
const indexByToken = new Map();
app.get(["/", "/index.html"], (req, res, next) => {
  if (!indexRaw) return next();
  const token = verifyTokenFor(req);
  if (token === ZALO_VERIFY_DEFAULT) return next();  // il file statico ha già questo
  if (!indexByToken.has(token)) {
    indexByToken.set(token, indexRaw.replaceAll(ZALO_VERIFY_DEFAULT, token));
  }
  res.type("html").send(indexByToken.get(token));
});

// ---- Zalo OA: rilascio iniziale dei token ----------------------------------------
// L'admin OA concede i permessi su oauth.zaloapp.com; Zalo rimanda qui con un
// `oa_code` monouso che scambiamo subito per access + refresh token. Da quel
// momento la catena vive nello store e si rinnova da sola: NON serve incollare
// ZALO_OA_ACCESS_TOKEN / ZALO_OA_REFRESH_TOKEN nelle env.
//
// Non protetta da token admin di proposito: l'unico modo di arrivarci con un
// codice valido è essere stati mandati da Zalo dopo aver concesso i permessi
// sulla NOSTRA app. Un codice inventato fallisce lo scambio e non tocca nulla.
// La pagina non mostra mai i token: solo l'esito e la scadenza.
app.get("/zalo/oa-callback", async (req, res) => {
  const code = req.query.oa_code || req.query.code || null;
  if (!code) {
    return res.status(400).type("html").send(
      "<h3>Thiếu oa_code</h3><p>Mở lại đường dẫn cấp quyền từ developers.zalo.me.</p>");
  }
  try {
    const t = await exchangeOaCode(code, req.query.code_verifier || null);
    const mins = Math.round((t.expiresAt - Date.now()) / 60000);
    console.log(`zalo: catena token creata da oa_code — scade tra ${mins} min, refresh=${!!t.refreshToken}`);
    res.type("html").send(
      `<h3>✅ Đã kết nối Official Account</h3>
       <p>Access token hết hạn sau <b>${mins} phút</b>, tự động gia hạn${t.refreshToken ? "" : " — ⚠️ KHÔNG có refresh token"}.</p>
       <p>Kiểm tra: <a href="/healthz">/healthz</a></p>`);
  } catch (e) {
    console.error("zalo oa-callback:", e.message);
    res.status(400).type("html").send(
      `<h3>❌ Không đổi được oa_code</h3><pre>${String(e.message).slice(0, 300)}</pre>
       <p>Mã chỉ dùng được một lần và hết hạn rất nhanh — hãy bấm lại đường dẫn cấp quyền.</p>`);
  }
});

app.use(express.static(join(__dirname, "public")));

// ---- Config --------------------------------------------------------------------
app.get("/api/config", (_req, res) =>
  res.json({
    extraction: extractionMode(),
    zalo: zaloEnabled(),
    store: storeMode(),
    billing: payosEnabled() ? "payos" : "pilot",
    plans: PLANS,
    thresholds: THRESHOLDS,
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { vi: c.vi, en: c.en, vat: c.vat, pit: c.pit, examples_vi: c.examples_vi, examples_en: c.examples_en }])),
  })
);

// ---- Auth ----------------------------------------------------------------------
app.post("/api/auth/register", (req, res) => {
  const out = register(req.body || {});
  if (out.error) return res.status(400).json({ error: out.error });
  // il libro nasce col nome dell'account
  const b = getBook("u:" + out.account.phone);
  if (!b.profile.name && out.account.name) { b.profile.name = out.account.name; persistBook("u:" + out.account.phone); }
  res.json({ ok: true, token: out.token, account: publicAccount(out.account) });
});

app.post("/api/auth/login", (req, res) => {
  const out = login(req.body || {});
  if (out.error) return res.status(400).json({ error: out.error });
  res.json({ ok: true, token: out.token, account: publicAccount(out.account) });
});

app.get("/api/auth/me", (req, res) =>
  res.json({ ok: true, account: publicAccount(req.account), subActive: subActive(req.account) }));

// Utente web → genera un codice da inviare all'OA Sổ Sạch su Zalo per collegare
// il proprio zaloId all'account (poi il sổ Zalo si fonde qui).
app.post("/api/link/zalo-code", requireAuth, (req, res) =>
  res.json({ ok: true, code: createLinkCode(req.phone), expiresInMinutes: 15 }));

// hộ → collega il proprio đại lý thuế con il codice invito
app.post("/api/link-agent", requireAuth, (req, res) => {
  const agent = findAgentByCode(req.body?.code);
  if (!agent) return res.status(404).json({ error: "Không tìm thấy mã đại lý." });
  req.account.agentPhone = agent.phone;
  persistAccount(req.phone);
  res.json({ ok: true, agent: { name: agent.name, phone: agent.phone } });
});

// ---- Billing -------------------------------------------------------------------
app.post("/api/billing/subscribe", requireAuth, async (req, res) => {
  const planKey = String(req.body?.plan || "co_ban");
  if (!PLANS[planKey]) return res.status(400).json({ error: "unknown plan" });
  if (payosEnabled()) {
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const out = await createPaymentLink({ planKey, phone: req.phone, baseUrl });
    if (out.error) return res.status(502).json({ error: out.error });
    req.account.pendingOrder = { orderCode: out.orderCode, plan: planKey };
    persistAccount(req.phone);
    return res.json({ ok: true, mode: "payos", checkoutUrl: out.checkoutUrl });
  }
  // Pilot mode: attivazione founder gratuita (30 giorni), nessun pagamento.
  const sub = activateSub(req.account, planKey, { pilot: true });
  persistAccount(req.phone);
  res.json({ ok: true, mode: "pilot", sub });
});

app.post("/webhooks/payos", (req, res) => {
  if (!verifyPayosWebhook(req.body)) return res.status(401).json({ error: "bad signature" });
  const data = req.body?.data || {};
  const acct = Object.values(accounts).find((a) => a.pendingOrder?.orderCode === data.orderCode);
  if (acct && (data.code === "00" || req.body.success === true)) {
    activateSub(acct, acct.pendingOrder.plan, { pilot: false });
    delete acct.pendingOrder;
    persistAccount(acct.phone);
  }
  res.json({ ok: true });
});

// ---- Estrazione da foto ----------------------------------------------------------
app.post("/api/extract", rateLimit({ windowMs: 15 * 60_000, max: 15, globalMax: 400, name: "extract" }), async (req, res) => {
  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: "image (base64) required" });
  try {
    const extracted = await extractReceipt(image, mediaType || "image/jpeg");
    res.json({ ok: true, extracted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Libro ----------------------------------------------------------------------
function ledgerPayload(uid) {
  const b = getBook(uid);
  const now = new Date();
  const { q, year } = quarterOf(now);   // anno e trimestre VIETNAMITI, non del server
  const tYear = totals(b.entries, { year });
  const tQuarter = totals(b.entries, { year, q });
  const projection = projectAnnual(tYear.revenue, now);
  // Serie mensile per il grafico cash-flow (anno corrente).
  const monthly = Array.from({ length: 12 }, () => ({ thu: 0, chi: 0 }));
  for (const e of b.entries) {
    // Stessa trappola di totals(): "2026-01-01" letto come istante sparirebbe
    // dal grafico a ovest di Greenwich. Si leggono i campi dalla stringa.
    const p = partsOf(e.date);
    if (p && p.year === year) monthly[p.month - 1][e.type === "thu" ? "thu" : "chi"] += e.amount;
  }
  return {
    profile: b.profile,
    entries: [...b.entries].sort((a, z) => z.date.localeCompare(a.date)).slice(0, 500),
    year: { ...tYear, label: String(year) },
    quarter: { ...tQuarter, label: `Q${q}/${year}` },
    monthly,
    thresholds: thresholdStatus(projection),
    tax: quarterlyTax(tQuarter.revenue, b.profile.category, projection),
    deadline: nextDeadline(now),
    score: sosachScore(b, now),
  };
}

app.get("/api/ledger", (req, res) => res.json(ledgerPayload(uidFor(req))));

app.post("/api/ledger", (req, res) => {
  const uid = uidFor(req);
  const { type, amount, date, counterparty, description } = req.body || {};
  if (!["thu", "chi"].includes(type) || !Number(amount))
    return res.status(400).json({ error: "type thu|chi e amount richiesti" });
  const b = getBook(uid);
  const entry = {
    id: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
    type, amount: Math.round(Number(amount)),
    date: date || todayVN(),
    counterparty: String(counterparty || "").slice(0, 120),
    description: String(description || "").slice(0, 200),
    source: "web", createdAt: new Date().toISOString(),
  };
  b.entries.push(entry);
  persistBook(uid);
  res.json({ ok: true, entry });
});

app.delete("/api/ledger/:id", (req, res) => {
  const uid = uidFor(req);
  const b = getBook(uid);
  const before = b.entries.length;
  b.entries = b.entries.filter((e) => e.id !== req.params.id);
  persistBook(uid);
  res.json({ ok: true, removed: before - b.entries.length });
});

app.post("/api/profile", (req, res) => {
  const uid = uidFor(req);
  const b = getBook(uid);
  const { name, category, revenueEstimate } = req.body || {};
  if (name !== undefined) b.profile.name = String(name).slice(0, 120);
  if (category && CATEGORIES[category]) b.profile.category = category;
  if (revenueEstimate !== undefined) b.profile.revenueEstimate = Math.max(0, Number(revenueEstimate) || 0);
  persistBook(uid);
  res.json({ ok: true, profile: b.profile });
});

// ---- Bảng đại lý thuế (bản trình diễn) + hồ sơ tín dụng danh mục -----------------
// Pubblico e senza login: è la storia di distribuzione (un agente → decine di hộ)
// e il dato aggregato che un istituto di credito comprerebbe. Prima erano
// visibili solo a un agente con clienti reali, cioè mai in una demo.
app.get("/api/agent/demo", rateLimit({ windowMs: 60_000, max: 30, name: "agentdemo" }),
  (_req, res) => res.json({ ok: true, ...demoAgency() }));

// ---- Danh sách chờ pilot (thay cho mailto) ---------------------------------------
// Il CTA era un mailto:, che su mobile perde il lead. Qui il contatto entra in
// Postgres e sopravvive ai redeploy: è la pipeline delle prime 100 hộ.
app.post("/api/waitlist", rateLimit({ windowMs: 60 * 60_000, max: 8, name: "waitlist" }), (req, res) => {
  const { name, phone, city, role } = req.body || {};
  const p = normalizePhone(phone);
  if (!p) return res.status(400).json({ error: "Số điện thoại không hợp lệ." });
  const existing = leads[p];
  // Un reinvio non deve MAI impoverire un lead già raccolto: si aggiornano solo
  // i campi valorizzati (un secondo invio col nome vuoto cancellava il nome).
  const keep = (fresh, old, len) => {
    const v = String(fresh ?? "").trim().slice(0, len);
    return v || old || "";
  };
  leads[p] = {
    phone: p,
    name: keep(name, existing?.name, 120),
    city: keep(city, existing?.city, 80),
    role: role === "agent" || role === "ho" ? role : (existing?.role || "ho"),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  persistLead(p);
  // la posizione è prova sociale onesta: numero reale, nessun gonfiaggio
  res.json({ ok: true, position: Object.keys(leads).length, already: !!existing });
});

// Conteggio pubblico (solo numero, mai i contatti).
app.get("/api/waitlist/count", (_req, res) => res.json({ ok: true, count: Object.keys(leads).length }));

// Export per Yuri — protetto da ADMIN_TOKEN; senza token la rotta non esiste.
app.get("/api/waitlist", (req, res) => {
  const tok = process.env.ADMIN_TOKEN;
  if (!tok || req.get("X-Admin-Token") !== tok) return res.status(404).json({ error: "not found" });
  res.json({ ok: true, count: Object.keys(leads).length, leads: Object.values(leads) });
});

// ---- Sổ mẫu (demo per utenti/investitori — solo sandbox anonime) ------------------
app.post("/api/demo-seed", (req, res) => {
  if (req.phone) return res.status(403).json({ error: "Sổ mẫu chỉ dành cho bản dùng thử (chưa đăng nhập)." });
  const b = getBook(uidFor(req));
  b.entries = b.entries.filter((e) => !e.sample); // niente doppioni se ritappato
  b.entries.push(...sampleEntries());
  if (!b.profile.name) Object.assign(b.profile, SAMPLE_PROFILE);
  persistBook(uidFor(req));
  res.json({ ok: true, added: b.entries.filter((e) => e.sample).length });
});

app.delete("/api/demo-seed", (req, res) => {
  const b = getBook(uidFor(req));
  const before = b.entries.length;
  b.entries = b.entries.filter((e) => !e.sample);
  if (b.profile.name === SAMPLE_PROFILE.name) b.profile.name = "";
  persistBook(uidFor(req));
  res.json({ ok: true, removed: before - b.entries.length });
});

// ---- Export CSV (BOM per Excel, apre pulito con dấu tiếng Việt) -------------------
app.get("/api/export.csv", (req, res) => {
  const uid = uidFor(req);
  const b = getBook(uid);
  const rows = [["Ngày", "Loại", "Số tiền (VND)", "Đối tác", "Mô tả", "Nguồn"]];
  for (const e of [...b.entries].sort((a, z) => a.date.localeCompare(z.date))) {
    rows.push([e.date, e.type === "thu" ? "Thu" : "Chi", e.amount, e.counterparty || "", e.description || "", e.source || ""]);
  }
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="so-sach-${todayVN()}.csv"`);
  res.send(csv);
});

// ---- Tờ khai 01/CNKD --------------------------------------------------------------
app.get("/api/declaration", (req, res) => {
  const b = getBook(uidFor(req));
  const d = buildDeclaration(b, { year: req.query.year, q: req.query.q });
  const agent = req.account?.agentPhone ? accounts[req.account.agentPhone] : null;
  res.json({ ...d, agent: agent ? { name: agent.name, phone: agent.phone } : null });
});

// ---- Số dư đầu kỳ (chi arriva a metà anno) ---------------------------------
// Senza queste cifre `projectAnnual()` legge i mesi in bianco come mesi senza
// incassi e dice "miễn thuế" a chi ha già superato il miliardo — vedi
// src/opening.js per il conto completo.
app.get("/api/opening", (req, res) => {
  const year = Number(req.query.year) || Number(todayVN().slice(0, 4));
  res.json({ ok: true, year, quarters: openingOf(getBook(uidFor(req)), year) });
});

app.post("/api/opening", (req, res) => {
  const uid = uidFor(req);
  const b = getBook(uid);
  const out = applyOpening(b, req.body || {}, todayVN());
  if (out.error) return res.status(400).json({ error: out.error });
  persistBook(uid);
  res.json({ ok: true, ...out, ledger: ledgerPayload(uid) });
});

// ---- Đại lý thuế (agent) dashboard -------------------------------------------------
app.get("/api/agent/clients", requireAuth, (req, res) => {
  if (req.account.role !== "agent") return res.status(403).json({ error: "Chỉ dành cho đại lý thuế." });
  const now = new Date();
  const year = now.getFullYear();
  const { q } = quarterOf(now);
  const clients = Object.values(accounts)
    .filter((a) => a.role === "ho" && a.agentPhone === req.phone)
    .map((a) => {
      const b = getBook("u:" + a.phone);
      const tQ = totals(b.entries, { year, q });
      const tY = totals(b.entries, { year });
      const projection = projectAnnual(tY.revenue, now);
      const tax = quarterlyTax(tQ.revenue, b.profile.category, projection);
      return {
        phone: a.phone, name: b.profile.name || a.name || a.phone,
        category: b.profile.category,
        entries: b.entries.length,
        quarterRevenue: tQ.revenue, quarterTax: tax.total, exempt: tax.exempt,
        subActive: subActive(a),
      };
    });
  res.json({ ok: true, agentCode: req.account.agentCode, quarter: `Q${q}/${year}`, clients });
});

app.get("/api/agent/client/:phone", requireAuth, (req, res) => {
  if (req.account.role !== "agent") return res.status(403).json({ error: "Chỉ dành cho đại lý thuế." });
  const phone = normalizePhone(req.params.phone);
  const client = phone && accounts[phone];
  if (!client || client.agentPhone !== req.phone) return res.status(404).json({ error: "Không phải khách của bạn." });
  res.json({ ok: true, client: { phone, name: client.name }, ...ledgerPayload("u:" + phone) });
});

app.get("/healthz", (_req, res) => res.json({
  ok: true, store: storeMode(), billing: payosEnabled() ? "payos" : "pilot",
  // expiresInMin rende visibile a colpo d'occhio se la catena token è viva:
  // è l'unico modo per accorgersi che il bot ha smesso di rispondere.
  zalo: tokenStatus(),
}));

// ---- Boot -------------------------------------------------------------------------
const mode = await initStore(DATA_DIR);
// I token Zalo vivono nello store (il refresh_token ruota): le env sono solo
// il seme del primo avvio. Va dopo initStore, che popola `settings`.
await bootstrapFromEnv();
app.listen(PORT, () =>
  console.log(`📒 Sổ Sạch http://localhost:${PORT} (extraction: ${extractionMode()}, zalo: ${zaloEnabled()}, store: ${mode}, billing: ${payosEnabled() ? "payos" : "pilot"})`));
