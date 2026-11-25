// ===== 싱글모드 화면: 미션 선택, 웨이브 HUD, 강화 카드, 결과, 영입 컷신, 스토리 극장 =====

// 미션 목록: js/data/story_missions.js STORY_ORDER (출전 캐릭터 = 선행 조건)
const SINGLE_MISSIONS = STORY_ORDER.map((m) => ({ ...m, need: m.players, wave: true }));
const missionOpen = (ms) => ms.players.some((k) => singleSave.recruited.includes(k));

function openSinglePanel() {
  renderSinglePanel();
  el("singlePanel").hidden = false;
  sfx("ui_click");
}
function renderSinglePanel() {
  const list = el("missionList");
  list.innerHTML = "";
  for (const ms of SINGLE_MISSIONS) {
    const got = singleSave.recruited.includes(ms.reward), ok = missionOpen(ms) || ROSTER.testMode;
    const S = STORY_MISSIONS[ms.id], W = WAVE_MISSIONS[ms.id];
    const card = document.createElement("div");
    card.className = "mission" + (got ? " done" : "") + (!ok ? " locked" : "");
    const im = document.createElement("img");
    im.src = lobbyArt[ms.reward].face.src;
    im.alt = "";
    const info = document.createElement("div");
    const sub = S ? `${S.title} · ${S.sub}` : W.sub;
    const who = ms.players.map((k) => DISPLAY_NAMES[k]).join(ms.any ? " 또는 " : " + ");
    const target = S ? S.target : "3~5분";
    info.innerHTML = `<b>${DISPLAY_NAMES[ms.reward]} 영입</b><span>${sub}</span>` +
      `<small>출전: ${who} · 목표 ${target} · ${got ? "영입 완료" : ok ? (missionOpen(ms) ? "도전 가능" : "QA 해금으로 도전 가능") : "조건: " + who + " 영입"}</small>`;
    card.append(im, info);
    if (ok) {
      const btns = document.createElement("div");
      btns.className = "mission-btns";
      for (const k of ms.players) {
        if (!singleSave.recruited.includes(k) && !ROSTER.testMode) continue;
        const b = document.createElement("button");
        b.className = "btn btn-gold";
        b.textContent = ms.players.length > 1 ? `${DISPLAY_NAMES[k]}(으)로 출전` : got ? "다시 도전" : "시작";
        b.onclick = () => startMission(ms.id, k);
        btns.append(b);
      }
      card.append(btns);
    }
    list.append(card);
  }
  // 스토리 극장: 영입한 캐릭터의 컷신 다시 보기 (진행도·영입 변화 없음). 컷신이 없는 캐릭터(재한·정용)는 없음
  const th = el("theaterList");
  th.innerHTML = "";
  const story = (id) => RECRUIT_STORIES[id] || CUTSCENES[id];
  const seen = SINGLE_MISSIONS.filter((ms) => story(ms.id) && (singleSave.cleared[ms.id] || singleSave.recruited.includes(ms.reward) || ROSTER.testMode));
  if (!seen.length) th.textContent = "영입을 완료하면 컷신을 다시 볼 수 있어요.";
  for (const ms of seen) {
    const b = document.createElement("button");
    const got = singleSave.cleared[ms.id] || singleSave.recruited.includes(ms.reward);
    b.className = "btn btn-ghost" + (got ? "" : " test");
    b.textContent = "▶ " + DISPLAY_NAMES[ms.reward] + " · " + story(ms.id).title + (got ? "" : " (테스트)");
    b.onclick = () => playCutscene(ms.id, null);
    th.append(b);
  }
}
function startMission(id, who) {
  const ms = SINGLE_MISSIONS.find((m) => m.id === id);
  who = who || ms.players[0];
  if (!ms.players.includes(who)) return; // 지정된 캐릭터로만
  if (!singleSave.recruited.includes(who) && !ROSTER.testMode) return;
  el("singlePanel").hidden = true;
  if (STORY_MISSIONS[id]) beginStory(id, who);
  else beginSingle(id);
  sfx("ui_click");
  document.querySelector("#character").value = who;
  if (who === "summoner" && (lobbyDeck.length !== 3 || new Set(lobbyDeck).size !== 3)) lobbyDeck = [0, 1, 2];
  if (who === "summoner") deck = lobbyDeck.slice();
  document.querySelector("#charApply").click();
}
el("lobbySingle").onclick = openSinglePanel;
el("singleClose").onclick = () => {
  el("singlePanel").hidden = true;
  sfx("ui_click");
  if (lobbyMode === "single") openModePanel(); // 싱글 모드 → 모드 선택으로

};

