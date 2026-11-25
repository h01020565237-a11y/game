// ===== 무한 생존 데이터 (docs/ENDLESS_SURVIVAL_V1.md) =====
// 스토리 미션·배틀로얄과 분리. 모든 수치는 QA 에서 조정하도록 여기 모음.
// "기획서" = 기획서에 적힌 초기값, "제안" = 기획서 미정이라 Claude 가 넣은 초기 테스트값

const ENDLESS = {
  normalTime: 60,            // 일반 웨이브 생존 시간(초) — 기획서
  bossEvery: 5,              // 5의 배수 웨이브는 보스 — 기획서
  heal: { clear: 0.2, boss: 0.5 },        // 웨이브 클리어 회복 (최대 HP 비율) — 기획서
  dropHeal: { chance: 0.03, amount: 0.1 }, // 적 처치 시 회복 아이템 — 기획서
  rarity: { common: 65, rare: 25, legend: 10 }, // 카드 등장 확률(%) — 기획서
  countdown: 3,              // 웨이브 시작 전 카운트다운(초) — 기획서 제안
  resetSkillCD: true,        // 웨이브 전환 시 일반 스킬 쿨타임 초기화 — 기획서 제안
  exp: { base: 50, per: 15 },// 다음 레벨 요구 = base + per × (현재 레벨 - 1) — 기획서
  scale: { hp: 1.1, atk: 1.07, spdPer: 0.015, spdMax: 1.5 }, // 웨이브 W 배율: hp^(W-1), atk^(W-1), min(spdMax, 1+spdPer×(W-1)) — 기획서
  after20: { add: 5, max: 150 },          // 21 웨이브 이후 일반 웨이브 총수량 +5, 최대 150 — 기획서
  maxAlive: 24,              // 화면에 동시에 있는 적 최대 수 — 제안 (모바일 성능)
  spawnMinDist: 380,         // 플레이어와 이만큼 떨어진 곳에서 등장 — 제안
  bossIntro: 2,              // 보스 등장 연출 (전투 정지·무피해) — 기획서
  bossStatusMul: 0.5,        // 보스는 기절·둔화·이동불가 시간 절반 — 기획서 "상태이상 효과 감소" (배율은 제안)
};

// 적 유형 (일반 적은 대표 패턴만). visual = 타락한 캐릭터 그림, exp 경험치 — 기획서. 능력치는 제안
//   hp 체력 (2026-11-25 상향: 기본 공격 3번 안에 죽던 문제 → 근접 520·원거리 400·기동 450·탱커 1300·투척 450·암살 480·지원 500·소환 600, 초기 제안), spd 이동 배율(150 기준), dmg 공격 피해, range 공격 거리, cd 공격 간격, r 몸 크기
const ENEMY_TYPES = {
  melee: { name: "근접", visual: "suit", exp: 10, hp: 520, spd: 0.62, dmg: 55, range: 34, cd: 1.1, r: 16 },
  ranged: { name: "원거리", visual: "soccer", exp: 15, hp: 400, spd: 0.52, dmg: 50, range: 270, cd: 2.0, r: 16, keep: [170, 250], shot: 240 },
  mobile: { name: "기동", visual: "runner", exp: 15, hp: 450, spd: 0.8, dmg: 60, range: 34, cd: 1.0, r: 16, dash: { every: 3.5, speed: 3.2, dur: 0.35 } },
  tank: { name: "탱커", visual: "bear", exp: 25, hp: 1300, spd: 0.42, dmg: 90, range: 40, cd: 1.6, r: 22, scale: 1.2 },
  thrower: { name: "투척", visual: "octo", exp: 20, hp: 450, spd: 0.5, dmg: 70, range: 300, cd: 2.6, r: 16, keep: [190, 280], lob: { radius: 60, tele: 0.8 } },
  assassin: { name: "암살", visual: "stripe", exp: 25, hp: 480, spd: 0.75, dmg: 120, range: 34, cd: 1.6, r: 16, stealthUntil: 120 },
  support: { name: "지원", visual: "support", exp: 25, hp: 500, spd: 0.5, dmg: 40, range: 240, cd: 2.4, r: 16, keep: [200, 300], heal: { every: 4, radius: 200, amount: 0.15 } },
  summoner: { name: "소환", visual: "summoner", exp: 30, hp: 600, spd: 0.48, dmg: 45, range: 240, cd: 2.4, r: 16, keep: [220, 320], summon: { every: 7, count: 2, cap: 4 } },
  elite: { name: "엘리트", exp: 50, hpMul: 4, dmgMul: 1.6, scale: 1.35, aura: 0.85 }, // 무작위 유형 + 강화 — 능력치 제안
  boss: { name: "보스", exp: 200 }, // 기획서
  minion: { name: "졸개", visual: "summoner", exp: 0, hp: 90, spd: 0.7, dmg: 30, range: 30, cd: 1.0, r: 12, scale: 0.75 }, // 소환된 적: 경험치 0 (반복 파밍 방지)
};

