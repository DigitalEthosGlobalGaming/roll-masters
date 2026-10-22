import test from "node:test";
import assert from "node:assert/strict";
import * as ex from "./ui-runtime.mjs";
import { Panel } from "../src/ui/panel.ts";
import { Button } from "../src/ui/elements/button.ts";
import { Label } from "../src/ui/elements/label.ts";
import { List } from "../src/ui/elements/list.ts";
import { Slider } from "../src/ui/elements/slider.ts";
import { ScrollPanel } from "../src/ui/scroll-panel.ts";
import { ScreenPanel } from "../src/ui/screen-panel.ts";
import { UpgradesModal } from "../src/ui/upgrades-modal.ts";
import { UpgradeUi } from "../src/ui/upgrades.ts";
import { PrestigeUi } from "../src/ui/prestige.ts";
import { InputManager } from "../src/input/input-manager.ts";
import { ExtendedPointerEvent } from "../src/input/extended-pointer-event.ts";
import { ExtendedKeyEvent } from "../src/input/extended-key-event.ts";
import { waitForFontLoad } from "../src/ui/font-loader.ts";
import { PlayerUi } from "../src/ui/scores/player-ui.ts";
import { GameMenu } from "../src/ui/game-menu.ts";
import { NavigationStack } from "../src/ui/navigation-stack.ts";
import { SettingsUi } from "../src/scenes/settings.scene.ts";
import { CreditUi } from "../src/scenes/credits.scene.ts";
import { UpdatesUi } from "../src/scenes/updates.scene.ts";
import { Scenes } from "../src/scenes/welcome.scene.ts";
import { WelcomeUi } from "../src/scenes/welcome.scene.ts";
import { HowToPlayUi } from "../src/scenes/how-to-play.scene.ts";
import { helpTopics, formatGold } from "../src/ui/game-presentation.ts";
import { ScoreComponent } from "../src/components/score-component.ts";
import { prestigeReward } from "../src/ui/game-presentation.ts";

function fixture() {
  const engine = ex.engine(); const scene = new ex.Level(); scene.engine = engine;
  const manager = new InputManager(); manager.scene = scene; scene.inputSystem = manager; manager.onAdd(engine);
  const root = new Panel();
  function attach(panel) { panel.scene = scene; panel.onAdd(engine); for (const child of panel.getChildrenPanels()) attach(child); }
  attach(root);
  const settle = (panel = root) => { for (let i = 0; i < 12; i++) panel.render(); };
  const pointer = (type, x = 0, y = 0, id = 0, pointerType = ex.PointerType.Mouse, button = ex.PointerButton.Left) => new ex.PointerEvent(type, id, button, pointerType, { worldPos: ex.vec(x, y), screenPos: ex.vec(x, y) }, {});
  return { engine, scene, manager, root, attach, settle, pointer, dispose: () => { root.kill(); manager.onRemove(engine); } };
}
const metrics = panel => [panel.metrics, ...panel.getChildrenPanels().flatMap(metrics)];

test("scoring leaves closed modal layout asleep and reopening displays current state", () => {
  const f = fixture();
  const player = { score: 10, prestigePoints: 0, currentPrestigeScore: 0, currentAction: "NONE", upgrades: [], getData: () => true };
  f.scene.player = player;
  const hud = new PlayerUi(); f.attach(hud); f.settle(hud);
  try {
    const toolbarBefore = JSON.stringify(metrics(hud.playerActionsUi));
    player.score = 20; f.scene.emit("ui-score-changed"); f.settle(hud);
    assert.equal(JSON.stringify(metrics(hud.playerActionsUi)), toolbarBefore);
    hud.openUpgrades("upgrade-ui"); f.settle(hud);
    const modal = hud.getPanel("upgrades");
    modal.visible = false; f.settle(hud);
    const closedCounts = JSON.stringify(metrics(modal));
    for (let i = 0; i < 10; i++) { player.score += 10; f.scene.emit("ui-score-changed"); f.settle(hud); }
    assert.equal(JSON.stringify(metrics(modal)), closedCounts);
    assert.equal(modal.graphics.visible, false);
    hud.openUpgrades("upgrade-ui"); f.settle(hud);
    assert.equal(modal.graphics.visible, true);
    assert.equal(modal.getPanel("upgrade-ui").getPanel("wallet").text, "Gold: " + formatGold(player.score));
  } finally { hud.kill(); f.dispose(); }
});

test("menus have final geometry on their first render and after viewport changes", () => {
  const geometry = panel => [
    [panel.name, panel.size.x, panel.size.y, panel.pos.x, panel.pos.y, panel.scale.x, panel.scale.y, panel.rendered],
    ...panel.getChildrenPanels().flatMap(geometry),
  ];
  for (const Menu of [WelcomeUi, SettingsUi, HowToPlayUi, CreditUi, UpdatesUi]) {
    for (const large of [0, 1]) {
      const f = fixture(); const ui = new Menu();
      try {
        ex.Environment.set("large-text", large);
        f.engine.screen.drawWidth = 320; f.engine.screen.drawHeight = 568;
        f.attach(ui);
        for (const [width, height] of [[320, 568], [844, 390], [1280, 720]]) {
          f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
          ui.onViewportChanged();
          ui.render();
          const first = geometry(ui);
          const painted = JSON.stringify(metrics(ui).map(counts => counts.paints));
          f.settle(ui);
          assert.deepEqual(first, geometry(ui), `${Menu.name} ${width}x${height} large=${large}`);
          assert.equal(painted, JSON.stringify(metrics(ui).map(counts => counts.paints)), "no corrective paint on later frames");
        }
      } finally { ex.Environment.set("large-text", 0); ui.kill(); f.dispose(); }
    }
  }
});

