// ===== 무한 생존 화면: 시작 목록·기록, HUD(웨이브·타이머·레벨), 카드, 결과 =====

function renderEndlessList() {
  const box = el("endlessList");
  box.innerHTML = "";
  for (const k of LOBBY_ORDER) {
    const ok = canPlay(k), best = endlessSave.best[k];
    const b = document.createElement("button");
    b.className = "endless-tile" + (ok ? "" : " locked") + (isRecruited(k) ? "" : " test");
    b.disabled = !ok;
    b.innerHTML = `<img alt=""><b>${DISPLAY_NAMES[k]}</b><small>${best ? `최고 W${best.wave} · ${fmtTime(best.time)}` : "기록 없음"}</small>`;
    b.querySelector("img").src = lobbyArt[k].face.src;
    b.onclick = () => startEndless(k);
    box.append(b);
  }
}
function startEndless(k) {
  el("singlePanel").hidden = true;
  beginEndless(k);
  sfx("ui_click");
  document.querySelector("#character").value = k;
  document.querySelector("#charApply").click();
}

function updateEndlessHUD() {
  const R = singleRun;
  setText("aliveNum", String(bots.filter((b) => b.hp > 0 && !b.bossId).length));
  el("aliveHud").firstChild.textContent = "적 ";
  setText("zoneHud", R.spec?.boss ? `W${R.wave} 보스` : `W${R.wave} · ${fmtTime(Math.max(0, Math.ceil(R.phase === "fight" ? R.timer : ENDLESS.normalTime)))}`);
  // 레벨·경험치
  const eh = el("expHud");
  if (eh.hidden) eh.hidden = false;
  eh.classList.toggle("boss", !!R.boss);
  setText("expLv", "Lv" + R.level);
  const pct = (100 * R.exp / endlessNeedExp(R.level)).toFixed(1) + "%";
  if (el("expFill").style.width !== pct) el("expFill").style.width = pct;
  // 보스 체력
  const boss = R.boss && R.boss.hp > 0 ? R.boss : null, bh = el("bossHud");
  if (bh.hidden !== !boss) bh.hidden = !boss;
  if (boss) {
    el("bossFill").style.width = (100 * boss.hp / boss.max).toFixed(1) + "%";
    setText("bossName", `타락한 ${DISPLAY_NAMES[boss.bossId]} · ${ENDLESS_BOSSES[boss.bossId].name}`);
  }
  // 배너·카운트다운
  const bn = el("waveBanner");
  const txt = R.phase === "count" ? `W${R.wave} 시작까지 ${Math.ceil(R.t)}` : R.bannerT > 0 ? R.banner : "";
  if (bn.hidden !== !txt) bn.hidden = !txt;
  if (txt && bn.textContent !== txt) bn.textContent = txt;
  // 카드
  const wc = el("waveCards"), on = R.phase === "cards";
  if (wc.hidden !== !on) {
    wc.hidden = !on;
    if (on) renderEndlessCards();
  }
}
function renderEndlessCards() {
  const R = singleRun, row = el("cardsRow");
  el("cardsTitle").textContent = R.cardRarity === "legend" ? "보스 처치! 전설 카드를 1장 고르세요" : `카드를 1장 고르세요 (Lv${R.level})`;
  row.innerHTML = "";
  R.cards.forEach(({ card, rarity }, i) => {
    const b = document.createElement("button"), L = RARITY_LOOK[rarity];
    b.className = "wave-card " + rarity;
    b.style.borderColor = L.color;
    const n = cardCount(card.id);
    b.innerHTML = `<em style="color:${L.color}">${L.name} · ${card.cat}</em><i>${card.icon}</i><b>${card.name}</b><span>${cardText(card, card.tiers[rarity])}</span><small>${n}/${card.cap}</small>`;
    b.onclick = () => {
      pickEndlessCard(i);
      el("waveCards").hidden = true;
    };
    row.append(b);
  });
}
function showEndlessResult() {
  const r = endlessRecord();
  el("resTitle").textContent = r.newBest ? "🏆 최고 기록!" : "무한 생존 종료";
  el("resTitle").classList.toggle("lose", !r.newBest);
  el("resRank").previousElementSibling.textContent = "웨이브 · 레벨";
  el("resRank").textContent = `W${r.wave} · Lv${r.level}`;
  el("overBtn").textContent = "다시 도전";
}
