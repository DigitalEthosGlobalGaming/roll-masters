export const MIN_CAMERA_ZOOM = 0.5;
export const MAX_CAMERA_ZOOM = 3;

export function clampCameraZoom(zoom: number): number {
  return Number.isFinite(zoom) ? Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, zoom)) : 1;
}

/** World offset that keeps an anchor at the same screen pixel when zoom changes. */
export function zoomAnchorOffset(screenOffset: number, oldZoom: number, newZoom: number): number {
  return screenOffset * (1 / oldZoom - 1 / newZoom);
}
