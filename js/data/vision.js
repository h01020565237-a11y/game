// ===== 시야·풀숲 규칙 (2026-11-25 요청). 숫자는 모두 초기 테스트값 =====
// 싱글(영입 미션)·웨이브(무한 생존)에서 켜짐. PvP 는 같은 함수(visible / inSight)로 나중에 켤 수 있게 on.pvp 만 false
// 캐릭터 시야 반경은 CHARACTER_STATS[캐릭터].sight (js/data/characters.js)
const VISION = {
  on: { single: true, wave: true, pvp: false },
  petSight: 250,          // 소환 포켓몬 시야 (현곤과 공유)
  enemySight: 480,        // 일반 적이 플레이어를 알아보는 거리 (ENEMY_TYPES[k].sight 로 개별 조정)
  memory: 5,              // 적이 마지막으로 본 자리를 기억하는 시간(초) → 그 자리로 가서 주변을 찾음
  search: 130,            // 놓친 뒤 주변을 찾는 반경
  edge: 70,               // 시야 경계 그라데이션 폭
  dark: 0.6,              // 시야 밖 어둡기
  tint: "8, 12, 30",      // 시야 밖 색 (푸르스름하게 어둡게)
  maskScale: 0.25,        // 어둠 마스크 해상도 (화면의 1/4 로 그려서 늘림 → 부드러운 경계 + 모바일 성능)
  sightCard: 0.15,        // 시야 강화 카드 1장당 시야 +15%
};
// 풀숲: 안에 있으면 밖에서 안 보임. 같은 풀숲·가까이(near) 는 보임. 공격하면 attackReveal 초, 맞으면 hitReveal 초 동안 위치 노출
const BUSH_RULES = { near: 75, attackReveal: 2, hitReveal: 1 };
// 소환 포켓몬 이동 AI (현곤 일반·궁극기·진화·전설 공통)
const PET_AI = {
  leash: 400,             // 현곤 기준 최대 활동 반경: 넘으면 공격 중단하고 복귀
  follow: [60, 100],      // 평소 현곤과 유지하는 거리
  arrive: 18,             // 대기 자리에 도착했다고 보는 거리
  personal: 44,           // 현곤에게 이보다 가까우면 비켜 섬 (이동 방해 금지)
  sep: 36,                // 포켓몬끼리 이보다 가까우면 서로 밀어냄
  spread: 0.9,            // 대기 자리 각도 간격 (라디안, 현곤 뒤쪽 부채꼴)
};
