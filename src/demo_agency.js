// ============================================================================
//  Sổ Sạch — bảng đại lý thuế (bản trình diễn) + hồ sơ tín dụng danh mục.
//
//  Perché esiste: il canale đại lý thuế È il modello di distribuzione (un
//  agente porta decine di hộ, 30% rev-share) e l'exit è "i libri aggregati di
//  5,2M microimprese = il funnel del credito PMI". Entrambe le cose erano
//  invisibili nel prodotto: la dashboard agente si popola solo con clienti veri.
//  Qui generiamo un'agenzia dimostrativa e — punto chiave — calcoliamo tasse e
//  punteggi con i MOTORI VERI (tax.js, score.js), non con numeri inventati:
//  se un investitore verifica i conti, tornano.
//
//  Deterministico (PRNG seminato): la stessa giornata mostra sempre gli stessi
//  numeri, così una demo non cambia sotto gli occhi di chi guarda.
// ============================================================================
import { totals, projectAnnual, quarterlyTax, quarterOf, CATEGORIES } from "./tax.js";
import { sosachScore } from "./score.js";

// LCG deterministico — Math.random() renderebbe la demo instabile a ogni reload.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 12 hộ kinh doanh plausibili di un đại lý thuế a TP.HCM. `discipline` guida
// quanto bene tengono il libro → produce una distribuzione di punteggi realistica
// (qualche A, molti B/C, un D) invece di una fila di 100 che nessuno crede.
const CLIENTS = [
  { name: "Quán Bún Bò Cô Hai",      cat: "services_goods", daily: [900_000, 2_400_000], discipline: 0.95, margin: 0.42 },
  { name: "Tạp hoá Chị Lan",         cat: "distribution",   daily: [1_200_000, 3_100_000], discipline: 0.90, margin: 0.18 },
  { name: "Cà phê Sáu Râu",          cat: "services_goods", daily: [600_000, 1_800_000], discipline: 0.86, margin: 0.38 },
  { name: "Tiệm tóc Hương",          cat: "services",       daily: [400_000, 1_100_000], discipline: 0.80, margin: 0.55 },
  { name: "Sửa xe Tư Bền",           cat: "services_goods", daily: [500_000, 1_600_000], discipline: 0.62, margin: 0.40 },
  { name: "Bánh mì Bà Tám",          cat: "services_goods", daily: [350_000, 900_000],   discipline: 0.74, margin: 0.35 },
  { name: "Cơm tấm Út Nhỏ",          cat: "services_goods", daily: [800_000, 2_200_000], discipline: 0.68, margin: 0.30 },
  { name: "Đại lý gạo Minh Tâm",     cat: "distribution",   daily: [2_000_000, 5_500_000], discipline: 0.88, margin: 0.12 },
  { name: "Giặt ủi Sạch Nhanh",      cat: "services",       daily: [300_000, 850_000],   discipline: 0.44, margin: 0.50 },
  { name: "Photocopy Thành Đạt",     cat: "services",       daily: [250_000, 700_000],   discipline: 0.30, margin: 0.22 },
  { name: "Trà sữa Bé Ba",           cat: "services_goods", daily: [700_000, 2_000_000], discipline: 0.60, margin: 0.14 },
  { name: "Hàng rau chợ Bà Chiểu",   cat: "distribution",   daily: [450_000, 1_300_000], discipline: 0.18, margin: 0.06 },
];

const SUPPLIERS = ["Chợ đầu mối Bình Điền", "Đại lý gạo Minh Tâm", "Điện lực TP.HCM",
  "CTY TNHH Thực Phẩm Sài Gòn", "Đại lý gas Thành Tín", "Chợ Bến Thành"];
const BUYERS = ["Khách lẻ", "GrabFood", "ShopeeFood", "Khách đặt tiệc", "Khách quen"];

