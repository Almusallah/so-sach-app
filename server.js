// ============================================================================
//  Sổ Sạch — server. Sổ sách kế toán AI cho hộ kinh doanh.
//  Foto scontrino → voce di sổ → soglie fiscali → tờ khai trimestrale.
//  Near-final: account (SĐT+PIN), ruoli hộ/đại lý thuế, storage JSON↔Postgres,
//  billing payOS (env-gated, pilot mode senza chiavi), export CSV, Zalo OA.
// ============================================================================
import express from "express";
import crypto from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  THRESHOLDS, CATEGORIES, totals, projectAnnual, quarterlyTax,
  thresholdStatus, quarterOf, nextDeadline, partsOf,
} from "./src/tax.js";
import { extractReceipt, extractionMode } from "./src/extract.js";
import { zaloEnabled, verifyWebhook, webhookSecretStatus, sendText, fetchImageBase64, formatEntryMessage, formatQuarterMessage, formatYearMessage, formatLowConfidenceMessage, tokenStatus, vnDate } from "./src/zalo.js";
import { matchCommand, matchCommandFuzzy, matchLangCommand, normalize, menuText, parseKhaiCommand } from "./src/commands.js";
import { makePendingStore } from "./src/pending.js";
import { buildDeclaration } from "./src/declaration.js";
import { bootstrapFromEnv, exchangeOaCode } from "./src/zalo_token.js";
import {
  initStore, storeMode, books, accounts, leads, getBook,
  persistBook, persistAccount,
  mutateBookDurable, mergeBooksDurable, persistAccountDurable, persistLeadDurable, _durability,
} from "./src/store.js";
import { register, login, publicAccount, findAgentByCode, findAccountByZaloId, createLinkCode, consumeLinkCode, authOptional, requireAuth, normalizePhone } from "./src/auth.js";
import { PLANS, payosEnabled, createPaymentLink, verifyPayosWebhook, activateSub, subActive } from "./src/billing.js";
import { sosachScore } from "./src/score.js";
import { parseMoneyCommand } from "./src/amount.js";
import { todayVN } from "./src/vndate.js";
import { applyOpening, openingOf, declaredRevenue, latestCorrectable } from "./src/opening.js";
import { sampleEntries, SAMPLE_PROFILE } from "./src/sample.js";
import { demoAgency } from "./src/demo_agency.js";
import { validateSheetsUrl, buildSheetsPayload, makePushQueue, pushToSheet } from "./src/sheets.js";
import { mintClaimToken, verifyClaimToken, claimPromptFor, claimReminderLine, makeClaimLinkSource } from "./src/claim.js";

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

// uid del libro: account autenticato → "u:<phone>"; altrimenti sandbox anonima.
// ?uid= arriva dal client e NON deve mai poter indirizzare i namespace
// riservati ("u:<phone>", "zalo:<id>"): senza questo filtro chiunque, senza
// token, leggeva e scriveva il libro di un account reale indovinando il
// telefono. Le sandbox anonime del sito sono id opachi senza ":" (public/app.js),
// quindi ammettiamo solo quelli; tutto il resto ricade su "demo".
const SANDBOX_UID = /^[A-Za-z0-9_-]{1,64}$/;
const uidFor = (req) => {
  if (req.phone) return "u:" + req.phone;
  const q = String(req.query.uid || "");
  return SANDBOX_UID.test(q) ? q : "demo";
};

// Libro per un utente Zalo: se il suo zaloId è collegato a un account →
// "u:<phone>" (visibile su web e all'đại lý thuế); altrimenti "zalo:<id>".
const zaloBookUid = (zaloId) => {
  const acct = findAccountByZaloId(zaloId);
  return acct ? "u:" + acct.phone : "zalo:" + zaloId;
};

// Fonde il libro Zalo pre-collegamento nell'account e rimuove l'orfano.
// Gira sotto ENTRAMBE le code (mergeBooksDurable): una voce concorrente sulla
// sorgente o arriva prima (fusa) o si accoda dopo (sorgente già rimossa —
// vedi writeZaloEntry per il re-instradamento). La destinazione è durevole
// PRIMA della rimozione della sorgente: un crash in mezzo lascia al peggio un
// doppione visibile al riavvio, mai una perdita.
// Torna { ok:true, moved } oppure { ok:false, error } (niente merge avvenuto).
async function mergeZaloBook(zaloId, phone) {
  const srcUid = "zalo:" + zaloId, dstUid = "u:" + phone;
  if (!books[srcUid]?.entries?.length) return { ok: true, moved: 0 };
  const out = await mergeBooksDurable(srcUid, dstUid, (src, dst) => {
    if (!src?.entries?.length) return 0;
    dst.entries.push(...src.entries);
    // L'eventuale config Google Sheets migra sul libro di destinazione PRIMA
    // della rimozione: un timer di push pendente sul libro cancellato non deve
    // poterlo ricreare vuoto (Code.gs fa clearContents — spazzerebbe il foglio).
    if (src.profile?.sheets && !dst.profile.sheets) dst.profile.sheets = src.profile.sheets;
    return src.entries.length;
  });
  if (!out.ok) return { ok: false, error: out.error };
  // Il libro fuso è appena cambiato (voci nuove e/o config Sheets migrata):
  // senza questo touch il foglio dell'account resta indietro fino alla
  // PROSSIMA mutazione — che può arrivare fra giorni.
  sheetsQueue.touch(dstUid);
  return { ok: true, moved: out.result };
}

// Scrive UNA voce sul libro Zalo giusto anche quando un claim/link fonde il
// libro DURANTE l'elaborazione: l'estrazione foto dura secondi, e "manda la
// ricevuta, tocca subito il claim-link" è la sequenza canonica. Dopo la
// scrittura durevole si ricontrolla l'instradamento: se nel frattempo lo
// zaloId si è collegato a un account, la voce non deve restare su un libro
// orfano invisibile — la si sposta (dedup per id: se il merge l'ha già
// copiata, non si duplica).
async function writeZaloEntry(zaloId, entry) {
  const writeUid = zaloBookUid(zaloId);
  let saved = await mutateBookDurable(writeUid, (b) => { b.entries.push(entry); });
  if (!saved.ok) return { ok: false, uid: writeUid };
  const freshUid = zaloBookUid(zaloId);
  if (freshUid === writeUid) return { ok: true, uid: writeUid };
  if (books[writeUid]?.entries?.some((e) => e.id === entry.id)) {
    await mutateBookDurable(writeUid, (b) => {
      const i = b.entries.findIndex((e) => e.id === entry.id);
      if (i >= 0) b.entries.splice(i, 1);
    });
  }
  saved = await mutateBookDurable(freshUid, (b) => {
    if (!b.entries.some((e) => e.id === entry.id)) b.entries.push(entry);
  });
  return { ok: saved.ok, uid: freshUid };
}

// I due volti di "non ho potuto salvare": la promessa del prodotto è che una
// voce CONFERMATA è nel sổ, quindi quando la persistenza fallisce l'unica
// risposta onesta è "niente è stato registrato, riprova" — mai la conferma.
const SAVE_FAIL_VI = "Chưa lưu được vào sổ — hệ thống lưu trữ đang gặp sự cố, chưa có gì được ghi. Bạn thử lại giúp mình nhé.";
const saveFailText = (lang) => lang === "en"
  ? "⚠️ I couldn't save that to your book (storage hiccup) — nothing was recorded. Please try again in a minute."
  : "⚠️ Mình chưa lưu được vào sổ (hệ thống lưu trữ đang gặp sự cố) — chưa có gì được ghi. Bạn thử lại sau một phút nhé.";

// Rifiuto DENTRO una mutazione durevole: lanciare questo dentro il callback di
// mutateBookDurable ripristina lo snapshot e NON persiste nulla — serve al
// "khai", dove applyOpening può applicare il thu e scartare il chi, e il
// messaggio all'utente dice "chưa ghi được": la memoria deve dire lo stesso.
class RefuseMutation extends Error {
  constructor(payload) { super("refused"); this.payload = payload; }
}

