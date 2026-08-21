// ============================================================================
//  Sổ Sạch ↔ Google Sheets — test del motore puro (niente rete, niente server).
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSheetsUrl, buildSheetsPayload, makePushQueue } from "../src/sheets.js";
import { applyOpening } from "../src/opening.js";

const NOW = new Date("2026-08-21T05:00:00Z");

// ---- URL: la SSRF si previene qui -------------------------------------------
test("validateSheetsUrl: accetta solo deployment Google Apps Script", () => {
  assert.ok(validateSheetsUrl("https://script.google.com/macros/s/AKf.../exec").ok);
  assert.ok(validateSheetsUrl("https://script.googleusercontent.com/macros/echo?x=1").ok);
  for (const bad of [
    "http://script.google.com/macros/s/x/exec",     // https obbligatorio
    "https://evil.com/exec",
    "https://script.google.com.evil.com/exec",      // suffisso truffa
    "https://script.google.com:8443/exec",          // porta custom
    "https://169.254.169.254/latest/meta-data",     // metadata endpoint
    "not a url", "", null,
  ]) {
    assert.equal(validateSheetsUrl(bad).ok, false, String(bad));
  }
});

// ---- Payload ----------------------------------------------------------------
function bookFixture() {
  const book = { profile: { name: "Quán Cô Ba", category: "services_goods" }, entries: [] };
  book.entries.push(
    { id: "a", type: "thu", amount: 2_400_000, date: "2026-07-05", counterparty: "Khách lẻ",
      description: "Tổng bán trong ngày", source: "zalo", provenance: "manual" },
    { id: "b", type: "chi", amount: 30_000, date: "2026-08-10", counterparty: "HỆ THỐNG SIÊU THỊ JMART",
      description: "Mua hàng tạp phẩm", source: "zalo", provenance: "photo" },
    { id: "c", type: "thu", amount: 1_000_000, date: "2026-02-14", counterparty: "", description: "",
      source: "web", provenance: "manual" },
  );
  return book;
}

test("buildSheetsPayload: righe ordinate per data, numeri come numeri", () => {
  const p = buildSheetsPayload(bookFixture(), { now: NOW });
  const rows = p.sheets["Sổ thu chi"];
  assert.deepEqual(rows[0], ["Ngày", "Loại", "Số tiền (VND)", "Đối tác", "Mô tả", "Nguồn", "Gốc"]);
  assert.deepEqual(rows.slice(1).map((r) => r[0]), ["2026-02-14", "2026-07-05", "2026-08-10"]);
  for (const r of rows.slice(1)) assert.equal(typeof r[2], "number", "gli importi devono restare numeri");
  assert.equal(rows[3][1], "Chi");
  assert.equal(rows[3][3], "HỆ THỐNG SIÊU THỊ JMART", "diacritici intatti");
});

test("buildSheetsPayload: Tổng hợp concorda con i motori fiscali", () => {
  const p = buildSheetsPayload(bookFixture(), { now: NOW });
  const s = p.sheets["Tổng hợp"];
  assert.deepEqual(s[0], ["", "Q1", "Q2", "Q3", "Q4", "Năm 2026"]);
  const thu = s[1], chi = s[2];
  assert.equal(thu[1], 1_000_000);            // Q1: la voce di febbraio
  assert.equal(thu[3], 2_400_000);            // Q3: luglio
  assert.equal(chi[3], 30_000);
  assert.equal(thu[5], 3_400_000);            // anno
  const deadline = s.find((r) => r[0] === "Hạn nộp tờ khai");
  assert.equal(deadline[5], "2026-10-31", "stessa scadenza della dichiarazione");
});

test("buildSheetsPayload: le aperture dichiarate compaiono nel ledger con la loro origine", () => {
  const book = bookFixture();
  applyOpening(book, { year: 2026, quarters: { 1: { revenue: 500_000_000 } } }, "2026-08-21");
  const p = buildSheetsPayload(book, { now: NOW });
  const opening = p.sheets["Sổ thu chi"].find((r) => r[6] === "declared");
  assert.ok(opening, "la riga tự khai deve esserci");
  assert.equal(opening[2], 500_000_000);
  const thu = p.sheets["Tổng hợp"][1];
  assert.equal(thu[1], 501_000_000, "e contare nel trimestre giusto");
});

test("buildSheetsPayload: libro vuoto → solo intestazioni, niente crash", () => {
  const p = buildSheetsPayload({ profile: {}, entries: [] }, { now: NOW });
  assert.equal(p.sheets["Sổ thu chi"].length, 1);
  assert.ok(p.sheets["Tổng hợp"].length > 3);
});

// ---- Debounce ---------------------------------------------------------------
test("makePushQueue: molte mutazioni ravvicinate → UN solo push, dopo la quiete", () => {
  const fired = [];
  // scheduler finto: cattura i callback, li scatta a mano
  const cbs = new Map(); let id = 0;
  const q = makePushQueue((uid) => fired.push(uid), {
    schedule: (fn) => { const k = ++id; cbs.set(k, fn); return k; },
    clear: (k) => cbs.delete(k),
  });
  q.touch("u:0900"); q.touch("u:0900"); q.touch("u:0900");
  assert.equal(cbs.size, 1, "i touch ripetuti cancellano il timer precedente");
  assert.equal(q.pending(), 1);
  [...cbs.values()].forEach((fn) => fn());
  assert.deepEqual(fired, ["u:0900"]);
  assert.equal(q.pending(), 0);
});

test("makePushQueue: uid diversi non si pestano", () => {
  const fired = [];
  const cbs = []; 
  const q = makePushQueue((uid) => fired.push(uid), {
    schedule: (fn) => (cbs.push(fn), cbs.length), clear: () => {},
  });
  q.touch("a"); q.touch("b");
  cbs.forEach((fn) => fn());
  assert.deepEqual(fired.sort(), ["a", "b"]);
});

test("makePushQueue: un push che esplode non uccide il processo", async () => {
  const cbs = [];
  const q = makePushQueue(() => { throw new Error("foglio giù"); }, {
    schedule: (fn) => (cbs.push(fn), cbs.length), clear: () => {},
  });
  q.touch("x");
  cbs.forEach((fn) => fn());               // non deve lanciare
  await new Promise((r) => setImmediate(r));
  assert.ok(true);
});
