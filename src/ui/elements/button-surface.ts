import * as ex from "excalibur";

export type ButtonVisualState = "normal" | "hover" | "pressed" | "disabled";
const metal = {
  normal: { hi: "#ffe08a", mid: "#d9a33a", lo: "#8f5f19", outline: "#24160a" },
  hover: { hi: "#fff2b8", mid: "#efbd50", lo: "#a8721f", outline: "#24160a" },
  disabled: { hi: "#b8b2a2", mid: "#858072", lo: "#57534a", outline: "#1a1917" },
};
const face = {
  normal: { base: "#2e4a33", hi: "#3d6043", lo: "#223828" },
  hover: { base: "#37573c", hi: "#4c7552", lo: "#29422e" },
  pressed: { base: "#213526", hi: "#1c2e20", lo: "#162419" },
  disabled: { base: "#34372f", hi: "#3b3e36", lo: "#2d2f29" },
};
const colors = new Map<string, ex.Color>();
function color(hex: string): ex.Color {
  let result = colors.get(hex);
  if (!result) { result = ex.Color.fromHex(hex); colors.set(hex, result); }
  return result;
}

/** Integrated bracket frame from the HTML reference, drawn at its actual dimensions. */
export class ButtonSurface extends ex.Graphic {
  state: ButtonVisualState = "normal";
  selected = false;
  focused = false;
  disabled = false;
  quiet = false;
  pressOffset = 0;
  private from = 0;
  private target = 0;
  private elapsed = 100;
  get contentOffset(): number { return this.disabled ? 0 : Math.round(this.pressOffset); }

  /** Bounded cubic ease-out; motion never owns activation or the hit rectangle. */
  updateMotion(pressed: boolean, quiet: boolean, elapsed: number): boolean {
    const previous = this.pressOffset;
    if (quiet) {
      this.pressOffset = this.from = this.target = 0; this.elapsed = 100;
    } else {
      const target = pressed ? 3 : 0;
      if (target !== this.target) { this.from = this.pressOffset; this.target = target; this.elapsed = 0; }
      this.elapsed = Math.min(100, this.elapsed + Math.max(0, elapsed));
      const t = this.elapsed / 100;
      this.pressOffset = this.from + (this.target - this.from) * (1 - Math.pow(1 - t, 3));
    }
    return previous !== this.pressOffset;
  }
  pulse(): void { this.pressOffset = this.from = this.target = 3; this.elapsed = 100; }

