// ============================================================================
//  Sổ Sạch — server. Sổ sách kế toán AI cho hộ kinh doanh.
//  Foto scontrino → voce di sổ → soglie fiscali → tờ khai trimestrale.
//  Near-final: account (SĐT+PIN), ruoli hộ/đại lý thuế, storage JSON↔Postgres,
//  billing payOS (env-gated, pilot mode senza chiavi), export CSV, Zalo OA.
// ============================================================================
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  THRESHOLDS, CATEGORIES, totals, projectAnnual, quarterlyTax,
  thresholdStatus, quarterOf, nextDeadline,
} from "./src/tax.js";
import { extractReceipt, extractionMode } from "./src/extract.js";
import { zaloEnabled, verifyWebhook, sendText, fetchImageBase64, formatEntryMessage } from "./src/zalo.js";
import { initStore, storeMode, books, accounts, getBook, persistBook, persistAccount, removeBook } from "./src/store.js";
import { register, login, publicAccount, findAgentByCode, findAccountByZaloId, createLinkCode, consumeLinkCode, authOptional, requireAuth, normalizePhone } from "./src/auth.js";
import { PLANS, payosEnabled, createPaymentLink, verifyPayosWebhook, activateSub, subActive } from "./src/billing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3500;
const DATA_DIR = join(__dirname, "data");

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
app.post("/webhooks/zalo", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  const mac = req.headers["x-zevent-signature"];
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "bad json" }); }
  const check = verifyWebhook(raw, event.timestamp, mac);
  if (!check.ok && zaloEnabled()) return res.status(401).json({ error: "invalid signature" });
  try {
    const uid = event?.sender?.id || "zalo-unknown";
    if (event.event_name === "user_send_image") {
      const url = event?.message?.attachments?.[0]?.payload?.url;
      if (url) {
        const bookUid = zaloBookUid(uid); // account collegato o libro Zalo
        const { base64, mediaType } = await fetchImageBase64(url);
        const extracted = await extractReceipt(base64, mediaType);
        const b = getBook(bookUid);
        const entry = { id: "e" + Date.now(), ...extracted, source: "zalo", createdAt: new Date().toISOString() };
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
      } else if (txt === "sổ" || txt === "so") {
        const b = getBook(zaloBookUid(uid));
        const now = new Date();
        const t = totals(b.entries, { year: now.getFullYear() });
        await sendText(uid, `📒 Sổ năm ${now.getFullYear()}:\nThu: ${t.revenue.toLocaleString("vi-VN")}đ\nChi: ${t.expenses.toLocaleString("vi-VN")}đ\nLãi gộp: ${t.net.toLocaleString("vi-VN")}đ`);
      } else {
        const linked = !!findAccountByZaloId(uid);
        await sendText(uid,
          "Chào bạn! Chụp ảnh hoá đơn gửi vào đây, Sổ Sạch sẽ ghi sổ giúp bạn. Gõ \"sổ\" để xem tổng kết." +
          (linked ? "" : "\n\n💡 Có tài khoản trên web? Vào phần Tài khoản → \"Lấy mã kết nối Zalo\" rồi gửi mã vào đây để gộp sổ và cho đại lý thuế xem giúp."));
      }
    }
  } catch (e) { console.error("zalo webhook:", e.message); }
  res.json({ ok: true });
});

app.use(express.json({ limit: "12mb" }));
app.use(authOptional);
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
app.post("/api/extract", async (req, res) => {
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
  const year = now.getFullYear();
  const { q } = quarterOf(now);
  const tYear = totals(b.entries, { year });
  const tQuarter = totals(b.entries, { year, q });
  const projection = projectAnnual(tYear.revenue, now);
  return {
    profile: b.profile,
    entries: [...b.entries].sort((a, z) => z.date.localeCompare(a.date)).slice(0, 500),
    year: { ...tYear, label: String(year) },
    quarter: { ...tQuarter, label: `Q${q}/${year}` },
    thresholds: thresholdStatus(projection),
    tax: quarterlyTax(tQuarter.revenue, b.profile.category, projection),
    deadline: nextDeadline(now),
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
    date: date || new Date().toISOString().slice(0, 10),
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
  res.setHeader("Content-Disposition", `attachment; filename="so-sach-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// ---- Tờ khai 01/CNKD --------------------------------------------------------------
app.get("/api/declaration", (req, res) => {
  const uid = uidFor(req);
  const b = getBook(uid);
  const now = new Date();
  const year = Number(req.query.year || now.getFullYear());
  const q = Number(req.query.q || quarterOf(now).q);
  const t = totals(b.entries, { year, q });
  const tYear = totals(b.entries, { year });
  const projection = projectAnnual(tYear.revenue, now);
  const tax = quarterlyTax(t.revenue, b.profile.category, projection);
  const cat = CATEGORIES[b.profile.category];
  const agent = req.account?.agentPhone ? accounts[req.account.agentPhone] : null;
  res.json({
    form: "01/CNKD (Thông tư 40/2021/TT-BTC) — BẢN NHÁP / DRAFT",
    period: `Quý ${q} năm ${year}`,
    taxpayer: b.profile.name || "—",
    category: { key: b.profile.category, vi: cat.vi, en: cat.en },
    revenue: t.revenue,
    rates: tax.rates,
    vat: tax.vat,
    pit: tax.pit,
    total: tax.total,
    exempt: tax.exempt,
    exemptNote: tax.exempt
      ? "Doanh thu dự kiến cả năm dưới ngưỡng chịu thuế — vẫn phải nộp tờ khai."
      : null,
    agent: agent ? { name: agent.name, phone: agent.phone } : null,
    disclaimer: "Bản nháp do Sổ Sạch soạn. Kiểm tra với đại lý thuế trước khi nộp. / Draft prepared by Sổ Sạch — verify with a licensed tax agent before filing.",
  });
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

app.get("/healthz", (_req, res) => res.json({ ok: true, store: storeMode(), billing: payosEnabled() ? "payos" : "pilot" }));

// ---- Boot -------------------------------------------------------------------------
const mode = await initStore(DATA_DIR);
app.listen(PORT, () =>
  console.log(`📒 Sổ Sạch http://localhost:${PORT} (extraction: ${extractionMode()}, zalo: ${zaloEnabled()}, store: ${mode}, billing: ${payosEnabled() ? "payos" : "pilot"})`));
