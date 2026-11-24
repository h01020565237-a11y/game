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
sheets.suit = loadImage("assets/characters/suit-sheet.webp");
sheets.octo = loadImage("assets/characters/octo-sheet.webp");
sheets.stripe = loadImage("assets/characters/stripe-sheet.png");
sheets.soccer = loadImage("assets/characters/soccer-sheet.webp");
sheets.support = loadImage("assets/characters/support-sheet.webp");
sheets.summoner = loadImage("assets/characters/summoner-sheet.webp");
sheets.runner = loadImage("assets/characters/runner-sheet.webp");
const crateArt = loadImage("assets/props/crate.webp");
const jungle = loadImage(MAP_JUNGLE.background);
