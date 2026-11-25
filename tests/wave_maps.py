"""무한 생존 맵 순환 테스트: python3 tests/wave_maps.py [index.html]
- 1~4 운동장 → 5 체육관(보스) → 10 옥상 → 15 번화가 → 20 신전 → 25 운동장
- 현곤 보스 웨이브만 경기장, 다음 일반 웨이브는 순환 맵 복귀
- 교체 시 런 진행(레벨·체력 비율·카드·궁극기) 유지, 이전 적·투사체 제거, 암전 중 카운트다운 정지, 보상 1회
- 플레이어·보스가 벽 밖·안전 위치, 적 스폰이 플레이어와 240 이상
- 스토리 미션·배틀로얄은 정글 맵 그대로"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
JS = r'''
window.T = {};
T.inside = (a) => blocked(a.x, a.y, (a.r || 16) - 2) || a.x < 0 || a.y < 0 || a.x > W || a.y > H;
T.step = (n) => { for (let i = 0; i < n; i++) update(1 / 60); };
T.cards = () => { let g = 0; while ((singleRun.phase === "cards" || singleRun.cardQueue.length) && g++ < 40) { if (singleRun.phase !== "cards") T.step(1); if (singleRun.phase === "cards") pickEndlessCard(0); } };
// 다음 웨이브까지: 지금 웨이브를 바로 끝내고 카드 고르고 암전·카운트다운 끝까지
T.next = () => {
  const R = singleRun, boss = !!R.spec?.boss;
  endEndlessWave(boss); T.cards();
  const info = { wave: R.wave, swap: !!R.mapSwap, countBefore: R.t };
  let g = 0, sawFade = false, countWhileFade = true;
  while (R.mapSwap && g++ < 300) { const t0 = R.t; T.step(1); sawFade ||= R.fadeA > 0; if (R.mapSwap && R.t !== t0) countWhileFade = false; }
  info.sawFade = sawFade; info.countFrozen = countWhileFade;
  info.map = activeMap.id; info.player = { x: Math.round(p.x), y: Math.round(p.y), inside: T.inside(p) };
  info.leftovers = bots.filter((b) => b.mob).length + mobShots.length + shots.length + hazards.length;
  info.banner = R.mapName + ' ' + (R.mapNameT > 0);
  g = 0; while (R.phase === "count" && g++ < 600) T.step(1);
  info.phase = R.phase;
  if (R.boss) info.boss = { id: R.boss.bossId, inside: T.inside(R.boss), d: Math.round(dist(R.boss, p)) };
  T.step(30);
  info.mobs = bots.filter((b) => b.mob && b !== R.boss).map((b) => Math.round(Math.hypot(b.x - p.x, b.y - p.y)));
  info.mobsInside = bots.filter((b) => b.mob && T.inside(b)).length;
  return info;
};
0;
'''
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: 'BADSPEC' in m.text and print(m.text))
    pg.goto(url); pg.wait_for_timeout(2000)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    pg.evaluate(JS)
    pg.evaluate('startEndless("suit"); god = true; T.step(2)')
    ok('1웨이브 운동장', pg.evaluate('activeMap.id') == 'schoolyard', pg.evaluate('activeMap.id'))
    ok('웨이브 맵은 상자 없음', pg.evaluate('boxes.length') == 0)
    # 첫 순환은 현곤 아닌 보스로 고정해서 순서 확인, 그다음 현곤 강제
    pg.evaluate('singleRun.bossCycle = ["octo", "stripe", "runner", "soccer", "bear", "suit", "support"]')
    expect = {2: 'schoolyard', 3: 'schoolyard', 4: 'schoolyard', 5: 'gym', 6: 'gym', 9: 'gym', 10: 'rooftop', 15: 'nightstreet', 20: 'temple', 25: 'schoolyard'}
    ult_before = None
    for w in range(2, 26):
        if w == 5:
            pg.evaluate('p.ult = 0.7; singleRun.level = 4; singleRun.kills = 33; T.lvl = singleRun.level')
        info = pg.evaluate('T.next()')
        if w in expect:
            ok(f'W{w} 맵 {expect[w]}', info['map'] == expect[w], info['map'])
        if w % 5 == 0:
            ok(f'W{w} 맵 교체 암전 있음', info['swap'] and info['sawFade'], info)
            ok(f'W{w} 암전 중 카운트다운 정지', info['countFrozen'])
            ok(f'W{w} 이전 적·투사체 없음', info['leftovers'] == 0, info['leftovers'])
            ok(f'W{w} 플레이어 안전 위치', not info['player']['inside'], info['player'])
            ok(f'W{w} 보스 등장·벽 밖', info.get('boss') and not info['boss']['inside'] and info['boss']['d'] > 200, info.get('boss'))
        if w == 5:
            r = pg.evaluate('({ ult: p.ult, lvl: singleRun.level, kills: singleRun.kills })')
            ok('W5 교체 후 궁극기·레벨·처치 수 유지', r['ult'] >= 0.7 and r['lvl'] >= 4 and r['kills'] >= 33, r)
        if w in (2, 6):
            ok(f'W{w} 맵 바뀌지 않음(암전 없음)', not info['swap'])
        if info['mobs']:
            ok(f'W{w} 적 스폰 플레이어와 거리 ≥ 200', min(info['mobs']) >= 200, min(info['mobs']))
        ok(f'W{w} 적 벽 안 0', info['mobsInside'] == 0, info['mobsInside'])
    # 현곤 보스 → 경기장, 다음 웨이브 복귀
    pg.evaluate('singleRun.bossCycle = ["summoner"]')
    for w in range(26, 31):
        info = pg.evaluate('T.next()')
    ok('W30 현곤 보스 → 현곤 경기장', info['map'] == 'hyeongon_stadium' and info.get('boss', {}).get('id') == 'summoner', (info['map'], info.get('boss')))
    ok('경기장 맵 이름 표시', '경기장' in info['banner'], info['banner'])
    info = pg.evaluate('T.next()')
    ok('W31 순환 맵(체육관, 30~34 구간)으로 복귀', info['map'] == 'gym', info['map'])
    # 보상 1회: 보스 처치 카드 1장만
    q = pg.evaluate('(() => { for (let i = 32; i < 35; i++) T.next(); const R = singleRun; endEndlessWave(true); return R.cardQueue.filter((c) => c === "legend").length; })()')
    ok('보스 처치 전설 카드 1회', q == 1, q)
    # 스토리·배틀로얄은 정글
    m = pg.evaluate('(() => { singleRun = null; reset(); return activeMap.id; })()')
    ok('배틀로얄 reset → 정글', m == 'jungle', m)
    m = pg.evaluate('(() => { beginStory("eunsuk", "summoner"); reset(); return [activeMap.id, W, walls.length === MAP_JUNGLE.walls.length]; })()')
    ok('스토리 미션 → 정글', m[0] == 'jungle' and m[2], m)
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
