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
function swipeChoice(dx, dy) {
  [dx, dy] = toLocal(dx, dy);
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  return Math.hypot(dx, dy) < 22 || Math.abs(angle) > 67.5 ? -1 : angle < -22.5 ? 0 : angle > 22.5 ? 2 : 1;
}
function closeSwipe() {
  swipe = null;
  menu.classList.remove("open");
}
sb.onpointerdown = (e) => {
  if (over || swipe) return;
  e.preventDefault();
  if (character !== "summoner") {
    characterSkill(1);
    return;
  }
  sb.setPointerCapture(e.pointerId);
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, choice: -1 };
  menu.classList.add("open");
  // 레이아웃 좌표(offset*) 사용: 화면이 회전돼 있어도 정확함
  let bw = sb.offsetWidth, x = sb.offsetLeft + bw / 2, y = sb.offsetTop + sb.offsetHeight / 2, d = bw * 0.98 + 8, aw = menu.offsetWidth, ah = menu.offsetHeight;
  [[x - d * 0.9, y - d * 0.9], [x, y - d * 1.45], [x + d * 0.9, y - d * 0.9]].forEach(([xx, yy], i) => {
    let el = menu.children[i], half = bw / 2;
    el.style.left = clamp(xx, half, aw - half) + "px";
    el.style.top = clamp(yy, half, ah - half) + "px";
  });
  menu.classList.add("open");
  touchHUD();
};
sb.onpointermove = (e) => {
  if (swipe?.id === e.pointerId) {
    swipe.choice = swipeChoice(e.clientX - swipe.x, e.clientY - swipe.y);
    touchHUD();
  }
};
sb.onpointerup = (e) => {
  if (swipe?.id !== e.pointerId) return;
  let i = swipeChoice(e.clientX - swipe.x, e.clientY - swipe.y);
  closeSwipe();
  if (i < 0 || over) return;
  selected = i;
  if (pet?.id === deck[i]) return;
  aimSummon();
  summon(!!pet);
};
sb.onpointercancel = sb.onlostpointercapture = () => closeSwipe();
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
  const r = weapons[p.w][3] * (p.w === 6 ? manualAim.mag : 1);
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
};
document.querySelector("#pickBtn").onpointerdown = (e) => {
  e.preventDefault();
  if (!over) pickup(p);
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
  setText("summonBtn", extraNames[character] ? extraNames[character][0] + (p.s1 > 0 ? " " + p.s1.toFixed(1) : "") : character === "runner" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주 " + Math.floor(p.energy) + "%" : character === "bear" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주" : pet ? "교체 ↔" : flight ? "투척 중" : "소환 ↑");
  let op = loot.some((l) => dist(p, l) < 48) ? "1" : "0.45", pick = el("pickBtn");
  if (pick._op !== op) {
    pick._op = op;
    pick.style.opacity = op;
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
  reset();
};
