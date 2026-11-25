// ===== 타이틀 화면 데이터 (최종: 완성 이미지 1장 그대로 사용) =====
// 이전 버전 백업: archive/title_v1 (배경+로고+자동 배치), archive/title_v2 (캐릭터 PNG 로 시안 재구성)
// 이미지는 받은 파일 그대로(바이트 동일) 사용. 구도·캐릭터·로고·배경을 다시 만들지 않음.
// 버튼은 이미지 위에 투명하게 겹친 실제 버튼. 위치는 이미지 기준 %(가로·세로)

const TITLE_IMAGE = {
  src: "assets/title_screen/title_final.webp", // 2026-11-25: PNG 2.5MB → webp 376KB (같은 그림, 첫 로딩 단축)
  width: 1672,
  height: 941,
  // 그림 속 "TAP TO START" 막대 영역
  start: { x: 34.5, y: 88.0, w: 30.9, h: 8.2 },
  // 그림 속 설정(톱니) 아이콘: 가운데 (cx, cy), 지름 d (가로 % 기준)
  settings: { cx: 4.5, cy: 93.1, d: 5.6 },
};
