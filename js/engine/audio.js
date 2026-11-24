// 사운드 시스템
//
// - Web Audio 사용. 모바일 브라우저는 사용자가 화면을 만지기 전에는 소리를 낼 수 없어서,
//   첫 터치/클릭/키 입력 때 오디오를 켠다 (iOS 무음 버퍼 재생 포함). 그 전의 sfx() 호출은 조용히 무시.
// - 효과음·BGM 음량 따로, 전체 음소거. 설정은 localStorage 에 저장 (실패해도 동작)
// - 같은 소리 동시 재생 수·간격 제한, 내 캐릭터에서 먼 소리는 작게
// - 파일을 못 불러오면(예: file:// 로 연 경우) <audio> 요소로 재생, 그것도 안 되면 합성음

const audio = { ctx: null, master: null, sfxGain: null, bgmGain: null, buffers: {}, els: {}, last: {}, playing: {}, bgmNode: null, bgmTimer: null, settings: null };

audio.settings = (() => {
  try {
    return Object.assign({}, AUDIO_DEFAULTS, JSON.parse(localStorage.getItem("battlelab.audio") || "{}"));
  } catch (e) {
    return Object.assign({}, AUDIO_DEFAULTS);
  }
})();
function saveAudioSettings() {
  try {
    localStorage.setItem("battlelab.audio", JSON.stringify(audio.settings));
  } catch (e) {}
}
function applyVolumes() {
  if (!audio.ctx) return;
  const s = audio.settings, t = audio.ctx.currentTime;
  audio.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.02);
  audio.sfxGain.gain.setTargetAtTime(s.sfx, t, 0.02);
  audio.bgmGain.gain.setTargetAtTime(s.bgm * BGM.vol, t, 0.05);
}
function setAudio(key, value) {
  audio.settings[key] = value;
  saveAudioSettings();
  applyVolumes();
  if (key === "muted" || key === "bgm") syncBgm();
}

function unlockAudio() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.connect(audio.ctx.destination);
    audio.sfxGain = audio.ctx.createGain();
    audio.sfxGain.connect(audio.master);
    audio.bgmGain = audio.ctx.createGain();
    audio.bgmGain.connect(audio.master);
    applyVolumes();
    // iOS: 무음 버퍼를 한 번 재생해야 이후 소리가 남
    const b = audio.ctx.createBuffer(1, 1, 22050), s = audio.ctx.createBufferSource();
    s.buffer = b;
    s.connect(audio.ctx.destination);
    s.start(0);
    loadSounds();
  }
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  syncBgm();
}
for (const ev of ["pointerdown", "touchend", "keydown", "click"]) document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
document.addEventListener("visibilitychange", () => {
  if (!audio.ctx) return;
  if (document.hidden) audio.ctx.suspend();
  else audio.ctx.resume();
});

function loadSounds() {
  const fileMode = location.protocol === "file:" ; // file:// 은 fetch 가 막혀서 바로 <audio> 사용
  for (const [name, s] of Object.entries(SOUNDS)) {
    if (!s.src) continue;
    if (fileMode && !s.src.startsWith("data:")) {
      audio.els[name] = Object.assign(new Audio(s.src), { preload: "auto" });
      continue;
    }
    fetch(s.src)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then((ab) => audio.ctx.decodeAudioData(ab))
      .then((buf) => (audio.buffers[name] = buf))
      .catch(() => {
        // file:// 등 fetch 가 막힌 경우: <audio> 요소로 재생
        const el = new Audio(s.src);
        el.preload = "auto";
        audio.els[name] = el;
      });
  }
  if (BGM.src) {
    fetch(BGM.src).then((r) => r.arrayBuffer()).then((ab) => audio.ctx.decodeAudioData(ab)).then((buf) => {
      audio.buffers.__bgm = buf;
      syncBgm(true);
    }).catch(() => {});
  }
}

