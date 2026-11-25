// ===== 시야·풀숲 (js/data/vision.js) =====
// 판정 함수는 진영과 상관없이 같음 (PvP 에서도 그대로 쓸 수 있게):
//   inSight(a, b)  a 쪽 시야 안에 b 가 있나 (플레이어 편은 현곤·포켓몬 시야 공유)
//   concealed(a, b) b 가 풀숲에 숨어서 a 에게 안 보이나 (같은 풀숲·가까움·노출 중이면 보임)
//   visible(a, b)  (js/engine/world.js) = 은신 아님 && 숨지 않음 && 시야 안 → 자동 조준·자동 공격·AI 대상
// 수동 조준·광역·이미 날아간 투사체는 canHit() 이라 시야 밖·풀숲 속 적도 맞음

function visionOn() {
  if (!singleRun) return VISION.on.pvp;
  return singleRun.endless && !singleRun.story ? VISION.on.wave : VISION.on.single;
}
function playerSight() {
  return (CHARACTER_STATS[character]?.sight || 320) * (p.sightMul || 1);
}
function isPlayerSide(a) {
  return a === p || a === pet || a.owner === p || a.clone || ultPets.includes(a);
}
// 시야 원 (프레임마다 한 번 계산). 소환이 풀리면 그 포켓몬 시야도 바로 빠짐
let visionCache = { t: -1, list: [] };
function visionSources() {
  if (visionCache.t === elapsed && visionCache.p === p) return visionCache.list;
  const list = [{ x: p.x, y: p.y, r: playerSight() }];
  for (const pt of [pet, ...ultPets]) if (pt && pt.hp > 0 && pt.life > 0) list.push({ x: pt.x, y: pt.y, r: VISION.petSight * (p.sightMul || 1) });
  visionCache = { t: elapsed, p, list };
  return list;
}
function inPlayerVision(b) {
  if (!visionOn()) return true;
  const br = b.r || 16;
  for (const s of visionSources()) if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 <= (s.r + br) ** 2) return true;
  return false;
}
function inSight(a, b) {
  if (!visionOn() || !b.max) return true;
  if (isPlayerSide(a)) return isPlayerSide(b) || inPlayerVision(b);
  if (a.mob) {
    if (a.bossId) return true; // 보스는 플레이어를 항상 앎 (보스전)
    return dist(a, b) <= (ENEMY_TYPES[a.mob]?.sight || VISION.enemySight);
  }
  return true;
}
// 풀숲 번호 (없으면 -1). 같은 풀숲에 있으면 서로 보임
function bushIndex(a) {
  if (!inBush(a)) return -1;
  if (a._bi !== undefined && a._bix === a.x && a._biy === a.y) return a._bi;
  let i = bushes.findIndex((q) => a.x > q[0] && a.x < q[0] + q[2] && a.y > q[1] && a.y < q[1] + q[3]);
  a._bi = i;
  a._bix = a.x;
  a._biy = a.y;
  return i;
}
function concealed(a, b) {
  if (!inBush(b) || b.reveal > 0) return false;
  if (dist(a, b) < BUSH_RULES.near) return false;
  const i = bushIndex(b);
  return !(i >= 0 && bushIndex(a) === i);
}

// ----- 적 AI: 보이면 쫓고, 놓치면 마지막 본 자리 → 주변 수색. 처음부터 못 봤으면 플레이어가 마지막으로 드러났던 쪽으로 -----
// (풀숲에 숨으면 숨기 전 자리까지만 따라옴. 웨이브 생존이 끊기지 않게 멀리 있는 적도 대략 그쪽으로 옴)
function mobGoal(a) {
  if (!visionOn() || a.bossId) return p;
  if (visible(a, p)) {
    a.seen = { x: p.x, y: p.y, t: elapsed };
    a.searchT = 0;
    return p;
  }
  const exp = p.exposed || p;
  if (a.seen && elapsed - a.seen.t < VISION.memory) {
    if (dist(a, a.seen) > 24) return a.seen;
    // 도착했는데 없음: 근처를 돌며 찾기
    if (!a.searchAt || dist(a, a.searchAt) < 20 || elapsed > (a.searchT || 0)) {
      const v = Math.random() * 7;
      a.searchAt = { x: clamp(a.seen.x + Math.cos(v) * VISION.search, 30, W - 30), y: clamp(a.seen.y + Math.sin(v) * VISION.search, 30, H - 30) };
      a.searchT = elapsed + 1.5;
    }
    return a.searchAt;
  }
  return exp;
}
// 매 프레임: 플레이어가 드러나 있던 마지막 자리 (풀숲 밖이거나 노출 중)
function updateVision() {
  if (!visionOn()) return;
  if (!inBush(p) || p.reveal > 0) p.exposed = { x: p.x, y: p.y };
}

// ----- 그림: 시야 밖 어둡게 (작은 캔버스에 그려서 늘림 = 부드러운 경계, 모바일 가벼움) -----
let visionMask = null, visionMaskG = null;
function drawVisionDark() {
  if (!visionOn()) return;
  const k = VISION.maskScale, w = Math.max(2, Math.ceil(VW * k)), h = Math.max(2, Math.ceil(VH * k));
  if (!visionMask) {
    visionMask = document.createElement("canvas");
    visionMaskG = visionMask.getContext("2d");
  }
  if (visionMask.width !== w || visionMask.height !== h) {
    visionMask.width = w;
    visionMask.height = h;
  }
  const m = visionMaskG;
  m.globalCompositeOperation = "source-over";
  m.clearRect(0, 0, w, h);
  m.fillStyle = `rgba(${VISION.tint}, ${VISION.dark})`;
  m.fillRect(0, 0, w, h);
  m.globalCompositeOperation = "destination-out";
  for (const s of visionSources()) {
    const x = (s.x - camX) * k, y = (s.y - camY) * k, r = s.r * k, e = Math.min(VISION.edge * k, r * 0.6);
    if (x + r < 0 || y + r < 0 || x - r > w || y - r > h) continue;
    const gr = m.createRadialGradient(x, y, Math.max(0, r - e), x, y, r);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    m.fillStyle = gr;
    m.beginPath();
    m.arc(x, y, r, 0, 7);
    m.fill();
  }
  m.globalCompositeOperation = "source-over";
  g.save();
  g.imageSmoothingEnabled = true;
  g.drawImage(visionMask, 0, 0, w, h, camX, camY, w / k, h / k);
  g.restore();
}
