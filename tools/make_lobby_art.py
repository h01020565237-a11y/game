"""로비·상세 화면용 캐릭터 그림 만들기 (ChatGPT 전신 그림 기준).

입력: 전신 그림 폴더(예: 통합 패키지의 assets/lobby/<id>.png, 높이 512px)
처리:
  1) 배경 제거 때 어두운 부분(눈·코·발톱·머리카락 등)이 같이 지워진 '안쪽 구멍'을 메움
     - 구멍 아래 원래 색이 남아 있으면 그 색, 없으면 어두운 색(원래 지워진 부분이 어두운 색이라서)
  2) 전신: assets/lobby/<id>-full.webp (캐릭터 상세 화면용)
  3) 얼굴 아이콘: 머리 위치를 찾아 정사각형으로 잘라 256px → assets/lobby/<id>-face.webp
사용법: python3 tools/make_lobby_art.py <전신 그림 폴더>
(통합 패키지의 portraits/*.png 는 얼굴이 입 근처에서 가로로 잘려 있어 쓰지 않음)
"""
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'lobby'
IDS = ['summoner', 'bear', 'runner', 'suit', 'octo', 'stripe', 'soccer', 'support']
DARK = np.array([34, 29, 29])


def fill_holes(im, max_hole=1200):
    a = np.array(im.convert('RGBA')).astype(np.float32)
    al = a[..., 3]
    solid = al > 100
    holes = ndimage.binary_fill_holes(solid) & ~solid
    lab, n = ndimage.label(holes)
    filled = 0
    if n:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s <= max_hole])
        rgb = a[..., :3]
        has = rgb.sum(-1) > 30
        rgb[mask & ~has] = DARK
        # 메운 부분이 튀지 않게 살짝 흐린 값과 섞음
        blur = np.array(Image.fromarray(rgb.astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)
        rgb[mask] = rgb[mask] * 0.6 + blur[mask] * 0.4
        a[..., :3] = rgb
        al[mask] = 255
        filled = int(mask.sum())
    # 혼자 반투명한 점 (주변 8칸 중 6칸 이상이 불투명)
    s = (al > 200).astype(int)
    nb = sum(np.roll(np.roll(s, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    speck = (al < 230) & (nb >= 6)
    al[speck] = 255
    a[..., 3] = al
    return Image.fromarray(a.astype(np.uint8)), filled + int(speck.sum())


def face_crop(im, size=256):
    a = np.array(im)[..., 3] > 60
    ys, xs = np.nonzero(a)
    top = ys.min()
    body_h = ys.max() - top
    head = a[top: top + int(body_h * 0.40)]
    hy, hx = np.nonzero(head)
    cx = float(hx.mean())
    side = int(body_h * 0.50)
    x0, y0 = int(round(cx - side / 2)), max(0, top - int(side * 0.04))
    canvas = Image.new('RGBA', (side, side))
    canvas.paste(im.crop((x0, y0, x0 + side, y0 + side)), (0, 0))
    return canvas.resize((size, size), Image.LANCZOS)


def main(src):
    src = pathlib.Path(src)
    OUT.mkdir(parents=True, exist_ok=True)
    for k in IDS:
        im, n = fill_holes(Image.open(src / f'{k}.png'))
        im.save(OUT / f'{k}-full.webp', quality=90, method=6)
        face_crop(im).save(OUT / f'{k}-face.webp', quality=90, method=6)
        print(f'{k}: filled {n} px, full {im.size}')


if __name__ == '__main__':
    main(sys.argv[1])