// ----- 플레이 모드 선택 (타이틀 다음 화면) → 모드별 캐릭터 선택(로비) -----
// lobbyMode: "single" = 스토리·영입 미션 / "wave" = 무한 생존. PvP 는 1차 빌드에서 준비 중(진입 차단, 기존 코드 보존)
let lobbyMode = "single";
function openModePanel() {
  el("modePanel").hidden = false;
  document.body.classList.add("modeOpen");
  for (const b of document.querySelectorAll(".mode-hit.card")) b.classList.toggle("sel", b.dataset.mode === lobbyMode);
}
function chooseMode(mode) {
  if (mode === "pvp") { // 준비 중: 들어가지 않음
    sfx("ui_click");
    const t = el("modePvp");
    t.classList.remove("shake");
    void t.offsetWidth;
    t.classList.add("shake");
    return;
  }
  sfx("ui_click");
  lobbyMode = mode;
  el("modePanel").hidden = true;
  document.body.classList.remove("modeOpen");
  openLobby();
  if (mode === "single") openSinglePanel(); // 싱글: 미션마다 출전 캐릭터가 정해져 있어 미션 목록으로 바로
}
for (const b of document.querySelectorAll(".mode-hit.card")) b.onclick = () => chooseMode(b.dataset.mode);
el("modeNext").onclick = () => chooseMode(lobbyMode);
el("modeBack").onclick = () => { // 타이틀로
  sfx("ui_click");
  el("modePanel").hidden = true;
  document.body.classList.remove("modeOpen");
  el("title").hidden = false;
  document.body.classList.add("titleOpen");
};
// 설정: 소리 3종 + QA 전체 해금(일반 저장과 분리된 테스트 전용 스위치)
el("modeSettings").onclick = () => {
  sfx("ui_click");
  const p = el("modeSet");
  p.hidden = !p.hidden;
  el("mVolBgm").value = Math.round(audio.settings.bgm * 100);
  el("mVolSfx").value = Math.round(audio.settings.sfx * 100);
  el("mVolVoice").value = Math.round((audio.settings.voice ?? 0.9) * 100);
  el("mMute").textContent = audio.settings.muted ? "소리 켜기" : "음소거";
  el("mQa").checked = ROSTER.testMode;
};
el("mVolBgm").oninput = (e) => setAudio("bgm", e.target.value / 100);
el("mVolSfx").oninput = (e) => setAudio("sfx", e.target.value / 100);
el("mVolVoice").oninput = (e) => setAudio("voice", e.target.value / 100);
el("mMute").onclick = () => {
  setAudio("muted", !audio.settings.muted);
  el("mMute").textContent = audio.settings.muted ? "소리 켜기" : "음소거";
};
el("mQa").onchange = (e) => {
  setQaUnlock(e.target.checked);
  if (lobbyReady) buildLobby();
};
el("mClose").onclick = () => {
  sfx("ui_click");
  el("modeSet").hidden = true;
};
el("lobbyBack").onclick = () => {
  sfx("ui_click");
  closeModePanels();
  openModePanel();
};
function closeModePanels() {
  for (const id of ["modePanel", "singlePanel"]) el(id).hidden = true;
}
// 로비 시작 버튼: 싱글 = 미션 목록(고른 캐릭터로 출전) / 웨이브 = 무한 생존 시작
el("lobbyPlay").onclick = () => {
  el("lobbyErr").textContent = "";
  if (!canPlay(lobbySel)) {
    el("lobbyErr").textContent = lockReason(lobbySel);
    sfx("ui_click");
    return;
  }
  if (lobbySel === "summoner" && (lobbyDeck.length !== 3 || new Set(lobbyDeck).size !== 3)) {
    el("lobbyErr").textContent = "서로 다른 포켓몬 3마리를 골라 주세요.";
    return;
  }
  if (lobbyMode === "wave") startEndless(lobbySel);
  else openSinglePanel();
};
// 잠금 이유: 어떤 미션을 깨면 영입되는지 / 준비 중
function lockReason(k) {
  if (ROSTER.comingSoon.includes(k)) return `${DISPLAY_NAMES[k]}: 영입 미션 준비 중이에요.`;
  const ms = SINGLE_MISSIONS.find((m) => m.reward === k);
  if (!ms) return "아직 영입하지 않은 캐릭터예요.";
  const who = ms.players.map((n) => DISPLAY_NAMES[n]).join(ms.any ? " 또는 " : " + ");
  return `${DISPLAY_NAMES[k]}: 싱글 모드 「${DISPLAY_NAMES[k]} 영입」 미션(출전: ${who})을 깨면 영입돼요.` + (missionOpen(ms) ? "" : ` (먼저 ${who} 영입 필요)`);
}

