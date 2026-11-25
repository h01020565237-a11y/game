"""몬스터 충돌·길찾기 테스트: python3 tests/collision.py [index.html]
- 플레이어를 맵 여러 곳(벽 뒤·좁은 통로·다리·강가·모서리)에 두고, 사방에서 몬스터(보통/큰 몸/보스)를 출발시켜 추적
- 확인: 벽·물·상자 안으로 들어간 프레임 0, 끼여서 3초 넘게 못 움직인 몬스터 0, 도달 비율
- 성능: 몬스터 24마리가 동시에 추적할 때 프레임당 길찾기 시간
게임 루프를 멈추고 update(1/60) 를 직접 돌림 (같은 결과 반복)"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
JS = r'''
window.T = {};
T.inside = (a) => { const r = (a.r || 16) - 3; return terrain(a.x, a.y, r) || blocked(a.x, a.y, r) || nearBox(a.x, a.y, r + 11); };
T.run = (spots, kinds, secs) => {
  startEndless("suit"); document.body.classList.add("menuOpen"); god = true;
  singleRun.t = 0.01; for (let i = 0; i < 10; i++) update(1 / 60);
  singleRun.plan = []; singleRun.spawnQ = []; // 자동 스폰 끔
  const out = [];
  for (const [px, py, name] of spots) {
    bots = []; shots = []; mobShots = [];
    p.x = px; p.y = py;
    const ms = [];
    kinds.forEach((k, i) => {
      const ang = i / kinds.length * Math.PI * 2, d = 420 + (i % 3) * 120;
      const q = freeSpot(clamp(px + Math.cos(ang) * d, 60, W - 60), clamp(py + Math.sin(ang) * d, 60, H - 60), k === "boss" ? 34 : 18);
      if (!q) return;
      let m;
      if (k === "boss") { m = makeEnemy("tank", q); m.r = 34; m.atkT = 99; const q2 = freeSpot(m.x, m.y, 34); m.x = q2.x; m.y = q2.y; } else m = makeEnemy(k, q);
      m.spawnT = 0; m.atkT = 99; m.dmg = 0; m.stealth = 0; m.noStealth = true;
      ms.push(m);
    });
    let insideFrames = 0, maxStuck = 0, navMs0 = navStats.ms, frames = Math.round(secs * 60);
    const st = ms.map((m) => ({ x: m.x, y: m.y, t: 0, best: 1e9 }));
    for (let f = 0; f < frames; f++) {
      p.x = px; p.y = py; p.hp = p.max;
      for (const m of ms) { m.atkT = 99; m.stealth = 0; }
      update(1 / 60);
      ms.forEach((m, i) => {
        if (T.inside(m)) insideFrames++;
        const s = st[i], d = Math.hypot(m.x - px, m.y - py);
        s.best = Math.min(s.best, d);
        const keeps = !!(ENEMY_TYPES[m.mob] && ENEMY_TYPES[m.mob].keep); // 원거리형은 일부러 거리 유지
        if (!keeps && Math.hypot(m.x - s.x, m.y - s.y) < 2 && d > 90) { s.t += 1 / 60; maxStuck = Math.max(maxStuck, s.t); } else { s.t = 0; s.x = m.x; s.y = m.y; }
      });
    }
    out.push({ name, n: ms.length, insideFrames, maxStuck: +maxStuck.toFixed(2), reached: st.filter((s, i) => s.best < 110 || (ENEMY_TYPES[ms[i].mob] && ENEMY_TYPES[ms[i].mob].keep)).length, stuckKinds: ms.filter((m, i) => st[i].t > 2).map((m) => m.mob), navMsPerFrame: +((navStats.ms - navMs0) / frames).toFixed(3) });
  }
  return out;
};
0;
'''
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2000)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    pg.evaluate(JS)
    # 플레이어 자리: 맵 가운데 광장 / 돌담 뒤 / 강가·다리 / 풀숲 모서리 / 좁은 통로 근처
    spots = pg.evaluate('''(() => { const c = [[1236, 690, "가운데 광장"]];
      const pick = (name, test) => { for (let y = 80; y < H - 80; y += 24) for (let x = 80; x < W - 80; x += 24) if (!terrain(x, y) && !blocked(x, y) && !nearBox(x, y, 30) && test(x, y)) return [x, y, name]; return null; };
      c.push(pick("돌담 바로 뒤", (x, y) => blocked(x + 30, y, 2) && blocked(x + 30, y - 20, 2) && x < 700));
      c.push(pick("강가(물 바로 옆)", (x, y) => terrain(x + 28, y, 2) && !terrain(x + 10, y, 2) && y > 300));
      c.push(pick("다리 위", (x, y) => terrain(x, y - 30, 2) && terrain(x, y + 30, 2) && !terrain(x, y)));
      c.push(pick("좁은 통로", (x, y) => (blocked(x - 26, y, 2) || terrain(x - 26, y, 2)) && (blocked(x + 26, y, 2) || terrain(x + 26, y, 2))));
      return c.filter(Boolean); })()''')
    print('spots', spots)
    kinds = ["melee", "melee", "mobile", "tank", "ranged", "melee", "boss", "melee"]
    res = pg.evaluate(f'T.run({json.dumps(spots)}, {json.dumps(kinds)}, 14)')
    for r in res:
        print(r)
        ok(f"[{r['name']}] 몬스터가 벽·물·상자 안에 들어간 프레임 0", r['insideFrames'] == 0, r['insideFrames'])
        ok(f"[{r['name']}] 3초 넘게 끼인 몬스터 없음", r['maxStuck'] < 3, r['maxStuck'])
        ok(f"[{r['name']}] 근접 도달 {r['reached']}/{r['n']} (원거리형은 사거리 유지)", r['reached'] >= r['n'] - 2, r['reached'])
    perf = pg.evaluate('T.run([[1236, 690, "24마리"]], Array(24).fill("melee"), 8)')[0]
    print(perf)
    ok('24마리 동시 추적: 프레임당 길찾기 1ms 미만', perf['navMsPerFrame'] < 1, perf['navMsPerFrame'])
    ok('24마리: 벽 안 0', perf['insideFrames'] == 0, perf['insideFrames'])
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
