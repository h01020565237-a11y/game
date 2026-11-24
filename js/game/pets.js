// 소환사: 소환·교체·펫 기술

let flight = null;
let deck = [0, 3, 5], selected = 0, pet = null, summonCD = Array(8).fill(0), skillCD = 0, swapCD = 0;
function summon(swap = false) {
  if (character !== "summoner") return;
  let id = deck[selected];
  if (summonCD[id] > 0 || flight || p.hp <= 0 || !swap && pet || swap && (!pet || pet.id === id || swapCD > 0)) {
    notice = "소환/교체 불가: 선택 및 쿨타임 확인";
    nt = 2;
    return;
  }
  let dx = mouse.x - p.x, dy = mouse.y - p.y, n = Math.hypot(dx, dy) || 1, k = Math.min(1, 220 / n), x = clamp(p.x + dx * k, 20, W - 20), y = clamp(p.y + dy * k, 20, H - 20);
  if (terrain(x, y) || blocked(x, y) || boxes.some((b) => dist({ x, y }, b) < 32)) return;
  if (swap) {
    fx.push({ x: pet.x, y: pet.y, t: 0.55, recall: true });
    pet = null;
    swapCD = 2;
  }
  flight = { x: p.x, y: p.y, tx: x, ty: y, id, t: 0 };
  summonCD[id] = 15;
  skillCD = 0;
}
function command() {
  if (!pet || skillCD > 0) return;
  let id = pet.id;
  let enemies = bots.filter((b) => b.hp > 0 && dist(pet, b) < (id === 5 ? 100 : 220) && !blocked((pet.x + b.x) / 2, (pet.y + b.y) / 2, 2)).sort((a, b) => dist(pet, a) - dist(pet, b));
  if (!enemies.length) return;
  if ((id === 0 || id === 7) && enemies.length < 2 && pet.life > 7) return;
  skillCD = 5;
  fx.push({ x: pet.x, y: pet.y - 30, t: 0.65, text: ["10만 볼트", "화염방사", "하이드로펌프", "씨폭탄", "섀도볼", "헤비봄버", "냉동빔", "노래하기"][id] });
  for (let b of enemies.slice(0, id === 0 ? 3 : id === 5 || id === 7 ? 7 : 1)) {
    if (id === 0) fx.push({ x: b.x, y: b.y, sx: pet.x, sy: pet.y, t: 0.48, bolt: true, strong: true });
    pet.pose = 0.35;
    hit(pet, b, [420, 460, 350, 300, 350, 550, 330, 120][id]);
    if (id === 3 || id === 7) b.stun = 1;
    if (id === 6) b.slow = 2;
    if (id === 4) b.weak = 3;
    if (id === 1) {
      b.burn = 3;
      b.burnTick = 0;
    }
    if (id === 2) {
      let dx = b.x - pet.x, dy = b.y - pet.y, n = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 5; i++) {
        let x = clamp(b.x + dx / n * 10, 18, W - 18), y = clamp(b.y + dy / n * 10, 18, H - 18);
        if (terrain(x, y) || blocked(x, y) || boxes.some((q) => dist({ x, y }, q) < 30)) break;
        b.x = x;
        b.y = y;
      }
    }
  }
  fx.push({ x: pet.x, y: pet.y, t: 0.35, ring: id === 5 ? 100 : 220 });
}
