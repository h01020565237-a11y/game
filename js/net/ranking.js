// ===== 닉네임·랭킹 통신 (js/data/ranking.js) =====
// - 프로필(localStorage battlelab.profile): { playerId(UUID 1개), token(UUID 2개 연결), nickname, registered }
// - 서버 연결 실패해도 게임은 그대로: 닉네임은 기기에 저장(registered:false)해 두고 나중에 등록 재시도
// - 기록 등록 실패 → battlelab.rankQueue 에 보관, 다음 기회(랭킹 열기·결과 화면·게임 시작)에 재전송
// - QA 테스트(전체 해금) 판과 싱글 미션 기록은 온라인 등록 안 함
const PROFILE_KEY = "battlelab.profile", RANK_QUEUE_KEY = "battlelab.rankQueue";
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
let profile = (() => {
  try {
    const s = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (s && s.playerId && s.token) return s;
  } catch (e) {}
  return null;
})();
function saveProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}
}
function ensureIds() {
  if (!profile) profile = { playerId: uuid(), token: uuid() + uuid(), nickname: "", registered: false };
  return profile;
}
// 닉네임 검사 (화면 검사; 중복은 서버가 판단)
function nickError(n) {
  const N = RANKING.nick, len = [...n].length;
  if (len < N.min || len > N.max) return `${N.min}~${N.max}자로 입력해 주세요`;
  if (!N.pattern.test(n)) return "한글·영문·숫자만 쓸 수 있어요";
  return "";
}
// ----- 서버 요청 -----
// GAS 웹 앱은 script.google.com → 302 → script.googleusercontent.com 으로 넘김. fetch 가 따라가며, 응답은 CORS 허용
// POST 는 '단순 요청'(text/plain)이라 사전 요청(preflight) 없이 감
async function rankFetch(opts, query = "") {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), RANKING.timeout);
  try {
    const res = await fetch(RANKING.url + query, { ...opts, redirect: "follow", signal: ctl.signal, cache: "no-store" });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("서버 응답을 읽을 수 없어요");
    }
    if (!res.ok || data.ok === false || data.success === false || data.error) throw new Error(rankErrorText(data.error || data.message || data.code || `HTTP ${res.status}`));
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("서버 응답이 늦어요");
    if (e instanceof TypeError) throw new Error("서버에 연결할 수 없어요");
    throw e;
  } finally {
    clearTimeout(t);
  }
}
function rankErrorText(e) {
  const s = String(e);
  if (/dup|taken|exist|중복|사용 ?중/i.test(s)) return "이미 사용 중인 닉네임이에요";
  if (/auth|token|unauth|권한|인증/i.test(s)) return "인증 정보가 맞지 않아요";
  if (/invalid|length|형식|글자/i.test(s)) return "닉네임 형식을 확인해 주세요";
  return s;
}
const rankPost = (body) => rankFetch({ method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body) });
const rankGet = (q) => rankFetch({ method: "GET" }, "?" + new URLSearchParams(q).toString());
async function rankHealth() {
  return rankGet({ action: "health" });
}
async function registerNickname(nickname) {
  const P = ensureIds();
  await rankPost({ action: "register", playerId: P.playerId, token: P.token, nickname });
  P.nickname = nickname;
  P.registered = true;
  saveProfile();
}
async function renameNickname(nickname) {
  const P = ensureIds();
  if (!P.registered) return registerNickname(nickname); // 아직 서버에 없으면 등록으로
  await rankPost({ action: "rename", playerId: P.playerId, token: P.token, nickname });
  P.nickname = nickname; // 기록은 playerId 기준이라 그대로 유지
  saveProfile();
}
// 서버 연결 실패 시: 닉네임만 기기에 두고 게임 진행 (나중에 등록)
function keepNicknameOffline(nickname) {
  const P = ensureIds();
  P.nickname = nickname;
  P.registered = false;
  saveProfile();
}
// ----- 랭킹 목록 -----
// 서버 응답 모양이 조금 달라도 읽을 수 있게 (ranking|rows|data|list|배열), 필드 이름도 몇 가지 허용
function normRow(r) {
  const n = (v) => +v || 0;
  return {
    playerId: r.playerId || r.player_id || r.id || "",
    nickname: String(r.nickname ?? r.nick ?? r.name ?? "?"),
    character: r.character || r.char || "",
    wave: n(r.wave), time: n(r.time ?? r.survival ?? r.seconds), level: n(r.level ?? r.lv), kills: n(r.kills ?? r.kill),
  };
}
const rankSort = (a, b) => b.wave - a.wave || b.kills - a.kills || b.time - a.time;
const rankCache = {};
async function fetchRanking(ch, force) {
  const C = rankCache[ch];
  if (!force && C && performance.now() - C.at < RANKING.cacheSec * 1000) return C.rows;
  const data = await rankGet({ action: "ranking", character: ch });
  const list = Array.isArray(data) ? data : data.ranking || data.rows || data.data || data.list || data.items || [];
  // 같은 사람 중복 방지(최고 기록 1개만) + 정렬 + 최대 100위
  const best = new Map();
  for (const raw of list) {
    const r = normRow(raw), key = r.playerId || r.nickname;
    const o = best.get(key);
    if (!o || rankSort(r, o) < 0) best.set(key, r);
  }
  const rows = [...best.values()].sort(rankSort).slice(0, RANKING.top);
  rankCache[ch] = { at: performance.now(), rows };
  return rows;
}
// ----- 기록 등록 (실패 시 대기열) -----
function rankQueue() {
  try {
    return JSON.parse(localStorage.getItem(RANK_QUEUE_KEY)) || [];
  } catch (e) {
    return [];
  }
}
function setRankQueue(q) {
  try {
    localStorage.setItem(RANK_QUEUE_KEY, JSON.stringify(q.slice(-20)));
  } catch (e) {}
}
// 웨이브 판 종료 시 (QA·싱글 제외). 같은 캐릭터는 더 좋은 기록만 남김
function queueWaveRecord(rec) {
  const q = rankQueue().filter((x) => !(x.character === rec.character && rankSort(x, rec) <= 0));
  if (!q.some((x) => x.character === rec.character)) q.push(rec);
  setRankQueue(q);
}
let rankSending = false;
async function flushRankQueue() {
  if (rankSending || !profile?.nickname) return { sent: 0, left: rankQueue().length };
  rankSending = true;
  let sent = 0, err = "";
  try {
    if (!profile.registered) await registerNickname(profile.nickname); // 오프라인으로 시작했던 닉네임 등록
    for (const rec of rankQueue()) {
      await rankPost({ action: "submit", playerId: profile.playerId, token: profile.token, character: rec.character, wave: rec.wave, time: rec.time, level: rec.level, kills: rec.kills });
      setRankQueue(rankQueue().filter((x) => x !== rec && !(x.character === rec.character && x.wave === rec.wave && x.kills === rec.kills && x.time === rec.time)));
      sent++;
      for (const k of ["all", rec.character]) delete rankCache[k];
    }
  } catch (e) {
    err = e.message;
  } finally {
    rankSending = false;
  }
  return { sent, left: rankQueue().length, err };
}