// ---- Google Sheets: motore di push ------------------------------------------------
// Il libro è la fonte di verità, il foglio è una vista: un push fallito si
// logga e finisce in lastPushOk, MAI blocca la scrittura contabile.
// retries: 2 con backoff sul push automatico, 0 su config/push manuale
// (lì l'utente vede l'errore in chiaro e riprova).
async function sheetsPushNow(uid, { retries = 0 } = {}) {
  // books[uid] diretto, NON getBook: un libro rimosso (merge Zalo→account)
  // non va MAI ricreato vuoto da un push in ritardo — Code.gs fa clearContents
  // e un libro vuoto spazzerebbe le tab del foglio dell'utente.
  const b = books[uid];
  if (!b) return { ok: false, error: "Sổ không tồn tại" };
  const cfg = b.profile?.sheets;
  if (!cfg?.url || !cfg?.secret) return { ok: false, error: "Chưa kết nối Google Sheets" };
  const payload = buildSheetsPayload(b);
  let out = { ok: false, error: "?" };
  for (let i = 0; i <= retries; i++) {
    if (i) await new Promise((r) => setTimeout(r, i * 2000)); // backoff 2s, 4s
    try { out = await pushToSheet(cfg.url, cfg.secret, payload); }
    catch (e) { out = { ok: false, error: e.message }; }
    if (out.ok) break;
  }
  cfg.lastPushAt = new Date().toISOString();
  cfg.lastPushOk = !!out.ok;
  persistBook(uid);
  if (!out.ok) console.error(`sheets push ${uid}:`, out.error);
  return out;
}

// Push AUTOMATICO: 30 s di quiete dopo l'ULTIMA mutazione, un timer per uid
// (un fiume di foto non produce un fiume di push). La pushFn non lancia mai
// verso l'esterno e ignora "demo" (libro condiviso fra tutti gli anonimi:
// il foglio di uno non deve ricevere i libri di tutti) e i libri senza config.
const SHEETS_DEBOUNCE_MS = Number(process.env.SHEETS_DEBOUNCE_MS) || 30_000;
const sheetsQueue = makePushQueue(async (uid) => {
  try {
    if (uid === "demo") return;
    if (!books[uid]?.profile?.sheets) return;
    await sheetsPushNow(uid, { retries: 2 });
  } catch (e) { console.error("sheets auto-push:", e.message); }
}, { delayMs: SHEETS_DEBOUNCE_MS });

// ---- Claim-link: onboarding Zalo-first → account (docs/ONBOARDING_SPEC.md) --------
// L'utente solo-Zalo riceve, DOPO la prima voce registrata, un link firmato a
// un tocco che porta il suo libro dentro un account web — mai un codice da
// copiare. Stesso segreto delle sessioni: il token claim è a tutti gli effetti
// una credenziale a scadenza (72h) per il SOLO libro zalo:<id>.
const CLAIM_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || "https://sosach.com.vn").replace(/\/+$/, "");

// Registro monouso del claim. La verità PERSISTITA vive sul libro zalo
// (claimTokenHash / claimTokenUsedAt: sopravvivono al riavvio); la mappa in
// memoria copre solo l'uid che un libro non ce l'ha ancora (reminder da
// "menu" prima della prima voce). Un account già collegato vale "usato" anche
// quando il merge ha rimosso il libro zalo: è il backstop contro il riuso.
const claimHashMem = new Map();
const claimRegistry = {
  getCurrentHash: (zaloId) => books["zalo:" + zaloId]?.claimTokenHash || claimHashMem.get(zaloId) || null,
  setCurrentHash: (zaloId, hash) => {
    claimHashMem.set(zaloId, hash);
    const b = books["zalo:" + zaloId];
    if (b) { b.claimTokenHash = hash; persistBook("zalo:" + zaloId); }
  },
  isUsed: (zaloId) => !!findAccountByZaloId(zaloId) || !!books["zalo:" + zaloId]?.claimTokenUsedAt,
  markUsed: (zaloId) => {
    const b = books["zalo:" + zaloId];
    if (b) { b.claimTokenUsedAt = new Date().toISOString(); persistBook("zalo:" + zaloId); }
  },
};

// Ogni link coniato registra il proprio hash: UN token per uid alla volta,
// rigenerare invalida il precedente (spec, Guardie). Ma il link si RIUSA
// finché è vivo: prima di questa factory ogni «menu» e ogni testo sconosciuto
// coniava (e quindi ruotava) il token, uccidendo il link della CTA appena
// l'utente scriveva qualunque cosa non riconosciuta — il tocco di conversione
// più prezioso moriva in mano all'utente. Si conia solo se assente/scaduto/
// superato/consumato (vedi makeClaimLinkSource in src/claim.js).
const claimLinkFor = makeClaimLinkSource({
  secret: CLAIM_SECRET, registry: claimRegistry, origin: PUBLIC_ORIGIN,
});

// CTA una-tantum in coda alla PRIMA conferma di scrittura di un uid NON
// collegato (flag claimPromptedAt sul libro — la decisione vive in
// claimPromptFor, testabile da sola). Il mint avviene solo se la CTA esce.
function claimCtaFor(zaloId, bookUid, lang) {
  if (bookUid !== "zalo:" + zaloId) return "";   // collegato: il libro è "u:<phone>"
  const b = books[bookUid];
  if (!b || b.claimPromptedAt) return "";
  const cta = claimPromptFor(b, claimLinkFor(zaloId), lang);
  if (cta) persistBook(bookUid);                 // il flag deve sopravvivere al riavvio
  return cta;
}

// Re-prompt breve: SOLO in coda al menu e a "quý" (spec, Flusso §2 — mai su
// ogni risposta), e solo per uid non collegati.
function claimReminderFor(zaloId, lang) {
  if (findAccountByZaloId(zaloId)) return "";
  return "\n\n" + claimReminderLine(claimLinkFor(zaloId), lang);
}

// Le risposte d'errore del claim, in vietnamita garbato + fallback sul flusso
// codice esistente (che RESTA, per chi parte dal web). `code` è per la pagina:
// la copia bilingue vive in claim.html, il testo qui è la rete di sicurezza.
const CLAIM_ERROR_VI = {
  expired: 'Đường dẫn đã hết hạn (72 giờ). Bạn gõ "menu" trong Zalo Sổ Sạch để nhận đường dẫn mới nhé.',
  used: "Đường dẫn này đã được dùng rồi — sổ của bạn đã kết nối. Bạn chỉ cần đăng nhập trên web là thấy sổ.",
  invalid: 'Đường dẫn không hợp lệ hoặc đã được thay bằng đường dẫn mới hơn. Bạn gõ "menu" trong Zalo Sổ Sạch để nhận đường dẫn mới nhé.',
};
const CLAIM_ERROR_STATUS = { expired: 410, used: 409, invalid: 400 };

// ---- Zalo webhook (raw body PRIMA del json parser, per la firma) ---------------
// Deduplica gli eventi Zalo. "Webhook Retry" è ATTIVO lato Zalo: se non
// rispondiamo in fretta, lo stesso messaggio arriva 2-3 volte e la stessa
// ricevuta finisce nel sổ due o tre volte — davanti a un cliente sembra che il
// prodotto conti male. La finestra dei retry è di minuti, quindi basta una
// mappa in memoria con TTL (un riavvio la svuota: è accettabile).
const seenEvents = new Map();
const EVENT_TTL_MS = 10 * 60 * 1000;

// Estrazioni foto a bassa confidenza in attesa di conferma ("1" entro 10 min):
// la voce NON è nel libro finché l'utente non conferma. In memoria per scelta,
// come seenEvents — vedi src/pending.js per la semantica di scarto.
const pendingPhotos = makePendingStore();

