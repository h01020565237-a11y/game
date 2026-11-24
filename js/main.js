// 시작과 메인 루프

reset();
function loop(t) {
  let dt = Math.min(0.035, (t - last) / 1e3 || 0);
  last = t;
  update(dt);
  draw();
  touchHUD();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
