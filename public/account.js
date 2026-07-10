// ============================================================================
//  Sổ Sạch — account layer (login/đăng ký, onboarding, gói, đại lý thuế).
//  Si aggancia ad app.js: usa window.SS = { api, T?, refresh, toast, showModal,
//  closeModal, vnd } esposti da app.js.
// ============================================================================
(() => {
  const { api, refresh, toast, showModal, closeModal, vnd } = window.SS;
  const $ = (s, r = document) => r.querySelector(s);
  const LANG = () => localStorage.getItem("ss_lang") || "vi";
  const t = (vi, en) => (LANG() === "vi" ? vi : en);

  const tokenKey = "ss_token";
  window.SS.getToken = () => localStorage.getItem(tokenKey);
  let ME = null;

  // ---- UI topbar -----------------------------------------------------------
  async function renderAcct() {
    const area = $("#acctArea");
    if (!area) return;
    if (!window.SS.getToken()) {
      ME = null;
      area.innerHTML = `<button class="btn solid" id="loginBtn">${t("Đăng nhập", "Sign in")}</button>`;
      $("#loginBtn").addEventListener("click", () => authModal());
      $("#agentSec")?.classList.add("hidden");
      return;
    }
    const r = await api("/api/auth/me");
    if (!r.ok || !r.account) { localStorage.removeItem(tokenKey); return renderAcct(); }
    ME = r.account;
    const sub = r.subActive
      ? `<span class="pill ok">${ME.sub.pilot ? t("Gói pilot", "Pilot plan") : (ME.sub.plan === "pro" ? "Pro" : t("Cơ bản", "Core"))}</span>`
      : `<span class="pill">${t("Chưa có gói", "No plan")}</span>`;
    area.innerHTML = `
      ${ME.role === "agent" ? `<span class="pill agent">🧑‍💼 ${t("Đại lý thuế", "Tax agent")} · ${ME.agentCode}</span>` : sub}
      <button class="btn ghost" id="meBtn">${ME.name || ME.phone}</button>`;
    $("#meBtn").addEventListener("click", accountModal);

    if (ME.role === "agent") { $("#agentSec")?.classList.remove("hidden"); renderAgent(); }
    else {
      $("#agentSec")?.classList.add("hidden");
      if (!localStorage.getItem("ss_onboarded_" + ME.phone)) onboarding();
    }
    refresh();
  }

  // ---- Auth modal ------------------------------------------------------------
  function authModal(mode = "register") {
    const reg = mode === "register";
    showModal(`
      <div class="modal-head">${reg ? t("Tạo tài khoản Sổ Sạch", "Create your Sổ Sạch account") : t("Đăng nhập", "Sign in")}</div>
      <div class="modal-body">
        <div class="field"><label>${t("Số điện thoại", "Phone number")}</label>
          <input id="aPhone" inputmode="numeric" placeholder="090 123 4567" /></div>
        <div class="field"><label>${t("Mã PIN (4–8 số)", "PIN (4–8 digits)")}</label>
          <input id="aPin" inputmode="numeric" type="password" placeholder="••••" /></div>
        ${reg ? `
        <div class="field"><label>${t("Bạn là…", "You are…")}</label>
          <select id="aRole">
            <option value="ho">${t("Hộ kinh doanh", "Household business")}</option>
            <option value="agent">${t("Đại lý thuế", "Tax agent (đại lý thuế)")}</option>
          </select></div>
        <div class="field"><label>${t("Tên (hộ KD hoặc đại lý)", "Name (business or agency)")}</label>
          <input id="aName" placeholder="${t("VD: Quán Cơm Cô Ba", "e.g. Co Ba Eatery")}" /></div>
        <div class="field" id="aCodeWrap"><label>${t("Mã đại lý thuế (nếu có)", "Tax-agent code (optional)")}</label>
          <input id="aCode" placeholder="DL1234" /></div>` : ""}
        <div class="err" id="aErr"></div>
        <div style="display:flex;gap:9px;margin-top:12px">
          <button class="btn solid block" id="aGo">${reg ? t("Đăng ký", "Register") : t("Đăng nhập", "Sign in")}</button>
          <button class="btn ghost block" id="aSwap">${reg ? t("Đã có tài khoản", "I have an account") : t("Tạo tài khoản", "Create account")}</button>
        </div>
        <div class="disc" style="margin-top:10px">${t("Bản pilot: đăng nhập chính thức qua Zalo sẽ có ở bản phát hành.", "Pilot build: official Zalo sign-in ships in the release version.")}</div>
      </div>`);
    $("#aSwap").addEventListener("click", () => authModal(reg ? "login" : "register"));
    if (reg) $("#aRole").addEventListener("change", () => { $("#aCodeWrap").style.display = $("#aRole").value === "ho" ? "" : "none"; });
    $("#aGo").addEventListener("click", async () => {
      const body = { phone: $("#aPhone").value, pin: $("#aPin").value };
      if (reg) { body.role = $("#aRole").value; body.name = $("#aName").value; body.agentCode = $("#aCode").value; }
      const r = await api(`/api/auth/${reg ? "register" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) { $("#aErr").textContent = r.error || "error"; return; }
      localStorage.setItem(tokenKey, r.token);
      closeModal(); toast(t("Xin chào " + (r.account.name || r.account.phone) + "! 👋", "Welcome!"));
      renderAcct();
    });
  }

  // ---- Account modal (gói, đại lý, đăng xuất) ---------------------------------
  async function accountModal() {
    const cfg = await api("/api/config");
    const isPilot = cfg.billing === "pilot";
    const plans = Object.values(cfg.plans);
    const subLine = ME.sub?.activeUntil
      ? t(`Gói ${ME.sub.plan === "pro" ? "Pro" : "Cơ bản"}${ME.sub.pilot ? " (pilot)" : ""} đến ${new Date(ME.sub.activeUntil).toLocaleDateString("vi-VN")}`,
          `${ME.sub.plan === "pro" ? "Pro" : "Core"} plan${ME.sub.pilot ? " (pilot)" : ""} until ${new Date(ME.sub.activeUntil).toLocaleDateString("en-GB")}`)
      : t("Chưa kích hoạt gói nào.", "No active plan.");
    showModal(`
      <div class="modal-head">${ME.name || ME.phone}</div>
      <div class="modal-body">
        ${ME.role === "agent"
          ? `<div class="conf-note">🧑‍💼 ${t("Mã mời khách hàng của bạn:", "Your client invite code:")} <b>${ME.agentCode}</b><br/>${t("Khách nhập mã này khi đăng ký là sổ của họ hiện trong bảng của bạn — bạn hưởng 30% hoa hồng.", "Clients enter this code at sign-up and their books appear on your dashboard — you earn 30% revenue share.")}</div>`
          : `<div class="conf-note">${subLine}</div>
             <div class="plans">
               ${plans.map((p) => `
                 <div class="plan">
                   <b>${LANG() === "vi" ? p.vi : p.en}</b>
                   <div class="price">${vnd(p.amountVND)}<small>/${t("tháng", "mo")}</small></div>
                   <button class="btn solid block" data-plan="${p.key}">${isPilot ? t("Kích hoạt (pilot miễn phí)", "Activate (free pilot)") : t("Thanh toán VietQR", "Pay via VietQR")}</button>
                 </div>`).join("")}
             </div>
             <div class="field" style="margin-top:10px"><label>${t("Mã đại lý thuế của bạn", "Your tax agent's code")}</label>
               <div style="display:flex;gap:8px"><input id="linkCode" placeholder="DL1234" style="flex:1"/><button class="btn ghost" id="linkGo">${t("Kết nối", "Link")}</button></div>
               ${ME.agentPhone ? `<small>${t("Đang kết nối với đại lý", "Linked to agent")}: ${ME.agentPhone}</small>` : ""}
             </div>
             <div class="field" style="margin-top:10px"><label>💬 ${t("Kết nối Zalo", "Connect Zalo")}</label>
               ${ME.zaloLinked
                 ? `<div class="conf-note">✅ ${t("Đã kết nối Zalo — sổ trên Zalo và web là một.", "Zalo linked — your Zalo and web ledger are one.")}</div>`
                 : `<button class="btn ghost block" id="zaloLinkBtn">${t("Lấy mã kết nối Zalo", "Get Zalo link code")}</button>
                    <small>${t("Để gửi hoá đơn qua Zalo mà sổ vẫn về tài khoản này (và đại lý thuế xem được).", "So receipts you send on Zalo land in this account (and your tax agent can see them).")}</small>`}
             </div>`}
        <div style="display:flex;gap:9px;margin-top:14px">
          <a class="btn ghost block" href="/api/export.csv" onclick="this.href='/api/export.csv'" id="csvBtn">📥 ${t("Xuất Excel (CSV)", "Export Excel (CSV)")}</a>
          <button class="btn ghost block" id="logoutBtn">${t("Đăng xuất", "Sign out")}</button>
        </div>
      </div>`);
    document.querySelectorAll("[data-plan]").forEach((b) =>
      b.addEventListener("click", async () => {
        const r = await api("/api/billing/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: b.dataset.plan }) });
        if (r.checkoutUrl) { window.location.href = r.checkoutUrl; return; }
        if (r.ok) { toast(t("✅ Đã kích hoạt gói pilot 30 ngày", "✅ 30-day pilot plan activated")); closeModal(); renderAcct(); }
        else toast("❌ " + (r.error || "error"));
      }));
    $("#linkGo")?.addEventListener("click", async () => {
      const r = await api("/api/link-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: $("#linkCode").value }) });
      if (r.ok) { toast(t("✅ Đã kết nối với đại lý " + r.agent.name, "✅ Linked to " + r.agent.name)); closeModal(); renderAcct(); }
      else toast("❌ " + (r.error || "error"));
    });
    $("#zaloLinkBtn")?.addEventListener("click", async () => {
      const r = await api("/api/link/zalo-code", { method: "POST" });
      if (!r.ok) return toast("❌ " + (r.error || "error"));
      showModal(`
        <div class="modal-head">💬 ${t("Kết nối Zalo", "Connect Zalo")}</div>
        <div class="modal-body">
          <div class="conf-note">${t("Mở OA <b>Sổ Sạch</b> trên Zalo và gửi mã này vào khung chat:", "Open the <b>Sổ Sạch</b> OA on Zalo and send this code in the chat:")}</div>
          <div style="font-size:2.1rem;font-weight:800;letter-spacing:6px;text-align:center;margin:16px 0;color:#0b3d2e;font-family:monospace">${r.code}</div>
          <div class="disc">${t("Mã có hiệu lực 15 phút. Sau khi gửi, mọi hoá đơn bạn chụp trên Zalo sẽ về đúng tài khoản này.", "Code valid 15 minutes. After you send it, every receipt you snap on Zalo lands in this account.")}</div>
          <button class="btn solid block" id="zDone" style="margin-top:12px">${t("Xong", "Done")}</button>
        </div>`);
      $("#zDone").addEventListener("click", () => { closeModal(); renderAcct(); });
    });
    // CSV con token: fetch + blob (l'header Authorization non passa nei link)
    $("#csvBtn").addEventListener("click", async (e) => {
      e.preventDefault();
      const res = await fetch("/api/export.csv", { headers: { Authorization: "Bearer " + window.SS.getToken() } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "so-sach.csv"; a.click(); URL.revokeObjectURL(a.href);
    });
    $("#logoutBtn").addEventListener("click", () => { localStorage.removeItem(tokenKey); closeModal(); renderAcct(); toast(t("Đã đăng xuất", "Signed out")); });
  }

  // ---- Onboarding (hộ, primo accesso) ------------------------------------------
  async function onboarding() {
    const cfg = await api("/api/config");
    showModal(`
      <div class="modal-head">${t("Chào mừng! Cho Sổ Sạch biết về bạn", "Welcome! Tell Sổ Sạch about your business")}</div>
      <div class="modal-body">
        <div class="field"><label>${t("Ngành nghề (quyết định thuế suất)", "Category (sets your tax rates)")}</label>
          <select id="obCat">${Object.entries(cfg.categories).map(([k, c]) => `<option value="${k}">${LANG() === "vi" ? c.vi : c.en}</option>`).join("")}</select></div>
        <div class="field"><label>${t("Doanh thu một tháng khoảng bao nhiêu?", "Rough monthly revenue?")}</label>
          <select id="obRev">
            <option value="20000000">${t("Dưới 40 triệu", "Under 40M VND")}</option>
            <option value="60000000" selected>40–80 ${t("triệu", "M VND")}</option>
            <option value="120000000">80–160 ${t("triệu", "M VND")}</option>
            <option value="250000000">${t("Trên 160 triệu", "Over 160M VND")}</option>
          </select></div>
        <div class="conf-note" id="obNote"></div>
        <button class="btn solid block" id="obGo">${t("Bắt đầu ghi sổ →", "Start keeping books →")}</button>
      </div>`);
    const note = () => {
      const yearly = Number($("#obRev").value) * 12;
      $("#obNote").innerHTML = yearly <= cfg.thresholds.taxFree
        ? t(`Dự kiến ~${(yearly / 1e6).toFixed(0)} triệu/năm — <b>dưới ngưỡng chịu thuế</b>. Bạn vẫn phải nộp tờ khai, và Sổ Sạch sẽ canh ngưỡng giúp.`,
            `~${(yearly / 1e6).toFixed(0)}M VND/yr — <b>below the taxable threshold</b>. You still file; Sổ Sạch watches the line for you.`)
        : t(`Dự kiến ~${(yearly / 1e6).toFixed(0)} triệu/năm — <b>trên ngưỡng</b>: sẽ có thuế GTGT + TNCN theo quý. Sổ Sạch tính sẵn từng quý.`,
            `~${(yearly / 1e6).toFixed(0)}M VND/yr — <b>above the threshold</b>: quarterly VAT + PIT apply. Sổ Sạch computes each quarter.`);
    };
    $("#obRev").addEventListener("change", note); note();
    $("#obGo").addEventListener("click", async () => {
      await api("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: $("#obCat").value, revenueEstimate: Number($("#obRev").value) }) });
      localStorage.setItem("ss_onboarded_" + ME.phone, "1");
      closeModal(); toast(t("Sẵn sàng! Chụp hoá đơn đầu tiên đi 📷", "Ready! Snap your first receipt 📷")); refresh();
    });
  }

  // ---- Agent dashboard ----------------------------------------------------------
  async function renderAgent() {
    const box = $("#agentBox");
    if (!box) return;
    const r = await api("/api/agent/clients");
    if (!r.ok) { box.innerHTML = `<div class="empty">${r.error || "…"}</div>`; return; }
    $("#agentCodeShow").textContent = r.agentCode;
    if (!r.clients.length) {
      box.innerHTML = `<div class="empty">${t("Chưa có khách. Gửi mã " + r.agentCode + " cho khách của bạn — họ nhập khi đăng ký.", "No clients yet. Share code " + r.agentCode + " — clients enter it at sign-up.")}</div>`;
      return;
    }
    box.innerHTML = `<table>
      <tr><th>${t("Khách", "Client")}</th><th>${t("Số bút toán", "Entries")}</th><th style="text-align:right">${t("Doanh thu " + r.quarter, "Revenue " + r.quarter)}</th><th style="text-align:right">${t("Thuế ước tính", "Est. tax")}</th><th></th></tr>
      ${r.clients.map((c) => `
        <tr>
          <td><b>${c.name}</b><div class="src">${c.phone}${c.subActive ? " · ✅" : ""}</div></td>
          <td>${c.entries}</td>
          <td class="amt">${vnd(c.quarterRevenue)}</td>
          <td class="amt">${c.exempt ? t("Miễn", "Exempt") : vnd(c.quarterTax)}</td>
          <td><button class="btn ghost" data-view="${c.phone}">${t("Xem sổ", "View")}</button></td>
        </tr>`).join("")}
    </table>`;
    box.querySelectorAll("[data-view]").forEach((b) =>
      b.addEventListener("click", async () => {
        const d = await api("/api/agent/client/" + b.dataset.view);
        if (!d.ok) return toast("❌ " + (d.error || ""));
        showModal(`
          <div class="modal-head">📒 ${d.client.name} — ${d.quarter.label}</div>
          <div class="modal-body">
            <div class="conf-note">${t("Thu", "Income")}: <b>${vnd(d.quarter.revenue)}</b> · ${t("Thuế quý ước tính", "Est. quarterly tax")}: <b>${d.tax.exempt ? t("miễn", "exempt") : vnd(d.tax.total)}</b> · ${t("Hạn", "Due")}: ${d.deadline.deadline}</div>
            <div class="ledger">${d.entries.length ? `<table>
              ${d.entries.slice(0, 30).map((e) => `<tr class="${e.type}"><td>${e.date}</td><td>${e.counterparty || e.description || ""}</td><td class="amt">${e.type === "thu" ? "+" : "−"}${vnd(e.amount)}</td></tr>`).join("")}
            </table>` : `<div class="empty">${t("Sổ trống", "Empty ledger")}</div>`}</div>
            <button class="btn ghost block" id="dClose2" style="margin-top:12px">${t("Đóng", "Close")}</button>
          </div>`);
        $("#dClose2").addEventListener("click", closeModal);
      }));
  }

  window.SS.renderAcct = renderAcct;
  renderAcct();
})();
