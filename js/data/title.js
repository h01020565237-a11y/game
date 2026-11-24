// ===== 타이틀 화면 데이터 =====
// 배경·로고·캐릭터는 각각 별도 레이어. 캐릭터는 이미지에 합성하지 않고 확정된 전신 이미지(LOBBY_ART.full)를 따로 배치.
// 캐릭터를 늘리거나 빼려면 TITLE_CHARACTERS 목록만 바꾸면 됨 (배경·로고 수정 불필요)

const TITLE_ART = {
  // 원본: assets/title_screen/*.png (1672×941). 게임에서는 용량을 줄인 WebP 사용 (로고는 투명 여백만 잘라냄)
  background: "assets/title_screen/school_background.webp",
  logo: "assets/title_screen/juyeop_logo.webp",
};

// 표시 순서 = 왼쪽에서 오른쪽. 가운데는 시작 버튼 자리로 비워 두고 양쪽으로 나눠 배치.
// 선택 항목: x(0~100, 화면 가로 %), y(발 위치, 화면 세로 %), h(키, 화면 세로 %), flip(좌우 반전), back(뒷줄)
// 지정하지 않으면 인원 수에 맞춰 자동 배치
const TITLE_CHARACTERS = [
  { id: "support" },
  { id: "octo" },
  { id: "summoner" },
  { id: "suit" },
  { id: "runner" },
  { id: "stripe" },
  { id: "soccer" },
  { id: "bear" },
];

const TITLE_LAYOUT = {
  logo: { w: 54, top: 2 },             // 로고 너비(화면 가로 %), 위 여백(세로 %)
  centerGap: 26,                       // 가운데 시작 버튼 자리 (가로 %)
  side: 3,                             // 좌우 끝 여백 (가로 %)
  front: { y: 99, h: 46 },             // 앞줄 발 위치·키 (세로 %)
  back: { y: 90, h: 38 },              // 뒷줄
};

const GAME_VERSION = "claude-dev 테스트";
