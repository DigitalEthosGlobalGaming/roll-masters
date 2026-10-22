import * as ex from "excalibur";
import { Modal } from "./modal";
import { Panel } from "./panel";
import { Label } from "./elements/label";
import { Button } from "./elements/button";
import { List } from "./elements/list";
import { ScrollPanel } from "./scroll-panel";
import { NavigationStack } from "./navigation-stack";
import { addHelpContent, configureHelpNavigation, wrapContent } from "./help-content";
import { addSettingsContent } from "./settings-content";
import { buildRequirements, formatGold } from "./game-presentation";
import { getPlayerActions, PlayerActionTypes } from "@src/player-systems/player-actions";
import { Level } from "@src/level";

export type GameMenuPage = "menu" | "help" | "settings" | "build" | "view";

export class GameMenu extends Modal {
  private history = new NavigationStack<GameMenuPage>();
  private title!: Label;
  private backButton!: Button;
  private settingsNote!: Label;
  private pages = new Map<GameMenuPage, ScrollPanel>();
  private lastPage?: GameMenuPage;
  private rememberedFocus = new Map<GameMenuPage, Panel>();
  private rememberFocus(): void {
    const page = this.history.current;
    const find = (panel: Panel): Panel | undefined => panel.focused ? panel : panel.getChildrenPanels().map(find).find(Boolean);
    const focused = page ? find(this.pages.get(page)!) : undefined;
    if (page && focused) this.rememberedFocus.set(page, focused);
  }
  private get player() { return this.scene instanceof Level ? this.scene.player : undefined; }
  open(page: GameMenuPage): void {
    this.ensureSetup();
    this.rememberFocus();
    if (this.visible && this.history.current) this.history.push(page); else this.history.open(page);
    this.visible = true;
    this.invalidate();
  }
  private back(): void {
    if (!this.history.canGoBack) { this.onClose(); return; }
    this.rememberFocus(); this.history.back(); this.invalidate();
  }
  protected override onBack(): void { this.back(); }
  override onSetup(): void {
    super.onSetup();
    this.title = this.addPanel("title", Label); this.title.fontSize = 26; this.title.z = 1;
    this.backButton = this.addPanel("back", Button); this.backButton.text = "Back";
    this.backButton.onClick = () => this.back();
    this.settingsNote = this.addPanel("settings-note", Label);
    this.settingsNote.text = "Changes save automatically"; this.settingsNote.fontSize = 14;
    this.settingsNote.z = 1;
    this.settingsNote.color = ex.Color.fromHex("#b5b9ae");
    for (const page of ["menu", "help", "settings", "build", "view"] as const) this.pages.set(page, this.addPanel(page, ScrollPanel));
    const menu = this.pages.get("menu")!.content; menu.spacing = 12;
    for (const [text, page] of [["Board view", "view"], ["Help", "help"], ["Settings", "settings"]] as const) {
      const button = menu.addPanel(page, Button); button.text = text; button.onClick = () => this.open(page);
    }
    const resume = menu.addPanel("resume", Button); resume.text = "Resume"; resume.onClick = () => this.onClose();
    const title = menu.addPanel("title", Button); title.text = "Save and return to title";
    title.onClick = () => { this.player?.getScene().save(); this.onClose(); this.scene?.engine.goToScene("WelcomeScene"); };
    const view = this.pages.get("view")!.content;
    const gesture = view.addPanel("gestures", Label); gesture.text = "Drag to pan · Pinch to zoom";
    for (const [key, text, command] of [
      ["zoom-out", "Zoom out", () => { const p = this.player; if (p) p.setCameraZoom(p.getCamera().zoom / 1.25); }],
      ["reset-view", "Centre board", () => this.player?.resetCamera()],
      ["zoom-in", "Zoom in", () => { const p = this.player; if (p) p.setCameraZoom(p.getCamera().zoom * 1.25); }],
    ] as const) {
      const button = view.addPanel(key, Button); button.text = text;
      button.onClick = () => { command(); this.onClose(); };
    }
    addHelpContent(this.pages.get("help")!.content);
    configureHelpNavigation(this.pages.get("help")!);
    this.pages.get("settings")!.useFooterNavigation();
    addSettingsContent(this.pages.get("settings")!.content);
    const build = this.pages.get("build")!.content; build.spacing = 12;
    for (const action of getPlayerActions().filter(action => action.type === PlayerActionTypes.BUILDABLE && action.code !== "REMOVE")) {
      const row = build.addPanel(action.code, List); row.spacing = 4;
      const button = row.addPanel("choose", Button); button.icon = { imageSource: action.image, width: 28, height: 28 }; button.fontSize = 18;
      button.onClick = () => { if (!action.unlocked) return; this.onClose(); if (this.player) this.player.currentAction = action.code; };
      row.addPanel("description", Label).text = action.tooltip;
    }
    // Escape follows the same history as the visible Back control.
  }
  override onRefresh(): void {
    const page = this.history.current ?? "menu";
    this.title.text = { menu: "Game menu", help: "How to play", settings: "Settings", build: "Build a piece", view: "Board view" }[page];
    for (const [key, list] of this.pages) list.collapsed = key !== page;
    this.backButton.collapsed = !this.history.canGoBack;
    this.settingsNote.collapsed = page !== "settings";
    for (const action of getPlayerActions()) {
      const row = this.pages.get("build")?.content.getPanel<List>(action.code);
      if (!row || action.type !== PlayerActionTypes.BUILDABLE) continue;
      const button = row.getPanel<Button>("choose")!;
      const name = action.code === "NEWKNIGHT" ? "Knight" : action.name.replace("Buy ", "");
      button.text = action.unlocked ? `${name}\n${formatGold(action.building.cost())} gold` : `${name}\nLocked`;
      button.disabled = !action.unlocked;
      row.getPanel<Label>("description")!.text = action.unlocked ? action.tooltip : buildRequirements[action.code] ?? "Unlock through Research";
    }
    super.onRefresh();
    if (this.lastPage !== page && this.scene instanceof Level) {
      this.lastPage = page;
      const target = this.rememberedFocus.get(page);
      this.scene.inputSystem?.setFocus(target?.rendered ? target : this.history.canGoBack ? this.backButton : this.closeButton);
    }
  }
  override onLayout(): void {
    super.onLayout();
    this.title.topLeft = ex.vec(-this.halfWidth + 16, -this.halfHeight + 16);
    this.title.maxWidth = Math.max(40, this.width - this.closeButton.width - 48);
    this.backButton.bottomLeft = ex.vec(-this.halfWidth + 16, this.halfHeight - 12);
    if (!this.settingsNote.collapsed) {
      if (this.screenHeight < 450 && this.width >= 500) {
        this.settingsNote.maxWidth = Math.max(1, this.closeButton.left - this.title.right - 32);
        this.settingsNote.leftCenter = ex.vec(this.title.right + 16, this.title.center.y);
      } else {
        this.settingsNote.maxWidth = Math.max(1, this.width - 40);
        this.settingsNote.topLeft = ex.vec(-this.halfWidth + 20, this.title.bottom + 10);
      }
    }
    for (const [key, page] of this.pages) {
      if (key === "settings" || key === "help") {
        const top = key === "settings" ? Math.max(this.title.bottom, this.settingsNote.bottom) + 14 : Math.max(this.title.bottom, this.closeButton.bottom) + 12;
        const bottom = this.backButton.collapsed ? this.halfHeight - (key === "help" ? 84 : 16) : this.backButton.top - 12;
        page.size = ex.vec(this.width - 40, Math.max(1, bottom - top));
        page.pos = ex.vec(0, (top + bottom) / 2);
      } else {
        page.size = ex.vec(this.width - 40, Math.max(1, this.height - 154));
        page.pos = ex.vec(0, 2);
      }
      wrapContent(page.content, page.width - 8);
    }
  }
}
