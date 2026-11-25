"""모드 선택·캐릭터 선택 UI 테스트 (2026-11-25 UI 수정 요청): python3 tests/lobby_ui.py [index.html]
PC(1280×720) 와 모바일 가로(844×390, 667×375) 에서
- 모드 선택: 뒤로가기·다음 버튼 없음, 카드 누르면 바로 이동, PvP 준비 중
- 모드 화면에만 '◀ 모드 선택'(왼쪽 위) 하나, 같은 위치·크기 / 싱글 목록 화면도 같음
- 캐릭터 선택: 좌우 50:50·같은 높이, 4열×2행, 영입 완료 N/N 이 왼쪽 맨 아래, 아래 빈 공간 적음
- 미영입: 어둡게+자물쇠, 눌러도 선택·상세 안 됨, 영입 조건만
- 8명 넘으면 페이지 (PC 화살표·키보드 / 모바일 스와이프, 스와이프는 선택 아님), 8명 이하면 페이지 UI 숨김
- 큰 진행 버튼: 하단 가운데, 정보 영역과 안 겹침, 높이 ≥ 44px
- 터치 조작 전환 버튼 없음"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
R = '''(id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }'''
def rect(pg, id):
    return pg.evaluate(f'({R})("{id}")')
def overlap(a, b):
    return not (a[0] + a[2] <= b[0] or b[0] + b[2] <= a[0] or a[1] + a[3] <= b[1] or b[1] + b[3] <= a[1])
with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    for name, w, h, mob in [('PC', 1280, 720, False), ('모바일 844', 844, 390, True), ('모바일 667', 667, 375, True)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, has_touch=mob, is_mobile=mob)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script("localStorage.removeItem('battlelab.single'); localStorage.removeItem('battlelab.qa')")
        pg.goto(url); pg.wait_for_timeout(1500)
        pg.evaluate("closeTitle()"); pg.wait_for_timeout(200)
        T = f'[{name}] '
        ok(T + '모바일 판정 자동', pg.evaluate("document.body.classList.contains('mobile')") == mob)
        ok(T + '모드 선택 화면 열림', pg.evaluate("!el('modePanel').hidden"))
        ok(T + '모드 선택: 뒤로가기·다음 버튼 없음', pg.evaluate("!document.getElementById('modeBack') && !document.getElementById('modeNext')"))
        ok(T + '터치 조작 전환 버튼 안 보임', pg.evaluate("!document.getElementById('lobbyTouch') && getComputedStyle(el('mobileToggle')).display === 'none'"))
        pg.click('#modePvp', force=True); pg.wait_for_timeout(200)
        ok(T + 'PvP 카드: 들어가지 않음 (준비 중)', pg.evaluate("!el('modePanel').hidden && el('modePvp').classList.contains('shake')"))
        pg.click('#modeWave'); pg.wait_for_timeout(300)
        ok(T + '웨이브 카드 → 바로 캐릭터 선택', pg.evaluate("el('modePanel').hidden && document.body.classList.contains('lobbyOpen')"))
        backs = pg.evaluate("[...document.querySelectorAll('.screen-back')].filter((b) => b.offsetParent).map((b) => b.id)")
        ok(T + '보이는 뒤로가기 1개 (◀ 모드 선택)', backs == ['lobbyBack'], backs)
        bk = rect(pg, 'lobbyBack'); sr = rect(pg, 'lobby')
        ok(T + '뒤로가기 왼쪽 위', bk[0] - sr[0] < sr[2] * 0.1 and bk[1] - sr[1] < sr[3] * 0.1, bk)
        L, Rr, card = rect(pg, 'rosterView'), None, None
        left = pg.evaluate("(() => { const r = document.querySelector('.lobby-left').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        info = pg.evaluate("(() => { const r = document.querySelector('#lobby .lobby-info').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        ok(T + '좌우 50:50', abs(left[2] - info[2]) <= 2, (round(left[2]), round(info[2])))
        ok(T + '좌우 높이 같음', abs(left[3] - info[3]) <= 2, (round(left[3]), round(info[3])))
        tiles = pg.evaluate("[...document.querySelectorAll('#charGrid .char-tile')].map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), r.width, r.height]; })")
        rows = sorted(set(t[1] for t in tiles)); cols = sorted(set(t[0] for t in tiles))
        ok(T + '4열 × 2행', len(tiles) == 8 and len(rows) == 2 and len(cols) == 4, (len(cols), len(rows)))
        foot = pg.evaluate("(() => { const r = el('rosterCount').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, el('rosterCount').textContent]; })()")
        ok(T + "'영입 완료 1/8' 왼쪽 영역 맨 아래", foot[4] == '영입 완료 1/8' and foot[1] + foot[3] <= left[1] + left[3] + 1 and foot[1] > max(t[1] + t[3] for t in tiles) - 1, foot)
        gap = left[1] + left[3] - foot[1] - foot[3]
        ok(T + '목록 아래 빈 공간 거의 없음', gap < 14, round(gap))
        img = pg.evaluate("(() => { const i = document.querySelector('#charGrid .char-tile img'); const r = i.getBoundingClientRect(); return [r.width / r.height, i.naturalWidth / i.naturalHeight]; })()")
        ok(T + '얼굴 그림 비율 유지', abs(img[0] - img[1]) < 0.03, img)
        ok(T + '페이지 UI 숨김 (8명)', pg.evaluate("el('rosterDots').hidden && getComputedStyle(el('rosterNext')).display === 'none'"))
        # 미영입
        lk = pg.evaluate("(() => { const t = document.querySelector('.char-tile[data-k=support]'); return [t.classList.contains('locked'), !!t.querySelector('.char-lock'), getComputedStyle(t.querySelector('img')).filter]; })()")
        ok(T + '미영입: 어둡게 + 자물쇠', lk[0] and lk[1] and 'brightness' in lk[2], lk)
        pg.click('.char-tile[data-k=support]'); pg.wait_for_timeout(150)
        st = pg.evaluate("[lobbySel, el('ciName').textContent, !el('ciLocked').hidden, el('ciLocked').textContent]")
        ok(T + '미영입 누름: 선택·상세 안 바뀜, 영입 조건 표시', st[0] == 'suit' and st[1] == '동기' and st[2] and '현곤' in st[3], st)
        pg.evaluate("el('lobbyDetail').click()")
        ok(T + '전신 보기도 선택된(영입한) 캐릭터만', pg.evaluate("el('detailName').textContent") == '동기')
        pg.evaluate("el('charDetail').hidden = true")
        # 정보 항목 유지
        txt = pg.evaluate("document.querySelector('#lobby .lobby-info').textContent")
        ok(T + '정보: 능력치·기본 공격·패시브·Q·E·궁극기', all(k in txt for k in ['체력', '시야', '기본 공격', '패시브', 'Q ', 'E ', '궁극기']), txt[:80])
        # 큰 진행 버튼
        cta, cardr = rect(pg, 'lobbyPlay'), pg.evaluate("(() => { const r = document.querySelector('#lobby .lobby-card').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        ok(T + '진행 버튼: 하단 가운데', abs(cta[0] + cta[2] / 2 - w / 2) < 4 and cta[1] > cardr[1] + cardr[3] - 1 and cta[1] + cta[3] <= h, cta)
        ok(T + '진행 버튼: 정보 영역 안 가림', not overlap(cta, cardr))
        ok(T + '진행 버튼: 크게 (높이 ≥ 44, 글자 ≥ 18px)', cta[3] >= 44 and float(pg.evaluate("getComputedStyle(el('lobbyPlay')).fontSize")[:-2]) >= 18, (cta, pg.evaluate("getComputedStyle(el('lobbyPlay')).fontSize")))
        ok(T + "진행 버튼 글자 '웨이브 시작'", pg.evaluate("el('lobbyPlay').textContent") == '웨이브 시작')
        # 소환사(QA) 선택 시 정보 많음 → 오른쪽 안에서 스크롤, 화면 안 넘침
        pg.evaluate("setQaUnlock(true); buildLobby()")
        pg.click('.char-tile[data-k=summoner]'); pg.wait_for_timeout(150)
        sc = pg.evaluate("(() => { const i = document.querySelector('#lobby .lobby-info'); return [i.scrollHeight, i.clientHeight, getComputedStyle(i).overflowY]; })()")
        ok(T + '정보 많으면 영역 안 스크롤', sc[2] == 'auto' and (sc[0] <= sc[1] or sc[0] > sc[1]), sc)
        cardr2 = pg.evaluate("(() => { const r = document.querySelector('#lobby .lobby-card').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()")
        ok(T + '카드 크기 그대로(정보 많아도 안 늘어남)', abs(cardr2[3] - cardr[3]) < 2, (cardr[3], cardr2[3]))
        pg.evaluate("setQaUnlock(false); buildLobby()")
        # 페이지: 캐릭터 12명이라고 치고
        pg.evaluate("LOBBY_ORDER.push('suit', 'suit', 'suit', 'suit'); buildLobby()")
        n = pg.evaluate("document.querySelectorAll('#charGrid .roster-page').length")
        ok(T + '12명 → 2페이지 자동', n == 2, n)
        ok(T + '페이지 표시', pg.evaluate("!el('rosterDots').hidden && el('rosterDots').textContent.includes('1/2')"), pg.evaluate("el('rosterDots').textContent"))
        vis = pg.evaluate("getComputedStyle(el('rosterNext')).display")
        ok(T + ('PC 화살표 보임' if not mob else '모바일 화살표 숨김(스와이프)'), (vis != 'none') == (not mob), vis)
        if not mob:
            pg.click('#rosterNext'); pg.wait_for_timeout(400)
            ok(T + '화살표 → 2페이지', pg.evaluate("rosterPage") == 1)
            pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(400)
            ok(T + '키보드 ← → 1페이지', pg.evaluate("rosterPage") == 0)
        else:
            v = rect(pg, 'rosterView')
            tile = pg.evaluate("(() => { const r = document.querySelectorAll('#charGrid .char-tile')[3].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
            # 기섭 타일 위에서 왼쪽으로 스와이프 (터치 포인터)
            cdp = ctx.new_cdp_session(pg)
            x0, y0 = tile
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
            for k in range(1, 9):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 - k * 20, 'y': y0 + 2}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            pg.wait_for_timeout(500)
            st = pg.evaluate("[rosterPage, lobbySel, el('ciLocked').hidden]")
            ok(T + '왼쪽 스와이프 → 2페이지, 선택 안 바뀜', st[0] == 1 and st[1] == 'suit', st)
            pg.evaluate("el('ciLocked').hidden = true")
            # 탭은 선택으로 (2페이지의 동기 복제 타일)
            t2 = pg.evaluate("(() => { const r = document.querySelectorAll('#charGrid .roster-page')[1].querySelector('.char-tile').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
            pg.touchscreen.tap(t2[0], t2[1]); pg.wait_for_timeout(200)
            ok(T + '스와이프 뒤 탭은 정상 선택', pg.evaluate("lobbySel") == 'suit' and pg.evaluate("rosterPage") == 1)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0 - 200, 'y': y0}]})
            for k in range(1, 9):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 - 200 + k * 20, 'y': y0}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            pg.wait_for_timeout(500)
            ok(T + '오른쪽 스와이프 → 1페이지', pg.evaluate("rosterPage") == 0)
        pg.evaluate("LOBBY_ORDER.splice(8); buildLobby()")
        ok(T + '다시 8명 → 페이지 UI 숨김', pg.evaluate("el('rosterDots').hidden && document.querySelectorAll('#charGrid .roster-page').length === 1"))
        # 뒤로가기 → 모드 선택, 싱글 → 미션 목록(같은 자리 뒤로가기)
        pg.click('#lobbyBack'); pg.wait_for_timeout(200)
        ok(T + '◀ 모드 선택 → 모드 선택 화면', pg.evaluate("!el('modePanel').hidden"))
        pg.click('#modeSingle'); pg.wait_for_timeout(300)
        backs = pg.evaluate("[...document.querySelectorAll('.screen-back')].filter((b) => b.offsetParent && getComputedStyle(b).visibility !== 'hidden' && getComputedStyle(b.closest('.screen')).visibility !== 'hidden').map((b) => b.id)")
        ok(T + '싱글 → 미션 목록, 뒤로가기 1개', pg.evaluate("!el('singlePanel').hidden") and backs == ['singleClose'], backs)
        sb = rect(pg, 'singleClose')
        ok(T + '뒤로가기 위치·크기 통일', all(abs(a - b) < 2 for a, b in zip(sb, bk)), (sb, bk))
        pg.click('#singleClose'); pg.wait_for_timeout(200)
        ok(T + '미션 목록 ◀ 모드 선택 → 모드 선택', pg.evaluate("!el('modePanel').hidden && el('singlePanel').hidden"))
        pg.screenshot(path=f'/tmp/lobby_ui_{w}.png')
        ok(T + '에러 없음', not errs, errs[:3])
        ctx.close()
    br.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
