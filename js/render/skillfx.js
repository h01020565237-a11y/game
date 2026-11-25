// ===== 스킬 그림: 조준 경로 미리보기, 궁극기 효과, 포켓몬·분신 =====

// 포켓몬 (일반·현곤 궁극기 공통). 궁극기 포켓몬은 금색 테두리
function drawPetActor(pt) {
  if (pt.ult) {
    g.save();
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(pt.x, pt.y + 8, 22, 10, 0, 0, 7);
    g.stroke();
    g.restore();
  }
  if (pt.id === 0) drawPika(pt);
  else {
    g.fillStyle = "#285c9c";
    g.beginPath();
    g.arc(pt.x, pt.y, 18, 0, 7);
    g.fill();
    g.font = "24px sans-serif";
    g.textAlign = "center";
    g.fillText(mons[pt.id][1], pt.x, pt.y + 8);
  }
  bar(pt.x, pt.y - 61, pt.hp, pt.max);
  g.fillStyle = "white";
  g.font = "12px sans-serif";
  g.textAlign = "center";
  g.fillText(mons[pt.id][0], pt.x, pt.y + 30);
}
// 경수 분신: 경수 스프라이트를 반투명 파란빛으로
function drawClone(c) {
  g.save();
  g.globalAlpha = 0.55 * clamp(c.life / 0.4, 0, 1);
  g.fillStyle = "#3f8cff55";
  g.beginPath();
  g.ellipse(c.x, c.y + 8, 18, 8, 0, 0, 7);
  g.fill();
  drawActorWithFeel(c, "stripe");
  g.restore();
}
function drawHeart(x, y, r) {
  g.fillStyle = "#ff5fa2";
  g.strokeStyle = "#fff";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x, y + r);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  g.fill();
  g.stroke();
}

