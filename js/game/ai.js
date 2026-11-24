// 봇·펫 이동 AI: 격자 A* 경로 탐색
//
// - 맵을 12px 칸으로 나눠 "지나갈 수 있는 칸"을 한 번만 계산 (벽 + 물, 캐릭터 반경 16px 기준)
// - 목표까지 직선으로 갈 수 있으면 예전처럼 직진, 막혀 있으면 A* 경로를 따라 이동
// - 경로는 0.4~0.6초마다 또는 목표가 48px 이상 움직였을 때만 다시 계산 (모바일 부담 최소화)
// - 상자는 부서지는 장애물이라 격자에 넣지 않음 (막히면 기존 좌우 회피 로직이 처리)

let navSeq = 0;
const NAV = { cell: 12, cols: 0, rows: 0, walk: null, g: null, from: null, stamp: null, closed: null, run: 0 };

function buildNav() {
  const cs = NAV.cell;
  NAV.cols = Math.ceil(W / cs);
  NAV.rows = Math.ceil(H / cs);
  const n = NAV.cols * NAV.rows;
  NAV.walk = new Uint8Array(n);
  NAV.g = new Float32Array(n);
  NAV.from = new Int32Array(n);
  NAV.stamp = new Int32Array(n);
  NAV.closed = new Int32Array(n);
  for (let r = 0; r < NAV.rows; r++) for (let c2 = 0; c2 < NAV.cols; c2++) {
    const x = (c2 + 0.5) * cs, y = (r + 0.5) * cs;
    NAV.walk[r * NAV.cols + c2] = x >= 18 && x <= W - 18 && y >= 18 && y <= H - 18 && !terrain(x, y) && !blocked(x, y) ? 1 : 0;
  }
}

function navCell(x, y) {
  const c2 = clamp(Math.floor(x / NAV.cell), 0, NAV.cols - 1), r = clamp(Math.floor(y / NAV.cell), 0, NAV.rows - 1);
  return r * NAV.cols + c2;
}

