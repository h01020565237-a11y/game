// 배열을 새로 만들지 않고 조건에 맞는 원소만 남김 (GC 감소)
function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
  arr.length = j;
}
// 한 프레임 게임 로직 (자기장, 상태이상, 펫, 플레이어, 봇 AI, 투사체)

function update(dt) {
  if (over) return;
  if (singleRun && singleRun.phase === "cards") return; // 강화 카드 고르는 동안 전투 정지
  elapsed += dt;
  zone = singleRun?.m && !singleRun.m.zone ? 1e9 : Math.max(115, 1450 - Math.max(0, elapsed - 25) * 8);
  for (let a of [p, ...bots]) {
    a.reveal = Math.max(0, (a.reveal || 0) - dt);
    if (a.hp > 0 && Math.hypot(a.x - W / 2, a.y - H / 2) > zone && !(a === p && god)) a.hp -= dt * (80 + elapsed * 0.7);
  }
  for (let b of bots) {
    if (b.prevX !== void 0) {
      let dx = b.x - b.prevX, dy = b.y - b.prevY;
      b.moving = Math.hypot(dx, dy) > 0.05;
      if (b.moving) {
        b.dir = (Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8;
        // 버그 수정(3.3): move() 로 이미 프레임을 넘긴 경우 다시 넘기지 않음 (예전엔 2배속)
        if (!b._anim) b.frame = ((b.frame || 0) + dt * 12) % 8;
      }
    }
    b.prevX = b.x;
    b.prevY = b.y;
    b._anim = false;
  }
  for (let k of ["s1", "s2", "focus", "guard", "stealth"]) p[k] = Math.max(0, p[k] - dt * (k[0] === "s" && k.length === 2 ? p.cdRate || 1 : 1));
  if (character === "support") p.hp = Math.min(p.max, p.hp + p.max * 3e-3 * dt);
  if (character === "runner") {
    p.run = Math.max(0, p.run - dt);
    p.runCD = Math.max(0, p.runCD - dt * (p.cdRate || 1));
    p.tackleCD = Math.max(0, p.tackleCD - dt * (p.cdRate || 1));
  }
  if (character === "bear") {
    p.run = Math.max(0, p.run - dt);
    p.runCD = Math.max(0, p.runCD - dt * (p.cdRate || 1));
    p.healCD = Math.max(0, p.healCD - dt * (p.cdRate || 1));
    if (p.heal > 0) {
      let t = Math.min(dt, p.heal);
      p.hp = Math.min(p.max, p.hp + p.max * 0.1 * t);
      p.heal -= t;
    }
  }
  if (flight) {
    flight.t += dt;
    if (flight.t >= 0.42) {
      let { tx: x, ty: y, id } = flight, m = mons[id];
      pet = { ...actor(x, y), id, hp: m[4], max: m[4], life: 10 };
      fx.push({ x, y, t: 0.55, burst: true });
      flight = null;
    }
  }
  nt -= dt;
  summonCD = summonCD.map((v) => Math.max(0, v - dt * (p.cdRate || 1)));
  swapCD = Math.max(0, swapCD - dt);
  skillCD = Math.max(0, skillCD - dt);
  for (let b of [p, ...bots]) {
    for (let k of ["stun", "slow", "weak", "ink"]) b[k] = Math.max(0, (b[k] || 0) - dt);
    if (b.burn > 0 && b.hp > 0) {
      b.burn -= dt;
      b.burnTick -= dt;
      if (b.burnTick <= 0) {
        b.burnTick += 1;
        hit({ gear: [] }, b, 55);
      }
    }
  }
  if (pet) {
    pet.life -= dt;
    pet.pose = Math.max(0, (pet.pose || 0) - dt);
    pet.cd = Math.max(0, pet.cd - dt);
    if (pet.life <= 0 || pet.hp <= 0) {
      fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true });
      sfx("pet_return", pet);
      pet = null;
    } else {
      command();
      let b = minBy(bots.filter((b2) => b2.hp > 0), (b2) => dist(pet, b2)), m = mons[pet.id];
      if (b) {
        if (dist(pet, b) > m[3] || blocked((pet.x + b.x) / 2, (pet.y + b.y) / 2, 2)) steer(pet, b.x, b.y, dt); // AI: 경로 탐색
        else {
          pet.moving = false;
          pet.dir = (Math.round(Math.atan2(b.x - pet.x, pet.y - b.y) / (Math.PI / 4)) + 8) % 8;
          if (pet.cd <= 0) {
            pet.cd = 0.8;
            pet.pose = 0.25;
            hit(pet, b, m[2]);
            fx.push({ x: b.x, y: b.y, sx: pet.x, sy: pet.y, t: 0.24, bolt: pet.id === 0, ring: 22 });
          }
        }
      }
    }
  }
  for (let a of [p, ...bots]) {
    a.cd = Math.max(0, a.cd - dt);
    a.grenCD = Math.max(0, (a.grenCD || 0) - dt);
    updateAmmo(a, dt);
    // 타격감 타이머 (그림용)
    a.aimT = Math.max(0, (a.aimT || 0) - dt);
    a.hitT = Math.max(0, (a.hitT || 0) - dt);
    if (a.swing && (a.swing.t += dt) >= a.swing.dur) a.swing = null;
  }
  // 자기장 경고음: 축소 시작, 그리고 내가 자기장 밖에 있으면 3초마다
  if (!singleRun && elapsed - dt < 25 && elapsed >= 25) sfx("zone_warning");
  if (!singleRun && p.hp > 0 && Math.hypot(p.x - W / 2, p.y - H / 2) > zone && (p.zoneWarnT || 0) <= elapsed) {
    p.zoneWarnT = elapsed + 3;
    sfx("zone_warning");
  }
  p.dashCD = Math.max(0, p.dashCD - dt);
  let ox = p.x, oy = p.y;
  if (character === "runner" && p.tackle > 0) {
    let step = Math.min(dt, p.tackle);
    let n = Math.hypot(p.tx, p.ty) || 1;
    for (let k = 0; k < 3; k++) {
      let bx = p.x, by = p.y;
      move(p, p.tx, p.ty, step * 1.25);
      if (Math.hypot(p.x - bx, p.y - by) < 1e-6) {
        p.tackle = 0;
        break;
      }
      for (let b of bots.filter((b2) => b2.hp > 0 && !p.tackleHits.has(b2) && dist(p, b2) < 38)) {
        p.tackleHits.add(b);
        hit(p, b, p.tackleDamage);
        for (let j = 0; j < 8; j++) {
          let x = clamp(b.x + p.tx / n * 6, 18, W - 18), y = clamp(b.y + p.ty / n * 6, 18, H - 18);
          if (terrain(x, y) || blocked(x, y) || boxes.some((q) => dist({ x, y }, q) < 30)) break;
          b.x = x;
          b.y = y;
        }
        fx.push({ x: b.x, y: b.y, t: 0.3, ring: 38 });
      }
    }
    p.tackle = Math.max(0, p.tackle - step);
    fx.push({ x: p.x, y: p.y, t: 0.18, trail: true, dir: p.dir, frame: 0 });
  } else if (p.dash > 0) {
    fx.push({ x: p.x, y: p.y, t: 0.18, trail: true, dir: p.dir, frame: Math.floor(p.frame) });
    let step = Math.min(dt, p.dash);
    move(p, p.dx, p.dy, step);
    p.dash = Math.max(0, p.dash - step);
  } else {
    let [ix, iy] = tackleInput();
    if (Math.hypot(ix, iy) > 0.15) p.lastMoveDir = (Math.round(Math.atan2(ix, -iy) / (Math.PI / 4)) + 8) % 8;
    move(p, ix, iy, dt);
    if (aiming) {
      autoAttack();
    } else if (mouse.down) attack(p, mouse.x, mouse.y);
  }
  // 자동 획득: 지나가기만 하면 손해 없는 아이템은 바로 먹음 (교체는 버튼/F 키)
  if (p.hp > 0) pickup(p, isFreeLoot);
  if (character === "runner" && p.tackle <= 0 && p.dash <= 0 && p.run <= 0) p.energy = Math.min(100, p.energy + Math.hypot(p.x - ox, p.y - oy) / 6);
  if (singleRun?.m) updateWave(dt); // 싱글: 웨이브 적은 전용 AI
  if (!freeze) for (let a of bots.filter((a2) => a2.hp > 0 && !(a2.stun > 0) && !a2.mob)) {
    let l = a.w ? undefined : minBy(loot.filter((l2) => l2.type === 0), (x) => dist(a, x));
    let b = minBy(targets(a), (x) => dist(a, x) + (x.max && !a.w ? 150 : 0));
    if (Math.hypot(a.x - W / 2, a.y - H / 2) > zone - 40) {
      steer(a, W / 2, H / 2, dt); // AI: 물·벽을 돌아서 자기장 안으로
      continue;
    }
    // 수정(3.5): 정장·소환사 봇의 직접 피해 스킬은 벽 너머로 쓰지 않음 (시야가 열릴 때까지 대기)
    if (b && b.max && dist(a, b) < 230 && (a.skillTimer || 0) <= elapsed && (a.visual !== "suit" && a.visual !== "summoner" || clearLine(a, b))) {
      a.skillTimer = elapsed + 7 + Math.random() * 3;
      let k = a.visual;
      // 봇 스킬 효과음 (그 캐릭터의 해당 스킬 소리, 거리에 따라 작게)
      sfx({ bear: "skill_bear_e", support: "skill_support_q", suit: "skill_suit_q", stripe: "skill_stripe_e", runner: "skill_runner_e", soccer: "skill_soccer_q", summoner: "pet_summon" }[k] || "", a);
      if (k === "bear" || k === "support") {
        a.hp = Math.min(a.max, a.hp + a.max * 0.18);
        fx.push({ x: a.x, y: a.y, t: 0.6, text: "회복" });
      } else if (k === "octo") {
        const oi = Math.random() < 0.5 ? 1 : 2;
        sfx(oi === 1 ? "skill_octo_q" : "skill_octo_e", a);
        throwOcto(a, oi);
      } else if (k === "suit") {
        hit(a, b, 250);
      } else if (k === "stripe" || k === "runner" || k === "soccer") {
        let dx = b.x - a.x, dy = b.y - a.y;
        for (let j = 0; j < 6; j++) move(a, dx, dy, 0.05);
        if (dist(a, b) < 85) hit(a, b, 350);
      } else if (k === "summoner") {
        hit(a, b, 180);
        fx.push({ x: b.x, y: b.y, t: 0.4, ring: 35 });
      }
    }
    // 수류탄: 대상이 벽 뒤에 있거나 가끔, 투척 거리 안이면 던짐 (플레이어와 같은 규칙: 최대 3개, 자동 충전 없음)
    if (a.grenades > 0 && b && b.max && (a.grenT || 0) <= elapsed && dist(a, b) > 90 && dist(a, b) < weapons[GRENADE.weaponId][3] && (!clearLine(a, b) || Math.random() < 0.02)) {
      if (throwGrenade(a, b.x, b.y)) a.grenT = elapsed + 3 + Math.random() * 2;
    }
    if (l && dist(a, l) < 250) {
      steer(a, l.x, l.y, dt);
      pickup(a);
    } else if (b) {
      let r = weapons[a.w][3];
      // AI: 사거리 밖이거나, 벽에 가려 공격이 막히면(수류탄 제외) 경로를 따라 접근
      if (dist(a, b) > r * 0.75 || a.w !== 6 && !clearLine(a, b)) {
        let x = a.x, y = a.y;
        steer(a, b.x, b.y, dt);
        if (dist(a, { x, y }) < 0.1) {
          let sign = a.avoid || (a.avoid = Math.random() < 0.5 ? 1 : -1);
          move(a, (b.y - a.y) * sign, -(b.x - a.x) * sign, dt);
          if (dist(a, { x, y }) < 0.1) a.avoid = -sign;
        }
      } else {
        a.moving = false;
        attack(a, b.x, b.y);
      }
      pickup(a);
    }
  }
  for (let s of shots) {
    if (s.octo) {
      s.t -= dt;
      let u = clamp(1 - s.t / 0.55, 0, 1);
      s.x = s.sx + (s.tx - s.sx) * u;
      s.y = s.sy + (s.ty - s.sy) * u;
      if (s.t <= 0) {
        if (s.octo === 2 && !s.armed) {
          s.armed = true;
          s.t = 3;
          s.sx = s.tx;
          s.sy = s.ty;
        } else if (s.octo === 1) {
          for (let b of [p, ...bots, ...boxes].filter((b2) => b2 !== s.a && b2.hp > 0 && dist(b2, { x: s.tx, y: s.ty }) < 85)) {
            hit(s.a, b, s.d);
            if (b.max) b.ink = 2;
          }
          fx.push({ x: s.tx, y: s.ty, t: 0.7, inkBurst: true });
          s.dead = true;
        } else s.dead = true;
      }
      if (s.armed && !s.dead) {
        let b = [p, ...bots].find((b2) => b2 !== s.a && b2.hp > 0 && dist(b2, { x: s.tx, y: s.ty }) < 65);
        if (b) {
          hit(s.a, b, s.d);
          b.stun = 1.5;
          s.dead = true;
          fx.push({ x: s.tx, y: s.ty, t: 0.5, inkBurst: true });
        }
      }
      continue;
    }
    if (s.gren) {
      s.t -= dt;
      let u = clamp(1 - s.t / 0.8, 0, 1);
      s.x = s.sx + (s.tx - s.sx) * u;
      s.y = s.sy + (s.ty - s.sy) * u;
      if (s.t <= 0) {
        for (let b of [p, ...bots, ...boxes, ...pet ? [pet] : []]) if (b !== s.a && b.hp > 0 && !(s.a === p && b === pet) && !(s.a === pet && b === p) && dist({ x: s.tx, y: s.ty }, b) <= 90) hit(s.a, b, s.d);
        fx.push({ x: s.tx, y: s.ty, t: 0.45, explosion: true });
        sfx("grenade_explode", { x: s.tx, y: s.ty });
        if (Math.hypot(p.x - s.tx, p.y - s.ty) < 300) shake(8);
        s.dead = true;
      }
      continue;
    }
    let steps = Math.ceil(dt * 650 / 8);
    for (let i = 0; i < steps && !s.dead; i++) {
      s.x += s.vx * dt / steps;
      s.y += s.vy * dt / steps;
      s.left -= 650 * dt / steps;
      if (s.soccer && s.bounces > 0 && (blocked(s.x, s.y, 2) || s.x < 0 || s.x > W || s.y < 0 || s.y > H)) {
        s.x -= s.vx * dt / steps;
        s.y -= s.vy * dt / steps;
        s.vx *= -1;
        s.vy *= -1;
        s.bounces--;
        s.d *= 1.15;
        continue;
      }
      if (blocked(s.x, s.y, 2) || s.left < 0 || s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
        s.dead = true;
        break;
      }
      let b = firstTargetNear(s.a, s, 18);
      if (b) {
        hit(s.a, b, s.d * (s.shotgun ? 0.35 + 0.65 * clamp(s.left / s.range, 0, 1) : 1));
        if (s.slow) b.slow = 2.5;
        s.dead = true;
      }
    }
  }
  compact(shots, (s) => !s.dead);
  compact(fx, (f) => (f.t -= dt) > 0);
  if (p.hp <= 0) over = "패배";
  else if (singleRun) {
    if (singleRun.phase === "clear") over = "미션 성공";
  } else if (!bots.some((a) => a.hp > 0)) over = "승리!";
  if (over) {
    sfx(over === "패배" ? "defeat" : "victory");
    stats.rank = over === "패배" ? bots.filter((a) => a.hp > 0).length + 1 : 1;
    stats.time = elapsed;
  }
}
