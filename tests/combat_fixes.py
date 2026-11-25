"""전투 버그 수정 테스트 (2026-11-25 3~7번): python3 tests/combat_fixes.py [index.html]
3. 소환 포켓몬이 보물상자도 공격 (적이 없을 때) + 적이 있으면 적 우선
4. '은숙이를 지켜라': 적이 플레이어보다 은숙을 우선 노림 (근접·원거리 모두)
5. 은숙 떨림: 맞은 뒤 흔들림이 곧 멈춤
6. 웨이브 시작 안내 중에도 캐릭터 이동 (안내 약 1.5초)
7. 적과 몸이 닿으면 피해, 0.8초 간격 (연속 프레임 피해 없음), 위빙 무적 존중"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    # 3. 포켓몬 → 상자
    r = pg.evaluate('''(() => { startMission("eunsuk", "summoner"); document.body.classList.add("menuOpen"); god = true;
      for (let i = 0; i < 300 && singleRun.phase !== "fight"; i++) update(1/60); singleRun.plan = 0; singleRun.timer = 1e9; bots = []; mobShots = []; hazards = [];
      const bx = boxes.find((x) => !x.broken && freeSpot(x.x + 70, x.y, 16)); const q = freeSpot(bx.x + 70, bx.y, 16); p.x = q.x; p.y = q.y; visionCache.t = -1;
      const hp0 = bx.hp; pet = { ...actor(p.x + 20, p.y), id: 1, hp: 800, max: 800, life: 99, skillCD: 99, cd: 0 };
      for (let i = 0; i < 360 && !bx.broken; i++) { p.x = q.x; p.y = q.y; update(1/60); }
      const out = { boxHit: bx.broken || bx.hp < hp0, broken: !!bx.broken };
      // 적이 있으면 적 먼저
      const bx2 = boxes.find((x) => !x.broken && dist(x, p) < 400); let sp = null; for (let k = 0; k < 16 && !sp; k++) { const c = freeSpot(p.x + Math.cos(k * 0.8) * 120, p.y + Math.sin(k * 0.8) * 120, 16); if (c && !inBush(c)) sp = c; } const e = makeEnemy("tank", sp, { noExp: true }); e.spawnT = 0; e.spd = 1e-4; e.dmg = 0; e.atkT = 99; e.hunt = false;
      visionCache.t = -1; out.pickFoe = petTarget(pet) === e;
      pet = null; return out; })()''')
    ok('3. 포켓몬이 보물상자를 공격해 부숨', r['boxHit'], r)
    ok('3. 적이 있으면 적을 먼저', r['pickFoe'], r)
    # 4·5. 은숙 우선 노림·떨림
    r = pg.evaluate('''(() => { startMission("eunsuk", "summoner"); document.body.classList.add("menuOpen"); god = true;
      for (let i = 0; i < 300 && singleRun.phase !== "fight"; i++) update(1/60); singleRun.plan = 0; singleRun.timer = 1e9; bots = []; mobShots = []; hazards = [];
      const w = singleRun.ward; p.x = w.x - 150; p.y = w.y; const q1 = freeSpot(w.x + 220, w.y + 40, 16), q2 = freeSpot(w.x + 260, w.y - 60, 16);
      const m = makeEnemy("melee", q1, { noExp: true }), rg = makeEnemy("ranged", q2, { noExp: true }); m.spawnT = rg.spawnT = 0;
      const hunt = [m.hunt, rg.hunt]; const w0 = w.hp, p0 = p.hp; let hitWard = 0, closer = 0;
      for (let i = 0; i < 600; i++) { update(1/60); if (dist(m, w) < dist(m, p)) closer++; }
      const out = { hunt, wardDmg: w0 - w.hp, closer };
      // 떨림: 맞은 뒤 흔들림 값이 줄어드는지
      bots = []; mobShots = []; hit(m, w, 1); const h1 = w.hitT; for (let i = 0; i < 30; i++) update(1/60); out.hitT = [h1, w.hitT];
      return out; })()''')
    ok('4. 근접·원거리 적 모두 은숙 우선', r['hunt'] == [True, True], r)
    ok('4. 실제로 은숙이 공격받음 (근접이 은숙 쪽으로)', r['wardDmg'] > 0 and r['closer'] > 300, r)
    ok('5. 은숙 떨림(맞은 흔들림) 0.5초 안에 멈춤', r['hitT'][0] > 0 and r['hitT'][1] == 0, r['hitT'])
    # 6. 웨이브 시작 안내 중 이동
    r = pg.evaluate('''(() => { openLobby(); startEndless("suit"); document.body.classList.add("menuOpen"); god = true; const R = singleRun;
      const ph = R.phase, t0 = R.t; const x0 = p.x; keys.KeyD = true; for (let i = 0; i < 30; i++) update(1/60); keys.KeyD = false;
      return { ph, t0, moved: p.x - x0, still: R.phase }; })()''')
    ok('6. 안내(카운트다운) 1.5초, 그동안 캐릭터 이동', r['ph'] == 'count' and abs(r['t0'] - 1.5) < 0.01 and r['moved'] > 50, r)
    # 7. 접촉 피해
    r = pg.evaluate('''(() => { const R = singleRun; R.t = 0.01; for (let i = 0; i < 5; i++) update(1/60); R.plan = 0; R.timer = 1e9; bots = []; god = false; p.hp = p.max;
      const e = makeEnemy("melee", freeSpot(p.x + 20, p.y, 16), { noExp: true }); e.spawnT = 0; e.atkT = 99; e.spd = 1e-4;
      let hits = 0, last = p.hp; for (let i = 0; i < 120; i++) { e.atkT = 99; e.x = p.x + 22; e.y = p.y; update(1/60); if (p.hp < last) hits++; last = p.hp; }
      const out = { hits, dmg: Math.round(p.max - p.hp) };
      p.hp = p.max; p.weave = 1; let hw = 0; last = p.hp; p.contactT = 0; for (let i = 0; i < 30; i++) { e.atkT = 99; e.x = p.x + 22; e.y = p.y; p.weave = 1; update(1/60); if (p.hp < last) hw++; last = p.hp; }
      out.weaveHits = hw; god = true; return out; })()''')
    ok('7. 몸이 닿으면 피해, 2초 동안 0.8초 간격으로 2~3번만', 2 <= r['hits'] <= 3 and r['dmg'] > 0, r)
    ok('7. 위빙(무적 회피) 중엔 접촉 피해 없음', r['weaveHits'] == 0, r)
    # 무기 밸런스 (검 250·0.8초·2명 / 망치 700·2.0초·2명·160도 / 권총 450·1.2초·1명)
    r = pg.evaluate('''(() => { openLobby(); startEndless("suit"); document.body.classList.add("menuOpen"); god = true; const R = singleRun; R.t = 0.01; for (let i = 0; i < 5; i++) update(1/60); R.plan = 0; R.timer = 1e9;
      const out = {};
      for (const [w, name] of [[1, "검"], [2, "망치"], [3, "권총"]]) {
        bots = []; p.w = w; p.ammo = 3; p.cd = 0; p.comboStep = 0;
        const es = [[50, -8], [56, 8], [62, -16], [68, 16]].map(([dx, dy]) => { const e = makeEnemy("tank", { x: p.x + dx, y: p.y + dy }, { noExp: true }); e.x = p.x + dx; e.y = p.y + dy; e.spawnT = 0; e.hp = e.max = 1e5; return e; });
        attack(p, p.x + 100, p.y); for (let i = 0; i < 30; i++) { for (const e of es) { e.x = e.x; } update(1/60); }
        const hitN = es.filter((e) => e.hp < e.max).length, dmg = Math.round(Math.max(...es.map((e) => e.max - e.hp)));
        p.cd = 0; p.ammo = 3; attack(p, p.x + 100, p.y); const cd = +p.cd.toFixed(2);
        out[name] = { hitN, dmg, cd, def: weapons[w].slice(1) };
      }
      return out; })()''')
    print('weapons', r)
    ok('검: 250 피해·간격 0.8초·최대 2명', r['검']['hitN'] == 2 and r['검']['cd'] == 0.8 and r['검']['def'][0] == 250, r['검'])
    ok('망치: 700 피해·간격 2초·최대 2명·160도', r['망치']['hitN'] == 2 and r['망치']['cd'] == 2 and r['망치']['def'][0] == 700 and pg.evaluate('angles[2]') == 160, r['망치'])
    ok('권총: 450 피해·간격 1.2초·1명', r['권총']['hitN'] == 1 and r['권총']['cd'] == 1.2 and r['권총']['def'][0] == 450, r['권총'])
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
