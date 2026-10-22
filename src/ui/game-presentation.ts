export const prestigeThreshold = 1_000_000;
export function prestigeReward(earned: number): number {
  return Math.max(0, Math.floor(earned / prestigeThreshold));
}
export function formatGold(value: number): string { return Math.floor(value).toLocaleString("en"); }
export function formatCompactGold(value: number): string {
  if (value < 1000) return formatGold(value);
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export const helpTopics = [
  { title: "Your first roll", text: "Choose Dice. Tap an empty square to spend 10 gold and place a die. Choose Roll, then tap the die to earn gold." },
  { title: "Automate your rolls", text: "Pawns roll touching dice. Bishops roll along diagonals. Research unlocks more pieces for your board." },
  { title: "Boost your dice", text: "Wandering Knights strengthen nearby dice as they move. Rooks strengthen dice they pass." },
  { title: "Build and remove", text: "Tap a tool to select it. Keep placing until you choose Done to return to Roll. Remove deletes pieces without a refund." },
  { title: "Explore the board", text: "Drag to pan. Pinch or scroll to zoom. Open Menu, then Board view to centre the board or adjust zoom." },
  { title: "Research upgrades", text: "Open Ascend for Research and Prestige. Research spends gold to unlock pieces and improve this run. Cards show each effect and cost." },
  { title: "Earn prestige points", text: "Each 1,000,000 gold earned this run grants one point when you prestige. Spending gold does not reduce this progress." },
  { title: "Rise again", text: "Prestige resets your board, research and piece unlocks. Permanent upgrades and unspent prestige points stay with you." },
];

export const buildRequirements: Record<string, string> = {
  NEWDICE: "Available from the start",
  NEWROLLER: "Place your first die",
  NEWKNIGHT: "Research Wandering Knight (after Dice Boosters level 5)",
  BISHOP: "Research Bishop (after Wandering Knight level 5)",
  ROOK: "Research Rook (after Wandering Knight level 5)",
};

export function safeInsets(): { top: number; right: number; bottom: number; left: number } {
  const style = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement) : undefined;
  const value = (edge: string) => Math.max(12, parseFloat(style?.getPropertyValue(`--safe-${edge}`) ?? "0") || 0);
  return { top: value("top"), right: value("right"), bottom: value("bottom"), left: value("left") };
}
