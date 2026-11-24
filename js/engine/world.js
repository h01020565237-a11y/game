// 월드: 전역 상태, 지형/충돌, 이동

const waterBits = atob(MAP_JUNGLE.water.bits);
function wet(x, y) {
  let i = Math.floor(y / 6) * 412 + Math.floor(x / 6);
  return i >= 0 && i < 95584 && !!(waterBits.charCodeAt(i >> 3) & 128 >> (i & 7));
}
let character = "summoner";
const W = MAP_JUNGLE.width, H = MAP_JUNGLE.height, VW = c.width, VH = c.height, keys = {}, mouse = { x: 500, y: 300, down: false };
let p, bots, boxes, loot, shots, fx, last = 0, god = false, freeze = false, over = "", notice = "", nt = 0;
const rivers = [], walls = MAP_JUNGLE.walls, bushes = MAP_JUNGLE.bushes;
let camX = 0, camY = 0, elapsed = 0, zone = 1450;
function inBushXY(px, py) {
  for (let i = 0; i < bushes.length; i++) {
    const b = bushes[i];
    if (px > b[0] && px < b[0] + b[2] && py > b[1] && py < b[1] + b[3]) return true;
  }
  return false;
}
// 성능: 위치가 바뀌지 않았으면 이전 결과 재사용 (결과는 동일)
const inBush = (a) => {
  if (a._bx !== a.x || a._by !== a.y) {
    a._bx = a.x;
    a._by = a.y;
    a._bush = inBushXY(a.x, a.y);
  }
  return a._bush;
};
const visible = (a, b) => !b.max || !(a.ink > 0 && dist(a, b) > 110) && (!(b.stealth > 0) && (!inBush(b) || inBush(a)) || dist(a, b) < 75 || b.reveal > 0);
// 성능: 임시 배열 없이 같은 순서로 5점 검사
const terrain = (x, y, r = 16) => wet(x, y) || wet(x + r, y) || wet(x - r, y) || wet(x, y + r) || wet(x, y - r);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function actor(x, y) {
  return { x, y, hp: 3e3, max: 3e3, w: 0, gear: [], cd: 0, dir: 4, frame: 0, moving: false, dash: 0, dashCD: 0, dx: 0, dy: 0 };
}
function nearBox(x, y, r) {
  for (let i = 0; i < boxes.length; i++) if (Math.hypot(x - boxes[i].x, y - boxes[i].y) < r) return true;
  return false;
}
function blocked(x, y, r = 16) {
  for (let i = 0; i < walls.length; i++) {
    const q = walls[i];
    if (x + r > q[0] && x - r < q[0] + q[2] && y + r > q[1] && y - r < q[1] + q[3]) return true;
  }
  return false;
}
function move(a, dx, dy, dt) {
  if (a.stun > 0) {
    a.moving = false;
    return;
  }
  let n = Math.hypot(dx, dy);
  a.moving = n > 0.01;
  if (!a.moving) return;
  dx /= n;
  dy /= n;
  a.dir = (Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8;
  a.frame = (a.frame + dt * 12) % 8;
  let s = 150 * (a === p && pet ? 1.1 : 1) * (a === p && a.run > 0 ? character === "runner" ? 1.6 : 1.7 : 1) * (a === p && a.heal > 0 ? 0.7 : 1) * (a.slow > 0 ? 0.65 : 1) * (a.dash > 0 ? 4 : 1) * (a.gear.includes(0) ? 1.1 : 1) * dt, x = clamp(a.x + dx * s, 18, W - 18), y = clamp(a.y + dy * s, 18, H - 18);
  if (!terrain(x, a.y) && !blocked(x, a.y) && !nearBox(x, a.y, 30)) a.x = x;
  if (!terrain(a.x, y) && !blocked(a.x, y) && !nearBox(a.x, y, 30)) a.y = y;
}
