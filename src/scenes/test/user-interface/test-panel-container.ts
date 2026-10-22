import * as ex from "excalibur";
import { Panel, PanelBackgrounds } from "@src/ui/panel";
export class TestPanelContainer extends Panel {
  margin = ex.vec(0, 0);
  setup(): void { }
  override onSetup(): void { this.background = PanelBackgrounds.Panel; this.setup(); }
  override onViewportChanged(): void { this.margin = this.screenSize.scale(0.05); this.size = this.screenSize.scale(0.9); this.topLeft = this.margin; this.invalidateLayout(); }
}
