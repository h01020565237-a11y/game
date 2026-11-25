// ===== 무한 생존 그림: 보스 예고, 범위 공격 예고, 공전 칼날 =====
// 예고 모양과 실제 판정 위치·크기가 같도록 같은 값(P.radius, P.arc, P.dist, spots)을 그대로 씀
function drawEndlessTele(a) {
  if (!a.tele) return;
  const { P, t, dur, ang, x, y, spots } = a.tele, u = 1 - t / dur;
  g.save();
  g.fillStyle = `rgba(255, 70, 50, ${0.14 + 0.22 * u})`;
  g.strokeStyle = "#ff5a43";
  g.lineWidth = 3;
  const circle = (cx, cy, r) => {
    g.beginPath();
    g.arc(cx, cy, r, 0, 7);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r * u, 0, 7);
    g.fill();
  };
  if (P.k === "slam") circle(P.jump ? x : a.x, P.jump ? y : a.y, P.radius);
  else if (P.k === "charge") {
    g.translate(a.x, a.y);
    g.rotate(ang);
    g.fillRect(0, -26, P.dist, 52);
    g.strokeRect(0, -26, P.dist, 52);
    g.fillRect(0, -26, P.dist * u, 52);
  } else if (P.k === "cone") {
    const h = P.arc * Math.PI / 360;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.arc(a.x, a.y, P.radius, ang - h, ang + h);
    g.closePath();
    g.fill();
    g.stroke();
  } else if ((P.k === "traps" || P.k === "puddle" || P.k === "blastLine") && spots) for (const s of spots) circle(s.x, s.y, P.radius);
  else if (P.k === "shock") { // 착지 범위 + 충격파가 퍼질 최대 거리 (점선)
    circle(a.x, a.y, P.radius);
    g.setLineDash([10, 8]);
    g.beginPath();
    g.arc(a.x, a.y, P.max, 0, 7);
    g.stroke();
  } else if (P.k === "aoeHeal") {
    g.fillStyle = `rgba(90, 255, 140, ${0.08 + 0.15 * u})`;
    g.strokeStyle = "#7dff9a";
    circle(a.x, a.y, P.radius);
  } else if (P.k === "light" || P.k === "homing") { // 사방·부채꼴 탄 방향 미리보기
    g.setLineDash([6, 6]);
    g.strokeStyle = P.k === "light" ? "#fff3a8" : "#ff5fa2";
    const n = P.n;
    for (let i = 0; i < n; i++) {
      const v = P.k === "light" ? ang + i * Math.PI * 2 / n : ang + (i - (n - 1) / 2) * 0.55;
      g.beginPath();
      g.moveTo(a.x, a.y - 20);
      g.lineTo(a.x + Math.cos(v) * 100 * (0.4 + u), a.y - 20 + Math.sin(v) * 100 * (0.4 + u));
      g.stroke();
    }
  }
  else if (P.k === "ring" || P.k === "barrage" || P.k === "curve") {
    g.setLineDash([6, 6]);
    const n = P.k === "ring" ? P.n : P.k === "curve" ? 2 : P.n;
    for (let i = 0; i < n; i++) {
      const v = P.k === "ring" ? ang + i * Math.PI * 2 / n : ang + (i - (n - 1) / 2) * 0.28;
      g.beginPath();
      g.moveTo(a.x, a.y - 20);
      g.lineTo(a.x + Math.cos(v) * 110 * (0.4 + u), a.y - 20 + Math.sin(v) * 110 * (0.4 + u));
      g.stroke();
    }
  } else { // 소환·회복·은신 등: 보스 위 느낌표
    g.fillStyle = "#ffd23f";
    g.font = "bold 26px sans-serif";
    g.textAlign = "center";
    g.fillText("!", a.x, a.y - 90);
  }
  g.restore();
}
function drawHazards() {
  for (const h of hazards) {
    if (h.follow) {
      h.x = h.follow.x;
      h.y = h.follow.y;
    }
    if (h.shock) { // 퍼지는 충격파 고리 (틈 = 안전한 곳)
      if (h.r <= 0) continue;
      g.save();
      g.strokeStyle = `rgba(${h.color}, 0.85)`;
      g.lineWidth = h.w;
      g.lineCap = "butt";
      const gw = h.gapW, gs = h.gaps.map((x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((x, y) => x - y);
      if (!gs.length) {
        g.beginPath();
        g.arc(h.x, h.y, h.r, 0, 7);
        g.stroke();
      } else for (let i = 0; i < gs.length; i++) {
        const s0 = gs[i] + gw, s1 = (i + 1 < gs.length ? gs[i + 1] : gs[0] + Math.PI * 2) - gw;
        if (s1 <= s0) continue;
        g.beginPath();
        g.arc(h.x, h.y, h.r, s0, s1);
        g.stroke();
      }
      g.restore();
      continue;
    }
    const u = h.tick ? 1 : 1 - h.t / h.dur;
    g.save();
    if (h.ink) { // 먹물 웅덩이: 진한 보라 얼룩
      g.fillStyle = "rgba(40, 20, 60, 0.55)";
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const v = i / 12 * Math.PI * 2, rr = h.r * (0.92 + 0.08 * Math.sin(i * 2.7 + h.x));
        i ? g.lineTo(h.x + Math.cos(v) * rr, h.y + Math.sin(v) * rr * 0.8) : g.moveTo(h.x + rr, h.y);
      }
      g.fill();
    }
    g.fillStyle = `rgba(${h.color}, ${h.tick ? 0.18 : 0.12 + 0.25 * u})`;
    g.strokeStyle = `rgba(${h.color}, 0.9)`;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(h.x, h.y, h.r, 0, 7);
    g.fill();
    g.stroke();
    if (!h.tick) {
      g.beginPath();
      g.arc(h.x, h.y, h.r * u, 0, 7);
      g.fill();
    }
    g.restore();
  }
}
function drawBlades() {
  if (!singleRun?.endless || p.hp <= 0) return;
  const B = singleRun.blades, size = BLADES.size * B.size;
  for (const bl of bladePositions()) {
    g.save();
    g.translate(bl.x, bl.y - 14);
    g.rotate(bl.v * 2 + elapsed * 6);
    g.fillStyle = bl.outer ? "#9fd0ff" : "#e8f4ff";
    g.strokeStyle = "#3f6bd8";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(size * 0.35, 0);
    g.lineTo(0, size);
    g.lineTo(-size * 0.35, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
