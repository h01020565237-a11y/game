// 전투: 피해 계산, 아이템 획득, 공격

// 액세서리 효과 확인 (FEATURES.accessories 가 꺼져 있으면 항상 없음 → 플레이어·AI 동일)
function hasGear(a, id) {
  return FEATURES.accessories && !!a.gear && a.gear.includes(id);
}
// 상자 드롭: DROP_TABLE 가중치 추첨
function rollDrop() {
  const table = DROP_TABLE.filter((e) => !e.accessory || FEATURES.accessories);
  let r = Math.random() * table.reduce((s, e) => s + e.weight, 0);
  for (const e of table) {
    if ((r -= e.weight) < 0) return e;
  }
  return table[table.length - 1];
}

// 피해 처리 (모든 공격 공통). o: { ult 궁극기 피해(충전 제외), dot 지속 피해 }
function hit(a, b, d, o = {}) {
  if (b.broken) return; // 이미 부서진 상자 (같은 프레임 중복 타격 → 드롭 중복 방지)
  if (b === p && god) return;
  if (b.max && isMine(a) && isMine(b)) return; // 같은 편끼리는 피해 없음
  // 먹물(상훈 Q): 공격자에게 MISS 확률 → 피해 0 (회복·버프에는 영향 없음)
  if (a.miss > 0 && b.max && !o.dot && Math.random() < (a.missChance || 0)) {
    fx.push({ x: b.x, y: b.y, t: 0.6, text: "MISS", tcol: "#b8b8c0" });
    return;
  }
  // 동기 위빙: 회피 중 적 공격 무효 + 카운터 게이지
  if (b === p && p.weave > 0 && a !== p && !o.dot) {
    fx.push({ x: p.x, y: p.y, t: 0.6, text: "IMMUNE", tcol: "#b8b8c0" });
    const P = SKILL_DATA.suit.passive, was = p.counter || 0;
    p.counter = Math.min(1, was + P.perDodge);
    if (was < 1 && p.counter >= 1) fx.push({ x: p.x, y: p.y - 70, t: 0.8, text: "카운터 준비!", tcol: "#ffd23f" });
    return;
  }
  let crit = false;
  // 스킬·패시브 수치는 SKILL_DATA (js/data/skills.js)
  if (a === p && character === "suit") {
    if (p.comboMul && o.basic) d *= p.comboMul; // 잽-스트레이트-훅 (기본 공격만)
    if (p.counterNow && o.basic) { // 카운터 펀치
      d *= SKILL_DATA.suit.passive.mult;
      crit = true;
    }
  }
  if (a === p && character === "stripe" && b.max) {
    let vx = Math.sin(b.dir * Math.PI / 4), vy = -Math.cos(b.dir * Math.PI / 4);
    if ((p.x - b.x) * vx + (p.y - b.y) * vy < 0) {
      d *= SKILL_DATA.stripe.passive.mult;
      crit = true;
    }
  }
  if (a === p && character === "soccer" && o.basic && ++p.combo % SKILL_DATA.soccer.passive.every === 0) {
    d *= SKILL_DATA.soccer.passive.mult;
    crit = true;
  }
  d *= a.weak > 0 ? PET_SKILLS[4].weakMul : 1;
  if (a.atkMul) d *= a.atkMul; // 현곤 궁극기 포켓몬
  // 싱글 강화 카드 (이번 판의 p 에만 있는 값. 배틀로얄에서는 없음 → 1)
  if (isMine(a) && p.dmgMul) d *= p.dmgMul;
  if (b === p && p.takeMul) d *= p.takeMul;
  d *= hasGear(b, 1) ? 0.9 : 1;
  if (b === p) {
    if (character === "bear") {
      const B = SKILL_DATA.bear.passive;
      d *= 1 - B.perFoe * Math.min(B.maxFoes, bots.filter((a2) => a2.hp > 0 && dist(a2, p) < B.radius).length);
      if (p.bearGuard > 0) d *= 1 - SKILL_DATA.bear.r.guard;
    }
    if (character === "summoner" && (pet || ultPets.length)) d *= SKILL_DATA.summoner.passive.take;
  }
  if (b.guardT > 0) d *= b.guardMul ?? 1; // 은숙 E
  // 무한 생존 보스: 현곤 보스는 소환한 적이 살아 있는 동안 받는 피해 감소
  if (b.bossId && ENDLESS_BOSSES[b.bossId].dmgTakenWithAdds && bots.some((x) => x !== b && x.hp > 0 && !x.bossId)) d *= ENDLESS_BOSSES[b.bossId].dmgTakenWithAdds;
  // 은숙 카드: 보호막이 먼저 막음
  if (b === p && p.shield > 0) {
    const s = Math.min(p.shield, d);
    p.shield -= s;
    d -= s;
  }
  if (b.max) b.lastHurt = elapsed; // 은숙 패시브: 맞으면 회복 중단
  if (b === p && character === "octo" && b.max) p.sulk = Math.min(1, (p.sulk || 0) + d / SKILL_DATA.octo.passive.perDmg);
  const real = b.max ? Math.min(d, Math.max(0, b.hp)) : d; // 과잉 피해 제외한 실제 피해
  // 집계: 플레이어 편(포켓몬·분신 포함)이 적에게 입힌 피해·처치
  if (b.max && !isMine(b) && isMine(a) && b.hp > 0) {
    stats.damage += real;
    if (b.hp - d <= 0) stats.kills++;
    if (!o.ult) chargeUlt(ULT_RULES.overkill ? d : real); // 궁극기 충전 (상자·궁극기 피해 제외)
    if (p.steal && real > 0) healActor(p, real * p.steal, true); // 무한 생존 흡혈 카드
    if (singleRun?.endless) {
      const M = singleRun.mods;
      if (M.petWeak && (a === pet || a.ult)) b.weak = Math.max(b.weak || 0, M.petWeak);
      if (b.hp - d <= 0) endlessOnKill(a, b);
    }
  }
  if (b === p && d > 0 && singleRun?.endless) endlessOnHurt(d);
  b.hp -= d;
  if (!b.max) b.flash = elapsed + 0.12;
  // 타격감: 피격 깜빡임·밀림 흔들림, 타격 이펙트, 효과음, 내가 맞으면 화면 흔들림
  if (b.max) b.hitT = 0.14;
  if (a.max || a === pet || a.owner) fx.push({ x: b.x, y: b.y - (b.max ? 26 : 14), t: 0.22, impact: true, kind: weaponKind(a) });
  sfx(b.max ? "hit" : "crate_hit", b);
  if (b === p) shake(d >= 400 ? 7 : 4);
  if (hasGear(a, 5) && b.max) a.hp = Math.min(a.max, a.hp + d * 0.05);
  // 데미지 숫자: 내가 준 피해 초록, 내가(내 편이) 받은 피해 빨강, 그 밖 흰색, 치명타는 크게
  const tcol = isMine(b) ? "#ff5a5a" : isMine(a) ? "#5ee07a" : "#ffffff";
  fx.push({ x: b.x, y: b.y, t: 0.65, text: Math.round(d), tcol, big: crit });
  if (!b.max && b.hp <= 0) {
    // 부서짐: 즉시 충돌·공격 대상에서 빠지고 breakFx 초 파괴 연출 후 사라짐 → respawn 초 뒤 같은 자리에 다시 생김
    fx.push({ x: b.x, y: b.y, t: CHEST_RULES.breakFx, crateBurst: true });
    b.broken = true;
    boxes = boxes.filter((x) => x !== b);
    if (!boxRespawns.some((q) => q.x === b.x && q.y === b.y)) boxRespawns.push({ x: b.x, y: b.y, t: CHEST_RULES.respawn });
    if (typeof resetNav === "function") resetNav();
    const e = rollDrop();
    dropLoot({ x: b.x, y: b.y, type: e.type, id: e.type === LOOT.accessory ? Math.floor(Math.random() * gear.length) : e.id || 0 });
    sfx("crate_break", b);
  }
}
// 아이템 떨어뜨리기: 모두 수명(CHEST_RULES.lootLife)을 가짐 → 안 주우면 사라짐
function dropLoot(l) {
  l.life = CHEST_RULES.lootLife;
  loot.push(l);
  return l;
}
// 손해 없이 바로 먹을 수 있는 아이템: 빈손일 때 주무기, 수류탄(3개 미만), 회복(체력이 깎였을 때)
function isFreeLoot(a, l) {
  if (l.type === LOOT.weapon) return !a.w;
  if (l.type === LOOT.grenade) return (a.grenades || 0) < GRENADE.max;
  if (l.type === LOOT.heal) return a.hp < a.max;
  return FEATURES.accessories && !a.gear.includes(l.id) && a.gear.length < 3;
}
// 바꿔야 하는 아이템: 다른 주무기 (액세서리가 켜져 있으면 3칸이 꽉 찼을 때 새 액세서리)
function isSwapLoot(a, l) {
  if (l.type === LOOT.weapon) return a.w && l.id !== a.w;
  if (l.type === LOOT.accessory) return FEATURES.accessories && !a.gear.includes(l.id) && a.gear.length >= 3;
  return false;
}
// 봇·키보드 획득용: 지금 주워서 의미가 있는 아이템
function isUsefulLoot(a, l) {
  return isFreeLoot(a, l) || isSwapLoot(a, l);
}
function lootName(l) {
  return l.type === LOOT.weapon ? weapons[l.id][0] : l.type === LOOT.grenade ? "수류탄" : l.type === LOOT.heal ? "회복약" : gear[l.id];
}
function nearLoot(a, pred) {
  return minBy(loot.filter((x) => dist(a, x) < 48 && (!pred || pred(a, x))), (x) => dist(a, x));
}
// pred 를 주면 그 조건에 맞는 아이템만 줍는다 (기본: 주워서 의미가 있는 것)
function pickup(a, pred = isUsefulLoot) {
  let l = nearLoot(a, pred);
  if (!l || l.taken) return;
  l.taken = true; // 같은 프레임 중복 획득 방지
  if (l.type === LOOT.weapon) {
    if (a.w) dropLoot({ x: l.x + 20, y: l.y, type: LOOT.weapon, id: a.w });
    a.w = l.id;
  } else if (l.type === LOOT.grenade) {
    a.grenades = Math.min(GRENADE.max, (a.grenades || 0) + GRENADE.perPickup);
  } else if (l.type === LOOT.heal) {
    const amt = a.max * (l.amount ?? HEAL.ratio); // 무한 생존 처치 드롭은 10% (l.amount)
    if (a === p) healActor(a, amt);
    else a.hp = Math.min(a.max, a.hp + amt);
    fx.push({ x: a.x, y: a.y, t: 0.5, healRing: true });
  } else {
    if (!FEATURES.accessories) return;
    if (a.gear.includes(l.id)) return;
    if (a.gear.length === 3) {
      let old = a.gear.shift();
      dropLoot({ x: l.x + 20, y: l.y, type: 1, id: old });
      if (old === 3) {
        a.max = 3e3;
        a.hp = Math.min(a.hp, a.max);
      }
    }
    a.gear.push(l.id);
    if (l.id === 3) {
      a.max = 3450;
      a.hp += 450;
    }
  }
  loot = loot.filter((x) => x !== l);
  if (a === p) {
    notice = "획득: " + lootName(l);
    nt = 2;
  }
  sfx(l.type === LOOT.heal ? "heal" : "pickup", a);
}
function canTarget(a, b) {
  return b !== a && b.hp > 0 && visible(a, b) && !(isMine(a) && isMine(b));
}
// 실제로 맞는지(수동 조준 근접·투사체·관통): 은신은 무적이 아니라서 은신 여부는 보지 않음
// 기본 크기(16)보다 큰 몸(보스 등)의 추가 판정 반경
function bodyR(b) {
  return b.r > 16 ? b.r - 16 : 0;
}
function canHit(a, b) {
  return b !== a && b.hp > 0 && seenIgnoringStealth(a, b) && !(isMine(a) && isMine(b));
}
function hitTargets(a) {
  const out = [];
  forEachCandidate((b) => {
    if (canHit(a, b)) out.push(b);
  });
  return out;
}
// 대상 후보 순서: 플레이어, 봇, 상자, 펫 (원본과 동일)
function forEachCandidate(fn) {
  if (fn(p)) return true;
  for (let i = 0; i < bots.length; i++) if (fn(bots[i])) return true;
  for (let i = 0; i < boxes.length; i++) if (fn(boxes[i])) return true;
  if (pet && fn(pet)) return true;
  for (let i = 0; i < ultPets.length; i++) if (fn(ultPets[i])) return true;
  return false;
}
function targets(a) {
  const out = [];
  forEachCandidate((b) => {
    if (canTarget(a, b)) out.push(b);
  });
  return out;
}
// 성능: targets(a).find(b => dist(c, b) < r) 와 같은 결과, 배열을 만들지 않음
function firstTargetNear(a, c, r) {
  let hitB;
  forEachCandidate((b) => dist(c, b) < r + bodyR(b) && canHit(a, b) && (hitB = b, true)); // 투사체: 은신해도 맞음, 큰 적(보스)은 몸 크기만큼 넓게
  return hitB;
}
// 성능: arr.sort((x, y) => key(x) - key(y))[0] 와 같은 결과 (동점이면 앞쪽 우선)
function minBy(arr, key) {
  let best, bk = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const k = key(arr[i]);
    if (best === undefined || k < bk) {
      best = arr[i];
      bk = k;
    }
  }
  return best;
}
function clearLine(a, b) {
  let n = Math.ceil(dist(a, b) / 8);
  for (let i = 1; i < n; i++) if (blocked(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, 2)) return false;
  return true;
}
// 탄창 1발이 충전되는 시간 = 무기 쿨타임 (손목시계 -10%)
// 캐릭터 고유 기본 공격 (맨손일 때만, 플레이어): 상훈 먹물 곡사 / 은숙 빛 구체. 무기를 주우면 그 무기로
function basicOf(a) {
  if (a !== p || a.w !== 0) return null;
  const D = SKILL_DATA[character];
  return D && D.basic || null;
}
function attackRange(a) {
  const B = basicOf(a);
  return B ? B.range : weapons[a.w][3];
}
function reloadTime(a) {
  const B = basicOf(a);
  if (B) return B.reload * (hasGear(a, 4) ? 0.9 : 1) * (a.reloadMul || 1);
  return weapons[a.w][2] * (hasGear(a, 4) ? 0.9 : 1) * (a.reloadMul || 1);
}
function updateAmmo(a, dt) {
  if (a.ammo >= AMMO.max) {
    a.reload = 0;
    return;
  }
  a.reload += dt;
  const t = reloadTime(a);
  if (a.reload >= t) {
    a.reload -= t;
    a.ammo++;
    if (a === p) sfx("reload", a);
  }
}
// 수류탄 투척 (소모품): 기존 수류탄 판정 그대로 (0.8초 후 반경 90, 피해 500, 벽을 넘어감)
function throwGrenade(a, x, y) {
  if (a.stun > 0 || (a.grenades || 0) < 1 || (a.grenCD || 0) > 0) return false;
  let [, d, , r] = weapons[GRENADE.weaponId];
  d *= hasGear(a, 2) ? 1.15 : 1;
  const ang = Math.atan2(y - a.y, x - a.x), len = Math.min(r, Math.hypot(x - a.x, y - a.y));
  a.grenades--;
  a.grenCD = GRENADE.gap;
  a.reveal = 1.2;
  if (a === p) p.stealth = 0;
  a.attackAng = ang;
  a.aimT = 0.35;
  a.swing = { kind: "throw", w: GRENADE.weaponId, t: 0, dur: WEAPON_FEEL[GRENADE.weaponId].dur };
  shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx: clamp(a.x + Math.cos(ang) * len, 0, W), ty: clamp(a.y + Math.sin(ang) * len, 0, H), t: GRENADE.fuse, d, gren: true });
  sfx("grenade_throw", a);
  return true;
}
function attack(a, x, y) {
  if (a.stun > 0) return;
  if (a.cd > 0) return;
  if (a.ammo !== undefined && a.ammo < 1) return; // 탄창이 비었으면 충전될 때까지 대기
  a.reveal = 1.2;
  if (a === p) p.stealth = 0;
  let [name, d, cd, r] = weapons[a.w];
  // 동기: 맨손 3연타 콤보(잽-스트레이트-훅), 카운터 게이지가 가득이면 이번 공격이 카운터 펀치
  if (a === p && character === "suit") {
    const C = SKILL_DATA.suit.combo;
    p.comboStep = a.w === 0 && elapsed - (p.comboT ?? -9) < C.reset ? ((p.comboStep || 0) + 1) % 3 : 0;
    p.comboT = elapsed;
    p.comboMul = a.w === 0 ? C.mults[p.comboStep] : 1;
    p.counterNow = p.counter >= 1;
    if (p.counterNow) {
      p.counter = 0;
      fx.push({ x: a.x, y: a.y - 70, t: 0.7, text: "카운터!", tcol: "#ffd23f", big: true });
    }
  }
  // 타격감: 공격 방향으로 몸·무기 돌리기, 무기별 모션·반동·총구 불꽃·효과음
  const kind = weaponKind(a);
  a.aimT = 0.35;
  a.swing = { kind, w: a.w, t: 0, dur: WEAPON_FEEL[a.w].dur };
  sfx(WEAPON_FEEL[a.w].sound, a);
  if (a === p && WEAPON_FEEL[a.w].kick) shake(WEAPON_FEEL[a.w].kick);
  // 탄창 1발 소모, 다음 발까지 짧은 간격만 둠 (충전은 reloadTime 마다 1발)
  a.ammo -= 1;
  a.cd = AMMO.fireGap;
  d *= hasGear(a, 2) ? 1.15 : 1;
  let ang = Math.atan2(y - a.y, x - a.x);
  a.attackAng = ang;
  const B = basicOf(a);
  if (B) { // 캐릭터 고유 원거리 기본 공격
    const dd = B.dmg * (hasGear(a, 2) ? 1.15 : 1);
    if (B.kind === "lob") { // 상훈: 곡사 (벽·강을 넘어감), 착탄 지점 소범위
      const len = Math.min(B.range, Math.max(30, Math.hypot(x - a.x, y - a.y)));
      shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx: clamp(a.x + Math.cos(ang) * len, 0, W), ty: clamp(a.y + Math.sin(ang) * len, 0, H), t: B.flight, flight: B.flight, octo: 3, d: dd, S: B, basic: true });
    } else { // 은숙: 직선 빛 구체 (벽에 막힘, 단일 대상)
      shots.push({ a, x: a.x, y: a.y, vx: Math.cos(ang) * B.speed, vy: Math.sin(ang) * B.speed, left: B.range, d: dd, range: B.range, basic: true, orb: true, hitR: B.width });
    }
    return;
  }
  if (a === p && a.w !== 6) fx.push({ x: a.x, y: a.y, t: 0.22, cone: true, ang, r, half: angles[a.w] * Math.PI / 360 });
  if (a.w < 3) {
    for (let b of hitTargets(a)) { // 휘두른 범위 안이면 은신해도 맞음
      let delta = Math.atan2(Math.sin(Math.atan2(b.y - a.y, b.x - a.x) - ang), Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - ang));
      if (dist(a, b) <= r && Math.abs(delta) <= angles[a.w] * Math.PI / 360 && clearLine(a, b)) {
        hit(a, b, d, { basic: true });
        if (a === p && character === "suit" && p.comboStep === 2 && a.w === 0) knock(b, b.x - a.x, b.y - a.y, SKILL_DATA.suit.combo.hookPush);
      }
    }

    fx.push({ x: a.x + Math.cos(ang) * r * 0.6, y: a.y + Math.sin(ang) * r * 0.6, t: 0.18, ring: r * 0.55 });
  } else if (a.w === 6) {
    let len = Math.min(r, Math.hypot(x - a.x, y - a.y)), q = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx: clamp(q.x, 0, W), ty: clamp(q.y, 0, H), t: 0.8, d, gren: true });
  } else {
    for (let i = 0; i < (a.w === 4 ? 5 : 1); i++) {
      let v = ang + (a.w === 4 ? (i - 2) * Math.PI / 12 : 0);
      shots.push({ a, x: a.x, y: a.y, vx: Math.cos(v) * 650, vy: Math.sin(v) * 650, left: r, d: d * (a === p && p.counterNow ? SKILL_DATA.suit.passive.mult : 1), shotgun: a.w === 4, range: r, basic: true });
    }
  }
  if (a === p) p.counterNow = false; // 카운터는 이번 공격 한 번만
}

// 무기 종류: 근접(맨손·검·망치) / 총 / 투척
function weaponKind(a) {
  if (!a || a.w === undefined) return "pet";
  return a.w < 3 ? "melee" : a.w === 6 ? "throw" : "gun";
}
