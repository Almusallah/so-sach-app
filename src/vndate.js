// ============================================================================
//  Sổ Sạch — "oggi" secondo il fuso di Hồ Chí Minh, non secondo il server.
//  Render gira in UTC: alle 00:30 ICT (= 17:30 UTC del giorno prima) un quán
//  che chiude a tarda notte si vedrebbe la voce datata IERI. E il 1° gennaio
//  o il 1° aprile quella voce finirebbe nel TRIMESTRE sbagliato, cioè nella
//  dichiarazione 01/CNKD sbagliata. Per un prodotto di contabilità è un bug
//  fiscale, non un dettaglio di formattazione.
// ============================================================================

// en-CA formatta nativamente YYYY-MM-DD.
const FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
});

export const todayVN = (now = new Date()) => FMT.format(now);

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

// Una data ISO che ESISTE davvero. `new Date("2026-02-30T00:00:00Z")` NON è
// NaN: JS la fa scorrere al 2 marzo. Il round-trip è l'unico controllo serio.
export function realDate(iso) {
  if (!ISO.test(String(iso || ""))) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === iso ? d : null;
}

// Aritmetica di giorni su una data ISO GIÀ nel fuso VN (l'output di todayVN):
// si lavora a mezzanotte UTC sulla STRINGA, mai su new Date() del server —
// "hôm qua" scritto alle 00:30 ICT deve dare ieri VIETNAMITA, non ieri del
// server UTC. Attraversa mesi, trimestri e anni senza sorprese (setUTCDate
// normalizza da solo: 2026-04-01 − 1 = 2026-03-31).
export function addDaysVN(iso, delta) {
  const d = realDate(iso);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + Number(delta || 0));
  return d.toISOString().slice(0, 10);
}

// Normalizza la data letta da uno scontrino.
//   → { date, dateNote: null | "swapped" | "guessed" }
// `dateNote` non è cosmetico: dice al bot se deve chiedere conferma all'utente.
export function normalizeReceiptDate(raw, today = todayVN()) {
  const t = realDate(today) || new Date();
  const clean = String(raw || "").trim();
  const d = realDate(clean);

  if (d && d <= t) {
    // Più di 2 anni fa: o l'anno è stato letto male, o è un'allucinazione.
    // Non la riscrivo in silenzio — segnalo e lascio decidere all'utente.
    const days = (t - d) / 86_400_000;
    return days > 730 ? { date: today, dateNote: "guessed" } : { date: clean, dateNote: null };
  }

  // Data FUTURA = impossibile su uno scontrino già stampato. In Việt Nam la
  // causa è quasi sempre DD/MM letto come MM/DD: "10/08/2026" (10 agosto)
  // torna indietro come 2026-10-08 (8 ottobre). Scambiare i due campi
  // recupera la data vera invece di buttarla via.
  if (d) {
    const swapped = `${clean.slice(0, 4)}-${clean.slice(8, 10)}-${clean.slice(5, 7)}`;
    const s = realDate(swapped);
    if (s && s <= t) return { date: swapped, dateNote: "swapped" };
  }
  return { date: today, dateNote: "guessed" };
}
