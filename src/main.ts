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

import { waitForFontLoad } from "./ui/font-loader";

let soundsLoaded = false;
// Load font before game start
waitForFontLoad("24px sans-serif").then(() => {
  const game = new ex.Engine({
    backgroundColor: ex.Color.fromHex("#141719"),
    // Excalibur's blended pixel-art sampler smooths edges at fractional zooms.
    pixelArt: true,
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
    game.goToScene(import.meta.env.DEV && new URLSearchParams(location.search).has("ui-gallery") ? "TestUserInterfaceScene" : "WelcomeScene");
  });

  document.addEventListener("click", () => {
    if (!soundsLoaded) {
      soundsLoaded = true;
      SoundManager.initialise(game);
      SoundManager.instance?.playBackgroundMusic();
    }
  });
});