  protected override _drawImage(ctx: ex.ExcaliburGraphicsContext, x: number, y: number): void {
    const width = this.width, height = this.height;
    if (width <= 0 || height <= 0) return;
    if (this.quiet) {
      const pressed = this.state === "pressed" || this.pressOffset > 1.5;
      const active = this.state === "hover" || this.focused;
      const rect = (left: number, top: number, w: number, h: number, fill: ex.Color) => {
        const right = Math.min(width, left + w), bottom = Math.min(height, top + h);
        left = Math.max(0, left); top = Math.max(0, top);
        if (right > left && bottom > top) ctx.drawRectangle(ex.vec(x + left, y + top), right - left, bottom - top, fill);
      };
      rect(0, 0, width, height, color("#101613"));
      rect(0, this.contentOffset, width, height - 3, color(this.disabled ? "#292d28" : pressed ? "#293e2e" : active ? "#29372d" : "#1e2522"));
      const edge = color(this.disabled ? "#57534a" : active ? "#c9a66a" : "#65583e");
      rect(0, height - 3, width, 2, edge);
      if (this.focused && !this.disabled) {
        const ink = color("#f2eadb");
        rect(0, 0, width, 2, ink);
        rect(0, 0, 2, height - 3, ink);
        rect(width - 2, 0, 2, height - 3, ink);
      }
      return;
    }
    // Only unusually tiny manual controls compress the fixed corner footprint.
    const scale = Math.min(1, width / 28, height / 28);
    const w = width / scale, h = height / scale;
    const state = this.disabled ? "disabled" : this.state;
    const pressed = state === "pressed" || !this.disabled && this.pressOffset > 1.5;
    const g = metal[state === "disabled" ? "disabled" : state === "hover" ? "hover" : "normal"];
    const f = face[state];
    const rect = (left: number, top: number, rw: number, rh: number, fill: string) => {
      // Clip adornments to the widget, including fractional and tiny controls.
      const right = Math.min(w, left + rw), bottom = Math.min(h, top + rh);
      left = Math.max(0, left); top = Math.max(0, top);
      if (right > left && bottom > top) ctx.drawRectangle(ex.vec(x + left * scale, y + top * scale), (right - left) * scale, (bottom - top) * scale, color(fill));
    };
    const x0 = 2, y0 = 2 + this.contentOffset, fw = w - 4, fh = h - 7;
    rect(x0, 5, fw, fh, "#07090a");
    rect(x0, y0, fw, fh, g.outline);
    rect(x0 + 1, y0 + 1, fw - 2, fh - 2, g.mid);
    const light = pressed ? g.lo : g.hi, shade = pressed ? g.hi : g.lo;
    rect(x0 + 1, y0 + 1, fw - 2, 1, light);
    rect(x0 + 1, y0 + 1, 1, fh - 2, light);
    rect(x0 + 1, y0 + fh - 2, fw - 2, 1, shade);
    rect(x0 + fw - 2, y0 + 1, 1, fh - 2, shade);
    const ix = x0 + 3, iy = y0 + 3, iw = fw - 6, ih = fh - 6;
    rect(ix + 1, iy, iw - 2, ih, g.outline);
    rect(ix, iy + 1, iw, ih - 2, g.outline);
    rect(ix + 1, iy + 1, iw - 2, ih - 2, f.base);
    if (pressed) {
      rect(ix + 1, iy + 1, iw - 2, 3, f.lo);
      rect(ix + 1, iy + 1, 1, ih - 2, f.lo);
    } else if (!this.disabled) {
      rect(ix + 1, iy + 1, iw - 2, 2, f.hi);
      rect(ix + 1, iy + ih - 3, iw - 2, 2, f.lo);
    }
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const cx = sx > 0 ? x0 - 1 : x0 + fw, cy = sy > 0 ? y0 - 1 : y0 + fh;
      const p = (i: number, j: number, pw: number, ph: number, fill: string) => rect(sx > 0 ? cx + i : cx - i - pw + 1, sy > 0 ? cy + j : cy - j - ph + 1, pw, ph, fill);
      p(0, 0, 11, 5, g.outline); p(0, 0, 5, 11, g.outline);
      p(1, 1, 9, 3, g.mid); p(1, 1, 3, 9, g.mid);
      p(1, 1, 9, 1, (sy > 0) !== pressed ? g.hi : g.lo);
      p(1, 1, 1, 9, (sx > 0) !== pressed ? g.hi : g.lo);
      p(2, 2, 1, 1, g.outline);
    }
    if (!this.disabled && this.selected) rect(ix + 5, iy + ih - 4, iw - 10, 2, g.hi);
    if (!this.disabled && this.focused) {
      const focus = "#fff2b8";
      rect(ix + 2, iy + 2, iw - 4, 1, focus); rect(ix + 2, iy + ih - 3, iw - 4, 1, focus);
      rect(ix + 2, iy + 2, 1, ih - 4, focus); rect(ix + iw - 3, iy + 2, 1, ih - 4, focus);
    }
  }

  clone(): ButtonSurface {
    const result = new ButtonSurface(this.cloneGraphicOptions());
    result.state = this.state; result.selected = this.selected; result.focused = this.focused; result.disabled = this.disabled;
    result.quiet = this.quiet;
    result.pressOffset = this.pressOffset; result.from = this.from; result.target = this.target; result.elapsed = this.elapsed;
    return result;
  }
}
