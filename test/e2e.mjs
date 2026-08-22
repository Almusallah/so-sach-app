// End-to-end contro un server VERO: registrazione → voci → libro → 01/CNKD.
// Niente mock: se una route cambia forma, questo test se ne accorge.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import http from "node:http";
// mint a livello unit, con lo STESSO SESSION_SECRET passato al server: serve
// alla sezione 8b per fabbricare un token già scaduto (il gancio test-mint
// del server conia solo token freschi).
import { mintClaimToken } from "../src/claim.js";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Porte nella fascia 3530-3539 riservata ai test di questo repo (bot/backend):
// le altre corsie di lavoro girano server propri in parallelo su fasce diverse.
const PORT = 3530, BASE = `http://127.0.0.1:${PORT}`;
// Porta del finto Apps Script (sezione 8): il server lo raggiunge solo perché
// SHEETS_TEST_HOSTS whitelist-a 127.0.0.1 — in produzione la env non esiste.
const FPORT = 3531;
const env = { ...process.env, PORT, NODE_ENV: "test", SESSION_SECRET: "test-secret-e2e",
  DATABASE_URL: "", ANTHROPIC_API_KEY: "", DATA_DIR: "",
  SHEETS_TEST_HOSTS: "127.0.0.1", SHEETS_DEBOUNCE_MS: "1000" };

// ⚠️ DATA_DIR env è IGNORATA dal server (data/ è hard-coded accanto a
// server.js): questo e2e scrive nei file VERI. Si fotografa lo stato prima
// dello spawn e lo si ripristina nel finally — mai lasciare dietro account
// di prova, mai committare data/.
const DATA_DIR_REAL = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const DATA_FILES = ["ledger.json", "accounts.json", "leads.json", "settings.json"]
  .map((f) => join(DATA_DIR_REAL, f));
const dataBackup = new Map();
for (const f of DATA_FILES) if (existsSync(f)) dataBackup.set(f, readFileSync(f));

