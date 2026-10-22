// Verify lightweight cells against real Excalibur transforms, not the UI doubles.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

globalThis.window = {};
globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
const engineUrl = new URL("../node_modules/excalibur/build/esm/excalibur.js", import.meta.url).href;
const ex = await import(engineUrl);
const gridUrl = `data:text/javascript,${encodeURIComponent(`import { Actor } from "${engineUrl}";
export class GridSystem extends Actor {
  getSpacePositionFromIndex(index) { return { x: index % 16, y: Math.floor(index / 16) }; }
}`)}`;
const { GridSystem } = await import(gridUrl);
const source = stripTypeScriptTypes(readFileSync(new URL("../src/grid-system/grid-space.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`)
  .replace('from "./grid-system"', `from "${gridUrl}"`);
const { GridSpace } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const cellUrl = `data:text/javascript,${encodeURIComponent(source)}`;
const gridSource = stripTypeScriptTypes(readFileSync(new URL("../src/grid-system/grid-system.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`)
  .replace('from "./grid-space"', `from "${cellUrl}"`);
const { GridSystem: GameGrid } = await import(`data:text/javascript,${encodeURIComponent(gridSource)}`);

test("loaded occupied cells have final positions before any lookup or update", () => {
  const grid = new GameGrid();
  grid.deserialize({ spaceSize: { _x: 32, _y: 32 }, size: { _x: 16, _y: 16 } });
  grid.pos = ex.vec(20, 30);
  const cell = new GridSpace();
  cell.deserialize({ gridIndex: 197 });
  grid.addChildObject(cell, cell.serialize());
  const piece = new ex.Actor(); cell.addChild(piece);
  assert.equal(cell.pos.x, 176); assert.equal(cell.pos.y, 400);
  assert.equal(piece.globalPos.x, 196); assert.equal(piece.globalPos.y, 430);
  assert.equal(cell.serializeId, "grid-space-197");
  assert.equal(grid.children.length, 1, "restoring does not populate empty cells");
  grid.size = ex.vec(18, 18);
  assert.equal(cell.gridIndex, 221);
  assert.equal(cell.pos.x, 176); assert.equal(cell.pos.y, 400);
  grid.spaceSize = ex.vec(48, 24);
  assert.equal(cell.pos.x, 264); assert.equal(cell.pos.y, 300);
  assert.equal(grid.spaces[221], cell);
});

test("cells contribute transforms to pieces without joining actor systems", () => {
  const grid = new GridSystem();
  grid.pos = ex.vec(20, 30);
  const a = new GridSpace(), b = new GridSpace();
  a.pos = ex.vec(16, 16); b.pos = ex.vec(48, 16);
  grid.addChild(a); grid.addChild(b);
  const die = new ex.Actor({ pos: ex.vec(2, 3) });
  a.addChild(die);
  assert.equal(a instanceof ex.Actor, false);
  assert.deepEqual(a.getComponents().map(component => component.constructor), [ex.TransformComponent]);
  assert.equal(die.globalPos.x, 38); assert.equal(die.globalPos.y, 49);
  a.removeChild(die); b.addChild(die);
  assert.equal(die.globalPos.x, 70); assert.equal(die.globalPos.y, 49);
  grid.pos = ex.vec(100, 200);
  assert.equal(die.globalPos.x, 150); assert.equal(die.globalPos.y, 219);
  assert.equal(b.getBounds().left, 148);
  assert.equal(b.getBounds().bottom, 248);
});

test("cells preserve their serialized name, index and child hierarchy", () => {
  const grid = new GridSystem();
  const cell = new GridSpace();
  grid.addChild(cell);
  cell.deserialize({ gridIndex: 17 });
  assert.equal(GridSpace.serializeName, "GridSpace");
  assert.deepEqual(cell.serialize(), { gridIndex: 17 });
  assert.deepEqual(cell.gridPos, { x: 1, y: 1 });
  cell.deserialize({ gridIndex: 34 });
  assert.deepEqual(cell.gridPos, { x: 2, y: 2 });
  const child = new ex.Actor();
  cell.addChild(child);
  assert.equal(child.parent, cell);
  assert.equal(cell.grid, grid);
  cell.kill();
  assert.equal(cell.isKilled(), true);
});