test("help cards stay readable and fully reachable in title and in-game views", () => {
  for (const inGame of [false, true]) {
    const f = fixture();
    const ui = inGame ? f.root.addPanel("game-menu", GameMenu) : new HowToPlayUi();
    f.attach(ui);
    try {
      for (const large of [0, 1]) {
        ex.Environment.set("large-text", large);
        for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1280, 720], [2560, 1080]]) {
          f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
          ui.onViewportChanged(); ui.allDirty = true;
          if (inGame) { ui.open("menu"); ui.open("help"); }
          for (let i = 0; i < 40; i++) ui.render();
          const page = ui.getPanel(inGame ? "help" : "scroll"), back = ui.getPanel("back");
          assert.ok(page.top > ui.getPanel("title").bottom);
          assert.ok(page.bottom < back.top);
          if (!inGame && width === 320 && !large) assert.equal(back.focused, true);
          const visited = new Set();
          const forwardPages = [];
          for (let turn = 0; turn < 12; turn++) {
            for (let i = 0; i < 30; i++) ui.render();
            const shown = page.content.getChildrenPanels().filter(card => card.visible);
            forwardPages.push(shown.map(card => card.name));
            assert.ok(shown.length > 0);
            for (const card of shown) {
              visited.add(card.name);
              assert.equal(card.scale.x, 1, `${inGame ? "in-game" : "title"} ${width}x${height} large=${large} ${card.name}`);
              assert.ok(card.top >= -page.halfHeight - 0.01 && card.bottom <= page.halfHeight + 0.01);
              const title = card.getPanel("title"), body = card.getPanel("body");
              assert.ok(body.top > title.bottom);
              for (const label of [title, body]) {
                assert.ok(label.left >= -card.halfWidth && label.right <= card.halfWidth + 0.01);
                assert.ok(label.bottom <= card.halfHeight);
              }
            }
            const next = page.getPanel("next"), previous = page.getPanel("previous");
            for (const button of [next, previous].filter(button => button.visible)) {
              assert.ok(button.width >= 44 && button.height >= 44);
              assert.ok(button.bottom + page.pos.y <= ui.halfHeight);
              assert.ok(button.left + page.pos.x > back.right);
            }
            if (!next.visible) break;
            next.activate();
          }
          assert.equal(visited.size, helpTopics.length);
          const snapshot = (panel, path = "help") => [[path, JSON.stringify(panel.metrics)], ...panel.getChildrenPanels().flatMap(child => snapshot(child, path + "/" + child.name))];
          const before = new Map(snapshot(ui));
          for (let i = 0; i < 50; i++) ui.render();
          assert.deepEqual(snapshot(ui).filter(([path, counts]) => counts !== before.get(path)).map(([path]) => path), [], `${inGame} ${width}x${height} large=${large}`);
          for (const expected of forwardPages.slice(0, -1).reverse()) {
            assert.equal(page.getPanel("previous").visible, true);
            page.getPanel("previous").activate();
            for (let i = 0; i < 30; i++) ui.render();
            assert.deepEqual(page.content.getChildrenPanels().filter(card => card.visible).map(card => card.name), expected);
          }
          assert.equal(page.getPanel("previous").visible, false);
          if (inGame) ui.onClose();
        }
      }
    } finally { ex.Environment.set("large-text", 0); ui.kill(); f.dispose(); }
  }
});

test("a retired welcome menu ignores a final queued render after its children are disposed", () => {
  const f = fixture(); const ui = new WelcomeUi(); f.attach(ui); f.settle(ui);
  try {
    ui.kill();
    const before = { ...ui.metrics };
    assert.doesNotThrow(() => ui.render());
    assert.doesNotThrow(() => ui.onPreUpdate(f.engine, 16));
    assert.deepEqual(ui.metrics, before);
  } finally { f.dispose(); }
});

test("welcome keeps play visible and supporting actions reachable without shrinking touch targets", () => {
  const f = fixture(); const ui = new WelcomeUi(); f.attach(ui);
  try {
    for (const large of [0, 1]) {
      ex.Environment.set("large-text", large);
      for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1280, 720], [2560, 1080]]) {
        f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
        ui.onViewportChanged(); ui.allDirty = true;
        for (let i = 0; i < 50; i++) ui.render();
        const play = ui.getPanel("play"), scroll = ui.getPanel("scroll");
        if (large === 0 && width === 320) assert.equal(play.focused, true);
        assert.ok(play.rendered && play.width >= 44 && play.height >= 44);
        assert.ok(scroll.top > play.bottom);
        assert.ok(scroll.bottom < ui.getPanel("version").top);
        const visited = new Set();
        for (let page = 0; page < 6; page++) {
          for (let i = 0; i < 30; i++) ui.render();
          for (const row of scroll.content.getChildrenPanels().filter(row => row.visible)) {
            assert.equal(row.scale.x, 1, `${width}x${height} large=${large}`);
            assert.ok(row.top >= -scroll.halfHeight - 0.01 && row.bottom <= scroll.halfHeight + 0.01);
            for (const button of row.getChildrenPanels()) {
              visited.add(button.name);
              assert.ok(button.width >= 44 && button.height >= 44);
              assert.ok(button.left >= -row.halfWidth && button.right <= row.halfWidth + 0.01);
            }
          }
          if (!scroll.getPanel("next").visible) break;
          scroll.getPanel("next").activate();
        }
        assert.ok(["Help", "Settings", "Updates", "Credits"].every(name => visited.has(name)));
        const before = JSON.stringify(metrics(ui));
        for (let i = 0; i < 50; i++) ui.render();
        assert.equal(JSON.stringify(metrics(ui)), before);
        while (scroll.getPanel("previous").visible) { scroll.getPanel("previous").activate(); for (let i = 0; i < 30; i++) ui.render(); }
      }
    }
  } finally { ex.Environment.set("large-text", 0); ui.kill(); f.dispose(); }
});

test("settings keep full-size choices and stable paging across devices", () => {
  const f = fixture(); const ui = new SettingsUi(); f.attach(ui);
  try {
    for (const large of [0, 1]) {
      ex.Environment.set("large-text", large);
      for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [1280, 720], [2560, 1080]]) {
        f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
        ui.onViewportChanged(); ui.allDirty = true;
        for (let i = 0; i < 50; i++) ui.render();
        const scroll = ui.getPanel("scroll"); const back = ui.getPanel("back");
        assert.ok(scroll.top > ui.getPanel("note").bottom);
        assert.ok(scroll.bottom < back.top);
        const visited = new Set();
        for (let page = 0; page < 6; page++) {
          for (let i = 0; i < 30; i++) ui.render();
          const shown = scroll.content.getChildrenPanels().filter(row => row.visible);
          assert.ok(shown.length > 0);
          for (const row of shown) {
            visited.add(row.name);
            assert.equal(row.scale.x, 1, `${width}x${height} large=${large} ${row.name} must not shrink`);
            assert.ok(row.top >= -scroll.halfHeight - 0.01 && row.bottom <= scroll.halfHeight + 0.01);
            for (const choice of row.getChildrenPanels().filter(child => child.name.startsWith("choice-"))) {
              assert.ok(choice.height >= 44 && choice.width >= 44);
              assert.ok(choice.left >= -row.halfWidth && choice.right <= row.halfWidth + 0.01);
              assert.ok(choice.bottom <= row.halfHeight + 0.01);
            }
          }
          const next = scroll.getPanel("next");
          if (!next.visible) break;
          assert.ok(scroll.getPanel("previous").left + scroll.pos.x >= back.right + 4);
          next.activate();
        }
        assert.equal(visited.size, 6);
        const before = JSON.stringify(metrics(ui)); for (let i = 0; i < 50; i++) ui.render();
        assert.equal(JSON.stringify(metrics(ui)), before);
        while (scroll.getPanel("previous").visible) { scroll.getPanel("previous").activate(); for (let i = 0; i < 30; i++) ui.render(); }
      }
    }
  } finally { ex.Environment.set("large-text", 0); ui.kill(); f.dispose(); }
});

