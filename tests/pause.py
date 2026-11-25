"""일시정지 메뉴 테스트 (2026-11-25 최우선 버그: 메뉴 버튼이 안 눌림): python3 tests/pause.py [index.html]
PC(마우스 클릭·Esc) / 모바일(터치) × 웨이브 / 싱글 미션
- 메뉴 버튼이 실제로 맨 위에 있어 눌림 (다른 요소가 가리지 않음)
- 누르면 일시정지: 적·플레이어·웨이브 타이머·스킬 쿨타임·투사체 전부 멈춤
- 계속하기 → 정확히 재개 (멈춘 시간이 한꺼번에 흐르지 않음)
- 옵션: 사운드 조절 저장 / 나가기: 타이틀로, 입력·판 정리
- 메뉴에 랭킹 버튼 없음"""
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
    for name, mob in (('PC', False), ('모바일', True)):
        ctx = b.new_context(viewport={'width': 844, 'height': 390} if mob else {'width': 1280, 'height': 720}, has_touch=mob, is_mobile=mob)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script("localStorage.clear()")
        pg.goto(url); pg.wait_for_timeout(2500)
        pg.click('#titleStart'); pg.wait_for_timeout(400)
        for mode in ('wave', 'single'):
            T = f'[{name}·{mode}] '
            if mode == 'wave':
                pg.click('#modeWave'); pg.wait_for_timeout(300); pg.click('#lobbyPlay')
            else:
                pg.click('#modeSingle'); pg.wait_for_timeout(300); pg.click('#missionList .mission:not(.locked) .btn')
            pg.wait_for_timeout(4500)  # 카운트다운 지나 전투
            top = pg.evaluate("(() => { const m = el('menuBtn'), r = m.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return [r.width > 0, t === m || m.contains(t), t && (t.id || t.className)]; })()")
            ok(T + '메뉴 버튼 보이고 가장 위 (가리는 요소 없음)', top[0] and top[1], top)
            before = pg.evaluate("({ t: singleRun ? (singleRun.timer ?? singleRun.t) : 0, el: elapsed, bots: bots.filter(b => b.hp > 0).map(b => [b.x, b.y]).slice(0, 5), px: p.x })")
            (pg.tap if mob else pg.click)('#menuBtn')
            pg.wait_for_timeout(150)
            st = pg.evaluate("[document.body.classList.contains('paused'), !el('pauseMenu').hidden, [...el('pauseMenu').querySelectorAll('button')].map(b => b.textContent.trim())]")
            ok(T + '누르면 일시정지 메뉴', st[0] and st[1], st)
            ok(T + '메뉴 구성: 계속하기·옵션·나가기 (랭킹 없음)', any('계속' in x for x in st[2]) and any('옵션' in x for x in st[2]) and any('나가기' in x for x in st[2]) and not any('랭킹' in x for x in st[2]), st[2])
            s1 = pg.evaluate("({ el: elapsed, bots: bots.filter(b => b.hp > 0).map(b => [b.x, b.y]).slice(0, 5), px: p.x, t: singleRun ? (singleRun.timer ?? singleRun.t) : 0, cd: JSON.stringify(p.skcd || {}) })")
            # 이동 키·조이스틱을 눌러 봐도
            if not mob:
                pg.keyboard.down('KeyD'); pg.wait_for_timeout(700); pg.keyboard.up('KeyD')
            else:
                pg.wait_for_timeout(700)
            s2 = pg.evaluate("({ el: elapsed, bots: bots.filter(b => b.hp > 0).map(b => [b.x, b.y]).slice(0, 5), px: p.x, t: singleRun ? (singleRun.timer ?? singleRun.t) : 0, cd: JSON.stringify(p.skcd || {}) })")
            ok(T + '일시정지 중 시간·적·플레이어·타이머·쿨타임 전부 정지', s1 == s2, (s1, s2) if s1 != s2 else '')
            # 옵션
            pg.click('#pauseOptBtn'); pg.wait_for_timeout(100)
            pg.evaluate("el('pVolSfx').value = 40; el('pVolSfx').dispatchEvent(new Event('input'))")
            ok(T + '옵션: 효과음 조절 저장', abs(pg.evaluate('audio.settings.sfx') - 0.4) < 1e-6 and '"sfx":0.4' in (pg.evaluate("localStorage.getItem('battlelab.audio')") or ''))
            # 계속하기
            pg.click('#pauseResume'); pg.wait_for_timeout(50)
            e0 = pg.evaluate('elapsed'); pg.wait_for_timeout(500); e1 = pg.evaluate('elapsed')
            ok(T + '계속하기 → 재개 (멈춘 시간 한꺼번에 안 흐름)', not pg.evaluate("document.body.classList.contains('paused')") and 0.3 < e1 - e0 < 0.8 and e0 - s2['el'] < 0.3, (round(e0 - s2['el'], 3), round(e1 - e0, 3)))
            # Esc (PC)
            if not mob:
                pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
                ok(T + 'Esc → 일시정지', pg.evaluate("document.body.classList.contains('paused')"))
                pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
                ok(T + 'Esc 다시 → 계속', not pg.evaluate("document.body.classList.contains('paused')"))
            # 나가기
            (pg.tap if mob else pg.click)('#menuBtn'); pg.wait_for_timeout(100)
            pg.click('#pauseExit'); pg.wait_for_timeout(400)
            st = pg.evaluate("[!el('title').hidden, !singleRun, mvX, mvY, aiming, document.body.classList.contains('paused'), Object.values(keys).some(Boolean), getComputedStyle(el('menuBtn')).display]")
            ok(T + '나가기 → 타이틀, 판·입력 정리, 메뉴 버튼 숨김', st[0] and st[1] and st[2] == 0 and st[3] == 0 and not st[4] and not st[5] and not st[6] and st[7] == 'none', st)
            pg.click('#titleStart'); pg.wait_for_timeout(400)
        ok(f'[{name}] 에러 없음', not errs, errs[:3])
        ctx.close()
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
