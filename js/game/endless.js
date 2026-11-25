// ===== 무한 생존 (docs/ENDLESS_SURVIVAL_V1.md) =====
// singleRun.endless 일 때만 동작. 스토리 미션(wave.js)·배틀로얄과 상태를 섞지 않음:
//   - 판 진행 상태는 singleRun 안, 플레이어 강화는 p(판마다 새로)와 R.blades/R.mods
//   - 캐릭터 전용 카드는 SKILL_DATA[캐릭터] 를 이번 판 동안만 바꾸고, 판이 끝나면(다른 모드로 가면) 원래대로 되돌림
// 적은 bots 배열에 mob 표시로 넣음 → 기존 공격·스킬·포켓몬·궁극기 판정이 그대로 적용

const ENDLESS_SAVE_KEY = "battlelab.endless";
let endlessSave = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(ENDLESS_SAVE_KEY));
    if (s && s.v === 1) return s;
  } catch (e) {}
  return { v: 1, best: {} };
})();
function writeEndlessSave() {
  try {
    localStorage.setItem(ENDLESS_SAVE_KEY, JSON.stringify(endlessSave));
  } catch (e) {}
}

// ----- 스킬 데이터 이번 판만 바꾸기 / 되돌리기 -----
let endlessSkillBackup = null;
function restoreEndlessSkills() {
  restorePokemonDeck(); // 현곤 포켓몬 덱 (js/game/pokemon.js)
  if (!endlessSkillBackup) return;
  SKILL_DATA[endlessSkillBackup.ch] = endlessSkillBackup.data;
  endlessSkillBackup = null;
}
function snapshotEndlessSkills(ch) {
  restoreEndlessSkills();
  endlessSkillBackup = { ch, data: SKILL_DATA[ch] };
  SKILL_DATA[ch] = JSON.parse(JSON.stringify(SKILL_DATA[ch])); // 이번 판 전용 사본
}

function beginEndless(ch) {
  singleRun = { id: "endless", endless: true, char: ch };
}
function setupEndless() {
  const R = singleRun;
  snapshotEndlessSkills(character);
  setupPokemonRun();
  Object.assign(R, {
    m: { zone: false },  // 자기장 끔 (update.js 공통 처리)
    wave: 0, phase: "count", t: ENDLESS.countdown, timer: 0, plan: 0, spawned: 0, spawnT: 0,
    level: 1, exp: 0, cardQueue: [], cards: [], cardRarity: "", stacks: {},
    blades: { n: 0, dmg: 1, spd: 1, size: 1, wall: false, double: false, ang: 0 },
    mods: {}, kills: 0, bossCycle: [], boss: null, banner: "", bannerT: 0, startedAt: 0,
  });
  bots = [];
  mobShots = [];
  hazards = [];
  loot = [];
  nextEndlessWave();
}
function endlessNeedExp(level) {
  return ENDLESS.exp.base + ENDLESS.exp.per * (level - 1);
}
function waveScale(W) {
  const S = ENDLESS.scale;
  return { hp: Math.pow(S.hp, W - 1), atk: Math.pow(S.atk, W - 1), spd: Math.min(S.spdMax, 1 + S.spdPer * (W - 1)) };
}
function waveSpec(W) {
  if (W % ENDLESS.bossEvery === 0) return { boss: true };
  if (W < ENDLESS_WAVES.length && ENDLESS_WAVES[W]) return ENDLESS_WAVES[W];
  // 21 이후: 총수량 +5 씩 (최대 150), 구성은 전체 혼합
  const lastNormal = ENDLESS_WAVES[19].count, extra = (W - 20 - Math.floor((W - 20) / ENDLESS.bossEvery)) * ENDLESS.after20.add;
  return { kinds: "all", count: Math.min(ENDLESS.after20.max, lastNormal + extra) };
}
function nextEndlessWave() {
  const R = singleRun;
  R.wave++;
  R.spec = waveSpec(R.wave);
  R.phase = "count";
  R.t = ENDLESS.countdown;
  if (ENDLESS.resetSkillCD && p.skcd) for (const k in p.skcd) p.skcd[k] = 0; // 웨이브 전환: 일반 스킬 쿨타임 초기화
}
function startEndlessFight() {
  const R = singleRun, S = R.spec;
  if (S.boss) {
    spawnEndlessBoss();
    R.phase = "intro";
    R.t = ENDLESS.bossIntro;
    R.banner = `W${R.wave} 보스 · ${R.boss ? "타락한 " + DISPLAY_NAMES[R.boss.bossId] + " — " + ENDLESS_BOSSES[R.boss.bossId].name : ""}`;
    R.bannerT = ENDLESS.bossIntro + 0.5;
    sfx("zone_warning");
    return;
  }
  R.phase = "fight";
  R.timer = ENDLESS.normalTime;
  R.plan = S.count;
  R.spawned = 0;
  R.spawnT = 0;
  R.banner = `W${R.wave} · ${ENDLESS.normalTime}초 생존`;
  R.bannerT = 1.6;
}

