"""공격 모션 검수용: 무기별로 공격 순간부터 프레임을 넘기며 캐릭터 주변을 잘라 한 장으로 만든다.
사용법: python3 tools/motion_strip.py 출력.png [index.html] [바라보는 각도(라디안)]"""
import io
import pathlib
import sys

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'tests'))
from sim import INIT  # noqa: E402

out = sys.argv[1]
page_path = sys.argv[2] if len(sys.argv) > 2 else 'index.html'
ang = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
FRAMES = [0, 2, 4, 6, 8, 10, 12, 15, 18, 22]  # 1/60초 단위
rows = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_page(viewport={'width': 1200, 'height': 800})
    pg.add_init_script(INIT)
    pg.goto(pathlib.Path(page_path).resolve().as_uri())
    pg.wait_for_function('typeof assetsReady !== "undefined" && assetsReady() && !!window.__rafCb', polling=100)
    pg.evaluate("document.querySelector('#charApply').click(); freeze = true; god = true; window.__t = 0; bots.forEach(b => { b.x = 60; b.y = 60; });")
    step = "() => { window.__t += 1000/60; window.__rafCb(window.__t); }"
    box = pg.locator('#c').bounding_box()
    for w in [0, 1, 2, 3, 4, 5, 6]:
        pg.evaluate(f"p.x = 1236; p.y = 760; p.w = {0 if w == 6 else w}; p.ammo = 3; p.cd = 0; p.grenades = 3; p.grenCD = 0; p.swing = null; shots = []; fx = [];")
        for _ in range(3):
            pg.evaluate(step)
        if w == 6:
            pg.evaluate(f"throwGrenade(p, p.x + Math.cos({ang}) * 200, p.y + Math.sin({ang}) * 200)")
        else:
            pg.evaluate(f"attack(p, p.x + Math.cos({ang}) * 200, p.y + Math.sin({ang}) * 200)")
        row, done = [], 0
        for f in FRAMES:
            while done < f:
                pg.evaluate(step)
                done += 1
            pg.evaluate(step)
            done += 1
            sx = box['width'] / pg.evaluate('VW')
            cx = box['x'] + (pg.evaluate('p.x - camX')) * sx
            cy = box['y'] + (pg.evaluate('p.y - camY')) * sx
            png = pg.screenshot(clip={'x': cx - 70 * sx, 'y': cy - 85 * sx, 'width': 140 * sx, 'height': 120 * sx})
            row.append(Image.open(io.BytesIO(png)).convert('RGB').resize((140, 120)))
        rows.append(row)
    b.close()
names = ['맨손', '검', '망치', '권총', '산탄총', '저격총', '수류탄']
sheet = Image.new('RGB', (140 * len(FRAMES), 120 * len(rows)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, im in enumerate(row):
        sheet.paste(im, (c * 140, r * 120))
        d.text((c * 140 + 3, r * 120 + 2), f'{int((FRAMES[c] + 1) * 1000 / 60)}ms', fill=(255, 255, 0))
sheet.save(out)
print(out)
