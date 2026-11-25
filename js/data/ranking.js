// ===== 닉네임·웨이브 랭킹 (Google Apps Script 서버, 2026-11-25 요청서) =====
// 서버 규격: GET ?action=health | ?action=ranking&character=all|suit…
//            POST(본문 JSON, Content-Type text/plain;charset=UTF-8) action=register|rename|submit
// 정렬(화면): 도달 웨이브 → 처치 수 → 생존 시간 (최신 통합 요청서 6장. 이전 요청서는 웨이브 → 생존 시간 → 처치 수 — 충돌, 최신 기준)
const RANKING = {
  url: "https://script.google.com/macros/s/AKfycbwNbdh8exke0WeZPmRokyOWLeZhg9jBtISFDJ9gDVbwHnHMTUvP9KuZmVOeT8tkPwluOA/exec",
  timeout: 9000,        // 요청 제한 시간(ms). 실패해도 게임은 계속
  top: 100,             // 최대 표시 순위
  nick: { min: 2, max: 12, pattern: /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_\-. ]+$/ }, // 한글·영문·숫자 (+ 공백·_-.)
  cacheSec: 20,         // 같은 탭을 다시 열 때 이 시간 안이면 다시 안 불러옴
  characters: ["all", "suit", "summoner", "support", "runner", "octo", "stripe", "bear", "soccer"],
};
