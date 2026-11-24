// 라운드 초기화

function reset() {
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
  bots = MAP_JUNGLE.botSpawns.map((a, i) => Object.assign(actor(...a), { visual: Object.keys(sheets).concat("bear").filter((k) => k !== character)[i] }));
  boxes = MAP_JUNGLE.crates.map(([x, y]) => ({ x, y, hp: 1e3 }));
  loot = [];
  shots = [];
  fx = [];
  over = "";
  notice = "";
}
