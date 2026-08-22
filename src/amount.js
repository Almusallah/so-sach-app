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
//    2 chai   2 củ                     ← gergo: chai (Sud) e củ (Nord) = triệu
//    2 lít                             ← gergo: lít = trăm nghìn (100.000đ)
//
//  GERGO — verificato il 22/08/2026 (fptshop.com.vn/tin-tuc/danh-gia/1-lit-la-
//  bao-nhieu-tien-167587 e thuthuatphanmem.vn/1-xi-1-chai-1-lit-1-ve-la-bao-
//  nhieu-tien): "chai" = 1 triệu e "lít" = 100 nghìn sono coerenti in tutte le
//  fonti. "xị" invece NO: le fonti lo danno a 10 nghìn ma segnalano che la
//  conversione cambia da zona a zona (altrove vale 100 nghìn). In un registro
//  fiscale un importo ambiguo non si indovina MAI: "xị" viene riconosciuto ma
//  torna { needsAmount, ambiguousUnit } — il bot fa una domanda esplicita
//  invece di registrare a caso.
//
//  ⚠️ chai/củ/lít sono anche NOMI DI CONTENITORI: "chi 2 chai nước" sono due
//  bottiglie d'acqua, non 2 triệu. Il gergo si accetta quindi SOLO quando
//  chiude la frase (al più seguito da hôm qua/hôm kia): se dopo l'unità c'è
//  altro testo, meglio la domanda mirata di una voce da 2 triệu inventata.
//
//  Dal 22/08 il comando accetta anche una coda libera → descrizione della voce
//  ("thu 2tr4 cà phê") e le parole-data hôm qua / hôm kia (ieri / l'altro
//  ieri, aritmetica su todayVN — mai sul fuso del server).
//
//  ⚠️ Un numero NUDO non viene indovinato. Per un quán "2tr" è quasi sempre
//  incasso, ma "quasi sempre" scritto in un registro fiscale è una voce
//  sbagliata con l'aria di essere giusta — lo stesso guasto del media_type,
//  dove l'estrazione ripiegava su demo invece di fallire. Meglio una domanda.
// ============================================================================
import { todayVN, addDaysVN } from "./vndate.js";

// (?=\s|$) e NON \b: il \b di JS è ASCII-only, quindi /^chi\b/ aggancerebbe
// "chiều nay…" ("ề" non è word-char) e il bot risponderebbe «vuoi ghi CHI?»
// a una frase di conversazione.
const THU = /^(thu|ban|bán|doanh thu|dt)(?=\s|$)/i;
const CHI = /^(chi|mua|chi phi|chi phí|cp)(?=\s|$)/i;

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

  // 2tr4 / 2 triệu 4 / 2.4tr / 2tr / 2 chai — chai e củ valgono triệu (gergo
  // verificato, vedi intestazione). "xị" NON sta qui: è ambiguo per regione e
  // non deve mai produrre un importo.
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu|củ|cu|chai)\s*(\d{1,3})?$/);
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

  // 2 lít = 200.000 — lít = trăm nghìn, coerente in tutte le fonti (gergo
  // verificato, vedi intestazione).
  const l = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:lít|lit)$/);
  if (l) {
    const v = Math.round(Number(l[1].replace(",", ".")) * 100_000);
    return Number.isFinite(v) && v > 0 ? v : null;
  }

  // 2.400.000 / 2,400,000 / 2400000 — separatori via, deve restare solo cifre
  const plain = s.replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(plain)) return null;
  const v = Number(plain);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// Parole-data nel comando: hôm qua = ieri, hôm kia = l'altro ieri (VIETNAMITI,
// via todayVN + addDaysVN — mai il fuso del server). Si estraggono PRIMA di
// leggere l'importo, ovunque stiano nella frase ("thu hôm qua 2tr" vale
// quanto "thu 2tr hôm qua").
const DATE_WORD = /(^|\s)(hôm qua|hom qua|hôm kia|hom kia)(?=\s|$)/i;