// 카드 선택·카운트다운·보스 등장 중에는 전투 정지 (update 맨 앞에서 호출, true 면 이번 프레임 전투 안 함)
function endlessPaused(dt) {
  const R = singleRun;
  if (R.bannerT > 0) R.bannerT -= dt;
  if (R.phase === "cards" || R.pkOpen) return true; // 카드 선택·포켓몬 편성 중 정지
  if (R.cardQueue.length) {
    openEndlessCards();
    return true;
  }
  if (R.phase === "count") {
    if ((R.t -= dt) <= 0) startEndlessFight();
    return true;
  }
  if (R.phase === "intro") {
    if ((R.t -= dt) <= 0) R.phase = "boss";
    return true;
  }
  return false;
}

// ----- 적 만들기 -----
let hazards = []; // 예고 후 터지는 범위 공격 (적 투척·보스 함정 등)
function endlessSpawnPoint() {
  return spawnPoint(ENDLESS.spawnMinDist);
}
function makeEnemy(kind, at, opts = {}) {
  const R = singleRun, sc = waveScale(R.wave);
  let base = ENEMY_TYPES[kind], elite = false;
  if (kind === "elite") {
    elite = true;
    const pool = ENDLESS_ALL_KINDS.filter((k) => k !== "elite");
    kind = pool[Math.floor(Math.random() * pool.length)];
    base = ENEMY_TYPES[kind];
  }
  const E = ENEMY_TYPES.elite, q = at || endlessSpawnPoint();
  const a = actor(q.x, q.y);
  const hp = base.hp * sc.hp * (elite ? E.hpMul : 1);
  Object.assign(a, {
    mob: kind, endless: true, elite, hp, max: hp, spd: base.spd * sc.spd, dmg: base.dmg * sc.atk * (elite ? E.dmgMul : 1),
    r: base.r * (elite ? 1.2 : 1), exp: opts.noExp ? 0 : elite ? E.exp : base.exp, atkT: 0.5 + Math.random(), spawnT: 0.6, deadT: 0,
    visual: base.visual, seed: Math.random() * 100, look: { scale: (base.scale || 1) * (elite ? E.scale : 1), aura: elite ? E.aura : 0.55 },
    specialT: 1 + Math.random() * 2, owner: null, summoner: opts.summoner || null,
  });
  if (kind === "assassin") a.stealth = 99;
  const sp = freeSpot(a.x, a.y, a.r); // 벽·물·상자 안 스폰 금지 (몸 크기 기준)
  if (sp) {
    a.x = sp.x;
    a.y = sp.y;
  }
  fx.push({ x: a.x, y: a.y, t: 0.6, ring: a.r + 14 });
  bots.push(a);
  return a;
}

// ----- 매 프레임 -----
function updateEndless(dt) {
  const R = singleRun;
  // 플레이어 강화: 자연 회복, 상태이상 저항(상훈 카드)
  if (p.regen) healActor(p, p.max * p.regen * dt, true);
  if (R.mods.resist) for (const k of ["stun", "slow", "root"]) if (p[k] > 0) p[k] = Math.max(0, p[k] - dt * R.mods.resist / (1 - R.mods.resist));
  // 일반 웨이브: 60초 동안 총수량을 고르게 등장
  if (R.phase === "fight") {
    R.timer -= dt;
    R.spawnT -= dt;
    const alive = bots.filter((b) => b.hp > 0).length;
    if (R.spawned < R.plan && R.spawnT <= 0 && alive < ENDLESS.maxAlive) {
      const kinds = R.spec.kinds === "all" ? ENDLESS_ALL_KINDS : R.spec.kinds;
      let k = kinds[Math.floor(Math.random() * kinds.length)];
      if (k === "elite" && Math.random() > ELITE_SHARE * kinds.length) k = kinds.find((x) => x !== "elite") || "melee";
      makeEnemy(k);
      R.spawned++;
      R.spawnT = (ENDLESS.normalTime * 0.92) / R.plan;
    }
    if (R.timer <= 0) endEndlessWave(false);
  }
  // 적 행동
  for (const a of bots) {
    if (a.hp <= 0) {
      if (!a.counted) onEndlessDeath(a);
      a.deadT += dt;
      continue;
    }
    if (a.spawnT > 0) {
      a.spawnT -= dt;
      continue;
    }
    if (a.bossId) {
      // 보스: 상태이상 효과 감소 (남은 시간을 더 빨리 줄임)
      const m = 1 / ENDLESS.bossStatusMul - 1;
      for (const k of ["stun", "slow", "root"]) if (a[k] > 0) a[k] = Math.max(0, a[k] - dt * m);
    }
    if (a.stun > 0) continue;
    if (playerHidden() && !a.tele && !a.channel && !a.charge) searchGhost(a, dt); // 은신: 실제 위치 추적 안 함
    else if (a.bossId) endlessBossAI(a, dt);
    else enemyAI(a, dt);
  }
  compact(bots, (b) => b.hp > 0 || b.deadT < 0.6);
  updateMobShots(dt);
  updateHazards(dt);
  updateBlades(dt);
  // 보스 처치
  if (R.phase === "boss" && R.boss && R.boss.hp <= 0) endEndlessWave(true);
}
function onEndlessDeath(a) {
  const R = singleRun;
  a.counted = true;
  if (a.summoner && a.summoner.minions) a.summoner.minions--;
  if (!a.exp) return;
  R.kills++;
  gainExp(a.exp);
  if (Math.random() < ENDLESS.dropHeal.chance) dropLoot({ x: a.x, y: a.y, type: LOOT.heal, id: 0, amount: ENDLESS.dropHeal.amount });
}
function gainExp(n) {
  const R = singleRun;
  R.exp += n;
  while (R.exp >= endlessNeedExp(R.level)) { // 초과분은 다음 레벨로 이월, 동시 레벨업은 카드 순차 지급
    R.exp -= endlessNeedExp(R.level);
    R.level++;
    R.cardQueue.push("normal");
    fx.push({ x: p.x, y: p.y - 80, t: 1, text: `레벨 업! Lv${R.level}`, tcol: "#7fe3ff", big: true });
  }
}
function endEndlessWave(boss) {
  const R = singleRun;
  // 남은 적 제거 (경험치 없음), 남은 아이템 자동 획득, 회복 (중복 없음)
  for (const b of bots) {
    b.counted = true;
    b.hp = 0;
  }
  bots = [];
  mobShots = [];
  hazards = [];
  for (const l of loot.slice()) {
    if (l.type === LOOT.heal) healActor(p, p.max * (l.amount ?? HEAL.ratio));
    else if (l.type === LOOT.grenade) p.grenades = Math.min(GRENADE.max, (p.grenades || 0) + 1);
    else if (l.type === LOOT.weapon && !p.w) p.w = l.id;
  }
  loot = [];
  healActor(p, p.max * (boss ? ENDLESS.heal.boss : ENDLESS.heal.clear));
  R.cardQueue.unshift(boss ? "legend" : "normal"); // 클리어 카드 먼저, 레벨 업 카드는 그 뒤
  R.boss = null;
  R.banner = boss ? `W${R.wave} 보스 처치!` : `W${R.wave} 생존!`;
  R.bannerT = 1.4;
  sfx(boss ? "victory" : "pickup");
  nextEndlessWave();
}

