"""일반 몬스터 처치 시간(TTK) 측정: python3 tools/measure_ttk.py [index.html] [출력 json]
- 실제 무한 생존/영입 미션 엔진에서 적 1마리를 실제 AI 로 움직이게 두고 (플레이어 무적, 적 공격 피해 0)
  자동 조작 플레이어가 잡는 시간을 잼. 게임 루프 멈추고 update(1/60) 직접 (같은 조건 반복)
- 자동 조작: 적 쪽으로 이동해 사거리 85% 유지, 기본 공격(자동 조준), 스킬 모드면 Q/E 쿨마다 적에게, 현곤은 포켓몬 소환
- 두 가지: basic = 기본 공격만 / full = 기본 공격 + 스킬 (궁극기 제외)
- 웨이브 배율: 체력 1.1^(W-1). 카드: W 별 '보통 성장' 가정 피해 배율 (CARD_MUL, 아래)
- 같은 조건 3번 평균 (적 등장 각도 다르게)"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/ttk.json'
url = pathlib.Path(f).resolve().as_uri()
CH = ['suit', 'summoner', 'support', 'runner', 'octo', 'stripe', 'soccer', 'bear']
KINDS = ['melee', 'ranged', 'mobile', 'tank', 'thrower', 'assassin', 'support', 'summoner']
# 웨이브별 '보통 성장' 가정: 그 웨이브까지 고른 공격력·공속 카드 효과를 합친 피해 배율 (제안값, 측정 결과 아님)
CARD_MUL = {1: 1.0, 5: 1.3, 10: 1.6, 20: 2.2}
JS = r'''
window.K = {};
K.run = (ch, kind, wave, mode, mul, ang, scaleW) => {
  startEndless(ch); document.body.classList.add("menuOpen"); god = true;
  const R = singleRun;
  if (scaleW) R.story = { scaleW, stages: [] }; // 영입 미션 난이도 (scaleW 고정)
  R.wave = wave; R.phase = "fight"; R.plan = 0; R.spawned = 0; R.timer = 999; R.spec = { kinds: ["melee"], count: 0 };
  bots = []; mobShots = []; hazards = []; shots = []; pet = null; flight = null; ultPets = []; clones = [];
  if (scaleW) { R.story = null; }
  p.x = W / 2; p.y = H / 2 + 60; p.dmgMul = mul; p.hp = p.max;
  const q = freeSpot(p.x + Math.cos(ang) * 260, p.y + Math.sin(ang) * 200, 22);
  const sc = scaleW ? waveScale(scaleW) : waveScale(wave);
  const e = makeEnemy(kind, q, { noExp: true });
  if (scaleW) { e.hp = e.max = ENEMY_TYPES[kind].hp * sc.hp; }
  e.spawnT = 0; e.dmg = 0;
  const hp0 = e.max;
  let t = 0, hits = 0, first = -1;
  const _hit = window.hit;
  for (let f = 0; f < 60 * 60 && e.hp > 0; f++) {
    // 적 공격 무력화 (측정 대상은 처치 시간)
    e.atkT = Math.max(e.atkT, 0.5); mobShots = []; hazards = [];
    for (const b of bots) if (b !== e && b.mob === "minion") b.hp = 0; // 소환형이 부른 졸개는 제외 (본체 TTK)
    const d = dist(p, e), rng = attackRange(p);
    const want = Math.max(40, rng * 0.85);
    const dx = e.x - p.x, dy = e.y - p.y, n = Math.hypot(dx, dy) || 1;
    if (d > want) { mvX = dx / n; mvY = dy / n; } else if (d < want * 0.5 && rng > 150) { mvX = -dx / n; mvY = -dy / n; } else { mvX = 0; mvY = 0; }
    aiming = true;
    if (mode === "full") {
      for (const s of ["q", "e"]) if (skillCdLeft(s) <= 0 && d < 260) castSkill(s, { x: e.x, y: e.y });
      if (character === "summoner" && !pet && !flight && summonCD[selected] <= 0 && d < 300) { mouse.x = e.x; mouse.y = e.y; summon(); }
      if (character === "runner") p.energy = Math.max(p.energy, 60);
    }
    p.ult = 0;
    const before = e.hp;
    update(1 / 60);
    if (e.hp < before) { hits++; if (first < 0) first = t; }
    t += 1 / 60;
  }
  aiming = false; mvX = mvY = 0;
  return { t: e.hp > 0 ? null : +t.toFixed(2), fight: e.hp > 0 ? null : +(t - Math.max(0, first)).toFixed(2), hp: Math.round(hp0), hits };
};
0;
'''
def main():
    out = {'endless': {}, 'story': {}}
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = b.new_context(viewport={'width': 844, 'height': 390}).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url); pg.wait_for_timeout(2000)
        pg.evaluate('closeTitle(); setQaUnlock(true); el("modePanel").hidden = true; document.body.classList.remove("modeOpen")')
        pg.evaluate(JS)
        angs = [0.3, 2.4, 4.4]
        def avg(ch, kind, wave, mode, mul, scaleW=0):
            rs = [pg.evaluate(f'K.run("{ch}", "{kind}", {wave}, "{mode}", {mul}, {a}, {scaleW})') for a in angs]
            ts = [r['t'] for r in rs if r['t'] is not None]
            fs = [r['fight'] for r in rs if r['fight'] is not None]
            return {'t': round(sum(ts) / len(ts), 2) if ts else None, 'fight': round(sum(fs) / len(fs), 2) if fs else None, 'hits': round(sum(r['hits'] for r in rs) / len(rs), 1), 'hp': rs[0]['hp'], 'fail': len(rs) - len(ts)}
        for ch in CH:
            out['endless'][ch] = {}
            for w in CARD_MUL:
                for kind in KINDS:
                    out['endless'][ch][f'{w}:{kind}'] = {m: avg(ch, kind, w, m, CARD_MUL[w] if w > 1 else 1) for m in ('basic', 'full')}
            print(ch, 'endless done', flush=True)
        # 영입 미션: 미션별 출전 캐릭터 × 그 미션에 나오는 적 유형, scaleW 고정, 카드 없음
        story = pg.evaluate('Object.entries(STORY_MISSIONS).map(([id, S]) => [id, S.scaleW, [...new Set(S.stages.flatMap((st) => st.kinds === "all" ? ENDLESS_ALL_KINDS : st.kinds || []))].filter((k) => ENEMY_TYPES[k] && ENEMY_TYPES[k].hp), STORY_ORDER.find((m) => m.id === id).players])')
        for sid, sw, kinds, players in story:
            out['story'][sid] = {'scaleW': sw}
            for ch in players:
                for kind in kinds:
                    out['story'][sid][f'{ch}:{kind}'] = {m: avg(ch, kind, 1, m, 1, sw) for m in ('basic', 'full')}
            print(sid, 'story done', flush=True)
        out['errors'] = errs[:5]
        b.close()
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
    print('saved', OUT, 'errors', out['errors'])
main()
