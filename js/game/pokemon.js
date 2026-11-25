// ===== 현곤 무한 생존 포켓몬 성장 (진화 · 전설/환상 영입 · 웨이브 사이 편성) =====
// 데이터: js/data/pokemon.js.  무한 생존 + 현곤일 때만 동작. 판이 끝나면 덱을 시작할 때로 되돌림
// - 보유 목록(owned): 시작 덱 3마리 + 영입한 전설/환상. 진화하면 같은 칸이 진화형으로 바뀜
// - 덱(deck) 3칸: 웨이브 사이(카운트다운 중) "포켓몬 편성" 에서 보유 목록과 교체
// - 카드: 일반(HP·공격력·공격 속도) / 희귀(진화 1단계, 잠만보·라프라스는 전용 강화, 소환 지속) / 전설(영입)

const PK_RULES = {
  hp: "pk_hp", atk: "pk_atk", aspd: "pk_spd", life: "pk_life", // 카드 id
  legendChanceNormal: 0.3, // 일반 웨이브 전설 카드 뽑기에서 영입 카드가 후보에 오를 확률 (보스 보상은 항상 + 가중치)
  legendWeightBoss: 3,
};
let pkDeckBackup = null;

function pkRun() {
  return singleRun?.endless && character === "summoner" ? singleRun.pk : null;
}
function setupPokemonRun() {
  restorePokemonDeck();
  if (character !== "summoner") return;
  pkDeckBackup = { deck: deck.slice(), selected };
  singleRun.pk = { owned: deck.slice(), boost: {}, mul: { hp: 1, atk: 1, aspd: 1, life: 1 } };
  if (summonCD.length < mons.length) summonCD = mons.map((_, i) => summonCD[i] || 0);
}
// 판 끝(스토리·배틀로얄로 돌아갈 때): 시작 덱으로
function restorePokemonDeck() {
  if (!pkDeckBackup) return;
  deck = pkDeckBackup.deck;
  selected = pkDeckBackup.selected;
  pkDeckBackup = null;
  if (pet && pet.id >= BASE_PET_COUNT) pet = null;
}
// 능력치 배율 (무한 생존 카드·전용 강화). 스토리·배틀로얄은 항상 1
function petMul(id, key) {
  const K = pkRun();
  if (!K) return 1;
  let m = K.mul[key] || 1;
  const lv = K.boost[id] || 0;
  if (lv) m *= key === "hp" ? EVO_RULES.hp ** lv : key === "atk" ? EVO_RULES.atk ** lv : key === "special" ? EVO_RULES.special ** lv : 1;
  return m;
}
function petMaxHp(id) {
  return Math.round(mons[id][4] * petMul(id, "hp"));
}
function petLife() {
  return PET_RULES.life * petMul(0, "life");
}

