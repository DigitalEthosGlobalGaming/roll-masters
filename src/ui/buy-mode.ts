export type BuyMode = "one" | "ten" | "max";

/**
 * Shared bulk-buy state for upgrade lists. The toggle works on touch; held Shift (max) and
 * Ctrl (x10) override it on desktop.
 */
class BuyModeState {
  toggle: BuyMode = "one";
  private shift = false;
  private ctrl = false;
  private listeners = new Set<() => void>();
  private attached = false;

  get mode(): BuyMode {
    if (this.shift) return "max";
    if (this.ctrl) return "ten";
    return this.toggle;
  }
  /** Purchase size for `Upgrade.buy`. */
  get limit(): number { return this.mode === "max" ? Infinity : this.mode === "ten" ? 10 : 1; }

  setToggle(mode: BuyMode): void {
    this.toggle = this.toggle === mode ? "one" : mode;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    this.attach();
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void { for (const listener of this.listeners) listener(); }

  private sync(shift: boolean, ctrl: boolean): void {
    if (shift === this.shift && ctrl === this.ctrl) return;
    this.shift = shift;
    this.ctrl = ctrl;
    this.notify();
  }

  private attach(): void {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    const onKey = (event: KeyboardEvent) => this.sync(event.shiftKey, event.ctrlKey || event.metaKey);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", () => this.sync(false, false));
    // Clicks carry accurate modifier state even if a key event was missed.
    window.addEventListener("pointerdown", event => this.sync(event.shiftKey, event.ctrlKey || event.metaKey), true);
  }
}

export const buyMode = new BuyModeState();
