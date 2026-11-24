// 시작과 메인 루프
//
// 고정 시간 간격(1/60초) 업데이트 + 누적기 방식 (버그 수정 3.7).
// 예전에는 dt 를 0.035초로 잘라서, 28fps 아래로 떨어지면 게임 전체가 느리게 흘렀다.
// 이제는 프레임이 떨어져도 게임 속도는 실제 시간과 같고, 그리기만 덜 한다.

const STEP = 1 / 60;
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

let overShown = "";
function syncOverButton() {
  // 게임이 끝나면 캔버스 위에 "다시 하기" 버튼 표시 (모바일에서 R 키 없이 재시작)
  if (overShown === over) return;
  overShown = over;
  el("overBtn").hidden = !over;
}

fitCanvas();
reset();
function loop(t) {
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
  if (document.body.classList.contains("menuOpen")) acc = 0;
  while (acc >= STEP - 1e-9 && n < MAX_STEPS) {
    updateMouseWorld();
    update(STEP);
    acc -= STEP;
    n++;
  }
  if (n === MAX_STEPS) acc = 0;
  draw();
  touchHUD();
  syncOverButton();
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
