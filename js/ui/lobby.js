// 로비(캐릭터 선택), 전투 HUD, 결과 화면, 사운드 설정
// 디자인: ChatGPT 인계 시안(남색 패널·하늘색 테두리·노란 버튼) 참고, 실제 HTML/CSS/Canvas 로 구현
// 기존 선택 상자(#character, #slot0~2)와 시작 버튼(#charApply)을 그대로 이용해서 게임 시작 로직은 바뀌지 않음

let lobbySel = character, lobbyDeck = deck.slice(), lobbyReady = false;

function isLobbyOpen() {
  return document.body.classList.contains("lobbyOpen");
}
function openLobby() {
  lobbySel = character;
  lobbyDeck = deck.slice();
  document.body.classList.add("lobbyOpen");
  el("results").hidden = true;
  mvX = mvY = 0;
  releaseAttack(false);
  releaseGrenade(false);
  renderLobbyInfo();
}
function closeLobby() {
  document.body.classList.remove("lobbyOpen");
}

// 캐릭터 얼굴 아이콘: 이동 시트의 정면(S) 첫 프레임에서 위쪽을 잘라 씀
function drawPortrait(cv, k, zoom = 1) {
  const x = cv.getContext("2d");
  x.clearRect(0, 0, cv.width, cv.height);
  const im = sheets[k];
  if (im && im.naturalWidth) x.drawImage(im, 18, 4 * 96 + 6, 60, 60 / zoom, 0, 0, cv.width, cv.height / zoom);
  else if (k === "bear" && bearImg.naturalWidth) x.drawImage(bearImg, 4 * 80 + 12, 2, 56, 56 / zoom, 0, 0, cv.width, cv.height / zoom);
}

function buildLobby() {
  const grid = el("charGrid");
  grid.innerHTML = "";
  for (const k of CHARACTER_ORDER) {
    const b = document.createElement("button");
    b.className = "char-tile";
    b.dataset.k = k;
    b.setAttribute("aria-label", CHARACTER_INFO[k].name);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 72;
    drawPortrait(cv, k);
    b.append(cv);
    const n = document.createElement("span");
    n.textContent = CHARACTER_INFO[k].name;
    b.append(n);
    b.onclick = () => {
      lobbySel = k;
      el("lobbyErr").textContent = "";
      renderLobbyInfo();
      sfx("ui_click");
    };
    grid.append(b);
  }
  lobbyReady = true;
  renderLobbyInfo();
}

function renderLobbyInfo() {
  if (!lobbyReady) return;
  const info = CHARACTER_INFO[lobbySel];
  for (const t of el("charGrid").children) t.classList.toggle("sel", t.dataset.k === lobbySel);
  el("ciName").textContent = info.name;
  el("ciRole").textContent = info.role;
  el("ciRole").hidden = !info.role;
  const ul = el("ciSkills");
  ul.innerHTML = "";
  info.skills.forEach(([n, d], i) => {
    const li = document.createElement("li");
    const kb = document.createElement("b");
    kb.textContent = (i ? "E" : "Q") + " " + n;
    const sp = document.createElement("span");
    sp.textContent = d;
    li.append(kb, sp);
    ul.append(li);
  });
  el("ciPassive").textContent = "패시브 · " + info.passive;
  // 소환사: 포켓몬 덱 3마리 선택
  const dk = el("lobbyDeck");
  dk.innerHTML = "";
  dk.hidden = lobbySel !== "summoner";
  if (lobbySel === "summoner") {
    const lab = document.createElement("span");
    lab.textContent = "덱";
    dk.append(lab);
    lobbyDeck.forEach((v, i) => {
      const s = document.createElement("select");
      s.setAttribute("aria-label", `덱 ${i + 1}번`);
      mons.forEach((m, j) => s.add(new Option(m[1] + " " + m[0], j, false, j === v)));
      s.onchange = () => {
        lobbyDeck[i] = +s.value;
        el("lobbyErr").textContent = "";
      };
      dk.append(s);
    });
  }
}

// 로비 가운데 캐릭터 미리보기 (정면으로 달리는 모습)
function drawLobbyPreview() {
  const cv = el("charPreview"), x = cv.getContext("2d"), k = lobbySel;
  x.clearRect(0, 0, cv.width, cv.height);
  const t = performance.now() / 1000, f = Math.floor(t * 10) % 8, s = cv.width;
  const im = sheets[k];
  if (im && im.naturalWidth) x.drawImage(im, f * 96, 4 * 96, 96, 96, 0, 0, s, s);
  else if (k === "bear" && bearImg.naturalWidth) x.drawImage(bearImg, 4 * 80, 0, 80, 80, s * 0.05, s * 0.04 + Math.abs(Math.sin(t * 6)) * -6, s * 0.9, s * 0.9);
}

el("lobbyStart").onclick = () => {
  if (lobbySel === "summoner" && new Set(lobbyDeck).size !== 3) {
    el("lobbyErr").textContent = "서로 다른 포켓몬 3마리를 골라 주세요.";
    return;
  }
  sfx("ui_click");
  // 기존 선택 상자에 반영한 뒤 기존 시작 버튼 로직 실행
  document.querySelector("#character").value = lobbySel;
  deck = lobbyDeck.slice();
  deck.forEach((v, i) => {
    const s = document.querySelector("#slot" + i);
    if (s) s.value = v;
  });
  document.querySelector("#charApply").click();
};
el("lobbyTouch").onclick = () => document.querySelector("#mobileToggle").click();
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
  const bgm = el("volBgm"), sf = el("volSfx"), mute = el("muteBtn");
  const sync = () => {
    bgm.value = Math.round(audio.settings.bgm * 100);
    sf.value = Math.round(audio.settings.sfx * 100);
    mute.textContent = audio.settings.muted ? "소리 켜기" : "음소거";
    mute.classList.toggle("on", audio.settings.muted);
  };
  bgm.oninput = () => setAudio("bgm", bgm.value / 100);
  sf.oninput = () => setAudio("sfx", sf.value / 100);
  sf.onchange = () => sfx("ui_click");
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
  const alive = bots.filter((a) => a.hp > 0).length + (p.hp > 0 ? 1 : 0);
  setText("aliveNum", String(alive));
  setText("timeHud", fmtTime(elapsed));
  setText("zoneHud", elapsed < 25 ? "자기장 " + Math.ceil(25 - elapsed) + "초 후" : "자기장 축소 중");
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
  setText("weaponName", weapons[p.w][0]);
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
  setTimeout(() => {
    if (!over) return;
    el("resTitle").textContent = over === "패배" ? "패배" : "승리!";
    el("resTitle").classList.toggle("lose", over === "패배");
    el("resRank").textContent = stats.rank + "위";
    el("resKills").textContent = String(stats.kills);
    el("resDmg").textContent = Math.round(stats.damage).toLocaleString("ko-KR");
    el("resTime").textContent = fmtTime(stats.time);
    drawPortrait(el("resChar"), character, 0.75);
    r.hidden = false;
  }, 700);
}

// 메인 루프에서 매 프레임 호출
function uiFrame() {
  if (!lobbyReady && assetsReady()) buildLobby();
  if (isLobbyOpen()) drawLobbyPreview();
  else updateHUD();
  syncResults();
}
