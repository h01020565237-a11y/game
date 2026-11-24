"""ChatGPT 그래픽 초안(draft_crops) 정리 도구.

- 상자 7종: 남은 반투명 잡티 제거, 잔디 받침 기준으로 위치 맞춤, 같은 크기 캔버스로 출력
- 무기 6종: 불투명하게 남은 어두운 패널 배경을 색상 기반으로 제거, 가장자리 부드럽게, 96×96 아이콘
사용법: python3 tools/clean_drafts.py <draft_crops 폴더> <출력 assets 폴더> [검수 미리보기.png]
"""
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

CHESTS = ['chest_intact', 'chest_hit', 'chest_cracked', 'chest_heavy_damage', 'chest_burst_1', 'chest_burst_2', 'chest_debris']
WEAPONS = ['sword', 'hammer', 'pistol', 'shotgun', 'sniper', 'grenade']
# 무기별 배경 판정 기준 (저격총 조준경은 배경과 밝기가 비슷해서 더 엄격하게)
BG_TOL = {'sniper': (30, 32)}


def load(p):
    return np.array(Image.open(p).convert('RGBA')).astype(np.float32)


def clean_chest(a, keep_particles):
    al = a[..., 3]
    al[al < 14] = 0  # 반투명 잡티
    lab, n = ndimage.label(al > 40)
    if n:
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        big = np.argmax(sizes) + 1
        # 파편 이미지는 조각·연기를 살리고, 나머지는 본체와 큰 덩어리(! 표시 등)만
        keep = [i + 1 for i, s in enumerate(sizes) if i + 1 == big or s >= (25 if keep_particles else 120)]
        mask = np.isin(lab, keep)
        mask = ndimage.binary_dilation(mask, iterations=3)  # 부드러운 가장자리 보존
        al[~mask] = 0
    a[..., 3] = al
    return a


def base_anchor(a):
    """잔디 받침 기준점: 아래쪽 25% 영역의 불투명 픽셀 가로 중심, 맨 아래 y"""
    al = a[..., 3] > 128
    ys, xs = np.nonzero(al)
    bottom = ys.max()
    sel = ys > bottom - (bottom - ys.min()) * 0.25
    return float(xs[sel].mean()), int(bottom)


def remove_panel_bg(a, tol=42, gtol=40):
    """불투명한 어두운 패널 배경 제거: 색 기반 1차 추정 → OpenCV GrabCut 으로 경계 다듬기.
    어두운 부품(조준경, 총신)이 배경으로 지워지지 않도록 GrabCut 이 색 분포와 경계를 같이 본다."""
    import cv2
    rgb, al = a[..., :3], a[..., 3]
    h, w = al.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    border_al = np.concatenate([al[0], al[-1], al[:, 0], al[:, -1]])
    ref = np.median(border[border_al > 128], axis=0)
    dref = np.linalg.norm(rgb - ref, axis=-1)
    gy = np.abs(np.diff(rgb, axis=0, append=rgb[-1:])).sum(-1)
    gx = np.abs(np.diff(rgb, axis=1, append=rgb[:, -1:])).sum(-1)
    grad = np.maximum(gx, gy)
    bglike = ((dref < tol) & (grad < gtol)) | (al < 128)
    lab, n = ndimage.label(bglike)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    flood_bg = np.isin(lab, list(edge_labels))

    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1)
    gc = np.full((h, w), cv2.GC_PR_FGD, np.uint8)
    gc[flood_bg] = cv2.GC_PR_BGD
    gc[(dref < 14) & flood_bg] = cv2.GC_BGD
    gc[:4, :] = gc[-4:, :] = cv2.GC_BGD
    gc[:, :4] = gc[:, -4:] = cv2.GC_BGD
    gc[al < 128] = cv2.GC_BGD
    sure_fg = ndimage.binary_erosion(~flood_bg, iterations=4) & ((sat > 0.35) | (mx > 150))
    gc[sure_fg] = cv2.GC_FGD
    # 배경보다 확실히 어두운 부품(조준경 등 검은 부분)도 물체로 고정 (가장자리 10px 안쪽, 원래 불투명한 곳만)
    lum, ref_lum = rgb.mean(-1), ref.mean()
    inner_box = np.zeros_like(fg_dummy := al, dtype=bool)
    inner_box[10:-10, 10:-10] = True
    dark = (lum < ref_lum * 0.62) & (al > 200) & inner_box
    dark = ndimage.binary_opening(dark, iterations=2)
    gc[dark] = cv2.GC_FGD
    img = np.ascontiguousarray(rgb[..., ::-1].astype(np.uint8))
    bgm, fgm = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, gc, None, bgm, fgm, 10, cv2.GC_INIT_WITH_MASK)
    fg = (gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)
    lab3, n3 = ndimage.label(fg)
    if n3:
        sizes = ndimage.sum(np.ones_like(al), lab3, range(1, n3 + 1))
        big = np.argmax(sizes) + 1
        fg = np.isin(lab3, [i + 1 for i, s2 in enumerate(sizes) if i + 1 == big or s2 > sizes.max() * 0.08])
    fg = ndimage.binary_opening(fg, iterations=1)
    soft = ndimage.gaussian_filter(fg.astype(np.float32), 0.7)
    a[..., 3] = np.clip(soft * 255, 0, 255) * (al / 255)
    return a


