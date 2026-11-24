// 화면(캔버스) 크기 맞추기
//
// PC: 기존과 같이 1000×650 고정.
// 모바일(터치 모드): 게임 화면이 폰 화면 전체를 채우도록 캔버스 비율을 화면 비율에 맞춘다.
//   세로로 보이는 월드 높이를 MOBILE_VIEW_H 로 줄여서 캐릭터가 더 크게 보인다
//   (예전 650 → 480, 가로 폰 기준 약 1.35배 확대). 가로 폭은 화면 비율만큼 넓어진다.
// 선명도: 캔버스 내부 해상도를 기기 픽셀에 맞춰 올린다 (최대 2배, 성능 보호).

const MOBILE_VIEW_H = 480;
// 캔버스 내부 픽셀 상한 (모바일 발열·프레임 드랍 방지). 실제 배율은 프레임 상황에 따라 자동 조절
const MAX_BACKING_PIXELS = 1.4e6;
let viewScale = 1, qualityScale = 1;

function fitCanvas() {
  const mobile = document.body.classList.contains("mobile");
  let vw = 1000, vh = 650, k = 1;
  // 세로로 든 폰: 게임 화면을 90도 돌려서 가로로 표시 (CSS body.rot)
  const rot = mobile && window.innerHeight > window.innerWidth;
  document.body.classList.toggle("rot", rot);
  if (mobile) {
    const sw = rot ? window.innerHeight : window.innerWidth, sh = rot ? window.innerWidth : window.innerHeight;
    vh = MOBILE_VIEW_H;
    vw = Math.round(clamp(vh * sw / Math.max(1, sh), 480, W));
    k = clamp(sh * (window.devicePixelRatio || 1) / vh, 1, 2);
    k = Math.min(k, Math.sqrt(MAX_BACKING_PIXELS / (vw * vh)));
    k = Math.max(1, k * qualityScale);
  }
  VW = vw;
  VH = vh;
  viewScale = k;
  const bw = Math.round(vw * k), bh = Math.round(vh * k);
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
}

// 매 프레임 그리기 전에 호출: 논리 좌표(VW×VH)로 그리도록 배율 설정
function beginFrame() {
  g.setTransform(viewScale, 0, 0, viewScale, 0, 0);
}

window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", () => setTimeout(fitCanvas, 200));

// 자동 화질 조절: 최근 2초 평균 프레임 간격이 22ms(약 45fps)보다 길면 해상도를 한 단계 낮추고,
// 5초 이상 여유(14ms 이하)가 있으면 한 단계 올림. 모바일에서만 동작
const perfWin = { sum: 0, n: 0, since: 0, last: 0 };
function trackFrame(t) {
  if (!document.body.classList.contains("mobile")) return;
  if (perfWin.last) {
    const d = t - perfWin.last;
    if (d < 250) { // 백그라운드 복귀 등 긴 공백은 제외
      perfWin.sum += d;
      perfWin.n++;
    }
  }
  perfWin.last = t;
  if (!perfWin.since) perfWin.since = t;
  const span = t - perfWin.since;
  if (span < 2000 || perfWin.n < 30) return;
  const avg = perfWin.sum / perfWin.n;
  let q = qualityScale;
  if (avg > 22 && q > 0.5) q = Math.max(0.5, q - 0.15);
  else if (avg < 14 && span > 5000 && q < 1) q = Math.min(1, q + 0.15);
  else if (avg <= 22 && !(avg < 14 && span > 5000)) {
    if (span > 5000) Object.assign(perfWin, { sum: 0, n: 0, since: t });
    return;
  }
  Object.assign(perfWin, { sum: 0, n: 0, since: t });
  if (q !== qualityScale) {
    qualityScale = q;
    fitCanvas();
  }
}
