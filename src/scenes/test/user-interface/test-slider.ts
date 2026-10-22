import { Slider } from "@src/ui/elements/slider";
import { TestPanelContainer } from "./test-panel-container";
import * as ex from "excalibur";

export class TestSliderPanel extends TestPanelContainer {
  override onLayout(): void {
    for (const slider of this.getChildrenPanels()) slider.size = ex.vec(Math.max(150, this.width / 2), 12);
  }
  setup() {
    const containerSize = this.size ?? ex.vec(0, 0);
    let sliderConfigs = [
      {
        min: 0,
        max: 10,
        step: 0.5,
        value: 5,
      },
      {
        min: 0,
        max: 100,
        step: 1,
        value: 50,
      },
      {
        min: 0,
        max: 1000,
        step: 10,
        value: 500,
      },
    ];
    let lastSlider: Slider | null = null;
    for (let i = 0; i < sliderConfigs.length; i++) {
      let pos = lastSlider?.bottomCenter ?? ex.vec(0, 0);
      let slider = this.addPanel("slider" + i, Slider);
      slider.topCenter = pos.add(ex.vec(0, 30));
      slider.padding = 5;
      slider.size = ex.vec(Math.max(150, containerSize.x / 2), 12);
      slider.min = sliderConfigs[i].min;
      slider.max = sliderConfigs[i].max;
      slider.step = sliderConfigs[i].step;
      slider.value = sliderConfigs[i].value;
      lastSlider = slider;
    }
  }
}
