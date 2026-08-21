// ============================================================================
//  Sổ Sạch — proposte in sospeso (estrazioni foto a bassa confidenza).
//
//  Quando la lettura di uno scontrino è incerta il bot NON scrive il libro:
//  propone la voce e aspetta un "1" di conferma. La proposta vive qui, in una
//  Map in memoria chiavata per uid, con TTL di 10 minuti. Un riavvio la
//  svuota: accettabile — la foto è ancora nella chat, si rimanda.
//
//  Modulo puro (niente I/O, clock iniettabile) così i test possono girare il
//  tempo in avanti senza aspettare 10 minuti veri.
// ============================================================================

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function makePendingStore({ ttlMs = DEFAULT_TTL_MS, now = Date.now } = {}) {
  const map = new Map(); // uid → { value, at }

  // Potatura opportunistica: la mappa non deve crescere all'infinito se
  // nessuno consuma mai le proposte (foto sfocate mandate e abbandonate).
  function prune() {
    const t = now();
    for (const [k, rec] of map) if (t - rec.at > ttlMs) map.delete(k);
  }

  return {
    // Registra (o SOSTITUISCE) la proposta in sospeso per questo uid: una
    // nuova foto incerta rimpiazza sempre la precedente — mai due in coda.
    put(uid, value) {
      prune();
      map.set(uid, { value, at: now() });
    },

    // Legge E RIMUOVE la proposta. Scaduta → null (e comunque rimossa): è la
    // semantica «qualunque interazione successiva scarta in silenzio» — il
    // chiamante la invoca a ogni messaggio, e solo un "1" entro il TTL salva.
    take(uid) {
      const rec = map.get(uid);
      if (!rec) return null;
      map.delete(uid);
      return now() - rec.at > ttlMs ? null : rec.value;
    },

    // Solo per test e diagnostica.
    size() {
      return map.size;
    },
  };
}
