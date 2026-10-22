import { forceArray } from "./utility/force-array";
import { quickHash } from "./utility/hash";

type Category = "Features" | "Fixes" | "Technical";
// Date will be formated as "YYYY-MM-DD"
// Key in updates is the category
// Value in updates is the list of updates for that category
export type GameUpdate = {
  id: number;
  date: string;
  updates: Record<string, string[]>;
};

const updates: Record<string, GameUpdate> = {};

function addUpdate(date: string, category: Category, items: string | string[]) {
  let update = updates[date];
  if (updates[date] == null) {
    update = updates[date] = {
      id: quickHash([date, category, items]),
      date: date,
      updates: {},
    };
  }
  if (update.updates[category] == null) {
    update.updates[category] = [];
  }
  items = forceArray(items);
  update.updates[category].push(...items);
}

addUpdate("2025-01-20", "Features", "Added in updates menu.");
addUpdate("2025-01-20", "Features", "Added in saving and loading.");
addUpdate("2025-01-20", "Fixes", "Fixed ui breaking when screen was resized.");
addUpdate(
  "2025-01-22",
  "Technical",
  "Refactored the UI to be more stable and easier to use."
);

addUpdate(
  "2025-01-23",
  "Technical",
  "Added in the ability to view history builds and added the version number to the welcome screen."
);
addUpdate(
  "2025-01-23",
  "Features",
  "Dice rollers now all roll at the same time."
);
addUpdate(
  "2025-01-23",
  "Features",
  "Hovering over buildings animate them to be larger."
);
addUpdate(
  "2025-01-23",
  "Features",
  "Added in wandering knights which move around and empower dice."
);

addUpdate(
  "2025-01-24",
  "Fixes",
  "Fixed an issue where the knight would move off the screen."
);
addUpdate(
  "2025-01-24",
  "Features",
  "Knights now move to their new position instead of teleporting."
);
addUpdate("2025-01-24", "Features", "Escape now goes back to the main menu.");
addUpdate(
  "2025-01-24",
  "Features",
  "Added in tooltips when hovering over buildings."
);

addUpdate(
  "2025-01-28",
  "Features",
  "Added in a 'progression' like system that unlocks new buildings and upgrades as you research."
);
addUpdate(
  "2025-01-28",
  "Features",
  "Added in a new Bishop piece that rolls diagonals."
);
addUpdate("2025-01-29", "Features", "Game now saves every 30 seconds.");
addUpdate(
  "2025-01-29",
  "Features",
  "Added in a new Rook piece that moves through dice."
);
addUpdate(
  "2025-01-29",
  "Technical",
  "Made it so we limit the number of score particles based on FPS."
);

// 2025-01-30
addUpdate(
  "2025-01-30",
  "Fixes",
  "Fixed the sound system looping forever and crashing the game."
);
addUpdate(
  "2025-01-31",
  "Features",
  "Added in the prestige system and 2 upgrades."
);
addUpdate(
  "2025-01-31",
  "Technical",
  "Found some bugs in the dice rolling that was creating 100x more animations than needed to be created."
);

const showAfter = "2025-01-24";
addUpdate("2026-10-22", "Fixes", "Button text now draws above button backgrounds, including the main menu.");
addUpdate("2026-10-22", "Features", "B3 green-and-brass buttons now have square normal, hover, pressed and disabled skins.");
addUpdate("2026-10-22", "Fixes", "Button frames now resize with nine-slice tiles, preserving corner details on longer controls.");
addUpdate("2026-10-21", "Features", [
  "Rebuilt the HUD with separate board tools, Research, Prestige and game menus.",
  "Added a mobile Build picker, readable upgrade cards and clear prestige confirmation.",
  "Added in-game Help, larger text, reduced motion and audio settings.",
]);
addUpdate("2026-10-21", "Fixes", "Spending gold no longer reduces earned prestige progress. Gold is awarded before visual feedback completes.");

addUpdate("2026-10-22", "Features", "Settings now show every choice, with clearer descriptions, mobile layouts, and controls that save immediately.");

addUpdate("2026-10-22", "Features", "Buttons now have crisp drawn gold frames, green faces, and a gentle press response that respects reduced motion.");

export const gameUpdates = Object.values(updates)
  .filter((item) => item.date >= showAfter)
  .sort((a, b) => {
    return -a.date
      .toLocaleLowerCase()
      .localeCompare(b.date.toLocaleLowerCase());
  });