test("volume sliders accept touch, keyboard and semantic input and reopen with saved levels", () => {
  const previous = { ...ex.Environment.data }; const f = fixture(); let ui = new SettingsUi();
  ex.Environment.set("sound", 0); ex.Environment.set("music-volume", 100); ex.Environment.set("effects-volume", 70);
  f.engine.screen.drawWidth = 390; f.engine.screen.drawHeight = 844;
  const showMusic = () => {
    f.attach(ui); f.settle(ui);
    const scroll = ui.getPanel("scroll"), row = scroll.content.getPanel("music-volume");
    for (let i = 0; !row.rendered && i < 6; i++) { scroll.getPanel("next").activate(); f.settle(ui); }
    assert.ok(row.rendered);
    return row.getPanel("slider");
  };
  try {
    let slider = showMusic();
    const { x, y } = slider.globalPos;
    f.manager.onPointerDown(f.pointer("down", x - slider.width / 4, y, 8, ex.PointerType.Touch));
    f.manager.onPointerMove(f.pointer("move", x + slider.width / 4, y, 8, ex.PointerType.Touch));
    f.manager.onPointerUp(f.pointer("up", x + slider.width / 4, y, 8, ex.PointerType.Touch));
    f.settle(ui); assert.equal(ex.Environment.get("music-volume"), 75);
    assert.equal(slider.getPanel("thumb").text, "75%");
    f.manager.setFocus(slider); f.manager.onKeyDown(new ex.KeyEvent(ex.Keys.Home));
    assert.equal(ex.Environment.get("music-volume"), 0);
    f.manager.onKeyDown(new ex.KeyEvent(ex.Keys.End)); assert.equal(ex.Environment.get("music-volume"), 100);
    const input = f.manager.accessible.get(slider); input.value = "42"; input.oninput();
    f.settle(ui); assert.equal(ex.Environment.get("music-volume"), 42);
    assert.equal(input.attributes["aria-label"], "Music volume");
    assert.equal(ex.Environment.get("effects-volume"), 70);
    ui.kill(); ui = new SettingsUi(); slider = showMusic(); assert.equal(slider.value, 42);
    const before = JSON.stringify(metrics(ui)); f.settle(ui); assert.equal(JSON.stringify(metrics(ui)), before);
  } finally { ui.kill(); ex.Environment.data = previous; f.dispose(); }
});

test("credits and release notes keep every card readable and reachable across screens", () => {
  assert.equal(Object.hasOwn(Scenes, "UI Gallery"), false);
  for (const Menu of [CreditUi, UpdatesUi]) {
    const f = fixture(); const ui = new Menu(); f.attach(ui);
    try {
      for (const large of [0, 1]) {
        ex.Environment.set("large-text", large);
        for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1280, 720]]) {
          f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
          ui.onViewportChanged(); ui.allDirty = true; f.settle(ui);
          const scroll = ui.getPanel("scroll"), back = ui.getPanel("back");
          while (scroll.getPanel("previous").visible) { scroll.getPanel("previous").activate(); f.settle(ui); }
          const visited = new Set(), rows = scroll.content.getChildrenPanels();
          for (let page = 0; page <= rows.length; page++) {
            const shown = rows.filter(row => row.rendered); assert.ok(shown.length);
            for (const row of shown) {
              visited.add(row.name);
              assert.equal(row.scale.x, 1, `${Menu.name} ${width}x${height} large=${large} ${row.name}`);
              assert.ok(row.top >= -scroll.halfHeight - 0.01 && row.bottom <= scroll.halfHeight + 0.01);
              assert.ok(row.getPanel("title").text && row.getPanel("body").text);
            }
            assert.ok(back.height >= 44 && back.rendered);
            if (!scroll.getPanel("next").visible) break;
            scroll.getPanel("next").activate(); f.settle(ui);
          }
          assert.equal(visited.size, rows.length);
          assert.ok(scroll.bottom < back.top);
        }
      }
      let destination; f.engine.goToScene = value => { destination = value; };
      ui.onKeyUp(ExtendedKeyEvent.extend(new ex.KeyEvent(ex.Keys.Esc), f.manager));
      assert.equal(destination, "WelcomeScene");
    } finally { ex.Environment.set("large-text", 0); ui.kill(); f.dispose(); }
  }
});

test("settings persist choices, expose selection and finish subtle feedback", () => {
  const previous = { ...ex.Environment.data }; const f = fixture(); const ui = new SettingsUi(); f.attach(ui);
  try {
    for (let i = 0; i < 40; i++) ui.render();
    const audio = ui.getPanel("scroll").content.getPanel("sound");
    const muted = audio.getPanel("choice-2"); muted.activate();
    for (let i = 0; i < 30; i++) ui.render();
    assert.equal(ex.Environment.get("sound"), 2); assert.equal(muted.selected, true);
    assert.equal(audio.getPanel("choice-0").selected, false);
    assert.ok(muted.label.text.startsWith("\u2713"));
    assert.equal(f.manager.accessible.get(muted).attributes["aria-pressed"], "true");
    muted.onPreUpdate(f.engine, 120); ui.render(); assert.equal(muted.flash.opacity, 0);
    ex.Environment.set("reduced-motion", 1);
    const effects = audio.getPanel("choice-1"); effects.activate(); ui.render();
    assert.equal(effects.remaining, 0);
    assert.equal(ex.Environment.get("sound"), 1);
  } finally { ex.Environment.data = previous; ui.kill(); f.dispose(); }
});

test("in-game settings preserve touch sizes and return focus to the menu", () => {
  const f = fixture(); const menu = f.root.addPanel("game-menu", GameMenu); f.attach(menu);
  try {
    for (const large of [0, 1]) {
      ex.Environment.set("large-text", large);
      for (const [width, height] of [[320, 568], [568, 320], [844, 390], [1280, 720]]) {
        f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
        menu.onViewportChanged(); menu.allDirty = true; menu.open("menu"); f.settle();
        const settings = menu.getPanel("menu").content.getPanel("settings");
        while (!settings.rendered && menu.getPanel("menu").getPanel("next").visible) {
          menu.getPanel("menu").getPanel("next").activate(); f.settle();
        }
        f.manager.setFocus(settings); settings.activate();
        for (let i = 0; i < 40; i++) f.root.render();
        const page = menu.getPanel("settings");
        for (let i = 0; i < 6; i++) {
          const shown = page.content.getChildrenPanels().filter(row => row.visible);
          assert.ok(shown.length > 0);
          for (const row of shown) assert.equal(row.scale.x, 1, `in-game ${width}x${height} large=${large} ${row.name}`);
          if (!page.getPanel("next").visible) break;
          page.getPanel("next").activate(); for (let j = 0; j < 30; j++) f.root.render();
        }
        f.manager.onKeyUp(new ex.KeyEvent(ex.Keys.Esc)); f.settle();
        assert.equal(settings.focused, true);
        menu.onClose();
      }
    }
  } finally { ex.Environment.set("large-text", 0); f.dispose(); }
});

test("procedural buttons follow hover, press and disabled input with foreground labels", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Show completed (2)";
  f.attach(button); f.settle();
  try {
    assert.equal(button.surface.state, "normal");
    button.onPointerEnter(f.pointer("move")); f.settle(); assert.equal(button.surface.state, "hover");
    button.onPointerDown(f.pointer("down")); f.settle(); assert.equal(button.surface.state, "pressed");
    button.disabled = true; f.settle(); assert.equal(button.surface.state, "disabled");
    button.onPointerUp(f.pointer("up")); button.onPointerLeave(f.pointer("move")); button.disabled = false; f.settle();
    assert.equal(button.surface.state, "normal");
    assert.ok(button.getPanel("label").globalZ > button.globalZ);
  } finally { f.dispose(); }
});

