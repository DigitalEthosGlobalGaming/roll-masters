import { Environment, Settings } from "@src/env";

// One media query and settings listener for the app, rather than polling per actor/draw.
const media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
export const motionPreferences = { reduced: false, quiet: false };
function refresh() {
  motionPreferences.reduced = !!Environment.get("reduced-motion") || media?.matches === true;
  motionPreferences.quiet = motionPreferences.reduced || Environment.get("graphics") === Settings.graphics.basic;
}
Environment.onChange(refresh);
media?.addEventListener("change", refresh);
refresh();
