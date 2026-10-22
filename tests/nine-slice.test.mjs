import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fitNineSlice, getNineSliceCenter, nineSliceCenterColors, nineSliceSources } from "../src/ui/nine-slice-config.ts";
import { getAtlasButtonSlices, b3ButtonGeometry } from "../src/ui/atlas-button-layout.ts";

test("square atlas states keep identical corners on short, long and tall buttons", () => {
  const corners = [];
  for (const [width, height] of [[96, 48], [220, 48], [360, 56], [72, 72]]) {
    const tiles = getAtlasButtonSlices({ x: 128, y: 128, width: 128, height: 128 }, width, height, b3ButtonGeometry);
    assert.equal(tiles.length, 9);
    corners.push([tiles[0].width, tiles[0].height]);
    assert.deepEqual(tiles[0].sourceView, { x: 128, y: 128, width: 28, height: 28 });
    assert.deepEqual(tiles[8].sourceView, { x: 228, y: 228, width: 28, height: 28 });
    assert.equal(tiles[8].x + tiles[8].width, width);
    assert.equal(tiles[8].y + tiles[8].height, height);
    for (const tile of tiles) assert.ok(tile.width > 0 && tile.height > 0);
    assert.ok(Math.abs(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0) - width * height) < 1e-6);
  }
  assert.deepEqual(corners, [[14, 14], [14, 14], [14, 14], [14, 14]]);
});

test("atlas nine-slice also supports rectangular artwork and tiny destinations without overlap", () => {
  for (const [width, height] of [[300, 48], [44, 44], [10, 10], [0.5, 2]]) {
    const tiles = getAtlasButtonSlices({ x: 792, y: 320, width: 336, height: 128 }, width, height);
    assert.ok(tiles.every(tile => tile.width > 0 && tile.height > 0));
    assert.ok(Math.abs(tiles[8].x + tiles[8].width - width) < 1e-9);
    assert.ok(Math.abs(tiles[8].y + tiles[8].height - height) < 1e-9);
  }
});

test("atlas descriptors agree with runtime source dimensions and slice boundaries", () => {
  const atlas = JSON.parse(readFileSync(new URL("../public/images/ui/medieval_ui_atlas.json", import.meta.url), "utf8"));
  for (const [name, source] of Object.entries(nineSliceSources)) {
    const frame = atlas.frames[name];
    assert.equal(frame.centerColor, nineSliceCenterColors[name]);
    assert.deepEqual(frame.nineSlice, {
      leftMargin: source.leftMargin, topMargin: source.topMargin,
      rightMargin: source.rightMargin, bottomMargin: source.bottomMargin,
    });
    const [x, y, width, height] = frame.rect;
    assert.equal(width, source.width);
    assert.equal(height, source.height);
    assert.ok(x >= 0 && y >= 0 && x + width <= atlas.width && y + height <= atlas.height);
  }
});

test("solid center backing stays within slice borders, including compressed controls", () => {
  for (const source of Object.values(nineSliceSources)) {
    for (const [width, height] of [[320, 180], [120, 240], [160, 40], [200, 12], [1, 1]]) {
      const target = fitNineSlice(width, height, source);
      const center = getNineSliceCenter(width, height, source);
      assert.ok(center.width > 0 && center.height > 0);
      assert.equal(center.left, source.leftMargin * target.scaleX);
      assert.equal(center.top, source.topMargin * target.scaleY);
      assert.ok(Math.abs(center.left + center.width + source.rightMargin * target.scaleX - width) < 1e-9);
      assert.ok(Math.abs(center.top + center.height + source.bottomMargin * target.scaleY - height) < 1e-9);
    }
  }
});

test("normal panel and button sizes retain native corners and positive center regions", () => {
  for (const [name, width, height] of [
    ["Panel", 320, 180], ["Panel", 120, 240],
    ["Button", 160, 40], ["Button", 44, 44], ["Button", 200, 12],
  ]) {
    const source = nineSliceSources[name];
    const target = fitNineSlice(width, height, source);
    assert.equal(target.width, width);
    assert.equal(target.height, height);
    assert.equal(target.scaleX, 1);
    assert.equal(target.scaleY, 1);
    assert.ok(target.width > source.leftMargin + source.rightMargin);
    assert.ok(target.height > source.topMargin + source.bottomMargin);
  }
});

test("tiny controls avoid overlapping corners and still occupy their requested bounds", () => {
  for (const source of Object.values(nineSliceSources)) {
    for (const [width, height] of [[1, 1], [200, 2], [0.5, 40]]) {
      const target = fitNineSlice(width, height, source);
      assert.ok(target.width - source.leftMargin - source.rightMargin >= 1);
      assert.ok(target.height - source.topMargin - source.bottomMargin >= 1);
      assert.equal(target.width * target.scaleX, width);
      assert.equal(target.height * target.scaleY, height);
    }
  }
});

test("invalid target dimensions are rejected before creating canvas slices", () => {
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => fitNineSlice(invalid, 40, nineSliceSources.Button), RangeError);
    assert.throws(() => fitNineSlice(40, invalid, nineSliceSources.Panel), RangeError);
  }
});
