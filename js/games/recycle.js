/* ============================================================
   분리수거 게임
   - 화면에 나타난 쓰레기 아이템을 알맞은 분리수거함으로 드래그
   - 재활 목표: 인지(분류 판단) + 팔 뻗기·조준(드래그 앤 드롭)
   - 측정: 점수, 정확도(올바른 통에 넣은 비율), 평균 반응 속도(등장~정답 투입)
   ============================================================ */

window.RecycleGame = (function () {
  const DIFFS = {
    easy:   { bins: 2, spawnMs: 1900, itemR: 58, maxItems: 3, duration: 45 },
    normal: { bins: 3, spawnMs: 1500, itemR: 48, maxItems: 4, duration: 40 },
    hard:   { bins: 4, spawnMs: 1150, itemR: 40, maxItems: 5, duration: 38 },
  };
  const CATEGORIES = [
    { key: "paper",   label: "종이",    icon: "📄", color: "#8d6e63" },
    { key: "plastic", label: "플라스틱", icon: "🧴", color: "#42a5f5" },
    { key: "can",     label: "캔/병",   icon: "🥫", color: "#66bb6a" },
    { key: "trash",   label: "일반쓰레기", icon: "🗑️", color: "#78909c" },
  ];

  let canvas, ctx, cfg, activeCats, bins;
  let items = [];
  let dragging = null;
  let score = 0, hits = 0, drops = 0;
  let reactionTimes = [];
  let timeLeft = 0, running = false, lastTs = 0, spawnTimer = 0, rafId = null;
  let onTick, onEnd;

  function start(canvasEl, difficulty, callbacks) {
    canvas = canvasEl;
    ctx = canvas.getContext("2d");
    cfg = DIFFS[difficulty] || DIFFS.normal;
    activeCats = CATEGORIES.slice(0, cfg.bins);
    onTick = callbacks.onTick;
    onEnd = callbacks.onEnd;

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMoveDrag);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    items = []; dragging = null;
    score = 0; hits = 0; drops = 0; reactionTimes = [];
    timeLeft = cfg.duration;
    spawnTimer = 0;
    running = true;
    lastTs = performance.now();
    onTick({ score, timeLeft: Math.ceil(timeLeft) });
    rafId = requestAnimationFrame(loop);
  }

  function resize() {
    const w = canvas.clientWidth;
    canvas.width = w;
    canvas.height = Math.round(w * 0.62);
    buildBins();
  }

  function buildBins() {
    if (!canvas || !activeCats) return;
    const binH = 84, gap = 14;
    const totalW = canvas.width - gap * (activeCats.length + 1);
    const binW = totalW / activeCats.length;
    bins = activeCats.map((cat, i) => ({
      ...cat,
      x: gap + i * (binW + gap),
      y: canvas.height - binH - 10,
      w: binW,
      h: binH,
    }));
  }

  function spawnItem() {
    if (items.filter((it) => !it.dragging).length >= cfg.maxItems) return;
    const cat = activeCats[Math.floor(Math.random() * activeCats.length)];
    const r = cfg.itemR;
    const x = r + Math.random() * (canvas.width - 2 * r);
    const y = r + Math.random() * (canvas.height * 0.45);
    items.push({ ...cat, x, y, r, born: performance.now(), dragging: false });
  }

  function onDown(e) {
    if (!running) return;
    const p = toCanvasXY(e);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const dx = p.x - it.x, dy = p.y - it.y;
      if (dx * dx + dy * dy <= it.r * it.r * 1.4) {
        dragging = it;
        it.dragging = true;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
  }

  function onMoveDrag(e) {
    if (!dragging) return;
    const p = toCanvasXY(e);
    dragging.x = p.x;
    dragging.y = p.y;
  }

  function onUp() {
    if (!dragging) return;
    const bin = bins.find((b) => dragging.x >= b.x && dragging.x <= b.x + b.w && dragging.y >= b.y - 10 && dragging.y <= b.y + b.h);
    drops++;
    if (bin && bin.key === dragging.key) {
      hits++;
      score += 15;
      reactionTimes.push(performance.now() - dragging.born);
      items = items.filter((it) => it !== dragging);
    } else if (bin) {
      score = Math.max(0, score - 5);
      dragging.dragging = false;
    } else {
      dragging.dragging = false;
    }
    dragging = null;
  }

  function toCanvasXY(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function loop(ts) {
    if (!running) return;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;

    timeLeft -= dt;
    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) { spawnItem(); spawnTimer = cfg.spawnMs; }

    draw();
    onTick({ score, timeLeft: Math.max(0, Math.ceil(timeLeft)) });

    if (timeLeft <= 0) return finish();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 분리수거함
    bins.forEach((b) => {
      ctx.fillStyle = b.color + "33";
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      roundRect(b.x, b.y, b.w, b.h, 12);
      ctx.fill(); ctx.stroke();
      ctx.font = `${Math.round(b.h * 0.34)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(b.icon, b.x + b.w / 2, b.y + b.h * 0.44);
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#333";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h - 10);
    });

    // 아이템
    items.forEach((it) => {
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 3;
      ctx.fill(); ctx.stroke();
      ctx.font = `${Math.round(it.r * 1.1)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(it.icon, it.x, it.y + 1);
    });
    ctx.textBaseline = "alphabetic";
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
    cleanup();
    const accuracy = drops > 0 ? Math.round((hits / drops) * 100) : 0;
    const avgReaction = reactionTimes.length
      ? Math.round(reactionTimes.reduce((a, c) => a + c, 0) / reactionTimes.length)
      : 0;
    onEnd({ score, hits, clicks: drops, accuracy, avgReactionMs: avgReaction, durationSec: cfg.duration });
  }

  function stop() { running = false; cleanup(); }

  function cleanup() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    window.removeEventListener("resize", resize);
    if (canvas) {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMoveDrag);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    }
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { start, stop };
})();
