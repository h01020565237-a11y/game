"""분리된 소스를 index.html 한 파일로 합친다 (공유·오프라인용).

사용법:  python3 tools/build_single.py            -> dist/index.html
         python3 tools/build_single.py out.html

- <link rel="stylesheet" href="..."> 는 <style> 로 인라인
- <script src="..."> 는 <script> 로 인라인 (순서 유지)
- CSS/JS/HTML 안의 "assets/..." 경로 문자열은 data URI 로 교체
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MIME = {'.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml'}
ASSET_RE = re.compile(r'(["\'(])(assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpe?g|gif|svg|wav|mp3|ogg))(["\')])')


def inline_assets(text):
    def rep(m):
        path = ROOT / m.group(2)
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
    html = inline_assets(html)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding='utf-8')
    print(f'{out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {out.stat().st_size:,} bytes')


if __name__ == '__main__':
    build(pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'dist' / 'index.html')
