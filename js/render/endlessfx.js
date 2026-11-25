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
  } else if (P.k === "traps" && spots) for (const s of spots) circle(s.x, s.y, P.radius);
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
    const u = h.tick ? 1 : 1 - h.t / h.dur;
    g.save();
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
