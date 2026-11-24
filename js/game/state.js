// 라운드 초기화

// 봇 외형 배정 순서 (예전 Object.keys(sheets) + "bear" 순서와 같음)
const BOT_VISUAL_ORDER = ["suit", "octo", "stripe", "soccer", "support", "summoner", "runner", "bear"];
// 결과 화면용 집계 (실제로 일어난 일만 기록, 게임 규칙에는 영향 없음)
let stats = { kills: 0, damage: 0, rank: 0, time: 0 };
function reset() {
  stats = { kills: 0, damage: 0, rank: 0, time: 0 };
  elapsed = 0;
  zone = 1450;
  flight = null;
  pet = null;
  summonCD = Array(8).fill(0);
  skillCD = 0;
  swapCD = 0;
  selected = 0;
  p = actor(...MAP_JUNGLE.playerSpawn);
  p.run = 0;
  p.runCD = 0;
  p.heal = 0;
  p.healCD = 0;
  p.energy = 0;
  p.tackle = 0;
  p.tackleCD = 0;
  p.lastMoveDir = 4;
  p.s1 = 0;
  p.s2 = 0;
  p.focus = 0;
  p.guard = 0;
  p.stealth = 0;
  p.combo = 0;
  bots = MAP_JUNGLE.botSpawns.map((a, i) => Object.assign(actor(...a), { visual: BOT_VISUAL_ORDER.filter((k) => k !== character)[i] }));
  boxes = MAP_JUNGLE.crates.map(([x, y]) => ({ x, y, hp: 1e3 }));
  loot = [];
  shots = [];
  fx = [];
  over = "";
  notice = "";
  if (singleRun) setupWaveRun(); // 싱글 웨이브 미션: 봇 대신 웨이브 적
  else mobShots = [];
}
