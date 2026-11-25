// 로비(캐릭터 선택), 전투 HUD, 결과 화면, 사운드 설정
// 디자인: ChatGPT 인계 시안(남색 패널·하늘색 테두리·노란 버튼) 참고, 실제 HTML/CSS/Canvas 로 구현
// 기존 선택 상자(#character, #slot0~2)와 시작 버튼(#charApply)을 그대로 이용해서 게임 시작 로직은 바뀌지 않음

let lobbySel = character, lobbyDeck = deck.slice(), lobbyReady = false;

function isLobbyOpen() {
  return document.body.classList.contains("lobbyOpen");
}
function openLobby() {
  if (singleRun) { // 싱글 미션 중 로비로 나가면 미션 종료 (강화·상태 초기화)
    endSingle();
    resetSingleHUD();
    restoreResultLabels();
    reset();
  }
  lobbySel = character;
  lobbyDeck = deck.slice();
  if (lobbyReady) buildLobby(); // 영입 상태가 바뀌었을 수 있으므로 타일 다시 그림
  document.body.classList.add("lobbyOpen");
  el("results").hidden = true;
  el("recruitResult").hidden = true;
  el("missionPrep").hidden = true;
  mvX = mvY = 0;
  releaseAttack(false);
  releaseGrenade(false);
  renderLobbyInfo();
}
function closeLobby() {
  document.body.classList.remove("lobbyOpen");
}

