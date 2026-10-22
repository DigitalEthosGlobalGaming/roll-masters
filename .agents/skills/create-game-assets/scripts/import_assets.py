"""Validate new PNG artifacts, stage sprites, and optionally install them."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile

from PIL import Image


class ImportFailure(ValueError):
    pass


def confined(base: Path, relative: str) -> Path:
    """Reject absolute/traversal paths and links escaping a trusted directory."""
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise ImportFailure(f"Expected a nonempty POSIX relative path: {relative!r}")
    parts = PurePosixPath(relative).parts
    if relative.startswith("/") or ":" in relative or any(p in (".", "..") for p in relative.split("/")):
        raise ImportFailure(f"Unsafe relative path: {relative}")
    candidate = base.joinpath(*parts)
    if not candidate.resolve().is_relative_to(base.resolve()):
        raise ImportFailure(f"Path escapes its directory: {relative}")
    return candidate


def integers(value, length: int, label: str, minimum: int = 1) -> list[int]:
    if not isinstance(value, list) or len(value) != length or any(
        type(v) is not int or v < minimum for v in value
    ):
        raise ImportFailure(f"{label} requires {length} integers >= {minimum}")
    return value


def output_name(value) -> str:
    if not isinstance(value, str) or not re.fullmatch(
        r"(?:[a-z0-9][a-z0-9_-]*/)+[a-z0-9][a-z0-9_]*\.png", value
    ):
        raise ImportFailure(f"Invalid output name (folder/snake_case.png required): {value!r}")
    reserved = {"con", "prn", "aux", "nul"} | {f"{s}{i}" for s in ("com", "lpt") for i in range(1, 10)}
    if any(p.split(".")[0] in reserved for p in value.split("/")):
        raise ImportFailure(f"Reserved Windows output name: {value}")
    return value


def validate_pixels(image: Image.Image, padding: int, label: str):
    alpha = image.getchannel("A")
    low, high = alpha.getextrema()
    if high == 0 or low != 0:
        raise ImportFailure(f"{label}: visible content and genuine transparent pixels required")
    width, height = image.size
    if padding:
        if 2 * padding >= min(width, height):
            raise ImportFailure(f"{label}: padding consumes the sprite")
        borders = [(0, 0, width, padding), (0, height - padding, width, height),
                   (0, 0, padding, height), (width - padding, 0, width, height)]
        if any(alpha.crop(box).getextrema()[1] != 0 for box in borders):
            raise ImportFailure(f"{label}: content touches the required transparent gutter")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".sprite-", delete=False) as handle:
            name = handle.name
            handle.write(data)
        os.replace(name, path)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)


def import_assets(run_dir: Path, repo_root: Path, apply: bool = False,
                  replace_existing: bool = False) -> dict:
    run_dir, repo_root = run_dir.resolve(), repo_root.resolve()
    images_root = confined(repo_root, "public/images")
    if run_dir.is_relative_to(images_root.resolve()):
        raise ImportFailure("Run directory must be outside public/images")
    generated = confined(run_dir, "generated")
    manifest_path = confined(run_dir, "manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or type(manifest.get("version")) is not int or manifest["version"] != 1:
        raise ImportFailure("Expected manifest version 1")
    sources, assets = manifest.get("sources"), manifest.get("assets")
    if not isinstance(sources, list) or not sources or not isinstance(assets, list) or not assets:
        raise ImportFailure("Nonempty sources and assets lists required")

    loaded, source_reports = {}, []
    for source in sources:
        if not isinstance(source, dict):
            raise ImportFailure("Every source must be an object")
        source_id = source.get("id")
        if not isinstance(source_id, str) or not source_id or source_id in loaded:
            raise ImportFailure("Source IDs must be nonempty and unique")
        file = source.get("file")
        path = confined(run_dir, file)
        if not isinstance(file, str) or not file.startswith("generated/") or not path.resolve().is_relative_to(generated.resolve()):
            raise ImportFailure("Source files must be in this run's generated/ folder")
        # A generated/ link back to old game assets is not a new input.
        if path.resolve().is_relative_to(images_root.resolve()):
            raise ImportFailure("Existing public/images files cannot be source artifacts")
        size = integers(source.get("size"), 2, "Source size")
        data = path.read_bytes()
        with Image.open(io.BytesIO(data)) as original:
            if original.format != "PNG" or "A" not in original.getbands() or getattr(original, "n_frames", 1) != 1:
                raise ImportFailure(f"{file}: a single-frame PNG with an alpha channel is required")
            if original.size != tuple(size):
                raise ImportFailure(f"{file}: expected {size}, received {original.size}")
            loaded[source_id] = original.convert("RGBA")
        source_reports.append({"id": source_id, "file": file, "size": size, "sha256": sha256(data)})

    plans, names, resolved_targets, rectangles = [], set(), set(), {}
    for asset in assets:
        if not isinstance(asset, dict):
            raise ImportFailure("Every asset must be an object")
        source_id = asset.get("source")
        if not isinstance(source_id, str) or source_id not in loaded:
            raise ImportFailure(f"Unknown source ID: {source_id}")
        name = output_name(asset.get("output"))
        target = confined(images_root, name)
        resolved = str(target.resolve()).casefold()
        if name in names or resolved in resolved_targets:
            raise ImportFailure(f"Duplicate destination: {name}")
        names.add(name)
        resolved_targets.add(resolved)
        if target.exists() and not target.is_file():
            raise ImportFailure(f"Destination is not a file: {name}")
        x, y, width, height = integers(asset.get("rect"), 4, "Rectangle", 0)
        image = loaded[source_id]
        if width == 0 or height == 0 or x + width > image.width or y + height > image.height:
            raise ImportFailure(f"{name}: rectangle is empty or outside source bounds")
        box = (x, y, x + width, y + height)
        for other in rectangles.setdefault(source_id, []):
            if box[0] < other[2] and box[2] > other[0] and box[1] < other[3] and box[3] > other[1]:
                raise ImportFailure(f"{name}: overlapping asset rectangles")
        rectangles[source_id].append(box)
        size = integers(asset.get("size", [width, height]), 2, "Output size")
        if size[0] * height != size[1] * width:
            raise ImportFailure(f"{name}: resize must preserve aspect ratio")
        padding = asset.get("padding", 1)
        if type(padding) is not int or padding < 0:
            raise ImportFailure(f"{name}: padding must be a nonnegative integer")
        sprite = image.crop(box)
        validate_pixels(sprite, padding, name)
        sprite = sprite.resize(tuple(size), Image.Resampling.NEAREST)
        validate_pixels(sprite, padding, name)
        buffer = io.BytesIO()
        sprite.save(buffer, format="PNG")
        payload = buffer.getvalue()
        staged = confined(run_dir, f"processed/{name}")
        backup = confined(run_dir, f"backups/{name}")
        if apply and target.exists() and not replace_existing:
            raise ImportFailure(f"Existing destination: {name}; replacement must be requested explicitly")
        if apply and target.exists() and backup.exists():
            raise ImportFailure(f"Backup already exists: {backup}; use a new run folder")
        # Prevent linked staging paths from aliasing source artifacts or destinations.
        for temporary in (staged, backup):
            if temporary.resolve().is_relative_to(generated.resolve()) or temporary.resolve().is_relative_to(images_root.resolve()):
                raise ImportFailure("Staging/backup path aliases source or destination directories")
        plans.append({"source": source_id, "rect": [x, y, width, height], "output": name,
                      "size": size, "sha256": sha256(payload), "target": str(target),
                      "collision": target.exists(), "backup": None, "installed": False,
                      "_payload": payload, "_staged": staged, "_backup": backup})

    report_path = confined(run_dir, "import-report.json")
    if report_path.resolve().is_relative_to(generated.resolve()) or report_path.resolve().is_relative_to(images_root.resolve()):
        raise ImportFailure("Report path aliases source or destination directories")
    report = {"version": 1, "applied": False, "sources": source_reports, "assets": []}
    for plan in plans:
        atomic_write(plan["_staged"], plan["_payload"])
        report["assets"].append({key: value for key, value in plan.items() if not key.startswith("_")})

    def save_report():
        atomic_write(report_path, (json.dumps(report, indent=2) + "\n").encode("utf-8"))

    save_report()
    if apply:
        for plan, entry in zip(plans, report["assets"]):
            target, backup = Path(plan["target"]), plan["_backup"]
            if target.exists():
                if not replace_existing:
                    raise ImportFailure(f"Destination appeared during import: {target}")
                backup.parent.mkdir(parents=True, exist_ok=True)
                # Copy bytes only; never decode existing artwork.
                with target.open("rb") as old, backup.open("xb") as saved:
                    shutil.copyfileobj(old, saved)
                entry["backup"] = str(backup)
                save_report()
            atomic_write(target, plan["_payload"])
            entry["installed"] = True
            save_report()
        report["applied"] = True
        save_report()
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[4])
    parser.add_argument("--apply", action="store_true", help="Install staged sprites into public/images")
    parser.add_argument("--replace-existing", action="store_true", help="Back up and replace explicitly authorized targets")
    args = parser.parse_args()
    try:
        report = import_assets(args.run_dir, args.repo_root, args.apply, args.replace_existing)
    except (ValueError, OSError, Image.DecompressionBombError) as exc:
        parser.exit(1, f"Import rejected: {exc}\n")
    print(json.dumps({"applied": report["applied"], "assets": len(report["assets"]),
                      "report": str(args.run_dir.resolve() / "import-report.json")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
