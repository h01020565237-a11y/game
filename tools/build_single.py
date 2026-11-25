"""분리된 소스를 index.html 한 파일로 합친다 (공유·오프라인용).

사용법:  python3 tools/build_single.py            -> dist/index.html
         python3 tools/build_single.py out.html

- <link rel="stylesheet" href="..."> 는 <style> 로 인라인
- <script src="..."> 는 <script> 로 인라인 (순서 유지)
- CSS/JS/HTML 안의 "assets/..." 경로 문자열은 data URI 로 교체
- 검사(실패 시 빌드 중단): `assets/${...}` 같은 조합 경로, 파일 안에 못 넣고 남은 "assets/..." 경로
  → 배포본(아티팩트)에는 assets 폴더가 없어서 이런 경로는 이미지·소리가 깨짐
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {'.m4a': 'audio/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'}
OPTIONAL = ('assets/pokemon/', 'assets/summons/')  # 공개 저장소에 올리지 않는 로컬 테스트용 그림 (포켓몬 공식 일러스트)
TEMPLATE_RE = re.compile(r'`[^`\n]*assets/[^`\n]*\$\{[^`\n]*`')
LEFT_RE = re.compile(r'(["\'(])(assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a))(["\')])')
ASSET_RE = re.compile(r'(["\'(])(assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg|m4a))(["\')])')


def inline_assets(text):
    def rep(m):
        path = ROOT / m.group(2)
        if not path.exists() and m.group(2).startswith(OPTIONAL):  # 선택 그림(로컬 전용): 없으면 빈 경로 → 게임이 아이콘으로 대신
            return f'{m.group(1)}{m.group(3)}'
        if not path.exists():  # 주석 속 예시 경로 등: 그대로 두고 알림만
            print(f'warning: missing asset (left as is): {m.group(2)}')
            return m.group(0)
        b64 = base64.b64encode(path.read_bytes()).decode()
        return f'{m.group(1)}data:{MIME[path.suffix]};base64,{b64}{m.group(3)}'
    return ASSET_RE.sub(rep, text)


def build(out):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')

    def css(m):
        return '<style>\n' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</style>'

    def js(m):
        code = (ROOT / m.group(1)).read_text(encoding='utf-8')
        assert '</script' not in code, m.group(1)
        return f'<script>/* {m.group(1)} */\n' + code + '</script>'

    html = re.sub(r'<link rel="stylesheet" href="(?!https?:)([^"]+)">', css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)
    bad = TEMPLATE_RE.findall(html)
    html = inline_assets(html)
    left = sorted({m.group(2) for m in LEFT_RE.finditer(html)})
    if bad or left:
        for b in bad:
            print('ERROR 조합 경로(빌드에서 파일을 넣을 수 없음):', b[:120])
        for l in left:
            print('ERROR 파일 안에 못 넣은 경로(파일 없음):', l)
        sys.exit(1)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print(f'{out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {out.stat().st_size:,} bytes')


if __name__ == '__main__':
    build(pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'dist' / 'index.html')
