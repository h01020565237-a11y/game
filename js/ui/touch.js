// 모바일 터치 조작

// 조작 방식 자동: 주 입력이 터치(휴대폰·태블릿)면 터치 조작, 아니면 키보드·마우스. 전환 버튼 없음
// 마우스 기기인데 화면을 직접 터치하면(터치 노트북 등) 그때 터치 조작으로 바뀜
const touchMode = matchMedia("(pointer:coarse)").matches || (matchMedia("(hover:none)").matches && navigator.maxTouchPoints > 0);
document.body.classList.toggle("mobile", touchMode);
addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || document.body.classList.contains("mobile")) return;
  document.body.classList.add("mobile");
  if (typeof fitCanvas === "function") fitCanvas();
}, { capture: true });
let mvX = 0, mvY = 0, aiming = false;
const sb = document.querySelector("#summonBtn");
// 화면 회전 모드(세로로 든 폰에서 게임을 90도 돌려 가로로 표시)일 때
// 화면 좌표의 이동량을 게임 화면 기준으로 바꿈
function toLocal(dx, dy) {
  return document.body.classList.contains("rot") ? [dy, -dx] : [dx, dy];
}
// ----- 스킬 버튼 공통 조작 (Q·E·궁극기) -----
// 탭: 가장 가까운 적에게 자동 조준해서 발동
// 길게 누르기(0.5초): 설명창 + 예상 경로(자동 조준 방향). 그대로 떼면 발동하지 않음
// 누른 채 끌기: 설명 닫고 경로를 손가락 방향으로 조준, 떼면 그 방향·위치로 발동. 처음 자리로 되돌려 떼면 취소
let skillAim = null; // 미리보기 { slot, x, y } (렌더러가 그림)
// 스킬 버튼 공통 조작
// - 일반 조준 스킬: 탭 = 자동 조준 발동 / 길게 = 경로 표시 / 끌기 = 직접 조준 / 떼면 발동 / 가운데로 되돌려 떼면 취소
// - 이동형 스킬(move: true, 공통 대시 포함): 같은 조작, 단 방향은 끈 방향 > 이동 조이스틱 > 마지막 이동 방향 (자동 조준 없음)
//   길게 누르는 동안 미리보기는 조이스틱 방향을 실시간으로 따라감
// - 전투 중 터치로 길게 누르면 조준 표시가 설명창보다 우선 (조준 없는 스킬은 설명창)
function skillButton(btn, slot) {
  let press = null;
  const S = () => skillOf(slot);
  const aimable = () => S() && S().aim !== "none" && !(character === "summoner" && slot !== "r");
  SkillTip.attach(btn, (touch) => (touch && aimable() ? null : slot === "dash" ? dashTipModel() : skillTipModel(character, slot)));
  btn.onpointerdown = (e) => {
    e.preventDefault();
    if (over || press) return;
    btn.setPointerCapture(e.pointerId);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, aiming: false, cancel: false };
    const pr = press;
    pr.timer = setTimeout(() => {
      if (press !== pr || pr.aiming || !aimable()) return;
      skillAim = S().move ? { slot, live: true, ...moveAim(slot) } : { slot, ...clampAim(slot, autoAimPoint(slot)) };
    }, SKILL_HOLD * 1000);
  };
  btn.onpointermove = (e) => {
    if (press?.id !== e.pointerId) return;
    if (!aimable()) return;
    const sk = S();
    const [dx, dy] = toLocal(e.clientX - press.x, e.clientY - press.y), m = Math.hypot(dx, dy);
    if (m > AIM_DEAD) press.aiming = true;
    if (!press.aiming) return;
    press.cancel = m <= AIM_DEAD;
    if (press.cancel) {
      skillAim = null;
      return;
    }
    const len = sk.aim === "point" ? clamp(m / (btn.offsetWidth * 1.6), 0.15, 1) * sk.range : sk.range || 150;
    skillAim = { slot, x: p.x + dx / m * len, y: p.y + dy / m * len };
  };
  btn.onpointerup = (e) => {
    if (press?.id !== e.pointerId) return;
    clearTimeout(press.timer);
    const pr = press, aimAt = skillAim;
    press = null;
    skillAim = null;
    if (over) return;
    if (pr.aiming) {
      if (!pr.cancel && aimAt) castSkill(slot, aimAt);
      return;
    }
    if (SkillTip.used(btn)) return; // 설명만 보고 뗌 (조준 없는 스킬)
    castSkill(slot); // 탭 또는 길게 누른 뒤 뗌: 이동형은 조이스틱/마지막 이동 방향, 그 밖은 자동 조준
  };
  btn.onpointercancel = btn.onlostpointercapture = (e) => {
    if (press?.id !== e.pointerId) return;
    clearTimeout(press.timer);
    press = null;
    skillAim = null;
  };
}
// 길게 누르는 중(끌기 전) 이동형 스킬 미리보기: 매 프레임 조이스틱 방향을 따라감
function tickSkillAim() {
  if (skillAim?.live) Object.assign(skillAim, moveAim(skillAim.slot));
}
function dashTipModel() {
  return { title: DASH.name, desc: skillText(DASH), chips: skillChips(DASH) };
}
const SKILL_HOLD = 0.5;

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
  petPress = null;
  summonAim = null;
}
function tickSummonAim() {
  if (petPress && (character !== "summoner" || p.hp <= 0 || over)) closeSwipe();
}
petBtns.forEach((btn, i) => {
  SkillTip.attach(btn, () => petTipModel(i));
  btn.onpointerdown = (e) => {
    e.preventDefault();
    if (over || petPress || character !== "summoner") return;
    btn.setPointerCapture(e.pointerId);
    petPress = { id: e.pointerId, i, x: e.clientX, y: e.clientY, moved: false, cancel: false };
  };
  btn.onpointermove = (e) => {
    if (petPress?.id !== e.pointerId) return;
    const [dx, dy] = toLocal(e.clientX - petPress.x, e.clientY - petPress.y), m = Math.hypot(dx, dy);
    if (m > AIM_DEAD) petPress.moved = true; // 끌기 시작하면 설명창은 SkillTip 이 닫음
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
    closeSwipe();
    if (!pr.moved && SkillTip.used(btn)) return; // 설명만 보고 뗌: 소환하지 않음
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
skillButton(sb, "q");
skillButton(document.querySelector("#ultBtn"), "r");
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
  const foe = minBy(bots.filter((b) => b.hp > 0 && !(b.stealth > 0) && dist(p, b) <= SUMMON_RANGE + 60), (b) => dist(p, b));
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
// 조이스틱: 손가락 하나(pointerId)를 따라감
// 고착 방지 (2026-11-25 버그: 가끔 혼자 한쪽으로 고정되고 다시 눌러도 조작 불가)
//  - 새로 누르면 이전 손가락 상태가 남아 있어도 새 손가락으로 넘김 (예전엔 pid 가 남으면 영원히 무시)
//  - 손 뗌·취소 이벤트를 문서 전체에서도 받음 (버튼이 숨겨지거나 캡처를 잃어도)
//  - 화면의 모든 손가락이 떨어졌는데 조이스틱이 눌린 상태면 바로 놓음 (touchend 의 touches 확인)
//  - 앱 전환·화면 꺼짐·일시정지(메뉴·카드·결과) 때 놓음
const sticks = [];
function stick(id, fn) {
  let el = document.getElementById(id), pid = null;
  function set(e) {
    let r = el.getBoundingClientRect(), [x, y] = toLocal((e.clientX - r.left - r.width / 2) / (r.width / 2), (e.clientY - r.top - r.height / 2) / (r.height / 2)), n = Math.max(1, Math.hypot(x, y));
    x /= n;
    y /= n;
    el.querySelector("i").style.transform = `translate(${x * r.width * 0.3}px,${y * r.height * 0.3}px)`;
    fn(x, y, true);
  }
  function release() {
    if (pid !== null) {
      try {
        el.releasePointerCapture(pid);
      } catch (err) {}
    }
    pid = null;
    el.querySelector("i").style.transform = "";
    fn(0, 0, false);
  }
  el.onpointerdown = (e) => {
    e.preventDefault();
    if (pid !== null && pid !== e.pointerId) release(); // 남아 있던 손가락은 버리고 새 손가락으로
    pid = e.pointerId;
    try {
      el.setPointerCapture(pid);
    } catch (err) {}
    set(e);
  };
  el.onpointermove = (e) => {
    if (e.pointerId === pid) set(e);
  };
  function end(e) {
    if (e.pointerId !== pid) return;
    release();
  }
  el.onpointerup = end;
  el.onpointercancel = end;
  el.onlostpointercapture = end;
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
  // 남은 손가락 중 조이스틱 위(조금 넓게)에 있는 게 없으면 놓음
  const touchCheck = (e) => {
    if (pid === null) return;
    const r = el.getBoundingClientRect(), pad = Math.max(r.width, 60);
    for (const t of e.touches) if (t.clientX > r.left - pad && t.clientX < r.right + pad && t.clientY > r.top - pad && t.clientY < r.bottom + pad) return;
    release();
  };
  document.addEventListener("touchend", touchCheck, true);
  document.addEventListener("touchcancel", touchCheck, true);
  sticks.push({ el, release, held: () => pid !== null });
}
function releaseSticks() {
  for (const s of sticks) s.release();
  mvX = mvY = 0;
}
document.addEventListener("visibilitychange", () => document.hidden && releaseSticks());
addEventListener("pagehide", releaseSticks);
// ----- 이동: 플로팅 조이스틱 (2026-11-25) -----
// 왼쪽 이동 영역(#mvZone) 어디서든 누르면 그 자리가 조이스틱 중심. 360도, 끈 방향·거리(세기) 반영
// 손가락이 영역 밖으로 나가도 그 손가락(pointerId) 계속 추적. 떼거나 취소되면 정지·원래 자리로
// 멀티터치: 손가락마다 따로. 다른 손가락(공격·대시 등)을 떼도 이동 손가락은 유지 (touch identifier 로 확인)
const MV_STICK = { dead: 0.12, radius: 0.5 }; // dead: 이 안쪽은 정지, radius: 최대 세기가 되는 거리(조이스틱 지름 비율)
function floatStick(zone, st, fn) {
  const knob = st.querySelector("i"), arena = document.getElementById("arena");
  let pid = null, tid = null, cx = 0, cy = 0;
  const rot = () => document.body.classList.contains("rot");
  function local(clx, cly) { // 화면 좌표 → #touch 안 좌표 (세로 폰 회전 포함)
    const r = arena.getBoundingClientRect(), s = (rot() ? r.height : r.width) / (arena.offsetWidth || 1) || 1;
    return rot() ? [(cly - r.top) / s, (r.right - clx) / s] : [(clx - r.left) / s, (cly - r.top) / s];
  }
  function place(lx, ly) {
    st.style.left = `${lx - st.offsetWidth / 2}px`;
    st.style.top = `${ly - st.offsetHeight / 2}px`;
    st.style.bottom = "auto";
    st.classList.add("on");
  }
  function home() {
    st.style.left = st.style.top = st.style.bottom = "";
    st.classList.remove("on");
    knob.style.transform = "";
  }
  function set(e) {
    const size = (rot() ? st.getBoundingClientRect().height : st.getBoundingClientRect().width) || 80;
    let [dx, dy] = toLocal(e.clientX - cx, e.clientY - cy);
    let x = dx / (size * MV_STICK.radius), y = dy / (size * MV_STICK.radius);
    const n = Math.hypot(x, y);
    if (n > 1) {
      x /= n;
      y /= n;
    }
    knob.style.transform = `translate(${x * st.offsetWidth * 0.3}px,${y * st.offsetHeight * 0.3}px)`;
    if (n < MV_STICK.dead) fn(0, 0, true);
    else fn(x, y, true);
  }
  function release() {
    if (pid !== null) {
      try {
        zone.releasePointerCapture(pid);
      } catch (err) {}
    }
    pid = tid = null;
    home();
    fn(0, 0, false);
  }
  function down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    if (pid !== null && pid !== e.pointerId) release(); // 남아 있던 손가락 상태는 버리고 새 손가락으로
    pid = e.pointerId;
    cx = e.clientX;
    cy = e.clientY;
    const [lx, ly] = local(cx, cy);
    place(lx, ly);
    try {
      zone.setPointerCapture(pid);
    } catch (err) {}
    fn(0, 0, true);
  }
  zone.addEventListener("pointerdown", down);
  st.addEventListener("pointerdown", down);
  const mv = (e) => e.pointerId === pid && set(e);
  zone.addEventListener("pointermove", mv);
  st.addEventListener("pointermove", mv);
  const end = (e) => e.pointerId === pid && release();
  for (const t of [zone, st]) for (const ev of ["pointerup", "pointercancel"]) t.addEventListener(ev, end);
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
  const tstart = (e) => (tid = e.changedTouches[0]?.identifier ?? tid);
  zone.addEventListener("touchstart", tstart, { passive: true });
  st.addEventListener("touchstart", tstart, { passive: true });
  const tcheck = (e) => { // 이동 손가락(identifier)이 더 이상 화면에 없으면 놓음 (다른 손가락을 뗀 건 상관없음)
    if (pid === null || tid === null) return;
    for (const t of e.touches) if (t.identifier === tid) return;
    release();
  };
  document.addEventListener("touchend", tcheck, true);
  document.addEventListener("touchcancel", tcheck, true);
  sticks.push({ el: st, release, held: () => pid !== null });
}
floatStick(document.getElementById("mvZone"), document.getElementById("mv"), (x, y) => {
  mvX = x;
  mvY = y;
});
const atkBtn = document.querySelector("#atk");
function aimTarget() {
  const B = basicOf(p), lob = p.w === 6 || B?.kind === "lob"; // 곡사는 벽 너머도 조준
  let list = targets(p).filter((b) => dist(p, b) <= attackRange(p) && (lob || clearLine(p, b)));
  return list.filter((b) => b.max).sort((a, b) => dist(p, a) - dist(p, b))[0] || list.sort((a, b) => dist(p, a) - dist(p, b))[0];
}
function autoAttack() {
  let b = aimTarget();
  const r = attackRange(p);
  attack(p, b ? b.x : p.x + Math.sin(p.dir * Math.PI / 4) * r, b ? b.y : p.y - Math.cos(p.dir * Math.PI / 4) * r);
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
  const r = attackRange(p) * (basicOf(p)?.kind === "lob" ? manualAim.mag : 1); // 곡사는 끈 거리만큼
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
skillButton(document.querySelector("#dashBtn"), "dash"); // 공통 대시: 이동형 스킬 조작 공유
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
// 메뉴 버튼(일시정지)은 js/ui/lobby.js 한 곳에서만 처리 (예전엔 여기와 lobby.js 가 서로 덮어씀)
window.addEventListener("blur", () => {
  releaseSticks();
  releaseAttack(false);
  aiming = false;
  closeSwipe();
});
const ammoText = (a) => "●".repeat(a.ammo) + "○".repeat(Math.max(0, AMMO.max - a.ammo));
function touchHUD() {
  checkHoldAttack();
  tickSkillAim();
  // 공격 버튼: 장착 무기 아이콘(없으면 주먹) + 탄창. 무기가 바뀌면 바로 갱신
  const wKey = p.w + "|" + (basicOf(p)?.name || "");
  if (atkBtn._w !== wKey) {
    atkBtn._w = wKey;
    const art = WEAPON_ART[p.w];
    atkBtn.style.setProperty("--wicon", art ? `url("${weaponIcons[p.w].src}")` : "none");
    atkBtn.classList.toggle("fist", !art);
    atkBtn.dataset.w = basicOf(p)?.name || weapons[p.w][0];
  }
  setText("atkAmmo", ammoText(p));
  setText("grenCount", String(p.grenades || 0));
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
    const html = `${petIconHTML(id)}<span class="pn">${mons[id][0]}</span><span class="ps">${status}</span>`;
    if (btn._html !== html) {
      btn._html = html;
      btn.innerHTML = html;
    }
    const cls = "petBtn" + (live ? " live" : "") + (wait !== 0 ? " lock" : "") + (petPress?.i === i ? " press" : "");
    if (btn.className !== cls) btn.className = cls;
  }
  setText("dashBtn", p.dashCD > 0 ? "대시 " + p.dashCD.toFixed(1) : "대시");
  // 스킬 버튼 글자: 스킬 이름 + 남은 쿨타임 (이름은 SKILL_DATA)
  const D = SKILL_DATA[character];
  if (D && character !== "summoner") {
    const lab = (slot) => D[slot].name + (p.skcd[slot] > 0 ? "\n" + p.skcd[slot].toFixed(1) : character === "runner" && slot === "q" ? "\n" + Math.floor(p.energy) + "%" : "");
    setText("summonBtn", lab("q"));
    setText("bearHeal", lab("e"));
  }
  // 궁극기 버튼: 충전 링 + 완충 강조
  const ub = document.querySelector("#ultBtn"), pct = Math.floor((p.ult || 0) * 100), ready = ultReady();
  if (ub._pct !== pct) {
    ub._pct = pct;
    ub.style.setProperty("--ult", pct + "%");
  }
  setText("ultLabel", p.ultT > 0 ? "발동 중" : ready ? D.r.name : pct + "%");
  if (ub._ready !== ready) {
    ub._ready = ready;
    ub.classList.toggle("ready", ready);
  }
  // 무기 교체 버튼: 바꿀 수 있는 무기 위에 있을 때만 (금빛 팝 등장 / 페이드 사라짐). 자리는 고정이라 다른 버튼이 안 흔들림
  let swapL = nearLoot(p, isSwapLoot), pick = el("pickBtn");
  const sKey = swapL ? swapL.type + ":" + swapL.id : "";
  if (pick._k !== sKey) {
    pick._k = sKey;
    if (swapL) {
      const ic = swapL.type === LOOT.weapon ? weaponIcons[swapL.id] : null;
      pick.style.setProperty("--wicon", ic ? `url("${ic.src}")` : "none");
      setText("pickName", lootName(swapL));
    }
    pick.classList.toggle("show", !!swapL);
    pick.setAttribute("aria-hidden", String(!swapL));
  }
}
// #bearHeal: 이름과 달리 비소환사 캐릭터 공통 스킬2 버튼
skillButton(document.querySelector("#bearHeal"), "e");
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
const allowNative = (t) => t && t.closest && t.closest("select, option, input, textarea, #menuPanel");
const inGameArea = (t) => t && t.closest && t.closest("#arena, #touch");
for (const ev of ["contextmenu", "selectstart", "dragstart"]) {
  document.addEventListener(ev, (e) => {
    if ((document.body.classList.contains("mobile") || inGameArea(e.target)) && !allowNative(e.target)) e.preventDefault();
  });
}
// iOS Safari: 핀치 확대 제스처 (viewport 설정을 무시하므로 직접 막음)
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
// 두 번 탭 확대 (iOS 일부 버전은 touch-action 만으로 안 막힘)
document.addEventListener("dblclick", (e) => {
  if (inGameArea(e.target) && !allowNative(e.target)) e.preventDefault();
}, { passive: false });
// 조작 버튼·조이스틱·캔버스: 터치 기본 동작(길게 누르기 메뉴·돋보기·스크롤·확대) 막기. 포인터 이벤트(조작)는 그대로 옴
const isControl = (t) => t && t.closest && t.closest("#touch button, #touch .stick, #arena canvas");
for (const ev of ["touchstart", "touchmove"]) {
  document.addEventListener(ev, (e) => {
    if (isControl(e.target) && e.cancelable) e.preventDefault();
    else if (ev === "touchmove" && e.touches.length > 1 && e.cancelable) e.preventDefault(); // 두 손가락 확대
  }, { passive: false });
}

// 수류탄 버튼 (소모품, 최대 3개)
// - 탭: 가장 가까운 적에게 자동 조준 투척 (적이 없으면 바라보는 방향 최대 거리)
// - 끌기: 방향과 거리를 직접 조준 (화면에 낙하 지점과 폭발 범위 표시), 손을 떼면 투척, 가운데로 되돌리면 취소
const grenBtn = document.querySelector("#grenBtn");
grenBtn.style.setProperty("--gicon", weaponIcons[GRENADE.weaponId] ? `url("${weaponIcons[GRENADE.weaponId].src}")` : "none"); // 수류탄 아이콘 (사용해도 장착 무기는 그대로)
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