// ----- 카드 대상 -----
function pkEvolveTargets() {
  const K = pkRun();
  if (!K) return [];
  return K.owned.filter((id) => PET_DEX[id].next !== undefined || (PET_DEX[id].boost && (K.boost[id] || 0) < PET_BOOST_MAX));
}
function pkLegendTargets() {
  const K = pkRun();
  return K ? PET_LEGEND_IDS.filter((id) => !K.owned.includes(id)) : [];
}
function pkEvolve(id) {
  const K = pkRun(), D = PET_DEX[id];
  if (D.boost) { // 잠만보·라프라스: 전용 강화
    K.boost[id] = (K.boost[id] || 0) + 1;
    if (pet?.id === id) {
      const was = pet.max;
      pet.max = petMaxHp(id);
      pet.hp += pet.max - was;
    }
    return id;
  }
  const to = D.next;
  K.owned = K.owned.map((x) => (x === id ? to : x));
  deck = deck.map((x) => (x === id ? to : x));
  summonCD[to] = summonCD[id] || 0;
  if (pet?.id === id) { // 싸우는 중이면 그 자리에서 진화
    const f = pet.hp / pet.max;
    pet.id = to;
    pet.max = petMaxHp(to);
    pet.hp = pet.max * f;
  }
  // 진화 이펙트: 싸우는 중이면 그 포켓몬 위, 아니면 현곤 위에 (빛 + 이름)
  const at = pet?.id === to ? pet : p;
  fx.push({ x: at.x, y: at.y, t: 1.2, evolve: true, col: PET_LOOK[to]?.color || "#fff" });
  fx.push({ x: at.x, y: at.y - 40, t: 1.2, text: `${mons[id][0]} → ${mons[to][0]}`, tcol: "#ffe07a", big: true });
  return to;
}
function pkRecruit(id) {
  const K = pkRun();
  if (K.owned.includes(id)) return;
  K.owned.push(id);
  summonCD[id] = 0;
}
// 카드 뽑을 때 대상 정하기 (동적 카드). 대상이 없으면 그 카드는 후보에서 빠짐
function pkCardTarget(card) {
  if (card.dyn === "evolve") {
    const t = pkEvolveTargets();
    return t.length ? t[Math.floor(Math.random() * t.length)] : null;
  }
  if (card.dyn === "legend") {
    const t = pkLegendTargets();
    return t.length ? t[Math.floor(Math.random() * t.length)] : null;
  }
  return undefined;
}
function pkCardText(card, target) {
  if (card.dyn === "evolve") {
    const D = PET_DEX[target];
    return D.boost ? `${mons[target][0]} 전용 강화 ${(pkRun().boost[target] || 0) + 1}/${PET_BOOST_MAX}단계 (HP·공격 +30%, 기술 +20%)` : `${mons[target][0]} → ${mons[D.next][0]} 진화 (HP·공격 +30%, 기술 +20%, 사거리 +15%)`;
  }
  if (card.dyn === "legend") return `${mons[target][0]} 영입 · ${PET_SKILLS[target].name}`;
  return "";
}
function pkCardIcon(card, target) {
  if (card.dyn === "evolve") return petIconHTML(PET_DEX[target].boost ? target : PET_DEX[target].next, "card-art");
  if (card.dyn === "legend") return petIconHTML(target, "card-art");
  return null;
}

// ----- 웨이브 사이 편성 -----
function pkCanEdit() {
  const R = singleRun;
  return !!pkRun() && R.phase === "count" && R.pk.owned.length > 3;
}
function pkOpenDeck() {
  if (!pkCanEdit()) return;
  singleRun.pkOpen = true;
  singleRun.pkSlot = 0;
  renderPkDeck();
  el("pkPanel").hidden = false;
}
function pkCloseDeck() {
  if (!singleRun) return;
  singleRun.pkOpen = false;
  el("pkPanel").hidden = true;
  if (pet && !deck.includes(pet.id)) { // 덱에서 빠진 포켓몬은 돌아감
    fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true });
    pet = null;
  }
  selected = Math.min(selected, 2);
}
function pkPlace(id) {
  const R = singleRun, s = R.pkSlot;
  const other = deck.indexOf(id);
  if (other >= 0) deck[other] = deck[s]; // 이미 덱에 있으면 두 칸 맞바꿈
  deck[s] = id;
  R.pkSlot = (s + 1) % 3;
  renderPkDeck();
}
function renderPkDeck() {
  const R = singleRun, K = R.pk, slots = el("pkSlots"), list = el("pkOwned");
  slots.innerHTML = "";
  deck.forEach((id, i) => {
    const b = document.createElement("button");
    b.className = "pk-slot" + (i === R.pkSlot ? " on" : "");
    b.innerHTML = `${petIconHTML(id)}<b>${mons[id][0]}</b><small>${i + 1}번 칸</small>`;
    b.onclick = () => {
      R.pkSlot = i;
      renderPkDeck();
    };
    slots.append(b);
  });
  list.innerHTML = "";
  for (const id of K.owned) {
    const b = document.createElement("button"), D = PET_DEX[id];
    b.className = "pk-mon " + D.kind + (deck.includes(id) ? " in" : "");
    b.style.setProperty("--mon", PET_LOOK[id].color);
    b.innerHTML = `${petIconHTML(id)}<b>${mons[id][0]}</b><small>${D.kind === "legend" ? "전설·환상" : D.kind === "evo" ? "진화" : K.boost[id] ? `강화 ${K.boost[id]}` : "기본"}</small>`;
    b.onclick = () => pkPlace(id);
    SkillTip.attach(b, () => petTipModelById(id));
    list.append(b);
  }
}
el("pkDone").onclick = () => {
  sfx("ui_click");
  pkCloseDeck();
};
el("pkDeckBtn").onclick = () => {
  sfx("ui_click");
  pkOpenDeck();
};
