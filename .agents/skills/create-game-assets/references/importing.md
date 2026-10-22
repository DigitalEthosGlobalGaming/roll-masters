# Import contract

Requires Python 3.10+ and Pillow. If `python` lacks Pillow, use an available bundled
Python or create a local venv and install `scripts/requirements.txt` there.

Run layout (originals are retained):

```text
tmp/game-assets/<run-id>/
  prompt.md                 Exact creator prompt/job
  creator-review.md         Creator's own visual checks and limitations
  manifest.json
  generated/                Only artwork newly created for this run
    dice-atlas.png
  processed/                Importer creates this
  backups/                  Importer creates this only for replaced targets
  import-report.json        Importer creates this
```

`generated/` is a provenance boundary: never populate it with existing game images
or copies of unrelated reference art. The importer restricts source reads to it;
it cannot establish who created a file. Preserve prompt/review evidence yourself.

## Manifest version 1

Example for two assets from a two-cell atlas, not a complete six-face job:

```json
{
  "version": 1,
  "sources": [
    {"id": "dice", "file": "generated/dice-atlas.png", "size": [1024, 512]}
  ],
  "assets": [
    {"source": "dice", "rect": [0, 0, 512, 512], "output": "medieval/dice_1.png", "size": [64, 64], "padding": 1},
    {"source": "dice", "rect": [512, 0, 512, 512], "output": "medieval/dice_2.png", "size": [64, 64], "padding": 1}
  ]
}
```

- Source `size` is mandatory and must match decoded dimensions exactly. Obtain
  actual dimensions from the creator. Every PNG must have an alpha channel.
- Rectangles are integer `[x, y, width, height]` in source pixels, with origin at
  the top left. Every asset needs a rectangle, including individual PNGs (use the
  whole canvas). Out-of-bounds and overlapping rectangles are rejected per source.
- `output` is a unique lowercase snake_case `.png` path relative to `public/images`.
  Nested lowercase folder names may contain underscores/hyphens. Absolute paths,
  traversal, symlink escapes, duplicate/case-alias targets, Windows reserved names,
  and overwriting the source artifact are rejected.
- Optional asset `size` defaults to the crop size; resizing uses nearest-neighbor.
  Aspect ratio must stay unchanged. The whole cell is resized, without auto-trim
  or recentering, to preserve animation alignment.
- `padding` defaults to 1 transparent pixel on every side. It is checked on both
  crop and final output, so request sufficient generation gutters for reductions.
  Explicitly use 0 for intentionally full-bleed UI. Every crop/output still needs
  visible content and at least one fully transparent pixel; opaque sheets must be
  corrected by the image creator. No matte removal or pixel recolouring occurs.
- Do not put prompts, provenance metadata, or arbitrary code inside manifests.

## Commands

```powershell
python .agents/skills/create-game-assets/scripts/import_assets.py --run-dir tmp/game-assets/<run-id>
python .agents/skills/create-game-assets/scripts/import_assets.py --run-dir tmp/game-assets/<run-id> --apply
# Only for replacements already requested by the user:
python .agents/skills/create-game-assets/scripts/import_assets.py --run-dir tmp/game-assets/<run-id> --apply --replace-existing
```

The default repository root is derived from the script location. `--repo-root`
exists for isolated tests. All inputs and collisions are checked before staging
or installing. Dry-run staging is safe to repeat. The JSON report records source
hashes, crop/output geometry, hashes of processed PNGs, targets, collisions, and
whether installation occurred. `--replace-existing` writes byte-for-byte backups
without decoding existing images and refuses to overwrite an earlier backup.
Backup collisions are also preflighted. Individual installed files use atomic
replacement; a whole multi-file batch is not transactional on filesystem failure.
If installation fails midway, inspect targets/report/backups before retrying.

These checks cannot verify face values, subject identity, style, or whether a
model baked a checkerboard into an image with some transparent pixels. The
creator's visual review is a separate requirement. The script deliberately does
not generate thumbnails or open destination images.

Tests use synthetic PNGs created during the test and isolated temporary repositories:

```powershell
python -m unittest discover -s .agents/skills/create-game-assets/scripts -p "test_*.py"
```
