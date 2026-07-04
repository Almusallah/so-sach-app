// ============================================================================
//  Sổ Sạch — server. Sổ sách kế toán AI cho hộ kinh doanh.
//  Foto scontrino → voce di sổ → soglie fiscali → tờ khai trimestrale.
// ============================================================================
import express from "express";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  THRESHOLDS, CATEGORIES, totals, projectAnnual, quarterlyTax,
  thresholdStatus, quarterOf, nextDeadline,
} from "./src/tax.js";
import { extractReceipt, extractionMode } from "./src/extract.js";
import { zaloEnabled, verifyWebhook, sendText, fetchImageBase64, formatEntryMessage } from "./src/zalo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3500;

const DATA_DIR = join(__dirname, "data");
const LEDGER = join(DATA_DIR, "ledger.json");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// Sostegno multi-tenant minimo: un libro per utente (web demo usa "demo").
let books = {};
if (existsSync(LEDGER)) { try { books = JSON.parse(readFileSync(LEDGER, "utf8")); } catch { books = {}; } }
const book = (uid) => {
  if (!books[uid]) books[uid] = { profile: { name: "", category: "services_goods" }, entries: [] };
  return books[uid];
};
const persist = () => writeFileSync(LEDGER, JSON.stringify(books, null, 2));

// Il webhook Zalo ha bisogno del raw body per la firma → registrato PRIMA del json parser.
app.post("/webhooks/zalo", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  const mac = req.headers["x-zevent-signature"];
  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "bad json" }); }
  const check = verifyWebhook(raw, event.timestamp, mac);
  if (!check.ok && zaloEnabled()) return res.status(401).json({ error: "invalid signature" });

  // Gestione: immagine → estrazione → voce sul libro dell'utente Zalo.
  try {
    const uid = event?.sender?.id || "zalo-unknown";
    if (event.event_name === "user_send_image") {
      const url = event?.message?.attachments?.[0]?.payload?.url;
      if (url) {
        const { base64, mediaType } = await fetchImageBase64(url);
        const extracted = await extractReceipt(base64, mediaType);
        const b = book("zalo:" + uid);
        const entry = { id: "e" + Date.now(), ...extracted, source: "zalo", createdAt: new Date().toISOString() };
        b.entries.push(entry);
        persist();
        await sendText(uid, formatEntryMessage(entry));
      }
    } else if (event.event_name === "user_send_text") {
      const txt = (event?.message?.text || "").trim().toLowerCase();
      const b = book("zalo:" + uid);
      if (txt === "sổ" || txt === "so") {
        const now = new Date();
        const t = totals(b.entries, { year: now.getFullYear() });
        await sendText(uid, `📒 Sổ năm ${now.getFullYear()}:\nThu: ${t.revenue.toLocaleString("vi-VN")}đ\nChi: ${t.expenses.toLocaleString("vi-VN")}đ\nLãi gộp: ${t.net.toLocaleString("vi-VN")}đ`);
      } else {
        await sendText(uid, "Chào bạn! Chụp ảnh hoá đơn gửi vào đây, Sổ Sạch sẽ ghi sổ giúp bạn. Gõ \"sổ\" để xem tổng kết.");
      }
    }
  } catch (e) {
    console.error("zalo webhook:", e.message);
  }
  res.json({ ok: true });
});

app.use(express.json({ limit: "12mb" }));
app.use(express.static(join(__dirname, "public")));

// ---- API ----------------------------------------------------------------------
app.get("/api/config", (_req, res) =>
  res.json({
    extraction: extractionMode(),
    zalo: zaloEnabled(),
    thresholds: THRESHOLDS,
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { vi: c.vi, en: c.en, vat: c.vat, pit: c.pit, examples_vi: c.examples_vi, examples_en: c.examples_en }])),
  })
);

// Estrazione da foto (base64) — usata dalla web app.
app.post("/api/extract", async (req, res) => {
  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: "image (base64) required" });
  try {
    const extracted = await extractReceipt(image, mediaType || "image/jpeg");
    res.json({ ok: true, extracted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Libro: lettura + CRUD voci (uid via query, default demo).
app.get("/api/ledger", (req, res) => {
  const uid = String(req.query.uid || "demo");
  const b = book(uid);
  const now = new Date();
  const year = now.getFullYear();
  const { q } = quarterOf(now);
  const tYear = totals(b.entries, { year });
  const tQuarter = totals(b.entries, { year, q });
  const projection = projectAnnual(tYear.revenue, now);
  res.json({
    profile: b.profile,
    entries: [...b.entries].sort((a, z) => z.date.localeCompare(a.date)).slice(0, 500),
    year: { ...tYear, label: String(year) },
    quarter: { ...tQuarter, label: `Q${q}/${year}` },
    thresholds: thresholdStatus(projection),
    tax: quarterlyTax(tQuarter.revenue, b.profile.category, projection),
    deadline: nextDeadline(now),
  });
});

app.post("/api/ledger", (req, res) => {
  const uid = String(req.query.uid || "demo");
  const { type, amount, date, counterparty, description } = req.body || {};
  if (!["thu", "chi"].includes(type) || !Number(amount))
    return res.status(400).json({ error: "type thu|chi e amount richiesti" });
  const b = book(uid);
  const entry = {
    id: "e" + Date.now() + Math.random().toString(36).slice(2, 6),
    type, amount: Math.round(Number(amount)),
    date: date || new Date().toISOString().slice(0, 10),
    counterparty: String(counterparty || "").slice(0, 120),
    description: String(description || "").slice(0, 200),
    source: "web", createdAt: new Date().toISOString(),
  };
  b.entries.push(entry);
  persist();
  res.json({ ok: true, entry });
});

app.delete("/api/ledger/:id", (req, res) => {
  const uid = String(req.query.uid || "demo");
  const b = book(uid);
  const before = b.entries.length;
  b.entries = b.entries.filter((e) => e.id !== req.params.id);
  persist();
  res.json({ ok: true, removed: before - b.entries.length });
});

app.post("/api/profile", (req, res) => {
  const uid = String(req.query.uid || "demo");
  const b = book(uid);
  const { name, category } = req.body || {};
  if (name !== undefined) b.profile.name = String(name).slice(0, 120);
  if (category && CATEGORIES[category]) b.profile.category = category;
  persist();
  res.json({ ok: true, profile: b.profile });
});

// Tờ khai 01/CNKD (bozza precompilata) per il trimestre corrente o richiesto.
app.get("/api/declaration", (req, res) => {
  const uid = String(req.query.uid || "demo");
  const b = book(uid);
  const now = new Date();
  const year = Number(req.query.year || now.getFullYear());
  const q = Number(req.query.q || quarterOf(now).q);
  const t = totals(b.entries, { year, q });
  const tYear = totals(b.entries, { year });
  const projection = projectAnnual(tYear.revenue, now);
  const tax = quarterlyTax(t.revenue, b.profile.category, projection);
  const cat = CATEGORIES[b.profile.category];
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
    disclaimer: "Bản nháp do Sổ Sạch soạn. Kiểm tra với đại lý thuế trước khi nộp. / Draft prepared by Sổ Sạch — verify with a licensed tax agent before filing.",
  });
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`📒 Sổ Sạch chạy tại http://localhost:${PORT} (extraction: ${extractionMode()}, zalo: ${zaloEnabled()})`));
