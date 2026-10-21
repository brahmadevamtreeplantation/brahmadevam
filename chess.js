(function (root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.ChessEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FILES = "abcdefgh";
  const PIECE_VALUES = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  const KNIGHT_STEPS = [-17, -15, -10, -6, 6, 10, 15, 17];
  const KING_STEPS = [-9, -8, -7, -1, 1, 7, 8, 9];

  function squareName(index) {
    return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
  }

  function squareIndex(square) {
    if (!/^[a-h][1-8]$/.test(square)) throw new Error(`Invalid square: ${square}`);
    return (8 - Number(square[1])) * 8 + FILES.indexOf(square[0]);
  }

  function initialState() {
    return fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  function fromFEN(fen) {
    const fields = fen.trim().split(/\s+/);
    if (fields.length < 4) throw new Error("FEN must include a position, turn, castling rights, and en-passant square.");
    const board = Array(64).fill(null);
    const rows = fields[0].split("/");
    if (rows.length !== 8) throw new Error("FEN position must have eight ranks.");
    rows.forEach((row, rank) => {
      let file = 0;
      for (const symbol of row) {
        if (/[1-8]/.test(symbol)) file += Number(symbol);
        else if (/[prnbqkPRNBQK]/.test(symbol)) {
          if (file > 7) throw new Error("Invalid FEN rank.");
          board[rank * 8 + file] = {
            type: symbol.toLowerCase(),
            color: symbol === symbol.toUpperCase() ? "w" : "b"
          };
          file++;
        } else throw new Error(`Invalid FEN piece: ${symbol}`);
      }
      if (file !== 8) throw new Error("Each FEN rank must contain eight squares.");
    });
    if (!["w", "b"].includes(fields[1])) throw new Error("FEN active color must be w or b.");
    const kings = { w: 0, b: 0 };
    board.forEach(piece => { if (piece && piece.type === "k") kings[piece.color]++; });
    if (kings.w !== 1 || kings.b !== 1) throw new Error("A chess position must contain one king per side.");
    return {
      board,
      turn: fields[1],
      castling: fields[2] === "-" ? "" : fields[2],
      enPassant: fields[3] === "-" ? null : squareIndex(fields[3]),
      halfmove: Number(fields[4] || 0),
      fullmove: Number(fields[5] || 1)
    };
  }

  function toFEN(state) {
    const ranks = [];
    for (let rank = 0; rank < 8; rank++) {
      let line = "";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = state.board[rank * 8 + file];
        if (!piece) empty++;
        else {
          if (empty) line += empty;
          empty = 0;
          line += piece.color === "w" ? piece.type.toUpperCase() : piece.type;
        }
      }
      if (empty) line += empty;
      ranks.push(line);
    }
    const castling = "KQkq".split("").filter(right => state.castling.includes(right)).join("") || "-";
    return `${ranks.join("/")} ${state.turn} ${castling} ${state.enPassant === null ? "-" : squareName(state.enPassant)} ${state.halfmove} ${state.fullmove}`;
  }

  function positionKey(state) {
    const fen = toFEN(state).split(" ");
    return fen.slice(0, 4).join(" ");
  }

  function sameRank(a, b) {
    return Math.floor(a / 8) === Math.floor(b / 8);
  }

  function isSquareAttacked(state, target, byColor) {
    const board = state.board;
    const targetRank = Math.floor(target / 8);
    const targetFile = target % 8;
    const pawnSourceRank = targetRank + (byColor === "w" ? 1 : -1);
    for (const fileDelta of [-1, 1]) {
      const file = targetFile + fileDelta;
      if (pawnSourceRank >= 0 && pawnSourceRank < 8 && file >= 0 && file < 8) {
        const piece = board[pawnSourceRank * 8 + file];
        if (piece && piece.color === byColor && piece.type === "p") return true;
      }
    }
    for (const step of KNIGHT_STEPS) {
      const source = target + step;
      if (source < 0 || source >= 64) continue;
      const df = Math.abs((source % 8) - targetFile);
      const dr = Math.abs(Math.floor(source / 8) - targetRank);
      if (df * dr !== 2) continue;
      const piece = board[source];
      if (piece && piece.color === byColor && piece.type === "n") return true;
    }
    for (const step of KING_STEPS) {
      const source = target + step;
      if (source < 0 || source >= 64 || (!sameRank(source, target) && Math.abs(step) === 1)) continue;
      if (Math.abs((source % 8) - targetFile) > 1 || Math.abs(Math.floor(source / 8) - targetRank) > 1) continue;
      const piece = board[source];
      if (piece && piece.color === byColor && piece.type === "k") return true;
    }
    for (const [step, types] of [
      [-8, ["q", "r"]], [8, ["q", "r"]], [-1, ["q", "r"]], [1, ["q", "r"]],
      [-9, ["q", "b"]], [-7, ["q", "b"]], [7, ["q", "b"]], [9, ["q", "b"]]
    ]) {
      let square = target + step;
      while (square >= 0 && square < 64 && (Math.abs(step) !== 1 || sameRank(square, square - step)) &&
        (Math.abs(step) === 1 || Math.abs((square % 8) - ((square - step) % 8)) <= 1)) {
        const piece = board[square];
        if (piece) {
          if (piece.color === byColor && types.includes(piece.type)) return true;
          break;
        }
        square += step;
      }
    }
    return false;
  }

  function kingSquare(state, color) {
    return state.board.findIndex(piece => piece && piece.type === "k" && piece.color === color);
  }

  function inCheck(state, color) {
    const king = kingSquare(state, color);
    return king !== -1 && isSquareAttacked(state, king, color === "w" ? "b" : "w");
  }

  function addPawnMove(moves, from, to, captured, isEnPassant) {
    const lastRank = Math.floor(to / 8);
    if (lastRank === 0 || lastRank === 7) {
      for (const promotion of ["q", "r", "b", "n"]) {
        moves.push({ from, to, captured: captured || null, promotion, enPassant: !!isEnPassant });
      }
    } else moves.push({ from, to, captured: captured || null, enPassant: !!isEnPassant });
  }

  function pseudoMoves(state) {
    const moves = [];
    const board = state.board;
    const color = state.turn;
    const enemy = color === "w" ? "b" : "w";
    const add = (from, to, extra = {}) => {
      const captured = board[to];
      if (!captured || captured.color !== color) moves.push({ from, to, captured: captured ? captured.type : null, ...extra });
    };
    for (let from = 0; from < 64; from++) {
      const piece = board[from];
      if (!piece || piece.color !== color) continue;
      const rank = Math.floor(from / 8);
      const file = from % 8;
      if (piece.type === "p") {
        const direction = color === "w" ? -8 : 8;
        const next = from + direction;
        if (next >= 0 && next < 64 && !board[next]) {
          addPawnMove(moves, from, next);
          const startRank = color === "w" ? 6 : 1;
          const double = from + direction * 2;
          if (rank === startRank && !board[double]) moves.push({ from, to: double, captured: null, doublePawn: true });
        }
        for (const df of [-1, 1]) {
          const targetFile = file + df;
          const to = next + df;
          if (targetFile < 0 || targetFile > 7 || to < 0 || to >= 64) continue;
          if (board[to] && board[to].color === enemy && board[to].type !== "k") addPawnMove(moves, from, to, board[to].type, false);
          else if (to === state.enPassant) addPawnMove(moves, from, to, "p", true);
        }
        continue;
      }
      if (piece.type === "n") {
        for (const step of KNIGHT_STEPS) {
          const to = from + step;
          if (to < 0 || to >= 64) continue;
          const df = Math.abs((to % 8) - file);
          const dr = Math.abs(Math.floor(to / 8) - rank);
          if (df * dr === 2) add(from, to);
        }
        continue;
      }
      if (piece.type === "k") {
        for (const step of KING_STEPS) {
          const to = from + step;
          if (to < 0 || to >= 64 || Math.abs((to % 8) - file) > 1 || Math.abs(Math.floor(to / 8) - rank) > 1) continue;
          add(from, to);
        }
        const home = color === "w" ? 60 : 4;
        const kingSide = color === "w" ? "K" : "k";
        const queenSide = color === "w" ? "Q" : "q";
        if (from === home && !inCheck(state, color)) {
          if (state.castling.includes(kingSide) && !board[home + 1] && !board[home + 2] &&
            board[home + 3] && board[home + 3].type === "r" && board[home + 3].color === color &&
            !isSquareAttacked(state, home + 1, enemy) && !isSquareAttacked(state, home + 2, enemy)) {
            moves.push({ from, to: home + 2, captured: null, castle: "k" });
          }
          if (state.castling.includes(queenSide) && !board[home - 1] && !board[home - 2] && !board[home - 3] &&
            board[home - 4] && board[home - 4].type === "r" && board[home - 4].color === color &&
            !isSquareAttacked(state, home - 1, enemy) && !isSquareAttacked(state, home - 2, enemy)) {
            moves.push({ from, to: home - 2, captured: null, castle: "q" });
          }
        }
        continue;
      }
      const directions = piece.type === "b" ? [-9, -7, 7, 9]
        : piece.type === "r" ? [-8, -1, 1, 8]
          : [-9, -8, -7, -1, 1, 7, 8, 9];
      for (const step of directions) {
        let to = from + step;
        while (to >= 0 && to < 64 && (Math.abs(step) !== 1 || sameRank(to, to - step)) &&
          (Math.abs(step) === 1 || Math.abs((to % 8) - ((to - step) % 8)) <= 1)) {
          const target = board[to];
          if (!target) moves.push({ from, to, captured: null });
          else {
            if (target.color !== color && target.type !== "k") add(from, to);
            break;
          }
          if (piece.type !== "q" && (piece.type === "b" ? Math.abs(step) !== 7 && Math.abs(step) !== 9 : Math.abs(step) !== 1 && Math.abs(step) !== 8)) break;
          to += step;
        }
      }
    }
    return moves;
  }

  function applyMove(state, move) {
    const board = state.board.slice();
    const piece = board[move.from];
    const captured = board[move.to];
    board[move.from] = null;
    if (move.enPassant) board[move.to + (piece.color === "w" ? 8 : -8)] = null;
    if (move.castle) {
      const rookFrom = move.castle === "k" ? move.from + 3 : move.from - 4;
      const rookTo = move.castle === "k" ? move.from + 1 : move.from - 1;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = null;
    }
    board[move.to] = { type: move.promotion || piece.type, color: piece.color };
    let castling = state.castling;
    if (piece.type === "k") castling = castling.replace(piece.color === "w" ? /[KQ]/g : /[kq]/g, "");
    if (move.from === 63 || move.to === 63) castling = castling.replace("K", "");
    if (move.from === 56 || move.to === 56) castling = castling.replace("Q", "");
    if (move.from === 7 || move.to === 7) castling = castling.replace("k", "");
    if (move.from === 0 || move.to === 0) castling = castling.replace("q", "");
    return {
      board,
      turn: piece.color === "w" ? "b" : "w",
      castling,
      enPassant: move.doublePawn ? (move.from + move.to) / 2 : null,
      halfmove: piece.type === "p" || captured || move.enPassant ? 0 : state.halfmove + 1,
      fullmove: state.fullmove + (piece.color === "b" ? 1 : 0)
    };
  }

  function legalMoves(state, from) {
    return pseudoMoves(state)
      .filter(move => (from === undefined || move.from === from) && !inCheck(applyMove(state, move), state.turn));
  }

  function playMove(state, from, to, promotion) {
    const fromIndex = typeof from === "number" ? from : squareIndex(from);
    const toIndex = typeof to === "number" ? to : squareIndex(to);
    const move = legalMoves(state, fromIndex).find(candidate =>
      candidate.to === toIndex && (candidate.promotion || null) === (promotion || null));
    if (!move) return null;
    return { state: applyMove(state, move), move };
  }

  function insufficientMaterial(state) {
    const remaining = state.board.filter(piece => piece && piece.type !== "k");
    if (remaining.length === 0) return true;
    if (remaining.some(piece => piece.type === "p" || piece.type === "r" || piece.type === "q")) return false;
    if (remaining.length === 1) return true;
    const firstBishop = state.board.findIndex(piece => piece && piece.type === "b");
    const firstBishopColor = (Math.floor(firstBishop / 8) + firstBishop % 8) % 2;
    return remaining.every(piece => piece.type === "b") &&
      state.board.reduce((squares, piece, index) => {
        if (piece && piece.type === "b") squares.push((Math.floor(index / 8) + index % 8) % 2);
        return squares;
      }, []).every(square => square === firstBishopColor);
  }

  function gameStatus(state) {
    const moves = legalMoves(state);
    const checked = inCheck(state, state.turn);
    if (!moves.length) return checked ? "checkmate" : "stalemate";
    if (state.halfmove >= 100) return "fifty-move";
    if (insufficientMaterial(state)) return "insufficient-material";
    return checked ? "check" : "playing";
  }

  function moveScore(state, move) {
    const victim = move.enPassant ? 100 : move.captured ? PIECE_VALUES[move.captured] : 0;
    const attacker = PIECE_VALUES[state.board[move.from].type];
    return (move.promotion ? PIECE_VALUES[move.promotion] : 0) + (victim ? 10 * victim - attacker : 0);
  }

  function evaluate(state) {
    let score = 0;
    for (let index = 0; index < 64; index++) {
      const piece = state.board[index];
      if (!piece) continue;
      const rank = Math.floor(index / 8);
      const file = index % 8;
      const advance = piece.color === "w" ? 6 - rank : rank - 1;
      const center = 7 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
      let value = PIECE_VALUES[piece.type];
      if (piece.type === "p") value += advance * 8 + center * 2;
      else if (piece.type === "n" || piece.type === "b") value += center * 7;
      score += piece.color === "w" ? value : -value;
    }
    return score;
  }

  function search(state, depth, alpha, beta) {
    const moves = legalMoves(state);
    const checked = inCheck(state, state.turn);
    if (!moves.length) return checked ? (state.turn === "w" ? -100000 - depth : 100000 + depth) : 0;
    if (state.halfmove >= 100 || insufficientMaterial(state)) return 0;
    if (depth === 0) return evaluate(state);
    moves.sort((a, b) => moveScore(state, b) - moveScore(state, a));
    if (state.turn === "w") {
      let best = -Infinity;
      for (const move of moves) {
        best = Math.max(best, search(applyMove(state, move), depth - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    }
    let best = Infinity;
    for (const move of moves) {
      best = Math.min(best, search(applyMove(state, move), depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseMove(state, depth = 3) {
    const moves = legalMoves(state);
    if (!moves.length) return null;
    moves.sort((a, b) => moveScore(state, b) - moveScore(state, a));
    let bestMove = moves[0];
    let best = state.turn === "w" ? -Infinity : Infinity;
    for (const move of moves) {
      const value = search(applyMove(state, move), Math.max(0, depth - 1), -Infinity, Infinity);
      if ((state.turn === "w" && value > best) || (state.turn === "b" && value < best)) {
        best = value;
        bestMove = move;
      }
    }
    return bestMove;
  }

  return {
    applyMove,
    chooseMove,
    fromFEN,
    gameStatus,
    inCheck,
    initialState,
    legalMoves,
    playMove,
    positionKey,
    squareIndex,
    squareName,
    toFEN
  };
});
