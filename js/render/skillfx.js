// ===== 스킬 그림: 조준 경로 미리보기, 궁극기 효과, 포켓몬·분신 =====

// 포켓몬 (일반·현곤 궁극기 공통). 궁극기 포켓몬은 금색 테두리
// 그림 순서: 인게임 스프라이트(대기·이동·공격·피격, 8방향, PMD AnimData) → 없으면 공식 일러스트 1장(통통·기울기 연출) → 없으면 아이콘
const pkSheetImgs = {};
function pkSheet(src) {
  let im = pkSheetImgs[src];
  if (!im) {
    im = pkSheetImgs[src] = new Image();
    im.src = src;
  }
  return im.naturalWidth ? im : null;
}
// 게임 방향(0=위, 시계방향) → PMD 행(0=아래, 반시계: 아래·오른아래·오른·오른위·위·왼위·왼·왼아래)
const pmdRow = (dir) => (12 - (dir || 0)) % 8;
// 소환수 그래픽 팩 시트 (64칸 · 4프레임 · 8방향 북부터 시계방향 = 게임 방향 그대로)
//   상태: 공격(1번 재생 후 복귀) > 이동 > 대기. 방향은 이동·공격 방향(pt.dir)
function summonAnimState(pt, sg) {
  const F = SUMMON_FRAME, atkLen = F.dur.attack.reduce((x, y) => x + y, 0) / 60;
  let key = "idle", t = elapsed + (pt.id || 0) * 0.37, once = false;
  if (pt.atkAt !== undefined && elapsed - pt.atkAt < atkLen) (key = "attack"), (t = elapsed - pt.atkAt), (once = true);
  else if (pt.moving) key = "move";
  const im = summonImg(sg.G.anims[key]);
  if (!im) return null;
  return { im, dur: F.dur[key], t, once, row: ((pt.dir || 0) % 8 + 8) % 8, fw: F.fw, fh: F.fh, ft: F.anchor, k: F.scale * sg.grow, smooth: true };
}
function petAnimState(pt) {
  const sg = summonGfx(pt.id), ss = sg && summonAnimState(pt, sg);
  if (ss) return ss;
  const S = petSprite(pt.id);
  if (!S) return null;
  const A = S.anims, atkLen = A.attack.dur.reduce((x, y) => x + y, 0) / 60;
  let st;
  if (pt.atkAt !== undefined && elapsed - pt.atkAt < atkLen) st = { A: A.attack, t: elapsed - pt.atkAt, once: true };
  else if (pt.hitT > 0 && A.hurt) st = { A: A.hurt, t: 0.14 - pt.hitT, once: true };
  else st = pt.moving ? { A: A.walk, t: elapsed } : { A: A.idle, t: elapsed + (pt.id || 0) * 0.37 };
  const im = pkSheet(st.A.src);
  if (!im) return null;
  const row = Math.min(st.A.dirs - 1, pmdRow(pt.dir));
  return { im, dur: st.A.dur, t: st.t, once: st.once, row, fw: st.A.fw, fh: st.A.fh, feet: st.A.feet[row], k: PET_DRAW.spriteScale, smooth: false };
}
function drawPetSprite(pt) {
  const st = petAnimState(pt);
  if (!st) return false;
  const { im, dur, fw, fh, row, k } = st;
  const total = dur.reduce((x, y) => x + y, 0);
  let tick = Math.floor(st.t * 60);
  tick = st.once ? Math.min(total - 1, Math.max(0, tick)) : ((tick % total) + total) % total;
  let f = 0;
  for (let acc = 0; f < dur.length - 1 && tick >= acc + dur[f]; f++) acc += dur[f];
  const ft = st.ft || st.feet?.[f] || [fw / 2, fh * 0.75];
  const x = pt.x - ft[0] * k, y = pt.y + 6 - ft[1] * k, w = fw * k, h = fh * k;
  g.save();
  g.imageSmoothingEnabled = st.smooth; // 도트(PMD)는 또렷하게, 그래픽 팩은 부드럽게
  if (pt.fadeIn > 0) g.globalAlpha = 1 - pt.fadeIn;
  g.drawImage(im, f * fw, row * fh, fw, fh, x, y, w, h);
  if (pt.hitT > 0) { // 피격: 잠깐 하얗게
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5;
    g.drawImage(im, f * fw, row * fh, fw, fh, x, y, w, h);
  }
  g.restore();
  return true;
}
// 스프라이트가 없을 때: 공식 일러스트 1장 + 상태 연출 (대기 숨쉬기 / 이동 통통 / 공격 앞으로 / 피격 번쩍)
function drawPetArt(pt) {
  const im = petArt[pt.id];
  if (!im) return false;
  const sz = PET_DRAW.artSize, atk = pt.atkAt !== undefined && elapsed - pt.atkAt < 0.25 ? 1 - (elapsed - pt.atkAt) / 0.25 : 0;
  const bob = pt.moving ? Math.abs(Math.sin(elapsed * 12)) * 4 : Math.sin(elapsed * 3 + pt.id) * 1.2;
  const v = (pt.dir || 0) * Math.PI / 4, lx = Math.sin(v) * 6 * atk, ly = -Math.cos(v) * 6 * atk;
  const flip = (pt.dir || 0) >= 5 ? -1 : 1;
  g.save();
  g.translate(pt.x + lx, pt.y - sz * 0.45 - bob + ly);
  g.scale(flip * (1 + atk * 0.08), 1 + atk * 0.08);
  if (pt.moving) g.rotate(Math.sin(elapsed * 12) * 0.06);
  g.drawImage(im, -sz / 2, -sz / 2, sz, sz);
  if (pt.hitT > 0) {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5;
    g.drawImage(im, -sz / 2, -sz / 2, sz, sz);
  }
  g.restore();
  return true;
}
function drawPetActor(pt) {
  const col = PET_LOOK[pt.id]?.color || "#ffd23f";
  g.save();
  g.fillStyle = "#0004"; // 그림자
  g.beginPath();
  g.ellipse(pt.x, pt.y + 6, 15, 6, 0, 0, 7);
  g.fill();
  g.strokeStyle = pt.ult ? "#ffd23f" : col + "aa"; // 동료 표시: 발밑 고리 (궁극기 포켓몬은 금색)
  g.lineWidth = pt.ult ? 3 : 2;
  g.beginPath();
  g.ellipse(pt.x, pt.y + 6, 20, 9, 0, 0, 7);
  g.stroke();
  g.restore();
  if (visionOn() && inBush(pt) && !(pt.reveal > 0)) g.globalAlpha = 0.55; // 풀숲 은폐 중 (내 화면에선 반투명)
  const drawn = drawPetSprite(pt) || drawPetArt(pt);
  if (!drawn) {
    if (pt.id === 0) drawPika(pt);
    else {
      g.fillStyle = col;
      g.beginPath();
      g.arc(pt.x, pt.y - 12, 16, 0, 7);
      g.fill();
      g.font = "20px sans-serif";
      g.textAlign = "center";
      g.fillText(mons[pt.id][1], pt.x, pt.y - 5);
    }
  }
  g.globalAlpha = 1;
  bar(pt.x, pt.y - 58, pt.hp, pt.max);
  g.fillStyle = "white";
  g.font = "12px sans-serif";
  g.textAlign = "center";
  g.fillText(mons[pt.id][0], pt.x, pt.y + 26);
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

// 원거리 기본 공격 조준 표시: 곡사(포물선 + 떨어질 범위) / 직선(폭 있는 선, 벽에서 끊김)
function drawBasicAim(B, ang, len) {
  const ux = Math.cos(ang), uy = Math.sin(ang);
  g.save();
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 2;
  g.setLineDash([7, 5]);
  if (B.kind === "lob") {
    const tx = p.x + ux * len, ty = p.y + uy * len;
    g.beginPath();
    g.arc(p.x, p.y, B.range, 0, 7); // 사거리
    g.stroke();
    g.beginPath();
    g.moveTo(p.x, p.y - 20);
    g.quadraticCurveTo((p.x + tx) / 2, Math.min(p.y, ty) - 60, tx, ty);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.arc(tx, ty, B.radius, 0, 7);
    g.fill();
    g.stroke();
  } else {
    let L = 0; // 벽에 막히는 곳까지
    for (; L < len; L += 6) if (blocked(p.x + ux * L, p.y + uy * L, 2)) break;
    g.translate(p.x, p.y);
    g.rotate(ang);
    g.fillRect(0, -B.width, L, B.width * 2);
    g.strokeRect(0, -B.width, L, B.width * 2);
  }
  g.restore();
}
