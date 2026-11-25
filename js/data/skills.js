// ===== 스킬 데이터 (모든 캐릭터·포켓몬 공통) =====
// 실제 스킬 코드(js/game/skills.js, combat.js, update.js, pets.js, engine/world.js)가 여기 숫자를 읽음.
// 설명창(길게 누르기·마우스 올리기)과 로비 스킬 설명도 여기서 자동으로 만들어짐 → 밸런스는 이 파일만 고치면 됨.
//
// 항목 규칙 (캐릭터.q / .e / .passive, 포켓몬 PET_SKILLS[i])
//   name  스킬 이름
//   text  설명 문장. {키} 는 같은 항목의 값, {키%} 는 백분율로 표시 (예: {chance%} → 15%)
//   아래 키는 설명창 아래 칸(수치 칩)에 자동 표시: dmg 피해량, dur 지속시간(초), radius 범위, range 사거리, cd 쿨타임(초)
//   그 밖의 키는 코드에서만 쓰는 값 (text 에 넣으면 설명에도 나옴)
//   새 캐릭터·스킬을 추가할 때도 같은 형식으로 넣으면 설명창·로비에 자동 반영됨

// 조준 (모든 스킬 공통 조작): aim "none" 방향 없음 | "dir" 방향 | "point" 위치
//   탭 = 사거리 안 가장 가까운 적 자동 조준, 길게 누르기 = 설명 + 예상 경로, 끌기 = 직접 조준
//   preview: "line"(길이 range, 폭 width) | "curve" | "circle"(radius, 위치 스킬) | "cone"(radius, arc 도)
// 궁극기 r: 쿨타임 대신 충전(ULT_RULES). 수치는 CHARACTER_COMBAT_V2.md 초기값, 기획서에 없는 값은 "초기 테스트값"
const SKILL_DATA = {
  suit: { // 동기: 민첩형 복서 (DONGI_SKILLSET.md)
    combo: { name: "잽-스트레이트-훅", mults: [1, 1.2, 1.6], reset: 0.9, hookPush: 30 }, // 맨손 기본 공격 3연타 (초기 테스트값)
    q: { name: "순간 돌진", cd: 6, dmg: 280, range: 200, stun: 0.4, aim: "dir", move: true, preview: "line", width: 34, text: "적에게 빠르게 돌진해 바디블로 {dmg} 피해, {stun}초 기절" },
    e: { name: "위빙", cd: 5, dur: 0.5, range: 40, aim: "dir", move: true, preview: "line", pathPreview: true, width: 30, text: "{dur}초간 몸을 빼 적의 공격을 회피 (IMMUNE)" },
    r: { name: "펀치 러시", dur: 2, tick: 0.15, dmg: 150, dmgSide: 100, radius: 110, arc: 150, moveMul: 0.5, aim: "dir", preview: "cone", text: "{dur}초간 앞쪽 부채꼴로 연속 펀치, {tick}초마다 주 대상 {dmg}·주변 {dmgSide} 피해" },
    passive: { name: "카운터 펀치", perDodge: 0.34, mult: 2, text: "위빙으로 회피하면 카운터 게이지 충전, 가득 차면 다음 공격 피해 ×{mult}" },
  },
  summoner: { // 현곤
    q: { name: "소환", cd: 15, dur: 10, aim: "none", text: "덱의 포켓몬을 던져 {dur}초간 함께 싸움 (포켓몬 버튼)" },
    e: { name: "교체", cd: 2, aim: "none", text: "소환 중인 포켓몬을 다른 포켓몬으로 교체" },
    r: { name: "한잔했어!", dur: 8, atkMul: 0.45, aim: "none", text: "고른 포켓몬 3마리를 {dur}초간 동시에 소환, 포켓몬 공격력 ×{atkMul}" },
    passive: { name: "동료", speed: 1.1, take: 0.9, text: "포켓몬 소환 중 이동속도 ×{speed}, 받는 피해 ×{take}" },
  },
  support: { // 은숙
    // 기본 공격(맨손일 때): 빛의 구체 직선 발사 — 단일 대상, 장애물에 막힘
    basic: { name: "빛의 구체", kind: "orb", dmg: 110, range: 260, speed: 560, width: 14, reload: 0.55 },
    q: { name: "정신 차려!", cd: 8, dmg: 250, slow: 2.5, range: 350, speed: 650, aim: "dir", preview: "line", width: 16, text: "{dmg} 피해 탄을 쏴 {slow}초 둔화" },
    e: { name: "걱정하지 마", cd: 10, heal: 0.2, guard: 0.3, dur: 3, radius: 200, aim: "none", text: "자신과 주변 아군 최대 HP {heal%} 즉시 회복, {dur}초간 받는 피해 -{guard%}" },
    r: { name: "다들 내 뒤로!", dur: 6, radius: 130, tick: 0.5, healPerSec: 0.04, dmg: 100, slow: 1, aim: "none", text: "{dur}초간 따라다니는 영역: 아군 초당 {healPerSec%} 회복, 적 {tick}초마다 {dmg} 피해와 둔화" },
    passive: { name: "내가 챙겨줄게", idle: 5, perSec: 0.02, radius: 200, text: "{idle}초간 안 맞으면 초당 최대 HP {perSec%} 회복 (자신·주변 아군, 맞으면 중단)" },
  },
  runner: { // 기섭
    q: { name: "나 좀 봐라!", cd: 6, dur: 2, cost: 50, speed: 1.6, aim: "none", text: "자신감 게이지 {cost} 사용, {dur}초간 이동속도 ×{speed}" },
    e: { name: "비켜 내가 간다", cd: 8, dmg: 400, dmgRun: 600, dashT: 0.22, range: 124, aim: "dir", move: true, preview: "line", width: 76, text: "돌진 태클 {dmg} 피해와 넉백 (질주 중 {dmgRun}), 벽에 부딪히면 멈춤" },
    r: { name: "나란 남자", pose: 0.6, dur: 5, tick: 0.3, hearts: 6, dmg: 90, slow: 1, range: 300, speed: 420, homing: 1, homeTurn: 2.2, homeRange: 320, aim: "none", text: "하트 포즈 후 {dur}초간 사방으로 하트 발사 (매번 {homing}발은 가까운 적을 약하게 추적), 한 발 {dmg} 피해와 둔화 (이동·공격 가능)" },
    passive: { name: "역시 나야", per: 6, max: 100, text: "{per}px 이동할 때마다 자신감 게이지 1 충전 (최대 {max})" },
  },
  octo: { // 상훈
    // 기본 공격(맨손일 때): 먹물 곡사 투척 — 장애물을 넘어가고 착탄 지점 소범위 피해. reload: 탄창 1발 충전 시간(공격속도)
    basic: { name: "먹물 던지기", kind: "lob", dmg: 120, range: 230, radius: 42, flight: 0.45, reload: 0.6 },
    q: { name: "몰라 안 해", cd: 5, dmg: 450, radius: 85, range: 360, miss: 0.3, missBoss: 0.15, missDur: 3, aim: "point", preview: "circle", text: "먹물 폭탄 {dmg} 피해, {missDur}초간 공격 {miss%} 확률 MISS" },
    e: { name: "내 맘대로 할 거야", cd: 9, dmg: 250, root: 1.5, radius: 65, range: 300, armT: 3, aim: "point", preview: "circle", text: "촉수 함정({armT}초 유지), 밟으면 {dmg} 피해와 {root}초 이동불가" },
    r: { name: "다 필요 없어!", dur: 5, tick: 0.5, radius: 140, dmg: 120, push: 40, aim: "none", text: "{dur}초간 주변을 촉수로 연속 공격, {tick}초마다 {dmg} 피해와 넉백 (이동·공격 가능)" },
    passive: { name: "나 삐졌어", perDmg: 1500, mult: 1.3, text: "맞으면 삐짐 게이지 충전, 가득 차면 다음 스킬 피해 ×{mult} (투척은 벽·강을 넘어감)" },
  },
  stripe: { // 경수
    q: { name: "나 안 놀아", cd: 7, dur: 3, detect: 120, aim: "none", text: "{dur}초간 은신: 적 화면에서 사라지고 자동 조준·추적 대상에서 빠짐 (공격하면 풀림, 맞아도 유지)" },
    e: { name: "두고 보자", cd: 9, dmg: 450, radius: 65, range: 84, aim: "dir", move: true, preview: "line", width: 50, text: "앞으로 돌진해 주변에 {dmg} 피해" },
    r: { name: "나 건드리지 마!", count: 4, dur: 5, dmg: 90, atkCd: 0.6, spd: 1.6, aim: "none", text: "분신 {count}개가 {dur}초간 적을 쫓아 공격 (한 번에 {dmg} 피해)" },
    passive: { name: "뒤끝 있어", mult: 1.5, text: "적의 등 뒤를 공격하면 피해 ×{mult}" },
  },
  soccer: { // 재한
    q: { name: "가볍게 제쳐볼까", cd: 7, dmg: 300, radius: 60, range: 72, aim: "dir", move: true, preview: "line", width: 44, text: "드리블 돌진, 주변에 {dmg} 피해" },
    e: { name: "감각적인 감아차기", cd: 9, dmg: 400, range: 520, bend: 120, speed: 600, aim: "dir", preview: "curve", text: "좌우로 휘는 관통 슈팅 {dmg} 피해, 벽에 맞으면 멈춤 (쏠 때마다 휘는 방향 번갈아)" },
    r: { name: "내가 마무리할게", dmgFirst: 1500, dmg: 600, range: 650, speed: 900, push: 80, blastRadius: 110, blastDmg: 500, aim: "dir", preview: "line", width: 36, text: "직선 관통 슈팅: 첫 적중 {dmgFirst} 피해 + 그 자리에서 폭발 {blastDmg} (1회), 이후 관통 {dmg} 피해와 넉백. 안 맞으면 최대 거리에서 폭발" },
    passive: { name: "이 정도쯤이야", every: 4, mult: 1.3, text: "{every}번째 기본 공격마다 피해 ×{mult}" },
  },
  bear: { // 정용
    q: { name: "나 원래 빠른데", cd: 7, dur: 1, speed: 1.7, push: 60, range: 255, aim: "dir", move: true, preview: "line", width: 68, text: "{dur}초간 네발 질주 이동속도 ×{speed}, 부딪힌 적 넉백" },
    e: { name: "나 안 삐졌는데", cd: 12, dur: 2.5, perSec: 0.1, moveMul: 0.7, aim: "none", text: "{dur}초간 꿀을 먹으며 총 최대 HP 25% 회복 (이동속도 ×{moveMul})" },
    r: { name: "나 진짜 세거든", range: 320, jumpT: 0.6, radius: 120, inner: 60, dmg: 1400, dmgEdge: 600, stun: 1, guard: 0.3, guardDur: 3, aim: "point", move: true, preview: "circle", text: "지정 위치로 점프, 착지 중심({inner}) {dmg}·외곽 {dmgEdge} 피해와 {stun}초 기절, 착지 후 {guardDur}초간 받는 피해 -{guard%}" },
    passive: { name: "별로 안 아픈데", perFoe: 0.08, maxFoes: 3, radius: 120, text: "주변 적 1명당 받는 피해 -{perFoe%} (최대 {maxFoes}명)" },
  },
};

