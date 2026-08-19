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

// ---- Số dư đầu kỳ (chi arriva a metà anno) ----------------------------------
import { applyOpening, openingOf, openingDate, declaredRevenue } from "../src/opening.js";

const freshBook = () => ({ profile: { category: "services_goods" }, entries: [] });

test("openingDate: trimestri chiusi al loro ultimo giorno, quello in corso a oggi", () => {
  assert.equal(openingDate(2026, 1, TODAY), "2026-03-31");
  assert.equal(openingDate(2026, 2, TODAY), "2026-06-30");
  assert.equal(openingDate(2026, 3, TODAY), TODAY, "Q3 è in corso il 19/08 → oggi, non 30/09 (sarebbe futuro)");
  assert.equal(openingDate(2026, 4, TODAY), null, "Q4 non è ancora cominciato");
  assert.equal(openingDate(2025, 4, TODAY), "2025-12-31", "anno chiuso → fine trimestre");
});

test("applyOpening: IL BUG — chi si iscrive ad agosto non deve risultare esente", () => {
  // Quán da 120 triệu/mese = 1,44 tỷ l'anno: SOPRA la soglia del miliardo.
  const perMonth = 120_000_000;
  const b = freshBook();
  // Un mese di registrazioni vere, tutto il resto in bianco.
  for (let d = 0; d < 25; d++) {
    b.entries.push({ id: "e" + d, type: "thu", amount: Math.round(perMonth / 25),
      date: `2026-08-${String(d + 1).padStart(2, "0")}`, provenance: "photo" });
  }
  const now = new Date("2026-08-19T00:00:00Z");
  const before = projectAnnual(totals(b.entries, { year: 2026 }).revenue, now);
  assert.ok(before < 1_000_000_000, `senza apertura proietta ${before} → dice esente`);

  applyOpening(b, { year: 2026, quarters: {
    1: { revenue: perMonth * 3 }, 2: { revenue: perMonth * 3 }, 3: { revenue: perMonth } } }, TODAY);

  const after = projectAnnual(totals(b.entries, { year: 2026 }).revenue, now);
  assert.ok(after > 1_000_000_000, `con l'apertura proietta ${after} → correttamente NON esente`);
  assert.equal(thresholdStatus(after).taxFree.crossed, true);
});

test("applyOpening: le cifre finiscono nel trimestre giusto", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: { 1: { revenue: 100 }, 2: { revenue: 200 }, 3: { revenue: 300 } } }, TODAY);
  assert.equal(totals(b.entries, { year: 2026, q: 1 }).revenue, 100);
  assert.equal(totals(b.entries, { year: 2026, q: 2 }).revenue, 200);
  assert.equal(totals(b.entries, { year: 2026, q: 3 }).revenue, 300);
});

test("applyOpening: SOSTITUISCE, non accumula — e non tocca gli altri trimestri", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: { 1: { revenue: 100 }, 2: { revenue: 200 } } }, TODAY);
  applyOpening(b, { year: 2026, quarters: { 2: { revenue: 999 } } }, TODAY);
  assert.equal(totals(b.entries, { year: 2026, q: 2 }).revenue, 999, "Q2 corretto, non 200+999");
  assert.equal(totals(b.entries, { year: 2026, q: 1 }).revenue, 100, "Q1 dichiarato prima resta");
});

test("applyOpening: 0 cancella l'apertura", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: { 1: { revenue: 100, expenses: 50 } } }, TODAY);
  assert.equal(b.entries.length, 2);
  applyOpening(b, { year: 2026, quarters: { 1: { revenue: 0, expenses: 0 } } }, TODAY);
  assert.equal(b.entries.length, 0);
});

test("applyOpening: un trimestre futuro viene rifiutato E segnalato, mai ignorato", () => {
  const b = freshBook();
  const out = applyOpening(b, { year: 2026, quarters: { 4: { revenue: 500 } } }, TODAY);
  assert.equal(out.entries, 0);
  assert.deepEqual(out.skipped, [{ q: 4, why: "quarter is in the future" }]);
});

test("applyOpening: anno assurdo → errore, non un libro corrotto", () => {
  for (const year of [2030, 1999, "abc", null, 20.5]) {
    assert.ok(applyOpening(freshBook(), { year, quarters: { 1: { revenue: 1 } } }, TODAY).error, `year=${year}`);
  }
});