test("retired preview settings cannot change the theme or intercept slider arrows", () => {
  const previous = { ...ex.Environment.data };
  ex.Environment.set("button-style", -1); ex.Environment.set("button-style-preview", true);
  const f = fixture();
  try {
    const button = f.root.addPanel("play", Button); button.text = "Continue"; f.attach(button);
    const slider = f.root.addPanel("slider", Slider); f.attach(slider); f.settle();
    f.manager.setFocus(slider); f.manager.onKeyDown(new ex.KeyEvent(ex.Keys.Right)); f.settle();
    assert.equal(slider.value, 1);
    assert.equal(button.surface.state, "normal");
    assert.equal(button.background, null);
    assert.ok(button.label.globalZ > button.globalZ);
    assert.equal(button.label.graphic.text, "Continue");
  } finally { ex.Environment.data = previous; f.dispose(); }
});

test("navigation histories isolate roots and unwind nested pages", () => {
  const history = new NavigationStack(); history.open("menu"); history.push("help"); history.push("help");
  assert.equal(history.back(), "menu"); assert.equal(history.canGoBack, false);
  history.push("settings"); history.open("build"); assert.equal(history.canGoBack, false);
  history.clear(); assert.equal(history.current, undefined);
});

test("gold is committed before feedback and spending does not erase earned prestige", () => {
  const score = new ScoreComponent(); const data = {}; let events = 0;
  score.owner = { scene: { emit() { events++; } } };
  score._player = { getData: key => data[key], setData: (key, value) => { data[key] = value; }, playerUi: { getPanel() { return null; } } };
  score.score = 10;
  score.createScore({}, 1000000);
  assert.equal(score.score, 1000010); assert.equal(prestigeReward(data["current-prestige-score"]), 1);
  score.updateScore(-900000);
  assert.equal(score.score, 100010); assert.equal(data["current-prestige-score"], 1000000);
  assert.equal(data["lifetime-energy"], 1000000); assert.ok(events > 0);
});

test("screen-plane hit tests remain correct when world and screen coordinates differ", () => {
  const f = fixture(); const button = f.root.addPanel("screen", Button); button.text = "HUD";
  f.root.transform.coordPlane = ex.CoordPlane.Screen;
  f.attach(button); f.settle();
  const event = ExtendedPointerEvent.extend(new ex.PointerEvent("move", 0, ex.PointerButton.Left, ex.PointerType.Mouse, { worldPos: ex.vec(9000, 9000), screenPos: ex.vec(0, 0) }, {}), f.manager);
  assert.equal(event.entities[0], button); f.dispose();
});

test("mobile HUD separates tools from menus and restores Roll when menus close", () => {
  const f = fixture(); f.engine.screen.drawWidth = 360; f.engine.screen.drawHeight = 640;
  const data = { "ui.guidance-dismissed": true };
  f.scene.player = { score: 123, prestigePoints: 2, currentPrestigeScore: 1000000, currentAction: "NONE", upgrades: [], getData: key => data[key] };
  const hud = new PlayerUi(); f.attach(hud); hud.onViewportChanged(); f.settle(hud);
  assert.equal(hud.getPanel("menus"), null, "closed menus are not allocated at startup");
  assert.equal(hud.getPanel("upgrades"), null, "closed upgrades are not allocated at startup");
  assert.equal(hud.transform.coordPlane, ex.CoordPlane.Screen);
  assert.equal(hud.playerActionsUi.getPanel("build").collapsed, false);
  assert.equal(hud.playerActionsUi.getPanel("NEWROLLER").collapsed, true);
  assert.equal(hud.getPanel("navigation"), null);
  assert.equal(hud.getPanel("camera-controls"), null);
  assert.equal(hud.playerActionsUi.getPanel("NEWDICE").iconPlacement, "above");
  hud.playerActionsUi.getPanel("build").activate(); f.settle(hud);
  assert.equal(hud.getPanel("menus").visible, true); assert.equal(f.scene.player.currentAction, "NONE");
  hud.getPanel("menus").getPanel("close").activate(); f.settle(hud);
  assert.equal(hud.getPanel("menus").visible, false);
  hud.getPanel("ascend").activate(); f.settle(hud);
  assert.equal(hud.getPanel("menus").visible, false);
  assert.equal(hud.getPanel("upgrades").currentTab, "upgrade-ui");
  assert.equal(hud.getPanel("gold-icon").width, 40);
  const before = JSON.stringify(metrics(hud)); for (let i = 0; i < 1000; i++) hud.render();
  assert.equal(JSON.stringify(metrics(hud)), before);
  hud.kill(); f.dispose();
});

test("in-game Help goes back to its caller and restores the calling control's focus", () => {
  const f = fixture(); const menu = f.root.addPanel("game-menu", GameMenu); f.attach(menu);
  menu.open("menu"); f.settle();
  const help = menu.getPanel("menu").content.getPanel("help"); f.manager.setFocus(help); help.activate(); f.settle();
  assert.equal(menu.getPanel("help").collapsed, false);
  f.manager.onKeyUp(new ex.KeyEvent(ex.Keys.Esc)); f.settle();
  assert.equal(menu.getPanel("menu").collapsed, false); assert.equal(help.focused, true);
  f.manager.onKeyUp(new ex.KeyEvent(ex.Keys.Esc)); assert.equal(menu.visible, false); f.dispose();
});

test("prestige confirmation starts on Keep playing and cannot grant zero-point resets", () => {
  const f = fixture(); let resets = 0;
  f.scene.player = { upgrades: [], currentPrestigeScore: 1000000, prestigePoints: 3, totalPrestiges: 0, getScene: () => ({ prestige() { resets++; } }) };
  const ui = f.root.addPanel("prestige", PrestigeUi); f.attach(ui); f.settle();
  ui.getPanel("perform").activate(); f.settle();
  const dialog = ui.getPanel("confirmation"); assert.equal(dialog.getPanel("close").focused, true);
  f.scene.player.currentPrestigeScore = 0; ui.invalidate(); f.settle();
  dialog.getPanel("confirm").activate(); assert.equal(resets, 0);
  dialog.getPanel("close").activate(); f.settle(); assert.equal(dialog.visible, false); f.dispose();
});

test("HUD layouts settle across portrait, landscape and desktop with larger text", () => {
  const f = fixture();
  f.scene.player = { score: 1234567, prestigePoints: 12, currentPrestigeScore: 2000000, currentAction: "REMOVE", upgrades: [], getData: () => false };
  const hud = new PlayerUi(); f.attach(hud);
  for (const large of [0, 1]) {
    ex.Environment.set("large-text", large);
    for (const [width, height] of [[320, 568], [844, 390], [1280, 720], [2560, 1080]]) {
      f.engine.screen.drawWidth = width; f.engine.screen.drawHeight = height;
      hud.onViewportChanged(); hud.allDirty = true;
      for (let i = 0; i < 30; i++) hud.render();
      const toolbar = hud.playerActionsUi;
      for (const button of toolbar.getChildrenPanels().filter(child => !child.collapsed)) {
        assert.ok(button.left >= -toolbar.halfWidth && button.right <= toolbar.halfWidth);
      }
      assert.ok(hud.getPanel("context").top >= 0);
      assert.equal(toolbar.height, 84);
      const menu = hud.getPanel("menu"), ascend = hud.getPanel("ascend"), score = hud.getPanel("score");
      assert.ok(ascend.right < menu.left);
      assert.ok(ascend.left >= 0);
      assert.ok(ascend.top >= score.bottom || ascend.left > score.right);
      for (const button of toolbar.getChildrenPanels().filter(child => !child.collapsed)) {
        assert.ok(button.width >= 64 && button.height >= 80);
      }
      const counts = (panel, path = "hud") => [[path, JSON.stringify(panel.metrics)], ...panel.getChildrenPanels().flatMap(child => counts(child, path + "/" + child.name))];
      const before = new Map(counts(hud)); for (let i = 0; i < 30; i++) hud.render();
      assert.deepEqual(counts(hud).filter(([path, count]) => before.get(path) !== count).map(([path]) => path), [], width + "x" + height + " large=" + large);
    }
  }
  ex.Environment.set("large-text", 0); hud.kill(); f.dispose();
});