// 효과음 재생. pos 를 주면 내 캐릭터와의 거리로 음량 조절
function sfx(name, pos) {
  const s = SOUNDS[name];
  if (s && !s.src && !AUDIO_SYNTH_FALLBACK) return; // 파일 없는 소리는 무음
  if (!s || !audio.ctx || audio.settings.muted || audio.ctx.state !== "running") return;
  const now = audio.ctx.currentTime;
  if (now - (audio.last[name] || -1) < (s.gap || 0.03)) return;
  if ((audio.playing[name] || 0) >= (s.max || 3)) return;
  let v = s.vol ?? 0.7;
  if (pos && p && pos !== p && !s.ui) {
    const d = Math.hypot(pos.x - p.x, pos.y - p.y);
    if (d > 950) return;
    v *= clamp(1 - (d - 220) / 700, 0.12, 1) * (pos === pet ? 1 : 0.75);
  }
  audio.last[name] = now;
  const done = () => (audio.playing[name] = Math.max(0, (audio.playing[name] || 1) - 1));
  audio.playing[name] = (audio.playing[name] || 0) + 1;
  const buf = audio.buffers[name];
  if (buf) {
    const src = audio.ctx.createBufferSource(), gn = audio.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = 0.96 + fxRand() * 0.08; // 반복음이 덜 기계적으로 들리게
    gn.gain.value = v;
    src.connect(gn).connect(audio.sfxGain);
    src.onended = done;
    src.start();
  } else if (audio.els[name]) {
    const el = audio.els[name].cloneNode();
    el.volume = clamp(v * audio.settings.sfx, 0, 1);
    el.onended = done;
    el.play().catch(done);
  } else {
    synth(s.synth || name, v);
    setTimeout(done, 250);
  }
}

// 합성음 (파일이 없을 때)
function synth(kind, v) {
  const c2 = audio.ctx, t = c2.currentTime, o = c2.createOscillator(), gn = c2.createGain();
  o.connect(gn).connect(audio.sfxGain);
  const env = (a, d) => {
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(v * a, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  };
  if (kind === "skill") {
    o.type = "triangle";
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.18);
    env(0.5, 0.25);
  } else if (kind === "summon") {
    o.type = "sine";
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    env(0.4, 0.3);
  } else {
    o.type = "square";
    o.frequency.setValueAtTime(300, t);
    env(0.2, 0.1);
  }
  o.start(t);
  o.stop(t + 0.35);
}

// 배경음악: 파일이 있으면 반복 재생, 없으면 합성 루프 (정글 느낌의 부드러운 마림바 + 베이스)
function syncBgm(force) {
  if (!audio.ctx) return;
  const want = !audio.settings.muted && audio.settings.bgm > 0;
  if (!want) return stopBgm();
  if (audio.bgmNode && !force) return;
  stopBgm();
  if (!audio.buffers.__bgm && !AUDIO_SYNTH_FALLBACK) return; // 배경음악 파일이 없으면 무음
  if (audio.buffers.__bgm) {
    const s = audio.ctx.createBufferSource();
    s.buffer = audio.buffers.__bgm;
    s.loop = true;
    s.connect(audio.bgmGain);
    s.start();
    audio.bgmNode = s;
    return;
  }
  const notes = [0, 3, 5, 7, 10, 12, 10, 7], bass = [0, 0, -5, -2], beat = 0.25;
  let step = 0, next = audio.ctx.currentTime + 0.1;
  const tone = (freq, t, len, vol, type) => {
    const o = audio.ctx.createOscillator(), gn = audio.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(gn).connect(audio.bgmGain);
    o.start(t);
    o.stop(t + len + 0.05);
  };
  const base = 220;
  audio.bgmNode = { stop() {} };
  audio.bgmTimer = setInterval(() => {
    while (next < audio.ctx.currentTime + 0.3) {
      const bar = Math.floor(step / 8) % bass.length;
      if (step % 2 === 0) tone(base * Math.pow(2, notes[(step * 3 + bar) % notes.length] / 12), next, 0.35, 0.12, "triangle");
      if (step % 8 === 0) tone(base / 2 * Math.pow(2, bass[bar] / 12), next, 1.6, 0.16, "sine");
      if (step % 4 === 2) tone(90, next, 0.08, 0.05, "square");
      step++;
      next += beat;
    }
  }, 100);
}
function stopBgm() {
  if (audio.bgmTimer) clearInterval(audio.bgmTimer);
  audio.bgmTimer = null;
  if (audio.bgmNode) try {
    audio.bgmNode.stop();
  } catch (e) {}
  audio.bgmNode = null;
}
