// 전투: 피해 계산, 아이템 획득, 공격

function hit(a, b, d) {
  if (b === p && god) return;
  if (b === p && p.guard > 0) {
    d *= 0.5;
    if (a.max && a !== p) a.hp -= d * 0.5;
  }
  if (a === p && character === "suit" && (p.focus > 0 || Math.random() < 0.15)) d *= 1.4;
  if (a === p && character === "stripe" && b.max) {
    let vx = Math.sin(b.dir * Math.PI / 4), vy = -Math.cos(b.dir * Math.PI / 4);
    if ((p.x - b.x) * vx + (p.y - b.y) * vy < 0) d *= 1.5;
  }
  if (a === p && character === "soccer" && ++p.combo % 4 === 0) d *= 1.3;
  d *= a.weak > 0 ? 0.8 : 1;
  d *= b.gear?.includes(1) ? 0.9 : 1;
  if (b === p && character === "bear") d *= 1 - 0.08 * Math.min(3, bots.filter((a2) => a2.hp > 0 && dist(a2, p) < 120).length);
  b.hp -= d;
  if (!b.max) b.flash = elapsed + 0.12;
  if (a.gear.includes(5) && b.max) a.hp = Math.min(a.max, a.hp + d * 0.05);
  fx.push({ x: b.x, y: b.y, t: 0.65, text: Math.round(d) });
  if (!b.max && b.hp <= 0) {
    fx.push({ x: b.x, y: b.y, t: 0.45, crateBurst: true });
    boxes = boxes.filter((x) => x !== b);
    loot.push({ x: b.x, y: b.y, type: Math.random() < 0.5 ? 0 : 1, id: 0 });
    let l = loot.at(-1);
    l.id = l.type ? Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 6);
  }
}
function pickup(a) {
  let l = minBy(loot.filter((x) => dist(a, x) < 48), (x) => dist(a, x));
  if (!l) return;
  if (l.type === 0) {
    if (a.w) loot.push({ x: l.x + 20, y: l.y, type: 0, id: a.w });
    a.w = l.id;
  } else {
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
    notice = "획득: " + (l.type ? gear[l.id] : weapons[l.id][0]);
    nt = 2;
  }
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
function attack(a, x, y) {
  if (a.stun > 0) return;
  if (a.cd > 0) return;
  a.reveal = 1.2;
  if (a === p) p.stealth = 0;
  let [name, d, cd, r] = weapons[a.w];
  a.cd = cd * (a.gear.includes(4) ? 0.9 : 1);
  d *= a.gear.includes(2) ? 1.15 : 1;
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
