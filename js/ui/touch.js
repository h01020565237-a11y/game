// 모바일 터치 조작

const touchMode = matchMedia("(pointer:coarse)").matches;
document.body.classList.toggle("mobile", touchMode);
let mvX = 0, mvY = 0, aiming = false;
const sb = document.querySelector("#summonBtn");
// 화면 회전 모드(세로로 든 폰에서 게임을 90도 돌려 가로로 표시)일 때
// 화면 좌표의 이동량을 게임 화면 기준으로 바꿈
function toLocal(dx, dy) {
  return document.body.classList.contains("rot") ? [dy, -dx] : [dx, dy];
}
// ----- 길게 누르기 설명창 -----
// 스킬·포켓몬 버튼을 0.45초 이상 누르고 있으면 효과 설명을 띄움. 설명을 본 뒤 손을 떼면 스킬은 나가지 않음
const LONG_PRESS = 0.45;
const tip = document.querySelector("#skillTip");
function showTip(btn, info) {
  document.querySelector("#tipName").textContent = info.name;
  document.querySelector("#tipDesc").textContent = info.desc;
  document.querySelector("#tipMeta").textContent = info.meta || "";
  tip.hidden = false;
  // 레이아웃 좌표(offset*) 기준: 회전 화면에서도 버튼 바로 위(공간이 없으면 아래)에 표시
  const box = tip.offsetParent || document.body, bw = box.offsetWidth, bh = box.offsetHeight;
  const tw = tip.offsetWidth, th = tip.offsetHeight, cx = btn.offsetLeft + btn.offsetWidth / 2;
  let top = btn.offsetTop - th - 10;
  if (top < 6) top = btn.offsetTop + btn.offsetHeight + 10;
  tip.style.left = clamp(cx - tw / 2, 6, bw - tw - 6) + "px";
  tip.style.top = clamp(top, 6, bh - th - 6) + "px";
  if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) {}
}
function hideTip() {
  tip.hidden = true;
}
function skillInfo(slot) { // slot 1 = 스킬1(Q), 2 = 스킬2(E)
  const info = CHARACTER_INFO[character], sk = info && info.skills[slot - 1];
  if (!sk) return null;
  const [desc, cd] = sk[1].split(" · ");
  return { name: `${DISPLAY_NAMES[character]} · ${sk[0]}`, desc, meta: (cd ? "쿨타임 " + cd + " · " : "") + "패시브: " + info.passive };
}
function petInfo(i) {
  const id = deck[i], m = mons[id], P = PET_INFO[id];
  return { name: `${m[1]} ${m[0]} · ${P.skill}`, desc: P.desc, meta: `공격력 ${m[2]} · 체력 ${m[4]} · 소환 10초 / 쿨타임 15초` };
}
// 일반 스킬 버튼: 짧게 탭하면 손을 뗄 때 사용, 길게 누르면 설명만
function tapOrInfo(btn, fire, info) {
  let press = null;
  btn.onpointerdown = (e) => {
    e.preventDefault();
    if (over || press) return;
    btn.setPointerCapture(e.pointerId);
    press = { id: e.pointerId, info: false, timer: setTimeout(() => {
      const d = info();
      if (press && d) {
        press.info = true;
        showTip(btn, d);
      }
    }, LONG_PRESS * 1000) };
  };
  btn.onpointerup = (e) => {
    if (press?.id !== e.pointerId) return;
    clearTimeout(press.timer);
    const shown = press.info;
    press = null;
    hideTip();
    if (!shown && !over) fire();
  };
  btn.onpointercancel = btn.onlostpointercapture = (e) => {
    if (press?.id !== e.pointerId) return;
    clearTimeout(press.timer);
    press = null;
    hideTip();
  };
}