test("short landscape upgrade screens reserve a readable column for cards", () => {
  const f = fixture(); f.scene.player = { upgrades: [], score: 0, currentPrestigeScore: 0, prestigePoints: 0, totalPrestiges: 0 };
  const ui = f.root.addPanel("prestige", PrestigeUi); f.attach(ui); ui.size = ex.vec(680, 280); f.settle();
  const rows = ui.getPanel("rows"); assert.equal(rows.height, 280);
  assert.ok(rows.left > ui.getPanel("wallet").left);
  assert.ok(ui.getPanel("perform").bottom <= ui.getPanel("prestige").top);
  f.dispose();
});

test("desktop prestige shows three compact upgrades without unnecessary paging", () => {
  const f = fixture(); f.engine.screen.drawWidth = 1908; f.engine.screen.drawHeight = 904;
  const player = { score: 100, prestigePoints: 0, currentPrestigeScore: 26461, totalPrestiges: 0 };
  player.upgrades = [
    ["GRID_SIZE", "Grid Size", "Board: 16 Ãƒâ€” 16 Ã¢â€ â€™ 17 Ãƒâ€” 17", 1],
    ["DICE_WEIGHT", "Dice Weight", "Average roll bonus: +0% Ã¢â€ â€™ +10%\nMore rolls land on six.", 2],
    ["PASSIVE_BOOST", "Passive Gold Boost", "Passive gold bonus: 0% Ã¢â€ â€™ 100%", 1],
  ].map(([code, name, description, nextCost]) => ({ code, name, description, nextCost, nextValue: 1, value: 0, cost: 0, level: 0, type: "PRESTIGE", canResearch: true, isMaxLevel: false, player, planPurchase() { return { count: 1, cost: this.nextCost }; } }));
  f.scene.player = player;
  const modal = f.root.addPanel("upgrades", UpgradesModal); f.attach(modal); modal.currentTab = "prestige-ui";
  for (let i = 0; i < 30; i++) f.root.render();
  const scroll = modal.getPanel("prestige-ui").getPanel("rows");
  assert.equal(scroll.getPanel("next").visible, false);
  for (const upgrade of player.upgrades) {
    const card = scroll.content.getPanel(upgrade.code); const buy = card.getPanel("buy");
    assert.equal(card.visible, true); assert.ok(card.height < 110);
    assert.ok(buy.left > card.getPanel("description").right);
    assert.equal(buy.disabled, true); assert.equal(buy.surface.state, "disabled");
    assert.match(buy.text, upgrade.nextCost === 1 ? /1 point$/ : /2 points$/);
  }
  const before = JSON.stringify(metrics(f.root)); for (let i = 0; i < 30; i++) f.root.render();
  assert.equal(JSON.stringify(metrics(f.root)), before); f.dispose();
});

test("an unchanged tree performs no additional setup, refresh, layout, or paint work", () => {
  const f = fixture(); const slider = f.root.addPanel("slider", Slider); const button = f.root.addPanel("button", Button); button.text = "Action";
  f.attach(slider); f.attach(button); f.settle();
  const before = JSON.stringify(metrics(f.root)); const graphics = slider.graphicCount;
  for (let i = 0; i < 1000; i++) f.root.render();
  assert.equal(JSON.stringify(metrics(f.root)), before); assert.equal(slider.graphicCount, graphics); assert.ok(graphics > 0);
  assert.equal(button.metrics.setups, 1); f.dispose();
});
test("a changed leaf wakes only its ancestor path and paint does not remeasure", () => {
  const f = fixture(); const a = f.root.addPanel("a", Panel); const b = f.root.addPanel("b", Label); b.text = "Unchanged"; f.settle();
  const before = { ...b.metrics }; a.color = ex.Color.Brown; f.settle(); assert.deepEqual(b.metrics, before);
  const layouts = a.metrics.layouts; a.backgroundColor = ex.Color.Brown; f.settle(); assert.equal(a.metrics.layouts, layouts); f.dispose();
});
test("measurement unions separated and negative child bounds without recursive resize", () => {
  const f = fixture(); const group = f.root.addPanel("group", Panel);
  const a = group.addPanel("a", Panel); a.size = ex.vec(20, 30); a.pos = ex.vec(-40, -10);
  const b = group.addPanel("b", Panel); b.size = ex.vec(50, 60); b.pos = ex.vec(100, 70);
  assert.deepEqual(group.size, ex.vec(175, 125)); let events = 0; b.on("resize", () => events++);
  b.size = ex.vec(100, 60); assert.equal(group.width, 200); assert.equal(events, 1); assert.equal(b.width, 100); assert.equal(events, 1);
  group.removePanel(b); assert.equal(group.width, 20); assert.ok(b.isKilled()); f.dispose();
});
test("lists use n-1 gaps, border-box padding, and explicit collapsed semantics", () => {
  const f = fixture(); const list = f.root.addPanel("list", List); list.padding = 5; list.spacing = 10;
  const a = list.addPanel("a", Panel); a.size = ex.vec(20, 20); const b = list.addPanel("b", Panel); b.size = ex.vec(20, 30);
  assert.equal(list.height, 70); b.visible = false; assert.equal(list.height, 70); b.collapsed = true; assert.equal(list.height, 30);
  a.padding = 10; assert.equal(a.width, 20); f.dispose();
});
test("empty and long labels recover without changing explicit visibility or hanging font fitting", () => {
  const f = fixture(); const label = f.root.addPanel("label", Label); label.text = "Energy"; label.text = ""; label.adjustFontsizeToWidth(100);
  label.text = "Energy"; assert.ok(label.visible && label.width > 0); label.adjustFontsizeToWidth(80); assert.ok(label.width <= 80);
  label.visible = false; label.text = "Restored"; assert.equal(label.visible, false); label.maxWidth = 40; assert.ok(label.height > label.fontSize); f.dispose();
});
test("named children are reused safely and reject a conflicting widget class", () => {
  const f = fixture(); const label = f.root.addPanel("same", Label); assert.equal(f.root.addPanel("same", Label), label);
  assert.throws(() => f.root.addPanel("same", Button), /different widget type/); f.root.removePanel(label); assert.equal(f.root.hasPanel("same"), false); f.dispose();
});

