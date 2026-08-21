// ============================================================================
//  Sổ Sạch — saldi di apertura per chi arriva a metà anno.
//
//  IL PROBLEMA CHE RISOLVE. `projectAnnual()` divide i ricavi da inizio anno
//  per i GIORNI TRASCORSI dal 1° gennaio. Un quán che fattura 120 triệu al
//  mese — 1,44 tỷ l'anno, ben SOPRA la soglia — se si iscrive il 19 agosto con
//  il libro vuoto proietta 114 triệu e il prodotto gli dice "miễn thuế, 0đ".
//  Sette mesi in bianco vengono letti come sette mesi senza incassi. È il
//  modo più veloce per far sbagliare la dichiarazione a un hộ kinh doanh.
//
//  LA FORMA. Le cifre portate da fuori diventano VOCI VERE del libro, non un
//  campo a parte: così totali, tờ khai, grafico e export funzionano senza
//  toccare nulla. Ma nascono con `provenance: "declared"` — dichiarate, non
//  documentate — e il punteggio Sổ Sạch le ignora. Un hộ può quindi arrivare
//  con tre anni di quaderno, avere SUBITO la posizione fiscale giusta, e un
//  Điểm Sổ Sạch che parte basso e se lo guadagna dal primo giorno di prove.
//  È la distinzione che un istituto di credito compra.
// ============================================================================
import { todayVN, realDate } from "./vndate.js";
import { quarterOf } from "./tax.js";

export const openingId = (year, q, type) => `open:${year}Q${q}:${type}`;
const isOpening = (e) => typeof e?.id === "string" && e.id.startsWith("open:");

// Ultimo giorno del trimestre; per il trimestre IN CORSO si usa oggi, perché
// una voce datata al 30/09 il 19 agosto sarebbe una data futura — e il
// validatore delle foto, giustamente, le rifiuta.
export function openingDate(year, q, today = todayVN()) {
  const now = quarterOf(today);
  if (year > now.year || (year === now.year && q > now.q)) return null; // futuro
  if (year === now.year && q === now.q) return today;
  const endDay = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" }[q];
  return `${year}-${endDay}`;
}

// Sostituisce (non accumula) le voci di apertura di un trimestre.
//   quarters: { 1: {revenue, expenses}, 2: {...}, ... }
// Torna { entries, replaced, skipped } — `skipped` elenca i trimestri rifiutati
// con il motivo, perché un'apertura scartata in silenzio è di nuovo il bug di
// partenza.
export function applyOpening(book, { year, quarters }, today = todayVN()) {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > quarterOf(today).year) {
    return { error: `bad year: ${JSON.stringify(year)}` };
  }
  const skipped = [];
  const keep = [];
  const touched = new Set();

  for (const [rawQ, vals] of Object.entries(quarters || {})) {
    const q = Number(rawQ);
    if (![1, 2, 3, 4].includes(q)) { skipped.push({ q: rawQ, why: "quarter must be 1-4" }); continue; }
    const date = openingDate(y, q, today);
    if (!date || !realDate(date)) { skipped.push({ q, why: "quarter is in the future" }); continue; }
    touched.add(q);
    for (const [type, key] of [["thu", "revenue"], ["chi", "expenses"]]) {
      const amount = Math.round(Number(vals?.[key]) || 0);
      if (amount < 0) { skipped.push({ q, why: `negative ${key}` }); continue; }
      if (amount === 0) continue;                     // 0 = cancella, non registra
      keep.push({
        id: openingId(y, q, type),
        type, amount, date,
        counterparty: "",
        description: type === "thu"
          ? `Doanh thu Quý ${q}/${y} trước khi dùng Sổ Sạch (tự khai)`
          : `Chi phí Quý ${q}/${y} trước khi dùng Sổ Sạch (tự khai)`,
        source: "opening",
        provenance: "declared",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Via le vecchie aperture SOLO dei trimestri toccati: correggere il Q2 non
  // deve cancellare il Q1 dichiarato la settimana scorsa.
  const drop = new Set();
  for (const q of touched) for (const t of ["thu", "chi"]) drop.add(openingId(y, q, t));
  const before = book.entries.length;
  book.entries = book.entries.filter((e) => !drop.has(e.id));
  const replaced = before - book.entries.length;
  book.entries.push(...keep);

  return { entries: keep.length, replaced, skipped };
}

// Le aperture attualmente nel libro, per ri-mostrarle nel form.
export function openingOf(book, year) {
  const out = {};
  for (const e of book.entries) {
    if (!isOpening(e)) continue;
    const m = /^open:(\d{4})Q([1-4]):(thu|chi)$/.exec(e.id);
    if (!m || Number(m[1]) !== Number(year)) continue;
    const q = Number(m[2]);
    out[q] = out[q] || { revenue: 0, expenses: 0 };
    out[q][m[3] === "thu" ? "revenue" : "expenses"] = e.amount;
  }
  return out;
}

// Indice dell'ultima voce che "sửa" può toccare, o -1. Vive qui perché il
// confine da difendere è di questo modulo: le aperture (`provenance:
// "declared"`) si correggono ri-dichiarando con "khai" — replace, non delete —
// e un "sửa" che le cancellasse farebbe sparire un trimestre intero di
// fatturato dalla proiezione, cioè il bug d'origine di questo file.
// "Ultima" = max createdAt; a parità o senza createdAt decide l'ordine
// d'arrivo nel libro (le voci vengono solo appese).
export function latestCorrectable(entries) {
  let best = -1;
  for (let i = 0; i < (entries || []).length; i++) {
    if (entries[i]?.provenance === "declared") continue;
    if (best === -1 || String(entries[i].createdAt || "") >= String(entries[best].createdAt || "")) {
      best = i;
    }
  }
  return best;
}

// Quota di ricavi solo DICHIARATI in un periodo: la tờ khai deve poterlo dire.
export function declaredRevenue(entries, { year, q } = {}) {
  let sum = 0;
  for (const e of entries) {
    if (e.provenance !== "declared" || e.type !== "thu") continue;
    const m = /^(\d{4})-(\d{2})/.exec(e.date || "");
    if (!m) continue;
    if (year && Number(m[1]) !== year) continue;
    if (q && Math.floor((Number(m[2]) - 1) / 3) + 1 !== q) continue;
    sum += e.amount;
  }
  return sum;
}
