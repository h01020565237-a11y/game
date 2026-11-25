// 키보드·마우스 입력

onkeydown = (e) => {
  if (["SELECT", "BUTTON"].includes(document.activeElement?.tagName)) document.activeElement.blur();
  keys[e.code] = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) castDash(); // 이동 키 방향 → 마지막 이동 방향
  }
  if (!over && !e.repeat) {
    // PC: 스킬은 마우스 위치로 조준 (현곤 Q·E 는 소환·교체 그대로)
    if (e.code === "KeyQ") castSkill("q", { x: mouse.x, y: mouse.y });
    if (e.code === "KeyE") castSkill("e", { x: mouse.x, y: mouse.y });
    if (e.code === "KeyX") castSkill("r", { x: mouse.x, y: mouse.y });
    if (/^Digit[123]$/.test(e.code)) selected = +e.code.slice(-1) - 1;
  }
  if (e.code === "KeyG" && !over && !e.repeat) throwGrenade(p, mouse.x, mouse.y);
  if (e.code === "Escape") openLobby();
  if (e.code === "KeyR") reset();
  if (e.code === "KeyF" && !over) pickup(p, isSwapLoot);
  if (e.code.startsWith("Arrow")) e.preventDefault();
};
onkeyup = (e) => keys[e.code] = false;
onblur = () => {
  for (const k in keys) keys[k] = false;
  mouse.down = false;
};
// 버그 수정(3.1): 마우스는 화면 좌표(sx, sy)로 저장하고, 월드 좌표는 매 프레임
// 현재 카메라 기준으로 다시 계산한다 (updateMouseWorld). 예전에는 카메라가 움직이면
// 커서와 공격 방향이 어긋났음.
c.onmousemove = (e) => {
  let r = c.getBoundingClientRect();
  mouse.sx = (e.clientX - r.left) * VW / r.width;
  mouse.sy = (e.clientY - r.top) * VH / r.height;
  updateMouseWorld();
};
function updateMouseWorld() {
  if (mouse.sx === undefined) return;
  mouse.x = camX + mouse.sx;
  mouse.y = camY + mouse.sy;
}
c.onmousedown = (e) => {
  // 터치 모드에서는 캔버스 탭이 호환 마우스 이벤트로 공격을 일으키지 않게 무시
  if (document.body.classList.contains("mobile")) return;
  if (e.button === 0) mouse.down = true;
  if (e.button === 2 && !over) throwGrenade(p, mouse.x, mouse.y); // 오른쪽 클릭: 수류탄
};
onmouseup = () => mouse.down = false;
c.oncontextmenu = (e) => e.preventDefault();
