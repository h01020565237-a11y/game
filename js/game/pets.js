// 소환사: 소환·교체·펫 기술

let flight = null;
let deck = [0, 3, 5], selected = 0, pet = null, summonCD = Array(8).fill(0), skillCD = 0, swapCD = 0;
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
    fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true });
    pet = null;
    swapCD = PET_RULES.swapCD;
  }
  flight = { x: p.x, y: p.y, tx: x, ty: y, id, t: 0 };
  sfx(swap ? "pet_switch" : "pet_summon", p);
  summonCD[id] = PET_RULES.summonCD;
  skillCD = 0;
}
function command() {
  if (!pet || skillCD > 0) return;
  // 기술 수치는 PET_SKILLS / PET_RULES (js/data/skills.js)
  const id = pet.id, S = PET_SKILLS[id], reach = S.radius || PET_RULES.range;
  let enemies = bots.filter((b) => b.hp > 0 && dist(pet, b) < reach && !blocked((pet.x + b.x) / 2, (pet.y + b.y) / 2, 2)).sort((a, b) => dist(pet, a) - dist(pet, b));
  if (!enemies.length) return;
  if (S.minFoes && enemies.length < S.minFoes && pet.life > 7) return;
  skillCD = PET_RULES.skillCD;
  sfx("pet_skill", pet);
  fx.push({ x: pet.x, y: pet.y - 30, t: 0.65, text: S.name });
  for (let b of enemies.slice(0, S.targets || 1)) {
    if (id === 0) fx.push({ x: b.x, y: b.y, sx: pet.x, sy: pet.y, t: 0.48, bolt: true, strong: true });
    pet.pose = 0.35;
    hit(pet, b, S.dmg);
    if (S.stun) b.stun = S.stun;
    if (S.slow) b.slow = S.slow;
    if (S.weak) b.weak = S.weak;
    if (S.burn) {
      b.burn = S.burn;
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
  fx.push({ x: pet.x, y: pet.y, t: 0.35, ring: reach });
}