// ----- 웨이브 HUD (전투 화면 위쪽) -----
function updateSingleHUD() {
  const R = singleRun;
  if (R.endless) return updateEndlessHUD(); // 무한 생존 (js/ui/endless.js)
  setText("aliveNum", String(waveRemaining()));
  el("aliveHud").firstChild.textContent = "남은 적 ";
  setText("zoneHud", R.m ? `${R.m.waves[Math.max(0, R.wave)].label} (${Math.max(1, R.wave + 1)}/${R.m.waves.length})` : "");
  const boss = bots.find((b) => b.mob === "boss" && b.hp > 0);
  const bh = el("bossHud");
  if (bh.hidden !== !boss) bh.hidden = !boss;
  if (boss) {
    el("bossFill").style.width = (100 * boss.hp / boss.max).toFixed(1) + "%";
    setText("bossName", "타락한 " + (DISPLAY_NAMES[boss.visual] || MOB_TYPES.boss.name));
  }
  const bn = el("waveBanner"), show = R.bannerT > 0 || R.phase === "intro";
  const txt = R.phase === "intro" ? "몰려오는 적을 모두 물리쳐라!" : R.banner;
  if (bn.hidden !== !show) bn.hidden = !show;
  if (show && bn.textContent !== txt) bn.textContent = txt;
  // 강화 카드
  const wc = el("waveCards"), cardOn = R.phase === "cards";
  if (wc.hidden !== !cardOn) {
    wc.hidden = !cardOn;
    if (cardOn) renderCards();
  }
}
function resetSingleHUD() {
  el("expHud").hidden = true;
  el("aliveHud").firstChild.textContent = "생존 ";
  el("bossHud").hidden = true;
  el("waveBanner").hidden = true;
  el("waveCards").hidden = true;
}
function renderCards() {
  const R = singleRun, row = el("cardsRow");
  el("cardsTitle").textContent = `${R.m.waves[R.wave].label} 돌파! 강화 카드를 1장 고르세요`;
  row.innerHTML = "";
  R.cards.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "wave-card";
    b.innerHTML = `<i>${c.icon}</i><b>${c.name}</b><span>${c.desc}</span>`;
    b.onclick = () => {
      pickCard(i);
      el("waveCards").hidden = true;
    };
    row.append(b);
  });
}

// ----- 결과 (lobby.js syncResults 에서 호출) -----
function showSingleResult() {
  if (singleRun.story) return showStoryResult();
  if (singleRun.endless) return showEndlessResult();
  const R = singleRun, win = over === "미션 성공";
  el("resTitle").textContent = win ? `${DISPLAY_NAMES[R.m.reward]} 영입 성공!` : "미션 실패";
  el("resTitle").classList.toggle("lose", !win);
  el("resRank").previousElementSibling.textContent = "웨이브";
  el("resRank").textContent = `${win ? R.m.waves.length : Math.max(0, R.wave)}/${R.m.waves.length}`;
  el("overBtn").textContent = win ? "다시 하기" : "재도전";
}
function restoreResultLabels() {
  el("resRank").previousElementSibling.textContent = "순위";
  el("overBtn").textContent = "다시 하기";
}
// 미션 성공: 먼저 영입을 저장하고(스킵·종료해도 유지) 컷신 → 결과 화면
function onMissionClear(done) {
  if (!singleRun.granted) { // 보통은 update.js 에서 클리어 즉시 저장됨
    singleRun.granted = true;
    grantRecruit(singleRun.id);
  }
  playCutscene(singleRun.id, done);
}

