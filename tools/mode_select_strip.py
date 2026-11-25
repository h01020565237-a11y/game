"""모드 선택 그림에서 '뒤로가기'(왼쪽 위)·'다음: 캐릭터 선택'(아래) 버튼을 지움 (2026-11-25 요청)
원본: docs/art_backup/mode_select_before_button_removal.webp → assets/ui/mode_select.webp
방법: 버튼 영역 위·아래 배경 줄을 세로로 이어 붙이듯 보간 + 주변과 같은 미세 질감(노이즈)"""
import numpy as np
from PIL import Image
im = np.asarray(Image.open('docs/art_backup/mode_select_before_button_removal.webp').convert('RGB')).astype(np.float32)
rng = np.random.default_rng(7)
def fill(x0, x1, y0, y1):
    top, bot = im[y0 - 1, x0:x1], im[y1, x0:x1]
    # 위아래 기준줄 자체도 가로로 살짝 흐리게 (점무늬가 세로 줄무늬로 늘어나지 않게)
    k = np.ones(9) / 9
    top = np.stack([np.convolve(np.pad(top[:, c], 4, mode='edge'), k, 'valid') for c in range(3)], 1)
    bot = np.stack([np.convolve(np.pad(bot[:, c], 4, mode='edge'), k, 'valid') for c in range(3)], 1)
    for y in range(y0, y1):
        t = (y - y0 + 1) / (y1 - y0 + 1)
        im[y, x0:x1] = top * (1 - t) + bot * t + rng.normal(0, 1.6, (x1 - x0, 1))
fill(14, 256, 14, 108)    # 뒤로가기
fill(500, 1172, 776, 896) # 다음: 캐릭터 선택
Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save('assets/ui/mode_select.webp', 'WEBP', quality=88, method=6)
