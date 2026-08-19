// ============================================================================
//  Sổ Sạch — test unitari. `npm test`.
//  Coprono ciò che, sbagliato, produce una DICHIARAZIONE sbagliata: date,
//  importi, trimestri, aliquote. Non l'estetica.
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import { todayVN, realDate, normalizeReceiptDate } from "../src/vndate.js";
import { validate, parseVndAmount } from "../src/extract.js";
import { parseMoneyCommand, parseAmount } from "../src/amount.js";
import { totals, quarterOf, quarterlyTax, projectAnnual, thresholdStatus, nextDeadline, CATEGORIES } from "../src/tax.js";
import { sosachScore } from "../src/score.js";

// ---- Fuso orario ------------------------------------------------------------
test("todayVN: mezzanotte e mezza a Saigon è ancora il giorno DOPO in UTC", () => {
  // 2026-01-01T17:30:00Z = 2026-01-02 00:30 ICT → per il quán è già il 2.
  assert.equal(todayVN(new Date("2026-01-01T17:30:00Z")), "2026-01-02");
  // Il caso che sposta di TRIMESTRE: 31/03 17:30Z = 01/04 ICT → Q2, non Q1.
  assert.equal(todayVN(new Date("2026-03-31T17:30:00Z")), "2026-04-01");
  // Mezzogiorno UTC non è ambiguo.
  assert.equal(todayVN(new Date("2026-08-19T05:46:00Z")), "2026-08-19");
});

test("realDate: rifiuta date che NON esistono (JS le fa scorrere in silenzio)", () => {
  assert.equal(realDate("2026-02-30"), null, "30 febbraio non esiste");
  assert.equal(realDate("2026-13-05"), null, "mese 13");
  assert.equal(realDate("2026-04-31"), null, "aprile ha 30 giorni");
  assert.equal(realDate("19/08/2026"), null, "non è ISO");
  assert.equal(realDate(""), null);
  assert.equal(realDate(null), null);
  assert.ok(realDate("2026-02-28"));
  assert.ok(realDate("2028-02-29"), "2028 è bisestile");
});

// ---- La data dello scontrino ------------------------------------------------
const TODAY = "2026-08-19";

test("normalizeReceiptDate: IL BUG JMART — 10/08 letto come 8 ottobre", () => {
  // Caso reale, primo scontrino vero (19/08/2026): il modello ha restituito
  // 2026-10-08 per uno scontrino stampato 10/08/2026.
  const r = normalizeReceiptDate("2026-10-08", TODAY);
  assert.equal(r.date, "2026-08-10");
  assert.equal(r.dateNote, "swapped");
});

test("normalizeReceiptDate: tabella", () => {
  const cases = [
    ["2026-08-19", "2026-08-19", null,      "oggi"],
    ["2026-08-01", "2026-08-01", null,      "passato recente"],
    ["2025-12-31", "2025-12-31", null,      "anno scorso, entro 2 anni"],
    ["2026-12-25", TODAY,        "guessed", "futuro non recuperabile (25 non è un mese)"],
    ["2026-09-01", "2026-01-09", "swapped", "futuro recuperabile scambiando"],
    ["2019-05-05", TODAY,        "guessed", "più vecchio di 2 anni"],
    ["not a date", TODAY,        "guessed", "spazzatura"],
    ["",           TODAY,        "guessed", "vuoto"],
    [null,         TODAY,        "guessed", "null"],
    ["2026-02-30", TODAY,        "guessed", "data inesistente"],
  ];
  for (const [raw, date, note, why] of cases) {
    const r = normalizeReceiptDate(raw, TODAY);
    assert.equal(r.date, date, `${why}: ${raw} → ${r.date}`);
    assert.equal(r.dateNote, note, `${why}: nota`);
  }
});

test("normalizeReceiptDate: non inventa MAI una data futura", () => {
  for (const raw of ["2027-01-01", "2026-10-08", "2099-12-31", "2026-12-25"]) {
    const { date } = normalizeReceiptDate(raw, TODAY);
    assert.ok(date <= TODAY, `${raw} → ${date} non deve essere futuro`);
  }
});

// ---- Validazione di ciò che torna dal modello --------------------------------
test("validate: una risposta buona passa e viene ripulita", () => {
  const v = validate({ type: "chi", amount: 30000, date: "2026-08-10",
    counterparty: "  JMART  ", description: " đậu phụ ", confidence: 0.91 }, TODAY);
  assert.deepEqual(v, { type: "chi", amount: 30000, date: "2026-08-10", dateNote: null,
    counterparty: "JMART", description: "đậu phụ", confidence: 0.91, engine: "claude" });
});

