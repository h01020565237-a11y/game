"""결정적(시드 고정) 시뮬레이션 테스트.

같은 시드·같은 입력으로 캐릭터 8종을 일정 프레임 돌리고 게임 상태 요약을 출력한다.
리팩터링 전후 결과를 비교해 "동작이 그대로인지" 확인하는 용도.

사용법:
  python3 tests/sim.py index.html                 # 상태 요약 JSON 출력
  python3 tests/sim.py a.html b.html              # 두 버전 비교 (다르면 종료 코드 1)
  옵션: --frames 2400 --seed 7 --mobile --fps
필요: playwright (python), Chrome
"""
import argparse
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

CHARS = ['summoner', 'bear', 'runner', 'suit', 'octo', 'stripe', 'soccer', 'support']

INIT = r"""
(() => {
  let s = 1;
  window.__seed = (v) => { s = v >>> 0; };
  Math.random = () => {  // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__rafCb = null;
  window.requestAnimationFrame = (cb) => { window.__rafCb = cb; return 1; };
})();
"""

RUN = r"""
async ({char, frames, seed, every, timing}) => {
  const key = (code, type='keydown') => window.dispatchEvent(new KeyboardEvent(type, {code}));
  document.querySelector('#character').value = char;
  document.querySelector('#charApply').click();
  window.__seed(seed);
  const moves = [['KeyW'], ['KeyA','KeyS'], ['KeyD'], ['KeyS','KeyD'], [], ['KeyW','KeyD'], ['KeyA']];
  const out = [];
  const times = [];
  let t = (window.__t || 0);
  const setAim = (x, y) => { if (window.__setMouseWorld) window.__setMouseWorld(x, y); else { mouse.x = x; mouse.y = y; } };
  for (let f = 0; f < frames; f++) {
    const mv = moves[Math.floor(f / 90) % moves.length];
    for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = mv.includes(k);
    const alive = bots.filter(b => b.hp > 0);
    if (alive.length) {
      let b = alive.reduce((m, x) => Math.hypot(x.x-p.x, x.y-p.y) < Math.hypot(m.x-p.x, m.y-p.y) ? x : m);
      setAim(b.x, b.y);
    }
    mouse.down = f % 120 < 80;
    if (f % 200 === 50) key('KeyQ');
    if (f % 260 === 130) key('KeyE');
    if (f % 150 === 75) key('Space');
    if (f % 180 === 20) key('KeyF');
    if (f % 333 === 100) key('Digit' + (1 + Math.floor(f / 333) % 3));
    t += 1000 / 60;
    const t0 = performance.now();
    window.__rafCb(t);
    if (timing) times.push(performance.now() - t0);
    if ((f + 1) % every === 0) {
      const r = (a) => ({x: a.x, y: a.y, hp: a.hp, w: a.w, gear: a.gear.join(','), dir: a.dir});
      out.push({f: f + 1, p: r(p), bots: bots.map(r), boxes: boxes.length, loot: loot.length,
                shots: shots.length, over, elapsed, pet: pet ? [pet.id, pet.x, pet.y, pet.hp] : null});
    }
  }
  window.__t = t;
  for (const k of ['KeyW','KeyA','KeyS','KeyD']) keys[k] = false;
  mouse.down = false;
  let timingInfo = null;
  if (timing) {
    times.sort((a, b) => a - b);
    const q = (v) => +times[Math.min(times.length - 1, Math.floor(v * times.length))].toFixed(3);
    timingInfo = {median_ms: q(.5), p95_ms: q(.95), max_ms: q(1)};
  }
  return {states: out, timing: timingInfo};
}
"""


def run(path, frames, seed, mobile, timing):
    url = pathlib.Path(path).resolve().as_uri()
    res, errors = {}, []
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'])
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, has_touch=mobile, is_mobile=mobile)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.add_init_script(INIT)
        page.goto(url)
        page.wait_for_function('typeof sheets !== "undefined" && Object.values(sheets).every(i => i.naturalWidth) && jungle.naturalWidth && window.__rafCb && (typeof assetsReady === "undefined" || assetsReady())', timeout=30000, polling=100)
        for ch in CHARS:
            res[ch] = page.evaluate(RUN, {'char': ch, 'frames': frames, 'seed': seed, 'every': max(1, frames // 8), 'timing': timing})
        b.close()
    return res, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='+')
    ap.add_argument('--frames', type=int, default=2400)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--mobile', action='store_true')
    ap.add_argument('--fps', action='store_true', help='프레임 처리 시간 측정')
    a = ap.parse_args()
    results = []
    for f in a.files:
        r, errs = run(f, a.frames, a.seed, a.mobile, a.fps)
        results.append(r)
        print(f'== {f}: errors={len(errs)}', *errs[:5], sep='\n')
        for ch, v in r.items():
            last = v['states'][-1]
            alive = sum(1 for x in last['bots'] if x['hp'] > 0)
            print(f'  {ch:9s} p.hp={last["p"]["hp"]:.0f} bots_alive={alive} boxes={last["boxes"]} over={last["over"]!r}'
                  + (f' timing={v["timing"]}' if v['timing'] else ''))
    if len(results) == 2:
        bad = [ch for ch in CHARS if results[0][ch]['states'] != results[1][ch]['states']]
        print('IDENTICAL' if not bad else f'DIFFERENT: {bad}')
        if bad:
            ch = bad[0]
            for s0, s1 in zip(results[0][ch]['states'], results[1][ch]['states']):
                if s0 != s1:
                    print('first diff at frame', s0['f'])
                    print(json.dumps(s0)[:600]); print(json.dumps(s1)[:600])
                    break
            sys.exit(1)


if __name__ == '__main__':
    main()
