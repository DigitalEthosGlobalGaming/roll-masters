import * as ex from "excalibur";
import { GameLoader } from "./game-loader";
import { WelcomeScene } from "@src/scenes/welcome.scene";
import { CreditScene } from "@src/scenes/credits.scene";
import { HowToPlayScene } from "@src/scenes/how-to-play.scene";
import { UpdatesScene } from "@src/scenes/updates.scene";
import { TestUserInterfaceScene } from "@src/scenes/test/user-interface/user-interface.scene";
import { SoundManager } from "@src/sound-manager";
import { PrestigeScene } from "./scenes/prestige.scene";
import { SettingsScene } from "./scenes/settings.scene";
import { GameScene } from "./scenes/game.scene";

async function waitForFontLoad(font: string, timeout = 2000, interval = 100) {
  return new Promise((resolve, reject) => {
    // repeatedly poll check
    const poller = setInterval(async () => {
      try {
        await document.fonts.load(font);
      } catch (err) {
        reject(err);
      }
      if (document.fonts.check(font)) {
        clearInterval(poller);
        resolve(true);
      }
    }, interval);
    setTimeout(() => clearInterval(poller), timeout);
  });
}

let soundsLoaded = false;
// Load font before game start
waitForFontLoad("24px DS-DIGI").then(() => {
  const game = new ex.Engine({
    backgroundColor: ex.Color.fromHex("#000000"),
    pixelArt: false,
    displayMode: ex.DisplayMode.FillScreen,
    scenes: {
      WelcomeScene,
      GameScene,
      CreditScene,
      HowToPlayScene,
      UpdatesScene,
      TestUserInterfaceScene,
      PrestigeScene,
      SettingsScene
    },
  });

  const loader = new GameLoader();
  game.start(loader).then(() => {
    game.goToScene("GameScene");
  });

  document.addEventListener("click", () => {
    if (!soundsLoaded) {
      soundsLoaded = true;
      SoundManager.initialise(game);
      SoundManager.instance?.playBackgroundMusic();
    }
  });
});
