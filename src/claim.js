// ============================================================================
//  Sổ Sạch — claim token: il link a un tocco che porta un utente solo-Zalo
//  dentro un account web (docs/ONBOARDING_SPEC.md).
//
//  Il funnel reale è Zalo-first: il libro vive in "zalo:<id>", invisibile sul
//  web e irrecuperabile se cambia telefono. DOPO il primo momento magico
//  (foto → scrittura) il bot propone UNA volta un link firmato:
//    https://sosach.com.vn/claim/<token>
//  token = base64url({zaloId, exp}) + "." + base64url(HMAC-SHA256(payload)).
//  Nessun dato personale nell'URL oltre l'id opaco firmato. Scadenza 72 ore,
//  monouso, un token per uid alla volta: rigenerare invalida il precedente.
//
//  Questo modulo è PURO (niente store, niente rete): il registro monouso è
//  iniettabile, così i test girano senza server e il server può persistere
//  hash e marcatore sul libro zalo (claimTokenHash / claimTokenUsedAt).
// ============================================================================
import crypto from "node:crypto";

const CLAIM_TTL_MS = 72 * 60 * 60 * 1000; // 72 ore, come da spec

const b64uJson = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const macFor = (payloadB64, secret) =>
  crypto.createHmac("sha256", String(secret)).update(payloadB64).digest("base64url");

// Impronta del token: è ciò che si persiste (mai il token in chiaro nello
// store — un dump del DB non deve regalare link di claim ancora validi).
export function hashClaimToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

// Registro monouso in memoria (default nei test). Il server ne inietta uno
// che legge/scrive il libro zalo, così i marcatori sopravvivono al riavvio.
//   getCurrentHash(zaloId)        → hash del token corrente o null
//   setCurrentHash(zaloId, hash)  → registra il token appena coniato
//   isUsed(zaloId, hash)          → true se già consumato
//   markUsed(zaloId, hash)        → consuma
export function makeMemoryClaimRegistry() {
  const used = new Set();
  const current = new Map();
  return {
    getCurrentHash: (zaloId) => current.get(zaloId) || null,
    setCurrentHash: (zaloId, hash) => { current.set(zaloId, hash); },
    isUsed: (_zaloId, hash) => used.has(hash),
    markUsed: (_zaloId, hash) => { used.add(hash); },
  };
}

// Conia un token per uno zaloId. `now` iniettabile per i test di scadenza.
// Col registro, il mint registra l'hash corrente: UN token per uid alla
// volta — il precedente smette di verificare (vedi verifyClaimToken).
export function mintClaimToken(zaloId, { secret, now = Date.now(), registry = null } = {}) {
  if (!secret) throw new Error("claim: secret mancante");
  if (!zaloId) throw new Error("claim: zaloId mancante");
  const payload = b64uJson({ zaloId: String(zaloId), exp: now + CLAIM_TTL_MS });
  const token = payload + "." + macFor(payload, secret);
  registry?.setCurrentHash(String(zaloId), hashClaimToken(token));
  return token;
}

// Verifica: {zaloId} oppure {error: "invalid"|"expired"|"used"}.
// Ordine dei controlli: firma (un byte cambiato = invalid, prima di qualunque
// altra risposta — la firma è l'unica cosa che rende il resto affidabile),
// poi supersessione da re-mint, poi scadenza, poi monouso.
export function verifyClaimToken(token, { secret, now = Date.now(), registry = null } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { error: "invalid" };
  const [payloadB64, mac] = parts;
  const want = macFor(payloadB64, secret);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return { error: "invalid" };
  } catch { return { error: "invalid" }; }
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")); } catch { return { error: "invalid" }; }
  const zaloId = payload?.zaloId, exp = payload?.exp;
  if (typeof zaloId !== "string" || !zaloId || !Number.isFinite(exp)) return { error: "invalid" };
  const hash = hashClaimToken(token);
  // Re-mint: se esiste un token corrente e NON è questo, questo è il vecchio.
  const cur = registry?.getCurrentHash(zaloId) || null;
  if (cur && cur !== hash) return { error: "invalid" };
  if (now > exp) return { error: "expired" };
  if (registry?.isUsed(zaloId, hash)) return { error: "used" };
  return { zaloId };
}

// ---- Copy (VI-first, coppia EN) ---------------------------------------------------
// Le due righe vivono qui, accanto alla logica che decide QUANDO escono:
// testo e condizione in due file diversi divergono sempre (lezione di
// commands.js). I termini fiscali restano vietnamiti anche in EN.

// CTA lunga, appesa UNA volta alla prima conferma di scrittura (spec, "Copy").
export function claimCtaLine(link, lang = "vi") {
  return lang === "en"
    ? `💡 Create a free account to see your book on the web, let your đại lý thuế help, and never lose it when you change phones: ${link}`
    : `💡 Tạo tài khoản (miễn phí) để xem sổ trên web, cho đại lý thuế xem giúp, và không mất sổ khi đổi điện thoại: ${link}`;
}

// Re-prompt breve (UNA riga), SOLO in coda a "menu" e "quý" (spec, Flusso §2).
export function claimReminderLine(link, lang = "vi") {
  return lang === "en"
    ? `💡 Create an account to see your book on the web and keep it when you change phones: ${link}`
    : `💡 Tạo tài khoản để xem sổ trên web và không mất sổ khi đổi điện thoại: ${link}`;
}

// La CTA esce UNA sola volta per libro: il flag claimPromptedAt si scrive qui,
// sul libro passato — il chiamante persiste. Libro già promptato (o assente,
// o già collegato: in quel caso il chiamante non arriva qui) → stringa vuota.
export function claimPromptFor(book, link, lang = "vi") {
  if (!book || book.claimPromptedAt) return "";
  book.claimPromptedAt = new Date().toISOString();
  return "\n\n" + claimCtaLine(link, lang);
}
