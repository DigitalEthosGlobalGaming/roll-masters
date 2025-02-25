import { InputManager } from "@src/input/input-manager";
import { Level } from "@src/level";
import { Button } from "@src/ui/elements/button";
import { Label } from "@src/ui/elements/label";
import { List } from "@src/ui/elements/list";
import { Panel } from "@src/ui/panel";
import * as ex from "excalibur";

export const Scenes: Record<string, string> = {
  Play: "GameScene",
  Updates: "UpdatesScene",
  Help: "HowToPlayScene",
  Credits: "CreditScene",
  Settings: "SettingsScene",
};
class WelcomeUi extends Panel {
  onRender(): void {
    super.onRender();
    const screenSize = this.screenSize;
    this.size = screenSize.scale(0.9);
    this.pos = screenSize.scale(0.5);

    const list = this.addPanel("list", List);
    list.spacing = 30;

    const label = list.addPanel("game-title", Label);
    label.fontSize = 60;
    label.text = "Roll Masters";

    for (const title in Scenes) {
      const sceneButton = list.addPanel(title, Button);
      sceneButton.text = title;
      sceneButton.fontSize = 30;
      sceneButton.on(InputManager.Events.pointerEnter, () => {
        sceneButton.backgroundColor = ex.Color.ExcaliburBlue;
      });
      sceneButton.on(InputManager.Events.pointerLeave, () => {
        sceneButton.backgroundColor = ex.Color.White;
      });
      sceneButton.onClick = () => {
        this.scene?.engine.goToScene(Scenes[title]);
      };
    }

    let versionLabel1 = this.addPanel("version-label-2", Label);
    versionLabel1.fontSize = 30;
    versionLabel1.text = `Version ${import.meta.env.VITE_BUILD_VERSION || "dev"
      }`;
    versionLabel1.bottomRight = ex.vec(
      screenSize.x / 2 - 10,
      screenSize.y / 2 - 10
    );
  }
}

export class WelcomeScene extends Level {
  mainPanel!: WelcomeUi;
  onActivate(context: ex.SceneActivationContext): void {
    super.onActivate(context);
    this.mainPanel = new WelcomeUi();
    this.add(this.mainPanel);
  }

  onDeactivate(context: ex.SceneActivationContext): void {
    super.onDeactivate(context);
    this.mainPanel?.kill();
    this.remove(this.mainPanel);
  }
}
