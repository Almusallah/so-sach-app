// ============================================================================
//  Sổ Sạch — la tờ khai 01/CNKD, calcolata UNA volta sola.
//  La rotta HTTP e il comando "quý" del bot devono dare la stessa risposta:
//  due implementazioni della stessa dichiarazione fiscale è il modo migliore
//  per farle divergere in silenzio e far depositare all'hộ due cifre diverse
//  a seconda di dove ha guardato.
// ============================================================================
import { totals, quarterlyTax, projectAnnual, quarterOf, nextDeadline, CATEGORIES } from "./tax.js";
import { declaredRevenue } from "./opening.js";
import { todayVN } from "./vndate.js";

export function buildDeclaration(book, { year, q, now = new Date() } = {}) {
  const cur = quarterOf(now);
  const Y = Number(year) || cur.year;
  const Q = Number(q) || cur.q;
  const t = totals(book.entries, { year: Y, q: Q });
  const tYear = totals(book.entries, { year: Y });
  const projection = projectAnnual(tYear.revenue, now);
  const tax = quarterlyTax(t.revenue, book.profile.category, projection);
  const cat = CATEGORIES[book.profile.category] || CATEGORIES.services_goods;

  return {
    form: "01/CNKD (Thông tư 40/2021/TT-BTC) — BẢN NHÁP / DRAFT",
    period: `Quý ${Q} năm ${Y}`,
    year: Y, quarter: Q,
    generatedAt: todayVN(now),
    deadline: deadlineFor(Y, Q),
    taxpayer: book.profile.name || "—",
    category: { key: book.profile.category, vi: cat.vi, en: cat.en },
    revenue: t.revenue,
    expenses: t.expenses,
    net: t.net,
    declaredRevenue: declaredRevenue(book.entries, { year: Y, q: Q }),
    projection,
    rates: tax.rates,
    vat: tax.vat,
    pit: tax.pit,
    total: tax.total,
    exempt: tax.exempt,
    exemptNote: tax.exempt
      ? "Doanh thu dự kiến cả năm dưới ngưỡng chịu thuế — vẫn phải nộp tờ khai."
      : null,
    disclaimer: "Bản nháp do Sổ Sạch soạn. Kiểm tra với đại lý thuế trước khi nộp. / Draft prepared by Sổ Sạch — verify with a licensed tax agent before filing.",
  };
}

// Scadenza di UN trimestre qualsiasi, non solo di quello corrente: chi chiede
// il Q1 a novembre deve vedere la data del Q1.
export function deadlineFor(year, q) {
  // Ultimo giorno del mese successivo al trimestre. Day 0 di Date.UTC risale
  // all'ultimo giorno del mese precedente, quindi il mese q*3+1 dà il giusto.
  return new Date(Date.UTC(year, q * 3 + 1, 0)).toISOString().slice(0, 10);
}

export { nextDeadline };