test("le aperture sono 'declared' e NON fanno punteggio", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: {
    1: { revenue: 500_000_000 }, 2: { revenue: 500_000_000 } } }, TODAY);
  assert.ok(b.entries.every((e) => e.provenance === "declared" && e.source === "opening"));
  const s = sosachScore(b, new Date("2026-08-19T00:00:00Z"));
  assert.ok(s.score <= 25, `un anno dichiarato non compra un punteggio: ${s.score}`);
});

test("il punteggio guarda solo le voci con prova", () => {
  const withProof = freshBook(), declaredOnly = freshBook();
  for (let d = 0; d < 60; d++) {
    const date = new Date(Date.UTC(2026, 5, 1) + d * 86400000).toISOString().slice(0, 10);
    withProof.entries.push({ id: "p" + d, type: d % 4 ? "thu" : "chi", amount: 500_000, date,
      counterparty: "Khách lẻ", description: "Bán hàng", provenance: "photo" });
  }
  applyOpening(declaredOnly, { year: 2026, quarters: { 1: { revenue: 1_000_000_000 } } }, TODAY);
  const now = new Date("2026-08-19T00:00:00Z");
  assert.ok(sosachScore(withProof, now).score > sosachScore(declaredOnly, now).score + 30,
    "chi documenta deve staccare nettamente chi dichiara");
});

test("openingOf: rilegge quello che c'è, per ri-mostrarlo nel form", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: { 1: { revenue: 100, expenses: 40 }, 2: { revenue: 200 } } }, TODAY);
  assert.deepEqual(openingOf(b, 2026), { 1: { revenue: 100, expenses: 40 }, 2: { revenue: 200, expenses: 0 } });
  assert.deepEqual(openingOf(b, 2025), {}, "un altro anno non si mescola");
});

test("declaredRevenue: la tờ khai sa dire quanta parte non ha una foto dietro", () => {
  const b = freshBook();
  applyOpening(b, { year: 2026, quarters: { 3: { revenue: 300 } } }, TODAY);
  b.entries.push({ id: "x", type: "thu", amount: 700, date: TODAY, provenance: "photo" });
  assert.equal(totals(b.entries, { year: 2026, q: 3 }).revenue, 1000);
  assert.equal(declaredRevenue(b.entries, { year: 2026, q: 3 }), 300);
});

// ---- Comandi del bot --------------------------------------------------------
import { matchCommand, normalize, menuText, welcomeText, COMMANDS } from "../src/commands.js";
import { buildDeclaration, deadlineFor } from "../src/declaration.js";
import { formatQuarterMessage, formatEntryMessage, vnDate } from "../src/zalo.js";

test("matchCommand: i vietnamiti scrivono spesso senza segni diacritici", () => {
  for (const t of ["sổ", "SỔ", "so", " Sô ", "Sổ Sạch", "tổng kết"]) assert.equal(matchCommand(t), "year", t);
  for (const t of ["quý", "QUY", "quy", "Quý này", "thuế"]) assert.equal(matchCommand(t), "quarter", t);
  for (const t of ["menu", "giúp", "GIUP", "help", "?", "hướng dẫn", "làm gì"]) assert.equal(matchCommand(t), "menu", t);
});

test("matchCommand: non intercetta ciò che non è un comando", () => {
  for (const t of ["thu 2tr4", "chi 500k", "xin chào", "", "  ", "A1B2C3", "500000"])
    assert.equal(matchCommand(t), null, JSON.stringify(t));
});

test("il menu elenca DAVVERO ogni comando esistente", () => {
  // La regressione da evitare: il testo di aiuto che promette qualcosa che il
  // router non fa (prometteva "tổng kết tháng" e restituiva l'anno).
  const txt = menuText();
  for (const c of COMMANDS) assert.ok(txt.includes(c.label_vi), `manca dal menu: ${c.key}`);
  assert.ok(txt.includes('"quý"') && txt.includes('"sổ"') && txt.includes('"menu"'));
});

test("nessun testo del bot promette più un totale MENSILE", () => {
  const entry = { type: "chi", amount: 30000, date: "2026-08-10", counterparty: "JMART", description: "x" };
  for (const t of [menuText(), welcomeText(), formatEntryMessage(entry)]) {
    assert.ok(!/tổng kết tháng/i.test(t), "promette ancora il mese: " + t.slice(0, 60));
  }
});

