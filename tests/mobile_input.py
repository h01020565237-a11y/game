"""모바일 조작 영역 브라우저 기본 동작 차단 테스트 (Chromium 모바일 에뮬레이션)
길게 누르기(1.5초) 연속 공격 중: 텍스트 선택 없음, contextmenu/selectstart/dragstart 막힘, 확대 없음, 조작 정상"""
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
    for name, vp in [('가로', (844, 390)), ('세로회전', (390, 844))]:
        pg = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, has_touch=True, is_mobile=True, device_scale_factor=2).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(1500); pg.evaluate('closeTitle(); setQaUnlock(true); el("modePanel").hidden = true; document.body.classList.remove("modeOpen")')
        pg.evaluate('openLobby(); lobbySel="suit"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(300)
        pg.evaluate('god=true; window.__ev={}; for (const ev of ["contextmenu","selectstart","dragstart","dblclick"]) document.addEventListener(ev, (e)=>{ __ev[ev]=e.defaultPrevented; }, {capture:false});')
        cdp = pg.context.new_cdp_session(pg)
        def touch(t, pts): cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': pts})
        c = pg.evaluate('(()=>{let r=document.querySelector("#atk").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()')
        mv = pg.evaluate('(()=>{let r=document.querySelector("#mv").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()')
        # 1) 공격 버튼 1.5초 누르기 + 동시에 이동 (멀티터치)
        touch('touchStart', [{'x': c[0], 'y': c[1], 'id': 1}])
        touch('touchStart', [{'x': c[0], 'y': c[1], 'id': 1}, {'x': mv[0], 'y': mv[1], 'id': 2}])
        touch('touchMove', [{'x': c[0], 'y': c[1], 'id': 1}, {'x': mv[0] + 30, 'y': mv[1], 'id': 2}])
        x0 = pg.evaluate('[p.x,p.y]'); pg.wait_for_timeout(1500)
        st = pg.evaluate('[aiming, window.getSelection().toString(), visualViewport.scale, [p.x,p.y]]')
        # 길게 누를 때 브라우저가 보내는 contextmenu 를 직접 쏴서 막히는지
        cm = pg.evaluate('(()=>{const e=new MouseEvent("contextmenu",{bubbles:true,cancelable:true}); document.querySelector("#atk").dispatchEvent(e); return e.defaultPrevented})()')
        ss = pg.evaluate('(()=>{const e=new Event("selectstart",{bubbles:true,cancelable:true}); document.querySelector("#atk").dispatchEvent(e); return e.defaultPrevented})()')
        dg = pg.evaluate('(()=>{const e=new Event("dragstart",{bubbles:true,cancelable:true}); (document.querySelector("#touch img")||document.querySelector("#atk")).dispatchEvent(e); return e.defaultPrevented})()')
        db = pg.evaluate('(()=>{const e=new MouseEvent("dblclick",{bubbles:true,cancelable:true}); document.querySelector("#atk").dispatchEvent(e); return e.defaultPrevented})()')
        ts = pg.evaluate('(()=>{const t=new Touch({identifier:9,target:document.querySelector("#atk"),clientX:1,clientY:1}); const e=new TouchEvent("touchstart",{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}); document.querySelector("#atk").dispatchEvent(e); return e.defaultPrevented})()')
        touch('touchEnd', [])
        css = pg.evaluate('(()=>{const s=getComputedStyle(document.querySelector("#atk")); return [s.userSelect||s.webkitUserSelect, s.webkitTouchCallout, s.touchAction]})()')
        ok(f'[{name}] 공격 길게 누르기: 연속 공격 유지 + 이동 동시 (멀티터치)', st[0] and st[3] != x0, st)
        ok(f'[{name}] 텍스트 선택 없음 / 화면 확대 없음', st[1] == '' and st[2] == 1, st)
        ok(f'[{name}] 길게 누르기 메뉴·선택 시작·이미지 끌기·두 번 탭 확대 막힘', cm and ss and dg and db, (cm, ss, dg, db))
        ok(f'[{name}] 조작 버튼 touchstart 기본 동작 막힘 (iOS 콜아웃·돋보기)', ts)
        ok(f'[{name}] CSS: user-select none, touch-callout none, touch-action none', css[0] == 'none' and css[2] == 'none', css)
        # 2) 드래그 조준은 그대로
        touch('touchStart', [{'x': c[0], 'y': c[1], 'id': 1}]); touch('touchMove', [{'x': c[0] - 50, 'y': c[1], 'id': 1}]); pg.wait_for_timeout(80)
        aim = pg.evaluate('!!manualAim && !manualAim.cancel'); touch('touchEnd', []); pg.wait_for_timeout(50)
        ok(f'[{name}] 끌어서 직접 조준 정상', aim)
        # 3) 패널 스크롤은 막지 않음 (싱글 미션 목록)
        pg.evaluate('openLobby(); openSinglePanel()'); pg.wait_for_timeout(200)
        ok(f'[{name}] 메뉴 패널은 기본 스크롤 허용(조작부만 막음)', pg.evaluate('(()=>{const t=new Touch({identifier:8,target:document.querySelector("#missionList"),clientX:1,clientY:1}); const e=new TouchEvent("touchmove",{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}); document.querySelector("#missionList").dispatchEvent(e); return !e.defaultPrevented})()'))
        ok(f'[{name}] 에러 없음', not errs, errs)
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
