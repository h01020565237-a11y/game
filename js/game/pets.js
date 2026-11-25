// 소환사: 소환·교체·펫 기술

let flight = null;
let deck = [0, 3, 5], selected = 0, pet = null, summonCD = Array(mons.length).fill(0), skillCD = 0, swapCD = 0;
const SUMMON_RANGE = 220; // 캐릭터 기준 최대 투척 거리
// 목표 지점을 사거리 안으로 당기고, 던질 수 있는 자리인지(지형·벽·상자) 확인
function summonPoint(tx, ty) {
  let dx = tx - p.x, dy = ty - p.y, n = Math.hypot(dx, dy) || 1, k = Math.min(1, SUMMON_RANGE / n);
  let x = clamp(p.x + dx * k, 20, W - 20), y = clamp(p.y + dy * k, 20, H - 20);
  return { x, y, ok: !(terrain(x, y) || blocked(x, y) || boxes.some((b) => dist({ x, y }, b) < 32)) };
}
function summon(swap = false) {
  if (character !== "summoner") return;
  let id = deck[selected];
  if (ultPets.length) {
    notice = "한잔했어! 중에는 소환할 수 없어요";
    nt = 1.5;
    return;
  }
  if (summonCD[id] > 0 || flight || p.hp <= 0 || !swap && pet || swap && (!pet || pet.id === id || swapCD > 0)) {
    notice = "소환/교체 불가: 선택 및 쿨타임 확인";
    nt = 2;
    return;
  }
  let { x, y, ok } = summonPoint(mouse.x, mouse.y);
  if (!ok) {
    notice = "그곳엔 소환할 수 없어요";
    nt = 1.5;
    return;
  }
  if (swap) {
    fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true, red: true }); // 교체: 붉은 빛으로 몬스터볼에 복귀
    pet = null;
    swapCD = PET_RULES.swapCD;
  }
  flight = { x: p.x, y: p.y, tx: x, ty: y, id, t: 0 };
  sfx(swap ? "pet_switch" : "pet_summon", p);
  summonCD[id] = PET_RULES.summonCD;
  skillCD = 0;
}
// 포켓몬 행동 (일반·궁극기·진화·전설 공통, 수치는 PET_AI js/data/vision.js)
// - 시야 공유: 현곤·포켓몬 시야 안 + 풀숲·은신 아닌 적만 자동 공격 (visible)
// - 최대 활동 반경: 현곤에서 PET_AI.leash 밖의 적은 쫓지 않음. 반경을 넘으면 공격 중단하고 복귀
// - 적이 없으면 현곤 뒤쪽 대기 자리(포켓몬마다 다른 자리, 60~100)로. 현곤 바로 옆은 비켜 섬
// - 공격 애니메이션의 '맞는 프레임'에 피해 (스프라이트 없으면 바로)
function petList() {
  return [...(pet ? [pet] : []), ...ultPets];
}
function petSlot(pt) {
  const list = petList(), i = Math.max(0, list.indexOf(pt)), n = list.length;
  const v = (p.lastMoveDir ?? 4) * Math.PI / 4, back = Math.atan2(-Math.cos(v), Math.sin(v)) + Math.PI; // 현곤이 보는 방향의 반대쪽
  const ang = back + (i - (n - 1) / 2) * PET_AI.spread, r = (PET_AI.follow[0] + PET_AI.follow[1]) / 2;
  const q = freeSpot(clamp(p.x + Math.cos(ang) * r, 30, W - 30), clamp(p.y + Math.sin(ang) * r, 30, H - 30), pt.r || 16);
  return q || p;
}
function petTarget(pt) {
  const L = PET_AI.leash;
  return minBy(bots.filter((b2) => b2.hp > 0 && dist(p, b2) <= L && visible(pt, b2)), (b2) => dist(pt, b2));
}
function runPet(pt, dt) {
  pt.life -= dt;
  pt.pose = Math.max(0, (pt.pose || 0) - dt);
  pt.cd = Math.max(0, (pt.cd || 0) - dt);
  pt.skillCD = Math.max(0, (pt.skillCD || 0) - dt);
  if (pt.life <= 0 || pt.hp <= 0) return;
  petPendingHit(pt, dt);
  const m = mons[pt.id], dp = dist(pt, p);
  // 너무 멀어짐 → 복귀 (도착할 때까지 공격 안 함)
  if (dp > PET_AI.leash) pt.returning = true;
  if (pt.returning) {
    const s0 = petSlot(pt);
    steer(pt, s0.x, s0.y, dt * 1.25);
    if (dist(pt, p) <= PET_AI.follow[1]) pt.returning = false;
    petSeparate(pt);
    return;
  }
  command(pt);
  const b = petTarget(pt);
  if (b) {
    if (dist(pt, b) > m[3] || blocked((pt.x + b.x) / 2, (pt.y + b.y) / 2, 2)) {
      const x0 = pt.x, y0 = pt.y;
      steer(pt, b.x, b.y, dt); // AI: 경로 탐색
      if (dist(pt, p) > PET_AI.leash) { // 반경 밖으로 나가는 걸음은 취소
        pt.x = x0;
        pt.y = y0;
        pt.moving = false;
      }
    } else {
      pt.moving = false;
      pt.dir = (Math.round(Math.atan2(b.x - pt.x, pt.y - b.y) / (Math.PI / 4)) + 8) % 8;
      if (pt.cd <= 0) {
        pt.cd = 0.8 * (pt.ult && singleRun?.endless && singleRun.mods.petHaste || 1) / petMul(pt.id, "aspd"); // 무한 생존 카드: 공격 속도
        pt.pose = 0.25;
        pt.atkAt = elapsed; // 공격 애니메이션 시작
        pt.pendingHit = { b, t: petHitDelay(pt.id), d: m[2] * petMul(pt.id, "atk") };
        if (pt.pendingHit.t <= 0) petPendingHit(pt, 0);
      }
    }
  } else {
    const s0 = petSlot(pt);
    if (dist(pt, s0) > PET_AI.arrive) steer(pt, s0.x, s0.y, dt);
    else pt.moving = false;
  }
  petSeparate(pt);
}
// 맞는 프레임까지 시간 (스프라이트 AnimData 의 HitFrame)
function petHitDelay(id) {
  const A = petSprite(id)?.anims.attack;
  if (!A || !A.hit) return 0;
  let t = 0;
  for (let i = 0; i < A.hit && i < A.dur.length; i++) t += A.dur[i];
  return t / 60;
}
function petPendingHit(pt, dt) {
  const H = pt.pendingHit;
  if (!H) return;
  if ((H.t -= dt) > 0) return;
  pt.pendingHit = null;
  const b = H.b;
  if (b.hp <= 0 || dist(pt, b) > mons[pt.id][3] + 40) return;
  hit(pt, b, H.d, { ult: !!pt.ult });
  petAttackFx(pt, b, false);
}
// 현곤 바로 옆·다른 포켓몬과 겹치지 않게 살짝 밀어냄 (벽 안으로는 안 밀림)
function petSeparate(pt) {
  const push = (o, min, k) => {
    const dx = pt.x - o.x, dy = pt.y - o.y, d = Math.hypot(dx, dy);
    if (d >= min) return;
    const n = d || 1, ux = d ? dx / n : Math.cos(pt.id), uy = d ? dy / n : Math.sin(pt.id);
    moveRaw(pt, ux, uy, (min - d) * k);
  };
  if (!pt.pendingHit) push(p, PET_AI.personal, 0.25);
  for (const o of petList()) if (o !== pt) push(o, PET_AI.sep, 0.3);
}
// 속성별 공격 이펙트 (전기 / 불꽃 / 물줄기 …). 진화·전설은 기본형·색으로
function petElement(id) {
  const D = PET_DEX[id], base = D.base ?? (D.kind === "legend" ? -1 : id);
  return PET_ELEMENTS[base] || PET_ELEMENTS.legend;
}
function petAttackFx(pt, b, strong) {
  const E = petElement(pt.id);
  if (E.fx === "bolt") fx.push({ x: b.x, y: b.y, sx: pt.x, sy: pt.y, t: strong ? 0.48 : 0.24, bolt: true, strong });
  else fx.push({ x: b.x, y: b.y, sx: pt.x, sy: pt.y - 10, t: strong ? 0.45 : 0.3, dur: strong ? 0.45 : 0.3, elem: E.fx, col: E.color, strong });
  fx.push({ x: b.x, y: b.y - 10, t: 0.25, ring: strong ? 30 : 18 });
}
function command(pt = pet) {
  if (!pt || (pt.skillCD || 0) > 0) return;
  const pet = pt; // 아래 코드는 pet 이름 그대로 사용 (일반 포켓몬·궁극기 포켓몬 공통)
  // 기술 수치는 PET_SKILLS / PET_RULES (js/data/skills.js)
  const id = pet.id, S = PET_SKILLS[id], reach = S.radius || PET_RULES.range;
  let enemies = bots.filter((b) => b.hp > 0 && visible(pet, b) && dist(p, b) <= PET_AI.leash && dist(pet, b) < reach && !blocked((pet.x + b.x) / 2, (pet.y + b.y) / 2, 2)).sort((a, b) => dist(pet, a) - dist(pet, b));
  if (!enemies.length) return;
  if (S.minFoes && enemies.length < S.minFoes && pet.life > 7) return;
  pet.skillCD = PET_RULES.skillCD;
  sfx("pet_skill", pet);
  fx.push({ x: pet.x, y: pet.y - 30, t: 0.65, text: S.name });
  petSkillEffect(pet, S, enemies);
  fx.push({ x: pet.x, y: pet.y, t: 0.35, ring: reach });
}
// 포켓몬 기술 효과 (기본·진화·전설 공통). 뮤: 회복 + 무작위 기본 기술
function petSkillEffect(pet, S, enemies) {
  const id = pet.id, mul = petSkillMul(id);
  if (S.heal) healActor(p, p.max * S.heal);
  if (S.random) {
    const pick = PET_SKILLS[Math.floor(Math.random() * BASE_PET_COUNT)];
    fx.push({ x: pet.x, y: pet.y - 48, t: 0.65, text: pick.name, tcol: "#f7a8d8" });
    S = { ...pick, dmg: S.dmg };
  }
  if (S.line) { // 레쿠쟈: 가장 가까운 적 쪽 직선 관통
    const b0 = enemies[0], ang = Math.atan2(b0.y - pet.y, b0.x - pet.x), ux = Math.cos(ang), uy = Math.sin(ang);
    for (const b of bots) {
      if (b.hp <= 0 || b.stealth > 0) continue;
      const rx = b.x - pet.x, ry = b.y - pet.y, along = rx * ux + ry * uy, off = Math.abs(rx * uy - ry * ux);
      if (along > 0 && along < S.line && off < S.width / 2) hit(pet, b, S.dmg * mul, { ult: !!pet.ult });
    }
    fx.push({ x: pet.x, y: pet.y, t: 0.35, cone: true, ang, r: S.line, half: 0.08 });
    pet.pose = 0.35;
    return;
  }
  pet.atkAt = elapsed;
  for (let b of enemies.slice(0, S.targets || 1)) {
    petAttackFx(pet, b, true);
    pet.pose = 0.35;
    hit(pet, b, S.dmg * mul, { ult: !!pet.ult });
    if (S.stun) b.stun = S.stun;
    if (S.slow) b.slow = S.slow;
    if (S.weak) b.weak = S.weak;
    if (S.burn) {
      b.burn = S.burn;
      b.burnDps = S.burnDps * mul;
      b.burnBy = pet; // 화상 피해도 포켓몬(=현곤) 피해로 집계·충전
      b.burnTick = 0;
    }
    if (S.push) {
      let dx = b.x - pet.x, dy = b.y - pet.y, n = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < S.push / 10; i++) {
        let x = clamp(b.x + dx / n * 10, 18, W - 18), y = clamp(b.y + dy / n * 10, 18, H - 18);
        if (terrain(x, y) || blocked(x, y) || boxes.some((q) => dist({ x, y }, q) < 30)) break;
        b.x = x;
        b.y = y;
      }
    }
  }
}
// 기술 피해 배율: 진화·강화(기술 +20%/단계) × 공격력 카드
function petSkillMul(id) {
  const K = pkRun();
  return petMul(id, "special") * (K ? K.mul.atk : 1);
}

// 인게임 스프라이트 (js/data/pokemon_sprites.js, 도감번호별). 없으면 null → 공식 일러스트 1장
function petSprite(id) {
  const dex = PET_DEX[id]?.dex;
  return dex !== undefined && typeof POKEMON_SPRITES !== "undefined" ? POKEMON_SPRITES[dex] || null : null;
}
