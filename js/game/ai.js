// 봇·몬스터·펫·분신 이동 AI: 격자 A* 경로 탐색
//
// - 맵을 12px 칸으로 나눠 "지나갈 수 있는 칸"을 계산 (벽 + 물 + 상자). 몸 크기(반경)별로 따로 계산해 보관
//   (보통 16px / 큰 몸 24·34px 등) → 큰 보스가 좁은 틈으로 경로를 잡지 않음
// - 목표까지 직선으로 갈 수 있으면 직진, 막혀 있으면 A* 경로를 따라 이동
// - 경로는 0.4~0.6초마다, 목표가 48px 이상 움직였을 때, 또는 0.5초 넘게 거의 못 움직였을 때(끼임) 다시 계산
//   봇마다 재계산 시점을 나눠 같은 프레임에 몰리지 않게 함 (모바일 부담 최소화)
// - 맵(벽)이 바뀌면 resetNav() 로 격자를 다시 만듦 (무한 생존 맵 전환)

let navSeq = 0;
const NAV_CELL = 12;
const NAVS = {}; // 반경별 격자
let navStats = { paths: 0, ms: 0 };
function navRadius(a) {
  const r = (a && a.r) || 16;
  return r <= 18 ? 16 : Math.ceil(r / 4) * 4; // 17~18 은 보통 크기로 (좁은 길 막힘 방지)
}
function resetNav() {
  for (const k in NAVS) delete NAVS[k];
}
function navOf(r = 16) {
  if (NAVS[r]) return NAVS[r];
  const cs = NAV_CELL, cols = Math.ceil(W / cs), rows = Math.ceil(H / cs), n = cols * rows;
  const N = { r, cell: cs, cols, rows, walk: new Uint8Array(n), g: new Float32Array(n), from: new Int32Array(n), stamp: new Int32Array(n), closed: new Int32Array(n), run: 0 };
  for (let row = 0; row < rows; row++) for (let c2 = 0; c2 < cols; c2++) {
    const x = (c2 + 0.5) * cs, y = (row + 0.5) * cs;
    N.walk[row * cols + c2] = x >= r + 2 && x <= W - r - 2 && y >= r + 2 && y <= H - r - 2 && !terrain(x, y, r) && !blocked(x, y, r + 3) && !nearBox(x, y, r + 14) ? 1 : 0; // 벽과 3px 여유: 경로 지점이 벽에 딱 붙으면 축별 이동이 막혀 제자리 떨림
  }
  return (NAVS[r] = N);
}
// 예전 이름 호환
function buildNav() {
  resetNav();
  navOf(16);
}
function navCell(N, x, y) {
  const c2 = clamp(Math.floor(x / N.cell), 0, N.cols - 1), r = clamp(Math.floor(y / N.cell), 0, N.rows - 1);
  return r * N.cols + c2;
}
// 막힌 칸이면 가장 가까운 지나갈 수 있는 칸 (최대 반경 8칸)
function nearestWalkable(N, i) {
  if (N.walk[i]) return i;
  const c0 = i % N.cols, r0 = (i / N.cols) | 0;
  for (let d = 1; d <= 8; d++) {
    let best = -1, bd = Infinity;
    for (let r = r0 - d; r <= r0 + d; r++) for (let c2 = c0 - d; c2 <= c0 + d; c2++) {
      if (r < 0 || c2 < 0 || r >= N.rows || c2 >= N.cols) continue;
      if (Math.max(Math.abs(r - r0), Math.abs(c2 - c0)) !== d) continue;
      const j = r * N.cols + c2, dd = (r - r0) ** 2 + (c2 - c0) ** 2;
      if (N.walk[j] && dd < bd) {
        bd = dd;
        best = j;
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}
// 몸 반경 r 로 직선 이동이 가능한지 (벽·물·상자)
function walkLine(ax, ay, bx, by, r = 16) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 8);
  for (let i = 1; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
    if (terrain(x, y, r) || blocked(x, y, r) || nearBox(x, y, r + 14)) return false;
  }
  return true;
}
// 지나갈 수 있는 가장 가까운 자리 (스폰·순간이동·밀려난 위치 보정). 없으면 null
function freeSpot(x, y, r = 16) {
  if (!terrain(x, y, r) && !blocked(x, y, r) && !nearBox(x, y, r + 14) && x >= r && y >= r && x <= W - r && y <= H - r) return { x, y };
  const N = navOf(navRadius({ r })), j = nearestWalkable(N, navCell(N, x, y));
  return j < 0 ? null : { x: (j % N.cols + 0.5) * N.cell, y: (((j / N.cols) | 0) + 0.5) * N.cell };
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
function findPath(ax, ay, bx, by, rad = 16) {
  const NAV = navOf(rad), t0 = performance.now();
  const s = nearestWalkable(NAV, navCell(NAV, ax, ay)), t = nearestWalkable(NAV, navCell(NAV, bx, by));
  if (s < 0 || t < 0) return null;
  const cols = NAV.cols, tc = t % cols, tr = (t / cols) | 0;
  const run = ++NAV.run;
  navHeap.idx.length = navHeap.f.length = 0;
  NAV.stamp[s] = run;
  NAV.g[s] = 0;
  NAV.from[s] = -1;
  heapPush(s, 0);
  let found = false, guard = 0, bestI = s, bestH = Infinity;
  while (navHeap.idx.length && guard++ < 20000) {
    const i = heapPop();
    if (i === t) {
      found = true;
      break;
    }
    const hi = Math.hypot(i % cols - tc, ((i / cols) | 0) - tr); // 못 가는 곳이면 가장 가까이 갈 수 있는 칸까지라도
    if (hi < bestH) {
      bestH = hi;
      bestI = i;
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
  navStats.paths++;
  navStats.ms += performance.now() - t0;
  const end = found ? t : bestI; // 목표에 못 닿으면(몸이 커서 못 지나가는 틈 등) 가장 가까운 칸으로
  if (!found && end === s) return null;
  const path = [];
  for (let i = end; i >= 0; i = NAV.from[i]) path.push([(i % cols + 0.5) * NAV.cell, (((i / cols) | 0) + 0.5) * NAV.cell]);
  path.reverse();
  if (found) path[path.length - 1] = [bx, by];
  return path;
}

// a 를 (tx, ty) 쪽으로 한 스텝 이동. 실제로 움직였으면 true
function steer(a, tx, ty, dt) {
  const rad = navRadius(a);
  const nav = a._nav || (a._nav = { path: null, i: 0, t: -1, tx: 0, ty: 0, direct: true, sx: a.x, sy: a.y, st: 0 });
  // 끼임 감지: 0.5초 동안 6px 도 못 움직였으면 바로 경로 재탐색
  nav.st += dt;
  let stuck = false;
  if (nav.st >= 0.5) {
    stuck = Math.hypot(a.x - nav.sx, a.y - nav.sy) < 6 && Math.hypot(tx - a.x, ty - a.y) > 40;
    nav.sx = a.x;
    nav.sy = a.y;
    nav.st = 0;
  }
  if (elapsed >= nav.t || Math.hypot(tx - nav.tx, ty - nav.ty) > 48 || stuck) {
    if (nav.seq === undefined) nav.seq = navSeq++ % 5;
    nav.t = elapsed + 0.4 + nav.seq * 0.05;
    nav.tx = tx;
    nav.ty = ty;
    nav.direct = !stuck && walkLine(a.x, a.y, tx, ty, rad);
    nav.path = nav.direct ? null : findPath(a.x, a.y, tx, ty, rad);
    nav.i = 0;
    if (stuck) nav.raw = elapsed + 1.2; // 끼였으면 잠시 경로 다듬기 없이 격자 지점을 하나씩 따라감 (격자 지점끼리는 항상 지나갈 수 있음)
  }
  let gx = tx, gy = ty;
  const path = nav.path;
  if (!nav.direct && path) {
    while (nav.i < path.length - 1 && Math.hypot(path[nav.i][0] - a.x, path[nav.i][1] - a.y) < 8) nav.i++;
    // 경로 다듬기: 앞쪽 지점 중 직선으로 보이는 가장 먼 곳을 바로 향함
    if (!(nav.raw > elapsed)) for (let j = Math.min(path.length - 1, nav.i + 6); j > nav.i; j--) {
      if (walkLine(a.x, a.y, path[j][0], path[j][1], rad)) {
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
