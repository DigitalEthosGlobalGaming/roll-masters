import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkLayout } from "../src/performance/benchmark-layout.ts";

test("comparison layouts retain the original staggered pawns", () => {
  const cells = benchmarkLayout(16, 256);
  assert.equal(cells.filter(cell => cell.kind === "pawn").length, 64);
  assert.deepEqual(cells.filter(cell => cell.kind === "pawn").slice(4, 8).map(cell => cell.x), [1, 5, 9, 13]);
  assert.equal(benchmarkLayout(16, 0).length, 0);
  assert.equal(benchmarkLayout(16, 64).length, 64);
});

test("full 32 board and mixed fixtures stay in bounds without duplicate cells", () => {
  assert.equal(benchmarkLayout(32, 1024).length, 1024);
  for (const size of [16, 32]) {
    const cells = benchmarkLayout(size, size * size, true);
    const occupied = new Map(cells.map(cell => [`${cell.x},${cell.y}`, cell]));
    assert.equal(occupied.size, cells.length);
    assert.ok(cells.every(cell => cell.x >= 0 && cell.x < size && cell.y >= 0 && cell.y < size));
    for (const kind of ["dice", "pawn", "knight", "bishop", "rook"]) assert.ok(cells.some(cell => cell.kind === kind));
    for (const cell of cells.filter(cell => cell.kind === "knight" || cell.kind === "rook")) {
      assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const x = cell.x + dx, y = cell.y + dy;
        return x >= 0 && x < size && y >= 0 && y < size && !occupied.has(`${x},${y}`);
      }), "moving pieces need a free adjacent destination");
    }
    for (const cell of cells.filter(cell => cell.kind === "bishop")) {
      assert.ok([[-1, -1], [-1, 1], [1, -1], [1, 1]].some(([dx, dy]) => occupied.get(`${cell.x + dx},${cell.y + dy}`)?.kind === "dice"));
    }
  }
});

test("invalid layouts fail before starting the engine fixture", () => {
  for (const args of [[8, 64], [16, 257], [32, -1], [16, 1.5], [32, 256, true]]) {
    assert.throws(() => benchmarkLayout(...args), /Unsupported benchmark layout/);
  }
});
