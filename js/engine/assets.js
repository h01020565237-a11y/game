// 캔버스와 이미지 로딩
//
// 모든 이미지는 loadImage() 로 등록되고, assetsReady() 가 true 가 될 때까지
// 메인 루프는 로딩 화면만 그린다 (이미지가 없어 캐릭터가 안 보이던 문제 수정).
// 참고: assets/characters/summoner-hd.webp(대시 잔상 전용이던 고해상도 시트)와
//       assets/portraits/*.webp(초상화, 게임 화면에서는 쓰지 않음)는 저장소에 그대로 두고
//       로딩만 하지 않는다. 캐릭터 선택 화면 등에서 쓸 수 있음.

const c = document.querySelector("canvas"), g = c.getContext("2d");
const assetList = [];
function loadImage(src) {
  const im = new Image();
  im.src = src;
  const entry = { im, src, done: false, failed: false };
  const finish = (ok) => {
    entry.done = true;
    entry.failed = !ok;
    if (!ok) console.warn("이미지 로딩 실패:", src);
  };
  // decode(): 첫 그리기 때 디코딩으로 멈추는 현상 방지
  im.decode ? im.decode().then(() => finish(true), () => finish(im.naturalWidth > 0)) : (im.onload = () => finish(true), im.onerror = () => finish(false));
  assetList.push(entry);
  return im;
}
function assetsProgress() {
  return assetList.filter((e) => e.done).length / assetList.length;
}
function assetsReady() {
  return assetList.every((e) => e.done);
}

const bearImg = loadImage("assets/characters/bear.webp");
const runnerImg = loadImage("assets/characters/runner-dir.webp");
// 순서 중요: Object.keys(sheets) 순서로 봇 외형이 배정됨
const sheets = {};
// 동기(정장): 배경 제거 때 생긴 안쪽 구멍을 메운 복구본 (원본 suit-sheet.webp 보관, tools/fix_sheet_holes.py)
sheets.suit = loadImage("assets/characters/suit-sheet-fixed.webp");
sheets.octo = loadImage("assets/characters/octo-sheet.webp");
// 줄무늬: ChatGPT 인계 후보(stripe_run) 적용. 같은 그림에서 발 위치만 90px 기준선으로 정렬됨 (기존 파일 stripe-sheet.png 는 보관)
sheets.stripe = loadImage("assets/characters/stripe-run-sheet.webp");
sheets.soccer = loadImage("assets/characters/soccer-sheet.webp");
sheets.support = loadImage("assets/characters/support-sheet.webp");
sheets.summoner = loadImage("assets/characters/summoner-sheet.webp");
sheets.runner = loadImage("assets/characters/runner-sheet.webp");
// 정용(곰): ChatGPT 승인 디자인(빨간 스카프) 이동 시트. 맨 뒤에 둬서 봇 외형 배정 순서는 그대로
// 예전 그림(bear.webp, 방향당 1장)은 CHARACTER_ART.bearSheet = false 로 되돌릴 수 있음
sheets.bear = loadImage("assets/characters/bear-run-sheet.webp");
const crateArt = loadImage("assets/props/crate.webp");
const healArt = loadImage("assets/props/heal.png"); // 체력 회복 아이템 // 새 상자 그림을 못 불러올 때 대체용
// 상자 상태별 그림 (96×90, 잔디 받침 중심 = (48, 84))
const chestArt = {
  intact: loadImage("assets/props/chest-intact.webp"),
  hit: loadImage("assets/props/chest-hit.webp"),
  cracked: loadImage("assets/props/chest-cracked.webp"),
  heavy: loadImage("assets/props/chest-heavy-damage.webp"),
  burst1: loadImage("assets/props/chest-burst-1.webp"),
  burst2: loadImage("assets/props/chest-burst-2.webp"),
  debris: loadImage("assets/props/chest-debris.webp"),
};
// 무기 아이콘 (96×96), weapons 순서와 같음. 0번 맨손은 그림 없음
const weaponIcons = WEAPON_ART.map((w) => w && loadImage(w.src));
// 공격 모션 시트 (있을 때만)
const attackSheets = {};
for (const [k, v] of Object.entries(ATTACK_SPRITES)) attackSheets[k] = loadImage(v.src);
// 곰 Q 질주 전용 시트 (ChatGPT 인계 후보). CHARACTER_ART.bearSprint 가 true 일 때만 사용
const bearSprintImg = loadImage("assets/characters/bear-sprint-sheet.webp");
const jungle = loadImage(MAP_JUNGLE.background);
// 로비 그림
const lobbyArt = {};
for (const [k, v] of Object.entries(LOBBY_ART)) lobbyArt[k] = { face: loadImage(v.face), full: loadImage(v.full) };