// ----- 캐릭터 선택: 4열×2행 페이지 (8명 넘으면 페이지 자동 추가). PC 화살표·키보드 ←→, 모바일 좌우 스와이프 -----
let rosterPage = 0;
const rosterPages = () => Math.max(1, Math.ceil(LOBBY_ORDER.length / (LOBBY_PAGE.cols * LOBBY_PAGE.rows)));
const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor"/><circle cx="12" cy="15.5" r="1.8" fill="#1b2550"/></svg>';
function buildLobby() {
  const track = el("charGrid"), per = LOBBY_PAGE.cols * LOBBY_PAGE.rows, n = rosterPages();
  track.innerHTML = "";
  track.style.setProperty("--pages", n);
  for (let pg = 0; pg < n; pg++) {
    const page = document.createElement("div");
    page.className = "roster-page";
    page.style.setProperty("--cols", LOBBY_PAGE.cols);
    page.style.setProperty("--rows", LOBBY_PAGE.rows);
    for (const k of LOBBY_ORDER.slice(pg * per, pg * per + per)) page.append(charTile(k));
    track.append(page);
  }
  if (!canPlay(lobbySel)) lobbySel = LOBBY_ORDER.find(canPlay) || "suit"; // 미영입 캐릭터는 고를 수 없음
  rosterPage = Math.min(rosterPage, n - 1);
  const got = LOBBY_ORDER.filter(isRecruited).length;
  el("rosterCount").textContent = `영입 완료 ${got}/${LOBBY_ORDER.length}`;
  lobbyReady = true;
  setRosterPage(Math.floor(LOBBY_ORDER.indexOf(lobbySel) / per), true);
  renderLobbyInfo();
}
function charTile(k) {
  const b = document.createElement("button");
  const locked = !isRecruited(k), soon = ROSTER.comingSoon.includes(k); // QA 전체 해금이면 잠금 표시는 그대로, 고를 수만 있음
  b.type = "button";
  b.className = "char-tile" + (locked ? " locked" : "") + (locked && canPlay(k) ? " qa" : "");
  b.dataset.k = k;
  b.setAttribute("aria-label", CHARACTER_INFO[k].name + (locked ? (soon ? " (출시 예정)" : " (미영입)") : ""));
  // 이미지 영역과 이름 영역을 분리: [얼굴 칸] 아래에 [이름 칸]
  const face = document.createElement("span"), fin = document.createElement("span");
  face.className = "char-face";
  fin.className = "face-in"; // 그림 비율(256×225) 상자: 자물쇠가 항상 얼굴 가운데
  const im = document.createElement("img");
  im.src = lobbyArt[k].face.src;
  im.alt = "";
  im.draggable = false;
  fin.append(im);
  face.append(fin);
  if (locked) {
    const lock = document.createElement("i");
    lock.className = "char-lock";
    lock.innerHTML = LOCK_SVG;
    fin.append(lock);
    if (soon) {
      const tag = document.createElement("em");
      tag.className = "char-soon";
      tag.textContent = "출시 예정";
      face.append(tag);
    }
  }
  const nm = document.createElement("span");
  nm.className = "char-name";
  nm.textContent = CHARACTER_INFO[k].name;
  b.append(face, nm);
  b.onclick = () => {
    if (rosterSwiped) return; // 스와이프 끝의 손 뗌은 선택이 아님
    sfx("ui_click");
    if (!canPlay(k)) { // 미영입: 선택·상세 열람 불가, 영입 조건만 보여 줌
      showRosterLock(k);
      return;
    }
    lobbySel = k;
    el("lobbyErr").textContent = "";
    renderLobbyInfo();
  };
  return b;
}
let rosterToastT = 0;
function showRosterLock(k) {
  const t = el("ciLocked");
  t.innerHTML = `<i>${LOCK_SVG}</i><b>${DISPLAY_NAMES[k]} · 미영입</b><span></span>`;
  t.querySelector("span").textContent = lockReason(k).replace(`${DISPLAY_NAMES[k]}: `, "");
  t.hidden = false;
  t.classList.remove("pop");
  void t.offsetWidth;
  t.classList.add("pop");
  for (const x of el("charGrid").querySelectorAll(".char-tile")) x.classList.toggle("peek", x.dataset.k === k);
  clearTimeout(rosterToastT);
  rosterToastT = setTimeout(() => {
    t.hidden = true;
    for (const x of el("charGrid").querySelectorAll(".char-tile.peek")) x.classList.remove("peek");
  }, 4000);
}
function setRosterPage(i, instant) {
  const n = rosterPages();
  rosterPage = clamp(i, 0, n - 1);
  const track = el("charGrid");
  track.style.transition = instant ? "none" : "";
  track.style.transform = `translateX(${-rosterPage * 100 / n}%)`;
  el("rosterView").classList.toggle("paged", n > 1);
  el("rosterPrev").disabled = rosterPage === 0;
  el("rosterNext").disabled = rosterPage === n - 1;
  const dots = el("rosterDots");
  dots.hidden = n <= 1;
  dots.innerHTML = n <= 1 ? "" : Array.from({ length: n }, (_, j) => `<i class="${j === rosterPage ? "on" : ""}"></i>`).join("") + `<small>${rosterPage + 1}/${n}</small>`;
}
el("rosterPrev").onclick = () => { sfx("ui_click"); setRosterPage(rosterPage - 1); };
el("rosterNext").onclick = () => { sfx("ui_click"); setRosterPage(rosterPage + 1); };
addEventListener("keydown", (e) => {
  if (!isLobbyOpen() || rosterPages() <= 1 || !el("singlePanel").hidden || !el("charDetail").hidden) return;
  if (e.key === "ArrowLeft") setRosterPage(rosterPage - 1);
  else if (e.key === "ArrowRight") setRosterPage(rosterPage + 1);
});
// 스와이프: 가로로 12px 넘게 끌면 스와이프로 판정 (그 손가락의 탭은 캐릭터 선택으로 치지 않음), 50px 넘으면 페이지 넘김
let rosterSwipe = null, rosterSwiped = false;
el("rosterView").addEventListener("pointerdown", (e) => {
  rosterSwiped = false;
  if (rosterPages() <= 1) return;
  rosterSwipe = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
});
el("rosterView").addEventListener("pointermove", (e) => {
  const S = rosterSwipe;
  if (!S || S.id !== e.pointerId) return;
  S.dx = e.clientX - S.x;
  if (!S.on && Math.abs(S.dx) > 12 && Math.abs(S.dx) > Math.abs(e.clientY - S.y)) {
    S.on = true;
    rosterSwiped = true;
    el("rosterView").setPointerCapture?.(e.pointerId);
  }
  if (S.on) {
    const n = rosterPages(), w = el("rosterView").clientWidth || 1, track = el("charGrid");
    track.style.transition = "none";
    track.style.transform = `translateX(${(-rosterPage * w + clamp(S.dx, -w, w)) / (w * n) * 100}%)`;
  }
});
const endRosterSwipe = (e) => {
  const S = rosterSwipe;
  if (!S || S.id !== e.pointerId) return;
  rosterSwipe = null;
  if (S.on) setRosterPage(rosterPage + (S.dx < -50 ? 1 : S.dx > 50 ? -1 : 0));
  setTimeout(() => (rosterSwiped = false), 0); // 바로 뒤따르는 click 만 무시
};
el("rosterView").addEventListener("pointerup", endRosterSwipe);
el("rosterView").addEventListener("pointercancel", endRosterSwipe);

