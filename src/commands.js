// ============================================================================
//  Sổ Sạch — i comandi del bot, dichiarati UNA volta.
//
//  Perché un file solo per questo: il testo di aiuto prometteva «"sổ" để xem
//  tổng kết THÁNG» mentre il comando restituiva l'ANNO, ed è finito in ogni
//  singola risposta che il bot abbia mai inviato. Router e menu scritti in due
//  posti diversi divergono sempre. Qui la lista è il router E il menu: se un
//  comando cambia, il testo cambia con lui.
// ============================================================================

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
