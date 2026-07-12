/* ============================================================
   궤적 따라 그리기 게임
   - 곡선 경로 위를 움직이는 목표점을 손가락/마우스로 계속 따라감
   - 재활 목표: 손목·팔의 부드러운 운동 범위, 정밀 제어(추적 운동)
   - 측정: 정확도(경로 위에 머문 시간 비율), 이탈→복귀 반응 속도
   ============================================================ */

window.TraceGame = (function () {
  const DIFFS = {
    // 재활 훈련에서는 급한 움직임보다 안정적인 추적이 우선이다.
    easy:   { tolerance: 58, speed: 0.22, duration: 50 },
    normal: { tolerance: 42, speed: 0.34, duration: 45 },
    hard:   { tolerance: 28, speed: 0.50, duration: 40 },
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
  let recoveryAttempts = 0;
  let score = 0, exactScore = 0;
  let lastScoreMilestone = 0;
  let scoreFlash = null;
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
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    timeLeft = cfg.duration;
    pathT = 0; pathDir = 1;
    pointer = null; onTrack = false; offSince = 0;
    onGoodTime = 0; totalTime = 0; recoveries = []; recoveryAttempts = 0;
    score = 0; exactScore = 0; lastScoreMilestone = 0; scoreFlash = null;
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

  function markOffTrack() {
    if (onTrack) {
      offSince = performance.now();
      recoveryAttempts++;
    }
    onTrack = false;
  }

  function onLeave() {
    markOffTrack();
    pointer = null;
  }

  function onDown(e) {
    onMove(e);
    if (e.pointerType !== "mouse") canvas.setPointerCapture(e.pointerId);
  }

  function onUp(e) {
    if (e.pointerType !== "mouse") onLeave();
  }

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
        // 프레임마다 반올림하면 대부분 0점이 되므로 소수점으로 누적한다.
        exactScore += dt * 20;
        score = Math.floor(exactScore);
        // 점수 획득을 캔버스 안에서도 바로 알 수 있게 표시한다.
        if (score >= lastScoreMilestone + 10) {
          const earned = Math.floor((score - lastScoreMilestone) / 10) * 10;
          lastScoreMilestone += earned;
          scoreFlash = { value: earned, x: target.x, y: target.y - 28, startedAt: performance.now() };
        }
        if (!onTrack && offSince) {
          recoveries.push(performance.now() - offSince);
          offSince = 0;
        }
        onTrack = true;
      } else {
        markOffTrack();
      }
    } else {
      markOffTrack();
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

    // 상단 HUD 외에도 게임 안에서 즉시 점수 획득 여부를 보여준다.
    if (onTrack) {
      ctx.fillStyle = "rgba(46, 125, 50, 0.92)";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓ 잘 따라가고 있어요", canvas.width / 2, 34);
    }
    if (scoreFlash) {
      const age = performance.now() - scoreFlash.startedAt;
      if (age > 800) {
        scoreFlash = null;
      } else {
        ctx.globalAlpha = 1 - age / 800;
        ctx.fillStyle = "#2e7d32";
        ctx.font = "bold 26px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`+${scoreFlash.value}점`, scoreFlash.x, scoreFlash.y - age * 0.04);
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = "start";
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
      clicks: recoveryAttempts,
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
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop };
})();
