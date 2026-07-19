// ============================================================================
//  Sổ Sạch — Điểm Sổ Sạch (credit-readiness score 0–100).
//  Il fossato dell'exit reso visibile nel prodotto: un libro tenuto bene è un
//  dossier di credito. Il punteggio è spiegabile (4 componenti, tip per salire)
//  — la stessa struttura che una banca/quỹ tín dụng userebbe in underwriting.
//  NON è un credit score ufficiale: euristica di "prontezza del dossier".
// ============================================================================
import { totals } from "./tax.js";

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function sosachScore(book, now = new Date()) {
  const entries = book.entries || [];
  const year = now.getFullYear();

  // 1) Nề nếp ghi sổ (30đ) — copertura: quante delle ultime 12 settimane hanno
  //    almeno una voce. La regolarità è il segnale n.1 per un underwriter.
  const weeks = new Set();
  for (const e of entries) {
    const diff = Math.floor((now - new Date(e.date)) / 86400000);
    if (diff >= 0 && diff < 84) weeks.add(Math.floor(diff / 7));
  }
  const consistency = Math.round(clamp01(weeks.size / 12) * 30);

  // 2) Chứng từ đầy đủ (20đ) — quota di voci con controparte E descrizione:
  //    un libro "auditabile", non solo numeri sciolti.
  const filled = entries.filter((e) => e.counterparty && e.description).length;
  const completeness = entries.length ? Math.round((filled / entries.length) * 20) : 0;

  // 3) Sức khoẻ dòng tiền (30đ) — margine lordo YTD: 0% → 0đ, ≥25% → pieno.
  //    Serve del fatturato registrato perché conti.
  const t = totals(entries, { year });
  const margin = t.revenue > 0 ? t.net / t.revenue : 0;
  const cashflow = t.revenue > 0 ? Math.round(clamp01(margin / 0.25) * 30) : 0;

  // 4) Sẵn sàng khai thuế (20đ) — profilo completo (10) + attività registrata
  //    nel trimestre corrente (10): il tờ khai si può generare davvero.
  const profileOk = book.profile?.name && book.profile?.category ? 10 : 0;
  const q = Math.floor(now.getMonth() / 3) + 1;
  const hasQuarter = entries.some((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && Math.floor(d.getMonth() / 3) + 1 === q;
  });
  const compliance = profileOk + (hasQuarter ? 10 : 0);

  const score = consistency + completeness + cashflow + compliance;
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";

  return {
    score, grade,
    parts: [
      {
        key: "consistency", points: consistency, max: 30,
        vi: "Nề nếp ghi sổ", en: "Bookkeeping habit",
        tip_vi: "Ghi sổ đều mỗi tuần — ngân hàng thích sự đều đặn.",
        tip_en: "Record something every week — lenders love regularity.",
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
        tip_vi: "Lãi gộp dương và ổn định nâng điểm này.",
        tip_en: "Positive, steady gross margin lifts this.",
      },
      {
        key: "compliance", points: compliance, max: 20,
        vi: "Sẵn sàng khai thuế", en: "Filing-ready",
        tip_vi: "Điền tên hộ + ngành nghề, và ghi sổ trong quý hiện tại.",
        tip_en: "Set business name + category, keep the current quarter active.",
      },
    ],
  };
}
