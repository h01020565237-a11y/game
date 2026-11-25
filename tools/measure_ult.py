"""궁극기 피해 측정 (강화 카드 없음, 허수아비 1/5/10개)
python3 tools/measure_ult.py [dist/index.html]  →  표 출력 + docs/ULT_MEASURE.md

- 게임 루프를 멈추고 update(1/60) 를 직접 돌려 정확히 같은 조건으로 측정 (실시간 아님)
- 허수아비: 체력 무한, 움직이지 않음. 플레이어 오른쪽 110px 를 중심으로 모여 있음 (5개 반경 60, 10개 반경 95)
- 궁극기는 허수아비 무리 중심을 조준해서 1번 사용, 효과가 끝날 때까지(최대 12초) 허수아비가 받은 피해 합계
- 현곤: 일반 소환수 1마리(10초) 피해와 궁극기(3마리 8초) 피해를 따로
- 평균 충전 시간: 허수아비 5개 앞에서 기본 공격 + Q/E(쿨타임마다) 로 PvE 기준 0→100% 걸리는 시간 (궁극기 미사용)
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html'
url = pathlib.Path(f).resolve().as_uri()
CH = sys.argv[3].split(',') if len(sys.argv) > 3 else ['suit', 'summoner', 'support', 'runner', 'octo', 'stripe', 'soccer', 'bear']
JS = r'''
window.M = {};
M.setup = (ch, n, mode = "static") => {
  openLobby(); lobbySel = ch; document.querySelector("#lobbyStart").click();
  document.body.classList.add("menuOpen"); // RAF 루프 정지 → 직접 스텝
  god = true; freeze = true; aiming = false; mouse.down = false; mvX = 0; mvY = 0;
  p.x = 1236; p.y = 520; p.lastMoveDir = 2; p.dir = 2;
  pet = null; flight = null; ultPets = []; clones = []; shots = []; fx = []; boxes = []; loot = [];
  const cx = p.x + (mode === "far" ? 300 : 110), cy = p.y, R = n === 1 ? 0 : n === 5 ? 60 : 95;
  M.mode = mode; M.t = 0;
  bots = [];
  for (let i = 0; i < n; i++) {
    const a = i === 0 ? 0 : (i - 1) / Math.max(1, n - 1) * Math.PI * 2, r = i === 0 ? 0 : R * (i % 2 ? 1 : 0.6);
    const d = actor(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    Object.assign(d, { hp: 1e9, max: 1e9, dummy: true, dir: 6, w: 0, name: "dummy" });
    bots.push(d);
  }
  M.cx = cx; M.cy = cy;
  M.log = { dmg: 0, hits: 0, byTarget: new Map(), heal: 0, stun: 0, slow: 0, knock: 0 };
  return bots.length;
};
// 피해 기록: 허수아비가 실제로 잃은 HP
if (!window.__hitWrapped) {
  window.__hitWrapped = true;
  const _hit = hit;
  window.hit = hit = function (a, b, d, o = {}) {
    const before = b.hp, st = b.stun || 0;
    const r = _hit(a, b, d, o);
    if (b.track && M.log && before - b.hp > 0) { M.log.dmg += before - b.hp; M.log.hits++; }
    if (b.dummy && M.log) {
      const got = before - b.hp;
      if (got > 0) { M.log.dmg += got; M.log.hits++; M.log.byTarget.set(b, (M.log.byTarget.get(b) || 0) + got); }
      if ((b.stun || 0) > st + 0.01) M.log.stun++;
      b.hp = b.max; // 무한 체력
    }
    return r;
  };
}
M.step = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { b4(); update(1 / 60); } };
function b4() {
  M.t += 1 / 60;
  bots.forEach((b, i) => {
    if (!b.dummy) return;
    if (M.mode === "move") { // 움직이는 적: 무리 중심 둘레를 초당 120px 로 돎 (넉백·기절 무시하고 계속 이동)
      const a = M.t * 120 / 80 + i * 1.3, r = 50 + (i % 3) * 25;
      b.x = M.cx + Math.cos(a) * r; b.y = M.cy + Math.sin(a) * r; b.moving = true;
    } else { b.x = b._x ?? (b._x = b.x); b.y = b._y ?? (b._y = b.y); }
    if (b.slow > 0) M.log.slowT = (M.log.slowT || 0) + 1 / 60;
  });
}
// 실제 보스 (무한 생존 W5 보스, 실제 AI 로 움직이고 공격함, 플레이어 무적)
M.boss = (ch, bossId) => {
  startEndless(ch); document.body.classList.add("menuOpen"); god = true;
  singleRun.wave = 4; singleRun.bossCycle = [bossId]; nextEndlessWave(); singleRun.t = 0.01;
  for (let i = 0; i < 400 && singleRun.phase !== "boss"; i++) update(1 / 60);
  const B = singleRun.boss; B.hp = B.max = 1e8; B.dummy = false; B.track = true;
  bots = bots.filter((b) => b === B);
  B.x = 1236; B.y = 640; // 맵 가장자리 등장 위치 대신 가운데 (플레이어가 맵 밖으로 나가지 않게)
  p.x = B.x - 120; p.y = B.y; pet = null; ultPets = []; clones = [];
  M.cx = B.x; M.cy = B.y; M.mode = "boss";
  M.log = { dmg: 0, hits: 0, byTarget: new Map(), stun: 0 };
  p.ult = 1; p.ultT = 0;
  castSkill("r", { x: B.x, y: B.y });
  let t = 0;
  update(1 / 60);
  while (t < 12 && (M.active() || t < 0.1)) { for (let k = 0; k < 3; k++) update(1 / 60); t += 0.05; }
  for (let k = 0; k < 30; k++) update(1 / 60);
  return { dmg: Math.round(M.log.dmg), hits: M.log.hits, dur: +t.toFixed(2) };
};
M.active = () => p.punchRush || p.zoneUlt || p.heartUlt || p.tentUlt || p.jump || ultPets.length || clones.length || shots.some((s) => s.a === p || s.a?.owner === p) || p.ultT > 0;
M.ult = () => {
  p.ult = 1; p.ultT = 0;
  const hp0 = p.hp; p.hp = p.max * 0.5; const h0 = p.hp;
  const ok = castSkill("r", { x: M.cx, y: M.cy });
  let t = 0;
  M.step(1 / 60);
  while (t < 12 && (M.active() || t < 0.1)) { M.step(0.05); t += 0.05; }
  M.step(0.5);
  return { ok, dmg: Math.round(M.log.dmg), hits: M.log.hits, dur: +t.toFixed(2), stunned: bots.filter((b) => b.stun > 0).length, slowT: +(M.log.slowT || 0).toFixed(1), heal: Math.round(p.hp - h0), targets: M.log.byTarget.size, ultAfter: +p.ult.toFixed(3) };
};
// 현곤 일반 소환수: 덱 첫 포켓몬 1마리 소환 → 사라질 때까지
M.pet = () => {
  selected = 0; summonCD.fill(0); mouse.x = M.cx - 40; mouse.y = M.cy;
  summon();
  let t = 0;
  M.step(0.5);
  while (t < 15 && (pet || flight)) { M.step(0.05); t += 0.05; }
  return { dmg: Math.round(M.log.dmg), hits: M.log.hits, dur: +t.toFixed(2), deck: deck.map((i) => mons[i][0]).join("·") };
};
// 충전 시간: 기본 공격 + 스킬, 궁극기 미사용
M.charge = () => {
  p.ult = 0; aiming = true;
  let t = 0;
  while (t < 240 && p.ult < 1) {
    for (const s of ["q", "e"]) if (skillCdLeft(s) <= 0) castSkill(s, { x: M.cx, y: M.cy });
    if (character === "summoner" && !pet && !flight) { mouse.x = M.cx - 40; mouse.y = M.cy; summon(); }
    if (character === "runner") p.energy = 100;
    M.step(0.1); t += 0.1;
    p.x = 1236; p.y = 520; // 제자리
  }
  aiming = false;
  return { t: +t.toFixed(1), dps: Math.round(M.log.dmg / t) };
};
0;
'''
out = {}
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500); pg.evaluate('closeTitle()')
    pg.evaluate(JS)
    for ch in CH:
        out[ch] = {}
        for n in [1, 5, 10]:
            pg.evaluate(f'M.setup("{ch}", {n})')
            out[ch][n] = pg.evaluate('M.ult()')
        pg.evaluate(f'M.setup("{ch}", 5, "move")'); out[ch]['move5'] = pg.evaluate('M.ult()')
        pg.evaluate(f'M.setup("{ch}", 1, "far")'); out[ch]['far1'] = pg.evaluate('M.ult()')
        runs = [pg.evaluate(f'(Math.random = (() => {{ let s = {seed}; return () => (s = (s * 16807) % 2147483647) / 2147483647; }})(), M.boss("{ch}", "bear"))') for seed in (11, 22, 33, 44, 55)]
        out[ch]['boss'] = {'avg': round(sum(r['dmg'] for r in runs) / len(runs)), 'min': min(r['dmg'] for r in runs), 'max': max(r['dmg'] for r in runs), 'runs': [r['dmg'] for r in runs]}
        pg.evaluate('endSingle(); reset()')
        if ch == 'summoner':
            for n in [1, 5, 10]:
                pg.evaluate(f'M.setup("{ch}", {n})')
                out[ch][f'pet{n}'] = pg.evaluate('M.pet()')
        pg.evaluate(f'M.setup("{ch}", 5)')
        out[ch]['charge'] = pg.evaluate('M.charge()')
        print(ch, json.dumps(out[ch], ensure_ascii=False), flush=True)
    print('errors', errs)
    b.close()
json.dump(out, open(sys.argv[2] if len(sys.argv) > 2 else '/tmp/ult_measure.json', 'w'), ensure_ascii=False, indent=1)
