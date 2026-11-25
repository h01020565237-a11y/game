// 효과음·BGM 목록 (ChatGPT 사운드 담당과 공동 관리)
// - src 에 파일 경로만 바꾸면 교체됨 (wav/mp3/ogg). src 가 없으면 무음
// - vol: 기본 음량(0~1), max: 같은 소리 동시 재생 최대 수, gap: 같은 소리 최소 간격(초)
// - 이벤트가 실제로 일어났을 때만 재생 (버튼 입력 시도만으로는 재생하지 않음)
const SOUNDS = {
  punch: { src: "assets/audio/sfx/punch.wav", vol: 0.7 },
  sword: { src: "assets/audio/sfx/sword.wav", vol: 0.7 },
  hammer: { src: "assets/audio/sfx/hammer.wav", vol: 0.8 },
  pistol: { src: "assets/audio/sfx/pistol.wav", vol: 0.6 },
  shotgun: { src: "assets/audio/sfx/shotgun.wav", vol: 0.75 },
  sniper: { src: "assets/audio/sfx/sniper.wav", vol: 0.8 },
  grenade_throw: { src: "assets/audio/sfx/grenade_throw.wav", vol: 0.7 },
  grenade_explode: { src: "assets/audio/sfx/grenade_explode.wav", vol: 0.9, max: 3 },
  hit: { src: "assets/audio/sfx/hit.wav", vol: 0.55, max: 4, gap: 0.04 },
  crate_hit: { src: "assets/audio/sfx/crate_hit.wav", vol: 0.55, max: 3, gap: 0.05 },
  crate_break: { src: "assets/audio/sfx/crate_break.wav", vol: 0.8 },
  dash: { src: "assets/audio/sfx/dash.wav", vol: 0.6 },
  pickup: { src: "assets/audio/sfx/pickup.wav", vol: 0.7 },
  heal: { src: "assets/audio/sfx/heal.wav", vol: 0.7 },
  reload: { src: "assets/audio/sfx/reload.wav", vol: 0.35 },
  ui_click: { src: "assets/audio/sfx/ui_click.wav", vol: 0.6, ui: true },
  zone_warning: { src: "assets/audio/sfx/zone_warning.wav", vol: 0.6, ui: true },
  victory: { src: "assets/audio/sfx/victory.wav", vol: 0.9, ui: true },
  defeat: { src: "assets/audio/sfx/defeat.wav", vol: 0.9, ui: true },
  // 포켓몬 (현곤): 소환 / 교체 / 돌아감
  pet_summon: { src: "assets/audio/sfx/pet_summon.wav", vol: 0.7 },
  pet_switch: { src: "assets/audio/sfx/pet_switch.wav", vol: 0.7 },
  pet_return: { src: "assets/audio/sfx/pet_return.wav", vol: 0.6 },
  // 캐릭터 스킬: skill_<캐릭터>_<q|e> (현곤은 소환·교체가 스킬이라 pet_* 사용)
  skill_bear_q: { src: "assets/audio/sfx/skill_bear_q.wav", vol: 0.7 },
  skill_bear_e: { src: "assets/audio/sfx/skill_bear_e.wav", vol: 0.7 },
  skill_runner_q: { src: "assets/audio/sfx/skill_runner_q.wav", vol: 0.7 },
  skill_runner_e: { src: "assets/audio/sfx/skill_runner_e.wav", vol: 0.7 },
  skill_suit_q: { src: "assets/audio/sfx/skill_suit_q.wav", vol: 0.7 },
  skill_suit_e: { src: "assets/audio/sfx/skill_suit_e.wav", vol: 0.7 },
  skill_octo_q: { src: "assets/audio/sfx/skill_octo_q.wav", vol: 0.7 },
  skill_octo_e: { src: "assets/audio/sfx/skill_octo_e.wav", vol: 0.7 },
  skill_stripe_q: { src: "assets/audio/sfx/skill_stripe_q.wav", vol: 0.7 },
  skill_stripe_e: { src: "assets/audio/sfx/skill_stripe_e.wav", vol: 0.7 },
  skill_soccer_q: { src: "assets/audio/sfx/skill_soccer_q.wav", vol: 0.7 },
  skill_soccer_e: { src: "assets/audio/sfx/skill_soccer_e.wav", vol: 0.7 },
  skill_support_q: { src: "assets/audio/sfx/skill_support_q.wav", vol: 0.7 },
  skill_support_e: { src: "assets/audio/sfx/skill_support_e.wav", vol: 0.7 },
  // 아직 파일이 없는 소리: 무음 (파일이 오면 src 추가)
  pet_skill: { src: null, vol: 0.5 }, // 포켓몬 자동 기술
};

// 배경음악: 정글 전투 반복 재생 (32초 루프). 브라우저가 재생할 수 있는 첫 형식을 사용
// (아이폰 Safari 는 ogg 를 못 여는 경우가 있어 m4a 도 둠: tools 없이 ffmpeg 로 변환)
const BGM = { srcs: [["assets/audio/bgm/jungle_loop.ogg", "audio/ogg"], ["assets/audio/bgm/jungle_loop.m4a", "audio/mp4"]], vol: 0.6 };
// 파일이 없을 때 합성음으로 대신 낼지 (사양: 없는 효과음은 무음 → false). 테스트용으로 true 가능
const AUDIO_SYNTH_FALLBACK = false;

// 기본 음량 설정 (사용자가 바꾸면 브라우저에 저장)
const AUDIO_DEFAULTS = { bgm: 0.35, sfx: 0.8, voice: 0.9, muted: false }; // voice: 컷신 음성
