// 한 프레임 게임 로직 (자기장, 상태이상, 펫, 플레이어, 봇 AI, 투사체)

function update(dt) {
  if (over) return;
  elapsed += dt;
  zone = Math.max(115, 1450 - Math.max(0, elapsed - 25) * 8);
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
        b.frame = ((b.frame || 0) + dt * 12) % 8;
      }
    }
    b.prevX = b.x;
    b.prevY = b.y;
  }
  for (let k of ["s1", "s2", "focus", "guard", "stealth"]) p[k] = Math.max(0, p[k] - dt);
  if (character === "support") p.hp = Math.min(p.max, p.hp + p.max * 3e-3 * dt);
  if (character === "runner") {
    p.run = Math.max(0, p.run - dt);
    p.runCD = Math.max(0, p.runCD - dt);
    p.tackleCD = Math.max(0, p.tackleCD - dt);
  }
  if (character === "bear") {
    p.run = Math.max(0, p.run - dt);
    p.runCD = Math.max(0, p.runCD - dt);
    p.healCD = Math.max(0, p.healCD - dt);
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
  summonCD = summonCD.map((v) => Math.max(0, v - dt));
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
      pet = null;
    } else {
      command();
      let b = bots.filter((b2) => b2.hp > 0).sort((a, b2) => dist(pet, a) - dist(pet, b2))[0], m = mons[pet.id];
      if (b) {
        if (dist(pet, b) > m[3] || blocked((pet.x + b.x) / 2, (pet.y + b.y) / 2, 2)) move(pet, b.x - pet.x, b.y - pet.y, dt);
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
  for (let a of [p, ...bots]) a.cd = Math.max(0, a.cd - dt);
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
  if (character === "runner" && p.tackle <= 0 && p.dash <= 0 && p.run <= 0) p.energy = Math.min(100, p.energy + Math.hypot(p.x - ox, p.y - oy) / 6);
  if (!freeze) for (let a of bots.filter((a2) => a2.hp > 0 && !(a2.stun > 0))) {
    let l = loot.filter((l2) => l2.type === 0 && !a.w).sort((x, y) => dist(a, x) - dist(a, y))[0];
    let b = targets(a).sort((x, y) => dist(a, x) + (x.max && !a.w ? 150 : 0) - (dist(a, y) + (y.max && !a.w ? 150 : 0)))[0];
    if (Math.hypot(a.x - W / 2, a.y - H / 2) > zone - 40) {
      move(a, W / 2 - a.x, H / 2 - a.y, dt);
      continue;
    }
    if (b && b.max && dist(a, b) < 230 && (a.skillTimer || 0) <= elapsed) {
      a.skillTimer = elapsed + 7 + Math.random() * 3;
      let k = a.visual;
      if (k === "bear" || k === "support") {
        a.hp = Math.min(a.max, a.hp + a.max * 0.18);
        fx.push({ x: a.x, y: a.y, t: 0.6, text: "회복" });
      } else if (k === "octo") {
        throwOcto(a, Math.random() < 0.5 ? 1 : 2);
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
    if (l && dist(a, l) < 250) {
      move(a, l.x - a.x, l.y - a.y, dt);
      pickup(a);
    } else if (b) {
      let r = weapons[a.w][3];
      if (dist(a, b) > r * 0.75) {
        let x = a.x, y = a.y;
        move(a, b.x - a.x, b.y - a.y, dt);
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
      let b = targets(s.a).find((b2) => dist(s, b2) < 18);
      if (b) {
        hit(s.a, b, s.d * (s.shotgun ? 0.35 + 0.65 * clamp(s.left / s.range, 0, 1) : 1));
        if (s.slow) b.slow = 2.5;
        s.dead = true;
      }
    }
  }
  shots = shots.filter((s) => !s.dead);
  fx = fx.filter((f) => (f.t -= dt) > 0);
  if (p.hp <= 0) over = "패배 — R 재시작";
  else if (!bots.some((a) => a.hp > 0)) over = "승리! — R 재시작";
}
