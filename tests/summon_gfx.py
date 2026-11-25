"""소환수 그래픽 팩 적용 테스트: python3 tests/summon_gfx.py [index.html] [비교할 이전 빌드.html]
- 그래픽 매핑 (V2): 피카츄→썬더리, 파이리→볼케론, 꼬부기→아쿠비, 이상해씨→플로라온, 고오스→팬텀랜턴, 잠만보→그라바크
  라프라스·푸린은 기존 그대로, 크리스골렘·스카이런은 후보(게임에 안 나옴), 소환수 수 그대로
- 능력치·스킬·공격 판정(맞는 시점)·쿨타임: 이전 빌드와 완전히 같음
- 8방향: 이동·공격 방향에 맞는 시트 줄, 공격 모션 1번 재생 후 이동/대기로 복귀
- 소환 버튼 아이콘 교체, 화면 크기(캐릭터와 비율), 성능, 그림이 없는 공개 빌드에서도 에러 없이 대체 표시"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
old = sys.argv[2] if len(sys.argv) > 2 else None
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
SNAP = "JSON.stringify({ mons, PET_SKILLS, PET_RULES: typeof PET_RULES !== 'undefined' ? PET_RULES : null, PET_AI: typeof PET_AI !== 'undefined' ? PET_AI : null, dex: PET_DEX.map((d) => [d.dex, d.kind, d.base, d.stage]), delay: PET_DEX.map((d, i) => +petHitDelay(i).toFixed(4)), n: mons.length })"
SEED = "localStorage.setItem('battlelab.profile', JSON.stringify({playerId: '00000000-0000-4000-8000-000000000000', token: 'x', nickname: '테스트', registered: true}))"
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    def page(path, mob=True):
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=mob, is_mobile=mob)
        ctx.add_init_script(SEED)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(pathlib.Path(path).resolve().as_uri()); pg.wait_for_timeout(3000)
        return pg, errs
    pg, errs = page(f)
    snap = pg.evaluate(SNAP)
    if old:
        po, _ = page(old)
        ok('능력치·스킬·공격 판정 시점·쿨타임·소환수 수가 이전 빌드와 같음', po.evaluate(SNAP) == snap)
        po.context.close()
    m = pg.evaluate("PET_DEX.map((d, i) => { const s = summonGfx(i); return s ? [s.key, +s.grow.toFixed(2)] : null; })")
    names = pg.evaluate("mons.map((x) => x[0])")
    want = {'피카츄': 'thunderi', '파이리': 'bolkeron', '꼬부기': 'akubi', '이상해씨': 'floraon', '고오스': 'phantomlantern', '잠만보': 'gravak'}
    ok('기본 소환수 6종 그래픽 매핑', all(m[names.index(k)] and m[names.index(k)][0] == v for k, v in want.items()), m[:8])
    ok('라프라스·푸린은 기존 그림 그대로 (매핑 없음)', m[names.index('라프라스')] is None and m[names.index('푸린')] is None)
    evo = {n: m[i] for i, n in enumerate(names) if n in ('라이츄', '리자몽', '거북왕', '팬텀')}
    ok('진화형은 기본형 그래픽 + 단계별 크게', evo['라이츄'][0] == 'thunderi' and evo['리자몽'] == ['bolkeron', 1.16] and evo['거북왕'][0] == 'akubi' and evo['팬텀'][0] == 'phantomlantern', evo)
    ok('크리스골렘·스카이런: 후보 등록만, 게임 소환수 목록엔 없음', pg.evaluate("SUMMON_GFX.crystalgolem.candidate && SUMMON_GFX.skyreyon.candidate && !Object.values(SUMMON_BY_PET).some((k) => k === 'crystalgolem' || k === 'skyreyon')"))
    loaded = pg.evaluate("Object.keys(SUMMON_GFX).every((k) => ['idle','move','attack'].every((a) => !!summonImg(SUMMON_GFX[k].anims[a])) && !!summonImg(SUMMON_GFX[k].icon))")
    ok('8종 시트(대기·이동·공격)·아이콘 불러옴 (로컬)', loaded)
    # 실제 게임: 현곤 웨이브
    pg.click('#titleStart'); pg.wait_for_timeout(200); pg.evaluate("setQaUnlock(true)"); pg.click('#modeWave'); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#character').value='summoner'; lobbySel='summoner'"); pg.click('#lobbyPlay'); pg.wait_for_timeout(2500)
    r = pg.evaluate('''(() => { document.body.classList.add('menuOpen'); god = true; const R = singleRun; R.plan = 0; R.timer = 1e9; bots = []; mobShots = []; hazards = [];
      // drawImage 엿보기: 어떤 그림·줄(row)로 그렸는지
      const calls = []; const orig = g.drawImage.bind(g); g.drawImage = (...a) => { calls.push([a[0].src || '', a[2]]); return orig(...a); };
      const out = {};
      pet = { ...actor(p.x + 40, p.y), id: 0, hp: 800, max: 800, life: 99, skillCD: 99, cd: 0 }; visionCache.t = -1;
      // 이동: 플레이어가 오른쪽으로 멀어지면 소환수가 따라 오른쪽(E=2)으로
      const dirs = [];
      for (let i = 0; i < 90; i++) { p.x += 3; update(1/60); if (pet.moving) dirs.push(pet.dir); }
      calls.length = 0; drawPetSprite(pet);
      out.moveDir = dirs.length ? dirs[dirs.length - 1] : -1; out.moveSheet = calls[0]?.[0].split('/').slice(-2).join('/'); out.moveRow = calls[0] ? calls[0][1] / 64 : -1;
      // 공격: 왼쪽 위(NW=7)의 적을 치면 공격 시트·NW 줄, 0.4초 뒤 대기로
      pet.x = p.x; pet.y = p.y + 30; pet.moving = false; pet.cd = 0;
      const e = makeEnemy('tank', { x: pet.x - 70, y: pet.y - 70 }, { noExp: true }); e.x = pet.x - 70; e.y = pet.y - 70; e.spawnT = 0; e.hp = e.max = 1e6; e.spd = 1e-6; e.atkT = 99; e.dmg = 0; visionCache.t = -1;
      let at = -1; for (let i = 0; i < 120 && at < 0; i++) { update(1/60); if (pet.atkAt !== undefined && elapsed - pet.atkAt < 0.05) at = i; }
      calls.length = 0; drawPetSprite(pet); out.atkSheet = calls[0]?.[0].split('/').slice(-2).join('/'); out.atkRow = calls[0] ? calls[0][1] / 64 : -1; out.atkDir = pet.dir;
      const t0 = pet.atkAt; elapsed = t0 + 0.45; pet.moving = false; calls.length = 0; drawPetSprite(pet); out.after = calls[0]?.[0].split('/').slice(-2).join('/');
      // 크기: 캐릭터(68px 칸, 키 약 56~60px) 대비 소환수 그려지는 칸
      calls.length = 0; drawPetSprite(pet); const cw = calls.length ? 64 * SUMMON_FRAME.scale : 0;
      out.size = +cw.toFixed(1);
      g.drawImage = orig; bots = []; return out; })()''')
    print('dir', r)
    ok('이동 방향(E)에 맞는 이동 시트·줄', r['moveDir'] == 2 and r['moveSheet'] == 'thunderi/move.webp' and r['moveRow'] == 2, r)
    ok('공격 방향(NW)에 맞는 공격 시트·줄', r['atkDir'] == 7 and r['atkSheet'] == 'thunderi/attack.webp' and r['atkRow'] == 7, r)
    ok('공격 모션 1번 재생 후 대기로 복귀', r['after'] == 'thunderi/idle.webp', r['after'])
    ok('크기: 64칸 × 1.2 → 약 77px 칸 (몸 키 약 36~48px, 캐릭터 56~60px 의 약 3/4)', 74 <= r['size'] <= 80, r['size'])
    # 모든 방향 줄 사용
    rows = pg.evaluate('''(() => { const rows = []; const orig = g.drawImage.bind(g); g.drawImage = (...a) => { rows.push(a[2] / 64); return orig(...a); };
      for (let d = 0; d < 8; d++) drawPetSprite({ x: p.x, y: p.y, id: 3, dir: d, moving: true }); g.drawImage = orig; return rows; })()''')
    ok('8방향 모두 각자 줄로 전환', rows == list(range(8)), rows)
    # 소환 버튼 아이콘
    pg.evaluate("document.body.classList.remove('menuOpen')"); pg.wait_for_timeout(300)
    ic = pg.evaluate("[...document.querySelectorAll('.petBtn')].map((b) => (b.querySelector('img')?.src || '').split('/').slice(-2).join('/'))")
    ok('소환 버튼 아이콘 = 새 소환수 아이콘', all(x.endswith('icon.webp') for x in ic) and len(ic) == 3, ic)
    # 현곤 보스가 부르는 포켓몬(적)도 같은 그래픽
    used = pg.evaluate('''(() => { const calls = []; const orig = g.drawImage.bind(g); g.drawImage = (...a) => { calls.push(a[0].src || ''); return orig(...a); };
      const e = makeEnemy('pk_char', { x: p.x + 90, y: p.y }, { noExp: true }); e.spawnT = 0; draw(); g.drawImage = orig; bots = bots.filter((b) => b !== e);
      return calls.filter((s) => s.includes('summons_v2/')).map((s) => s.split('/').slice(-2).join('/')); })()''')
    ok('현곤 보스가 부르는 소환수(적)도 같은 그래픽', 'bolkeron/idle.webp' in used or 'bolkeron/move.webp' in used, used[:3])
    # 성능: 소환수 4 + 궁극기 3 + 적 소환수 6 + 적 20 상태에서 그리기 시간
    perf = pg.evaluate('''(() => { document.body.classList.add('menuOpen'); bots = [];
      for (let i = 0; i < 20; i++) { const e = makeEnemy(['melee','ranged','tank'][i % 3], { x: p.x + 120 + (i % 5) * 40, y: p.y - 80 + Math.floor(i / 5) * 40 }, { noExp: true }); e.spawnT = 0; }
      for (let i = 0; i < 6; i++) { const e = makeEnemy(['pk_pika','pk_char','pk_squirt'][i % 3], { x: p.x - 150 + i * 30, y: p.y + 90 }, { noExp: true }); e.spawnT = 0; }
      ultPets = [0, 1, 2].map((id, i) => ({ ...actor(p.x - 60 + i * 40, p.y - 50), id, hp: 1, max: 1, life: 9, moving: i % 2 === 0, dir: i * 2 }));
      const run = () => { for (let i = 0; i < 20; i++) draw(); const t = performance.now(); for (let i = 0; i < 120; i++) { elapsed += 1/60; draw(); } return (performance.now() - t) / 120; };
      const withGfx = run();
      const keep0 = { ...SUMMON_BY_PET }; for (const k in SUMMON_BY_PET) delete SUMMON_BY_PET[k]; const without = run(); Object.assign(SUMMON_BY_PET, keep0);
      ultPets = []; bots = []; return { withGfx: +withGfx.toFixed(2), without: +without.toFixed(2) }; })()''')
    print('perf', perf)
    ok('성능: 그리기 시간 증가 0.5ms 이하 (프레임 16.7ms 기준)', perf['withGfx'] - perf['without'] < 0.5, perf)
    ok('에러 없음', not errs, errs[:3])
    pg.context.close()
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
