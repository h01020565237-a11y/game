"""무기 밸런스 최종 + 전투 HUD V2 (2026-11-25 추가 수정 요청): python3 tests/weapons_hud.py [index.html]
무기: 샷건 4.0초·최대 5명(탄환별 피해 유지) / 저격총 1,200·3.5초 / 수류탄 2.0초 별도 쿨타임·장착 무기 안 바뀜 / 맨손 유지
     연타로 간격 무시 불가 / 무기 교체로 쿨타임 초기화 불가
HUD: 원형 스킬 버튼(캐릭터 아이콘·원형 쿨타임·남은 초), 궁극기 충전·완충 구분, 패시브 상태 표시(버튼 아님)
     공격 버튼 무기 아이콘(없으면 주먹)·즉시 변경, 대시=교체 같은 크기, 교체 버튼 등장해도 다른 버튼 안 움직임
     수류탄 수량·0개 비활성, 버튼끼리 안 겹침(모바일 여러 크기·PC), 직사각형 무기 패널·가로 스킬칸 없음"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
SEED = "localStorage.setItem('battlelab.profile', JSON.stringify({playerId: '00000000-0000-4000-8000-000000000000', token: 'x', nickname: '테스트', registered: true}))"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    # ----- 무기 -----
    r = pg.evaluate('''(() => { openLobby(); startEndless("suit"); document.body.classList.add("menuOpen"); god = true; const R = singleRun; R.t = 0.01; for (let i = 0; i < 5; i++) update(1/60); R.plan = 0; R.timer = 1e9;
      const mk = (dx, dy) => { const e = makeEnemy("melee", { x: p.x + dx, y: p.y + dy }, { noExp: true }); e.x = p.x + dx; e.y = p.y + dy; e.spawnT = 0; e.hp = e.max = 1e6; e.spd = 1e-6; e.atkT = 99; e.dmg = 0; return e; };
      const out = {};
      // 샷건: 부채꼴 안에 적 8명 → 최대 5명
      bots = []; shots = []; p.w = 4; p.ammo = 3; p.cd = 0;
      const es = [-30, -15, 0, 15, 30].map((d) => [115, d]).concat([-22, -7, 7, 22].map((d) => [150, d])).map(([r, d]) => mk(Math.cos(d * Math.PI / 180) * r, Math.sin(d * Math.PI / 180) * r));
      attack(p, p.x + 200, p.y); for (let i = 0; i < 40; i++) update(1/60);
      out.sgHit = es.filter((e) => e.hp < e.max).length; out.sgGap = +(WEAPON_RULES[4].gap).toFixed(2);
      p.cd = 0; p.ammo = 3; attack(p, p.x + 200, p.y); out.sgCd = +p.cd.toFixed(2);
      // 샷건 탄환별 피해 그대로 (기존 140 × 거리 감쇠)
      out.sgDmg = weapons[4][1];
      // 저격총
      bots = []; shots = []; p.w = 5; p.ammo = 3; p.cd = 0; const s1 = mk(150, 0);
      attack(p, s1.x, s1.y); for (let i = 0; i < 40; i++) update(1/60); out.snDmg = Math.round(s1.max - s1.hp);
      p.cd = 0; p.ammo = 3; attack(p, s1.x, s1.y); out.snCd = +p.cd.toFixed(2);
      // 연타로 간격 무시 불가: 0.1초마다 공격 3.4초 동안 → 저격 1발만 더 나가면 안 됨
      bots = []; shots = []; const s2 = mk(150, 0); p.cd = 0; p.ammo = 3; let fired = 0;
      for (let i = 0; i < 204; i++) { if (i % 6 === 0) { const c0 = p.ammo; attack(p, s2.x, s2.y); if (p.ammo < c0) fired++; } update(1/60); }
      out.spam = fired;
      // 무기 교체로 쿨타임 초기화 불가: 저격 직후 교체해도 남은 간격 유지
      bots = []; shots = []; p.w = 5; p.cd = 0; p.ammo = 3; attack(p, p.x + 100, p.y); const cd0 = p.cd;
      dropLoot({ x: p.x, y: p.y, type: LOOT.weapon, id: 1 }); pickup(p, isSwapLoot); out.swap = [p.w, +cd0.toFixed(2), +p.cd.toFixed(2)];
      const c1 = p.ammo; attack(p, p.x + 100, p.y); out.swapFire = p.ammo < c1;
      // 수류탄: 2초 별도 쿨타임, 던져도 장착 무기 그대로, 공격 쿨타임과 따로
      p.w = 3; p.cd = 0; p.ammo = 3; p.grenades = 3; p.grenCD = 0;
      const t1 = throwGrenade(p, p.x + 100, p.y), w1 = p.w, gcd = +p.grenCD.toFixed(2), t2 = throwGrenade(p, p.x + 100, p.y);
      const a0 = p.ammo; attack(p, p.x + 100, p.y); const atkOk = p.ammo < a0;
      for (let i = 0; i < 125; i++) update(1/60); const t3 = throwGrenade(p, p.x + 100, p.y);
      out.gren = { t1, w1, gcd, t2, atkOk, t3, left: p.grenades };
      out.fist = weapons[0].slice(1);
      return out; })()''')
    print('weapons', r)
    ok('샷건: 범위 안 적 9명 중 최대 5명만 맞음 (탄 5발이 각각 첫 대상)', 4 <= r['sgHit'] <= 5, r['sgHit'])
    ok('샷건: 공격 간격 4.0초, 탄환별 피해 기존 140 유지', r['sgCd'] == 4.0 and r['sgDmg'] == 140, (r['sgCd'], r['sgDmg']))
    ok('저격총: 1,200 피해·간격 3.5초', r['snDmg'] >= 1200 and r['snCd'] == 3.5, (r['snDmg'], r['snCd']))
    ok('연타해도 간격 무시 불가 (저격 3.4초 동안 1발)', r['spam'] == 1, r['spam'])
    ok('무기 교체해도 남은 쿨타임 유지 (바로 못 쏨)', r['swap'][0] == 1 and r['swap'][2] == r['swap'][1] and not r['swapFire'], (r['swap'], r['swapFire']))
    g = r['gren']
    ok('수류탄: 던져도 장착 무기 그대로, 2.0초 별도 쿨타임', g['t1'] and g['w1'] == 3 and g['gcd'] == 2.0 and not g['t2'], g)
    ok('수류탄 쿨타임 중에도 주무기 공격 가능, 2초 뒤 다시 던짐', g['atkOk'] and g['t3'] and g['left'] == 1, g)
    ok('맨손 기존 유지 (100·0.5·80)', r['fist'] == [100, 0.5, 80], r['fist'])
    # ----- HUD -----
    def hud(vp, mob, chars, rot=False):
        global fails
        ctx = b.new_context(viewport=vp, has_touch=mob, is_mobile=mob)
        ctx.add_init_script(SEED)
        q = ctx.new_page(); e2 = []
        q.on('pageerror', lambda e: e2.append(str(e)))
        q.goto(url); q.wait_for_timeout(2500)
        q.click('#titleStart'); q.wait_for_timeout(200); q.evaluate("setQaUnlock(true)"); q.click('#modeWave'); q.wait_for_timeout(200)
        tag = f"[{vp['width']}x{vp['height']}{' 모바일' if mob else ' PC'}]"
        for ch in chars:
            q.evaluate(f"openLobby(); lobbyMode = 'wave'; document.querySelector('#character').value = '{ch}'; lobbySel = '{ch}'")
            q.click('#lobbyPlay'); q.wait_for_timeout(1800)
            q.evaluate("document.body.classList.add('menuOpen')")
            ids = ['atk', 'dashBtn', 'grenBtn', 'pickBtn', 'ultBtn'] + (['summonBtn', 'bearHeal'] if ch != 'summoner' else [])
            sel = ids + (['petBtn0', 'petBtn1', 'petBtn2'] if ch == 'summoner' else [])
            st = q.evaluate('''([ids, sel]) => { p.grenades = 0; p.w = 0; p.skcd.q = 3; p.skcd.e = 0; p.ult = 0.4; touchHUD();
              const rect = (e) => e.getBoundingClientRect(), R = {};
              for (const id of sel) { const e = id.startsWith('petBtn') ? document.querySelectorAll('.petBtn')[+id.slice(-1)] : el(id); const r = rect(e); R[id] = [r.left, r.top, r.right, r.bottom, getComputedStyle(e).display, getComputedStyle(e).borderRadius, e.offsetWidth]; }
              const pick0 = R.pickBtn.slice(0, 4);
              const a = el('atk'), ic = getComputedStyle(el('summonBtn').querySelector('.sk-ico')).backgroundImage, ult = el('ultBtn');
              const s1 = { fist: a.classList.contains('fist'), qcd: getComputedStyle(el('summonBtn')).getPropertyValue('--cd').trim(), qtxt: el('summonBtn').querySelector('.cdt').textContent, ultPct: el('ultLabel').textContent, ultReady: ult.classList.contains('ready'), grenEmpty: el('grenBtn').classList.contains('empty'), icon: ic.startsWith('url(') && !ic.includes('/css/') };
              p.w = 3; p.ult = 1; p.grenades = 2; touchHUD();
              const s2 = { fist: a.classList.contains('fist'), wicon: a.style.getPropertyValue('--wicon').length > 10, ultReady: ult.classList.contains('ready'), grenEmpty: el('grenBtn').classList.contains('empty'), cnt: el('grenCount').textContent };
              // 교체 버튼 등장 전후로 다른 버튼 자리 그대로
              const before = {}; for (const id of ids) { const r = rect(el(id)); before[id] = [r.left, r.top]; }
              dropLoot({ x: p.x, y: p.y, type: LOOT.weapon, id: 4 }); touchHUD();
              const shown = el('pickBtn').classList.contains('show'), moved = ids.filter((id) => id !== 'pickBtn' && (rect(el(id)).left !== before[id][0] || rect(el(id)).top !== before[id][1]));
              const pk = getComputedStyle(el('pickBtn')).getPropertyValue('--wicon').length > 10;
              const chip = el('passiveChip'), chipBtn = chip.tagName === 'BUTTON';
              return { R, s1, s2, shown, moved, pk, chip: !chip.hidden && el('passiveName').textContent.length > 0, chipBtn,
                skillBar: getComputedStyle(el('skillBar')).display, weaponHud: getComputedStyle(el('weaponHud')).display, nameLabel: typeof drawName };
            }''', [ids, sel])
            R = st['R']
            # 원형 버튼: 중심·반지름으로 겹침 판정 (교체 버튼은 나타났을 때 크기)
            vis = {}
            for k, v in R.items():
                if v[4] == 'none' or v[6] == 0: continue
                cx, cy = (v[0] + v[2]) / 2, (v[1] + v[3]) / 2
                vis[k] = [cx - v[6] / 2, cy - v[6] / 2, cx + v[6] / 2, cy + v[6] / 2] + v[4:]
            over = []
            ks = list(vis)
            for i in range(len(ks)):
                for j in range(i + 1, len(ks)):
                    A, B = vis[ks[i]], vis[ks[j]]
                    ax, ay, ar = (A[0] + A[2]) / 2, (A[1] + A[3]) / 2, (A[2] - A[0]) / 2
                    bx, by, br = (B[0] + B[2]) / 2, (B[1] + B[3]) / 2, (B[2] - B[0]) / 2
                    if ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5 < ar + br + 2:
                        over.append((ks[i], ks[j]))
            inside = all(v[0] >= -1 and v[1] >= -1 and v[2] <= vp['width'] + 1 and v[3] <= vp['height'] + 1 for v in vis.values())
            T = f'{tag}[{ch}] '
            ok(T + '버튼끼리 안 겹침·화면 안', not over and inside, (over, {k: [round(x) for x in v[:4]] for k, v in vis.items()}) if over or not inside else '')
            ok(T + '모든 조작 버튼 원형', all(v[5] == '50%' for k, v in vis.items()), {k: v[5] for k, v in vis.items() if v[5] != '50%'})
            dw = R['dashBtn'][6]; pw_ = R['pickBtn'][6]; aw = R['atk'][6]
            ok(T + '대시·교체 버튼 같은 크기, 공격 버튼이 가장 큼', abs(dw - pw_) < 1 and aw > max(v[6] for k, v in vis.items() if k != 'atk'), (dw, pw_, aw))
            ok(T + '무기 없으면 주먹 → 무기 들면 무기 아이콘으로 즉시', st['s1']['fist'] and not st['s2']['fist'] and st['s2']['wicon'])
            if ch != 'summoner':
                ok(T + '스킬 아이콘 + 원형 쿨타임·남은 초', st['s1']['icon'] and float(st['s1']['qcd'] or 0) > 0 and st['s1']['qtxt'] == '3.0', st['s1'])
            ok(T + '궁극기 충전률 표시 → 완충 시 구분', st['s1']['ultPct'] == '40%' and not st['s1']['ultReady'] and st['s2']['ultReady'])
            ok(T + '수류탄 수량 표시, 0개면 비활성', st['s1']['grenEmpty'] and not st['s2']['grenEmpty'] and st['s2']['cnt'] == '2')
            ok(T + '교체 버튼: 바꿀 무기 위에서만 등장(무기 아이콘), 다른 버튼 안 움직임', st['shown'] and st['pk'] and not st['moved'], st['moved'])
            ok(T + '패시브는 버튼이 아닌 상태 표시', st['chip'] and not st['chipBtn'])
            ok(T + '직사각형 무기 패널·가로 스킬칸 없음', st['skillBar'] == 'none' and st['weaponHud'] == 'none', (st['skillBar'], st['weaponHud']))
            q.evaluate("document.body.classList.remove('menuOpen')")
        ok(f'{tag} 에러 없음', not e2, e2[:3])
        ctx.close()
    hud({'width': 844, 'height': 390}, True, ['suit', 'summoner', 'bear', 'runner'])
    hud({'width': 667, 'height': 375}, True, ['octo', 'summoner'])
    hud({'width': 932, 'height': 430}, True, ['stripe'])
    hud({'width': 1280, 'height': 720}, False, ['suit', 'summoner'])
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
