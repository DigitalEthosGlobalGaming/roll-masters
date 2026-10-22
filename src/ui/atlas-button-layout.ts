export type ButtonSourceRect = { x: number; y: number; width: number; height: number };
export type ButtonSliceGeometry = { left: number; right: number; top: number; bottom: number; pixelScale: number };
export const b3ButtonGeometry: ButtonSliceGeometry = { left: 28, right: 28, top: 28, bottom: 28, pixelScale: 0.5 };

/** The 336Ã—128 atlas artwork uses a common, uniformly scaled corner footprint. */
export function getAtlasButtonSlices(source: ButtonSourceRect, width: number, height: number, geometry = b3ButtonGeometry) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0)) throw new RangeError("Button size must be positive and finite");
  const { left, right, top, bottom, pixelScale } = geometry;
  const naturalX = [left * pixelScale, right * pixelScale];
  const naturalY = [top * pixelScale, bottom * pixelScale];
  // Reserve a positive centre even for controls smaller than both corners together.
  const scaleX = Math.min(1, width / (naturalX[0] + naturalX[1] + 1));
  const scaleY = Math.min(1, height / (naturalY[0] + naturalY[1] + 1));
  const sourceWidths = [left, source.width - left - right, right];
  const sourceHeights = [top, source.height - top - bottom, bottom];
  if (sourceWidths[1] <= 0 || sourceHeights[1] <= 0) throw new RangeError("Button source is too small for its slice margins");
  const widths = [naturalX[0] * scaleX, width - (naturalX[0] + naturalX[1]) * scaleX, naturalX[1] * scaleX];
  const heights = [naturalY[0] * scaleY, height - (naturalY[0] + naturalY[1]) * scaleY, naturalY[1] * scaleY];
  const tiles = [];
  let y = 0, sourceY = source.y;
  for (let row = 0; row < 3; row++) {
    let x = 0, sourceX = source.x;
    for (let column = 0; column < 3; column++) {
      tiles.push({ sourceView: { x: sourceX, y: sourceY, width: sourceWidths[column], height: sourceHeights[row] }, x, y, width: widths[column], height: heights[row] });
      x += widths[column]; sourceX += sourceWidths[column];
    }
    y += heights[row]; sourceY += sourceHeights[row];
  }
  return tiles;
}
