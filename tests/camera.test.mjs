import test from "node:test";
import assert from "node:assert/strict";
import { clampCameraZoom, zoomAnchorOffset } from "../src/player-systems/camera-controls.ts";

test("zoom stays within usable limits and rejects invalid values", () => {
  assert.equal(clampCameraZoom(0.1), 0.5);
  assert.equal(clampCameraZoom(4), 3);
  assert.equal(clampCameraZoom(1.5), 1.5);
  assert.equal(clampCameraZoom(NaN), 1);
});

test("zoom preserves the world point under an off-center screen anchor", () => {
  for (const oldZoom of [0.5, 1, 3]) {
    for (const newZoom of [0.5, 1, 3]) {
      for (const screenOffset of [-400, 0, 250]) {
        const worldPoint = 100 + screenOffset / oldZoom;
        const newCenter = 100 + zoomAnchorOffset(screenOffset, oldZoom, newZoom);
        assert.ok(Math.abs((worldPoint - newCenter) * newZoom - screenOffset) < 1e-9);
      }
    }
  }
});