// 궁극기 충전 (CHARACTER_COMBAT_V2.md)
//   실제로 적에게 입힌 피해로 충전: 기본·일반 스킬·소환수·지속 피해 포함 / 상자·받은 피해·MISS·궁극기 자체 피해(궁극기 소환수·분신 포함) 제외
//   100% 에서 발동, 발동 즉시 0%. 기준 피해 base 를 캐릭터 배율 mult 로 나눠 채움 (배율 140% = 1.4배 빨리)
const ULT_RULES = {
  pve: { base: 5000 },                 // 싱글·무한 생존
  pvp: { base: 5000 },                 // 배틀로얄
  // 충전 배율 (클수록 빨리 참). PvE·PvP 따로 조정 가능. 스킬 수치도 SKILL_DATA[캐릭터].r.pvp = { dmg: ... } 로 배틀로얄만 따로 덮어쓸 수 있음
  mult: { // PvE (싱글·무한 생존)
    pve: { suit: 1, summoner: 0.5, support: 1.4, runner: 1.2, octo: 0.5, stripe: 1.1, soccer: 1, bear: 1.68 },
    pvp: { suit: 1, summoner: 0.5, support: 1.4, runner: 1.2, octo: 0.5, stripe: 1.1, soccer: 1, bear: 1.68 },
  },
  overkill: false,                     // 적 남은 체력을 넘는 피해는 충전 제외 (기획서 권장)
  chargeDuringUlt: false,              // 궁극기 발동 중 충전 (테스트 후 결정, 초기값: 안 됨)
  healCoef: 0.5,                       // 은숙: 실제 아군 회복량의 이 비율만큼 충전 (초기 테스트값)
};
// 지속·광역 피해 판정: 같은 대상에게 tick 초마다 1번 (스킬 데이터의 tick 사용)

