"""전신 이미지(배경 투명)의 실루엣 바깥에 남은 반투명 그림자 지우기.
반투명(알파<235)이면서 어두운 회색이거나 보라빛 회색인 픽셀만 투명 처리. 불투명한 그림 안쪽은 건드리지 않음.
사용: python3 -I tools/clean_full_halo.py <입력.png> <출력.webp>"""
import sys
import numpy as np
from PIL import Image

a = np.array(Image.open(sys.argv[1]).convert('RGBA')).astype(int)
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
mx, mn = a[..., :3].max(2), a[..., :3].min(2)
semi = (al > 0) & (al < 235)
grey = (mx < 120) & (mx - mn < 60)
purple = (b > g + 25) & (b >= r - 15)
halo = semi & (grey | purple)
a[halo, 3] = 0
Image.fromarray(a.astype(np.uint8)).save(sys.argv[2], quality=92, method=6)
print(sys.argv[1], 'halo', int(halo.sum()))