// 웨이브 표 (1~20) — 기획서. kinds 중 무작위로 고르게, count = 60초 동안 총 등장 수
const ENDLESS_WAVES = [
  null,
  { kinds: ["melee"], count: 15 },
  { kinds: ["melee", "ranged"], count: 20 },
  { kinds: ["melee", "ranged", "mobile"], count: 25 },
  { kinds: ["melee", "mobile", "tank"], count: 30 },
  { boss: true },
  { kinds: ["melee", "ranged", "thrower"], count: 35 },
  { kinds: ["mobile", "ranged", "assassin"], count: 40 },
  { kinds: ["melee", "tank", "support"], count: 45 },
  { kinds: ["melee", "thrower", "summoner"], count: 50 },
  { boss: true },
  { kinds: ["melee", "mobile", "elite"], count: 55 },
  { kinds: ["ranged", "thrower", "assassin"], count: 60 },
  { kinds: ["tank", "support", "elite"], count: 65 },
  { kinds: "all", count: 70 },
  { boss: true },
  { kinds: ["mobile", "assassin", "elite"], count: 75 },
  { kinds: ["tank", "thrower", "support"], count: 80 },
  { kinds: ["ranged", "summoner", "elite"], count: 85 },
  { kinds: "all", count: 90 },
  { boss: true },
];
const ENDLESS_ALL_KINDS = ["melee", "ranged", "mobile", "tank", "thrower", "assassin", "support", "summoner", "elite"];
// 엘리트 비율: kinds 에 elite 가 있어도 너무 많지 않게 (제안)
const ELITE_SHARE = 0.12;

// 보스 (8명 무작위 순환, 한 순환 안에서 중복 없음) — 기획서 콘셉트, 수치는 제안
//   phase: HP > 60% basic / 30~60% ult (+지원 적) / 30% 이하 enrage (예고·대기 enrageMul 배)
//   패턴 종류(공통 부품): slam 원 / charge 돌진선 / cone 부채꼴 / ring 사방탄 / barrage 부채탄 / curve 휘는 탄
//                      traps 여러 곳 원 / summon 적 소환 / heal 회복(맞으면 중단) / stealth 은신 후 뒤로 / clones 분신 / zone 영역 / rush 추적 연타
const BOSS_BASE = { addsCap: 6, hp: 8000, dmg: 1, healCap: 0.15, tele: [0.6, 1], ultTele: [1, 1.5], enrageMul: 0.7, gap: 1.2, r: 34, scale: 1.6, spd: 0.5 };
const ENDLESS_BOSSES = {
  suit: { name: "폭주하는 복서", basic: [{ k: "barrage", n: 2, dmg: 70 }, { k: "charge", dmg: 220, dist: 380, rest: 1.6 }, { k: "cone", dmg: 200, radius: 150, arc: 110 }], ult: [{ k: "rush", dmg: 70, dur: 2.5 }], adds: ["melee", "melee"] },
  summoner: { name: "만취한 소환사", basic: [{ k: "summon", kinds: ["minion"], n: 2 }, { k: "barrage", n: 3, dmg: 60 }], ult: [{ k: "summon", kinds: ["summoner", "minion", "minion"], n: 3 }], adds: ["summoner"], dmgTakenWithAdds: 0.6 },
  support: { name: "타락한 수호자", basic: [{ k: "barrage", n: 3, dmg: 60, slow: 1.5 }, { k: "heal", amount: 0.06, dur: 2 }], ult: [{ k: "zone", radius: 150, dmg: 45, dur: 5 }], adds: ["support", "melee"], idleHeal: { after: 4, perSec: 0.01 } },
  runner: { name: "자기애의 화신", basic: [{ k: "charge", dmg: 200, dist: 420, rest: 1.0 }, { k: "charge", dmg: 200, dist: 420, rest: 1.4 }, { k: "traps", n: 4, dmg: 160, radius: 55 }], ult: [{ k: "ring", n: 16, dmg: 60, spin: true, waves: 4 }], adds: ["mobile", "mobile"] },
  octo: { name: "극도로 삐진 쭈꾸미", basic: [{ k: "traps", n: 3, dmg: 180, radius: 70 }, { k: "ring", n: 10, dmg: 60 }], ult: [{ k: "traps", n: 8, dmg: 220, radius: 80, map: true }], adds: ["thrower", "thrower"] },
  stripe: { name: "그림자 암살자", basic: [{ k: "stealth", dmg: 260 }, { k: "cone", dmg: 180, radius: 120, arc: 120 }], ult: [{ k: "clones", n: 4 }], adds: ["assassin"] },
  soccer: { name: "폭주하는 스트라이커", basic: [{ k: "barrage", n: 1, dmg: 90, repeat: 3 }, { k: "curve", dmg: 120 }, { k: "charge", dmg: 180, dist: 300, rest: 1.2 }], ult: [{ k: "barrage", n: 3, dmg: 160, big: true, blast: 90 }], adds: ["ranged", "ranged"] },
  bear: { name: "분노의 거대 백곰", basic: [{ k: "slam", dmg: 260, radius: 110 }, { k: "charge", dmg: 240, dist: 360, rest: 1.4 }, { k: "heal", amount: 0.08, dur: 2.5 }], ult: [{ k: "slam", dmg: 320, radius: 170, jump: true }], adds: ["tank"] },
};

