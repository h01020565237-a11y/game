// 모바일 터치 조작

const touchMode = matchMedia("(pointer:coarse)").matches;
document.body.classList.toggle("mobile", touchMode);
let mvX = 0, mvY = 0, aiming = false;
const sb = document.querySelector("#summonBtn"), menu = document.querySelector("#summonMenu");
let swipe = null;
for (let i = 0; i < 3; i++) {
  let el = document.createElement("div");
  el.className = "choice";
  menu.append(el);
}
// 화면 회전 모드(세로로 든 폰에서 게임을 90도 돌려 가로로 표시)일 때
// 화면 좌표의 이동량을 게임 화면 기준으로 바꿈
function toLocal(dx, dy) {
  return document.body.classList.contains("rot") ? [dy, -dx] : [dx, dy];
}
// 소환 메뉴: 버튼을 누르면 왼쪽 · 왼쪽 위 · 위 세 방향에 포켓몬 3마리가 부채꼴로 펼쳐짐
// (오른쪽 화면 끝에 몰려 겹치지 않도록 왼쪽·위로만 펼침)
const SWIPE_ANGLES = [-90, -45, 0]; // 위=0°, 왼쪽=-90°
function swipeChoice(dx, dy) {
  [dx, dy] = toLocal(dx, dy);
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (Math.hypot(dx, dy) < 22 || angle < -112.5 || angle > 22.5) return -1;
  return angle < -67.5 ? 0 : angle < -22.5 ? 1 : 2;
}
function closeSwipe() {
  swipe = null;
  menu.classList.remove("open");
}
// 조준 모드: 포켓몬을 고른 뒤 던질 위치를 직접 정함
// - 화면(맵)을 탭/드래그: 손가락 위치로 조준, 떼면 투척 (사거리 밖은 원 테두리로 당김)
// - 소환 버튼 탭: 현재 조준점으로 투척 / 버튼에서 끌기: 방향·거리 조준, 가운데로 되돌려 떼면 취소
// - 5초 동안 아무것도 안 하면 자동 취소
let summonAim = null; // { x, y, t, press }
function startSummonAim() {
  aimSummon(); // 기본 조준점: 이동 방향(없으면 바라보는 방향) 110px
  summonAim = { x: mouse.x, y: mouse.y, t: 5, press: null, drag: null };
}
function endSummonAim(fire) {
  if (!summonAim) return;
  const a = summonAim;
  summonAim = null;
  if (!fire || over) return;
  mouse.x = a.x;
  mouse.y = a.y;
  summon(!!pet);
}
function tickSummonAim(dt) {
  if (summonAim && !summonAim.press && !summonAim.drag && (summonAim.t -= dt) <= 0) summonAim = null;
  if (summonAim && (character !== "summoner" || p.hp <= 0 || over)) summonAim = null;
}
sb.onpointerdown = (e) => {
  if (over || swipe) return;
  e.preventDefault();
  if (character !== "summoner") {
    characterSkill(1);
    return;
  }
  sb.setPointerCapture(e.pointerId);
  if (summonAim) { // 조준 중: 버튼으로 투척/방향 조준
    summonAim.press = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: summonAim.x - p.x, oy: summonAim.y - p.y, moved: false };
    return;
  }
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, choice: -1 };
  // 레이아웃 좌표(offset*) 사용: 화면이 회전돼 있어도 정확함
  menu.classList.add("open"); // 먼저 열어야 크기를 잴 수 있음
  let bw = sb.offsetWidth, cx = sb.offsetLeft + bw / 2, cy = sb.offsetTop + sb.offsetHeight / 2, aw = menu.offsetWidth, ah = menu.offsetHeight;
  let cw = menu.children[0].offsetWidth || 60, half = cw / 2;
  // 이웃한 아이콘 중심 거리(현의 길이 2R·sin22.5°)가 아이콘 크기의 1.2배 이상이 되도록 반지름 결정
  let R = Math.max(bw / 2 + half + 10, cw * 1.2 / (2 * Math.sin(Math.PI / 8)));
  SWIPE_ANGLES.forEach((deg, i) => {
    let r = deg * Math.PI / 180, el = menu.children[i];
    el.style.left = clamp(cx + Math.sin(r) * R, half + 4, aw - half - 4) + "px";
    el.style.top = clamp(cy - Math.cos(r) * R, half + 4, ah - half - 4) + "px";
  });
  touchHUD();
};
sb.onpointermove = (e) => {
  if (swipe?.id === e.pointerId) {
    swipe.choice = swipeChoice(e.clientX - swipe.x, e.clientY - swipe.y);
    touchHUD();
  } else if (summonAim?.press?.id === e.pointerId) {
    let pr = summonAim.press, [dx, dy] = toLocal(e.clientX - pr.x, e.clientY - pr.y), m = Math.hypot(dx, dy);
    if (m > AIM_DEAD) pr.moved = true;
    if (!pr.moved) return;
    const R = sb.offsetWidth * 1.6; // 이만큼 끌면 최대 사거리
    pr.cancel = m <= AIM_DEAD;
    if (!pr.cancel) {
      let d = clamp(m / R, 0.15, 1) * SUMMON_RANGE;
      summonAim.x = p.x + dx / m * d;
      summonAim.y = p.y + dy / m * d;
    }
  }
};
sb.onpointerup = (e) => {
  if (summonAim?.press?.id === e.pointerId) {
    let pr = summonAim.press;
    summonAim.press = null;
    if (pr.moved && pr.cancel) summonAim = null; // 가운데로 되돌려 뗌: 취소
    else endSummonAim(true);
    return;
  }
  if (swipe?.id !== e.pointerId) return;
  let i = swipeChoice(e.clientX - swipe.x, e.clientY - swipe.y);
  closeSwipe();
  if (i < 0 || over) return;
  selected = i;
  if (pet?.id === deck[i]) return;
  startSummonAim();
};
sb.onpointercancel = sb.onlostpointercapture = (e) => {
  closeSwipe();
  if (summonAim?.press?.id === e.pointerId) summonAim.press = null;
};
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
// 조준 중 맵을 직접 탭/드래그해서 위치 지정
function clientToWorld(cx, cy) {
  let r = c.getBoundingClientRect(), lx, ly, lw, lh;
  if (document.body.classList.contains("rot")) {
    lx = cy - r.top; ly = r.right - cx; lw = r.height; lh = r.width;
  } else {
    lx = cx - r.left; ly = cy - r.top; lw = r.width; lh = r.height;
  }
  return { x: camX + lx * VW / lw, y: camY + ly * VH / lh };
}
function aimAtClient(e) {
  let w = clientToWorld(e.clientX, e.clientY), dx = w.x - p.x, dy = w.y - p.y, n = Math.hypot(dx, dy) || 1, k = Math.min(1, SUMMON_RANGE / n);
  summonAim.x = p.x + dx * k;
  summonAim.y = p.y + dy * k;
}
c.addEventListener("pointerdown", (e) => {
  if (!summonAim || summonAim.drag) return;
  e.preventDefault();
  c.setPointerCapture(e.pointerId);
  summonAim.drag = e.pointerId;
  aimAtClient(e);
});
c.addEventListener("pointermove", (e) => summonAim?.drag === e.pointerId && aimAtClient(e));
c.addEventListener("pointerup", (e) => {
  if (summonAim?.drag !== e.pointerId) return;
  aimAtClient(e);
  summonAim.drag = null;
  endSummonAim(true);
});
c.addEventListener("pointercancel", (e) => summonAim?.drag === e.pointerId && (summonAim.drag = null));
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
  if (swipe) for (let i = 0; i < 3; i++) {
    let id = deck[i], b = menu.children[i], live = pet?.id === id, locked = !live && (summonCD[id] > 0 || !!flight || !!pet && swapCD > 0);
    let html = `<strong>${mons[id][1]}</strong>${mons[id][0]}<span>${live ? "전투 중" : summonCD[id] > 0 ? Math.ceil(summonCD[id]) + "초" : flight ? "투척 중" : pet && swapCD > 0 ? Math.ceil(swapCD) + "초" : "준비"}</span>`;
    if (b._html !== html) {
      b._html = html;
      b.innerHTML = html;
    }
    let cls = "choice" + (swipe.choice === i ? " focus" : "") + (locked ? " lock" : "") + (live ? " live" : "");
    if (b.className !== cls) b.className = cls;
  }
  setText("dashBtn", p.dashCD > 0 ? "대시 " + p.dashCD.toFixed(1) : "대시");
  setText("bearHeal", extraNames[character] ? extraNames[character][1] + (p.s2 > 0 ? " " + p.s2.toFixed(1) : "") : character === "runner" ? p.tackleCD > 0 ? "태클 " + p.tackleCD.toFixed(1) : "태클" : p.healCD > 0 ? "회복 " + p.healCD.toFixed(1) : "회복");
  setText("summonBtn", extraNames[character] ? extraNames[character][0] + (p.s1 > 0 ? " " + p.s1.toFixed(1) : "") : character === "runner" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주 " + Math.floor(p.energy) + "%" : character === "bear" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주" : summonAim ? "던지기" : pet ? "교체 ↔" : flight ? "투척 중" : "소환 ↑");
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
document.querySelector("#bearHeal").onpointerdown = (e) => {
  e.preventDefault();
  characterSkill(2);
};
document.querySelector("#charApply").onclick = () => {
  character = document.querySelector("#character").value;
  ui.style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#petHUD").style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#bearHeal").style.display = character !== "summoner" ? "block" : "none";
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
