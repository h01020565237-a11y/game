// 시작과 메인 루프
//
// 고정 시간 간격(1/60초) 업데이트 + 누적기 방식 (버그 수정 3.7).
// 예전에는 dt 를 0.035초로 잘라서, 28fps 아래로 떨어지면 게임 전체가 느리게 흘렀다.
// 이제는 프레임이 떨어져도 게임 속도는 실제 시간과 같고, 그리기만 덜 한다.

const STEP = 1 / 60;
const MAX_STEPS = 8; // 한 프레임에 따라잡을 최대 스텝 수 (약 0.13초)
let acc = 0;

function drawLoading() {
  g.fillStyle = "#17232b";
  g.fillRect(0, 0, VW, VH);
  g.fillStyle = "#b6c5a1";
  g.font = "24px sans-serif";
  g.textAlign = "center";
  g.fillText("Battle Lab 로딩 중…", VW / 2, VH / 2 - 24);
  g.fillStyle = "#26332b";
  g.fillRect(VW / 2 - 160, VH / 2, 320, 14);
  g.fillStyle = "#7de36c";
  g.fillRect(VW / 2 - 160, VH / 2, 320 * assetsProgress(), 14);
}

// ----- 인게임 일시정지 메뉴 (싱글·웨이브) -----
// 기존 menuOpen은 메인 루프의 고정 스텝과 누적 시간을 이미 정지한다.
// 메뉴 열기 자체로는 endSingle/reset/기록 저장을 호출하지 않는다.
function installBattlePauseMenu() {
  const arena = el("arena"), body = document.body;
  const style = document.createElement("style");
  style.textContent = `
    #battlePause[hidden], #battlePause [hidden] { display:none !important; }
    #battlePause { position:absolute; inset:0; z-index:60; display:grid; place-items:center; background:#070d20b8; touch-action:auto; }
    #battlePause .pause-card { width:min(78%,340px); max-height:94%; box-sizing:border-box; padding:clamp(10px,3vh,20px); overflow:auto; display:flex; flex-direction:column; gap:clamp(6px,1.6vh,12px); text-align:center; }
    #battlePause h3 { margin:0; color:#ffe17b; font-size:clamp(17px,4vh,25px); }
    #battlePause p { margin:0; color:#e0ebff; font-size:14px; }
    #battlePause button { min-height:38px; padding:8px 12px; font-size:clamp(15px,3.4vh,20px); width:100%; }
    #battlePause .pause-exit { background:#923536; color:#fff; box-shadow:0 4px 0 #52202c; }
    #battlePause label { display:grid; grid-template-columns:62px minmax(0,1fr) 36px; align-items:center; gap:6px; font-size:14px; text-align:left; }
    #battlePause input[type=range] { width:100%; min-width:0; touch-action:auto; accent-color:#ffcd51; }
    #pauseDesktopBtn { position:absolute; top:8px; left:10px; z-index:8; font-size:13px; min-height:32px; padding:5px 10px; }
    body:not(.mobile) #topHud { left:88px; }
    body.mobile #pauseDesktopBtn, body.lobbyOpen #pauseDesktopBtn, body.titleOpen #pauseDesktopBtn, body.modeOpen #pauseDesktopBtn, body.csOpen #pauseDesktopBtn { display:none; }
    body.menuOpen #skillTip { visibility:hidden; }
  `;
  document.head.append(style);
  const overlay = document.createElement("section");
  overlay.id = "battlePause";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "pauseHeading");
  overlay.innerHTML = `
    <div class="panel pause-card">
      <h3 id="pauseHeading">일시정지</h3>
      <div id="pauseHome" style="display:grid;gap:10px">
        <button type="button" class="btn btn-gold" id="pauseResume">▶ 이어하기</button>
        <button type="button" class="btn btn-blue" id="pauseOptions">옵션 · 사운드</button>
        <button type="button" class="btn pause-exit" id="pauseExit">나가기</button>
      </div>
      <div id="pauseSound" hidden>
        <div style="display:grid;gap:10px">
          <label>배경음 <input id="pauseBgm" type="range" min="0" max="100" aria-label="배경음"><output id="pauseBgmValue"></output></label>
          <label>효과음 <input id="pauseSfx" type="range" min="0" max="100" aria-label="효과음"><output id="pauseSfxValue"></output></label>
          <label>음성 <input id="pauseVoice" type="range" min="0" max="100" aria-label="음성"><output id="pauseVoiceValue"></output></label>
          <button type="button" class="btn btn-ghost" id="pauseMute">음소거</button>
          <button type="button" class="btn btn-blue" id="pauseSoundBack">뒤로가기</button>
        </div>
      </div>
      <div id="pauseConfirm" hidden>
        <div style="display:grid;gap:10px">
          <p>현재 전투 진행 상황이 사라집니다. 나갈까요?</p>
          <button type="button" class="btn pause-exit" id="pauseExitYes">나가기</button>
          <button type="button" class="btn btn-blue" id="pauseExitNo">취소</button>
        </div>
      </div>
    </div>`;
  arena.append(overlay);
  const pc = document.createElement("button");
  pc.id = "pauseDesktopBtn"; pc.type = "button";
  pc.className = "btn btn-ghost"; pc.textContent = "Ⅱ 메뉴";
  pc.setAttribute("aria-label", "일시정지 메뉴 (Esc)");
  arena.append(pc);
  const mobile = el("menuBtn");
  mobile.onpointerdown = null;
  let page = "pauseHome", returnFocus = null;
  const held = new Map(), blocked = new Map();
  const active = () => !overlay.hidden;
  const canOpen = () => !!singleRun && !over && !["lobbyOpen","titleOpen","modeOpen","csOpen"].some(k => body.classList.contains(k));
  // 멀티터치에서 메뉴를 여는 순간 공격·스킬 홀드를 취소한다.
  document.addEventListener("pointerdown", e => {
    if (e.target.closest?.("#touch, #skillBar") && e.target !== mobile) held.set(e.pointerId, e.target);
  }, true);
  for (const name of ["pointerup","pointercancel"]) document.addEventListener(name, e => held.delete(e.pointerId), true);
  function cancelCombatInput() {
    for (const [id, target] of [...held]) {
      try {
        target.dispatchEvent(new PointerEvent("pointercancel", {pointerId:id, bubbles:true}));
        if (target.hasPointerCapture?.(id)) target.releasePointerCapture(id);
      } catch (_) {}
    }
    held.clear();
    for (const k in keys) keys[k] = false;
    mouse.down = false;
    releaseSticks();
    releaseAttack(false);
    releaseGrenade(false);
    closeSwipe();
    skillAim = null;
    el("skillTip").hidden = true;
  }
  function showPage(next) {
    page = next;
    for (const id of ["pauseHome","pauseSound","pauseConfirm"]) el(id).hidden = id !== next;
    el("pauseHeading").textContent = next === "pauseSound" ? "사운드 옵션" : next === "pauseConfirm" ? "게임 나가기" : "일시정지";
    if (next === "pauseSound") syncSound();
    const first = el(next).querySelector("button");
    first?.focus({preventScroll:true});
  }
  function syncSound() {
    for (const [id,key] of [["Bgm","bgm"],["Sfx","sfx"],["Voice","voice"]]) {
      const n = Math.round((audio.settings[key] ?? 0.9)*100);
      el("pause"+id).value = n; el("pause"+id+"Value").textContent = n+"%";
    }
    el("pauseMute").textContent = audio.settings.muted ? "소리 켜기" : "음소거";
  }
  for (const [id,key] of [["Bgm","bgm"],["Sfx","sfx"],["Voice","voice"]]) {
    el("pause"+id).oninput = e => {
      setAudio(key, Number(e.target.value)/100);
      syncSound();
    };
  }
  el("pauseSfx").onchange = () => sfx("ui_click");
  el("pauseMute").onclick = () => { setAudio("muted", !audio.settings.muted); syncSound(); };
  function open() {
    if (active() || !canOpen()) return;
    returnFocus = document.activeElement;
    body.classList.add("menuOpen");
    cancelCombatInput();
    for (const id of ["touch","skillBar","c","pkDeckBtn","waveCards"]) {
      const node = el(id);
      if (node) { blocked.set(node, node.inert); node.inert = true; }
    }
    overlay.hidden = false;
    showPage("pauseHome");
    sfx("ui_click");
  }
  function close(restoreFocus = true) {
    cancelCombatInput();
    overlay.hidden = true;
    for (const [node, previous] of blocked) node.inert = previous;
    blocked.clear();
    acc = 0;
    last = performance.now();
    body.classList.remove("menuOpen");
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    returnFocus = null;
  }
  function back() {
    if (page !== "pauseHome") showPage("pauseHome");
    else close();
  }
  pc.onclick = mobile.onclick = open;
  el("pauseResume").onclick = () => close();
  el("pauseOptions").onclick = () => showPage("pauseSound");
  el("pauseSoundBack").onclick = back;
  el("pauseExit").onclick = () => showPage("pauseConfirm");
  el("pauseExitNo").onclick = back;
  el("pauseExitYes").onclick = () => {
    // 중도 포기: 기존 로비 복귀 루틴이 현재 판을 정리한다.
    close(false);
    openLobby();
    if (lobbyMode === "single") openSinglePanel();
  };
  // 메뉴가 열린 동안 기존 즉시 발동 Q/E/X/Space/우클릭 등을 차단.
  const originalKeydown = window.onkeydown;
  window.onkeydown = function(e) {
    if (e.code === "Escape" && (active() || canOpen())) {
      e.preventDefault();
      if (!e.repeat) active() ? back() : open();
      return;
    }
    if (active()) return;
    if (originalKeydown) originalKeydown.call(window,e);
  };
  // PC 우클릭·터치 호환 마우스 이벤트가 캔버스에 전달되어도 공격하지 않는다.
  const originalMouseDown = c.onmousedown;
  c.onmousedown = function(e) { if (!active() && originalMouseDown) originalMouseDown.call(c,e); };
  const help = el("help");
  if (help) help.textContent = help.textContent.replace("Esc 캐릭터 선택","Esc 일시정지 메뉴");
  const debugMenu = document.querySelector("#debugBar button");
  if (debugMenu) { debugMenu.textContent = "메뉴 (Esc)"; debugMenu.onclick = open; }
}

installBattlePauseMenu();

fitCanvas();
reset();
function loop(t) {
  trackFrame(t);
  beginFrame();
  if (!assetsReady()) {
    last = t;
    drawLoading();
    requestAnimationFrame(loop);
    return;
  }
  acc += Math.min(MAX_STEPS * STEP, (t - last) / 1e3 || 0);
  last = t;
  let n = 0;
  // 모바일 메뉴가 열려 있으면 게임 일시정지
  // 로비·메뉴가 열려 있으면 게임 일시정지
  if (document.body.classList.contains("menuOpen") || document.body.classList.contains("lobbyOpen") || document.body.classList.contains("csOpen")) acc = 0;
  while (acc >= STEP - 1e-9 && n < MAX_STEPS) {
    updateMouseWorld();
    update(STEP);
    tickSummonAim(STEP);
    acc -= STEP;
    n++;
  }
  if (n === MAX_STEPS) acc = 0;
  draw();
  touchHUD();
  uiFrame();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 다른 앱/탭으로 갔다 오면 밀린 시간을 한꺼번에 처리하지 않도록 초기화
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    last = performance.now();
    acc = 0;
  }
});
