# Asset map from source text

Use `src/resources.ts` and its callers as the current authority. This inventory
requires no inspection of existing pixels. Names below match current paths;
replacements require the user's replacement intent, otherwise use new filenames.

| Resource / purpose | Destination under public/images | Notes |
| --- | --- | --- |
| Dice1–Dice6 | medieval/dice_1.png … dice_6.png | Exact face values; one aligned set. |
| DiceEmpty | medieval/dice_empty.png | Blank face. |
| ChessPawn / Roller | medieval/chess_pawn.png | Buildable pawn automation. |
| ChessKnight | medieval/chess_knight.png | Wandering knight. |
| ChessBishop | medieval/chess_bishop.png | Diagonal rolling. |
| ChessRook | medieval/chess_rook.png | Moving automation. |
| ChessKing, ChessQueen | medieval/chess_king.png, medieval/chess_queen.png | Registered art; not current build actions. |
| DiceOut | medieval/dice_out.png | Buy/place dice action. |
| DiceSkull | medieval/dice_skull.png | Remove action. |
| FlaskFull | medieval/flask_full.png | Research action. |
| Dollar | medieval/dollar.png | Default upgrade icon, now a gold arrow on a shield. |
| SuitDiamonds | medieval/suit_diamonds.png | Floating score gem. |
| Token, Tokens | board-game-icons/token.png | Both currently reference the same file. |
| TokensStack | board-game-icons/tokens_stack.png | Supporting icon. |
| Pouch, HandCube | board-game-icons/pouch.png, board-game-icons/hand_cube.png | Supporting icons. |
| SuitHearts/Spades/Clubs | board-game-icons/suit_hearts.png etc. | Supporting icons. |
| CardTarget | board-game-icons/card_target.png | Supporting icon. |
| ResizeDCrossDiagonal | medieval/resize_d_cross_diagonal.png | Grid hover brackets. |
| UiPanel, UiButton | ui/medieval_panel.png, ui/medieval_button.png | 64×64 patches; panel borders8px, button borders4px. Packed in ui/medieval_ui_atlas.png with a JSON descriptor. |

For a unified new set, put new gameplay art under `medieval/`, new UI under `ui/`,
and cursors under `cursors/`. Map changed locations explicitly in `Resources`.
Do not silently move existing files. Retain snake_case PNG basenames to match the
asset naming convention. Do not generate every inventory item by default.

Important consumers: `buildings/dice.ts` uses a blank followed by six numbered
faces and builds roll animation from them. `building.ts` fits sprites into a
24×24 footprint. `player-systems/player-actions.ts` associates artwork with actions.
`ui/nine-slice-config.ts` defines UI source dimensions and margins;
keep `public/images/ui/medieval_ui_atlas.json` consistent with it. The runtime uses
extracted patches because Excalibur's NineSlice source config has no atlas offset.
Artwork should fill patch edges, with transparent corner cutouts but no outer
gutter; import UI patches with padding0. Runtime dice tinting shifts
towards gold/yellow as multipliers increase. Settings can alter graphics behavior.

The medieval UI textures are translucent frame skins. `getUiBackground()` layers
a solid dark rectangle under only the center slice before drawing the frame;
`getNineslice()` returns the raw frame graphic. Keep `centerColor` in the atlas
descriptor in sync with `nineSliceCenterColors`. Do not flatten the whole frame
over a matte or fill the transparent corners when preparing future variants.