// 오른쪽 정보: 소개·능력치·기본 공격·패시브·Q/E·궁극기 (영역 안에서 스크롤)
function basicText(k) {
  const B = SKILL_DATA[k]?.basic, w = weapons[0];
  return B ? `${B.name} · 피해 ${B.dmg} · 사거리 ${B.range} · ${B.kind === "lob" ? "곡사(벽 넘어감)" : "원거리"}` : `근접 공격 · 피해 ${w[1]} · 사거리 ${w[3]}`;
}
function renderLobbyInfo() {
  if (!lobbyReady) return;
  const info = CHARACTER_INFO[lobbySel], st = CHARACTER_STATS[lobbySel] || {};
  for (const t of el("charGrid").querySelectorAll(".char-tile")) t.classList.toggle("sel", t.dataset.k === lobbySel);
  el("ciName").textContent = info.name;
  el("ciRole").textContent = info.role;
  el("ciRole").hidden = !info.role;
  el("ciIntro").textContent = info.intro || "";
  el("ciIntro").hidden = !info.intro;
  el("ciStats").innerHTML = `<span><b>체력</b>${st.hp ?? 3000}</span><span><b>이동</b>${Math.round((st.speed ?? 1) * 100)}%</span><span><b>시야</b>${st.sight ?? "-"}</span>`;
  el("ciBasic").innerHTML = "<b>기본 공격</b> ";
  el("ciBasic").append(basicText(lobbySel));
  el("ciPassive").innerHTML = "<b>패시브</b> ";
  el("ciPassive").append(info.passive);
  fillSkills(el("ciSkills"), info);
  const stt = el("ciStatus");
  stt.hidden = isRecruited(lobbySel);
  stt.textContent = "QA 해금";
  el("lobbyStart").disabled = !canPlay(lobbySel);
  // 모드별 큰 버튼: 싱글 = 미션 선택 / 웨이브 = 웨이브 시작 (+ 최고 기록)
  const wave = lobbyMode === "wave";
  el("lobbyPlayText").textContent = wave ? "웨이브 시작" : "미션 선택";
  el("lobbyPlayIcon").innerHTML = wave
    ? '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" d="M12 12c-2.4-3.2-4.6-4.2-6.4-4.2a4.2 4.2 0 0 0 0 8.4c1.8 0 4-1 6.4-4.2s4.6-4.2 6.4-4.2a4.2 4.2 0 0 1 0 8.4c-1.8 0-4-1-6.4-4.2z"/></svg>'
    : '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 2.5h9.5L20 7v12.5A2 2 0 0 1 18 21.5H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zm8.5 1.5v4h4zM7.5 10h9v2h-9zm0 4h9v2h-9zm0 4h6v2h-6z"/></svg>';
  el("lobbyPlay").classList.toggle("off", !canPlay(lobbySel));
  el("lobbyErr").textContent = canPlay(lobbySel) ? "" : lockReason(lobbySel);
  el("lobbyModeTag").textContent = wave ? "웨이브 모드 · 영입한 캐릭터만 출전" : "싱글 모드 · 스토리 · 영입 미션";
  const rec = wave && typeof endlessSave !== "undefined" ? endlessSave.best[lobbySel] : null;
  el("lobbyRecord").textContent = rec ? `최고 기록 W${rec.wave} · ${fmtTime(rec.time)} · 처치 ${rec.kills}` : "";
  renderDeckPicker();
}

