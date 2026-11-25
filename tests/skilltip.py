"""공통 스킬 설명창 테스트 (모바일 가로·세로 회전, PC 마우스).
사용: python3 tests/skilltip.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright

url = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri()
fails = 0
def ok(name, cond, extra=''):
    global fails
    fails += not cond
    print(('PASS ' if cond else 'FAIL ') + name, extra)

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    for mode, vp in [('가로', (844, 390)), ('세로회전', (390, 844))]:
        pg = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, has_touch=True, is_mobile=True).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(1500); pg.evaluate('closeTitle()')
        cdp = pg.context.new_cdp_session(pg)
        def touch(t, x=0, y=0): cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
        ctr = lambda sel: pg.evaluate('(s)=>{let r=document.querySelector(s).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}', sel)
        rot = pg.evaluate('document.body.classList.contains("rot")')
        L = lambda c, dx, dy: (c[0] - dy, c[1] + dx) if rot else (c[0] + dx, c[1] + dy)
        tipText = lambda: pg.evaluate('skillTip.hidden ? "" : skillTip.textContent')
        for ch in ['stripe', 'bear', 'runner', 'suit', 'octo', 'soccer', 'support']:
            pg.evaluate(f'openLobby(); lobbySel="{ch}"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(250)
            pg.evaluate('god=true; freeze=true; p.s1=p.s2=p.runCD=p.healCD=p.tackleCD=0; p.energy=100')
            for sel, slot in [('#summonBtn', 'q'), ('#bearHeal', 'e')]:
                c = ctr(sel)
                touch('touchStart', *c); pg.wait_for_timeout(400); early = tipText(); pg.wait_for_timeout(250); t = tipText(); touch('touchEnd'); pg.wait_for_timeout(60)
                name = pg.evaluate(f'SKILL_DATA["{ch}"].{slot}.name'); cdv = pg.evaluate(f'fmtNum(SKILL_DATA["{ch}"].{slot}.cd)')
                fired = pg.evaluate(f'skillCdLeft("{slot}") > 0')
                ok(f'[{mode}] {ch} {slot}: 0.4초엔 안 뜨고 0.6초에 설명(이름·쿨타임 {cdv}초) → 떼도 발동 안 함', not early and name in t and f'쿨타임 {cdv}초' in t and not fired and tipText() == '')
                touch('touchStart', *c); pg.wait_for_timeout(80); touch('touchEnd'); pg.wait_for_timeout(60)
                ok(f'[{mode}] {ch} {slot}: 짧게 탭하면 발동', pg.evaluate(f'skillCdLeft("{slot}") > 0'))
        # 끌기 시작하면 닫힘
        pg.evaluate('p.s1=0'); c = ctr('#summonBtn'); touch('touchStart', *c); pg.wait_for_timeout(650); shown = tipText() != ''
        touch('touchMove', *L(c, 30, 0)); pg.wait_for_timeout(60); closed = tipText() == ''; touch('touchEnd')
        ok(f'[{mode}] 설명 중 끌기 시작하면 닫힘', shown and closed)
        # 현곤 포켓몬 버튼
        pg.evaluate('openLobby(); lobbySel="summoner"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(300)
        pg.evaluate('god=true;p.x=1236;p.y=640;bots.forEach(b=>{b.x=200;b.y=200});pet=null;flight=null;summonCD.fill(0)')
        for i in range(3):
            c = ctr(f'.petBtn[data-i="{i}"]')
            touch('touchStart', *c); pg.wait_for_timeout(650); t = tipText(); touch('touchEnd'); pg.wait_for_timeout(60)
            want = pg.evaluate(f'PET_SKILLS[deck[{i}]].name'); dmg = pg.evaluate(f'PET_SKILLS[deck[{i}]].dmg')
            ok(f'[{mode}] 포켓몬 {i + 1}: 길게 누르면 기술·피해 {dmg} 설명, 소환 안 됨', want in t and f'피해 {dmg}' in t and not pg.evaluate('!!flight'))
        c = ctr('.petBtn[data-i="0"]'); touch('touchStart', *c); pg.wait_for_timeout(80); touch('touchEnd'); pg.wait_for_timeout(60)
        ok(f'[{mode}] 포켓몬 탭: 바로 소환', pg.evaluate('!!flight'))
        pg.evaluate('pet=null;flight=null;summonCD.fill(0)')
        c = ctr('.petBtn[data-i="2"]'); touch('touchStart', *c); pg.wait_for_timeout(650)
        for k in range(1, 7): touch('touchMove', *L(c, -10 * k, 4 * k)); pg.wait_for_timeout(25)
        mid = tipText() == '' and pg.evaluate('!!summonAim'); touch('touchEnd'); pg.wait_for_timeout(60)
        ok(f'[{mode}] 포켓몬: 설명 보다가 끌면 설명 닫히고 조준·투척 유지', mid and pg.evaluate('!!flight'))
        ok(f'[{mode}] 오류 없음', not errs, errs)
    # PC 마우스
    pg = b.new_context(viewport={'width': 1400, 'height': 860}).new_page()
    pg.goto(url); pg.wait_for_timeout(1500); pg.evaluate('closeTitle()')
    for ch in ['stripe', 'summoner']:
        pg.evaluate(f'openLobby(); lobbySel="{ch}"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(300)
        n = pg.evaluate('document.querySelectorAll("#skillBar .sk-slot").length')
        ok(f'[PC] {ch} 스킬 칸 표시 ({n}칸)', n == (6 if ch == 'summoner' else 3))
        for k in range(n):
            pg.hover(f'#skillBar .sk-slot >> nth={k}'); pg.wait_for_timeout(250)
            t = pg.evaluate('skillTip.hidden ? "" : skillTip.textContent')
            ok(f'[PC] {ch} 칸 {k + 1}: 마우스 올리면 설명', len(t) > 5, t[:40])
        pg.mouse.move(5, 5); pg.wait_for_timeout(150)
        ok(f'[PC] {ch}: 마우스가 벗어나면 닫힘', pg.evaluate('skillTip.hidden'))
    # 데이터 연동: 수치를 바꾸면 설명과 실제 피해가 같이 바뀜
    pg.evaluate('openLobby(); lobbySel="stripe"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(300)
    pg.evaluate('SKILL_DATA.stripe.e.dmg = 777')
    pg.hover('#skillBar .sk-slot >> nth=1'); pg.wait_for_timeout(250)
    t = pg.evaluate('skillTip.textContent')
    hpdrop = pg.evaluate('''(() => { god = true; freeze = true; p.s2 = 0; const b = bots[0]; b.x = p.x + 30; b.y = p.y; b.hp = b.max = 5000; p.lastMoveDir = 2; mvX = 1; mvY = 0; characterSkill(2); mvX = mvY = 0; return 5000 - b.hp; })()''')
    ok('[연동] 피해 수치 변경이 설명과 실제 피해에 같이 반영', '777' in t and abs(hpdrop - 777) < 1 or abs(hpdrop - 777 * 1.5) < 1, f'tip={("777" in t)} dmg={hpdrop}')
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
sys.exit(1 if fails else 0)
