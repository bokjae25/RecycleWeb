/* ============================================================
   풍선 터뜨리기 게임
   - 화면에 풍선이 떠오르고, 클릭/터치하면 터짐
   - 재활 목표: 손-눈 협응, 반응 속도, 정확도
   - 난이도: 풍선 크기·속도·생성 간격 조절
   - 측정: 점수, 정확도(맞힌 수 / 전체 클릭), 평균 반응 시간
   ============================================================ */

window.BalloonGame = (function () {
  const DIFFS = {
    easy:   { radius: 55, speed: 45,  interval: 1100, duration: 45 },
    normal: { radius: 42, speed: 75,  interval: 850,  duration: 40 },
    hard:   { radius: 30, speed: 115, interval: 600,  duration: 35 },
  };
  const COLORS = ["#ef5350", "#ffca28", "#66bb6a", "#42a5f5", "#ab47bc", "#ff7043"];

  let canvas, ctx, cfg;
  let balloons = [];
  let score = 0, hits = 0, clicks = 0;
  let reactionTimes = [];
  let timeLeft = 0, running = false;
  let spawnTimer = 0, lastTs = 0;
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

    balloons = [];
    score = 0; hits = 0; clicks = 0;
    reactionTimes = [];
    timeLeft = cfg.duration;
    spawnTimer = 0;
    running = true;
    lastTs = performance.now();
    onTick({ score, timeLeft: Math.ceil(timeLeft) });
    requestAnimationFrame(loop);
  }

  function resize() {
    const w = canvas.clientWidth;
    canvas.width = w;
    canvas.height = Math.round(w * 0.62);
  }

  function spawn() {
    const r = cfg.radius;
    balloons.push({
      x: r + Math.random() * (canvas.width - 2 * r),
      y: canvas.height + r,
      r,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      born: performance.now(),
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    timeLeft -= dt;
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) { spawn(); spawnTimer = cfg.interval; }

    for (const b of balloons) {
      b.y -= cfg.speed * dt;
      b.wobble += dt * 2;
      b.x += Math.sin(b.wobble) * 0.4;
    }
    // 화면 위로 벗어난 풍선 제거 (놓친 것)
    balloons = balloons.filter((b) => b.y + b.r > -5);

    draw();
    onTick({ score, timeLeft: Math.max(0, Math.ceil(timeLeft)) });

    if (timeLeft <= 0) return finish();
    requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of balloons) {
      // 풍선 몸통
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 0.85, b.r, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      // 하이라이트
      ctx.beginPath();
      ctx.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.22, b.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fill();
      // 매듭 + 줄
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.r);
      ctx.lineTo(b.x, b.y + b.r + 18);
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function onPointer(e) {
    if (!running) return;
    clicks++;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    // 가장 위(먼저 나온)에 그려진 것부터 검사하려면 뒤에서부터
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i];
      const dx = px - b.x, dy = py - b.y;
      if (dx * dx + dy * dy <= b.r * b.r * 1.1) {
        hits++;
        score += difficultyBonus();
        reactionTimes.push(performance.now() - b.born);
        pop(b);
        balloons.splice(i, 1);
        return;
      }
    }
  }

  function difficultyBonus() {
    if (cfg.radius <= 30) return 15;
    if (cfg.radius <= 42) return 10;
    return 5;
  }

  function pop(b) {
    // 간단한 터짐 효과
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
  }

  function finish() {
    running = false;
    cleanup();
    const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
    const avgReaction = reactionTimes.length
      ? Math.round(reactionTimes.reduce((a, c) => a + c, 0) / reactionTimes.length)
      : 0;
    onEnd({
      score,
      hits,
      clicks,
      accuracy,
      avgReactionMs: avgReaction,
      durationSec: cfg.duration,
    });
  }

  function stop() { running = false; cleanup(); }

  function cleanup() {
    window.removeEventListener("resize", resize);
    if (canvas) canvas.removeEventListener("pointerdown", onPointer);
  }

  return { start, stop };
})();
