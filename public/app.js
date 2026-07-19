// ============================================================================
//  Sổ Sạch — frontend (VI primario, EN toggle).
//  Flusso: foto → /api/extract → conferma → /api/ledger → dashboard + tờ khai.
//  Dashboard: card → Điểm Sổ Sạch (credit-readiness) → soglie → grafico 12 mesi.
// ============================================================================
const $ = (s, r = document) => r.querySelector(s);

// Sandbox anonima PRIVATA per visitatore (prima tutti condividevano uid=demo).
const ANON = localStorage.getItem("ss_anon") ||
  (() => { const v = "w" + Math.random().toString(36).slice(2, 12); localStorage.setItem("ss_anon", v); return v; })();
const Q = "?uid=" + ANON;

// api(): allega il Bearer token quando l'utente è loggato — il server allora
// usa il libro dell'account invece della sandbox anonima (stessi endpoint).
const api = (u, opts = {}) => {
  const token = localStorage.getItem("ss_token");
  if (token) opts.headers = { ...(opts.headers || {}), Authorization: "Bearer " + token };
  return fetch(u, opts).then((r) => r.json());
};
const vnd = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
// Formato compatto per numeri grandi (barre/etichette): 1,2 tỷ · 850 triệu.
const vndShort = (n) => {
  n = Number(n) || 0;
  if (n >= 1e9) return (n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " tỷ";
  if (n >= 1e6) return Math.round(n / 1e6).toLocaleString("vi-VN") + " triệu";
  return vnd(n);
};
let LANG = localStorage.getItem("ss_lang") || "vi";
let CONFIG = null;
let manualType = "thu";

const I18N = {
  nav_app: { vi: "Sổ của tôi", en: "My ledger" },
  hero_eyebrow: { vi: "Từ 01/01/2026 hết thuế khoán — 5,2 triệu hộ kinh doanh phải ghi sổ", en: "Lump-sum tax ends 01/01/2026 — 5.2M household businesses must keep books" },
  hero_h1: { vi: "Chụp hoá đơn.<br/>Sổ sách tự lo.", en: "Snap the receipt.<br/>The books do themselves." },
  hero_p: { vi: "Gửi ảnh hoá đơn vào Zalo, <b>Sổ Sạch</b> tự ghi sổ thu chi, canh ngưỡng thuế giúp bạn và soạn sẵn tờ khai quý — bằng tiếng Việt dễ hiểu, không cần biết kế toán.", en: "Send a receipt photo on Zalo and <b>Sổ Sạch</b> writes your ledger, watches the tax thresholds for you and pre-fills the quarterly declaration — in plain language, no accounting needed." },
  hero_cta1: { vi: "Dùng thử ngay — miễn phí", en: "Try it now — free" },
  hero_cta2: { vi: "Xem cách hoạt động", en: "See how it works" },
  trust1: { vi: "📱 Chạy trong Zalo", en: "📱 Lives inside Zalo" },
  trust2: { vi: "🔔 Báo trước khi chạm ngưỡng thuế", en: "🔔 Warns before you cross tax thresholds" },
  trust3: { vi: "📄 Tờ khai 01/CNKD soạn sẵn", en: "📄 Form 01/CNKD pre-filled" },
  s1: { vi: "hộ kinh doanh phải tự khai từ 2026", en: "household businesses must self-declare from 2026" },
  s2: { vi: "hạn nộp tờ khai quý đầu tiên", en: "first quarterly filing deadline" },
  s3: { vi: "mỗi tháng — rẻ hơn một bữa trưa", en: "per month — cheaper than lunch" },
  how_kicker: { vi: "Cách hoạt động", en: "How it works" },
  how_h2: { vi: "Ba bước, không cần biết kế toán", en: "Three steps, zero accounting" },
  how1_t: { vi: "Chụp & gửi", en: "Snap & send" },
  how1_p: { vi: "Chụp hoá đơn, biên lai, hay tin nhắn chuyển khoản — gửi vào Zalo Sổ Sạch như gửi cho bạn bè.", en: "Photograph receipts, bills or bank-transfer screenshots — send them to the Sổ Sạch Zalo like you'd message a friend." },
  how2_t: { vi: "AI ghi sổ", en: "AI writes the ledger" },
  how2_p: { vi: "Sổ Sạch đọc ảnh, tự phân loại thu/chi, ghi vào sổ. Sai thì sửa một chạm. Cuối tháng có tổng kết rõ ràng.", en: "Sổ Sạch reads the image, classifies income/expense, writes the entry. One tap to fix. Clear monthly summary." },
  how3_t: { vi: "Tờ khai soạn sẵn", en: "Declaration pre-filled" },
  how3_p: { vi: "Đến kỳ, tờ khai 01/CNKD đã điền sẵn số liệu. Ký, nộp — hoặc gửi thẳng cho đại lý thuế của bạn.", en: "When the quarter ends, form 01/CNKD is already filled in. Sign and file — or send it to your tax agent." },
  app_kicker: { vi: "Sổ của tôi · bản dùng thử", en: "My ledger · live demo" },
  app_h2: { vi: "Thử ngay trên web", en: "Try it on the web" },
  app_p: { vi: "Đây chính là sản phẩm — phiên bản web. Trên Zalo, mọi thứ diễn ra trong khung chat.", en: "This is the actual product — web edition. On Zalo, everything happens in the chat." },
  add_title: { vi: "➕ Thêm hoá đơn", en: "➕ Add a receipt" },
  drop_label: { vi: "Chụp hoặc chọn ảnh hoá đơn", en: "Snap or choose a receipt photo" },
  drop_hint: { vi: "AI sẽ đọc và điền sẵn — bạn chỉ xác nhận", en: "AI reads and pre-fills — you just confirm" },
  or: { vi: "hoặc nhập tay", en: "or enter manually" },
  seg_thu: { vi: "📈 Thu", en: "📈 Income" },
  seg_chi: { vi: "📉 Chi", en: "📉 Expense" },
  ph_amount: { vi: "Số tiền (đ)", en: "Amount (VND)" },
  ph_who: { vi: "Khách / nhà cung cấp", en: "Customer / supplier" },
  ph_desc: { vi: "Mô tả", en: "Description" },
  ph_name: { vi: "Tên hộ kinh doanh (cho tờ khai)", en: "Business name (for the declaration)" },
  cat_label: { vi: "Ngành nghề (quyết định thuế suất)", en: "Business category (sets tax rates)" },
  add_btn: { vi: "Ghi vào sổ", en: "Record entry" },
  dash_title: { vi: "📊 Tổng quan", en: "📊 Overview" },
  decl_btn: { vi: "📄 Xem tờ khai quý (bản nháp)", en: "📄 View quarterly declaration (draft)" },
  ledger_title: { vi: "📒 Sổ thu chi", en: "📒 Ledger" },
  zb_kicker: { vi: "Trên Zalo", en: "On Zalo" },
  zb_h2: { vi: "Sổ Sạch sống trong Zalo của bạn", en: "Sổ Sạch lives inside your Zalo" },
  zb_p: { vi: "Không app mới, không mật khẩu mới. Kết bạn với OA Sổ Sạch, gửi ảnh hoá đơn là xong. Bản OA đang mở cho 100 hộ đầu tiên tại TP.HCM.", en: "No new app, no new password. Follow the Sổ Sạch OA, send receipt photos, done. The OA is opening to the first 100 households in HCMC." },
  zb_btn: { vi: "Đăng ký 100 hộ đầu tiên", en: "Join the first 100" },
  foot: { vi: "© 2026 Sổ Sạch — bản dùng thử. Số liệu thuế là ước tính, kiểm tra với đại lý thuế trước khi nộp.", en: "© 2026 Sổ Sạch — demo. Tax figures are estimates; verify with a licensed tax agent before filing." },
  foot_co: { vi: "Một sản phẩm của CÔNG TY TNHH OFFICINE GẶP — TP. Hồ Chí Minh", en: "A product of OFFICINE GAP CO., LTD — Ho Chi Minh City" },
  // dinamiche
  card_thu: { vi: "Thu năm nay", en: "Income YTD" },
  card_chi: { vi: "Chi năm nay", en: "Expenses YTD" },
  card_lai: { vi: "Lãi gộp", en: "Gross profit" },
  bar_taxfree: { vi: "Ngưỡng chịu thuế (1 tỷ)", en: "Taxable threshold (1B)" },
  bar_einv: { vi: "Ngưỡng e-invoice máy tính tiền (1 tỷ)", en: "Cash-register e-invoice threshold (1B)" },
  proj: { vi: "dự kiến cả năm", en: "projected/yr" },
  tax_exempt: { vi: "✅ Doanh thu dự kiến dưới ngưỡng — quý này KHÔNG phải nộp thuế, nhưng vẫn nộp tờ khai.", en: "✅ Projected revenue below threshold — NO tax due this quarter, but you still file the declaration." },
  tax_due: { vi: "Thuế ước tính quý này", en: "Estimated tax this quarter" },
  deadline: { vi: "Hạn nộp", en: "Deadline" },
  confirm_title: { vi: "Xác nhận hoá đơn", en: "Confirm receipt" },
  conf_demo: { vi: "⚠️ Bản demo: AI chưa kết nối, số liệu ví dụ — hãy sửa cho đúng rồi lưu.", en: "⚠️ Demo mode: AI not connected, sample values — edit then save." },
  conf_ai: { vi: "AI đã đọc ảnh (độ tin cậy {c}%) — kiểm tra rồi lưu.", en: "AI read the image ({c}% confidence) — check and save." },
  save: { vi: "Lưu vào sổ", en: "Save to ledger" },
  cancel: { vi: "Huỷ", en: "Cancel" },
  saved: { vi: "✅ Đã ghi vào sổ", en: "✅ Recorded" },
  deleted: { vi: "Đã xoá", en: "Deleted" },
  reading: { vi: "⏳ AI đang đọc ảnh…", en: "⏳ AI is reading…" },
  th_date: { vi: "Ngày", en: "Date" }, th_what: { vi: "Nội dung", en: "Item" }, th_amt: { vi: "Số tiền", en: "Amount" },
  empty_ledger: { vi: "Chưa có gì trong sổ — chụp hoá đơn đầu tiên đi! 📷", en: "Ledger is empty — snap your first receipt! 📷" },
  sample_btn: { vi: "📚 Xem thử với sổ mẫu 4 tháng", en: "📚 Load a 4-month sample book" },
  sample_hint: { vi: "Chưa muốn nhập số thật? Nạp sổ mẫu của một quán bún bò để xem điểm, biểu đồ và tờ khai hoạt động.", en: "Not ready for real numbers? Load a noodle-shop sample book to see the score, chart and declaration in action." },
  sample_clear: { vi: "Xoá sổ mẫu", en: "Clear sample" },
  sample_loaded: { vi: "✅ Đã nạp sổ mẫu — xem điểm và biểu đồ!", en: "✅ Sample loaded — check the score and chart!" },
  sample_cleared: { vi: "Đã xoá sổ mẫu", en: "Sample cleared" },
  sample_tag: { vi: "sổ mẫu", en: "sample" },
  del_arm: { vi: "Chạm lần nữa để xoá", en: "Tap again to delete" },
  more_entries: { vi: "… còn {n} bút toán cũ hơn — xuất CSV để xem tất cả", en: "… {n} older entries — export CSV to see all" },
  // Điểm Sổ Sạch
  score_title: { vi: "Điểm Sổ Sạch", en: "Sổ Sạch Score" },
  score_sub: { vi: "Sổ càng sạch — càng dễ vay vốn", en: "Cleaner books — easier credit" },
  grade_A: { vi: "Hồ sơ đẹp, sẵn sàng vay vốn 🏦", en: "Loan-ready books 🏦" },
  grade_B: { vi: "Sổ tốt — gần đạt chuẩn", en: "Good books — nearly there" },
  grade_C: { vi: "Khá — cần đều tay hơn", en: "Fair — needs regularity" },
  grade_D: { vi: "Mới bắt đầu — cứ ghi tiếp!", en: "Just starting — keep going!" },
  score_note: { vi: "Ngân hàng và quỹ tín dụng nhìn vào nề nếp sổ sách khi xét vay. Điểm này đo mức độ \"sẵn sàng hồ sơ\" của sổ — không phải điểm tín dụng chính thức.", en: "Banks and credit funds look at bookkeeping discipline when assessing loans. This measures how loan-ready your books are — not an official credit score." },
  chart_title: { vi: "📈 Dòng tiền 12 tháng", en: "📈 12-month cash flow" },
  leg_thu: { vi: "Thu", en: "In" },
  leg_chi: { vi: "Chi", en: "Out" },
  decl_title: { vi: "Tờ khai thuế quý — BẢN NHÁP", en: "Quarterly tax declaration — DRAFT" },
  d_period: { vi: "Kỳ tính thuế", en: "Tax period" },
  d_taxpayer: { vi: "Người nộp thuế", en: "Taxpayer" },
  d_cat: { vi: "Ngành nghề", en: "Category" },
  d_rev: { vi: "Doanh thu tính thuế trong quý", en: "Taxable revenue this quarter" },
  d_vat: { vi: "Thuế GTGT ({r}%)", en: "VAT ({r}%)" },
  d_pit: { vi: "Thuế TNCN ({r}%)", en: "PIT ({r}%)" },
  d_tot: { vi: "TỔNG THUẾ PHẢI NỘP", en: "TOTAL TAX DUE" },
  d_print: { vi: "🖨️ In / Lưu PDF", en: "🖨️ Print / Save PDF" },
  d_close: { vi: "Đóng", en: "Close" },
};
const T = (k, vars) => {
  let s = (I18N[k] || {})[LANG] || (I18N[k] || {}).vi || k;
  if (vars) for (const [key, v] of Object.entries(vars)) s = s.replace(`{${key}}`, v);
  return s;
};
const MONTHS = { vi: ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"], en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"] };