test("currency icons follow wrapped text, resize, and release unused graphics", () => {
  const f = fixture(); const label = f.root.addPanel("money", Label);
  label.text = "10\u23e2\n20\u23e2"; label.align = "left"; f.settle();
  assert.equal(label.graphic.text.includes("\u23e2"), false);
  assert.equal(label.moneyIcons.length, 2);
  assert.equal(label.moneyIcons[1].offset.y - label.moneyIcons[0].offset.y, label.fontSize * 1.2);
  const first = label.moneyIcons[0].graphic;
  label.fontSize = 30; label.maxWidth = 30; f.settle();
  assert.equal(label.moneyIcons[0].graphic, first);
  assert.ok(label.moneyIcons[1].offset.y > label.moneyIcons[0].offset.y);
  for (const member of label.moneyIcons) {
    assert.ok(member.offset.x >= -label.width / 2);
    assert.ok(member.offset.x + member.graphic.destSize.width <= label.width / 2);
  }
  label.text = "No cost"; f.settle();
  assert.equal(label.moneyIcons.length, 0); assert.equal(label.graphicCount, 1);
  f.dispose();
});

test("currency reserves space even when font ink bounds omit trailing whitespace", () => {
  const f = fixture(); const label = f.root.addPanel("money", Label);
  label.font.measureText = text => ({ width: text.trimEnd().length * label.font.size / 2 });
  label.text = "10\u23e2"; f.settle();
  assert.ok(label.moneyIcons[0].graphic.destSize.width > 0);
  assert.equal(label.width, label.fontSize * 1.5);
  f.dispose();
});
test("button content sizing uses horizontal composition and retained icons", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Test"; button.icon = { imageSource: {}, width: 32, height: 64 }; f.settle();
  assert.equal(button.height, 84); const count = button.iconPanel.graphicCount; button.text = "Longer label"; f.settle(); assert.equal(button.iconPanel.graphicCount, count);
  assert.ok(button.iconPanel.globalZ > button.globalZ, "image batches sort above the button face");
  button.icon = undefined; f.settle(); assert.equal(button.iconPanel.graphicCount, count - 1); f.dispose();
});

test("button state changes preserve hit bounds, layout and retained graphics count", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Buy"; f.settle();
  const size = button.size; const layouts = button.metrics.layouts; const count = button.graphicCount;
  const tick = () => { button.onPreUpdate(f.engine, 16); f.settle(); };
  button.isHovered = true; button.onHoverChanged(f.pointer("move")); tick();
  assert.equal(button.surface.state, "hover");
  button.onPointerDown(f.pointer("down"));
  for (let i = 0; i < 24; i++) tick();
  assert.equal(button.surface.state, "pressed");
  assert.equal(button.label.drawOffset.y, 3);
  button.onPointerCancel(f.pointer("cancel")); button.isHovered = false;
  button.onHoverChanged(f.pointer("move"));
  for (let i = 0; i < 24; i++) tick();
  assert.equal(button.label.drawOffset.y, 0);
  assert.deepEqual(button.size, size); assert.equal(button.metrics.layouts, layouts);
  assert.equal(button.graphicCount, count);
  const paints = button.metrics.paints;
  for (let i = 0; i < 100; i++) tick();
  assert.equal(button.metrics.paints, paints);
  button.selected = true; button.onFocusChanged(true); f.settle();
  assert.ok(button.surface.selected && button.surface.focused);
  button.disabled = true; tick(); assert.equal(button.surface.state, "disabled");
  f.dispose();
});

test("reduced-motion buttons change state without shifting their content or face", () => {
  ex.setReducedMotion(true);
  const f = fixture();
  try {
    const button = f.root.addPanel("button", Button); button.text = "Buy"; f.settle();
    button.isHovered = true; button.onPointerDown(f.pointer("down"));
    button.onPreUpdate(f.engine, 16); f.settle();
    assert.equal(button.surface.state, "pressed"); assert.equal(button.label.drawOffset.y, 0);
  } finally { f.dispose(); ex.setReducedMotion(false); }
});
test("pressed button text, inline gold and icons move with the face without changing layout", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button);
  button.text = "Buy 10\u23e2"; button.icon = { imageSource: {}, width: 20, height: 20 }; f.attach(button); f.settle();
  const label = button.label;
  const restingText = label.textMember.offset.clone();
  const restingGold = label.moneyIcons[0].offset.clone();
  const restingIcon = button.iconMember.offset.clone();
  const bounds = button.size; const layouts = button.metrics.layouts; const labelLayouts = label.metrics.layouts;
  try {
    button.onPointerDown(f.pointer("down"));
    for (const elapsed of [16, 16, 68]) {
      button.onPreUpdate(f.engine, elapsed); f.settle();
      const offset = button.surface.contentOffset;
      assert.equal(label.textMember.offset.y - restingText.y, offset);
      assert.equal(label.moneyIcons[0].offset.y - restingGold.y, offset);
      assert.equal(button.iconMember.offset.y - restingIcon.y, offset);
      assert.equal(label.textMember.offset.x, restingText.x);
    }
    assert.equal(button.surface.contentOffset, 3);
    button.onPointerUp(f.pointer("up")); button.onPreUpdate(f.engine, 100); f.settle();
    assert.deepEqual(label.textMember.offset, restingText);
    assert.deepEqual(label.moneyIcons[0].offset, restingGold);
    assert.deepEqual(button.iconMember.offset, restingIcon);
    assert.deepEqual(button.size, bounds);
    assert.equal(button.metrics.layouts, layouts); assert.equal(label.metrics.layouts, labelLayouts);
  } finally { f.dispose(); }
});

test("keyboard and semantic button presses show feedback without delaying activation", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Continue";
  f.attach(button); f.settle(); let clicks = 0; button.onClick = () => clicks++;
  try {
    f.manager.setFocus(button); f.manager.onKeyDown(new ex.KeyEvent(ex.Keys.Enter)); f.settle();
    assert.equal(button.surface.state, "pressed"); assert.equal(clicks, 0);
    button.onPreUpdate(f.engine, 50); f.settle(); assert.ok(button.surface.pressOffset > 0);
    f.manager.onKeyUp(new ex.KeyEvent(ex.Keys.Enter)); f.settle(); assert.equal(clicks, 1);
    button.onPreUpdate(f.engine, 100); f.settle(); assert.equal(button.surface.contentOffset, 0);
    const semantic = f.manager.accessible.get(button);
    semantic.onkeydown({ key: " " }); f.settle(); assert.equal(button.surface.state, "pressed");
    semantic.onkeyup({ key: " " }); semantic.onclick(); assert.equal(clicks, 2);
    semantic.onkeydown({ key: " " }); semantic.onblur(); f.settle();
    assert.notEqual(button.surface.state, "pressed");
  } finally { f.dispose(); }
});

