import { Canvas, Color } from "excalibur";

export const boardPadding = 18;

/** Static board artwork is rasterized once; camera movement only transforms its image. */
export function createBoardGraphic(columns: number, rows: number, cellWidth: number, cellHeight: number, color: Color): Canvas {
  const width = columns * cellWidth;
  const height = rows * cellHeight;
  return new Canvas({
    width: width + boardPadding * 2,
    height: height + boardPadding * 2,
    cache: true,
    draw: ctx => {
      ctx.translate(boardPadding, boardPadding);
      const surround = (padding: number, fill: string, offset = 0) => {
        ctx.fillStyle = fill;
        ctx.fillRect(offset - padding, offset - padding, width + padding * 2, height + padding * 2);
      };
      surround(13, "#0b0d0e", 5);
      surround(11, "#86704b");
      surround(10, "#362e26");
      surround(3, "#86704b");
      surround(2, "#111c19");
      ctx.fillStyle = color.toString();
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#253c34";
      for (let row = 0; row < rows; row++) {
        for (let col = row % 2; col < columns; col += 2) ctx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
      }
      ctx.strokeStyle = "#172622";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let row = 0; row <= rows; row++) { ctx.moveTo(0, row * cellHeight); ctx.lineTo(width, row * cellHeight); }
      for (let col = 0; col <= columns; col++) { ctx.moveTo(col * cellWidth, 0); ctx.lineTo(col * cellWidth, height); }
      ctx.stroke();
    },
  });
}
