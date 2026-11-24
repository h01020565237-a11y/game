// 캐릭터 스킬

function tackleInput() {
  return Math.hypot(mvX, mvY) > 0.15 ? [mvX, mvY] : [(keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0)];
}
// 소환사를 제외한 캐릭터의 스킬1/스킬2 (예전 이름 bearSkill)
function characterSkill(i) {
  if (over || character === "summoner") return;
  if (extraNames[character]) {
    extraSkill(i);
    return;
  }
  if (character === "runner") {
    if (i === 1 && p.runCD <= 0 && p.energy >= 50) {
      p.energy -= 50;
      p.run = 2;
      p.runCD = 6;
    }
    if (i === 2 && p.tackleCD <= 0 && p.dash <= 0) {
      let [x, y] = tackleInput();
      if (Math.hypot(x, y) < 0.15) {
        x = Math.sin(p.lastMoveDir * Math.PI / 4);
        y = -Math.cos(p.lastMoveDir * Math.PI / 4);
      }
      p.lastMoveDir = (Math.round(Math.atan2(x, -y) / (Math.PI / 4)) + 8) % 8;
      p.tx = x;
      p.ty = y;
      p.tackle = 0.22;
      p.tackleCD = 8;
      p.tackleDamage = p.run > 0 ? 600 : 400;
      p.tackleHits = new Set();
    }
    return;
  }
  if (i === 1 && p.runCD <= 0) {
    p.run = 1;
    p.runCD = 7;
  }
  if (i === 2 && p.healCD <= 0) {
    p.heal = 2.5;
    p.healCD = 12;
  }
}
function throwOcto(a, i) {
  let range = (i === 1 ? 300 : 250) * 1.2;
  let b = targets(a).filter((b2) => dist(a, b2) <= range).sort((b2, c2) => (b2.max ? 0 : 1e3) + dist(a, b2) - (c2.max ? 0 : 1e3) - dist(a, c2))[0];
  let dx = Math.sin(a.dir * Math.PI / 4), dy = -Math.cos(a.dir * Math.PI / 4);
  let tx = b ? b.x : clamp(a.x + dx * range, 20, W - 20), ty = b ? b.y : clamp(a.y + dy * range, 20, H - 20);
  shots.push({ a, x: a.x, y: a.y, sx: a.x, sy: a.y, tx, ty, t: 0.55, octo: i, d: i === 1 ? 450 : 250 });
  a.reveal = 1.2;
}
function extraSkill(i) {
  let k = i === 1 ? "s1" : "s2";
  if (p[k] > 0) return;
  p[k] = i === 1 ? 7 : 9;
  let [x, y] = tackleInput();
  if (Math.hypot(x, y) < 0.15) {
    x = Math.sin(p.lastMoveDir * Math.PI / 4);
    y = -Math.cos(p.lastMoveDir * Math.PI / 4);
  }
  let n = Math.hypot(x, y) || 1;
  x /= n;
  y /= n;
  let enemies = bots.filter((b2) => b2.hp > 0 && dist(p, b2) < (i === 1 ? 120 : 300) && !blocked((p.x + b2.x) / 2, (p.y + b2.y) / 2, 2));
  let front = enemies.filter((b2) => ((b2.x - p.x) * x + (b2.y - p.y) * y) / Math.max(1, dist(p, b2)) > 0.65).sort((a, b2) => dist(p, a) - dist(p, b2));
  let b = front[0];
  fx.push({ x: p.x, y: p.y, t: 0.65, text: extraNames[character][i - 1] });
  if (character === "suit") {
    if (i === 1) p.focus = 3;
    else p.guard = 2;
  }
  if (character === "octo") {
    p[k] = i === 1 ? 5 : 9;
    throwOcto(p, i);
  }
  if (character === "stripe") {
    if (i === 1) p.stealth = 3;
    else {
      for (let j = 0; j < 8; j++) move(p, x, y, 0.07);
      for (let a of bots.filter((a2) => a2.hp > 0 && dist(p, a2) < 65)) hit(p, a, 450);
      p.stealth = 0;
    }
  }
  if (character === "soccer") {
    if (i === 1) {
      for (let j = 0; j < 8; j++) move(p, x, y, 0.06);
      for (let a of bots.filter((a2) => a2.hp > 0 && dist(p, a2) < 60)) hit(p, a, 300);
    } else shots.push({ a: p, x: p.x, y: p.y, vx: x * 650, vy: y * 650, left: 500, d: 500, soccer: true, bounces: 3 });
  }
  if (character === "support") {
    if (i === 1) {
      p.hp = Math.min(p.max, p.hp + p.max * 0.2);
      fx.push({ x: p.x, y: p.y, t: 0.5, ring: 100 });
    } else shots.push({ a: p, x: p.x, y: p.y, vx: x * 650, vy: y * 650, left: 350, d: 250, slow: true });
  }
}