test("press/release ownership tolerates jitter and rejects release-only and outside activation", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Action"; f.attach(button); f.settle(); let clicks = 0; button.onClick = () => clicks++;
  f.manager.onPointerDown(f.pointer("down")); f.manager.onPointerMove(f.pointer("move", 2, 1)); f.manager.onPointerUp(f.pointer("up", 2, 1)); assert.equal(clicks, 1);
  f.manager.onPointerDown(f.pointer("down", 300)); f.manager.onPointerUp(f.pointer("up")); assert.equal(clicks, 1);
  f.manager.onPointerDown(f.pointer("down")); f.manager.onPointerUp(f.pointer("up", 300)); assert.equal(clicks, 1); assert.equal(button.isMouseDown, false); f.dispose();
});
test("drag move is delivered once and release/cancellation end capture immediately", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Action"; f.attach(button); f.settle(); let moves = 0, ends = 0;
  button.onPointerMove = () => moves++; button.onDragEnd = () => ends++;
  f.manager.onPointerDown(f.pointer("down")); f.manager.onPointerMove(f.pointer("move", 10)); f.manager.onPointerUp(f.pointer("up", 200));
  assert.equal(moves, 1); assert.equal(ends, 1); assert.equal(f.manager.isDragging, false);
  f.manager.onPointerDown(f.pointer("down", 0, 0, 1, ex.PointerType.Touch)); f.manager.onPointerMove(f.pointer("move", 10, 0, 1, ex.PointerType.Touch)); f.manager.cancelAll();
  assert.equal(ends, 2); assert.equal(button.isMouseDown, false); assert.equal(f.manager.isDown("MouseLeft"), false); f.dispose();
});
test("disabled, hidden, and right-button inputs cannot activate buttons", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Action"; f.attach(button); f.settle(); let clicks = 0; button.onClick = () => clicks++;
  for (const state of ["disabled", "hidden", "right"]) {
    button.disabled = state === "disabled"; button.visible = state !== "hidden"; const which = state === "right" ? ex.PointerButton.Right : ex.PointerButton.Left;
    f.manager.onPointerDown(f.pointer("down", 0, 0, 0, ex.PointerType.Mouse, which)); f.manager.onPointerUp(f.pointer("up", 0, 0, 0, ex.PointerType.Mouse, which));
  }
  assert.equal(clicks, 0); f.dispose();
});
test("slider setters validate ranges, steps, clamping, and keyboard changes", () => {
  const f = fixture(); const slider = f.root.addPanel("slider", Slider); slider.min = 10; slider.max = 10; slider.step = 0; slider.value = NaN;
  assert.equal(slider.percentage, 0); assert.ok(slider.step > 0 && Number.isFinite(slider.value)); slider.max = 20; slider.step = 0.5; slider.value = 11.2; assert.equal(slider.value, 11);
  slider.onKeyDown(ExtendedKeyEvent.extend(new ex.KeyEvent(ex.Keys.Right), f.manager)); assert.equal(slider.value, 11.5);
  slider.size = ex.vec(0, 12); slider.setValueFromPointerEvent(ExtendedPointerEvent.extend(f.pointer("move"), f.manager)); assert.ok(Number.isFinite(slider.value)); f.dispose();
});
test("pointer and keyboard wrappers do not mutate shared events or cache across managers", () => {
  const f = fixture(); const original = f.pointer("move"); const prototype = Object.getPrototypeOf(original);
  const a = ExtendedPointerEvent.extend(original, f.manager); const b = ExtendedPointerEvent.extend(original, f.manager); a.entities = [f.root];
  assert.notEqual(a, b); assert.equal(Object.getPrototypeOf(original), prototype); assert.deepEqual(b.entities, []);
  const key = new ex.KeyEvent(ex.Keys.Enter); assert.notEqual(ExtendedKeyEvent.extend(key, f.manager), key); f.dispose();
});
test("modal scope blocks background pointer/semantics and Escape restores focus", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Background"; f.attach(button); f.settle(); f.manager.setFocus(button);
  const modal = f.root.addPanel("modal", UpgradesModal); f.attach(modal); f.settle(); let clicks = 0; button.onClick = () => clicks++;
  f.manager.onPointerDown(f.pointer("down")); f.manager.onPointerUp(f.pointer("up")); assert.equal(clicks, 0);
  f.manager.onKeyUp(new ex.KeyEvent(ex.Keys.Esc)); assert.equal(modal.visible, false); assert.equal(button.focused, true); f.dispose();
});
test("upgrade rows reconcile removals including transition to the empty state", () => {
  const f = fixture(); const upgrade = { code: "A", name: "Test", type: "RESEARCH", canResearch: true, level: 0, isMaxLevel: false, nextCost: 10, nextValue: 1, cost: 0, value: 0, description: "Cost {nextCost}", buy() {}, planPurchase() { return { count: 1, cost: this.nextCost }; } };
  f.scene.player = { upgrades: [upgrade], currentPrestigeScore: 0, prestigePoints: 0 };
  const ui = f.root.addPanel("upgrade", UpgradeUi); f.attach(ui); f.settle(); const content = ui.getPanel("rows").content;
  assert.equal(content.hasPanel("A"), true); upgrade.canResearch = false; ui.invalidate(); f.settle(); assert.equal(content.hasPanel("A"), false); assert.equal(content.getPanel("info").collapsed, false); f.dispose();
});
test("prestige disabled state resets in both directions and confirmation survives refresh", () => {
  const f = fixture(); f.scene.player = { upgrades: [], currentPrestigeScore: 0, prestigePoints: 0, totalPrestiges: 0 };
  const ui = f.root.addPanel("prestige", PrestigeUi); f.attach(ui); f.settle(); const perform = ui.getPanel("perform"); assert.equal(perform.disabled, true);
  f.scene.player.currentPrestigeScore = 1000000; ui.invalidate(); f.settle(); assert.equal(perform.disabled, false);
  perform.activate(); f.settle(); ui.invalidate(); f.settle(); assert.equal(perform.text, "Confirm prestige");
  const before = JSON.stringify(metrics(ui)); for (let i = 0; i < 1000; i++) ui.render(); assert.equal(JSON.stringify(metrics(ui)), before); f.dispose();
});
test("paging returns from a short final page to the same preceding page", () => {
  const f = fixture(); const scroll = f.root.addPanel("pages", ScrollPanel);
  scroll.useFooterNavigation(); scroll.size = ex.vec(400, 300);
  for (let i = 1; i <= 8; i++) scroll.content.addPanel(String(i), Panel).size = ex.vec(200, 40);
  f.attach(scroll); f.settle();
  const shown = () => scroll.content.getChildrenPanels().filter(row => row.rendered).map(row => row.name);
  try {
    for (let repeat = 0; repeat < 3; repeat++) {
      assert.deepEqual(shown(), ["1", "2", "3", "4", "5", "6"]);
      scroll.getPanel("next").activate(); f.settle();
      assert.deepEqual(shown(), ["7", "8"]);
      assert.equal(scroll.getPanel("next").visible, false);
      scroll.getPanel("previous").activate(); f.settle();
      assert.deepEqual(shown(), ["1", "2", "3", "4", "5", "6"]);
      assert.equal(scroll.getPanel("previous").visible, false);
    }
    scroll.getPanel("next").activate(); f.settle();
    scroll.size = ex.vec(400, 150); f.settle();
    assert.deepEqual(shown(), ["7", "8"]);
    scroll.getPanel("previous").activate(); f.settle();
    assert.deepEqual(shown(), ["4", "5", "6"]);
    scroll.getPanel("previous").activate(); f.settle();
    assert.deepEqual(shown(), ["1", "2", "3"]);
    scroll.content.getPanel("2").collapsed = true; f.settle();
    assert.deepEqual(shown(), ["1", "3", "4"]);
    scroll.getPanel("next").activate(); f.settle();
    assert.deepEqual(shown(), ["5", "6", "7"]);
    scroll.getPanel("previous").activate(); f.settle();
    assert.deepEqual(shown(), ["1", "3", "4"]);
  } finally { f.dispose(); }
});