// 현곤(소환사): 소환 버튼 대신 포켓몬 3마리 버튼을 화면에 바로 표시
// - 탭: 그 포켓몬을 자동 위치로 바로 소환 (다른 포켓몬이 나와 있으면 교체)
// - 끌기: 방향·거리 조준(사거리 원과 조준점 표시), 떼면 그 자리에 투척, 가운데로 되돌려 떼면 취소
let summonAim = null; // 조준 미리보기 { x, y } (렌더러가 그림)
let petPress = null;  // { id, i, x, y, moved, cancel }
const petBtns = [...document.querySelectorAll(".petBtn")];
function throwSummon(i, x, y) {
  selected = i;
  if (pet?.id === deck[i]) return;
  mouse.x = x;
  mouse.y = y;
  summon(!!pet);
}
function closeSwipe() { // 이름은 예전 호출부 호환용: 진행 중인 소환 조준 취소
  if (petPress) clearTimeout(petPress.timer);
  hideTip();
  petPress = null;
  summonAim = null;
}
function tickSummonAim() {
  if (petPress && (character !== "summoner" || p.hp <= 0 || over)) closeSwipe();
}
petBtns.forEach((btn, i) => {
  btn.onpointerdown = (e) => {
    e.preventDefault();
    if (over || petPress || character !== "summoner") return;
    btn.setPointerCapture(e.pointerId);
    petPress = { id: e.pointerId, i, x: e.clientX, y: e.clientY, moved: false, cancel: false, info: false };
    const pp = petPress;
    pp.timer = setTimeout(() => {
      if (petPress === pp && !pp.moved) {
        pp.info = true;
        showTip(btn, petInfo(i));
      }
    }, LONG_PRESS * 1000);
  };
  btn.onpointermove = (e) => {
    if (petPress?.id !== e.pointerId) return;
    const [dx, dy] = toLocal(e.clientX - petPress.x, e.clientY - petPress.y), m = Math.hypot(dx, dy);
    if (m > AIM_DEAD && !petPress.moved) {
      petPress.moved = true;
      clearTimeout(petPress.timer);
      if (petPress.info) { // 설명을 보다가 끌기 시작하면 설명 닫고 조준으로
        petPress.info = false;
        hideTip();
      }
    }
    if (!petPress.moved) return;
    petPress.cancel = m <= AIM_DEAD;
    if (petPress.cancel) {
      summonAim = null;
      return;
    }
    const d = clamp(m / (btn.offsetWidth * 1.6), 0.15, 1) * SUMMON_RANGE; // 버튼 1.6배 끌면 최대 사거리
    summonAim = { x: p.x + dx / m * d, y: p.y + dy / m * d };
    selected = i; // 조준 미리보기에 이름 표시
  };
  btn.onpointerup = (e) => {
    if (petPress?.id !== e.pointerId) return;
    const pr = petPress, aimAt = summonAim;
    clearTimeout(pr.timer);
    closeSwipe();
    if (pr.info) return hideTip(); // 설명만 보고 뗌: 소환하지 않음
    if (over) return;
    if (pr.moved) {
      if (!pr.cancel && aimAt) throwSummon(i, aimAt.x, aimAt.y);
      return;
    }
    selected = i;
    const t = autoSummonSpot();
    throwSummon(i, t.x, t.y);
  };
  btn.onpointercancel = btn.onlostpointercapture = (e) => petPress?.id === e.pointerId && closeSwipe();
});
tapOrInfo(sb, () => character !== "summoner" && characterSkill(1), () => skillInfo(1));
function aimSummon() {
  let x = mvX, y = mvY;
  if (!x && !y) {
    x = Math.sin(p.dir * Math.PI / 4);
    y = -Math.cos(p.dir * Math.PI / 4);
  }
  let n = Math.hypot(x, y) || 1;
  mouse.x = p.x + x / n * 110;
  mouse.y = p.y + y / n * 110;
}
// 자동 투척 위치
function autoSummonSpot() {
  const foe = minBy(bots.filter((b) => b.hp > 0 && dist(p, b) <= SUMMON_RANGE + 60), (b) => dist(p, b));
  let ang, d;
  if (foe) {
    ang = Math.atan2(foe.y - p.y, foe.x - p.x);
    d = clamp(dist(p, foe) - 40, 60, SUMMON_RANGE);
  } else {
    aimSummon();
    ang = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    d = 110;
  }
  // 막힌 자리면 각도를 조금씩 돌리고 거리를 줄여 가며 가까운 빈자리를 찾음
  for (const dd of [d, d * 0.75, d * 0.5, 50])
    for (const da of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) {
      const t = summonPoint(p.x + Math.cos(ang + da) * dd, p.y + Math.sin(ang + da) * dd);
      if (t.ok) return t;
    }
  return summonPoint(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d);
}
function stick(id, fn) {
  let el = document.getElementById(id), pid = null;
  function set(e) {
    let r = el.getBoundingClientRect(), [x, y] = toLocal((e.clientX - r.left - r.width / 2) / (r.width / 2), (e.clientY - r.top - r.height / 2) / (r.height / 2)), n = Math.max(1, Math.hypot(x, y));
    x /= n;
    y /= n;
    el.querySelector("i").style.transform = `translate(${x * r.width * 0.3}px,${y * r.height * 0.3}px)`;
    fn(x, y, true);
  }
  el.onpointerdown = (e) => {
    if (pid !== null) return;
    e.preventDefault();
    pid = e.pointerId;
    el.setPointerCapture(pid);
    set(e);
  };
  el.onpointermove = (e) => {
    if (e.pointerId === pid) set(e);
  };
  function end(e) {
    if (e.pointerId !== pid) return;
    pid = null;
    el.querySelector("i").style.transform = "";
    fn(0, 0, false);
  }
  el.onpointerup = end;
  el.onpointercancel = end;
  el.onlostpointercapture = end;
}
stick("mv", (x, y) => {
  mvX = x;
  mvY = y;
});
const atkBtn = document.querySelector("#atk");
function aimTarget() {
  let list = targets(p).filter((b) => dist(p, b) <= weapons[p.w][3] && (p.w === 6 || clearLine(p, b)));
  return list.filter((b) => b.max).sort((a, b) => dist(p, a) - dist(p, b))[0] || list.sort((a, b) => dist(p, a) - dist(p, b))[0];
}
function autoAttack() {
  let b = aimTarget();
  attack(p, b ? b.x : p.x + Math.sin(p.dir * Math.PI / 4) * weapons[p.w][3], b ? b.y : p.y - Math.cos(p.dir * Math.PI / 4) * weapons[p.w][3]);
}
// 공격 버튼
// - 짧게 탭: 가까운 적에게 자동 조준 1발
// - 누른 채 가만히: 자동 조준 연속 공격 (탄창이 남아 있는 동안)
// - 누른 채 끌기: 끈 방향으로 직접 조준 (화면에 범위 표시), 손을 떼면 발사
//   수류탄은 끈 거리만큼 던지는 거리도 조절됨. 버튼 가운데로 되돌리고 떼면 취소
let atkPress = null, manualAim = null;
const AIM_DEAD = 16; // px, 이만큼 끌어야 직접 조준 시작
atkBtn.onpointerdown = (e) => {
  e.preventDefault();
  if (over || atkPress) return;
  atkBtn.setPointerCapture(e.pointerId);
  atkPress = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  manualAim = null;
};
atkBtn.onpointermove = (e) => {
  if (atkPress?.id !== e.pointerId) return;
  let [dx, dy] = toLocal(e.clientX - atkPress.x, e.clientY - atkPress.y), m = Math.hypot(dx, dy);
  if (m > AIM_DEAD || manualAim) {
    aiming = false;
    const R = atkBtn.offsetWidth * 1.1; // 이만큼 끌면 최대 거리
    manualAim = m < 1 ? { x: 0, y: 0, mag: 0, cancel: true } : { x: dx / m, y: dy / m, mag: clamp(m / R, 0.15, 1), cancel: m <= AIM_DEAD };
  }
};
function fireManual() {
  const r = weapons[p.w][3];
  attack(p, p.x + manualAim.x * r, p.y + manualAim.y * r);
}
function releaseAttack(fire) {
  if (!atkPress) return;
  if (fire && !over) {
    if (manualAim) {
      if (!manualAim.cancel) fireManual();
    } else if (!aiming) autoAttack(); // 짧은 탭
  }
  atkPress = null;
  manualAim = null;
  aiming = false;
}
atkBtn.onpointerup = (e) => atkPress?.id === e.pointerId && releaseAttack(true);
atkBtn.onpointercancel = atkBtn.onlostpointercapture = () => releaseAttack(false);
// 끌지 않고 0.2초 이상 누르고 있으면 자동 연속 공격 (touchHUD 에서 매 프레임 확인)
function checkHoldAttack() {
  if (atkPress && !manualAim && !aiming && performance.now() - atkPress.t > 200) aiming = true;
}
// 반응 속도: 손을 뗄 때(click)가 아니라 누르는 순간(pointerdown) 발동
document.querySelector("#dashBtn").onpointerdown = (e) => {
  e.preventDefault();
  if (over || p.dashCD > 0 || p.tackle > 0) return;
  let x = mvX, y = mvY;
  if (Math.hypot(x, y) < 0.15) {
    x = Math.sin(p.dir * Math.PI / 4);
    y = -Math.cos(p.dir * Math.PI / 4);
  }
  p.dx = x;
  p.dy = y;
  p.dash = 0.1;
  p.dashCD = 3;
  sfx("dash", p);
};
document.querySelector("#pickBtn").onpointerdown = (e) => {
  e.preventDefault();
  if (!over) pickup(p, isSwapLoot);
};
document.querySelector("#mobileToggle").onclick = () => {
  document.body.classList.toggle("mobile");
  document.body.classList.remove("menuOpen");
  mvX = mvY = 0;
  aiming = false;
  fitCanvas();
};
// 모바일 메뉴 (캐릭터·덱 선택). 열려 있는 동안 게임은 멈춤
document.querySelector("#menuBtn").onpointerdown = (e) => {
  e.preventDefault();
  document.body.classList.toggle("menuOpen");
  mvX = mvY = 0;
  aiming = false;
  closeSwipe();
};
window.addEventListener("blur", () => {
  mvX = mvY = 0;
  releaseAttack(false);
  aiming = false;
  closeSwipe();
});
const ammoText = (a) => "●".repeat(a.ammo) + "○".repeat(Math.max(0, AMMO.max - a.ammo));
function touchHUD() {
  checkHoldAttack();
  setText("atk", "공격\n" + ammoText(p));
  setText("grenBtn", "수류탄\n" + (p.grenades || 0) + "/" + GRENADE.max);
  const gOn = (p.grenades || 0) > 0;
  if (grenBtn._on !== gOn) {
    grenBtn._on = gOn;
    grenBtn.classList.toggle("empty", !gOn);
    grenBtn.setAttribute("aria-disabled", String(!gOn));
  }
  if (character === "summoner") for (let i = 0; i < 3; i++) {
    const id = deck[i], btn = petBtns[i], live = pet?.id === id;
    const wait = live ? 0 : summonCD[id] > 0 ? summonCD[id] : flight ? -1 : pet && swapCD > 0 ? swapCD : 0;
    const status = live ? "전투 중" : wait > 0 ? Math.ceil(wait) + "초" : wait < 0 ? "투척 중" : pet ? "교체" : "소환";
    const html = `<strong>${mons[id][1]}</strong><span class="pn">${mons[id][0]}</span><span class="ps">${status}</span>`;
    if (btn._html !== html) {
      btn._html = html;
      btn.innerHTML = html;
    }
    const cls = "petBtn" + (live ? " live" : "") + (wait !== 0 ? " lock" : "") + (petPress?.i === i ? " press" : "");
    if (btn.className !== cls) btn.className = cls;
  }
  setText("dashBtn", p.dashCD > 0 ? "대시 " + p.dashCD.toFixed(1) : "대시");
  setText("bearHeal", extraNames[character] ? extraNames[character][1] + (p.s2 > 0 ? " " + p.s2.toFixed(1) : "") : character === "runner" ? p.tackleCD > 0 ? "태클 " + p.tackleCD.toFixed(1) : "태클" : p.healCD > 0 ? "회복 " + p.healCD.toFixed(1) : "회복");
  setText("summonBtn", extraNames[character] ? extraNames[character][0] + (p.s1 > 0 ? " " + p.s1.toFixed(1) : "") : character === "runner" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주 " + Math.floor(p.energy) + "%" : character === "bear" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주" : "소환");
  // 교체 버튼: 바꿀 수 있는 아이템 위에 있을 때만 표시
  let swapL = nearLoot(p, isSwapLoot), pick = el("pickBtn");
  let label = swapL ? "교체\n" + lootName(swapL) : "";
  setText("pickBtn", label);
  if (pick._show !== !!swapL) {
    pick._show = !!swapL;
    pick.style.visibility = swapL ? "visible" : "hidden";
  }
}
// #bearHeal: 이름과 달리 비소환사 캐릭터 공통 스킬2 버튼
tapOrInfo(document.querySelector("#bearHeal"), () => characterSkill(2), () => skillInfo(2));
document.querySelector("#charApply").onclick = () => {
  character = document.querySelector("#character").value;
  ui.style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#petHUD").style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#bearHeal").style.display = character !== "summoner" ? "block" : "none";
  document.body.classList.toggle("summoner", character === "summoner");
  closeSwipe();
  document.body.classList.remove("menuOpen");
  closeLobby();
  reset();
};

