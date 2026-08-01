// ============================================================================
//  Sổ Sạch — integrazione Zalo Official Account (env-driven).
//  Il bot vive dove vivono gli hộ kinh doanh: dentro Zalo.
//  Senza credenziali il modulo resta inerte e il prodotto gira via web.
//
//  Env richieste per attivarlo (vedi docs/DEPLOY.md):
//    ZALO_OA_ACCESS_TOKEN  — token OA (rinnovabile via refresh flow)
//    ZALO_APP_SECRET       — per verificare la firma dei webhook (X-ZEvent-Signature)
//    ZALO_APP_ID
// ============================================================================
import { createHash } from "node:crypto";
import { getAccessToken, tokenStatus } from "./zalo_token.js";

const APP_SECRET = process.env.ZALO_APP_SECRET || null;
const APP_ID = process.env.ZALO_APP_ID || null;
const API = "https://openapi.zalo.me/v3.0/oa";

// Abilitato se esiste una catena di token (env al primo avvio, poi lo store).
export const zaloEnabled = () => tokenStatus().configured;
export { tokenStatus };

// Verifica firma webhook Zalo: mac = sha256(appId + rawBody + timestamp + appSecret).
// Se le credenziali non sono configurate, accetta solo in modalità demo.
export function verifyWebhook(rawBody, timestamp, mac) {
  if (!APP_SECRET || !APP_ID) return { ok: false, reason: "zalo not configured" };
  const expected = createHash("sha256")
    .update(APP_ID + rawBody + String(timestamp) + APP_SECRET)
    .digest("hex");
  return { ok: expected === String(mac || "").replace(/^mac=/, ""), reason: "signature" };
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
export async function fetchImageBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`zalo image ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type") || "image/jpeg";
  return { base64: buf.toString("base64"), mediaType };
}

// Formatta la conferma voce per il messaggio di risposta del bot.
export function formatEntryMessage(entry, lang = "vi") {
  const vnd = (n) => n.toLocaleString("vi-VN") + "đ";
  if (lang === "vi") {
    return `✅ Đã ghi vào Sổ Sạch:\n${entry.type === "thu" ? "📈 THU" : "📉 CHI"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nNgày: ${entry.date}\n\nTrả lời "sửa" nếu cần chỉnh, "sổ" để xem tổng kết tháng.`;
  }
  return `✅ Recorded in Sổ Sạch:\n${entry.type === "thu" ? "📈 IN" : "📉 OUT"} ${vnd(entry.amount)}\n${entry.counterparty || ""} — ${entry.description || ""}\nDate: ${entry.date}`;
}
