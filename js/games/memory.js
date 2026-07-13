/* ============================================================
   순서 기억 게임
   - 3x3 타일이 순서대로 반짝이고, 같은 순서로 눌러야 함
   - 성공하면 다음 라운드는 순서가 한 칸 길어지고, 틀리면 같은 길이로 재도전
   - 재활 목표: 인지(작업기억), 손끝 정밀 터치
   - 측정: 점수, 정확도(정답 터치/전체 터치), 평균 반응 속도
   ============================================================ */

window.MemoryGame = (function () {
  const DIFFS = {
    easy:   { startLen: 2, showMs: 750, gapMs: 350, duration: 60 },
    normal: { startLen: 3, showMs: 580, gapMs: 280, duration: 50 },
    hard:   { startLen: 4, showMs: 430, gapMs: 220, duration: 45 },
  };
  const COLS = 3, ROWS = 3;
  const COLORS = ["#42a5f5", "#66bb6a", "#ffca28", "#ef5350", "#ab47bc", "#26c6da", "#ff7043", "#8d6e63", "#5c6bc0"];

  let canvas, ctx, cfg;
  let tiles = [];
  let sequence = [];
  let inputIndex = 0;
  let acceptingInput = false;
  let litIndex = -1;
  let wrongFeedback = false;
  let promptReadyAt = 0;
  let timeLeft = 0, running = false, lastTs = 0, rafId = null;
  let score = 0, hits = 0, clicks = 0;
  let reactionTimes = [];
  let runToken = 0;
  let onTick, onEnd;

  function start(canvasEl, difficulty, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    cfg = DIFFS[difficulty] || DIFFS.normal;
    onTick = callbacks.onTick;
    onEnd = callbacks.onEnd;

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointer);

    score = 0; hits = 0; clicks = 0; reactionTimes = [];
    wrongFeedback = false;
    timeLeft = cfg.duration;
    running = true;
    lastTs = performance.now();
    runToken++;
    playRound(cfg.startLen, runToken);
    onTick({ score, timeLeft: Math.ceil(timeLeft) });
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const w = canvas.clientWidth;
    canvas.width = w;
    canvas.height = Math.round(w * 0.7);
    buildTiles();
  }

  function buildTiles() {
    if (!canvas) return;
    const pad = 20;
    const cw = (canvas.width - pad * (COLS + 1)) / COLS;
    const ch = (canvas.height - pad * (ROWS + 1)) / ROWS;
    tiles = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        tiles.push({ x: pad + c * (cw + pad), y: pad + r * (ch + pad), w: cw, h: ch, color: COLORS[i % COLORS.length] });
      }
    }
  }

  function sleep(ms, token) {
    return new Promise((resolve) => setTimeout(() => resolve(token === runToken && running), ms));
  }

  function flashWholeScreen() {
    document.body.classList.remove("game-error-flash");
    // 같은 오류가 연속으로 나와도 CSS 애니메이션을 매번 처음부터 재생한다.
    void document.body.offsetWidth;
    document.body.classList.add("game-error-flash");
    setTimeout(() => document.body.classList.remove("game-error-flash"), 520);
  }

  /* 시퀀스를 보여준 뒤 입력을 받도록 전환 (같은 token 동안만 유효) */
  async function playRound(len, token) {
    sequence = Array.from({ length: len }, () => Math.floor(Math.random() * tiles.length));
    inputIndex = 0;
    acceptingInput = false;
    litIndex = -1;
    wrongFeedback = false;

    if (!(await sleep(400, token))) return;
    for (let i = 0; i < sequence.length; i++) {
      litIndex = sequence[i];
      if (!(await sleep(cfg.showMs, token))) return;
      litIndex = -1;
      if (!(await sleep(cfg.gapMs, token))) return;
    }
    acceptingInput = true;
    promptReadyAt = performance.now();
  }

  function onPointer(e) {
    if (!running || !acceptingInput) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const idx = tiles.findIndex((t) => px >= t.x && px <= t.x + t.w && py >= t.y && py <= t.y + t.h);
    if (idx < 0) return;

    clicks++;
    litIndex = idx;

    if (idx === sequence[inputIndex]) {
      hits++;
      score += 10;
      reactionTimes.push(performance.now() - promptReadyAt);
      promptReadyAt = performance.now();
      inputIndex++;
      if (inputIndex >= sequence.length) {
        score += 15;
        acceptingInput = false;
        const token = runToken;
        setTimeout(() => { if (token === runToken && running) playRound(sequence.length + 1, token); }, 500);
      }
    } else {
      acceptingInput = false;
      wrongFeedback = true;
      flashWholeScreen();
      const token = runToken;
      setTimeout(() => { if (token === runToken && running) playRound(sequence.length, token); }, 650);
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    timeLeft -= dt;

    draw();
    onTick({ score, timeLeft: Math.max(0, Math.ceil(timeLeft)) });

    if (timeLeft <= 0) return finish();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    tiles.forEach((t, i) => {
      ctx.fillStyle = wrongFeedback && i === litIndex ? "#d32f2f" : i === litIndex ? "#fff59d" : t.color;
      roundRect(t.x, t.y, t.w, t.h, 14);
      ctx.fill();
    });
    if (wrongFeedback) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillRect(0, 0, canvas.width, 118);
      ctx.fillStyle = "rgba(198, 40, 40, 0.94)";
      ctx.font = "bold 42px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("다시 도전해요!", canvas.width / 2, 54);
      ctx.font = "bold 23px sans-serif";
      ctx.fillText("같은 단계부터 다시 시작합니다", canvas.width / 2, 88);
      ctx.textAlign = "start";
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function finish() {
    running = false;
    runToken++;
    cleanup();
    const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
    const avgReaction = reactionTimes.length
      ? Math.round(reactionTimes.reduce((a, c) => a + c, 0) / reactionTimes.length)
      : 0;
    onEnd({ score, hits, clicks, accuracy, avgReactionMs: avgReaction, durationSec: cfg.duration });
  }

  function stop() { running = false; runToken++; cleanup(); }

  function cleanup() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    window.removeEventListener("resize", resize);
    if (canvas) canvas.removeEventListener("pointerdown", onPointer);
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop };
})();
