"""여러 판 반복 시 누수·느려짐 검사.
판마다: 캐릭터 선택 → 한 판(최대 N프레임, 실제 그리기 포함) → 결과 → 다시 하기/로비.
판 끝마다 JS 힙, DOM 노드 수, 이벤트 리스너 수, 프레임 처리 시간(중앙값·95%)을 기록.
사용법: python3 tests/leak.py [index.html] [판 수=8] [--mobile] [--throttle 4]"""
import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from sim import INIT  # noqa: E402

GAME = r"""
async ({frames, ch, viaLobby}) => {
  if (viaLobby) { openLobby(); [...document.querySelectorAll('.char-tile')].find(t => t.dataset.k === ch).click(); document.querySelector('#lobbyStart').click(); }
  else { document.querySelector('#character').value = ch; document.querySelector('#charApply').click(); }
  god = false; freeze = false;
  const times = [];
  let t = window.__t || 0;
  const moves = [['KeyW'], ['KeyA','KeyS'], ['KeyD'], ['KeyS','KeyD'], [], ['KeyW','KeyD'], ['KeyA']];
  for (let f = 0; f < frames && !over; f++) {
    const mv = moves[Math.floor(f / 90) % moves.length];
    for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = mv.includes(k);
    const alive = bots.filter(b => b.hp > 0);
    if (alive.length) { const b = alive.reduce((m, x) => Math.hypot(x.x-p.x, x.y-p.y) < Math.hypot(m.x-p.x, m.y-p.y) ? x : m); window.__setMouseWorld ? 0 : (mouse.x = b.x, mouse.y = b.y); }
    mouse.down = f % 120 < 80;
    if (f % 200 === 50) window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyQ'}));
    if (f % 260 === 130) window.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyE'}));
    if (f % 300 === 10 && p.grenades) throwGrenade(p, mouse.x, mouse.y);
    t += 1000 / 60;
    const t0 = performance.now();
    window.__rafCb(t);
    times.push(performance.now() - t0);
    if (f % 30 === 29) await new Promise((r) => setTimeout(r, 0)); // 실제처럼 브라우저가 화면을 그릴 틈을 줌
  }
  window.__t = t;
  for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
  mouse.down = false;
  if (!over) { p.hp = 0; t += 1000/60; window.__rafCb(t); window.__t = t; }
  await new Promise(r => setTimeout(r, 800));
  times.sort((a, b) => a - b);
  const q = (v) => +times[Math.min(times.length - 1, Math.floor(v * times.length))].toFixed(2);
  return { frames: times.length, med: q(.5), p95: q(.95), max: q(1), fx: fx.length, shots: shots.length, over };
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file', nargs='?', default='index.html')
    ap.add_argument('games', nargs='?', type=int, default=8)
    ap.add_argument('--mobile', action='store_true')
    ap.add_argument('--throttle', type=float, default=1)
    ap.add_argument('--frames', type=int, default=3600)
    a = ap.parse_args()
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--enable-precise-memory-info', '--js-flags=--expose-gc'])
        opts = dict(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=3) if a.mobile else dict(viewport={'width': 1280, 'height': 900})
        ctx = b.new_context(**opts)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script(INIT)
        pg.goto(pathlib.Path(a.file).resolve().as_uri())
        pg.wait_for_function('typeof assetsReady !== "undefined" && assetsReady() && !!window.__rafCb', polling=100)
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Performance.enable')
        if a.throttle > 1:
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': a.throttle})
        chars = ['summoner', 'bear', 'runner', 'suit', 'octo', 'stripe', 'soccer', 'support']
        print(f'{"판":>3} {"캐릭터":9} {"프레임":>6} {"중앙ms":>7} {"95%ms":>7} {"최대ms":>7} {"힙MB":>6} {"노드":>6} {"리스너":>6} {"fx":>4}')
        for i in range(a.games):
            r = pg.evaluate(GAME, {'frames': a.frames, 'ch': chars[i % 8], 'viaLobby': i % 2 == 1})
            pg.evaluate('window.gc && window.gc()')
            m = {x['name']: x['value'] for x in cdp.send('Performance.getMetrics')['metrics']}
            print(f'{i+1:>3} {chars[i % 8]:9} {r["frames"]:>6} {r["med"]:>7} {r["p95"]:>7} {r["max"]:>7} {m["JSHeapUsedSize"]/1e6:>6.1f} {int(m["Nodes"]):>6} {int(m["JSEventListeners"]):>6} {r["fx"]:>4}')
        print('errors', errs[:3])
        b.close()


if __name__ == '__main__':
    main()
