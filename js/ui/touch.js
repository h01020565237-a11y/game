// 모바일 터치 조작

const touchMode = matchMedia("(pointer:coarse)").matches;
document.body.classList.toggle("mobile", touchMode);
let mvX = 0, mvY = 0, aimX = 0, aimY = 0, aiming = false;
const sb = document.querySelector("#summonBtn"), menu = document.querySelector("#summonMenu");
let swipe = null;
for (let i = 0; i < 3; i++) {
  let el = document.createElement("div");
  el.className = "choice";
  menu.append(el);
}
function swipeChoice(dx, dy) {
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
    bearSkill(1);
    return;
  }
  sb.setPointerCapture(e.pointerId);
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, choice: -1 };
  menu.classList.add("open");
  let r = sb.getBoundingClientRect(), a = menu.getBoundingClientRect(), x = r.left + r.width / 2 - a.left, y = r.top + r.height / 2 - a.top, d = r.width * 0.98 + 8;
  [[x - d * 0.9, y - d * 0.9], [x, y - d * 1.45], [x + d * 0.9, y - d * 0.9]].forEach(([xx, yy], i) => {
    let el = menu.children[i], half = r.width / 2;
    el.style.left = clamp(xx, half, a.width - half) + "px";
    el.style.top = clamp(yy, half, a.height - half) + "px";
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
  let x = aimX || mvX, y = aimY || mvY;
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
    let r = el.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2), n = Math.max(1, Math.hypot(x, y));
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
atkBtn.onpointerdown = (e) => {
  e.preventDefault();
  atkBtn.setPointerCapture(e.pointerId);
  aiming = true;
  autoAttack();
};
atkBtn.onpointerup = atkBtn.onpointercancel = atkBtn.onlostpointercapture = () => aiming = false;
document.querySelector("#dashBtn").onclick = () => {
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
document.querySelector("#pickBtn").onclick = () => {
  if (!over) pickup(p);
};
document.querySelector("#mobileToggle").onclick = () => {
  document.body.classList.toggle("mobile");
  mvX = mvY = 0;
  aiming = false;
};
window.addEventListener("blur", () => {
  mvX = mvY = 0;
  aiming = false;
  closeSwipe();
});
function touchHUD() {
  if (swipe) for (let i = 0; i < 3; i++) {
    let id = deck[i], b = menu.children[i], live = pet?.id === id, locked = !live && (summonCD[id] > 0 || !!flight || !!pet && swapCD > 0);
    b.innerHTML = `<strong>${mons[id][1]}</strong>${mons[id][0]}<span>${live ? "전투 중" : summonCD[id] > 0 ? Math.ceil(summonCD[id]) + "초" : flight ? "투척 중" : pet && swapCD > 0 ? Math.ceil(swapCD) + "초" : "준비"}</span>`;
    b.className = "choice" + (swipe.choice === i ? " focus" : "") + (locked ? " lock" : "") + (live ? " live" : "");
  }
  document.querySelector("#dashBtn").textContent = p.dashCD > 0 ? "대시 " + p.dashCD.toFixed(1) : "대시";
  document.querySelector("#bearHeal").textContent = extraNames[character] ? extraNames[character][1] + (p.s2 > 0 ? " " + p.s2.toFixed(1) : "") : character === "runner" ? p.tackleCD > 0 ? "태클 " + p.tackleCD.toFixed(1) : "태클" : p.healCD > 0 ? "회복 " + p.healCD.toFixed(1) : "회복";
  document.querySelector("#summonBtn").textContent = extraNames[character] ? extraNames[character][0] + (p.s1 > 0 ? " " + p.s1.toFixed(1) : "") : character === "runner" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주 " + Math.floor(p.energy) + "%" : character === "bear" ? p.runCD > 0 ? "질주 " + p.runCD.toFixed(1) : "질주" : pet ? "교체 ↔" : flight ? "투척 중" : "소환 ↑";
  document.querySelector("#pickBtn").style.opacity = loot.some((l) => dist(p, l) < 48) ? 1 : 0.45;
}
document.querySelector("#bearHeal").onclick = () => bearSkill(2);
document.querySelector("#charApply").onclick = () => {
  character = document.querySelector("#character").value;
  ui.style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#petHUD").style.display = character !== "summoner" ? "none" : "";
  document.querySelector("#bearHeal").style.display = character !== "summoner" ? "block" : "none";
  closeSwipe();
  reset();
};
