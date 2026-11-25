// 소환수 그래픽 V2 (Juyeop_Summon_V2 팩, manifest.json). 그래픽만 바꿈: 능력치·스킬·공격 판정·쿨타임·덱·저장 데이터는 그대로
//   (소환수 번호·저장된 덱은 mons 번호 그대로 → 그래픽만 번호에 연결. 이름 표시는 바꾸지 않음)
// 그림: assets/summons_v2/<id>/ — 독자 디자인 저폴리 3D 렌더 → 공개 빌드 포함 (V1 팩은 포켓몬 유사로 사용 중단)
// 시트: 256×512, 64×64 칸, 가로 4프레임 × 세로 8방향 (N, NE, E, SE, S, SW, W, NW = 게임 방향 0~7 과 같은 순서)
// anchor: 발 위치 — 팩 권장 (32,44), 실측 발 아래끝 47~53 → 48 로 맞춤 (그림자 위에 서게)
// dur: 프레임별 시간(1/60초) — idle 4fps · move 8fps · attack 10fps (시각 연출만). 공격 모션은 1번 재생 후 대기/이동으로
// scale: 몸이 칸 안에서 30~40px → 1.2배로 소환수 키 약 44px (캐릭터 화면 키 56~60px 의 약 3/4)
// pet: 기존 소환수 번호 (mons). 진화형은 기본형 그림을 단계마다 조금 크게. 라프라스(6)·푸린(7)은 이 팩에 없어 기존 표시 유지
// candidate: 신규 후보 (스탯 미확정) — 그래픽만 등록, 게임에는 아직 안 나옴
const SUMMON_FRAME = { fw: 64, fh: 64, anchor: [32, 48], scale: 1.2, evoGrow: 0.08, dur: { idle: [15, 15, 15, 15], move: [8, 7, 8, 7], attack: [6, 6, 6, 6] } };
const SUMMON_GFX = {
  thunderi: { name: "썬더리", theme: "전기", legacy: "피카츄", pet: 0,
    icon: "assets/summons_v2/thunderi/icon.webp",
    anims: { idle: "assets/summons_v2/thunderi/idle.webp", move: "assets/summons_v2/thunderi/move.webp", attack: "assets/summons_v2/thunderi/attack.webp" } },
  bolkeron: { name: "볼케론", theme: "불", legacy: "파이리", pet: 1,
    icon: "assets/summons_v2/bolkeron/icon.webp",
    anims: { idle: "assets/summons_v2/bolkeron/idle.webp", move: "assets/summons_v2/bolkeron/move.webp", attack: "assets/summons_v2/bolkeron/attack.webp" } },
  akubi: { name: "아쿠비", theme: "물", legacy: "꼬부기", pet: 2,
    icon: "assets/summons_v2/akubi/icon.webp",
    anims: { idle: "assets/summons_v2/akubi/idle.webp", move: "assets/summons_v2/akubi/move.webp", attack: "assets/summons_v2/akubi/attack.webp" } },
  floraon: { name: "플로라온", theme: "풀", legacy: "이상해씨", pet: 3,
    icon: "assets/summons_v2/floraon/icon.webp",
    anims: { idle: "assets/summons_v2/floraon/idle.webp", move: "assets/summons_v2/floraon/move.webp", attack: "assets/summons_v2/floraon/attack.webp" } },
  gravak: { name: "그라바크", theme: "바위", legacy: "잠만보", pet: 5,
    icon: "assets/summons_v2/gravak/icon.webp",
    anims: { idle: "assets/summons_v2/gravak/idle.webp", move: "assets/summons_v2/gravak/move.webp", attack: "assets/summons_v2/gravak/attack.webp" } },
  phantomlantern: { name: "팬텀랜턴", theme: "고스트", legacy: "고오스", pet: 4,
    icon: "assets/summons_v2/phantomlantern/icon.webp",
    anims: { idle: "assets/summons_v2/phantomlantern/idle.webp", move: "assets/summons_v2/phantomlantern/move.webp", attack: "assets/summons_v2/phantomlantern/attack.webp" } },
  crystalgolem: { name: "크리스골렘", theme: "바위", legacy: null, candidate: true,
    icon: "assets/summons_v2/crystalgolem/icon.webp",
    anims: { idle: "assets/summons_v2/crystalgolem/idle.webp", move: "assets/summons_v2/crystalgolem/move.webp", attack: "assets/summons_v2/crystalgolem/attack.webp" } },
  skyreyon: { name: "스카이런", theme: "비행", legacy: null, candidate: true,
    icon: "assets/summons_v2/skyreyon/icon.webp",
    anims: { idle: "assets/summons_v2/skyreyon/idle.webp", move: "assets/summons_v2/skyreyon/move.webp", attack: "assets/summons_v2/skyreyon/attack.webp" } },
};
