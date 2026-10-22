import * as ex from "excalibur";
import { Panel, PanelBackgrounds } from "./panel";
import { Button } from "./elements/button";
import { InputManager } from "@src/input/input-manager";
import { Level } from "@src/level";
import { safeInsets } from "./game-presentation";

export class Modal extends Panel {
  onClose: () => void = () => { this.visible = false; };
  protected closeButton!: Button;
  private shade!: Panel;
  private readonly shadeGraphic = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#080b0c") });
  private get manager(): InputManager | undefined { return this.scene instanceof Level ? this.scene.inputSystem : undefined; }
  override onSetup(): void {
    this.background = PanelBackgrounds.Panel;
    this.z = 100;
    this.acceptingInputs = true;
    this.shade = this.addPanel("backdrop", Panel); this.shade.z = -1;
    this.shadeGraphic.opacity = 0.72;
    this.shade.addGraphic(this.shadeGraphic);
    this.closeButton = this.addPanel("close", Button);
    this.closeButton.text = "Close";
    this.closeButton.onClick = () => this.onClose();
  }
  override onViewportChanged(): void {
    const inset = safeInsets();
    this.size = ex.vec(Math.min(720, this.screenWidth - inset.left - inset.right), Math.min(760, this.screenHeight - inset.top - inset.bottom));
    this.invalidateLayout();
  }
  override onLayout(): void { this.closeButton.topRight = ex.vec(this.halfWidth - 12, -this.halfHeight + 12); }
  override onRender(): void {
    this.shade.pos = ex.vec(-this.globalPos.x, -this.globalPos.y);
    if (this.shadeGraphic.width !== this.screenWidth) this.shadeGraphic.width = this.screenWidth;
    if (this.shadeGraphic.height !== this.screenHeight) this.shadeGraphic.height = this.screenHeight;
  }
  protected onBack(): void { this.onClose(); }
  override onVisibleChanged(value: boolean): void {
    if (value) this.invalidate(); else this.manager?.popModal(this);
  }
  override onRefresh(): void { if (this.rendered) this.manager?.pushModal(this, () => this.onBack()); }
  override onRemove(engine: ex.Engine): void { this.manager?.popModal(this); super.onRemove(engine); }
  override kill(): void { this.manager?.popModal(this); super.kill(); }
}
