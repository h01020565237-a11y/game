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
  summonCD = Array(mons.length).fill(0);
  skillCD = 0;
  swapCD = 0;
  selected = 0;
  p = actor(...MAP_JUNGLE.playerSpawn);
  // 스킬 상태 (판마다 새로): 쿨타임 q·e, 궁극기 충전 ult(0~1)·발동 중 ultT, 캐릭터별 게이지
  p.skcd = { q: 0, e: 0 }; // 스킬 쿨타임 (p.cd 는 기존 공격 간격)
  p.ult = 0;
  p.ultT = 0;
  p.run = 0;
  p.heal = 0;
  p.energy = 0;
  p.tackle = 0;
  p.lastMoveDir = 4;
  p.stealth = 0;
  p.combo = 0;
  p.counter = 0;
  p.sulk = 0;
  ultPets = [];
  clones = [];
  bots = MAP_JUNGLE.botSpawns.map((a, i) => Object.assign(actor(...a), { visual: BOT_VISUAL_ORDER.filter((k) => k !== character)[i] }));
  boxes = MAP_JUNGLE.crates.map(([x, y]) => ({ x, y, hp: 1e3 }));
  loot = [];
  shots = [];
  fx = [];
  over = "";
  notice = "";
  if (!singleRun?.endless) restoreEndlessSkills(); // 무한 생존 밖에서는 항상 원래 스킬 수치
  hazards = [];
  gameTimers = [];
  if (singleRun) setupWaveRun(); // 싱글 웨이브 미션·무한 생존: 봇 대신 웨이브 적
  else mobShots = [];
}
