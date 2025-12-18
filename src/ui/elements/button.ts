import * as ex from "excalibur";
import { Panel, PanelBackgrounds } from "@src/ui/panel";
import { Tooltip } from "@src/player-systems/player-tooltip";
import { Label } from "@src/ui/elements/label";
import { SoundManager } from "@src/sound-manager";
import { SoundKey } from "@src/resources";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";

export type ButtonIcon = {
  imageSource: ex.ImageSource;
  width: number;
  height: number;
};
type ButtonOptions = {
  text?: string;
  icon?: ButtonIcon;
  onClick?: (e: ExtendedPointerEvent) => void;
};
export class Button extends Panel {
  private label?: Label;
  iconSprite?: ex.Sprite;
  options: ButtonOptions = {};
  _tooltip?: Tooltip;
  get tooltip(): Tooltip | undefined {
    return this._tooltip;
  }
  set tooltip(value: Tooltip | undefined | string) {
    let oldTooltip = this._tooltip;
    // Check if valiue is a string
    if (typeof value == "string") {
      value = {
        code: `button-${this.id}`,
        title: value,
        description: "",
      };
    }
    if (value?.code == this.tooltip?.code) {
      return;
    }

    this._tooltip = value;

    if (this.isHovered) {
      if (oldTooltip != null) {
        this.player?.hideTooltip(oldTooltip);
      }

      if (value != null) {
        this.player?.hideTooltip(value);
        this.player?.showTooltip(value);
      }
    }
  }
  hoverColor?: ex.Color = ex.Color.Brown;
  originalColor?: ex.Color;

  set icon(value: ButtonIcon) {
    let oldIcon = this.options.icon;
    let newKey = `${value.imageSource.path}-${value.width}-${value.height}`;
    let oldKey = `${oldIcon?.imageSource.path}-${oldIcon?.width}-${oldIcon?.height}`;
    if (newKey == oldKey) {
      return;
    }

    this.clearGraphics();
    this.iconSprite = undefined;
    this.options.icon = value;
    this.dirty = true;
  }

  disabled: boolean = false;

  get text() {
    return this.options.text ?? "";
  }

  set text(value: string | undefined | null) {
    value = value ?? "";
    if (this.text == value) {
      return;
    }
    this.options.text = value;
    this.setupLabel();
    this.dirty = true;
  }

  private _fontSize: number = 0;
  set fontSize(value: number) {
    if (this._fontSize == value) {
      return;
    }
    this._fontSize = value;
    if (this.text == "") {
      return;
    }
    this.setupLabel();
    this.dirty = true;
  }
  get fontSize(): number {
    return this._fontSize;
  }

  private _sound: SoundKey = "ChipLay2";
  set sound(value: SoundKey) {
    this._sound = value;
  }
  get sound(): SoundKey {
    return this._sound;
  }

  get labelSize(): ex.Vector {
    if (this.text == "") {
      return new ex.Vector(0, 0);
    }
    if (this.label == null) {
      return new ex.Vector(0, 0);
    }
    return this.label.size;
  }
  get labelWidth(): number {
    return this.labelSize.x;
  }
  get labelHeight(): number {
    return this.labelSize.y;
  }

  get iconSize(): ex.Vector {
    if (this.options?.icon == null) {
      return new ex.Vector(0, 0);
    }
    return new ex.Vector(
      this.options.icon.width ?? 0,
      this.options.icon.height ?? 0
    );
  }
  get iconWidth(): number {
    return this.iconSize.x;
  }
  get iconHeight(): number {
    return this.iconSize.y;
  }
  get width(): number {
    return this.padding + this.iconWidth + this.labelWidth;
  }
  get height(): number {
    return this.padding + this.labelHeight + this.iconHeight;
  }

  get size(): ex.Vector {
    return ex.vec(this.width, this.height);
  }

  set onClick(value: (e: ExtendedPointerEvent) => void) {
    this.options.onClick = value;
  }

  constructor(parent: Panel) {
    super(parent);
    this.background = PanelBackgrounds.Button;
    this.padding = 20;
  }

  onHoverChanged(e: ExtendedPointerEvent): void {
    super.onHoverChanged(e);
    if (this.hoverColor != null) {
      if (this.isHovered) {
        this.originalColor = this.color.clone();
        this.color = this.hoverColor;
      } else {
        this.color = this.originalColor ?? this.color;
      }
    }
    if (e.pointerType != "Mouse") {
      this.player?.clearTooltips();
    }
    if (this.tooltip != null) {
      if (this.isHovered) {
        this.player?.showTooltip(this.tooltip);
      } else {
        this.player?.hideTooltip(this.tooltip);
      }
    }
  }

  onPointerDown(_e: ExtendedPointerEvent): void {
    super.onPointerDown(_e);
    if (this.disabled) {
      return;
    }
    SoundManager.play("ChipLay2");
    this.emit("button-clicked", _e);
    if (this.options.onClick != null) {
      this.options.onClick(_e);
    }
  }

  setupLabel() {
    const text = this.text;
    if (text != "") {
      this.label = this.addPanel("label", Label);
    } else {
      this.label?.kill();
      this.label = undefined;
      return;
    }

    this.label.color = this.color;
    this.label.fontSize = this._fontSize;
    this.label.text = text ?? "";
  }

  override onRender(): void {
    super.onRender();
    const { icon } = this.options ?? {
      text: "Hello world",
    };

    this.setupLabel();

    if (icon != null) {
      if (this.iconSprite == null) {
        this.iconSprite = ex.Sprite.from(icon.imageSource);
        this.iconSprite.destSize = {
          width: icon.width,
          height: icon.height,
        };
        let offset = new ex.Vector(icon.width, icon.height).scale(-0.5);
        if (this.label != null) {
          let totalWidth = this.width;
          let labelPercent = this.labelWidth / totalWidth;
          let iconSize = this.iconWidth / 2 + 5;
          let labelPos =
            -totalWidth * labelPercent + this.labelWidth - iconSize;
          this.label.pos = ex.vec(labelPos, 0);
          offset = offset.add(
            new ex.Vector(labelPos + this.labelWidth / 2 + iconSize, 0)
          );
        }
        this.addGraphic(this.iconSprite, offset);
      }
    }

    // if (this.label != null && this.icon != null) {

    // } else {
    //   if (this.label != null) {
    //     this.label.pos = ex.vec(0, 0);
    //   }
    // }
  }

  override render(): void {
    const wasDirty = this.isChildDirty;
    super.render();
    if (wasDirty) {
      let oldSize = super.size;
      let newSize = this.size;
      if (!oldSize.equals(newSize)) {
        this.dirty = true;
      }
    }
  }
}
