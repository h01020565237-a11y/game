"""전투 규칙 회귀 테스트 (브라우저에서 실제 게임 코드로 확인).

확인 항목: 무기 수치 보존, 액세서리 비활성, 상자 드롭 구성, 수류탄·회복 규칙, 탄창 충전,
캐릭터 스킬 발동, 충돌(벽·강·상자), 모바일 멀티터치(이동+공격 동시)
사용법: python3 tests/rules.py [index.html]
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from sim import INIT  # noqa: E402

CHECKS = r"""
async () => {
  const R = [];
  const ok = (name, cond, info) => R.push({ name, ok: !!cond, info: info === undefined ? "" : JSON.stringify(info) });
  const step = (n) => { for (let i = 0; i < n; i++) { window.__t += 1000 / 60; window.__rafCb(window.__t); } };
  const fresh = (ch) => { document.querySelector('#character').value = ch; document.querySelector('#charApply').click(); freeze = true; god = false; window.__seed(99); };
  window.__t = window.__t || 0;

  // 1) 무기 수치 보존 (V1.4 원본 값)
  const orig = [["맨손",100,0.5,80],["검",250,0.6,120],["망치",600,1.5,100],["권총",250,0.6,240],["샷건",140,1.4,160],["저격총",800,2,380],["수류탄",500,2,260]];
  ok("무기 수치 원본과 동일", JSON.stringify(weapons) === JSON.stringify(orig));
  ok("근접 부채꼴 각도 원본과 동일", JSON.stringify(angles) === JSON.stringify([90,120,160,30,75,12,60]));

  // 2) 액세서리 비활성
  fresh("summoner");
  ok("액세서리 기능 꺼짐", FEATURES.accessories === false);
  ok("액세서리 데이터 보존(6종)", gear.length === 6, gear);
  p.gear = [0, 1, 2, 4, 5];
  ok("액세서리 효과 무시(플레이어)", [0,1,2,3,4,5].every((i) => !hasGear(p, i)));
  ok("액세서리 효과 무시(AI)", [0,1,2,3,4,5].every((i) => !hasGear(bots[0], i)));
  p.gear = [];
  loot.push({ x: p.x, y: p.y, type: LOOT.accessory, id: 2 });
  pickup(p, () => true);
  ok("액세서리 획득 안 됨", p.gear.length === 0);
  loot = [];
  ok("액세서리 UI 숨김", document.querySelector('#gearHud').hidden === true);

  // 3) 상자 드롭 구성
  const cnt = {};
  for (let i = 0; i < 20000; i++) { const e = rollDrop(); const k = e.type + ":" + (e.id || 0); cnt[k] = (cnt[k] || 0) + 1; }
  ok("상자에서 액세서리 안 나옴", !Object.keys(cnt).some((k) => k.startsWith("1:")), cnt);
  ok("주무기 5종만 (수류탄은 주무기 아님)", Object.keys(cnt).filter((k) => k.startsWith("0:")).sort().join() === "0:1,0:2,0:3,0:4,0:5", cnt);
  const total = Object.values(cnt).reduce((a, b) => a + b, 0), wsum = DROP_TABLE.filter((e) => !e.accessory).reduce((a, e) => a + e.weight, 0);
  ok("드롭 확률이 데이터 가중치와 일치(±1.5%p)", DROP_TABLE.filter((e) => !e.accessory).every((e) => Math.abs((cnt[e.type + ":" + (e.id || 0)] || 0) / total - e.weight / wsum) < 0.015));

  // 4) 수류탄
  fresh("bear");
  p.x = 1236; p.y = 700;
  for (let i = 0; i < 5; i++) { loot.push({ x: p.x, y: p.y, type: LOOT.grenade }); pickup(p); }
  ok("수류탄 최대 3개", p.grenades === 3, p.grenades);
  ok("수류탄 3개면 더 안 주움", loot.length === 2);
  loot = [];
  const target = bots[0]; target.x = p.x + 150; target.y = p.y; target.hp = 3000;
  const thrown = throwGrenade(p, target.x, target.y);
  ok("수류탄 투척 시 1개 소모", thrown && p.grenades === 2);
  ok("수류탄은 주무기를 바꾸지 않음", p.w === 0);
  step(47);
  ok("0.8초 전에는 폭발 안 함", target.hp === 3000, target.hp);
  step(3);
  ok("0.8초 후 폭발 피해 500", Math.abs(3000 - target.hp - 500) < 1e-6, 3000 - target.hp);
  ok("수류탄 자동 충전 없음", (step(300), p.grenades === 2));

  // 5) 체력 회복
  p.hp = 1000;
  loot.push({ x: p.x, y: p.y, type: LOOT.heal });
  pickup(p);
  ok("회복: 최대 HP 의 25% 즉시 회복", Math.abs(p.hp - 1750) < 1e-6, p.hp);
  p.hp = p.max;
  loot.push({ x: p.x, y: p.y, type: LOOT.heal });
  pickup(p);
  ok("체력이 가득하면 회복약 안 주움", loot.length === 1);
  loot = [];

  // 6) 탄창: 3칸, 순차 충전 (권총 0.6초 = 36프레임에 1칸)
  p.w = 3; p.ammo = 3; p.cd = 0; p.reload = 0;
  attack(p, p.x + 100, p.y); step(16); attack(p, p.x + 100, p.y); step(16); attack(p, p.x + 100, p.y);
  ok("3번 연속 공격 후 탄창 0", p.ammo === 0, p.ammo);
  p.ammo = 0; p.reload = 0; p.cd = 0;
  const nShots = shots.length;
  attack(p, p.x + 100, p.y);
  ok("탄창이 비면 공격 안 됨", p.ammo === 0 && shots.length === nShots);
  step(35);
  ok("0.6초 전에는 충전 안 됨", p.ammo === 0, [p.ammo, p.reload]);
  step(2);
  ok("0.6초에 1칸 충전", p.ammo === 1, [p.ammo, p.reload]);
  step(36);
  ok("다음 0.6초에 1칸 더 (순차 충전)", p.ammo === 2, p.ammo);
  step(200);
  ok("최대 3칸까지만 충전", p.ammo === 3, p.ammo);

  // 7) 캐릭터 스킬 발동 (Q/E)
  const skillState = () => JSON.stringify([p.run, p.heal, p.tackle, p.s1, p.s2, p.focus, p.guard, p.stealth, shots.length, p.hp, !!flight]);
  for (const ch of CHARACTER_ORDER) {
    fresh(ch);
    p.energy = 100;
    p.hp = 2000;
    const before = skillState();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" }));
    step(1);
    const afterQ = skillState();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
    step(1);
    ok(`스킬 발동: ${ch}`, before !== afterQ || afterQ !== skillState(), [before, afterQ]);
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" }));
  }

  // 8) 충돌: AI 를 3000프레임 돌리며 벽·강·상자 안으로 들어간 액터가 없는지
  fresh("summoner");
  freeze = false; god = true;
  let botThrows = 0;
  const origThrow = throwGrenade;
  throwGrenade = function (a, x, y) { const r = origThrow(a, x, y); if (r && a !== p) botThrows++; return r; };
  bots.forEach((b) => (b.grenades = 3));
  let bad = [];
  for (let f = 0; f < 3000; f++) {
    step(1);
    for (const a of [p, ...bots]) {
      if (a.hp <= 0) continue;
      if (terrain(a.x, a.y) || blocked(a.x, a.y) || nearBox(a.x, a.y, 29.9)) bad.push([f, a.visual || "p", Math.round(a.x), Math.round(a.y)]);
    }
  }
  ok("벽·강·상자 겹침 없음 (AI 3000프레임)", bad.length === 0, bad.slice(0, 5));
  throwGrenade = origThrow;
  ok("AI 도 수류탄 사용 (같은 규칙)", botThrows > 0, botThrows);
  ok("AI 수류탄도 최대 3개 이하", bots.every((b) => b.grenades <= 3));
  // 9) 자동 조준 우선순위: 적 → 상자
  fresh("summoner");
  p.w = 3; p.x = 1236; p.y = 600;  // 덤불·벽 없는 자리
  bots.forEach((b, i) => { b.x = 60 + i * 5; b.y = 60; });
  boxes[0].x = p.x; boxes[0].y = p.y + 80;
  bots[0].x = p.x + 60; bots[0].y = p.y;
  ok("자동 조준: 상자보다 적 우선", aimTarget() === bots[0]);
  bots[0].x = 60; bots[0].y = 60;
  ok("자동 조준: 적이 없으면 상자", aimTarget() === boxes[0]);

  // 10) 승리·패배·재시작
  fresh("bear"); god = false;
  bots.forEach((b) => (b.hp = 0));
  step(2);
  ok("모든 봇이 쓰러지면 승리", over === "승리!" && stats.rank === 1, [over, stats.rank]);
  await new Promise((r) => setTimeout(r, 900)); // 결과 화면은 0.7초 뒤 표시
  ok("승리 결과 화면 표시", !document.querySelector("#results").hidden && document.querySelector("#resTitle").textContent === "승리!");
  document.querySelector("#overBtn").click();
  step(2);
  ok("다시 하기로 재시작", over === "" && p.hp === p.max && document.querySelector("#results").hidden && bots.every((b) => b.hp > 0));
  freeze = true;
  p.hp = 0; bots[0].hp = 0;
  step(2);
  ok("패배 + 순위 집계 (살아 있는 봇 6 → 7위)", over === "패배" && stats.rank === 7, [over, stats.rank]);
  await new Promise((r) => setTimeout(r, 900));
  ok("패배 결과 화면 표시", !document.querySelector("#results").hidden && document.querySelector("#resTitle").textContent === "패배");
  document.querySelector("#resLobby").click();
  ok("로비로 이동", document.body.classList.contains("lobbyOpen"));
  document.querySelector("#lobbyStart").click();
  ok("로비에서 다시 시작", !document.body.classList.contains("lobbyOpen") && over === "");

  // 11) 공격 실패 시 모션·소리 없음
  fresh("summoner");
  p.w = 3; p.ammo = 0; p.cd = 0; p.swing = null;
  attack(p, p.x + 100, p.y);
  ok("탄창 부족이면 공격 모션 없음", p.swing === null);
  p.grenades = 0; p.grenCD = 0;
  ok("수류탄 없으면 투척 안 됨", throwGrenade(p, p.x + 100, p.y) === false && p.swing === null);

  // 13) 모든 상자를 맨손으로 칠 수 있는 자리가 있음 (벽 안에 묻힌 상자 없음)
  const unreachable = boxes.map((bx, i) => {
    if (blocked(bx.x, bx.y, 2)) return i;
    for (let dx = -80; dx <= 80; dx += 4) for (let dy = -80; dy <= 80; dy += 4) {
      const x = bx.x + dx, y = bx.y + dy;
      if (Math.hypot(dx, dy) > 80 || x < 18 || y < 18 || x > W - 18 || y > H - 18) continue;
      if (!terrain(x, y) && !blocked(x, y) && !nearBox(x, y, 30) && clearLine({ x, y }, bx)) return -1;
    }
    return i;
  }).filter((i) => i >= 0);
  ok("모든 상자를 맨손 사거리(80) 안에서 칠 수 있음", unreachable.length === 0, unreachable);

  // 14) 로비 포켓몬 선택: 3마리, 4번째는 가장 먼저 고른 것과 교체
  openLobby();
  [...document.querySelectorAll(".char-tile")].find((t) => t.dataset.k === "summoner").click();
  const tiles = () => [...document.querySelectorAll(".mon-tile")];
  ok("포켓몬 선택 타일 8개", tiles().length === 8);
  lobbyDeck = [0, 3, 5]; renderDeckPicker();
  tiles()[1].click(); tiles()[2].click(); tiles()[6].click();
  ok("포켓몬 4번째 선택 시 가장 먼저 고른 것과 교체 (기본 덱 0,3,5 → 1,2,6)", lobbyDeck.join() === "1,2,6", lobbyDeck);
  tiles()[lobbyDeck[0]].click();
  ok("선택한 포켓몬 다시 누르면 빠짐", lobbyDeck.length === 2, lobbyDeck);
  document.querySelector("#lobbyStart").click();
  ok("3마리가 아니면 시작 안 됨", isLobbyOpen() && document.querySelector("#lobbyErr").textContent.length > 0);
  tiles()[7].click();
  document.querySelector("#lobbyStart").click();
  ok("3마리 고르면 그 덱으로 시작", !isLobbyOpen() && deck.length === 3 && new Set(deck).size === 3, deck);

  // 12) 표시 이름 (CHARACTER_NAMES.md)
  ok("선택창 순서 고정 (동기·현곤·은숙·기섭 / 상훈·경수·재한·정용)", [...document.querySelectorAll(".char-tile")].map((t) => CHARACTER_INFO[t.dataset.k].name).join() === "동기,현곤,은숙,기섭,상훈,경수,재한,정용");
  ok("미영입 잠금 표시 + 출시 예정 2명", document.querySelectorAll(".char-tile.locked .char-lock").length === 7 && document.querySelectorAll(".char-soon").length === 2 && !document.querySelector(".char-tile[data-k=suit]").classList.contains("locked"));
  ok("얼굴 이미지와 이름 분리 + contain", [...document.querySelectorAll(".char-tile")].every((t) => t.querySelector(".char-face img") && t.querySelector(".char-name") && getComputedStyle(t.querySelector("img")).objectFit === "contain"));
  ok("표시 이름 적용", CHARACTER_ORDER.map((k) => CHARACTER_INFO[k].name).join() === "현곤,정용,기섭,동기,상훈,경수,재한,은숙");
  return R;
}
"""

MULTITOUCH = r"""
() => ({ mvX, mvY, ammo: p.ammo, x: p.x, y: p.y })
"""


def main(path='index.html'):
    url = pathlib.Path(path).resolve().as_uri()
    errors, fails = [], 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=user-gesture-required'])
        pg = b.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.add_init_script(INIT)
        pg.goto(url)
        pg.wait_for_function('typeof assetsReady !== "undefined" && assetsReady() && !!window.__rafCb', polling=100, timeout=30000)
        for r in pg.evaluate(CHECKS):
            fails += not r['ok']
            print(('PASS ' if r['ok'] else 'FAIL ') + r['name'] + ('' if r['ok'] or not r['info'] else '  ' + r['info'][:200]))
        # 모바일 멀티터치: 조이스틱을 누른 채 공격 버튼 누르기
        ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True)
        m = ctx.new_page()
        m.on('pageerror', lambda e: errors.append(str(e)))
        m.goto(url)
        m.wait_for_timeout(1500)
        title_ok = m.evaluate("!document.querySelector('#title').hidden && document.querySelectorAll('.title-char').length === TITLE_CHARACTERS.length")
        m.evaluate("closeTitle()")
        title_closed = m.evaluate("document.querySelector('#title').hidden && document.body.classList.contains('lobbyOpen')")
        fails += not (title_ok and title_closed)
        print(('PASS ' if title_ok and title_closed else 'FAIL ') + '타이틀: 처음 진입 시 표시(캐릭터 데이터 수만큼 레이어) → 시작하면 로비')
        m.evaluate("document.querySelector('#charApply').click(); freeze = true; god = true; p.w = 3;")
        cdp = ctx.new_cdp_session(m)
        r1 = m.evaluate("JSON.parse(JSON.stringify(document.querySelector('#mv').getBoundingClientRect()))")
        r2 = m.evaluate("JSON.parse(JSON.stringify(document.querySelector('#atk').getBoundingClientRect()))")
        c1 = (r1['x'] + r1['width'] / 2, r1['y'] + r1['height'] / 2)
        c2 = (r2['x'] + r2['width'] / 2, r2['y'] + r2['height'] / 2)
        x0 = m.evaluate('p.x')
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': c1[0], 'y': c1[1], 'id': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': c1[0] + 40, 'y': c1[1], 'id': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': c1[0] + 40, 'y': c1[1], 'id': 1}, {'x': c2[0], 'y': c2[1], 'id': 2}]})
        m.wait_for_timeout(400)
        st = m.evaluate(MULTITOUCH)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        mt_ok = st['mvX'] > 0.5 and st['x'] > x0 + 20 and st['ammo'] < 3
        fails += not mt_ok
        print(('PASS ' if mt_ok else 'FAIL ') + '모바일 멀티터치: 이동하면서 공격 (누르고 있으면 자동 연속 공격)', json.dumps(st) if not mt_ok else '')
        # 수동 조준 취소: 끌었다가 가운데로 되돌리고 떼면 공격하지 않음
        m.evaluate("p.ammo = 3; p.cd = 0; p.swing = null;")
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': c2[0], 'y': c2[1], 'id': 3}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': c2[0] - 60, 'y': c2[1], 'id': 3}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': c2[0] - 4, 'y': c2[1], 'id': 3}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        m.wait_for_timeout(100)
        cancel_ok = m.evaluate('p.ammo') == 3
        fails += not cancel_ok
        print(('PASS ' if cancel_ok else 'FAIL ') + '모바일: 끌어서 조준 후 가운데로 되돌리면 취소')
        # 수동 조준: 왼쪽으로 끌고 떼면 왼쪽으로 1발
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': c2[0], 'y': c2[1], 'id': 4}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': c2[0] - 70, 'y': c2[1], 'id': 4}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        m.wait_for_timeout(80)
        aim = m.evaluate('[p.ammo, p.attackAng]')
        aim_ok = aim[0] == 2 and abs(abs(aim[1]) - 3.14159) < 0.05
        fails += not aim_ok
        print(('PASS ' if aim_ok else 'FAIL ') + '모바일: 끌어서 조준한 방향으로 공격', '' if aim_ok else aim)
        # 수류탄 버튼 비활성 (0개)
        m.evaluate("p.grenades = 0;")
        m.wait_for_timeout(50)
        r3 = m.evaluate("JSON.parse(JSON.stringify(document.querySelector('#grenBtn').getBoundingClientRect()))")
        m.touchscreen.tap(r3['x'] + r3['width'] / 2, r3['y'] + r3['height'] / 2)
        m.wait_for_timeout(80)
        g_ok = m.evaluate("document.querySelector('#grenBtn').getAttribute('aria-disabled') === 'true' && shots.every(s => !s.gren)")
        fails += not g_ok
        print(('PASS ' if g_ok else 'FAIL ') + '모바일: 수류탄 0개면 버튼 비활성')
        # 오디오: 첫 터치 후 켜짐, 백그라운드 전환 시 멈춤 → 복귀 시 재개
        st_a = m.evaluate("audio.ctx ? audio.ctx.state : 'none'")
        m.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'));")
        m.wait_for_timeout(150)
        st_b = m.evaluate("audio.ctx.state")
        m.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange'));")
        m.wait_for_timeout(300)
        st_c = m.evaluate("audio.ctx.state")
        a_ok = st_a == 'running' and st_b == 'suspended' and st_c == 'running'
        fails += not a_ok
        print(('PASS ' if a_ok else 'FAIL ') + '오디오: 첫 터치 후 켜짐 → 백그라운드 멈춤 → 복귀 재개', '' if a_ok else [st_a, st_b, st_c])
        b.close()
    print(f'errors={errors[:3]}')
    print('ALL PASS' if not fails and not errors else f'{fails} FAIL')
    sys.exit(1 if fails or errors else 0)


if __name__ == '__main__':
    main(*sys.argv[1:])
