// Exercise real Excalibur draw transforms under Node. No browser or asset pixels are loaded.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

class Canvas {
  width = 1; height = 1;
  getContext() { return new Proxy({}, { get: () => () => {} }); }
  setAttribute() {}
}
globalThis.window = {};
globalThis.document = { createElement: () => new Canvas() };
globalThis.HTMLCanvasElement = Canvas;
globalThis.Image = class {
  width = 64; height = 64; src = "synthetic-loaded-image";
  setAttribute() {}
};

const engineUrl = new URL("../node_modules/excalibur/build/esm/excalibur.js", import.meta.url).href;
const ex = await import(engineUrl);
// Load the real factory, bypassing the general UI suite's resources/engine mocks.
const source = stripTypeScriptTypes(readFileSync(new URL("../src/resources.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`)
  .replace('from "./ui/nine-slice-config"', `from "${new URL("../src/ui/nine-slice-config.ts", import.meta.url).href}"`);
const { getUiBackground } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const buttonSource = stripTypeScriptTypes(readFileSync(new URL("../src/ui/atlas-button-skin.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`)
  .replace('from "./atlas-button-layout"', `from "${new URL("../src/ui/atlas-button-layout.ts", import.meta.url).href}"`);
const { AtlasButtonSkin } = await import(`data:text/javascript,${encodeURIComponent(buttonSource)}`);
const surfaceSource = stripTypeScriptTypes(readFileSync(new URL("../src/ui/elements/button-surface.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`);
const { ButtonSurface } = await import(`data:text/javascript,${encodeURIComponent(surfaceSource)}`);
const boardSource = stripTypeScriptTypes(readFileSync(new URL("../src/graphics/board.ts", import.meta.url), "utf8"))
  .replace('from "excalibur"', `from "${engineUrl}"`);
const { createBoardGraphic, boardPadding } = await import(`data:text/javascript,${encodeURIComponent(boardSource)}`);

class DrawRecorder {
  matrix = ex.AffineMatrix.identity(); stack = []; draws = []; opacity = 1;
  save() { this.stack.push({ matrix: this.matrix.clone(), opacity: this.opacity, tint: this.tint }); }
  restore() { Object.assign(this, this.stack.pop()); }
  translate(x, y) { this.matrix.translate(x, y); }
  scale(x, y) { this.matrix.scale(x, y); }
  multiply(matrix) { this.matrix = this.matrix.multiply(matrix); }
  drawRectangle(position, width, height, color) {
    const start = this.matrix.multiply(position);
    const end = this.matrix.multiply(position.add(ex.vec(width, height)));
    this.draws.push({ left: start.x, top: start.y, right: end.x, bottom: end.y, fill: color.toHex() });
  }
  drawImage(_image, ...args) {
    const [x, y, width = _image.width, height = _image.height] = args.length === 8 ? args.slice(4) : args;
    const start = this.matrix.multiply(ex.vec(x, y));
    const end = this.matrix.multiply(ex.vec(x + width, y + height));
    this.draws.push({ left: start.x, top: start.y, right: end.x, bottom: end.y, tint: this.tint, source: args.length === 8 ? args.slice(0, 4) : undefined });
  }
}

test("cached board rasterizes once and preserves its frame bounds through camera transforms", () => {
  const board = createBoardGraphic(16, 16, 32, 32, ex.Color.fromHex("#20352e"));
  const execute = board.execute.bind(board);
  let rasterizations = 0;
  board.execute = ctx => { rasterizations++; execute(ctx); };
  for (const zoom of [0.5, 1, 2]) {
    const ctx = new DrawRecorder(); ctx.translate(100, 50); ctx.scale(zoom, zoom);
    for (let i = 0; i < 10; i++) board.draw(ctx, -boardPadding, -boardPadding);
    assert.equal(ctx.draws.length, 10);
    assert.equal(ctx.draws[0].left, 100 - boardPadding * zoom);
    assert.equal(ctx.draws[0].right, 100 + (512 + boardPadding) * zoom);
  }
  assert.equal(rasterizations, 1);
  const larger = createBoardGraphic(18, 18, 32, 32, ex.Color.fromHex("#20352e"));
  assert.equal(larger.width, 576 + boardPadding * 2);
});

test("procedural frames draw every state inside short, long, tall and tiny button bounds", () => {
  for (const [width, height] of [[48, 48], [220, 48], [360, 56], [72, 120], [10.5, 2.5]]) {
    for (const state of ["normal", "hover", "pressed", "disabled"]) {
      const surface = new ButtonSurface({ width, height }); surface.state = state; surface.disabled = state === "disabled";
      surface.updateMotion(state === "pressed", false, 100);
      const group = new ex.GraphicsGroup({ useAnchor: false, members: [{ graphic: surface, offset: ex.vec(-width / 2, -height / 2) }] });
      const context = new DrawRecorder(); group.draw(context, 123, 456);
      assert.ok(context.draws.length > 20);
      for (const draw of context.draws) {
        assert.ok(draw.left >= -width / 2 - 1e-8 && draw.right <= width / 2 + 1e-8);
        assert.ok(draw.top >= -height / 2 - 1e-8 && draw.bottom <= height / 2 + 1e-8);
        assert.ok(draw.right > draw.left && draw.bottom > draw.top);
      }
      const fill = { normal: "#2e4a33", hover: "#37573c", pressed: "#213526", disabled: "#34372f" }[state];
      assert.ok(context.draws.some(draw => draw.fill === fill));
      if (width >= 28 && height >= 28) {
        const brackets = context.draws.filter(draw => Math.abs(draw.right - draw.left - 11) < 1e-8 && Math.abs(draw.bottom - draw.top - 5) < 1e-8);
        assert.equal(brackets.length, 4, "bracket dimensions stay fixed as the button grows");
      }
    }
  }
});

test("quiet menu buttons keep every state and focus frame within their bounds", () => {
  for (const [width, height] of [[115, 52], [520, 60], [10.5, 2.5]]) {
    for (const state of ["normal", "hover", "pressed", "disabled"]) {
      const surface = new ButtonSurface({ width, height });
      surface.quiet = true; surface.focused = true; surface.state = state; surface.disabled = state === "disabled";
      surface.updateMotion(state === "pressed", false, 100);
      const context = new DrawRecorder(); surface.draw(context, 0, 0);
      assert.ok(context.draws.length > 0);
      for (const draw of context.draws) {
        assert.ok(draw.left >= 0 && draw.top >= 0 && draw.right <= width && draw.bottom <= height);
        assert.ok(draw.right > draw.left && draw.bottom > draw.top);
      }
      assert.equal(surface.clone().quiet, true);
    }
  }
});

test("procedural button easing settles, reverses continuously and respects quiet mode", () => {
  const surface = new ButtonSurface({ width: 100, height: 48 });
  surface.updateMotion(true, false, 25); const partial = surface.pressOffset;
  assert.ok(partial > 0 && partial < 3);
  surface.updateMotion(false, false, 0); assert.equal(surface.pressOffset, partial);
  surface.updateMotion(false, false, 100); assert.equal(surface.pressOffset, 0);
  surface.pulse(); surface.updateMotion(false, false, 1000); assert.equal(surface.pressOffset, 0);
  surface.updateMotion(true, true, 16); assert.equal(surface.contentOffset, 0);
  assert.equal(surface.updateMotion(false, true, 16), false);
});

test("real atlas nine-slice preserves state offsets and fixed corners through resize", () => {
  const image = { width: 256, height: 256, image: new Image(), ready: Promise.resolve(), isLoaded: () => true };
  const skin = new AtlasButtonSkin(image, { x: 128, y: 128, width: 128, height: 128 }, 96, 48,
    { left: 28, right: 28, top: 28, bottom: 28, pixelScale: 0.5 }, { color: "#263C29", inset: 8 });
  assert.deepEqual(skin.members.slice(0, 3).map(member => [member.offset.x, member.offset.y, member.graphic.width, member.graphic.height]), [[6, 6, 84, 36], [4, 14, 88, 20], [14, 4, 68, 40]]);
  for (const [width, height] of [[96, 48], [220, 48], [360, 56], [72, 72], [10.5, 2.5]]) {
    skin.resize(width, height);
    const group = new ex.GraphicsGroup({ useAnchor: false, members: [{ graphic: skin, offset: ex.vec(-width / 2, -height / 2) }] });
    const context = new DrawRecorder(); group.draw(context, 123, 456);
    const draws = context.draws.filter(draw => draw.source);
    // The backing is a Raster; the nine atlas sprites refer to the supplied 256px image.
    const atlasDraws = draws.filter(draw => draw.source[0] >= 128 && draw.source[1] >= 128);
    assert.equal(atlasDraws.length, 9);
    assert.deepEqual(atlasDraws[0].source, [128, 128, 28, 28]);
    assert.deepEqual(atlasDraws[8].source, [228, 228, 28, 28]);
    assert.ok(Math.abs(Math.min(...draws.map(draw => draw.left)) + width / 2) < 1e-8);
    assert.ok(Math.abs(Math.max(...draws.map(draw => draw.right)) - width / 2) < 1e-8);
    assert.ok(Math.abs(Math.max(...draws.map(draw => draw.bottom)) - height / 2) < 1e-8);
    if (width >= 29 && height >= 29) {
      assert.equal(atlasDraws[0].right - atlasDraws[0].left, 14);
      assert.equal(atlasDraws[0].bottom - atlasDraws[0].top, 14);
    }
  }
});

for (const [name, width, height] of [["Button", 68, 68], ["Panel", 320, 180], ["Button", 200, 12], ["Button", 2, 2]]) {
  test(`real ${name} background retains its offset and size inside a widget graphics group (${width}x${height})`, () => {
    const background = getUiBackground({ name, width, height });
    const widget = new ex.GraphicsGroup({ useAnchor: false, members: [
      { graphic: background, offset: ex.vec(-width / 2, -height / 2) },
    ] });
    const context = new DrawRecorder();
    // GraphicsSystem passes an anchor offset, intentionally ignored by the outer widget group.
    widget.draw(context, -width / 2, -height / 2);
    assert.ok(context.draws.length >= 10, "center backing and all nine real slices are drawn");
    assert.equal(Math.min(...context.draws.map(draw => draw.left)), -width / 2);
    assert.equal(Math.min(...context.draws.map(draw => draw.top)), -height / 2);
    assert.equal(Math.max(...context.draws.map(draw => draw.right)), width / 2);
    assert.equal(Math.max(...context.draws.map(draw => draw.bottom)), height / 2);
  });
}

test("real background groups preserve interactive tint and independent margin configs", () => {
  const background = getUiBackground({ name: "Button", width: 80, height: 44 });
  const tint = ex.Color.fromHex("#c9a77b");
  background.tint = tint;
  const context = new DrawRecorder();
  background.draw(context, -40, -22);
  assert.ok(context.draws.every(draw => draw.tint === tint));
  const first = background.members[1].graphic;
  const other = getUiBackground({ name: "Button", width: 80, height: 44 }).members[1].graphic;
  first.setMargins(1, 1, 1, 1);
  assert.equal(other.getConfig().sourceConfig.leftMargin, 4);
});
