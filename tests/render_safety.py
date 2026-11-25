"""그리기 안전장치: python3 tests/render_safety.py [index.html]
- 정용 최종 보스 충격파(폭발 효과 수명이 0.45초보다 김)에서 원 반지름이 음수가 돼 게임이 멈추던 버그 (캐릭터 없는 화면으로 정지)
- 그리기 중 에러가 나도 게임 루프는 계속 돌아야 함"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 844, 'height': 390})
    ctx.add_init_script("localStorage.setItem('battlelab.profile', JSON.stringify({playerId: '00000000-0000-4000-8000-000000000000', token: 'x', nickname: '테스트', registered: true}))")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(pathlib.Path(f).resolve().as_uri()); pg.wait_for_timeout(2500)
    pg.click('#titleStart'); pg.wait_for_timeout(300); pg.click('#modeWave'); pg.wait_for_timeout(300); pg.click('#lobbyPlay'); pg.wait_for_timeout(1500)
    r = pg.evaluate("""(() => { try { for (const t of [0.6, 0.5, 0.45, 0.2, 0, -0.1]) { fx.push({ x: p.x, y: p.y, t, explosion: true }); } draw(); return null; } catch (e) { return String(e); } })()""")
    ok('폭발 효과 수명이 0.45초보다 길어도 그리기 에러 없음', r is None, r)
    # 그리기에서 일부러 에러를 내도 루프가 계속 도는지
    pg.evaluate("window.__d = draw; window.draw = () => { window.__d(); throw new Error('test draw error'); }; window.__e = elapsed")
    pg.wait_for_timeout(800)
    moved = pg.evaluate("elapsed - window.__e")
    pg.evaluate("window.draw = window.__d")
    ok('그리기 에러가 나도 게임 진행 계속 (화면 멈춤 없음)', moved > 0.4, round(moved, 2))
    pg.wait_for_timeout(300)
    e1 = pg.evaluate('elapsed'); pg.wait_for_timeout(500)
    ok('에러 뒤 정상 그리기로 돌아옴', pg.evaluate('elapsed') - e1 > 0.3)
    ok('페이지 에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
