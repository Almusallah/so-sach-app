// ============================================================================
//  Sổ Sạch — sổ mẫu ("Bún Bò Cô Hai").
//  Un libro realistico di ~4 mesi per demo a utenti/investitori: si carica con
//  un tap nella sandbox anonima, si rimuove con un tap (voci flaggate sample).
// ============================================================================

const THU = [
  ["Khách lẻ", "Bán hàng trong ngày"],
  ["Khách lẻ", "Bán mang về + tại quán"],
  ["Khách đặt tiệc", "Đơn đặt 20 tô + nước"],
  ["GrabFood", "Đơn app trong ngày"],
  ["ShopeeFood", "Đơn app trong ngày"],
];
const CHI = [
  ["Chợ Bến Thành - sạp thịt", "Mua thịt bò, giò heo", 900_000, 2_200_000],
  ["Chợ Bến Thành - sạp rau", "Rau sống, hành, sả", 200_000, 550_000],
  ["Đại lý gạo Minh Tâm", "Bún tươi, gạo", 500_000, 1_300_000],
  ["Đại lý gas Thành Tín", "Bình gas 12kg", 380_000, 460_000],
  ["Điện lực TP.HCM", "Tiền điện tháng", 600_000, 1_100_000],
  ["CTY nước mắm Phú Quốc", "Gia vị, nước mắm", 250_000, 700_000],
];

const rnd = (lo, hi) => Math.round((lo + Math.random() * (hi - lo)) / 1000) * 1000;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Genera ~4 mesi di voci (thu ~6 giorni/settimana, chi ~1 giorno su 3).
export function sampleEntries(now = new Date()) {
  const out = [];
  for (let back = 120; back >= 0; back--) {
    const d = new Date(now.getTime() - back * 86400000);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    if (dow !== 1) { // chiuso il lunedì — le pause rendono il libro credibile
      const [who, desc] = pick(THU);
      // ~1 voce su 4 senza descrizione: com'è un libro vero → score < 100 e
      // il consiglio "compila la descrizione" resta visibile nella demo.
      out.push(mk("thu", rnd(700_000, 2_600_000), iso, who, Math.random() < 0.25 ? "" : desc, back));
      if (dow === 6 || dow === 0) // weekend: seconda voce di vendita
        out.push(mk("thu", rnd(400_000, 1_500_000), iso, "Khách lẻ", "Bán thêm buổi tối", back));
    }
    if (back % 2 === 0) { // spesa un giorno sì e uno no: margine F&B realistico
      const [who, desc, lo, hi] = pick(CHI);
      out.push(mk("chi", rnd(lo, hi), iso, who, desc, back));
    }
  }
  return out;
}

function mk(type, amount, date, counterparty, description, salt) {
  return {
    id: "s" + Date.now().toString(36) + salt + Math.random().toString(36).slice(2, 5),
    type, amount, date, counterparty, description,
    source: "web", sample: true, createdAt: new Date().toISOString(),
  };
}

export const SAMPLE_PROFILE = { name: "Bún Bò Cô Hai (sổ mẫu)", category: "services_goods" };
