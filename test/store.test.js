// ============================================================================
//  Il motore delle scritture durevoli (src/store.js).
//  La promessa sotto esame: una mutazione FISCALE o è su disco quando il
//  chiamante riceve ok:true, o la memoria torna com'era e arriva ok:false —
//  mai una voce confermata che vive solo in RAM, mai una voce in RAM dopo un
//  "riprova". Modalità JSON (writeFileSync) ma la semantica è identica in PG:
//  il fallimento si inietta col gancio _durability, lo stesso usato dall'e2e.
// ============================================================================
process.env.NODE_ENV = "test";

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initStore, books, accounts, getBook,
  mutateBookDurable, mergeBooksDurable, persistAccountDurable, removeBook, _durability,
} from "../src/store.js";

const DIR = mkdtempSync(join(tmpdir(), "sosach-store-"));
await initStore(DIR);

const onDisk = (uid) => {
  try { return JSON.parse(readFileSync(join(DIR, "ledger.json"), "utf8"))[uid]; }
  catch { return undefined; }
};

test("mutateBookDurable: ok:true solo quando la voce è ANCHE su disco", async () => {
  const out = await mutateBookDurable("t:felice", (b) => {
    b.entries.push({ id: "e1", type: "thu", amount: 100_000 });
    return "fatto";
  });
  assert.equal(out.ok, true);
  assert.equal(out.result, "fatto");
  assert.equal(books["t:felice"].entries.length, 1);
  assert.equal(onDisk("t:felice").entries.length, 1, "la voce deve essere nel file");
});

test("persist fallito → ok:false, memoria ROLLBACK, file intatto", async () => {
  await mutateBookDurable("t:rollback", (b) => { b.entries.push({ id: "base" }); });
  _durability.failNext = 1;
  const out = await mutateBookDurable("t:rollback", (b) => { b.entries.push({ id: "persa" }); });
  assert.equal(out.ok, false);
  assert.ok(out.error, "l'errore arriva al chiamante");
  assert.equal(books["t:rollback"].entries.length, 1, "la memoria torna allo snapshot");
  assert.equal(books["t:rollback"].entries[0].id, "base");
  assert.equal(onDisk("t:rollback").entries.length, 1, "il file non ha mai visto la voce");
  // il guasto era one-shot: il retry dell'utente ora riesce
  const retry = await mutateBookDurable("t:rollback", (b) => { b.entries.push({ id: "riprova" }); });
  assert.equal(retry.ok, true);
  assert.equal(books["t:rollback"].entries.length, 2);
});

test("persist fallito su un libro MAI esistito → la chiave sparisce del tutto", async () => {
  _durability.failNext = 1;
  const out = await mutateBookDurable("t:mai-nato", (b) => { b.entries.push({ id: "x" }); });
  assert.equal(out.ok, false);
  assert.equal(Object.prototype.hasOwnProperty.call(books, "t:mai-nato"), false,
    "getBook non deve lasciare un libro fantasma dopo il rollback");
  assert.equal(onDisk("t:mai-nato"), undefined);
});

test("mutate che LANCIA → rollback e rejection (bug di programmazione, non 503)", async () => {
  await mutateBookDurable("t:throw", (b) => { b.entries.push({ id: "ok" }); });
  await assert.rejects(
    mutateBookDurable("t:throw", (b) => { b.entries.push({ id: "meta" }); throw new Error("boom"); }),
    /boom/);
  assert.equal(books["t:throw"].entries.length, 1, "lo stato a metà non sopravvive");
  assert.equal(onDisk("t:throw").entries.length, 1);
});

test("scritture concorrenti sulla stessa chiave si SERIALIZZANO", async () => {
  const N = 8;
  await Promise.all(Array.from({ length: N }, (_, i) =>
    mutateBookDurable("t:coda", (b) => { b.entries.push({ id: "c" + i }); })));
  assert.equal(books["t:coda"].entries.length, N, "nessuna mutazione calpestata");
  assert.equal(onDisk("t:coda").entries.length, N);
  assert.deepEqual(books["t:coda"].entries.map((e) => e.id),
    Array.from({ length: N }, (_, i) => "c" + i), "ordine FIFO della coda");
});

test("rollback in coda NON calpesta la mutazione successiva", async () => {
  await mutateBookDurable("t:interleave", (b) => { b.entries.push({ id: "a" }); });
  _durability.failNext = 1;
  // le due partono insieme: la prima fallisce e fa rollback, la seconda —
  // serializzata DOPO — deve vedere lo stato ripristinato e riuscire
  const [fail, okOut] = await Promise.all([
    mutateBookDurable("t:interleave", (b) => { b.entries.push({ id: "b-persa" }); }),
    mutateBookDurable("t:interleave", (b) => { b.entries.push({ id: "c-viva" }); }),
  ]);
  assert.equal(fail.ok, false);
  assert.equal(okOut.ok, true);
  assert.deepEqual(books["t:interleave"].entries.map((e) => e.id), ["a", "c-viva"]);
  assert.deepEqual(onDisk("t:interleave").entries.map((e) => e.id), ["a", "c-viva"]);
});

test("persistAccountDurable: fallimento → ok:false, il retry riconverge", async () => {
  accounts["0900111222"] = { phone: "0900111222", role: "ho" };
  _durability.failNext = 1;
  const fail = await persistAccountDurable("0900111222");
  assert.equal(fail.ok, false);
  const ok = await persistAccountDurable("0900111222");
  assert.equal(ok.ok, true);
  const acctsOnDisk = JSON.parse(readFileSync(join(DIR, "accounts.json"), "utf8"));
  assert.equal(acctsOnDisk["0900111222"].phone, "0900111222");
});

