// ===== 싱글모드: 웨이브 생존전 =====
// 배틀로얄과 분리된 상태:
//   singleRun  이번 미션 진행 상태 (null 이면 배틀로얄)
//   p.dmgMul / reloadMul / spd / cdRate / takeMul  강화 카드 효과. p 는 판마다 새로 만들어지므로 다음 판에 남지 않음
//   mobShots  웨이브 적 투사체 (플레이어 쪽만 맞음)
// 웨이브 적은 bots 배열에 mob 표시를 달고 넣음 → 기존 공격·스킬·수류탄·포켓몬 판정이 그대로 적용됨

let singleRun = null, mobShots = [];

// ----- 저장 (버전 있는 localStorage, 배틀로얄 설정과 다른 키) -----
const SINGLE_SAVE_KEY = "battlelab.single";
const SINGLE_SAVE_VERSION = 1;
function defaultSingleSave() {
  return { v: SINGLE_SAVE_VERSION, recruited: ["suit"], cleared: {}, seen: {} };
}
function loadSingleSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SINGLE_SAVE_KEY));
    if (s && s.v === SINGLE_SAVE_VERSION && Array.isArray(s.recruited)) return { ...defaultSingleSave(), ...s };
  } catch (e) {}
  return defaultSingleSave();
}
let singleSave = loadSingleSave();
function writeSingleSave() {
  try {
    localStorage.setItem(SINGLE_SAVE_KEY, JSON.stringify(singleSave));
  } catch (e) {}
}
// 영입 지급 (중복 지급 방지). 컷신 재생 전에 먼저 저장 → 스킵·종료해도 영입 유지
function grantRecruit(missionId) {
  const m = WAVE_MISSIONS[missionId] || STORY_MISSIONS[missionId];
  if (!m) return;
  if (!singleSave.recruited.includes(m.reward)) singleSave.recruited.push(m.reward);
  singleSave.cleared[missionId] = (singleSave.cleared[missionId] || 0) + 1;
  writeSingleSave();
  ROSTER.unlocked = singleSave.recruited.slice();
}
ROSTER.unlocked = singleSave.recruited.slice();

// ----- 미션 시작 (reset() 끝에서 호출) -----
function beginSingle(missionId) {
  singleRun = { id: missionId };
}
function endSingle() {
  singleRun = null;
  mobShots = [];
  restoreEndlessSkills(); // 무한 생존 카드로 바뀐 스킬 수치를 원래대로
}
function setupWaveRun() {
  if (singleRun.endless) return setupEndless(); // 무한 생존 (js/game/endless.js)
  const m = WAVE_MISSIONS[singleRun.id];
  Object.assign(singleRun, {
    m, wave: -1, phase: "intro", t: m.startDelay, queue: [], spawnT: 0, cards: [], picked: [], kills: 0, bannerT: 0, banner: "",
  });
  bots = [];
  mobShots = [];
  nextWave();
  singleRun.phase = "intro";
  singleRun.t = m.startDelay;
}
function nextWave() {
  const R = singleRun, m = R.m;
  R.wave++;
  const w = m.waves[R.wave];
  R.queue = [];
  for (const [type, n] of w.spawn) for (let i = 0; i < n; i++) R.queue.push(type);
  R.spawnT = 0;
  R.phase = "fight";
  R.banner = w.label + (R.wave === m.waves.length - 1 ? " · 보스 등장" : "");
  R.bannerT = 2.2;
  sfx("zone_warning");
}
function waveRemaining() {
  return singleRun ? singleRun.queue.length + bots.filter((b) => b.hp > 0).length : 0;
}

// ----- 적 만들기 -----
function spawnPoint(minDist) {
  for (let k = 0; k < 60; k++) {
    const x = 60 + Math.random() * (W - 120), y = 60 + Math.random() * (H - 120);
    if (Math.hypot(x - p.x, y - p.y) < minDist) continue;
    if (terrain(x, y) || blocked(x, y, 20) || nearBox(x, y, 40)) continue;
    return { x, y };
  }
  const list = activeMap.botSpawns || activeMap.enemySpawns, s = list[Math.floor(Math.random() * list.length)];
  return { x: s[0], y: s[1] };
}
function makeMob(type, at) {
  const T = MOB_TYPES[type], q = at || spawnPoint(singleRun.m.spawnMinDist);
  const a = actor(q.x, q.y);
  const look = CORRUPT_LOOK[type], vis = look.visuals[Math.floor(Math.random() * look.visuals.length)];
  Object.assign(a, { mob: type, r: T.r || 16, hp: T.hp, max: T.hp, spd: T.spd, atkT: 0.6 + Math.random() * 0.6, spawnT: 0.6, deadT: 0, visual: vis, seed: Math.random() * 100 });
  if (type === "boss") Object.assign(a, { pat: 0, patT: 2.5, tele: null, summoned: 0 });
  const sp = freeSpot(a.x, a.y, a.r); // 벽·물·상자 안에 나오지 않게 (몸 크기 기준)
  if (sp) {
    a.x = sp.x;
    a.y = sp.y;
  }
  fx.push({ x: a.x, y: a.y, t: 0.6, ring: T.r + 14 });
  bots.push(a);
  return a;
}

