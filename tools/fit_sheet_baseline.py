"""ChatGPT 보정 시트의 발 높이를 기존 시트에 맞춤.
방향(행)마다 기존 시트와 가장 낮은 발 위치를 비교해 차이만큼 세로로 이동한다 (그림 자체는 그대로).
사용: python3 -I tools/fit_sheet_baseline.py <새 시트.png> <기존 시트> <출력.webp>"""
import sys
import numpy as np
from PIL import Image

CELL = 96

def foot(arr, d):
    m = 0
    for f in range(8):
        ys = np.nonzero((arr[d * CELL:(d + 1) * CELL, f * CELL:(f + 1) * CELL, 3] > 40).any(1))[0]
        if len(ys):
            m = max(m, int(ys.max()))
    return m

new = np.array(Image.open(sys.argv[1]).convert('RGBA'))
old = np.array(Image.open(sys.argv[2]).convert('RGBA'))
out = np.zeros((8 * CELL, 8 * CELL, 4), np.uint8)
for d in range(8):
    dy = foot(old, d) - foot(new, d)
    row = new[d * CELL:(d + 1) * CELL, :8 * CELL]
    out[d * CELL:(d + 1) * CELL] = np.roll(row, dy, axis=0)
    if dy > 0:
        out[d * CELL:d * CELL + dy] = 0
    elif dy < 0:
        out[(d + 1) * CELL + dy:(d + 1) * CELL] = 0
    print('dir', d, 'shift', dy)
Image.fromarray(out).save(sys.argv[3], quality=92, method=6)