test("removeBook è awaitabile: sparisce da memoria E dal file", async () => {
  await mutateBookDurable("t:via", (b) => { b.entries.push({ id: "x" }); });
  assert.ok(onDisk("t:via"));
  await removeBook("t:via");
  assert.equal(books["t:via"], undefined);
  assert.equal(onDisk("t:via"), undefined);
});

test("la coda serializza con persist LENTI (interleave reale, non solo sincrono)", async () => {
  // In JSON mode writeFileSync è sincrona: senza questo delay due task in coda
  // non potrebbero mai interleave e il test passerebbe anche SENZA coda.
  _durability.delayNextMs = 40;
  const a = mutateBookDurable("t:slow", (b) => { b.entries.push({ id: "a" }); });
  const b2 = mutateBookDurable("t:slow", (b) => { b.entries.push({ id: "b" }); });
  const [ra, rb] = await Promise.all([a, b2]);
  assert.equal(ra.ok, true); assert.equal(rb.ok, true);
  assert.deepEqual(books["t:slow"].entries.map((e) => e.id), ["a", "b"]);
  assert.deepEqual(onDisk("t:slow").entries.map((e) => e.id), ["a", "b"]);
});

test("mergeBooksDurable: fusione sotto ENTRAMBE le code — nessuna voce persa", async () => {
  // Il bug che il verifier ha trovato pre-commit: merge sulla sola coda della
  // destinazione + scrittura concorrente sulla sorgente durante l'UPSERT del
  // merge = voce confermata e poi cancellata dal removeBook. Qui il persist
  // del merge è rallentato ad arte e la scrittura concorrente parte SUBITO:
  // con il merge a doppia coda deve sopravvivere sempre, da qualche parte.
  await mutateBookDurable("t:m-src", (b) => { b.entries.push({ id: "s1" }); });
  _durability.delayNextMs = 50;
  const mergeP = mergeBooksDurable("t:m-src", "t:m-dst", (src, dst) => {
    if (src?.entries?.length) dst.entries.push(...src.entries);
    return src?.entries?.length || 0;
  });
  const writeP = mutateBookDurable("t:m-src", (b) => { b.entries.push({ id: "s2" }); });
  const [m, w] = await Promise.all([mergeP, writeP]);
  assert.equal(m.ok, true);
  assert.equal(w.ok, true);
  assert.ok(books["t:m-dst"].entries.some((e) => e.id === "s1"), "s1 fusa nella destinazione");
  const everywhere = [...(books["t:m-dst"]?.entries || []), ...(books["t:m-src"]?.entries || [])].map((e) => e.id);
  assert.ok(everywhere.includes("s2"),
    "s2 (scritta durante il merge) deve ESISTERE — fusa o sul libro sorgente ricreato, mai persa: " + everywhere.join(","));
});

test("mergeBooksDurable: persist fallito → ENTRAMBI i libri tornano come prima", async () => {
  await mutateBookDurable("t:mr-src", (b) => { b.entries.push({ id: "s1" }); });
  await mutateBookDurable("t:mr-dst", (b) => { b.entries.push({ id: "d1" }); });
  _durability.failNext = 1;
  const m = await mergeBooksDurable("t:mr-src", "t:mr-dst", (src, dst) => {
    dst.entries.push(...src.entries);
  });
  assert.equal(m.ok, false);
  assert.deepEqual(books["t:mr-src"].entries.map((e) => e.id), ["s1"], "sorgente intatta");
  assert.deepEqual(books["t:mr-dst"].entries.map((e) => e.id), ["d1"], "destinazione intatta");
  assert.deepEqual(onDisk("t:mr-src").entries.map((e) => e.id), ["s1"]);
  assert.deepEqual(onDisk("t:mr-dst").entries.map((e) => e.id), ["d1"]);
});

test("mergeBooksDurable: successo → sorgente rimossa, destinazione durevole", async () => {
  await mutateBookDurable("t:mo-src", (b) => { b.entries.push({ id: "x1" }, { id: "x2" }); });
  const m = await mergeBooksDurable("t:mo-src", "t:mo-dst", (src, dst) => {
    dst.entries.push(...src.entries);
    return src.entries.length;
  });
  assert.equal(m.ok, true);
  assert.equal(m.result, 2);
  assert.equal(books["t:mo-src"], undefined, "sorgente via dalla memoria");
  assert.equal(onDisk("t:mo-src"), undefined, "sorgente via dal file");
  assert.deepEqual(onDisk("t:mo-dst").entries.map((e) => e.id), ["x1", "x2"]);
});

test("getBook dopo un rollback non resuscita lo snapshot vecchio per riferimento", async () => {
  // Chi tiene un riferimento al libro PRIMA della mutazione fallita sta
  // guardando un oggetto staccato: la disciplina è rileggere con getBook.
  const before = getBook("t:refs");
  before.entries.push({ id: "seed" });
  await mutateBookDurable("t:refs", () => {});          // persist del seed
  _durability.failNext = 1;
  await mutateBookDurable("t:refs", (b) => { b.entries.push({ id: "kaputt" }); });
  const after = getBook("t:refs");
  assert.equal(after.entries.length, 1);
  assert.equal(after.entries[0].id, "seed");
});
