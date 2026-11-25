// ===== 캐릭터 스킬 (V2: docs/CHARACTER_COMBAT_V2.md) =====
// 모든 스킬은 castSkill(슬롯, 조준점) 하나로 발동. 슬롯 "q" | "e" | "r"(궁극기)
//   조준점이 없으면(탭) 사거리 안 가장 가까운 적에게 자동 조준. 있으면(끌어서 조준·PC 마우스) 그 지점으로
// 수치는 전부 SKILL_DATA (js/data/skills.js). 진행 중인 효과는 updateSkills(dt) 가 매 프레임 처리
// 플레이어 전용 상태는 p 에 붙음 (판마다 새로 만들어짐 → 모드 간 섞이지 않음)

let ultPets = [], clones = [];

function tackleInput() {
  return Math.hypot(mvX, mvY) > 0.15 ? [mvX, mvY] : [(keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0)];
}
function skillOf(slot, ch = character) {
  if (slot === "dash") return DASH; // 공통 대시 (이동형 스킬 조작 공유)
  return SKILL_DATA[ch] && SKILL_DATA[ch][slot];
}
// ----- 이동형 스킬 공통 방향 (js/data/skills.js DASH 위 설명) -----
// aim: 끌어서 정한 지점(또는 PC 마우스). 없으면 이동 조이스틱 → 마지막 이동 방향. 적 자동 조준 안 함
function moveDir(aim) {
  if (aim) {
    const dx = aim.x - p.x, dy = aim.y - p.y, n = Math.hypot(dx, dy);
    if (n >= 1) return [dx / n, dy / n, n];
  }
  const [ix, iy] = tackleInput(), m = Math.hypot(ix, iy);
  if (m > 0.15) return [ix / m, iy / m, 0];
  const [fx0, fy0] = facingVec();
  return [fx0, fy0, 0];
}
// 이동형 스킬의 목표 지점: 방향 스킬은 이동 거리만큼, 위치 스킬(점프)은 끈 거리(탭이면 최대 거리)
function moveAim(slot, aim) {
  const S = skillOf(slot), [x, y, n] = moveDir(aim);
  const len = S.aim === "point" && n > 0 ? Math.min(n, S.range) : S.range || 120;
  const t = { x: p.x + x * len, y: p.y + y * len, dir: [x, y] };
  return S.aim === "point" ? { ...clampAim(slot, t), dir: [x, y] } : t;
}
function castDash(aim) {
  if (over || p.hp <= 0 || p.dashCD > 0 || p.tackle > 0 || p.stun > 0 || p.jump) return false;
  const [x, y] = moveDir(aim);
  p.dx = x;
  p.dy = y;
  p.dash = DASH.t;
  p.dashCD = DASH.cd;
  faceVec(x, y);
  sfx("dash", p);
  return true;
}
function facingVec() {
  return [Math.sin((p.lastMoveDir ?? p.dir) * Math.PI / 4), -Math.cos((p.lastMoveDir ?? p.dir) * Math.PI / 4)];
}
// 자동 조준: 사거리(+여유) 안에서 가장 가까운 보이는 적. 없으면 바라보는 방향
function autoAimPoint(slot) {
  const S = skillOf(slot), reach = (S.range || S.radius || 200) + 60;
  const b = minBy(bots.filter((t) => t.hp > 0 && visible(p, t) && dist(p, t) <= reach), (t) => dist(p, t));
  if (b) return { x: b.x, y: b.y, auto: true, target: b };
  const [fx0, fy0] = facingVec(), len = S.aim === "point" ? Math.min(S.range, 160) : S.range || 120;
  return { x: p.x + fx0 * len, y: p.y + fy0 * len, auto: true };
}
// 위치 스킬은 사거리 안으로 당김
function clampAim(slot, t) {
  const S = skillOf(slot);
  if (S.aim !== "point") return t;
  const dx = t.x - p.x, dy = t.y - p.y, n = Math.hypot(dx, dy) || 1, k = Math.min(1, S.range / n);
  return { x: clamp(p.x + dx * k, 20, W - 20), y: clamp(p.y + dy * k, 20, H - 20) };
}
function unitTo(t) {
  const dx = t.x - p.x, dy = t.y - p.y, n = Math.hypot(dx, dy);
  if (n < 1) return facingVec();
  return [dx / n, dy / n];
}
function faceVec(x, y) {
  p.lastMoveDir = (Math.round(Math.atan2(x, -y) / (Math.PI / 4)) + 8) % 8;
  p.dir = p.lastMoveDir;
  p.attackAng = Math.atan2(y, x);
  p.aimT = 0.35;
}
// 남은 쿨타임 (궁극기는 충전이 덜 됐으면 남은 비율)
function skillCdLeft(slot) {
  if (character === "summoner" && slot !== "r") return slot === "q" ? summonCD[deck[selected]] : swapCD;
  if (slot === "r") return p.ult >= 1 ? 0 : 1 - p.ult;
  return p.skcd ? p.skcd[slot] || 0 : 0;
}
function ultReady() {
  return p.ult >= 1 && !(p.ultT > 0);
}
// 상훈 삐짐: 가득 차 있으면 이번 스킬 피해 배율을 주고 소모
function sulkMul() {
  if (character !== "octo" || p.sulk < 1) return 1;
  p.sulk = SKILL_DATA.octo.passive.keep || 0; // 무한 생존 카드: 일부 유지
  fx.push({ x: p.x, y: p.y - 70, t: 0.7, text: "삐짐 폭발!", tcol: "#ff7ab0", big: true });
  return SKILL_DATA.octo.passive.mult;
}

