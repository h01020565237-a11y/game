"""PMDCollab(SpriteCollab) 포켓몬 스프라이트 → 소환체 인게임 스프라이트
사용: python3 -I tools/import_pmd_sprites.py <종별 폴더들이 든 폴더(0025, 0004 ...)>
- 그림: assets/pokemon/summons/<도감번호>/<Idle|Walk|Attack|Hurt>-Anim.png + credits.txt (assets/pokemon/ 은 .gitignore: 공개 저장소에 안 올림)
- 데이터: js/data/pokemon_sprites.js (경로·프레임 크기·재생 시간·발 위치만. 그림은 안 들어감)
- AnimData.xml: FrameWidth/Height, Durations(1/60초 단위), HitFrame. 행 = 8방향 (아래, 오른아래, 오른, 오른위, 위, 왼위, 왼, 왼아래)
- 발 위치: Shadow.png 의 그림자 점 중심 (프레임마다)
권리: SpriteCollab 커뮤니티 제작분 CC BY-NC 4.0 (출처 표시), 원작 포켓몬/춘소프트 권리는 별도 → 로컬 테스트 전용"""
import json, os, shutil, sys
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
src = sys.argv[1]
ANIMS = {'idle': 'Idle', 'walk': 'Walk', 'attack': 'Attack', 'hurt': 'Hurt'}
out = {}
for d in sorted(os.listdir(src)):
    path = os.path.join(src, d)
    if not (os.path.isdir(path) and d.isdigit()):
        continue
    dex = int(d)
    dst = f'assets/pokemon/summons/{dex}'
    os.makedirs(dst, exist_ok=True)
    root = ET.parse(os.path.join(path, 'AnimData.xml')).getroot()
    byname = {a.findtext('Name'): a for a in root.iter('Anim')}
    sp = {'credits': open(os.path.join(path, 'credits.txt'), encoding='utf-8-sig').read().strip().split('\t')[1:3], 'anims': {}}
    for key, name in ANIMS.items():
        a = byname[name]
        if a.find('CopyOf') is not None:
            a = byname[a.findtext('CopyOf')]
            name = a.findtext('Name')
        fw, fh = int(a.findtext('FrameWidth')), int(a.findtext('FrameHeight'))
        dur = [int(x.text) for x in a.iter('Duration')]
        shutil.copyfile(os.path.join(path, f'{name}-Anim.png'), f'{dst}/{name}-Anim.png')
        sh = np.array(Image.open(os.path.join(path, f'{name}-Shadow.png')).convert('RGBA'))
        rows = sh.shape[0] // fh
        anchors = []
        for r in range(rows):
            row = []
            for f in range(len(dur)):
                cell = sh[r * fh:(r + 1) * fh, f * fw:(f + 1) * fw, 3]
                ys, xs = np.nonzero(cell)
                row.append([round(float(xs.mean()), 1), round(float(ys.mean()), 1)] if len(xs) else [fw / 2, fh * 0.75])
            anchors.append(row)
        A = {'src': f'{dst}/{name}-Anim.png', 'fw': fw, 'fh': fh, 'dur': dur, 'dirs': rows, 'feet': anchors}
        if a.findtext('HitFrame'):
            A['hit'] = int(a.findtext('HitFrame'))
        sp['anims'][key] = A
    shutil.copyfile(os.path.join(path, 'credits.txt'), f'{dst}/credits.txt')
    out[dex] = sp
    print('ok', dex, {k: (v['fw'], v['fh'], len(v['dur'])) for k, v in sp['anims'].items()})
txt = '// 자동 생성: tools/import_pmd_sprites.py — 소환 포켓몬 인게임 스프라이트 (PMDCollab SpriteCollab)\n'
txt += '// 그림 파일은 assets/pokemon/summons/<도감번호>/ (공개 저장소 제외, 로컬 테스트 전용 — CC BY-NC 4.0 + 원작 권리 미확인)\n'
txt += '// 같은 방식으로 폴더만 추가하면 진화·전설도 자동 연결 (없는 포켓몬은 공식 일러스트 1장으로 표시)\n'
txt += '// dur: 프레임별 시간(1/60초), feet: [방향][프레임] 발(그림자) 위치, hit: 공격이 맞는 프레임\n'
txt += 'const POKEMON_SPRITES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('js/data/pokemon_sprites.js', 'w', encoding='utf-8').write(txt)
