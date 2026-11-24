// ===== 싱글 웨이브 적 그림 (임시 도형) =====
// 전용 그래픽 에셋이 오면 drawMob 안에서 이미지로 바꾸면 됨. 판정 크기는 MOB_TYPES[].r

function drawMob(a) {
  const T = MOB_TYPES[a.mob], r = T.r, t = elapsed;
  const appear = a.spawnT > 0 ? 1 - a.spawnT / 0.6 : 1;
  const fade = a.hp <= 0 ? Math.max(0, 1 - a.deadT / 0.6) : 1;
  const bob = a.moving ? Math.sin(t * 12 + a.x) * 2 : Math.sin(t * 3 + a.y) * 1;
  const atk = a.atkAnim > 0 ? (a.atkAnim -= 1 / 60, 1) : 0;
  const flash = a.hitT > 0;
  g.save();
  g.globalAlpha = fade * Math.min(1, appear * 1.5);
  // 그림자
  g.fillStyle = "#0005";
  g.beginPath();
  g.ellipse(a.x, a.y + 6, r * 1.05, r * 0.45, 0, 0, 7);
  g.fill();
  g.translate(a.x, a.y - r * 0.9 + bob);
  const s = (0.6 + 0.4 * appear) * (1 + atk * 0.12);
  g.scale(s, s);
  const body = flash ? "#ffffff" : T.color;
  if (a.mob === "melee") {
    // 가시 덩굴: 둥근 몸 + 가시 + 눈
    g.fillStyle = T.accent;
    for (let i = 0; i < 7; i++) {
      const v = i / 7 * Math.PI * 2 + t * 0.6;
      g.beginPath();
      g.moveTo(Math.cos(v) * r * 0.8, Math.sin(v) * r * 0.8);
      g.lineTo(Math.cos(v + 0.22) * r * 1.35, Math.sin(v + 0.22) * r * 1.35);
      g.lineTo(Math.cos(v + 0.44) * r * 0.8, Math.sin(v + 0.44) * r * 0.8);
      g.fill();
    }
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, r, 0, 7);
    g.fill();
  } else if (a.mob === "ranged") {
    // 포자 버섯: 기둥 + 갓 + 점무늬
    g.fillStyle = flash ? "#fff" : "#efe3cf";
    g.fillRect(-r * 0.45, -r * 0.1, r * 0.9, r * 1.0);
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, -r * 0.2, r * 1.15, r * 0.85, 0, Math.PI, 0);
    g.closePath();
    g.fill();
    g.fillStyle = T.accent;
    for (const [x, y, k] of [[-0.5, -0.55, 0.18], [0.35, -0.7, 0.14], [0.55, -0.35, 0.12]]) {
      g.beginPath();
      g.arc(x * r, y * r, k * r, 0, 7);
      g.fill();
    }
  } else {
    // 정글 거목(보스): 둥치 + 가지 + 잎 + 빛나는 눈
    g.fillStyle = flash ? "#fff" : "#4f3720";
    g.fillRect(-r * 0.75, -r * 0.2, r * 1.5, r * 1.15);
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, -r * 0.25, r * 0.95, 0, 7);
    g.fill();
    g.fillStyle = flash ? "#fff" : T.accent;
    for (let i = 0; i < 6; i++) {
      const v = -Math.PI + i / 5 * Math.PI;
      g.beginPath();
      g.arc(Math.cos(v) * r * 0.9, -r * 0.55 + Math.sin(v) * r * 0.65, r * 0.42, 0, 7);
      g.fill();
    }
    const enr = a.hp <= a.max * T.enrageAt;
    g.fillStyle = enr ? "#ff4b3e" : "#ffe46b";
    g.shadowColor = g.fillStyle;
    g.shadowBlur = 10;
  }
  // 눈 (플레이어 쪽을 봄)
  const ang = Math.atan2(p.y - a.y, p.x - a.x), ex = Math.cos(ang) * r * 0.18, ey = Math.sin(ang) * r * 0.12;
  if (a.mob !== "boss") g.fillStyle = "#1b1b24";
  const eyeY = a.mob === "ranged" ? r * 0.35 : a.mob === "boss" ? -r * 0.1 : -r * 0.1, eyeR = a.mob === "boss" ? r * 0.13 : r * 0.17;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(sx * r * 0.32 + ex, eyeY + ey, eyeR, 0, 7);
    g.fill();
  }
  g.restore();
  if (a.hp > 0 && appear >= 1) {
    const top = a.y - r * 2.1 - 8;
    if (a.mob === "boss") return; // 보스 체력은 화면 위 큰 막대로 표시
    bar(a.x, top, a.hp, a.max);
  }
}
// 보스 패턴 예고 (바닥 표시)
function drawBossTele(a) {
  if (!a.tele) return;
  const { P, t, dur, ang } = a.tele, u = 1 - t / dur;
  g.save();
  g.fillStyle = `rgba(255,70,50,${0.12 + 0.22 * u})`;
  g.strokeStyle = "#ff5a43";
  g.lineWidth = 3;
  if (P.kind === "slam") {
    g.beginPath();
    g.arc(a.x, a.y, P.radius, 0, 7);
    g.fill();
    g.stroke();
    g.beginPath();
    g.arc(a.x, a.y, P.radius * u, 0, 7);
    g.fill();
  } else if (P.kind === "charge") {
    g.translate(a.x, a.y);
    g.rotate(ang);
    g.fillRect(0, -26, P.dist, 52);
    g.strokeRect(0, -26, P.dist, 52);
    g.fillRect(0, -26, P.dist * u, 52);
  } else if (P.kind === "ring") {
    g.setLineDash([6, 6]);
    for (let i = 0; i < P.count; i++) {
      const v = ang + i * Math.PI * 2 / P.count;
      g.beginPath();
      g.moveTo(a.x, a.y - 20);
      g.lineTo(a.x + Math.cos(v) * 90 * (0.4 + u), a.y - 20 + Math.sin(v) * 90 * (0.4 + u));
      g.stroke();
    }
  }
  g.restore();
}
function drawMobShots() {
  for (const s of mobShots) {
    g.fillStyle = "#0004";
    g.beginPath();
    g.ellipse(s.x, s.y + 18, s.r, s.r * 0.4, 0, 0, 7);
    g.fill();
    g.fillStyle = s.color;
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, 7);
    g.fill();
    g.strokeStyle = "#0006";
    g.lineWidth = 2;
    g.stroke();
  }
}