// 조준 경로 미리보기 (스킬 버튼을 길게 누르거나 끌 때). 모양은 SKILL_DATA 의 preview
function drawSkillPreview() {
  if (!skillAim || p.hp <= 0) return;
  const S = skillOf(skillAim.slot);
  if (!S || !S.preview) return;
  const t = clampAim(skillAim.slot, skillAim), [ux, uy] = unitTo(t), col = skillAim.slot === "r" ? "255, 210, 63" : "127, 240, 255";
  g.save();
  g.strokeStyle = `rgba(${col}, 0.9)`;
  g.fillStyle = `rgba(${col}, 0.18)`;
  g.lineWidth = 2;
  g.setLineDash([8, 6]);
  if (S.preview === "line" && S.pathPreview) { // 실제 이동 경로(벽 충돌·미끄러짐 반영)와 도착 위치
    const pts = simMovePath(p.x, p.y, ux, uy, S.range), [ex, ey] = pts[pts.length - 1];
    g.lineCap = "round";
    g.lineJoin = "round";
    g.setLineDash([]);
    g.lineWidth = S.width || 20;
    g.strokeStyle = `rgba(${col}, 0.22)`;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = `rgba(${col}, 0.9)`;
    g.setLineDash([6, 5]);
    g.stroke();
    g.setLineDash([]);
    g.beginPath(); // 도착 위치: 캐릭터 발밑 원
    g.ellipse(ex, ey + 6, 18, 9, 0, 0, 7);
    g.fill();
    g.stroke();
    skillAim.end = [ex, ey];
  } else if (S.preview === "line") {
    const len = S.range, w = S.width || 20, ang = Math.atan2(uy, ux);
    g.translate(p.x, p.y);
    g.rotate(ang);
    g.fillRect(0, -w / 2, len, w);
    g.strokeRect(0, -w / 2, len, w);
    if (S.move) { // 이동형: 도착 지점 표시 (+ 도착 판정 범위)
      g.setLineDash([]);
      g.beginPath();
      g.arc(len, 0, S.radius || 8, 0, 7);
      if (S.radius) g.fill();
      g.stroke();
    }
    if (S.blastRadius) { // 재한 궁극기: 끝 폭발 범위
      g.beginPath();
      g.arc(len, 0, S.blastRadius, 0, 7);
      g.fill();
      g.stroke();
    }
  } else if (S.preview === "curve") { // 재한 감아차기: 다음에 휘는 방향으로
    const c = curvePath(p.x, p.y, ux, uy, S.range, S.bend * (p.curveSide || 1));
    g.lineWidth = 14;
    g.strokeStyle = `rgba(${col}, 0.25)`;
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(c.p0[0], c.p0[1]);
    g.quadraticCurveTo(c.p1[0], c.p1[1], c.p2[0], c.p2[1]);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = `rgba(${col}, 0.9)`;
    g.setLineDash([8, 6]);
    g.stroke();
  } else if (S.preview === "circle") { // 위치 스킬: 사거리 원 + 떨어질 범위
    g.beginPath();
    g.arc(p.x, p.y, S.range, 0, 7);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.arc(t.x, t.y, S.radius, 0, 7);
    g.fill();
    g.stroke();
  } else if (S.preview === "cone") {
    const ang = Math.atan2(uy, ux), half = (S.arc || 90) * Math.PI / 360;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.arc(p.x, p.y, S.radius, ang - half, ang + half);
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.restore();
}

// 궁극기 바닥 효과 (캐릭터보다 먼저 그림)
function drawUltGround() {
  if (p.hp <= 0) return;
  const t = elapsed;
  if (p.zoneUlt) { // 은숙 영역
    const R = p.zoneUlt.S.radius;
    g.save();
    g.fillStyle = `rgba(92, 184, 255, ${0.16 + 0.05 * Math.sin(t * 5)})`;
    g.strokeStyle = "#8fd0ff";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(p.x, p.y, R, 0, 7);
    g.fill();
    g.stroke();
    g.restore();
  }
  if (p.tentUlt) { // 상훈 촉수 범위
    g.save();
    g.strokeStyle = "rgba(210, 91, 124, 0.6)";
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.arc(p.x, p.y, p.tentUlt.S.radius, t * 0.8, t * 0.8 + 7);
    g.stroke();
    g.restore();
  }
  if (p.punchRush) { // 동기 펀치 러시 방향
    const S = p.punchRush.S, ang = p.punchRush.ang, half = S.arc * Math.PI / 360;
    g.save();
    g.fillStyle = "rgba(255, 210, 63, 0.16)";
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.arc(p.x, p.y, S.radius, ang - half, ang + half);
    g.closePath();
    g.fill();
    g.restore();
  }
  if (p.jump) { // 정용 착지 지점
    const J = p.jump;
    g.save();
    g.strokeStyle = "#ff5a43";
    g.fillStyle = "rgba(255, 90, 67, 0.18)";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(J.tx, J.ty, J.S.radius, 0, 7);
    g.fill();
    g.stroke();
    g.restore();
  }
  if (p.heartUlt && p.heartUlt.pose > 0) drawHeart(p.x, p.y - 80, 14 + 4 * Math.sin(t * 20)); // 기섭 하트 포즈
  if (character === "suit" && p.counter >= 1) { // 동기 카운터 준비
    g.save();
    g.strokeStyle = `rgba(255, 210, 63, ${0.5 + 0.3 * Math.sin(t * 8)})`;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(p.x, p.y + 8, 24, 11, 0, 0, 7);
    g.stroke();
    g.restore();
  }
}

// 은신 근접 감지: 내 캐릭터 머리 위 빨간 느낌표
function drawStealthAlert() {
  const bob = Math.sin(elapsed * 10) * 2, x = p.x, y = p.y - 92 + bob - (p.jumpZ || 0);
  g.save();
  g.font = "bold 34px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 5;
  g.strokeStyle = "#2a0000";
  g.strokeText("!", x, y);
  g.fillStyle = "#ff2a2a";
  g.shadowColor = "#ff0000";
  g.shadowBlur = 12;
  g.fillText("!", x, y);
  g.restore();
}
