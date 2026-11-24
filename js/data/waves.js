// ===== 싱글모드: 웨이브 생존전 데이터 (docs/SINGLE_WAVE_PROTOTYPE.md) =====
// 수치는 모두 여기서 조정. 배틀로얄 모드 데이터(weapons, DROP_TABLE 등)와 분리.
// 적 그림은 전용 에셋이 오기 전까지 캔버스 도형으로 임시 표시 (js/render/mobs.js)

// 적 종류
//   hp 체력, spd 이동 속도 배율(기본 이동 150 기준), r 몸 크기, dmg 공격 피해, range 공격 거리, cd 공격 간격(초)
//   keep: 원거리 적이 유지하려는 거리 [최소, 최대], shot: 투사체 속도
const MOB_TYPES = {
  melee: { name: "가시 덩굴", hp: 420, spd: 0.58, r: 17, dmg: 85, range: 34, cd: 1.2, color: "#3f9a4a", accent: "#bfe86b" },
  ranged: { name: "포자 버섯", hp: 320, spd: 0.5, r: 16, dmg: 70, range: 260, cd: 2.2, keep: [170, 250], shot: 235, color: "#8a4fb8", accent: "#f2c6ff" },
  boss: {
    name: "정글 거목", hp: 5500, spd: 0.48, r: 34, dmg: 130, range: 48, cd: 1.3, color: "#6b4a2c", accent: "#9be15d",
    // 패턴: 순서대로 돌아가며 사용. tele 예고 시간(초), 체력이 enrageAt 이하면 예고·대기 시간 enrageMul 배
    patterns: [
      { kind: "slam", tele: 0.9, radius: 110, dmg: 350, rest: 1.2 },          // 내려찍기: 발밑 원 범위
      { kind: "ring", tele: 0.7, count: 10, dmg: 90, speed: 220, rest: 1.0 }, // 포자 고리: 사방 투사체
      { kind: "charge", tele: 0.8, speed: 520, dist: 420, dmg: 320, rest: 1.4 }, // 돌진: 예고선 방향으로 돌격
    ],
    summonAt: [0.6, 0.3],   // 체력 60%, 30%에서 가시 덩굴 소환
    summonCount: 2,
    enrageAt: 0.3,
    enrageMul: 0.7,
  },
};

// 강화 카드 (웨이브 사이에 무작위 중복 없이 3장 중 1장 선택). 미션이 끝나면 초기화
//   apply: 이번 미션의 플레이어(p)에만 적용. 배틀로얄 상태와 섞이지 않음
const WAVE_CARDS = [
  { id: "atk", name: "공격력 +20%", desc: "모든 공격 피해 증가", icon: "⚔️", apply: (a) => (a.dmgMul = (a.dmgMul || 1) * 1.2) },
  { id: "hp", name: "최대 체력 +20%", desc: "늘어난 만큼 바로 회복", icon: "❤️", apply: (a) => { const add = a.max * 0.2; a.max += add; a.hp += add; } },
  { id: "charge", name: "공격 충전 +15%", desc: "공격 칸 충전 속도 증가", icon: "🔋", apply: (a) => (a.reloadMul = (a.reloadMul || 1) / 1.15) },
  { id: "speed", name: "이동 속도 +10%", desc: "더 빠르게 이동", icon: "👟", apply: (a) => (a.spd = (a.spd || 1) * 1.1) },
  { id: "cdr", name: "스킬 쿨타임 -15%", desc: "스킬이 더 빨리 돌아옴", icon: "⏱️", apply: (a) => (a.cdRate = (a.cdRate || 1) / 0.85) },
  { id: "guard", name: "받는 피해 -10%", desc: "모든 피해 감소", icon: "🛡️", apply: (a) => (a.takeMul = (a.takeMul || 1) * 0.9) },
];

// 미션
//   waves: 순서대로 진행, 전원 처치 시 다음 웨이브. spawn 은 순서대로 interval 초마다 1마리씩 등장 (동시 최대 maxAlive)
//   cardsAfter: 이 웨이브가 끝나면 강화 카드 선택
const WAVE_MISSIONS = {
  hyeongon: {
    title: "현곤 영입 미션",
    sub: "웨이브 생존전",
    player: "suit",          // 동기
    reward: "summoner",      // 현곤
    zone: false,             // 테스트: 자기장 축소 끔
    startDelay: 2,
    waves: [
      { label: "1웨이브", spawn: [["melee", 8]], interval: 1.0, maxAlive: 5, cardsAfter: true },
      { label: "2웨이브", spawn: [["melee", 5], ["ranged", 2], ["melee", 5], ["ranged", 2]], interval: 1.4, maxAlive: 6, cardsAfter: true },
      { label: "최종 웨이브", spawn: [["melee", 4], ["ranged", 2], ["boss", 1], ["melee", 4], ["ranged", 2]], interval: 1.4, maxAlive: 6 },
    ],
    spawnMinDist: 360,       // 플레이어와 이만큼 떨어진 곳에서 등장
    clearHeal: 0.4,          // 웨이브를 넘길 때 최대 체력의 이만큼 회복
  },
};
