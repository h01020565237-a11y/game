// ===== 현곤 무한 생존 포켓몬 성장 (docs/characters/HYEONGON_POKEMON_SURVIVAL.md) =====
// - 기본 8종(0~7)은 스토리·배틀로얄과 같음. 8번부터는 무한 생존에서만 쓰는 진화·전설/환상 포켓몬
// - mons / PET_SKILLS / PET_LOOK 배열 뒤에 이어 붙임 → 번호(id) 하나로 기존 소환·기술 코드가 그대로 동작
// - 진화 능력치: 기본형 대비 단계마다 EVO_RULES 배율 (초기 제안값, QA 후 조정)
//
// 그림: 공식 일러스트(PokéAPI official-artwork)는 권리자 저작물이라 공개 저장소에는 올리지 않음 (기획서 규칙)
//   로컬 테스트: assets/pokemon/<도감번호>.png 에 넣으면 빌드가 테스트 링크에 넣고, 없으면 아이콘(이모지)으로 표시
//   (assets/pokemon/ 은 .gitignore 처리)

const EVO_RULES = { hp: 1.3, atk: 1.3, special: 1.2, range: 1.15 };

// kind: base 기본 / evo 진화 / legend 전설·환상.  from: 진화 전 id.  stage: 기본형으로부터 단계
const PET_DEX = [
  { dex: 25, kind: "base" }, { dex: 4, kind: "base" }, { dex: 7, kind: "base" }, { dex: 1, kind: "base" },
  { dex: 92, kind: "base" }, { dex: 143, kind: "base", boost: true }, { dex: 131, kind: "base", boost: true }, { dex: 39, kind: "base" },
];
// 진화 (이름, 아이콘, 도감번호, 진화 전 id) — 25→26, 4→5→6, 7→8→9, 1→2→3, 92→93→94, 39→40
const PET_EVOLUTIONS = [
  ["라이츄", "⚡", 26, 0], ["리자드", "🔥", 5, 1], ["리자몽", "🐉", 6, "리자드"], ["어니부기", "💧", 8, 2], ["거북왕", "🌊", 9, "어니부기"],
  ["이상해풀", "🌿", 2, 3], ["이상해꽃", "🌺", 3, "이상해풀"], ["고우스트", "👻", 93, 4], ["팬텀", "😈", 94, "고우스트"], ["푸크린", "🎵", 40, 7],
];
// 전설·환상: [이름, 아이콘, 도감번호, 공격력, 사거리, HP, 색, 기술]  (수치는 초기 제안)
const PET_LEGENDS = [
  ["레시라무", "🔥", 643, 260, 170, 2200, "#f4f1ea", { name: "크로스플레임", dmg: 520, radius: 130, targets: 7, burn: 3, burnDps: 90, text: "가까운({radius}) 적 최대 {targets}명에게 {dmg} 피해 + {burn}초 화상 (초당 {burnDps})" }],
  ["뮤", "✨", 151, 190, 180, 1600, "#f7a8d8", { name: "신비의 힘", dmg: 380, heal: 0.08, random: true, text: "현곤 최대 HP {heal%} 회복 + 무작위 기본 포켓몬 기술 (피해 {dmg})" }],
  ["뮤츠", "🔮", 150, 280, 200, 2000, "#b38ad9", { name: "사이코키네시스", dmg: 950, stun: 0.8, text: "적 1명에게 {dmg} 피해 + {stun}초 기절" }],
  ["레쿠쟈", "🐲", 384, 270, 190, 2300, "#3fae6b", { name: "용의 파동", dmg: 600, line: 420, width: 46, text: "앞으로 {line} 거리 직선 관통 {dmg} 피해" }],
  ["루기아", "🌪️", 249, 240, 190, 2400, "#c9d6f2", { name: "에어로블라스트", dmg: 440, radius: 150, targets: 7, push: 90, text: "가까운({radius}) 적 모두에게 {dmg} 피해 + 밀쳐냄" }],
  ["제크로무", "⚡", 644, 270, 170, 2300, "#3b3f52", { name: "크로스썬더", dmg: 470, targets: 3, stun: 1, text: "적 최대 {targets}명에게 {dmg} 피해 + {stun}초 기절" }],
];
// 잠만보·라프라스: 진화 대신 전용 강화 (단계당 EVO_RULES 배율, 최대 2단계)
const PET_BOOST_MAX = 2;

