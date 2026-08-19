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

// Il trimestre in un messaggio: è la domanda che il prodotto esiste per
// rispondere, perché la 01/CNKD si deposita per TRIMESTRE.
export function formatQuarterMessage(d) {
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
  return L.join("\n");
}

// Quando la data è stata corretta o indovinata l'utente DEVE saperlo: è
// l'unico che ha lo scontrino in mano, e una data sbagliata sposta la voce
// nel trimestre sbagliato della 01/CNKD.
const DATE_NOTE_VI = {
  swapped: "⚠️ Hoá đơn ghi ngày/tháng — mình hiểu là ngày trên. Sai thì trả lời \"sửa\".",
  guessed: "⚠️ Mình không đọc rõ ngày nên tạm lấy hôm nay. Sai thì trả lời \"sửa\".",
};

export function formatEntryMessage(entry, lang = "vi") {
  const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
  if (lang === "vi") {
    const note = DATE_NOTE_VI[entry.dateNote];
    return `✅ Đã ghi vào Sổ Sạch:\n${entry.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nNgày: ${entry.date}\n${note ? note + "\n" : ""}\nTrả lời "sửa" nếu cần chỉnh · "quý" xem quý này · "menu" xem tất cả.`;
  }
  return `✅ Recorded in Sổ Sạch:\n${entry.type === "thu" ? "📈 IN" : "📉 OUT"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nDate: ${entry.date}`;
}
