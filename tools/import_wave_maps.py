"""웨이브 맵 V2 + 현곤 경기장 → js/data/wave_maps.js

사용: python3 -I tools/import_wave_maps.py <Juyeop_Wave_Maps_V2 폴더> <Juyeop_Hyeongon_Arena_V1 폴더>
- 맵 그림은 assets/maps/wave/<id>.webp (별도로 변환해 둠)
- 플레이 영역(bounds) 밖은 경계 벽, 경기장의 사다리꼴 영역은 계단식 직사각형 벽으로 바꿈 (엔진이 사각형 충돌만 지원)
"""
import json, math, sys, os

wm_dir, ar_dir = sys.argv[1], sys.argv[2]
wm = json.load(open(os.path.join(wm_dir, "maps.json"), encoding="utf-8"))
ar = json.load(open(os.path.join(ar_dir, "arena.json"), encoding="utf-8"))


def rects(obs):
    return [[o["x"], o["y"], o["width"], o["height"]] for o in obs if o.get("blocksMovement", True)]


def border(w, h, l, t, r, b):
    # 플레이 영역 밖 4면 벽 (겹쳐도 무방)
    return [[0, 0, w, t], [0, b, w, h - b], [0, 0, l, h], [r, 0, w - r, h]]


maps = []
for m in wm["maps"]:
    w, h = m["size"]["width"], m["size"]["height"]
    B = m["bounds"]
    maps.append({
        "id": m["id"], "name": m["name"], "sub": m["sub"], "width": w, "height": h,
        "background": f"assets/maps/wave/{m['id']}.webp",
        "walls": border(w, h, B["left"], B["top"], B["right"], B["bottom"]) + rects(m["obstacles"]),
        "playerSpawn": m["playerSpawn"], "bossSpawn": m["bossSpawn"], "enemySpawns": m["enemySpawns"],
        "spawnMin": m.get("spawnMinDistanceFromPlayer", 240),
    })

# 경기장: 사다리꼴 [[249,276],[1420,276],[1532,831],[137,831]] → 위·아래 벽 + 좌우 계단 벽
w, h = ar["size"]["width"], ar["size"]["height"]
poly = ar["playablePolygon"]
top, bot = poly[0][1], poly[2][1]
tl, tr, br, bl = poly
walls = [[0, 0, w, top], [0, bot, w, h - bot]]
STEP = 37  # 띠 높이: 보수적으로 띠 안에서 가장 좁은 쪽 경계를 씀
y = top
while y < bot:
    y2 = min(bot, y + STEP)
    f = (y - top) / (bot - top)  # 위쪽이 더 좁음 → 띠 윗변 기준이 보수적
    lx = tl[0] + (bl[0] - tl[0]) * f
    rx = tr[0] + (br[0] - tr[0]) * f
    walls.append([0, y, math.ceil(lx), y2 - y])
    walls.append([math.floor(rx), y, w - math.floor(rx), y2 - y])
    y = y2
walls += rects(ar["obstacles"])
arena = {
    "id": "hyeongon_stadium", "name": ar["name"], "sub": "현곤 보스 전용", "width": w, "height": h,
    "background": "assets/maps/wave/hyeongon_stadium.webp", "walls": walls,
    "playerSpawn": ar["playerSpawn"], "bossSpawn": ar["bossSpawn"], "enemySpawns": ar["enemySpawns"], "spawnMin": 240,
}

out = "// 자동 생성: tools/import_wave_maps.py (Juyeop_Wave_Maps_V2 + Juyeop_Hyeongon_Arena_V1). 직접 고치지 말고 원본 JSON 수정 후 다시 생성\n"
out += "// 무한 생존 전용 맵. 스토리 미션·PvP는 정글 맵 그대로\n"
out += "// 순환: cycle[Math.floor(wave / 5) % cycle.length], 현곤 보스 웨이브만 경기장(arenaBoss)\n"
out += "const WAVE_MAPS = " + json.dumps({m["id"]: m for m in maps + [arena]}, ensure_ascii=False) + ";\n"
out += "const WAVE_MAP_RULES = " + json.dumps({"cycle": wm["cycle"], "every": 5, "arena": "hyeongon_stadium", "arenaBoss": "summoner", "fadeOut": 0.4, "fadeIn": 0.5, "nameBanner": 2.2}, ensure_ascii=False) + ";\n"
open("js/data/wave_maps.js", "w", encoding="utf-8").write(out)
print("ok", len(maps) + 1, "maps")
