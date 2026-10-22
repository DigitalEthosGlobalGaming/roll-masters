import * as ex from "excalibur";
import { Label } from "@src/ui/elements/label";
import { TestPanelContainer } from "./test-panel-container";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { ExtendedKeyEvent } from "@src/input/extended-key-event";

const positionsToSet = [
  "center",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
  "right",
  "left",
  "top",
  "bottom",
];

export class TestLabelPanel extends TestPanelContainer {
  currentPosIndex = 0;
  onKeyPress(evt: ExtendedKeyEvent): void {
    if (evt.key == ex.Keys.Space) {
      this.currentPosIndex++;
      if (this.currentPosIndex >= positionsToSet.length) {
        this.currentPosIndex = 0;
      }
      this.removeAllPanels();
      this.setup();
    }
  }
  setup() {
    if (this.currentPosIndex != 0) {
      this.removeAllPanels();
      let label = this.addPanel("label-positioning", Label);
      const anchor = positionsToSet[this.currentPosIndex];
      label.fontSize = 20;
      label.text = `Label ${anchor}`;
      label.pos = ex.vec(0, 0);
      if (this.currentPosIndex > 4) {
        (label as any)[anchor] = 0;
      } else {
        (label as any)[anchor] = ex.vec(0, 0);
      }
    } else {
      this.removePanel("label-positioning");
      let labelSizes = [20, 24, 32, 48, 64];
      let previousY = this.top;
      for (let i = 0; i < labelSizes.length; i++) {
        let label = this.addPanel("label-" + i, Label);
        label.acceptingInputs = true;
        label.text = `Label ${labelSizes[i]}`;
        label.fontSize = labelSizes[i];
        label.pos.y = previousY + label.halfHeight;
        label.onHoverChanged = (_evt: ExtendedPointerEvent) => {
          if (label.isHovered) {
            label.color = ex.Color.Green;
          } else {
            label.color = ex.Color.White;
          }
        };
        previousY = previousY + label.size.y + 10;
      }
    }
  }

}