test("viewport roots and paged content settle after resize, including oversized rows", () => {
  const f = fixture(); const screen = new ScreenPanel(); f.attach(screen); const scroll = screen.getPanel("scroll");
  for (let i = 0; i < 20; i++) { const label = scroll.content.addPanel(String(i), Label); label.text = "Long menu content ".repeat(i + 1); }
  screen.onViewportChanged(); f.settle(screen); const before = JSON.stringify(metrics(screen)); for (let i = 0; i < 1000; i++) screen.render(); assert.equal(JSON.stringify(metrics(screen)), before);
  f.engine.screen.drawWidth = 360; f.engine.screen.drawHeight = 640; screen.onViewportChanged(); f.settle(screen); assert.equal(screen.width, 324);
  let pages = 0; while (scroll.getPanel("next").visible && pages++ < 30) { scroll.getPanel("next").activate(); f.settle(screen); }
  assert.ok(pages < 30); assert.ok(scroll.content.getChildrenPanels().at(-1).visible); screen.kill(); f.dispose();
});
test("repeated panel removal disposes handlers and semantic controls", () => {
  const f = fixture(); const baseline = Object.keys(f.manager.entities).length;
  for (let i = 0; i < 20; i++) { const panel = f.root.addPanel("scope", Panel); const button = panel.addPanel("button", Button); f.attach(panel); f.settle(); assert.ok(f.manager.entities[button.id]); f.root.removePanel(panel); }
  assert.equal(Object.keys(f.manager.entities).length, baseline); f.dispose(); assert.ok(!InputManager.InputManagers.includes(f.manager));
});
test("font loading settles on success, rejection, and timeout", async () => {
  assert.equal(await waitForFontLoad("font", 10, { load: async () => [] }), true);
  assert.equal(await waitForFontLoad("font", 10, { load: async () => { throw new Error("failed"); } }), false);
  assert.equal(await waitForFontLoad("font", 5, { load: () => new Promise(() => {}) }), false);
});

test("resize callbacks can schedule one further layout without recursion or lost work", () => {
  const f = fixture(); const panel = f.root.addPanel("resize", Panel); let events = 0;
  panel.onResize = (_old, next) => { events++; if (next.x === 100) panel.size = ex.vec(120, 30); };
  panel.size = ex.vec(100, 30); f.settle(); assert.equal(panel.width, 120); assert.equal(events, 2);
  const before = JSON.stringify(metrics(f.root)); f.settle(); assert.equal(JSON.stringify(metrics(f.root)), before); f.dispose();
});
test("independent touch pointers retain ownership and cancellation clears button state", () => {
  const f = fixture(); const a = f.root.addPanel("a", Button); const b = f.root.addPanel("b", Button); b.pos = ex.vec(200, 0);
  f.attach(a); f.attach(b); f.settle(); let clicks = 0; a.onClick = b.onClick = () => clicks++;
  f.manager.onPointerDown(f.pointer("down", 0, 0, 1, ex.PointerType.Touch)); f.manager.onPointerDown(f.pointer("down", 200, 0, 2, ex.PointerType.Touch));
  f.manager.onPointerUp(f.pointer("up", 0, 0, 1, ex.PointerType.Touch)); assert.equal(clicks, 1); assert.equal(f.manager.isDown("MouseLeft"), true);
  f.engine.input.pointers.emit("cancel", f.pointer("cancel", 200, 0, 2, ex.PointerType.Touch)); assert.equal(f.manager.isDown("MouseLeft"), false); assert.equal(b.isMouseDown, false); f.dispose();
});

test("unstable layouts have bounded work and paint only once per render", () => {
  const f = fixture(); const panel = f.root.addPanel("unstable", Panel);
  panel.onLayout = () => panel.invalidateLayout();
  try {
    f.root.render();
    assert.equal(panel.metrics.layouts, 12);
    assert.equal(panel.metrics.paints, 1);
    f.root.render();
    assert.equal(panel.metrics.layouts, 24);
    assert.equal(panel.metrics.paints, 2);
  } finally { f.dispose(); }
});

test("two board touches track pinch positions and suppress cell activation on both releases", () => {
  const f = fixture(); const board = f.root.addPanel("board", Panel);
  board.size = ex.vec(500, 500); board.acceptingInputs = ["MouseLeft"];
  f.attach(board); f.settle(); let clicks = 0;
  board.onPointerPressed = () => clicks++;
  f.manager.onPointerDown(f.pointer("down", -40, 0, 1, ex.PointerType.Touch));
  f.manager.onPointerDown(f.pointer("down", 40, 0, 2, ex.PointerType.Touch));
  assert.equal(f.manager.isDragging, true);
  f.manager.onPointerMove(f.pointer("move", 80, 0, 2, ex.PointerType.Touch));
  assert.deepEqual(f.manager.boardPointers, [ex.vec(-40, 0), ex.vec(80, 0)]);
  f.manager.onPointerUp(f.pointer("up", -40, 0, 1, ex.PointerType.Touch));
  f.manager.onPointerUp(f.pointer("up", 80, 0, 2, ex.PointerType.Touch));
  assert.equal(clicks, 0); assert.equal(f.manager.boardPointers.length, 0);
  f.manager.onPointerDown(f.pointer("down", 0, 0, 1, ex.PointerType.Touch));
  f.manager.onPointerUp(f.pointer("up", 0, 0, 1, ex.PointerType.Touch));
  assert.equal(clicks, 1); f.dispose();
});
test("semantic controls are created after construction and guarded by modal scope", () => {
  const f = fixture(); const button = f.root.addPanel("button", Button); button.text = "Action"; f.attach(button); f.settle();
  const container = ex.document.body.children.at(-1); const semantic = container.children.find(element => element.attributes["aria-label"] === "Action");
  assert.ok(semantic); let clicks = 0; button.onClick = () => clicks++;
  const modal = f.root.addPanel("modal", UpgradesModal); f.attach(modal); f.settle(); semantic.onclick(); assert.equal(clicks, 0); assert.equal(semantic.hidden, true);
  modal.visible = false; f.settle(); semantic.onclick(); assert.equal(clicks, 1); f.dispose();
});
test("reattachment preserves setup listeners and rebinds only attachment subscriptions", () => {
  const f = fixture(); let calls = 0;
  class Reusable extends Panel {
    onSetup() { this.subscriptions.push(this.on("custom", () => calls++)); }
  }
  const panel = new Reusable(); f.attach(panel); panel.emit("custom"); panel.onRemove(f.engine); panel.scene = null;
  f.attach(panel); panel.emit("custom"); assert.equal(calls, 2); assert.equal(panel.metrics.setups, 1);
  const listeners = f.engine.screen.events.listeners.get("resize").size; panel.onRemove(f.engine);
  assert.equal(f.engine.screen.events.listeners.get("resize").size, listeners - 1);
  panel.kill(); panel.emit("custom"); assert.equal(calls, 2); f.dispose();
});
