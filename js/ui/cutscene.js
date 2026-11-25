// ===== 영입 컷신 플레이어 (그림 컷 + 카메라 연출 + 음성/효과음/BGM) =====
// 데이터: js/data/cutscenes.js (RECRUIT_STORIES, CUTSCENE_VOICES, CUTSCENE_SFX, CUTSCENE_BGM, CUTSCENE_RULES)
// - 장면은 데이터 순서대로 재생. 시작 시 모든 그림을 미리 불러옴
// - 그림은 승인본 그대로: 잘리지 않게 화면 안에 맞추고(contain), 남는 곳은 같은 그림을 흐리고 어둡게 깔아 채움
// - 스킵/종료: 예약된 타이머, 음성, 효과음, BGM 을 모두 멈춤. 영입 저장은 컷신 시작 전에 이미 끝남(single.js)
// - 음량: 음성(voice) / 배경음(bgm) / 효과음(sfx) 따로 (로비 설정 + 컷신 안 소리 버튼)

const cs = { run: 0, timers: [], srcs: [], bgm: null, story: null, idx: 0, buf: {}, gain: null, voiceGain: null, bgmGain: null, front: 0, utter: null };

// 음량 노드: 효과음은 게임 효과음 음량, 음성은 음성 음량, BGM 은 배경음 음량을 따름
function csNodes() {
  if (!audio.ctx || cs.gain) return;
  cs.gain = audio.ctx.createGain();
  cs.gain.connect(audio.sfxGain);
  cs.voiceGain = audio.ctx.createGain();
  cs.voiceGain.connect(audio.master);
  cs.bgmGain = audio.ctx.createGain();
  cs.bgmGain.connect(audio.master);
  csApplyVolumes();
}
function csApplyVolumes() {
  if (!cs.gain) return;
  const s = audio.settings, t = audio.ctx.currentTime;
  cs.voiceGain.gain.setTargetAtTime(s.voice ?? 0.9, t, 0.02);
  cs.bgmGain.gain.setTargetAtTime(s.bgm * CUTSCENE_BGM.vol, t, 0.02);
}
// 컷신 소리 디코딩 (처음 한 번)
function csLoad(key, src) {
  if (cs.buf[key] || !audio.ctx || !src) return Promise.resolve(cs.buf[key]);
  const job = src.startsWith("data:") ? Promise.resolve(dataUriToBuffer(src)) : fetch(src).then((r) => r.arrayBuffer());
  return job.then((ab) => audio.ctx.decodeAudioData(ab)).then((b) => (cs.buf[key] = b)).catch(() => null);
}
function csPreloadAudio(story) {
  if (!audio.ctx) return;
  csNodes();
  csLoad("__bgm", CUTSCENE_BGM.src);
  for (const sc of story.scenes) {
    for (const [, id] of sc.sfx) csLoad(id, CUTSCENE_SFX[id]?.src);
    for (const v of sc.voice) if (v[3]) csLoad("voice:" + v[3], v[3]);
  }
}
function csPlayBuf(key, node, vol = 1, loop = false) {
  const b = cs.buf[key];
  if (!b || !audio.ctx || audio.settings.muted) return null;
  const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain();
  s.buffer = b;
  s.loop = loop;
  g.gain.value = vol;
  s.connect(g).connect(node);
  s.start();
  cs.srcs.push(s);
  s.onended = () => (cs.srcs = cs.srcs.filter((x) => x !== s));
  return { s, g };
}
function csSfx(id) {
  if (CUTSCENE_RULES.shakeOn.includes(id)) csShake();
  csPlayBuf(id, cs.gain, CUTSCENE_SFX[id]?.vol ?? 0.9);
}
function csBgm(want) {
  if (want) {
    if (!cs.bgm) cs.bgm = csPlayBuf("__bgm", cs.bgmGain, 1, true);
  } else if (cs.bgm) {
    // 툭 끊기 (코믹 정적)
    const { s, g } = cs.bgm, t = audio.ctx.currentTime;
    g.gain.setTargetAtTime(0, t, CUTSCENE_RULES.bgmStopFade / 3);
    try {
      s.stop(t + CUTSCENE_RULES.bgmStopFade);
    } catch (e) {}
    cs.bgm = null;
  }
}

