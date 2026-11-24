// 타격감 그리기: 화면 흔들림, 손에 든 무기, 공격 모션, 타격 이펙트, 피격 깜빡임
// (게임 판정과 무관한 그림 전용. 게임 난수(Math.random)를 쓰지 않음 → 리플레이·테스트에 영향 없음)

let fxSeed = 12345;
function fxRand() {
  fxSeed = (fxSeed * 1103515245 + 12345) & 0x7fffffff;
  return fxSeed / 0x7fffffff;
}

// 화면 흔들림
let shakeAmt = 0, shakeLast = 0;
function shake(px) {
  shakeAmt = Math.max(shakeAmt, px);
}
function shakeOffset() {
  const now = performance.now(), dt = Math.min(0.1, (now - shakeLast) / 1000 || 0);
  shakeLast = now;
  shakeAmt *= Math.pow(0.0005, dt); // 약 0.25초에 거의 사라짐
  if (shakeAmt < 0.3) return [0, 0];
  return [(fxRand() * 2 - 1) * shakeAmt, (fxRand() * 2 - 1) * shakeAmt];
}

const dirToAngle = (d) => d * Math.PI / 4 - Math.PI / 2;
const angleToDir = (ang) => (Math.round(Math.atan2(Math.cos(ang), -Math.sin(ang)) / (Math.PI / 4)) + 8) % 8;

// 그림에서 바라보는 방향: 공격 직후(aimT)에는 공격 방향, 아니면 이동 방향
function faceDir(a) {
  return a.aimT > 0 && a.attackAng !== undefined ? angleToDir(a.attackAng) : a.dir || 0;
}
function aimAngle(a) {
  return a.aimT > 0 && a.attackAng !== undefined ? a.attackAng : dirToAngle(a.dir || 0);
}

// ===== 공격 모션 (docs/ATTACK_ANIMATION.md) =====
// swing = { kind, w, t, dur } : 공격이 실제로 일어난 순간 기록 (탄창 부족 등으로 실패하면 기록 안 됨)
// 단계: 0 준비 → 1 공격 → 2 복귀. 이동 방향과 공격 방향은 따로 (aimT 동안 공격 방향을 바라봄)
function swingPhase(sw) {
  const ph = WEAPON_FEEL[sw.w].phases, ms = sw.t * 1000;
  if (ms < ph[0]) return [0, ms / ph[0]];
  if (ms < ph[0] + ph[1]) return [1, (ms - ph[0]) / ph[1]];
  return [2, Math.min(1, (ms - ph[0] - ph[1]) / ph[2])];
}
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u;

// 무기 모션 계산: 회전 보정, 손에서 뻗는 거리, 반동, 섬광 세기
function weaponPose(a) {
  const sw = a.swing, pose = { rot: 0, reach: 4, back: 0, flash: 0, lift: 0, body: 0, w: a.w, trail: 0 };
  if (!sw) return pose;
  const f = WEAPON_FEEL[sw.w], [ph, u] = swingPhase(sw);
  pose.w = sw.w;
  if (sw.kind === "melee") {
    const arc = f.swing || 1;
    if (sw.w === 0) {
      // 맨손: 살짝 당겼다가 앞으로 지르기
      pose.reach = ph === 0 ? 4 - 5 * easeOut(u) : ph === 1 ? -1 + 16 * easeOut(u) : 15 - 11 * easeIn(u);
    } else {
      pose.rot = ph === 0 ? -arc / 2 * easeOut(u) : ph === 1 ? -arc / 2 + arc * easeOut(u) : arc / 2 * (1 - easeIn(u));
      pose.reach = 4 + (ph === 1 ? Math.sin(u * Math.PI) * 9 : 0);
      if (sw.w === 2) pose.lift = ph === 0 ? -8 * easeOut(u) : ph === 1 ? -8 + 12 * easeIn(u) : 4 * (1 - u); // 망치: 들어올렸다 내려찍기
    }
    pose.trail = ph === 1 ? easeOut(u) : ph === 2 ? 1 : 0;
    pose.trailFade = ph === 2 ? 1 - u : 1;
    pose.body = (f.body || 0) * (ph === 1 ? Math.sin(u * Math.PI) : 0);
  } else if (sw.kind === "gun") {
    pose.lift = ph === 0 ? -2 * easeOut(u) : 0;
    pose.back = ph === 0 ? 0 : ph === 1 ? (f.recoil || 6) * (1 - 0.4 * u) : (f.recoil || 6) * 0.6 * (1 - easeOut(u));
    pose.flash = ph === 1 ? 1 - u : 0;
    pose.body = (f.body || 0) * (ph === 1 ? 1 : ph === 2 ? 1 - easeOut(u) : 0);
  } else if (sw.kind === "throw") {
    pose.rot = ph === 0 ? -1.4 * easeOut(u) : ph === 1 ? -1.4 + 1.8 * easeOut(u) : 0.4 * (1 - u);
    pose.reach = ph === 1 ? 4 + 10 * u : 4;
    pose.released = ph === 2 || (ph === 1 && u > 0.5); // 공격 단계 중간에 손을 떠남
    pose.body = (f.body || 0) * (ph === 1 ? Math.sin(u * Math.PI) : 0);
  }
  return pose;
}

