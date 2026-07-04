// ============================================================================
//  Sổ Sạch — estrazione dati da foto di scontrini/fatture.
//  Con ANTHROPIC_API_KEY: visione Claude (structured output).
//  Senza chiave (demo/prototipo): estrattore locale deterministico, così il
//  prodotto è dimostrabile end-to-end anche prima di collegare la chiave.
// ============================================================================
import { createHash } from "node:crypto";

const API_KEY = process.env.ANTHROPIC_API_KEY || null;
const MODEL = process.env.EXTRACT_MODEL || "claude-haiku-4-5-20251001";

const SCHEMA_PROMPT = `Bạn là trợ lý kế toán cho hộ kinh doanh Việt Nam. Nhìn ảnh hoá đơn/biên lai và trả về JSON DUY NHẤT theo mẫu:
{"type":"thu"|"chi","amount":<số tiền VND, số nguyên>,"date":"YYYY-MM-DD","counterparty":"<tên cửa hàng/khách>","description":"<mô tả ngắn>","confidence":<0-1>}
"thu" = tiền vào (bán hàng), "chi" = tiền ra (mua nguyên liệu, chi phí). Nếu không chắc ngày, dùng hôm nay. Chỉ JSON, không giải thích.`;

// ---- Claude vision ---------------------------------------------------------
async function extractWithClaude(imageBase64, mediaType) {
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
          { type: "text", text: SCHEMA_PROMPT },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON in model output");
  return { ...JSON.parse(m[0]), engine: "claude" };
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
    date: new Date().toISOString().slice(0, 10),
    counterparty: pick[0],
    description: pick[3],
    confidence: 0.5,
    engine: "demo",
  };
}

// ---- API principale ----------------------------------------------------------
export async function extractReceipt(imageBase64, mediaType = "image/jpeg") {
  if (API_KEY) {
    try {
      return await extractWithClaude(imageBase64, mediaType);
    } catch (e) {
      console.error("extract: claude failed, falling back to demo:", e.message);
    }
  }
  return extractDemo(imageBase64);
}

export const extractionMode = () => (API_KEY ? "claude" : "demo");