// 포켓몬 공통 규칙 (소환사 Q·E 와 같은 값)
const PET_RULES = { life: SKILL_DATA.summoner.q.dur, summonCD: SKILL_DATA.summoner.q.cd, swapCD: SKILL_DATA.summoner.e.cd, skillCD: 5, range: 220 };
// 포켓몬 기술 (mons 순서와 같음). targets 최대 대상 수, minFoes 이 수 이상일 때만 사용, burnDps 화상 초당 피해
const PET_SKILLS = [
  { name: "10만 볼트", dmg: 420, targets: 3, minFoes: 2, text: "적 최대 {targets}명에게 {dmg} 피해 (적이 {minFoes}명 이상일 때)" },
  { name: "화염방사", dmg: 460, burn: 3, burnDps: 55, text: "적 1명에게 {dmg} 피해 + {burn}초 화상 (초당 {burnDps})" },
  { name: "하이드로펌프", dmg: 350, push: 50, text: "적 1명에게 {dmg} 피해 + 뒤로 밀쳐냄" },
  { name: "씨폭탄", dmg: 300, stun: 1, text: "적 1명에게 {dmg} 피해 + {stun}초 기절" },
  { name: "섀도볼", dmg: 350, weak: 3, weakMul: 0.8, text: "적 1명에게 {dmg} 피해 + {weak}초 약화 (주는 피해 ×{weakMul})" },
  { name: "헤비봄버", dmg: 550, radius: 100, targets: 7, text: "가까운({radius}) 적 모두에게 {dmg} 피해" },
  { name: "냉동빔", dmg: 330, slow: 2, text: "적 1명에게 {dmg} 피해 + {slow}초 둔화" },
  { name: "노래하기", dmg: 120, stun: 1, targets: 7, minFoes: 2, text: "적 최대 {targets}명에게 {dmg} 피해 + {stun}초 기절 (적이 {minFoes}명 이상일 때)" },
];