let fake = null;   // finto ricevitore Apps Script, acceso nella sezione 8
const srv = spawn("node", ["server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
// TUTTO ciò che il server scrive (stdout E stderr) si conserva: la sezione 9
// lo passa al setaccio per il secret — un log che lo contenesse finirebbe
// dritto nei log di Render, leggibili da chiunque abbia accesso alla dashboard.
let serverLog = "";
srv.stdout.on("data", (d) => { serverLog += String(d); });
srv.stderr.on("data", (d) => {
  serverLog += String(d);
  if (process.env.VERBOSE) console.error("[srv]", String(d).trim());
});

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
// Ogni risposta passata da api() si archivia qui: la sezione 9 le setaccia
// TUTTE per il secret, non solo le due rotte dove il leak è già stato pensato.
const RESPONSES = [];
async function api(path, opts = {}) {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}), ...(opts.headers || {}) },
  });
  const body = r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text();
  RESPONSES.push({ path, status: r.status, body });
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
  const csvText = new TextDecoder().decode(csvBytes);
  check("CSV contiene le voci", () => {
    assert.match(csvText, /Ngày","Loại/);
    assert.ok(csvText.split("\r\n").length > 50, "righe");
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

  // --- 8. Google Sheets ----------------------------------------------------
  // Finto Apps Script: verifica il secret e, come il VERO /exec, risponde 302
  // verso un secondo URL da cui la risposta si legge in GET — così l'e2e
  // esercita davvero il redirect manuale a un solo hop del trasporto.
  let lastPush = null, pushCount = 0, badSecretCount = 0;
  fake = http.createServer((req, res) => {
    if (req.method === "POST") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        let body = null;
        try { body = JSON.parse(raw); } catch {}
        if (!body || body.secret !== "sekret-e2e") {
          badSecretCount++;
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ ok: false, error: "bad secret" }));
        }
        lastPush = body; pushCount++;
        res.writeHead(302, { location: `http://127.0.0.1:${FPORT}/echo` });
        res.end();
      });
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, at: new Date().toISOString() }));
    }
  });
  await new Promise((r) => fake.listen(FPORT, r));

  // URL non-Google → 400 (la whitelist SSRF lavora prima di tutto)
  const badUrl = await api("/api/sheets/config", { method: "POST",
    body: JSON.stringify({ url: "https://evil.com/exec", secret: "x" }) });
  check("config Sheets con URL non-Google → 400", () => assert.equal(badUrl.status, 400));

  // niente auth → 401; e il libro "demo" (condiviso!) non è configurabile
  const savedTok8 = token; token = null;
  const noAuth = await api("/api/sheets/config", { method: "POST",
    body: JSON.stringify({ url: "https://script.google.com/macros/s/x/exec", secret: "x" }) });
  check("config Sheets senza login → 401", () => assert.equal(noAuth.status, 401));
  const demoTry = await api("/api/sheets/config?uid=demo", { method: "POST",
    body: JSON.stringify({ url: "https://script.google.com/macros/s/x/exec", secret: "x" }) });
  check("config Sheets su demo/anonimo → rifiutata", () => assert.equal(demoTry.status, 401));
  token = savedTok8;

  // secret sbagliato → il push di prova fallisce e l'errore del foglio arriva in chiaro
  const wrongSec = await api("/api/sheets/config", { method: "POST",
    body: JSON.stringify({ url: `http://127.0.0.1:${FPORT}/exec`, secret: "wrong" }) });
  check("secret sbagliato → errore del foglio visibile in chiaro", () => {
    assert.equal(wrongSec.status, 200);
    assert.equal(wrongSec.body.push?.ok, false);
    assert.equal(wrongSec.body.push?.error, "bad secret");
    assert.equal(badSecretCount, 1);
  });

  // config buona → push di prova immediato, attraverso il 302
  const cfgd = await api("/api/sheets/config", { method: "POST",
    body: JSON.stringify({ url: `http://127.0.0.1:${FPORT}/exec`, secret: "sekret-e2e" }) });
  check("config valida → push di prova arrivato al foglio (via 302)", () => {
    assert.equal(cfgd.status, 200);
    assert.equal(cfgd.body.push?.ok, true);
    assert.equal(pushCount, 1);
    assert.ok(lastPush, "il finto Apps Script deve aver ricevuto il payload");
  });
  check("payload: 7 intestazioni e importi come NUMERI", () => {
    const rows = lastPush.sheets["Sổ thu chi"];
    assert.deepEqual(rows[0], ["Ngày", "Loại", "Số tiền (VND)", "Đối tác", "Mô tả", "Nguồn", "Gốc"]);
    assert.ok(rows.length > 100, "tutte le voci del libro");
    for (const r of rows.slice(1, 20)) assert.equal(typeof r[2], "number", "il foglio deve poter sommare");
  });
  check("payload: tab Tổng hợp con i motori fiscali", () => {
    const s = lastPush.sheets["Tổng hợp"];
    assert.deepEqual(s[0].slice(0, 5), ["", "Q1", "Q2", "Q3", "Q4"]);
    assert.ok(s.find((r) => r[0] === "Hạn nộp tờ khai"), "la scadenza della dichiarazione");
  });
  check("la risposta della config NON contiene il secret", () => {
    const j = JSON.stringify(cfgd.body);
    assert.ok(!j.includes("sekret-e2e"));
    assert.ok(!/"secret"/.test(j));
  });

  const led8 = await api("/api/ledger");
  check("GET /api/ledger non trapela il secret da NESSUNA parte", () => {
    const j = JSON.stringify(led8.body);
    assert.ok(!j.includes("sekret-e2e"));
    assert.ok(!/"secret"/.test(j));
    assert.ok(led8.body.profile.sheets?.url, "ma l'URL resta visibile per la UI");
  });

  // throttle: il push di prova della config è appena partito → 429
  const throttled = await api("/api/sheets/push", { method: "POST" });
  check("push manuale entro 10 s → 429 (throttle per-uid, non rateLimit)", () =>
    assert.equal(throttled.status, 429));

  // push AUTOMATICO: una mutazione del libro → debounce (1 s in test) → push
  const beforeAuto = pushCount;
  await api("/api/ledger", { method: "POST", body: JSON.stringify({
    type: "chi", amount: 77_000, date: "2026-08-20", counterparty: "AUTO-SHEETS", description: "auto-push e2e" }) });
  await new Promise((r) => setTimeout(r, 2000));
  check("mutazione del libro → push automatico dopo la quiete", () => {
    assert.equal(pushCount, beforeAuto + 1);
    assert.ok(JSON.stringify(lastPush.sheets["Sổ thu chi"]).includes("AUTO-SHEETS"),
      "il push automatico porta la voce nuova");
  });

  // passati i 10 s il push manuale torna a funzionare — e si spara IN COPPIA:
  // due richieste parallele leggevano entrambe il lastPushAt vecchio (si
  // aggiorna solo a push finito) e passavano entrambe il throttle. Ora la
  // seconda deve vedere il push in volo e ricevere 429.
  console.log("  ⏳ throttle: attesa 10 s per il push manuale…");
  await new Promise((r) => setTimeout(r, 10_200));
  const [mA, mB] = await Promise.all([
    api("/api/sheets/push", { method: "POST" }),
    api("/api/sheets/push", { method: "POST" }),
  ]);
  check("dopo 10 s il push manuale passa e arriva al foglio", () => {
    const passed = [mA, mB].filter((r) => r.status === 200);
    assert.equal(passed.length, 1, "esattamente UNO dei due paralleli passa");
    assert.equal(passed[0].body.ok, true);
    assert.equal(pushCount, beforeAuto + 2, "e al foglio arriva UN solo push");
  });
  check("push parallelo al primo → 429 (il throttle regge anche in volo)", () =>
    assert.equal([mA, mB].filter((r) => r.status === 429).length, 1));

  // --- 8b. Claim-link onboarding (Zalo-first → account) ---------------------
  // Il webhook Zalo gira senza firma in test (OA non configurato): si simula
  // l'utente solo-Zalo con "thu 2tr4" → nasce il libro zalo:<id> con una voce
  // (e la CTA con il PRIMO token, che non possiamo leggere: sendText è spenta).
  // I token per le prove arrivano dal gancio test-mint — stessa via, stesso
  // registro del webhook, quindi ogni mint invalida il precedente.
  const ZUID = "ze2e" + String(Date.now()).slice(-6);
  await api("/webhooks/zalo", { method: "POST", body: JSON.stringify({
    event_name: "user_send_text", sender: { id: ZUID },
    message: { text: "thu 2tr4", msg_id: "m-claim-1" }, timestamp: Date.now() }) });
  await new Promise((r) => setTimeout(r, 600));   // l'ACK precede l'elaborazione

  const savedTok8b = token; token = null;
  const t1 = (await api(`/api/claim/test-mint/${ZUID}`)).body.token;
  const t2 = (await api(`/api/claim/test-mint/${ZUID}`)).body.token;
  check("test-mint conia token in forma base64url.base64url", () =>
    assert.match(t2, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/));

  // la pagina si serve SEMPRE — token valido, superato o spazzatura
  const page = await api(`/claim/${t2}`);
  check("GET /claim/<token> serve la pagina (200 + titolo della spec)", () => {
    assert.equal(page.status, 200);
    assert.match(String(page.body), /Kết nối sổ Zalo/);
  });
  const pageJunk = await api("/claim/spazzatura-qualunque");
  check("GET /claim/<spazzatura> serve comunque la pagina (validazione sull'API)", () =>
    assert.equal(pageJunk.status, 200));

  const prev = await api(`/api/claim/preview/${t2}`);
  check("preview: SOLO il conteggio, mai le voci", () => {
    assert.equal(prev.status, 200);
    assert.deepEqual(prev.body, { ok: true, entries: 1 });
    assert.ok(!JSON.stringify(prev.body).includes("2400000"), "nessun importo nel payload");
  });

  // re-mint: t2 ha invalidato t1
  const claimPhone = "0902" + String(Date.now()).slice(-6);
  const oldTok = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: t1, phone: claimPhone, pin: "246813" }) });
  check("token superato dal re-mint → 4xx, nessun account creato", () => {
    assert.ok(oldTok.status >= 400, "status " + oldTok.status);
    assert.equal(oldTok.body.code, "invalid");
  });

  // manomissione: un carattere della firma
  const tam = t2.slice(0, -1) + (t2.endsWith("A") ? "B" : "A");
  const tampered = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: tam, phone: claimPhone, pin: "246813" }) });
  check("token manomesso → 4xx invalid", () => {
    assert.ok(tampered.status >= 400);
    assert.equal(tampered.body.code, "invalid");
  });

  // percorso felice: registrazione + merge del libro zalo nell'account
  const claimed = await api("/api/claim", { method: "POST", body: JSON.stringify({
    token: t2, phone: claimPhone, pin: "246813", name: "Quán Claim E2E" }) });
  check("claim felice: account nuovo + libro Zalo fuso", () => {
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.ok, true);
    assert.ok(claimed.body.token, "torna un bearer token di sessione");
    assert.equal(claimed.body.account?.zaloLinked, true);
    assert.equal(claimed.body.moved, 1, "la voce Zalo è migrata");
  });
  check("il claim non fa MAI trapelare PIN o hash", () =>
    assert.ok(!JSON.stringify(claimed.body).match(/246813|pinHash|salt/i)));

  token = claimed.body.token;
  const claimedLed = await api("/api/ledger");
  check("la voce scritta su Zalo è visibile col bearer del nuovo account", () => {
    const hit = (claimedLed.body.entries || []).find((e) => e.amount === 2_400_000 && e.source === "zalo");
    assert.ok(hit, "manca la voce thu 2tr4 migrata");
  });
  token = null;

  // riuso del token appena consumato
  const reuse = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: t2, phone: claimPhone, pin: "246813" }) });
  check("token riusato → 4xx used", () => {
    assert.ok(reuse.status >= 400);
    assert.equal(reuse.body.code, "used");
  });

  // token scaduto: coniato a livello unit con lo stesso secret, 73 ore fa
  const oldMint = mintClaimToken("zexp" + Date.now(), {
    secret: "test-secret-e2e", now: Date.now() - 73 * 60 * 60 * 1000 });
  const expired = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: oldMint, phone: "0903000111", pin: "246813" }) });
  check("token scaduto (72h) → 4xx expired", () => {
    assert.ok(expired.status >= 400);
    assert.equal(expired.body.code, "expired");
  });
  token = savedTok8b;

  // --- 8c. "sửa" chiede conferma; eventi non-testo non toccano il libro ------
  // sendText è spenta (nessun token OA), quindi le RISPOSTE del bot non si
  // leggono da qui: si osservano gli EFFETTI sul libro — il conteggio voci via
  // test-mint + preview, la stessa via della sezione 8b.
  const savedTok8c = token; token = null;
  const ZFIX = "zfix" + String(Date.now()).slice(-6);
  let zmsg = 0;
  const zText = (text) => api("/webhooks/zalo", { method: "POST", body: JSON.stringify({
    event_name: "user_send_text", sender: { id: ZFIX },
    message: { text, msg_id: `m-fix-${++zmsg}` }, timestamp: Date.now() }) });
  const zEvent = (event_name) => api("/webhooks/zalo", { method: "POST", body: JSON.stringify({
    event_name, sender: { id: ZFIX },
    message: { msg_id: `m-fix-${++zmsg}` }, timestamp: Date.now() }) });
  const settle = () => new Promise((r) => setTimeout(r, 600));   // l'ACK precede l'elaborazione
  const zCount = async () => {
    const t = (await api(`/api/claim/test-mint/${ZFIX}`)).body.token;
    return (await api(`/api/claim/preview/${t}`)).body.entries;
  };

  await zText("thu 2tr4"); await settle();
  await zText("chi 500k"); await settle();
  const beforeFix = await zCount();
  check("premessa: il libro Zalo ha 2 voci", () => assert.equal(beforeFix, 2));

  await zText("sửa"); await settle();
  const afterAsk = await zCount();
  check('"sửa" NON cancella più da solo: le voci sono ancora 2 (aspetta il "1")', () =>
    assert.equal(afterAsk, 2));

  await zText("menu"); await settle();     // qualunque altro testo annulla in silenzio
  await zText("1"); await settle();        // …e ora "1" NON deve più cancellare
  const afterCancel = await zCount();
  check('conferma annullata da un altro messaggio: "1" tardivo non cancella', () =>
    assert.equal(afterCancel, 2));

  await zText("sửa"); await settle();
  await zText("1"); await settle();        // conferma entro il TTL → cancella
  const afterConfirm = await zCount();
  check('"sửa" + "1" cancella UNA voce (l\'ultima)', () => assert.equal(afterConfirm, 1));

  // eventi utente non-testo: il bot risponde (vocale/file) o tace (sticker),
  // ma NON scrive mai nel libro e NON muore.
  await zEvent("user_send_audio"); await settle();
  await zEvent("user_send_file"); await settle();
  await zEvent("user_send_sticker"); await settle();
  const afterEvents = await zCount();
  check("vocale/file/sticker: nessuna voce scritta nel libro", () =>
    assert.equal(afterEvents, 1));
  const health8c = await api("/healthz");
  check("healthz ok dopo gli eventi non-testo", () => assert.equal(health8c.body.ok, true));
  token = savedTok8c;

  // --- 8d. Durabilità: un persist fallito NON diventa mai una conferma -------
  // Il gancio /api/test/fail-persist fa fallire i prossimi N persist (qualunque
  // tipo, in ordine di coda): il contratto sotto esame è 503/"chưa lưu được"
  // + stato INVARIATO, e il retry che riconverge senza doppioni.
  const armFail = (n) => api("/api/test/fail-persist", { method: "POST", body: JSON.stringify({ n }) });

  // (a) web: POST /api/ledger — 503, il libro non cambia, il retry non doppia
  const countMine = async () => (await api("/api/ledger")).body.entries.length;
  const nBefore = await countMine();
  await armFail(1);
  const durFail = await api("/api/ledger", { method: "POST", body: JSON.stringify({
    type: "thu", amount: 777_000, date: "2026-08-21", description: "voce durabilità" }) });
  check("persist fallito su POST /api/ledger → 503 con messaggio onesto", () => {
    assert.equal(durFail.status, 503);
    assert.match(durFail.body.error || "", /Chưa lưu được/);
  });
  const nAfterFail = await countMine();
  check("dopo il 503 il conteggio è invariato", () => assert.equal(nAfterFail, nBefore));
  const durRetry = await api("/api/ledger", { method: "POST", body: JSON.stringify({
    type: "thu", amount: 777_000, date: "2026-08-21", description: "voce durabilità" }) });
  const nAfterRetry = await countMine();
  check("il retry riesce e NON crea doppioni (una voce sola in più)", () => {
    assert.equal(durRetry.status, 200);
    assert.equal(nAfterRetry, nBefore + 1);
  });

  // (b) Zalo: il bot non conferma una voce non durevole
  const savedTok8d = token; token = null;
  const zdBefore = await zCount();                    // ZFIX: 1 voce dalla 8c
  await armFail(1);
  await zText("thu 300k"); await settle();
  const zdAfterFail = await zCount();
  check("Zalo: persist fallito → nessuna voce nel libro (il bot dice riprova)", () =>
    assert.equal(zdAfterFail, zdBefore));
  await zText("thu 300k"); await settle();
  const zdAfterRetry = await zCount();
  check("Zalo: il reinvio scrive UNA voce (niente doppioni dal rollback)", () =>
    assert.equal(zdAfterRetry, zdBefore + 1));

  // (c) claim: l'account esiste solo se durevole. n=2 perché register() accoda
  // anche il persist legacy prima di quello durevole della rotta.
  const ZDUR = "zdur" + String(Date.now()).slice(-6);
  await api("/webhooks/zalo", { method: "POST", body: JSON.stringify({
    event_name: "user_send_text", sender: { id: ZDUR },
    message: { text: "thu 1tr", msg_id: "m-dur-1" }, timestamp: Date.now() }) });
  await settle();
  const tDur = (await api(`/api/claim/test-mint/${ZDUR}`)).body.token;
  const durPhone = "0904" + String(Date.now()).slice(-6);
  await armFail(2);
  const claimFail = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: tDur, phone: durPhone, pin: "135790", name: "Hộ Durabilità" }) });
  check("claim con persist fallito → 503, mai un token di sessione", () => {
    assert.equal(claimFail.status, 503);
    assert.ok(!claimFail.body.token, "nessuna sessione per un account non durevole");
  });
  const ghostLogin = await api("/api/auth/login", { method: "POST",
    body: JSON.stringify({ phone: durPhone, pin: "135790" }) });
  check("l'account fantasma NON esiste (rollback completo)", () =>
    assert.ok(ghostLogin.status >= 400, "login deve fallire, status " + ghostLogin.status));
  const claimRetry = await api("/api/claim", { method: "POST",
    body: JSON.stringify({ token: tDur, phone: durPhone, pin: "135790", name: "Hộ Durabilità" }) });
  check("il claim ritentato con lo STESSO link riesce e fonde il libro", () => {
    assert.equal(claimRetry.status, 200);
    assert.equal(claimRetry.body.moved, 1, "la voce Zalo è migrata al retry");
  });

  // (d) registrazione: la porta d'ingresso non consegna token per account in RAM
  const regPhone = "0905" + String(Date.now()).slice(-6);
  await armFail(2);                                   // legacy in register() + durevole
  const regFail = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: regPhone, pin: "112233", name: "Hộ Reg Durabilità" }) });
  check("registrazione con persist fallito → 503 senza token", () => {
    assert.equal(regFail.status, 503);
    assert.ok(!regFail.body.token);
  });
  const regRetry = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: regPhone, pin: "112233", name: "Hộ Reg Durabilità" }) });
  check("la registrazione ritentata riesce (nessun 'số này đã đăng ký' fantasma)", () =>
    assert.equal(regRetry.status, 200));
  token = savedTok8d;

  // --- 8e. Bảng đại lý thuế: roster con stato + tờ khai per cliente ----------
  // Il roster è un piano di lavoro: per ogni cliente lo stato Zalo/Sheets,
  // l'ultima voce registrata, il voto — e la 01/CNKD del trimestre scelto
  // prodotta DALL'đại lý, con l'export CSV del libro del cliente.
  const savedTok8e = token; token = null;

  // l'đại lý e il suo cliente
  const agPhone = "0906" + String(Date.now()).slice(-6);
  const agReg = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: agPhone, pin: "778899", role: "agent", name: "Đại Lý E2E" }) });
  const agToken = agReg.body.token;
  const agCode = agReg.body.account?.agentCode;
  check("registrazione đại lý → codice invito DLxxxx", () =>
    assert.match(agCode || "", /^DL\d{4}$/));

  const clPhone = "0907" + String(Date.now()).slice(-6);
  const clReg = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: clPhone, pin: "665544", role: "ho", name: "Hộ Của Đại Lý", agentCode: agCode }) });
  const clToken = clReg.body.token;
  token = clToken;
  await api("/api/ledger", { method: "POST", body: JSON.stringify({
    type: "thu", amount: 5_000_000, date: "2026-07-15", description: "bán hàng" }) });
  await api("/api/ledger", { method: "POST", body: JSON.stringify({
    type: "chi", amount: 1_200_000, date: "2026-08-02", description: "nguyên liệu" }) });

  // il conto principale (con Sheets configurato in sezione 8) entra nel roster
  token = savedTok8e;
  const linked = await api("/api/link-agent", { method: "POST", body: JSON.stringify({ code: agCode }) });
  check("l'hộ si collega all'đại lý col codice invito", () => assert.equal(linked.status, 200));

  token = agToken;
  const roster = await api("/api/agent/clients");
  check("il roster elenca i clienti dell'đại lý", () => {
    assert.equal(roster.status, 200);
    assert.ok(roster.body.clients.length >= 2, "almeno 2 clienti, ha " + roster.body.clients.length);
  });
  const cl = roster.body.clients.find((c) => c.phone === clPhone);
  const mainCl = roster.body.clients.find((c) => c.phone === phone);
  check("ogni cliente porta stato Zalo, Sheets, ultima voce e voto", () => {
    assert.equal(cl.entries, 2);
    assert.equal(cl.zaloLinked, false);
    assert.equal(cl.sheets, null, "nessuna config Sheets per il cliente nuovo");
    assert.equal(cl.lastEntryAt, "2026-08-02", "l'ultima voce per DATA, non per arrivo");
    assert.ok(["A", "B", "C", "D"].includes(cl.score));
  });
  check("il cliente con Sheets configurato lo mostra SENZA url né secret", () => {
    assert.equal(mainCl.sheets?.connected, true);
    assert.ok(!("url" in (mainCl.sheets || {})), "mai l'url nel roster");
    assert.ok(!JSON.stringify(mainCl).includes("sekret-e2e"));
  });

  // la tờ khai del cliente, trimestre scelto dall'đại lý
  const agDecl = await api(`/api/agent/client/${clPhone}/declaration?year=2026&q=3`);
  check("l'đại lý produce la 01/CNKD del cliente (Q3/2026)", () => {
    assert.equal(agDecl.status, 200);
    assert.match(agDecl.body.form, /01\/CNKD/);
    assert.equal(agDecl.body.revenue, 5_000_000, "la voce thu del 15/07 è nel Q3");
    assert.equal(agDecl.body.taxpayer, "Hộ Của Đại Lý");
    assert.equal(agDecl.body.agent?.name, "Đại Lý E2E", "il preparatore è l'đại lý");
  });
  const agDeclQ1 = await api(`/api/agent/client/${clPhone}/declaration?year=2026&q=1`);
  check("trimestre senza voci → dichiarazione a zero, non un errore", () => {
    assert.equal(agDeclQ1.status, 200);
    assert.equal(agDeclQ1.body.revenue, 0);
  });

  // CSV del libro del cliente
  const agCsv = await api(`/api/agent/client/${clPhone}/export.csv`);
  check("CSV del cliente: 7 colonne e le sue voci", () => {
    assert.equal(agCsv.status, 200);
    assert.match(String(agCsv.body), /Ngày.*Gốc/);
    assert.match(String(agCsv.body), /5000000/);
  });

  // confini: un ALTRO đại lý non vede questo cliente; un hộ non è un đại lý
  const ag2Phone = "0908" + String(Date.now()).slice(-6);
  const ag2 = await api("/api/auth/register", { method: "POST",
    body: JSON.stringify({ phone: ag2Phone, pin: "998877", role: "agent", name: "Đại Lý Estraneo" }) });
  token = ag2.body.token;
  const foreign = await api(`/api/agent/client/${clPhone}/declaration`);
  const foreignCsv = await api(`/api/agent/client/${clPhone}/export.csv`);
  check("il cliente di un altro đại lý → 404 (dichiarazione E csv)", () => {
    assert.equal(foreign.status, 404);
    assert.equal(foreignCsv.status, 404);
  });
  token = clToken;
  const notAgent = await api("/api/agent/clients");
  check("un hộ che chiama le rotte đại lý → 403", () => assert.equal(notAgent.status, 403));
  token = savedTok8e;

  // --- 9. Il secret non esce MAI --------------------------------------------
  // Il setaccio finale: il secret viaggia SOLO nel corpo della POST di config
  // (client → server) e nei push verso il foglio. In nessuna risposta, in
  // nessun export, in nessuna riga di log.
  check("nessuna delle risposte API catturate contiene il secret", () => {
    const leaks = RESPONSES.filter((r) => JSON.stringify(r.body ?? "").includes("sekret-e2e"));
    assert.equal(leaks.length, 0, leaks.map((l) => l.path).join(", "));
  });
  check('nessuna risposta serializza una chiave "secret"', () => {
    const leaks = RESPONSES.filter((r) => /"secret"\s*:/.test(JSON.stringify(r.body ?? "")));
    assert.equal(leaks.length, 0, leaks.map((l) => l.path).join(", "));
  });
  check("nemmeno il CSV esportato contiene il secret", () =>
    assert.ok(!csvText.includes("sekret-e2e")));
  check("il server non logga MAI il secret (stdout + stderr)", () => {
    const hits = serverLog.split("\n").filter((l) => l.includes("sekret-e2e"));
    assert.equal(hits.length, 0, hits.slice(0, 3).join(" | "));
  });

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
  fake?.close();
  // Il server è morto (scritture sincrone: niente write in coda) — si
  // ripristina data/ com'era prima dell'e2e; i file nati durante il test
  // e assenti nel backup si eliminano.
  await new Promise((r) => setTimeout(r, 400));
  for (const f of DATA_FILES) {
    if (dataBackup.has(f)) writeFileSync(f, dataBackup.get(f));
    else if (existsSync(f)) rmSync(f);
  }
}

console.log("");
for (const t of ok) console.log("  \x1b[32m✓\x1b[0m", t);
for (const t of bad) console.log("  \x1b[31m✗\x1b[0m", t);
console.log(`\n  ${ok.length} passati, ${bad.length} falliti\n`);
process.exit(bad.length ? 1 : 0);