// ----- 일반 적 행동 (유형별 대표 패턴 하나) -----
function enemyAI(a, dt) {
  const T = ENEMY_TYPES[a.mob], d = dist(a, p);
  a.atkT -= dt;
  a.specialT -= dt;
  if (p.hp <= 0) return;
  const shoot = (spd, dmg, extra = {}) => {
    const ang = Math.atan2(p.y - a.y, p.x - a.x);
    mobShots.push({ x: a.x, y: a.y - 14, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, left: T.range + 80, d: dmg, a, r: 7, color: "#c77dff", ...extra });
    a.atkAnim = 0.3;
  };
  const keepAway = () => {
    const see = d < T.range + 20 && clearLine(a, p);
    if (d > T.keep[1] || !see) chase(a, dt);
    else if (d < T.keep[0]) move(a, a.x - p.x, a.y - p.y, dt);
    else a.moving = false;
    return see;
  };
  switch (a.mob) {
    case "ranged": {
      if (keepAway() && d <= T.range && a.atkT <= 0) {
        a.atkT = T.cd * (0.85 + Math.random() * 0.3);
        shoot(T.shot, a.dmg);
        sfx("pistol", a);
      }
      return;
    }
    case "thrower": { // 플레이어 위치에 예고 원 → 터짐
      if (keepAway() && d <= T.range && a.atkT <= 0) {
        a.atkT = T.cd;
        a.atkAnim = 0.3;
        hazards.push({ x: p.x, y: p.y, r: T.lob.radius, t: T.lob.tele, dur: T.lob.tele, dmg: a.dmg, a, color: "200, 90, 255" });
      }
      return;
    }
    case "support": { // 주변 적 회복 + 약한 탄
      if (a.specialT <= 0) {
        a.specialT = T.heal.every;
        for (const b of bots) if (b !== a && b.hp > 0 && !b.bossId && dist(a, b) <= T.heal.radius) b.hp = Math.min(b.max, b.hp + b.max * T.heal.amount);
        fx.push({ x: a.x, y: a.y, t: 0.5, ring: T.heal.radius });
      }
      if (keepAway() && d <= T.range && a.atkT <= 0) {
        a.atkT = T.cd;
        shoot(220, a.dmg);
      }
      return;
    }
    case "summoner": { // 졸개 소환 (경험치 0)
      if (a.specialT <= 0 && (a.minions || 0) < T.summon.cap) {
        a.specialT = T.summon.every;
        for (let i = 0; i < T.summon.count; i++) {
          const ang = Math.random() * 7, q = { x: clamp(a.x + Math.cos(ang) * 50, 30, W - 30), y: clamp(a.y + Math.sin(ang) * 50, 30, H - 30) };
          if (!terrain(q.x, q.y) && !blocked(q.x, q.y)) {
            makeEnemy("minion", q, { noExp: true, summoner: a });
            a.minions = (a.minions || 0) + 1;
          }
        }
      }
      if (keepAway() && d <= T.range && a.atkT <= 0) {
        a.atkT = T.cd;
        shoot(220, a.dmg);
      }
      return;
    }
    case "mobile": // 주기적으로 빠른 돌진
      if (a.specialT <= 0 && d < 300 && d > 60) {
        a.specialT = T.dash.every;
        a.dashLeft = T.dash.dur;
      }
      if (a.dashLeft > 0) {
        a.dashLeft -= dt;
        move(a, p.x - a.x, p.y - a.y, dt * T.dash.speed);
      }
      break;
    case "assassin": // 가까이 올 때까지 은신
      if (a.stealth > 0 && d < T.stealthUntil) {
        a.stealth = 0;
        a.reveal = 0.5;
        a.atkT = 0.35;
        fx.push({ x: a.x, y: a.y, t: 0.4, ring: 30 });
      }
      break;
  }
  // 근접 공통 (근접·기동·탱커·암살·졸개)
  if (d > T.range + 16) chase(a, dt);
  else {
    a.moving = false;
    faceTo(a, p.x, p.y);
    if (a.atkT <= 0) {
      a.atkT = T.cd;
      a.atkAnim = 0.3;
      if (a.mob === "tank") { // 탱커: 작은 범위 내려찍기
        hazards.push({ x: a.x, y: a.y, r: 55, t: 0.45, dur: 0.45, dmg: a.dmg, a, color: "255, 120, 80" });
      } else hit(a, p, a.dmg);
    }
  }
  separate(a);
}

