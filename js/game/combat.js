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

function hit(a, b, d) {
  if (b === p && god) return;
  // 스킬·패시브 수치는 SKILL_DATA (js/data/skills.js)
  if (b === p && p.guard > 0) {
    d *= SKILL_DATA.suit.e.take;
    if (a.max && a !== p) a.hp -= d * SKILL_DATA.suit.e.reflect;
  }
  if (a === p && character === "suit") {
    if (p.focus > 0) d *= SKILL_DATA.suit.q.mult;
    else if (Math.random() < SKILL_DATA.suit.passive.chance) d *= SKILL_DATA.suit.passive.mult;
  }
  if (a === p && character === "stripe" && b.max) {
    let vx = Math.sin(b.dir * Math.PI / 4), vy = -Math.cos(b.dir * Math.PI / 4);
    if ((p.x - b.x) * vx + (p.y - b.y) * vy < 0) d *= SKILL_DATA.stripe.passive.mult;
  }
  if (a === p && character === "soccer" && ++p.combo % SKILL_DATA.soccer.passive.every === 0) d *= SKILL_DATA.soccer.passive.mult;
  d *= a.weak > 0 ? PET_SKILLS[4].weakMul : 1;
  // 싱글 강화 카드 (이번 미션의 p 에만 있는 값. 배틀로얄에서는 없음 → 1)
  if (a === p && p.dmgMul) d *= p.dmgMul;
  if (b === p && p.takeMul) d *= p.takeMul;
  d *= hasGear(b, 1) ? 0.9 : 1;
  if (b === p && character === "bear") {
    const B = SKILL_DATA.bear.passive;
    d *= 1 - B.perFoe * Math.min(B.maxFoes, bots.filter((a2) => a2.hp > 0 && dist(a2, p) < B.radius).length);
  }
  // 집계: 플레이어(와 내 포켓몬)가 적에게 입힌 피해·처치
  if (b.max && b !== p && b !== pet && (a === p || a === pet) && b.hp > 0) {
    stats.damage += Math.min(d, b.hp);
    if (b.hp - d <= 0) stats.kills++;
  }
  b.hp -= d;
  if (!b.max) b.flash = elapsed + 0.12;
  // 타격감: 피격 깜빡임·밀림 흔들림, 타격 이펙트, 효과음, 내가 맞으면 화면 흔들림
  if (b.max) b.hitT = 0.14;
  if (a.max || a === pet) fx.push({ x: b.x, y: b.y - (b.max ? 26 : 14), t: 0.22, impact: true, kind: weaponKind(a) });
  sfx(b.max ? "hit" : "crate_hit", b);
  if (b === p) shake(d >= 400 ? 7 : 4);
  if (hasGear(a, 5) && b.max) a.hp = Math.min(a.max, a.hp + d * 0.05);
  fx.push({ x: b.x, y: b.y, t: 0.65, text: Math.round(d) });
  if (!b.max && b.hp <= 0) {
    fx.push({ x: b.x, y: b.y, t: 0.45, crateBurst: true });
    fx.push({ x: b.x, y: b.y, t: 2, debris: true }); // 바닥 잔해 (그림만, 충돌 없음)
    boxes = boxes.filter((x) => x !== b);
    const e = rollDrop();
    loot.push({ x: b.x, y: b.y, type: e.type, id: e.type === LOOT.accessory ? Math.floor(Math.random() * gear.length) : e.id || 0 });
    sfx("crate_break", b);
  }
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
  if (!l) return;
  if (l.type === LOOT.weapon) {
    if (a.w) loot.push({ x: l.x + 20, y: l.y, type: LOOT.weapon, id: a.w });
    a.w = l.id;
  } else if (l.type === LOOT.grenade) {
    a.grenades = Math.min(GRENADE.max, (a.grenades || 0) + GRENADE.perPickup);
  } else if (l.type === LOOT.heal) {
    const before = a.hp;
    a.hp = Math.min(a.max, a.hp + a.max * HEAL.ratio);
    fx.push({ x: a.x, y: a.y - 20, t: 0.8, text: "+" + Math.round(a.hp - before), heal: true });
    fx.push({ x: a.x, y: a.y, t: 0.5, healRing: true });
  } else {
    if (!FEATURES.accessories) return;
    if (a.gear.includes(l.id)) return;
    if (a.gear.length === 3) {
      let old = a.gear.shift();
      loot.push({ x: l.x + 20, y: l.y, type: 1, id: old });
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
  return b !== a && b.hp > 0 && visible(a, b) && !(a === p && b === pet) && !(a === pet && b === p);
}
// 대상 후보 순서: 플레이어, 봇, 상자, 펫 (원본과 동일)
function forEachCandidate(fn) {
  if (fn(p)) return true;
  for (let i = 0; i < bots.length; i++) if (fn(bots[i])) return true;
  for (let i = 0; i < boxes.length; i++) if (fn(boxes[i])) return true;
  return pet ? fn(pet) : false;
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
  forEachCandidate((b) => dist(c, b) < r && canTarget(a, b) && (hitB = b, true));
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
function reloadTime(a) {
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
  if (a === p && a.w !== 6) fx.push({ x: a.x, y: a.y, t: 0.22, cone: true, ang, r, half: angles[a.w] * Math.PI / 360 });
  if (a.w < 3) {
    for (let b of targets(a)) {
      let delta = Math.atan2(Math.sin(Math.atan2(b.y - a.y, b.x - a.x) - ang), Math.cos(Math.atan2(b.y - a.y, b.x - a.x) - ang));
      if (dist(a, b) <= r && Math.abs(delta) <= angles[a.w] * Math.PI / 360 && clearLine(a, b)) hit(a, b, d);
    }
    fx.push({ x: a.x + Math.cos(ang) * r * 0.6, y: a.y + Math.sin(ang) * r * 0.6, t: 0.18, ring: r * 0.55 });
  } else if (a.w === 6) {
    let len = Math.min(r, Math.hypot(x - a.x, y - a.y)), q = { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
    shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx: clamp(q.x, 0, W), ty: clamp(q.y, 0, H), t: 0.8, d, gren: true });
  } else {
    for (let i = 0; i < (a.w === 4 ? 5 : 1); i++) {
      let v = ang + (a.w === 4 ? (i - 2) * Math.PI / 12 : 0);
      shots.push({ a, x: a.x, y: a.y, vx: Math.cos(v) * 650, vy: Math.sin(v) * 650, left: r, d, shotgun: a.w === 4, range: r });
    }
  }
}

// 무기 종류: 근접(맨손·검·망치) / 총 / 투척
function weaponKind(a) {
  if (!a || a.w === undefined) return "pet";
  return a.w < 3 ? "melee" : a.w === 6 ? "throw" : "gun";
}
