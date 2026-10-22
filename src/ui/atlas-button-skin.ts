import * as ex from "excalibur";
import { getAtlasButtonSlices, b3ButtonGeometry } from "./atlas-button-layout";
import type { ButtonSourceRect } from "./atlas-button-layout";
import type { ButtonSliceGeometry } from "./atlas-button-layout";

/** Nine atlas-aware sprites preserve corner art without extracting or altering pixels. */
export class AtlasButtonSkin extends ex.GraphicsGroup {
  readonly sourceView: ButtonSourceRect;
  private tiles: { graphic: ex.Sprite; offset: ex.Vector }[];
  private targetWidth: number;
  private targetHeight: number;
  private geometry: ButtonSliceGeometry;
  private fillMembers: { graphic: ex.Rectangle; offset: ex.Vector }[];
  private fillInset: number;
  constructor(image: ex.ImageSource, source: ButtonSourceRect, width: number, height: number, geometry: ButtonSliceGeometry = b3ButtonGeometry, fill?: { color: string; inset: number }) {
    const tiles = getAtlasButtonSlices(source, width, height, geometry).map(tile => ({
      graphic: new ex.Sprite({ image, sourceView: tile.sourceView,
        destSize: { width: tile.sourceView.width, height: tile.sourceView.height },
        scale: ex.vec(tile.width / tile.sourceView.width, tile.height / tile.sourceView.height) }),
      offset: ex.vec(tile.x, tile.y),
    }));
    // Nested inside Panel's actor-local group; retain the caller's placement offset.
    const fillMembers = fill ? Array.from({ length: 3 }, () => ({ graphic: new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex(fill.color) }), offset: ex.vec(0, 0) })) : [];
    super({ members: [...fillMembers, ...tiles], useAnchor: true });
    this.sourceView = { ...source };
    this.tiles = tiles;
    this.geometry = geometry;
    this.fillMembers = fillMembers; this.fillInset = fill?.inset ?? 0;
    this.targetWidth = width; this.targetHeight = height;
    this.resizeFill(width, height);
  }
  private resizeFill(width: number, height: number): void {
    if (!this.fillMembers.length) return;
    const corner = getAtlasButtonSlices(this.sourceView, width, height, this.geometry)[0];
    const map = (position: number, sourceSize: number, targetSize: number, start: number, end: number, cap: number) => {
      const scale = cap / start;
      if (position <= start) return position * scale;
      if (position >= sourceSize - end) return targetSize - (sourceSize - position) * scale;
      return cap + (position - start) / (sourceSize - start - end) * (targetSize - (start + end) * scale);
    };
    const { left, right, top, bottom } = this.geometry;
    const w = this.sourceView.width, h = this.sourceView.height;
    const inset = this.fillInset, cornerInset = inset + 4;
    // Creator-verified union: inset12 centre, inset8 straight inner rails,
    // stopping at28px corner caps. An inset8 box alone leaks into the cutouts.
    const boxes = [[cornerInset, cornerInset, w - cornerInset, h - cornerInset], [inset, top, w - inset, h - bottom], [left, inset, w - right, h - inset]];
    boxes.forEach(([x1, y1, x2, y2], index) => {
      const x = map(x1, w, width, left, right, corner.width), y = map(y1, h, height, top, bottom, corner.height);
      const member = this.fillMembers[index];
      member.offset = ex.vec(x, y);
      member.graphic.width = Math.max(0, map(x2, w, width, left, right, corner.width) - x);
      member.graphic.height = Math.max(0, map(y2, h, height, top, bottom, corner.height) - y);
    });
  }
  resize(width: number, height: number): void {
    if (width === this.targetWidth && height === this.targetHeight) return;
    const slices = getAtlasButtonSlices(this.sourceView, width, height, this.geometry);
    slices.forEach((slice, index) => {
      const tile = this.tiles[index];
      // Sprite rounds destination pixels on load; scale integer source-sized tiles
      // instead so fractional/small destinations cannot grow seams or overshoot.
      tile.graphic.scale = ex.vec(slice.width / slice.sourceView.width, slice.height / slice.sourceView.height);
      tile.offset = ex.vec(slice.x, slice.y);
    });
    this.targetWidth = width; this.targetHeight = height;
    this.resizeFill(width, height);
  }
}
