// ============================================================================
//  Sổ Sạch — account + sessioni.
//  Telefono VN + PIN (4–8 cifre) hashed con scrypt; token firmati HMAC.
//  Ruoli: "ho" (hộ kinh doanh) e "agent" (đại lý thuế, con codice invito).
//  In produzione il login primario sarà Zalo OAuth: questo layer resta come
//  fallback web e come modello dati (account = telefono).
// ============================================================================
import crypto from "node:crypto";
import { accounts, persistAccount } from "./store.js";

const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET)
  console.warn("auth: SESSION_SECRET non impostato — le sessioni si invalidano a ogni riavvio (ok per pilota).");

const TOKEN_DAYS = 30;

export function normalizePhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("84")) d = "0" + d.slice(2);
  if (!/^0\d{9}$/.test(d)) return null; // formato VN: 0 + 9 cifre
  return d;
}

export function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 32).toString("hex");
}

export function makeToken(phone) {
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  const mac = crypto.createHmac("sha256", SECRET).update(`${phone}.${exp}`).digest("hex").slice(0, 32);
  return `${phone}.${exp}.${mac}`;
}

export function verifyToken(token) {
  const [phone, expStr, mac] = String(token || "").split(".");
  if (!phone || !expStr || !mac) return null;
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return null;
  const want = crypto.createHmac("sha256", SECRET).update(`${phone}.${exp}`).digest("hex").slice(0, 32);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  } catch { return null; }
  return accounts[phone] ? phone : null;
}

// Registrazione. role: "ho" | "agent". agentCode opzionale (collega hộ → agente).
export function register({ phone: rawPhone, pin, role = "ho", name = "", agentCode = "" }) {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { error: "Số điện thoại không hợp lệ (VD: 0901234567)." };
  if (!/^\d{4,8}$/.test(String(pin || ""))) return { error: "Mã PIN phải là 4–8 chữ số." };
  if (accounts[phone]) return { error: "Số này đã đăng ký — hãy đăng nhập." };
  if (!["ho", "agent"].includes(role)) role = "ho";

  const salt = crypto.randomBytes(12).toString("hex");
  const acct = {
    phone, salt, pinHash: hashPin(pin, salt), role,
    name: String(name || "").slice(0, 120),
    createdAt: new Date().toISOString(),
    sub: { plan: null, activeUntil: null, pilot: false },
  };
  if (role === "agent") acct.agentCode = generateAgentCode();
  if (role === "ho" && agentCode) {
    const agent = findAgentByCode(agentCode);
    if (agent) acct.agentPhone = agent.phone;
  }
  accounts[phone] = acct;
  persistAccount(phone);
  return { account: acct, token: makeToken(phone) };
}

export function login({ phone: rawPhone, pin }) {
  const phone = normalizePhone(rawPhone);
  const acct = phone && accounts[phone];
  if (!acct) return { error: "Không tìm thấy tài khoản — hãy đăng ký." };
  if (hashPin(pin, acct.salt) !== acct.pinHash) return { error: "Sai mã PIN." };
  return { account: acct, token: makeToken(phone) };
}

export function findAgentByCode(code) {
  const c = String(code || "").trim().toUpperCase();
  return Object.values(accounts).find((a) => a.role === "agent" && a.agentCode === c) || null;
}

function generateAgentCode() {
  let code;
  do { code = "DL" + String(Math.floor(1000 + Math.random() * 9000)); }
  while (findAgentByCode(code));
  return code;
}

// ---- Zalo linking -----------------------------------------------------------
//  Un utente web (telefono+PIN) genera un codice, lo invia all'OA Sổ Sạch su
//  Zalo, e il bot collega il suo zaloId all'account → il sổ su Zalo e sul web
//  diventano lo stesso libro (e l'đại lý thuế lo vede). Codici effimeri, 15 min.
const linkCodes = new Map(); // code -> { phone, exp }
const LINK_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // niente O/0/I/1 ambigui

export function createLinkCode(phone) {
  const now = Date.now();
  for (const [c, r] of linkCodes) if (r.exp < now) linkCodes.delete(c); // purge
  let code;
  do { code = Array.from({ length: 6 }, () => LINK_ALPHABET[crypto.randomInt(LINK_ALPHABET.length)]).join(""); }
  while (linkCodes.has(code));
  linkCodes.set(code, { phone, exp: now + 15 * 60 * 1000 });
  return code;
}

// Consuma un codice per un dato zaloId. Ritorna il telefono collegato o null.
export function consumeLinkCode(code, zaloId) {
  const rec = linkCodes.get(String(code || "").trim().toUpperCase());
  if (!rec || Date.now() > rec.exp) return null;
  linkCodes.delete(String(code).trim().toUpperCase());
  const acct = accounts[rec.phone];
  if (!acct) return null;
  acct.zaloId = zaloId;
  persistAccount(rec.phone);
  return rec.phone;
}

export function findAccountByZaloId(zaloId) {
  if (!zaloId) return null;
  return Object.values(accounts).find((a) => a.zaloId === zaloId) || null;
}

// Vista pubblica dell'account (mai pinHash/salt fuori).
export function publicAccount(acct) {
  if (!acct) return null;
  const { phone, role, name, agentCode, agentPhone, sub, createdAt } = acct;
  return { phone, role, name, agentCode: agentCode || null, agentPhone: agentPhone || null,
           zaloLinked: !!acct.zaloId, sub, createdAt };
}

// Middleware: popola req.phone / req.account se il Bearer token è valido.
export function authOptional(req, _res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  const phone = token ? verifyToken(token) : null;
  if (phone) { req.phone = phone; req.account = accounts[phone]; }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.account) return res.status(401).json({ error: "Cần đăng nhập." });
  next();
}
