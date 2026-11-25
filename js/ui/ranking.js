// ===== 닉네임 팝업 · 웨이브 랭킹 화면 (js/net/ranking.js) =====
// 진입: 타이틀 GAME START → 닉네임 있으면 바로 모드 선택, 없으면 닉네임 팝업(취소 = 타이틀)
// 랭킹: 웨이브 모드 캐릭터 선택 화면 오른쪽 위 🏆 (인게임 메뉴에는 없음)
// 판 종료(웨이브 모드, QA·싱글 제외): 기록 자동 등록 → 결과 화면에 상태 + 실패 시 다시 보내기 + 랭킹 보기(내 순위 이동 애니메이션)

// ----- 닉네임 팝업 -----
let nickMode = "register", nickBusy = false, nickDone = null;
function openNick(mode, done) {
  nickMode = mode;
  nickDone = done || null;
  el("nickTitle").textContent = mode === "rename" ? "닉네임 변경" : "닉네임 등록";
  el("nickSub").textContent = mode === "rename" ? "바꿔도 랭킹 기록은 그대로예요" : "랭킹에 표시될 이름 (2~12자)";
  el("nickOk").textContent = mode === "rename" ? "변경" : "등록";
  el("nickInput").value = mode === "rename" ? profile?.nickname || "" : "";
  el("nickErr").textContent = "";
  el("nickOffline").hidden = true;
  nickCount();
  el("nickPopup").hidden = false;
  document.body.classList.add("nickOpen");
  setTimeout(() => el("nickInput").focus({ preventScroll: true }), 50);
}
function closeNick() {
  el("nickInput").blur(); // 키보드 닫기
  el("nickPopup").hidden = true;
  el("nickPopup").classList.remove("kb");
  document.body.classList.remove("nickOpen");
}
function nickCount() {
  const n = [...el("nickInput").value.trim()].length;
  el("nickCount").textContent = `${n}/${RANKING.nick.max}`;
  el("nickCount").classList.toggle("over", n > RANKING.nick.max);
}
el("nickInput").addEventListener("input", nickCount); // 한글 조합 중에도 표시만 갱신 (막지 않음)
el("nickInput").addEventListener("compositionend", nickCount);
el("nickInput").addEventListener("keydown", (e) => {
  e.stopPropagation(); // 게임 키(WASD·Esc…) 로 안 넘어가게
  if (e.key === "Escape") {
    e.preventDefault();
    el("nickCancel").click();
  }
});
el("nickInput").addEventListener("keyup", (e) => e.stopPropagation());
// 모바일 키보드: 입력창·버튼이 가리지 않게 팝업을 키보드 반대쪽으로 (세로 폰 회전 화면 포함)
el("nickInput").addEventListener("focus", () => el("nickPopup").classList.add("kb"));
el("nickInput").addEventListener("blur", () => setTimeout(() => document.activeElement !== el("nickInput") && el("nickPopup").classList.remove("kb"), 120));
window.visualViewport?.addEventListener("resize", () => {
  const vv = window.visualViewport, open = vv.height < window.innerHeight * 0.8;
  el("nickPopup").style.setProperty("--kbh", open ? `${Math.round(window.innerHeight - vv.height)}px` : "0px");
});
el("nickForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (nickBusy) return; // 요청 중 중복 누름 방지
  const name = el("nickInput").value.trim(), bad = nickError(name);
  if (bad) {
    el("nickErr").textContent = bad;
    return;
  }
  if (nickMode === "rename" && name === profile?.nickname) return closeNick();
  nickBusy = true;
  el("nickOk").disabled = true;
  el("nickOk").textContent = nickMode === "rename" ? "변경 중…" : "등록 중…";
  el("nickErr").textContent = "";
  try {
    if (nickMode === "rename") await renameNickname(name);
    else await registerNickname(name);
    closeNick();
    syncNickUI();
    nickDone?.();
  } catch (err) {
    el("nickErr").textContent = err.message;
    // 서버에 닿지 않으면 게임은 막지 않음: 기기에만 저장하고 시작 (나중에 등록)
    const offline = /연결|늦어요|읽을 수/.test(err.message);
    el("nickOffline").hidden = !offline;
  } finally {
    nickBusy = false;
    el("nickOk").disabled = false;
    el("nickOk").textContent = nickMode === "rename" ? "변경" : "등록";
  }
});
el("nickOffline").onclick = () => {
  const name = el("nickInput").value.trim();
  if (nickError(name)) return;
  if (nickMode === "rename") {
    profile.nickname = name;
    profile.renamePending = true;
    saveProfile();
  } else keepNicknameOffline(name);
  closeNick();
  syncNickUI();
  nickDone?.();
};
el("nickCancel").onclick = () => {
  sfx("ui_click");
  closeNick(); // 타이틀(또는 설정)로 그대로
};
// 타이틀 GAME START: 닉네임 확인
function titleStartGate() {
  if (profile?.nickname) return closeTitle();
  sfx("ui_click");
  openNick("register", () => closeTitle());
}
// 설정(모드 선택 화면 톱니): 닉네임 표시·변경
function syncNickUI() {
  const n = profile?.nickname || "-";
  if (el("mNick")) el("mNick").textContent = n + (profile && !profile.registered ? " (미등록)" : "");
  el("rankMe").textContent = profile?.nickname ? `내 닉네임: ${profile.nickname}` : "닉네임 없음";
}
el("mNickEdit").onclick = () => {
  sfx("ui_click");
  openNick(profile?.nickname ? "rename" : "register");
};
syncNickUI();

