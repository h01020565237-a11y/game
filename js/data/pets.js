// 포켓몬: [이름, 아이콘, 공격력, 사거리, HP]

const mons = [["피카츄", "⚡", 160, 150, 800], ["파이리", "🔥", 180, 130, 850], ["꼬부기", "💧", 150, 150, 1e3], ["이상해씨", "🌿", 140, 130, 1e3], ["고오스", "👻", 170, 160, 750], ["잠만보", "💤", 230, 55, 1800], ["라프라스", "❄", 160, 170, 1200], ["푸린", "♫", 120, 80, 900]];

// 포켓몬 선택 화면용 아이콘·색 (아이콘 그림이 오면 img 에 경로를 넣으면 이모지 대신 표시)
// 속성별 공격 이펙트 (기본형 번호 기준, 진화형은 기본형을 따름). fx: bolt 전기 / flame 불꽃 / water 물줄기 / 그 밖은 색 광선
const PET_ELEMENTS = {
  0: { fx: "bolt", color: "#ffe14d" }, 1: { fx: "flame", color: "#ff6a2a" }, 2: { fx: "water", color: "#4aa8ff" }, 3: { fx: "beam", color: "#6fd36b" },
  4: { fx: "beam", color: "#9a6cd9" }, 5: { fx: "beam", color: "#c8c8d8" }, 6: { fx: "beam", color: "#9fe8ff" }, 7: { fx: "beam", color: "#f29cc0" },
  legend: { fx: "beam", color: "#fff6c8" },
};
// 소환체 그림 크기 (스프라이트 확대 배율, 픽셀 아트라 정수 근처가 깔끔)
const PET_DRAW = { spriteScale: 2.4, artSize: 50 };
const PET_LOOK = [
  { color: "#f7c948" }, { color: "#f28b3c" }, { color: "#4aa3e8" }, { color: "#5cbf6b" },
  { color: "#8a64c9" }, { color: "#9aa3b5" }, { color: "#7fd4e6" }, { color: "#f29cc0" },
];