// ----- 매 프레임 (update 에서 호출) -----
function updateWave(dt) {
  if (singleRun.endless) return updateEndless(dt);
  const R = singleRun;
  if (R.bannerT > 0) R.bannerT -= dt;
  if (R.phase === "fight" || R.phase === "boss") contactDamage(dt); // 몸 접촉 피해 (현곤 영입 미션)
  if (R.phase === "intro") {
    if ((R.t -= dt) <= 0) R.phase = "fight";
    return;
  }
  if (R.phase !== "fight") return;
  const w = R.m.waves[R.wave];
  // 순차 등장
  R.spawnT -= dt;
  if (R.queue.length && R.spawnT <= 0 && bots.filter((b) => b.hp > 0).length < w.maxAlive) {
    makeMob(R.queue.shift());
    R.spawnT = w.interval;
  }
  // 적 행동
  for (const a of bots) {
    if (a.hp <= 0) {
      a.deadT += dt;
      continue;
    }
    if (a.spawnT > 0) {
      a.spawnT -= dt;
      continue;
    }
    if (a.stun > 0) continue;
    if (playerHidden() && !a.tele) searchGhost(a, dt); // 은신: 실제 위치를 모르고 은신 시작 위치만 수색
    else if (a.mob === "boss") bossAI(a, dt);
    else mobAI(a, dt);
  }
  // 쓰러진 적은 잠깐 보인 뒤 정리
  compact(bots, (b) => b.hp > 0 || b.deadT < 0.6);
  updateMobShots(dt);
  // 웨이브 완료
  if (!R.queue.length && !bots.some((b) => b.hp > 0)) {
    mobShots = [];
    if (R.wave >= R.m.waves.length - 1) {
      R.phase = "clear";
      return;
    }
    p.hp = Math.min(p.max, p.hp + p.max * (R.m.clearHeal || 0));
    if (w.cardsAfter) {
      R.cards = drawCards(3);
      R.phase = "cards";
    } else nextWave();
  }
}
function faceTo(a, tx, ty) {
  a.dir = (Math.round(Math.atan2(tx - a.x, a.y - ty) / (Math.PI / 4)) + 8) % 8;
}
function mobAI(a, dt) {
  const T = MOB_TYPES[a.mob], d = dist(a, p);
  a.atkT -= dt;
  if (p.hp <= 0) return;
  if (a.mob !== "boss" && !visible(a, p)) return chase(a, dt); // 못 보면 찾으러 감 (공격 안 함)
  if (a.mob === "ranged") {
    const see = d < T.range + 20 && clearLine(a, p);
    if (d > T.keep[1] || !see) chase(a, dt);
    else if (d < T.keep[0]) move(a, a.x - p.x, a.y - p.y, dt);
    else a.moving = false;
    if (see && d <= T.range && a.atkT <= 0) {
      a.atkT = T.cd * (0.85 + Math.random() * 0.3);
      faceTo(a, p.x, p.y);
      a.atkAnim = 0.3;
      const ang = Math.atan2(p.y - a.y, p.x - a.x);
      mobShots.push({ x: a.x, y: a.y - 14, vx: Math.cos(ang) * T.shot, vy: Math.sin(ang) * T.shot, left: T.range + 60, d: T.dmg, a, r: 7, color: T.accent });
      sfx("pistol", a);
    }
    return;
  }
  // 근접: 쫓아가서 붙으면 공격
  if (d > T.range + p_r()) chase(a, dt);
  else {
    a.moving = false;
    faceTo(a, p.x, p.y);
    if (a.atkT <= 0) {
      a.atkT = T.cd;
      a.atkAnim = 0.3;
      hit(a, p, T.dmg);
    }
  }
  separate(a);
}
// 쫓아가기: 막히면 옆으로 비켜 가고, 3초 동안 실제로 거의 못 다가가면(벽에 끼어 제자리 떨림 포함) 다른 곳에서 다시 등장
function chase(a, dt) {
  const goal = a.mob ? mobGoal(a) : p; // 시야: 보이면 플레이어, 놓치면 마지막 본 자리·수색 (js/game/vision.js)
  const moved = steer(a, goal.x, goal.y, dt);
  if (!moved && dist(a, goal) > 20) {
    const x = a.x, y = a.y, sign = a.avoid || (a.avoid = Math.random() < 0.5 ? 1 : -1);
    move(a, (goal.y - a.y) * sign, -(goal.x - a.x) * sign, dt);
    if (dist(a, { x, y }) < 0.1) a.avoid = -sign;
  }
  // 1.5초마다 실제 이동량 확인
  const c = a.chk || (a.chk = { x: a.x, y: a.y, t: 0, bad: 0 });
  if ((c.t += dt) >= 1.5) {
    c.bad = Math.hypot(a.x - c.x, a.y - c.y) < 12 ? c.bad + 1 : 0;
    c.x = a.x;
    c.y = a.y;
    c.t = 0;
    if (c.bad >= 2) {
      const q = spawnPoint(260);
      a.x = c.x = q.x;
      a.y = c.y = q.y;
      a._nav = null;
      c.bad = 0;
      a.spawnT = 0.6;
      fx.push({ x: a.x, y: a.y, t: 0.6, ring: (a.r || MOB_TYPES[a.mob]?.r || 16) + 14 });
    }
  }
}
function p_r() {
  return 16;
}
// 적끼리 겹치지 않게 살짝 밀어냄
function separate(a) {
  for (const b of bots) {
    if (b === a || b.hp <= 0) continue;
    const dx = a.x - b.x, dy = a.y - b.y, dd = Math.hypot(dx, dy), min = (a.r || MOB_TYPES[a.mob]?.r || 16) + (b.r || MOB_TYPES[b.mob]?.r || 16);
    if (dd > 0.01 && dd < min) {
      const k = (min - dd) / dd * 0.25, x = a.x + dx * k, y = a.y + dy * k, r = a.r || 16;
      if (!terrain(x, y, r) && !blocked(x, y, r) && !nearBox(x, y, r + 14)) { // 밀려도 벽·상자 안으로 안 들어감
        a.x = x;
        a.y = y;
      }
    }
  }
}

