"""로비(캐릭터 선택)용 이미지 생성.

이동 시트의 정면(S) 서 있는 프레임을 잘라서
- 계단 현상 정리(알파 가장자리 부드럽게, 떨어진 점 제거)
- 고품질 확대(Lanczos)
- 얼굴 아이콘은 머리의 실제 위치를 찾아 가운데 정렬
해서 assets/lobby/<id>-stand.webp(서 있는 모습), <id>-face.webp(얼굴 아이콘)으로 저장한다.
고해상도 로비 그림이 따로 오면 이 파일들만 교체하면 됨.
사용법: python3 tools/make_lobby_art.py
"""
import pathlib

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'lobby'
# (시트 파일, 칸 크기, 정면 행, 서 있는 프레임 열)
SRC = {
    'summoner': ('summoner-hd.webp', 128, 4, 0),  # 소환사는 128px 고해상도 시트가 있음
    'bear': ('bear.webp', 80, 0, 4),               # 곰: 한 줄 8방향, 정면은 4번 칸
    'runner': ('runner-sheet.webp', 96, 4, 0),
    'suit': ('suit-sheet-fixed.webp', 96, 4, 0),  # 안쪽 구멍 복구본 (tools/fix_sheet_holes.py)
    'octo': ('octo-sheet.webp', 96, 4, 0),
    'stripe': ('stripe-run-sheet.webp', 96, 4, 0),
    'soccer': ('soccer-sheet.webp', 96, 4, 0),
    'support': ('support-sheet.webp', 96, 4, 0),
}


def clean(im):
    a = np.array(im).astype(np.float32)
    al = a[..., 3]
    lab, n = ndimage.label(al > 24)
    if n:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= max(12, sizes.max() * 0.01)])
        al[~ndimage.binary_dilation(keep, iterations=1)] = 0
    a[..., 3] = al
    return Image.fromarray(a.astype(np.uint8))


def round_cut_edge(im, max_ext=5):
    """원본 그림이 칸 경계에서 세로로 잘린 경우(곰 정면): 잘린 쪽 가장자리를 반대편을 비춰 몇 px 둥글게 채움"""
    a = np.array(im)
    al = a[..., 3] > 100
    h, w = al.shape
    ys, xs = np.nonzero(al[: int(h * 0.35)])
    c = int(round(xs.mean()))
    for y in range(h):
        row = np.nonzero(al[y])[0]
        if len(row) < 2:
            continue
        xl, xr = row[0], row[-1]
        if (c - xl) - (xr - c) > 3:  # 오른쪽이 왼쪽보다 짧게 끊김
            for k in range(1, max_ext + 1):
                x, mx = xr + k, 2 * c - (xr + k)
                if x >= w or mx < 0 or not al[y, mx]:
                    break
                a[y, x] = a[y, mx]
    return Image.fromarray(a)


def upscale(im, h):
    """알파 가장자리 계단을 줄이며 확대: 프리멀티플라이 후 Lanczos, 알파만 살짝 부드럽게"""
    a = np.array(im).astype(np.float32) / 255
    rgb = a[..., :3] * a[..., 3:4]
    pm = Image.fromarray((np.dstack([rgb, a[..., 3:4]]) * 255).astype(np.uint8), 'RGBA')
    w = round(im.width * h / im.height)
    big = pm.resize((w, h), Image.LANCZOS)
    b = np.array(big).astype(np.float32) / 255
    al = np.array(Image.fromarray((b[..., 3] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    al = np.clip((al - 0.04) / 0.92, 0, 1)  # 흐려진 가장자리를 다시 또렷하게
    rgb = np.where(b[..., 3:4] > 1e-3, b[..., :3] / np.maximum(b[..., 3:4], 1e-3), 0)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), al]) * 255).astype(np.uint8), 'RGBA')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for k, (f, cell, row, col) in SRC.items():
        sheet = Image.open(ROOT / 'assets' / 'characters' / f).convert('RGBA')
        im = clean(sheet.crop((col * cell, row * cell, (col + 1) * cell, (row + 1) * cell)))
        if k == 'bear':
            im = round_cut_edge(im)
        im = im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
        stand = upscale(im, 256)
        stand.save(OUT / f'{k}-stand.webp', quality=92, method=6)
        # 얼굴: 위쪽 45% 에서 머리 중심을 찾아 정사각형으로 자름
        al = np.array(stand)[..., 3] > 40
        top = int(stand.height * 0.45)
        ys, xs = np.nonzero(al[:top])
        cx = float(np.average(xs, weights=np.ones_like(xs)))
        side = int(stand.height * 0.62)  # 머리 전체 + 어깨 조금
        x0 = int(round(cx - side / 2))
        face = Image.new('RGBA', (side, side))
        face.paste(stand.crop((x0, 0, x0 + side, side)), (0, 0))
        face = face.resize((160, 160), Image.LANCZOS)
        face.save(OUT / f'{k}-face.webp', quality=92, method=6)
        print(k, stand.size, 'face center x', round(cx))


if __name__ == '__main__':
    main()
