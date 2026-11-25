"""이동형 스킬 공통 조작 + 경수 은신 규칙 테스트: python3 tests/move_stealth.py [index.html]"""
import pathlib, sys, math
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(name, cond, extra=''):
    global fails
    fails += not cond
    print(('PASS ' if cond else 'FAIL ') + name, extra)
def ang(v): return math.degrees(math.atan2(v[1], v[0]))
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(1500); pg.evaluate('closeTitle()')
    def start(ch):
        pg.evaluate(f'openLobby(); lobbySel="{ch}"; document.querySelector("#lobbyStart").click()'); pg.wait_for_timeout(250)
        # 열린 곳 (정중앙 별 광장), 적은 왼쪽 가까이 (자동 조준이면 왼쪽으로 감)
        pg.evaluate('god=true; freeze=true; p.x=1236; p.y=690; p.skcd.q=p.skcd.e=0; p.ult=1; p.energy=100; p.dashCD=0; bots.forEach((b,i)=>{b.x=1100; b.y=690+i*3; b.stealth=0}); mvX=0; mvY=0; p.lastMoveDir=4')
    # 1) 방향 우선순위: 이동형 스킬 전부 + 대시 (적은 왼쪽에 있음)
    cases = [('suit', 'q'), ('suit', 'e'), ('runner', 'e'), ('stripe', 'e'), ('soccer', 'q'), ('bear', 'q'), ('bear', 'r'), ('suit', 'dash')]
    for ch, slot in cases:
        start(ch)
        r = pg.evaluate(f'''(() => {{
          const o = {{}};
          mvX = 0; mvY = -1;                      // 조이스틱 위쪽
          o.joy = moveAim("{slot}").dir;
          mvX = 0; mvY = 0; p.lastMoveDir = 2;      // 조이스틱 없음, 마지막 이동 = 오른쪽
          o.last = moveAim("{slot}").dir;
          mvX = 0; mvY = -1;
          o.drag = moveAim("{slot}", {{ x: p.x, y: p.y + 100 }}).dir; // 끈 방향(아래) > 조이스틱(위)
          return o; }})()''')
        ok(f'{ch} {slot}: 끈 방향 > 조이스틱 > 마지막 이동 방향, 적 자동 조준 없음',
           abs(ang(r['joy']) + 90) < 1 and abs(ang(r['last'])) < 1 and abs(ang(r['drag']) - 90) < 1, r)
        # 실제 발동: 조이스틱 위쪽, 적은 왼쪽 → 위로 이동해야 함
        pg.evaluate(f'mvX=0; mvY=-1; p.x=1236; p.y=690; window.__o=[p.x,p.y]; castSkill("{slot}")')
        pg.evaluate('freeze=false'); pg.wait_for_timeout(700 if slot != 'r' else 1100); pg.evaluate('freeze=true; mvX=0; mvY=0')
        d = pg.evaluate('[p.x-__o[0], p.y-__o[1]]')
        ok(f'{ch} {slot}: 탭 발동 → 조이스틱(위) 방향으로 이동 (적 쪽 아님)', d[1] < -10 and abs(d[0]) < abs(d[1]) * 0.5, d)
    # 2) 정용 질주: 발동 방향 고정, 끝나면 조이스틱대로
    start('bear')
    pg.evaluate('mvX=1; mvY=0; castSkill("q"); mvX=0; mvY=-1; window.__o=[p.x,p.y]; freeze=false'); pg.wait_for_timeout(500)
    d1 = pg.evaluate('[p.x-__o[0], p.y-__o[1], !!p.moveLock]')
    pg.wait_for_timeout(560); pg.evaluate('window.__o=[p.x,p.y]'); pg.wait_for_timeout(150)
    d2 = pg.evaluate('[p.x-__o[0], p.y-__o[1], !!p.moveLock]'); pg.evaluate('freeze=true; mvX=0; mvY=0')
    ok('정용 질주: 질주 중 조이스틱을 바꿔도 발동 방향(오른쪽) 유지', d1[0] > 40 and abs(d1[1]) < 5 and d1[2], d1)
    ok('정용 질주: 끝나면 조이스틱(위)대로 이동 재개', d2[1] < -5 and not d2[2], d2)
    # 3) 터치: 길게 누르면 미리보기(조이스틱 실시간), 끌기 방향, 가운데로 되돌리면 취소
    start('suit')
    cdp = pg.context.new_cdp_session(pg)
    def touch(t, x=0, y=0): cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
    c = pg.evaluate('(()=>{let r=document.querySelector("#bearHeal").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()')
    pg.evaluate('mvX=0; mvY=-1')
    touch('touchStart', *c); pg.wait_for_timeout(650)
    a1 = pg.evaluate('skillAim && [skillAim.live, skillAim.dir]'); tip = pg.evaluate('!skillTip.hidden')
    pg.evaluate('mvX=1; mvY=0'); pg.wait_for_timeout(80)
    a2 = pg.evaluate('skillAim && skillAim.dir')
    touch('touchMove', c[0], c[1] + 60); pg.wait_for_timeout(60)
    a3 = pg.evaluate('skillAim && [skillAim.x - p.x, skillAim.y - p.y]')
    touch('touchMove', c[0], c[1] + 2); pg.wait_for_timeout(60); touch('touchEnd'); pg.wait_for_timeout(80)
    cancelled = pg.evaluate('p.skcd.e === 0 && !p.sideStep')
    ok('길게 누름: 조준 표시(설명창 대신), 조이스틱 방향을 실시간으로 따라감', a1 and a1[0] and abs(ang(a1[1]) + 90) < 1 and not tip and abs(ang(a2)) < 1, (a1, a2, tip))
    ok('끌기: 끈 방향으로 조준 갱신', a3 and a3[1] > 30, a3)
    ok('끈 뒤 버튼 가운데로 되돌려 떼면 취소', cancelled)
    # 4) 위빙 미리보기 경로 = 실제 경로 (벽 충돌 포함)
    pg.evaluate('freeze=true; mvX=0; mvY=0')
    wall = pg.evaluate('''(() => { // 벽 바로 옆 자리 찾기 (오른쪽 30px 안에 벽)
      for (const [x, y, w, h] of walls) { const px = x - 24, py = y + h / 2; if (!terrain(px, py) && !blocked(px, py) && !nearBox(px, py, 30)) return [px, py]; } return null; })()''')
    res = []
    for dx, dy in [(1, 0), (1, -1), (0, 1)]:
        pg.evaluate(f'p.x={wall[0]}; p.y={wall[1]}; p.skcd.e=0; p.sideStep=null; p.weave=0')
        pre = pg.evaluate(f'(() => {{ const t={{x:p.x+{dx}*40, y:p.y+{dy}*40}}; const [ux,uy]=unitTo(t); const pts=simMovePath(p.x,p.y,ux,uy,SKILL_DATA.suit.e.range); return pts[pts.length-1]; }})()')
        pg.evaluate(f'castSkill("e", {{x:p.x+{dx}*40, y:p.y+{dy}*40}}); freeze=false'); pg.wait_for_timeout(400); pg.evaluate('freeze=true')
        real = pg.evaluate('[p.x, p.y]')
        res.append((pre, real))
    ok('위빙: 미리보기 도착 위치 = 실제 도착 위치 (벽 충돌·미끄러짐 포함)', all(abs(a[0] - c2[0]) < 0.6 and abs(a[1] - c2[1]) < 0.6 for a, c2 in res), res)
    ok('위빙: 벽 쪽으로는 벽 앞에서 멈춤', res[0][1][0] - wall[0] < 40, res[0])

    # ===== 경수 은신 =====
    start('stripe')
    pg.evaluate('freeze=true; bots.forEach((b,i)=>{b.x=1236+60; b.y=690+i*5; b.hp=b.max})')
    pg.evaluate('castSkill("q")')
    r = pg.evaluate('[p.stealth, bots.every((b) => !targets(b).includes(p)), bots.every((b) => !visible(b, p))]')
    ok('은신 3초, 가까이(60) 있어도 적 자동 타겟·시야에서 제외', abs(r[0] - SKILL_DATA_q_dur) < 0.01 if (SKILL_DATA_q_dur := pg.evaluate('SKILL_DATA.stripe.q.dur')) else False and r[1] and r[2], r)
    ok('은신: 적 자동 타겟 대상 아님 (60px 거리)', r[1] and r[2], r)
    hp0 = pg.evaluate('god=false; p.hp')
    pg.evaluate('const b=bots[0]; shots.push({a:b, x:p.x-40, y:p.y, vx:650, vy:0, left:200, d:50})'); pg.wait_for_timeout(50)
    pg.evaluate('freeze=false'); pg.wait_for_timeout(150); pg.evaluate('freeze=true')
    r = pg.evaluate(f'[p.hp < {hp0}, p.stealth > 0]')
    ok('은신 중에도 이미 날아온 투사체·수동 공격에 맞음, 맞아도 은신 유지', r == [True, True], r)
    pg.evaluate('god=true')
    # 은신 시간 끝
    pg.evaluate('p.stealth=0.2; freeze=false; bots.forEach(b=>{b.x=200;b.y=200})'); pg.wait_for_timeout(400); pg.evaluate('freeze=true')
    ok('지속시간 끝나면 은신 해제 → 다시 타겟 가능', pg.evaluate('p.stealth === 0 && visible(bots[0], p)'))
    pg.evaluate('castSkill("q") || (p.skcd.q=0, castSkill("q"))'); pg.evaluate('p.skcd.q=0; p.stealth=3')
    pg.evaluate('attack(p, p.x+50, p.y)')
    ok('공격하면 즉시 은신 해제', pg.evaluate('p.stealth === 0'))
    # PvE: 적 AI 가 실제 위치를 모름 (무한 생존)
    pg.evaluate('startEndless("stripe"); god=true; singleRun.t=0.01'); pg.wait_for_timeout(400)
    pg.evaluate('bots.length=0; p.x=1236; p.y=690; const m=makeEnemy("melee",{x:1236+300,y:690}); m.spawnT=0; p.skcd.q=0; castSkill("q"); p.x=1236; p.y=690+250')
    pg.evaluate('freeze=false'); pg.wait_for_timeout(1200)
    r = pg.evaluate('(() => { const m = bots.find(b=>b.mob==="melee"); return [Math.round(Math.hypot(m.x-p.ghost.x, m.y-p.ghost.y)), Math.round(Math.hypot(m.x-p.x, m.y-p.y)), p.stealth > 0]; })()')
    ok('PvE 적 AI: 실제 위치가 아니라 은신 시작 위치로 감 (추적 안 함)', r[2] and r[0] < r[1] and r[1] > 150, r)
    # 근접 감지: 은신한 적(무한 생존 암살 적)이 120 안 → 내 머리 위 !, 경고음 1번
    pg.evaluate('freeze=true; bots.length=0; window.__snd=0; const _s=sfx; window.sfx=(n,...a)=>{ if(n==="stealth_alert") __snd++; return _s(n,...a); }; const a=makeEnemy("assassin",{x:p.x+300,y:p.y}); a.spawnT=0; a.stealth=99')
    pg.evaluate('updateStealthAlert()'); far = pg.evaluate('p.stealthAlert')
    pg.evaluate('bots[0].x=p.x+100; updateStealthAlert(); updateStealthAlert(); bots[0].x=p.x+90; updateStealthAlert()')
    near = pg.evaluate('[p.stealthAlert, __snd]')
    auto = pg.evaluate('[autoAimPoint("e").target === undefined, !targets(p).includes(bots[0])]')
    pg.evaluate('bots[0].x=p.x+200; updateStealthAlert()'); gone = pg.evaluate('p.stealthAlert')
    pg.evaluate('bots[0].x=p.x+100; updateStealthAlert(); bots[0].stealth=0; updateStealthAlert()'); gone2 = pg.evaluate('p.stealthAlert')
    ok('근접 감지: 범위 밖 없음 → 안에 들어오면 ! 표시, 경고음은 처음 1번만', far is False and near == [True, 1], (far, near))
    ok('근접 감지 중에도 자동 조준·자동 타겟 대상 아님', auto == [True, True], auto)
    ok('범위를 벗어나거나 은신이 풀리면 ! 바로 사라짐', gone is False and gone2 is False, (gone, gone2))
    ok('감지 범위 데이터화 (SKILL_DATA.stripe.q.detect)', pg.evaluate('SKILL_DATA.stripe.q.detect') == 120)
    ok('후방 공격 패시브 유지 ×1.5', pg.evaluate('SKILL_DATA.stripe.passive.mult') == 1.5)
    ok('에러 없음', not errs, errs)
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
