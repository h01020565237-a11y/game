// ===== 싱글 웨이브 적 그림: 타락한 캐릭터 =====
// 아군 8명의 이동 시트(sheets[k])를 화면 밖 캔버스에 복사해 어둡게·보라 톤으로 바꾼 "타락 시트"를 따로 만들어 씀.
//   → 아군 원본 이미지(sheets)는 절대 바꾸지 않음. 픽셀을 읽지 않는 합성 방식이라 file:// 에서도 동작.
// 오라는 몸과 별개인 이펙트(바닥 빛·피어오르는 연기·보스는 고리와 외곽 빛)로 그림. 세기·크기는 CORRUPT_LOOK
const corruptSheets = {};
function corruptSheet(k) {
  if (corruptSheets[k]) return corruptSheets[k];
  const src = sheets[k];
  if (!src || !src.naturalWidth) return null;
  const c = document.createElement("canvas");
  c.width = src.naturalWidth;
  c.height = src.naturalHeight;
  const x = c.getContext("2d");
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = "multiply"; // 어둡게 + 보라 쪽으로
  x.fillStyle = CORRUPT_LOOK.tint.multiply;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "source-atop";
  x.fillStyle = CORRUPT_LOOK.tint.overlay;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = "destination-in"; // 원래 모양(투명 부분)만 남김
  x.drawImage(src, 0, 0);
  return (corruptSheets[k] = c);
}
// 오라 이펙트 (몸 뒤). power 0~1
function drawCorruptAura(a, s, power, fade) {
  const t = elapsed + a.seed, pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
  const rx = 30 * s, ry = 12 * s;
  g.save();
  g.globalAlpha = fade;
  // 바닥 빛
  const grd = g.createRadialGradient(a.x, a.y, 2, a.x, a.y, rx * 1.4);
  grd.addColorStop(0, `rgba(170, 70, 255, ${0.55 * power * pulse})`);
  grd.addColorStop(0.6, `rgba(110, 30, 200, ${0.28 * power * pulse})`);
  grd.addColorStop(1, "rgba(80, 0, 160, 0)");
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(a.x, a.y, rx * 1.4, ry * 1.4, 0, 0, 7);
  g.fill();
  // 피어오르는 보라 연기 (상태 없이 시간으로 계산)
  const n = Math.round(4 + 8 * power);
  for (let i = 0; i < n; i++) {
    const u = (t * (0.45 + 0.1 * (i % 3)) + i / n) % 1;
    const ang = i * 2.399 + a.seed;
    const px = a.x + Math.cos(ang) * rx * (0.5 + 0.4 * ((i * 37) % 10) / 10);
    const py = a.y - u * 62 * s;
    g.fillStyle = `rgba(${190 - 60 * u | 0}, ${90 - 60 * u | 0}, 255, ${(1 - u) * 0.55 * (0.4 + power * 0.6)})`;
    g.beginPath();
    g.arc(px, py, (2.2 + 2.5 * power) * (1 - u * 0.5) * s, 0, 7);
    g.fill();
  }
  // 보스: 바깥 고리
  if (power > 0.8) {
    g.strokeStyle = `rgba(200, 120, 255, ${0.5 * pulse})`;
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(a.x, a.y, rx * 1.6 + 4 * Math.sin(t * 2), ry * 1.6, 0, 0, 7);
    g.stroke();
  }
  g.restore();
}
function drawMob(a) {
  const L = a.look || CORRUPT_LOOK[a.mob], s = L.scale; // 무한 생존 적은 a.look (크기·오라)
  const appear = a.spawnT > 0 ? 1 - a.spawnT / 0.6 : 1;
  const fade = a.hp <= 0 ? Math.max(0, 1 - a.deadT / 0.6) : 1;
  const alpha = fade * Math.min(1, appear * 1.5) * (a.stealth > 0 ? 0.18 : 1); // 은신: 흐린 실루엣만
  if (a.atkAnim > 0) a.atkAnim -= 1 / 60;
  drawCorruptAura(a, s, L.aura * (a.mob === "boss" && a.hp <= a.max * MOB_TYPES.boss.enrageAt ? 1.25 : 1), alpha);
  const sh = corruptSheet(a.visual);
  if (!sh) return drawMobShape(a);
  const w = 68 * s * (0.7 + 0.3 * appear) * (a.atkAnim > 0 ? 1.08 : 1);
  const fx0 = (a.moving ? Math.floor(a.frame || 0) % 8 : 0) * 96, fy0 = (a.dir || 0) * 96;
  const x = a.x - w / 2, y = a.y - w * (56 / 68);
  g.save();
  g.globalAlpha = alpha;
  if (L.aura > 0.8) { // 보스: 몸 테두리 빛
    g.shadowColor = "#b35cff";
    g.shadowBlur = 16;
  }
  g.drawImage(sh, fx0, fy0, 96, 96, x, y, w, w);
  g.shadowBlur = 0;
  if (a.hitT > 0) { // 피격: 잠깐 밝게
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = alpha * 0.45;
    g.drawImage(sh, fx0, fy0, 96, 96, x, y, w, w);
  }
  g.restore();
  if (a.hp > 0 && appear >= 1 && a.mob !== "boss") bar(a.x, y - 6, a.hp, a.max); // 보스 체력은 화면 위 큰 막대
}
// 시트가 아직 안 불러와졌을 때 대신 그리는 간단한 모양
function drawMobShape(a) {
  const r = a.r || MOB_TYPES[a.mob]?.r || 16;
  g.fillStyle = "#4a2a6e";
  g.beginPath();
  g.arc(a.x, a.y - r, r, 0, 7);
  g.fill();
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
    if (s.heart) {
      drawHeart(s.x, s.y, s.r);
      continue;
    }
    g.fillStyle = s.color;
    g.shadowColor = "#b35cff";
    g.shadowBlur = 8;
    g.beginPath();
    g.arc(s.x, s.y, s.r, 0, 7);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "#0006";
    g.lineWidth = 2;
    g.stroke();
  }
}
