// ============================================================================
//  Sổ Sạch — lettura degli importi scritti a mano in chat.
//
//  Serve perché il bot PROMETTEVA già "hoặc gõ số tiền để mình ghi tay" in due
//  messaggi diversi e poi non gestiva niente: chi ci provava riceveva il saluto
//  generico. Ed è la via principale per il FATTURATO di un quán: nessuno
//  fotografa 200 caffè, ma tutti sanno scrivere il totale di fine giornata.
//
//  I vietnamiti scrivono i soldi in molti modi e vanno accettati tutti:
//    2.400.000  2,400,000  2400000     ← punto/virgola = separatore migliaia
//    2tr4   2 triệu 4   2tr   2.4tr    ← triệu = milione; le cifre dopo "tr"
//                                        sono centinaia di migliaia (2tr4 = 2,4M)
//    500k   500 nghìn   500 ngàn       ← k = mille
//
//  ⚠️ Un numero NUDO non viene indovinato. Per un quán "2tr" è quasi sempre
//  incasso, ma "quasi sempre" scritto in un registro fiscale è una voce
//  sbagliata con l'aria di essere giusta — lo stesso guasto del media_type,
//  dove l'estrazione ripiegava su demo invece di fallire. Meglio una domanda.
// ============================================================================

const THU = /^(thu|ban|bán|doanh thu|dt)\b/i;
const CHI = /^(chi|mua|chi phi|chi phí|cp)\b/i;

// "2tr4" → 2.400.000 : le cifre dopo l'unità si leggono come frazione di
// milione (4 → 400, 45 → 450), quindi si allineano a destra su 3 posizioni.
function millionsWithTail(whole, tail) {
  const base = Number(whole.replace(",", ".")) * 1_000_000;
  if (!tail) return Math.round(base);
  return Math.round(base + Number(tail.padEnd(3, "0")) * 1_000);
}

export function parseAmount(input) {
  const s = String(input || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!s) return null;

  // 2tr4 / 2 triệu 4 / 2.4tr / 2tr
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu|củ|cu)\s*(\d{1,3})?$/);
  if (m) {
    const v = millionsWithTail(m[1], m[2]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // 500k / 500 nghìn / 500 ngàn
  const k = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|nghin|ngàn|ngan)$/);
  if (k) {
    const v = Math.round(Number(k[1].replace(",", ".")) * 1_000);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // 2.400.000 / 2,400,000 / 2400000 — separatori via, deve restare solo cifre
  const plain = s.replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(plain)) return null;
  const v = Number(plain);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// Ritorna:
//   {type, amount}          comando completo → si registra
//   {amount, needsType:true} solo cifre → si chiede thu o chi
//   null                     non è un importo
export function parseMoneyCommand(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const isThu = THU.test(s);
  const isChi = CHI.test(s);
  if (isThu || isChi) {
    const rest = s.replace(isThu ? THU : CHI, "").trim();
    const amount = parseAmount(rest);
    return amount ? { type: isThu ? "thu" : "chi", amount } : null;
  }

  const amount = parseAmount(s);
  return amount ? { amount, needsType: true } : null;
}