test("vnDate: le date si mostrano all'italiana/vietnamita, non in ISO", () => {
  assert.equal(vnDate("2026-10-31"), "31/10/2026");
  assert.equal(vnDate("2026-01-05"), "05/01/2026");
  assert.equal(vnDate("boh"), "boh");
});

test("deadlineFor: ogni trimestre, non solo quello in corso", () => {
  assert.equal(deadlineFor(2026, 1), "2026-04-30");
  assert.equal(deadlineFor(2026, 2), "2026-07-31");
  assert.equal(deadlineFor(2026, 3), "2026-10-31");
  assert.equal(deadlineFor(2026, 4), "2027-01-31", "il Q4 scade a gennaio dell'anno dopo");
});

test('il comando "quý" risponde con quello che serve per depositare', () => {
  const book = { profile: { name: "Quán Cô Ba", category: "services_goods" }, entries: [] };
  for (let d = 0; d < 40; d++) {
    book.entries.push({ id: "e" + d, type: "thu", amount: 30_000_000,
      date: `2026-07-${String((d % 30) + 1).padStart(2, "0")}`, provenance: "photo" });
  }
  const msg = formatQuarterMessage(buildDeclaration(book, { now: new Date("2026-08-19T00:00:00Z") }));
  assert.match(msg, /Quý 3\/2026/);
  assert.match(msg, /Thu:/);
  assert.match(msg, /Thuế tạm tính/, "sopra soglia → deve mostrare l'imposta");
  assert.match(msg, /GTGT 3%/);
  assert.match(msg, /TNCN 1,5%/, "virgola decimale, non punto");
  assert.match(msg, /31\/10\/2026/, "la scadenza in formato vietnamita");
  assert.match(msg, /đại lý thuế/, "e il rimando al professionista");
});

test('"quý" per un esente dice ESENTE ma ricorda la dichiarazione', () => {
  const book = { profile: { name: "Quán nhỏ", category: "services_goods" }, entries: [
    { id: "a", type: "thu", amount: 5_000_000, date: "2026-07-10", provenance: "photo" }] };
  const msg = formatQuarterMessage(buildDeclaration(book, { now: new Date("2026-08-19T00:00:00Z") }));
  assert.match(msg, /dưới ngưỡng 1 tỷ/);
  assert.match(msg, /VẪN phải nộp tờ khai/, "esente non vuol dire niente da fare");
  assert.ok(!/Thuế tạm tính/.test(msg), "non deve mostrare un'imposta che non è dovuta");
});

test('"quý" dichiara quanta parte del ricavo è solo autodichiarata', () => {
  const book = { profile: { category: "services_goods" }, entries: [] };
  applyOpening(book, { year: 2026, quarters: { 3: { revenue: 200_000_000 } } }, TODAY);
  book.entries.push({ id: "p", type: "thu", amount: 50_000_000, date: "2026-08-01", provenance: "photo" });
  const msg = formatQuarterMessage(buildDeclaration(book, { now: new Date("2026-08-19T00:00:00Z") }));
  assert.match(msg, /tự khai, chưa có chứng từ/);
});

test("buildDeclaration: la rotta HTTP e il bot calcolano la stessa cosa", () => {
  // Non è un test cosmetico: due implementazioni della stessa dichiarazione
  // fiscale divergono, e l'hộ deposita cifre diverse a seconda di dove guarda.
  const book = { profile: { name: "X", category: "distribution" }, entries: [
    { id: "1", type: "thu", amount: 900_000_000, date: "2026-07-05", provenance: "photo" },
    { id: "2", type: "chi", amount: 100_000_000, date: "2026-08-05", provenance: "photo" }] };
  const d = buildDeclaration(book, { year: 2026, q: 3, now: new Date("2026-08-19T00:00:00Z") });
  assert.equal(d.revenue, 900_000_000);
  assert.equal(d.expenses, 100_000_000);
  assert.equal(d.rates.vat, 0.01);
  assert.equal(d.vat, 9_000_000);
  assert.equal(d.pit, 4_500_000);
  assert.equal(d.total, 13_500_000);
  assert.equal(d.deadline, "2026-10-31");
  assert.match(d.form, /BẢN NHÁP/);
});
