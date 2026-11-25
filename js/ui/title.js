// ===== 타이틀 화면 (게임 처음 열 때) =====
// 완성된 타이틀 이미지 1장을 그대로 표시하고, 그림 속 TAP TO START·설정 아이콘 위치에 투명 버튼을 겹침
// 시작 → 기존 메인 로비로 전환. 로비·전투 코드는 건드리지 않음
// 반응형: 무대는 이미지 비율(1672:941) 그대로 화면 안에 꽉 차게(contain) → 그림이 잘리지 않고 버튼 위치도 항상 일치.
//         화면 비율이 달라 남는 곳은 같은 그림을 흐리게 깔아 채움

function buildTitle() {
  const T = TITLE_IMAGE;
  el("titleBg").src = T.src;
  el("titleArt").src = T.src;
  el("title").style.setProperty("--title-ar", `${T.width} / ${T.height}`);
  el("title").style.setProperty("--title-k", String(T.width / T.height));
  const s = el("titleStart").style;
  s.left = T.start.x + "%";
  s.top = T.start.y + "%";
  s.width = T.start.w + "%";
  s.height = T.start.h + "%";
  const g = el("titleSettings").style;
  g.left = T.settings.cx + "%";
  g.top = T.settings.cy + "%";
  g.width = T.settings.d + "%";
  el("title").hidden = false;
  document.body.classList.add("titleOpen");
}
function closeTitle() {
  el("title").hidden = true;
  el("titleSettingsPanel").hidden = true;
  document.body.classList.remove("titleOpen");
  bindAudioUI(); // 로비 사운드 슬라이더에 타이틀에서 바꾼 값 반영
  sfx("ui_click");
  if (typeof openModePanel === "function") openModePanel(); // 타이틀 → 플레이 모드 선택
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
// PC: Enter / Space 로도 시작
document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("titleOpen") || !el("titleSettingsPanel").hidden) return;
  if (e.code === "Enter" || e.code === "Space") {
    e.preventDefault();
    closeTitle();
  }
});
buildTitle();