// 소환사: 포켓몬 8마리 중 3마리를 눌러서 고름 (고른 순서 = 1·2·3번 슬롯)
function renderDeckPicker() {
  const dk = el("lobbyDeck");
  dk.innerHTML = "";
  dk.hidden = lobbySel !== "summoner";
  if (lobbySel !== "summoner") return;
  const head = document.createElement("div");
  head.className = "deck-head";
  head.textContent = `포켓몬 3마리 선택 (${lobbyDeck.length}/3)`;
  dk.append(head);
  const grid = document.createElement("div");
  grid.className = "mon-grid";
  mons.slice(0, BASE_PET_COUNT).forEach((m, j) => { // 기본 8종만 (진화·전설은 무한 생존 전용)
    const b = document.createElement("button");
    const slot = lobbyDeck.indexOf(j);
    b.className = "mon-tile" + (slot >= 0 ? " sel" : "");
    b.style.setProperty("--mon", PET_LOOK[j].color);
    b.setAttribute("aria-pressed", String(slot >= 0));
    b.setAttribute("aria-label", m[0]);
    const icon = document.createElement("span");
    icon.className = "mon-icon";
    if (PET_LOOK[j].img) {
      const im = document.createElement("img");
      im.src = PET_LOOK[j].img;
      im.alt = "";
      icon.append(im);
    } else icon.textContent = m[1];
    const name = document.createElement("span");
    name.className = "mon-name";
    name.textContent = m[0];
    b.append(icon, name);
    if (slot >= 0) {
      const badge = document.createElement("b");
      badge.className = "mon-slot";
      badge.textContent = String(slot + 1);
      b.append(badge);
    }
    SkillTip.attach(b, () => petTipModelById(j)); // 길게 누르기(PC는 마우스 올리기)로 효과 설명
    b.onclick = () => {
      if (SkillTip.used(b)) return; // 설명만 본 경우 선택을 바꾸지 않음
      SkillTip.hide();
      const at = lobbyDeck.indexOf(j);
      if (at >= 0) lobbyDeck.splice(at, 1); // 다시 누르면 빼기
      else {
        if (lobbyDeck.length >= 3) lobbyDeck.shift(); // 3마리가 차 있으면 가장 먼저 고른 것과 교체
        lobbyDeck.push(j);
      }
      el("lobbyErr").textContent = "";
      sfx("ui_click");
      renderDeckPicker();
    };
    grid.append(b);
  });
  dk.append(grid);
}

el("lobbyStart").onclick = () => {
  if (!canPlay(lobbySel)) {
    el("lobbyErr").textContent = "아직 영입하지 않은 캐릭터예요.";
    return;
  }
  if (lobbySel === "summoner" && (lobbyDeck.length !== 3 || new Set(lobbyDeck).size !== 3)) {
    el("lobbyErr").textContent = "서로 다른 포켓몬 3마리를 골라 주세요.";
    return;
  }
  sfx("ui_click");
  endSingle(); // 배틀로얄 시작: 싱글 상태와 분리
  // 기존 선택 상자에 반영한 뒤 기존 시작 버튼 로직 실행
  document.querySelector("#character").value = lobbySel;
  deck = lobbyDeck.slice();
  deck.forEach((v, i) => {
    const s = document.querySelector("#slot" + i);
    if (s) s.value = v;
  });
  document.querySelector("#charApply").click();
};
// 캐릭터 상세: 전신 그림 + 스킬 설명
function fillSkills(ul, info) {
  ul.innerHTML = "";
  [...info.skills, ...(info.ult ? [info.ult] : [])].forEach(([n, d], i) => {
    const li = document.createElement("li");
    const kb = document.createElement("b");
    kb.textContent = ["Q", "E", "궁극기"][i] + " " + n;
    const sp = document.createElement("span");
    sp.textContent = d;
    li.append(kb, sp);
    ul.append(li);
  });
}
el("lobbyDetail").onclick = () => {
  const info = CHARACTER_INFO[lobbySel];
  el("detailArt").src = lobbyArt[lobbySel].full.src;
  el("detailName").textContent = info.name;
  el("detailRole").textContent = info.role;
  el("detailRole").hidden = !info.role;
  fillSkills(el("detailSkills"), info);
  el("detailPassive").textContent = "패시브 · " + info.passive;
  el("charDetail").hidden = false;
  sfx("ui_click");
};
el("detailClose").onclick = () => {
  el("charDetail").hidden = true;
  sfx("ui_click");
};
// 설정(소리): 오른쪽 위 톱니
el("lobbySet").onclick = () => {
  sfx("ui_click");
  el("lobbyFoot").hidden = !el("lobbyFoot").hidden;
};
el("lobbySetClose").onclick = () => {
  sfx("ui_click");
  el("lobbyFoot").hidden = true;
};
el("resLobby").onclick = () => {
  sfx("ui_click");
  openLobby();
};
el("overBtn").onclick = () => {
  sfx("ui_click");
  reset();
};
document.querySelector("#menuBtn").onpointerdown = (e) => {
  e.preventDefault();
  openLobby();
};

