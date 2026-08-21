// End-to-end contro un server VERO: registrazione → voci → libro → 01/CNKD.
// Niente mock: se una route cambia forma, questo test se ne accorge.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const PORT = 3599, BASE = `http://127.0.0.1:${PORT}`;
const env = { ...process.env, PORT, NODE_ENV: "test", SESSION_SECRET: "test-secret-e2e",
  DATABASE_URL: "", ANTHROPIC_API_KEY: "", DATA_DIR: "" };
const srv = spawn("node", ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
srv.stderr.on("data", (d) => process.env.VERBOSE && console.error("[srv]", String(d).trim()));

const ok = [], bad = [];
const check = (name, fn) => { try { fn(); ok.push(name); } catch (e) { bad.push(`${name}\n     → ${e.message.split("\n")[0]}`); } };

async function ready() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + "/healthz")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server non è partito");
}

// L'autenticazione è un Bearer token nel corpo della risposta, NON un cookie:
// senza Authorization ogni scrittura finisce nel libro condiviso "demo".
let token = null;
async function api(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}), ...(opts.headers || {}) },
  });
  const body = r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text();
  return { status: r.status, body };
}

const vnd = (n) => n.toLocaleString("vi-VN") + "đ";

try {
  await ready();

  // --- 1. il negozio apre --------------------------------------------------
  const health = await api("/healthz");
  check("healthz risponde ok", () => assert.equal(health.body.ok, true));

  const phone = "0900" + String(Date.now()).slice(-6);
  const reg = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone, pin: "246810", name: "Quán Cà Phê Cô Ba" }) });
  check("registrazione hộ kinh doanh", () => assert.equal(reg.status, 200));
  token = reg.body.token;
  check("la registrazione restituisce un token", () => assert.ok(token));
  const me = await api("/api/auth/me");
  check("il token identifica l'hộ giusto", () => assert.equal(me.body.account?.phone, phone));
  check("il PIN non torna MAI indietro", () =>
    assert.ok(!JSON.stringify(reg.body).match(/246810|pinHash|salt/i), JSON.stringify(reg.body).slice(0, 120)));

  await api("/api/profile", { method: "POST",
    body: JSON.stringify({ name: "Quán Cà Phê Cô Ba", category: "services_goods" }) });

  // --- 2. un trimestre di lavoro ------------------------------------------
  // Q3/2026: 92 giorni di incassi + spese, sotto la soglia del miliardo.
  let added = 0;
  for (let d = 0; d < 50; d++) {
    const date = new Date(Date.UTC(2026, 6, 1) + d * 86400000).toISOString().slice(0, 10);
    const r1 = await api("/api/ledger", { method: "POST", body: JSON.stringify({
      type: "thu", amount: 1_800_000 + (d % 7) * 120_000, date,
      counterparty: "Khách lẻ", description: "Tổng bán trong ngày" }) });
    const r2 = await api("/api/ledger", { method: "POST", body: JSON.stringify({
      type: "chi", amount: 400_000 + (d % 5) * 30_000, date,
      counterparty: "Chợ đầu mối", description: "Nguyên liệu" }) });
    if (r1.status === 200 && r2.status === 200) added += 2;
  }
  check("50 giorni di voci accettate", () => assert.equal(added, 100));

  const led = await api("/api/ledger");
  check("il libro torna le voci", () => assert.ok(led.body.entries.length >= 40));
  check("il libro calcola i totali di anno e trimestre", () => {
    assert.ok(led.body.year.revenue > 0 && led.body.year.expenses > 0, "anno");
    assert.ok(led.body.quarter.revenue > 0, "trimestre");
    assert.equal(led.body.year.net, led.body.year.revenue - led.body.year.expenses);
  });
  check("il grafico mensile non perde i mesi di confine", () => {
    const tot = led.body.monthly.reduce((a, m) => a + m.thu, 0);
    assert.equal(tot, led.body.year.revenue, "somma mensile = totale anno");
  });
  check("il libro porta il punteggio Sổ Sạch", () =>
    assert.ok(led.body.score && led.body.score.score >= 0 && ["A","B","C","D"].includes(led.body.score.grade)));
  check("il libro porta lo stato soglie", () => assert.ok(led.body.thresholds?.taxFree));

  // --- 3. la dichiarazione -------------------------------------------------
  const dec = await api("/api/declaration?year=2026&q=3");
  const D = dec.body;
  if (process.env.DEBUG) {
    const thu = led.body.entries.filter((e) => e.type === "thu");
    console.error("DEBUG entries:", led.body.entries.length, "thu:", thu.length,
      "range:", thu.at(-1)?.date, "→", thu[0]?.date,
      "\n  year.revenue:", led.body.year.revenue, "quarter:", led.body.quarter.label, led.body.quarter.revenue,
      "\n  D.revenue:", D.revenue, "exempt:", D.exempt, "projection@thresholds:", led.body.thresholds.projection);
  }
  check("01/CNKD si genera", () => assert.equal(dec.status, 200));
  check("periodo corretto", () => assert.equal(D.period, "Quý 3 năm 2026"));
  check("è marcata BẢN NHÁP", () => assert.match(D.form, /BẢN NHÁP|DRAFT/));
  check("porta il disclaimer đại lý thuế", () => assert.match(D.disclaimer, /đại lý thuế/));
  check("categoria ăn uống = 3% VAT + 1,5% TNCN", () =>
    assert.deepEqual(D.rates, { vat: 0.03, pit: 0.015 }));

  const expectedRev = 50 * 1_800_000 + 120_000 * [0,1,2,3,4,5,6].reduce((a,b)=>a+ (Math.floor(50/7) + (50%7 > b ? 1:0)) * b, 0);
  check("ricavo del trimestre = somma delle voci thu", () =>
    assert.equal(D.revenue, led.body.entries.filter(e => e.type === "thu" && e.date >= "2026-07-01" && e.date <= "2026-09-30")
      .reduce((a, e) => a + e.amount, 0)));

  check("sotto il miliardo → esente ma dichiarazione dovuta", () => {
    assert.equal(D.exempt, true);
    assert.equal(D.total, 0);
    assert.match(D.exemptNote, /vẫn phải nộp tờ khai/);
  });

  // --- 4. chi supera il miliardo paga -------------------------------------
  for (let d = 0; d < 40; d++) {
    const date = new Date(Date.UTC(2026, 7, 1) + d * 86400000).toISOString().slice(0, 10);
    await api("/api/ledger", { method: "POST", body: JSON.stringify({
      type: "thu", amount: 30_000_000, date, counterparty: "Đặt tiệc", description: "Đơn lớn" }) });
  }
  const dec2 = (await api("/api/declaration?year=2026&q=3")).body;
  check("superata la soglia → non più esente", () => assert.equal(dec2.exempt, false));
  check("VAT = 3% del ricavo trimestrale", () => assert.equal(dec2.vat, Math.round(dec2.revenue * 0.03)));
  check("TNCN = 1,5% del ricavo trimestrale", () => assert.equal(dec2.pit, Math.round(dec2.revenue * 0.015)));
  check("totale = VAT + TNCN", () => assert.equal(dec2.total, dec2.vat + dec2.pit));

  // --- 5. il trimestre sbagliato non si mescola ---------------------------
  const q2 = (await api("/api/declaration?year=2026&q=2")).body;
  check("Q2 resta vuoto (nessuna contaminazione fra trimestri)", () => assert.equal(q2.revenue, 0));
  const y25 = (await api("/api/declaration?year=2025&q=3")).body;
  check("l'anno scorso resta vuoto", () => assert.equal(y25.revenue, 0));

  // --- 5b. số dư đầu kỳ, contro il server vero ---------------------------
  const phone2 = "0901" + String(Date.now()).slice(-6);
  const savedTok = token;
  token = (await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: phone2, pin: "135791", name: "Quán Mới Mở Sổ" }) })).body.token;
  await api("/api/profile", { method: "POST", body: JSON.stringify({ category: "services_goods" }) });

  // Un mese di registrazioni vere per un quán da 120 triệu/mese.
  for (let d = 0; d < 25; d++) {
    await api("/api/ledger", { method: "POST", body: JSON.stringify({
      type: "thu", amount: 4_800_000, date: `2026-08-${String(d + 1).padStart(2, "0")}`,
      counterparty: "Khách lẻ", description: "Tổng bán trong ngày" }) });
  }
  const naive = (await api("/api/ledger")).body;
  check("libro vuoto a metà anno → il prodotto crede che sia sotto soglia", () =>
    assert.equal(naive.thresholds.taxFree.crossed, false));

  const op = await api("/api/opening", { method: "POST", body: JSON.stringify({
    year: 2026, quarters: { 1: { revenue: 360_000_000 }, 2: { revenue: 360_000_000 }, 3: { revenue: 120_000_000 } } }) });
  check("apertura accettata senza scarti", () => {
    assert.equal(op.status, 200);
    assert.deepEqual(op.body.skipped, []);
    assert.equal(op.body.entries, 3);
  });
  const fixed = op.body.ledger;
  check("con l'apertura il quán risulta correttamente SOPRA la soglia", () =>
    assert.equal(fixed.thresholds.taxFree.crossed, true));
  check("l'apertura non regala punteggio", () =>
    assert.ok(fixed.score.score <= naive.score.score + 2,
      `${naive.score.score} → ${fixed.score.score}`));

  const dq1 = (await api("/api/declaration?year=2026&q=1")).body;
  check("il Q1 dichiarato produce una tờ khai compilabile", () => {
    assert.equal(dq1.revenue, 360_000_000);
    assert.equal(dq1.declaredRevenue, 360_000_000, "e dice che è tutto autodichiarato");
    assert.equal(dq1.exempt, false, "sopra soglia → non esente");
  });
  const dq3 = (await api("/api/declaration?year=2026&q=3")).body;
  check("il Q3 mescola dichiarato e documentato, e li distingue", () => {
    assert.equal(dq3.revenue, 120_000_000 + 25 * 4_800_000);
    assert.equal(dq3.declaredRevenue, 120_000_000);
  });
  const reread = await api("/api/opening?year=2026");
  check("le aperture si rileggono per il form", () =>
    assert.equal(reread.body.quarters[2].revenue, 360_000_000));
  token = savedTok;

  // --- 6. export --------------------------------------------------------
  // fetch().text() TOGLIE il BOM: va letto sui byte, o il test è finto.
  const csvBytes = new Uint8Array(await (await fetch(BASE + "/api/export.csv", { headers: { authorization: "Bearer " + token } })).arrayBuffer());
  check("CSV esporta con BOM (Excel VN legge i diacritici)", () =>
    assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf]));
  check("CSV contiene le voci", () => {
    const txt = new TextDecoder().decode(csvBytes);
    assert.match(txt, /Ngày","Loại/);
    assert.ok(txt.split("\r\n").length > 50, "righe");
  });

  // --- 7. il libro è privato ---------------------------------------------
  const saved = token; token = null;
  const anon = await api("/api/ledger");
  check("senza token NON si vede il libro dell'hộ", () => {
    const mine = new Set(led.body.entries.map((e) => e.id));
    assert.equal((anon.body.entries || []).filter((e) => mine.has(e.id)).length, 0);
  });
  const stolen = await api("/api/declaration?year=2026&q=3");
  check("nemmeno la dichiarazione trapela senza token", () =>
    assert.notEqual(stolen.body.taxpayer, "Quán Cà Phê Cô Ba"));
  // ?uid= può aprire solo sandbox anonime: i namespace "u:"/"zalo:" sono off-limits
  const forged = await api(`/api/ledger?uid=u:${phone}`);
  check("?uid=u:<phone> NON apre il libro dell'hộ (IDOR)", () => {
    const mine = new Set(led.body.entries.map((e) => e.id));
    assert.equal((forged.body.entries || []).filter((e) => mine.has(e.id)).length, 0);
  });
  await api(`/api/ledger?uid=u:${phone}`, { method: "POST",
    body: JSON.stringify({ type: "chi", amount: 999_999, counterparty: "IDOR-PROBE" }) });
  const sandbox = await api("/api/ledger?uid=wtestsandbox");
  check("la sandbox anonima con ?uid= opaco funziona ancora", () =>
    assert.ok(Array.isArray(sandbox.body.entries)));
  token = saved;
  const after = await api("/api/ledger");
  check("?uid=u:<phone> NON scrive nel libro dell'hộ (IDOR)", () =>
    assert.equal(after.body.entries.filter((e) => e.counterparty === "IDOR-PROBE").length, 0));

  // --- riepilogo -----------------------------------------------------------
  console.log("\n\x1b[1mE2E — 01/CNKD, Quý 3 năm 2026\x1b[0m");
  console.log("  Người nộp thuế :", dec2.taxpayer);
  console.log("  Ngành nghề     :", dec2.category.vi);
  console.log("  Doanh thu quý  :", vnd(dec2.revenue));
  console.log(`  GTGT ${(dec2.rates.vat*100).toFixed(1)}%      :`, vnd(dec2.vat));
  console.log(`  TNCN ${(dec2.rates.pit*100).toFixed(1)}%      :`, vnd(dec2.pit));
  console.log("  TỔNG PHẢI NỘP  :", vnd(dec2.total));
} finally {
  srv.kill();
}

console.log("");
for (const t of ok) console.log("  \x1b[32m✓\x1b[0m", t);
for (const t of bad) console.log("  \x1b[31m✗\x1b[0m", t);
console.log(`\n  ${ok.length} passati, ${bad.length} falliti\n`);
process.exit(bad.length ? 1 : 0);
