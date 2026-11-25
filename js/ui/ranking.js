// 웨이브 랭킹 UI: Apps Script GET API 연동. 닉네임 등록/기록 POST는 별도 계정 모듈에서 담당.
// 계정 모듈은 등록/변경 완료 후 JuyeopRankingUI.setNickname(nickname) 호출.
// 서버 응답: {ok:true,character,ranking:[{rank,nickname,character,wave,time,level,kills}]}.
const JuyeopRankingUI = (() => {
  const API = "https://script.google.com/macros/s/AKfycbwNbdh8exke0WeZPmRokyOWLeZhg9jBtISFDJ9gDVbwHnHMTUvP9KuZmVOeT8tkPwluOA/exec";
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const style = make("style");
  style.textContent = `
    #lobbyRankBtn[hidden],#waveRanking[hidden],#waveRanking [hidden]{display:none!important}
    #lobbyRankBtn{position:absolute;top:clamp(6px,2.4cqh,16px);right:calc(clamp(8px,2cqw,20px) + clamp(34px,9.5cqh,48px) + 14px);z-index:3;height:clamp(34px,9.5cqh,48px);padding:0 clamp(12px,2cqw,20px);border:2px solid #ffe8a0;border-radius:999px;background:linear-gradient(#ffe57c,#ecad2c);color:#392600;font:inherit;font-size:clamp(13px,3.8cqh,18px);box-shadow:0 3px 0 #81561e;cursor:pointer;display:flex;align-items:center;gap:6px}
    #waveRanking{z-index:45;inset:0;box-sizing:border-box;padding:2.2%;background:radial-gradient(ellipse at 50% 0%,#375fac,#172c69 50%,#0d1636);gap:0;justify-content:stretch}
    #waveRanking .rank-card{width:min(96%,980px);height:100%;min-height:0;box-sizing:border-box;display:flex;flex-direction:column;gap:clamp(4px,1.3cqh,10px);padding:clamp(8px,2.1cqh,17px);overflow:hidden}
    #waveRanking .rank-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;flex:none}
    #waveRanking .rank-head h2{display:block;margin:0;font-size:clamp(19px,5.3cqh,30px);color:#ffdc75;text-shadow:0 2px #725019;text-align:center}
    #waveRanking .rank-head button{font-size:clamp(11px,3cqh,15px);min-height:30px;padding:5px 12px;width:max-content}
    #waveRanking .rank-head button:last-child{justify-self:end}
    #waveRanking .rank-tabs{display:flex;gap:6px;flex:none}
    #waveRanking .rank-tabs button{flex:1;min-height:30px;padding:4px 8px;font-size:clamp(13px,3.6cqh,17px);border-radius:10px;background:#111e4e;border:1px solid #7ca3ec;color:#d6e7ff;cursor:pointer;font-family:inherit}
    #waveRanking .rank-tabs button[aria-pressed=true]{background:linear-gradient(#ffe88c,#efb53f);border-color:#ffeaa3;color:#3c2700;box-shadow:0 2px #88551c}
    #waveRanking .rank-filters{display:flex;gap:5px;overflow-x:auto;flex:none;padding:1px 0 3px;touch-action:pan-x;scrollbar-width:thin}
    #waveRanking .rank-filter{flex:1 0 auto;display:flex;align-items:center;gap:5px;min-height:29px;padding:3px 7px;color:#dbeaff;background:#162957;border:1px solid #577eb9;border-radius:8px;font:inherit;font-size:clamp(11px,3.1cqh,14px);cursor:pointer}
    #waveRanking .rank-filter[aria-pressed=true]{border-color:#ffdf67;background:#425a98;color:#ffe27c}
    #waveRanking .rank-filter img,#waveRanking .rank-character img{width:clamp(22px,6.5cqh,33px);height:clamp(22px,6.5cqh,33px);object-fit:cover;border-radius:6px;background:#254779;flex:none}
    #waveRanking .rank-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:thin;background:#101d46;border:1px solid #6182b9;border-radius:10px}
    #waveRanking .rank-grid{display:grid;grid-template-columns:.55fr minmax(0,1.45fr) minmax(0,1.1fr) .8fr .85fr .65fr .8fr;align-items:center;gap:5px;padding:5px 8px;text-align:center;font-size:clamp(11px,3.1cqh,15px);min-width:0}
    #waveRanking .rank-labels{position:sticky;top:0;background:#263b75;color:#c4dbff;font-size:clamp(10px,2.8cqh,13px);z-index:1;border-bottom:1px solid #6289cb}
    #waveRanking .rank-row{min-height:clamp(30px,8.2cqh,44px);border-bottom:1px solid #49669d55;color:#f3f6ff;box-sizing:border-box}
    #waveRanking .rank-row:nth-child(even){background:#21346465}
    #waveRanking .rank-row.top-one{background:linear-gradient(90deg,#61482088,#4b3b2799);color:#ffe6a0}
    #waveRanking .rank-row.top-two{background:#a1b8d51a}
    #waveRanking .rank-row.top-three{background:#be865b23}
    #waveRanking .rank-row.mine{box-shadow:inset 0 0 0 2px #69e9bf;background:#174f58}
    #waveRanking .rank-place{font-size:clamp(14px,4cqh,20px);font-weight:bold}
    #waveRanking .rank-nick{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
    #waveRanking .rank-character{display:flex;align-items:center;justify-content:center;gap:4px;min-width:0;white-space:nowrap}
    #waveRanking .rank-wave{color:#ffdc75;font-weight:bold}
    #waveRanking .rank-status{display:grid;place-items:center;text-align:center;min-height:70px;padding:12px;color:#c8ddff;font-size:clamp(13px,3.5cqh,17px)}
    #waveRanking .rank-foot{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;color:#c5ddff;font-size:clamp(10px,2.8cqh,13px);white-space:normal}
    #waveRanking .rank-personal{color:#ffdf75;text-align:right}
    @media (max-height:390px) and (orientation:landscape){#waveRanking .rank-card{gap:4px;padding:7px}#waveRanking .rank-grid{padding:3px 6px}#waveRanking .rank-filter img{display:none}}
  `;
  document.head.append(style);
  const launch = make("button","","🏆 랭킹");
  launch.type = "button"; launch.id = "lobbyRankBtn"; launch.hidden = true;
  launch.setAttribute("aria-haspopup","dialog");
  el("lobby").append(launch);
  const screen = make("section","screen");
  screen.id = "waveRanking"; screen.hidden = true;
  screen.setAttribute("role","dialog"); screen.setAttribute("aria-modal","true");
  screen.setAttribute("aria-labelledby","waveRankingTitle");
  screen.innerHTML = `
    <div class="panel rank-card">
      <div class="rank-head">
        <button type="button" class="btn btn-ghost" id="rankClose">◀ 뒤로</button>
        <h2 id="waveRankingTitle">🏆 웨이브 랭킹</h2>
        <button type="button" class="btn btn-ghost" id="rankRefresh">↻ 새로고침</button>
      </div>
      <div class="rank-tabs">
        <button type="button" id="rankAll" aria-pressed="true">전체 랭킹</button>
        <button type="button" id="rankByChar" aria-pressed="false">캐릭터별 랭킹</button>
      </div>
      <div class="rank-filters" id="rankFilters" hidden></div>
      <div class="rank-scroll" tabindex="0" aria-label="랭킹 목록">
        <div class="rank-grid rank-labels" aria-hidden="true"><span>순위</span><span>닉네임</span><span>캐릭터</span><span>웨이브</span><span>생존 시간</span><span>레벨</span><span>처치</span></div>
        <div id="rankRows"></div>
        <div id="rankStatus" class="rank-status" role="status" aria-live="polite" hidden></div>
      </div>
      <div class="rank-foot"><span id="rankAccount">온라인 랭킹 · TOP 100</span><span class="rank-personal" id="rankPersonal"></span></div>
    </div>`;
  el("arena").append(screen);
  let category = "all", selectedChar = "suit", nickname = "", requestId = 0, controller = null, savedInert = false, lastRows = [];
  const ids = () => LOBBY_ORDER.filter(k => Object.prototype.hasOwnProperty.call(DISPLAY_NAMES,k));
  const name = k => DISPLAY_NAMES[k] || "캐릭터";
  const face = k => {
    const art = LOBBY_ART[k];
    if (!art?.face) return null;
    const img = make("img");
    img.src = art.face; img.alt = ""; img.loading = "lazy";
    img.onerror = () => img.remove();
    return img;
  };
  const validNumber = n => typeof n === "number" && Number.isFinite(n) && n >= 0;
  const compare = (a,b) => b.wave-a.wave || b.time-a.time || b.kills-a.kills;
  function showPersonal() {
    const own = nickname && lastRows.find(r => r.nickname === nickname);
    el("rankAccount").textContent = nickname ? "내 닉네임: "+nickname+(own?" · "+own.rank+"위":"") : "온라인 랭킹 · TOP 100";
    const records = endlessSave.best || {};
    const rec = category === "all" ? Object.values(records).sort(compare)[0] : records[selectedChar];
    el("rankPersonal").textContent = rec ? "내 기기 최고 W"+rec.wave+" · "+fmtTime(rec.time) : "내 기기 기록 없음";
  }
  function renderRows(rows) {
    el("rankRows").replaceChildren();
    for (const r of rows) {
      const row = make("div","rank-grid rank-row"+(r.rank===1?" top-one":r.rank===2?" top-two":r.rank===3?" top-three":"")+(nickname && r.nickname===nickname?" mine":""));
      const rank = make("span","rank-place",["🥇","🥈","🥉"][r.rank-1] || r.rank+"위");
      rank.setAttribute("aria-label",r.rank+"위");
      const nick = make("span","rank-nick",r.nickname);
      nick.title = r.nickname;
      const char = make("span","rank-character"), img = face(r.character);
      if (img) char.append(img);
      char.append(make("span","",name(r.character)));
      row.append(rank,nick,char,make("span","rank-wave","W"+r.wave),make("span","",fmtTime(r.time)),make("span","","Lv"+r.level),make("span","",r.kills.toLocaleString("ko-KR")));
      el("rankRows").append(row);
    }
    showPersonal();
  }
  function status(message) {
    const node = el("rankStatus");
    node.hidden = !message; node.textContent = message;
  }
  function syncTabs() {
    el("rankAll").setAttribute("aria-pressed",String(category==="all"));
    el("rankByChar").setAttribute("aria-pressed",String(category==="character"));
    el("rankFilters").hidden = category==="all";
    for (const b of el("rankFilters").children) b.setAttribute("aria-pressed",String(b.dataset.character===selectedChar));
    showPersonal();
  }
  function buildFilters() {
    const bar = el("rankFilters"); bar.replaceChildren();
    for (const k of ids()) {
      const b = make("button","rank-filter");
      b.type="button"; b.dataset.character=k;
      const img = face(k);
      if (img) b.append(img);
      b.append(make("span","",name(k)));
      b.onclick = () => { selectedChar=k; syncTabs(); load(); };
      bar.append(b);
    }
    syncTabs();
  }
  async function load() {
    const seq = ++requestId;
    if (controller) controller.abort();
    controller = new AbortController();
    const current = controller, timeout = setTimeout(() => current.abort(),12000);
    const ch = category==="all" ? "all" : selectedChar;
    lastRows=[]; renderRows([]); status("랭킹을 불러오는 중…");
    el("rankRefresh").disabled=true;
    try {
      const response = await fetch(API+"?action=ranking&character="+encodeURIComponent(ch),{signal:current.signal,cache:"no-store",credentials:"omit"});
      if (!response.ok) throw new Error("HTTP "+response.status);
      const data=await response.json();
      if (!data.ok || !Array.isArray(data.ranking)) throw new Error("INVALID_RESPONSE");
      if (seq!==requestId || screen.hidden) return;
      lastRows=data.ranking.filter(r=>Number.isInteger(r.rank)&&r.rank>=1&&typeof r.nickname==="string"&&ids().includes(r.character)&&[r.wave,r.time,r.level,r.kills].every(validNumber)).slice(0,100);
      renderRows(lastRows);
      status(lastRows.length ? "" : "아직 등록된 기록이 없습니다. 첫 기록에 도전하세요!");
    } catch (_) {
      if (seq===requestId && !screen.hidden) status("랭킹 서버에 연결할 수 없습니다. 새로고침을 눌러 다시 시도하세요.");
    } finally {
      clearTimeout(timeout);
      if (seq===requestId) { el("rankRefresh").disabled=false; controller=null; }
    }
  }
  function open() {
    if (lobbyMode!=="wave" || !isLobbyOpen() || !screen.hidden) return;
    el("lobbyFoot").hidden=true;
    category="all"; selectedChar=ids().includes(lobbySel)?lobbySel:ids()[0];
    savedInert=el("lobby").inert; el("lobby").inert=true;
    screen.hidden=false; buildFilters(); load(); el("rankClose").focus({preventScroll:true}); sfx("ui_click");
  }
  function close() {
    ++requestId; if (controller) controller.abort(); controller=null;
    screen.hidden=true; el("lobby").inert=savedInert;
    launch.focus({preventScroll:true}); sfx("ui_click");
  }
  launch.onclick=open;
  el("rankClose").onclick=close; el("rankRefresh").onclick=load;
  el("rankAll").onclick=()=>{category="all";syncTabs();load();};
  el("rankByChar").onclick=()=>{category="character";syncTabs();load();};
  document.addEventListener("keydown",e=>{
    if (screen.hidden) return;
    if(e.code==="Escape"){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)close();return;}
    if(e.code==="Tab"){
      const nodes=[...screen.querySelectorAll("button:not([disabled]),[tabindex='0']")].filter(n=>!n.closest("[hidden]"));
      const first=nodes[0],last=nodes[nodes.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      e.stopImmediatePropagation();return;
    }
    // 버튼의 기본 Enter/Space 동작은 허용하되 게임 키 처리로 전달하지 않는다.
    e.stopImmediatePropagation();
  },true);
  return {
    syncLobby(){launch.hidden=lobbyMode!=="wave";},
    setNickname(value){nickname=typeof value==="string"?value:"";if(!screen.hidden)renderRows(lastRows);},
    open,close
  };
})();
