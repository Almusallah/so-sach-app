// ============================================================================
//  Sổ Sạch — integrazione Zalo Official Account (env-driven).
//  Il bot vive dove vivono gli hộ kinh doanh: dentro Zalo.
//  Senza credenziali il modulo resta inerte e il prodotto gira via web.
//
//  Env richieste per attivarlo (vedi docs/DEPLOY.md):
//    ZALO_OA_ACCESS_TOKEN   — token OA (rinnovabile via refresh flow)
//    ZALO_OA_REFRESH_TOKEN  — catena di rinnovo (ruota a ogni refresh)
//    ZALO_OA_SECRET_KEY     — firma i webhook. È l'"OA Secret Key" della pagina
//                             Webhook, NON la "Khóa bí mật" dell'app: sono due
//                             chiavi diverse e incollare quella sbagliata faceva
//                             fallire la firma senza un solo messaggio d'errore.
//    ZALO_APP_ID
// ============================================================================
import { createHash } from "node:crypto";
import { getAccessToken, tokenStatus } from "./zalo_token.js";
import { thresholdStatus } from "./tax.js";

// Accetta il nome nuovo e, per compatibilità, quello vecchio.
const OA_SECRET = process.env.ZALO_OA_SECRET_KEY || process.env.ZALO_APP_SECRET || null;
const SECRET_SOURCE = process.env.ZALO_OA_SECRET_KEY ? "ZALO_OA_SECRET_KEY"
  : process.env.ZALO_APP_SECRET ? "ZALO_APP_SECRET (legacy name)" : "unset";

// Il fallback nacque quando le due chiavi erano lo stesso valore. Da quando
// esiste il flusso OAuth non lo sono più: ZALO_APP_SECRET è la "Khóa bí mật"
// dell'app e serve a zalo_token.js per scambiare oa_code e refresh. Usarla per
// firmare i webhook produce un mismatch a ogni messaggio — visibile solo nei
// log, col bot che tace. Meglio dirlo all'avvio che scoprirlo dal pilota.
if (!process.env.ZALO_OA_SECRET_KEY && process.env.ZALO_APP_SECRET) {
  console.warn(
    "⚠️ zalo: ZALO_OA_SECRET_KEY non impostata, uso ZALO_APP_SECRET per la firma webhook. " +
    "Sono chiavi DIVERSE: ZALO_APP_SECRET è la Khóa bí mật dell'app (OAuth), " +
    "la firma vuole l'OA Secret Key della pagina Webhook. Se i webhook falliscono, è questo."
  );
}
const APP_ID = process.env.ZALO_APP_ID || null;
const API = "https://openapi.zalo.me/v3.0/oa";

// Abilitato se esiste una catena di token (env al primo avvio, poi lo store).
export const zaloEnabled = () => tokenStatus().configured;
export { tokenStatus };

export const webhookSecretStatus = () => ({
  configured: !!(OA_SECRET && APP_ID), source: SECRET_SOURCE, appId: !!APP_ID,
});

// Verifica firma webhook Zalo: mac = sha256(appId + rawBody + timestamp + OASecretKey).
export function verifyWebhook(rawBody, timestamp, mac) {
  if (!OA_SECRET || !APP_ID) return { ok: false, reason: "zalo not configured" };
  const expected = createHash("sha256")
    .update(APP_ID + rawBody + String(timestamp) + OA_SECRET)
    .digest("hex");
  const got = String(mac || "").replace(/^mac=/, "");
  const ok = expected === got;
  if (!ok) {
    // RUMOROSO di proposito: una firma che non torna è quasi sempre la chiave
    // sbagliata, e in silenzio sembra "il bot non risponde e non so perché".
    console.error(
      `zalo webhook SIGNATURE MISMATCH — key in use: ${SECRET_SOURCE}. ` +
      `Expected ${expected.slice(0, 12)}… got ${got.slice(0, 12) || "(none)"}…  ` +
      `Check ZALO_OA_SECRET_KEY holds the OA Secret Key from the Webhook page ` +
      `(NOT the app's "Khóa bí mật").`
    );
  }
  return { ok, reason: "signature" };
}

// Invio messaggio testo a un utente OA. Il token viene risolto a ogni invio
// (rinnovato se vicino alla scadenza) e, se Zalo lo rifiuta comunque come
// scaduto (-216), si riprova UNA volta con un token forzatamente rinnovato:
// senza questo un token invalidato lato Zalo prima della scadenza attesa
// farebbe fallire il messaggio in silenzio.
async function post(path, payload, token) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { access_token: token, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { httpOk: res.ok, data };
}