// 예고 범위 공격: 시간이 다 되면 범위 안의 플레이어 편에게 피해 (예고와 판정 위치가 같음)
function updateHazards(dt) {
  for (const h of hazards) {
    if (h.tick) { // 지속 영역 (보스 zone)
      h.life -= dt;
      if ((h.tickT -= dt) <= 0) {
        h.tickT += h.tick;
        if (dist(p, h) <= h.r) hit(h.a, p, h.dmg, { dot: true });
      }
      if (h.life <= 0) h.dead = true;
      continue;
    }
    if ((h.t -= dt) <= 0) {
      h.dead = true;
      for (const b of [p, ...(pet ? [pet] : []), ...ultPets]) if (b.hp > 0 && dist(b, h) <= h.r + 10) hit(h.a, b, h.dmg);
      fx.push({ x: h.x, y: h.y, t: 0.35, explosion: h.r > 70, ring: h.r });
    }
  }
  compact(hazards, (h) => !h.dead);
}

// ----- 보스 -----
function spawnEndlessBoss() {
  const R = singleRun, sc = waveScale(R.wave);
  if (!R.bossCycle.length) { // 8명 무작위 순환, 한 순환 안에서 중복 없음
    R.bossCycle = Object.keys(ENDLESS_BOSSES);
    for (let i = R.bossCycle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [R.bossCycle[i], R.bossCycle[j]] = [R.bossCycle[j], R.bossCycle[i]];
    }
  }
  const id = R.bossCycle.shift(), B = BOSS_BASE, q = spawnPoint(300);
  const a = actor(q.x, q.y), hp = B.hp * sc.hp;
  Object.assign(a, {
    mob: "boss", endless: true, bossId: id, hp, max: hp, spd: B.spd * sc.spd, dmgMul: sc.atk, r: B.r, exp: ENEMY_TYPES.boss?.exp ?? 200,
    atkT: 1, spawnT: 0, deadT: 0, visual: id, seed: Math.random() * 100, look: { scale: B.scale, aura: 1 },
    pat: 0, patT: 1.5, tele: null, phaseDone: 0, healed: 0, lastHurt: 0,
  });
  bots.push(a);
  R.boss = a;
}
function bossPhase(a) {
  const f = a.hp / a.max;
  return f > 0.6 ? 0 : f > 0.3 ? 1 : 2;
}
function endlessBossAI(a, dt) {
  const Bd = ENDLESS_BOSSES[a.bossId], B = BOSS_BASE, ph = bossPhase(a), enr = ph === 2 ? B.enrageMul : 1;
  // 단계 진입 처리: 체력이 한 번에 크게 깎여도 각 단계의 등장 효과는 순서대로 한 번씩만
  while (a.phaseDone < ph) {
    a.phaseDone++;
    if (a.phaseDone === 1) for (const k of Bd.adds) makeEnemy(k, null, { noExp: true });
    singleRun.banner = a.phaseDone === 1 ? "보스 궁극기 단계!" : "보스 광폭화!";
    singleRun.bannerT = 1.4;
  }
  // 은숙 보스: 안 맞으면 자연 회복 (회복 상한)
  if (Bd.idleHeal && elapsed - (a.lastHurt || 0) > Bd.idleHeal.after) bossHeal(a, a.max * Bd.idleHeal.perSec * dt);
  if (a.channel) { // 회복 채널링: 맞으면 끊김
    const C = a.channel;
    if (a.hitT > 0) {
      a.channel = null;
      fx.push({ x: a.x, y: a.y - 60, t: 0.7, text: "회복 끊김!", tcol: "#ffffff" });
    } else {
      bossHeal(a, a.max * C.amount * dt / C.dur);
      if ((C.t -= dt) <= 0) a.channel = null;
      return;
    }
  }
  if (a.rushT > 0) { // 추적 연타
    a.rushT -= dt;
    chase(a, dt * 1.6);
    if ((a.rushTick -= dt) <= 0 && dist(a, p) < 60) {
      a.rushTick = 0.3;
      hit(a, p, a.rushDmg);
    }
    return;
  }
  if (a.charge) return bossChargeStep(a, dt);
  if (a.hidden > 0) { // 경수 보스 은신
    a.hidden -= dt;
    if (a.hidden <= 0) {
      const ang = Math.atan2(p.y - a.y, p.x - a.x) + Math.PI; // 뒤쪽으로 나타남
      const fxv = facingVec();
      const sp = freeSpot(clamp(p.x - fxv[0] * 60, 30, W - 30), clamp(p.y - fxv[1] * 60, 30, H - 30), a.r) || a; // 벽 안에 나타나지 않게
      a.x = sp.x;
      a.y = sp.y;
      a.stealth = 0;
      a.tele = { P: { k: "slam", dmg: a.ambushDmg, radius: 70 }, t: 0.4, dur: 0.4, x: a.x, y: a.y, ang };
    }
    return;
  }
  if (a.tele) {
    a.tele.t -= dt;
    if (a.tele.t <= 0) fireBossPat(a);
    return;
  }
  a.patT -= dt;
  a.atkT -= dt;
  const d = dist(a, p);
  if (d > 60) chase(a, dt);
  else if (a.atkT <= 0) {
    a.atkT = 1.2 * enr;
    a.atkAnim = 0.35;
    faceTo(a, p.x, p.y);
    hit(a, p, 80 * a.dmgMul);
  }
  if (a.patT <= 0 && p.hp > 0) {
    const list = ph >= 1 && (a.pat % 3 === 2) ? Bd.ult : Bd.basic; // 궁극기 단계부터 3번에 1번 궁극기 패턴
    const P = list[a.pat % list.length];
    a.pat++;
    const ult = list === Bd.ult, [t0, t1] = ult ? B.ultTele : B.tele, tele = (t0 + Math.random() * (t1 - t0)) * enr;
    faceTo(a, p.x, p.y);
    a.moving = false;
    const ang = Math.atan2(p.y - a.y, p.x - a.x);
    const tx = P.jump || P.k === "traps" ? p.x : a.x, ty = P.jump || P.k === "traps" ? p.y : a.y;
    a.tele = { P, t: tele, dur: tele, ang, x: tx, y: ty, spots: P.k === "traps" ? trapSpots(P) : null };
    a.patT = tele + (P.rest || B.gap) * enr + 0.8;
  }
}
function bossHeal(a, amt) {
  const cap = a.max * BOSS_BASE.healCap;
  if (a.healed >= cap || amt <= 0) return;
  const got = Math.min(amt, cap - a.healed, a.max - a.hp);
  a.hp += got;
  a.healed += got;
}
function trapSpots(P) {
  const out = [];
  for (let i = 0; i < P.n; i++) {
    if (P.map) out.push({ x: 120 + Math.random() * (W - 240), y: 120 + Math.random() * (H - 240) });
    else {
      const ang = Math.random() * 7, r = i === 0 ? 0 : 60 + Math.random() * 120;
      out.push({ x: clamp(p.x + Math.cos(ang) * r, 30, W - 30), y: clamp(p.y + Math.sin(ang) * r, 30, H - 30) });
    }
  }
  if (P.map) out[0] = { x: p.x, y: p.y };
  return out;
}
function fireBossPat(a) {
  const { P, ang } = a.tele, m = a.dmgMul, T = a.tele;
  a.tele = null;
  a.atkAnim = 0.4;
  switch (P.k) {
    case "slam":
      if (P.jump) { // 점프는 벽을 넘어갈 수 있지만 착지는 빈 자리에
        const sp = freeSpot(T.x, T.y, a.r) || a;
        a.x = sp.x;
        a.y = sp.y;
      }
      for (const b of [p, ...(pet ? [pet] : []), ...ultPets]) if (dist(a, b) <= P.radius + 10) hit(a, b, P.dmg * m);
      fx.push({ x: a.x, y: a.y, t: 0.45, explosion: true });
      shake(8);
      sfx("hammer", a);
      break;
    case "charge":
      a.charge = { vx: Math.cos(ang), vy: Math.sin(ang), speed: 540, left: P.dist, dmg: P.dmg * m, hit: false, rest: P.rest };
      sfx("dash", a);
      break;
    case "cone":
      if (dist(a, p) <= P.radius && angleDiff(Math.atan2(p.y - a.y, p.x - a.x), ang) <= P.arc * Math.PI / 360) hit(a, p, P.dmg * m);
      fx.push({ x: a.x, y: a.y, t: 0.25, cone: true, ang, r: P.radius, half: P.arc * Math.PI / 360 });
      break;
    case "ring": {
      const waves = P.waves || 1;
      for (let w = 0; w < waves; w++) setTimeoutGame(() => {
        for (let i = 0; i < P.n; i++) {
          const v = ang + i * Math.PI * 2 / P.n + (P.spin ? w * 0.2 : 0);
          mobShots.push({ x: a.x, y: a.y - 20, vx: Math.cos(v) * 220, vy: Math.sin(v) * 220, left: 520, d: P.dmg * m, a, r: 9, color: a.bossId === "runner" ? "#ff5fa2" : "#d39bff", heart: a.bossId === "runner", boss: true });
        }
      }, w * 0.35);
      sfx("shotgun", a);
      break;
    }
    case "barrage": {
      const rep = P.repeat || 1;
      for (let r = 0; r < rep; r++) setTimeoutGame(() => {
        const a2 = Math.atan2(p.y - a.y, p.x - a.x);
        for (let i = 0; i < P.n; i++) {
          const v = a2 + (i - (P.n - 1) / 2) * 0.28;
          mobShots.push({ x: a.x, y: a.y - 20, vx: Math.cos(v) * 300, vy: Math.sin(v) * 300, left: 560, d: P.dmg * m, a, r: P.big ? 14 : 8, color: "#d39bff", slow: P.slow, blast: P.blast, boss: true });
        }
      }, r * 0.3);
      sfx("pistol", a);
      break;
    }
    case "curve":
      for (const side of [-1, 1]) mobShots.push({ x: a.x, y: a.y - 20, vx: Math.cos(ang - side * 0.7) * 280, vy: Math.sin(ang - side * 0.7) * 280, turn: side * 1.4, left: 600, d: P.dmg * m, a, r: 10, color: "#d39bff", boss: true });
      break;
    case "traps":
      for (const s of T.spots) hazards.push({ x: s.x, y: s.y, r: P.radius, t: 0.01, dur: 0.01, dmg: P.dmg * m, a, color: "210, 91, 124" });
      break;
    case "summon":
      for (let i = 0; i < P.n; i++) {
        if (bots.filter((x) => x.hp > 0 && !x.bossId).length >= BOSS_BASE.addsCap) break; // 보스가 부른 적 상한
        const k = P.kinds[i % P.kinds.length], v = i / P.n * 7, q = { x: clamp(a.x + Math.cos(v) * 80, 30, W - 30), y: clamp(a.y + Math.sin(v) * 80, 30, H - 30) };
        if (!terrain(q.x, q.y) && !blocked(q.x, q.y)) makeEnemy(k, q, { noExp: true });
      }
      break;
    case "heal":
      a.channel = { t: P.dur, dur: P.dur, amount: P.amount };
      fx.push({ x: a.x, y: a.y - 70, t: 0.8, text: "회복 중… 공격해서 끊어!", tcol: "#ffffff" });
      break;
    case "stealth":
      a.hidden = 1.1;
      a.stealth = 1.1;
      a.ambushDmg = P.dmg * m;
      break;
    case "clones":
      for (let i = 0; i < P.n; i++) {
        const v = i / P.n * 7, q = { x: clamp(p.x + Math.cos(v) * 160, 30, W - 30), y: clamp(p.y + Math.sin(v) * 160, 30, H - 30) };
        if (!terrain(q.x, q.y) && !blocked(q.x, q.y)) {
          const c = makeEnemy("assassin", q, { noExp: true });
          c.hp = c.max = 120 * waveScale(singleRun.wave).hp;
          c.stealth = 0;
          c.look = { scale: 1, aura: 0.3 };
        }
      }
      break;
    case "zone":
      hazards.push({ x: a.x, y: a.y, r: P.radius, tick: 0.5, tickT: 0.5, life: P.dur, dmg: P.dmg * m, a, follow: a, color: "92, 184, 255" });
      break;
    case "rush":
      a.rushT = P.dur;
      a.rushTick = 0;
      a.rushDmg = P.dmg * m;
      break;
  }
}
function bossChargeStep(a, dt) {
  const c = a.charge, step = c.speed * dt;
  if (chargeStep(a, c.vx, c.vy, step)) {
    c.left = 0;
    shake(5);
  }
  c.left -= step;
  if (!c.hit && dist(a, p) < a.r + 20) {
    c.hit = true;
    hit(a, p, c.dmg);
  }
  fx.push({ x: a.x, y: a.y, t: 0.2, ring: 20 });
  if (c.left <= 0) {
    a.charge = null;
    a.patT = Math.max(a.patT, c.rest || 1); // 돌진 후 빈틈
  }
}
// 게임 시간 기준 지연 실행 (정지 중에는 멈춤)
let gameTimers = [];
function setTimeoutGame(fn, sec) {
  if (sec <= 0) return fn();
  gameTimers.push({ fn, t: sec });
}
function updateGameTimers(dt) {
  for (const g2 of gameTimers) if ((g2.t -= dt) <= 0) g2.fn();
  gameTimers = gameTimers.filter((g2) => g2.t > 0);
}

