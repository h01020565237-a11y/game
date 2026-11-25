// 소환수 그래픽 (Juyeop_Summon_Assets 팩, manifest.json). 그래픽만 바꿈: 능력치·스킬·공격 판정·쿨타임은 js/data/pets.js · pokemon.js 그대로
// 그림 파일: assets/summons/<id>/ — 외형이 기존 포켓몬과 유사해 권리 검토 전까지 공개 저장소·공개 빌드 제외 (없으면 기존 그림/아이콘으로 대신)
// 시트: 64×64 칸, 가로 4프레임 × 세로 8방향 (N, NE, E, SE, S, SW, W, NW = 게임 방향 0~7 과 같은 순서), 발 기준점 (32, 56)
// dur: 프레임별 시간(1/60초) — idle 4fps · move 8fps · attack 10fps (시각 연출만). 공격 모션은 1번 재생 후 대기/이동으로
// scale: 64칸 → 화면 크기. 기존 캐릭터(화면 키 56~60px)와 맞춰 소환수 키 약 44px (캐릭터의 약 3/4)
// pet: 기존 소환수 번호 (mons). 진화형은 기본형 그림을 단계마다 조금 크게. 라프라스(6)·푸린(7)은 이 팩에 없어 기존 그림 유지
// candidate: 신규 후보 (스탯 미확정) — 그래픽만 등록, 게임에는 아직 안 나옴
const SUMMON_FRAME = { fw: 64, fh: 64, anchor: [32, 56], scale: 0.92, evoGrow: 0.08, dur: { idle: [15, 15, 15, 15], move: [8, 7, 8, 7], attack: [6, 6, 6, 6] } };
const SUMMON_GFX = {
  lightri: { name: "라이트리", element: "전기", legacy: "피카츄", color: "#F9C536", pet: 0,
    icon: "assets/summons/lightri/icon.webp", portrait: "assets/summons/lightri/portrait.webp",
    anims: { idle: "assets/summons/lightri/idle.webp", move: "assets/summons/lightri/move.webp", attack: "assets/summons/lightri/attack.webp" } },
  pyrion: { name: "파이리온", element: "불", legacy: "파이리", color: "#FA6A38", pet: 1,
    icon: "assets/summons/pyrion/icon.webp", portrait: "assets/summons/pyrion/portrait.webp",
    anims: { idle: "assets/summons/pyrion/idle.webp", move: "assets/summons/pyrion/move.webp", attack: "assets/summons/pyrion/attack.webp" } },
  aquaron: { name: "아쿠론", element: "물", legacy: "꼬부기", color: "#5DA9F3", pet: 2,
    icon: "assets/summons/aquaron/icon.webp", portrait: "assets/summons/aquaron/portrait.webp",
    anims: { idle: "assets/summons/aquaron/idle.webp", move: "assets/summons/aquaron/move.webp", attack: "assets/summons/aquaron/attack.webp" } },
  floragon: { name: "플로라곤", element: "풀", legacy: "이상해씨", color: "#70C96B", pet: 3,
    icon: "assets/summons/floragon/icon.webp", portrait: "assets/summons/floragon/portrait.webp",
    anims: { idle: "assets/summons/floragon/idle.webp", move: "assets/summons/floragon/move.webp", attack: "assets/summons/floragon/attack.webp" } },
  jamtori: { name: "잠토리", element: "노말", legacy: "잠만보", color: "#8192B8", pet: 5,
    icon: "assets/summons/jamtori/icon.webp", portrait: "assets/summons/jamtori/portrait.webp",
    anims: { idle: "assets/summons/jamtori/idle.webp", move: "assets/summons/jamtori/move.webp", attack: "assets/summons/jamtori/attack.webp" } },
  gastron: { name: "가스트론", element: "고스트", legacy: "고오스", color: "#B46AF3", pet: 4,
    icon: "assets/summons/gastron/icon.webp", portrait: "assets/summons/gastron/portrait.webp",
    anims: { idle: "assets/summons/gastron/idle.webp", move: "assets/summons/gastron/move.webp", attack: "assets/summons/gastron/attack.webp" } },
  bawiron: { name: "바위론", element: "바위", legacy: null, color: "#A29B83", candidate: true,
    icon: "assets/summons/bawiron/icon.webp", portrait: "assets/summons/bawiron/portrait.webp",
    anims: { idle: "assets/summons/bawiron/idle.webp", move: "assets/summons/bawiron/move.webp", attack: "assets/summons/bawiron/attack.webp" } },
  windbird: { name: "윈드버드", element: "비행", legacy: null, color: "#D49C67", candidate: true,
    icon: "assets/summons/windbird/icon.webp", portrait: "assets/summons/windbird/portrait.webp",
    anims: { idle: "assets/summons/windbird/idle.webp", move: "assets/summons/windbird/move.webp", attack: "assets/summons/windbird/attack.webp" } },
};
