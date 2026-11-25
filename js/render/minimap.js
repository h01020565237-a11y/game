// ===== 미니맵 (2026-11-25 통합 요청 5장) =====
// 중앙 하단, 화면 너비 약 17%, 반투명. 실제 위치와 연동:
//   플레이어 파란 화살표 · 적 빨강 · 상자 노랑 · 소환수(포켓몬·분신) 초록 · 은숙(보호 대상) 분홍 · 지금 화면 범위 흰 테두리
// 시야(싱글·웨이브)가 켜져 있으면 시야에 보이는 적만 표시 (미니맵으로 시야를 우회하지 않게)
// 성능: 벽은 맵·크기가 바뀔 때만 따로 그려 두고(캐시), 점들은 2프레임에 한 번
const MINIMAP = { every: 2, dot: 2.2 };
let mmFrame = 0, mmCache = null;
function drawMinimap() {
  const cv = document.getElementById("minimap");
  if (!cv || document.body.classList.contains("lobbyOpen") || document.body.classList.contains("titleOpen")) return;
  if (++mmFrame % MINIMAP.every) return;
  const cw = Math.max(60, Math.round(cv.clientWidth * (window.devicePixelRatio || 1)));
  const ch = Math.round(cw * H / W);
  if (cv.width !== cw || cv.height !== ch) {
    cv.width = cw;
    cv.height = ch;
  }
  const k = cw / W, m = cv.getContext("2d");
  const key = (activeMap?.id || "jungle") + ":" + cw;
  if (!mmCache || mmCache.key !== key) { // 벽 (맵 바뀔 때만)
    const c2 = document.createElement("canvas");
    c2.width = cw;
    c2.height = ch;
    const g2 = c2.getContext("2d");
    g2.fillStyle = "rgba(160, 180, 220, 0.55)";
    for (const [x, y, w, h] of walls) g2.fillRect(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k));
    g2.fillStyle = "rgba(70, 160, 90, 0.35)";
    for (const [x, y, w, h] of bushes) g2.fillRect(x * k, y * k, w * k, h * k);
    mmCache = { key, c: c2 };
  }
  m.clearRect(0, 0, cw, ch);
  m.drawImage(mmCache.c, 0, 0);
  const R = MINIMAP.dot * (cw / 160);
  const dot = (x, y, col, r = R) => {
    m.fillStyle = col;
    m.beginPath();
    m.arc(x * k, y * k, r, 0, 7);
    m.fill();
  };
  for (const b of boxes) if (!b.broken) dot(b.x, b.y, "#ffd23f", R * 0.9);
  for (const a of bots) {
    if (a.hp <= 0) continue;
    if (singleRun ? !mobShown(a) : !visible(p, a)) continue;
    dot(a.x, a.y, a.bossId || a.mob === "boss" ? "#ff2a2a" : "#ff5a5a", a.bossId || a.mob === "boss" ? R * 1.8 : R);
  }
  for (const a of [pet, ...ultPets, ...clones]) if (a && a.hp > 0) dot(a.x, a.y, "#5cff7a");
  if (singleRun?.ward && singleRun.ward.hp > 0) dot(singleRun.ward.x, singleRun.ward.y, "#ff8fd0", R * 1.4);
  // 화면 범위
  m.strokeStyle = "rgba(255,255,255,0.6)";
  m.lineWidth = Math.max(1, cw / 160);
  m.strokeRect(camX * k, camY * k, VW * k, VH * k);
  // 플레이어: 바라보는 방향 화살표
  const v = ((p.lastMoveDir ?? p.dir ?? 4) * Math.PI) / 4, s = R * 2.6, px = p.x * k, py = p.y * k;
  m.save();
  m.translate(px, py);
  m.rotate(v);
  m.fillStyle = "#3aa0ff";
  m.strokeStyle = "#ffffff";
  m.lineWidth = Math.max(1, cw / 200);
  m.beginPath();
  m.moveTo(0, -s);
  m.lineTo(s * 0.7, s * 0.7);
  m.lineTo(0, s * 0.3);
  m.lineTo(-s * 0.7, s * 0.7);
  m.closePath();
  m.fill();
  m.stroke();
  m.restore();
}
