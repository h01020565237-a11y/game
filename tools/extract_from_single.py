"""한 번만 쓰는 도구: 단일 index.html(V1.4)을 분리 구조로 풀어낸다.
사용법: python3 tools/extract_from_single.py <원본 index.html> <포맷된 js> <포맷된 css> <출력 폴더>
포맷된 js/css 는 esbuild 로 원본을 다시 출력한 것 (의미 변화 없음)."""
import base64, re, sys, pathlib

src, fmt_js, fmt_css, out = sys.argv[1:5]
out = pathlib.Path(out)
s = open(src, encoding='utf-8').read()

ASSETS = [  # 원본 등장 순서 그대로
    ('img', 'assets/characters/summoner-hd.webp'),
    ('bearImg', 'assets/characters/bear.webp'),
    ('runnerImg', 'assets/characters/runner-dir.webp'),
    ('extra_suit', 'assets/portraits/suit.webp'),
    ('extra_octo', 'assets/portraits/octo.webp'),
    ('extra_stripe', 'assets/portraits/stripe.webp'),
    ('extra_soccer', 'assets/portraits/soccer.webp'),
    ('extra_support', 'assets/portraits/support.webp'),
    ('sheet_suit', 'assets/characters/suit-sheet.webp'),
    ('sheet_octo', 'assets/characters/octo-sheet.webp'),
    ('sheet_stripe', 'assets/characters/stripe-sheet.png'),
    ('sheet_soccer', 'assets/characters/soccer-sheet.webp'),
    ('sheet_support', 'assets/characters/support-sheet.webp'),
    ('sheet_summoner', 'assets/characters/summoner-sheet.webp'),
    ('sheet_runner', 'assets/characters/runner-sheet.webp'),
    ('crate', 'assets/props/crate.webp'),
    ('jungle', 'assets/maps/jungle.webp'),
]
uris = re.findall(r'data:image/([a-z]+);base64,([A-Za-z0-9+/=]+)', s)
assert len(uris) == len(ASSETS)
for (ext, b64), (_, path) in zip(uris, ASSETS):
    assert path.endswith('.' + ext), path
    f = out / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(base64.b64decode(b64))

water = re.search(r'atob\("([^"]+)"\)', s).group(1)

js = open(fmt_js, encoding='utf-8').read()
for key, path in ASSETS:
    js = js.replace(f'"__ASSET_{key}__"', f'"{path}"')
assert '__ASSET_' not in js
L = js.split('\n')

def lines(a, b):  # 1-based inclusive
    return '\n'.join(L[a - 1:b]) + '\n'

def find(prefix, start=1):
    for i in range(start - 1, len(L)):
        if L[i].startswith(prefix):
            return i + 1
    raise KeyError(prefix)

def end_of(start):  # 최상위 블록 끝 줄
    for i in range(start - 1, len(L)):
        if L[i] in ('}', '};'):
            return i + 1
    raise KeyError(start)

n = {k: find(k) for k in [
    'function renderActor', 'const crateArt', 'const waterBits', 'let character', 'const weapons',
    'const rivers', 'let camX', 'const mons', 'let flight', 'const ui =', 'function summon',
    'function reset', 'reset();', 'onkeydown', 'function blocked', 'function hit', 'function tackleInput',
    'const extraNames', 'function throwOcto', 'function update', 'function ball', 'const ground',
    'buildGround();', 'function bar', 'const touchMode', 'function loop']}

def w(path, header, body):
    f = out / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(header.rstrip() + '\n\n' + body.rstrip() + '\n', encoding='utf-8')

# ---- data ----
walls_line = L[n['const rivers'] - 1]
m = re.match(r'const rivers = \[\], walls = (\[.*\]), bushes = (\[.*\]);$', walls_line)
reset_body = lines(n['function reset'], end_of(n['function reset']))
bot_sp = re.search(r'bots = (\[\[.*?\]\])\.map', reset_body).group(1)
crates = re.search(r'boxes = (\[\[.*?\]\])\.map', reset_body).group(1)
w('js/data/maps/jungle.js', '// 맵 데이터: 정글 (ChatGPT·Claude 공동 관리)\n// walls/bushes: [x, y, w, h], crates: [x, y], 좌표는 월드 픽셀',
  'const MAP_JUNGLE = {\n'
  '  id: "jungle",\n'
  '  width: 2472,\n'
  '  height: 1392,\n'
  '  background: "assets/maps/jungle.webp",\n'
  '  walls: ' + m.group(1) + ',\n'
  '  bushes: ' + m.group(2) + ',\n'
  '  crates: ' + crates + ',\n'
  '  playerSpawn: [220, 190],\n'
  '  botSpawns: ' + bot_sp + ',\n'
  '  // 물 비트맵: 6px 칸, 가로 412칸, 1비트 = 통과 불가\n'
  '  water: { cell: 6, cols: 412, cells: 95584, bits: "' + water + '" }\n'
  '};')
