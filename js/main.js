// 시작과 메인 루프
//
// 고정 시간 간격(1/60초) 업데이트 + 누적기 방식 (버그 수정 3.7).
// 예전에는 dt 를 0.035초로 잘라서, 28fps 아래로 떨어지면 게임 전체가 느리게 흘렀다.
// 이제는 프레임이 떨어져도 게임 속도는 실제 시간과 같고, 그리기만 덜 한다.

const STEP = 1 / 60;
// ----- 그리기 보간 (2026-11-25 이동 버벅임 수정) -----
// 원인: 게임 계산은 1/60초 고정인데 그림은 화면 주사율마다 그려서, 120Hz 폰에선 두 번에 한 번 같은 자리가 그려지고
//       60Hz 에서도 프레임 간격이 흔들리면 한 프레임에 0번·2번 계산돼 끊겨 보였음
// 해결: 스텝 직전 위치를 기억해 두고, 그릴 때만 '직전 위치 → 현재 위치' 사이를 남은 시간 비율로 이어 그림 (계산·판정은 그대로)
const INTERP_JUMP = 90; // 한 스텝에 이보다 많이 움직이면(순간이동·리스폰) 보간 안 함
function interpActors() {
  const out = [p];
  for (const a of bots) out.push(a);
  if (pet) out.push(pet);
  for (const a of ultPets) out.push(a);
  for (const a of clones) out.push(a);
  for (const s of shots) out.push(s);
  if (singleRun) for (const s of mobShots) out.push(s);
  return out;
}
function snapPrev() {
  for (const a of interpActors()) {
    a._px = a.x;
    a._py = a.y;
  }
}
function applyInterp(alpha) {
  const saved = [];
  if (alpha >= 1) return saved;
  for (const a of interpActors()) {
    if (a._px === undefined) continue;
    const dx = a.x - a._px, dy = a.y - a._py;
    if (Math.abs(dx) + Math.abs(dy) > INTERP_JUMP || (dx === 0 && dy === 0)) continue;
    saved.push(a, a.x, a.y);
    a.x = a._px + dx * alpha;
    a.y = a._py + dy * alpha;
  }
  return saved;
}
function restoreInterp(saved) {
  for (let i = 0; i < saved.length; i += 3) {
    saved[i].x = saved[i + 1];
    saved[i].y = saved[i + 2];
  }
}
const MAX_STEPS = 8; // 한 프레임에 따라잡을 최대 스텝 수 (약 0.13초)
let acc = 0;

function drawLoading() {
  g.fillStyle = "#17232b";
  g.fillRect(0, 0, VW, VH);
  g.fillStyle = "#b6c5a1";
  g.font = "24px sans-serif";
  g.textAlign = "center";
  g.fillText("Battle Lab 로딩 중…", VW / 2, VH / 2 - 24);
  g.fillStyle = "#26332b";
  g.fillRect(VW / 2 - 160, VH / 2, 320, 14);
  g.fillStyle = "#7de36c";
  g.fillRect(VW / 2 - 160, VH / 2, 320 * assetsProgress(), 14);
}

fitCanvas();
reset();
function loop(t) {
  trackFrame(t);
  beginFrame();
  if (!assetsReady()) {
    last = t;
    drawLoading();
    requestAnimationFrame(loop);
    return;
  }
  acc += Math.min(MAX_STEPS * STEP, (t - last) / 1e3 || 0);
  last = t;
  let n = 0;
  // 모바일 메뉴가 열려 있으면 게임 일시정지
  // 로비·메뉴가 열려 있으면 게임 일시정지
  // 일시정지 메뉴(paused)·로비·컷신·(테스트용 menuOpen) 동안 시뮬레이션 전체 정지: 적 AI·이동·공격·웨이브 타이머·스킬 시간
  if (document.body.classList.contains("paused") || document.body.classList.contains("menuOpen") || document.body.classList.contains("lobbyOpen") || document.body.classList.contains("csOpen")) acc = 0;
  while (acc >= STEP - 1e-9 && n < MAX_STEPS) {
    snapPrev(); // 그리기 보간용: 이번 스텝 전 위치
    updateMouseWorld();
    update(STEP);
    tickSummonAim(STEP);
    acc -= STEP;
    n++;
  }
  if (n === MAX_STEPS) acc = 0;
  const lerped = applyInterp(Math.min(1, acc / STEP)); // 계산은 1/60초 고정, 그림은 그 사이를 이어서 (120Hz·프레임 흔들림에서 끊김 방지)
  draw();
  restoreInterp(lerped);
  touchHUD();
  uiFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 다른 앱/탭으로 갔다 오면 밀린 시간을 한꺼번에 처리하지 않도록 초기화
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    last = performance.now();
    acc = 0;
  }
});
