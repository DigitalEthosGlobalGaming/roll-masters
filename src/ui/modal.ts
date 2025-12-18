import * as ex from "excalibur";
import { InputHandler } from "@src/input/input-manager";
import { Panel } from "@src/ui/panel";


export enum PanelBackgrounds {
  "Panel" = "Panel",
}

export class Modal extends Panel implements InputHandler {
  onInitialize(): void {
    this.background = PanelBackgrounds.Panel;
    this.size = ex.vec(400, 400);
  }
  onRender(): void {
    super.onRender();
  }
}
