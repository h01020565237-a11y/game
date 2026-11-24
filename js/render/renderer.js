// 화면 그리기와 HUD

// 성능: DOM 요소는 한 번만 찾고, 글자가 바뀔 때만 다시 씀 (매 프레임 레이아웃 방지)
const domCache = {};
function el(id) {
  return domCache[id] || (domCache[id] = document.getElementById(id));
}
function setText(id, s) {
  const e = el(id);
  if (e._text !== s) {
    e._text = s;
    e.textContent = s;
  }
}

function renderActor(a, k) {
  let im = sheets[k];
  if (im && im.naturalWidth) {
    g.drawImage(im, (a.moving ? Math.floor(a.frame || 0) % 8 : 0) * 96, (a.dir || 0) * 96, 96, 96, a.x - 34, a.y - 56, 68, 68);
    return true;
  }
  if (k === "bear" && bearImg.naturalWidth) {
    g.drawImage(bearImg, (a.dir || 0) * 80, 0, 80, 80, a.x - 34, a.y - 56, 68, 68);
    return true;
  }
  return false;
}
function bar(x, y, hp, max) {
  g.fillStyle = "#26332b";
  g.fillRect(x - 23, y, 46, 6);
  g.fillStyle = "#7de36c";
  g.fillRect(x - 23, y, 46 * clamp(hp / max, 0, 1), 6);
}
// 탄창 표시: HP 바 아래 3칸, 충전 중인 칸은 차오르는 정도만큼 표시
function ammoBar(x, y, a) {
  const n = AMMO.max, gap = 2, w = (46 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const bx = x - 23 + i * (w + gap);
    g.fillStyle = "#26332b";
    g.fillRect(bx, y, w, 4);
    const f = i < a.ammo ? 1 : i === a.ammo ? clamp(a.reload / reloadTime(a), 0, 1) : 0;
    if (f > 0) {
      g.fillStyle = f === 1 ? "#ffd35b" : "#ffd35b88";
      g.fillRect(bx, y, w * f, 4);
    }
  }
}
function coneDraw(x, y, ang, r, half, alpha = 0.22) {
  g.save();
  g.fillStyle = `rgba(255,240,170,${alpha})`;
  g.strokeStyle = "#fff0aa99";
  g.beginPath();
  g.moveTo(x, y);
  g.arc(x, y, r, ang - half, ang + half);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
function draw() {
  camX = clamp(p.x - VW / 2, 0, W - VW);
  camY = clamp(p.y - VH / 2, 0, H - VH);
  g.save();
  g.translate(-camX, -camY);
  // 성능: 맵 전체(2472×1392) 대신 카메라에 보이는 영역만 그림
  g.fillStyle = "#789b65";
  g.fillRect(camX, camY, VW, VH);
  if (jungle.naturalWidth) {
    const sx = jungle.naturalWidth / W, sy = jungle.naturalHeight / H;
    g.drawImage(jungle, camX * sx, camY * sy, VW * sx, VH * sy, camX, camY, VW, VH);
  } else scenery();
  if (manualAim && !manualAim.cancel) {
    // 직접 조준 미리보기
    const ang = Math.atan2(manualAim.y, manualAim.x), r = weapons[p.w][3];
    if (p.w === 6) {
      const d = r * manualAim.mag, tx = clamp(p.x + manualAim.x * d, 0, W), ty = clamp(p.y + manualAim.y * d, 0, H);
      g.save();
      g.strokeStyle = "#fff0aa";
      g.fillStyle = "rgba(255,240,170,0.18)";
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(tx, ty);
      g.stroke();
      g.beginPath();
      g.arc(tx, ty, 90, 0, 7);
      g.fill();
      g.stroke();
      g.restore();
    } else coneDraw(p.x, p.y, ang, r, Math.max(angles[p.w], 6) * Math.PI / 360, 0.3);
  } else if (aiming && p.w !== 6) {
    let b = aimTarget();
    let ang = b ? Math.atan2(b.y - p.y, b.x - p.x) : p.dir * Math.PI / 4 - Math.PI / 2;
    coneDraw(p.x, p.y, ang, weapons[p.w][3], angles[p.w] * Math.PI / 360);
  }
  for (let f of fx) {
    if (f.cone) coneDraw(f.x, f.y, f.ang, f.r, f.half, f.t);
    if (f.explosion) {
      g.save();
      let u = 1 - f.t / 0.45;
      g.fillStyle = `rgba(255,160,40,${1 - u})`;
      g.beginPath();
      g.arc(f.x, f.y, 90 * Math.min(1, u * 4), 0, 7);
      g.fill();
      for (let i = 0; i < 12; i++) {
        let a = i * Math.PI / 6;
        g.fillStyle = `rgba(80,65,48,${1 - u})`;
        g.beginPath();
        g.arc(f.x + Math.cos(a) * u * 95, f.y + Math.sin(a) * u * 95, 5 + u * 8, 0, 7);
        g.fill();
      }
      g.restore();
    }
  }
  for (let b of boxes) {
    g.save();
    g.globalAlpha = 1;
    g.fillStyle = "#30281955";
    g.beginPath();
    g.ellipse(b.x, b.y + 12, 30, 12, 0, 0, 7);
    g.fill();
    if (crateArt.naturalWidth) g.drawImage(crateArt, b.x - 32, b.y - 39, 64, 64);
    else {
      g.fillStyle = "#b87b36";
      g.fillRect(b.x - 20, b.y - 20, 40, 40);
    }
    if (b.flash > elapsed) {
      g.fillStyle = "#ffffff55";
      g.fillRect(b.x - 24, b.y - 28, 48, 48);
    }
    g.restore();
    bar(b.x, b.y - 45, b.hp, 1e3);
  }
  for (let l of loot) {
    g.fillStyle = l.type ? "#b8e9ff" : "#ffe07c";
    g.fillRect(l.x - 7, l.y - 7, 14, 14);
    g.fillStyle = "#fff";
    g.font = "12px sans-serif";
    g.textAlign = "center";
    g.fillText(l.type ? gear[l.id] : weapons[l.id][0], l.x, l.y - 12);
  }
  for (let f of fx.filter((f2) => f2.trail)) {
    if (character === "runner" && runnerImg.naturalWidth) {
      g.save();
      g.globalAlpha = f.t / 0.18 * 0.35;
      g.drawImage(runnerImg, f.dir * 80, 0, 80, 80, f.x - 34, f.y - 54, 68, 68);
      g.restore();
    } else if (character === "bear" && bearImg.complete && bearImg.naturalWidth) {
      g.save();
      g.globalAlpha = f.t / 0.18 * 0.35;
      g.drawImage(bearImg, f.dir * 80, 0, 80, 80, f.x - 34, f.y - 54, 68, 68);
      g.restore();
    } else if (sheets[character] && sheets[character].naturalWidth) {
      // 버그 수정(3.2): 예전에는 모든 캐릭터가 소환사 잔상으로 나왔음 → 자기 시트 사용
      g.save();
      g.globalAlpha = f.t / 0.18 * 0.35;
      g.drawImage(sheets[character], (f.frame % 8) * 96, f.dir * 96, 96, 96, f.x - 34, f.y - 56, 68, 68);
      g.restore();
    }
  }
  for (let a of [p, ...bots].filter((a2) => a2.hp > 0 && (a2 === p || visible(p, a2))).sort((a2, b) => a2.y - b.y)) {
    g.fillStyle = a === p ? "#337ddc" : "#b84949";
    g.beginPath();
    g.ellipse(a.x, a.y + 8, 20, 10, 0, 0, 7);
    g.fill();
    g.save();
    if (a === p && (p.stealth > 0 || inBush(p))) g.globalAlpha = 0.5;
    renderActor(a, a === p ? character : a.visual);
    g.restore();
    if (a === p && character === "runner") {
      g.fillStyle = "#ffd35b";
      g.fillRect(a.x - 23, a.y - 63, 46 * a.energy / 100, 5);
    }
    if (a === p && character === "bear" && a.heal > 0) {
      g.font = "22px sans-serif";
      g.fillText("🍯", a.x + 24, a.y - 20);
    }
    bar(a.x, a.y - 54, a.hp, a.max);
    if (a === p) ammoBar(a.x, a.y - 47, a);
    g.fillStyle = "white";
    g.font = "12px sans-serif";
    g.textAlign = "center";
    g.fillText(weapons[a.w][0], a.x, a.y + 28);
  }
  if (pet) {
    if (pet.id === 0) drawPika(pet);
    else {
      g.fillStyle = "#285c9c";
      g.beginPath();
      g.arc(pet.x, pet.y, 18, 0, 7);
      g.fill();
      g.font = "24px sans-serif";
      g.textAlign = "center";
      g.fillText(mons[pet.id][1], pet.x, pet.y + 8);
    }
    bar(pet.x, pet.y - 61, pet.hp, pet.max);
    g.fillStyle = "white";
    g.font = "12px sans-serif";
    g.fillText(mons[pet.id][0], pet.x, pet.y + 30);
  }
  setText("petHUD", `선택: ${mons[deck[selected]][0]} | Q ${summonCD[deck[selected]].toFixed(1)}초 | E ${swapCD.toFixed(1)}초 | 자동 기술 ${skillCD.toFixed(1)}초 | 덱 CD ${deck.map((id, i) => `${i + 1}:${summonCD[id].toFixed(1)}`).join(" / ")} | ${pet ? "소환 유지 " + pet.life.toFixed(1) + "초" : "미소환"}`);
  for (let s of shots) {
    if (s.octo) {
      let u = clamp(1 - s.t / 0.55, 0, 1);
      g.fillStyle = "#38244d88";
      g.beginPath();
      g.ellipse(s.x, s.y, 12, 6, 0, 0, 7);
      g.fill();
      g.fillStyle = s.octo === 1 ? "#502c70" : "#d25b7c";
      g.beginPath();
      g.arc(s.x, s.y - (s.armed ? 0 : 65 * Math.sin(Math.PI * u)), s.armed ? 17 : 12, 0, 7);
      g.fill();
      continue;
    }
    if (s.gren) {
      let u = clamp(1 - s.t / 0.8, 0, 1);
      g.save();
      g.fillStyle = "#ff373733";
      g.strokeStyle = "#ff5151";
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.beginPath();
      g.arc(s.tx, s.ty, 90, 0, 7);
      g.fill();
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#26332366";
      g.beginPath();
      g.ellipse(s.x, s.y, 8, 4, 0, 0, 7);
      g.fill();
      g.fillStyle = "#405632";
      g.strokeStyle = "#e1d3a0";
      g.beginPath();
      g.arc(s.x, s.y - 70 * Math.sin(Math.PI * u), 8, 0, 7);
      g.fill();
      g.stroke();
      g.restore();
      continue;
    }
    g.fillStyle = "#fff2a3";
    g.beginPath();
    g.arc(s.x, s.y, s.gren ? 7 : 4, 0, 7);
    g.fill();
  }
  if (flight) {
    let u = clamp(flight.t / 0.42, 0, 1), x = flight.x + (flight.tx - flight.x) * u, y = flight.y + (flight.ty - flight.y) * u;
    ball(x, y - 55 * Math.sin(Math.PI * u), 9, u * 12);
    g.strokeStyle = "#ffffff99";
    g.beginPath();
    g.ellipse(flight.tx, flight.ty, 20, 10, 0, 0, 7);
    g.stroke();
  }
  // 수정(3.8): 데미지 숫자 글꼴이 직전 그리기 상태에 따라 달라지던 문제 → 고정
  g.font = "12px sans-serif";
  g.textAlign = "center";
  for (let f of fx) {
    if (f.trail) continue;
    if (f.inkBurst) {
      g.save();
      g.globalAlpha = f.t / 0.7;
      g.fillStyle = "#40224f";
      g.beginPath();
      g.arc(f.x, f.y, 85 * (1 - f.t / 0.9), 0, 7);
      g.fill();
      g.restore();
      continue;
    }
    if (f.crateBurst) {
      g.save();
      g.globalAlpha = f.t / 0.45;
      for (let i = 0; i < 9; i++) {
        let a = i * 2.4, r = (1 - f.t / 0.45) * 48;
        g.fillStyle = i % 2 ? "#e5b45e" : "#9b572a";
        g.fillRect(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r - 12, 9, 5);
      }
      g.restore();
      continue;
    }
    if (f.bolt) {
      lightning(f);
      continue;
    }
    if (f.burst || f.recall) {
      g.save();
      g.globalAlpha = f.t / 0.55;
      g.fillStyle = "#fff6a0";
      g.beginPath();
      g.arc(f.x, f.y - 15, 10 + 35 * (1 - f.t / 0.55), 0, 7);
      g.fill();
      g.restore();
      if (f.recall) ball(f.x, f.y - 12, 8, 0);
      continue;
    }
    g.strokeStyle = "#ffdd88";
    g.fillStyle = "#fff";
    if (f.ring) {
      g.beginPath();
      g.arc(f.x, f.y, f.ring, 0, 7);
      g.stroke();
    } else g.fillText(f.text, f.x, f.y - 30 - (0.65 - f.t) * 25);
  }
  g.fillStyle = "#a72d4944";
  g.beginPath();
  g.rect(camX, camY, VW, VH); // 성능: 맵 전체 대신 화면 영역 기준
  g.arc(W / 2, H / 2, zone, 0, Math.PI * 2, true);
  g.fill("evenodd");
  g.strokeStyle = "#ff758d";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(W / 2, H / 2, zone, 0, 7);
  g.stroke();
  g.restore();
  g.fillStyle = "#172b24cc";
  g.fillRect(VW - 150, 8, 142, 40);
  g.fillStyle = "white";
  g.font = "13px sans-serif";
  g.textAlign = "center";
  g.fillText("자기장 " + (elapsed < 25 ? Math.ceil(25 - elapsed) + "초 후" : "축소 중"), VW - 79, 32);
  if (over) {
    g.fillStyle = "#0009";
    g.fillRect(0, 0, VW, VH);
    g.fillStyle = "white";
    g.font = "36px sans-serif";
    g.textAlign = "center";
    g.fillText(over, VW / 2, VH / 2);
  }
  setText("hud", `HP ${Math.max(0, Math.round(p.hp))}/${p.max} | 무기 ${weapons[p.w][0]} ${"●".repeat(p.ammo)}${"○".repeat(Math.max(0, AMMO.max - p.ammo))} | 장비 ${p.gear.map((i) => gear[i]).join(", ") || "없음"} | 생존 ${bots.filter((a) => a.hp > 0).length + (p.hp > 0 ? 1 : 0)} | 대시 ${p.dashCD > 0 ? p.dashCD.toFixed(1) + "초" : "준비 완료"} | 무적 ${god ? "ON" : "OFF"} | AI ${freeze ? "정지" : "활성"}`);
  setText("msg", extraNames[character] ? `${extraNames[character][0]} ${p.s1.toFixed(1)}초 | ${extraNames[character][1]} ${p.s2.toFixed(1)}초` : character === "runner" ? `질주 게이지 ${Math.floor(p.energy)}% | 전력 질주 ${p.runCD.toFixed(1)} | 태클 ${p.tackleCD.toFixed(1)}` : character === "bear" ? `방어 ${8 * Math.min(3, bots.filter((a) => a.hp > 0 && dist(a, p) < 120).length)}% | 질주 ${p.runCD.toFixed(1)} | 회복 ${p.healCD.toFixed(1)}` : nt > 0 ? notice : document.body.classList.contains("mobile") ? "소환 버튼을 좌상 / 위 / 우상으로 드래그 후 놓기" : "Q 소환 · E 교체 · 1~3 선택");
}