function castSkill(slot, aim) {
  if (over || p.hp <= 0 || p.stun > 0 || p.jump) return false;
  if (slot === "dash") return castDash(aim);
  const S = skillOf(slot);
  if (!S) return false;
  if (character === "summoner" && slot !== "r") return slot === "q" ? summon() : summon(true);
  if (slot === "r" ? !ultReady() : p.skcd[slot] > 0) return false;
  // 이동형 스킬: 공통 방향 규칙 (자동 조준 없음). 그 밖의 스킬: 자동 조준
  const t = S.move ? moveAim(slot, aim) : S.aim === "none" ? null : clampAim(slot, aim || autoAimPoint(slot));
  if (character === "stripe" && slot !== "q") p.stealth = 0; // 은신 중 공격 스킬을 쓰면 해제
  const impl = SKILL_IMPL[character] && SKILL_IMPL[character][slot];
  if (!impl || impl(S, t) === false) return false;
  if (slot === "r") {
    p.ult = 0;
    p.ultT = S.dur || 1;
    fx.push({ x: p.x, y: p.y - 80, t: 1, text: S.name, tcol: "#ffd23f", big: true });
    shake(5);
  } else {
    p.skcd[slot] = S.cd;
    fx.push({ x: p.x, y: p.y, t: 0.65, text: S.name });
  }
  sfx(slot === "r" ? "victory" : `skill_${character}_${slot}`, p);
  return true;
}
// 예전 호출부 호환 (봇·PC 키·테스트)
function characterSkill(i, aim) {
  return castSkill(i === 1 ? "q" : "e", aim);
}