w('js/data/combat.js', '// 무기: [이름, 데미지, 쿨타임(초), 사거리], angles: 근접/표시용 부채꼴 각도(도)\n// 장비 id: 0 운동화, 1 방탄조끼, 2 장갑, 3 목걸이, 4 손목시계, 5 흡혈 반지',
  lines(n['const weapons'], n['const rivers'] - 1))
w('js/data/pets.js', '// 포켓몬: [이름, 아이콘, 공격력, 사거리, HP]', lines(n['const mons'], n['const mons']))
w('js/data/characters.js', '// 캐릭터별 스킬 이름 [스킬1, 스킬2] (소환사·곰·러너는 코드에 직접 정의)',
  lines(n['const extraNames'], n['const extraNames']))

# ---- engine ----
w('js/engine/assets.js', '// 캔버스와 이미지 로딩', (lines(1, n['function renderActor'] - 1) + lines(n['const crateArt'], n['const waterBits'] - 1))
  .replace('jungle.src = "assets/maps/jungle.webp";', 'jungle.src = MAP_JUNGLE.background;'))
core = lines(n['const waterBits'], n['const weapons'] - 1) + \
       'const rivers = [], walls = MAP_JUNGLE.walls, bushes = MAP_JUNGLE.bushes;\n' + \
       lines(n['let camX'], n['const mons'] - 1) + lines(n['function blocked'], n['function hit'] - 1)
core = core.replace('atob("__WATER__")', 'atob(MAP_JUNGLE.water.bits)')
core = core.replace('const W = 2472, H = 1392,', 'const W = MAP_JUNGLE.width, H = MAP_JUNGLE.height,')
w('js/engine/world.js', '// 월드: 전역 상태, 지형/충돌, 이동', core)
w('js/engine/input.js', '// 키보드·마우스 입력', lines(n['onkeydown'], n['function blocked'] - 1))

# ---- game ----
w('js/game/pets.js', '// 소환사: 소환·교체·펫 기술', lines(n['let flight'], n['const ui ='] - 1) + lines(n['function summon'], n['function reset'] - 1))
reset_new = reset_body.replace(bot_sp + '.map', 'MAP_JUNGLE.botSpawns.map').replace(crates + '.map', 'MAP_JUNGLE.crates.map')
reset_new = reset_new.replace('p = actor(220, 190);', 'p = actor(...MAP_JUNGLE.playerSpawn);')
w('js/game/state.js', '// 라운드 초기화', reset_new)
w('js/game/combat.js', '// 전투: 피해 계산, 아이템 획득, 공격', lines(n['function hit'], n['function tackleInput'] - 1))
w('js/game/skills.js', '// 캐릭터 스킬', lines(n['function tackleInput'], n['const extraNames'] - 1) + lines(n['function throwOcto'], n['function update'] - 1))
w('js/game/update.js', '// 한 프레임 게임 로직 (자기장, 상태이상, 펫, 플레이어, 봇 AI, 투사체)', lines(n['function update'], n['function ball'] - 1))

# ---- render ----
w('js/render/effects.js', '// 이펙트 그리기: 몬스터볼, 피카츄, 번개', lines(n['function ball'], n['const ground'] - 1))
w('js/render/background.js', '// 정글 이미지가 없을 때 쓰는 대체 배경', lines(n['const ground'], n['buildGround();'] - 1))
w('js/render/renderer.js', '// 화면 그리기와 HUD', lines(n['function renderActor'], n['const crateArt'] - 1) + lines(n['function bar'], n['const touchMode'] - 1))

# ---- ui ----
w('js/ui/deck.js', '// 소환사 덱 편집 UI', lines(n['const ui ='], n['function summon'] - 1))
w('js/ui/touch.js', '// 모바일 터치 조작', lines(n['const touchMode'], n['function loop'] - 1))
w('js/main.js', '// 시작과 메인 루프', 'reset();\nbuildGround();\n' + lines(n['function loop'], len(L)))

# ---- css / html ----
(out / 'css').mkdir(exist_ok=True)
(out / 'css/game.css').write_text(open(fmt_css, encoding='utf-8').read(), encoding='utf-8')
print('ok')
