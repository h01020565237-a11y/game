// ===== 공통 스킬 설명창 =====
// 어떤 버튼이든 SkillTip.attach(버튼, 설명 만드는 함수) 한 줄로 연결:
//   터치: 0.5초 이상 길게 누르면 설명 표시 → 손을 떼거나 끌기 시작하면 닫힘
//         설명만 본 경우 SkillTip.used(버튼) 이 true → 각 버튼의 발동 코드가 이것을 보고 발동하지 않음
//   PC(마우스): 올리면 설명 표시, 벗어나면 닫힘 (누르는 동작은 그대로)
// 설명 내용은 SKILL_DATA / PET_SKILLS (js/data/skills.js) 에서 매번 새로 만들어서 밸런스 수정이 바로 반영됨

const SkillTip = (() => {
  const HOLD = 0.5, DRAG = 16, HOVER_DELAY = 120;
  const tip = document.querySelector("#skillTip");
  let owner = null;
  function render(model) {
    tip.innerHTML = "";
    const head = document.createElement("div");
    head.className = "tip-head";
    if (model.key) {
      const k = document.createElement("kbd");
      k.textContent = model.key;
      head.append(k);
    }
    const b = document.createElement("b");
    b.textContent = model.title;
    head.append(b);
    tip.append(head);
    const d = document.createElement("span");
    d.className = "tip-desc";
    d.textContent = model.desc;
    tip.append(d);
    if (model.chips && model.chips.length) {
      const row = document.createElement("div");
      row.className = "tip-chips";
      for (const c of model.chips) {
        const i = document.createElement("i");
        i.textContent = c;
        row.append(i);
      }
      tip.append(row);
    }
    if (model.foot) {
      const f = document.createElement("small");
      f.textContent = model.foot;
      tip.append(f);
    }
  }
  function show(el, provider) {
    const model = provider();
    if (!model) return false;
    render(model);
    tip.hidden = false;
    owner = el;
    // 레이아웃 좌표(offset*) 기준 → 화면이 회전돼 있어도 버튼 바로 위(공간이 없으면 아래)
    const box = tip.offsetParent || document.body, bw = box.offsetWidth, bh = box.offsetHeight;
    let x = 0, y = 0;
    for (let n = el; n && n !== box; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    for (let n = el.parentElement; n && n !== box; n = n.parentElement) { // 스크롤된 영역 안의 버튼(로비 등)
      x -= n.scrollLeft;
      y -= n.scrollTop;
    }
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top = y - th - 10;
    if (top < 6) top = y + el.offsetHeight + 10;
    tip.style.left = Math.max(6, Math.min(bw - tw - 6, x + el.offsetWidth / 2 - tw / 2)) + "px";
    tip.style.top = Math.max(6, Math.min(bh - th - 6, top)) + "px";
    return true;
  }
  function hide(el) {
    if (el && owner !== el) return;
    tip.hidden = true;
    owner = null;
  }
  function attach(el, provider) {
    let press = null, hoverT = 0;
    el.addEventListener("pointerdown", (e) => {
      el._tipUsed = false;
      if (e.pointerType === "mouse") return;
      clearTimeout(press?.timer);
      press = { id: e.pointerId, x: e.clientX, y: e.clientY };
      press.timer = setTimeout(() => {
        if (press && show(el, provider)) {
          el._tipUsed = true;
          if (navigator.vibrate) try { navigator.vibrate(12); } catch (err) {}
        }
      }, HOLD * 1000);
    });
    el.addEventListener("pointermove", (e) => {
      if (!press || press.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG) { // 끌기 시작: 설명 닫고 일반 조작으로
        clearTimeout(press.timer);
        el._tipUsed = false;
        hide(el);
        press = null;
      }
    });
    const end = (e) => {
      if (!press || press.id !== e.pointerId) return;
      clearTimeout(press.timer);
      press = null;
      hide(el);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    // PC: 마우스 올리기
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverT);
      hoverT = setTimeout(() => show(el, provider), HOVER_DELAY);
    });
    el.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      clearTimeout(hoverT);
      hide(el);
    });
  }
  // 설명만 보고 뗀 경우 true (발동하지 않아야 함). 다음 누르기에서 초기화
  const used = (el) => !!el._tipUsed;
  return { attach, used, hide: () => hide(null) };
})();