// ----- 캐릭터별 스킬 -----
const SKILL_IMPL = {
  suit: {
    q(S, t) { // 순간 돌진 바디블로
      const [x, y] = unitTo(t);
      faceVec(x, y);
      p.rush = { vx: x, vy: y, left: S.range, S, hitDone: false };
      return true;
    },
    e(S, t) { // 위빙: 정한 방향으로 짧게 몸을 빼며 회피 (공통 이동형 조작)
      const [x, y] = t.dir || unitTo(t);
      p.weave = S.dur;
      p.sideStep = { vx: x, vy: y, left: S.range }; // 미리보기와 같은 거리
      return true;
    },
    r(S, t) { // 펀치 러시
      const [x, y] = unitTo(t);
      faceVec(x, y);
      p.punchRush = { t: S.dur, tick: 0, ang: Math.atan2(y, x), S };
      return true;
    },
  },
  summoner: {
    r(S) { // 한잔했어!: 덱 3마리 동시 소환
      if (pet) {
        fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true });
        pet = null;
      }
      flight = null;
      ultPets = deck.map((id, i) => {
        const ang = -Math.PI / 2 + (i - 1) * 1.1, x = clamp(p.x + Math.cos(ang) * 70, 30, W - 30), y = clamp(p.y + Math.sin(ang) * 70, 30, H - 30);
        const m = mons[id];
        fx.push({ x, y, t: 0.55, burst: true });
        return { ...actor(terrain(x, y) || blocked(x, y) ? p.x : x, terrain(x, y) || blocked(x, y) ? p.y : y), id, hp: m[4], max: m[4], life: S.dur, owner: p, atkMul: S.atkMul, ult: true, skillCD: 0 };
      });
      return true;
    },
  },
  support: {
    q(S, t) { // 정신 차려!: 둔화탄
      const [x, y] = unitTo(t);
      faceVec(x, y);
      shots.push({ a: p, x: p.x, y: p.y, vx: x * S.speed, vy: y * S.speed, left: S.range, d: S.dmg, slow: S.slow });
      return true;
    },
    e(S) { // 걱정하지 마: 자신·주변 아군 회복 + 피해 감소
      for (const a of alliesNear(p, S.radius)) {
        healActor(a, a.max * S.heal);
        a.guardT = S.dur;
        a.guardMul = 1 - S.guard;
      }
      fx.push({ x: p.x, y: p.y, t: 0.5, ring: S.radius });
      if (S.waveDmg) for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius) hit(p, b, S.waveDmg); // 무한 생존 카드: 회복 충격파
      return true;
    },
    r(S) { // 다들 내 뒤로!: 따라다니는 영역
      p.zoneUlt = { t: S.dur, tick: 0, S };
      return true;
    },
  },
  runner: {
    q(S) {
      if (p.energy < S.cost) return false;
      p.energy -= S.cost;
      p.run = S.dur;
      return true;
    },
    e(S, t) { // 태클: 0.22초 고정 방향, 벽에 부딪히면 정지
      if (p.dash > 0) return false;
      const [x, y] = unitTo(t);
      faceVec(x, y);
      p.tx = x;
      p.ty = y;
      p.tackle = S.dashT;
      p.tackleDamage = p.run > 0 ? S.dmgRun : S.dmg;
      p.tackleHits = new Set();
      return true;
    },
    r(S) { // 나란 남자: 하트 포즈 후 하트 발사
      p.heartUlt = { pose: S.pose, t: S.dur, tick: 0, spin: 0, S };
      return true;
    },
  },
  octo: {
    q(S, t) {
      throwInk(p, S, t, "q", sulkMul());
      return true;
    },
    e(S, t) {
      throwInk(p, S, t, "e", sulkMul());
      return true;
    },
    r(S) { // 다 필요 없어!: 주변 촉수 연속 공격
      p.tentUlt = { t: S.dur, tick: 0, S, mul: sulkMul() };
      return true;
    },
  },
  stripe: {
    q(S) { // 나 안 놀아: 은신. 적은 은신 시작 위치만 기억 (실제 위치 추적 안 함)
      p.stealth = S.dur;
      p.ghost = { x: p.x, y: p.y };
      return true;
    },
    e(S, t) { // 두고 보자: 돌진 후 주변 피해
      const [x, y] = unitTo(t);
      faceVec(x, y);
      for (let j = 0; j < 8; j++) move(p, x, y, S.range / 8 / 150);
      for (const a of bots.filter((a2) => a2.hp > 0 && dist(p, a2) < S.radius)) hit(p, a, S.dmg);
      p.stealth = 0;
      return true;
    },
    r(S) { // 분신
      clones = [];
      for (let i = 0; i < S.count; i++) {
        const ang = i / S.count * Math.PI * 2;
        clones.push(Object.assign(actor(clamp(p.x + Math.cos(ang) * 30, 20, W - 20), clamp(p.y + Math.sin(ang) * 30, 20, H - 20)), { owner: p, life: S.dur, atkT: i * 0.12, spd: S.spd, clone: true, slotI: i }));
      }
      return true;
    },
  },
  soccer: {
    q(S, t) { // 드리블 돌진
      const [x, y] = unitTo(t);
      faceVec(x, y);
      for (let j = 0; j < 8; j++) move(p, x, y, S.range / 8 / 150);
      for (const a of bots.filter((a2) => a2.hp > 0 && dist(p, a2) < S.radius)) hit(p, a, S.dmg);
      return true;
    },
    e(S, t) { // 감아차기: 좌우 곡선 관통 (쏠 때마다 방향 번갈아)
      const [x, y] = unitTo(t);
      faceVec(x, y);
      const side = p.curveSide || 1;
      p.curveSide = -side;
      for (const sd of S.both ? [side, -side] : [side]) // 무한 생존 카드: 양발(좌우 동시)
        shots.push(Object.assign(curvePath(p.x, p.y, x, y, S.range, S.bend * sd), { a: p, curve: true, u: 0, speed: S.speed, d: S.dmg, hitSet: new Set(), soccer: true }));
      return true;
    },
    r(S, t) { // 내가 마무리할게: 직선 관통 + 최대 거리 폭발
      const [x, y] = unitTo(t);
      faceVec(x, y);
      const base = Math.atan2(y, x);
      for (const off of S.multi === 3 ? [-0.26, 0, 0.26] : [0]) { // 무한 생존 카드: 3방향
        const v = base + off;
        shots.push({ a: p, x: p.x, y: p.y, vx: Math.cos(v) * S.speed, vy: Math.sin(v) * S.speed, left: S.range, d: S.dmg, pierce: true, hitSet: new Set(), push: S.push, blast: S, soccer: true, big: true, ult: true });
      }
      return true;
    },
  },
  bear: {
    q(S, t) { // 네발 질주 + 부딪힌 적 넉백. 발동 순간 방향 고정, 끝나면 조이스틱대로 이동
      const [x, y] = t.dir || unitTo(t);
      faceVec(x, y);
      p.run = S.dur;
      p.runHits = new Set();
      p.moveLock = { x, y, t: S.dur };
      return true;
    },
    e(S) {
      p.heal = S.dur;
      return true;
    },
    r(S, t) { // 점프 착지
      p.jump = { sx: p.x, sy: p.y, tx: t.x, ty: t.y, t: 0, S };
      return true;
    },
  },
};
SKILL_IMPL.summoner.q = SKILL_IMPL.summoner.e = null;