// 그림 경로 (도감번호별). 파일이 없으면 빌드가 빈 문자열로 바꿈 → 아이콘으로 표시
const PET_ART = {
  25: "assets/pokemon/25.png", 4: "assets/pokemon/4.png", 7: "assets/pokemon/7.png", 1: "assets/pokemon/1.png",
  92: "assets/pokemon/92.png", 143: "assets/pokemon/143.png", 131: "assets/pokemon/131.png", 39: "assets/pokemon/39.png",
  26: "assets/pokemon/26.png", 5: "assets/pokemon/5.png", 6: "assets/pokemon/6.png", 8: "assets/pokemon/8.png", 9: "assets/pokemon/9.png",
  2: "assets/pokemon/2.png", 3: "assets/pokemon/3.png", 93: "assets/pokemon/93.png", 94: "assets/pokemon/94.png", 40: "assets/pokemon/40.png",
  643: "assets/pokemon/643.png", 151: "assets/pokemon/151.png", 150: "assets/pokemon/150.png", 384: "assets/pokemon/384.png",
  249: "assets/pokemon/249.png", 644: "assets/pokemon/644.png",
};

// ----- 배열 확장 (기본 8종 뒤에 진화·전설) -----
const BASE_PET_COUNT = 8;
(function buildPetDex() {
  const byName = {};
  mons.forEach((m, i) => (byName[m[0]] = i));
  for (const [name, icon, dex, from] of PET_EVOLUTIONS) {
    const prev = typeof from === "number" ? from : byName[from];
    const P = mons[prev], S = PET_SKILLS[prev], baseId = PET_DEX[prev].base ?? prev, stage = (PET_DEX[prev].stage || 0) + 1;
    const id = mons.length;
    // 공격력·HP ×1.3, 사거리 ×1.15 (이전 단계 기준으로 한 단계씩)
    mons.push([name, icon, Math.round(P[2] * EVO_RULES.atk), Math.round(P[3] * EVO_RULES.range), Math.round(P[4] * EVO_RULES.hp)]);
    const sk = { ...S };
    for (const k of ["dmg", "burnDps"]) if (sk[k]) sk[k] = Math.round(sk[k] * EVO_RULES.special);
    for (const k of ["burn", "stun", "slow", "weak"]) if (sk[k]) sk[k] = +(sk[k] * EVO_RULES.special).toFixed(2);
    if (sk.push) sk.push = Math.round(sk.push * EVO_RULES.special);
    if (sk.radius) sk.radius = Math.round(sk.radius * EVO_RULES.range);
    PET_SKILLS.push(sk);
    PET_LOOK.push({ ...PET_LOOK[prev] });
    PET_DEX.push({ dex, kind: "evo", from: prev, base: baseId, stage });
    PET_DEX[prev].next = id;
    byName[name] = id;
  }
  for (const [name, icon, dex, atk, range, hp, color, skill] of PET_LEGENDS) {
    mons.push([name, icon, atk, range, hp]);
    PET_SKILLS.push(skill);
    PET_LOOK.push({ color });
    PET_DEX.push({ dex, kind: "legend" });
  }
  PET_DEX.forEach((d, i) => (d.id = i));
})();
const PET_LEGEND_IDS = PET_DEX.filter((d) => d.kind === "legend").map((d) => d.id);

// 그림 (불러오기 실패·없음 → null → 아이콘 사용)
const petArt = {};
for (const d of PET_DEX) {
  const src = PET_ART[d.dex];
  if (!src) continue;
  const im = new Image();
  im.onerror = () => (petArt[d.id] = null);
  im.onload = () => (petArt[d.id] = im);
  im.src = src;
}
// 버튼·카드용: 그림이 있으면 <img>, 없으면 아이콘 글자
function petIconHTML(id, cls = "pet-art") {
  const im = petArt[id];
  return im ? `<img class="${cls}" src="${im.src}" alt="" draggable="false">` : `<strong>${mons[id][1]}</strong>`;
}
