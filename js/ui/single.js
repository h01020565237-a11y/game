// ===== 싱글모드 화면: 미션 선택, 웨이브 HUD, 강화 카드, 결과, 영입 컷신, 스토리 극장 =====

// 미션 목록 (현곤만 웨이브 생존전으로 구현. 나머지는 선행 조건만 표시)
const SINGLE_MISSIONS = [
  { id: "hyeongon", reward: "summoner", need: [], wave: true },
  { id: "eunsuk", reward: "support", need: ["summoner"] },
  { id: "giseop", reward: "runner", need: ["summoner", "suit"] },
  { id: "sanghun", reward: "octo", need: ["runner"] },
  { id: "gyeongsu", reward: "stripe", need: ["octo"] },
];

function openSinglePanel() {
  renderSinglePanel();
  el("singlePanel").hidden = false;
  sfx("ui_click");
}
function renderSinglePanel() {
  const list = el("missionList");
  list.innerHTML = "";
  for (const ms of SINGLE_MISSIONS) {
    const got = singleSave.recruited.includes(ms.reward), ok = ms.need.every((k) => singleSave.recruited.includes(k));
    const card = document.createElement("div");
    card.className = "mission" + (got ? " done" : "") + (!ok || !ms.wave ? " locked" : "");
    const im = document.createElement("img");
    im.src = lobbyArt[ms.reward].face.src;
    im.alt = "";
    const info = document.createElement("div");
    const m = WAVE_MISSIONS[ms.id];
    info.innerHTML = `<b>${DISPLAY_NAMES[ms.reward]} 영입</b><span>${m ? m.sub + " · " + DISPLAY_NAMES[m.player] + "(으)로 플레이" : "준비 중"}</span>` +
      `<small>${got ? "영입 완료" : ok ? (ms.wave ? "도전 가능" : "미션 준비 중") : "조건: " + ms.need.map((k) => DISPLAY_NAMES[k]).join(" + ") + " 영입"}</small>`;
    card.append(im, info);
    if (ok && ms.wave) {
      const b = document.createElement("button");
      b.className = "btn btn-gold";
      b.textContent = got ? "다시 도전" : "시작";
      b.onclick = () => startMission(ms.id);
      card.append(b);
    }
    list.append(card);
  }
  // 스토리 극장: 본 적 있는(영입 완료한) 컷신 다시 보기. 진행도는 바뀌지 않음
  const th = el("theaterList");
  th.innerHTML = "";
  const seen = SINGLE_MISSIONS.filter((ms) => CUTSCENES[ms.id] && singleSave.cleared[ms.id]);
  if (!seen.length) th.textContent = "영입을 완료하면 컷신을 다시 볼 수 있어요.";
  for (const ms of seen) {
    const b = document.createElement("button");
    b.className = "btn btn-ghost";
    b.textContent = "▶ " + CUTSCENES[ms.id].title;
    b.onclick = () => playCutscene(ms.id, null);
    th.append(b);
  }
}
function startMission(id) {
  const m = WAVE_MISSIONS[id];
  el("singlePanel").hidden = true;
  beginSingle(id);
  sfx("ui_click");
  // 기존 시작 경로 그대로 사용 (캐릭터만 미션 지정 캐릭터로)
  document.querySelector("#character").value = m.player;
  document.querySelector("#charApply").click();
}
el("lobbySingle").onclick = openSinglePanel;
el("singleClose").onclick = () => {
  el("singlePanel").hidden = true;
  sfx("ui_click");
};

// ----- 웨이브 HUD (전투 화면 위쪽) -----
function updateSingleHUD() {
  const R = singleRun;
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
  grantRecruit(singleRun.id);
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
