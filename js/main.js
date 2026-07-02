/* ============================================================
   메인 컨트롤러: 화면 전환, 메뉴, 난이도, 결과/기록 표시
   ============================================================ */

(function () {
  const GAME_NAMES = {
    balloon: "풍선 터뜨리기",
    trace: "궤적 따라 그리기",
    memory: "순서 기억",
    recycle: "분리수거",
  };
  const GAMES = {
    balloon: window.BalloonGame,
    trace: window.TraceGame,
    memory: window.MemoryGame,
    recycle: window.RecycleGame,
  };
  const SUCCESS_LABEL = {
    balloon: "맞힌 풍선",
    trace: "궤적 복귀 성공",
    memory: "정답 터치",
    recycle: "올바르게 분류",
  };

  let difficulty = "normal";
  let currentGame = null;
  let lastResult = null;

  const $ = (id) => document.getElementById(id);
  const screens = ["authScreen", "menuScreen", "gameScreen", "resultScreen", "historyScreen"];

  function showScreen(id) {
    screens.forEach((s) => $(s).classList.toggle("active", s === id));
  }

  /* ---------- 난이도 ---------- */
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      difficulty = btn.dataset.diff;
    });
  });

  /* ---------- 게임 카드 ---------- */
  document.querySelectorAll(".game-card").forEach((card) => {
    if (card.classList.contains("disabled")) return;
    card.addEventListener("click", () => launchGame(card.dataset.game));
  });

  function launchGame(game) {
    currentGame = game;
    showScreen("gameScreen");
    $("hudScore").textContent = "0";
    $("hudTime").textContent = "0";

    const impl = GAMES[game];
    if (!impl) return;
    impl.start($("gameCanvas"), difficulty, {
      onTick: ({ score, timeLeft }) => {
        $("hudScore").textContent = score;
        $("hudTime").textContent = timeLeft;
      },
      onEnd: handleGameEnd,
    });
  }

  async function handleGameEnd(stats) {
    lastResult = stats;
    const session = {
      game: currentGame,
      difficulty,
      score: stats.score,
      accuracy: stats.accuracy,
      avgReactionMs: stats.avgReactionMs,
      durationSec: stats.durationSec,
      playedAt: new Date().toISOString(),
    };

    renderResult(session, stats);
    showScreen("resultScreen");

    $("syncStatus").textContent = "기록 저장 중…";
    try {
      const r = await Store.record(session);
      $("syncStatus").textContent = r.savedServer
        ? "✅ 서버에 저장되었습니다 (의료진 공유)."
        : "💾 기기에 저장됨 — " + r.reason;
    } catch (e) {
      $("syncStatus").textContent = "기록 저장 중 오류가 발생했습니다.";
    }
  }

  function renderResult(session, stats) {
    $("resultCard").innerHTML = `
      <div class="result-row"><span>게임</span><strong>${GAME_NAMES[session.game]}</strong></div>
      <div class="result-row"><span>난이도</span><strong>${diffLabel(session.difficulty)}</strong></div>
      <div class="result-row"><span>점수</span><strong>${stats.score}점</strong></div>
      <div class="result-row"><span>정확도</span><strong>${stats.accuracy}%</strong></div>
      <div class="result-row"><span>평균 반응 속도</span><strong>${stats.avgReactionMs} ms</strong></div>
      <div class="result-row"><span>${SUCCESS_LABEL[session.game] || "성공"}</span><strong>${stats.hits} / ${stats.clicks}회 시도</strong></div>
    `;
  }

  function diffLabel(d) {
    return { easy: "쉬움", normal: "보통", hard: "어려움" }[d] || d;
  }

  /* ---------- 결과 화면 버튼 ---------- */
  $("retryBtn").addEventListener("click", () => launchGame(currentGame));
  $("menuBtn").addEventListener("click", () => showScreen("menuScreen"));
  $("quitBtn").addEventListener("click", () => {
    if (currentGame && GAMES[currentGame]) GAMES[currentGame].stop();
    currentGame = null;
    const canvas = $("gameCanvas");
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    showScreen("menuScreen");
  });

  /* ---------- 기록 화면 ---------- */
  $("historyBtn").addEventListener("click", showHistory);
  $("historyBackBtn").addEventListener("click", () => showScreen("menuScreen"));

  /* ---------- 담당 의료진 연결 ---------- */
  $("linkBtn").addEventListener("click", async () => {
    const code = prompt("의료진에게 받은 연결 코드를 입력하세요:");
    if (!code) return;
    try {
      const user = await Backend.getUser();
      const { error } = await Backend.client
        .from("profiles").update({ clinician_id: code.trim() }).eq("id", user.id);
      if (error) throw error;
      alert("담당 의료진과 연결되었습니다. 앞으로의 기록이 의료진에게 공유됩니다.");
    } catch (e) {
      alert("연결 실패: 코드를 확인해주세요.\n" + (e.message || ""));
    }
  });

  function showHistory() {
    const sessions = Store.getLocalSessions();
    const list = $("historyList");
    if (!sessions.length) {
      list.innerHTML = `<p class="history-empty">아직 기록이 없어요. 게임을 플레이해보세요!</p>`;
    } else {
      list.innerHTML = sessions.slice(0, 30).map((s) => `
        <div class="history-item">
          <div>
            <div class="h-game">${GAME_NAMES[s.game] || s.game} · ${diffLabel(s.difficulty)}</div>
            <div class="h-meta">${formatDate(s.playedAt)}</div>
          </div>
          <div>
            <div class="h-game">${s.score}점</div>
            <div class="h-meta">정확도 ${s.accuracy}%</div>
          </div>
        </div>
      `).join("");
    }
    showScreen("historyScreen");
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- 로그인 / 인증 ---------- */
  Auth.bindShowScreen(showScreen);
  Auth.init({
    onChange: () => { refreshAuthUI(); showScreen("menuScreen"); },
    onSkip: () => showScreen("menuScreen"),
  });

  async function refreshAuthUI() {
    const label = $("userLabel");
    const btn = $("authBtn");
    if (!(window.Backend && Backend.online)) {
      label.textContent = "오프라인 모드";
      btn.style.display = "none";
      return;
    }
    const user = await Backend.getUser();
    if (user) {
      btn.textContent = "로그아웃";
      btn.onclick = async () => { await Backend.signOut(); refreshAuthUI(); };
      Store.syncPending().then((r) => {
        if (r.synced) {
          console.log(`[Sync] 밀린 기록 ${r.synced}건 업로드 완료`);
        }
      });

      // 역할에 따라 메뉴/링크 표시
      const profile = await Backend.getProfile();
      const role = profile ? profile.role : "patient";
      const name = (profile && profile.full_name) || user.email;
      label.textContent = name + (role === "clinician" ? " (의료진)" : role === "admin" ? " (관리자)" : "");

      const isPatient = role === "patient";
      $("linkBtn").style.display = isPatient ? "" : "none";       // 담당 의료진 연결(환자만)
      $("dashboardLink").style.display = (role === "clinician" || role === "admin") ? "" : "none";
      $("adminLink").style.display = (role === "admin") ? "" : "none";
    } else {
      label.textContent = "로그인 안 됨";
      btn.textContent = "로그인";
      btn.onclick = () => Auth.open("login");
      $("linkBtn").style.display = "none";
      $("dashboardLink").style.display = "none";
      $("adminLink").style.display = "none";
    }
  }

  refreshAuthUI();

  // 첫 방문 시 로그인 화면 유도 (서버 연결됐고 아직 로그인 안 했을 때)
  (async function initialScreen() {
    if (window.Backend && Backend.online) {
      const user = await Backend.getUser();
      showScreen(user ? "menuScreen" : "authScreen");
    } else {
      showScreen("menuScreen");
    }
  })();
})();
