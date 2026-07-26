// ============================================================================
//  Sổ Sạch — Điểm Sổ Sạch (credit-readiness score 0–100).
//  Il fossato dell'exit reso visibile nel prodotto: un libro tenuto bene è un
//  dossier di credito. Il punteggio è spiegabile (4 componenti, tip per salire)
//  — la stessa struttura che una banca/quỹ tín dụng userebbe in underwriting.
//  NON è un credit score ufficiale: euristica di "prontezza del dossier".
//
//  ⚠ Tarato per DISCRIMINARE (rev. 2026-07-25). La prima versione dava la A a
//  chiunque: bastava una voce a settimana per fare 30/30 di costanza, un
//  margine >25% per 30/30 di cassa e il profilo compilato per 20/20. Su un
//  portafoglio di 12 hộ dava 12 A — un punteggio dove passano tutti non serve
//  a nessun istituto di credito. Ora si misura la DENSITÀ (giorni davvero
//  registrati sugli attesi) e i punti "gratis" sono graduati.
// ============================================================================
import { totals } from "./tax.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

export function sosachScore(book, now = new Date()) {
  const entries = book.entries || [];
  const year = now.getFullYear();

  // 1) Nề nếp ghi sổ (30đ) — DENSITÀ, non semplice presenza: giorni distinti
  //    con almeno una voce nelle ultime 12 settimane, su ~6 giorni/settimana
  //    attesi (72). Distingue chi registra ogni giorno da chi tocca il libro
  //    una volta a settimana — il segnale n.1 per un underwriter.
  const days = new Set();
  for (const e of entries) {
    const diff = Math.floor((now - new Date(e.date)) / 86400000);
    if (diff >= 0 && diff < 84) days.add(dayKey(e.date));
  }
  const EXPECTED_DAYS = 72;
  const consistency = Math.round(clamp01(days.size / EXPECTED_DAYS) * 30);

  // 2) Chứng từ đầy đủ (20đ) — quota di voci con controparte E descrizione:
  //    un libro "auditabile", non solo numeri sciolti.
  const filled = entries.filter((e) => e.counterparty && e.description).length;
  const completeness = entries.length ? Math.round((filled / entries.length) * 20) : 0;

  // 3) Sức khoẻ dòng tiền (30đ) — margine (20) + regolarità (10).
  //    Il margine da solo premiava troppo: un mese buono e via. La regolarità
  //    guarda quanti mesi attivi chiudono in positivo.
  const t = totals(entries, { year });
  const margin = t.revenue > 0 ? t.net / t.revenue : 0;
  const marginPts = t.revenue > 0 ? Math.round(clamp01(margin / 0.20) * 20) : 0;

  const byMonth = new Map();
  for (const e of entries) {
    const d = new Date(e.date);
    if (d.getFullYear() !== year) continue;
    const k = d.getMonth();
    const m = byMonth.get(k) || { thu: 0, chi: 0 };
    m[e.type === "thu" ? "thu" : "chi"] += e.amount;
    byMonth.set(k, m);
  }
  const months = [...byMonth.values()];
  const positive = months.filter((m) => m.thu > m.chi).length;
  const steadyPts = months.length ? Math.round((positive / months.length) * 10) : 0;
  const cashflow = marginPts + steadyPts;

  // 4) Sẵn sàng khai thuế (20đ) — graduato, niente blocco da 10 punti regalati:
  //    profilo (6) + trimestre corrente attivo (6) + libro a doppia entrata,
  //    cioè sia thu che chi (4) + almeno 60 giorni di storico (4).
  let compliance = 0;
  if (book.profile?.name && book.profile?.category) compliance += 6;
  const q = Math.floor(now.getMonth() / 3) + 1;
  const hasQuarter = entries.some((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && Math.floor(d.getMonth() / 3) + 1 === q;
  });
  if (hasQuarter) compliance += 6;
  if (entries.some((e) => e.type === "thu") && entries.some((e) => e.type === "chi")) compliance += 4;
  const spanDays = entries.length
    ? Math.floor((now - new Date(Math.min(...entries.map((e) => +new Date(e.date))))) / 86400000)
    : 0;
  if (spanDays >= 60) compliance += 4;

  const score = consistency + completeness + cashflow + compliance;
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";

  return {
    score, grade,
    parts: [
      {
        key: "consistency", points: consistency, max: 30,
        vi: "Nề nếp ghi sổ", en: "Bookkeeping habit",
        tip_vi: "Ghi sổ mỗi ngày bán hàng — ngân hàng nhìn vào sự đều đặn.",
        tip_en: "Record on every trading day — lenders read regularity.",
      },
      {
        key: "completeness", points: completeness, max: 20,
        vi: "Chứng từ đầy đủ", en: "Complete records",
        tip_vi: "Điền tên đối tác và mô tả cho mỗi bút toán.",
        tip_en: "Fill counterparty and description on every entry.",
      },
      {
        key: "cashflow", points: cashflow, max: 30,
        vi: "Sức khoẻ dòng tiền", en: "Cash-flow health",
        tip_vi: "Lãi gộp dương và ổn định qua từng tháng nâng điểm này.",
        tip_en: "A positive margin, steady month after month, lifts this.",
      },
      {
        key: "compliance", points: compliance, max: 20,
        vi: "Sẵn sàng khai thuế", en: "Filing-ready",
        tip_vi: "Điền tên hộ + ngành nghề, ghi cả thu lẫn chi, giữ sổ liên tục.",
        tip_en: "Set name + category, record both income and expenses, keep it continuous.",
      },
    ],
  };
}