// 손 위치: 바라보는 방향별 손 앵커 + 캐릭터 보정
function handPoint(a, k) {
  const A = HAND_ANCHORS[faceDir(a)], o = HAND_OFFSET[k] || {};
  return { x: a.x + A.x + (o.x || 0), y: a.y + A.y + (o.y || 0), behind: A.behind };
}

// 손에 든 무기 그리기
function drawHeldWeapon(a, k, pose) {
  const sheet = attackSheets[k];
  if (a.swing && sheet && sheet.naturalWidth && ATTACK_SPRITES[k].weaponInHand) return;
  // 수류탄을 던지는 동안에는 주무기 대신 수류탄을 손에 듦 (던진 뒤에는 아무것도 안 듦)
  const w = a.swing && a.swing.kind === "throw" ? (pose.released ? -1 : GRENADE.weaponId) : a.w;
  const ang = aimAngle(a), rot = ang + pose.rot;
  const H = handPoint(a, k);
  const cx = Math.cos(ang), sy = Math.sin(ang);
  const hx = H.x + Math.cos(rot) * pose.reach - cx * pose.back;
  const hy = H.y + Math.sin(rot) * pose.reach * 0.8 - sy * pose.back + pose.lift;
  if (w < 0) return;
  const art = WEAPON_ART[w], im = weaponIcons[w];
  if (!art || !im || !im.naturalWidth) {
    // 맨손: 공격할 때만 주먹 표시
    if (a.swing && a.swing.kind === "melee") {
      g.fillStyle = "#f2c9a0";
      g.strokeStyle = "#7a4d2b";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(hx, hy, 5.5, 0, 7);
      g.fill();
      g.stroke();
    }
    return;
  }
  const sz = art.size;
  g.save();
  g.translate(hx, hy);
  g.rotate(rot - art.angle);
  // 왼쪽을 향할 때 무기가 뒤집혀 보이지 않게 위아래 반전
  if (Math.cos(rot) < -0.05) {
    g.rotate(art.angle);
    g.scale(1, -1);
    g.rotate(-art.angle);
  }
  g.drawImage(im, -art.grip[0] * sz, -art.grip[1] * sz, sz, sz);
  g.restore();
  // 총구 섬광 (공격 단계에서만)
  if (pose.flash > 0) {
    const fl = WEAPON_FEEL[a.swing.w].flash, len = sz * (1 - art.grip[0]) + 4;
    drawMuzzleAt(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len * 0.8, ang, fl[0], fl[1], pose.flash);
  }
}

// 근접 베기 궤적
function drawSlashTrail(a, pose) {
  if (!pose.trail || !a.swing || a.swing.kind !== "melee") return;
  const w = a.swing.w, arc = WEAPON_FEEL[w].swing || 1, ang = aimAngle(a);
  g.save();
  g.globalAlpha = 0.6 * (pose.trailFade ?? 1);
  g.strokeStyle = "#ffffff";
  g.lineWidth = w === 2 ? 8 : w === 0 ? 4 : 5;
  g.lineCap = "round";
  g.beginPath();
  const r = w === 0 ? 22 : w === 2 ? 40 : 34;
  g.arc(a.x, a.y - 20, r, ang - arc / 2, ang - arc / 2 + arc * pose.trail);
  g.stroke();
  g.restore();
}

