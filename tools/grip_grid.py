"""무기 쥔 위치 검수: 캐릭터(여러 명) × 8방향 × 무기를 한 장에. 손 앵커 위치에 빨간 점.
사용법: python3 tools/grip_grid.py 출력.png [캐릭터=summoner] [무기 id 목록=1,3,5]"""
import io
import math
import pathlib
import sys

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'tests'))
from sim import INIT  # noqa: E402

out = sys.argv[1]
ch = sys.argv[2] if len(sys.argv) > 2 else 'summoner'
ws = [int(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '1,2,3,4,5').split(',')]
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page(viewport={'width': 1200, 'height': 800})
    pg.add_init_script(INIT)
    pg.goto(pathlib.Path('index.html').resolve().as_uri())
    pg.wait_for_function('typeof assetsReady !== "undefined" && assetsReady() && !!window.__rafCb', polling=100)
    pg.evaluate(f"document.querySelector('#character').value='{ch}'; document.querySelector('#charApply').click(); freeze=true; god=true; window.__t=0; bots.forEach(b=>{{b.x=60;b.y=60}}); window.__showHand=true; window.__idle=" + ('true' if len(sys.argv)>4 else 'false') + ";")
    box = pg.locator('#c').bounding_box()
    rows = []
    for w in ws:
        row = []
        for d in range(8):
            ang = d * math.pi / 4 - math.pi / 2
            pg.evaluate(f"p.x=1236; p.y=760; p.w={w}; p.swing=null; p.attackAng={ang}; p.aimT=(window.__idle?0:99); p.dir={d}; p.moving=false; fx=[]; shots=[]; window.__t+=1000/60; window.__rafCb(window.__t);")
            sx = box['width'] / pg.evaluate('VW')
            cx = box['x'] + pg.evaluate('p.x-camX') * sx
            cy = box['y'] + pg.evaluate('p.y-camY') * sx
            png = pg.screenshot(clip={'x': cx - 50 * sx, 'y': cy - 70 * sx, 'width': 100 * sx, 'height': 90 * sx})
            row.append(Image.open(io.BytesIO(png)).convert('RGB').resize((200, 180)))
        rows.append(row)
    b.close()
sheet = Image.new('RGB', (200 * 8, 180 * len(rows)))
d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, im in enumerate(row):
        sheet.paste(im, (c * 200, r * 180))
        d.text((c * 200 + 4, r * 180 + 2), ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][c], fill=(255, 255, 0))
sheet.save(out)
