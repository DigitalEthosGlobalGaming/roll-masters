/** Where the coach should point. Resolved to screen geometry by the HUD, never here. */
export type TutorialTarget =
  | "action:roll" | "action:NEWDICE" | "action:NEWROLLER"
  | "ascend" | "board:spot" | "board:dice" | "board:pawn-spot" | "board:pawn";

export type TutorialIcon = "dice" | "pawn" | "pieces" | "gold";

/** Snapshot of the board the tutorial reasons about. */
export type TutorialFacts = { action: string; dice: number; pawns: number };

export type TutorialStep = {
  id: string;
  title: string;
  text: string;
  icon?: TutorialIcon;
  target?: TutorialTarget;
  /** Label of the manual "continue" button; steps without one advance on their own. */
  button?: string;
  /** Placement is refused anywhere except the highlighted board square. */
  lockToTarget?: boolean;
  /** Gold floor granted when the step begins, so the lesson is never blocked by saving up. */
  gift?: number;
  /** State-based completion. Also fast-forwards steps already satisfied when resuming. */
  done?: (facts: TutorialFacts) => boolean;
  /** Event-based completion, emitted by the game as `tutorial-signal`. */
  signal?: string;
};

export const tutorialSteps: readonly TutorialStep[] = [
  {
    id: "welcome", icon: "dice", button: "Let's go",
    title: "Welcome to Roll Masters",
    text: "Roll dice, earn gold, then build pieces that roll for you. Let's place your first die.",
  },
  {
    id: "pick-dice", icon: "dice", target: "action:NEWDICE",
    title: "Pick the Dice tool",
    text: "Tap Dice in the toolbar. A die costs 10 gold.",
    done: f => f.action === "NEWDICE" || f.dice > 0,
  },
  {
    id: "place-dice", icon: "dice", target: "board:spot", signal: "built:Dice", lockToTarget: true,
    title: "Place your die",
    text: "Tap the glowing square on the board.",
    done: f => f.dice > 0,
  },
  {
    id: "pick-roll", icon: "dice", target: "action:roll",
    title: "Switch to Roll",
    text: "Tap Roll to stop building and start rolling.",
    done: f => f.action === "NONE" && f.dice > 0,
  },
  {
    id: "roll-dice", icon: "dice", target: "board:dice", signal: "rolled:Dice",
    title: "Roll it!",
    text: "Tap your die. Every roll pays its face value in gold.",
  },
  {
    id: "earn", icon: "gold", button: "Continue",
    title: "That's income",
    text: "Higher faces pay more. Gold buys pieces that do the rolling for you.",
  },
  {
    id: "pick-pawn", icon: "pawn", target: "action:NEWROLLER", gift: 100,
    title: "Buy a Pawn",
    text: "Here's 100 gold. Choose Pawn from the toolbar. On small screens, open Build first.",
    done: f => f.action === "NEWROLLER" || f.pawns > 0,
  },
  {
    id: "place-pawn", icon: "pawn", target: "board:pawn-spot", signal: "built:Pawn", lockToTarget: true,
    title: "Place it beside your die",
    text: "Tap the glowing square next to your die.",
    done: f => f.pawns > 0,
  },
  {
    id: "roll-pawn", icon: "pawn", target: "board:pawn", signal: "rolled:Pawn",
    title: "Tap your Pawn",
    text: "A Pawn rolls every die touching it. It also does this by itself every 10 seconds, even while you're busy.",
  },
  {
    id: "pieces", icon: "dice", target: "ascend", button: "Next",
    title: "There's more to discover",
    text: "Research in Ascend unlocks new pieces and upgrades. Keep earning, and see what you uncover.",
  },
  {
    id: "finish", icon: "gold", button: "Start playing",
    title: "You're ready",
    text: "Grow your board, research upgrades, then Ascend to start stronger. Replay this from Menu any time.",
  },
];