// Costruisce ~120 giorni di libro per un hộ. `discipline` = probabilità di
// registrare in un dato giorno (chi salta giorni prende meno punti di costanza,
// esattamente come nel motore vero).
function buildEntries(c, seed, now) {
  const r = rng(seed);
  const out = [];
  // Dal 1° gennaio a oggi: projectAnnual() annualizza il fatturato YTD sui
  // giorni trascorsi dell'anno, quindi un libro che parte 120 giorni fa fa
  // sembrare tutti sotto soglia (e la colonna imposte tutta a zero).
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysYTD = Math.floor((now - startOfYear) / 86400000);
  for (let back = daysYTD; back >= 0; back--) {
    const d = new Date(now.getTime() - back * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (d.getDay() === 1) continue;                 // chiuso il lunedì
    if (r() > c.discipline) continue;               // giorno non registrato
    const amt = Math.round((c.daily[0] + r() * (c.daily[1] - c.daily[0])) / 1000) * 1000;
    out.push({
      id: `d${seed}-${back}t`, type: "thu", amount: amt, date: iso,
      counterparty: BUYERS[Math.floor(r() * BUYERS.length)],
      // i libri meno curati hanno descrizioni mancanti → "chứng từ đầy đủ" scende
      description: r() < c.discipline ? "Bán hàng trong ngày" : "",
      source: "web", demo: true,
    });
    if (back % 2 === 0) {
      const spend = Math.round((amt * (1 - c.margin) * (0.8 + r() * 0.5)) / 1000) * 1000;
      out.push({
        id: `d${seed}-${back}c`, type: "chi", amount: spend, date: iso,
        counterparty: SUPPLIERS[Math.floor(r() * SUPPLIERS.length)],
        description: r() < c.discipline ? "Nhập hàng, nguyên liệu" : "",
        source: "web", demo: true,
      });
    }
  }
  return out;
}

let CACHE = null;   // { day, payload } — ricalcola una volta al giorno

export function demoAgency(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  if (CACHE && CACHE.day === day) return CACHE.payload;

  const year = now.getFullYear();
  const { q } = quarterOf(now);

  const clients = CLIENTS.map((c, i) => {
    const entries = buildEntries(c, 7919 + i * 104729, now);
    const book = { profile: { name: c.name, category: c.cat }, entries };
    const tQ = totals(entries, { year, q });
    const tY = totals(entries, { year });
    const projection = projectAnnual(tY.revenue, now);
    const tax = quarterlyTax(tQ.revenue, c.cat, projection);   // motore fiscale vero
    const sc = sosachScore(book, now);                          // motore punteggio vero
    return {
      name: c.name,
      category: c.cat,
      categoryVi: CATEGORIES[c.cat].vi,
      categoryEn: CATEGORIES[c.cat].en,
      entries: entries.length,
      quarterRevenue: tQ.revenue,
      yearRevenue: tY.revenue,
      projection,
      quarterTax: tax.total,
      exempt: tax.exempt,
      score: sc.score,
      grade: sc.grade,
    };
  }).sort((a, z) => z.score - a.score);

  // ---- Hồ sơ tín dụng danh mục — ciò che un istituto di credito comprerebbe.
  const dist = { A: 0, B: 0, C: 0, D: 0 };
  for (const c of clients) dist[c.grade]++;
  const receipts = clients.reduce((s, c) => s + c.entries, 0);
  const tracked = clients.reduce((s, c) => s + c.yearRevenue, 0);
  const taxQuarter = clients.reduce((s, c) => s + c.quarterTax, 0);
  const loanReady = dist.A + dist.B;

  const payload = {
    agency: { name: "Đại lý thuế Minh Khai", code: "DL2048", district: "Quận Bình Thạnh, TP.HCM" },
    quarter: `Q${q}/${year}`,
    portfolio: {
      households: clients.length,
      receipts,                                   // bút toán đã xử lý
      tracked,                                    // doanh thu đang theo dõi (VND)
      taxQuarter,                                 // thuế quý tính sẵn cho cả danh mục
      avgScore: Math.round(clients.reduce((s, c) => s + c.score, 0) / clients.length),
      distribution: dist,
      loanReady,
      loanReadyPct: Math.round((loanReady / clients.length) * 100),
      // Il ricavo dell'agente: 30% rev-share sul piano Cơ bản (69k/mese).
      // Su 12 hộ fa ~248k VND/mese: da solo non muove nessuno, ed è la prima
      // moltiplicazione che farà un investitore. Esponiamo anche il valore a
      // 100 hộ — la scala a cui un đại lý thuế lavora davvero — così il canale
      // si legge per quello che è invece di sembrare un incentivo da spiccioli.
      agentMonthlyVND: Math.round(clients.length * 69_000 * 0.30),
      agentAt100VND: Math.round(100 * 69_000 * 0.30),
    },
    clients,
    demo: true,
  };
  CACHE = { day, payload };
  return payload;
}
