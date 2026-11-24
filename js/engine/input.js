// 키보드·마우스 입력

onkeydown = (e) => {
  if (["SELECT", "BUTTON"].includes(document.activeElement?.tagName)) document.activeElement.blur();
  keys[e.code] = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat && !over && p.dashCD <= 0 && !(p.tackle > 0)) {
      let x = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), y = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
      if (!x && !y) {
        x = Math.sin(p.dir * Math.PI / 4);
        y = -Math.cos(p.dir * Math.PI / 4);
      }
      p.dx = x;
      p.dy = y;
      p.dash = 0.1;
      p.dashCD = 3;
    }
  }
  if (!over && !e.repeat) {
    if (e.code === "KeyQ") character !== "summoner" ? bearSkill(1) : summon();
    if (e.code === "KeyE") character !== "summoner" ? bearSkill(2) : summon(true);
    if (/^Digit[123]$/.test(e.code)) selected = +e.code.slice(-1) - 1;
  }
  if (e.code === "KeyR") reset();
  if (e.code === "KeyF" && !over) pickup(p);
  if (e.code.startsWith("Arrow")) e.preventDefault();
};
onkeyup = (e) => keys[e.code] = false;
onblur = () => {
  for (const k in keys) keys[k] = false;
  mouse.down = false;
};
c.onmousemove = (e) => {
  let r = c.getBoundingClientRect();
  mouse.x = camX + (e.clientX - r.left) * VW / r.width;
  mouse.y = camY + (e.clientY - r.top) * VH / r.height;
};
c.onmousedown = (e) => {
  if (e.button === 0) mouse.down = true;
};
onmouseup = () => mouse.down = false;