// ----- 음성: 녹음 파일 우선, 없으면 브라우저 한국어 음성(임시) -----
const MALE_HINT = /male|남|injoon|minho|hyunsu|bongjin|gookmin|jinho|seojin/i, FEMALE_HINT = /female|여|yuna|sunhi|heami|sora|jimin|seoyeon|jiyoung|yujin/i;
function csPickVoice(who) {
  const list = (window.speechSynthesis?.getVoices() || []).filter((v) => v.lang.toLowerCase().startsWith("ko"));
  if (!list.length) return null;
  const V = CUTSCENE_VOICES[who] || {};
  for (const name of V.prefer || []) {
    const hit = list.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  const hint = V.gender === "m" ? MALE_HINT : V.gender === "f" ? FEMALE_HINT : null;
  return (hint && list.find((v) => hint.test(v.name))) || list[0];
}
function csSpeak(line) {
  const [, who, text, file] = line;
  if (file && cs.buf["voice:" + file]) return csPlayBuf("voice:" + file, cs.voiceGain, 1);
  if (!CUTSCENE_RULES.ttsFallback || !window.speechSynthesis || audio.settings.muted) return;
  const vol = audio.settings.voice ?? 0.9;
  if (vol <= 0) return;
  try {
    const V = CUTSCENE_VOICES[who] || {}, u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    const voice = csPickVoice(who);
    if (voice) u.voice = voice;
    u.pitch = V.pitch ?? 1;
    u.rate = V.rate ?? 1;
    u.volume = vol;
    speechSynthesis.speak(u); // 음성 미지원이어도 컷신은 그대로 진행
  } catch (e) {}
}

// ----- 화면 -----
function csLater(fn, sec) {
  const tok = cs.run;
  cs.timers.push(setTimeout(() => tok === cs.run && fn(), sec * 1000));
}
function csFit(frame, size) {
  const st = el("csStory"), W = st.clientWidth, H = st.clientHeight, k = CUTSCENE_RULES.fit;
  const s = Math.min(W * k / size[0], H * k / size[1]);
  frame.style.width = size[0] * s + "px";
  frame.style.height = size[1] * s + "px";
}
function csCamera(frame, sc) {
  const R = CUTSCENE_RULES, d = sc.t * 1000;
  frame.getAnimations().forEach((a) => a.cancel());
  let kf;
  if (sc.motion === "pan") kf = [{ transform: `translate(-50%,-50%) translateX(${R.pan.move * 100}%) scale(${R.pan.scale})` }, { transform: `translate(-50%,-50%) translateX(${-R.pan.move * 100}%) scale(${R.pan.scale})` }];
  else if (sc.motion === "zoom") kf = [{ transform: `translate(-50%,-50%) scale(${R.zoom.from})` }, { transform: `translate(-50%,-50%) scale(${R.zoom.to})`, offset: 0.35 }, { transform: `translate(-50%,-50%) scale(${R.zoom.to})` }];
  else if (sc.motion === "shake") kf = [{ transform: `translate(-50%,-50%) scale(${R.shake.scale})` }, { transform: `translate(-50%,-50%) scale(${R.shake.scale})` }];
  else kf = [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: `translate(-50%,-50%) scale(${R.still.to})` }];
  frame.animate(kf, { duration: d, easing: sc.motion === "zoom" ? "cubic-bezier(.2,.8,.3,1)" : "ease-in-out", fill: "forwards" });
}
// 흔들림은 바깥 껍데기에 (카메라 움직임과 겹치지 않게)
function csShake() {
  const R = CUTSCENE_RULES.shake, px = R.px, sh = el("csShake");
  sh.getAnimations().forEach((a) => a.cancel());
  sh.animate([0, -1, 1, -0.8, 0.7, -0.4, 0.3, 0].map((k, i) => ({ transform: `translate(${k * px}px, ${(i % 2 ? 1 : -1) * k * px * 0.5}px)` })), { duration: R.dur * 1000, easing: "linear" });
}
function csShowScene(i) {
  const st = cs.story, sc = st.scenes[i];
  cs.idx = i;
  // 장면이 바뀌면 이전 장면 효과음·음성은 정리 (BGM 은 데이터대로)
  for (const s of cs.srcs) if (!cs.bgm || s !== cs.bgm.s) try {
    s.stop();
  } catch (e) {}
  cs.srcs = cs.bgm ? [cs.bgm.s] : [];
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {}
  // 겹쳐 바뀌기: 앞/뒤 프레임 번갈아 사용
  cs.front ^= 1;
  const frames = [el("csFrameA"), el("csFrameB")], fr = frames[cs.front], old = frames[cs.front ^ 1];
  const img = fr.querySelector("img");
  img.src = csImg(sc.img);
  csFit(fr, sc.size);
  // 원본 번호/타임코드 가리기 (그림 픽셀 → 비율)
  const cov = fr.querySelector(".cs-cover");
  cov.hidden = !sc.cover;
  if (sc.cover) {
    cov.style.width = (100 * st.label[0] / sc.size[0]) + "%";
    cov.style.height = (100 * st.label[1] / sc.size[1]) + "%";
    cov.textContent = `${i + 1} / ${st.scenes.length}`;
  }
  el("csBlur").style.backgroundImage = `url("${csImg(sc.img)}")`;
  fr.style.zIndex = 2;
  old.style.zIndex = 1;
  const f = CUTSCENE_RULES.fade * 1000;
  fr.getAnimations().forEach((a) => a.cancel());
  fr.style.opacity = 1;
  fr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: f, easing: "ease-out" });
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: f, fill: "forwards" });
  csCamera(fr, sc);
  if (sc.unlock) {
    const fl = el("csFlash");
    fl.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: CUTSCENE_RULES.unlockFlash * 1000, easing: "ease-out" });
  }
  if (sc.motion === "shake" && !sc.sfx.some(([, id]) => CUTSCENE_RULES.shakeOn.includes(id))) csShake();
  csBgm(sc.bgm === "play");
  for (const [at, id] of sc.sfx) csLater(() => csSfx(id), at);
  for (const v of sc.voice) csLater(() => csSpeak(v), v[0]);
  // 진행 막대
  const total = st.scenes.reduce((a, s) => a + s.t, 0), done = st.scenes.slice(0, i).reduce((a, s) => a + s.t, 0);
  const bar = el("csBar");
  bar.getAnimations().forEach((a) => a.cancel());
  bar.animate([{ width: (100 * done / total) + "%" }, { width: (100 * (done + sc.t) / total) + "%" }], { duration: sc.t * 1000, fill: "forwards" });
  csLater(() => (i + 1 < st.scenes.length ? csShowScene(i + 1) : endCutscene()), sc.t);
}
// 그림 경로 → 미리 불러 둔 Image 의 src (빌드에서는 data URI)
const csImgCache = {};
function csImg(src) {
  if (!csImgCache[src]) csImgCache[src] = Object.assign(new Image(), { src, decoding: "async" });
  return csImgCache[src].src;
}

