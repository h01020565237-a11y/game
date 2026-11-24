// ===== 타이틀 화면 (게임 처음 열 때) =====
// 시작 → 기존 메인 로비로 전환. 로비·전투 코드는 건드리지 않음
// 레이어: 배경(화면 전체 cover) → 16:9 무대(로고, 캐릭터, 버튼). 화면 비율이 달라도 무대는 16:9 를 유지하고 배경이 남는 곳을 채움

function titleLayout(list) {
  const L = TITLE_LAYOUT, n = list.length, left = Math.ceil(n / 2), right = n - left;
  const half = (100 - L.centerGap) / 2 - L.side;
  return list.map((c, i) => {
    const onLeft = i < left, k = onLeft ? i : i - left, cnt = onLeft ? left : right;
    // 가장자리는 앞줄, 가운데 쪽으로 갈수록 번갈아 뒷줄 (단체 사진처럼)
    const back = c.back !== undefined ? c.back : k % 2 === (onLeft ? 1 : 0) && cnt > 1;
    const row = back ? L.back : L.front;
    const x0 = onLeft ? L.side : 100 - L.side - half;
    const x = c.x !== undefined ? c.x : x0 + half * (cnt === 1 ? 0.5 : (k + 0.5) / cnt);
    return { ...c, x, y: c.y !== undefined ? c.y : row.y, h: c.h !== undefined ? c.h : row.h, back, flip: c.flip !== undefined ? c.flip : !onLeft };
  });
}

// 원본 PNG 의 실제 그림 영역(알파 > 20)을 잼. 그림을 읽을 수 없는 환경(file:// 등)이면 이미지 전체를 그림 영역으로 봄
function figureBox(im) {
  const w = im.naturalWidth, h = im.naturalHeight;
  try {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(im, 0, 0);
    const a = cx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 20) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    if (x1 >= x0) return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  } catch (e) {}
  return { x0: 0, y0: 0, x1: w, y1: h };
}
// 그림 영역 기준: 키 = c.h(무대 세로 %), 발 = c.y, 가로 가운데 = c.x. 무대는 16:9
function placeTitleChar(im, c) {
  const b = figureBox(im), s = c.h / (b.y1 - b.y0); // 원본 1px 당 무대 세로 %
  const W = im.naturalWidth, H = im.naturalHeight, ar = 9 / 16;
  const cx = c.flip ? W - (b.x0 + b.x1) / 2 : (b.x0 + b.x1) / 2;
  im.style.height = H * s + "%";
  im.style.top = c.y - b.y1 * s + "%";
  im.style.left = c.x - cx * s * ar + "%";
  if (c.flip) im.classList.add("flip");
}
function buildTitle() {
  const t = el("title");
  el("titleBg").src = TITLE_ART.background;
  el("titleLogo").src = TITLE_ART.logo;
  el("titleLogo").style.width = TITLE_LAYOUT.logo.w + "%";
  el("titleLogo").style.top = TITLE_LAYOUT.logo.top + "%";
  const box = el("titleChars");
  box.innerHTML = "";
  // 뒷줄 먼저 그려서 앞줄이 위에 오게
  const items = titleLayout(TITLE_CHARACTERS.filter((c) => LOBBY_ART[c.id])).sort((a, b) => b.back - a.back);
  items.forEach((c, i) => {
    const im = document.createElement("img");
    im.className = "title-char" + (c.back ? " back" : "");
    im.alt = DISPLAY_NAMES[c.id] || "";
    im.draggable = false;
    im.style.animationDelay = (i * 0.07).toFixed(2) + "s";
    im.onload = () => placeTitleChar(im, c);
    im.src = c.img || LOBBY_ART[c.id].full;
    box.append(im);
  });
  el("titleVersion").textContent = GAME_VERSION;
  t.hidden = false;
  document.body.classList.add("titleOpen");
}
function closeTitle() {
  el("title").hidden = true;
  el("titleSettingsPanel").hidden = true;
  document.body.classList.remove("titleOpen");
  bindAudioUI(); // 로비 사운드 슬라이더에 타이틀에서 바꾼 값 반영
  sfx("ui_click");
}
el("titleStart").onclick = closeTitle;
// 설정: 기존 사운드 설정(setAudio)을 그대로 사용
el("titleSettings").onclick = () => {
  const panel = el("titleSettingsPanel");
  panel.hidden = !panel.hidden;
  el("tVolBgm").value = Math.round(audio.settings.bgm * 100);
  el("tVolSfx").value = Math.round(audio.settings.sfx * 100);
  el("tMute").textContent = audio.settings.muted ? "소리 켜기" : "음소거";
  sfx("ui_click");
};
el("tVolBgm").oninput = (e) => setAudio("bgm", e.target.value / 100);
el("tVolSfx").oninput = (e) => setAudio("sfx", e.target.value / 100);
el("tMute").onclick = () => {
  setAudio("muted", !audio.settings.muted);
  el("tMute").textContent = audio.settings.muted ? "소리 켜기" : "음소거";
};
el("tClose").onclick = () => {
  el("titleSettingsPanel").hidden = true;
  sfx("ui_click");
};
buildTitle();
// PC: Enter / Space 로도 시작
document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("titleOpen") || !el("titleSettingsPanel").hidden) return;
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    closeTitle();
  }
});
