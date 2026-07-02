/* ============================================================
   궤적 따라 그리기 게임
   - 곡선 경로 위를 움직이는 목표점을 손가락/마우스로 계속 따라감
   - 재활 목표: 손목·팔의 부드러운 운동 범위, 정밀 제어(추적 운동)
   - 측정: 정확도(경로 위에 머문 시간 비율), 이탈→복귀 반응 속도
   ============================================================ */

window.TraceGame = (function () {
  const DIFFS = {
    easy:   { tolerance: 46, speed: 0.55, duration: 45 },
    normal: { tolerance: 32, speed: 0.8,  duration: 40 },
    hard:   { tolerance: 20, speed: 1.15, duration: 35 },
  };

  let canvas, ctx, cfg;
  let timeLeft = 0, running = false, lastTs = 0, rafId = null;
  let pathT = 0;           // 0~1 경로 진행도(왕복)
  let pathDir = 1;
  let pointer = null;      // 현재 포인터 위치 {x,y}
  let onTrack = false;
  let offSince = 0;        // 이탈 시작 시각
  let onGoodTime = 0, totalTime = 0;
  let recoveries = [];     // 이탈→복귀까지 걸린 시간(ms)
  let score = 0;
  let onTick, onEnd;

  function start(canvasEl, difficulty, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    cfg = DIFFS[difficulty] || DIFFS.normal;
    onTick = callbacks.onTick;
    onEnd = callbacks.onEnd;

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    timeLeft = cfg.duration;
    pathT = 0; pathDir = 1;
    pointer = null; onTrack = false; offSince = 0;
    onGoodTime = 0; totalTime = 0; recoveries = [];
    score = 0;
    running = true;
    lastTs = performance.now();
    onTick({ score, timeLeft: Math.ceil(timeLeft) });
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const w = canvas.clientWidth;
    canvas.width = w;
    canvas.height = Math.round(w * 0.55);
  }

  function onLeave() { pointer = null; }

  /* 경로: 화면을 가로지르는 물결 곡선. t(0~1) -> 좌표 */
  function pathPoint(t) {
    const marginX = 60, marginY = 70;
    const w = canvas.width - marginX * 2;
    const x = marginX + t * w;
    const y = canvas.height / 2 + Math.sin(t * Math.PI * 3) * (canvas.height / 2 - marginY);
    return { x, y };
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    pointer = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    timeLeft -= dt;
    pathT += pathDir * cfg.speed * dt * 0.35;
    if (pathT >= 1) { pathT = 1; pathDir = -1; }
    if (pathT <= 0) { pathT = 0; pathDir = 1; }

    const target = pathPoint(pathT);
    totalTime += dt;

    if (pointer) {
      const dx = pointer.x - target.x, dy = pointer.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nowOnTrack = dist <= cfg.tolerance;

      if (nowOnTrack) {
        onGoodTime += dt;
        score += Math.round(dt * 20);
        if (!onTrack && offSince) {
          recoveries.push(performance.now() - offSince);
          offSince = 0;
        }
        onTrack = true;
      } else {
        if (onTrack) offSince = performance.now();
        onTrack = false;
      }
    } else {
      onTrack = false;
    }

    draw(target);
    onTick({ score, timeLeft: Math.max(0, Math.ceil(timeLeft)) });

    if (timeLeft <= 0) return finish();
    rafId = requestAnimationFrame(loop);
  }

  function draw(target) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 경로 전체를 옅게 표시
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const p = pathPoint(i / 60);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "rgba(21,101,192,0.25)";
    ctx.lineWidth = cfg.tolerance * 2;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgba(21,101,192,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 목표점
    ctx.beginPath();
    ctx.arc(target.x, target.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = onTrack ? "#2e7d32" : "#ef5350";
    ctx.fill();

    // 사용자 포인터
    if (pointer) {
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#ff7043";
      ctx.fill();
    }
  }

  function finish() {
    running = false;
    cleanup();
    const accuracy = totalTime > 0 ? Math.round((onGoodTime / totalTime) * 100) : 0;
    const avgReaction = recoveries.length
      ? Math.round(recoveries.reduce((a, c) => a + c, 0) / recoveries.length)
      : 0;
    onEnd({
      score,
      hits: recoveries.length,
      clicks: recoveries.length,
      accuracy,
      avgReactionMs: avgReaction,
      durationSec: cfg.duration,
    });
  }

  function stop() { running = false; cleanup(); }

  function cleanup() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    window.removeEventListener("resize", resize);
    if (canvas) {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop };
})();