// ----- 공전 칼날 -----
function bladePositions() {
  const R = singleRun, B = R && R.blades;
  if (!B || !B.n) return [];
  const out = [];
  for (let i = 0; i < B.n; i++) {
    const v = B.ang + i / B.n * Math.PI * 2;
    out.push({ x: p.x + Math.cos(v) * BLADES.orbit, y: p.y + Math.sin(v) * BLADES.orbit * 0.75, v });
  }
  if (B.double) {
    const n2 = Math.max(BLADES.outer.min, Math.round(B.n * BLADES.outer.ratio));
    for (let i = 0; i < n2; i++) {
      const v = -B.ang * 0.8 + i / n2 * Math.PI * 2;
      out.push({ x: p.x + Math.cos(v) * BLADES.outer.orbit, y: p.y + Math.sin(v) * BLADES.outer.orbit * 0.75, v, outer: true });
    }
  }
  return out;
}
function updateBlades(dt) {
  const B = singleRun.blades;
  if (!B.n || p.hp <= 0) return;
  B.ang += BLADES.speed * B.spd * dt;
  const size = BLADES.size * B.size, dmg = weapons[p.w][1] * BLADES.dmgRatio * B.dmg;
  for (const bl of bladePositions()) {
    for (const b of bots) {
      if (b.hp <= 0 || b.spawnT > 0 || dist(bl, b) > size + (b.r || 16)) continue;
      const key = BLADES.sharedGap ? "bladeHitT" : "bladeHitT" + (bl.outer ? "o" : "");
      if (elapsed - (b[key] ?? -9) < BLADES.hitGap) continue;
      b[key] = elapsed;
      hit(p, b, dmg); // 궁극기 충전에도 반영
    }
    if (B.wall) for (const s of mobShots) if (!s.boss && !s.dead && Math.hypot(s.x - bl.x, s.y + 14 - bl.y) < size + 8) s.dead = true; // 철벽 방어: 일반 적 투사체 제거
  }
}

