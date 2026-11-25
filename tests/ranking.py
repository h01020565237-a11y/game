"""닉네임·웨이브 랭킹 테스트 (가짜 서버로 GAS 규격 흉내): python3 tests/ranking.py [index.html]
실제 Google Apps Script 서버는 이 환경에서 접속이 막혀 있어 확인 불가 → 브라우저에서 따로 확인 필요
- GAME START: 닉네임 없으면 팝업, 취소 → 타이틀, 등록 → 모드 선택, 재접속 시 바로 모드 선택
- 닉네임 2~12자, 글자 수 표시, 중복 거절, playerId(UUID)·token(UUID 2개) 저장, Enter 등록, 요청 중 중복 누름 방지
- 서버 연결 실패: 게임 진행 가능(오프라인 시작), 나중에 등록
- 설정에서 닉네임 변경 (기록 유지)
- 웨이브 판 종료 → 기록 자동 등록, 개인 최고 표시, 실패 시 재전송, QA·싱글 제외, 낮은 기록은 안 보냄
- 랭킹: 전체·캐릭터별, 정렬, 메달, 내 줄 강조·아래 고정, POST 는 text/plain"""
import json, pathlib, sys, uuid
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
SERVER = {'players': {}, 'records': {}, 'down': False, 'posts': []}
SERVER['players']['p-old'] = {'nickname': '기존유저', 'token': 't'}
for i, (nick, ch, w, k) in enumerate([('강자', 'suit', 18, 300), ('중수', 'runner', 12, 200), ('하수', 'suit', 5, 60), ('동점A', 'octo', 12, 250)]):
    SERVER['players'][f'p{i}'] = {'nickname': nick, 'token': 't'}
    SERVER['records'][(f'p{i}', ch)] = {'wave': w, 'time': w * 60, 'level': w, 'kills': k}
