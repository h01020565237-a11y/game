"""이동 끊김 테스트 (2026-11-25): python3 tests/movement.py [index.html]
- 화면 주사율 60/120/144Hz·프레임 간격 흔들림에서 '그려진' 플레이어 위치가 고르게 움직이는지 (보간)
- 적 수(0·24·60)·포켓몬 소환·방향 전환 중 한 스텝 계산 시간
- 키보드 이동 회귀"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
JS = r'''
window.M = {};
// 실제 메인 루프(loop)를 가짜 시간으로 직접 돌리며, draw() 시점의 플레이어 화면 위치를 기록
M.run = (hz, jitter, frames) => {
  document.body.classList.remove("menuOpen", "lobbyOpen", "paused");
  const rec = [], _d = window.draw;
  window.draw = draw = () => rec.push(p.x);
  let t = performance.now() + 1000; last = t; acc = 0;
  let seed = 3; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const realRAF = window.requestAnimationFrame; window.requestAnimationFrame = () => 0;
  for (let i = 0; i < frames; i++) { t += 1000 / hz * (1 + (rnd() - 0.5) * jitter); loop(t); }
  window.requestAnimationFrame = realRAF; window.draw = draw = _d;
  document.body.classList.add("menuOpen");
  const d = rec.slice(4).map((x, i) => x - rec[i + 3]); // 시작 몇 프레임 제외
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const zero = d.filter((x) => Math.abs(x) < 1e-6).length;
  const dev = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / d.length) / (Math.abs(mean) || 1);
  return { mean: +mean.toFixed(3), zero, dev: +dev.toFixed(3), n: d.length };
};
M.cost = (n, pets) => {
  bots = bots.filter((b) => !b.mob);
  for (let i = 0; i < n; i++) { const q = freeSpot(p.x + Math.cos(i) * (250 + i * 6), p.y + Math.sin(i) * (200 + i * 4), 16); if (q) { const e = makeEnemy(["melee", "ranged", "tank", "mobile"][i % 4], q, { noExp: true }); e.spawnT = 0; e.dmg = 0; } }
  if (pets) { p.ult = 1; castSkill("r", { x: p.x + 40, y: p.y }); for (const pt of ultPets) pt.life = 99; }
  for (let i = 0; i < 30; i++) update(1 / 60);
  const t0 = performance.now(); let mx = 0;
  for (let i = 0; i < 240; i++) { keys.KeyD = i % 60 < 30; keys.KeyA = !keys.KeyD; const a = performance.now(); update(1 / 60); mx = Math.max(mx, performance.now() - a); }
  keys.KeyD = keys.KeyA = false;
  return { avg: +((performance.now() - t0) / 240).toFixed(3), max: +mx.toFixed(2), n: bots.filter((b) => b.mob && b.hp > 0).length };
};
0;
'''
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen'); startEndless('suit'); document.body.classList.add('menuOpen'); god = true; singleRun.t = 0.01; for (let i = 0; i < 20; i++) update(1/60); singleRun.plan = 0; singleRun.timer = 1e9; bots = []")
    pg.evaluate(JS)
    for hz, jit in [(60, 0), (60, 0.3), (120, 0), (120, 0.3), (144, 0.2), (90, 0.25)]:
        pg.evaluate("p.x = W / 2; p.y = H / 2; keys.KeyD = true")
        r = pg.evaluate(f'M.run({hz}, {jit}, 120)')
        pg.evaluate("keys.KeyD = false")
        print(hz, jit, r)
        ok(f'{hz}Hz 흔들림 {int(jit*100)}%: 멈춘 프레임 없음·간격 고름 (편차 < 35%)', r['zero'] == 0 and r['dev'] < 0.35 and r['mean'] > 0, r)
    for n, pets in [(0, False), (24, False), (60, False), (24, True)]:
        if pets:
            pg.evaluate("openLobby(); lobbySel = 'summoner'; startEndless('summoner'); document.body.classList.add('menuOpen'); god = true; singleRun.t = 0.01; for (let i = 0; i < 20; i++) update(1/60); singleRun.plan = 0; singleRun.timer = 1e9")
        r = pg.evaluate(f'M.cost({n}, {str(pets).lower()})')
        print('cost', n, pets, r)
        ok(f'적 {r["n"]}{" + 포켓몬 3" if pets else ""}: 스텝당 평균 < 4ms, 최대 < 16ms (PC 헤드리스 기준)', r['avg'] < 4 and r['max'] < 16, r)
    # 키보드 이동 회귀
    r = pg.evaluate("(() => { bots = []; p.x = W / 2; p.y = H / 2; const x0 = p.x; keys.KeyD = true; for (let i = 0; i < 60; i++) update(1/60); keys.KeyD = false; return p.x - x0; })()")
    ok('키보드 이동 회귀 (1초에 140 이상)', r > 140, r)
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