test("parseVndAmount: il punto in Việt Nam separa le MIGLIAIA, non i decimali", () => {
  const cases = [
    ["30.000",       30_000,    "il bug da 1000×: Number() darebbe 30"],
    ["1.234.567",    1_234_567, "gruppi multipli"],
    ["2.500.000đ",   2_500_000, "con simbolo di valuta"],
    ["30 000",       30_000,    "separato da spazio"],
    ["2500000 VND",  2_500_000, "con sigla"],
    ["30000.4",      30_000,    "i centesimi di đồng non esistono → scartati"],
    ["30.000,00",    30_000,    "decimale all'europea, scartato"],
    [30000,          30_000,    "già numero"],
    [30000.6,        30_001,    "numero arrotondato"],
  ];
  for (const [raw, want, why] of cases) {
    assert.equal(parseVndAmount(raw), want, `${why}: ${JSON.stringify(raw)}`);
  }
  for (const raw of ["", "abc", null, undefined, NaN]) {
    assert.ok(Number.isNaN(parseVndAmount(raw)), `${JSON.stringify(raw)} → NaN`);
  }
});

test("validate: importi impossibili FALLISCONO (niente voce inventata)", () => {
  for (const amount of [0, -5000, "abc", null, undefined, NaN, 1e11, Infinity, 30, 999]) {
    assert.throws(() => validate({ type: "chi", amount, date: TODAY }, TODAY),
      /bad amount/, `amount=${amount} deve lanciare`);
  }
});

test("validate: importi scritti come stringa vengono recuperati", () => {
  assert.equal(validate({ type: "chi", amount: "30.000", date: TODAY }, TODAY).amount, 30000);
  assert.equal(validate({ type: "thu", amount: "2500000đ", date: TODAY }, TODAY).amount, 2500000);
  assert.equal(validate({ type: "chi", amount: 30000.4, date: TODAY }, TODAY).amount, 30000);
});

test("validate: lo scontrino JMART VERO del 19/08/2026, end-to-end", () => {
  // Ciò che il modello ha davvero restituito quel giorno, data futura inclusa.
  const v = validate({ type: "chi", amount: 30000, date: "2026-10-08",
    counterparty: "HE THỐNG SIÊU THỊ JMART", description: "Mua đậu phụ", confidence: 0.9 }, TODAY);
  assert.equal(v.amount, 30_000);
  assert.equal(v.date, "2026-08-10", "la data futura va corretta, non accettata");
  assert.equal(v.dateNote, "swapped", "e l'utente deve vederselo dire");
});

test("validate: tipo mancante o inventato FALLISCE", () => {
  for (const type of [undefined, null, "", "spesa", "expense", "THU", 1]) {
    assert.throws(() => validate({ type, amount: 1000, date: TODAY }, TODAY), /bad type/);
  }
});

test("validate: confidence fuori scala viene riportata dentro [0,1]", () => {
  assert.equal(validate({ type: "chi", amount: 50_000, confidence: 5 }, TODAY).confidence, 1);
  assert.equal(validate({ type: "chi", amount: 50_000, confidence: -2 }, TODAY).confidence, 0);
  assert.equal(validate({ type: "chi", amount: 50_000 }, TODAY).confidence, 0.6);
});

test("validate: campi testuali troncati (nessun campo illimitato nel libro)", () => {
  const v = validate({ type: "chi", amount: 50_000, counterparty: "x".repeat(500), description: "y".repeat(500) }, TODAY);
  assert.equal(v.counterparty.length, 120);
  assert.equal(v.description.length, 200);
});

// ---- Comandi in denaro (il fatturato scritto a mano) -------------------------
test("parseMoneyCommand: forme vietnamite", () => {
  const cases = [
    ["thu 2tr4",        { type: "thu", amount: 2_400_000 }],
    ["chi 500k",        { type: "chi", amount: 500_000 }],
    ["thu 2.400.000",   { type: "thu", amount: 2_400_000 }],
    ["thu 500 nghìn",   { type: "thu", amount: 500_000 }],
    ["bán 1tr2",        { type: "thu", amount: 1_200_000 }],
    ["mua 350k",        { type: "chi", amount: 350_000 }],
  ];
  for (const [raw, want] of cases) {
    const got = parseMoneyCommand(raw);
    assert.equal(got?.type, want.type, raw);
    assert.equal(got?.amount, want.amount, raw);
  }
});

test("parseMoneyCommand: un numero NUDO non viene mai indovinato", () => {
  const r = parseMoneyCommand("500k");
  assert.equal(r.needsType, true, "deve chiedere thu o chi");
  assert.equal(r.amount, 500_000);
});

