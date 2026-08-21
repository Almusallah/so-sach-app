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

// Ogni comando porta anche gli alias INGLESI nella stessa lista `match`: un
// utente che ha messo il bot in inglese digita "quarter" o "undo" e deve
// arrivare allo stesso ramo. Eccezione voluta: "khai" resta SOLO vietnamita —
// è terminologia fiscale (tự khai) e tradurla creerebbe un comando che
// l'ufficio delle imposte non riconosce.
export const COMMANDS = [
  {
    key: "photo", pattern: true, icon: "📸",
    label_vi: "Gửi ảnh hoá đơn",
    desc_vi: "mình đọc và ghi vào sổ giúp bạn",
    label_en: "Send a receipt photo",
    desc_en: "I read it and write it into your book",
  },
  {
    key: "paper", pattern: true, icon: "📝",
    label_vi: "Chụp tờ giấy ghi tay cuối ngày",
    desc_vi: "cũng gửi vào đây được",
    label_en: "Snap your end-of-day handwritten sheet",
    desc_en: "works exactly the same way",
  },
  {
    key: "money", pattern: true, icon: "⌨️",
    label_vi: 'Gõ nhanh: "thu 2tr4" · "chi 500k"',
    desc_vi: "thu = tiền bán, chi = tiền mua",
    label_en: 'Quick type: "thu 2tr4" · "chi 500k"',
    desc_en: "thu = money in, chi = money out",
  },
  // `pattern` E `match` insieme: stanno nella sezione GHI SỔ del menu (sono
  // azioni sul libro, non consultazioni) ma restano instradabili come parola
  // esatta. "sửa" è PROMESSO in ogni conferma di registrazione da mesi: un
  // comando promesso e non instradato è il bug che questo file esiste per
  // impedire. Le forme sono POST-normalize (niente diacritici, đ→d).
  {
    key: "fix", pattern: true, match: ["sua", "xoa", "sua lai", "undo", "delete", "fix"], icon: "✏️",
    label_vi: 'Gõ "sửa"',
    desc_vi: "xoá bút toán vừa ghi nếu sai, rồi gửi lại",
    label_en: 'Type "undo"',
    desc_en: "deletes the last entry if it's wrong, then resend it",
  },
  {
    key: "khai", pattern: true, match: ["khai"], icon: "📥",
    label_vi: 'Gõ "khai"',
    desc_vi: "mới dùng giữa năm? khai thu chi các quý trước",
    label_en: 'Type "khai"',
    desc_en: "started mid-year? declare past quarters (Vietnamese syntax)",
  },
  {
    key: "quarter", match: ["quy", "quy nay", "thue", "quarter", "q3", "tax"], icon: "📊",
    label_vi: 'Gõ "quý"',
    desc_vi: "thu chi quý này, thuế tạm tính và hạn nộp tờ khai",
    label_en: 'Type "quarter"',
    desc_en: "this quarter's totals, provisional tax and the tờ khai deadline",
  },
  {
    key: "year", match: ["so", "so sach", "tong ket", "year", "book", "summary"], icon: "📒",
    label_vi: 'Gõ "sổ"',
    desc_vi: "tổng kết cả năm và khoảng cách tới ngưỡng 1 tỷ",
    label_en: 'Type "year"',
    desc_en: "full-year summary and distance to the 1 tỷ threshold",
  },
  {
    key: "menu", match: ["menu", "giup", "help", "?", "huong dan", "lam gi", "commands", "start"], icon: "📋",
    label_vi: 'Gõ "menu"',
    desc_vi: "xem lại bảng này bất cứ lúc nào",
    label_en: 'Type "menu"',
    desc_en: "see this table again any time",
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

// ---- Fuzzy matching (distanza di edit ≤ 1) ---------------------------------
// «quyy», «menuu», «suaa»: sul telefono, di fretta, la lettera doppia o quella
// accanto capita di continuo — e la risposta era il menu generico, che suona
// come «non ti ho capito». Il fuzzy vale SOLO per le parole-comando: mai per
// importi, mai per codici di collegamento, mai per gli argomenti di "khai".
//
// true se a e b distano al più 1 edit (inserimento/cancellazione/sostituzione).
// Niente matrice di Levenshtein: con soglia 1 basta una scansione, e le
// trasposizioni ("mneu") restano fuori di proposito — distanza 2.
function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) [a, b] = [b, a];      // a è la più corta
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length) { i++; j++; }     // sostituzione
    else { j++; }                                 // inserimento in b
  }
  return edits + (b.length - j) + (a.length - i) <= 1;
}

// Parole-denaro: sono l'INIZIO di un comando importo ("thu 2tr4"), non un
// comando. "thu" nudo dista 1 da "thue" e senza questa lista un utente che ha
// dimenticato l'importo riceverebbe il riepilogo del trimestre.
const MONEY_WORDS = new Set(["thu", "chi", "mua", "ban", "dt", "cp"]);

