"""캐릭터 시트의 '안쪽 구멍' 복구: 배경 제거 때 어두운 부분(머리카락·안경 주변·정장)이 잘못 투명해진 곳을 메움.
작은 닫힌 구멍(칸마다 max_hole px 이하)만 채우고, 색은 주변 픽셀로 칠함(OpenCV inpaint).
팔과 몸 사이처럼 원래 뚫린 큰 공간은 건드리지 않음. 원본 파일은 그대로 두고 새 파일로 저장.
사용법: python3 tools/fix_sheet_holes.py 입력.webp 출력.webp [max_hole=30]"""
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

src, dst = sys.argv[1], sys.argv[2]
max_hole = int(sys.argv[3]) if len(sys.argv) > 3 else 30
a = np.array(Image.open(src).convert('RGBA'))
cell = a.shape[0] // 8
filled_total = 0
for r in range(8):
    for c in range(8):
        sl = (slice(r * cell, (r + 1) * cell), slice(c * cell, (c + 1) * cell))
        al = a[sl][..., 3]
        solid = al > 100
        holes = ndimage.binary_fill_holes(solid) & ~solid
        lab, n = ndimage.label(holes)
        if not n:
            continue
        sizes = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        mask = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s <= max_hole])
        if not mask.any():
            continue
        rgb = np.ascontiguousarray(a[sl][..., :3])
        fixed = cv2.inpaint(rgb, mask.astype(np.uint8) * 255, 2, cv2.INPAINT_TELEA)
        block = a[sl].copy()
        block[..., :3][mask] = fixed[mask]
        block[..., 3][mask] = 255
        a[sl] = block
        filled_total += int(mask.sum())
# 반투명 점: 주변 8칸 중 6칸 이상이 불투명한데 혼자 반투명이면 불투명하게 (머리카락 속 푸른 점)
for _ in range(2):
    al = a[..., 3].astype(int)
    solid = (al > 200).astype(int)
    nb = sum(np.roll(np.roll(solid, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    speck = (al < 230) & (nb >= 6)
    a[..., 3][speck] = 255
    filled_total += int(speck.sum())
Image.fromarray(a).save(dst, quality=92, method=6)
print(f'{dst}: filled {filled_total} px')
