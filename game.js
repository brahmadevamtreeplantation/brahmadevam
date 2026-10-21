(() => {
  "use strict";

  const Chess = window.ChessEngine;
  const boardElement = document.querySelector("#chess-board");
  const ui = {
    blackCard: document.querySelector("#player-black"),
    whiteCard: document.querySelector("#player-white"),
    blackClock: document.querySelector("#black-clock"),
    whiteClock: document.querySelector("#white-clock"),
    blackTurn: document.querySelector("#black-turn"),
    whiteTurn: document.querySelector("#white-turn"),
    turnTitle: document.querySelector("#turn-title"),
    turnMessage: document.querySelector("#turn-message"),
    turnIcon: document.querySelector("#turn-icon"),
    gameStatus: document.querySelector("#game-status-label"),
    matchState: document.querySelector("#match-state"),
    matchTitle: document.querySelector("#match-title"),
    moveList: document.querySelector("#move-list"),
    moveCount: document.querySelector("#move-count"),
    whiteCaptures: document.querySelector("#white-captures"),
    blackCaptures: document.querySelector("#black-captures"),
    whiteMaterial: document.querySelector("#white-material"),
    blackMaterial: document.querySelector("#black-material"),
    undo: document.querySelector("#undo-button"),
    computerBlackMode: document.querySelector("#mode-computer-black"),
    computerWhiteMode: document.querySelector("#mode-computer-white"),
    localMode: document.querySelector("#mode-local"),
    whiteName: document.querySelector("#player-white .player-name"),
    blackName: document.querySelector("#player-black .player-name"),
    boardFooter: document.querySelector("#board-side-label"),
    winnerBanner: document.querySelector("#winner-banner"),
    winnerMessage: document.querySelector("#winner-message"),
    promotionDialog: document.querySelector("#promotion-dialog"),
    promotionOptions: document.querySelector("#promotion-options")
  };
  const GLYPHS = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
  };
  const PIECE_NAMES = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const PROMOTION_TYPES = ["q", "r", "b", "n"];
  const INCREMENT = 10;
  const START_TIME = 10 * 60;
  const squares = [];
  let state;
  let selected = null;
  let flipped = false;
  let gameMode = "computer-black";
  let aiPending = false;
  let gameOver = false;
  let currentStatus = "playing";
  let history = [];
  let movesPlayed = [];
  let clockSeconds = [START_TIME, START_TIME];
  let clockStarted = false;
  let lastClockTick = 0;
  let clockInterval;
  let pendingPromotion = null;

  function setMode(mode) {
    if (gameMode === mode) return;
    gameMode = mode;
    newGame();
  }

  function getAiSide() {
    if (gameMode === "computer-black") return "b";
    if (gameMode === "computer-white") return "w";
    return null;
  }

  function isHumanTurn() {
    const aiSide = getAiSide();
    return aiSide === null || state.turn !== aiSide;
  }

  function createBoard() {
    for (let screenRank = 0; screenRank < 8; screenRank++) {
      for (let screenFile = 0; screenFile < 8; screenFile++) {
        const square = document.createElement("button");
        square.type = "button";
        square.className = "square";
        square.setAttribute("role", "gridcell");
        square.addEventListener("click", () => handleSquare(Number(square.dataset.index)));
        boardElement.append(square);
        squares.push(square);
      }
    }
  }

  function screenSquare(screenRank, screenFile) {
    const rank = flipped ? screenRank : 7 - screenRank;
    const file = flipped ? 7 - screenFile : screenFile;
    return rank * 8 + file;
  }

  function renderBoard() {
    const legal = selected === null ? [] : Chess.legalMoves(state, selected);
    const destinations = new Set(legal.map(move => move.to));
    const checkedKing = Chess.inCheck(state, state.turn) ? state.board.findIndex(piece => piece && piece.type === "k" && piece.color === state.turn) : -1;
    for (let screenRank = 0; screenRank < 8; screenRank++) {
      for (let screenFile = 0; screenFile < 8; screenFile++) {
        const index = screenSquare(screenRank, screenFile);
        const square = squares[screenRank * 8 + screenFile];
        const piece = state.board[index];
        square.dataset.index = String(index);
        square.className = `square ${(screenRank + screenFile) % 2 === 0 ? "light" : "dark"}`;
        square.setAttribute("aria-label", `${Chess.squareName(index)}${piece ? `, ${piece.color === "w" ? "White" : "Black"} ${PIECE_NAMES[piece.type]}` : ""}`);
        square.replaceChildren();

        const previous = movesPlayed[movesPlayed.length - 1];
        if (previous && (previous.move.from === index || previous.move.to === index)) square.classList.add("last-move");
        if (selected === index) square.classList.add("selected");
        if (index === checkedKing) square.classList.add("in-check");
        if (piece) {
          const glyph = document.createElement("span");
          glyph.className = `piece-glyph ${piece.color === "w" ? "white-piece" : "black-piece"}`;
          glyph.setAttribute("aria-hidden", "true");
          glyph.textContent = GLYPHS[piece.color][piece.type];
          square.append(glyph);
        }
        if (destinations.has(index)) {
          const dot = document.createElement("span");
          dot.className = "legal-dot";
          dot.setAttribute("aria-hidden", "true");
          square.append(dot);
        }
        if ((flipped ? screenRank === 0 : screenRank === 7)) {
          const coordinate = document.createElement("span");
          coordinate.className = "coordinate";
          coordinate.setAttribute("aria-hidden", "true");
          coordinate.textContent = Chess.squareName(index)[0];
          square.append(coordinate);
        }
        if ((flipped ? screenFile === 7 : screenFile === 0)) {
          const coordinate = document.createElement("span");
          coordinate.className = "coordinate";
          coordinate.setAttribute("aria-hidden", "true");
          coordinate.textContent = Chess.squareName(index)[1];
          square.append(coordinate);
        }
      }
    }
  }

  function handleSquare(index) {
    if (gameOver || aiPending || !isHumanTurn()) return;
    const piece = state.board[index];
    const activeColor = state.turn;
    if (selected !== null) {
      const candidates = Chess.legalMoves(state, selected).filter(move => move.to === index);
      if (candidates.length) {
        if (candidates.some(move => move.promotion)) {
          showPromotion(candidates);
          return;
        }
        commitMove(candidates[0]);
        return;
      }
    }
    if (piece && piece.color === activeColor) selected = index;
    else selected = null;
    renderBoard();
  }

  function showPromotion(candidates) {
    pendingPromotion = candidates;
    ui.promotionOptions.replaceChildren();
    for (const type of PROMOTION_TYPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = GLYPHS.w[type];
      button.setAttribute("aria-label", `Promote to ${PIECE_NAMES[type]}`);
      button.addEventListener("click", () => {
        const move = pendingPromotion.find(candidate => candidate.promotion === type);
        pendingPromotion = null;
        ui.promotionDialog.close();
        if (move) commitMove(move);
      });
      ui.promotionOptions.append(button);
    }
    ui.promotionDialog.showModal();
  }

  function formatMove(move, before) {
    if (move.castle === "k") return "O-O";
    if (move.castle === "q") return "O-O-O";
    const piece = before.board[move.from];
    return `${piece.type === "p" ? "" : piece.type.toUpperCase()}${Chess.squareName(move.from)}${move.captured || move.enPassant ? "×" : "–"}${Chess.squareName(move.to)}${move.promotion ? `=${move.promotion.toUpperCase()}` : ""}`;
  }

  function commitMove(move) {
    if (gameOver) return;
    const before = state;
    const piece = before.board[move.from];
    const captured = move.enPassant ? "p" : (before.board[move.to] && before.board[move.to].type);
    history.push({
      state: before,
      clocks: clockSeconds.slice(),
      clockStarted
    });
    movesPlayed.push({
      move,
      color: piece.color,
      captured,
      notation: formatMove(move, before)
    });
    state = Chess.applyMove(before, move);
    if (!clockStarted) {
      clockStarted = true;
      lastClockTick = performance.now();
    }
    clockSeconds[piece.color === "w" ? 0 : 1] += INCREMENT;
    selected = null;
    currentStatus = Chess.gameStatus(state);
    if (currentStatus === "playing" || currentStatus === "check") {
      const key = Chess.positionKey(state);
      const repetitions = movesPlayed.reduce((number, record) => number + (record.positionKey === key ? 1 : 0), 1);
      movesPlayed[movesPlayed.length - 1].positionKey = key;
      if (repetitions >= 3) currentStatus = "threefold";
    }
    gameOver = ["checkmate", "stalemate", "fifty-move", "insufficient-material", "threefold", "timeout"].includes(currentStatus);
    if (gameOver) {
      ui.winnerBanner.classList.add("visible");
    }
    updateUI();
    renderBoard();
    if (!gameOver && getAiSide() === state.turn) {
      aiPending = true;
      updateUI();
      window.setTimeout(playComputerMove, 260);
    }
  }

  function playComputerMove() {
    const aiSide = getAiSide();
    if (gameMode === "local" || gameOver || state.turn !== aiSide) {
      aiPending = false;
      updateUI();
      return;
    }
    const move = Chess.chooseMove(state, 2);
    if (!move) {
      currentStatus = Chess.gameStatus(state);
      gameOver = ["checkmate", "stalemate", "fifty-move", "insufficient-material", "threefold", "timeout"].includes(currentStatus);
      aiPending = false;
      updateUI();
      return;
    }
    aiPending = false;
    commitMove(move);
  }

  function restoreLastTurn() {
    if (gameOver && ui.promotionDialog.open) return;
    if (!history.length) return;
    aiPending = false;
    selected = null;
    const previous = history.pop();
    state = previous.state;
    clockSeconds = previous.clocks;
    clockStarted = previous.clockStarted;
    movesPlayed.pop();
    lastClockTick = performance.now();
    gameOver = false;
    currentStatus = Chess.gameStatus(state);
    updateUI();
    renderBoard();
  }

  function formatClock(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
  }

  function tickClock() {
    if (!clockStarted || gameOver) return;
    const now = performance.now();
    const elapsed = (now - lastClockTick) / 1000;
    lastClockTick = now;
    const side = state.turn === "w" ? 0 : 1;
    clockSeconds[side] = Math.max(0, clockSeconds[side] - elapsed);
    if (clockSeconds[side] <= 0) {
      clockSeconds[side] = 0;
      gameOver = true;
      currentStatus = "timeout";
    }
    updateClocks();
    if (gameOver) updateUI();
  }

  function updateClocks() {
    for (const [index, element] of [ui.whiteClock, ui.blackClock].entries()) {
      element.textContent = formatClock(clockSeconds[index]);
      element.classList.toggle("active-clock", clockStarted && !gameOver && index === (state.turn === "w" ? 0 : 1));
      element.classList.toggle("low-time", clockSeconds[index] <= 20);
    }
  }

  function modeTitle() {
    if (gameMode === "computer-black") return "White vs. Computer";
    if (gameMode === "computer-white") return "Computer vs. White";
    return "Player 1 vs. Player 2";
  }

  function winnerText() {
    if (currentStatus === "checkmate") {
      const winner = state.turn === "w" ? "Black" : "White";
      if (gameMode === "computer-black") return winner === "White" ? "You win by checkmate!" : "Computer wins by checkmate.";
      if (gameMode === "computer-white") return winner === "Black" ? "You win by checkmate!" : "Computer wins by checkmate.";
      return `${winner} wins by checkmate.`;
    }
    if (currentStatus === "stalemate") return "Draw by stalemate.";
    if (currentStatus === "fifty-move") return "Draw by the 50-move rule.";
    if (currentStatus === "insufficient-material") return "Draw — insufficient material.";
    if (currentStatus === "threefold") return "Draw by repetition.";
    if (currentStatus === "timeout") {
      const winner = state.turn === "w" ? "Black" : "White";
      if (gameMode === "computer-black") return winner === "White" ? "You win on time!" : "Computer wins on time.";
      if (gameMode === "computer-white") return winner === "Black" ? "You win on time!" : "Computer wins on time.";
      return `${winner} wins on time.`;
    }
    return "Game over";
  }

  function outcomeMessage() {
    if (currentStatus === "checkmate") {
      const winner = state.turn === "w" ? "Black" : "White";
      return ["Checkmate", winnerText(), winner === "White" ? "♔" : "♚"];
    }
    if (currentStatus === "stalemate") return ["Draw", "Neither side has a legal move.", "½"];
    if (currentStatus === "fifty-move") return ["Draw", "No pawn was moved or captured in 50 moves.", "½"];
    if (currentStatus === "insufficient-material") return ["Draw", "There isn’t enough material to force mate.", "½"];
    if (currentStatus === "threefold") return ["Draw", "The same position repeated three times.", "½"];
    if (currentStatus === "timeout") return ["Time is up", winnerText(), "◷"];
    if (currentStatus === "check") return state.turn === "w" ? ["White in check", "Your king is under attack.", "♔"] : ["Black in check", "The black king is under attack.", "♚"];
    if (aiPending) return ["Computer thinking", "The AI is considering its move.", "♚"];
    if (gameMode === "local") return state.turn === "w"
      ? ["White to move", "Player 1: select a piece and choose a square.", "♔"]
      : ["Black to move", "Player 2: select a piece and choose a square.", "♚"];
    if (gameMode === "computer-black") return state.turn === "w"
      ? ["Your move", "Select a piece, then choose a square.", "♙"]
      : ["Computer to move", "The computer is choosing its response.", "♚"];
    return state.turn === "b"
      ? ["Your move", "Select a piece, then choose a square.", "♙"]
      : ["Computer to move", "The computer is choosing its response.", "♔"];
  }

  function renderMoveHistory() {
    ui.moveList.replaceChildren();
    if (!movesPlayed.length) {
      const empty = document.createElement("p");
      empty.className = "empty-moves";
      empty.textContent = "The first move is yours.";
      ui.moveList.append(empty);
    } else {
      for (let index = 0; index < movesPlayed.length; index += 2) {
        const row = document.createElement("div");
        row.className = "move-row";
        const number = document.createElement("span");
        number.className = "move-number";
        number.textContent = `${Math.floor(index / 2) + 1}.`;
        row.append(number);
        for (let offset = 0; offset < 2; offset++) {
          const record = movesPlayed[index + offset];
          const entry = document.createElement("span");
          entry.className = "move-entry";
          if (record) {
            entry.textContent = record.notation;
            if (index + offset === movesPlayed.length - 1) entry.classList.add("latest");
          }
          row.append(entry);
        }
        ui.moveList.append(row);
      }
      ui.moveList.scrollTop = ui.moveList.scrollHeight;
    }
    const fullMoves = Math.ceil(movesPlayed.length / 2);
    ui.moveCount.textContent = `${fullMoves} ${fullMoves === 1 ? "MOVE" : "MOVES"}`;
  }

  function renderCaptures() {
    const whiteTaken = [];
    const blackTaken = [];
    for (const record of movesPlayed) {
      if (!record.captured) continue;
      (record.color === "w" ? whiteTaken : blackTaken).push(record.captured);
    }
    whiteTaken.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
    blackTaken.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);
    ui.whiteCaptures.textContent = whiteTaken.map(type => GLYPHS.b[type]).join("");
    ui.blackCaptures.textContent = blackTaken.map(type => GLYPHS.w[type]).join("");
    const score = list => list.reduce((total, type) => total + PIECE_VALUES[type], 0);
    ui.whiteMaterial.textContent = score(whiteTaken) ? `+${score(whiteTaken)}` : "—";
    ui.blackMaterial.textContent = score(blackTaken) ? `+${score(blackTaken)}` : "—";
  }

  function updateUI() {
    const [title, message, icon] = outcomeMessage();
    ui.turnTitle.textContent = title;
    ui.turnMessage.textContent = message;
    ui.turnIcon.textContent = icon;
    const turn = state.turn === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE";
    ui.gameStatus.textContent = gameOver ? "GAME COMPLETE" : (currentStatus === "check" ? `${turn} · CHECK` : turn);
    ui.matchState.textContent = gameOver ? "FINISHED" : (clockStarted ? "IN PLAY" : "READY");
    ui.matchTitle.textContent = modeTitle();
    ui.whiteName.textContent = gameMode === "computer-black" ? "You · White" : (gameMode === "computer-white" ? "Computer · White" : "Player 1 · White");
    ui.blackName.textContent = gameMode === "computer-black" ? "Computer · Black" : (gameMode === "computer-white" ? "You · Black" : "Player 2 · Black");
    ui.computerBlackMode.classList.toggle("active-mode", gameMode === "computer-black");
    ui.computerWhiteMode.classList.toggle("active-mode", gameMode === "computer-white");
    ui.localMode.classList.toggle("active-mode", gameMode === "local");
    ui.computerBlackMode.setAttribute("aria-pressed", String(gameMode === "computer-black"));
    ui.computerWhiteMode.setAttribute("aria-pressed", String(gameMode === "computer-white"));
    ui.localMode.setAttribute("aria-pressed", String(gameMode === "local"));

    if (gameMode === "computer-black") {
      ui.boardFooter.textContent = state.turn === "w" ? "PLAYING WHITE" : "COMPUTER IS THINKING";
    } else if (gameMode === "computer-white") {
      ui.boardFooter.textContent = state.turn === "b" ? "PLAYING BLACK" : "COMPUTER IS THINKING";
    } else {
      ui.boardFooter.textContent = `LOCAL GAME · ${state.turn === "w" ? "WHITE" : "BLACK"} TO MOVE`;
    }

    ui.whiteCard.classList.toggle("active-player", !gameOver && state.turn === "w");
    ui.blackCard.classList.toggle("active-player", !gameOver && state.turn === "b");
    ui.whiteTurn.textContent = gameOver ? "FINISHED" : (state.turn === "w"
      ? (gameMode === "local" ? "PLAYER 1 TURN" : (gameMode === "computer-black" ? "YOUR TURN" : "WAITING"))
      : "WAITING");
    ui.blackTurn.textContent = gameOver ? "FINISHED" : (state.turn === "b"
      ? (gameMode === "local" ? "PLAYER 2 TURN" : (gameMode === "computer-white" ? "YOUR TURN" : "WAITING"))
      : (gameMode === "local" ? "PLAYER 2" : "OPPONENT"));

    ui.undo.disabled = history.length === 0 || aiPending;
    ui.winnerBanner.classList.toggle("visible", gameOver && currentStatus !== "playing");
    ui.winnerMessage.textContent = winnerText();
    updateClocks();
    renderMoveHistory();
    renderCaptures();
  }

  function newGame() {
    if (ui.promotionDialog.open) ui.promotionDialog.close();
    pendingPromotion = null;
    state = Chess.initialState();
    selected = null;
    flipped = false;
    aiPending = false;
    gameOver = false;
    currentStatus = "playing";
    history = [];
    movesPlayed = [];
    clockSeconds = [START_TIME, START_TIME];
    clockStarted = false;
    lastClockTick = performance.now();
    ui.winnerBanner.classList.remove("visible");
    updateUI();
    renderBoard();
    if (getAiSide() === state.turn) {
      aiPending = true;
      updateUI();
      window.setTimeout(playComputerMove, 260);
    }
  }

  boardElement.addEventListener("keydown", event => {
    if (event.key === "Escape" && selected !== null) {
      selected = null;
      renderBoard();
    }
  });

  document.querySelector("#undo-button").addEventListener("click", restoreLastTurn);
  ui.computerBlackMode.addEventListener("click", () => setMode("computer-black"));
  ui.computerWhiteMode.addEventListener("click", () => setMode("computer-white"));
  ui.localMode.addEventListener("click", () => setMode("local"));
  document.querySelector("#flip-button").addEventListener("click", () => {
    flipped = !flipped;
    renderBoard();
  });
  document.querySelector("#reset-button").addEventListener("click", newGame);

  createBoard();
  newGame();
  clockInterval = window.setInterval(tickClock, 200);
  window.addEventListener("pagehide", () => window.clearInterval(clockInterval), { once: true });
})();
