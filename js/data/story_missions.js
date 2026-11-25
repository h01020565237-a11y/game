// ===== 싱글 영입 미션 (docs: STORY_RECRUITMENT_DIFFICULTY_V1 · SINGLE_PLAYER_PHASE1 · 사용자 최종 결정 2026-11-25) =====
// - 현곤 영입은 기존 웨이브 미션(js/data/waves.js WAVE_MISSIONS.hyeongon) 그대로
// - 나머지 6개는 무한 생존 엔진(적 8유형·보스 8명 패턴·카드·경험치)을 미션 대본으로 돌림 (js/game/story.js)
// - 출전 캐릭터는 지정된 캐릭터만 (players). 기섭 영입은 동기/현곤, 재한 영입은 경수/정용 중 선택
// - 선행 조건(requires): 앞 순서 캐릭터가 영입되어 있어야 미션이 열림 (출전 조건과 따로)
// - 수치는 초기 설계안 (실제 플레이 후 조정). 보스 체력은 출전 캐릭터 단일 대상 지속 피해(측정값)의 약 55% × 목표 보스전 시간
//   측정: 현곤 437 · 동기 332 · 기섭 284 · 상훈 330 · 경수 323 · 재한 ~330 (초당, 허수아비 1개, 기본 공격+Q/E)
// - 단계(stages): time 초 생존(그동안 count 마리 고르게 등장) 또는 boss. ward = 보호 대상(은숙)
// - tips: [단계 시작 후 초, 안내] — 출전 캐릭터 스킬·조작을 익히는 실전 튜토리얼
// - scaleW: 적 체력·공격력 기준 웨이브 (무한 생존 waveScale 과 같은 공식)
// 예상 성공 시간(계산값, 실제 플레이 전): 생존 단계 합 + 보스 체력 ÷ (지속 피해 × 0.55) + 카운트다운·카드 약 30~50초
//   현곤 ~4분 · 은숙 ~4.8 · 기섭 ~5 · 상훈 ~5.2 · 경수 ~6 · 정용(현곤) ~9 · 재한(경수/정용) ~7.5  → 1차 5개 ≈ 25분, 7개 ≈ 42분
//   보스전 계산: 정용 미션 중간 21000÷(404×0.55)≈95초·최종 40000÷(404×0.55)≈180초 / 재한 미션 최종 경수 25000÷(270×0.55)≈168초 = 정용 17200÷(186×0.55)≈168초

