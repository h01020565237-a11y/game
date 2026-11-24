// 소환사 덱 편집 UI

const ui = document.querySelector("#deckUI");
ui.innerHTML = "덱: " + deck.map((v, i) => `<select id="slot${i}">${mons.map((m, j) => `<option value="${j}" ${v === j ? "selected" : ""}>${m[0]}</option>`).join("")}</select>`).join(" ") + ' <button id="applyDeck">덱 적용 및 재시작</button> <span id="petHUD"></span>';
document.querySelector("#applyDeck").onclick = () => {
  let d = deck.map((_, i) => +document.querySelector("#slot" + i).value);
  if (new Set(d).size !== 3) {
    alert("서로 다른 포켓몬 3마리를 선택하세요.");
    return;
  }
  deck = d;
  document.body.classList.remove("menuOpen");
  reset();
};
