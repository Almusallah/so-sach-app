// ============================================================================
//  Sổ Sạch — motore fiscale per hộ kinh doanh (regime 2026, post-khoán).
//  ATTENZIONE PROTOTIPO: aliquote e soglie codificate dalle norme citate nel
//  README (Circ. 40/2021/TT-BTC per le aliquote %, Decreto 70/2025 e riforma
//  2026 per le soglie). Vanno validate con un đại lý thuế prima dell'uso reale.
// ============================================================================
import { todayVN } from "./vndate.js";

// Soglie 2026 (VND / anno) — configurabili via env per aggiornamenti rapidi.
export const THRESHOLDS = {
  // Sotto questa soglia di ricavi annui: esente VAT/PIT. Innalzata da 500M a
  // 1 miliardo dal 01/01/2026 (Decreto 141/2026/NĐ-CP, modifica il 68/2026).
  // Da validare con un đại lý thuế; override rapido via TAX_FREE_THRESHOLD.
  taxFree: Number(process.env.TAX_FREE_THRESHOLD || 1_000_000_000),
  // Da questa soglia: obbligo e-invoice da registratore di cassa (Decreto 70/2025).
  eInvoice: Number(process.env.EINVOICE_THRESHOLD || 1_000_000_000),
};

// Categorie di attività con aliquote presuntive (VAT% + PIT% sui ricavi)
// secondo l'allegato della Circolare 40/2021/TT-BTC.
export const CATEGORIES = {
  distribution: {
    vi: "Phân phối, cung cấp hàng hoá",
    en: "Distribution & supply of goods",
    vat: 0.01, pit: 0.005,
    examples_vi: "tạp hoá, bán lẻ, chợ",
    examples_en: "grocery, retail, market stall",
  },
  services_goods: {
    vi: "Dịch vụ có gắn với hàng hoá, ăn uống, sản xuất, vận tải",
    en: "Services bundled with goods, F&B, production, transport",
    vat: 0.03, pit: 0.015,
    examples_vi: "quán ăn, cà phê, sửa xe, may đo",
    examples_en: "food stall, café, repair shop, tailoring",
  },
  services: {
    vi: "Dịch vụ thuần tuý, xây dựng không bao thầu NVL",
    en: "Pure services, construction without materials",
    vat: 0.05, pit: 0.02,
    examples_vi: "cắt tóc, giặt ủi, cho thuê, tư vấn",
    examples_en: "hair salon, laundry, rentals, consulting",
  },
};

// "2026-04-01" è una DATA DI CALENDARIO, non un istante: non ha fuso orario.
// `new Date("2026-04-01").getMonth()` la interpreta come mezzanotte UTC e poi
// la rilegge nel fuso del processo — a ovest di Greenwich diventa il 31 marzo,
// cioè il trimestre PRECEDENTE, e il 1° gennaio scivola nell'ANNO precedente.
// Su un prodotto che compila la 01/CNKD è una dichiarazione sbagliata, quindi
// i campi si leggono dalla stringa e basta.
const ymd = (v) => {
  if (v instanceof Date) return todayVN(v);            // un istante → giorno vietnamita
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return m ? m[0] : null;
};
export const partsOf = (v) => {
  const d = ymd(v);
  return d ? { year: +d.slice(0, 4), month: +d.slice(5, 7), day: +d.slice(8, 10) } : null;
};

// Trimestre corrente da una data (Date = adesso, oppure "YYYY-MM-DD").
export function quarterOf(date = new Date()) {
  const p = partsOf(date) || partsOf(new Date());
  const q = Math.floor((p.month - 1) / 3) + 1;
  return { q, year: p.year, label: `Q${q}/${p.year}` };
}

// Aggregati di un elenco voci {type:'thu'|'chi', amount, date}.
export function totals(entries, { year, q } = {}) {
  let revenue = 0, expenses = 0;
  for (const e of entries) {
    const p = partsOf(e.date);
    if (!p) continue;
    if (year && p.year !== year) continue;
    if (q && Math.floor((p.month - 1) / 3) + 1 !== q) continue;
    if (e.type === "thu") revenue += e.amount;
    else expenses += e.amount;
  }
  return { revenue, expenses, net: revenue - expenses };
}

// Proiezione annua dai ricavi year-to-date.
export function projectAnnual(revenueYTD, now = new Date()) {
  const today = ymd(now);
  const start = Date.UTC(+today.slice(0, 4), 0, 1);
  const daysElapsed = Math.max(1, Math.round((Date.parse(today + "T00:00:00Z") - start) / 86400000) + 1);
  return Math.round((revenueYTD / daysElapsed) * 365);
}

// Stima imposte trimestrali per categoria (regime dichiarativo 2026).
// Se la proiezione annua resta sotto la soglia tax-free → 0 dovuto (esente),
// ma la dichiarazione va comunque presentata.
export function quarterlyTax(revenueQuarter, categoryKey, annualProjection) {
  const cat = CATEGORIES[categoryKey] || CATEGORIES.services_goods;
  const exempt = annualProjection < THRESHOLDS.taxFree;
  const vat = exempt ? 0 : Math.round(revenueQuarter * cat.vat);
  const pit = exempt ? 0 : Math.round(revenueQuarter * cat.pit);
  return { vat, pit, total: vat + pit, exempt, rates: { vat: cat.vat, pit: cat.pit } };
}

// Stato soglie per la dashboard ("ti stai avvicinando a…").
export function thresholdStatus(annualProjection) {
  return {
    projection: annualProjection,
    taxFree: {
      limit: THRESHOLDS.taxFree,
      pct: Math.min(1, annualProjection / THRESHOLDS.taxFree),
      crossed: annualProjection >= THRESHOLDS.taxFree,
    },
    eInvoice: {
      limit: THRESHOLDS.eInvoice,
      pct: Math.min(1, annualProjection / THRESHOLDS.eInvoice),
      crossed: annualProjection >= THRESHOLDS.eInvoice,
    },
  };
}

// Scadenze dichiarative trimestrali (ultimo giorno del mese successivo al trimestre).
export function nextDeadline(now = new Date()) {
  const { q, year } = quarterOf(now);
  const deadline = new Date(Date.UTC(year, q * 3 + 1, 0)); // ultimo giorno del mese successivo al trimestre
  return { quarter: `Q${q}/${year}`, deadline: deadline.toISOString().slice(0, 10) };
}
