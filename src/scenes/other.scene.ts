import { ExtendedKeyEvent } from "@src/input/extended-key-event";
import { Serializable } from "@src/systems/save-system";
import * as ex from "excalibur";
import { GameScene } from "./game.scene";

export class OtherScene extends GameScene implements Serializable {
  static serializeName = "OtherScene";
  serialize() {
    return null;
    // throw new Error("Method not implemented.");
  }

  onKeyUp(evt: ExtendedKeyEvent) {
    if (evt.key == ex.Keys.Escape) {
      this.save();
      this.engine.goToScene("WelcomeScene");
    }
  }

}
