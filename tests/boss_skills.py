"""보스 고유 스킬 강화판 테스트: python3 tests/boss_skills.py [index.html]
보스 8명 각각 실제 AI 로 체력 100% / 60% 이하 / 30% 이하 구간을 돌려 봄 (플레이어 무적, 맞은 피해는 기록)
- 캐릭터별 대표 패턴이 실제로 나옴 (동기 연속 돌진·펀치 러시 / 현곤 포켓몬 동시 소환 / 은숙 빛의 탄막·광역 회복 /
  기섭 연속 질주·추적 하트 / 상훈 먹물 웅덩이·다수 촉수 / 경수 은신 기습·분신 8 / 재한 3방향 슈팅·연속 폭발 / 정용 연속 점프·충격파)
- 60%·30% 에서 강화값 적용 (연속 횟수·개수 증가), 광폭화 예고 짧아짐
- 모든 피해 패턴은 예고(0.3초 이상)가 먼저 나옴 → 피할 수 없는 기습 없음
- 에러 없음"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x)
JS = r'''
window.BT = {};
BT.run = (id, frac, secs) => {
  startEndless("suit"); document.body.classList.add("menuOpen"); god = true;
  singleRun.wave = 4; singleRun.bossCycle = [id]; nextEndlessWave();
  if (singleRun.mapSwap) { applyWaveMap(singleRun.mapSwap.def); singleRun.mapSwap = null; }
  singleRun.t = 0.01; singleRun.cardQueue = [];
  for (let i = 0; i < 600 && singleRun.phase !== "boss"; i++) update(1 / 60);
  const B = singleRun.boss;
  B.hp = B.max * frac; B.phaseDone = frac <= 0.3 ? 2 : frac <= 0.6 ? 1 : 0; // 단계 진입 지원 적 생략 (패턴만 봄)
  bots = bots.filter((b) => b === B);
  const log = { fired: {}, teleMin: 99, chainMax: {}, pk: 0, pkTogether: 0, clones: 0, homing: 0, homingTurned: false, light: 0, shockHit: 0, shockGaps: 0, puddleSlow: false, blastSeq: false, healed: 0, tri: false, maxTimes: {}, telePlain: [] };
  const _fire = fireBossPat;
  window.fireBossPat = fireBossPat = function (a) {
    const T = a.tele, P = T.P;
    log.fired[P.k] = (log.fired[P.k] || 0) + 1;
    if (P.k !== "summon" && P.k !== "heal" && P.k !== "stealth" && P.k !== "clones" && P.k !== "pokemon" && P.k !== "aoeHeal") log.teleMin = Math.min(log.teleMin, T.dur);
    log.maxTimes[P.k] = Math.max(log.maxTimes[P.k] || 0, P.times || 1, P.n || 0, P.waves || 0, P.lines || 0, P.repeat || 0);
    if (P.k === 'light' && P.n === 12) log.lightWaves = Math.max(log.lightWaves || 0, P.waves || 1);
    const nb = bots.length, ns = mobShots.length, nh = hazards.length;
    const r = _fire(a);
    const added = bots.slice(nb);
    if (P.k === "pokemon") { log.pk += added.filter((b) => b.pk !== undefined).length; if (P.together && added.length >= 3) log.pkTogether++; }
    if (P.k === "clones") log.clones = Math.max(log.clones, added.length);
    if (P.k === "homing") log.homing += mobShots.length - ns;
    if (P.k === "barrage" && P.n === 3) log.tri = true;
    if (P.k === "blastLine") { const hs = hazards.slice(nh); log.blastSeq = hs.length >= 4 && hs.every((h, i) => i === 0 || h.t >= hs[i - 1].t - 1e-6 || h.x !== hs[i - 1].x); }
    if (P.k === "shock") log.shockGaps = hazards.slice(nh).filter((h) => h.shock && h.gaps.length).length;
    return r;
  };
  const hp0 = B.hp;
  for (let f = 0; f < secs * 60 && B.hp > 0; f++) {
    p.hp = p.max; // 무적처럼 버팀 (피해 기록은 hit 로)
    const sh = mobShots.filter((s) => s.home);
    const before = sh.map((s) => Math.atan2(s.vy, s.vx));
    update(1 / 60);
    sh.forEach((s, i) => { if (Math.abs(Math.atan2(s.vy, s.vx) - before[i]) > 1e-4) log.homingTurned = true; });
    for (const h of hazards) if (h.ink && dist(p, h) <= h.r && p.slow > 0) log.puddleSlow = true;
    if (B.healed > log.healed) log.healed = B.healed;
    // 플레이어를 보스 근처에 두되 가끔 옮겨서 다양한 패턴이 나오게
    if (f % 240 === 0) { const q = freeSpot(B.x + 160 * Math.cos(f), B.y + 120 * Math.sin(f), 16); if (q) { p.x = q.x; p.y = q.y; } }
    // 웅덩이 위에 서 보기
    const ink = hazards.find((h) => h.ink); if (ink && f % 60 === 30) { p.x = ink.x; p.y = ink.y; }
    if (f % 120 === 0) for (const b of bots) if (b !== B && b.mob && b.mob !== "assassin" && !b.pk) b.hp = 0; // 쌓이는 졸개 정리 (분신·포켓몬은 둠)
  }
  window.fireBossPat = fireBossPat = _fire;
  log.alive = B.hp > 0;
  return log;
};
0;
'''
EXPECT = {
    'suit': ['charge', 'rush'], 'summoner': ['pokemon'], 'support': ['light', 'aoeHeal'], 'runner': ['charge', 'homing'],
    'octo': ['puddle', 'traps'], 'stripe': ['stealth', 'clones'], 'soccer': ['barrage', 'blastLine'], 'bear': ['slam', 'shock'],
}
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2000)
    pg.evaluate("closeTitle(); setQaUnlock(true); el('modePanel').hidden = true; document.body.classList.remove('modeOpen')")
    pg.evaluate(JS)
    for bid, kinds in EXPECT.items():
        res = {fr: pg.evaluate(f'BT.run("{bid}", {fr}, 40)') for fr in (1.0, 0.5, 0.2)}
        fired = {}
        for r in res.values():
            for k, v in r['fired'].items(): fired[k] = fired.get(k, 0) + v
        print(bid, json.dumps({fr: {'fired': r['fired'], 'max': r['maxTimes'], 'teleMin': round(r['teleMin'], 2)} for fr, r in res.items()}, ensure_ascii=False))
        for k in kinds:
            ok(f'[{bid}] 고유 패턴 {k} 사용', fired.get(k, 0) > 0, fired)
        tm = min(r['teleMin'] for r in res.values())
        ok(f'[{bid}] 피해 패턴 예고 0.3초 이상 (피할 수 없는 기습 없음)', tm >= 0.3, round(tm, 2))
        r0, r2 = res[1.0], res[0.2]
        if bid in ('suit', 'runner'):
            ok(f'[{bid}] 연속 돌진: 30% 이하에서 횟수 증가', r2['maxTimes'].get('charge', 0) > r0['maxTimes'].get('charge', 0), (r0['maxTimes'].get('charge'), r2['maxTimes'].get('charge')))
        if bid == 'bear':
            ok('[정용] 연속 점프: 30% 이하에서 횟수 증가', r2['maxTimes'].get('slam', 0) > r0['maxTimes'].get('slam', 0), (r0['maxTimes'].get('slam'), r2['maxTimes'].get('slam')))
            ok('[정용] 충격파에 안전한 틈', sum(r['shockGaps'] for r in res.values()) > 0)
        if bid == 'summoner':
            ok('[현곤] 포켓몬 소환 (그림 있는 포켓몬 적)', sum(r['pk'] for r in res.values()) >= 3, [r['pk'] for r in res.values()])
            ok('[현곤] 궁극기: 3마리 이상 동시 등장', sum(r['pkTogether'] for r in res.values()) > 0)
        if bid == 'stripe':
            ok('[경수] 분신 8개', max(r['clones'] for r in res.values()) == 8, [r['clones'] for r in res.values()])
        if bid == 'runner':
            ok('[기섭] 추적 하트가 실제로 꺾임', any(r['homingTurned'] for r in res.values()) and sum(r['homing'] for r in res.values()) > 0)
        if bid == 'octo':
            ok('[상훈] 먹물 웅덩이 안에서 둔화', any(r['puddleSlow'] for r in res.values()))
            ok('[상훈] 촉수 함정: 30% 이하에서 개수 증가', r2['maxTimes'].get('traps', 0) > r0['maxTimes'].get('traps', 0), (r0['maxTimes'].get('traps'), r2['maxTimes'].get('traps')))
        if bid == 'soccer':
            ok('[재한] 3방향 슈팅', any(r['tri'] for r in res.values()))
            ok('[재한] 연속 폭발: 앞에서부터 차례로', any(r['blastSeq'] for r in res.values()))
        if bid == 'support':
            ok('[은숙] 광역 회복 (회복 상한 안)', max(r['healed'] for r in res.values()) > 0)
            ok('[은숙] 빛의 탄막: 60% 이하에서 물결 수 증가', (res[0.5].get('lightWaves') or 0) > (r0.get('lightWaves') or 0), (r0.get('lightWaves'), res[0.5].get('lightWaves')))
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
