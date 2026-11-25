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

const SKILL_DATA = {
  summoner: {
    q: { name: "소환", cd: 15, dur: 10, text: "덱의 포켓몬을 던져 {dur}초간 함께 싸움" },
    e: { name: "교체", cd: 2, text: "소환 중인 포켓몬을 다른 포켓몬으로 교체" },
    passive: { name: "동료", speed: 1.1, text: "포켓몬 소환 중 이동속도 ×{speed}" },
  },
  bear: {
    q: { name: "질주", cd: 7, dur: 1, speed: 1.7, text: "{dur}초간 이동속도 ×{speed}" },
    e: { name: "꿀 회복", cd: 12, dur: 2.5, perSec: 0.1, moveMul: 0.7, text: "{dur}초간 매초 최대 HP {perSec%} 회복 (회복 중 이동속도 ×{moveMul})" },
    passive: { name: "버티기", perFoe: 0.08, maxFoes: 3, radius: 120, text: "주변 적 1명당 받는 피해 -{perFoe%} (최대 {maxFoes}명)" },
  },
  runner: {
    q: { name: "전력 질주", cd: 6, dur: 2, cost: 50, speed: 1.6, text: "질주 게이지 {cost} 사용, {dur}초간 이동속도 ×{speed}" },
    e: { name: "태클", cd: 8, dmg: 400, dmgRun: 600, dashT: 0.22, text: "돌진해 {dmg} 피해와 넉백 (질주 중 {dmgRun})" },
    passive: { name: "러너", per: 6, max: 100, text: "{per}px 이동할 때마다 질주 게이지 1 충전 (최대 {max})" },
  },
  suit: {
    q: { name: "집중", cd: 7, dur: 3, mult: 1.4, text: "{dur}초간 주는 피해 ×{mult}" },
    e: { name: "반격", cd: 9, dur: 2, take: 0.5, reflect: 0.5, text: "{dur}초간 받는 피해 ×{take}, 줄어든 피해의 {reflect%}를 공격자에게 반사" },
    passive: { name: "급소", chance: 0.15, mult: 1.4, text: "공격할 때 {chance%} 확률로 피해 ×{mult}" },
  },
  octo: {
    q: { name: "먹물 폭탄", cd: 5, dmg: 450, radius: 85, range: 360, ink: 2, text: "던진 곳 주변에 {dmg} 피해, {ink}초간 시야 가림" },
    e: { name: "촉수 함정", cd: 9, dmg: 250, stun: 1.5, radius: 65, range: 300, armT: 3, text: "{armT}초간 깔린 함정, 밟으면 {dmg} 피해와 {stun}초 기절" },
    passive: { name: "투척", text: "투척 스킬은 벽을 넘어감" },
  },
  stripe: {
    q: { name: "은신", cd: 7, dur: 3, text: "{dur}초간 적에게 보이지 않음 (공격하면 풀림)" },
    e: { name: "기습", cd: 9, dmg: 450, radius: 65, text: "앞으로 돌진해 주변에 {dmg} 피해" },
    passive: { name: "뒤치기", mult: 1.5, text: "적의 등 뒤를 공격하면 피해 ×{mult}" },
  },
  soccer: {
    q: { name: "드리블", cd: 7, dmg: 300, radius: 60, text: "앞으로 돌진해 주변에 {dmg} 피해" },
    e: { name: "강슛", cd: 9, dmg: 500, range: 500, speed: 650, bounces: 3, bounceMul: 1.15, text: "{dmg} 피해 공, 벽에 {bounces}번 튕기며 매번 ×{bounceMul}" },
    passive: { name: "연계", every: 4, mult: 1.3, text: "{every}번째 공격마다 피해 ×{mult}" },
  },
  support: {
    q: { name: "회복", cd: 7, heal: 0.2, text: "최대 HP {heal%} 즉시 회복" },
    e: { name: "둔화탄", cd: 9, dmg: 250, slow: 2.5, range: 350, speed: 650, text: "{dmg} 피해와 {slow}초 둔화" },
    passive: { name: "재생", perSec: 0.003, text: "매초 최대 HP {perSec%} 재생" },
  },
};

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
const STAT_CHIPS = [["dmg", "피해", ""], ["dur", "지속", "초"], ["stun", "기절", "초"], ["slow", "둔화", "초"], ["radius", "범위", ""], ["range", "사거리", ""], ["cd", "쿨타임", "초"]];
function skillChips(s) {
  return STAT_CHIPS.filter(([k]) => s[k] !== undefined).map(([k, label, unit]) => `${label} ${fmtNum(s[k])}${unit}`);
}
// 로비·상세 화면용 기존 형식 [이름, "설명 · 쿨타임"] 도 이 데이터로 다시 만듦
for (const [k, d] of Object.entries(SKILL_DATA)) {
  if (!CHARACTER_INFO[k]) continue;
  CHARACTER_INFO[k].skills = [d.q, d.e].map((s) => [s.name, skillText(s) + (s.cd ? " · " + fmtNum(s.cd) + "초" : "")]);
  CHARACTER_INFO[k].passive = skillText(d.passive);
}