// 사운드 설정 (로비 안)
function bindAudioUI() {
  const bgm = el("volBgm"), sf = el("volSfx"), vo = el("volVoice"), mute = el("muteBtn");
  const sync = () => {
    bgm.value = Math.round(audio.settings.bgm * 100);
    sf.value = Math.round(audio.settings.sfx * 100);
    vo.value = Math.round((audio.settings.voice ?? 0.9) * 100);
    mute.textContent = audio.settings.muted ? "소리 켜기" : "음소거";
    mute.classList.toggle("on", audio.settings.muted);
  };
  bgm.oninput = () => setAudio("bgm", bgm.value / 100);
  sf.oninput = () => setAudio("sfx", sf.value / 100);
  sf.onchange = () => sfx("ui_click");
  vo.oninput = () => setAudio("voice", vo.value / 100);
  mute.onclick = () => {
    setAudio("muted", !audio.settings.muted);
    sync();
  };
  sync();
}
bindAudioUI();

// ===== 전투 HUD =====
const fmtTime = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
let hudWeapon = -1;
function updateHUD() {
  setText("timeHud", fmtTime(elapsed));
  updateSkillBar();
  const sm = el("aliveHud").querySelector("small");
  if (sm.hidden !== !!singleRun) sm.hidden = !!singleRun;
  if (singleRun?.m) updateSingleHUD();
  else {
    const alive = bots.filter((a) => a.hp > 0).length + (p.hp > 0 ? 1 : 0);
    setText("aliveNum", String(alive));
    setText("zoneHud", elapsed < 25 ? "자기장 " + Math.ceil(25 - elapsed) + "초 후" : "자기장 축소 중");
  }
  const zoneHud = el("zoneHud"), outside = Math.hypot(p.x - W / 2, p.y - H / 2) > zone;
  if (zoneHud._out !== outside) {
    zoneHud._out = outside;
    zoneHud.classList.toggle("danger", outside);
  }
  if (hudWeapon !== p.w) {
    hudWeapon = p.w;
    const art = WEAPON_ART[p.w], box = el("weaponIcon");
    box.style.backgroundImage = art ? `url("${weaponIcons[p.w].src}")` : "";
    box.classList.toggle("fist", !art);
  }
  setText("weaponName", basicOf(p)?.name || weapons[p.w][0]); // 상훈·은숙 맨손 = 고유 원거리 기본 공격
  setText("ammoPips", "●".repeat(p.ammo) + "○".repeat(Math.max(0, AMMO.max - p.ammo)));
  setText("grenHud", "수류탄 " + (p.grenades || 0) + "/" + GRENADE.max);
  // 액세서리 UI: 기능이 꺼져 있으면 숨김
  const gh = el("gearHud");
  if (gh._on !== FEATURES.accessories) {
    gh._on = FEATURES.accessories;
    gh.hidden = !FEATURES.accessories;
  }
  if (FEATURES.accessories) setText("gearHud", p.gear.map((i) => gear[i]).join(" · "));
}

// ===== 결과 화면 =====
let resShown = "";
function syncResults() {
  if (resShown === over) return;
  resShown = over;
  const r = el("results");
  if (!over) {
    r.hidden = true;
    return;
  }
  // 쓰러지는 순간을 잠깐 보여 준 뒤 결과 표시
  const show = () => {
    if (!over) return;
    el("resTitle").textContent = over === "패배" ? "패배" : "승리!";
    el("resTitle").classList.toggle("lose", over === "패배");
    el("resRank").textContent = stats.rank + "위";
    el("resKills").textContent = String(stats.kills);
    el("resDmg").textContent = Math.round(stats.damage).toLocaleString("ko-KR");
    el("resTime").textContent = fmtTime(stats.time);
    el("resChar").src = lobbyArt[character].face.src;
    el("resName").textContent = DISPLAY_NAMES[character];
    if (singleRun?.m && over === "미션 성공") return showRecruitResult(); // 영입 성공: 다음 스토리 안내 화면 (js/ui/single.js)
    if (singleRun?.m) showSingleResult();
    else restoreResultLabels();
    r.hidden = false;
  };
  // 싱글 미션 성공: 영입 저장 → 컷신 → 결과
  if (singleRun?.m && over === "미션 성공") setTimeout(() => over === "미션 성공" && onMissionClear(show), 900);
  else setTimeout(show, 700);
}

// 메인 루프에서 매 프레임 호출
function uiFrame() {
  if (!lobbyReady && assetsReady()) buildLobby();
  if (!isLobbyOpen()) updateHUD();
  syncResults();
}
