/** Native patch geometry. Keep in sync with public/images/ui/medieval_ui_atlas.json. */
export const nineSliceSources = {
  Panel: { width: 64, height: 64, leftMargin: 8, topMargin: 8, rightMargin: 8, bottomMargin: 8 },
  Button: { width: 64, height: 64, leftMargin: 4, topMargin: 4, rightMargin: 4, bottomMargin: 4 },
} as const;

/** Frame textures have translucent centers; these fills sit behind the center slice only. */
export const nineSliceCenterColors = { Panel: "#241b16", Button: "#342018" } as const;

type SliceMargins = { leftMargin: number; rightMargin: number; topMargin: number; bottomMargin: number };

/** Keep a positive center slice, even when a control is smaller than its borders. */
export function fitNineSlice(width: number, height: number, margins: SliceMargins) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError("Nine-slice dimensions must be finite and positive");
  }
  const targetWidth = Math.max(width, margins.leftMargin + margins.rightMargin + 1);
  const targetHeight = Math.max(height, margins.topMargin + margins.bottomMargin + 1);
  return {
    width: targetWidth,
    height: targetHeight,
    scaleX: width / targetWidth,
    scaleY: height / targetHeight,
  };
}

export function getNineSliceCenter(width: number, height: number, margins: SliceMargins) {
  const target = fitNineSlice(width, height, margins);
  return {
    left: margins.leftMargin * target.scaleX,
    top: margins.topMargin * target.scaleY,
    width: (target.width - margins.leftMargin - margins.rightMargin) * target.scaleX,
    height: (target.height - margins.topMargin - margins.bottomMargin) * target.scaleY,
  };
}
