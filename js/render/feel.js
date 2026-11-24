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

// 손에 든 무기 (공격 모션 포함)
function drawHeldWeapon(a, k) {
  const sheet = attackSheets[k];
  if (a.swing && sheet && sheet.naturalWidth && ATTACK_SPRITES[k].weaponInHand) return;
  const art = WEAPON_ART[a.w], im = weaponIcons[a.w];
  const ang = aimAngle(a), cos = Math.cos(ang), sin = Math.sin(ang);
  const feel = WEAPON_FEEL[a.w];
  const u = a.swing ? clamp(a.swing.t / a.swing.dur, 0, 1) : 1;
  let rot = ang, reach = 13, back = 0;
  if (a.swing && a.swing.kind === "melee") {
    const e = 1 - Math.pow(1 - u, 3); // 빠르게 휘두르고 천천히 멈춤
    rot = ang + (feel.swing || 1) * (e - 0.5);
    reach = 13 + Math.sin(u * Math.PI) * 8;
  } else if (a.swing && a.swing.kind === "gun") {
    back = (feel.recoil || 6) * Math.pow(1 - u, 2); // 반동: 뒤로 밀렸다 돌아옴
  } else if (a.swing && a.swing.kind === "throw") {
    rot = ang - 1.2 + u * 1.6;
    reach = 8 + u * 10;
  }
  const hx = a.x + Math.cos(rot) * reach - cos * back, hy = a.y - 22 + Math.sin(rot) * reach * 0.8 - sin * back;
  // 맨손: 주먹 휘두를 때만 작은 주먹 표시
  if (!art || !im || !im.naturalWidth) {
    if (a.swing && a.swing.kind === "melee") {
      g.fillStyle = "#f2c9a0";
      g.strokeStyle = "#7a4d2b";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(hx, hy, 5, 0, 7);
      g.fill();
      g.stroke();
    }
    return;
  }
  const s = art.size;
  g.save();
  g.translate(hx, hy);
  g.rotate(rot - art.angle);
  // 왼쪽을 향할 때 무기가 뒤집혀 보이지 않게 위아래 반전
  if (Math.cos(rot) < -0.05) {
    g.rotate(art.angle);
    g.scale(1, -1);
    g.rotate(-art.angle);
  }
  g.drawImage(im, -art.grip[0] * s, -art.grip[1] * s, s, s);
  g.restore();
  // 근접 휘두르기 잔상
  if (a.swing && a.swing.kind === "melee" && a.w > 0) {
    const arc = feel.swing || 1;
    g.save();
    g.globalAlpha = 0.55 * (1 - u);
    g.strokeStyle = "#ffffff";
    g.lineWidth = a.w === 2 ? 7 : 5;
    g.lineCap = "round";
    g.beginPath();
    g.arc(a.x, a.y - 20, 30 + (a.w === 2 ? 8 : 0), ang - arc / 2, ang - arc / 2 + arc * (1 - Math.pow(1 - u, 3)));
    g.stroke();
    g.restore();
  }
}

// 무기를 몸 뒤에 그릴지 (위쪽을 볼 때)
function weaponBehind(a) {
  return Math.sin(aimAngle(a)) < -0.35;
}

// 캐릭터 + 무기 + 피격 깜빡임 + 피격 흔들림
function drawActorWithFeel(a, k) {
  const jitter = a.hitT > 0 ? (fxRand() * 2 - 1) * 2.5 : 0;
  g.save();
  g.translate(jitter, 0);
  const behind = weaponBehind(a);
  if (behind) drawHeldWeapon(a, k);
  drawBody(a, k);
  if (a.hitT > 0) {
    // 하얗게 번쩍: 같은 그림을 '밝게 더하기'로 한 번 더 그림
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a.hitT / 0.14) * 0.75;
    drawBody(a, k);
    g.restore();
  }
  if (!behind) drawHeldWeapon(a, k);
  g.restore();
}

// 몸: 공격 모션 시트가 있으면 공격 중 그 시트, 아니면 이동 시트를 바라보는 방향으로
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

// 총구 불꽃 (fx.muzzle)
function drawMuzzle(f) {
  const o = f.owner, art = WEAPON_ART[o.w];
  const len = (art ? art.size * 0.75 : 20) + 8;
  const x = o.x + Math.cos(f.ang) * len, y = o.y - 22 + Math.sin(f.ang) * len * 0.8;
  g.save();
  g.globalAlpha = Math.min(1, f.t / 0.08);
  g.translate(x, y);
  g.rotate(f.ang);
  const s = f.big ? 1.5 : 1;
  g.fillStyle = "#fff6c2";
  g.beginPath();
  g.moveTo(0, -5 * s);
  g.lineTo(18 * s, 0);
  g.lineTo(0, 5 * s);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffb52e";
  g.beginPath();
  g.arc(2, 0, 6 * s, 0, 7);
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
