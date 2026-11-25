// ===== 싱글 영입 미션 (현곤 제외 6개) — 무한 생존 엔진 위에서 미션 대본(STORY_MISSIONS)대로 진행 =====
// singleRun = { endless: true, story: 대본, id: 미션 id } → endless.js 의 각 단계가 story 일 때 아래 함수로 갈라짐
// - 단계: time 초 생존 / 보스 (보스 8명 패턴 재사용, 체력은 대본 값)
// - 마지막 보스 처치 = 미션 성공 (phase "clear" → update.js 에서 over = "미션 성공" → 영입 저장 → 컷신 → 결과)
// - 실패: 플레이어 사망 / 보호 대상(은숙) 쓰러짐 / 보스 제한시간 초과 → R.failReason
// - 카드·레벨 업은 무한 생존과 같음 (이번 미션에서만, 끝나면 원래 수치로)
// - 무한 생존 최고 기록에는 들어가지 않음

function beginStory(id, ch) {
  singleRun = { id, endless: true, story: STORY_MISSIONS[id], char: ch };
}
function isStory() {
  return !!singleRun?.story;
}
// setupEndless 끝에서 호출
function setupStory() {
  const R = singleRun, S = R.story;
  R.failReason = "";
  R.ward = null;
  if (S.ward) { // 보호 대상: 플레이어 곁에서 시작, 아군 취급(내 공격에 안 맞음)
    const sp = freeSpot(p.x + 60, p.y + 10, 16) || { x: p.x, y: p.y };
    R.ward = { ...actor(sp.x, sp.y), hp: S.ward.hp, max: S.ward.hp, owner: p, ward: true, name: S.ward.name, look: S.ward.look, dir: 4 };
  }
}
function storyStage(W) {
  return singleRun.story.stages[W - 1];
}
function storyWaveSpec(W) {
  const st = storyStage(W);
  if (!st) return { done: true };
  return st.boss ? { boss: true, stage: st } : { kinds: st.kinds, count: st.count, time: st.time, stage: st };
}
// 대본 값이 캐릭터별이면 출전 캐릭터 것으로
function storyVal(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v[character] ?? Object.values(v)[0] : v;
}
function storyStageStart() {
  const R = singleRun, st = R.spec.stage;
  R.stageT = 0;
  R.tipQ = (st.tips || []).map(([t, msg]) => [t, storyVal(msg)]);
  R.limitT = st.limit || 0;
}
// 보스 생성 직후: 대본 체력
function storyBossSetup(a) {
  const st = singleRun.spec.stage, hp = storyVal(st.hp);
  if (hp) a.hp = a.max = hp;
}
// 마지막 단계면 미션 성공
function storyStageClear(boss) {
  const R = singleRun;
  if (R.wave >= R.story.stages.length) {
    for (const b of bots) {
      b.counted = true;
      b.hp = 0;
    }
    bots = [];
    mobShots = [];
    hazards = [];
    R.boss = null;
    R.phase = "clear";
    R.banner = "미션 성공!";
    R.bannerT = 3;
    return true;
  }
  return false;
}
function storyFail(reason) {
  const R = singleRun;
  if (R.failReason || R.phase === "clear") return;
  R.failReason = reason;
  R.banner = reason;
  R.bannerT = 3;
}
// 매 프레임 (updateEndless 앞쪽)
function updateStory(dt) {
  const R = singleRun;
  if (R.phase === "fight" || R.phase === "boss") {
    R.stageT = (R.stageT || 0) + dt;
    while (R.tipQ && R.tipQ.length && R.stageT >= R.tipQ[0][0]) {
      R.banner = "💡 " + R.tipQ.shift()[1];
      R.bannerT = 4.5;
    }
  }
  if (R.phase === "boss" && R.limitT > 0) {
    R.limitT -= dt;
    if (R.limitT <= 0) storyFail("시간 초과! 보스를 제한시간 안에 쓰러뜨리지 못했어요");
  }
  const w = R.ward;
  // 은숙 떨림 버그: 맞을 때 흔들림(hitT)이 은숙만 줄어들지 않아 한 번 맞으면 계속 떨렸음 → 여기서 줄임
  if (w) {
    w.hitT = Math.max(0, (w.hitT || 0) - dt);
    w.reveal = Math.max(0, (w.reveal || 0) - dt);
  }
  if (w && w.hp <= 0 && !w.down) {
    w.down = true;
    storyFail(`${w.name}이(가) 쓰러졌어요`);
  }
}
// 적 일부는 보호 대상을 노림 (근접·기동형)
// '은숙이를 지켜라': 적이 플레이어보다 은숙을 우선 노림 (2026-11-25 버그 수정: 예전엔 근접·기동형 40%만)
// hunters = 은숙을 노리는 적 비율(데이터), 보스·졸개 제외. 원거리형은 사거리에서 은숙에게 쏨 (탄은 플레이어가 막을 수 있음)
function storyMarkHunter(a, kind) {
  const R = singleRun, S = R?.story;
  if (!S?.ward || !R.ward || a.bossId || kind === "minion") return;
  if (Math.random() < (S.ward.hunters ?? 1)) a.hunt = true;
}
function wardAI(a, dt) {
  const w = singleRun.ward, T = ENEMY_TYPES[a.mob] || ENEMY_TYPES.melee, d = dist(a, w);
  const ranged = !!(T.shot || T.lob), reach = ranged ? (T.keep ? T.keep[1] : T.range || 200) : (T.range || 34) + 14;
  if (d > reach) steer(a, w.x, w.y, dt);
  else if (ranged && T.keep && d < T.keep[0]) move(a, a.x - w.x, a.y - w.y, dt);
  else a.moving = false;
  a.dir = (Math.round(Math.atan2(w.x - a.x, a.y - w.y) / (Math.PI / 4)) + 8) % 8;
  a.atkT = (a.atkT || 0) - dt;
  if (a.atkT > 0) return;
  if (ranged && d <= (T.range || 200) + 20 && clearLine(a, w)) {
    a.atkT = T.cd || 1.6;
    a.atkAnim = 0.3;
    if (T.lob) hazards.push({ x: w.x, y: w.y, r: T.lob.radius, t: T.lob.tele, dur: T.lob.tele, dmg: a.dmg, a, color: "211, 155, 255" });
    else {
      const ang = Math.atan2(w.y - a.y, w.x - a.x), spd = T.shot || 300;
      mobShots.push({ x: a.x, y: a.y - 14, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, left: (T.range || 200) + 80, d: a.dmg, a, r: 7, color: "#c77dff" });
    }
  } else if (!ranged && d <= (T.range || 34) + 18) {
    a.atkT = T.cd || 1.2;
    a.atkAnim = 0.3;
    hit(a, w, a.dmg || T.dmg);
  }
}
function drawStoryWard() {
  const w = singleRun?.ward;
  if (!w) return;
  g.save();
  if (w.hp <= 0) g.globalAlpha = 0.4;
  g.fillStyle = "#ffe07a55";
  g.beginPath();
  g.ellipse(w.x, w.y + 8, 24, 10, 0, 0, 7);
  g.fill();
  drawActorWithFeel(w, w.look);
  g.restore();
  bar(w.x, w.y - 62, w.hp, w.max);
  g.fillStyle = "#ffe07a";
  g.font = "bold 12px sans-serif";
  g.textAlign = "center";
  g.fillText(`지켜야 할 ${w.name}`, w.x, w.y - 70);
}
function storyHudText() {
  const R = singleRun, st = R.spec?.stage;
  if (!st) return "";
  if (st.boss) return `${st.label}${R.limitT > 0 ? " · 남은 " + fmtTime(Math.ceil(R.limitT)) : ""}`;
  return `${st.label} · ${fmtTime(Math.max(0, Math.ceil(R.phase === "fight" ? R.timer : st.time)))}`;
}
