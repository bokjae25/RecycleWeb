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

    if (game === "balloon") {
      BalloonGame.start($("gameCanvas"), difficulty, {
        onTick: ({ score, timeLeft }) => {
          $("hudScore").textContent = score;
          $("hudTime").textContent = timeLeft;
        },
        onEnd: handleGameEnd,
      });
    }
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
      <div class="result-row"><span>맞힌 풍선</span><strong>${stats.hits} / ${stats.clicks}회 클릭</strong></div>
    `;
  }

  function diffLabel(d) {
    return { easy: "쉬움", normal: "보통", hard: "어려움" }[d] || d;
  }

  /* ---------- 결과 화면 버튼 ---------- */
  $("retryBtn").addEventListener("click", () => launchGame(currentGame));
  $("menuBtn").addEventListener("click", () => showScreen("menuScreen"));
  $("quitBtn").addEventListener("click", () => {
    if (currentGame === "balloon") BalloonGame.stop();
    showScreen("menuScreen");
  });

  /* ---------- 기록 화면 ---------- */
  $("historyBtn").addEventListener("click", showHistory);
  $("historyBackBtn").addEventListener("click", () => showScreen("menuScreen"));

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
      label.textContent = user.email || "로그인됨";
      btn.textContent = "로그아웃";
      btn.onclick = async () => { await Backend.signOut(); refreshAuthUI(); };
      Store.syncPending().then((r) => {
        if (r.synced) {
          console.log(`[Sync] 밀린 기록 ${r.synced}건 업로드 완료`);
        }
      });
    } else {
      label.textContent = "로그인 안 됨";
      btn.textContent = "로그인";
      btn.onclick = () => Auth.open("login");
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
