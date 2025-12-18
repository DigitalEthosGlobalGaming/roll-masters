import * as ex from "excalibur";
import { Level } from "@src/level";
import { Panel } from "@src/ui/panel";
import { Label } from "@src/ui/elements/label";
import { List } from "@src/ui/elements/list";
import { Button } from "@src/ui/elements/button";

const elements: any[] = [
  "HELP",
  " ",
  "-----Objective-----",
  "Roll dice and try to get as much gold as possible",
  "",
  "-----How to play-----",
  "Click and drag your mouse to move the camera",
  "Choose what to place using the buttons on the bottom of the screen",
  "Place a dice, then click on it to roll it, this generates gold",
];

class HowToPlayUi extends Panel {
  onRender(): void {
    super.onRender();
    this.size = this.screenSize.scale(0.9);
    this.pos = this.screenSize.scale(0.5);

    const list = this.addPanel("list", List);
    list.padding = 15;

    for (const elementIndex in elements) {
      const label = list.addPanel(elementIndex, Label);
      label.fontSize = 20;
      label.text = elements[elementIndex];
    }

    const button = list.addPanel("back-button", Button);
    button.text = "Back";
    button.fontSize = 16;
    button.onClick = () => {
      this.scene?.engine.goToScene("WelcomeScene");
    };
  }
}

export class HowToPlayScene extends Level {
  mainPanel!: HowToPlayUi;
  onActivate(context: ex.SceneActivationContext): void {
    super.onActivate(context);
    this.mainPanel = new HowToPlayUi();
    this.add(this.mainPanel);
  }

  onDeactivate(context: ex.SceneActivationContext): void {
    super.onDeactivate(context);
    this.mainPanel?.kill();
    this.remove(this.mainPanel);
  }
}
