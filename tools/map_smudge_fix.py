"""맵 그림의 흐릿한 얼룩(상자를 지운 자국) 24곳을 선명하게 다시 그림.
원본: docs/art_backup/jungle_before_smudge_fix.webp → assets/maps/jungle.webp
얼룩 안 픽셀마다 무엇이어야 하는지 정함: 충돌 벽 칸 = 돌담 / 풀숲 칸 = 풀 / 나머지 = 흙
→ 종류별로, 얼룩 밖의 같은 종류 픽셀만 있는 근처 자리에서 무늬를 가져와 채움 (경계가 가장 잘 이어지는 자리)
구조물 위치·크기·충돌 판정은 바꾸지 않음."""
import json, re, sys
import numpy as np, cv2
ROOT = __import__('pathlib').Path(__file__).resolve().parent.parent
src = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / 'docs/art_backup/jungle_before_smudge_fix.webp')
dst = sys.argv[2] if len(sys.argv) > 2 else str(ROOT / 'assets/maps/jungle.webp')
im = cv2.imread(src).astype(np.float32); H, W = im.shape[:2]
mp = (ROOT / 'js/data/maps/jungle.js').read_text()
WW, WH = int(re.search(r'width:\s*(\d+)', mp).group(1)), int(re.search(r'height:\s*(\d+)', mp).group(1))
sx, sy = W / WW, H / WH
walls = json.loads(re.search(r'walls:\s*(\[\[.*?\]\])', mp, re.S).group(1))
bushes = json.loads(re.search(r'bushes:\s*(\[\[.*?\]\])', mp, re.S).group(1))
cls = np.zeros((H, W), np.uint8)  # 0 흙, 1 풀, 2 돌담
for x, y, w, h in bushes: cls[int(y*sy):int((y+h)*sy), int(x*sx):int((x+w)*sx)] = 1
for x, y, w, h in walls: cls[int(y*sy):int((y+h)*sy), int(x*sx):int((x+w)*sx)] = 2
# 실제 색으로 보정: 풀숲 칸 안이라도 흙색이면 흙 (칸이 넉넉하게 잡혀 있으므로)
hsv = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(int)
green = (hsv[..., 0] > 28) & (hsv[..., 0] < 80) & (hsv[..., 1] > 90)
L = [(478,0,58,72),(245,192,48,52),(108,305,58,80),(295,415,52,70),(596,160,58,80),(522,436,58,68),(106,540,60,75),(262,692,62,72),(476,856,60,70),(596,695,58,62)]
C = [(806,110,60,80),(798,248,76,56),(806,598,62,70),(802,726,62,72)]
R = [(x-4, y-4, w+8, h+8) for x, y, w, h in L + [(W-x-w, y, w, h) for x, y, w, h in L] + C]
bad = np.zeros((H, W), bool)
for x, y, w, h in R: bad[max(0,y-6):y+h+6, max(0,x-6):x+w+6] = True
# 얼룩 밖에서 본 실제 종류 (돌담은 충돌 칸, 풀은 칸+색)
real = np.where(cls == 2, 2, np.where((cls == 1) & green, 1, 0)).astype(np.uint8)
out = im.copy(); M = 8
for x, y, w, h in R:
    x0, y0 = max(0, x), max(0, y); x1, y1 = min(W, x+w), min(H, y+h)
    X0, Y0, X1, Y1 = max(0, x0-M), max(0, y0-M), min(W, x1+M), min(H, y1+M)
    T = im[Y0:Y1, X0:X1]
    inner = np.zeros((Y1-Y0, X1-X0), bool); inner[y0-Y0:y1-Y0, x0-X0:x1-X0] = True
    want = cls[Y0:Y1, X0:X1].copy()
    # 얼룩 안의 풀 칸: 칸 안이면 풀 (색은 얼룩이라 못 믿음)
    want = np.where(inner, want, real[Y0:Y1, X0:X1])
    fill = np.zeros_like(T); wsum = np.zeros(T.shape[:2], np.float32)
    for k in np.unique(want[inner]):
        tk = inner & (want == k)
        ring = (~inner) & (want == k)
        best = None
        for dy in range(-150, 151, 2):
            for dx in range(-220, 221, 2):
                if abs(dx) < (x1-x0) and abs(dy) < (y1-y0): continue
                a0, b0, a1, b1 = Y0+dy, X0+dx, Y1+dy, X1+dx
                if a0 < 0 or b0 < 0 or a1 > H or b1 > W: continue
                if bad[a0:a1, b0:b1][tk].any(): continue
                if (real[a0:a1, b0:b1][tk] != k).mean() > (0.25 if k == 1 else 0.03): continue
                S = im[a0:a1, b0:b1]
                c = ((S - T) ** 2)[ring].mean() if ring.any() else 0
                c += 4 * abs(dy) + 1 * abs(dx)
                if best is None or c < best[0]: best = (c, dx, dy)
        if best is None: print('no source', (x, y), k); continue
        _, dx, dy = best
        S = im[Y0+dy:Y1+dy, X0+dx:X1+dx]
        m = cv2.GaussianBlur(tk.astype(np.float32), (5, 5), 0)  # 종류 경계 부드럽게
        fill += S * m[..., None]; wsum += m
    yy, xx = np.mgrid[Y0:Y1, X0:X1]
    d = np.maximum(np.maximum(x0-xx, xx-(x1-1)), np.maximum(y0-yy, yy-(y1-1)))
    a = np.clip(1 - d / M, 0, 1) * (wsum > 0.01)
    f = fill / np.maximum(wsum, 1e-3)[..., None]
    out[Y0:Y1, X0:X1] = f * a[..., None] + T * (1 - a[..., None])
cv2.imwrite('/tmp/fix/fixed2.png', out.astype(np.uint8))
from PIL import Image
Image.open('/tmp/fix/fixed2.png').save(dst, 'WEBP', quality=90, method=6)
print('saved', dst)
