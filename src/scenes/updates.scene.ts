import { gameUpdates } from "@src/game-updates";
import { Level } from "@src/level";
import { Button } from "@src/ui/elements/button";
import { Label } from "@src/ui/elements/label";
import { ScreenPanel } from "@src/ui/screen-panel";
import * as ex from "excalibur";
class UpdatesUi extends ScreenPanel {
  override onSetup(): void {
    let index = 0;
    for (const update of gameUpdates) {
      const date = this.content.addPanel(`date-${index++}`, Label); date.fontSize = 28; date.text = update.date;
      for (const [category, lines] of Object.entries(update.updates)) {
        const heading = this.content.addPanel(`heading-${index++}`, Label); heading.text = category;
        for (const line of lines) { const label = this.content.addPanel(`line-${index++}`, Label); label.text = line; }
      }
    }
    const back = this.addPanel("back", Button); back.text = "Back";
    back.onClick = () => { this.scene?.engine.goToScene("WelcomeScene"); };
  }
}
export class UpdatesScene extends Level {
  private mainPanel?: UpdatesUi;
  override onActivate(context: ex.SceneActivationContext): void { super.onActivate(context); this.mainPanel = new UpdatesUi(); this.add(this.mainPanel); }
  override onDeactivate(context: ex.SceneActivationContext): void { super.onDeactivate(context); this.mainPanel?.kill(); this.mainPanel = undefined; }
}