// ----- 보스 -----
function bossAI(a, dt) {
  const T = MOB_TYPES.boss, enr = a.hp <= a.max * T.enrageAt ? T.enrageMul : 1;
  // 체력 구간마다 소환
  while (a.summoned < T.summonAt.length && a.hp <= a.max * T.summonAt[a.summoned]) {
    a.summoned++;
    for (let i = 0; i < T.summonCount; i++) {
      const ang = Math.random() * Math.PI * 2, q = { x: clamp(a.x + Math.cos(ang) * 90, 40, W - 40), y: clamp(a.y + Math.sin(ang) * 90, 40, H - 40) };
      if (!terrain(q.x, q.y) && !blocked(q.x, q.y)) makeMob("melee", q);
    }
    singleRun.banner = `타락한 ${DISPLAY_NAMES[a.visual] || "보스"}이(가) 졸개를 불러냈다!`;
    singleRun.bannerT = 1.6;
  }
  if (a.charge) { // 돌진 중
    const c = a.charge, step = c.speed * dt;
    if (chargeStep(a, c.vx, c.vy, step)) { // 벽·물·상자에 부딪히면 그 앞에서 멈춤
      c.left = 0;
      shake(5);
    }
    c.left -= step;
    if (!c.hit && dist(a, p) < T.r + 20) {
      c.hit = true;
      hit(a, p, c.dmg);
    }
    fx.push({ x: a.x, y: a.y, t: 0.2, ring: 20 });
    if (c.left <= 0) a.charge = null;
    return;
  }
  if (a.tele) { // 예고 중
    a.tele.t -= dt;
    if (a.tele.t <= 0) fireBossPattern(a);
    return;
  }
  a.patT -= dt;
  a.atkT -= dt;
  const d = dist(a, p);
  // 평소: 천천히 쫓아가며 가까우면 휘두르기
  if (d > T.range + 20) chase(a, dt);
  else if (a.atkT <= 0) {
    a.atkT = T.cd;
    a.atkAnim = 0.35;
    faceTo(a, p.x, p.y);
    hit(a, p, T.dmg);
  }
  if (a.patT <= 0 && p.hp > 0) {
    const P = T.patterns[a.pat % T.patterns.length];
    a.pat++;
    faceTo(a, p.x, p.y);
    a.moving = false;
    const ang = Math.atan2(p.y - a.y, p.x - a.x);
    a.tele = { P, t: P.tele * enr, dur: P.tele * enr, ang, x: a.x, y: a.y };
    a.patT = (P.tele + P.rest) * enr + 1.2;
  }
}
function fireBossPattern(a) {
  const { P, ang } = a.tele;
  a.tele = null;
  a.atkAnim = 0.4;
  if (P.kind === "slam") {
    if (dist(a, p) <= P.radius + 10) hit(a, p, P.dmg);
    if (pet && dist(a, pet) <= P.radius) hit(a, pet, P.dmg);
    fx.push({ x: a.x, y: a.y, t: 0.45, explosion: true });
    sfx("hammer", a);
    shake(8);
  } else if (P.kind === "ring") {
    for (let i = 0; i < P.count; i++) {
      const v = ang + i * Math.PI * 2 / P.count;
      mobShots.push({ x: a.x, y: a.y - 20, vx: Math.cos(v) * P.speed, vy: Math.sin(v) * P.speed, left: 520, d: P.dmg, a, r: 9, color: "#d39bff" });
    }
    sfx("shotgun", a);
  } else if (P.kind === "charge") {
    a.charge = { vx: Math.cos(ang), vy: Math.sin(ang), speed: P.speed, left: P.dist, dmg: P.dmg, hit: false };
    sfx("dash", a);
  }
}

