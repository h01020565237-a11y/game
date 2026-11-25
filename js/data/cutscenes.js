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
  jeongyong: { name: "정용", pitch: 0.72, rate: 1.0, gender: "m", prefer: [], direction: "묵직한 남성 저음, 걱정→분노" },
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
      { img: "assets/cutscenes/hyeongon/01.webp", size: [825, 311], t: 3.25, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "street"], [0.41, "steps"]], voice: [[0.81, "donggi", "대화역은 이쪽이지!", null]] },
      { img: "assets/cutscenes/hyeongon/02.webp", size: [825, 311], t: 2.44, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.08, "rustle"]], voice: [] },
      { img: "assets/cutscenes/hyeongon/03.webp", size: [825, 303], t: 3.25, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.0, "pop"]], voice: [[0.33, "hyeongon", "대화역은 저쪽이지!", null]] },
      { img: "assets/cutscenes/hyeongon/04.webp", size: [825, 303], t: 2.44, motion: "shake", bgm: "stop", cover: true, unlock: false, sfx: [[0.81, "impact"]], voice: [[0.81, "hyeongon", "너 맞을래?!", null]] },
      { img: "assets/cutscenes/hyeongon/05.webp", size: [825, 300], t: 1.62, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.16, "awkward"]], voice: [] },
      { img: "assets/cutscenes/hyeongon/06.webp", size: [825, 300], t: 2, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
  eunsuk: {
    name: "은숙", title: "새벽별교회 사건", reward: "support", label: [196, 35],
    scenes: [
      { img: "assets/cutscenes/eunsuk/01.webp", size: [824, 310], t: 3.95, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.16, "paper"]], voice: [[0.4, "hyeongon", "우리 새벽별교회 놀러 와!", null], [2.37, "eunsuk", "네, 오빠!", null]] },
      { img: "assets/cutscenes/eunsuk/02.webp", size: [824, 310], t: 3.16, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.16, "steps"]], voice: [] },
      { img: "assets/cutscenes/eunsuk/03.webp", size: [824, 298], t: 3.16, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [], voice: [[0.24, "eunsuk", "현곤 오빠 어딨어요?", "assets/audio/cutscene/voice/eunsuk/03_eunsuk.wav"], [1.9, "church", "현곤이?", "assets/audio/cutscene/voice/eunsuk/03_church.wav"]] },
      { img: "assets/cutscenes/eunsuk/04.webp", size: [824, 298], t: 1.98, motion: "zoom", bgm: "stop", cover: false, unlock: false, sfx: [[0.16, "impact"]], voice: [[0.24, "church", "걔 군대 갔어.", "assets/audio/cutscene/voice/eunsuk/04_church.wav"]] },
      { img: "assets/cutscenes/eunsuk/05.webp", size: [759, 305], t: 3.16, motion: "pan", bgm: "stop", cover: true, unlock: false, sfx: [[0.0, "march"]], voice: [[0.32, "hyeongon", "하나! 둘! 하나! 둘!", "assets/audio/cutscene/voice/eunsuk/05_hyeongon.wav"]] },
      { img: "assets/cutscenes/eunsuk/06.webp", size: [332, 305], t: 1.58, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.16, "awkward"]], voice: [] },
      { img: "assets/cutscenes/eunsuk/07.webp", size: [557, 305], t: 2, motion: "still", bgm: "stop", cover: false, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
  giseop: {
    name: "기섭", title: "매트리스 사건", reward: "runner", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/giseop/01.webp", size: [823, 287], t: 3.06, motion: "still", bgm: "play", cover: true, unlock: false, sfx: [], voice: [] },
      { img: "assets/cutscenes/giseop/02.webp", size: [822, 287], t: 3.06, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "drag"]], voice: [[0.23, "hyeongon", "헤헤헤! 캬하하!", null]] },
      { img: "assets/cutscenes/giseop/03.webp", size: [823, 269], t: 3.06, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [], voice: [[0.08, "donggi", "크크크!", null], [0.99, "hyeongon", "헤헤헤!", null]] },
      { img: "assets/cutscenes/giseop/04.webp", size: [822, 269], t: 1.53, motion: "shake", bgm: "stop", cover: true, unlock: false, sfx: [[0.0, "impact"]], voice: [[0.15, "giseop", "웃기냐?", null]] },
      { img: "assets/cutscenes/giseop/05.webp", size: [823, 293], t: 2.29, motion: "still", bgm: "stop", cover: true, unlock: false, sfx: [[0.08, "huff"]], voice: [[0.15, "hyeongon", "캬하하하!", null]] },
      { img: "assets/cutscenes/giseop/06.webp", size: [822, 293], t: 2, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
  sanghun: {
    name: "상훈", title: "섬 사건", reward: "octo", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/sanghun/01.webp", size: [823, 287], t: 3.2, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "car"]], voice: [] },
      { img: "assets/cutscenes/sanghun/02.webp", size: [823, 269], t: 3.2, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "car"]], voice: [[0.32, "sanghun", "어! 저기 바다에 땅이 떠 있다!", null]] },
      { img: "assets/cutscenes/sanghun/03.webp", size: [822, 269], t: 3.2, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.0, "pop"]], voice: [[0.24, "giseop", "저게 섬이라는 거야!!", null]] },
      { img: "assets/cutscenes/sanghun/04.webp", size: [823, 293], t: 2.4, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.16, "ding"]], voice: [] },
      { img: "assets/cutscenes/sanghun/05.webp", size: [822, 293], t: 2, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
  gyeongsu: {
    name: "경수", title: "커플룩 사건", reward: "stripe", label: [226, 40],
    scenes: [
      { img: "assets/cutscenes/gyeongsu/01.webp", size: [712, 285], t: 2.89, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "street"], [0.36, "steps"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/02.webp", size: [712, 285], t: 2.89, motion: "pan", bgm: "play", cover: true, unlock: false, sfx: [[0.0, "street"], [0.29, "steps"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/03.webp", size: [712, 304], t: 2.17, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.14, "pop"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/04.webp", size: [712, 304], t: 2.17, motion: "zoom", bgm: "stop", cover: true, unlock: false, sfx: [[0.14, "ding"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/05.webp", size: [712, 397], t: 2.89, motion: "pan", bgm: "stop", cover: true, unlock: false, sfx: [[0.0, "steps"], [2.17, "shutter"]], voice: [] },
      { img: "assets/cutscenes/gyeongsu/06.webp", size: [712, 397], t: 2, motion: "still", bgm: "stop", cover: true, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
  jeongyong: {
    name: "정용", title: "안 나오면 너 죽어!", reward: "bear", label: [0, 0],
    scenes: [
      { img: "assets/cutscenes/jeongyong/01.webp", size: [555, 294], t: 2, motion: "zoom", bgm: "play", cover: false, unlock: false, sfx: [[0, "car"], [0.1, "ding"]], voice: [[0.08, "jeongyong", "아… 기름 없는데…", null]] },
      { img: "assets/cutscenes/jeongyong/02.webp", size: [559, 294], t: 3, motion: "pan", bgm: "play", cover: false, unlock: false, sfx: [[0, "car"]], voice: [[0.08, "hyeongon", "괜찮아~ 그냥 가봐. 가다 보면 나와.", null]] },
      { img: "assets/cutscenes/jeongyong/03.webp", size: [540, 294], t: 1.5, motion: "pan", bgm: "play", cover: false, unlock: false, sfx: [[0, "car"]], voice: [[0.08, "hyeongon", "괜찮아~ 더 가봐.", null]] },
      { img: "assets/cutscenes/jeongyong/04.webp", size: [533, 287], t: 1.5, motion: "zoom", bgm: "stop", cover: false, unlock: false, sfx: [[0.1, "huff"]], voice: [[0.08, "jeongyong", "하…", null]] },
      { img: "assets/cutscenes/jeongyong/05.webp", size: [536, 287], t: 2, motion: "zoom", bgm: "stop", cover: false, unlock: false, sfx: [[0, "ding"]], voice: [[0.08, "hyeongon", "거봐! 나온다니까!", null]] },
      { img: "assets/cutscenes/jeongyong/06.webp", size: [585, 287], t: 3, motion: "shake", bgm: "stop", cover: false, unlock: false, sfx: [[0.1, "impact"]], voice: [[0.08, "jeongyong", "너 주유소 안 나왔으면 진짜 때리려고 했어!", null]] },
      { img: "assets/cutscenes/jeongyong/07.webp", size: [1664, 275], t: 2, motion: "still", bgm: "stop", cover: false, unlock: true, sfx: [[0.0, "fanfare"]], voice: [] },
    ],
  },
};

// ----- 연출 수치 (손으로 조정, 가져오기 스크립트가 덮어쓰지 않음) -----
const CUTSCENE_RULES = {
  fit: 0.92,          // 화면 대비 그림 최대 크기 (확대해도 말풍선이 안 잘리게 여백)
  fade: 0.15,         // 장면 전환(겹쳐 사라짐) 초 (2026-11-25: 0.28 → 0.15)
  pan: { scale: 1.05, move: 0.015 },  // 천천히 옆으로 이동
  zoom: { from: 1, to: 1.085 },       // 카메라 확대
  still: { to: 1.015 },
  shake: { px: 9, dur: 0.42, scale: 1.04 }, // 화면 흔들림 (impact 효과음 시점, 없으면 장면 시작)
  shakeOn: ["impact"],
  unlockFlash: 0.35,  // 영입 화면 진입 하얀 번쩍임
  bgmStopFade: 0.03,  // BGM 끊기 (짧을수록 코믹)
  ttsFallback: true,  // 녹음 파일이 없으면 브라우저 음성으로 임시 재생
  voiceHold: 5,       // 장면 시간이 끝나도 대사가 아직 나오는 중이면 최대 이만큼(초) 더 기다림. 무음·오류면 바로 진행, 스킵은 즉시
};
