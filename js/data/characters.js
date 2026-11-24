// 캐릭터별 스킬 이름 [스킬1, 스킬2] (소환사·곰·러너는 코드에 직접 정의)

const extraNames = { suit: ["집중", "반격"], octo: ["먹물 폭탄", "촉수 함정"], stripe: ["은신", "기습"], soccer: ["드리블", "강슛"], support: ["회복", "둔화탄"] };

// 그래픽 사용 설정
// bearSprint: 곰 Q 질주(1초) 동안 네 발 질주 시트 사용 여부.
//   검수 결과 기존 곰(실사 얼굴)과 얼굴·체형이 달라 질주 중 다른 캐릭터처럼 보여서 기본값은 꺼 둠.
const CHARACTER_ART = { bearSprint: false };

// 로비·설명용 정보 (실제 코드 수치 기준, 기획 변경 아님)
const CHARACTER_INFO = {
  summoner: { name: "빨간 모자", role: "소환사", skills: [["소환", "덱의 포켓몬을 던져 10초간 함께 싸움 · 15초"], ["교체", "소환 중인 포켓몬을 다른 포켓몬으로 교체 · 2초"]], passive: "포켓몬 소환 중 이동속도 +10%" },
  bear: { name: "곰", role: "생존형", skills: [["질주", "1초간 빠르게 이동 · 7초"], ["꿀 회복", "2.5초간 매초 최대 HP 10% 회복 · 12초"]], passive: "주변 적 1명당 받는 피해 -8% (최대 -24%)" },
  runner: { name: "러닝 선수", role: "기동형", skills: [["전력 질주", "질주 게이지 50 사용, 2초간 질주 · 6초"], ["태클", "돌진해 400 피해와 넉백, 질주 중 600 · 8초"]], passive: "이동하면 질주 게이지 충전" },
  suit: { name: "검은 정장", role: "", skills: [["집중", "3초간 주는 피해 ×1.4 · 7초"], ["반격", "2초간 받는 피해 절반, 일부 반사 · 9초"]], passive: "15% 확률로 피해 ×1.4" },
  octo: { name: "문어", role: "", skills: [["먹물 폭탄", "범위 450 피해와 시야 가림 · 5초"], ["촉수 함정", "밟으면 250 피해와 1.5초 기절 · 9초"]], passive: "투척 공격은 벽을 넘어감" },
  stripe: { name: "줄무늬", role: "", skills: [["은신", "3초간 적에게 보이지 않음 · 7초"], ["기습", "앞으로 돌진해 주변에 450 피해 · 9초"]], passive: "적의 등 뒤를 공격하면 피해 ×1.5" },
  soccer: { name: "축구 선수", role: "", skills: [["드리블", "앞으로 돌진해 주변에 300 피해 · 7초"], ["강슛", "500 피해 공, 벽에 3번 튕기며 강해짐 · 9초"]], passive: "4번째 공격마다 피해 ×1.3" },
  support: { name: "정장 여성", role: "", skills: [["회복", "최대 HP 20% 즉시 회복 · 7초"], ["둔화탄", "250 피해와 2.5초 둔화 · 9초"]], passive: "매초 최대 HP 0.3% 재생" },
};
const CHARACTER_ORDER = ["summoner", "bear", "runner", "suit", "octo", "stripe", "soccer", "support"];

// ===== 공격 모션 스프라이트 (교체 가능, 지금은 비어 있음) =====
// ChatGPT 가 공격 동작 시트를 주면 여기에 추가. 형식은 이동 시트와 같음 (96px 칸, 8행 = 방향 N NE E SE S SW W NW)
// 예: suit: { src: "assets/characters/suit-attack.webp", frames: 6, weaponInHand: true }
//   frames: 한 방향의 프레임 수, weaponInHand: 시트에 무기가 그려져 있으면 true (그러면 무기 아이콘을 따로 그리지 않음)
// 시트가 없는 캐릭터는 이동 시트를 공격 방향으로 돌려 보여 주고, 무기 아이콘으로 동작을 표현
const ATTACK_SPRITES = {};