// 감아차기 경로: 시작점 → 목표 방향으로 range 만큼, 옆으로 bend 만큼 휘는 2차 곡선
function curvePath(x0, y0, dx, dy, range, bend) {
  const ex = x0 + dx * range, ey = y0 + dy * range, mx = x0 + dx * range * 0.5 - dy * bend * 2, my = y0 + dy * range * 0.5 + dx * bend * 2;
  return { x: x0, y: y0, p0: [x0, y0], p1: [mx, my], p2: [ex, ey], len: range * 1.15 };
}
function bezier(s, u) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return [a * s.p0[0] + b * s.p1[0] + c * s.p2[0], a * s.p0[1] + b * s.p1[1] + c * s.p2[1]];
}
// 상훈 투척 (플레이어·봇 공통). slot "q" 먹물 폭탄 / "e" 촉수 함정
function throwInk(a, S, t, slot, mul = 1) {
  shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx: t.x, ty: t.y, t: 0.55, octo: slot === "q" ? 1 : 2, d: S.dmg * mul, S });
  a.reveal = 1.2;
}
// 봇 호환: 예전 throwOcto(a, i)
function throwOcto(a, i) {
  const S = SKILL_DATA.octo[i === 1 ? "q" : "e"];
  const b = targets(a).filter((b2) => dist(a, b2) <= S.range).sort((b2, c2) => (b2.max ? 0 : 1e3) + dist(a, b2) - (c2.max ? 0 : 1e3) - dist(a, c2))[0];
  const dx = Math.sin(a.dir * Math.PI / 4), dy = -Math.cos(a.dir * Math.PI / 4);
  throwInk(a, S, b ? { x: b.x, y: b.y } : { x: clamp(a.x + dx * S.range, 20, W - 20), y: clamp(a.y + dy * S.range, 20, H - 20) }, i === 1 ? "q" : "e");
}

