export type PieceMotionStyle = "pawn" | "bishop" | "knight" | "rook";

const rest = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const settleDuration = 110;

// Presentation timing also supplies contact hooks for effects along the visible path.
export class PieceFeedback {
  private elapsed = Infinity;
  private from = { x: 0, y: 0 };
  private travelDuration = 0;
  private moving = false;
  private contacts: { progress: number; callback: () => void }[] = [];

  constructor(private style: PieceMotionStyle) {}

  advance(elapsed: number) {
    if (this.elapsed >= (this.moving ? this.travelDuration + settleDuration : 180) && !this.contacts.length) return;
    this.elapsed += Math.max(0, elapsed);
    if (!this.contacts.length) return;
    const progress = this.travelProgress;
    const ready = this.contacts.filter(contact => contact.progress <= progress);
    this.contacts = this.contacts.filter(contact => contact.progress > progress);
    for (const contact of ready) contact.callback();
  }

  get travelProgress() {
    if (!this.moving) return 1;
    const flight = Math.max(0, Math.min(1, (this.elapsed / this.travelDuration - 0.12) / 0.88));
    return this.style === "knight" ? flight * flight * (3 - 2 * flight) : 1 - (1 - flight) ** 3;
  }

  whenPassed(progress: number, callback: () => void) {
    const contact = Math.max(0, Math.min(1, progress));
    if (contact <= this.travelProgress) callback();
    else this.contacts.push({ progress: contact, callback });
  }

  move(x: number, y: number) {
    this.contacts = [];
    this.from = { x, y };
    this.elapsed = 0;
    this.travelDuration = this.style === "knight" ? 240 : Math.min(280, 170 + Math.hypot(x, y) * 0.6);
    this.moving = true;
  }

  activate() {
    // A fast repeating automation pulse cannot keep restarting its own motion.
    if (this.elapsed < (this.moving ? this.travelDuration + settleDuration : 180)) return;
    this.elapsed = 0;
    this.moving = false;
  }

  pose(quiet = false) {
    if (quiet) return rest;
    if (!this.moving) {
      const t = Math.min(1, this.elapsed / 180);
      if (t === 1) return rest;
      const pulse = Math.sin(t * Math.PI) * (1 - t);
      const bishop = this.style === "bishop";
      return {
        x: 0,
        y: bishop ? -2 * pulse : 0,
        rotation: bishop ? 0 : -0.09 * pulse,
        scaleX: 1 + (bishop ? -0.07 : 0.12) * pulse,
        scaleY: 1 + (bishop ? 0.1 : -0.1) * pulse,
      };
    }

    const t = Math.min(1, this.elapsed / this.travelDuration);
    const knight = this.style === "knight";
    const direction = -Math.sign(this.from.x);
    if (t < 1) {
      // A brief crouch/lean precedes an eased takeoff; the final cell is already occupied.
      const anticipation = 0.12;
      if (t < anticipation) {
        const crouch = Math.sin(t / anticipation * Math.PI);
        return {
          x: this.from.x,
          y: this.from.y,
          rotation: -direction * 0.04 * crouch,
          scaleX: 1 + 0.08 * crouch,
          scaleY: 1 - 0.08 * crouch,
        };
      }
      const flight = (t - anticipation) / (1 - anticipation);
      const eased = this.travelProgress;
      const arc = Math.sin(flight * Math.PI);
      return {
        x: this.from.x * (1 - eased),
        y: this.from.y * (1 - eased) - (knight ? 7 : 0.8) * arc,
        rotation: direction * (knight ? 0.12 : 0.035) * arc,
        scaleX: 1 - (knight ? 0.07 : 0.02) * arc,
        scaleY: 1 + (knight ? 0.1 : 0.02) * arc,
      };
    }
    const landing = Math.min(1, (this.elapsed - this.travelDuration) / settleDuration);
    if (landing === 1) return rest;
    // Start at rest to avoid a discontinuity when crossing from flight to landing.
    const squash = Math.sin(landing * Math.PI * 2) * (1 - landing) ** 2 * (knight ? 0.25 : 0.14);
    return { x: 0, y: 0, rotation: 0, scaleX: 1 + squash, scaleY: 1 - squash };
  }
}