// ----- 설명 만들기 (공통) -----
function fmtNum(v) {
  return Number.isInteger(v) ? String(v) : String(+v.toFixed(3));
}
function skillText(s) {
  return s.text.replace(/\{(\w+)(%?)\}/g, (_, k, pct) => (s[k] === undefined ? "?" : pct ? fmtNum(s[k] * 100) + "%" : fmtNum(s[k])));
}
// ===== 이동형 스킬 공통 조작 (move: true 인 모든 스킬 + 공통 대시) =====
// 방향: 1) 스킬 버튼을 끈 방향  2) 이동 조이스틱 방향  3) 마지막 이동 방향   (적 자동 조준 없음)
// 짧게 탭: 바로 발동 / 길게 누름: 이동 거리·방향·판정 범위 표시 / 끌기: 방향 바꾸기 / 떼면 발동 / 가운데로 되돌려 떼면 취소
// range: 이동 거리(미리보기), width: 이동 경로 판정 폭, radius: 도착 지점 판정 반경
// 새 이동형 스킬은 move: true 만 달면 같은 조작이 적용됨
const DASH = { name: "대시", cd: 3, t: 0.1, speedMul: 4, range: 60, aim: "dir", move: true, preview: "line", width: 30, text: "짧게 빠르게 이동 (쿨타임 {cd}초)" };
const STAT_CHIPS = [["dmg", "피해", ""], ["dur", "지속", "초"], ["stun", "기절", "초"], ["root", "이동불가", "초"], ["slow", "둔화", "초"], ["radius", "범위", ""], ["range", "사거리", ""], ["cd", "쿨타임", "초"]];
function skillChips(s) {
  return STAT_CHIPS.filter(([k]) => s[k] !== undefined).map(([k, label, unit]) => `${label} ${fmtNum(s[k])}${unit}`);
}
// 로비·상세 화면용 기존 형식 [이름, "설명 · 쿨타임"] 도 이 데이터로 다시 만듦
for (const [k, d] of Object.entries(SKILL_DATA)) {
  if (!CHARACTER_INFO[k]) continue;
  CHARACTER_INFO[k].skills = [d.q, d.e].map((s) => [s.name, skillText(s) + (s.cd ? " · " + fmtNum(s.cd) + "초" : "")]);
  CHARACTER_INFO[k].ult = [d.r.name, skillText(d.r)];
  CHARACTER_INFO[k].passive = skillText(d.passive);
}
