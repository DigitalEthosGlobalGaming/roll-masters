import { gameUpdates } from "@src/game-updates";
import { Level } from "@src/level";
import { InformationScreen } from "@src/ui/information-screen";
import * as ex from "excalibur";

export class UpdatesUi extends InformationScreen {
  constructor() {
    super("Release notes", "What is new in Roll Masters, newest first.", gameUpdates.flatMap(update =>
      Object.entries(update.updates).flatMap(([category, lines]) => lines.map(body => ({ title: `${update.date} · ${category}`, body })))));
  }
}
export class UpdatesScene extends Level {
  private mainPanel?: UpdatesUi;
  override onActivate(context: ex.SceneActivationContext): void { super.onActivate(context); this.mainPanel = new UpdatesUi(); this.add(this.mainPanel); }
  override onDeactivate(context: ex.SceneActivationContext): void { super.onDeactivate(context); this.mainPanel?.kill(); this.mainPanel = undefined; }
}