// ----- 랭킹 화면 -----
const RANK_TAB_NAMES = { all: "전체" };
let rankTab = "all", rankAnim = null;
function buildRankTabs() {
  const box = el("rankTabs");
  box.innerHTML = "";
  for (const ch of RANKING.characters) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rank-tab" + (ch === rankTab ? " on" : "");
    b.textContent = RANK_TAB_NAMES[ch] || DISPLAY_NAMES[ch];
    b.setAttribute("role", "tab");
    b.onclick = () => {
      sfx("ui_click");
      rankTab = ch;
      buildRankTabs();
      loadRanking(false);
    };
    box.append(b);
  }
}
function fmtRankTime(s) {
  s = Math.round(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function rankRowHTML(r, i) {
  const medal = ["🥇", "🥈", "🥉"][i] || "";
  return `<span class="rk">${medal || i + 1}</span><span class="nm"></span><span>${DISPLAY_NAMES[r.character] || r.character || "-"}</span><span>W${r.wave}</span><span>${fmtRankTime(r.time)}</span><span>${r.level || "-"}</span><span>${r.kills}</span>`;
}
const isMyRow = (r) => profile && (r.playerId ? r.playerId === profile.playerId : r.nickname === profile.nickname);
function renderRanking(rows) {
  const list = el("rankList");
  list.innerHTML = "";
  let myIdx = -1;
  rows.forEach((r, i) => {
    const d = document.createElement("div");
    d.className = "rank-row" + (i < 3 ? " top" + (i + 1) : "") + (isMyRow(r) ? " mine" : "");
    d.innerHTML = rankRowHTML(r, i);
    d.querySelector(".nm").textContent = r.nickname; // 닉네임은 글자로만 (HTML 주입 방지)
    d.dataset.id = r.playerId || r.nickname;
    if (isMyRow(r)) myIdx = i;
    list.append(d);
  });
  // 내 순위 아래 고정 (목록에서 보이는 동안은 숨겨 중복 표시 방지)
  const pin = el("rankPin");
  if (myIdx >= 0) {
    pin.innerHTML = rankRowHTML(rows[myIdx], myIdx);
    pin.querySelector(".nm").textContent = rows[myIdx].nickname;
  } else if (profile?.nickname) {
    const loc = endlessBestFor(rankTab);
    pin.innerHTML = `<span class="rk">-</span><span class="nm"></span><span>${loc ? DISPLAY_NAMES[loc.character] : "-"}</span><span>${loc ? "W" + loc.wave : "-"}</span><span>${loc ? fmtRankTime(loc.time) : "-"}</span><span>${loc?.level || "-"}</span><span>${loc ? loc.kills : "-"}</span>`;
    pin.querySelector(".nm").textContent = profile.nickname + " (순위 밖)";
  }
  pin.hidden = !profile?.nickname;
  pin.dataset.idx = myIdx;
  updatePinVisibility();
  el("rankMsg").textContent = rows.length ? "" : "아직 등록된 기록이 없어요";
  return myIdx;
}
function updatePinVisibility() {
  const pin = el("rankPin"), list = el("rankList"), mine = list.querySelector(".mine");
  if (!mine || !profile?.nickname) return pin.classList.remove("dim");
  const a = mine.getBoundingClientRect(), b = list.getBoundingClientRect();
  pin.classList.toggle("dim", a.top >= b.top - 2 && a.bottom <= b.bottom + 2); // 목록에서 보이면 고정 줄은 감춤
}
el("rankList").addEventListener("scroll", updatePinVisibility, { passive: true });
function endlessBestFor(tab) { // 기기에 저장된 내 최고 기록 (순위 밖일 때 표시용)
  const list = Object.entries(endlessSave.best).map(([character, b]) => ({ character, ...b }));
  const pick = tab === "all" ? list.sort(rankSort)[0] : list.find((x) => x.character === tab);
  return pick || null;
}
async function loadRanking(force) {
  el("rankMsg").textContent = "불러오는 중…";
  try {
    if (rankQueue().length) await flushRankQueue(); // 못 보낸 기록 먼저
    const rows = await fetchRanking(rankTab, force);
    return { rows, idx: renderRanking(rows) };
  } catch (e) {
    el("rankList").innerHTML = "";
    el("rankMsg").innerHTML = "";
    el("rankMsg").append(`랭킹을 불러오지 못했어요 (${e.message}) `);
    const b = document.createElement("button");
    b.className = "btn btn-ghost";
    b.textContent = "다시 시도";
    b.onclick = () => loadRanking(true);
    el("rankMsg").append(b);
    return null;
  }
}
let rankPausedGame = false;
function openRanking(tab) {
  rankTab = tab || rankTab;
  buildRankTabs();
  syncNickUI();
  el("rankPanel").hidden = false;
  // 팝업 동안만 일시정지 (전투 중에 열렸다면). 닫으면 재개
  rankPausedGame = !isLobbyOpen() && !over && !document.body.classList.contains("paused");
  if (rankPausedGame) document.body.classList.add("paused");
  return loadRanking(false);
}
function closeRanking() {
  el("rankPanel").hidden = true;
  if (rankPausedGame) {
    document.body.classList.remove("paused");
    last = performance.now();
    acc = 0;
  }
  rankPausedGame = false;
}
el("rankClose").onclick = () => {
  sfx("ui_click");
  closeRanking();
};
el("lobbyRank").onclick = () => {
  sfx("ui_click");
  openRanking("all");
};
// 웨이브 모드 캐릭터 선택에서만 🏆 표시
const _renderLobbyInfo = renderLobbyInfo;
renderLobbyInfo = function () {
  _renderLobbyInfo();
  el("lobbyRank").hidden = lobbyMode !== "wave";
};

// ----- 판 종료: 기록 등록 + 결과 화면 표시 -----
let lastRunRank = null; // { before: [...], rec }
function onWaveRunEnd(r) {
  const R = singleRun, box = el("resOnline");
  box.hidden = true;
  el("resResend").hidden = el("resRankBtn").hidden = true;
  if (!R?.endless || R.story) return; // 싱글 미션 기록은 웨이브 랭킹 제외
  box.hidden = false;
  if (ROSTER.testMode) { // QA 테스트 판은 온라인 등록 제외
    el("resOnlineText").textContent = "QA 전체 해금 판 — 온라인 랭킹에는 등록되지 않아요";
    return;
  }
  if (!profile?.nickname) {
    el("resOnlineText").textContent = "닉네임이 없어 온라인 랭킹에 등록되지 않았어요";
    return;
  }
  if (r.newBest) { // 개인 최고 기록 갱신: 금빛 효과음
    sfx("pickup");
    el("resTitle").classList.add("gold-burst");
  }
  const rec = { character, wave: r.wave, time: Math.round(r.time), level: r.level, kills: r.kills };
  const prevAll = rankCache.all?.rows || null;
  lastRunRank = { before: prevAll, rec, newBest: r.newBest };
  if (!r.newBest && endlessSave.best[character]) { // 이 캐릭터 최고 기록보다 낮으면 보내지 않음 (덮어쓰기 방지)
    el("resOnlineText").textContent = "개인 최고 기록이 아니라 랭킹은 그대로예요";
    el("resRankBtn").hidden = false;
    return;
  }
  queueWaveRecord(rec);
  sendRunRecord();
}
async function sendRunRecord() {
  el("resOnlineText").textContent = "랭킹에 기록 등록 중…";
  el("resResend").hidden = true;
  const before = lastRunRank?.before || (await fetchRanking("all").catch(() => null));
  if (lastRunRank) lastRunRank.before = before;
  const res = await flushRankQueue();
  if (res.left === 0 && !res.err) {
    el("resOnlineText").textContent = lastRunRank?.newBest ? "🏆 개인 최고 기록 갱신! 랭킹에 등록했어요" : "랭킹에 등록했어요";
    el("resRankBtn").hidden = false;
  } else {
    el("resOnlineText").textContent = `기록 등록 실패 (${res.err || "대기 중"}) — 기기에 보관했어요`;
    el("resResend").hidden = false;
  }
}
el("resResend").onclick = () => {
  sfx("ui_click");
  sendRunRecord();
};
// 랭킹 보기: 이전 순위 자리에서 새 자리로 내 줄이 이동, 다른 줄은 밀려남 (FLIP 애니메이션)
el("resRankBtn").onclick = async () => {
  sfx("ui_click");
  const before = lastRunRank?.before;
  const oldIdx = before ? before.findIndex(isMyRow) : -1;
  const out = await openRanking("all");
  if (!out || out.idx < 0) return;
  const list = el("rankList"), rows = [...list.children], mine = rows[out.idx];
  const rowH = mine.getBoundingClientRect().height;
  const from = oldIdx >= 0 ? oldIdx : Math.min(rows.length, RANKING.top); // 처음 들어온 기록은 맨 아래에서
  if (from === out.idx) {
    mine.classList.add("gold");
    return;
  }
  // 첫 상태: 내 줄은 예전 자리, 그 사이 줄들은 한 칸씩 원래 자리
  mine.style.transform = `translateY(${(from - out.idx) * rowH}px)`;
  const lo = Math.min(from, out.idx), hi = Math.max(from, out.idx), dir = from > out.idx ? -1 : 1;
  for (let i = lo; i <= hi; i++) if (rows[i] && rows[i] !== mine) rows[i].style.transform = `translateY(${dir * rowH}px)`;
  mine.scrollIntoView({ block: "center" });
  void list.offsetHeight;
  requestAnimationFrame(() => {
    for (const d of rows) {
      d.style.transition = "transform .9s cubic-bezier(.2,.8,.2,1)";
      d.style.transform = "";
    }
    mine.classList.add("gold");
    if (lastRunRank?.newBest) sfx("pickup");
    setTimeout(() => {
      for (const d of rows) d.style.transition = "";
      updatePinVisibility();
    }, 950);
  });
};
// 시작할 때 못 보낸 기록이 있으면 조용히 재전송
setTimeout(() => {
  if (profile?.nickname && rankQueue().length) flushRankQueue();
}, 4000);
