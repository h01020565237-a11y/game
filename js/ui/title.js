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
    im.className = "title-char" + (c.back ? " back" : "") + (c.flip ? " flip" : "");
    im.src = LOBBY_ART[c.id].full;
    im.alt = DISPLAY_NAMES[c.id] || "";
    im.draggable = false;
    im.style.left = c.x + "%";
    im.style.top = c.y + "%";
    im.style.height = c.h + "%";
    im.style.animationDelay = (i * 0.07).toFixed(2) + "s";
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
