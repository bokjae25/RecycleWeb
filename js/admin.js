/* ============================================================
   관리자 페이지
   - 관리자 로그인 → 전 계정(환자/의료진/관리자) 목록
   - 역할 변경, 담당 의료진 배정, 검색/필터, 플레이 수 표시
   - RLS: is_admin() 정책으로 관리자만 전체 조회/수정 가능
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const ROLE_LABEL = { patient: "환자", clinician: "의료진", admin: "관리자" };

  let profiles = [];
  let clinicians = [];
  let sessionCounts = {}; // patient_id -> count
  let dirty = {};         // id -> {role, clinician_id}

  function showScreen(id) {
    ["loginScreen", "adminScreen"].forEach((s) => $(s).classList.toggle("active", s === id));
  }

  async function init() {
    if (!(window.Backend && Backend.online)) {
      $("loginError").textContent = "서버 설정이 필요합니다 (supabase-config.js).";
      return;
    }
    const user = await Backend.getUser();
    if (user) return afterLogin();
    showScreen("loginScreen");
  }

  $("loginBtn").addEventListener("click", login);
  ["email", "password"].forEach((id) =>
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") login(); }));
  $("logoutBtn").addEventListener("click", async () => { await Backend.signOut(); location.reload(); });
  $("reloadBtn").addEventListener("click", loadUsers);
  $("searchBox").addEventListener("input", render);
  $("roleFilter").addEventListener("change", render);

  async function login() {
    const email = $("email").value.trim(), password = $("password").value;
    if (!email || !password) return ($("loginError").textContent = "이메일과 비밀번호를 입력하세요.");
    $("loginBtn").disabled = true; $("loginError").textContent = "";
    try {
      const { error } = await Backend.signIn(email, password);
      if (error) throw error;
      await afterLogin();
    } catch (e) {
      $("loginError").textContent = /Invalid login/i.test(e.message || "")
        ? "이메일 또는 비밀번호가 올바르지 않습니다." : (e.message || "로그인 실패");
    } finally { $("loginBtn").disabled = false; }
  }

  async function afterLogin() {
    const profile = await Backend.getProfile();
    if (!profile || profile.role !== "admin") {
      $("loginError").textContent = "관리자 계정이 아닙니다.";
      await Backend.signOut();
      showScreen("loginScreen");
      return;
    }
    $("userLabel").textContent = (profile.full_name || "관리자") + " 님";
    $("logoutBtn").style.display = "";
    showScreen("adminScreen");
    await loadUsers();
  }

  async function loadUsers() {
    $("adminMsg").textContent = "불러오는 중…";
    const { data: profs, error } = await Backend.client
      .from("profiles").select("*").order("created_at", { ascending: true });
    if (error) { $("adminMsg").textContent = "목록을 불러오지 못했습니다: " + error.message; return; }

    profiles = profs || [];
    clinicians = profiles.filter((p) => p.role === "clinician");

    // 플레이 수 집계
    const { data: sess } = await Backend.client.from("sessions").select("patient_id");
    sessionCounts = {};
    (sess || []).forEach((s) => { sessionCounts[s.patient_id] = (sessionCounts[s.patient_id] || 0) + 1; });

    dirty = {};
    $("adminMsg").textContent = "";
    renderStats();
    render();
  }

  function renderStats() {
    const c = (r) => profiles.filter((p) => p.role === r).length;
    const stats = [["환자", c("patient")], ["의료진", c("clinician")], ["관리자", c("admin")], ["전체", profiles.length]];
    $("statRow").innerHTML = stats.map(([l, v]) =>
      `<div class="stat-box"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("");
  }

  function render() {
    const q = $("searchBox").value.trim().toLowerCase();
    const roleF = $("roleFilter").value;
    const clinOpts = clinicians.map((c) =>
      `<option value="${c.id}">${escapeHtml(c.full_name) || c.email || c.id.slice(0, 8)}</option>`).join("");

    const rows = profiles.filter((p) => {
      if (roleF !== "all" && p.role !== roleF) return false;
      if (q && !((p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q))) return false;
      return true;
    }).map((p) => {
      const d = dirty[p.id] || {};
      const curRole = d.role ?? p.role;
      const curClin = d.clinician_id ?? p.clinician_id ?? "";
      const isDirty = !!dirty[p.id];
      const clinCell = curRole === "patient"
        ? `<select data-id="${p.id}" data-field="clinician_id">
             <option value="">- 없음 -</option>${clinOpts}
           </select>`
        : `<span class="hint">-</span>`;
      return `<tr class="${isDirty ? "dirty" : ""}">
        <td>${escapeHtml(p.full_name) || "-"}</td>
        <td>${escapeHtml(p.email) || "-"}</td>
        <td>
          <select data-id="${p.id}" data-field="role">
            ${["patient", "clinician", "admin"].map((r) =>
              `<option value="${r}" ${r === curRole ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}
          </select>
        </td>
        <td>${clinCell}</td>
        <td>${sessionCounts[p.id] || 0}회</td>
        <td>${fmtDate(p.created_at)}</td>
        <td><button class="btn save-btn" data-save="${p.id}" ${isDirty ? "" : "disabled"}>저장</button></td>
      </tr>`;
    }).join("");

    $("userRows").innerHTML = rows || `<tr><td colspan="7" style="text-align:center;padding:30px;color:#888;">결과 없음</td></tr>`;

    // 선택된 select 값 반영(재렌더 후 clinician select 기본값)
    $("userRows").querySelectorAll('select[data-field="clinician_id"]').forEach((sel) => {
      const p = profiles.find((x) => x.id === sel.dataset.id);
      const d = dirty[sel.dataset.id] || {};
      sel.value = d.clinician_id ?? p.clinician_id ?? "";
    });

    $("userRows").querySelectorAll("select[data-field]").forEach((sel) =>
      sel.addEventListener("change", onEdit));
    $("userRows").querySelectorAll("button[data-save]").forEach((btn) =>
      btn.addEventListener("click", () => saveRow(btn.dataset.save)));
  }

  function onEdit(e) {
    const id = e.target.dataset.id, field = e.target.dataset.field;
    const p = profiles.find((x) => x.id === id);
    dirty[id] = dirty[id] || { role: p.role, clinician_id: p.clinician_id ?? "" };
    dirty[id][field] = e.target.value;
    // 역할을 환자가 아닌 것으로 바꾸면 담당 의료진 해제
    if (field === "role" && e.target.value !== "patient") dirty[id].clinician_id = "";
    render();
  }

  async function saveRow(id) {
    const d = dirty[id];
    if (!d) return;
    const patch = { role: d.role, clinician_id: d.clinician_id || null };
    $("adminMsg").textContent = "저장 중…";
    const { error } = await Backend.client.from("profiles").update(patch).eq("id", id);
    if (error) { $("adminMsg").textContent = "저장 실패: " + error.message; return; }

    // 로컬 반영
    const p = profiles.find((x) => x.id === id);
    Object.assign(p, patch);
    delete dirty[id];
    clinicians = profiles.filter((x) => x.role === "clinician");
    $("adminMsg").textContent = "저장되었습니다 ✓";
    renderStats();
    render();
    setTimeout(() => { if ($("adminMsg").textContent === "저장되었습니다 ✓") $("adminMsg").textContent = ""; }, 2000);
  }

  function fmtDate(iso) { const d = new Date(iso); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`; }
  const p = (n) => String(n).padStart(2, "0");
  function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  init();
})();
