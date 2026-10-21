"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Chess = require("../chess.js");

function playLine(state, moves) {
  for (const [from, to, promotion] of moves) {
    const result = Chess.playMove(state, from, to, promotion);
    assert.ok(result, `Expected legal move ${from}${to}`);
    state = result.state;
  }
  return state;
}

test("starts with the standard position and 20 legal moves", () => {
  const state = Chess.initialState();
  assert.equal(Chess.toFEN(state), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(Chess.legalMoves(state).length, 20);
});

test("rejects a move that leaves the king in check", () => {
  const state = Chess.fromFEN("4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1");
  assert.equal(Chess.playMove(state, "e2", "d2"), null);
  assert.ok(Chess.playMove(state, "e2", "e8"));
});

test("supports castling and removes castling rights after the king moves", () => {
  const state = playLine(Chess.initialState(), [
    ["e2", "e4"], ["a7", "a6"], ["g1", "f3"], ["a6", "a5"],
    ["f1", "e2"], ["b7", "b6"], ["e1", "g1"]
  ]);
  assert.equal(state.board[62].type, "k");
  assert.equal(state.board[61].type, "r");
  assert.equal(state.castling.includes("K"), false);
  assert.equal(state.castling.includes("Q"), false);
});

test("supports en passant and resets the half-move clock", () => {
  const state = playLine(Chess.initialState(), [
    ["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"], ["e5", "d6"]
  ]);
  assert.equal(state.board[Chess.squareIndex("d5")], null);
  assert.equal(state.board[Chess.squareIndex("d6")].type, "p");
  assert.equal(state.halfmove, 0);
});

test("generates all promotion choices and applies the selected promotion", () => {
  const state = Chess.fromFEN("7k/P7/8/8/8/8/8/7K w - - 0 1");
  assert.equal(Chess.legalMoves(state, Chess.squareIndex("a7")).length, 4);
  const result = Chess.playMove(state, "a7", "a8", "n");
  assert.ok(result);
  assert.equal(result.state.board[Chess.squareIndex("a8")].type, "n");
});

test("distinguishes checkmate and stalemate", () => {
  const mate = Chess.fromFEN("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1");
  const stalemate = Chess.fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  assert.equal(Chess.gameStatus(mate), "checkmate");
  assert.equal(Chess.gameStatus(stalemate), "stalemate");
});

test("finds a legal move with the built-in opponent search", () => {
  const state = Chess.initialState();
  const move = Chess.chooseMove(state, 2);
  assert.ok(Chess.legalMoves(state).some(candidate => candidate.from === move.from && candidate.to === move.to));
});
