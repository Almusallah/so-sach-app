// ============================================================================
//  Sổ Sạch — estrazione dati da foto di scontrini/fatture.
//  Con ANTHROPIC_API_KEY: visione Claude (structured output).
//  Senza chiave (demo/prototipo): estrattore locale deterministico, così il
//  prodotto è dimostrabile end-to-end anche prima di collegare la chiave.
// ============================================================================
import { createHash } from "node:crypto";
import { todayVN, normalizeReceiptDate } from "./vndate.js";

const API_KEY = process.env.ANTHROPIC_API_KEY || null;
const MODEL = process.env.EXTRACT_MODEL || "claude-haiku-4-5-20251001";

// Il prompt riceve la data di OGGI: senza, il modello non ha modo di capire
// che una data futura è impossibile, e su uno scontrino vietnamita stampato
// "10/08/2026" (10 agosto, DD/MM) torna volentieri come 8 ottobre.
const schemaPrompt = (today) => `Bạn là trợ lý kế toán cho hộ kinh doanh Việt Nam. Nhìn ảnh hoá đơn/biên lai và trả về JSON DUY NHẤT theo mẫu:
{"type":"thu"|"chi","amount":<số tiền VND, số nguyên>,"date":"YYYY-MM-DD","counterparty":"<tên cửa hàng/khách>","description":"<mô tả ngắn>","confidence":<0-1>}
"thu" = tiền vào (bán hàng), "chi" = tiền ra (mua nguyên liệu, chi phí).
NGÀY: hoá đơn Việt Nam in theo thứ tự NGÀY/THÁNG/NĂM (ví dụ 10/08/2026 = ngày 10 tháng 8). Hôm nay là ${today}; ngày trên hoá đơn KHÔNG BAO GIỜ ở tương lai. Nếu không đọc được ngày, dùng ${today}.
SỐ TIỀN: lấy TỔNG CỘNG phải trả, chỉ chữ số, không dấu chấm.
Chỉ JSON, không giải thích.`;

// ---- Claude vision ---------------------------------------------------------
async function extractWithClaude(imageBase64, mediaType) {
  const today = todayVN();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: schemaPrompt(today) },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON in model output");
  return validate(JSON.parse(m[0]), today);
}

// Quello che torna dal modello NON è ancora una scrittura contabile: finché
// non è validato è testo. Un importo assurdo o un tipo mancante devono far
// FALLIRE l'estrazione — il bot chiede di rifare la foto — non entrare nel
// libro come se fosse un dato letto davvero.
const MAX_VND = 100_000_000_000; // 100 tỷ: nessuno scontrino di un hộ kinh doanh
// In Việt Nam un totale sotto i 1.000đ non esiste. Serve da rete: se il
// parsing sbaglia di 1000× (vedi sotto) il numero cade qui e l'estrazione
// fallisce, invece di entrare nel libro come voce buona.
const MIN_VND = 1_000;

// Il punto più pericoloso del file. In Việt Nam il separatore delle MIGLIAIA
// è il PUNTO: "30.000" sono trentamila đồng. `Number("30.000")` fa 30 — cioè
// un errore di mille volte, scritto nel libro con la stessa faccia di un dato
// letto bene. E i centesimi di đồng non esistono, quindi un eventuale gruppo
// decimale finale (1-2 cifre) si scarta invece di interpretarlo.
export function parseVndAmount(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : NaN;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  const dec = /[.,](\d{1,2})$/.exec(s);
  if (dec) s = s.slice(0, -dec[0].length);
  s = s.replace(/[.,]/g, "");
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
}

export function validate(raw, today = todayVN()) {
  const type = raw?.type === "thu" || raw?.type === "chi" ? raw.type : null;
  if (!type) throw new Error(`bad type: ${JSON.stringify(raw?.type)}`);

  const amount = parseVndAmount(raw?.amount);
  if (!Number.isFinite(amount) || amount < MIN_VND || amount >= MAX_VND) {
    throw new Error(`bad amount: ${JSON.stringify(raw?.amount)}`);
  }

  const { date, dateNote } = normalizeReceiptDate(raw?.date, today);
  const conf = Number(raw?.confidence);

  return {
    type, amount, date, dateNote,
    counterparty: String(raw?.counterparty || "").trim().slice(0, 120),
    description: String(raw?.description || "").trim().slice(0, 200),
    confidence: Number.isFinite(conf) ? Math.min(1, Math.max(0, conf)) : 0.6,
    engine: "claude",
  };
}

// ---- Estrattore demo deterministico -----------------------------------------
// Genera una voce plausibile e STABILE per la stessa immagine (hash-based),
// marcata come demo così l'utente sa che deve confermare/correggere.
const DEMO_VENDORS = [
  ["Chợ Bến Thành - sạp rau", "chi", [80_000, 450_000], "Mua rau củ"],
  ["Đại lý gạo Minh Tâm", "chi", [300_000, 1_200_000], "Mua gạo, nguyên liệu"],
  ["Khách lẻ", "thu", [45_000, 350_000], "Bán hàng trong ngày"],
  ["CTY TNHH Thực Phẩm Sài Gòn", "chi", [500_000, 2_500_000], "Nhập hàng"],
  ["Khách đặt tiệc", "thu", [800_000, 3_500_000], "Đơn đặt món"],
  ["Điện lực TP.HCM", "chi", [250_000, 900_000], "Tiền điện"],
];

function extractDemo(imageBase64) {
  const h = createHash("sha256").update(imageBase64.slice(0, 4096)).digest();
  const pick = DEMO_VENDORS[h[0] % DEMO_VENDORS.length];
  const [lo, hi] = pick[2];
  const amount = Math.round((lo + (h.readUInt16BE(1) / 65535) * (hi - lo)) / 1000) * 1000;
  return {
    type: pick[1],
    amount,
    date: todayVN(),
    counterparty: pick[0],
    description: pick[3],
    confidence: 0.5,
    engine: "demo",
  };
}

// ---- API principale ----------------------------------------------------------
export async function extractReceipt(imageBase64, mediaType = "image/jpeg") {
  // ⚠️ NIENTE fallback demo quando la chiave c'è. Il demo inventa un fornitore
  // plausibile ("Chợ Bến Thành - sạp rau") con un importo plausibile: se
  // sostituisse un'estrazione fallita, l'utente riceverebbe una voce FALSA
  // scritta con la stessa sicurezza di una vera, e la scoprirebbe solo alla
  // dichiarazione. Meglio un errore onesto: chi chiama gestisce l'eccezione
  // e chiede di rifare la foto.
  if (API_KEY) return extractWithClaude(imageBase64, mediaType);
  return extractDemo(imageBase64);
}

export const extractionMode = () => (API_KEY ? "claude" : "demo");
