// ============================================================================
//  Sổ Sạch — i comandi del bot, dichiarati UNA volta.
//
//  Perché un file solo per questo: il testo di aiuto prometteva «"sổ" để xem
//  tổng kết THÁNG» mentre il comando restituiva l'ANNO, ed è finito in ogni
//  singola risposta che il bot abbia mai inviato. Router e menu scritti in due
//  posti diversi divergono sempre. Qui la lista è il router E il menu: se un
//  comando cambia, il testo cambia con lui.
// ============================================================================
import { parseAmount } from "./amount.js";

// I vietnamiti scrivono spessissimo senza segni diacritici (tastiera, fretta,
// telefono di qualcun altro): "sổ", "so", "SỔ" e "sô" devono valere uguale.
export function normalize(s) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

export const COMMANDS = [
  {
    key: "photo", pattern: true, icon: "📸",
    label_vi: "Gửi ảnh hoá đơn",
    desc_vi: "mình đọc và ghi vào sổ giúp bạn",
  },
  {
    key: "paper", pattern: true, icon: "📝",
    label_vi: "Chụp tờ giấy ghi tay cuối ngày",
    desc_vi: "cũng gửi vào đây được",
  },
  {
    key: "money", pattern: true, icon: "⌨️",
    label_vi: 'Gõ nhanh: "thu 2tr4" · "chi 500k"',
    desc_vi: "thu = tiền bán, chi = tiền mua",
  },
  // `pattern` E `match` insieme: stanno nella sezione GHI SỔ del menu (sono
  // azioni sul libro, non consultazioni) ma restano instradabili come parola
  // esatta. "sửa" è PROMESSO in ogni conferma di registrazione da mesi: un
  // comando promesso e non instradato è il bug che questo file esiste per
  // impedire. Le forme sono POST-normalize (niente diacritici, đ→d).
  {
    key: "fix", pattern: true, match: ["sua", "xoa", "sua lai"], icon: "✏️",
    label_vi: 'Gõ "sửa"',
    desc_vi: "xoá bút toán vừa ghi nếu sai, rồi gửi lại",
  },
  {
    key: "khai", pattern: true, match: ["khai"], icon: "📥",
    label_vi: 'Gõ "khai"',
    desc_vi: "mới dùng giữa năm? khai thu chi các quý trước",
  },
  {
    key: "quarter", match: ["quy", "quy nay", "thue"], icon: "📊",
    label_vi: 'Gõ "quý"',
    desc_vi: "thu chi quý này, thuế tạm tính và hạn nộp tờ khai",
  },
  {
    key: "year", match: ["so", "so sach", "tong ket"], icon: "📒",
    label_vi: 'Gõ "sổ"',
    desc_vi: "tổng kết cả năm và khoảng cách tới ngưỡng 1 tỷ",
  },
  {
    key: "menu", match: ["menu", "giup", "help", "?", "huong dan", "lam gi"], icon: "📋",
    label_vi: 'Gõ "menu"',
    desc_vi: "xem lại bảng này bất cứ lúc nào",
  },
];

// Comando esatto digitato dall'utente, o null.
export function matchCommand(raw) {
  const n = normalize(raw);
  if (!n) return null;
  for (const c of COMMANDS) {
    if (c.match && c.match.includes(n)) return c.key;
  }
  return null;
}

// "khai" con argomenti NON può passare da matchCommand (che confronta parole
// esatte): serve un parser. Vive qui e non in server.js perché è testabile da
// solo, e perché in server.js DEVE girare PRIMA di parseMoneyCommand — "khai
// quý 1 thu 360tr" contiene cifre e il parser dei soldi se lo mangerebbe.
// Torna:
//   null                             non è un comando khai
//   { help: true }                   "khai" nudo o sintassi illeggibile →
//                                    meglio rispiegare che indovinare un importo
//   { q, revenue, expenses, hasChi } pronto per applyOpening; lo 0 è AMMESSO
//                                    (nella semantica delle aperture 0 = cancella,
//                                    per questo non basta parseAmount, che rifiuta 0)
export function parseKhaiCommand(raw) {
  const n = normalize(raw).replace(/\s+/g, " ");
  if (n !== "khai" && !n.startsWith("khai ")) return null;
  if (n === "khai") return { help: true };
  const m = /^khai quy ?(\d+) thu (.+?)(?: chi (.+))?$/.exec(n);
  if (!m) return { help: true };
  // dopo normalize "0đ" è "0d": lo 0 esplicito si riconosce prima di parseAmount
  const amt = (s) => (/^0+ ?(d|vnd)?$/.test(s) ? 0 : parseAmount(s));
  const q = Number(m[1]);
  const revenue = amt(m[2]);
  const hasChi = m[3] !== undefined;
  const expenses = hasChi ? amt(m[3]) : 0;
  if (revenue === null || expenses === null) return { help: true };
  return { q, revenue, expenses, hasChi };
}

export function menuText({ linked = false } = {}) {
  const line = (c) => `${c.icon} ${c.label_vi} — ${c.desc_vi}`;
  const doing = COMMANDS.filter((c) => c.pattern).map(line).join("\n");
  const asking = COMMANDS.filter((c) => !c.pattern).map(line).join("\n");
  return (
    "📋 Sổ Sạch làm được gì\n\n" +
    "GHI SỔ\n" + doing + "\n\n" +
    "XEM LẠI\n" + asking +
    (linked ? "" :
      "\n\n💡 Bạn có tài khoản trên web? Vào Tài khoản → \"Lấy mã kết nối Zalo\", " +
      "rồi gửi mã 6 ký tự vào đây để gộp sổ và cho đại lý thuế xem giúp.")
  );
}

// ⚠️ NON più inviato dal codice. Il benvenuto vive nell'OA Manager
// (Thiết lập tương tác → Tin nhắn chào mừng), dove arriva come scheda ricca e
// non dipende dal nostro webhook. Questo testo resta come SORGENTE di quella
// configurazione: se si riscrive il messaggio su Zalo, si riscrive qui, così
// fra sei mesi si sa ancora cosa dice il primo messaggio che riceve un hộ.
export function welcomeText() {
  return (
    "Chào bạn 👋 Mình là Sổ Sạch — trợ lý ghi sổ cho hộ kinh doanh.\n\n" +
    "Từ đầu năm 2026 hộ kinh doanh phải tự ghi sổ và tự khai thuế. " +
    "Mình lo phần sổ sách giúp bạn, bằng tiếng Việt dễ hiểu, không cần biết kế toán.\n\n" +
    "Bắt đầu đơn giản lắm: chụp một tờ hoá đơn bất kỳ rồi gửi vào đây."
  );
}
