"""싱글 웨이브 생존전 밸런스 측정: 자동 조작으로 미션을 여러 판 돌려 클리어율·시간·웨이브별 체력을 잼.
자동 조작 = 평균적인 플레이어 흉내 (무기 사거리 유지, 보스 예고 회피, 스킬 사용, 상자 깨기, 카드 무작위).
사용: python3 tests/wave_balance.py [판 수] [실력 0~1, 기본 0.6]"""
import pathlib, sys, json
from playwright.sync_api import sync_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 8
SKILL = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
url = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').as_uri()
JS = r"""
([skill]) => {
  const STEP = 1 / 60, out = { waveHp: [], picked: [] };
  localStorage.removeItem("battlelab.single");
  beginSingle("hyeongon");
  document.querySelector("#character").value = "suit";
  document.querySelector("#charApply").click();
  let lastWave = -1, dodgeT = 0, react = 0;
  for (let f = 0; f < 60 * 600 && !over; f++) {
    const R = singleRun;
    if (R.phase === "cards") {
      out.waveHp.push(Math.round(p.hp / p.max * 100));
      const i = Math.floor(Math.random() * R.cards.length);
      out.picked.push(R.cards[i].id);
      pickCard(i);
      continue;
    }
    const foes = bots.filter((b) => b.hp > 0 && !(b.spawnT > 0));
    const near = minBy(foes, (b) => dist(p, b));
    const boss = foes.find((b) => b.mob === "boss");
    const range = weapons[p.w][3];
    let mx = 0, my = 0;
    // 보스 예고 회피 (실력만큼 반응)
    if (boss && boss.tele && Math.random() < skill * 0.2) dodgeT = 0.6;
    if (boss && dodgeT > 0) {
      dodgeT -= STEP;
      const P = boss.tele && boss.tele.P;
      if (P && P.kind === "charge") { mx = -Math.sin(boss.tele.ang); my = Math.cos(boss.tele.ang); }
      else { mx = p.x - boss.x; my = p.y - boss.y; }
    } else if (near) {
      const d = dist(p, near);
      const want = near.mob === "ranged" ? range * 0.7 : range * (0.55 + 0.25 * skill);
      if (d > want + 10 || !clearLine(p, near)) { mx = near.x - p.x; my = near.y - p.y; }
      else if (d < want - 25 && Math.random() < skill) { mx = p.x - near.x; my = p.y - near.y; }
    } else {
      // 적이 없으면 가장 가까운 상자로
      const bx = minBy(boxes, (b) => dist(p, b));
      if (bx && dist(p, bx) > 60) { mx = bx.x - p.x; my = bx.y - p.y; }
    }
    // 다가갈 때는 길찾기 경로를 따라감 (실제 플레이어처럼 벽·상자를 돌아감)
    if ((mx || my) && near && !dodgeT && (dist(p, near) > range || !clearLine(p, near))) {
      const P = (f % 20 === 0 || !window._pp) ? (window._pp = findPath(p.x, p.y, near.x, near.y)) : window._pp;
      if (P && P.length > 1) { const k = Math.min(2, P.length - 1); mx = P[k][0] - p.x; my = P[k][1] - p.y; }
    }
    const n = Math.hypot(mx, my) || 1;
    mvX = mx / n; mvY = my / n;
    if (!mx && !my) mvX = mvY = 0;
    aiming = !!(near && dist(p, near) < range + 20) || (!near && boxes.some((b) => dist(p, b) < 90));
    if (near && dist(p, near) < 160 && Math.random() < 0.02) characterSkill(1);
    if (near && dist(p, near) < 200 && Math.random() < 0.02) characterSkill(2);
    if (p.grenades > 0 && near && Math.random() < 0.01) throwGrenade(p, near.x, near.y);
    if (lastWave !== R.wave) { lastWave = R.wave; out["w" + R.wave + "start"] = Math.round(elapsed); }
    update(STEP);
    if (f > 60 * 580 && f % 60 === 0) (out.trace = out.trace || []).push([Math.round(p.x), Math.round(p.y), mvX.toFixed(2), mvY.toFixed(2), ...bots.filter((b) => b.hp > 0).map((b) => Math.round(b.x) + "/" + Math.round(b.y) + "/" + (b.stun > 0 ? "S" : "") + (b.spawnT > 0 ? "P" : ""))].join(","));
  }
  out.over = over; out.wave = singleRun.wave + 1; out.time = Math.round(elapsed); out.hp = Math.round(p.hp / p.max * 100);
  const boss = bots.find((b) => b.mob === "boss");
  out.bossHp = boss ? Math.round(boss.hp / boss.max * 100) : null;
  out.weapon = weapons[p.w][0];
  if (!over) out.left = [Math.round(p.x), Math.round(p.y), singleRun.queue.length, bots.filter((b) => b.hp > 0).map((b) => [b.mob[0], Math.round(b.x), Math.round(b.y), Math.round(b.stuckT || 0)].join(":")).join(" ")];
  mvX = mvY = 0; aiming = false;
  return out;
}
"""
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path='/usr/bin/google-chrome')
    pg = b.new_context(viewport={'width': 1000, 'height': 650}).new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script("window.requestAnimationFrame = () => 0;")
    pg.goto(url)
    pg.wait_for_function("typeof lobbyArt !== 'undefined' && assetsReady()", polling=100)
    res = []
    for i in range(N):
        r = pg.evaluate(JS, [SKILL])
        res.append(r)
        print(json.dumps(r, ensure_ascii=False))
    wins = sum(r['over'] == '미션 성공' for r in res)
    print(f'== 실력 {SKILL}: 클리어 {wins}/{N}, 평균 시간 {sum(r["time"] for r in res)/N:.0f}초, 실패 웨이브 {[r["wave"] for r in res if r["over"] != "미션 성공"]}')
    print('errors', errs)
    b.close()
