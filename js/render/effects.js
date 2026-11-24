// 이펙트 그리기: 몬스터볼, 피카츄, 번개

function ball(x, y, r, rot) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.fill();
  g.fillStyle = "#e94242";
  g.beginPath();
  g.arc(0, 0, r, Math.PI, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#30303a";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, r, 0, 7);
  g.moveTo(-r, 0);
  g.lineTo(r, 0);
  g.stroke();
  g.fillStyle = "white";
  g.beginPath();
  g.arc(0, 0, r * 0.28, 0, 7);
  g.fill();
  g.stroke();
  g.restore();
}
function drawPika(a) {
  let bob = a.moving ? Math.sin(a.frame * Math.PI / 2) * 3 : 0, side = Math.sin(a.dir * Math.PI / 4), back = a.dir === 0 || a.dir === 1 || a.dir === 7;
  g.save();
  g.translate(a.x, a.y);
  g.fillStyle = "#173a3860";
  g.beginPath();
  g.ellipse(0, 5, 21, 9, 0, 0, 7);
  g.fill();
  g.translate(0, bob - (a.pose > 0 ? 4 : 0));
  function oval(x, y, rx, ry, col, rot = 0) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, 7);
    g.fill();
  }
  // 성능: 그라디언트는 한 번만 만들어 재사용 (로컬 좌표 기준이라 결과 동일)
  let yellow = drawPika.yellow || (drawPika.yellow = (() => {
    let gr = g.createRadialGradient(-7, -32, 2, 0, -22, 30);
    gr.addColorStop(0, "#fff8a1");
    gr.addColorStop(0.55, "#ffda39");
    gr.addColorStop(1, "#ce8c16");
    return gr;
  })());
  g.save();
  g.scale(side < 0 ? -1 : 1, 1);
  g.fillStyle = "#e5a51e";
  g.strokeStyle = "#98631d";
  g.lineWidth = 1.5;
  g.beginPath();
  [[12, -9], [25, -23], [20, -28], [37, -47], [45, -37], [30, -22], [34, -17], [17, -4]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  oval(-9, 0, 8, 4, "#d79a20");
  oval(9, 0, 8, 4, "#d79a20");
  oval(0, -12, 15, 17, yellow);
  oval(-13, -13, 6, 9, yellow, -0.5);
  oval(13, -13, 6, 9, yellow, 0.5);
  oval(-12, -39, 6, 19, yellow, -0.42);
  oval(12, -39, 6, 19, yellow, 0.42);
  oval(-17, -51, 5, 7, "#38312d", -0.42);
  oval(17, -51, 5, 7, "#38312d", 0.42);
  oval(0, -28, 19, 17, yellow);
  if (!back) {
    let x = side * 5;
    oval(x - 8, -30, 3.4, 4.7, "#302a25");
    oval(x + 8, -30, 3.4, 4.7, "#302a25");
    oval(x - 9, -31, 1.2, 1.5, "white");
    oval(x + 7, -31, 1.2, 1.5, "white");
    oval(x - 13, -23, 5, 4, "#e94a37");
    oval(x + 13, -23, 5, 4, "#e94a37");
    oval(x, -24, 2, 1.5, "#47302a");
  } else {
    oval(0, -12, 10, 2, "#a76b21");
    oval(0, -7, 8, 2, "#a76b21");
  }
  g.restore();
}
function lightning(f) {
  g.save();
  g.globalAlpha = Math.min(1, f.t * 5);
  // 성능: 모바일(터치 모드)에서는 비싼 shadowBlur 대신 넓은 반투명 선으로 빛 번짐 표현
  const cheap = document.body.classList.contains("mobile");
  for (let pass = cheap ? -1 : 0; pass < 2; pass++) {
    g.strokeStyle = pass < 0 ? "#ffe12955" : pass ? "#fffbd1" : "#ffce24";
    g.lineWidth = pass < 0 ? (f.strong ? 22 : 14) : pass ? 2 : f.strong ? 10 : 5;
    if (!cheap) {
      g.shadowColor = "#ffe129";
      g.shadowBlur = 12;
    }
    g.beginPath();
    g.moveTo(f.sx, f.sy - 22);
    for (let i = 1; i < 8; i++) {
      let u = i / 8;
      g.lineTo(f.sx + (f.x - f.sx) * u + Math.sin(i * 13 + f.t * 30) * 9, f.sy - 22 + (f.y - f.sy) * u + Math.cos(i * 17) * 9);
    }
    g.lineTo(f.x, f.y - 22);
    g.stroke();
  }
  g.restore();
}
