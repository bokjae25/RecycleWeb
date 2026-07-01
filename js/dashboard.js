/* ============================================================
   의료진 대시보드
   - 의료진 로그인 → 담당 환자 목록 → 환자별 진행 그래프
   - RLS 덕분에 담당 환자(clinician_id = 본인)의 기록만 조회됨
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);
  const GAME_NAMES = { balloon: "풍선 터뜨리기", trace: "궤적 그리기", memory: "순서 기억", recycle: "분리수거" };

  let me = null;        // 로그인한 의료진 프로필
  let patients = [];
  let selectedId = null;

  function showScreen(id) {
    ["loginScreen", "dashScreen"].forEach((s) => $(s).classList.toggle("active", s === id));
  }

  /* ---------- 시작 ---------- */
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
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") login(); })
  );
  $("logoutBtn").addEventListener("click", async () => {
    await Backend.signOut();
    location.reload();
  });

  async function login() {
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) return ($("loginError").textContent = "이메일과 비밀번호를 입력하세요.");
    $("loginBtn").disabled = true;
    $("loginError").textContent = "";
    try {
      const { error } = await Backend.signIn(email, password);
      if (error) throw error;
      await afterLogin();
    } catch (e) {
      $("loginError").textContent = /Invalid login/i.test(e.message || "")
        ? "이메일 또는 비밀번호가 올바르지 않습니다." : (e.message || "로그인 실패");
    } finally {
      $("loginBtn").disabled = false;
    }
  }

  async function afterLogin() {
    const user = await Backend.getUser();
    const { data: profile, error } = await Backend.client
      .from("profiles").select("*").eq("id", user.id).single();

    if (error || !profile) {
      $("loginError").textContent = "프로필을 불러오지 못했습니다.";
      showScreen("loginScreen");
      return;
    }
    if (profile.role !== "clinician") {
      $("loginError").textContent = "의료진 계정이 아닙니다. 이 페이지는 의료진 전용입니다.";
      await Backend.signOut();
      showScreen("loginScreen");
      return;
    }

    me = profile;
    $("userLabel").textContent = (profile.full_name || user.email) + " 님";
    $("logoutBtn").style.display = "";
    $("clinicianCode").textContent = me.id;
    showScreen("dashScreen");
    await loadPatients();
  }

  $("copyCodeBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(me.id).then(() => {
      $("copyCodeBtn").textContent = "복사됨!";
      setTimeout(() => ($("copyCodeBtn").textContent = "복사"), 1500);
    });
  });

  /* ---------- 담당 환자 목록 ---------- */
  async function loadPatients() {
    const { data, error } = await Backend.client
      .from("profiles").select("id, full_name, created_at")
      .eq("clinician_id", me.id).eq("role", "patient");

    patients = error ? [] : (data || []);
    $("patientCount").textContent = patients.length;

    const list = $("patientList");
    if (!patients.length) {
      list.innerHTML = `<li class="patient-empty">아직 연결된 환자가 없습니다.<br>위 연결 코드를 환자에게 알려주세요.</li>`;
      return;
    }
    list.innerHTML = patients.map((p) => `
      <li data-id="${p.id}">
        <div class="p-name">${escapeHtml(p.full_name) || "이름 없음"}</div>
        <div class="p-meta">등록일 ${fmtDate(p.created_at)}</div>
      </li>`).join("");

    list.querySelectorAll("li[data-id]").forEach((li) =>
      li.addEventListener("click", () => selectPatient(li.dataset.id)));
  }

  /* ---------- 환자 상세 ---------- */
  async function selectPatient(id) {
    selectedId = id;
    document.querySelectorAll("#patientList li").forEach((li) =>
      li.classList.toggle("active", li.dataset.id === id));

    const patient = patients.find((p) => p.id === id);
    $("detailEmpty").style.display = "none";
    $("detailContent").style.display = "block";
    $("detailName").textContent = (patient.full_name || "이름 없음") + " 님의 진행 현황";

    const { data, error } = await Backend.client
      .from("sessions").select("*")
      .eq("patient_id", id).order("played_at", { ascending: true });

    const sessions = error ? [] : (data || []);
    renderSummary(sessions);
    renderChart("scoreChart", sessions, (s) => s.score, "#1565c0");
    renderChart("accuracyChart", sessions, (s) => s.accuracy ?? 0, "#2e7d32", 100);
    renderTable(sessions);
  }

  function renderSummary(sessions) {
    const n = sessions.length;
    const avg = (f) => n ? Math.round(sessions.reduce((a, s) => a + (f(s) || 0), 0) / n) : 0;
    const last = n ? sessions[n - 1] : null;
    const cards = [
      ["총 플레이", n + "회"],
      ["평균 점수", avg((s) => s.score) + "점"],
      ["평균 정확도", avg((s) => s.accuracy) + "%"],
      ["최근 플레이", last ? fmtDate(last.played_at) : "-"],
    ];
    $("summaryCards").innerHTML = cards.map(([label, val]) =>
      `<div class="summary-card"><div class="s-val">${val}</div><div class="s-label">${label}</div></div>`).join("");
  }

  /* 간단한 SVG 라인 차트 */
  function renderChart(elId, sessions, valueFn, color, fixedMax) {
    const el = $(elId);
    if (!sessions.length) { el.innerHTML = `<p class="hint">데이터가 없습니다.</p>`; return; }

    const W = 640, H = 200, pad = 34;
    const vals = sessions.map(valueFn);
    const maxV = fixedMax || Math.max(10, ...vals);
    const n = vals.length;
    const x = (i) => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
    const y = (v) => H - pad - (v / maxV) * (H - 2 * pad);

    const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const dots = vals.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${color}" />`).join("");
    const gridY = [0, 0.5, 1].map((f) => {
      const gy = H - pad - f * (H - 2 * pad);
      return `<line x1="${pad}" y1="${gy}" x2="${W - pad}" y2="${gy}" stroke="#e0e0e0" />
              <text x="4" y="${gy + 4}" font-size="11" fill="#999">${Math.round(f * maxV)}</text>`;
    }).join("");

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${gridY}
      <polyline fill="none" stroke="${color}" stroke-width="2.5" points="${pts}" />
      ${dots}
    </svg>`;
  }

  function renderTable(sessions) {
    if (!sessions.length) { $("sessionTable").innerHTML = `<p class="hint">기록이 없습니다.</p>`; return; }
    const rows = [...sessions].reverse().slice(0, 20).map((s) => `
      <tr>
        <td>${fmtDateTime(s.played_at)}</td>
        <td>${GAME_NAMES[s.game] || s.game}</td>
        <td>${diffLabel(s.difficulty)}</td>
        <td>${s.score}점</td>
        <td>${s.accuracy ?? "-"}%</td>
        <td>${s.avg_reaction_ms ?? "-"} ms</td>
      </tr>`).join("");
    $("sessionTable").innerHTML = `<table>
      <thead><tr><th>일시</th><th>게임</th><th>난이도</th><th>점수</th><th>정확도</th><th>반응속도</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  /* ---------- 유틸 ---------- */
  function diffLabel(d) { return { easy: "쉬움", normal: "보통", hard: "어려움" }[d] || d; }
  function fmtDate(iso) { const d = new Date(iso); return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`; }
  function fmtDateTime(iso) { const d = new Date(iso); return `${fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`; }
  const p = (n) => String(n).padStart(2, "0");
  function escapeHtml(s) { return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  init();
})();