// 막힌 칸이면 가장 가까운 지나갈 수 있는 칸 (최대 반경 6칸)
function nearestWalkable(i) {
  if (NAV.walk[i]) return i;
  const c0 = i % NAV.cols, r0 = (i / NAV.cols) | 0;
  for (let d = 1; d <= 6; d++) {
    let best = -1, bd = Infinity;
    for (let r = r0 - d; r <= r0 + d; r++) for (let c2 = c0 - d; c2 <= c0 + d; c2++) {
      if (r < 0 || c2 < 0 || r >= NAV.rows || c2 >= NAV.cols) continue;
      if (Math.max(Math.abs(r - r0), Math.abs(c2 - c0)) !== d) continue;
      const j = r * NAV.cols + c2, dd = (r - r0) ** 2 + (c2 - c0) ** 2;
      if (NAV.walk[j] && dd < bd) {
        bd = dd;
        best = j;
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

// 직선으로 걸어갈 수 있는지 (벽·물, 8px 간격 검사)
function walkLine(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
    if (terrain(x, y) || blocked(x, y)) return false;
  }
  return true;
}

// 이진 힙 우선순위 큐 (A* 열린 목록)
const navHeap = { idx: [], f: [] };
function heapPush(i, f) {
  const H2 = navHeap;
  let k = H2.idx.length;
  H2.idx.push(i);
  H2.f.push(f);
  while (k > 0) {
    const pk = (k - 1) >> 1;
    if (H2.f[pk] <= f) break;
    H2.idx[k] = H2.idx[pk];
    H2.f[k] = H2.f[pk];
    k = pk;
  }
  H2.idx[k] = i;
  H2.f[k] = f;
}
function heapPop() {
  const H2 = navHeap, top = H2.idx[0], li = H2.idx.pop(), lf = H2.f.pop(), n = H2.idx.length;
  if (n) {
    let k = 0;
    for (;;) {
      let c1 = 2 * k + 1;
      if (c1 >= n) break;
      if (c1 + 1 < n && H2.f[c1 + 1] < H2.f[c1]) c1++;
      if (H2.f[c1] >= lf) break;
      H2.idx[k] = H2.idx[c1];
      H2.f[k] = H2.f[c1];
      k = c1;
    }
    H2.idx[k] = li;
    H2.f[k] = lf;
  }
  return top;
}

const NAV_DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

// A*: 월드 좌표 경로 [[x, y], ...] 또는 null
function findPath(ax, ay, bx, by) {
  if (!NAV.walk) buildNav();
  const s = nearestWalkable(navCell(ax, ay)), t = nearestWalkable(navCell(bx, by));
  if (s < 0 || t < 0) return null;
  const cols = NAV.cols, tc = t % cols, tr = (t / cols) | 0;
  const run = ++NAV.run;
  navHeap.idx.length = navHeap.f.length = 0;
  NAV.stamp[s] = run;
  NAV.g[s] = 0;
  NAV.from[s] = -1;
  heapPush(s, 0);
  let found = false, guard = 0;
  while (navHeap.idx.length && guard++ < 20000) {
    const i = heapPop();
    if (i === t) {
      found = true;
      break;
    }
    if (NAV.closed[i] === run) continue;
    NAV.closed[i] = run;
    const c0 = i % cols, r0 = (i / cols) | 0;
    for (const [dx, dy, cost] of NAV_DIRS) {
      const c2 = c0 + dx, r = r0 + dy;
      if (c2 < 0 || r < 0 || c2 >= cols || r >= NAV.rows) continue;
      const j = r * cols + c2;
      if (!NAV.walk[j] || NAV.closed[j] === run) continue;
      // 대각선 이동 시 모서리 끼임 방지
      if (dx && dy && (!NAV.walk[r0 * cols + c2] || !NAV.walk[r * cols + c0])) continue;
      const gj = NAV.g[i] + cost;
      if (NAV.stamp[j] !== run || gj < NAV.g[j]) {
        NAV.stamp[j] = run;
        NAV.g[j] = gj;
        NAV.from[j] = i;
        const hx = Math.abs(c2 - tc), hy = Math.abs(r - tr);
        heapPush(j, gj + Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy));
      }
    }
  }
  if (!found) return null;
  const path = [];
  for (let i = t; i >= 0; i = NAV.from[i]) path.push([(i % cols + 0.5) * NAV.cell, (((i / cols) | 0) + 0.5) * NAV.cell]);
  path.reverse();
  path[path.length - 1] = [bx, by];
  return path;
}

// a 를 (tx, ty) 쪽으로 한 스텝 이동. 실제로 움직였으면 true
function steer(a, tx, ty, dt) {
  const nav = a._nav || (a._nav = { path: null, i: 0, t: -1, tx: 0, ty: 0, direct: true });
  if (elapsed >= nav.t || Math.hypot(tx - nav.tx, ty - nav.ty) > 48) {
    // 봇마다 재계산 주기를 조금씩 달리해서 같은 프레임에 몰리지 않게 함
    if (nav.seq === undefined) nav.seq = navSeq++ % 5;
    nav.t = elapsed + 0.4 + nav.seq * 0.05;
    nav.tx = tx;
    nav.ty = ty;
    nav.direct = walkLine(a.x, a.y, tx, ty);
    nav.path = nav.direct ? null : findPath(a.x, a.y, tx, ty);
    nav.i = 0;
  }
  let gx = tx, gy = ty;
  const path = nav.path;
  if (!nav.direct && path) {
    while (nav.i < path.length - 1 && Math.hypot(path[nav.i][0] - a.x, path[nav.i][1] - a.y) < 8) nav.i++;
    // 경로 다듬기: 앞쪽 지점 중 직선으로 보이는 가장 먼 곳을 바로 향함
    for (let j = Math.min(path.length - 1, nav.i + 6); j > nav.i; j--) {
      if (walkLine(a.x, a.y, path[j][0], path[j][1])) {
        nav.i = j;
        break;
      }
    }
    gx = path[nav.i][0];
    gy = path[nav.i][1];
  }
  const x0 = a.x, y0 = a.y;
  move(a, gx - a.x, gy - a.y, dt);
  return Math.hypot(a.x - x0, a.y - y0) >= 0.1;
}
