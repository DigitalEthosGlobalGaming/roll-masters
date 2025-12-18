import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { GameScene } from "@src/scenes/game.scene";
import { Button } from "@src/ui/elements/button";
import { Panel } from "@src/ui/panel";
import * as ex from "excalibur";
import { Player } from "./player";
import { PlayerAction, getPlayerActions } from "./player-actions";

export class PlayerActionButton extends Button {
  _action: PlayerAction | null = null;
  set action(value: PlayerAction) {
    this._action = value;
    this.icon = {
      imageSource: value.image,
      width: 64,
      height: 64,
    };
  }
  get action(): PlayerAction {
    if (this._action == null) {
      throw new Error("Action is null");
    }
    return this._action;
  }
  isFocused: boolean = false;

  getParent<T = PlayerActionsUi>(): T {
    if (this.parent instanceof PlayerActionsUi) {
      return this.parent as T;
    }
    throw new Error("Parent is not a PlayerActionsUi");
  }

  override onHoverChanged(e: ExtendedPointerEvent): void {
    super.onHoverChanged(e);
    if (this.isHovered) {
      this.getParent().hoveredAction = this.action;
    }

    this.updateColor();
  }

  onPointerUp(_e: ex.PointerEvent): void {
    this.getParent().changeAction(this.action);
  }

  updateColor() {
    const defaultColor = ex.Color.White;
    
    const focusedColor = ex.Color.Brown
    let colors = {
      hovered: defaultColor.clone().darken(0.5),
      focused: focusedColor,
      normal: ex.Color.White,
    };
    if (this.isFocused) {
      this.color = colors.focused;
    } else {
      this.color = colors.normal;
    }
    if (this.isHovered) {
      this.backgroundColor = colors.hovered;
    } else {
      this.backgroundColor = colors.normal;
    }
  }

  setFocused(value: boolean) {
    if (value != this.isFocused) {
      this.isFocused = value;
      this.updateColor();
    }
  }

  override collides(vec: ex.Vector): boolean {
    if (this.acceptingInputs === false) {
      return false;
    }

    const bounds = this.globalBounds;
    if (bounds == null) {
      return false;
    }
    return bounds.contains(vec);
  }
}

export class PlayerActionsUi extends Panel {
  get level(): GameScene {
    if (this.scene instanceof GameScene) {
      return this.scene;
    }
    throw new Error("Scene is not a GameScene");
  }
  get player(): Player {
    if (this.level.player == null) {
      throw new Error("Player is null");
    }
    return this.level.player;
  }
  get playerActions(): PlayerAction[] {
    return getPlayerActions().filter((a) => a.unlocked);
  }

  buttons: PlayerActionButton[] = [];

  hoveredAction: PlayerAction | null = null;
  get acceptingInputs() {
    return false;
  }

  get currentAction(): PlayerAction | null {
    return (
      getPlayerActions().find((a) => a.code == this.player.currentAction) ?? null
    );
  }
  set currentAction(value: PlayerAction) {
    if (this.player.currentAction == value.code) {
      return;
    }
    this.player.currentAction = value.code;
    this.dirty = true;
  }

  changeAction(action: PlayerAction) {
    for (let button of this.buttons) {
      if (button.action?.code == action.code) {
        button.setFocused(true);
      } else {
        button.setFocused(false);
      }
    }

    this.currentAction = action;
  }

  onRender(): void {
    if (this.player == null) {
      return;
    }

    const bounds = this.getParentBounds();
    const width = bounds?.width ?? 0;
    const height = bounds?.height ?? 0;
    const buttonWidth = 64;
    const spacing = 32;
    const totalWidth =
      this.playerActions.length * (buttonWidth + spacing) - spacing;
    const startX = (width - totalWidth) / 2;

    for (let i = 0; i < this.playerActions.length; i++) {
      const action = this.playerActions[i];
      const button = this.addPanel(
        `player-action-ui-${action.code}`,
        PlayerActionButton
      );
      button.action = action;
      const x = startX + i * (buttonWidth + spacing);
      button.pos = new ex.Vector(x, height - buttonWidth - 10);
      button.tooltip = {
        code: action.code,
        title: action.name,
        description: action.tooltip,
      };
      button.sound = "ChipLay1";
      this.buttons.push(button);
    }
    if (this.currentAction == null) {
      this.changeAction(this.playerActions[0]);
      return;
    }
  }
}
