"""영입 컷신 회귀 테스트: python3 tests/cutscene.py [dist/index.html]
- 5편 모두 끝까지 재생 → 종료 콜백, 타이머·소리 정리, 게임 BGM 복귀
- 스킵: 즉시 정리
- 스토리 극장 다시 보기: 영입/저장 변화 없음
- 미션 클리어: 컷신 전에 영입 저장 (스킵해도 유지)
"""
import pathlib, sys
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html'
url = pathlib.Path(f).resolve().as_uri()
ok = True
def check(name, cond, info=''):
    global ok
    print(('PASS ' if cond else 'FAIL ') + name, info)
    ok &= bool(cond)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(2500); pg.evaluate('localStorage.clear(); closeTitle()')
    pg.mouse.click(400, 200); pg.wait_for_timeout(300)
    # 시간 단축 (데이터만 바꿈)
    pg.evaluate('for (const st of Object.values(RECRUIT_STORIES)) for (const sc of st.scenes) { sc.t = 0.25; sc.sfx = sc.sfx.map(([a,i]) => [a/20, i]); sc.voice = sc.voice.map((v) => [v[0]/20, v[1], v[2], v[3]]); }')
    for k in ['hyeongon', 'eunsuk', 'giseop', 'sanghun', 'gyeongsu']:
        pg.evaluate(f'window.__d = 0; window.__seen=[]; const _s = csShowScene; playCutscene("{k}", () => window.__d = 1)')
        n = pg.evaluate(f'RECRUIT_STORIES["{k}"].scenes.length')
        pg.wait_for_timeout(int(n * 250 + 1400))
        st = pg.evaluate('[window.__d, el("cutscene").hidden, cs.timers.length ? cs.run : 0, cs.srcs.length, audio.holdBgm, cs.story]')
        check(f'{k}: {n}장면 끝까지 재생 후 종료', st[0] == 1 and st[1] and st[3] == 0 and st[4] is False and st[5] is None, st)
    pg.evaluate('playCutscene("eunsuk", null)'); pg.wait_for_timeout(500)
    mid = pg.evaluate('[cs.idx, audio.holdBgm, !el("cutscene").hidden]')
    pg.evaluate('el("csSkip").click()'); pg.wait_for_timeout(200)
    st = pg.evaluate('[el("cutscene").hidden, cs.srcs.length, audio.holdBgm, !!cs.story]')
    check('스킵: 화면 닫힘·소리 정지·게임 BGM 복귀', mid[1] and mid[2] and st == [True, 0, False, False], (mid, st))
    before = pg.evaluate('JSON.stringify(singleSave.recruited)')
    pg.evaluate('playCutscene("sanghun", null)'); pg.wait_for_timeout(1800)
    after = pg.evaluate('JSON.stringify(singleSave.recruited)')
    check('극장 다시 보기: 영입 변화 없음', before == after, (before, after))
    pg.evaluate('beginSingle("hyeongon"); singleRun.m = WAVE_MISSIONS.hyeongon; onMissionClear(() => {}); el("csSkip").click()')
    rec = pg.evaluate('[singleSave.recruited.includes("summoner"), JSON.parse(localStorage.getItem("battlelab.single")).recruited.includes("summoner")]')
    check('미션 클리어: 컷신 전에 영입 저장 (스킵해도 유지)', rec == [True, True], rec)
    pg.evaluate('openSinglePanel()')
    th = pg.evaluate('[...el("theaterList").querySelectorAll("button")].map((x) => x.textContent)')
    check('극장 목록: 영입한 현곤은 테스트 표시 없음', any('현곤' in t and '테스트' not in t for t in th), th)
    vol = pg.evaluate('setAudio("voice", 0.3); [audio.settings.voice, JSON.parse(localStorage.getItem("battlelab.audio")).voice, el("volVoice") ? 1 : 0]')
    check('음성 음량 따로 저장', vol[0] == 0.3 and vol[1] == 0.3 and vol[2] == 1, vol)
    check('에러 없음', not errs, errs)
    b.close()
print('ALL PASS' if ok else 'SOME FAIL')