// Conferme di CANCELLAZIONE in sospeso ("sửa" ora chiede prima di toccare il
// registro: un typo o un fuzzy non devono più poter cancellare una voce
// fiscale senza un "1" esplicito). Store SEPARATO dalle foto — namespace
// diversi, così un "1" non può mai confermare la cosa sbagliata — e in più i
// due rami si escludono a vicenda: una nuova foto scarta la cancellazione in
// sospeso, e un "sửa" arriva sempre DOPO che lo step 0 ha consumato la foto.
const pendingDeletes = makePendingStore();
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
  // Fail-CLOSED: prima la firma si esigeva solo con la catena token OA viva
  // (zaloEnabled) — con la SOLA chiave di firma configurata i webhook falsi
  // passavano. Ora basta UNA delle due configurazioni per rifiutare una firma
  // che non torna. NODE_ENV=test resta permissivo: l'e2e posta eventi non
  // firmati, e deve continuare a farlo anche se la shell di chi lo lancia ha
  // le env Zalo vere esportate.
  const enforceSig = process.env.NODE_ENV !== "test"
    && (zaloEnabled() || webhookSecretStatus().configured);
  if (!check.ok && enforceSig) return res.status(401).json({ error: "invalid signature" });

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
      // La lingua vive sul PROFILO del libro (condivisa col web via
      // /api/profile). books[] diretto, non getBook: chi manda una foto non
      // deve veder nascere un libro solo per la lettura della lingua.
      const bookUid = zaloBookUid(uid); // account collegato o libro Zalo
      const lang = books[bookUid]?.profile?.lang || "vi";
      // Una nuova foto scarta qualunque proposta rimasta in sospeso: se
      // restasse viva, un "1" tardivo salverebbe la voce VECCHIA sbagliata.
      // Idem per una cancellazione in attesa di conferma: il "1" dopo una foto
      // deve poter confermare SOLO la foto.
      pendingPhotos.take(uid);
      pendingDeletes.take(uid);
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
        await sendText(uid, lang === "en"
          ? "😕 I got the photo but couldn't download it. Please send it again — or type the amount and I'll record it by hand."
          : "😕 Mình nhận được ảnh nhưng chưa tải về được. Bạn thử gửi lại giúp mình nhé — " +
            "hoặc gõ số tiền để mình ghi tay.");
        return;
      }
      {
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
          await sendText(uid, lang === "en"
            ? "😕 I couldn't read this receipt. Take a clearer photo (good light, amount clearly visible) and send it again — or type the amount and I'll record it by hand."
            : "😕 Mình chưa đọc được hoá đơn này. Bạn chụp lại rõ hơn (đủ ánh sáng, thấy rõ số tiền) " +
              "rồi gửi lại giúp mình nhé. Hoặc gõ số tiền để mình ghi tay.");
          return;
        }
        // Confidenza bassa → NIENTE scrittura. Il libro è un registro FISCALE:
        // una voce incerta scritta zitta è il guasto peggiore possibile (sembra
        // giusta). La proposta resta in sospeso 10 minuti e si salva solo con
        // un "1" esplicito — vedi il ramo testo e src/pending.js.
        if (Number(entry.confidence ?? 1) < 0.6) {
          pendingPhotos.put(uid, entry);
          await sendText(uid, formatLowConfidenceMessage(entry, lang));
          return;
        }
        // Durevole PRIMA della conferma: "✅ Đã ghi" si dice solo a voce su
        // disco. writeZaloEntry ricontrolla l'instradamento: un claim arrivato
        // durante i secondi dell'estrazione non lascia la voce su un orfano.
        const saved = await writeZaloEntry(uid, entry);
        if (!saved.ok) { await sendText(uid, saveFailText(lang)); return; }
        sheetsQueue.touch(saved.uid);   // vista Sheets: push dopo la quiete
        // Prima voce di un uid non collegato → CTA claim UNA volta (spec).
        await sendText(uid, formatEntryMessage(entry, lang) + claimCtaFor(uid, saved.uid, lang));
      }
    } else if (event.event_name === "user_send_text") {
      const rawText = (event?.message?.text || "").trim();
      const bookUid = zaloBookUid(uid); // account collegato o libro Zalo
      const lang = books[bookUid]?.profile?.lang || "vi";

      // -1) Cancellazione in attesa di conferma ("sửa" ha chiesto, si aspetta
      //     un "1"): si consuma A OGNI messaggio, come le foto. Solo "1" entro
      //     il TTL cancella; qualunque altro testo annulla IN SILENZIO e
      //     prosegue nel router — mai un messaggio in più da spiegare.
      const pendingDelete = pendingDeletes.take(uid);
      if (pendingDelete && normalize(rawText) === "1") {
        // Ricerca e splice DENTRO la mutazione: atomici rispetto alla coda.
        const saved = await mutateBookDurable(bookUid, (b) => {
          const idx = b.entries.findIndex((e) => e.id === pendingDelete.entryId);
          return idx === -1 ? null : b.entries.splice(idx, 1)[0];
        });
        if (!saved.ok) { await sendText(uid, saveFailText(lang)); return; }
        const gone = saved.result;
        if (!gone) {
          // cancellata nel frattempo (web, altro dispositivo): niente da fare
          await sendText(uid, lang === "en"
            ? "That entry is no longer in the book — nothing to delete."
            : "Bút toán đó không còn trong sổ nữa — không có gì để xoá.");
          return;
        }
        sheetsQueue.touch(bookUid);   // vista Sheets: push dopo la quiete
        const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
        await sendText(uid, lang === "en"
          ? `🗑️ Deleted the latest entry:\n` +
            `${gone.type === "thu" ? "📈 IN" : "📉 OUT"} ${vnd(gone.amount)}\n` +
            (gone.counterparty ? `${gone.counterparty}\n` : "") +
            `Date: ${vnDate(gone.date)}\n\n` +
            `Send the receipt photo again or type the correct amount.`
          : `🗑️ Đã xoá bút toán gần nhất:\n` +
            `${gone.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(gone.amount)}\n` +
            (gone.counterparty ? `${gone.counterparty}\n` : "") +
            `Ngày: ${vnDate(gone.date)}\n\n` +
            `Bạn gửi lại ảnh hoá đơn hoặc gõ lại số tiền đúng nhé.`);
        return;
      }

      // 0) Proposta foto in sospeso: si consuma A OGNI messaggio (take rimuove
      //    sempre, scaduta o no). Solo "1" salva; "2"/"3" ricevono l'aiuto che
      //    le opzioni promettono; qualunque altro testo scarta in silenzio e
      //    prosegue nel router normale.
      const pendingEntry = pendingPhotos.take(uid);
      if (pendingEntry) {
        const choice = normalize(rawText);
        if (choice === "1") {
          // provenance "photo" già sulla voce; durevole prima della conferma
          const saved = await writeZaloEntry(uid, pendingEntry);
          if (!saved.ok) {
            // la proposta torna in sospeso: il "riprova" dell'utente è un
            // nuovo "1", non una nuova foto
            pendingPhotos.put(uid, pendingEntry);
            await sendText(uid, saveFailText(lang));
            return;
          }
          sheetsQueue.touch(saved.uid);   // vista Sheets: push dopo la quiete
          // Anche il "1" di conferma è una scrittura: la CTA claim vale qui.
          await sendText(uid, formatEntryMessage(pendingEntry, lang) + claimCtaFor(uid, saved.uid, lang));
          return;
        }
        if (choice === "2" || choice === "3") {
          // Senza questo ramo "2" cadrebbe su parseMoneyCommand e il bot
          // chiederebbe «vuoi registrare 2đ?» — una domanda assurda un
          // messaggio dopo aver offerto le opzioni numerate.
          await sendText(uid, choice === "2"
            ? (lang === "en"
                ? "👍 Sure — take a clearer photo and send it again, I'll re-read it."
                : "👍 Ok — bạn chụp lại rõ hơn rồi gửi vào đây nhé, mình đọc lại.")
            : (lang === "en"
                ? '⌨️ Type it like this: "thu 2tr4" if it\'s money in, "chi 500k" if it\'s money out.'
                : '⌨️ Bạn gõ như vầy nhé: "thu 2tr4" nếu là tiền bán, "chi 500k" nếu là tiền mua.'));
          return;
        }
        // qualunque altro testo: proposta scartata, il messaggio segue il router
      }

      // 1) È un codice di collegamento valido? → collega l'account e fondi il sổ.
      //    Gira PRIMA di tutto il resto, fuzzy compreso: un codice sbagliato di
      //    una lettera deve restare un codice sbagliato, mai diventare un comando.
      const linkRes = /^[A-Z0-9]{6}$/.test(rawText.toUpperCase())
        ? consumeLinkCode(rawText, uid) : null;
      const linkPhone = linkRes?.phone || null;
      // 2) Cambio lingua: ESATTO dopo normalize, mai fuzzy (commands.js).
      const langSwitch = matchLangCommand(rawText);
      // 3) Parser strutturati + comandi. Il fuzzy (distanza ≤ 1) si tenta SOLO
      //    quando né i parser né il match esatto riconoscono il testo: mai su
      //    importi, mai sugli argomenti di "khai", mai sul cambio lingua.
      const khai = parseKhaiCommand(rawText);
      const money = parseMoneyCommand(rawText);
      const cmd = matchCommand(rawText) ||
        (khai || money || langSwitch ? null : matchCommandFuzzy(rawText));
      if (linkPhone) {
        // ORDINE: prima il MERGE (durevole), poi il collegamento (durevole).
        // Così un fallimento a metà non lascia mai un collegamento durevole
        // con un libro non fuso — lo stato "linkato a metà" risorgerebbe al
        // riavvio con le voci Zalo invisibili per sempre. consumeLinkCode ha
        // toccato solo la MEMORIA: il rollback qui sotto la ripristina e può
        // dire onestamente "nulla è cambiato".
        const linkedAcct = accounts[linkPhone];
        const unlink = () => {
          if (linkRes.prevZaloId) linkedAcct.zaloId = linkRes.prevZaloId;
          else delete linkedAcct.zaloId;
        };
        const merged = await mergeZaloBook(uid, linkPhone);
        if (!merged.ok) {
          unlink();   // niente di durevole è cambiato
          await sendText(uid, lang === "en"
            ? "⚠️ I couldn't complete the link (storage hiccup) — nothing changed. Get a fresh code on the website and try again."
            : "⚠️ Mình chưa kết nối được (hệ thống lưu trữ đang gặp sự cố) — chưa có gì thay đổi. Bạn lấy mã mới trên web rồi gửi lại nhé.");
          return;
        }
        const acctSaved = await persistAccountDurable(linkPhone);
        if (!acctSaved.ok) {
          // il libro è GIÀ fuso (durevole) ma il collegamento no: si scollega
          // la memoria e si chiede un mã mới — al retry il merge è un no-op
          // (moved 0) e resta solo il collegamento da rendere durevole.
          unlink();
          persistAccount(linkPhone);   // best effort, coerenza memoria↔disco
          await sendText(uid, lang === "en"
            ? "⚠️ Your entries were moved but the link didn't stick (storage hiccup). Get a fresh code on the website and send it again."
            : "⚠️ Bút toán đã được chuyển nhưng kết nối chưa lưu được (hệ thống lưu trữ đang gặp sự cố). Bạn lấy mã mới trên web rồi gửi lại nhé.");
          return;
        }
        const moved = merged.moved;
        const acct = accounts[linkPhone];
        // Dopo il merge il libro è quello dell'ACCOUNT: la lingua giusta per
        // la conferma è la sua (scelta sul web), non quella del libro Zalo
        // appena fuso — `lang` calcolata sopra sarebbe già stantia.
        const mergedLang = books["u:" + linkPhone]?.profile?.lang || "vi";
        await sendText(uid, mergedLang === "en"
          ? `✅ Linked to the account ${acct?.name || linkPhone}.\n` +
            (moved ? `Moved ${moved} entries from Zalo into your book.\n` : "") +
            `From now on the Zalo and web books are one — your đại lý thuế can see it too.`
          : `✅ Đã kết nối với tài khoản ${acct?.name || linkPhone}.\n` +
            (moved ? `Đã chuyển ${moved} bút toán từ Zalo vào sổ của bạn.\n` : "") +
            `Từ giờ sổ trên Zalo và trên web là một — đại lý thuế cũng xem được.`);
      } else if (langSwitch) {
        // La conferma arriva nella lingua NUOVA: è la prova immediata che il
        // cambio ha preso. Persistita sul profilo del libro → vale anche sul
        // web (stesso campo di /api/profile).
        const saved = await mutateBookDurable(bookUid, (b) => { b.profile.lang = langSwitch; });
        if (!saved.ok) { await sendText(uid, saveFailText(lang)); return; }
        await sendText(uid, langSwitch === "en"
          ? `✅ English it is. Fiscal terms stay in Vietnamese (01/CNKD, tờ khai, GTGT, TNCN, hạn nộp) — those are the names your tax office uses.\nType "menu" to see the commands · gõ "tiếng việt" để quay lại.`
          : `✅ Đã chuyển sang tiếng Việt.\nGõ "menu" để xem các lệnh · type "english" for English.`);
      } else if (cmd === "fix") {
        // "sửa" era promesso in OGNI conferma di registrazione («Trả lời
        // "sửa" nếu cần chỉnh») e non instradato: chi lo digitava riceveva il
        // menu. Chỉnh = cancella l'ultima voce e invita a rimandarla — molto
        // più robusto di un editor via chat.
        const b = getBook(bookUid);
        const i = latestCorrectable(b.entries);
        if (!b.entries.length) {
          await sendText(uid, lang === "en"
            ? `Your book has no entries to undo yet.\nSend a receipt photo or type "thu 2tr4" / "chi 500k" to get started.`
            : `Sổ của bạn chưa có bút toán nào để sửa.\n` +
              `Gửi ảnh hoá đơn hoặc gõ "thu 2tr4" / "chi 500k" để bắt đầu nhé.`);
        } else if (i === -1) {
          // solo aperture dichiarate: si correggono ri-dichiarando, non cancellando
          await sendText(uid, lang === "en"
            ? `Your book only holds tự khai (self-declared) figures — nothing to undo.\nTo change those, type "khai" to see how to redeclare.`
            : `Sổ của bạn chỉ có số liệu tự khai, không có bút toán nào để sửa.\n` +
              `Muốn chỉnh số tự khai, gõ "khai" để xem cách khai lại.`);
        } else {
          // NIENTE cancellazione immediata: "sửa" mostra la voce che toccherà
          // e aspetta un "1" esplicito (pendingDeletes, TTL 10 min). Prima un
          // typo instradato qui cancellava una voce FISCALE senza appello —
          // la conferma costa un messaggio, il ripristino costava una foto
          // che magari non esiste più.
          const target = b.entries[i];
          pendingDeletes.put(uid, { entryId: target.id });
          const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
          await sendText(uid, lang === "en"
            ? `Delete this latest entry?\n` +
              `${target.type === "thu" ? "📈 IN" : "📉 OUT"} ${vnd(target.amount)}\n` +
              (target.counterparty ? `${target.counterparty}\n` : "") +
              `Date: ${vnDate(target.date)}\n\n` +
              `Reply "1" to delete — ignore this message to keep it.`
            : `Bạn muốn xoá bút toán gần nhất này?\n` +
              `${target.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(target.amount)}\n` +
              (target.counterparty ? `${target.counterparty}\n` : "") +
              `Ngày: ${vnDate(target.date)}\n\n` +
              `Trả lời "1" để xoá, bỏ qua nếu không.`);
        }
      } else if (khai || cmd === "khai") {
        // ⚠️ ORDINE: PRIMA di parseMoneyCommand. "khai quý 1 thu 360tr"
        // contiene "thu <importo>" e il parser dei soldi lo registrerebbe come
        // incasso di OGGI — l'esatto contrario di un saldo di apertura.
        // `cmd === "khai"` arriva solo dal match ESATTO: dal 22/08 il fuzzy
        // non instrada più verso khai (FUZZY_SAFE in commands.js) — "khaii"
        // riceve il menu. Le risposte restano IN VIETNAMITA anche col profilo in inglese:
        // khai è sintassi fiscale vietnamita per scelta (vedi commands.js) e
        // chi la digita sta già operando in vietnamita.
        const k = khai || { help: true };
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
          const now = new Date();
          const { year } = quarterOf(now);
          // applyOpening gira DENTRO la mutazione durevole; un rifiuto lancia
          // RefuseMutation → rollback: prima "khai quý 1 thu 360tr chi -5tr"
          // teneva il thu in memoria mentre il messaggio diceva "chưa ghi được".
          let saved;
          try {
            saved = await mutateBookDurable(bookUid, (b) => {
              const r = applyOpening(b, { year, quarters: { [k.q]: { revenue: k.revenue, expenses: k.expenses } } });
              if (r.error || r.skipped?.length) throw new RefuseMutation(r);
              return r;
            });
          } catch (e) {
            if (!(e instanceof RefuseMutation)) throw e;
            // un'apertura scartata in silenzio è il bug d'origine di opening.js:
            // il motivo del rifiuto arriva fino all'utente, in vietnamita
            const why = e.payload.error || e.payload.skipped?.[0]?.why || "";
            await sendText(uid, `⛔ Chưa ghi được số tự khai.\n` + (
              /future/.test(why)
                ? `Quý ${k.q}/${year} chưa tới — chỉ khai được các quý đã qua hoặc quý hiện tại.`
                : /1-4/.test(why)
                  ? `Quý phải từ 1 đến 4 (bạn gõ quý ${k.q}).`
                  : `Bạn kiểm tra lại cú pháp giúp mình: "khai quý 1 thu 360tr".`));
            return;
          }
          if (!saved.ok) { await sendText(uid, saveFailText(lang)); return; }
          const res = saved.result;
          {
            sheetsQueue.touch(bookUid);   // vista Sheets: push dopo la quiete
            const b = getBook(bookUid);
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
      } else if (cmd === "year") {
        const b = getBook(bookUid);
        const now = new Date();
        const { year } = quarterOf(now);
        const t = totals(b.entries, { year });
        const st = thresholdStatus(projectAnnual(t.revenue, now));
        const left = Math.max(0, st.taxFree.limit - st.projection);
        // Il testo vive in formatYearMessage (src/zalo.js), accanto alle altre
        // varianti VI/EN: due copie dello stesso messaggio divergono sempre.
        await sendText(uid, formatYearMessage({
          year, revenue: t.revenue, expenses: t.expenses, net: t.net,
          projection: st.projection, crossed: st.taxFree.crossed, left,
        }, lang));
      } else if (cmd === "quarter") {
        // La domanda che il prodotto esiste per rispondere: la 01/CNKD si
        // deposita per TRIMESTRE, e finora sul canale dove vive il cliente
        // questa era l'unica cosa che non si poteva chiedere.
        const b = getBook(bookUid);
        // In coda a "quý": re-prompt claim di UNA riga per gli uid non
        // collegati (spec, Flusso §2 — gli unici due posti sono menu e quý).
        await sendText(uid, formatQuarterMessage(buildDeclaration(b), lang) + claimReminderFor(uid, lang));
      } else if (cmd === "menu") {
        await sendText(uid, menuText({ linked: !!findAccountByZaloId(uid), lang }) + claimReminderFor(uid, lang));
      } else if (money) {
        // Il totale di fine giornata scritto a mano: la via principale per il
        // FATTURATO di un quán, dove le foto funzionano solo per le spese.
        const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
        if (money.needsAmount) {
          // Prefisso THU/CHI riconosciuto ma importo illeggibile (o "xị",
          // ambiguo per regione — vedi src/amount.js): domanda MIRATA, non il
          // muro-menu che suona come «non ti ho capito».
          const T = money.type === "thu";
          if (money.ambiguousUnit) {
            await sendText(uid, lang === "en"
              ? `🤔 "xị" means different amounts in different regions (10 nghìn or 100 nghìn), so I won't guess in your tax book — ` +
                `please type the exact number, e.g. "${money.type} 20k" or "${money.type} 200k".`
              : `🤔 Mỗi vùng hiểu "xị" khác nhau (10 nghìn hay 100 nghìn) nên mình không dám đoán trong sổ thuế — ` +
                `bạn gõ số cụ thể giúp mình nhé, vd: ${money.type} 20k hoặc ${money.type} 200k.`);
          } else {
            await sendText(uid, lang === "en"
              ? `🤔 Looks like you want to record ${T ? "IN (thu)" : "OUT (chi)"} but I couldn't read the amount — ` +
                `e.g. ${money.type} 2tr4, ${money.type} 500k.`
              : `🤔 Mình thấy bạn muốn ghi ${T ? "THU" : "CHI"} nhưng chưa đọc được số tiền — ` +
                `vd: ${money.type} 2tr4, ${money.type} 500k.`);
          }
        } else if (money.needsType) {
          // Non si indovina: per un quán sarebbe quasi sempre incasso, ma
          // "quasi sempre" in un registro fiscale è una voce sbagliata che
          // sembra giusta. Una domanda costa un messaggio.
          await sendText(uid, lang === "en"
            ? `Is ${vnd(money.amount)} money in or out?\n` +
              `• Type "thu ${money.amount}" if it's sales income\n` +
              `• Type "chi ${money.amount}" if it's a purchase/expense`
            : `Bạn muốn ghi ${vnd(money.amount)} là khoản nào?\n` +
              `• Gõ "thu ${money.amount}" nếu là tiền bán hàng\n` +
              `• Gõ "chi ${money.amount}" nếu là tiền mua/chi phí`);
        } else {
          const entry = {
            id: "e" + Date.now(),
            type: money.type,
            amount: money.amount,
            // "hôm qua"/"hôm kia" → ieri/l'altro ieri VIETNAMITI (parser)
            date: money.date || todayVN(),
            counterparty: money.type === "thu" ? "Khách lẻ" : "",
            // la coda libera del comando ("thu 2tr4 cà phê") è la descrizione
            description: money.description
              || (money.type === "thu" ? "Tổng bán trong ngày" : "Ghi tay"),
            source: "zalo",
            provenance: "manual",
            createdAt: new Date().toISOString(),
          };
          const saved = await writeZaloEntry(uid, entry);
          if (!saved.ok) { await sendText(uid, saveFailText(lang)); return; }
          sheetsQueue.touch(saved.uid);   // vista Sheets: push dopo la quiete
          // Scrittura a mano = stesso momento magico della foto: CTA claim.
          await sendText(uid, formatEntryMessage(entry, lang) + claimCtaFor(uid, saved.uid, lang));
        }
      } else {
        // Il testo sconosciuto riceve il menu: è output di menuText, quindi
        // porta lo stesso re-prompt del comando "menu" (stessa riga, stessa
        // condizione — mai una variante in più da tenere allineata).
        await sendText(uid, menuText({ linked: !!findAccountByZaloId(uid), lang }) + claimReminderFor(uid, lang));
      }
    } else if (String(event.event_name || "").startsWith("user_send") && event?.sender?.id) {
      // RAMO DI DEFAULT (prima non c'era): vocale, file, video, contatto… —
      // tutto ciò che un UTENTE manda e il bot non sa leggere. Il silenzio qui
      // era il guasto peggiore del prodotto: indistinguibile da un bot morto,
      // davanti a chiunque provi il vocale come prima cosa. Si risponde SOLO
      // agli eventi user_send_* con un sender.id — mai a ricevute di consegna,
      // seen, follow o altri eventi di piattaforma (quelli cadono nell'else
      // sotto, in silenzio): rispondere a una ricevuta creerebbe un loop di
      // messaggi non richiesti.
      const SILENT_USER_EVENTS = new Set(["user_send_sticker", "user_send_gif"]);
      if (SILENT_USER_EVENTS.has(event.event_name)) {
        // Sticker/GIF sono un gesto, non un contenuto da leggere: ack muto.
        console.debug(`zalo: ${event.event_name} da ${uid} — ack silenzioso`);
        return;
      }
      const bookUid = zaloBookUid(uid);
      const lang = books[bookUid]?.profile?.lang || "vi";
      await sendText(uid, lang === "en"
        ? "🎤 I can't listen to or read this file yet — please send a photo of the receipt, or type the amount (e.g. thu 2tr4)."
        : "🎤 Mình chưa nghe/đọc được tệp này — bạn chụp hoá đơn hoặc gõ số tiền nhé (vd: thu 2tr4).");
    } else {
      // Eventi non-utente (ricevute, seen, follow — il benvenuto del follow
      // vive nell'OA Manager, vedi il commento in testa): MAI una risposta,
      // solo una riga a livello debug per la diagnosi.
      console.debug(`zalo: evento ignorato ${event?.event_name || "(no event_name)"}`);
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
app.post("/api/auth/register", async (req, res) => {
  const out = register(req.body || {});
  if (out.error) return res.status(400).json({ error: out.error });
  const phone = out.account.phone;
  // L'account esiste solo se è durevole: un token consegnato per un account
  // solo in RAM funzionerebbe fino al primo riavvio, poi "account sparito".
  const saved = await persistAccountDurable(phone);
  if (!saved.ok) { delete accounts[phone]; return res.status(503).json({ error: SAVE_FAIL_VI }); }
  // il libro nasce col nome dell'account (cosmetico: non blocca la registrazione)
  if (out.account.name) {
    mutateBookDurable("u:" + phone, (b) => { if (!b.profile.name) b.profile.name = out.account.name; }).catch(() => {});
  }
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
app.post("/api/link-agent", requireAuth, async (req, res) => {
  const agent = findAgentByCode(req.body?.code);
  if (!agent) return res.status(404).json({ error: "Không tìm thấy mã đại lý." });
  const prev = req.account.agentPhone;
  req.account.agentPhone = agent.phone;
  const saved = await persistAccountDurable(req.phone);
  if (!saved.ok) {
    if (prev) req.account.agentPhone = prev; else delete req.account.agentPhone;
    return res.status(503).json({ error: SAVE_FAIL_VI });
  }
  res.json({ ok: true, agent: { name: agent.name, phone: agent.phone } });
});

// ---- Claim-link: rotte (pagina + API) ---------------------------------------------
// La pagina si serve SEMPRE, token valido o no: la validazione avviene sulla
// API chiamata dalla pagina — così il token non finisce nei log del server e
// lo status HTTP della pagina non fa da oracolo sulla validità del link.
app.get("/claim/:token", rateLimit({ windowMs: 15 * 60_000, max: 30, name: "claim" }), (_req, res) =>
  res.sendFile(join(__dirname, "public", "claim.html")));

// Anteprima: SOLO il conteggio, MAI le voci — il token viaggia in un URL e un
// link inoltrato per sbaglio non deve mostrare il libro a nessuno.
app.get("/api/claim/preview/:token", rateLimit({ windowMs: 15 * 60_000, max: 30, name: "claim" }), (req, res) => {
  const v = verifyClaimToken(req.params.token, { secret: CLAIM_SECRET, registry: claimRegistry });
  if (v.error) return res.status(CLAIM_ERROR_STATUS[v.error]).json({ error: CLAIM_ERROR_VI[v.error], code: v.error });
  res.json({ ok: true, entries: books["zalo:" + v.zaloId]?.entries?.length || 0 });
});

// Il claim vero: token valido + SĐT/PIN → account (login se esiste, il PIN si
// valida e mai si sovrascrive; registrazione hộ altrimenti) → zaloId collegato
// → mergeZaloBook (la macchina esistente: migra anche la config Sheets e
// tocca la coda di push) → il token si consuma. Stesso secchio rate "claim".
app.post("/api/claim", rateLimit({ windowMs: 15 * 60_000, max: 30, name: "claim" }), async (req, res) => {
  const { token: claimToken, phone: rawPhone, pin, name } = req.body || {};
  const v = verifyClaimToken(claimToken, { secret: CLAIM_SECRET, registry: claimRegistry });
  if (v.error) return res.status(CLAIM_ERROR_STATUS[v.error]).json({ error: CLAIM_ERROR_VI[v.error], code: v.error });
  const phone = normalizePhone(rawPhone);
  if (!phone) return res.status(400).json({ error: "Số điện thoại không hợp lệ (VD: 0901234567)." });
  const isNew = !accounts[phone];
  const out = isNew ? register({ phone, pin, name, role: "ho" }) : login({ phone, pin });
  if (out.error) return res.status(400).json({ error: out.error });
  const acct = out.account;
  // ORDINE DUREVOLE, dal meno al più impegnativo: (1) account base su disco,
  // (2) merge del libro (sotto entrambe le code), (3) collegamento zaloId,
  // (4) marcatore monouso. Ogni fallimento lascia uno stato da cui il RETRY
  // dello STESSO link riconverge: finché nessun account porta lo zaloId il
  // token resta valido (isUsed guarda findAccountByZaloId), e un merge già
  // fatto al retry è un no-op (moved 0).
  const acctSaved0 = await persistAccountDurable(phone);
  if (!acctSaved0.ok) {
    if (isNew) delete accounts[phone];
    return res.status(503).json({ error: SAVE_FAIL_VI });
  }
  // il libro nasce col nome dell'account (cosmetico, non blocca il claim)
  if (acct.name) mutateBookDurable("u:" + phone, (b) => { if (!b.profile.name) b.profile.name = acct.name; }).catch(() => {});
  const merged = await mergeZaloBook(v.zaloId, phone);
  if (!merged.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  // Doppio submit concorrente: entrambi passavano la verifica del token prima
  // che uno dei due collegasse. Il ricontrollo qui, DOPO il merge (che sotto
  // le due code è comunque idempotente sul secondo giro: sorgente già rimossa,
  // moved 0), chiude la finestra con un "used" onesto invece di due account
  // collegati allo stesso zaloId.
  if (claimRegistry.isUsed(v.zaloId)) {
    return res.status(CLAIM_ERROR_STATUS.used).json({ error: CLAIM_ERROR_VI.used, code: "used" });
  }
  const prevZalo = acct.zaloId;
  acct.zaloId = v.zaloId;
  const acctSaved = await persistAccountDurable(phone);
  if (!acctSaved.ok) {
    // il libro è già fuso (durevole), il collegamento no: scollegata la
    // memoria, il token resta valido e il retry fa solo merge(0) + link.
    if (prevZalo) acct.zaloId = prevZalo; else delete acct.zaloId;
    return res.status(503).json({ error: SAVE_FAIL_VI });
  }
  // Backstop già attivo (account collegato durevole); il marcatore sul libro
  // ormai rimosso resta best-effort per il caso "libro senza voci".
  claimRegistry.markUsed(v.zaloId);
  res.json({ ok: true, token: out.token, account: publicAccount(acct), moved: merged.moved });
});

// Gancio SOLO test (NODE_ENV=test): l'e2e non può leggere il messaggio Zalo
// col link vero (sendText è spenta senza token OA), quindi conia da qui —
// stessa via del webhook, stesso registro (il re-mint invalida il precedente
// anche quando a coniare è il test). In produzione la rotta non esiste.
if (process.env.NODE_ENV === "test") {
  app.get("/api/claim/test-mint/:zaloId", (req, res) =>
    res.json({ ok: true, token: mintClaimToken(req.params.zaloId, { secret: CLAIM_SECRET, registry: claimRegistry }) }));
  // Iniezione di guasti di persistenza: i prossimi N persist falliscono.
  // Serve all'e2e per provare che un persist fallito = 503 + rollback, mai
  // una conferma. In produzione la rotta non esiste.
  app.post("/api/test/fail-persist", (req, res) => {
    _durability.failNext = Math.max(0, Number(req.body?.n ?? 1));
    res.json({ ok: true, failNext: _durability.failNext });
  });
}

// ---- Billing -------------------------------------------------------------------
app.post("/api/billing/subscribe", requireAuth, async (req, res) => {
  const planKey = String(req.body?.plan || "co_ban");
  if (!PLANS[planKey]) return res.status(400).json({ error: "unknown plan" });
  if (payosEnabled()) {
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const out = await createPaymentLink({ planKey, phone: req.phone, baseUrl });
    if (out.error) return res.status(502).json({ error: out.error });
    // pendingOrder DEVE essere durevole prima del redirect: se sopravvive solo
    // in RAM e il server riavvia, l'utente PAGA e il webhook payOS non trova
    // più l'ordine — soldi presi, gói mai attivato.
    req.account.pendingOrder = { orderCode: out.orderCode, plan: planKey };
    const saved = await persistAccountDurable(req.phone);
    if (!saved.ok) { delete req.account.pendingOrder; return res.status(503).json({ error: SAVE_FAIL_VI }); }
    return res.json({ ok: true, mode: "payos", checkoutUrl: out.checkoutUrl });
  }
  // Pilot mode: attivazione founder gratuita (30 giorni), nessun pagamento.
  const prevSub = { ...req.account.sub };
  const sub = activateSub(req.account, planKey, { pilot: true });
  const saved = await persistAccountDurable(req.phone);
  if (!saved.ok) { req.account.sub = prevSub; return res.status(503).json({ error: SAVE_FAIL_VI }); }
  res.json({ ok: true, mode: "pilot", sub });
});

app.post("/webhooks/payos", async (req, res) => {
  if (!verifyPayosWebhook(req.body)) return res.status(401).json({ error: "bad signature" });
  const data = req.body?.data || {};
  const acct = Object.values(accounts).find((a) => a.pendingOrder?.orderCode === data.orderCode);
  if (acct && (data.code === "00" || req.body.success === true)) {
    const order = acct.pendingOrder;
    const prevSub = { ...acct.sub };
    activateSub(acct, order.plan, { pilot: false });
    delete acct.pendingOrder;
    // Un'attivazione PAGATA che vive solo in RAM è un cliente derubato al
    // prossimo deploy: se il persist fallisce, pendingOrder torna al suo posto
    // (il retry di payOS deve poter RITROVARE l'ordine) e ANCHE sub torna
    // indietro — activateSub estende da activeUntil, e senza questo rollback
    // ogni retry di payOS regalerebbe +30 giorni. Poi 500: payOS ritenta e il
    // giro riconverge sul persist.
    const saved = await persistAccountDurable(acct.phone);
    if (!saved.ok) {
      acct.pendingOrder = order;
      acct.sub = prevSub;
      return res.status(500).json({ error: "persist failed — retry" });
    }
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
// Vista pubblica del profilo: sheets.secret è WRITE-ONLY, come pinHash/salt in
// publicAccount (src/auth.js). ledgerPayload serve quattro rotte — /api/ledger,
// /api/opening, l'eco di /api/profile e la vista dell'đại lý thuế — e con il
// profilo intero il segreto del foglio trapelerebbe in ognuna.
function publicProfile(profile) {
  if (!profile) return profile;
  const pub = { ...profile };
  if (pub.sheets) {
    const { secret, ...rest } = pub.sheets;
    pub.sheets = { ...rest, connected: !!secret };
  }
  return pub;
}

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
    profile: publicProfile(b.profile),
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

// Provenienze ammesse dal client web (stesso vocabolario delle voci Zalo:
// manual | photo | bank | pos | einvoice). Tutto il resto — compreso il campo
// assente — ricade su "manual": la colonna "Gốc" di CSV e Sheets non deve
// più uscire vuota per una voce scritta a mano sul sito. MAI "declared" da
// qui: quella provenienza è riservata alle aperture (src/opening.js) e il
// punteggio la esclude — accettarla dal client falserebbe il Điểm Sổ Sạch.
const WEB_PROVENANCES = new Set(["manual", "photo", "bank", "pos", "einvoice"]);

app.post("/api/ledger", async (req, res) => {
  const uid = uidFor(req);
  const { type, amount, date, counterparty, description, provenance } = req.body || {};
  if (!["thu", "chi"].includes(type) || !Number(amount))
    return res.status(400).json({ error: "type thu|chi e amount richiesti" });
  const entry = {
    id: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
    type, amount: Math.round(Number(amount)),
    date: date || todayVN(),
    counterparty: String(counterparty || "").slice(0, 120),
    description: String(description || "").slice(0, 200),
    source: "web",
    provenance: WEB_PROVENANCES.has(provenance) ? provenance : "manual",
    createdAt: new Date().toISOString(),
  };
  // Durevole prima del 200: il client mostra "✅ Đã lưu" sulla risposta.
  const saved = await mutateBookDurable(uid, (b) => { b.entries.push(entry); });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  sheetsQueue.touch(uid);   // vista Sheets: push dopo la quiete
  res.json({ ok: true, entry });
});

app.delete("/api/ledger/:id", async (req, res) => {
  const uid = uidFor(req);
  const saved = await mutateBookDurable(uid, (b) => {
    const before = b.entries.length;
    b.entries = b.entries.filter((e) => e.id !== req.params.id);
    return before - b.entries.length;
  });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  sheetsQueue.touch(uid);   // vista Sheets: push dopo la quiete
  res.json({ ok: true, removed: saved.result });
});

app.post("/api/profile", async (req, res) => {
  const uid = uidFor(req);
  const { name, category, revenueEstimate, lang } = req.body || {};
  const saved = await mutateBookDurable(uid, (b) => {
    if (name !== undefined) b.profile.name = String(name).slice(0, 120);
    if (category && CATEGORIES[category]) b.profile.category = category;
    if (revenueEstimate !== undefined) b.profile.revenueEstimate = Math.max(0, Number(revenueEstimate) || 0);
    // lingua del bot/web: whitelist esplicita, come category — un valore fuori
    // da "vi"|"en" si ignora in silenzio, mai un 400 per un campo opzionale
    if (lang !== undefined && ["vi", "en"].includes(lang)) b.profile.lang = lang;
  });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  res.json({ ok: true, profile: publicProfile(getBook(uid).profile) });
});

// ---- Google Sheets: config + push manuale -----------------------------------------
// requireAuth su TUTTE e tre: il libro "demo" è condiviso fra tutti gli anonimi
// (il foglio di uno riceverebbe i libri di tutti) e le sandbox anonime non
// hanno un'identità a cui legare un segreto. uid derivato dal token, mai da ?uid=.
app.post("/api/sheets/config", requireAuth, async (req, res) => {
  const { url, secret } = req.body || {};
  const v = validateSheetsUrl(url);
  if (!v.ok) return res.status(400).json({ error: v.error });
  if (!String(secret || "").trim())
    return res.status(400).json({ error: "Thiếu mã bí mật — đặt SECRET trong Apps Script rồi dán vào đây." });
  const uid = "u:" + req.phone;
  // Durevole: un secret solo in RAM sparisce al riavvio e la sync muore muta.
  const saved = await mutateBookDurable(uid, (b) => {
    b.profile.sheets = { url: v.url, secret: String(secret).trim(), lastPushAt: null, lastPushOk: null };
  });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  // Push di prova IMMEDIATO: URL o secret sbagliati si scoprono ora, non alla
  // prossima ricevuta. 0 retry: l'errore del foglio arriva in chiaro all'utente.
  const push = await sheetsPushNow(uid);
  // Mai il secret nella risposta: publicProfile lo redige.
  res.json({ ok: true, sheets: publicProfile(getBook(uid).profile).sheets, push });
});

app.delete("/api/sheets/config", requireAuth, async (req, res) => {
  const uid = "u:" + req.phone;
  // Durevole: un "disconnesso" solo in RAM risorge al riavvio — l'utente
  // crede di aver revocato la sync e il server continua a spingere.
  const saved = await mutateBookDurable(uid, (b) => { delete b.profile.sheets; });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  res.json({ ok: true });
});

// Push manuali IN VOLO, per uid. Il throttle sui 10 s legge lastPushAt, che
// sheetsPushNow aggiorna solo A PUSH FINITO: due richieste PARALLELE leggevano
// entrambe il timestamp vecchio e passavano entrambe — il throttle esisteva
// solo in serie (confermato con 3 push simultanei, 3 arrivi al foglio). Il Set
// si riempie nel tratto SINCRONO della rotta, quindi la seconda richiesta lo
// vede sempre; si svuota nel finally, mai lasciato sporco da un errore.
const manualPushInFlight = new Set();

app.post("/api/sheets/push", requireAuth, async (req, res) => {
  // Throttle per-uid sul timestamp del profilo — NIENTE middleware rateLimit:
  // il suo globalMax è un singleton condiviso col contatore Anthropic di
  // /api/extract, e i push brucerebbero il budget giornaliero dell'estrazione.
  const uid = "u:" + req.phone;
  const cfg = books[uid]?.profile?.sheets;
  if (!cfg?.url) return res.status(400).json({ error: "Chưa kết nối Google Sheets." });
  if (manualPushInFlight.has(uid)) {
    res.setHeader("Retry-After", 3);
    return res.status(429).json({ error: "Vừa đẩy xong — chờ vài giây rồi thử lại nhé." });
  }
  const last = cfg.lastPushAt ? Date.parse(cfg.lastPushAt) : 0;
  const since = Date.now() - (Number.isFinite(last) ? last : 0);
  if (since < 10_000) {
    res.setHeader("Retry-After", Math.ceil((10_000 - since) / 1000));
    return res.status(429).json({ error: "Vừa đẩy xong — chờ vài giây rồi thử lại nhé." });
  }
  manualPushInFlight.add(uid);
  try {
    const out = await sheetsPushNow(uid);   // 0 retry sul manuale: l'errore si vede
    res.json(out.ok ? { ok: true, at: cfg.lastPushAt } : { ok: false, error: out.error, at: cfg.lastPushAt });
  } finally {
    manualPushInFlight.delete(uid);
  }
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
app.post("/api/waitlist", rateLimit({ windowMs: 60 * 60_000, max: 8, name: "waitlist" }), async (req, res) => {
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
  // Durevole: i lead sono la pipeline del pilota, non cache.
  const saved = await persistLeadDurable(p);
  if (!saved.ok) {
    if (existing) leads[p] = existing; else delete leads[p];
    return res.status(503).json({ error: SAVE_FAIL_VI });
  }
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
app.post("/api/demo-seed", async (req, res) => {
  if (req.phone) return res.status(403).json({ error: "Sổ mẫu chỉ dành cho bản dùng thử (chưa đăng nhập)." });
  const saved = await mutateBookDurable(uidFor(req), (b) => {
    b.entries = b.entries.filter((e) => !e.sample); // niente doppioni se ritappato
    b.entries.push(...sampleEntries());
    if (!b.profile.name) Object.assign(b.profile, SAMPLE_PROFILE);
    return b.entries.filter((e) => e.sample).length;
  });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  res.json({ ok: true, added: saved.result });
});

app.delete("/api/demo-seed", async (req, res) => {
  const saved = await mutateBookDurable(uidFor(req), (b) => {
    const before = b.entries.length;
    b.entries = b.entries.filter((e) => !e.sample);
    if (b.profile.name === SAMPLE_PROFILE.name) b.profile.name = "";
    return before - b.entries.length;
  });
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  res.json({ ok: true, removed: saved.result });
});

// ---- Export CSV (BOM per Excel, apre pulito con dấu tiếng Việt) -------------------
// 7 colonne, IDENTICHE al payload Sheets ("Gốc" = provenance): i due export
// devono raccontare lo stesso libro, colonna per colonna. Condiviso fra
// l'export dell'hộ e quello per-cliente dell'đại lý thuế.
function csvOfBook(b) {
  // I campi liberi arrivano dal CLIENTE (testo Zalo, form web): una cella che
  // inizia con = + - @ è una FORMULA per Excel, e con l'export per-cliente
  // dell'đại lý il CSV attraversa un confine di fiducia — un hộ ostile non
  // deve poter eseguire nulla nel foglio dello studio. L'apostrofo iniziale è
  // la neutralizzazione standard: Excel lo tratta come marcatore di testo.
  const safeCell = (v) => (/^[=+\-@\t\r]/.test(String(v)) ? "'" + v : v);
  const rows = [["Ngày", "Loại", "Số tiền (VND)", "Đối tác", "Mô tả", "Nguồn", "Gốc"]];
  for (const e of [...b.entries].sort((a, z) => a.date.localeCompare(z.date))) {
    rows.push([e.date, e.type === "thu" ? "Thu" : "Chi", e.amount, safeCell(e.counterparty || ""), safeCell(e.description || ""), e.source || "", e.provenance || ""]);
  }
  return "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}
function sendCsv(res, csv, filename) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

app.get("/api/export.csv", (req, res) =>
  sendCsv(res, csvOfBook(getBook(uidFor(req))), `so-sach-${todayVN()}.csv`));

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

app.post("/api/opening", async (req, res) => {
  const uid = uidFor(req);
  // applyOpening dentro la mutazione durevole. Un error (anno invalido) esce
  // PRIMA di toccare il libro, quindi il persist in quel caso è un no-op
  // innocuo; gli skipped parziali restano la semantica del form web (applica
  // i trimestri validi, riferisce quelli rifiutati).
  const saved = await mutateBookDurable(uid, (b) => applyOpening(b, req.body || {}, todayVN()));
  if (!saved.ok) return res.status(503).json({ error: SAVE_FAIL_VI });
  const out = saved.result;
  if (out.error) return res.status(400).json({ error: out.error });
  sheetsQueue.touch(uid);   // vista Sheets: push dopo la quiete
  res.json({ ok: true, ...out, ledger: ledgerPayload(uid) });
});

// ---- Đại lý thuế (agent) dashboard -------------------------------------------------
// Guardia unica: ruolo agent + (per le rotte per-cliente) cliente DEL SUO
// roster. Il telefono arriva dall'URL, quindi la proprietà si verifica sempre
// contro agentPhone — mai fidarsi del parametro da solo.
function agentClientOr404(req, res) {
  if (req.account.role !== "agent") { res.status(403).json({ error: "Chỉ dành cho đại lý thuế." }); return null; }
  const phone = normalizePhone(req.params.phone);
  const client = phone && accounts[phone];
  if (!client || client.agentPhone !== req.phone) { res.status(404).json({ error: "Không phải khách của bạn." }); return null; }
  return { phone, client };
}

app.get("/api/agent/clients", requireAuth, (req, res) => {
  if (req.account.role !== "agent") return res.status(403).json({ error: "Chỉ dành cho đại lý thuế." });
  const now = new Date();
  const { q, year } = quarterOf(now);   // trimestre VIETNAMITA, non del server
  const clients = Object.values(accounts)
    .filter((a) => a.role === "ho" && a.agentPhone === req.phone)
    .map((a) => {
      const b = getBook("u:" + a.phone);
      const tQ = totals(b.entries, { year, q });
      const tY = totals(b.entries, { year });
      const projection = projectAnnual(tY.revenue, now);
      const tax = quarterlyTax(tQ.revenue, b.profile.category, projection);
      const sh = b.profile.sheets;
      return {
        phone: a.phone, name: b.profile.name || a.name || a.phone,
        category: b.profile.category,
        entries: b.entries.length,
        // L'ultima data di voce dice a colpo d'occhio chi ha smesso di
        // registrare — il cliente che l'đại lý deve chiamare PRIMA della
        // scadenza, non il giorno della scadenza.
        lastEntryAt: b.entries.reduce((m, e) => (String(e.date || "") > m ? e.date : m), "") || null,
        quarterRevenue: tQ.revenue, quarterTax: tax.total, exempt: tax.exempt,
        subActive: subActive(a),
        zaloLinked: !!a.zaloId,
        // Diagnostica Sheets SENZA url né secret: all'đại lý serve solo
        // "collegato e funziona / collegato e rotto / non collegato".
        sheets: sh ? { connected: !!sh.secret, lastPushOk: sh.lastPushOk ?? null, lastPushAt: sh.lastPushAt || null } : null,
        score: sosachScore(b, now).grade,
      };
    });
  res.json({ ok: true, agentCode: req.account.agentCode, quarter: `Q${q}/${year}`, clients });
});

app.get("/api/agent/client/:phone", requireAuth, (req, res) => {
  const hit = agentClientOr404(req, res);
  if (!hit) return;
  const payload = ledgerPayload("u:" + hit.phone);
  // publicProfile redige solo il secret; l'URL del foglio resta — e va bene
  // per il PROPRIETARIO (il form di config lo rimostra), non per l'đại lý:
  // qui si riduce alla sola diagnostica, come nel roster.
  if (payload.profile?.sheets) {
    const { connected, lastPushOk = null, lastPushAt = null } = payload.profile.sheets;
    payload.profile = { ...payload.profile, sheets: { connected, lastPushOk, lastPushAt } };
  }
  res.json({ ok: true, client: { phone: hit.phone, name: hit.client.name, zaloLinked: !!hit.client.zaloId }, ...payload });
});

// La 01/CNKD di UN cliente, per il trimestre scelto: è il pezzo che rende il
// roster un piano di lavoro — l'đại lý produce la bozza di tờ khai da qui,
// senza chiedere al cliente di aprire nulla. Stesso buildDeclaration del
// libro proprio: mai due implementazioni della stessa dichiarazione.
app.get("/api/agent/client/:phone/declaration", requireAuth, (req, res) => {
  const hit = agentClientOr404(req, res);
  if (!hit) return;
  const b = getBook("u:" + hit.phone);
  const d = buildDeclaration(b, { year: req.query.year, q: req.query.q });
  res.json({
    ok: true,
    client: { phone: hit.phone, name: b.profile.name || hit.client.name || hit.phone },
    // il preparatore è l'đại lý stesso: sulla bozza stampata deve esserci
    agent: { name: req.account.name || req.phone, phone: req.phone },
    ...d,
  });
});

// CSV del libro di UN cliente: per il software di studio dell'đại lý.
app.get("/api/agent/client/:phone/export.csv", requireAuth, (req, res) => {
  const hit = agentClientOr404(req, res);
  if (!hit) return;
  sendCsv(res, csvOfBook(getBook("u:" + hit.phone)), `so-sach-${hit.phone}-${todayVN()}.csv`);
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