export async function sendText(userId, text) {
  let token = await getAccessToken();
  if (!token) return { ok: false, skipped: true };
  const payload = { recipient: { user_id: userId }, message: { text } };

  let { httpOk, data } = await post("/message/cs", payload, token);
  if (data?.error === -216 || data?.error === -201) {          // token scaduto/non valido
    token = await getAccessToken({ force: true });
    if (!token) return { ok: false, data };
    ({ httpOk, data } = await post("/message/cs", payload, token));
  }
  const ok = httpOk && data.error === 0;
  // Un fallimento d'invio non deve restare invisibile: è il modo in cui il
  // pilota muore senza che nessuno se ne accorga.
  if (!ok) console.error("zalo sendText failed:", JSON.stringify(data).slice(0, 200));
  return { ok, data };
}

// Scarica un'immagine allegata a un messaggio Zalo (via URL fornito nell'evento).
// Claude accetta SOLO image/jpeg|png|gif|webp. Il content-type di Zalo non è
// in quella lista (primo scontrino vero, 12/08/2026: l'API ha risposto
// "media_type: Input should be 'image/jpeg', 'image/png', 'image/gif' or
// 'image/webp'" e l'estrazione è caduta in demo). L'header è ciò che Zalo
// DICHIARA; i byte sono ciò che Claude verifica — quindi si guardano i byte.
function sniffMediaType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 6 && buf.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("latin1") === "RIFF"
      && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function fetchImageBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`zalo image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const declared = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const sniffed = sniffMediaType(buf);
  // jpg→jpeg è l'alias che rompe più spesso; il resto passa solo se già valido.
  const normalised = declared === "image/jpg" ? "image/jpeg" : declared;
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const mediaType = sniffed || (allowed.includes(normalised) ? normalised : "image/jpeg");
  if (sniffed && normalised && sniffed !== normalised) {
    console.log(`zalo image: content-type dichiarato "${declared}" ≠ byte reali ${sniffed} — uso i byte`);
  }
  return { base64: buf.toString("base64"), mediaType };
}

// Formatta la conferma voce per il messaggio di risposta del bot.
// Data vietnamita: 31/10/2026, non 2026-10-31. In una chat con una signora
// del mercato la forma ISO è rumore.
export const vnDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || "");
};

const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";

// Nudge CTV meinvoice — UNA riga in coda a "quý" e "sổ", e SOLO quando:
//  1. la proiezione annua ha superato la soglia e-invoice (thresholdStatus);
//  2. il codice referral esiste (env MEINVOICE_REF_CODE) — è il default di
//     produzione che manca finché Yuri non si registra come CTV: senza codice
//     l'output resta IDENTICO a prima, byte per byte.
// Citazione fiscale: il Decreto 70/2025 (che introdusse l'obbligo) è ABROGATO —
// la norma vigente è il Nghị định 254/2026/NĐ-CP, in vigore dal 01/07/2026,
// ed è quella che il messaggio cita.
export function einvoiceNudge(projection, lang = "vi", code = "") {
  if (!code) return "";
  if (!thresholdStatus(Number(projection) || 0).eInvoice.crossed) return "";
  if (lang === "en") {
    return `🧾 From 1 tỷ revenue you must issue e-invoices from a cash register (NĐ 254/2026). Sổ Sạch partner: meinvoice.vn — referral code ${code}.`;
  }
  return `🧾 Từ 1 tỷ doanh thu phải xuất hoá đơn điện tử từ máy tính tiền (NĐ 254/2026). Đối tác của Sổ Sạch: meinvoice.vn — mã giới thiệu ${code}.`;
}

// Cablaggio nei builder: legge l'env a ogni chiamata (non a import time, così
// i test possono impostarla/rimuoverla) e, se la riga c'è, la separa con una
// riga vuota. Se non c'è: stringa vuota, output invariato.
const nudgeSuffix = (projection, lang) => {
  const line = einvoiceNudge(projection, lang, process.env.MEINVOICE_REF_CODE || "");
  return line ? `\n\n${line}` : "";
};

// Il trimestre in un messaggio: è la domanda che il prodotto esiste per
// rispondere, perché la 01/CNKD si deposita per TRIMESTRE.
// ⚠️ Nella variante inglese i TERMINI FISCALI restano vietnamiti (01/CNKD,
// tờ khai, GTGT, TNCN, hạn nộp): sono i nomi che l'ufficio imposte e il
// đại lý thuế usano davvero — un contabile deve ritrovare quelli, con al
// massimo una glossa inglese accanto.
export function formatQuarterMessage(d, lang = "vi") {
  if (lang === "en") {
    const L = [
      `📊 Quý ${d.quarter}/${d.year} (quarter) — as of ${vnDate(d.generatedAt)}`,
      ``,
      `In (thu):    ${vnd(d.revenue)}`,
      `Out (chi):   ${vnd(d.expenses)}`,
      `Gross:       ${vnd(d.net)}`,
    ];
    if (d.declaredRevenue) {
      L.push(`(of which ${vnd(d.declaredRevenue)} is tự khai — self-declared, no receipts)`);
    }
    L.push(``);
    if (d.exempt) {
      L.push(`✅ Projected full-year revenue ${vnd(d.projection)} — below the 1 tỷ threshold.`);
      L.push(`No tax due this quarter, but the tờ khai STILL has to be filed.`);
    } else {
      L.push(`Provisional tax: ${vnd(d.total)}`);
      const pctEn = (r) => (r * 100).toFixed(1).replace(".0", "");
      L.push(`  • GTGT (VAT) ${pctEn(d.rates.vat)}%: ${vnd(d.vat)}`);
      L.push(`  • TNCN (PIT) ${pctEn(d.rates.pit)}%: ${vnd(d.pit)}`);
    }
    L.push(``);
    L.push(`🗓️ Hạn nộp tờ khai (filing deadline): ${vnDate(d.deadline)}`);
    L.push(``);
    L.push(`Draft — check with your đại lý thuế (tax agent) before filing.`);
    const nudgeEn = einvoiceNudge(d.projection, "en", process.env.MEINVOICE_REF_CODE || "");
    if (nudgeEn) L.push(``, nudgeEn);
    return L.join("\n");
  }
  const L = [
    `📊 Quý ${d.quarter}/${d.year} — tính đến ${vnDate(d.generatedAt)}`,
    ``,
    `Thu:      ${vnd(d.revenue)}`,
    `Chi:      ${vnd(d.expenses)}`,
    `Lãi gộp:  ${vnd(d.net)}`,
  ];
  if (d.declaredRevenue) {
    L.push(`(trong đó ${vnd(d.declaredRevenue)} là tự khai, chưa có chứng từ)`);
  }
  L.push(``);
  if (d.exempt) {
    L.push(`✅ Doanh thu dự kiến cả năm ${vnd(d.projection)} — dưới ngưỡng 1 tỷ.`);
    L.push(`Quý này chưa phải nộp thuế, nhưng VẪN phải nộp tờ khai.`);
  } else {
    L.push(`Thuế tạm tính: ${vnd(d.total)}`);
    // In Việt Nam il separatore decimale è la VIRGOLA: "1,5%", non "1.5%".
    const pct = (r) => (r * 100).toFixed(1).replace(".0", "").replace(".", ",");
    L.push(`  • GTGT ${pct(d.rates.vat)}%: ${vnd(d.vat)}`);
    L.push(`  • TNCN ${pct(d.rates.pit)}%: ${vnd(d.pit)}`);
  }
  L.push(``);
  L.push(`🗓️ Hạn nộp tờ khai: ${vnDate(d.deadline)}`);
  L.push(``);
  L.push(`Bản nháp — kiểm tra với đại lý thuế trước khi nộp.`);
  const nudge = einvoiceNudge(d.projection, "vi", process.env.MEINVOICE_REF_CODE || "");
  if (nudge) L.push(``, nudge);
  return L.join("\n");
}

// Il riepilogo dell'anno ("sổ"/"year"). Prima viveva inline in server.js: da
// quando esiste la variante inglese DEVE stare qui, accanto alle altre — due
// copie dello stesso messaggio in due file divergono sempre (è la lezione di
// commands.js).  d = { year, revenue, expenses, net, projection, crossed, left }.
export function formatYearMessage(d, lang = "vi") {
  if (lang === "en") {
    return (
      `📒 Book ${d.year}\n\n` +
      `In (thu):    ${vnd(d.revenue)}\n` +
      `Out (chi):   ${vnd(d.expenses)}\n` +
      `Gross:       ${vnd(d.net)}\n\n` +
      `Projected full year: ${vnd(d.projection)}\n` +
      (d.crossed
        ? `⚠️ Past the 1 tỷ threshold — tax is due this quarter. Type "quarter" for the numbers.`
        : `✅ ${vnd(d.left)} to go before the 1 tỷ threshold.`) +
      `\n\nType "quarter" for this quarter and the hạn nộp tờ khai (filing deadline).` +
      nudgeSuffix(d.projection, "en")
    );
  }
  return (
    `📒 Sổ năm ${d.year}\n\n` +
    `Thu:      ${vnd(d.revenue)}\n` +
    `Chi:      ${vnd(d.expenses)}\n` +
    `Lãi gộp:  ${vnd(d.net)}\n\n` +
    `Dự kiến cả năm: ${vnd(d.projection)}\n` +
    (d.crossed
      ? `⚠️ Đã vượt ngưỡng 1 tỷ — quý này phải nộp thuế. Gõ "quý" để xem số.`
      : `✅ Còn ${vnd(d.left)} nữa mới tới ngưỡng 1 tỷ.`) +
    `\n\nGõ "quý" để xem quý này và hạn nộp tờ khai.` +
    nudgeSuffix(d.projection, "vi")
  );
}

// Quando la data è stata corretta o indovinata l'utente DEVE saperlo: è
// l'unico che ha lo scontrino in mano, e una data sbagliata sposta la voce
// nel trimestre sbagliato della 01/CNKD.
const DATE_NOTE_VI = {
  swapped: "⚠️ Hoá đơn ghi ngày/tháng — mình hiểu là ngày trên. Sai thì trả lời \"sửa\".",
  guessed: "⚠️ Mình không đọc rõ ngày nên tạm lấy hôm nay. Sai thì trả lời \"sửa\".",
};
const DATE_NOTE_EN = {
  swapped: "⚠️ The date looked day/month swapped — I used the date above. Reply \"undo\" if wrong.",
  guessed: "⚠️ I couldn't read the date, so I used today. Reply \"undo\" if wrong.",
};

export function formatEntryMessage(entry, lang = "vi") {
  const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
  if (lang === "vi") {
    const note = DATE_NOTE_VI[entry.dateNote];
    return `✅ Đã ghi vào Sổ Sạch:\n${entry.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nNgày: ${entry.date}\n${note ? note + "\n" : ""}\nTrả lời "sửa" nếu cần chỉnh · "quý" xem quý này · "menu" xem tất cả.`;
  }
  // Variante inglese a PARITÀ di contenuto: nota sulla data e piè di pagina
  // con i comandi inclusi — un utente EN che perde l'avviso «data indovinata»
  // deposita la voce nel trimestre sbagliato esattamente come uno VN.
  const note = DATE_NOTE_EN[entry.dateNote];
  return `✅ Recorded in Sổ Sạch:\n${entry.type === "thu" ? "📈 IN" : "📉 OUT"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nDate: ${entry.date}\n${note ? note + "\n" : ""}\nReply "undo" to fix · "quarter" for this quarter · "menu" for everything.`;
}

// La proposta a bassa confidenza: la voce NON è nel libro — il bot mostra ciò
// che ha capito e chiede. Le opzioni sono NUMERI perché digitare "1" è l'unica
// cosa che riesce a chiunque su qualunque tastiera; solo "1" salva, tutto il
// resto scarta in silenzio (vedi src/pending.js).
export function formatLowConfidenceMessage(entry, lang = "vi") {
  const vnd = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
  const line = `${entry.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(entry.amount)}` +
    `\n${entry.counterparty || ""}${entry.description ? " — " + entry.description : ""}`;
  if (lang === "en") {
    return (
      `🤔 I read the photo but I'm not sure. My best guess:\n` +
      line + `\nDate: ${vnDate(entry.date)}\n\n` +
      `What would you like to do?\n` +
      `1️⃣ Reply "1" — save exactly as above\n` +
      `2️⃣ Retake the photo (good light, amount clearly visible) and send it again\n` +
      `3️⃣ Type it yourself: "thu 2tr4" or "chi 500k"\n\n` +
      `(If you don't reply, I'll drop this photo after 10 minutes.)`
    );
  }
  return (
    `🤔 Mình đọc được ảnh nhưng chưa chắc lắm. Mình tạm hiểu là:\n` +
    line + `\nNgày: ${vnDate(entry.date)}\n\n` +
    `Bạn chọn giúp mình nhé:\n` +
    `1️⃣ Trả lời "1" — lưu đúng như trên\n` +
    `2️⃣ Chụp lại rõ hơn (đủ sáng, thấy rõ số tiền) rồi gửi lại\n` +
    `3️⃣ Gõ tay: "thu 2tr4" hoặc "chi 500k"\n\n` +
    `(Không trả lời thì mình bỏ qua ảnh này sau 10 phút.)`
  );
}
