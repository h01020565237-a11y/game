// 효과음·BGM 목록 (ChatGPT 사운드 담당과 공동 관리)
// - src 에 파일 경로만 바꾸면 교체됨 (wav/mp3/ogg). src 가 없거나 못 불러오면 synth(합성음)로 대신 재생
// - vol: 기본 음량(0~1), max: 같은 소리 동시 재생 최대 수, gap: 같은 소리 최소 간격(초)
// - 이벤트가 실제로 일어났을 때만 재생 (버튼 입력 시도만으로는 재생하지 않음)
const SOUNDS = {
  punch: { src: "assets/sfx/punch.wav", vol: 0.7 },
  sword: { src: "assets/sfx/sword.wav", vol: 0.7 },
  hammer: { src: "assets/sfx/hammer.wav", vol: 0.8 },
  pistol: { src: "assets/sfx/pistol.wav", vol: 0.6 },
  shotgun: { src: "assets/sfx/shotgun.wav", vol: 0.75 },
  sniper: { src: "assets/sfx/sniper.wav", vol: 0.8 },
  grenade_throw: { src: "assets/sfx/grenade_throw.wav", vol: 0.7 },
  grenade_explode: { src: "assets/sfx/grenade_explode.wav", vol: 0.9, max: 3 },
  hit: { src: "assets/sfx/hit.wav", vol: 0.55, max: 4, gap: 0.04 },
  crate_hit: { src: "assets/sfx/crate_hit.wav", vol: 0.55, max: 3, gap: 0.05 },
  crate_break: { src: "assets/sfx/crate_break.wav", vol: 0.8 },
  dash: { src: "assets/sfx/dash.wav", vol: 0.6 },
  pickup: { src: "assets/sfx/pickup.wav", vol: 0.7 },
  heal: { src: "assets/sfx/heal.wav", vol: 0.7 },
  reload: { src: "assets/sfx/reload.wav", vol: 0.35 },
  ui_click: { src: "assets/sfx/ui_click.wav", vol: 0.6, ui: true },
  zone_warning: { src: "assets/sfx/zone_warning.wav", vol: 0.6, ui: true },
  victory: { src: "assets/sfx/victory.wav", vol: 0.9, ui: true },
  defeat: { src: "assets/sfx/defeat.wav", vol: 0.9, ui: true },
  // 아직 파일이 없는 소리: 합성음으로 재생 (파일이 오면 src 만 추가)
  skill: { src: null, synth: "skill", vol: 0.5 },
  summon: { src: null, synth: "summon", vol: 0.5 },
};

// 배경음악: src 가 없으면 간단한 합성 루프를 재생 (임시)
const BGM = { src: null, vol: 0.6 };

// 기본 음량 설정 (사용자가 바꾸면 브라우저에 저장)
const AUDIO_DEFAULTS = { bgm: 0.35, sfx: 0.8, muted: false };
