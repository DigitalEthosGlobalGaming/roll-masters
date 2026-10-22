import { tutorialSteps } from "./tutorial-steps";
import type { TutorialFacts, TutorialStep } from "./tutorial-steps";

export type TutorialChange = { type: "advanced" | "finished" | "skipped"; from: number; to: number };
export type TutorialStatus = "idle" | "running" | "finished" | "skipped";

/**
 * Pure tutorial state machine. It owns step order and completion rules only;
 * rendering, saving and rewards belong to the HUD that listens to `onChange`.
 */
export class TutorialDirector {
  onChange: (change: TutorialChange) => void = () => {};
  private _index = 0;
  private _status: TutorialStatus = "idle";
  constructor(readonly steps: readonly TutorialStep[] = tutorialSteps) {}

  get status(): TutorialStatus { return this._status; }
  get running(): boolean { return this._status === "running"; }
  get index(): number { return this._index; }
  get total(): number { return this.steps.length; }
  get step(): TutorialStep | null { return this.running ? this.steps[this._index] ?? null : null; }

  /** Begin (or resume) at a step, skipping any whose state-based goal is already met. */
  start(facts: TutorialFacts, index = 0): void {
    this._status = "running";
    this._index = Math.max(0, Math.min(this.steps.length - 1, Math.floor(index) || 0));
    this.move(this._index, facts);
  }

  /** Re-check the current step against board state. */
  refresh(facts: TutorialFacts): boolean {
    const step = this.step;
    if (!step?.done?.(facts)) return false;
    this.move(this._index + 1, facts);
    return true;
  }

  /** A game event occurred; advances only when the current step is waiting for it. */
  signal(name: string, facts: TutorialFacts): boolean {
    const step = this.step;
    if (!step || step.signal !== name) return false;
    this.move(this._index + 1, facts);
    return true;
  }

  /** The player pressed the step's own button. */
  next(facts: TutorialFacts): boolean {
    const step = this.step;
    if (!step?.button) return false;
    this.move(this._index + 1, facts);
    return true;
  }

  skip(): void {
    if (!this.running) return;
    const from = this._index;
    this._status = "skipped";
    this.onChange({ type: "skipped", from, to: from });
  }

  private move(target: number, facts: TutorialFacts): void {
    const from = this._index;
    let index = target;
    // Fast-forward through steps whose goal the board already satisfies.
    while (index < this.steps.length && this.steps[index].done?.(facts)) index++;
    if (index >= this.steps.length) {
      this._index = this.steps.length - 1;
      this._status = "finished";
      this.onChange({ type: "finished", from, to: this._index });
      return;
    }
    this._index = index;
    if (index !== from) this.onChange({ type: "advanced", from, to: index });
  }
}