def handle(route):
    req = route.request
    if SERVER['down']:
        return route.abort()
    if req.method == 'GET':
        q = dict(x.split('=') for x in req.url.split('?', 1)[1].split('&'))
        if q.get('action') == 'health':
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True}))
        ch = q.get('character', 'all')
        best = {}
        for (pid, c), r in SERVER['records'].items():
            if ch != 'all' and c != ch: continue
            cur = best.get(pid)
            if not cur or (r['wave'], r['kills']) > (cur['wave'], cur['kills']):
                best[pid] = {**r, 'character': c}
        rows = [{'playerId': pid, 'nickname': SERVER['players'][pid]['nickname'], **r} for pid, r in best.items()]
        rows.sort(key=lambda r: (-r['wave'], -r['kills'], -r['time']))
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True, 'ranking': rows[:100]}, ensure_ascii=False))
    SERVER['posts'].append(req.headers.get('content-type'))
    b = json.loads(req.post_data)
    a = b['action']
    def err(m): return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': False, 'error': m}))
    if a in ('register', 'rename'):
        if any(v['nickname'] == b['nickname'] and pid != b['playerId'] for pid, v in SERVER['players'].items()): return err('duplicate nickname')
        if a == 'rename' and SERVER['players'].get(b['playerId'], {}).get('token') != b['token']: return err('unauthorized')
        SERVER['players'][b['playerId']] = {'nickname': b['nickname'], 'token': b['token']}
    elif a == 'submit':
        P = SERVER['players'].get(b['playerId'])
        if not P or P['token'] != b['token']: return err('unauthorized')
        key = (b['playerId'], b['character']); cur = SERVER['records'].get(key)
        rec = {k: b[k] for k in ('wave', 'time', 'level', 'kills')}
        if not cur or (rec['wave'], rec['kills']) > (cur['wave'], cur['kills']): SERVER['records'][key] = rec
    return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok': True}))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
    ctx.route('https://script.google.com/**', handle)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(2500)
    # GAME START → 팝업
    pg.click('#titleStart'); pg.wait_for_timeout(200)
    ok('닉네임 없으면 팝업 (타이틀 위)', pg.evaluate("!el('nickPopup').hidden && !el('title').hidden"))
    box = pg.evaluate("(() => { const r = el('nickInput').getBoundingClientRect(), b = el('nickOk').getBoundingClientRect(), c = el('nickPopup').querySelector('.nick-card').getBoundingClientRect(); return [r.width, b.width, getComputedStyle(el('nickInput')).textAlign, getComputedStyle(el('nickInput')).fontSize, Math.abs((c.left + c.width / 2) - innerWidth / 2)]; })()")
    ok('입력창 200~240px·가운데 정렬·16px(확대 방지)·버튼 같은 너비·팝업 가운데', 200 <= box[0] <= 240 and abs(box[0] - box[1]) < 1 and box[2] == 'center' and box[3] == '16px' and box[4] < 3, box)
    pg.click('#nickCancel'); pg.wait_for_timeout(100)
    ok('취소 → 타이틀', pg.evaluate("el('nickPopup').hidden && !el('title').hidden"))
    pg.click('#titleStart'); pg.wait_for_timeout(100)
    pg.fill('#nickInput', '가'); pg.click('#nickOk'); pg.wait_for_timeout(100)
    ok('1자 거절', '2~12' in pg.evaluate("el('nickErr').textContent"))
    pg.fill('#nickInput', '강자'); pg.wait_for_timeout(50)
    ok('글자 수 표시 2/12', pg.evaluate("el('nickCount').textContent") == '2/12')
    pg.click('#nickOk'); pg.wait_for_timeout(400)
    ok('중복 닉네임 거절', '이미 사용' in pg.evaluate("el('nickErr').textContent"), pg.evaluate("el('nickErr').textContent"))
    pg.fill('#nickInput', '테스터01'); pg.press('#nickInput', 'Enter'); pg.wait_for_timeout(500)
    prof = pg.evaluate("JSON.parse(localStorage.getItem('battlelab.profile'))")
    ok('Enter 로 등록 → 모드 선택', pg.evaluate("el('nickPopup').hidden && !el('modePanel').hidden"))
    ok('playerId UUID·token UUID 2개·닉네임 저장', len(prof['playerId']) == 36 and len(prof['token']) == 72 and prof['nickname'] == '테스터01' and prof['registered'], prof)
    ok('POST Content-Type text/plain;charset=UTF-8', all((c or '').lower().startswith('text/plain') for c in SERVER['posts']), SERVER['posts'][:2])
    pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#titleStart'); pg.wait_for_timeout(200)
    ok('재접속: 바로 모드 선택 (닉네임 유지)', pg.evaluate("el('nickPopup').hidden && !el('modePanel').hidden"))
    # 웨이브 판 → 기록 등록
    pg.click('#modeWave'); pg.wait_for_timeout(300)
    ok('웨이브 캐릭터 선택에 랭킹 버튼', pg.evaluate("!el('lobbyRank').hidden"))
    pg.click('#lobbyPlay'); pg.wait_for_timeout(500)
    pg.evaluate("document.body.classList.add('menuOpen'); singleRun.wave = 14; singleRun.kills = 280; singleRun.level = 9; p.hp = 0; over = '패배'; syncResults()")
    pg.wait_for_timeout(1200)
    st = pg.evaluate("[el('resOnlineText').textContent, el('resTitle').textContent, !el('resRankBtn').hidden]")
    ok('판 종료 → 기록 자동 등록·개인 최고 표시', '등록했어요' in st[0] and '최고' in st[1] and st[2], st)
    if __import__('os').environ.get('SHOT'): pg.screenshot(path='/tmp/res.png')
    rec = SERVER['records'].get((prof['playerId'], 'suit'))
    ok('서버에 기록 (W14·처치 280·Lv9)', rec and rec['wave'] == 14 and rec['kills'] == 280 and rec['level'] == 9, rec)
    pg.click('#resRankBtn'); pg.wait_for_timeout(1500)
    import os
    if os.environ.get('SHOT'): pg.screenshot(path='/tmp/rank.png')
    rows = pg.evaluate("[...el('rankList').children].map((r) => [r.className, r.textContent])")
    ok('랭킹 정렬 웨이브→처치 (강자 W18, 테스터 W14, 동점A W12·250 > 중수 W12·200)', [r[1] for r in rows][0].startswith('🥇강자') and '테스터01' in rows[1][1] and '동점A' in rows[2][1] and '중수' in rows[3][1], [r[1] for r in rows])
    ok('1~3위 메달·내 줄 강조', '🥈' in rows[1][1] and 'mine' in rows[1][0] and 'gold' in rows[1][0])
    # 캐릭터별
    pg.evaluate("[...el('rankTabs').children].find((b) => b.textContent === '동기').click()"); pg.wait_for_timeout(600)
    rows2 = pg.evaluate("[...el('rankList').children].map((r) => r.textContent)")
    ok('캐릭터별(동기): 동기 기록만', len(rows2) == 3 and all('동기' in r for r in rows2), rows2)
    pg.click('#rankClose')
    # 낮은 기록은 안 보냄 / 실패 시 재전송 / QA 제외
    pg.evaluate("openLobby(); lobbyMode = 'wave'"); pg.click('#lobbyPlay'); pg.wait_for_timeout(300)
    n0 = len(SERVER['posts'])
    pg.evaluate("document.body.classList.add('menuOpen'); singleRun.wave = 3; singleRun.kills = 10; p.hp = 0; over = '패배'; syncResults()"); pg.wait_for_timeout(800)
    ok('개인 최고보다 낮은 기록은 안 보냄', len(SERVER['posts']) == n0 and '최고 기록이 아니' in pg.evaluate("el('resOnlineText').textContent"))
    SERVER['down'] = True
    pg.evaluate("openLobby(); lobbyMode = 'wave'"); pg.click('#lobbyPlay'); pg.wait_for_timeout(300)
    pg.evaluate("document.body.classList.add('menuOpen'); singleRun.wave = 20; singleRun.kills = 400; p.hp = 0; over = '패배'; syncResults()"); pg.wait_for_timeout(1500)
    st = pg.evaluate("[el('resOnlineText').textContent, !el('resResend').hidden, JSON.parse(localStorage.getItem('battlelab.rankQueue') || '[]').length]")
    ok('서버 실패 → 기기에 보관·다시 보내기 버튼', '실패' in st[0] and st[1] and st[2] == 1, st)
    SERVER['down'] = False
    pg.click('#resResend'); pg.wait_for_timeout(1200)
    ok('다시 보내기 → 등록, 대기열 비움', SERVER['records'][(prof['playerId'], 'suit')]['wave'] == 20 and pg.evaluate("JSON.parse(localStorage.getItem('battlelab.rankQueue') || '[]').length") == 0)
    pg.evaluate("openLobby(); setQaUnlock(true); lobbyMode = 'wave'"); pg.click('#lobbyPlay'); pg.wait_for_timeout(300)
    n0 = len(SERVER['posts'])
    pg.evaluate("document.body.classList.add('menuOpen'); singleRun.wave = 30; p.hp = 0; over = '패배'; syncResults()"); pg.wait_for_timeout(800)
    ok('QA 판은 온라인 등록 제외', len(SERVER['posts']) == n0 and 'QA' in pg.evaluate("el('resOnlineText').textContent"))
    pg.evaluate("setQaUnlock(false)")
    # 닉네임 변경 (기록 유지)
    pg.evaluate("openLobby(); el('lobby').hidden = false; openModePanel(); el('modeSet').hidden = false")
    pg.click('#mNickEdit'); pg.wait_for_timeout(100)
    pg.fill('#nickInput', '새이름'); pg.click('#nickOk'); pg.wait_for_timeout(500)
    ok('설정에서 닉네임 변경, 기록 유지', SERVER['players'][prof['playerId']]['nickname'] == '새이름' and SERVER['records'][(prof['playerId'], 'suit')]['wave'] == 20 and pg.evaluate("el('mNick').textContent") == '새이름')
    # 서버 다운 상태 첫 접속: 오프라인 시작 → 나중에 등록
    pg.evaluate('localStorage.clear()'); SERVER['down'] = True; pg.reload(); pg.wait_for_timeout(2500)
    pg.click('#titleStart'); pg.fill('#nickInput', '오프유저'); pg.click('#nickOk'); pg.wait_for_timeout(1500)
    st = pg.evaluate("[el('nickErr').textContent, !el('nickOffline').hidden]")
    ok('서버 연결 실패: 안내 + 오프라인 시작 버튼', st[1] and ('연결' in st[0] or '늦어' in st[0]), st)
    pg.click('#nickOffline'); pg.wait_for_timeout(200)
    ok('오프라인으로 게임 진행 (모드 선택)', pg.evaluate("!el('modePanel').hidden && JSON.parse(localStorage.getItem('battlelab.profile')).registered === false"))
    SERVER['down'] = False
    pg.evaluate("flushRankQueue()"); pg.wait_for_timeout(800)
    pid = pg.evaluate("profile.playerId")
    ok('연결되면 나중에 등록', SERVER['players'].get(pid, {}).get('nickname') == '오프유저' and pg.evaluate("profile.registered"))
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
