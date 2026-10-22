export type BenchmarkPiece = "dice" | "pawn" | "knight" | "bishop" | "rook";

// Repeating 4×4 tiles leave connected empty corridors for moving automation.
const mixedTile = [
  "dice", "pawn", "dice", null,
  "knight", null, "bishop", "dice",
  "dice", "dice", "rook", null,
  null, "dice", "dice", null,
] as const;

export function benchmarkLayout(size: number, count: number, mixed = false) {
  if (![16, 32].includes(size) || !Number.isInteger(count) || count < 0 || count > size * size || (mixed && count !== size * size)) {
    throw new Error("Unsupported benchmark layout");
  }
  const pieces: { x: number; y: number; kind: BenchmarkPiece }[] = [];
  for (let index = 0; index < count; index++) {
    const x = index % size, y = Math.floor(index / size);
    const kind = mixed ? mixedTile[(y % 4) * 4 + x % 4] : index % 4 === y % 4 ? "pawn" : "dice";
    if (kind) pieces.push({ x, y, kind });
  }
  return pieces;
}