// Parole vietnamite VERE a distanza di edit ≤ 1 da un comando: "của", "vừa",
// "hoa", "đùa", "hai"… scritte da sole sono conversazione, non un typo — e il
// fuzzy che le scambiasse per un comando CANCELLEREBBE una voce del libro
// ("sửa"/"xoá") o risponderebbe con la sintassi del tự khai ("hai" → khai).
// Forme POST-normalize, verificate una a una contro withinOneEdit. I collisori
// del solo "menu" ("giữ", "mến") non servono qui: il testo sconosciuto riceve
// comunque il menu.
const VN_STOP_WORDS = new Set([
  "qua",                                                    // quà/quá/qua → "quy" (oggi salvato dal pareggio con "sua"; qui per robustezza)
  "cua", "bua", "vua", "dua", "hoa", "toa", "xua", "xoay",  // của/bữa/vừa/dưa·đùa/hoa/toà/xưa/xoay → "sua"/"xoa" (fix: CANCELLA)
  "thua", "the", "tai",                                     // thưa/thua/thế/tài·tai → "thue"/"tax" (quarter)
  "khi", "kha", "hai", "chai",                              // khi/khá/hai·hài/chai → "khai"
  "sao",                                                    // sao → "so" (year)
]);

// Comando riconosciuto a distanza di edit ≤ 1, o null. Guardrail, in ordine:
//   • input < 3 caratteri: troppo corto, un edit cambierebbe metà parola;
//   • qualunque cifra nell'input: potrebbe essere un importo ("13" dista 1 da
//     "q3") — i soldi non si indovinano MAI;
//   • forma da codice di collegamento (6 alfanumerici): il controllo codici
//     gira prima in server.js, e un codice sbagliato di una lettera deve
//     restare un codice sbagliato, non diventare un comando;
//   • parola-denaro nuda ("thu", "chi"…): vedi sopra;
//   • parola vietnamita vera nella stop-list ("của", "hai"…): vedi sopra;
//   • pareggio fra DUE comandi diversi ("soa" dista 1 da "sua", "xoa" E
//     "so"): nessun match — indovinare a metà è peggio che richiedere.
export function matchCommandFuzzy(raw) {
  const n = normalize(raw);
  if (n.length < 3) return null;
  if (/\d/.test(n)) return null;
  if (/^[a-z0-9]{6}$/.test(n)) return null;
  if (MONEY_WORDS.has(n)) return null;
  if (VN_STOP_WORDS.has(n)) return null;
  const keys = new Set();
  for (const c of COMMANDS) {
    if (!c.match) continue;
    if (c.match.some((m) => withinOneEdit(n, m))) keys.add(c.key);
  }
  return keys.size === 1 ? [...keys][0] : null;
}

// ---- Cambio lingua ----------------------------------------------------------
// ESATTO dopo normalize, MAI fuzzy: cambiare lingua per un typo sarebbe il
// peggior falso positivo possibile (l'utente non capirebbe più le risposte).
// normalize toglie i diacritici, quindi "tiếng việt" e "tieng viet" collassano.
export function matchLangCommand(raw) {
  const n = normalize(raw).replace(/\s+/g, " ");
  if (n === "english") return "en";
  if (n === "tieng viet") return "vi";
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

// Il menu nella lingua del profilo. I comandi vietnamiti restano validi anche
// in inglese (e viceversa): la lingua cambia le ETICHETTE, mai il router.
export function menuText({ linked = false, lang = "vi" } = {}) {
  const en = lang === "en";
  const line = (c) => en
    ? `${c.icon} ${c.label_en} — ${c.desc_en}`
    : `${c.icon} ${c.label_vi} — ${c.desc_vi}`;
  const doing = COMMANDS.filter((c) => c.pattern).map(line).join("\n");
  const asking = COMMANDS.filter((c) => !c.pattern).map(line).join("\n");
  if (en) {
    return (
      "📋 What Sổ Sạch can do\n\n" +
      "RECORD\n" + doing + "\n\n" +
      "REVIEW\n" + asking +
      "\n\n🌐 Gõ \"tiếng việt\" để dùng tiếng Việt." +
      (linked ? "" :
        "\n\n💡 Have a web account? Go to Tài khoản → \"Lấy mã kết nối Zalo\", " +
        "then send the 6-character code here to merge your books and share them with your đại lý thuế.")
    );
  }
  return (
    "📋 Sổ Sạch làm được gì\n\n" +
    "GHI SỔ\n" + doing + "\n\n" +
    "XEM LẠI\n" + asking +
    "\n\n🌐 Type \"english\" for English." +
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
