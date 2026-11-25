// ===== 무한 생존 맵 순환 (Juyeop_Wave_Maps_V2, 현곤 경기장 V1) =====
// 규칙(js/data/wave_maps.js): 웨이브 w 의 맵 = cycle[floor(w / 5) % 5] → 1~4 운동장, 5~9 체육관, 10~14 옥상, 15~19 번화가, 20~24 신전, 25~ 반복
// 5의 배수 보스 웨이브에 현곤이 뽑히면 그 웨이브만 경기장, 다음 일반 웨이브는 순환 맵으로 복귀
// 전환: 카드 선택이 끝난 뒤 카운트다운 앞에서 암전 → 맵·충돌·길찾기 교체 → 안전 위치 배치 → 맵 이름 → 카운트다운·보스
// 스토리 미션·배틀로얄은 정글 맵 그대로 (reset 에서 항상 정글로 되돌림)

function waveMapsOn() {
  return !!(singleRun?.endless && !singleRun.story);
}
// 다음 보스 미리 보기: 순환이 비었으면 여기서 섞어 채움 (spawnEndlessBoss 와 같은 순환)
function peekEndlessBoss() {
  const R = singleRun;
  if (!R.bossCycle.length) {
    R.bossCycle = Object.keys(ENDLESS_BOSSES);
    for (let i = R.bossCycle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [R.bossCycle[i], R.bossCycle[j]] = [R.bossCycle[j], R.bossCycle[i]];
    }
  }
  return R.bossCycle[0];
}
function waveMapFor(wave) {
  const M = WAVE_MAP_RULES;
  if (wave % M.every === 0 && peekEndlessBoss() === M.arenaBoss) return WAVE_MAPS[M.arena];
  return WAVE_MAPS[M.cycle[Math.floor(wave / M.every) % M.cycle.length]];
}
// nextEndlessWave 에서 호출: 바꿀 맵이 있으면 예약
function planWaveMap() {
  const R = singleRun;
  if (!waveMapsOn()) return;
  const def = waveMapFor(R.wave);
  if (def === activeMap) return;
  preloadMap(def);
  R.mapSwap = { def, t: 0, done: false };
}
function preloadMap(def) {
  if (!mapImgs[def.id]) mapImgs[def.id] = loadImage(def.background);
}

// 맵 실제 교체 (전투 정리 + 배치). 런 진행(체력·레벨·카드·궁극기·포켓몬·기록)은 그대로
function applyWaveMap(def) {
  setActiveMap(def);
  bots = bots.filter((b) => !b.mob); // 이전 맵 적 (웨이브 끝에 이미 비워짐, 안전용)
  shots = [];
  mobShots = [];
  hazards = [];
  boxes = []; // 웨이브 맵은 보물상자 없음 (그림 속 상자는 고정 엄폐물)
  boxRespawns = [];
  loot = [];
  fx = [];
  const s = freeSpot(def.playerSpawn[0], def.playerSpawn[1], p.r || 16) || { x: def.playerSpawn[0], y: def.playerSpawn[1] };
  p.x = s.x;
  p.y = s.y;
  p._nav = null;
  p.dash = 0;
  // 따라다니는 것들(포켓몬·궁극기 소환수·분신)은 플레이어 옆으로
  const follow = (a, i) => {
    if (!a) return;
    const ang = i * 2.1, q = freeSpot(p.x + Math.cos(ang) * 40, p.y + Math.sin(ang) * 40, a.r || 16) || p;
    a.x = q.x;
    a.y = q.y;
    a._nav = null;
  };
  follow(pet, 0);
  ultPets.forEach((a, i) => follow(a, i + 1));
  clones.forEach((a, i) => follow(a, i + 3));
  camX = clamp(p.x - VW / 2, 0, Math.max(0, W - VW));
  camY = clamp(p.y - VH / 2, 0, Math.max(0, H - VH));
  singleRun.mapName = def.name;
  singleRun.mapNameT = WAVE_MAP_RULES.nameBanner;
}

// endlessPaused 의 카운트다운 단계에서 호출. 전환 중이면 true (카운트다운·전투 정지)
function updateMapSwap(dt) {
  const R = singleRun, S = R.mapSwap, M = WAVE_MAP_RULES;
  if (!S) return false;
  S.t += dt;
  if (!S.done && S.t >= M.fadeOut) {
    S.done = true;
    applyWaveMap(S.def);
  }
  R.fadeA = S.t < M.fadeOut ? S.t / M.fadeOut : Math.max(0, 1 - (S.t - M.fadeOut) / M.fadeIn);
  if (S.t >= M.fadeOut + M.fadeIn) {
    R.mapSwap = null;
    R.fadeA = 0;
    return false;
  }
  return true;
}

// 맵 순환에 쓰는 적·보스 등장 위치: 맵이 정한 후보 중 플레이어와 충분히 먼 곳 (+약간 흩뿌림)
function waveMapSpawn(minDist, r = 16) {
  const def = activeMap;
  if (!def.enemySpawns) return null;
  const need = Math.max(minDist, def.spawnMin || 0);
  const ok = def.enemySpawns.filter(([x, y]) => Math.hypot(x - p.x, y - p.y) >= need);
  for (let k = 0; k < 12 && ok.length; k++) {
    const [x, y] = ok[Math.floor(Math.random() * ok.length)];
    const q = freeSpot(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80, r);
    if (q && Math.hypot(q.x - p.x, q.y - p.y) >= need * 0.85) return q;
  }
  return null;
}
