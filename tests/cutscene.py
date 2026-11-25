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
    pg.goto(url); pg.wait_for_timeout(2500); pg.evaluate('localStorage.clear(); closeTitle(); setQaUnlock(true); el("modePanel").hidden = true; document.body.classList.remove("modeOpen")')
    pg.mouse.click(400, 200); pg.wait_for_timeout(300)
    # 시간 단축 (데이터만 바꿈)
    lens = pg.evaluate('Object.fromEntries(Object.entries(RECRUIT_STORIES).map(([k, s]) => [k, +s.scenes.reduce((a, x) => a + x.t, 0).toFixed(2)]))')
    check('컷신 목표 길이: 현곤 15·은숙 19·기섭 15·상훈 14·경수 15·정용 15초 (±0.1)', all(abs(lens[k] - v) <= 0.1 for k, v in {'hyeongon': 15, 'eunsuk': 19, 'giseop': 15, 'sanghun': 14, 'gyeongsu': 15, 'jeongyong': 15}.items()), lens)
    check('영입 장면 2초·전환 0.15초', pg.evaluate('Object.values(RECRUIT_STORIES).every((s) => s.scenes.filter((x) => x.unlock).every((x) => x.t === 2)) && CUTSCENE_RULES.fade === 0.15'))
    check('정용 컷신: 7장면, 보상 곰(정용), 정용 음성 pitch 0.72 / 현곤 1.25·1.09 유지', pg.evaluate('RECRUIT_STORIES.jeongyong.scenes.length === 7 && RECRUIT_STORIES.jeongyong.reward === "bear" && CUTSCENE_VOICES.jeongyong.pitch === 0.72 && CUTSCENE_VOICES.jeongyong.rate === 1 && CUTSCENE_VOICES.hyeongon.pitch === 1.25 && CUTSCENE_VOICES.hyeongon.rate === 1.09'))
    check('정용 음성 파일 없음 → 임시 TTS (파일 경로 null)', pg.evaluate('RECRUIT_STORIES.jeongyong.scenes.every((x) => x.voice.every((v) => v[3] === null))'))
    pg.evaluate('CUTSCENE_RULES.ttsFallback = false; CUTSCENE_RULES.voiceHold = 0') # 헤드리스: 음성 기다림 없이 장면 흐름만
    pg.evaluate('for (const st of Object.values(RECRUIT_STORIES)) for (const sc of st.scenes) { sc.t = 0.25; sc.sfx = sc.sfx.map(([a,i]) => [a/20, i]); sc.voice = sc.voice.map((v) => [v[0]/20, v[1], v[2], v[3]]); }')
    for k in ['hyeongon', 'eunsuk', 'giseop', 'sanghun', 'gyeongsu', 'jeongyong']:
        pg.evaluate(f'window.__d = 0; window.__seen=[]; const _s = csShowScene; playCutscene("{k}", () => window.__d = 1)')
        n = pg.evaluate(f'RECRUIT_STORIES["{k}"].scenes.length')
        pg.wait_for_timeout(int(n * 250 + 1400))
        st = pg.evaluate('[window.__d, el("cutscene").hidden, cs.timers.length ? cs.run : 0, cs.srcs.length, audio.holdBgm, cs.story]')
        check(f'{k}: {n}장면 끝까지 재생 후 종료', st[0] == 1 and st[1] and st[3] == 0 and st[4] is False and st[5] is None, st)
    # 대사가 끝나기 전에는 장면이 넘어가지 않음 (최대 voiceHold 초), 무음이면 바로
    pg.evaluate('CUTSCENE_RULES.voiceHold = 0.8; window.__d = 0; playCutscene("jeongyong", () => window.__d = 1)')
    pg.wait_for_function('cs.story && cs.sceneTok > 0', timeout=3000)
    i0 = pg.evaluate('(csTalkStart(), cs.idx)')  # 끝나지 않는 대사 하나 흉내
    pg.wait_for_timeout(550)
    held = pg.evaluate('cs.idx')
    pg.wait_for_timeout(900)
    moved = pg.evaluate('cs.idx')
    check('대사 재생 중엔 장면 유지, voiceHold 지나면 진행', held == i0 and moved > i0, (i0, held, moved))
    pg.evaluate('csTalkStart()'); pg.evaluate('el("csSkip").click()')
    check('대사 중 스킵: 즉시 닫힘·대사 정리', pg.evaluate('el("cutscene").hidden && cs.talking === 0 && window.__d === 1'))
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
