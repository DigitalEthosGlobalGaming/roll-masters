import { Label } from "@src/ui/elements/label";
export type Tooltip = { code: string; title: string; description: string };
export class PlayerTooltip extends Label {
  private _tooltip: Tooltip | null = null;
  get tooltip(): Tooltip | null { return this._tooltip; }
  set tooltip(value: Tooltip | null) {
    this._tooltip = value;
    this.visible = value !== null;
    this.text = value ? `${value.title}\n${value.description}` : "";
    this.align = "left";
  }
}
