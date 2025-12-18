import * as ex from "excalibur";

export const Resources = {
  // Relative to /public in vite

  // Board Game Items
  Token: new ex.ImageSource("./images/board-game-icons/token.png"),
  Tokens: new ex.ImageSource("./images/board-game-icons/token.png"),
  TokensStack: new ex.ImageSource("./images/board-game-icons/tokens_stack.png"),
  DiceEmpty: new ex.ImageSource("./images/board-game-icons/dice_empty.png"),
  Dollar: new ex.ImageSource("./images/board-game-icons/dollar.png"),
  Dice1: new ex.ImageSource("./images/medieval/dice_1.png"),
  Dice2: new ex.ImageSource("./images/medieval/dice_2.png"),
  Dice3: new ex.ImageSource("./images/medieval/dice_3.png"),
  Dice4: new ex.ImageSource("./images/medieval/dice_4.png"),
  Dice5: new ex.ImageSource("./images/medieval/dice_5.png"),
  Dice6: new ex.ImageSource("./images/medieval/dice_6.png"),
  HandCube: new ex.ImageSource("./images/board-game-icons/hand_cube.png"),
  DiceOut: new ex.ImageSource("./images/board-game-icons/dice_out.png"),
  Pouch: new ex.ImageSource("./images/board-game-icons/pouch.png"),
  ChessQueen: new ex.ImageSource("./images/medieval/chess_queen.png"),
  ChessKing: new ex.ImageSource("./images/medieval/chess_king.png"),
  ChessRook: new ex.ImageSource("./images/medieval/chess_rook.png"),
  ChessKnight: new ex.ImageSource("./images/medieval/chess_knight.png"),
  ChessBishop: new ex.ImageSource("./images/medieval/chess_bishop.png"),
  ChessPawn: new ex.ImageSource("./images/medieval/chess_pawn.png"),
  SuitDiamonds: new ex.ImageSource(
    "./images/board-game-icons/suit_diamonds.png"
  ),
  SuitHearts: new ex.ImageSource("./images/board-game-icons/suit_hearts.png"),
  SuitSpades: new ex.ImageSource("./images/board-game-icons/suit_spades.png"),
  SuitClubs: new ex.ImageSource("./images/board-game-icons/suit_clubs.png"),
  DiceSkull: new ex.ImageSource("./images/board-game-icons/dice_skull.png"),
  CardTarget: new ex.ImageSource("./images/board-game-icons/card_target.png"),

  FlaskFull: new ex.ImageSource("./images/board-game-icons/flask_full.png"),

  // Cursors
  ResizeDCrossDiagonal: new ex.ImageSource(
    "./images/cursors/basic/double/resize_d_cross_diagonal.png"
  ),

  // UI Images
  UiPanel: new ex.ImageSource("./images/ui/panel.png"),
  UiButton: new ex.ImageSource("./images/ui/button.png"),
} as const;

export const SoundPaths = {
  FlapSound: "./sounds/flap.wav",
  FailSound: "./sounds/fail.wav",
  ScoreSound: "./sounds/score.wav",
  ChipLay1: "./sounds/kenny/casino-audio/chip-lay-1.ogg",
  ChipLay2: "./sounds/kenny/casino-audio/chip-lay-2.ogg",
  Soundtrack1: "./sounds/music/soundtrack_1.mp3",
  Soundtrack2: "./sounds/music/soundtrack_2.mp3",
  Soundtrack3: "./sounds/music/soundtrack_3.mp3",
  Soundtrack4: "./sounds/music/soundtrack_4.mp3",
  Soundtrack5: "./sounds/music/soundtrack_5.mp3",
};
export const Sounds: Record<keyof typeof SoundPaths, ex.Sound> = {
  FlapSound: undefined,
  FailSound: undefined,
  ScoreSound: undefined,
  ChipLay1: undefined,
  ChipLay2: undefined,
  Soundtrack1: undefined,
  Soundtrack2: undefined,
  // Soundtrack3: undefined,
} as any;

export type SoundKey = keyof typeof SoundPaths;

const UiNineSlices = {
  Button: {
    source: Resources.UiButton,
    sourceConfig: {
      width: 1024,
      height: 1024,
      topMargin: 0,
      leftMargin: 0,
      bottomMargin: 0,
      rightMargin: 0,
    },
  },
  Panel: {
    source: Resources.UiPanel,
    sourceConfig: {
      width: 1024,
      height: 1024,
      topMargin: 0,
      leftMargin: 0,
      bottomMargin: 0,
      rightMargin: 0,
    },
  },
};

export type NinesliceResourceOptions = {
  name: keyof typeof UiNineSlices;
  height: number;
  width: number;
  drawCenter?: boolean;
  horizontalStretch?: ex.NineSliceStretch;
  verticalStretch?: ex.NineSliceStretch;
};

export function getNineslice(config: NinesliceResourceOptions) {
  const { source, sourceConfig } = UiNineSlices[config.name];
  const nineSliceConfig = {
    sourceConfig: sourceConfig,
    source: source,
    width: config.width,
    height: config.height,
    destinationConfig: {
      drawCenter: config.drawCenter ?? true,
      horizontalStretch:
        config.horizontalStretch ?? ex.NineSliceStretch.Stretch,
      verticalStretch: config.verticalStretch ?? ex.NineSliceStretch.Stretch,
    },
  };

  return new ex.NineSlice(nineSliceConfig);
}
