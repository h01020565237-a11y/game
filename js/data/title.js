// ===== 타이틀 화면 데이터 (v2: assets/title_screen/reference/title_concept_v2.png 구도 기준) =====
// v1 백업: archive/title_v1/
// 배경·로고·캐릭터는 각각 별도 레이어. 캐릭터는 승인된 전신 원본 PNG(assets/characters/full/, 받은 파일 그대로)를 사용.
// 원본마다 투명 여백이 달라도 화면에 그릴 때 그림 영역을 재서 키·발·가운데를 맞춤 (파일은 수정하지 않음)

const TITLE_ART = {
  // 원본: assets/title_screen/*.png (1672×941). 게임에서는 용량을 줄인 WebP 사용 (로고는 투명 여백만 잘라냄)
  background: "assets/title_screen/school_background.webp",
  logo: "assets/title_screen/juyeop_logo.webp",
};

// 캐릭터 목록 (그리는 순서: 뒷줄 → 앞줄 → 가운데 주인공)
//   row: "hero"(가운데 주인공) | "back"(뒷줄) | "front"(앞줄)
//   x: 그림 가로 가운데(무대 가로 %), y: 발 위치(무대 세로 %, 100 넘으면 화면 아래로 잘림), h: 키(무대 세로 %)
//   x·y·h 를 비워 두면 그 줄의 빈자리에 자동 배치 → 캐릭터를 추가할 때는 { id, img, row } 만 넣으면 됨
//   아래 값은 새 시안의 머리 위치·크기에 맞춤 (원본 PNG 의 머리~턱 비율로 키를 계산)
const TITLE_CHARACTERS = [
  { id: "runner", img: "assets/characters/full/runner.png", row: "back", x: 21, y: 88, h: 50 },
  { id: "support", img: "assets/characters/full/support.png", row: "back", x: 36, y: 76, h: 36 },
  { id: "summoner", img: "assets/characters/full/summoner.png", row: "back", x: 69, y: 75, h: 36 },
  { id: "bear", img: "assets/characters/full/bear.png", row: "front", x: 17, y: 106, h: 45 },
  { id: "stripe", img: "assets/characters/full/stripe.png", row: "front", x: 31, y: 108, h: 49 },
  { id: "soccer", img: "assets/characters/full/soccer.png", row: "front", x: 64, y: 103, h: 43 },
  { id: "octo", img: "assets/characters/full/octo.png", row: "front", x: 81, y: 112, h: 57 },
  { id: "suit", img: "assets/characters/full/suit.png", row: "hero", x: 51, y: 120, h: 80 }, // 동기: 가운데
];

const TITLE_LAYOUT = {
  logo: { w: 37, top: 0.5 },          // 로고 너비(무대 가로 %), 위 여백(세로 %)
  // 자동 배치용 줄 설정: 빈자리 후보 x(가운데에서 가까운 순으로 좌우 번갈아 사용), 발 위치·키
  rows: {
    hero: { y: 120, h: 80, xs: [50] },
    back: { y: 77, h: 38, xs: [36, 64, 21, 79, 8, 92] },
    front: { y: 105, h: 46, xs: [31, 69, 17, 83, 5, 95] },
  },
  minGap: 9,                          // 자동 배치 때 같은 줄 캐릭터와 최소 간격(가로 %)
};

const GAME_VERSION = "Ver. 1.0.0";