// 캐릭터 + 무기 + 몸 반동 + 피격 깜빡임
function drawActorWithFeel(a, k) {
  const pose = weaponPose(a);
  const ang = aimAngle(a);
  // 망치 충격파: 공격 단계가 끝나는 순간 한 번
  if (a.swing && a.swing.w === 2 && !a.swing.shock && swingPhase(a.swing)[0] === 2) {
    a.swing.shock = true;
    const H = handPoint(a, k);
    fx.push({ x: H.x + Math.cos(ang) * 30, y: a.y + Math.sin(ang) * 24, t: 0.35, shock: true });
  }
  const jitter = a.hitT > 0 ? (fxRand() * 2 - 1) * 2.5 : 0;
  g.save();
  g.translate(jitter + Math.cos(ang) * pose.body, Math.sin(ang) * pose.body * 0.6);
  const behind = handPoint(a, k).behind;
  if (behind) drawHeldWeapon(a, k, pose);
  drawBody(a, k);
  if (a.hitT > 0) {
    // 하얗게 번쩍: 같은 그림을 '밝게 더하기'로 한 번 더 그림
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a.hitT / 0.14) * 0.75;
    drawBody(a, k);
    g.restore();
  }
  if (!behind) drawHeldWeapon(a, k, pose);
  drawSlashTrail(a, pose);
  g.restore();
}

// 사망: 0.6초 동안 하얗게 바래며 가라앉는 임시 효과 (사망 스프라이트는 별도 작업)
function drawDeath(a, k) {
  const now = performance.now();
  if (!a._deadAt) a._deadAt = now;
  const u = (now - a._deadAt) / 600;
  if (u >= 1) return;
  g.save();
  g.globalAlpha = 1 - u;
  g.translate(0, u * 10);
  drawBody(a, k);
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = (1 - u) * 0.5;
  drawBody(a, k);
  g.restore();
}

// 몸: 공격 모션 시트가 있으면 공격 중 그 시트, 아니면 이동 시트를 바라보는 방향으로 (이동 그림은 왜곡하지 않음)
function drawBody(a, k) {
  const sheet = attackSheets[k];
  if (a.swing && sheet && sheet.naturalWidth) {
    const n = ATTACK_SPRITES[k].frames || 6, f = Math.min(n - 1, Math.floor(a.swing.t / a.swing.dur * n));
    g.drawImage(sheet, f * 96, faceDir(a) * 96, 96, 96, a.x - 34, a.y - 56, 68, 68);
    return;
  }
  const d = a.dir;
  a.dir = faceDir(a);
  renderActor(a, k);
  a.dir = d;
}

// 망치 충격파 (fx.shock)
function drawShock(f) {
  const u = 1 - f.t / 0.35;
  g.save();
  g.globalAlpha = 1 - u;
  g.strokeStyle = "#fff4c8";
  g.lineWidth = 5 * (1 - u) + 1;
  g.beginPath();
  g.ellipse(f.x, f.y, 14 + u * 46, 6 + u * 20, 0, 0, 7);
  g.stroke();
  g.restore();
}

// 타격 이펙트 (fx.impact)
function drawImpact(f) {
  const u = 1 - f.t / 0.22;
  const col = f.kind === "melee" ? "#ffffff" : f.kind === "gun" ? "#ffe36b" : "#ffb347";
  g.save();
  g.globalAlpha = 1 - u;
  g.strokeStyle = col;
  g.lineWidth = 3;
  g.lineCap = "round";
  const r0 = 6 + u * 10, r1 = 14 + u * 16;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + (f.seed || (f.seed = fxRand() * 6));
    g.beginPath();
    g.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
    g.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
    g.stroke();
  }
  g.fillStyle = col;
  g.globalAlpha = (1 - u) * 0.6;
  g.beginPath();
  g.arc(f.x, f.y, 9 * (1 - u) + 3, 0, 7);
  g.fill();
  g.restore();
}

// 총구 섬광: 길이 len, 폭 wid, 세기 k(0~1)
function drawMuzzleAt(x, y, ang, len, wid, k) {
  g.save();
  g.globalAlpha = Math.min(1, k * 1.4);
  g.translate(x, y);
  g.rotate(ang);
  g.fillStyle = "#fff6c2";
  g.beginPath();
  g.moveTo(0, -wid / 2);
  g.lineTo(len, 0);
  g.lineTo(0, wid / 2);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffb52e";
  g.beginPath();
  g.arc(2, 0, Math.max(4, wid * 0.55), 0, 7);
  g.fill();
  g.restore();
}

// 회복 이펙트 (fx.healRing)
function drawHealRing(f) {
  const u = 1 - f.t / 0.5;
  g.save();
  g.globalAlpha = 1 - u;
  g.strokeStyle = "#7dff8a";
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(f.x, f.y + 6, 18 + u * 26, 8 + u * 12, 0, 0, 7);
  g.stroke();
  g.restore();
}
