"""싱글 영입 미션 테스트: python3 tests/story.py [index.html]
- 새 저장: 동기만, 미션 잠금·출전 캐릭터 규칙, 기섭 2명 중 선택
- 각 미션 빠르게 진행(적 즉시 처치·타이머 단축) → 단계·보스 체력·성공 → 영입 저장 → 컷신/영입 완료 화면 스킵 → 결과
- 실패: 보호 대상 쓰러짐(은숙), 보스 제한시간(기섭), 사망 → 영입 없음
- 새로고침 후 영입 유지, 재클리어 중복 없음"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
url = pathlib.Path(f).resolve().as_uri()
fails = 0
def ok(n, c, x=''):
    global fails
    fails += not c
    print(('PASS ' if c else 'FAIL ') + n, x if not c else '')
RUN = r'''(async (id, who, mode) => {
  const step = (s) => { for (let i = 0; i < Math.round(s * 60); i++) update(1 / 60); };
  startMission(id, who);
  syncResults(); // (실제 게임은 매 프레임 호출) 이전 결과 상태 초기화
  document.body.classList.add("menuOpen"); // 루프 정지, 직접 진행
  god = true;
  const R = singleRun, info = { char: character, stages: [], bossHp: [] };
  let guard = 0;
  while (!over && guard++ < 4000) {
    if (R.phase === "cards") { pickEndlessCard(0); continue; }
    if (R.phase === "count" || R.phase === "intro") { step(0.2); continue; }
    if (R.phase === "fight") {
      if (!info.stages.includes(R.wave)) info.stages.push(R.wave);
      R.timer = Math.min(R.timer, 0.5);
      for (const b of bots) if (!b.bossId && b.hp > 0) b.hp = 0;
      step(0.3); continue;
    }
    if (R.phase === "boss") {
      if (!info.stages.includes(R.wave)) { info.stages.push(R.wave); info.bossHp.push([R.boss.bossId, Math.round(R.boss.max)]); }
      if (mode === "ward") { R.ward.hp = 0; step(0.2); continue; }
      if (mode === "limit") { god = true; step(1); continue; }
      if (mode === "die") { god = false; p.hp = 0; step(0.2); continue; }
      hit(p, R.boss, R.boss.max * 0.4); step(0.3); continue;
    }
    step(0.1);
  }
  info.over = over; info.fail = R.failReason; info.wave = R.wave; info.recruited = singleSave.recruited.slice();
  return info;
})'''
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = b.new_context(viewport={'width': 844, 'height': 390})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(1500)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(1500)
    pg.evaluate('closeTitle(); chooseMode("single")'); pg.wait_for_timeout(200)
    st = pg.evaluate('''(() => ({ rec: singleSave.recruited.slice(), qa: ROSTER.testMode, cards: [...document.querySelectorAll("#missionList .mission")].map(c => [c.querySelector("b").textContent, c.className.includes("locked"), [...c.querySelectorAll("button")].map(x => x.textContent)]) }))()''')
    print(st)
    ok('새 저장: 동기만 영입, QA 해금 꺼짐', st['rec'] == ['suit'] and not st['qa'])
    locks = {c[0]: c[1] for c in st['cards']}
    ok('처음엔 현곤 미션만 열림 (순서 건너뛰기 없음)', not locks['현곤 영입'] and all(locks[k] for k in ['은숙 영입', '기섭 영입', '상훈 영입', '경수 영입', '정용 영입', '재한 영입']), locks)
    ok('미션 목록 순서: 현곤·은숙·기섭·상훈·경수·정용·재한', [c[0] for c in st['cards']] == ['현곤 영입', '은숙 영입', '기섭 영입', '상훈 영입', '경수 영입', '정용 영입', '재한 영입'], [c[0] for c in st['cards']])
    ok('캐릭터 선택 순서: 동기·현곤·은숙·기섭·상훈·경수·정용·재한', pg.evaluate('LOBBY_ORDER.map((k) => DISPLAY_NAMES[k]).join()') == '동기,현곤,은숙,기섭,상훈,경수,정용,재한')
    ok('잠긴 미션 우회 시작 불가 (기섭: 동기는 영입돼 있어도 은숙 영입 전엔 잠김)', pg.evaluate('(startMission("giseop", "suit"), !singleRun)'))
    ok('출전 조건 따로: 정용 미션은 경수 영입이 선행, 출전은 현곤', pg.evaluate('(() => { const m = SINGLE_MISSIONS.find((x) => x.id === "jeongyong"); return m.requires.join() === "stripe" && m.players.join() === "summoner"; })()'))
    ok('지정되지 않은 캐릭터로 시작 불가', pg.evaluate('(startMission("eunsuk", "suit"), !singleRun)'))
    # 성공 경로: 순서대로 (출전 캐릭터 영입되면서 열림)
    order = [('hyeongon', 'suit'), ('eunsuk', 'summoner'), ('giseop', 'summoner'), ('sanghun', 'runner'), ('gyeongsu', 'octo'), ('jeongyong', 'summoner'), ('jaehan', 'bear')]
    for mid, who in order:
        if mid == 'hyeongon':  # 기존 웨이브 미션: 빠르게 클리어
            r = pg.evaluate('''(() => { startMission("hyeongon", "suit"); syncResults(); document.body.classList.add("menuOpen"); god = true; const R = singleRun; let g = 0;
              while (!over && g++ < 3000) { if (R.phase === "cards") { pickCard(0); continue; } for (const b of bots) b.hp = 0; R.queue && (R.queue.length = 0); for (let i = 0; i < 20; i++) update(1/60); }
              return { over, recruited: singleSave.recruited.slice() }; })()''')
        else:
            r = pg.evaluate(RUN + f'("{mid}", "{who}", "win")')
        print(mid, r)
        ok(f'{mid}: {who}(으)로 출전 → 미션 성공 → 영입 저장', r['over'] == '미션 성공' and pg.evaluate(f'singleSave.recruited.includes(STORY_ORDER.find(m => m.id === "{mid}").reward)'), r)
        if mid != 'hyeongon':
            S = pg.evaluate(f'STORY_MISSIONS["{mid}"].stages.length')
            ok(f'{mid}: 모든 단계 진행 ({S}단계)', r['stages'] == list(range(1, S + 1)), r['stages'])
        # 결과로 넘어가는 영입 연출 (컷신 또는 영입 완료 화면) 스킵
        pg.evaluate('document.body.classList.remove("menuOpen")'); pg.wait_for_timeout(1300)
        shown = pg.evaluate('[!el("cutscene").hidden, !el("recruitSplash").hidden]')
        if shown[0]: pg.evaluate('el("csSkip").click()')
        if shown[1]: pg.evaluate('el("rsOk").click()')
        pg.wait_for_timeout(900)
        res = pg.evaluate('[!el("recruitResult").hidden, el("rrTitle").textContent, el("results").hidden, [...document.querySelectorAll("#rrNextList .rr-go")].map((b) => b.dataset.id), !el("rrAll").hidden]')
        ok(f'{mid}: 컷신/영입 완료 화면 → 영입 결과 "{res[1]}"', res[0] and res[2] and '완료' in res[1] and (shown[0] or shown[1]), (shown, res))
        expect = pg.evaluate('nextMissions().map((m) => m.id)')
        ok(f'{mid}: 다음 스토리 = 도전 가능한 미영입 미션 {expect}', res[3] == expect, res[3])
        if expect:
            mb = pg.evaluate('(() => { const b = document.querySelector("#rrNextList .rr-go.main"); const r = b.getBoundingClientRect(); const o = [...document.querySelectorAll("#rrNextList .rr-go:not(.main), .rr-sub")].map((x) => x.getBoundingClientRect().height); return [r.height, Math.max(0, ...o), b.textContent]; })()')
            ok(f'{mid}: 다음 스토리 버튼이 가장 큼', mb[0] > mb[1] and '다음 스토리' in mb[2], mb)
            pg.evaluate('document.querySelector("#rrNextList .rr-go.main").click()'); pg.wait_for_timeout(100)
            pr = pg.evaluate('[!el("missionPrep").hidden, prepId, prepWho, el("prepTitle").textContent, [...document.querySelectorAll("#prepWho .prep-pick")].length, el("recruitResult").hidden, !!singleRun]')
            ok(f'{mid}: 다음 스토리 → {expect[0]} 준비 화면 (출전 캐릭터 표시, 미션 정리됨)', pr[0] and pr[1] == expect[0] and pr[2] and pr[5] and not pr[6], pr)
            pg.evaluate('el("missionPrep").hidden = true')
        else:
            ok(f'{mid}: 마지막 → 전체 캐릭터 영입 완료 화면', res[4] and '전체' in res[1], res)
        pg.evaluate('el("recruitResult").hidden = true; openLobby()')
    ok('8명 모두 영입', sorted(pg.evaluate('singleSave.recruited')) == sorted(['suit', 'summoner', 'support', 'runner', 'octo', 'stripe', 'soccer', 'bear']))
    ok('재한: 컷신 없이 영입 완료 화면 / 정용: 영입 컷신', pg.evaluate('!RECRUIT_STORIES.jaehan && !!RECRUIT_STORIES.jeongyong'))
    cleared = pg.evaluate('JSON.stringify(singleSave.cleared)')
    # 재클리어: 중복 영입 없음
    pg.evaluate(RUN + '("sanghun", "runner", "win")'); pg.evaluate('document.body.classList.remove("menuOpen")'); pg.wait_for_timeout(1300); pg.evaluate('el("csSkip").click(); el("rsOk").click()'); pg.wait_for_timeout(500)
    ok('재클리어: 영입 목록 중복 없음', pg.evaluate('singleSave.recruited.length === new Set(singleSave.recruited).size && singleSave.recruited.length === 8'))
    # 실패 경로
    pg.evaluate('openLobby()')
    r = pg.evaluate(RUN + '("eunsuk", "summoner", "ward")'); ok('은숙 미션: 은숙이 쓰러지면 실패', r['over'] == '패배' and '쓰러' in r['fail'], r)
    pg.evaluate('document.body.classList.remove("menuOpen"); openLobby()')
    r = pg.evaluate(RUN + '("giseop", "summoner", "limit")'); ok('기섭 미션: 보스 제한시간 초과 → 실패', r['over'] == '패배' and '시간' in r['fail'], r)
    pg.evaluate('document.body.classList.remove("menuOpen"); openLobby()')
    r = pg.evaluate(RUN + '("jaehan", "stripe", "die")'); ok('사망 → 실패', r['over'] == '패배', r)
    pg.wait_for_timeout(1200)
    fr = pg.evaluate('[el("resTitle").textContent, el("overBtn").textContent, !el("results").hidden, el("recruitResult").hidden]')
    ok('실패 결과 화면 "미션 실패" + 재도전', fr == ['미션 실패', '재도전', True, True], fr)
    # 새로고침 후 유지 + 웨이브에서 8명 사용 가능
    pg.evaluate('document.body.classList.remove("menuOpen")')
    pg.reload(); pg.wait_for_timeout(1500)
    ok('새로고침 후 영입 8명 유지, QA 해금 없이 웨이브 출전 가능', pg.evaluate('singleSave.recruited.length === 8 && !ROSTER.testMode && LOBBY_ORDER.every(canPlay)'))
    ok('웨이브 기록 초기화해도 영입 유지', pg.evaluate('(localStorage.removeItem("battlelab.endless"), JSON.parse(localStorage.getItem("battlelab.single")).recruited.length === 8)'))
    ok('에러 없음', not errs, errs[:3])
    b.close()
print('ALL PASS' if not fails else f'{fails} FAIL')