// ----- 설명 모델 (공통) -----
// 캐릭터 스킬: slot "q" | "e" | "passive"
function skillTipModel(charId, slot, key) {
  const D = SKILL_DATA[charId];
  if (!D || !D[slot]) return null;
  const s = D[slot];
  return {
    key,
    title: `${DISPLAY_NAMES[charId] || charId} · ${s.name}${slot === "passive" ? " (패시브)" : slot === "r" ? " (궁극기)" : ""}`,
    desc: skillText(s),
    chips: skillChips(s),
    foot: slot === "passive" ? "" : slot === "r" ? `적에게 준 피해로 충전 (지금 ${Math.floor((charId === character ? p.ult || 0 : 0) * 100)}%)` : "패시브 · " + D.passive.name + ": " + skillText(D.passive),
  };
}
// 포켓몬: 덱 칸 번호(0~2) → 포켓몬 번호로
function petTipModel(i, key) {
  return petTipModelById(deck[i], key);
}
// 포켓몬 번호(mons 순서)로 (캐릭터 선택창 포켓몬 칸 등)
function petTipModelById(id, key) {
  const m = mons[id], S = PET_SKILLS[id];
  return {
    key,
    title: `${m[1]} ${m[0]} · ${S.name}`,
    desc: skillText(S),
    chips: [...skillChips(S), `공격력 ${m[2]}`, `체력 ${m[4]}`, `소환 ${fmtNum(PET_RULES.life)}초`, `쿨타임 ${fmtNum(PET_RULES.summonCD)}초`],
    foot: `기술은 ${fmtNum(PET_RULES.skillCD)}초마다 자동 사용`,
  };
}

// ----- PC 스킬 칸 (경기장 오른쪽 아래, 마우스를 올리면 설명) -----
let skillBarFor = null;
function buildSkillBar() {
  const bar = document.querySelector("#skillBar");
  bar.innerHTML = "";
  skillBarFor = character + ":" + deck.join();
  const add = (cls, html, provider, onClick) => {
    const el = document.createElement("div");
    el.className = "sk-slot " + cls;
    el.innerHTML = html + '<i class="cd"></i><span class="cdt"></span>';
    SkillTip.attach(el, provider);
    if (onClick) el.onclick = onClick;
    bar.append(el);
    return el;
  };
  if (character === "summoner")
    deck.forEach((id, i) => add("pet", `<kbd>${i + 1}</kbd><strong>${mons[id][1]}</strong><b>${mons[id][0]}</b>`, () => petTipModel(i, String(i + 1)), () => (selected = i)));
  const D = SKILL_DATA[character];
  if (!D) return;
  add("q", `<kbd>Q</kbd><b>${D.q.name}</b>`, () => skillTipModel(character, "q", "Q"));
  add("e", `<kbd>E</kbd><b>${D.e.name}</b>`, () => skillTipModel(character, "e", "E"));
  add("r", `<kbd>X</kbd><b>${D.r.name}</b>`, () => skillTipModel(character, "r", "X"));
  add("passive", `<b>${D.passive.name}</b><span>패시브</span>`, () => skillTipModel(character, "passive"));
}
// updateHUD 에서 매 프레임 호출: 쿨타임 표시 갱신
function updateSkillBar() {
  if (document.body.classList.contains("mobile")) return;
  if (skillBarFor !== character + ":" + deck.join()) buildSkillBar();
  const bar = document.querySelector("#skillBar"), D = SKILL_DATA[character];
  for (const el of bar.children) {
    let left = 0, total = 1;
    if (el.classList.contains("pet")) {
      const i = [...bar.querySelectorAll(".pet")].indexOf(el), id = deck[i];
      left = summonCD[id];
      total = PET_RULES.summonCD;
      el.classList.toggle("sel", i === selected);
      el.classList.toggle("live", pet?.id === id);
    } else if (el.classList.contains("q") || el.classList.contains("e")) {
      const slot = el.classList.contains("q") ? "q" : "e";
      left = skillCdLeft(slot);
      total = character === "summoner" ? (slot === "q" ? PET_RULES.summonCD : PET_RULES.swapCD) : D[slot].cd;
    } else if (el.classList.contains("r")) { // 궁극기: 충전이 덜 된 만큼 가림
      left = 1 - (p.ult || 0);
      total = 1;
      el.classList.toggle("live", ultReady());
    }
    const h = left > 0 ? Math.min(100, (left / total) * 100).toFixed(0) + "%" : "0%";
    const cd = el.querySelector(".cd"), t = el.querySelector(".cdt"), txt = el.classList.contains("r") ? (left > 0 ? Math.floor((1 - left) * 100) + "%" : "") : left > 0 ? left.toFixed(left < 10 ? 1 : 0) : "";
    if (cd.style.height !== h) cd.style.height = h;
    if (t.textContent !== txt) t.textContent = txt;
  }
}