function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((el) => { const k = el.dataset.i18n; if (I18N[k]) el.innerHTML = T(k); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => { const k = el.dataset.i18nPh; if (I18N[k]) el.placeholder = T(k); });
  $("#langBtn").textContent = LANG === "vi" ? "EN" : "VI";
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
function showModal(html) { $("#modal").innerHTML = html; $("#modalBg").classList.add("open"); }
function closeModal() { $("#modalBg").classList.remove("open"); }

// ---- Điểm Sổ Sạch (ring + componenti) --------------------------------------------
function renderScore(sc) {
  const C = 2 * Math.PI * 34; // circonferenza ring r=34
  const off = C * (1 - sc.score / 100);
  // il consiglio: la componente più debole
  const weakest = [...sc.parts].sort((a, b) => a.points / a.max - b.points / b.max)[0];
  $("#scoreBox").innerHTML = `
    <div class="score-head"><b>💎 ${T("score_title")}</b><span>${T("score_sub")}</span></div>
    <div class="score-wrap">
      <svg class="ring g${sc.grade}" viewBox="0 0 84 84" role="img" aria-label="${sc.score}/100">
        <circle class="ring-bg" cx="42" cy="42" r="34"/>
        <circle class="ring-fg" cx="42" cy="42" r="34" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
        <text x="42" y="44" class="ring-num">${sc.score}</text>
        <text x="42" y="60" class="ring-grade">${sc.grade}</text>
      </svg>
      <div class="score-side">
        <div class="score-grade-label">${T("grade_" + sc.grade)}</div>
        ${sc.parts.map((p) => `
          <div class="sp-row" title="${LANG === "vi" ? p.tip_vi : p.tip_en}">
            <span>${LANG === "vi" ? p.vi : p.en}</span>
            <div class="sp-bar"><i style="width:${(p.points / p.max * 100).toFixed(0)}%"></i></div>
            <em>${p.points}/${p.max}</em>
          </div>`).join("")}
      </div>
    </div>
    ${sc.score < 100 ? `<div class="score-tip">💡 ${LANG === "vi" ? weakest.tip_vi : weakest.tip_en}</div>` : ""}
    <div class="score-note">${T("score_note")}</div>`;
}

// ---- Grafico cash-flow 12 mesi (SVG inline, zero dipendenze) ----------------------
function renderChart(monthly) {
  const hasData = monthly.some((m) => m.thu || m.chi);
  const box = $("#chartBox");
  if (!hasData) { box.innerHTML = ""; box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const max = Math.max(...monthly.flatMap((m) => [m.thu, m.chi]));
  const H = 128, base = H - 22, scale = (H - 38) / max;
  const bars = monthly.map((m, i) => {
    const gx = 8 + i * 30.5;
    const ht = Math.max(m.thu ? 2 : 0, m.thu * scale), hc = Math.max(m.chi ? 2 : 0, m.chi * scale);
    return `
      <rect class="b-thu" x="${gx}" y="${(base - ht).toFixed(1)}" width="9" height="${ht.toFixed(1)}" rx="2"><title>${MONTHS[LANG][i]} · ${T("leg_thu")}: ${vnd(m.thu)}</title></rect>
      <rect class="b-chi" x="${gx + 11}" y="${(base - hc).toFixed(1)}" width="9" height="${hc.toFixed(1)}" rx="2"><title>${MONTHS[LANG][i]} · ${T("leg_chi")}: ${vnd(m.chi)}</title></rect>
      <text x="${gx + 10}" y="${H - 8}" class="b-lbl">${MONTHS[LANG][i]}</text>`;
  }).join("");
  box.innerHTML = `
    <div class="chart-head"><b>${T("chart_title")}</b>
      <span class="legend"><i class="dot thu"></i>${T("leg_thu")} <i class="dot chi"></i>${T("leg_chi")}</span></div>
    <svg viewBox="0 0 378 ${H}" class="chart">
      <line x1="4" y1="${base}" x2="374" y2="${base}" class="axis"/>
      ${bars}
    </svg>`;
}

// ---- Sổ mẫu -----------------------------------------------------------------------
async function seedSample() {
  toast("⏳ …");
  const r = await api("/api/demo-seed" + Q, { method: "POST" });
  if (r.ok) { toast(T("sample_loaded")); refresh(); } else toast("❌ " + (r.error || ""));
}
async function clearSample() {
  const r = await api("/api/demo-seed" + Q, { method: "DELETE" });
  if (r.ok) { toast(T("sample_cleared")); refresh(); }
}

// ---- Dashboard -----------------------------------------------------------------
async function refresh() {
  const d = await api("/api/ledger" + Q);
  // profilo
  if ($("#bizName") !== document.activeElement) $("#bizName").value = d.profile.name || "";
  $("#category").value = d.profile.category;

  $("#cards").innerHTML = `
    <div class="card thu"><b>${vnd(d.year.revenue)}</b><span>${T("card_thu")}</span></div>
    <div class="card chi"><b>${vnd(d.year.expenses)}</b><span>${T("card_chi")}</span></div>
    <div class="card"><b>${vnd(d.year.net)}</b><span>${T("card_lai")}</span></div>`;

  renderScore(d.score);
  renderChart(d.monthly);

  const th = d.thresholds;
  $("#bars").innerHTML = `
    <div class="bar-row">
      <label><span>${T("bar_taxfree")}</span><span>${vndShort(th.projection)} ${T("proj")}</span></label>
      <div class="bar ${th.taxFree.pct > .8 ? "warn" : ""}"><i style="width:${(th.taxFree.pct * 100).toFixed(1)}%"></i></div>
    </div>
    <div class="bar-row">
      <label><span>${T("bar_einv")}</span><span>${(th.eInvoice.pct * 100).toFixed(0)}%</span></label>
      <div class="bar ${th.eInvoice.pct > .8 ? "warn" : ""}"><i style="width:${(th.eInvoice.pct * 100).toFixed(1)}%"></i></div>
    </div>`;

  $("#taxBox").innerHTML = d.tax.exempt
    ? `<span class="exempt">${T("tax_exempt")}</span><br/>${T("deadline")}: <b>${d.deadline.deadline}</b> (${d.deadline.quarter})`
    : `${T("tax_due")} (${d.quarter.label}): <b>${vnd(d.tax.total)}</b><br/>GTGT ${vnd(d.tax.vat)} + TNCN ${vnd(d.tax.pit)} · ${T("deadline")}: <b>${d.deadline.deadline}</b>`;

  // libro
  const hasSample = d.entries.some((e) => e.sample);
  const loggedOut = !localStorage.getItem("ss_token");
  if (!d.entries.length) {
    $("#ledger").innerHTML = `<div class="empty">
      <div class="empty-ico">📒</div>
      <p>${T("empty_ledger")}</p>
      ${loggedOut ? `<button class="btn solid" id="seedBtn">${T("sample_btn")}</button>
      <small>${T("sample_hint")}</small>` : ""}
    </div>`;
    $("#seedBtn")?.addEventListener("click", seedSample);
  } else {
    $("#ledger").innerHTML = `
      ${hasSample ? `<div class="sample-strip">📚 ${T("sample_hint").split("?")[0]}? <button class="chip-btn" id="clearSampleBtn">🧹 ${T("sample_clear")}</button></div>` : ""}
      <table>
      <tr><th>${T("th_date")}</th><th>${T("th_what")}</th><th style="text-align:right">${T("th_amt")}</th><th></th></tr>
      ${d.entries.slice(0, 40).map((e) => `
        <tr class="${e.type}">
          <td>${e.date}<div class="src">${e.source === "zalo" ? "💬 Zalo" : "🌐 web"}${e.engine === "demo" ? " · demo" : ""}${e.sample ? ` · ${T("sample_tag")}` : ""}</div></td>
          <td>${e.counterparty || ""}<div class="src">${e.description || ""}</div></td>
          <td class="amt">${e.type === "thu" ? "+" : "−"}${vnd(e.amount)}</td>
          <td><button class="del" data-del="${e.id}" title="${T("del_arm")}">🗑</button></td>
        </tr>`).join("")}
    </table>
    ${d.entries.length > 40 ? `<div class="src" style="padding:10px;text-align:center">${T("more_entries", { n: d.entries.length - 40 })}</div>` : ""}`;
    $("#clearSampleBtn")?.addEventListener("click", clearSample);
    // eliminazione in due tocchi (niente cancellazioni accidentali)
    $("#ledger").querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!b.dataset.armed) {
          b.dataset.armed = "1"; b.textContent = "❓"; b.classList.add("arm");
          setTimeout(() => { b.dataset.armed = ""; b.textContent = "🗑"; b.classList.remove("arm"); }, 2600);
          return;
        }
        await api(`/api/ledger/${b.dataset.del}${Q}`, { method: "DELETE" });
        toast(T("deleted")); refresh();
      })
    );
  }
}

