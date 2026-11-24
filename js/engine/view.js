// 화면(캔버스) 크기 맞추기
//
// PC: 기존과 같이 1000×650 고정.
// 모바일(터치 모드): 게임 화면이 폰 화면 전체를 채우도록 캔버스 비율을 화면 비율에 맞춘다.
//   세로로 보이는 월드 높이를 MOBILE_VIEW_H 로 줄여서 캐릭터가 더 크게 보인다
//   (예전 650 → 480, 가로 폰 기준 약 1.35배 확대). 가로 폭은 화면 비율만큼 넓어진다.
// 선명도: 캔버스 내부 해상도를 기기 픽셀에 맞춰 올린다 (최대 2배, 성능 보호).

const MOBILE_VIEW_H = 480;
let viewScale = 1;

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
