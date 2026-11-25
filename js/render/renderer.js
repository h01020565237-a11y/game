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
  // 곰 Q 질주 전용 시트 (설정에서 켰을 때만)
  if (k === "bear" && a === p && p.run > 0 && CHARACTER_ART.bearSprint && bearSprintImg.naturalWidth) {
    g.drawImage(bearSprintImg, Math.floor(a.frame || 0) % 8 * 96, (a.dir || 0) * 96, 96, 96, a.x - 34, a.y - 56, 68, 68);
    return true;
  }
  let im = k === "bear" && !CHARACTER_ART.bearSheet ? null : sheets[k];
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
// 체력 회복 아이템 (개별 그림이 없어 캔버스로 그림. 그림이 오면 교체)
function drawMedkit(x, y) {
  if (healArt.naturalWidth) {
    g.fillStyle = "#1a24164d";
    g.beginPath();
    g.ellipse(x, y + 10, 13, 5, 0, 0, 7);
    g.fill();
    g.drawImage(healArt, x - 16, y - 24, 32, 32);
    return;
  }
  g.fillStyle = "#1a24164d";
  g.beginPath();
  g.ellipse(x, y + 10, 13, 5, 0, 0, 7);
  g.fill();
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#2b6b3a";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(x - 13, y - 20, 26, 24, 6);
  g.fill();
  g.stroke();
  g.fillStyle = "#3fcf5a";
  g.fillRect(x - 3.5, y - 16, 7, 16);
  g.fillRect(x - 9, y - 11.5, 18, 7);
}
// 상자 그림(96×90, 받침 중심 48,84)을 받침이 (x, y+22) 에 오도록 0.8배로 그림
function drawChest(im, x, y, alpha = 1) {
  if (alpha < 1) {
    g.save();
    g.globalAlpha = alpha;
  }
  g.drawImage(im, x - 38.4, y - 45.2, 76.8, 72);
  if (alpha < 1) g.restore();
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
  const [shx, shy] = shakeOffset();
  g.translate(-camX + shx, -camY + shy);
  // 성능: 맵 전체(2472×1392) 대신 카메라에 보이는 영역만 그림
  g.fillStyle = "#789b65";
  g.fillRect(camX, camY, VW, VH);
  const mapImg = mapImage();
  if (mapImg.naturalWidth) {
    const sx = mapImg.naturalWidth / W, sy = mapImg.naturalHeight / H;
    g.drawImage(mapImg, camX * sx, camY * sy, VW * sx, VH * sy, camX, camY, VW, VH);
  } else if (activeMap === MAP_JUNGLE) scenery();
  else { // 웨이브 맵 그림을 아직 못 불러옴: 벽만 단순하게 (충돌과 같은 위치)
    g.fillStyle = "#5b6470";
    for (const [x, y, w, h] of walls) g.fillRect(x, y, w, h);
  }
  if (summonAim && p.hp > 0) drawSummonAim();
  drawUltGround();
  drawSkillPreview();
  if (grenAim && !grenAim.cancel) {
    // 수류탄 조준 미리보기: 던질 지점과 폭발 범위
    const d = weapons[GRENADE.weaponId][3] * grenAim.mag, tx = clamp(p.x + grenAim.x * d, 0, W), ty = clamp(p.y + grenAim.y * d, 0, H);
    g.save();
    g.strokeStyle = "#ffe07c";
    g.fillStyle = "rgba(255,90,60,0.18)";
    g.lineWidth = 2;
    g.setLineDash([6, 4]);
    g.beginPath();
    g.moveTo(p.x, p.y - 20);
    g.quadraticCurveTo((p.x + tx) / 2, Math.min(p.y, ty) - 70, tx, ty);
    g.stroke();
    g.beginPath();
    g.arc(tx, ty, GRENADE.radius, 0, 7);
    g.fill();
    g.stroke();
    g.restore();
  } else if (manualAim && !manualAim.cancel) {
    // 주무기 직접 조준 미리보기
    const ang = Math.atan2(manualAim.y, manualAim.x), r = attackRange(p), B = basicOf(p);
    if (B) drawBasicAim(B, ang, B.kind === "lob" ? r * manualAim.mag : r);
    else coneDraw(p.x, p.y, ang, r, Math.max(angles[p.w], 6) * Math.PI / 360, 0.3);
  } else if (aiming && p.w !== 6) {
    let b = aimTarget();
    let ang = b ? Math.atan2(b.y - p.y, b.x - p.x) : p.dir * Math.PI / 4 - Math.PI / 2;
    const B = basicOf(p);
    if (B) drawBasicAim(B, ang, B.kind === "lob" && b ? Math.min(dist(p, b), B.range) : B.range);
    else coneDraw(p.x, p.y, ang, weapons[p.w][3], angles[p.w] * Math.PI / 360);
  }
  for (let f of fx) {
    if (f.debris && f.t < 1.55 && chestArt.debris.naturalWidth) drawChest(chestArt.debris, f.x, f.y, Math.min(1, f.t / 0.6));
    if (f.cone) coneDraw(f.x, f.y, f.ang, f.r, f.half, f.t);
    if (f.explosion) {
      g.save();
      let u = Math.max(0, Math.min(1, 1 - f.t / 0.45)); // 수명이 0.45초보다 길게 들어와도 반지름이 음수가 되지 않게
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
    // 새 상자 그림: HP 에 따라 멀쩡함 → 금 감 → 크게 부서짐, 맞는 순간은 피격 그림
    if (b.born !== undefined && elapsed - b.born < 0.35) g.globalAlpha = (elapsed - b.born) / 0.35; // 다시 생길 때 살짝 나타남
    const art = b.flash > elapsed ? chestArt.hit : b.hp > 700 ? chestArt.intact : b.hp > 350 ? chestArt.cracked : chestArt.heavy;
    if (art.naturalWidth) drawChest(art, b.x, b.y);
    else if (crateArt.naturalWidth) {
      g.fillStyle = "#30281955";
      g.beginPath();
      g.ellipse(b.x, b.y + 12, 30, 12, 0, 0, 7);
      g.fill();
      g.drawImage(crateArt, b.x - 32, b.y - 39, 64, 64);
    } else {
      g.fillStyle = "#b87b36";
      g.fillRect(b.x - 20, b.y - 20, 40, 40);
    }
    if (b.flash > elapsed && !art.naturalWidth) {
      g.fillStyle = "#ffffff55";
      g.fillRect(b.x - 24, b.y - 28, 48, 48);
    }
    g.restore();
    bar(b.x, b.y - 50, b.hp, 1e3);
  }
  for (let l of loot) {
    if (l.life !== undefined && l.life < CHEST_RULES.blink && Math.floor(elapsed * 8) % 2) continue; // 사라지기 직전 깜빡임
    const icon = l.type === LOOT.weapon ? weaponIcons[l.id] : l.type === LOOT.grenade ? weaponIcons[GRENADE.weaponId] : null;
    if (l.type === LOOT.heal) drawMedkit(l.x, l.y + Math.sin(elapsed * 3 + l.x) * 2);
    else if (icon && icon.naturalWidth) {
      // 무기 아이콘: 바닥 그림자 + 살짝 떠 있는 움직임
      const bob = Math.sin(elapsed * 3 + l.x) * 2;
      g.fillStyle = "#1a24164d";
      g.beginPath();
      g.ellipse(l.x, l.y + 9, 14, 5, 0, 0, 7);
      g.fill();
      g.drawImage(icon, l.x - 18, l.y - 24 + bob, 36, 36);
    } else {
      // 장비: 개별 그림이 아직 없어 기존 표시 유지
      g.fillStyle = l.type ? "#b8e9ff" : "#ffe07c";
      g.fillRect(l.x - 7, l.y - 7, 14, 14);
    }
    g.fillStyle = "#fff";
    g.font = "12px sans-serif";
    g.textAlign = "center";
    g.fillText(lootName(l), l.x, (icon && icon.naturalWidth) || l.type === LOOT.heal ? l.y - 26 : l.y - 12);
  }
  for (let f of fx.filter((f2) => f2.trail)) {
    if (character === "bear" && CHARACTER_ART.bearSheet && sheets.bear.naturalWidth) {
      g.save();
      g.globalAlpha = f.t / 0.18 * 0.35;
      g.drawImage(sheets.bear, (f.frame % 8) * 96, f.dir * 96, 96, 96, f.x - 34, f.y - 56, 68, 68);
      g.restore();
    } else if (character === "runner" && runnerImg.naturalWidth) {
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
  // 쓰러진 캐릭터: 사라지기 전 잠깐 바래는 효과
  for (const a of [p, ...bots]) if (a.hp <= 0 && !a.mob) drawDeath(a, a === p ? character : a.visual);
  const vis = visionOn(); // 시야(싱글·웨이브): 위험 표시는 어둠 위에 다시 그림 (시야 밖에서 오는 공격도 보이게)
  if (!vis) drawDangerLayer(false);
  if (singleRun?.ward) drawStoryWard();
  if (singleRun) for (const a of bots) if (a.mob && a.hp <= 0 && mobShown(a)) drawMob(a); // 쓰러지는 중
  for (let a of [p, ...bots].filter((a2) => a2.hp > 0 && (a2 === p || (a2.mob ? mobShown(a2) : visible(p, a2)))).sort((a2, b) => a2.y - b.y)) {
    if (a.mob) {
      drawMob(a);
      continue;
    }
    g.fillStyle = a === p ? "#337ddc" : "#b84949";
    g.beginPath();
    g.ellipse(a.x, a.y + 8, 20, 10, 0, 0, 7);
    g.fill();
    g.save();
    if (a === p && (p.stealth > 0 || inBush(p))) g.globalAlpha = 0.5;
    if (a === p && p.weave > 0) g.globalAlpha = 0.6; // 위빙 중
    if (a === p && p.jumpZ) g.translate(0, -p.jumpZ); // 정용 점프
    drawActorWithFeel(a, a === p ? character : a.visual);
    g.restore();
    if (a === p && p.stealthAlert) drawStealthAlert(); // 은신한 적이 가까이 있음 (위치·방향은 안 알려줌)
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
    g.fillText(DISPLAY_NAMES[a === p ? character : a.visual], a.x, a.y + 28); // 이름만 (장착 무기 이름은 2026-11-25 요청으로 제거, 무기는 공격 버튼·HUD 아이콘)
  }
  for (const pt of [...(pet ? [pet] : []), ...ultPets]) drawPetActor(pt);
  drawBlades();
  for (const c of clones) drawClone(c);
  setText("petHUD", `선택: ${mons[deck[selected]][0]} | Q ${summonCD[deck[selected]].toFixed(1)}초 | E ${swapCD.toFixed(1)}초 | 자동 기술 ${(pet?.skillCD || 0).toFixed(1)}초 | 덱 CD ${deck.map((id, i) => `${i + 1}:${summonCD[id].toFixed(1)}`).join(" / ")} | ${pet ? "소환 유지 " + pet.life.toFixed(1) + "초" : "미소환"}`);
  if (singleRun && !vis) drawMobShots();
  for (let s of shots) {
    if (s.octo === 3) { // 상훈 기본 공격: 작은 먹물 덩어리 + 떨어질 곳 표시
      let u = clamp(1 - s.t / s.flight, 0, 1);
      g.strokeStyle = "#6b3d9a99";
      g.setLineDash([4, 4]);
      g.beginPath();
      g.arc(s.tx, s.ty, s.S.radius, 0, 7);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#38244d66";
      g.beginPath();
      g.ellipse(s.x, s.y, 8, 4, 0, 0, 7);
      g.fill();
      g.fillStyle = "#3d2357";
      g.beginPath();
      g.arc(s.x, s.y - 55 * Math.sin(Math.PI * u), 8, 0, 7);
      g.fill();
      continue;
    }
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
    if (s.heart) { // 기섭 궁극기 하트
      drawHeart(s.x, s.y - 20, 8);
      continue;
    }
    // 총알: 판정은 발밑 좌표, 그림은 총구·몸통 높이(20px 위)에 맞춰 그림
    const by = s.y - 20;
    if (s.orb) { // 은숙 빛의 구체
      const gr = g.createRadialGradient(s.x, by, 1, s.x, by, 12);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.45, "#fff3b0");
      gr.addColorStop(1, "#ffd23f00");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(s.x, by, 12, 0, 7);
      g.fill();
      continue;
    }
    g.strokeStyle = "#fff2a388";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(s.x - s.vx * 0.012, by - s.vy * 0.012);
    g.lineTo(s.x, by);
    g.stroke();
    g.fillStyle = "#fff2a3";
    g.beginPath();
    g.arc(s.x, by, s.big ? 11 : s.soccer ? 7 : 4, 0, 7);
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
    if (f.trail || f.debris) continue;
    if (f.impact) {
      drawImpact(f);
      continue;
    }
    if (f.shock) {
      drawShock(f);
      continue;
    }
    if (f.healRing) {
      drawHealRing(f);
      continue;
    }
    if (f.heal) {
      g.fillStyle = "#7dff8a";
      g.fillText(f.text, f.x, f.y - 30 - (0.8 - f.t) * 30);
      continue;
    }
    if (f.tentacle) { // 상훈 궁극기 촉수
      g.save();
      g.globalAlpha = f.t / 0.35;
      g.strokeStyle = "#d25b7c";
      g.lineWidth = 6;
      for (let i = 0; i < 6; i++) {
        const v = i / 6 * Math.PI * 2 + f.x * 0.01, r0 = f.r * (1 - f.t / 0.35);
        g.beginPath();
        g.moveTo(f.x + Math.cos(v) * 20, f.y + Math.sin(v) * 10);
        g.quadraticCurveTo(f.x + Math.cos(v + 0.5) * r0 * 0.7, f.y + Math.sin(v + 0.5) * r0 * 0.4 - 20, f.x + Math.cos(v) * r0, f.y + Math.sin(v) * r0 * 0.5);
        g.stroke();
      }
      g.restore();
      continue;
    }
    if (f.inkBurst) {
      g.save();
      g.globalAlpha = f.t / (f.small ? 0.4 : 0.7);
      g.fillStyle = "#40224f";
      g.beginPath();
      g.arc(f.x, f.y, (f.small ? 42 : 85) * (1 - f.t / (f.small ? 0.5 : 0.9)), 0, 7);
      g.fill();
      g.restore();
      continue;
    }
    if (f.crateBurst && chestArt.burst1.naturalWidth) {
      // 파괴 연출: 터짐 1 → 터짐 2 → 잔해 (잔해는 바닥 층에서 따로 서서히 사라짐)
      drawChest(f.t > 0.3 ? chestArt.burst1 : chestArt.burst2, f.x, f.y, f.t > 0.12 ? 1 : f.t / 0.12);
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
    if (f.pkball) { // 몬스터볼이 열리며 빛 (보스 포켓몬 소환·소환 등장). col = 포켓몬 색
      const u = 1 - f.t / 0.6;
      g.save();
      g.globalAlpha = f.t / 0.6;
      g.fillStyle = f.col || "#fff6a0";
      g.beginPath();
      g.arc(f.x, f.y, 8 + 34 * u, 0, 7);
      g.fill();
      g.globalAlpha = Math.min(1, f.t / 0.3);
      ball(f.x, f.y + 6 - 14 * u, 8, u * 6);
      g.restore();
      continue;
    }
    if (f.healRing) { // 광역 회복 범위 (초록 고리가 퍼짐)
      const u = 1 - f.t / 0.7;
      g.save();
      g.globalAlpha = f.t / 0.7;
      g.strokeStyle = "#7dff9a";
      g.lineWidth = 4;
      g.beginPath();
      g.arc(f.x, f.y, f.healRing * (0.3 + 0.7 * u), 0, 7);
      g.stroke();
      g.restore();
      continue;
    }
    if (f.evolve) { // 진화: 하얀 빛이 커졌다가 색 반짝임이 돎
      const u = 1 - f.t / 1.2;
      g.save();
      g.globalAlpha = Math.min(1, f.t / 0.4);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(f.x, f.y - 20, 14 + 40 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2), 0, 7);
      g.fill();
      g.fillStyle = f.col;
      for (let i = 0; i < 8; i++) {
        const v = i / 8 * Math.PI * 2 + u * 8, r = 30 + 30 * u;
        g.beginPath();
        g.arc(f.x + Math.cos(v) * r, f.y - 20 + Math.sin(v) * r * 0.7, 4, 0, 7);
        g.fill();
      }
      g.restore();
      continue;
    }
    if (f.elem) { // 포켓몬 공격: 불꽃(부채꼴 불씨) / 물줄기(굵은 선 + 물방울) / 그 밖은 색 광선
      const u = 1 - f.t / f.dur, a0 = Math.atan2(f.y - f.sy, f.x - f.sx), L = Math.hypot(f.x - f.sx, f.y - f.sy);
      g.save();
      g.globalAlpha = Math.min(1, f.t / f.dur * 2);
      if (f.elem === "flame") {
        for (let i = 0; i < (f.strong ? 14 : 8); i++) {
          const k = (i / (f.strong ? 14 : 8) + u * 0.6) % 1, spread = (Math.sin(i * 7.3) * 0.35) * k;
          g.fillStyle = i % 3 ? "#ff8a2a" : "#ffd23f";
          g.beginPath();
          g.arc(f.sx + Math.cos(a0 + spread) * L * k, f.sy + Math.sin(a0 + spread) * L * k, 3 + 7 * k * (f.strong ? 1.4 : 1), 0, 7);
          g.fill();
        }
      } else if (f.elem === "water") {
        g.strokeStyle = "#4aa8ffcc";
        g.lineWidth = f.strong ? 12 : 7;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(f.sx, f.sy);
        g.lineTo(f.sx + Math.cos(a0) * L * Math.min(1, u * 2), f.sy + Math.sin(a0) * L * Math.min(1, u * 2));
        g.stroke();
        g.strokeStyle = "#d8f0ff";
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = "#8fd0ff";
        for (let i = 0; i < 5; i++) {
          const v = i * 1.3 + u * 3;
          g.beginPath();
          g.arc(f.x + Math.cos(v) * 14 * u, f.y - 10 + Math.sin(v) * 10 * u, 3, 0, 7);
          g.fill();
        }
      } else {
        g.strokeStyle = f.col || "#fff";
        g.lineWidth = f.strong ? 8 : 4;
        g.beginPath();
        g.moveTo(f.sx, f.sy);
        g.lineTo(f.x, f.y - 10);
        g.stroke();
      }
      g.restore();
      continue;
    }
    if (f.burst || f.recall) {
      g.save();
      g.globalAlpha = f.t / 0.55;
      g.fillStyle = f.red ? "#ff4a4a" : "#fff6a0";
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
    } else if (f.text !== undefined) { // 데미지·회복·MISS 숫자: 색(f.tcol), 치명타·알림은 크게(f.big), 위로 떠오르며 사라짐
      if (f.tcol) {
        g.save();
        g.globalAlpha = clamp(f.t / 0.35, 0, 1);
        g.font = f.big ? "bold 19px sans-serif" : "bold 13px sans-serif";
        g.lineWidth = 3;
        g.strokeStyle = "#000a";
        const ty = f.y - 30 - (0.65 - f.t) * 30;
        g.strokeText(f.text, f.x, ty);
        g.fillStyle = f.tcol;
        g.fillText(f.text, f.x, ty);
        g.restore();
      } else g.fillText(f.text, f.x, f.y - 30 - (0.65 - f.t) * 25); // 수정: 글자 없는 이펙트(부채꼴 등)에 "undefined" 가 찍히던 문제
    }
  }
  if (vis) { // 시야 밖 어둡게 → 그 위에 위험(예고 범위·적 투사체·보스 예고)
    drawVisionDark();
    drawDangerLayer(true);
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
  // 자기장 남은 시간은 HTML 전투 HUD(#topHud)에 표시
  if (singleRun?.fadeA > 0) { // 무한 생존 맵 교체 암전
    g.fillStyle = `rgba(0,0,0,${singleRun.fadeA.toFixed(3)})`;
    g.fillRect(0, 0, VW, VH);
  }
  if (over) {
    // 결과 화면 뒤 배경만 어둡게 (문구는 결과 화면이 표시)
    g.fillStyle = "#0007";
    g.fillRect(0, 0, VW, VH);
  }
  setText("hud", `HP ${Math.max(0, Math.round(p.hp))}/${p.max} | 무기 ${weapons[p.w][0]} ${"●".repeat(p.ammo)}${"○".repeat(Math.max(0, AMMO.max - p.ammo))} ${FEATURES.accessories ? "| 장비 " + (p.gear.map((i) => gear[i]).join(", ") || "없음") + " " : ""}| 수류탄 ${p.grenades}/${GRENADE.max} | 생존 ${bots.filter((a) => a.hp > 0).length + (p.hp > 0 ? 1 : 0)} | 대시 ${p.dashCD > 0 ? p.dashCD.toFixed(1) + "초" : "준비 완료"} | 무적 ${god ? "ON" : "OFF"} | AI ${freeze ? "정지" : "활성"}`);
  const SD = SKILL_DATA[character];
  setText("msg", nt > 0 ? notice : character === "summoner" ? "Q 소환 · E 교체 · 1~3 선택 · X 궁극기" : `${SD.q.name} ${p.skcd.q.toFixed(1)}초 | ${SD.e.name} ${p.skcd.e.toFixed(1)}초 | 궁극기 ${Math.floor(p.ult * 100)}%${character === "runner" ? " | 자신감 " + Math.floor(p.energy) + "%" : ""}`);
}

// 소환 조준 미리보기: 사거리 원 + 떨어질 지점 (못 던지는 자리는 빨간색)
function drawSummonAim() {
  const t = summonPoint(summonAim.x, summonAim.y), col = t.ok ? "#7ff0ff" : "#ff6b6b";
  g.save();
  g.lineWidth = 2;
  g.setLineDash([8, 6]);
  g.strokeStyle = "rgba(127,240,255,0.55)";
  g.fillStyle = "rgba(127,240,255,0.07)";
  g.beginPath();
  g.arc(p.x, p.y, SUMMON_RANGE, 0, 7);
  g.fill();
  g.stroke();
  g.strokeStyle = col;
  g.beginPath();
  g.moveTo(p.x, p.y - 20);
  g.quadraticCurveTo((p.x + t.x) / 2, Math.min(p.y, t.y) - 60, t.x, t.y);
  g.stroke();
  g.setLineDash([]);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(t.x, t.y, 18, 0, 7);
  g.stroke();
  g.beginPath();
  g.moveTo(t.x - 26, t.y); g.lineTo(t.x - 10, t.y);
  g.moveTo(t.x + 10, t.y); g.lineTo(t.x + 26, t.y);
  g.moveTo(t.x, t.y - 26); g.lineTo(t.x, t.y - 10);
  g.moveTo(t.x, t.y + 10); g.lineTo(t.x, t.y + 26);
  g.stroke();
  const ic = mons[deck[selected]];
  g.font = "bold 13px sans-serif";
  g.textAlign = "center";
  g.fillStyle = "#fff";
  g.strokeStyle = "rgba(0,0,0,.6)";
  g.lineWidth = 3;
  const label = (ic ? ic[0] : "") + (t.ok ? "" : " · 불가");
  g.strokeText(label, t.x, t.y - 32);
  g.fillText(label, t.x, t.y - 32);
  g.restore();
}

// 위험 표시: 범위 공격 예고·보스 패턴 예고·적 투사체 (시야 켜짐이면 어둠 위에, 시야 밖이어도 보임)
function drawDangerLayer(withShots) {
  if (!singleRun) return;
  if (singleRun.endless) drawHazards();
  for (const a of bots) if (a.mob === "boss" && a.hp > 0) a.bossId ? drawEndlessTele(a) : drawBossTele(a);
  if (withShots) drawMobShots();
}
// 적 표시: 시야 안 + 풀숲에 숨지 않음 (현곤·포켓몬 시야 공유). 시야 끔이면 항상
function mobShown(a) {
  if (!visionOn()) return true;
  if (!inPlayerVision(a)) return false;
  return [p, pet, ...ultPets].some((o) => o && o.hp > 0 && !concealed(o, a));
}