// ----- 아군·회복 (공통) -----
// 같은 편: 플레이어, 플레이어의 포켓몬·궁극기 포켓몬·분신 (나중에 협동 모드가 생기면 여기만 넓히면 됨)
function isMine(a) {
  return !!a && (a === p || a === pet || a.owner === p);
}
function alliesNear(c, r) {
  return [p, ...(pet ? [pet] : []), ...ultPets].filter((a) => a.hp > 0 && dist(c, a) <= r);
}
// 회복: 실제 회복량 반환, 파란 숫자 표시, 은숙이면 궁극기 일부 충전
function healActor(a, amount, quiet) {
  const before = a.hp;
  a.hp = Math.min(a.max, a.hp + amount);
  const got = a.hp - before;
  // 은숙 카드 "넘치는 챙김": 넘친 회복을 보호막으로 (최대 HP 비율 상한)
  const cap = singleRun?.endless && singleRun.mods.shieldCap;
  if (cap && a === p && amount > got) p.shield = Math.min(p.max * cap, (p.shield || 0) + (amount - got));
  if (got <= 0) return 0;
  if (a === p || a.owner === p || a === pet) {
    a.healAcc = (a.healAcc || 0) + got;
    if (!quiet || a.healAcc >= 30) {
      fx.push({ x: a.x, y: a.y, t: 0.8, text: "+" + Math.round(a.healAcc), tcol: "#5cb8ff" });
      a.healAcc = 0;
    }
  }
  if (character === "support" && isMine(a)) chargeUlt(got * ULT_RULES.healCoef);
  return got;
}
// 궁극기 충전 (피해·회복 공통 진입점)
function chargeUlt(amount) {
  if (amount <= 0 || p.hp <= 0) return;
  if (p.ultT > 0 && !ULT_RULES.chargeDuringUlt) return;
  const base = (singleRun ? ULT_RULES.pve : ULT_RULES.pvp).base, mul = ULT_RULES.mult[character] || 1;
  const was = p.ult;
  p.ult = Math.min(1, p.ult + amount * mul * (p.ultMul || 1) / base); // ultMul: 무한 생존 카드
  if (was < 1 && p.ult >= 1) {
    fx.push({ x: p.x, y: p.y - 80, t: 1, text: "궁극기 준비!", tcol: "#ffd23f", big: true });
    sfx("reload", p);
  }
}

