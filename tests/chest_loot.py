"""보물상자 파괴·재생성 + 떨어진 아이템 수명 테스트"""
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
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2000)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen'); document.querySelector('#lobbyStart').click()")
    pg.wait_for_timeout(300)
    r = pg.evaluate('''(() => { document.body.classList.add("menuOpen"); god = true; freeze = true; bots.forEach(b => { b.x = 50; b.y = 50; });
      const n0 = boxes.length, bx = boxes[0], X = bx.x, Y = bx.y; p.x = X - 70; p.y = Y; loot = [];
      for (let i = 0; i < 30 && bx.hp > 0; i++) hit(p, bx, 200);
      const o = { gone: !boxes.includes(bx), n: boxes.length, n0, nearBox: nearBox(X, Y, 30), targetable: targets(p).includes(bx), drops: loot.length, life: loot[0] && loot[0].life, resp: boxRespawns.length };
      for (let i = 0; i < 5 && bx.hp <= 0; i++) hit(p, bx, 200); // 부서진 뒤 또 맞아도 드롭·재생성 중복 없음
      o.drops2 = loot.length; o.resp2 = boxRespawns.length;
      const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) update(1 / 60); };
      p.x = 200; p.y = 200;
      step(7.5); o.loot7 = loot.length; o.blinkWindow = loot[0] && loot[0].life < CHEST_RULES.blink;
      step(3); o.loot10 = loot.length;
      step(8); o.box19 = boxes.some(b => b.x === X && b.y === Y);
      p.x = X; p.y = Y + 10; step(2); o.box21occupied = boxes.some(b => b.x === X && b.y === Y);
      p.x = 200; p.y = 200; step(0.2); o.box21 = boxes.filter(b => b.x === X && b.y === Y).length; o.resp3 = boxRespawns.length;
      return o; })()''')
    print(r)
    ok('파괴 즉시 사라짐·충돌·공격 대상 제외', r['gone'] and not r['nearBox'] and not r['targetable'], r)
    ok('아이템 1번 드롭, 수명 10초', r['drops'] == 1 and abs(r['life'] - 10) < 0.01)
    ok('부서진 뒤 추가 타격: 드롭·재생성 중복 없음', r['drops2'] == 1 and r['resp2'] == 1)
    ok('7.5초: 아직 있음 + 마지막 3초 깜빡임 구간', r['loot7'] == 1 and r['blinkWindow'])
    ok('10초 지나면 아이템 사라짐', r['loot10'] == 0)
    ok('19초엔 아직, 20초 지나도 캐릭터가 서 있으면 대기', not r['box19'] and not r['box21occupied'])
    ok('비켜나면 같은 자리에 1개만 다시 생김', r['box21'] == 1 and r['resp3'] == 0)
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