// 길게 누르기 메뉴(복사·붙여넣기·이미지 저장)와 텍스트 선택 막기. 메뉴 패널의 선택 상자는 그대로 동작
const allowNative = (t) => t && t.closest && t.closest("select, option, input, #menuPanel");
for (const ev of ["contextmenu", "selectstart"]) {
  document.addEventListener(ev, (e) => {
    if (document.body.classList.contains("mobile") && !allowNative(e.target)) e.preventDefault();
  });
}

// 수류탄 버튼 (소모품, 최대 3개)
// - 탭: 가장 가까운 적에게 자동 조준 투척 (적이 없으면 바라보는 방향 최대 거리)
// - 끌기: 방향과 거리를 직접 조준 (화면에 낙하 지점과 폭발 범위 표시), 손을 떼면 투척, 가운데로 되돌리면 취소
const grenBtn = document.querySelector("#grenBtn");
let grenPress = null, grenAim = null;
grenBtn.onpointerdown = (e) => {
  e.preventDefault();
  if (over || grenPress || !(p.grenades > 0)) return; // 수류탄이 없으면 버튼 비활성
  grenBtn.setPointerCapture(e.pointerId);
  grenPress = { id: e.pointerId, x: e.clientX, y: e.clientY };
  grenAim = null;
};
grenBtn.onpointermove = (e) => {
  if (grenPress?.id !== e.pointerId) return;
  let [dx, dy] = toLocal(e.clientX - grenPress.x, e.clientY - grenPress.y), m = Math.hypot(dx, dy);
  if (m > AIM_DEAD || grenAim) {
    const R = grenBtn.offsetWidth * 1.6;
    grenAim = m < 1 ? { x: 0, y: 0, mag: 0, cancel: true } : { x: dx / m, y: dy / m, mag: clamp(m / R, 0.2, 1), cancel: m <= AIM_DEAD };
  }
};
function releaseGrenade(fire) {
  if (!grenPress) return;
  if (fire && !over) {
    const r = weapons[GRENADE.weaponId][3];
    if (grenAim) {
      if (!grenAim.cancel) throwGrenade(p, p.x + grenAim.x * r * grenAim.mag, p.y + grenAim.y * r * grenAim.mag);
    } else {
      const b = minBy(targets(p).filter((t) => t.max && dist(p, t) <= r), (t) => dist(p, t));
      const a = b ? Math.atan2(b.y - p.y, b.x - p.x) : dirToAngle(p.dir);
      throwGrenade(p, b ? b.x : p.x + Math.cos(a) * r, b ? b.y : p.y + Math.sin(a) * r);
    }
  }
  grenPress = null;
  grenAim = null;
}
grenBtn.onpointerup = (e) => grenPress?.id === e.pointerId && releaseGrenade(true);
grenBtn.onpointercancel = grenBtn.onlostpointercapture = () => releaseGrenade(false);
