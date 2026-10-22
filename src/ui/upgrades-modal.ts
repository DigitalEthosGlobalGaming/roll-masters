import * as ex from "excalibur";
import { Modal } from "./modal";
import { PrestigeUi } from "./prestige";
import { UpgradeUi } from "./upgrades";
import { Level } from "@src/level";

export class UpgradesModal extends Modal {
  private _currentTab: "upgrade-ui" | "prestige-ui" = "upgrade-ui";
  private research!: UpgradeUi;
  private prestige!: PrestigeUi;
  private lastTab?: string;
  get currentTab() { return this._currentTab; }
  override onViewportChanged(): void {
    super.onViewportChanged();
    this.size = ex.vec(this.width, Math.min(680, this.height));
    this.prestige?.getPanel("confirmation")?.onViewportChanged();
  }
  set currentTab(value: "upgrade-ui" | "prestige-ui") { if (value !== this._currentTab) { this._currentTab = value; this.invalidate(); } }
  override onSetup(): void {
    super.onSetup();
    this.research = this.addPanel("upgrade-ui", UpgradeUi);
    this.prestige = this.addPanel("prestige-ui", PrestigeUi);
    this.research.onNavigate = tab => this.currentTab = tab;
    this.prestige.onNavigate = tab => this.currentTab = tab;
  }
  override onRefresh(): void {
    this.research.visible = this.currentTab === "upgrade-ui";
    this.prestige.visible = this.currentTab === "prestige-ui";
    this.research.invalidate(); this.prestige.invalidate();
    super.onRefresh();
    if (this.lastTab !== this.currentTab && this.scene instanceof Level) {
      this.lastTab = this.currentTab;
      this.scene.inputSystem?.setFocus(this.closeButton);
    }
  }
  override onLayout(): void {
    super.onLayout();
    for (const tab of [this.research, this.prestige]) {
      tab.size = ex.vec(this.width - 48, this.height - 92);
      tab.pos = ex.vec(0, 26);
    }
  }
  override onVisibleChanged(value: boolean): void {
    this.prestige?.resetConfirmation();
    super.onVisibleChanged(value);
  }
}