def trim_square(img, size, pad=4):
    bbox = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    img = img.crop(bbox)
    s = max(img.size) + pad * 2
    sq = Image.new('RGBA', (s, s))
    sq.paste(img, ((s - img.width) // 2, (s - img.height) // 2))
    return sq.resize((size, size), Image.LANCZOS)


def main(src, out, preview=None):
    src, out = pathlib.Path(src), pathlib.Path(out)
    (out / 'props').mkdir(parents=True, exist_ok=True)
    (out / 'weapons').mkdir(parents=True, exist_ok=True)
    tiles = []
    # 상자: 잔디 받침 중심을 (160, 280) 에 맞춘 320×300 캔버스 → 96×90 으로 축소
    for name in CHESTS:
        a = clean_chest(load(src / 'objects' / f'{name}.png'), name in ('chest_burst_1', 'chest_burst_2', 'chest_debris'))
        cx, by = base_anchor(a)
        im = Image.fromarray(a.astype(np.uint8))
        canvas = Image.new('RGBA', (320, 300))
        canvas.alpha_composite(im, (int(round(160 - cx)), 280 - by)) if 160 - cx >= 0 and 280 - by >= 0 else canvas.paste(im, (int(round(160 - cx)), 280 - by), im)
        small = canvas.resize((96, 90), Image.LANCZOS)
        small.save(out / 'props' / f'{name.replace("_", "-")}.webp', quality=90, method=6)
        tiles.append(small)
    # 무기: 96×96 아이콘
    for name in WEAPONS:
        a = remove_panel_bg(load(src / 'weapons' / f'{name}.png'), *BG_TOL.get(name, (42, 40)))
        icon = trim_square(Image.fromarray(a.astype(np.uint8)), 96)
        icon.save(out / 'weapons' / f'{name}.webp', quality=92, method=6)
        tiles.append(icon)
    if preview:
        sheet = Image.new('RGBA', (110 * 7, 110 * 2 + 10))
        for i, t in enumerate(tiles):
            x, y = (i % 7) * 110, (i // 7) * 115
            for bgc, dy in [((120, 160, 110, 255), 0)]:
                bg = Image.new('RGBA', (106, 106), bgc)
                bg.alpha_composite(t, ((106 - t.width) // 2, (106 - t.height) // 2))
                sheet.paste(bg, (x, y + dy))
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(preview)


if __name__ == '__main__':
    main(*sys.argv[1:4])