// ----- 매 프레임: 진행 중인 스킬 효과 -----
function updateSkills(dt) {
  const rate = p.cdRate || 1;
  if (p.skcd) for (const k in p.skcd) p.skcd[k] = Math.max(0, p.skcd[k] - dt * rate);
  for (const k of ["stealth", "weave", "guardT", "bearGuard"]) p[k] = Math.max(0, (p[k] || 0) - dt);
  if (p.moveLock && (p.moveLock.t -= dt) <= 0) p.moveLock = null; // 이동형 스킬 방향 고정 끝 → 조이스틱대로
  if (!(p.stealth > 0)) p.ghost = null;
  updateStealthAlert();
  if (p.ultT > 0) p.ultT = Math.max(0, p.ultT - dt);
  // 은숙 패시브: 안 맞은 지 idle 초 지나면 자신·주변 아군 회복
  if (character === "support") {
    const P = SKILL_DATA.support.passive;
    for (const a of alliesNear(p, P.radius)) if (elapsed - (a.lastHurt ?? -99) >= P.idle) healActor(a, a.max * P.perSec * dt, true);
  }
  // 정용: 질주 중 부딪힌 적 넉백 (1번씩), 꿀 회복
  if (character === "bear") {
    if (p.run > 0) for (const b of bots) if (b.hp > 0 && !p.runHits?.has(b) && dist(p, b) < 34) {
      p.runHits?.add(b);
      if (SKILL_DATA.bear.q.dmg) hit(p, b, SKILL_DATA.bear.q.dmg); // 무한 생존 카드: 몸통 박치기
      knock(b, b.x - p.x, b.y - p.y, SKILL_DATA.bear.q.push);
      fx.push({ x: b.x, y: b.y, t: 0.3, ring: 30 });
    }
    if (p.heal > 0) {
      const t = Math.min(dt, p.heal);
      healActor(p, p.max * SKILL_DATA.bear.e.perSec * t, true);
      p.heal -= t;
    }
  }
  if (character === "runner" || character === "bear") p.run = Math.max(0, p.run - dt);
  // 기섭 카드 "잔상": 질주 중 지나간 자리 근처 적에게 피해
  if (character === "runner" && p.run > 0 && singleRun?.endless && singleRun.mods.trail && (p.trailT = (p.trailT || 0) - dt) <= 0) {
    p.trailT = 0.4;
    for (const b of bots) if (b.hp > 0 && dist(p, b) < 40) hit(p, b, singleRun.mods.trail);
  }
  // 동기: 돌진·옆걸음·펀치 러시
  if (p.rush) {
    const R = p.rush, step = Math.min(R.left, 900 * dt), ox = p.x, oy = p.y;
    move(p, R.vx, R.vy, step / 150);
    R.left -= step;
    const b = !R.hitDone && bots.find((b2) => b2.hp > 0 && dist(p, b2) < 38);
    if (b) {
      R.hitDone = true;
      hit(p, b, R.S.dmg);
      b.stun = Math.max(b.stun || 0, R.S.stun);
      fx.push({ x: b.x, y: b.y - 20, t: 0.3, ring: 26 });
      R.left = 0;
    }
    if (R.left <= 0 || Math.hypot(p.x - ox, p.y - oy) < 0.5) p.rush = null;
    fx.push({ x: p.x, y: p.y, t: 0.15, trail: true, dir: p.dir, frame: 0 });
  }
  if (p.sideStep) {
    // 위빙: 미리보기(simMovePath)와 같은 방식으로 정확히 S.side 만큼, 같은 충돌 규칙
    // 프레임과 상관없이 MOVE_STEP 단위로 같은 순서로 이동 → 미리보기 경로와 완전히 같음
    const s = p.sideStep;
    let budget = (s.carry || 0) + 320 * dt;
    while (s.left > 0 && budget >= Math.min(MOVE_STEP, s.left) && !(p.root > 0) && !(p.stun > 0)) {
      const st = Math.min(MOVE_STEP, s.left);
      moveRaw(p, s.vx, s.vy, st);
      s.left -= st;
      budget -= st;
    }
    s.carry = budget;
    if (s.left > 0) p.dir = (Math.round(Math.atan2(s.vx, -s.vy) / (Math.PI / 4)) + 8) % 8;
    if (s.left <= 0) p.sideStep = null;
  }
  if (p.punchRush) {
    const U = p.punchRush, S = U.S;
    U.t -= dt;
    if ((U.tick -= dt) <= 0) {
      U.tick += S.tick;
      for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius && angleDiff(Math.atan2(b.y - p.y, b.x - p.x), U.ang) <= S.arc * Math.PI / 360) hit(p, b, S.dmg, { ult: true });
      fx.push({ x: p.x, y: p.y, t: 0.12, cone: true, ang: U.ang, r: S.radius, half: S.arc * Math.PI / 360 });
      p.attackAng = U.ang;
      p.aimT = 0.2;
      p.swing = { kind: "melee", w: 0, t: 0, dur: 0.12 };
    }
    if (U.t <= 0) p.punchRush = null;
  }
  // 은숙 궁극기 영역
  if (p.zoneUlt) {
    const Z = p.zoneUlt, S = Z.S;
    Z.t -= dt;
    for (const a of alliesNear(p, S.radius)) healActor(a, a.max * S.healPerSec * dt, true);
    if ((Z.tick -= dt) <= 0) {
      Z.tick += S.tick;
      for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius) {
        hit(p, b, S.dmg, { ult: true });
        b.slow = Math.max(b.slow || 0, S.slow);
      }
    }
    if (Z.t <= 0) p.zoneUlt = null;
  }
  // 기섭 궁극기: 포즈 → 사방으로 하트
  if (p.heartUlt) {
    const H = p.heartUlt, S = H.S;
    if (H.pose > 0) H.pose -= dt;
    else {
      H.t -= dt;
      if ((H.tick -= dt) <= 0) {
        H.tick += S.tick;
        H.spin += 0.35;
        for (let i = 0; i < S.hearts; i++) {
          const v = H.spin + i / S.hearts * Math.PI * 2;
          shots.push({ a: p, x: p.x, y: p.y, vx: Math.cos(v) * S.speed, vy: Math.sin(v) * S.speed, left: S.range, d: S.dmg, slow: S.slow, heart: true, ult: true, pierce: !!S.pierce, hitSet: S.pierce ? new Set() : null });
        }
      }
      if (H.t <= 0) p.heartUlt = null;
    }
  }
  // 상훈 궁극기: 주변 촉수
  if (p.tentUlt) {
    const T = p.tentUlt, S = T.S;
    T.t -= dt;
    if ((T.tick -= dt) <= 0) {
      T.tick += S.tick;
      for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius) {
        hit(p, b, S.dmg * T.mul, { ult: true });
        knock(b, b.x - p.x, b.y - p.y, S.push);
      }
      fx.push({ x: p.x, y: p.y, t: 0.35, tentacle: true, r: S.radius });
    }
    if (T.t <= 0) p.tentUlt = null;
  }
  // 정용 궁극기: 점프 → 착지
  if (p.jump) {
    const J = p.jump, S = J.S;
    J.t += dt;
    const u = Math.min(1, J.t / S.jumpT);
    p.x = J.sx + (J.tx - J.sx) * u;
    p.y = J.sy + (J.ty - J.sy) * u;
    p.jumpZ = Math.sin(Math.PI * u) * 70;
    if (u >= 1) {
      p.jump = null;
      p.jumpZ = 0;
      // 착지 지점이 막혀 있으면 출발점으로 (벽·물 속 착지 방지)
      if (terrain(p.x, p.y) || blocked(p.x, p.y)) {
        p.x = J.sx;
        p.y = J.sy;
      }
      for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius) {
        hit(p, b, S.dmg, { ult: true });
        b.stun = Math.max(b.stun || 0, S.stun);
      }
      p.bearGuard = S.guardDur;
      fx.push({ x: p.x, y: p.y, t: 0.45, explosion: true });
      shake(9);
      sfx("hammer", p);
    }
  }
  // 현곤 궁극기 포켓몬
  for (const pt of ultPets) runPet(pt, dt);
  ultPets = ultPets.filter((pt) => {
    if (pt.life > 0 && pt.hp > 0) return true;
    fx.push({ x: pt.x, y: pt.y, t: 0.55, recall: true });
    return false;
  });
  // 경수 분신
  updateClones(dt);
}
function angleDiff(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
// 넉백 (벽·물·상자 앞에서 멈춤)
function knock(b, dx, dy, distPx) {
  const n = Math.hypot(dx, dy) || 1;
  for (let i = 0; i < distPx / 6; i++) {
    const x = clamp(b.x + dx / n * 6, 18, W - 18), y = clamp(b.y + dy / n * 6, 18, H - 18);
    if (terrain(x, y) || blocked(x, y) || boxes.some((q) => dist({ x, y }, q) < 30)) break;
    b.x = x;
    b.y = y;
  }
}
// 경수 분신: 적이 1명이면 집중, 여럿이면 가까운 순으로 나눠 공격
function updateClones(dt) {
  if (!clones.length) return;
  const S = SKILL_DATA.stripe.r;
  const foes = bots.filter((b) => b.hp > 0 && !(b.stealth > 0) && dist(p, b) < 420).sort((a, b) => dist(p, a) - dist(p, b));
  for (const c of clones) {
    c.life -= dt;
    c.atkT -= dt;
    const tgt = foes.length ? foes[c.slotI % foes.length] : null;
    if (!tgt) {
      if (dist(c, p) > 50) steer(c, p.x, p.y, dt);
      else c.moving = false;
      continue;
    }
    if (dist(c, tgt) > 34) steer(c, tgt.x, tgt.y, dt);
    else {
      c.moving = false;
      c.dir = (Math.round(Math.atan2(tgt.x - c.x, c.y - tgt.y) / (Math.PI / 4)) + 8) % 8;
      if (c.atkT <= 0) {
        c.atkT = S.atkCd;
        c.attackAng = Math.atan2(tgt.y - c.y, tgt.x - c.x);
        c.aimT = 0.2;
        c.swing = { kind: "melee", w: 0, t: 0, dur: 0.2 };
        hit(c, tgt, S.dmg, { ult: true });
      }
    }
    if (c.swing && (c.swing.t += dt) >= c.swing.dur) c.swing = null;
    c.aimT = Math.max(0, (c.aimT || 0) - dt);
  }
  clones = clones.filter((c) => c.life > 0 || (fx.push({ x: c.x, y: c.y, t: 0.4, recall: true }), false));
}

// ===== 은신 공통 규칙 (경수 Q 「나 안 놀아」, 무한 생존 은신 적) =====
// - 은신한 쪽은 상대 화면에서 안 보이고 자동 조준·자동 타겟(공격·스킬·소환수·AI) 대상에서 빠짐 (visible())
// - 무적 아님: 수동 조준·광역·이미 날아간 투사체는 맞음 (canHit()), 맞아도 은신 유지, 공격하면 해제
// - 근접 감지: 은신한 적이 감지 범위(SKILL_DATA.stripe.q.detect) 안에 들어오면 내 캐릭터 머리 위에 빨간 ! (위치·방향은 안 알려줌)
function playerHidden() {
  return p.stealth > 0 && p.hp > 0;
}
// 적 AI: 은신한 플레이어의 실제 위치 대신 은신 시작 위치까지만 가서 두리번거림
function searchGhost(a, dt) {
  const gp = p.ghost || { x: a.x, y: a.y };
  a.moving = false;
  if (Math.hypot(gp.x - a.x, gp.y - a.y) > 36) steer(a, gp.x, gp.y, dt);
  else {
    a.lookT = (a.lookT || 0) - dt;
    if (a.lookT <= 0) {
      a.lookT = 0.6 + Math.random() * 0.6;
      a.dir = Math.floor(Math.random() * 8);
    }
  }
}
function stealthDetect() {
  return SKILL_DATA.stripe.q.detect;
}
// 내 화면: 은신한 적이 가까이 오면 내 캐릭터 머리 위에 ! (처음 들어올 때 경고음 1번)
function updateStealthAlert() {
  const R = stealthDetect();
  let near = false;
  if (p.hp > 0) for (let i = 0; i < bots.length && !near; i++) {
    const b = bots[i];
    if (b.hp > 0 && b.stealth > 0 && Math.hypot(b.x - p.x, b.y - p.y) <= R) near = true;
  }
  if (near && !p.stealthAlert) sfx("stealth_alert");
  p.stealthAlert = near;
}
