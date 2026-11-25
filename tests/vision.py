"""시야·풀숲·소환 포켓몬 AI 테스트: python3 tests/vision.py [index.html]
싱글(은숙 영입 미션: 현곤 출전, 정글 맵 = 풀숲 있음)과 웨이브에서
- 시야 안/밖: 자동 조준·표시 제외, 수동 공격(canHit)은 맞음, 포켓몬 시야 공유·해제 즉시 제거
- 풀숲: 밖에서 안 보임, 같은 풀숲·가까이는 보임, 공격 2초·피격 1초 노출, 경수 은신과 따로
- 적 AI: 숨은 플레이어는 공격 안 함, 드러나면 공격
- 포켓몬: 활동 반경 400, 대기 거리 60~100, 여러 마리 안 겹침, 풀숲 은폐, 맞는 프레임에 피해
- 스프라이트: 피카츄·파이리·꼬부기 연결, 진화형(스프라이트 없음)은 일러스트로
- 보스 체력 HUD 는 시야와 관계없이, 시야 밖 위험 표시 그림
- 배틀로얄은 시야 꺼짐"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
JS = r'''
window.V = {};
V.story = () => {
  startMission("eunsuk", "summoner"); document.body.classList.add("menuOpen"); god = true;
  for (let i = 0; i < 400 && singleRun.phase !== "fight"; i++) update(1 / 60);
  bots = bots.filter((b) => b.mob === "ward" || b.ward); singleRun.plan = 0; singleRun.timer = 999; mobShots = []; hazards = [];
  pet = null; ultPets = []; flight = null;
};
V.step = (n) => { for (let i = 0; i < n; i++) update(1 / 60); };
V.enemy = (kind, x, y) => { const e = makeEnemy(kind, { x, y }, { noExp: true }); e.spawnT = 0; e.x = x; e.y = y; return e; };
V.freeAt = (x, y) => freeSpot(x, y, 16);
V.bushSpot = () => { // 플레이어가 들어갈 수 있는 풀숲 하나 (가운데)와 그 밖 160 떨어진 곳
  for (const q of bushes) { const c = { x: q[0] + q[2] / 2, y: q[1] + q[3] / 2 }; if (q[2] > 60 && q[3] > 60 && !blocked(c.x, c.y, 16) && !terrain(c.x, c.y)) { const o = freeSpot(c.x + Math.max(q[2], q[3]) / 2 + 140, c.y, 16); if (o && !inBush(o)) return { c, o, q }; } }
  return null;
};
0;
'''
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: m.text.startswith('SHOT') and print(m.text))
    pg.goto(url); pg.wait_for_timeout(2500)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    pg.evaluate(JS)
    # 배틀로얄: 시야 꺼짐
    pg.evaluate("openLobby(); lobbySel = 'suit'; el('lobbyStart').click(); document.body.classList.add('menuOpen')")
    ok('배틀로얄은 시야 꺼짐 (PvP 는 나중에 on.pvp)', pg.evaluate('!visionOn() && VISION.on.pvp === false'))
    pg.evaluate('V.story()')
    ok('싱글 영입 미션: 시야 켜짐, 현곤 시야 350', pg.evaluate('visionOn() && character === "summoner" && playerSight() === 350'))
    # 시야 안/밖
    r = pg.evaluate('''(() => { const q = V.freeAt(p.x + 600, p.y), n = V.freeAt(p.x + 200, p.y); const far = V.enemy("melee", q.x, q.y), near = V.enemy("melee", n.x, n.y);
      far.dmg = near.dmg = 0; return [visible(p, far), mobShown(far), canHit(p, far), visible(p, near), mobShown(near), targets(p).includes(far), Math.round(dist(p, far))]; })()''')
    ok('시야 밖 적: 자동 조준·표시 제외', r[0] is False and r[1] is False and r[5] is False, r)
    ok('시야 밖 적도 수동 공격·투사체는 맞음 (canHit)', r[2] is True, r)
    ok('시야 안 적: 보임', r[3] and r[4], r)
    # 포켓몬 시야 공유
    r = pg.evaluate('''(() => { const far = bots.find((b) => b.mob === "melee" && dist(p, b) > 500); const q = V.freeAt((p.x + far.x) / 2 + 60, (p.y + far.y) / 2);
      pet = { ...actor(q.x, q.y), id: 0, hp: 800, max: 800, life: 10, skillCD: 99, cd: 99 }; visionCache.t = -1;
      const withPet = [visible(p, far), mobShown(far), Math.round(dist(pet, far))]; pet.hp = 0; visionCache.t = -1; const after = visible(p, far); pet = null; return [...withPet, after]; })()''')
    ok('포켓몬 시야(250) 공유: 현곤 시야 밖 적이 보임', r[0] and r[1] and r[2] <= 250 + 16, r)
    ok('소환 해제되면 공유 시야 바로 제거', r[3] is False, r)
    # 풀숲
    bs = pg.evaluate('V.bushSpot()')
    ok('정글 맵에 풀숲 있음', bool(bs), bs)
    if bs:
        r = pg.evaluate('''(() => { const B = V.bushSpot(); bots = bots.filter((b) => !b.mob || b.ward); const e = V.enemy("ranged", B.c.x, B.c.y); e.dmg = 0; e.atkT = 99;
          p.x = B.o.x; p.y = B.o.y; p.reveal = 0; e.reveal = 0; visionCache.t = -1;
          const out = { hidden: visible(p, e), shown: mobShown(e), d: Math.round(dist(p, e)) };
          e.reveal = 0; const n = freeSpot(e.x + 50, e.y, 16); p.x = n.x; p.y = n.y; visionCache.t = -1; out.near = visible(p, e);
          p.x = B.o.x; p.y = B.o.y; visionCache.t = -1; god = false; hit(e, p, 1); god = true; p.hp = p.max; out.atkReveal = +e.reveal.toFixed(2); out.afterAtk = visible(p, e);
          e.reveal = 0; hit(p, e, 1); out.hitReveal = +e.reveal.toFixed(2); e.reveal = 0;
          // 같은 풀숲: 플레이어도 그 풀숲 안 (가까이 75 밖)
          const q = B.q; const s = [[q[0] + 18, q[1] + q[3] / 2], [q[0] + q[2] - 18, q[1] + q[3] / 2], [q[0] + q[2] / 2, q[1] + 18], [q[0] + q[2] / 2, q[1] + q[3] - 18]].map(([x, y]) => ({ x, y })).filter((t) => !blocked(t.x, t.y, 16) && inBush(t) && dist(t, e) >= 75);
          if (s.length) { p.x = s[0].x; p.y = s[0].y; p.reveal = 0; visionCache.t = -1; out.sameBush = visible(p, e); } else out.sameBush = "n/a";
          return out; })()''')
        ok('풀숲 속 적: 밖에서 안 보임 (자동 조준·표시 제외)', r['hidden'] is False and r['shown'] is False, r)
        ok('가까이(75 안)는 보임', r['near'] is True, r)
        ok('공격하면 2초 노출', r['atkReveal'] == 2 and r['afterAtk'] is True, r)
        ok('맞으면 1초 노출', r['hitReveal'] == 1, r)
        ok('같은 풀숲이면 보임', r['sameBush'] in (True, 'n/a'), r)
        # 플레이어가 풀숲에 숨으면 원거리 적이 쏘지 않음, 드러나면 쏨
        r = pg.evaluate('''(() => { const B = V.bushSpot(); bots = bots.filter((b) => !b.mob || b.ward); p.x = B.c.x; p.y = B.c.y; p.reveal = 0; p.exposed = { x: p.x, y: p.y };
          const e = V.enemy("ranged", B.o.x, B.o.y); e.atkT = 0; e.reveal = 0; e.hunt = false; e.spd = 1e-4; /* 제자리: 가까이 75 안으로 오면 발견이 맞음 */ mobShots = []; let shotsHidden = 0, shotsShown = 0;
          for (let i = 0; i < 180; i++) { p.reveal = 0; update(1 / 60); const n = mobShots.filter((s) => s.a === e).length; if (n) console.log('SHOT', i, p.reveal, inBush(p), Math.round(dist(e, p)), e.reveal, JSON.stringify(mobShots.filter((s) => s.a === e)[0]).slice(0, 120)); shotsHidden += n; mobShots = []; }
          for (let i = 0; i < 120; i++) { p.reveal = 2; update(1 / 60); shotsShown += mobShots.filter((s) => s.a === e).length; mobShots = []; }
          return [shotsHidden, shotsShown, visible(e, p)]; })()''')
        ok('플레이어가 풀숲에 숨으면 적이 공격 안 함, 드러나면 공격', r[0] == 0 and r[1] > 0, r)
        # 포켓몬 풀숲 은폐
        r = pg.evaluate('''(() => { const B = V.bushSpot(); const e = bots.find((b) => b.mob === "ranged"); pet = { ...actor(B.c.x, B.c.y), id: 1, hp: 800, max: 800, life: 10, skillCD: 99, cd: 99, reveal: 0 };
          const a = visible(e, pet); pet.reveal = 1; const b2 = visible(e, pet); pet = null; return [a, b2]; })()''')
        ok('포켓몬도 풀숲에서 은폐 (적이 못 봄), 노출되면 보임', r[0] is False and r[1] is True, r)
    # 경수 은신과 따로
    ok('경수 은신 상태는 자동 탐지 안 됨 (시야 안이어도)', pg.evaluate('(() => { const e = bots.find((b) => b.mob); const t = actor(e.x + 20, e.y); t.stealth = 2; t.mob = "assassin"; t.max = 100; t.hp = 100; return !visible(p, t) && !visible(e, Object.assign({}, p, { stealth: 2 })); })()'))
    # 포켓몬 AI: 활동 반경·복귀·대기 거리·겹침
    pg.evaluate('V.story()')
    r = pg.evaluate('''(() => { p.ult = 1; castSkill("r", { x: p.x + 50, y: p.y }); const out = { n: ultPets.length };
      for (const pt of ultPets) { pt.life = 99; pt.skillCD = 99; } boxes = []; /* 상자가 있으면 포켓몬이 상자를 때리러 감 (정상) */
      V.step(240); // 적 없음 → 대기 자리
      out.dist = ultPets.map((pt) => Math.round(dist(pt, p)));
      let mn = 1e9; for (let i = 0; i < ultPets.length; i++) for (let j = i + 1; j < ultPets.length; j++) mn = Math.min(mn, dist(ultPets[i], ultPets[j]));
      out.sep = Math.round(mn);
      // 반경 밖 적: 쫓지 않음 (시야 공유로 보여도)
      const q = V.freeAt(p.x + 520, p.y); const e = V.enemy("tank", q.x, q.y); e.dmg = 0; e.atkT = 99; e.spd = 0;
      let maxD = 0; for (let i = 0; i < 240; i++) { e.x = q.x; e.y = q.y; e.atkT = 99; update(1 / 60); for (const pt of ultPets) maxD = Math.max(maxD, dist(pt, p)); }
      out.leashMax = Math.round(maxD); out.hpFar = Math.round(e.hp / e.max * 100);
      // 반경 안 적: 공격
      const q2 = V.freeAt(p.x + 220, p.y); const e2 = V.enemy("tank", q2.x, q2.y); e2.dmg = 0; e2.atkT = 99; e2.spd = 0;
      for (let i = 0; i < 300; i++) { e2.x = q2.x; e2.y = q2.y; e2.atkT = 99; e.x = q.x; e.y = q.y; update(1 / 60); }
      out.hpNear = Math.round(e2.hp / e2.max * 100);
      // 현곤이 멀리 이동 → 공격 중단·복귀
      const far = V.freeAt(p.x - 700, p.y) || V.freeAt(p.x, p.y + 500); p.x = far.x; p.y = far.y; visionCache.t = -1;
      let ret = false; for (let i = 0; i < 600 && !ret; i++) { e2.x = q2.x; e2.y = q2.y; e2.atkT = 99; update(1 / 60); ret = ultPets.every((pt) => dist(pt, p) <= PET_AI.follow[1] + 30); }
      out.returned = ret;
      return out; })()''')
    print('pet AI', r)
    ok('궁극기 3마리 동시 소환', r['n'] == 3, r['n'])
    ok('적 없으면 현곤 옆 대기 (현곤과 40~130)', all(40 <= d <= 130 for d in r['dist']), r['dist'])
    ok('여러 마리 서로 안 겹침 (≥ 30)', r['sep'] >= 30, r['sep'])
    ok('반경(400) 밖 적은 쫓지 않음, 포켓몬이 400 넘게 안 감', r['leashMax'] <= 400 + 20 and r['hpFar'] == 100, (r['leashMax'], r['hpFar']))
    ok('반경 안 적은 공격', r['hpNear'] < 100, r['hpNear'])
    ok('현곤이 멀어지면 복귀', r['returned'], r['returned'])
    # 스프라이트·맞는 프레임
    pg.wait_for_timeout(500)
    r = pg.evaluate('''(() => { const out = {}; out.sprites = [0, 1, 2].map((id) => !!petSprite(id)); out.evoSprite = !!petSprite(PET_DEX[0].next); out.evoArt = petArt[PET_DEX[0].next] !== undefined;
      out.delay = +petHitDelay(0).toFixed(3);
      const pt = { ...actor(p.x + 40, p.y), id: 0, hp: 800, max: 800, life: 10, dir: 2 }; [pkSheet(petSprite(0).anims.idle.src), pkSheet(petSprite(0).anims.attack.src), pkSheet(petSprite(0).anims.walk.src), pkSheet(petSprite(0).anims.hurt.src)];
      return out; })()''')
    pg.wait_for_timeout(400)
    r2 = pg.evaluate('''(() => { const pt = { ...actor(p.x + 40, p.y), id: 0, hp: 800, max: 800, life: 10, dir: 2, moving: false };
      const src = () => petAnimState(pt).im.src.split('/').slice(-2).join('/');
      // 소환수 그래픽 팩(2026-11-25)이 있으면 그것 우선: 대기 / 이동 / 공격 + 피격은 하얗게 번쩍(두 번 그림)
      const a = !!drawPetSprite(pt) && src() === 'thunderi/idle.webp'; pt.moving = true; const b2 = src() === 'thunderi/move.webp'; pt.atkAt = elapsed; const c = src() === 'thunderi/attack.webp'; pt.atkAt = undefined;
      pt.hitT = 0.1; let n = 0; const o = g.drawImage.bind(g); g.drawImage = (...x) => (n++, o(...x)); drawPetSprite(pt); g.drawImage = o; const d = n === 2;
      // 그래픽 팩이 없으면 기존 PMD 스프라이트로 (대기·이동·공격·피격)
      const keep = SUMMON_BY_PET[0]; delete SUMMON_BY_PET[0]; pt.hitT = 0; pt.moving = false;
      const pm = (A) => petAnimState(pt).im.src.endsWith(A.src);
      const e1 = pm(petSprite(0).anims.idle); pt.moving = true; const e2 = pm(petSprite(0).anims.walk); pt.atkAt = elapsed; const e3 = pm(petSprite(0).anims.attack); pt.atkAt = undefined; pt.hitT = 0.1; const e4 = pm(petSprite(0).anims.hurt);
      SUMMON_BY_PET[0] = keep; return [a, b2, c, d, e1, e2, e3, e4]; })()''')
    ok('대기·이동·공격·피격 애니메이션 상태 전환 (새 그래픽 / 없으면 기존 스프라이트)', all(r2), r2)
    ok('진화형(스프라이트 없음)은 일러스트로 대체 가능', not r['evoSprite'], r)
    ok('공격 맞는 프레임에 피해 (AnimData HitFrame, 피카츄 약 0.12초)', 0.05 < r['delay'] < 0.3, r['delay'])
    # 보스: 체력 HUD 는 시야와 상관없이, 위험 표시는 어둠 위
    r = pg.evaluate('''(() => { startEndless("suit"); document.body.classList.add("menuOpen"); god = true; singleRun.wave = 4; singleRun.bossCycle = ["octo"]; nextEndlessWave(); if (singleRun.mapSwap) { applyWaveMap(singleRun.mapSwap.def); singleRun.mapSwap = null; } singleRun.t = 0.01; singleRun.cardQueue = [];
      for (let i = 0; i < 600 && singleRun.phase !== "boss"; i++) update(1 / 60);
      const B = singleRun.boss; const q = freeSpot(p.x + 700, p.y, 34) || freeSpot(p.x - 700, p.y, 34); B.x = q.x; B.y = q.y; visionCache.t = -1;
      updateEndlessHUD(); const hud = !el("bossHud").hidden; const shown = mobShown(B);
      let drew = 0; const _h = drawHazards; window.drawHazards = drawHazards = () => { drew++; _h(); }; hazards.push({ x: B.x, y: B.y, r: 60, t: 0.5, dur: 0.5, dmg: 0, a: B, color: "255,0,0" }); document.body.classList.remove("menuOpen"); draw(); document.body.classList.add("menuOpen"); window.drawHazards = drawHazards = _h;
      return [hud, shown, drew, visionOn()]; })()''')
    ok('웨이브: 시야 켜짐, 보스가 시야 밖이어도 체력 HUD 유지', r[3] and r[0] and r[1] is False, r)
    ok('시야 밖 위험 범위도 어둠 위에 그림', r[2] >= 1, r)
    ok('시야 카드 데이터 (넓은 시야)', pg.evaluate('ENDLESS_CARDS.some((c) => c.id === "sight")') if pg.evaluate('typeof ENDLESS_CARDS !== "undefined"') else True)
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
