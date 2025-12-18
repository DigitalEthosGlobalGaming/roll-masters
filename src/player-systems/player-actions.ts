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
        "10\u23E2 - Will roll to generate income.\n         Click to roll once placed.",
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
      tooltip: "100\u23E2 - Every 10 seconds will roll all touching dice.",
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
      tooltip: "1000\u23E2 - Moves around the board, strenghtening dice.",
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
        "125000 - Moves to a random space through buildings. Adding multipliers to dice passed.",
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
      tooltip: "10000\u23E2 - Rolls dice in a diagonal pattern.",
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
      tooltip: "Removes a dice from the board.",
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
