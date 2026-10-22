import * as ex from "excalibur";
import { Panel } from "./panel";
import { Label } from "./elements/label";
import { helpTopics } from "./game-presentation";
import { Button } from "./elements/button";
import { SettingsRow, SettingsVolumeRow } from "./settings-content";
import { InformationCard } from "./information-card";
import type { ScrollPanel } from "./scroll-panel";

/** One complete instruction per card, wrapped before the paging container measures it. */
export class HelpCard extends Panel {
  private title!: Label;
  private description!: Label;
  private availableWidth = 560;
  private surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#1e2522") });
  private edge = new ex.Rectangle({ width: 3, height: 1, color: ex.Color.fromHex("#65583e") });
  private surfaceMember = this.addGraphic(this.surface);
  private edgeMember = this.addGraphic(this.edge);
  constructor(parent: Panel, readonly index: number) { super(parent); }
  setLayoutWidth(width: number): void {
    width = Math.max(1, width);
    if (width !== this.availableWidth) { this.availableWidth = width; this.invalidateLayout(); }
  }
  override onSetup(): void {
    const topic = helpTopics[this.index];
    this.title = this.addPanel("title", Label);
    this.title.text = `${String(this.index + 1).padStart(2, "0")}  ${topic.title}`;
    this.title.fontSize = 21; this.title.color = ex.Color.fromHex("#e5c58a");
    this.description = this.addPanel("body", Label); this.description.text = topic.text;
    this.description.fontSize = 17; this.description.color = ex.Color.fromHex("#f2eadb");
    for (const label of [this.title, this.description]) { label.align = "left"; label.z = 1; }
  }
  override onLayout(): void {
    const padding = this.screenHeight < 450 ? 12 : 16;
    // Word wrapping uses a little more height; short landscape screens get slightly smaller body text.
    this.description.fontSize = this.screenHeight < 450 ? 15 : 17;
    for (const label of [this.title, this.description]) label.maxWidth = Math.max(1, this.availableWidth - padding * 2);
    this.size = ex.vec(this.availableWidth, padding * 2 + this.title.height + 8 + this.description.height);
    this.title.topLeft = ex.vec(-this.halfWidth + padding, -this.halfHeight + padding);
    this.description.topLeft = ex.vec(this.title.left, this.title.bottom + 8);
  }
  override onRender(): void {
    this.surface.width = this.width; this.surface.height = this.edge.height = this.height;
    this.surfaceMember.offset = this.edgeMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
  }
}

export function configureHelpNavigation(scroll: ScrollPanel): void {
  scroll.useFooterNavigation();
  for (const [key, name] of [["previous", "Previous instructions"], ["next", "More instructions"]]) {
    const button = scroll.getPanel<Button>(key)!;
    button.accessibleName = name; button.quiet = true;
  }
}

export function addHelpContent(parent: Panel): void {
  helpTopics.forEach((_, index) => parent.addPanel(`help-${index}`, HelpCard, index));
}

/** Wrap text before the paging container measures its cards. */
export function wrapContent(parent: Panel, width: number): void {
  for (const child of parent.getChildrenPanels()) {
    if (child instanceof SettingsRow || child instanceof SettingsVolumeRow || child instanceof HelpCard || child instanceof InformationCard) { child.setLayoutWidth(width); continue; }
    if (child instanceof Button) {
      child.maxTextWidth = Math.max(40, width - child.padding * 2 - (child.icon ? child.icon.width + 10 : 12));
      continue;
    }
    if (child instanceof Label) child.maxWidth = Math.max(40, width);
    wrapContent(child, width);
  }
}

