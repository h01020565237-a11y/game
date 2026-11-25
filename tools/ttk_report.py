"""measure_ttk.py 결과 두 개(변경 전/후)를 표로: python3 tools/ttk_report.py old.json new.json > docs/TTK_MEASURE.md"""
import json, sys
old, new = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
N = {'suit': '동기', 'summoner': '현곤', 'support': '은숙', 'runner': '기섭', 'octo': '상훈', 'stripe': '경수', 'soccer': '재한', 'bear': '정용'}
K = {'melee': '근접', 'ranged': '원거리', 'mobile': '기동', 'tank': '탱커', 'thrower': '투척', 'assassin': '암살', 'support': '지원', 'summoner': '소환'}
def f(x): return '-' if x is None else f'{x:.1f}'
print('# 일반 몬스터 처치 시간 측정 (2026-11-25, tools/measure_ttk.py)\n')
print('실제 엔진·실제 적 AI, 플레이어 무적·적 피해 0, 같은 조건 3번 평균. **전투 시간** = 첫 피해부터 처치까지(초), **타수** = 피해 들어간 프레임 수(기본 공격만이면 = 기본 공격 횟수에 가까움).')
print('카드: W1 없음, W5 ×1.3, W10 ×1.6, W20 ×2.2 피해 (보통 성장 가정). 체력 배율 1.1^(W-1).\n')
for w in ['1', '5', '10', '20']:
    print(f'\n## 무한 생존 W{w} — 기본 공격만: 타수 / 전투 시간(초), 변경 전 → 후\n')
    print('| 캐릭터 | ' + ' | '.join(K.values()) + ' |'); print('|' + '---|' * (len(K) + 1))
    for ch in N:
        row = []
        for k in K:
            o, n = old['endless'][ch][f'{w}:{k}']['basic'], new['endless'][ch][f'{w}:{k}']['basic']
            row.append(f"{o['hits']:.0f}타 {f(o['fight'])} → **{n['hits']:.0f}타 {f(n['fight'])}**")
        print(f'| {N[ch]} | ' + ' | '.join(row) + ' |')
    print(f'\n## 무한 생존 W{w} — 기본 공격 + 스킬: 전투 시간(초), 변경 전 → 후\n')
    print('| 캐릭터 | ' + ' | '.join(K.values()) + ' |'); print('|' + '---|' * (len(K) + 1))
    for ch in N:
        row = []
        for k in K:
            o, n = old['endless'][ch][f'{w}:{k}']['full'], new['endless'][ch][f'{w}:{k}']['full']
            row.append(f"{f(o['fight'])} → **{f(n['fight'])}**")
        print(f'| {N[ch]} | ' + ' | '.join(row) + ' |')
print('\n## 영입 미션 (미션 난이도 scaleW 고정, 카드 없음) — 기본 공격만 타수 / 기본+스킬 전투 시간(초), 변경 전 → 후\n')
for sid, d in new['story'].items():
    print(f"\n### {sid} (scaleW {d['scaleW']})\n")
    print('| 출전:적 | 기본 공격 타수 | 기본+스킬 전투 시간 |'); print('|---|---|---|')
    for key, v in d.items():
        if key == 'scaleW': continue
        o = old['story'][sid][key]; ch, k = key.split(':')
        print(f"| {N[ch]}:{K.get(k, k)} | {o['basic']['hits']:.0f} → **{v['basic']['hits']:.0f}** | {f(o['full']['fight'])} → **{f(v['full']['fight'])}** |")