// ---- Motore fiscale ---------------------------------------------------------
const q = (year, m, d) => `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

test("totals: filtra per anno e trimestre", () => {
  const es = [
    { type: "thu", amount: 100, date: q(2026, 1, 15) },  // Q1
    { type: "thu", amount: 200, date: q(2026, 4, 1) },   // Q2
    { type: "chi", amount:  50, date: q(2026, 4, 20) },  // Q2
    { type: "thu", amount: 999, date: q(2025, 4, 1) },   // altro anno
  ];
  assert.deepEqual(totals(es, { year: 2026 }), { revenue: 300, expenses: 50, net: 250 });
  assert.deepEqual(totals(es, { year: 2026, q: 2 }), { revenue: 200, expenses: 50, net: 150 });
  assert.deepEqual(totals(es, { year: 2026, q: 1 }), { revenue: 100, expenses: 0, net: 100 });
});

test("quarterOf: i confini di trimestre", () => {
  assert.equal(quarterOf(new Date("2026-03-31T12:00:00Z")).label, "Q1/2026");
  assert.equal(quarterOf(new Date("2026-04-01T12:00:00Z")).label, "Q2/2026");
  assert.equal(quarterOf(new Date("2026-12-31T12:00:00Z")).label, "Q4/2026");
});

test("quarterlyTax: aliquote Circ. 40/2021 per le tre categorie", () => {
  const over = 2_000_000_000; // sopra soglia → imposta dovuta
  assert.deepEqual(
    (({ vat, pit, total, exempt }) => ({ vat, pit, total, exempt }))(quarterlyTax(100_000_000, "distribution", over)),
    { vat: 1_000_000, pit: 500_000, total: 1_500_000, exempt: false });      // 1% + 0,5%
  assert.deepEqual(
    (({ vat, pit, total }) => ({ vat, pit, total }))(quarterlyTax(100_000_000, "services_goods", over)),
    { vat: 3_000_000, pit: 1_500_000, total: 4_500_000 });                    // 3% + 1,5%
  assert.deepEqual(
    (({ vat, pit, total }) => ({ vat, pit, total }))(quarterlyTax(100_000_000, "services", over)),
    { vat: 5_000_000, pit: 2_000_000, total: 7_000_000 });                    // 5% + 2%
});

test("quarterlyTax: sotto 1 tỷ è ESENTE ma la dichiarazione resta dovuta", () => {
  const r = quarterlyTax(100_000_000, "services_goods", 900_000_000);
  assert.equal(r.exempt, true);
  assert.equal(r.total, 0);
});

test("quarterlyTax: la soglia è >=, non >", () => {
  assert.equal(quarterlyTax(1000, "services", 999_999_999).exempt, true);
  assert.equal(quarterlyTax(1000, "services", 1_000_000_000).exempt, false);
});

test("quarterlyTax: categoria sconosciuta ricade su ăn uống, non su zero", () => {
  const r = quarterlyTax(100_000_000, "inventata", 2_000_000_000);
  assert.equal(r.rates.vat, CATEGORIES.services_goods.vat);
});

test("projectAnnual + thresholdStatus: chi supera il miliardo viene visto", () => {
  const now = new Date("2026-07-02T00:00:00Z"); // ~metà anno
  const proj = projectAnnual(600_000_000, now);
  assert.ok(proj > 1_100_000_000 && proj < 1_300_000_000, `proiezione ${proj}`);
  assert.equal(thresholdStatus(proj).taxFree.crossed, true);
  assert.equal(thresholdStatus(proj).eInvoice.crossed, true);
});

test("nextDeadline: ultimo giorno del mese successivo al trimestre", () => {
  assert.deepEqual(nextDeadline(new Date("2026-08-19T00:00:00Z")),
    { quarter: "Q3/2026", deadline: "2026-10-31" });
  assert.deepEqual(nextDeadline(new Date("2026-02-10T00:00:00Z")),
    { quarter: "Q1/2026", deadline: "2026-04-30" });
});

// ---- Punteggio --------------------------------------------------------------
test("sosachScore: un libro vuoto non prende un bel voto", () => {
  const s = sosachScore({ entries: [], profile: {} });
  assert.ok(s.score <= 25, `libro vuoto = ${s.score}`);
});

test("sosachScore: resta dentro 0-100 e ha una lettera", () => {
  const entries = [];
  for (let i = 0; i < 120; i++) {
    entries.push({ type: i % 4 ? "thu" : "chi", amount: 100_000 + i * 1000,
      date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
      description: "test" });
  }
  const s = sosachScore({ entries, profile: { category: "services_goods" } }, new Date("2026-08-19T00:00:00Z"));
  assert.ok(s.score >= 0 && s.score <= 100);
  assert.ok(["A", "B", "C", "D"].includes(s.grade));
});