// 공전 칼날 — 기획서 (일부 제안)
const BLADES = {
  max: 6, dmgRatio: 0.3, hitGap: 0.5, sharedGap: true, // 같은 대상은 모든 칼날 합쳐 0.5초에 1번 (제안)
  orbit: 70, size: 14, speed: 3.2,                       // 궤도 반지름, 칼날 크기, 회전 속도(rad/s) — 제안
  outer: { orbit: 115, ratio: 0.5, min: 2 },             // 이중 결계: 바깥 궤도 = 안쪽 개수 × ratio (최소 min) — 제안
};

// 강화 카드. tiers: 희귀도별 값 (일반/희귀/전설 중 있는 것만 등장), cap 최대 중첩 — 공격력 값은 기획서, 나머지 제안
//   type "stat": p 의 능력치 / "blade": 공전 칼날 / "skill": 그 캐릭터 스킬 데이터(이번 판만) / 효과 코드는 js/game/endless.js
const ENDLESS_CARDS = [
  // 공통: 공격
  { id: "atk", name: "공격력", icon: "⚔️", cat: "공격", tiers: { common: 0.1, rare: 0.2, legend: 0.35 }, cap: 6, text: "모든 피해 +{v%}" },
  { id: "aspd", name: "공격 충전", icon: "🔋", cat: "공격", tiers: { common: 0.08, rare: 0.15 }, cap: 5, text: "공격 칸 충전 속도 +{v%}" },
  { id: "ultc", name: "궁극기 충전", icon: "🌟", cat: "공격", tiers: { common: 0.1, rare: 0.2, legend: 0.35 }, cap: 4, text: "궁극기 충전 +{v%}" },
  // 공통: 방어
  { id: "maxhp", name: "최대 체력", icon: "❤️", cat: "방어", tiers: { common: 0.1, rare: 0.2, legend: 0.35 }, cap: 6, text: "최대 HP +{v%} (늘어난 만큼 회복)" },
  { id: "armor", name: "단단함", icon: "🛡️", cat: "방어", tiers: { common: 0.05, rare: 0.1, legend: 0.18 }, cap: 5, text: "받는 피해 -{v%}" },
  { id: "speed", name: "이동 속도", icon: "👟", cat: "방어", tiers: { common: 0.05, rare: 0.1 }, cap: 4, text: "이동속도 +{v%}" },
  // 공통: 회복
  { id: "regen", name: "자연 회복", icon: "🌿", cat: "회복", tiers: { common: 0.005, rare: 0.01, legend: 0.02 }, cap: 4, text: "초당 최대 HP {v%} 회복" },
  { id: "steal", name: "흡혈", icon: "🩸", cat: "회복", tiers: { rare: 0.03, legend: 0.06 }, cap: 3, text: "준 피해의 {v%} 회복" },
  // 공통: 스킬
  { id: "cdr", name: "스킬 가속", icon: "⏱️", cat: "스킬", tiers: { common: 0.08, rare: 0.15, legend: 0.25 }, cap: 4, text: "스킬 쿨타임 -{v%}" },
  // 공전 칼날 — 기획서
  { id: "blade_add", name: "수호의 칼날", icon: "🗡️", cat: "칼날", tiers: { common: 1 }, cap: 6, text: "공전 칼날 +{v}개" },
  { id: "blade_sharp", name: "날카로운 칼날", icon: "✴️", cat: "칼날", tiers: { common: 0.2 }, cap: 5, needBlade: true, text: "칼날 피해 +{v%}" },
  { id: "blade_fast", name: "고속 회전", icon: "🌀", cat: "칼날", tiers: { rare: 0.3 }, cap: 3, needBlade: true, text: "칼날 회전 속도 +{v%}" },
  { id: "blade_big", name: "거대한 칼날", icon: "🔪", cat: "칼날", tiers: { rare: 0.3 }, cap: 3, needBlade: true, text: "칼날 크기 +{v%}" },
  { id: "blade_wall", name: "철벽 방어", icon: "🧱", cat: "칼날", tiers: { rare: 1 }, cap: 1, needBlade: true, text: "칼날에 닿은 일반 적 투사체 제거" },
  { id: "blade_storm", name: "칼날 폭풍", icon: "⚡", cat: "칼날", tiers: { legend: 2 }, cap: 3, text: "공전 칼날 +{v}개" },
  { id: "blade_double", name: "이중 결계", icon: "💠", cat: "칼날", tiers: { legend: 1 }, cap: 1, needBlade: true, text: "바깥 궤도에 칼날이 하나 더 돔" },
  // 캐릭터 전용 (CHARACTER_COMBAT_V2.md 후보) — 수치 제안
  { id: "suit_counter", only: "suit", name: "카운터 강화", icon: "🥊", cat: "전용", tiers: { rare: 0.5 }, cap: 3, text: "카운터 펀치 피해 배율 +{v}" },
  { id: "suit_combo", only: "suit", name: "콤보 확장", icon: "👊", cat: "전용", tiers: { common: 0.15 }, cap: 4, text: "잽-스트레이트-훅 피해 +{v%}" },
  { id: "summoner_petheal", only: "summoner", name: "소환수 회복", icon: "💖", cat: "전용", tiers: { common: 0.03 }, cap: 3, text: "포켓몬이 적을 처치하면 최대 HP {v%} 회복" },
  { id: "summoner_weak", only: "summoner", name: "기 죽이기", icon: "😵", cat: "전용", tiers: { rare: 2 }, cap: 2, text: "포켓몬에게 맞은 적 {v}초간 공격력 감소" },
  { id: "summoner_guard", only: "summoner", name: "든든한 동료", icon: "🛡️", cat: "전용", tiers: { common: 0.05 }, cap: 3, text: "소환 중 받는 피해 추가 -{v%}" },
  { id: "summoner_ult", only: "summoner", name: "한 잔 더!", icon: "🍶", cat: "전용", tiers: { legend: 3 }, cap: 2, text: "한잔했어! 지속 +{v}초, 포켓몬 공격 속도 +20%" },
  { id: "support_slow", only: "support", name: "정신 바짝", icon: "🧊", cat: "전용", tiers: { common: 1 }, cap: 3, text: "정신 차려! 둔화 +{v}초" },
  { id: "support_shield", only: "support", name: "넘치는 챙김", icon: "🫧", cat: "전용", tiers: { rare: 0.2 }, cap: 2, text: "넘치는 회복을 보호막으로 (최대 HP {v%}까지)" },
  { id: "support_wave", only: "support", name: "회복 충격파", icon: "💫", cat: "전용", tiers: { rare: 150 }, cap: 2, text: "걱정하지 마 사용 시 주변 적에게 {v} 피해" },
  { id: "support_ult", only: "support", name: "다 내 뒤로!", icon: "🏰", cat: "전용", tiers: { legend: 0.3 }, cap: 2, text: "궁극기 범위·지속 +{v%}" },
  { id: "runner_more", only: "runner", name: "하트 폭주", icon: "💕", cat: "전용", tiers: { rare: 0.5 }, cap: 2, text: "하트 발사량 +{v%}" },
  { id: "runner_pierce", only: "runner", name: "꿰뚫는 매력", icon: "💘", cat: "전용", tiers: { legend: 1 }, cap: 1, text: "하트가 적을 관통" },
  { id: "runner_slow", only: "runner", name: "녹는 눈빛", icon: "🥰", cat: "전용", tiers: { common: 0.5 }, cap: 3, text: "하트 둔화 +{v}초" },
  { id: "runner_long", only: "runner", name: "나란 남자 연장", icon: "⏳", cat: "전용", tiers: { rare: 2 }, cap: 2, text: "나란 남자 지속 +{v}초" },
  { id: "runner_trail", only: "runner", name: "잔상", icon: "💨", cat: "전용", tiers: { rare: 40 }, cap: 2, text: "질주 중 지나간 자리에 {v} 피해" },
  { id: "runner_kill", only: "runner", name: "역시 나야", icon: "😎", cat: "전용", tiers: { common: 0.5 }, cap: 3, text: "적 처치 시 스킬 쿨타임 -{v}초" },
  { id: "octo_keep", only: "octo", name: "삐짐 유지", icon: "😤", cat: "전용", tiers: { rare: 0.5 }, cap: 1, text: "삐짐 폭발 후 게이지 {v%} 남음" },
  { id: "octo_resist", only: "octo", name: "고집", icon: "🪨", cat: "전용", tiers: { common: 0.25 }, cap: 2, text: "기절·둔화·이동불가 시간 -{v%}" },
  { id: "octo_hurtink", only: "octo", name: "피격 먹물", icon: "💦", cat: "전용", tiers: { rare: 0.25 }, cap: 2, text: "맞으면 {v%} 확률로 주변에 먹물 폭발" },
  { id: "octo_tent", only: "octo", name: "촉수 강화", icon: "🦑", cat: "전용", tiers: { rare: 0.3 }, cap: 2, text: "다 필요 없어! 범위 +{v%}" },
  { id: "octo_ink", only: "octo", name: "진한 먹물", icon: "🖤", cat: "전용", tiers: { common: 1 }, cap: 3, text: "먹물 MISS +10%p, 지속 +2초, 범위 +30%" },
  { id: "stripe_back", only: "stripe", name: "뒤끝 강화", icon: "🔪", cat: "전용", tiers: { common: 0.25 }, cap: 3, text: "후방 공격 피해 배율 +{v}" },
  { id: "stripe_speed", only: "stripe", name: "그림자 걸음", icon: "👣", cat: "전용", tiers: { common: 0.2 }, cap: 2, text: "은신 중 이동속도 +{v%}" },
  { id: "stripe_kill", only: "stripe", name: "다음 표적", icon: "🎯", cat: "전용", tiers: { rare: 2 }, cap: 2, text: "적 처치 시 은신 쿨타임 -{v}초" },
  { id: "stripe_clone", only: "stripe", name: "분신 추가", icon: "👥", cat: "전용", tiers: { legend: 1 }, cap: 2, text: "분신 +{v}개" },
  { id: "soccer_ball", only: "soccer", name: "묵직한 공", icon: "⚽", cat: "전용", tiers: { common: 0.2 }, cap: 3, text: "슈팅 피해 +{v%}" },
  { id: "soccer_three", only: "soccer", name: "빠른 마무리", icon: "3️⃣", cat: "전용", tiers: { rare: 1 }, cap: 1, text: "강화 기본 공격 4회 → 3회" },
  { id: "soccer_tri", only: "soccer", name: "트리플 슈팅", icon: "🔱", cat: "전용", tiers: { legend: 1 }, cap: 1, text: "궁극기 3방향 발사" },
  { id: "soccer_curve", only: "soccer", name: "양발 감아차기", icon: "🌙", cat: "전용", tiers: { rare: 0.4 }, cap: 2, text: "감아차기 곡률 +{v%}, 좌우 동시 발사" },
  { id: "bear_guard", only: "bear", name: "더 안 아파", icon: "🐻", cat: "전용", tiers: { common: 0.03 }, cap: 3, text: "주변 적 1명당 피해 감소 +{v%}" },
  { id: "bear_honey", only: "bear", name: "꿀 한 숟갈 더", icon: "🍯", cat: "전용", tiers: { common: 0.04 }, cap: 3, text: "꿀 회복 초당 +{v%}" },
  { id: "bear_run", only: "bear", name: "몸통 박치기", icon: "💥", cat: "전용", tiers: { rare: 150 }, cap: 2, text: "네발 질주로 부딪힌 적에게 {v} 피해" },
  { id: "bear_land", only: "bear", name: "더 크게 착지", icon: "🌋", cat: "전용", tiers: { rare: 0.3 }, cap: 2, text: "착지 범위 +{v%}" },
];
const RARITY_LOOK = { common: { name: "일반", color: "#9fb4dc" }, rare: { name: "희귀", color: "#c07bff" }, legend: { name: "전설", color: "#ffd23f" } };