const STORY_MISSIONS = {
  eunsuk: {
    reward: "support", players: ["summoner"], title: "새벽별교회를 지켜라", sub: "보호 방어전 + 보스", target: "4~6분", scaleW: 3,
    ward: { name: "은숙", look: "support", hp: 4200, hunters: 1 }, // hunters: 일반 적 중 은숙을 우선 노리는 비율 (2026-11-25: 0.4 근접·기동만 → 1 전 유형, 원거리는 사거리에서 쏨). 2026-11-25 요청: 적 수 1단계 24→36, 2단계 30→44
    stages: [
      { label: "1단계", time: 70, count: 36, kinds: ["melee", "mobile"], tips: [[0.5, "은숙을 지켜라! 은숙 체력이 0이 되면 실패"], [5, "포켓몬 버튼을 눌러 던지기 → 10초간 함께 싸움"], [16, "E 교체: 소환 중인 포켓몬을 다른 포켓몬으로"]] },
      { label: "2단계", time: 80, count: 44, kinds: ["melee", "mobile", "ranged", "thrower"], tips: [[0.5, "원거리·투척 적 등장 — 붉은 예고 범위를 피하세요"], [10, "R 궁극기 「한잔했어!」: 게이지 100%면 포켓몬 3마리 동시 소환"]] },
      { label: "보스", boss: "support", hp: 21000, tips: [[0.5, "타락한 수호자: 회복을 시작하면 때려서 끊으세요"], [12, "은숙 근처로 끌어오지 않게 조심"]] },
    ],
  },
  giseop: {
    reward: "runner", players: ["suit", "summoner"], title: "자기애의 화신을 잡아라", sub: "추격·돌진 회피 + 제한시간 보스", target: "5~7분", scaleW: 4,
    stages: [
      { label: "1단계", time: 75, count: 30, kinds: ["mobile", "melee"], tips: [[0.5, "빠르게 쫓아오는 기동형 적 — 돌진(붉은 선) 예고를 보고 옆으로 피하세요"], [8, { suit: "Q 순간 돌진: 짧게 누르면 이동 방향으로, 길게 누르면 경로 표시", summoner: "포켓몬을 미리 던져 두면 추격하는 적을 막아 줘요" }], [22, { suit: "E 위빙: 공격을 피하면 카운터 게이지 충전 → 다음 공격 ×2", summoner: "E 교체로 상황에 맞는 포켓몬 기술 쓰기" }]] },
      { label: "2단계", time: 90, count: 36, kinds: ["mobile", "tank", "melee"], tips: [[0.5, "탱커는 느리지만 단단해요 — 둘러싸이지 않게 이동하며 공격"], [14, "대시(공통): 위험할 때 빠르게 빠져나가기"]] },
      { label: "보스", boss: "runner", hp: { suit: 18500, summoner: 24000 }, limit: 150, tips: [[0.5, "제한시간 150초! 돌진 2번 뒤 함정을 깔아요"], [15, "돌진 뒤 멈춘 순간이 공격 기회"]] },
    ],
  },
  sanghun: {
    reward: "octo", players: ["runner"], title: "삐진 쭈꾸미의 먹물 지대", sub: "먹물·촉수 함정 + 다수 적 + 보스", target: "5~7분", scaleW: 5,
    stages: [
      { label: "1단계", time: 80, count: 34, kinds: ["thrower", "melee"], tips: [[0.5, "투척 적의 먹물: 떨어질 곳에 예고 원이 떠요"], [6, "기섭 Q 「나 좀 봐라!」: 자신감 게이지 50으로 2초간 빠르게 — 움직일수록 게이지가 차요"], [20, "E 태클: 질주 중에 쓰면 피해 600"]] },
      { label: "2단계", time: 90, count: 46, kinds: ["thrower", "melee", "mobile", "ranged"], tips: [[0.5, "적이 많아요 — 계속 달리면서 태클로 길을 여세요"], [16, "R 「나란 남자」: 하트 2발은 가까운 적을 따라가요"]] },
      { label: "보스", boss: "octo", hp: 17000, tips: [[0.5, "극도로 삐진 쭈꾸미: 바닥 함정 예고를 피해 다니세요"], [15, "궁극기 단계엔 맵 전체에 함정 — 빈 곳을 찾아 이동"]] },
    ],
  },
  gyeongsu: {
    reward: "stripe", players: ["octo"], title: "그림자 속의 경수", sub: "은신·기습 대응 + 분신 구별 보스", target: "6~8분", scaleW: 6,
    stages: [
      { label: "1단계", time: 80, count: 30, kinds: ["assassin", "melee"], tips: [[0.5, "은신한 적이 다가오면 머리 위에 빨간 ! — 위치는 안 알려줘요"], [7, "상훈 기본 공격: 먹물 곡사 — 벽 너머로도 던질 수 있어요"], [20, "E 촉수 함정: 은신 적이 올 길목에 깔아 두기"]] },
      { label: "2단계", time: 110, count: 44, kinds: ["assassin", "ranged", "mobile", "support"], tips: [[0.5, "지원형 적은 동료를 회복 — 먼저 처치"], [12, "Q 먹물 폭탄: 맞은 적은 공격이 빗나가요(MISS)"]] },
      { label: "보스", boss: "stripe", hp: 24000, tips: [[0.5, "그림자 암살자: 사라졌다가 등 뒤에서 나타나요 — ! 가 뜨면 바로 이동"], [12, "분신 중 진짜는 하나 — 공격받으면 사라지는 쪽이 가짜"]] },
    ],
  },
  // 2026-11-25 순서 변경: 정용(7번째, 현곤 출전) → 재한(8번째, 경수 또는 정용 출전)
  // 보스 체력: 출전 캐릭터 단일 대상 지속 피해 실측(초당, 기본+스킬·포켓몬 포함) 현곤 404 · 경수 270 · 정용 186 비율로 맞춤
  jeongyong: {
    reward: "bear", players: ["summoner"], title: "분노의 거대 백곰", sub: "다단계 전투 + 최종 보스", target: "8~10분", scaleW: 7,
    stages: [
      { label: "1단계", time: 90, count: 40, kinds: ["melee", "tank", "ranged"], tips: [[0.5, "포켓몬 버튼: 적 무리 쪽으로 던지기 — 포켓몬 시야(250)도 함께 보여요"], [10, "E 교체: 단단한 탱커엔 잠만보, 무리엔 피카츄 연쇄 번개"], [24, "포켓몬은 현곤에서 400 넘게 멀어지면 돌아와요 — 너무 멀리 도망가지 않기"]] },
      { label: "2단계", time: 90, count: 48, kinds: ["melee", "tank", "summoner", "support", "elite"], tips: [[0.5, "엘리트(큰 오라) 등장 — 체력이 4배"], [12, "지원형(회복)·소환형을 포켓몬으로 먼저 정리"]] },
      { label: "중간 보스", boss: "runner", hp: 21000, tips: [[0.5, "자기애의 화신: 연속 질주·추적 하트 — 옆으로 크게 피하기"], [10, "포켓몬을 보스 쪽에 두고 현곤은 거리 유지"]] },
      { label: "3단계", time: 70, count: 40, kinds: "all", tips: [[0.5, "마지막 관문 — 모든 유형의 적"]] },
      { label: "최종 보스", boss: "bear", hp: 40000, tips: [[0.5, "분노의 거대 백곰: 연속 점프·충격파(틈으로 피하기)·회복"], [10, "R 「한잔했어!」: 포켓몬 3마리 동시 소환 — 보스에게 아껴 두기"], [20, "회복할 때 공격을 몰아서"]] },
    ],
  },
  jaehan: {
    reward: "soccer", players: ["stripe", "bear"], title: "폭주하는 스트라이커", sub: "연속 전투 + 슈팅 패턴 회피 보스", target: "7~9분", scaleW: 8,
    stages: [
      { label: "1단계", time: 90, count: 36, kinds: ["ranged", "mobile"], tips: [[0.5, "슈팅 적 다수 — 탄이 날아오는 선을 보고 옆으로"], [6, { stripe: "경수 Q 「나 안 놀아」: 3초 은신 — 자동 조준·추적에서 빠져요 (맞아도 유지, 공격하면 해제)", bear: "정용 Q 「나 원래 빠른데」: 네발 질주로 슈팅 사이를 빠져나가기" }], [20, { stripe: "패시브: 적 등 뒤를 공격하면 피해 ×1.5", bear: "패시브: 주변 적이 많을수록 받는 피해 감소 (최대 3명)" }]] },
      { label: "2단계", time: 90, count: 40, kinds: ["ranged", "thrower", "tank", "melee"], tips: [[0.5, { stripe: "E 「두고 보자」: 돌진해 주변 피해 — 은신에서 기습!", bear: "E 「나 안 삐졌는데」: 꿀 먹고 HP 25% 회복 — 위험할 때" }]] },
      { label: "중간 보스", boss: "suit", hp: { stripe: 12500, bear: 8600 }, tips: [[0.5, "연속 전투: 폭주하는 복서를 먼저 쓰러뜨리세요 — 연속 돌진은 예고선 옆으로"], [10, { stripe: "R 분신 4개: 여러 적에게 나눠 공격", bear: "R 「나 진짜 세거든」: 점프 착지 중심 1400 + 기절" }]] },
      { label: "최종 보스", boss: "soccer", hp: { stripe: 25000, bear: 17200 }, tips: [[0.5, "폭주하는 스트라이커: 3방향 슈팅·연속 폭발·휘는 슛"], [12, "연속 폭발은 앞에서부터 차례로 터져요 — 줄 옆으로 비켜서기"]] },
    ],
  },
};
// 미션 목록 순서 (2026-11-25 최종): 동기 → 현곤 → 은숙 → 기섭 → 상훈 → 경수 → 정용 → 재한
// requires = 선행 영입 조건 (이 캐릭터들이 모두 영입돼야 열림, 순서 건너뛰기 방지)
// players  = 출전 가능 캐릭터 (any: 여럿 중 선택). 두 조건은 따로 검사
const STORY_ORDER = [
  { id: "hyeongon", reward: "summoner", requires: ["suit"], players: ["suit"] },
  { id: "eunsuk", reward: "support", requires: ["summoner"], players: ["summoner"] },
  { id: "giseop", reward: "runner", requires: ["support"], players: ["suit", "summoner"], any: true },
  { id: "sanghun", reward: "octo", requires: ["runner"], players: ["runner"] },
  { id: "gyeongsu", reward: "stripe", requires: ["octo"], players: ["octo"] },
  { id: "jeongyong", reward: "bear", requires: ["stripe"], players: ["summoner"] },
  { id: "jaehan", reward: "soccer", requires: ["bear"], players: ["stripe", "bear"], any: true },
];