// ----- 영입 컷신 -----
// 대사·순서는 docs/story/HYEONGON_RECRUITMENT.md. 그림은 현재 캐릭터 전신 이미지 사용
const CUTSCENES = {
  hyeongon: {
    title: "대화역은 저쪽이지!",
    shots: [
      { t: 4, bg: "street", left: "suit", leftCls: "walk-in point", bubble: ["left", "대화역은 이쪽이지!"] },
      { t: 3, bg: "bush", left: "suit", bush: "shake", sound: "crate_hit" },
      { t: 5, bg: "bush", left: "suit", leftCls: "flustered", right: "summoner", rightCls: "pop zoom", bubble: ["right", "대화역은 저쪽이지! 너 맞을래?"], sound: "pet_summon" },
      { t: 3, bg: "gold", right: "summoner", rightCls: "center glow", recruit: "summoner", sound: "victory" },
    ],
  },
};
let csTimer = null, csDone = null, csId = null;
function playCutscene(id, done) {
  if (RECRUIT_STORIES[id]) return playStory(id, done); // 승인된 그림 컷 컷신 (js/ui/cutscene.js)
  if (!CUTSCENES[id]) return showRecruitSplash(id, done); // 컷신 없음(재한·정용): 영입 완료 화면만. 나중에 RECRUIT_STORIES 에 추가하면 컷신 재생
  const cs = CUTSCENES[id];
  csId = id;
  csDone = done;
  el("cutscene").hidden = false;
  document.body.classList.add("csOpen");
  let i = 0;
  const step = () => {
    if (i >= cs.shots.length) return endCutscene();
    showShot(cs.shots[i]);
    csTimer = setTimeout(step, cs.shots[i++].t * 1000);
  };
  step();
}
function showShot(s) {
  el("csBg").className = "cs-bg " + s.bg;
  for (const [side, key, cls] of [["Left", s.left, s.leftCls], ["Right", s.right, s.rightCls]]) {
    const im = el("cs" + side);
    if (key) {
      im.src = lobbyArt[key].full.src;
      im.hidden = false;
      im.className = "cs-actor " + side.toLowerCase() + " " + (cls || "");
    } else im.hidden = true;
  }
  el("csBush").className = "cs-bush" + (s.bg === "bush" ? " on" : "") + (s.bush ? " " + s.bush : "");
  const bb = el("csBubble");
  bb.hidden = !s.bubble;
  if (s.bubble) {
    bb.className = "cs-bubble " + s.bubble[0];
    bb.textContent = s.bubble[1];
  }
  const rc = el("csRecruit");
  rc.hidden = !s.recruit;
  if (s.recruit) {
    el("csRecruitName").textContent = DISPLAY_NAMES[s.recruit];
    el("csRecruitRole").textContent = CHARACTER_INFO[s.recruit].role || "";
  }
  if (s.sound) sfx(s.sound);
}
function endCutscene() {
  clearTimeout(csTimer);
  if (cs.story) csCloseStory();
  if (csId && !singleSave.seen[csId]) {
    singleSave.seen[csId] = true;
    writeSingleSave();
  }
  el("cutscene").hidden = true;
  document.body.classList.remove("csOpen");
  const d = csDone;
  csDone = null;
  if (d) d();
  else if (!el("singlePanel").hidden) renderSinglePanel();
}
el("csSkip").onclick = () => {
  sfx("ui_click");
  endCutscene();
};

// 영입 미션 결과 (무한 생존 기록에는 넣지 않음)
function showStoryResult() {
  const R = singleRun, win = over === "미션 성공", S = R.story;
  el("resTitle").textContent = win ? `${DISPLAY_NAMES[S.reward]} 영입 성공!` : "미션 실패";
  el("resTitle").classList.toggle("lose", !win);
  el("resRank").previousElementSibling.textContent = win ? "단계" : "실패 이유";
  el("resRank").textContent = win ? `${S.stages.length}/${S.stages.length}` : R.failReason || (p.hp <= 0 ? "쓰러짐" : "") || `${Math.max(1, R.wave)}/${S.stages.length}단계`;
  el("overBtn").textContent = win ? "다시 하기" : "재도전";
}

// 영입 완료 화면 (컷신이 없는 캐릭터). 확인 또는 4초 뒤 결과로
function showRecruitSplash(id, done) {
  const m = STORY_MISSIONS[id] || WAVE_MISSIONS[id];
  if (!m) return done && done();
  const box = el("recruitSplash");
  el("rsFace").src = lobbyArt[m.reward].full.src;
  el("rsName").textContent = `${DISPLAY_NAMES[m.reward]} 영입 완료!`;
  box.hidden = false;
  sfx("victory");
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    box.hidden = true;
    clearTimeout(t);
    if (done) done();
  };
  const t = setTimeout(close, 4000);
  el("rsOk").onclick = close;
}