// ----- 강화 카드 -----
function cardCount(id) {
  return singleRun.stacks[id] || 0;
}
function cardEligible(c) {
  const R = singleRun;
  if (c.only && c.only !== character) return false;
  if (cardCount(c.id) >= c.cap) return false;
  if (c.needBlade && !R.blades.n) return false; // 칼날이 없으면 칼날 강화 카드는 안 나옴
  if ((c.id === "blade_add" || c.id === "blade_storm") && R.blades.n >= BLADES.max) return false; // 최대 개수면 제외
  return true;
}
function rollRarity() {
  const r = Math.random() * 100, P = ENDLESS.rarity;
  return r < P.legend ? "legend" : r < P.legend + P.rare ? "rare" : "common";
}
function drawEndlessCards(mode) {
  const pool = ENDLESS_CARDS.filter(cardEligible), out = [];
  for (let i = 0; i < 3; i++) {
    const want = mode === "legend" ? "legend" : rollRarity();
    const order = want === "legend" ? ["legend", "rare", "common"] : want === "rare" ? ["rare", "common", "legend"] : ["common", "rare", "legend"];
    let pick = null;
    for (const rar of order) {
      const cand = pool.filter((c) => c.tiers[rar] !== undefined && !out.some((o) => o.card.id === c.id));
      if (cand.length) {
        pick = { card: cand[Math.floor(Math.random() * cand.length)], rarity: rar };
        break;
      }
    }
    if (pick) out.push(pick);
  }
  return out;
}
function openEndlessCards() {
  const R = singleRun, mode = R.cardQueue.shift();
  R.cards = drawEndlessCards(mode);
  R.cardRarity = mode;
  if (!R.cards.length) return; // 받을 카드가 없으면 넘어감
  R.phase = "cards";
  R.phaseAfterCards = R.phaseAfterCards || null;
}
function pickEndlessCard(i) {
  const R = singleRun;
  if (R.phase !== "cards") return;
  const { card, rarity } = R.cards[i];
  applyEndlessCard(card, card.tiers[rarity]);
  R.stacks[card.id] = cardCount(card.id) + 1;
  R.cards = [];
  R.phase = R.boss ? "boss" : R.timer > 0 ? "fight" : "count";
  sfx("pickup", p);
}
function cardText(c, v) {
  return c.text.replace("{v%}", fmtNum(v * 100) + "%").replace("{v}", fmtNum(v));
}
function applyEndlessCard(c, v) {
  const R = singleRun, D = SKILL_DATA[character], M = R.mods, B = R.blades;
  switch (c.id) {
    case "atk": p.dmgMul = (p.dmgMul || 1) * (1 + v); break;
    case "aspd": p.reloadMul = (p.reloadMul || 1) / (1 + v); break;
    case "ultc": p.ultMul = (p.ultMul || 1) * (1 + v); break;
    case "maxhp": { const add = p.max * v; p.max += add; p.hp += add; break; }
    case "armor": p.takeMul = (p.takeMul || 1) * (1 - v); break;
    case "speed": p.spd = (p.spd || 1) * (1 + v); break;
    case "regen": p.regen = (p.regen || 0) + v; break;
    case "steal": p.steal = (p.steal || 0) + v; break;
    case "cdr": p.cdRate = (p.cdRate || 1) / (1 - v); break;
    case "blade_add": case "blade_storm": B.n = Math.min(BLADES.max, B.n + v); break;
    case "blade_sharp": B.dmg += v; break;
    case "blade_fast": B.spd *= 1 + v; break;
    case "blade_big": B.size *= 1 + v; break;
    case "blade_wall": B.wall = true; break;
    case "blade_double": B.double = true; break;
    case "suit_counter": D.passive.mult += v; break;
    case "suit_combo": D.combo.mults = D.combo.mults.map((x) => x * (1 + v)); break;
    case "summoner_petheal": M.petHeal = (M.petHeal || 0) + v; break;
    case "summoner_weak": M.petWeak = v; break;
    case "summoner_guard": D.passive.take = Math.max(0.3, D.passive.take - v); break;
    case "summoner_ult": D.r.dur += v; M.petHaste = 0.8; break;
    case "support_slow": D.q.slow += v; break;
    case "support_shield": M.shieldCap = Math.max(M.shieldCap || 0, 0) + v; break;
    case "support_wave": D.e.waveDmg = (D.e.waveDmg || 0) + v; break;
    case "support_ult": D.r.radius *= 1 + v; D.r.dur *= 1 + v; break;
    case "runner_more": D.r.hearts = Math.round(D.r.hearts * (1 + v)); break;
    case "runner_pierce": D.r.pierce = true; break;
    case "runner_slow": D.r.slow += v; break;
    case "runner_long": D.r.dur += v; break;
    case "runner_trail": M.trail = (M.trail || 0) + v; break;
    case "runner_kill": M.killCdr = (M.killCdr || 0) + v; break;
    case "octo_keep": D.passive.keep = v; break;
    case "octo_resist": M.resist = Math.min(0.75, (M.resist || 0) + v); break;
    case "octo_hurtink": M.hurtInk = (M.hurtInk || 0) + v; break;
    case "octo_tent": D.r.radius *= 1 + v; break;
    case "octo_ink": D.q.miss += 0.1; D.q.missDur += 2; D.q.radius *= 1.3; break;
    case "stripe_back": D.passive.mult += v; break;
    case "stripe_speed": p.stealthSpd = (p.stealthSpd || 1) + v; break;
    case "stripe_kill": M.killStealth = (M.killStealth || 0) + v; break;
    case "stripe_clone": D.r.count += v; break;
    case "soccer_ball": for (const k of ["e", "r"]) D[k].dmg *= 1 + v; D.r.blastDmg *= 1 + v; break;
    case "soccer_three": D.passive.every = 3; break;
    case "soccer_tri": D.r.multi = 3; break;
    case "soccer_curve": D.e.bend *= 1 + v; D.e.both = true; break;
    case "bear_guard": D.passive.perFoe += v; break;
    case "bear_honey": D.e.perSec += v; break;
    case "bear_run": D.q.dmg = (D.q.dmg || 0) + v; break;
    case "bear_land": D.r.radius *= 1 + v; break;
  }
}
// 무한 생존 전용 이벤트 (combat.js hit 에서 호출)
function endlessOnKill(a, b) {
  const R = singleRun, M = R.mods;
  if (M.petHeal && (a === pet || a.ult && a.owner === p) && b.exp) healActor(p, p.max * M.petHeal);
  if (M.killCdr && a === p) for (const k in p.skcd) p.skcd[k] = Math.max(0, p.skcd[k] - M.killCdr);
  if (M.killStealth && a === p) p.skcd.q = Math.max(0, p.skcd.q - M.killStealth);
}
function endlessOnHurt(d) {
  const M = singleRun.mods;
  if (M.hurtInk && Math.random() < M.hurtInk) { // 상훈: 맞으면 주변 먹물 폭발
    const S = SKILL_DATA.octo.q;
    for (const b of bots) if (b.hp > 0 && dist(p, b) <= S.radius) {
      hit(p, b, S.dmg * 0.5);
      b.miss = S.missDur;
      b.missChance = b.bossId ? S.missBoss : S.miss;
    }
    fx.push({ x: p.x, y: p.y, t: 0.7, inkBurst: true });
  }
}

// ----- 기록 -----
function endlessRecord() {
  const R = singleRun, ch = character, time = elapsed;
  const prev = endlessSave.best[ch], wave = R.wave;
  const better = !prev || wave > prev.wave || (wave === prev.wave && time > prev.time);
  if (better) {
    endlessSave.best[ch] = { wave, time: Math.round(time), level: R.level, kills: R.kills };
    writeEndlessSave();
  }
  return { wave, time, level: R.level, kills: R.kills, newBest: better };
}