function playStory(id, done) {
  const st = RECRUIT_STORIES[id];
  csStop();
  cs.story = st;
  csId = id;
  csDone = done;
  for (const sc of st.scenes) csImg(sc.img); // 장면 그림 미리 불러오기
  el("cutscene").hidden = false;
  el("cutscene").classList.add("story");
  el("csStory").hidden = false;
  el("csTitle").textContent = `${st.name} · ${st.title}`;
  document.body.classList.add("csOpen");
  audio.holdBgm = true;
  stopBgm();
  if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
  csPreloadAudio(st);
  try {
    speechSynthesis.getVoices();
  } catch (e) {}
  // 소리 디코딩이 늦어도 시작은 바로. 첫 장면 BGM 은 준비되는 대로 (최대 0.6초 기다림)
  const tok = cs.run;
  let started = false;
  const go = () => {
    if (started || tok !== cs.run) return;
    started = true;
    csShowScene(0);
  };
  Promise.race([csLoad("__bgm", CUTSCENE_BGM.src), new Promise((r) => setTimeout(r, 600))]).then(go);
}
// 재생 중인 것 전부 정지 (스킵·종료·다른 컷신 시작)
function csStop() {
  cs.run++;
  cs.timers.forEach(clearTimeout);
  cs.timers = [];
  for (const s of cs.srcs) try {
    s.stop();
  } catch (e) {}
  cs.srcs = [];
  cs.bgm = null;
  try {
    window.speechSynthesis?.cancel();
  } catch (e) {}
  for (const id of ["csFrameA", "csFrameB", "csBar", "csShake"]) el(id)?.getAnimations().forEach((a) => a.cancel());
}
function csCloseStory() {
  csStop();
  cs.story = null;
  el("csStory").hidden = true;
  el("cutscene").classList.remove("story");
  el("csVol").hidden = true;
  audio.holdBgm = false;
  syncBgm(true);
}

// 컷신 안 소리 조절 (음성 / 배경음 / 효과음)
(function bindCsVolume() {
  const box = el("csVol");
  el("csVolBtn").onclick = (e) => {
    e.stopPropagation();
    box.hidden = !box.hidden;
    for (const k of ["voice", "bgm", "sfx"]) el("csVol_" + k).value = Math.round((audio.settings[k] ?? 0.9) * 100);
  };
  for (const k of ["voice", "bgm", "sfx"]) el("csVol_" + k).oninput = (e) => {
    setAudio(k, e.target.value / 100);
    if (typeof bindAudioUI === "function") bindAudioUI();
  };
})();
addEventListener("resize", () => {
  if (!cs.story) return;
  const sc = cs.story.scenes[cs.idx];
  csFit([el("csFrameA"), el("csFrameB")][cs.front], sc.size);
});
