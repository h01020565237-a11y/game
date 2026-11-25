"""조이스틱 고착 테스트 (2026-11-25 버그: 혼자 고정되고 다시 눌러도 조작 불가): python3 tests/joystick.py
- 손 뗌 이벤트가 사라져도: 새로 누르면 새 손가락으로 넘어감 / 모든 손가락이 떨어지면(touchend) 놓임
- 화면 숨김·카드 화면 열림·메뉴에서 놓임
- 안전장치: 벽 안·맵 밖에 놓인 플레이어는 빈자리로"""
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
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen'); startEndless('suit')")
    pg.wait_for_timeout(300)
    r = pg.evaluate("(() => { const r = el('mv').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; })()")
    cx, cy, w = r
    cdp = ctx.new_cdp_session(pg)
    T = lambda typ, pts: cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': pts})
    T('touchStart', [{'x': cx, 'y': cy, 'id': 1}]); T('touchMove', [{'x': cx + w * 0.45, 'y': cy, 'id': 1}])
    ok('조이스틱 누르면 이동 입력', pg.evaluate('mvX') > 0.5, pg.evaluate('[mvX, mvY]'))
    # 손 뗌 이벤트 없이 상태만 남은 경우 흉내: 다른 손가락으로 새로 누름
    T('touchStart', [{'x': cx + w * 0.45, 'y': cy, 'id': 1}, {'x': cx, 'y': cy - w * 0.4, 'id': 2}])
    ok('새로 누르면 새 손가락으로 넘어감 (예전: 무시돼서 조작 불가)', pg.evaluate('mvY') < -0.5, pg.evaluate('[mvX, mvY]'))
    T('touchEnd', [])
    pg.wait_for_timeout(50)
    ok('손가락 모두 떼면 놓임', pg.evaluate('mvX === 0 && mvY === 0'), pg.evaluate('[mvX, mvY]'))
    # pointerup 이 조이스틱 밖에서 끝나도 (캡처 잃음)
    T('touchStart', [{'x': cx, 'y': cy, 'id': 3}]); T('touchMove', [{'x': cx + w * 3, 'y': cy - w, 'id': 3}]); T('touchEnd', [])
    pg.wait_for_timeout(50)
    ok('조이스틱 밖으로 끌고 가서 떼도 놓임', pg.evaluate('mvX === 0 && mvY === 0'))
    # 카드 화면 열릴 때
    T('touchStart', [{'x': cx, 'y': cy, 'id': 4}]); T('touchMove', [{'x': cx + w * 0.45, 'y': cy, 'id': 4}])
    pg.evaluate("singleRun.cardQueue.push('normal'); singleRun.phase = 'fight'; openEndlessCards()")
    ok('카드 화면 열리면 놓임', pg.evaluate('mvX === 0 && mvY === 0'))
    T('touchEnd', [])
    pg.evaluate("if (singleRun.phase === 'cards') pickEndlessCard(0)")
    # 안전장치
    r = pg.evaluate('''(() => { document.body.classList.add("menuOpen"); singleRun.cardQueue = []; singleRun.phase = "fight"; singleRun.timer = 999; const w0 = walls.find((q) => q[2] > 60 && q[3] > 60 && q[0] > 100); p.x = w0[0] + w0[2] / 2; p.y = w0[1] + w0[3] / 2; update(1 / 60); const a = !blocked(p.x, p.y, 10);
      p.x = -50; p.y = 300; update(1 / 60); const b2 = p.x > 0; return [a, b2, p.stuckFix, over, singleRun.phase, singleRun.cardQueue.length, !!singleRun.mapSwap]; })()''')
    ok('벽 안·맵 밖 플레이어 → 빈자리로', r[0] and r[1], r)
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