function extractDateWord(s, today) {
  const m = DATE_WORD.exec(s);
  if (!m) return { rest: s, date: null };
  const w = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const delta = w === "hom kia" ? -2 : -1;
  const rest = (s.slice(0, m.index) + " " + s.slice(m.index + m[0].length))
    .replace(/\s+/g, " ").trim();
  return { rest, date: addDaysVN(today, delta) };
}

// L'unità di gergo-contenitore in coda alla frase-importo: se dopo c'è ancora
// testo, la lettura "soldi" non è più affidabile (vedi intestazione).
const CONTAINER_UNIT = /(?:chai|củ|cu|lít|lit)\s*\d{0,3}$/i;
// Unità esplicite NON ambigue: con queste una coda-descrizione è sicura.
const SAFE_UNIT = /(?:tr|triệu|trieu|k|nghìn|nghin|ngàn|ngan)\s*\d{0,3}$/i;
// "xị": riconosciuto per NON registrarlo — la conversione cambia per regione.
const XI_AMBIGUOUS = /^\d+(?:[.,]\d+)?\s*(?:xị|xi)(?=\s|$)/i;

// Ritorna:
//   {type, amount, date?, description?}   comando completo → si registra
//   {type, needsAmount, ambiguousUnit?}   prefisso THU/CHI ma importo
//                                         illeggibile/ambiguo → domanda mirata
//   {amount, needsType:true, date?}       solo cifre → si chiede thu o chi
//   null                                  non è un importo
export function parseMoneyCommand(raw, { today = todayVN() } = {}) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const isThu = THU.test(s);
  const isChi = CHI.test(s);
  if (isThu || isChi) {
    const type = isThu ? "thu" : "chi";
    const d = extractDateWord(s.replace(isThu ? THU : CHI, "").trim(), today);
    const rest = d.rest;
    if (!rest) return { type, needsAmount: true };       // prefisso nudo (o solo la data)
    if (XI_AMBIGUOUS.test(rest)) return { type, needsAmount: true, ambiguousUnit: "xị" };

    // 1) tutta la stringa è un importo → nessuna descrizione
    const full = parseAmount(rest);
    if (full) return { type, amount: full, ...(d.date ? { date: d.date } : {}) };

    // 2) il prefisso più LUNGO (a confine di parola) che è un importo; la coda
    //    diventa la descrizione. "2 triệu 4 cà phê": vince "2 triệu 4".
    const tokens = rest.split(/\s+/);
    let bestAmount = null, bestLen = 0;
    for (let n = 1; n < tokens.length; n++) {
      const a = parseAmount(tokens.slice(0, n).join(" "));
      if (a) { bestAmount = a; bestLen = n; }
    }
    if (bestAmount) {
      const amountStr = tokens.slice(0, bestLen).join(" ");
      // gergo-contenitore + coda = probabile merce ("2 chai bia") → domanda
      if (CONTAINER_UNIT.test(amountStr)) return { type, needsAmount: true };
      // con una coda, un numero nudo minuscolo non è credibile come importo
      // ("thu 25 khách" NON è thu 25đ): serve un'unità o cifre ≥ 1000.
      if (!SAFE_UNIT.test(amountStr) && bestAmount < 1000) return { type, needsAmount: true };
      const description = tokens.slice(bestLen).join(" ")
        .replace(/^[\s,.;:!–—-]+|[\s,.;:!–—-]+$/g, "").slice(0, 200);
      return {
        type, amount: bestAmount,
        ...(d.date ? { date: d.date } : {}),
        ...(description ? { description } : {}),
      };
    }
    // 3) prefisso riconosciuto, importo no → il chiamante fa la domanda
    //    mirata invece del muro-menu.
    return { type, needsAmount: true };
  }

  // Numero NUDO (al più con la parola-data): si chiede thu o chi, MAI si
  // indovina. Con una coda libera non è un importo — passa oltre nel router.
  const d = extractDateWord(s, today);
  const amount = parseAmount(d.rest);
  return amount ? { amount, needsType: true, ...(d.date ? { date: d.date } : {}) } : null;
}