// ----- 적 투사체 -----
function updateMobShots(dt) {
  for (const s of mobShots) {
    const steps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy) * dt / 8));
    if (s.home && (s.homeT -= dt) > 0 && p.hp > 0) { // 추적탄 (기섭 보스 하트): 초당 home 라디안까지만 꺾임
      const want = Math.atan2(p.y - 14 - s.y, p.x - s.x), cur = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy);
      let dv = want - cur;
      while (dv > Math.PI) dv -= Math.PI * 2;
      while (dv < -Math.PI) dv += Math.PI * 2;
      const v = cur + clamp(dv, -s.home * dt, s.home * dt);
      s.vx = Math.cos(v) * sp;
      s.vy = Math.sin(v) * sp;
    }
    if (s.turn) { // 휘는 탄 (재한 보스 감아차기)
      const v = Math.atan2(s.vy, s.vx) + s.turn * dt, sp = Math.hypot(s.vx, s.vy);
      s.vx = Math.cos(v) * sp;
      s.vy = Math.sin(v) * sp;
    }
    for (let i = 0; i < steps && !s.dead; i++) {
      s.x += s.vx * dt / steps;
      s.y += s.vy * dt / steps;
      s.left -= Math.hypot(s.vx, s.vy) * dt / steps;
      if (s.left < 0 || blocked(s.x, s.y, 2) || s.x < 0 || s.y < 0 || s.x > W || s.y > H) {
        s.dead = true;
        if (s.blast) hazards.push({ x: s.x, y: s.y, r: s.blast, t: 0.01, dur: 0.01, dmg: s.d * 0.6, a: s.a, color: "211, 155, 255" });
      } else if (p.hp > 0 && Math.hypot(p.x - s.x, p.y - 14 - s.y) < 18 + s.r * 0.5) {
        hit(s.a, p, s.d);
        if (s.slow) p.slow = Math.max(p.slow || 0, s.slow);
        if (s.push) { // 물대포: 맞은 방향으로 밀림 (벽 통과 없음)
          const n = Math.hypot(s.vx, s.vy) || 1;
          for (let k = 0; k < 6; k++) moveRaw(p, s.vx / n, s.vy / n, s.push / 6);
        }
        if (s.blast) hazards.push({ x: s.x, y: s.y, r: s.blast, t: 0.01, dur: 0.01, dmg: s.d * 0.6, a: s.a, color: "211, 155, 255" });
        s.dead = true;
      } else if (pet && Math.hypot(pet.x - s.x, pet.y - s.y) < 20) {
        hit(s.a, pet, s.d);
        s.dead = true;
      } else if (singleRun?.ward && singleRun.ward.hp > 0 && Math.hypot(singleRun.ward.x - s.x, singleRun.ward.y - 14 - s.y) < 18 + s.r * 0.5) { // 보호 대상(은숙)도 맞음
        hit(s.a, singleRun.ward, s.d);
        s.dead = true;
      }
    }
  }
  compact(mobShots, (s) => !s.dead);
}

// ----- 강화 카드 -----
function drawCards(n) {
  const pool = WAVE_CARDS.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}
function pickCard(i) {
  const R = singleRun;
  if (!R || R.phase !== "cards") return;
  const c = R.cards[i];
  c.apply(p);
  R.picked.push(c.id);
  R.cards = [];
  sfx("pickup", p);
  nextWave();
}