// ---- Estrazione da foto -----------------------------------------------------------
async function handleFile(file) {
  const buf = await file.arrayBuffer();
  let bin = ""; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  const base64 = btoa(bin);
  toast(T("reading"));
  const r = await api("/api/extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType: file.type || "image/jpeg" }),
  });
  if (!r.ok) { toast("❌ " + (r.error || "error")); return; }
  confirmEntry(r.extracted);
}

function confirmEntry(x) {
  const note = x.engine === "demo" ? T("conf_demo") : T("conf_ai", { c: Math.round((x.confidence || 0) * 100) });
  showModal(`
    <div class="modal-head">${T("confirm_title")}</div>
    <div class="modal-body">
      <div class="conf-note">${note}</div>
      <div class="field"><label>${T("seg_thu")} / ${T("seg_chi")}</label>
        <select id="cType"><option value="thu" ${x.type === "thu" ? "selected" : ""}>📈 Thu</option><option value="chi" ${x.type === "chi" ? "selected" : ""}>📉 Chi</option></select></div>
      <div class="field"><label>${T("ph_amount")}</label><input id="cAmount" inputmode="numeric" value="${x.amount || ""}" /></div>
      <div class="field"><label>${T("ph_who")}</label><input id="cWho" value="${(x.counterparty || "").replace(/"/g, "&quot;")}" /></div>
      <div class="field"><label>${T("ph_desc")}</label><input id="cDesc" value="${(x.description || "").replace(/"/g, "&quot;")}" /></div>
      <div class="field"><label>${T("th_date")}</label><input id="cDate" type="date" value="${x.date || ""}" /></div>
      <div style="display:flex;gap:9px;margin-top:14px">
        <button class="btn solid block" id="cSave">${T("save")}</button>
        <button class="btn ghost block" id="cCancel">${T("cancel")}</button>
      </div>
    </div>`);
  $("#cCancel").addEventListener("click", closeModal);
  $("#cSave").addEventListener("click", async () => {
    const body = {
      type: $("#cType").value,
      amount: Number(String($("#cAmount").value).replace(/[^\d]/g, "")),
      counterparty: $("#cWho").value, description: $("#cDesc").value, date: $("#cDate").value,
    };
    const r = await api("/api/ledger" + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { closeModal(); toast(T("saved")); refresh(); }
  });
}

// ---- Tờ khai --------------------------------------------------------------------
async function openDeclaration() {
  const d = await api("/api/declaration" + Q);
  const pr = (n) => (n * 100).toFixed(1).replace(".0", "");
  showModal(`
    <div class="modal-head">${T("decl_title")}</div>
    <div class="modal-body decl">
      <h4>${d.form}</h4>
      <div class="sub">${d.period}</div>
      <table>
        <tr><td>${T("d_taxpayer")}</td><td><b>${d.taxpayer}</b></td></tr>
        <tr><td>${T("d_cat")}</td><td>${LANG === "vi" ? d.category.vi : d.category.en}</td></tr>
        <tr><td>${T("d_rev")}</td><td><b>${vnd(d.revenue)}</b></td></tr>
        <tr><td>${T("d_vat", { r: pr(d.rates.vat) })}</td><td>${vnd(d.vat)}</td></tr>
        <tr><td>${T("d_pit", { r: pr(d.rates.pit) })}</td><td>${vnd(d.pit)}</td></tr>
        <tr class="tot"><td>${T("d_tot")}</td><td>${vnd(d.total)}</td></tr>
      </table>
      ${d.exempt ? `<div class="conf-note">${d.exemptNote}</div>` : ""}
      ${d.agent ? `<div class="conf-note">🧑‍💼 ${LANG === "vi" ? "Đại lý thuế của bạn" : "Your tax agent"}: <b>${d.agent.name}</b> (${d.agent.phone})</div>` : ""}
      <div class="disc">${d.disclaimer}</div>
      <div class="share-foot">📒 ${LANG === "vi" ? "Tạo bởi" : "Made with"} <b>Sổ Sạch</b> — so-sach.onrender.com</div>
      <div style="display:flex;gap:9px;margin-top:14px">
        <button class="btn solid block" onclick="window.print()">${T("d_print")}</button>
        <button class="btn ghost block" id="dClose">${T("d_close")}</button>
      </div>
    </div>`);
  $("#dClose").addEventListener("click", closeModal);
}

// ---- Wiring ----------------------------------------------------------------------
async function init() {
  applyI18n();
  CONFIG = await api("/api/config");
  const sel = $("#category");
  sel.innerHTML = Object.entries(CONFIG.categories)
    .map(([k, c]) => `<option value="${k}">${LANG === "vi" ? c.vi : c.en} (${(c.vat * 100).toFixed(0)}%+${(c.pit * 100).toFixed(1)}%)</option>`)
    .join("");
  sel.addEventListener("change", async () => {
    await api("/api/profile" + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: sel.value }) });
    refresh();
  });
  $("#bizName").addEventListener("change", async () => {
    await api("/api/profile" + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: $("#bizName").value }) });
    refresh();
  });
  $("#drop").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; });
  $("#segType").querySelectorAll(".seg-btn").forEach((b) =>
    b.addEventListener("click", () => {
      manualType = b.dataset.type;
      $("#segType").querySelectorAll(".seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    })
  );
  $("#manualForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      type: manualType,
      amount: Number(String($("#mAmount").value).replace(/[^\d]/g, "")),
      counterparty: $("#mWho").value, description: $("#mDesc").value,
      date: $("#mDate").value || undefined,
    };
    if (!body.amount) return;
    const r = await api("/api/ledger" + Q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { $("#manualForm").reset(); toast(T("saved")); refresh(); }
  });
  $("#declBtn").addEventListener("click", openDeclaration);
  $("#modalBg").addEventListener("click", (e) => { if (e.target.id === "modalBg") closeModal(); });
  $("#langBtn").addEventListener("click", () => {
    LANG = LANG === "vi" ? "en" : "vi";
    localStorage.setItem("ss_lang", LANG);
    applyI18n(); init2();
  });
  refresh();
}
// re-render dinamiche dopo cambio lingua senza rifare i listener
async function init2() {
  const sel = $("#category");
  const cur = sel.value;
  sel.innerHTML = Object.entries(CONFIG.categories)
    .map(([k, c]) => `<option value="${k}">${LANG === "vi" ? c.vi : c.en} (${(c.vat * 100).toFixed(0)}%+${(c.pit * 100).toFixed(1)}%)</option>`)
    .join("");
  sel.value = cur;
  refresh();
  window.SS?.renderAcct?.();
}

// Espone gli helper condivisi ad account.js (auth, gói, đại lý thuế).
window.SS = { api, refresh, toast, showModal, closeModal, vnd };

init();
