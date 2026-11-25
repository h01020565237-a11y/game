// ===== 영입 컷신 데이터 (tools/import_cutscenes.py 로 timeline.json 에서 생성) =====
// 그림은 승인본 그대로 사용 (수정 금지). 음성·효과음은 테스트용 → 파일만 바꾸면 교체됨
// voice 줄: [시작초, 화자, 대사, 녹음파일경로|null]  → 녹음 파일이 있으면 파일 재생, 없으면 브라우저 한국어 음성(임시)
// sfx 줄: [시작초, 효과음 id]  motion: pan | zoom | shake | still   bgm: play | stop (stop = 즉시 끊김, 코믹 연출)

const CUTSCENE_VOICES = {
  donggi: { name: "동기", pitch: 0.72, rate: 0.94, gender: "m", prefer: [], direction: "매력적이고 안정적인 남성 저음" },
  hyeongon: { name: "현곤", pitch: 1.25, rate: 1.09, gender: "m", prefer: [], direction: "얇은 남성 하이톤, 여성 음색 아님, 취하면 실없이 웃음" },
  eunsuk: { name: "은숙", pitch: 1.17, rate: 1.0, gender: "f", prefer: [], direction: "하이톤, 단단하고 또렷한 발음" },
  giseop: { name: "기섭", pitch: 0.68, rate: 0.96, gender: "m", prefer: [], direction: "묵직한 저음, 자신감; 상훈 편은 비웃는 톤" },
  sanghun: { name: "상훈", pitch: 1.17, rate: 1.04, gender: "m", prefer: [], direction: "얇고 능청스러운 얍삽한 음색" },
  gyeongsu: { name: "경수", pitch: 0.82, rate: 0.97, gender: "m", prefer: [], direction: "낮고 얍삽한 음색" },
  church: { name: "교회 사람", pitch: 1.0, rate: 0.92, gender: null, prefer: [], direction: "태연하게, 성별/연령 고정하지 않음" },
};
// 컷신 효과음 (테스트용 합성음, 교체 가능)
const CUTSCENE_SFX = {
  awkward: { src: "assets/audio/cutscene/awkward.wav", vol: 0.9 },
  car: { src: "assets/audio/cutscene/car.wav", vol: 0.9 },
  ding: { src: "assets/audio/cutscene/ding.wav", vol: 0.9 },
  drag: { src: "assets/audio/cutscene/drag.wav", vol: 0.9 },
  fanfare: { src: "assets/audio/cutscene/fanfare.wav", vol: 0.9 },
  huff: { src: "assets/audio/cutscene/huff.wav", vol: 0.9 },
  impact: { src: "assets/audio/cutscene/impact.wav", vol: 0.9 },
  march: { src: "assets/audio/cutscene/march.wav", vol: 0.9 },
  paper: { src: "assets/audio/cutscene/paper.wav", vol: 0.9 },
  pop: { src: "assets/audio/cutscene/pop.wav", vol: 0.9 },
  rustle: { src: "assets/audio/cutscene/rustle.wav", vol: 0.9 },
  shutter: { src: "assets/audio/cutscene/shutter.wav", vol: 0.9 },
  steps: { src: "assets/audio/cutscene/steps.wav", vol: 0.9 },
  street: { src: "assets/audio/cutscene/street.wav", vol: 0.9 },
};
const CUTSCENE_BGM = { src: "assets/audio/cutscene/cs_bgm.wav", vol: 0.8 };
const RECRUIT_STORIES = {
  hyeongon: {
    name: "현곤", title: "대화역 사건", reward: "summoner", label: [196, 35],
    scenes: [
      { img: "assets/cutscenes/hyeongon/01.webp", size: [825, 311], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "street"], [0.5, "steps"]], voice: [[1, "donggi", "대화역은 이쪽이지!", null]] },
      { img: "assets/cutscenes/hyeongon/02.webp", size: [825, 311], t: 3, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.1, "rustle"]], voice: [] },
      { img: "assets/cutscenes/hyeongon/03.webp", size: [825, 303], t: 4, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0, "pop"]], voice: [[0.4, "hyeongon", "대화역은 저쪽이지!", null]] },
      { img: "assets/cutscenes/hyeongon/04.webp", size: [825, 303], t: 3, motion: "shake", bgm: "stop", cover: true, unlock: false, sfx: [[1, "impact"]], voice: [[1, "hyeongon", "너 맞을래?!", null]] },
      { img: "assets/cutscenes/hyeongon/05.webp", size: [825, 300], t: 2, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.2, "awkward"]], voice: [] },
      { img: "assets/cutscenes/hyeongon/06.webp", size: [825, 300], t: 3, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0, "fanfare"]], voice: [] },
    ],
  },
  eunsuk: {
    name: "은숙", title: "새벽별교회 사건", reward: "support", label: [196, 35],
    scenes: [
      { img: "assets/cutscenes/eunsuk/01.webp", size: [824, 310], t: 5, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.2, "paper"]], voice: [[0.5, "hyeongon", "우리 새벽별교회 놀러 와!", null], [3, "eunsuk", "네, 오빠!", null]] },
      { img: "assets/cutscenes/eunsuk/02.webp", size: [824, 310], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.2, "steps"]], voice: [] },
      { img: "assets/cutscenes/eunsuk/03.webp", size: [824, 298], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [], voice: [[0.3, "eunsuk", "현곤 오빠 어딨어요?", "assets/audio/cutscene/voice/eunsuk/03_eunsuk.wav"], [2.4, "church", "현곤이?", "assets/audio/cutscene/voice/eunsuk/03_church.wav"]] },
      { img: "assets/cutscenes/eunsuk/04.webp", size: [824, 298], t: 2.5, motion: "zoom", bgm: "stop", cover: false, unlock: false, sfx: [[0.2, "impact"]], voice: [[0.3, "church", "걔 군대 갔어.", "assets/audio/cutscene/voice/eunsuk/04_church.wav"]] },
      { img: "assets/cutscenes/eunsuk/05.webp", size: [759, 305], t: 4, motion: "pan", bgm: "stop", cover: true, unlock: false, sfx: [[0, "march"]], voice: [[0.4, "hyeongon", "하나! 둘! 하나! 둘!", "assets/audio/cutscene/voice/eunsuk/05_hyeongon.wav"]] },
      { img: "assets/cutscenes/eunsuk/06.webp", size: [332, 305], t: 2, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.2, "awkward"]], voice: [] },
      { img: "assets/cutscenes/eunsuk/07.webp", size: [557, 305], t: 3, motion: "still", bgm: "stop", cover: false, unlock: true, sfx: [[0, "fanfare"]], voice: [] },
    ],
  },
  giseop: {
    name: "기섭", title: "매트리스 사건", reward: "runner", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/giseop/01.webp", size: [823, 287], t: 4, motion: "still", bgm: "play", cover: true, unlock: false, sfx: [], voice: [] },
      { img: "assets/cutscenes/giseop/02.webp", size: [822, 287], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "drag"]], voice: [[0.3, "hyeongon", "헤헤헤! 캬하하!", null]] },
      { img: "assets/cutscenes/giseop/03.webp", size: [823, 269], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [], voice: [[0.1, "donggi", "크크크!", null], [1.3, "hyeongon", "헤헤헤!", null]] },
      { img: "assets/cutscenes/giseop/04.webp", size: [822, 269], t: 2, motion: "shake", bgm: "stop", cover: true, unlock: false, sfx: [[0, "impact"]], voice: [[0.2, "giseop", "웃기냐?", null]] },
      { img: "assets/cutscenes/giseop/05.webp", size: [823, 293], t: 3, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.1, "huff"]], voice: [[0.2, "hyeongon", "캬하하하!", null]] },
      { img: "assets/cutscenes/giseop/06.webp", size: [822, 293], t: 3, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0, "fanfare"]], voice: [] },
    ],
  },
  sanghun: {
    name: "상훈", title: "섬 사건", reward: "octo", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/sanghun/01.webp", size: [823, 287], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "car"]], voice: [] },
      { img: "assets/cutscenes/sanghun/02.webp", size: [823, 269], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "car"]], voice: [[0.4, "sanghun", "어! 저기 바다에 땅이 떠 있다!", null]] },
      { img: "assets/cutscenes/sanghun/03.webp", size: [822, 269], t: 4, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0, "pop"]], voice: [[0.3, "giseop", "저게 섬이라는 거야!!", null]] },
      { img: "assets/cutscenes/sanghun/04.webp", size: [823, 293], t: 3, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.2, "ding"]], voice: [] },
      { img: "assets/cutscenes/sanghun/05.webp", size: [822, 293], t: 3, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0, "fanfare"]], voice: [] },
    ],
  },
  gyeongsu: {
    name: "경수", title: "커플룩 사건", reward: "stripe", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/gyeongsu/01.webp", size: [712, 285], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "street"], [0.5, "steps"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/02.webp", size: [712, 285], t: 4, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0, "street"], [0.4, "steps"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/03.webp", size: [712, 304], t: 3, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.2, "pop"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/04.webp", size: [712, 304], t: 3, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.2, "ding"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/05.webp", size: [712, 397], t: 4, motion: "pan", bgm: "stop", cover: true, unlock: false, sfx: [[0, "steps"], [3, "shutter"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/06.webp", size: [712, 397], t: 3, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0, "fanfare"]], voice: [] },
    ],
  },
};

// ----- 연출 수치 (손으로 조정, 가져오기 스크립트가 덮어쓰지 않음) -----
const CUTSCENE_RULES = {
  fit: 0.92,          // 화면 대비 그림 최대 크기 (확대해도 말풍선이 안 잘리게 여백)
  fade: 0.28,         // 장면 전환(겹쳐 사라짐) 초
  pan: { scale: 1.05, move: 0.015 },  // 천천히 옆으로 이동
  zoom: { from: 1, to: 1.085 },       // 카메라 확대
  still: { to: 1.015 },
  shake: { px: 9, dur: 0.42, scale: 1.04 }, // 화면 흔들림 (impact 효과음 시점, 없으면 장면 시작)
  shakeOn: ["impact"],
  unlockFlash: 0.35,  // 영입 화면 진입 하얀 번쩍임
  bgmStopFade: 0.03,  // BGM 끊기 (짧을수록 코믹)
  ttsFallback: true,  // 녹음 파일이 없으면 브라우저 음성으로 임시 재생
};
