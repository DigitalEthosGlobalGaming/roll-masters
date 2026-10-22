import type { PlayerAction } from "./player-actions";

export type Tooltip = { code: string; title: string; description: string; cost?: number };

/** Build the tooltip for a toolbar action; placing tools carry their gold cost. */
export function actionTooltip(action: PlayerAction): Tooltip {
  const cost = "building" in action && action.code !== "REMOVE" ? action.building.cost() : undefined;
  return { code: action.code, title: action.name, description: action.tooltip, cost };
}
