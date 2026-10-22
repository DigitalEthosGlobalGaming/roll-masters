import * as ex from "excalibur";
import { Level } from "@src/level";
import { InformationScreen } from "@src/ui/information-screen";

export class CreditUi extends InformationScreen {
  constructor() {
    super("Credits", "The people and tools behind Roll Masters.", [
      { title: "Development", body: "Trent Jones" },
      { title: "Game engine", body: "Excalibur\nhttps://excaliburjs.com/" },
      { title: "Game assets", body: "Kenney\nhttps://kenney.nl/" },
    ]);
  }
}

export class CreditScene extends Level {
  mainPanel?: CreditUi;
  onActivate(context: ex.SceneActivationContext): void {
    super.onActivate(context);
    if (this.mainPanel == null) {
      this.mainPanel = new CreditUi();
      this.add(this.mainPanel);
    }
  }

  onDeactivate(context: ex.SceneActivationContext): void {
    super.onDeactivate(context);
    this.mainPanel?.kill();
    this.mainPanel = undefined;
  }
}
