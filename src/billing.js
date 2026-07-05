// ============================================================================
//  Sổ Sạch — billing (payOS, env-gated).
//  Con PAYOS_CLIENT_ID / PAYOS_API_KEY / PAYOS_CHECKSUM_KEY presenti:
//    → link di pagamento VietQR reali + webhook firmato.
//  Senza chiavi: "pilot mode" — l'abbonamento founder si attiva gratis (30gg),
//  così il flusso prodotto è completo end-to-end anche prima del conto payOS.
// ============================================================================
import crypto from "node:crypto";

export const PLANS = {
  co_ban: { key: "co_ban", vi: "Cơ bản", en: "Core", amountVND: 69000 },
  pro:    { key: "pro",    vi: "Pro",    en: "Pro",  amountVND: 149000 },
};

export const payosEnabled = () =>
  !!(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY);

// Firma payOS: HMAC-SHA256 del querystring ordinato alfabeticamente.
function signSorted(obj) {
  const qs = Object.keys(obj).sort().map((k) => `${k}=${obj[k] ?? ""}`).join("&");
  return crypto.createHmac("sha256", process.env.PAYOS_CHECKSUM_KEY).update(qs).digest("hex");
}

// Crea un payment-link payOS per un piano. Ritorna { checkoutUrl } o { error }.
export async function createPaymentLink({ planKey, phone, baseUrl }) {
  const plan = PLANS[planKey];
  if (!plan) return { error: "unknown plan" };
  const orderCode = Number(String(Date.now()).slice(-10)); // intero univoco richiesto da payOS
  const payload = {
    orderCode,
    amount: plan.amountVND,
    description: `SoSach ${plan.key} ${phone}`.slice(0, 25), // payOS: max 25 caratteri
    returnUrl: `${baseUrl}/?paid=1`,
    cancelUrl: `${baseUrl}/?paid=0`,
  };
  payload.signature = signSorted({
    amount: payload.amount, cancelUrl: payload.cancelUrl, description: payload.description,
    orderCode: payload.orderCode, returnUrl: payload.returnUrl,
  });
  const res = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": process.env.PAYOS_CLIENT_ID,
      "x-api-key": process.env.PAYOS_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (data?.data?.checkoutUrl) return { checkoutUrl: data.data.checkoutUrl, orderCode };
  return { error: data?.desc || "payOS error" };
}

// Verifica firma webhook payOS: body = { code, desc, data, signature }.
export function verifyPayosWebhook(body) {
  if (!payosEnabled()) return false;
  const { data, signature } = body || {};
  if (!data || !signature) return false;
  const want = signSorted(data);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(want));
  } catch { return false; }
}

// Attiva/estende l'abbonamento sull'account (30 giorni per ciclo).
export function activateSub(acct, planKey, { pilot = false } = {}) {
  const now = Date.now();
  const base = acct.sub?.activeUntil && new Date(acct.sub.activeUntil).getTime() > now
    ? new Date(acct.sub.activeUntil).getTime() : now;
  acct.sub = {
    plan: planKey,
    activeUntil: new Date(base + 30 * 864e5).toISOString(),
    pilot,
  };
  return acct.sub;
}

export const subActive = (acct) =>
  !!(acct?.sub?.activeUntil && new Date(acct.sub.activeUntil).getTime() > Date.now());
