"""배포본 검사: dist/index.html 한 파일만 assets 폴더가 없는 곳에 복사해 열고,
화면의 모든 이미지가 실제로 보이는지(깨진 이미지 '?' 가 없는지) 확인한다. 아티팩트(테스트 링크)와 같은 조건.
사용: python3 tools/build_single.py && python3 tests/dist_check.py"""
import pathlib, shutil, tempfile, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
tmp = pathlib.Path(tempfile.mkdtemp()) / 'index.html'
shutil.copy(ROOT / 'dist' / 'index.html', tmp)
BROKEN = """[...document.images].filter((i) => i.getAttribute('src') && (!i.complete || i.naturalWidth === 0)).map((i) => (i.id || i.className || i.alt) + ' ← ' + i.getAttribute('src').slice(0, 50))"""
fails = 0
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True).new_page()
    errs, reqs = [], []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('requestfailed', lambda r: reqs.append(r.url[:80]))
    pg.goto(tmp.as_uri())
    pg.wait_for_timeout(2500)
    def check(stage):
        global fails
        bad = pg.evaluate(BROKEN)
        print(('PASS ' if not bad else 'FAIL ') + stage, bad[:6])
        fails += bool(bad)
    check('타이틀')
    pg.evaluate("closeTitle()")
    pg.wait_for_timeout(500)
    check('캐릭터 선택')
    pg.evaluate("document.querySelector('#lobbyDetail').click()")
    pg.wait_for_timeout(400)
    check('상세 보기')
    pg.evaluate("document.querySelector('#detailClose').click(); document.querySelector('#lobbySingle').click()")
    pg.wait_for_timeout(400)
    check('싱글 미션')
    pg.evaluate("playCutscene('hyeongon', null)")
    pg.wait_for_timeout(8000)
    check('컷신')
    pg.evaluate("endCutscene(); document.querySelector('#singleClose').click(); document.querySelector('#lobbyStart').click()")
    pg.wait_for_timeout(800)
    check('전투')
    missing = pg.evaluate("Object.entries(sheets).filter(([k, im]) => !im.naturalWidth).map(([k]) => k)")
    print(('PASS ' if not missing else 'FAIL ') + '전투 스프라이트 시트', missing)
    fails += bool(missing)
    local = [r for r in reqs if r.startswith('file:') and 'assets/' in r]
    print(('PASS ' if not local else 'FAIL ') + 'assets 폴더 요청 없음', local[:5])
    fails += bool(local) + bool(errs)
    print('errors', errs)
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
sys.exit(1 if fails else 0)
