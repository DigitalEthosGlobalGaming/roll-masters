import { ImageSource } from "excalibur";
import { Resources } from "@src/resources";
import { Roller } from "@src/buildings/roller";
import { WanderingKnight } from "@src/buildings/wandering-knight";
import { Dice } from "@src/buildings/dice";
import { Bishop } from "@src/buildings/bishop";
import { Rook } from "@src/buildings/rook";

export const PlayerActionKey = {
  NEWDICE: "NEW_DICE",
  NEWROLLER: "NEWROLLER",
  NEWKNIGHT: "NEWKNIGHT",
  BISHOP: "BISHOP",
  REMOVE: "REMOVE",
  UPGRADES: "UPGRADES",
  ROOK: "ROOK",
  NONE: "NONE",
};
export type PlayerActions = keyof typeof PlayerActionKey;

export enum PlayerActionTypes {
  BUILDABLE = "BUILDABLE",
  MENU = "MENU",
}

export type PlayerAction =
  | {
    name: string;
    code: PlayerActions;
    type: PlayerActionTypes.MENU;
    image: ImageSource;
    tooltip: string;
    unlocked?: boolean;
  }
  | PlayerActionBuildable;

type PlayerActionBuildable = {
  name: string;
  code: PlayerActions;
  type: PlayerActionTypes.BUILDABLE;
  unlocked?: boolean;
  building: {
    cost: () => number;
    classRef: (new () => any) | null;
  };
  image: ImageSource;
  tooltip: string;
};

let playerActions: PlayerAction[] = [];


export function getPlayerActions() {
  if (playerActions.length > 0) {
    return playerActions;
  }
  playerActions = [
    {
      code: "NEWDICE",
      image: Resources.DiceOut,
      name: "Buy Dice",
      type: PlayerActionTypes.BUILDABLE,
      building: {
        cost: () => 10,
        classRef: Dice,
      },
      unlocked: true,
      tooltip:
        "Rolls to earn gold equal to its face.\nIn Roll mode, tap it to roll again.",
    },
    {
      code: "NEWROLLER",
      image: Resources.ChessPawn,
      name: "Buy Pawn",
      type: PlayerActionTypes.BUILDABLE,
      unlocked: false,
      building: {
        cost: () => 100,
        classRef: Roller,
      },
      tooltip: "Rolls every touching die, every 10 seconds.",
    },
    {
      code: "NEWKNIGHT",
      image: Resources.ChessKnight,
      name: "Buy Wandering Knight",
      type: PlayerActionTypes.BUILDABLE,
      building: {
        cost: () => 1000,
        classRef: WanderingKnight,
      },
      tooltip: "Wanders the board, strengthening the dice it visits.",
    },
    {
      code: "ROOK",
      image: Resources.ChessRook,
      name: "Buy Rook",
      type: PlayerActionTypes.BUILDABLE,
      building: {
        cost: () => 125000,
        classRef: Rook,
      },
      tooltip:
        "Slides through pieces to a random space, adding multipliers to dice it passes.",
    },
    {
      code: "BISHOP",
      image: Resources.ChessBishop,
      name: "Buy Bishop",
      type: PlayerActionTypes.BUILDABLE,
      unlocked: false,
      building: {
        cost: () => 10000,
        classRef: Bishop,
      },
      tooltip: "Rolls dice along its diagonals.",
    },
    {
      code: "REMOVE",
      image: Resources.DiceSkull,
      name: "Remove",
      unlocked: true,
      building: {
        cost: () => 0,
        classRef: null,
      },
      type: PlayerActionTypes.BUILDABLE,
      tooltip: "Removes a piece from the board. No refund.",
    },
    {
      code: "UPGRADES",
      image: Resources.FlaskFull,
      unlocked: true,
      name: "Show Research",
      type: PlayerActionTypes.MENU,
      tooltip: "Show the research panel.",
    },
  ] as any;
  return playerActions;

}
