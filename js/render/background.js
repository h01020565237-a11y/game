// 정글 이미지가 없을 때 쓰는 대체 배경

const ground = document.createElement("canvas");
ground.width = W;
ground.height = H;
const gg = ground.getContext("2d");
function buildGround() {
  let grad = gg.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#a7c779");
  grad.addColorStop(1, "#82aa65");
  gg.fillStyle = grad;
  gg.fillRect(0, 0, W, H);
  gg.fillStyle = "#d8c59a";
  gg.beginPath();
  gg.ellipse(W / 2, H / 2, 440, 360, 0, 0, 7);
  gg.fill();
  for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) if (wet(x + 3, y + 3)) {
    gg.fillStyle = "#65b5c3";
    gg.fillRect(x, y, 6, 6);
  }
  for (let i = 0; i < 900; i++) {
    let x = i * 137.53 % W, y = i * 83.71 % H;
    if (wet(x, y)) {
      gg.fillStyle = "#b6e3df55";
      gg.fillRect(x, y, 12, 2);
    } else {
      gg.fillStyle = "#527c4430";
      gg.beginPath();
      gg.ellipse(x, y, 4, 2, 0, 0, 7);
      gg.fill();
    }
  }
}
function scenery() {
  g.drawImage(ground, 0, 0);
  for (let [x, y, w, h] of bushes) {
    g.fillStyle = "#416c45";
    g.beginPath();
    g.roundRect(x, y, w, h, 15);
    g.fill();
    for (let j = 0; j < h; j += 19) for (let i = 0; i < w; i += 19) {
      let a = x + i + 9, b = y + j + 9;
      let q = g.createRadialGradient(a - 4, b - 5, 1, a, b, 13);
      q.addColorStop(0, "#9bc46a");
      q.addColorStop(1, "#477a48");
      g.fillStyle = q;
      g.beginPath();
      g.ellipse(a, b, 12, 11, -0.3, 0, 7);
      g.fill();
    }
  }
  for (let [x, y, w, h] of walls) {
    g.fillStyle = "#35483b44";
    g.fillRect(x + 5, y + 8, w, h);
    g.fillStyle = "#777d76";
    g.beginPath();
    g.roundRect(x, y, w, h, 7);
    g.fill();
    for (let i = 0; i < w; i += 35) {
      let z = Math.min(35, w - i);
      g.fillStyle = "#b6b9ad";
      g.beginPath();
      g.roundRect(x + i + 1, y + 1, z - 2, Math.max(5, h - 12), 5);
      g.fill();
      g.fillStyle = "#d5d7ca";
      g.fillRect(x + i + 5, y + 4, Math.max(0, z - 10), 4);
    }
  }
}
