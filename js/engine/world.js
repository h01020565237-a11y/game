// 월드: 전역 상태, 지형/충돌, 이동

// 지금 쓰는 맵 (정글: 배틀로얄·스토리 미션 / WAVE_MAPS: 무한 생존). setActiveMap 으로만 바꿈
let activeMap = MAP_JUNGLE, waterBits = atob(MAP_JUNGLE.water.bits), waterCols = 412, waterN = 95584;
function wet(x, y) {
  if (!waterBits) return false;
  let i = Math.floor(y / 6) * waterCols + Math.floor(x / 6);
  return i >= 0 && i < waterN && !!(waterBits.charCodeAt(i >> 3) & 128 >> (i & 7));
}
let character = "summoner";
// VW, VH: 화면에 보이는 월드 크기 (PC 1000×650 고정, 모바일은 화면 비율에 맞춰 view.js 가 조정)
let VW = c.width, VH = c.height;
let W = MAP_JUNGLE.width, H = MAP_JUNGLE.height;
const keys = {}, mouse = { x: 500, y: 300, down: false };
let p, bots, boxes, boxRespawns = [], loot, shots, fx, last = 0, god = false, freeze = false, over = "", notice = "", nt = 0;
let walls = MAP_JUNGLE.walls, bushes = MAP_JUNGLE.bushes;
// 맵 교체: 크기·벽·풀숲·물·길찾기 격자를 한꺼번에 바꿈 (그림은 renderer 의 mapImage)
function setActiveMap(def) {
  if (activeMap === def) return false;
  activeMap = def;
  W = def.width;
  H = def.height;
  walls = def.walls || [];
  bushes = def.bushes || [];
  waterBits = def.water ? atob(def.water.bits) : null;
  waterCols = def.water?.cols || Math.ceil(W / 6);
  waterN = def.water?.cells || 0;
  if (typeof resetNav === "function") resetNav();
  if (typeof fitCanvas === "function") fitCanvas(); // 모바일 화면 폭 상한이 맵 폭
  return true;
}
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
// 보임(자동 조준·자동 타겟·화면 표시): 은신 중이면 가까워도 안 보임 (풀숲은 예전처럼 75 이내·노출 시 보임)
// PvE 적(웨이브·무한 생존 몬스터)은 풀숲에 숨지 않음: 화면에 그려지므로 조준·피격도 되어야 함 (예전엔 풀숲 속 보스가 투사체에 안 맞음)
// 풀숲 규칙(같은 풀숲·가까움·노출)은 js/game/vision.js concealed(). PvE 적(b.mob)은 풀숲에 있어도 투사체·수동 공격은 맞음 (canHit)
const seenIgnoringStealth = (a, b) => !b.max || !(a.ink > 0 && dist(a, b) > 110) && (b.mob || !concealed(a, b));
// 보임(자동 조준·자동 공격·AI 대상): 은신 아님 + 풀숲에 숨지 않음 + 시야 안 (싱글·웨이브 시야, js/game/vision.js)
const visible = (a, b) => !b.max || !(b.stealth > 0) && !(a.ink > 0 && dist(a, b) > 110) && !concealed(a, b) && inSight(a, b);
// 성능: 임시 배열 없이 같은 순서로 5점 검사
const terrain = (x, y, r = 16) => wet(x, y) || wet(x + r, y) || wet(x - r, y) || wet(x, y + r) || wet(x, y - r);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function actor(x, y) {
  return { x, y, hp: 3e3, max: 3e3, w: 0, gear: [], cd: 0, ammo: AMMO.max, reload: 0, grenades: 0, grenCD: 0, dir: 4, frame: 0, moving: false, dash: 0, dashCD: 0, dx: 0, dy: 0 };
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
// 정해진 거리만큼 이동 (속도 버프·둔화 영향 없음, 지형 충돌 규칙은 move 와 같음: 축마다 따로 막힘 → 벽을 타고 미끄러짐)
// 이동형 스킬 미리보기(simMovePath)와 실제 이동이 같은 함수를 써서 경로가 정확히 일치
function moveRaw(a, dx, dy, d) {
  const n = Math.hypot(dx, dy);
  if (!n || d <= 0) return;
  const x = clamp(a.x + dx / n * d, 18, W - 18), y = clamp(a.y + dy / n * d, 18, H - 18);
  if (!terrain(x, a.y) && !blocked(x, a.y) && !nearBox(x, a.y, 30)) a.x = x;
  if (!terrain(a.x, y) && !blocked(a.x, y) && !nearBox(a.x, y, 30)) a.y = y;
}
const MOVE_STEP = 4;
function simMovePath(x0, y0, dx, dy, len) {
  const t = { x: x0, y: y0 }, pts = [[x0, y0]];
  for (let d = 0; d < len; d += MOVE_STEP) {
    moveRaw(t, dx, dy, Math.min(MOVE_STEP, len - d));
    pts.push([t.x, t.y]);
  }
  return pts;
}
// 돌진: 몸 크기만큼 4px 씩 나눠 검사, 막히면 그 앞에서 멈추고 true
function chargeStep(a, vx, vy, step) {
  const r = a.r || 16, n = Math.max(1, Math.ceil(step / 4));
  for (let k = 0; k < n; k++) {
    const x = clamp(a.x + vx * step / n, r + 2, W - r - 2), y = clamp(a.y + vy * step / n, r + 2, H - r - 2);
    if (terrain(x, y, r) || blocked(x, y, r) || nearBox(x, y, r + 14)) return true;
    a.x = x;
    a.y = y;
  }
  return false;
}
function move(a, dx, dy, dt) {
  if (a.stun > 0 || a.root > 0 || (a === p && p.jump)) { // 기절·이동불가(촉수 함정)·점프 중
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
  a._anim = true; // 이번 스텝에 걷기 프레임을 이미 넘김 (update 의 봇 애니메이션 중복 방지)
  let s = 150 * (a === p && (pet || ultPets.length) ? SKILL_DATA.summoner.passive.speed : 1) * (a === p && p.punchRush ? SKILL_DATA.suit.r.moveMul : 1) * (a === p && a.run > 0 ? character === "runner" ? SKILL_DATA.runner.q.speed : SKILL_DATA.bear.q.speed : 1) * (a === p && a.heal > 0 ? SKILL_DATA.bear.e.moveMul : 1) * (a.slow > 0 ? 0.65 : 1) * (a.dash > 0 ? 4 : 1) * (hasGear(a, 0) ? 1.1 : 1) * (a.spd || 1) * (a === p && p.stealth > 0 ? p.stealthSpd || 1 : 1) * dt;
  // 몸 크기(a.r, 기본 16)만큼 벽·물·상자 판정. 한 번에 많이 움직여도(빠른 이동·큰 dt) 8px 씩 나눠 검사 → 벽을 건너뛰지 않음
  const r = a.r || 16, steps = Math.max(1, Math.ceil(s / 8)), st = s / steps;
  for (let k = 0; k < steps; k++) {
    const x = clamp(a.x + dx * st, r + 2, W - r - 2), y = clamp(a.y + dy * st, r + 2, H - r - 2);
    const free = (px, py) => !terrain(px, py, r) && !blocked(px, py, r) && !nearBox(px, py, r + 14);
    const mx = x !== a.x && free(x, a.y), my = y !== a.y && free(mx ? x : a.x, y);
    if (mx) a.x = x;
    if (my) a.y = y;
    // 모서리 미끄러짐: 한 축이 벽 모서리에 몇 px 걸려 막히면 다른 축으로 살짝 비켜서 지나감 (제자리 떨림 방지)
    if (!mx && Math.abs(dx) > 0.3 && !my) {
      for (const o of [1, -1, 2, -2, 3, -3, 4, -4]) if (free(a.x, a.y + o) && free(x, a.y + o)) { a.y += Math.sign(o) * Math.min(Math.abs(o), st); break; }
    } else if (!my && Math.abs(dy) > 0.3 && !mx) {
      for (const o of [1, -1, 2, -2, 3, -3, 4, -4]) if (free(a.x + o, a.y) && free(a.x + o, y)) { a.x += Math.sign(o) * Math.min(Math.abs(o), st); break; }
    }
  }
}
