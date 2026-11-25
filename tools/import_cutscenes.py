"""영입 컷신 타임라인(ChatGPT 패키지의 timeline.json)을 게임 데이터 js/data/cutscenes.js 로 변환.

사용법: python3 tools/import_cutscenes.py docs/recruitment_pack/timeline.json
- 장면 그림: assets/cutscenes/<스토리>/<번호>.webp (패키지 scenes/ 폴더를 그대로 복사)
- 효과음: assets/audio/cutscene/<id>.wav, BGM: assets/audio/cutscene/cs_bgm.wav
- 경로는 따옴표 문자열로 하나씩 적음 (한 파일 빌드가 파일을 넣을 수 있도록)
- 연출 수치(확대량, 흔들림, 전환 시간 등)는 CUTSCENE_RULES 에서 손으로 조정 (이 스크립트는 덮어쓰지 않음)
"""
import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
tl = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
# 스토리 → 영입 보상 캐릭터 (SINGLE_MISSIONS 와 같은 id)
REWARD = {'hyeongon': 'summoner', 'eunsuk': 'support', 'giseop': 'runner', 'sanghun': 'octo', 'gyeongsu': 'stripe'}
# 원본 그림 왼쪽 위 번호/타임코드 표기 크기 (그림 픽셀). 이 영역을 UI 표시로 가림
LABEL = {'hyeongon': [196, 35], 'eunsuk': [196, 35], 'giseop': [226, 40], 'sanghun': [226, 40], 'gyeongsu': [226, 40]}
# 녹음 음성 (스토리, 장면 번호, 시작초, 화자) → 파일. 은숙: docs/recruitment_pack/eunsuk_voice_mapping.json (사용자 선택 4개, HeyGen 2개는 파일 없음 → TTS)
VOICE_FILES = {}
for e in json.loads((ROOT / 'docs/recruitment_pack/eunsuk_voice_mapping.json').read_text(encoding='utf-8')):
    if e['included'] and (ROOT / e['asset']).exists(): VOICE_FILES[('eunsuk', e['scene'], e['start'], e['speaker'])] = e['asset']
GENDER = {'donggi': 'm', 'hyeongon': 'm', 'eunsuk': 'f', 'giseop': 'm', 'sanghun': 'm', 'gyeongsu': 'm', 'church': None}
q = lambda v: json.dumps(v, ensure_ascii=False)
out = ['// ===== 영입 컷신 데이터 (tools/import_cutscenes.py 로 timeline.json 에서 생성) =====',
       '// 그림은 승인본 그대로 사용 (수정 금지). 음성·효과음은 테스트용 → 파일만 바꾸면 교체됨',
       '// voice 줄: [시작초, 화자, 대사, 녹음파일경로|null]  → 녹음 파일이 있으면 파일 재생, 없으면 브라우저 한국어 음성(임시)',
       '// sfx 줄: [시작초, 효과음 id]  motion: pan | zoom | shake | still   bgm: play | stop (stop = 즉시 끊김, 코믹 연출)',
       '']
out.append('const CUTSCENE_VOICES = {')
for k, v in tl['voices'].items():
    out.append(f'  {k}: {{ name: {q(v["name"])}, pitch: {v["pitch"]}, rate: {v["rate"]}, gender: {q(GENDER.get(k))}, prefer: [], direction: {q(v["direction"])} }},')
out.append('};')
ids = sorted({s[1] for st in tl['stories'].values() for sc in st['scenes'] for s in sc['sfx']})
out.append('// 컷신 효과음 (테스트용 합성음, 교체 가능)')
out.append('const CUTSCENE_SFX = {')
for i in ids:
    out.append(f'  {i}: {{ src: "assets/audio/cutscene/{i}.wav", vol: 0.9 }},')
out.append('};')
out.append('const CUTSCENE_BGM = { src: "assets/audio/cutscene/cs_bgm.wav", vol: 0.8 };')
out.append('const RECRUIT_STORIES = {')
for k, st in tl['stories'].items():
    out.append(f'  {k}: {{')
    out.append(f'    name: {q(st["name"])}, title: {q(st["title"])}, reward: {q(REWARD[k])}, label: {q(LABEL[k])},')
    out.append('    scenes: [')
    for i, sc in enumerate(st['scenes']):
        img = sc['image']
        assert (ROOT / 'assets/cutscenes' / img.split('/', 1)[1]).exists(), img
        voice = [[a, w, t, VOICE_FILES.get((k, i + 1, a, w))] for a, w, t in sc['voice']]
        out.append(f'      {{ img: "assets/cutscenes/{img.split("/", 1)[1]}", size: {q(sc["size"])}, t: {sc["duration"]}, motion: {q(sc["motion"])}, bgm: {q(sc["bgm"])}, '
                   f'cover: {q(sc["hideSourceTimecode"])}, unlock: {q(sc["unlock"])}, sfx: {q(sc["sfx"])}, voice: {q(voice)} }},')
    out.append('    ],')
    out.append('  },')
out.append('};')
dst = ROOT / 'js/data/cutscenes.js'
old = dst.read_text(encoding='utf-8') if dst.exists() else ''
rules = old[old.index('// ----- 연출 수치'):] if '// ----- 연출 수치' in old else '''// ----- 연출 수치 (손으로 조정, 가져오기 스크립트가 덮어쓰지 않음) -----
const CUTSCENE_RULES = {
  fit: 0.92,          // 화면 대비 그림 최대 크기 (확대해도 말풍선이 안 잘리게 여백)
  fade: 0.28,         // 장면 전환(겹쳐 사라짐) 초
  pan: { scale: 1.05, move: 0.015 },  // 천천히 옆으로 이동
  zoom: { from: 1, to: 1.085 },       // 카메라 확대
  still: { to: 1.015 },
  shake: { px: 9, dur: 0.42, scale: 1.04 }, // 화면 흔들림 (impact 효과음 시점, 없으면 장면 시작)
  shakeOn: ["impact"],
  unlockFlash: 0.35,  // 영입 화면 진입 하얀 번쩍임
  bgmStopFade: 0.03,  // BGM 끊기 (짧을수록 코믹)
  ttsFallback: true,  // 녹음 파일이 없으면 브라우저 음성으로 임시 재생
};
'''
dst.write_text('\n'.join(out) + '\n\n' + rules, encoding='utf-8')
print('wrote', dst)
