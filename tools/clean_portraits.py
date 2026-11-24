"""선택창 얼굴 아이콘(Portraits V2) 정리.
원본은 컨셉 시안에서 잘라낸 것이라 위아래로 바깥 액자색(#3062d3) 띠와 이웃 칸의 선택선이 붙어 있음.
그림은 그대로 두고 카드 영역(y 15~240)만 잘라 모서리를 둥글게 투명 처리한다.
사용: python3 -I tools/clean_portraits.py <ZIP 압축 해제 폴더>/assets/portraits"""
import sys, pathlib
from PIL import Image, ImageDraw

BOX = (0, 15, 256, 240)  # 카드 영역 (8장 모두 동일 위치, 측정값)
RADIUS = 18
OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'portraits'

def clean(path):
    im = Image.open(path).convert('RGBA').crop(BOX)
    s = 4  # 모서리 안티에일리어싱
    m = Image.new('L', (im.width * s, im.height * s), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, m.width - 1, m.height - 1), RADIUS * s, fill=255)
    im.putalpha(m.resize(im.size, Image.LANCZOS))
    return im

if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob('*.png')):
        clean(f).save(OUT / f.name, optimize=True)
        print(f.name)
