"""스프라이트 시트(8×8, 96px) 검수: 칸별 불투명 영역, 발 위치, 중심, 반투명 비율, 떨어진 점 수.
사용법: python3 tools/inspect_sheet.py sheet.png [비교용 sheet.png] [미리보기.png]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']


def stats(path, cell=96):
    a = np.array(Image.open(path).convert('RGBA'))[..., 3].astype(int)
    rows = []
    for r in range(8):
        row = []
        for c in range(8):
            al = a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
            m = al > 128
            if not m.any():
                row.append(None)
                continue
            ys, xs = np.nonzero(m)
            lab, n = ndimage.label(al > 20)
            sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1)) if n else []
            stray = int(sum(1 for s in sizes if s < 30))
            semi = float(((al > 10) & (al < 245)).sum() / max(1, (al > 10).sum()))
            edge = bool(al[0, :].max() > 20 or al[-1, :].max() > 20 or al[:, 0].max() > 20 or al[:, -1].max() > 20)
            row.append(dict(foot=int(ys.max()), top=int(ys.min()), cx=float(xs.mean()), area=int(m.sum()), blobs=int(n), stray=stray, semi=round(semi, 2), edge=edge))
        rows.append(row)
    return rows


def summary(path):
    s = stats(path)
    print(path)
    for r, row in enumerate(s):
        ok = [x for x in row if x]
        if not ok:
            print(f'  {DIRS[r]:2s}: empty')
            continue
        f = [x['foot'] for x in ok]; cx = [x['cx'] for x in ok]; ar = [x['area'] for x in ok]
        print(f'  {DIRS[r]:2s}: cells={len(ok)} foot {min(f)}-{max(f)} cx {min(cx):.0f}-{max(cx):.0f} area {min(ar)}-{max(ar)} '
              f'blobs<= {max(x["blobs"] for x in ok)} stray={sum(x["stray"] for x in ok)} semi<= {max(x["semi"] for x in ok)} edge={sum(x["edge"] for x in ok)}')
    return s


def preview(paths, out):
    tiles = []
    for p in paths:
        im = Image.open(p).convert('RGBA')
        bg = Image.new('RGBA', im.size)
        px = bg.load()
        for y in range(im.height):
            for x in range(im.width):
                px[x, y] = (200, 200, 200, 255) if (x // 8 + y // 8) % 2 else (150, 150, 150, 255)
        bg.alpha_composite(im)
        d = bg.load()
        for k in range(1, 8):  # 칸 경계선
            for t in range(im.width):
                d[k * 96, t] = (255, 0, 0, 255)
                d[t, k * 96] = (255, 0, 0, 255)
        tiles.append(bg)
    w = sum(t.width for t in tiles) + 10 * (len(tiles) - 1)
    sheet = Image.new('RGBA', (w, tiles[0].height), (30, 30, 30, 255))
    x = 0
    for t in tiles:
        sheet.paste(t, (x, 0))
        x += t.width + 10
    sheet.save(out)


if __name__ == '__main__':
    for p in sys.argv[1:3]:
        if p.endswith('.png') or p.endswith('.webp'):
            summary(p)
    if len(sys.argv) > 3:
        preview(sys.argv[1:3], sys.argv[3])
