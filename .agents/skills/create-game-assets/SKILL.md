---
name: create-game-assets
description: Plan and delegate original Roll Masters game artwork in a dark medieval pixel-art style, then validate, slice, name, and install generated sprite atlases or individual PNGs. Use for creating game assets or importing artwork returned by an image agent.
---

# Create game assets

## Roles and image access

You are the asset coordinator. Read code, filenames, and text manifests to work
out what the game needs. **Do not open, render, visually inspect, or pass existing
repository images to another agent.** This includes images under `public/images`,
old atlases, thumbnails, and contact sheets derived from them. The text art brief
below is the style authority. Do not rediscover the style from existing pixels.

Delegate image creation to a separate image-capable agent with a fresh/minimal
context. Supply only the text system prompt, asset list, layout, and run folder.
Do not fork conversation images into the handoff. Use collaboration/subagent tools
when available; this workflow authorizes delegation for image creation, not new
sidebar chats. If delegation is unavailable, prepare the complete handoff for an
external image agent and report that generation is pending; do not claim artwork
was generated. Do not create images merely because this skill is being installed.

Only the image agent visually reviews its own new outputs. The coordinator uses
script validation and the creator's review notes. It may inspect new outputs only
if the user specifically requests coordinator visual review. No role may inspect
pre-existing game art. Scripts may decode only new inputs in the current run's
`generated/` folder. Listing destination filenames or checking for collisions is OK.

## Plan and hand off

1. Read root `AGENTS.md`; inspect relevant source and `src/resources.ts` as text.
   Use [references/asset-map.md](references/asset-map.md) for initial mappings.
   Scope each batch to the user's requested assets; available queen/king art does
   not mean those game features are implemented.
2. Create a unique run folder outside `public/images`, normally
   `tmp/game-assets/<run-id>/`, with `generated/`. Keep the prompt, manifest,
   original returned artwork, and creator review notes together for provenance.
3. Read [references/image-agent-system.md](references/image-agent-system.md).
   Send its full text as the creator's system instructions (or clearly marked
   role brief if the tool has no system field). Append a concrete job with asset
   descriptions, exact row/column order or individual filenames, canvas sizes,
   cell rectangles, padding, and intended output names. Prefer small coherent
   sheets; use individual images if the generator cannot maintain exact layouts.
4. The creator uses its available image-generation tool and returns local PNG
   paths plus a text report of subject/order, alpha, pixel style, and readability.
   For built-in ImageGen, request `transparent_background: true` and generate
   from text without referenced images or previous-image inclusion. Copy its
   returned local outputs into this run's `generated/` folder; never assume a
   generator accepts a destination argument. If pixels are available only inline,
   obtain a supported saved artifact before importing; never invent a path.
5. Create `manifest.json` using the contract in
   [references/importing.md](references/importing.md). Layout errors require a
   corrected generation or measured crop rectangles from the creator; do not
   infer boundaries by examining old art. The coordinator may read dimensions
   of these new files via the importer. Do not invent transparency by deleting
   black/white pixels; have the creator correct opaque outputs.

## Nine-slice UI skins

Prototype one nine-slice skin before generating a batch. Have the creator report
centre alpha statistics and inspect stretched previews at intended sizes.

Nine-slice patches need full-bleed edges and no outer gutter, unlike isolated
game sprites. Preserve transparent corner cutouts. If dark centres become
transparent, establish a frame-plus-runtime-fill contract before continuing;
do not repeatedly generate the batch with the same failed fill instructions.
Include this UI-specific contract in the creator handoff; see the UI exception
in [references/image-agent-system.md](references/image-agent-system.md).

## Process and install

The helper requires Python 3.10+ and Pillow (`scripts/requirements.txt`). Use an
available bundled Python with Pillow, or a local virtual environment; no npm
runtime dependency is needed. Commands below run from the repository root.

```powershell
python .agents/skills/create-game-assets/scripts/import_assets.py --run-dir tmp/game-assets/<run-id>
python .agents/skills/create-game-assets/scripts/import_assets.py --run-dir tmp/game-assets/<run-id> --apply
```

The first command stages cropped PNGs and writes `import-report.json`; it never
writes to `public/images`. Review that report and the creator's notes before
applying. Existing targets are rejected by default. If the user requested replacing
those specific assets, add `--replace-existing`; the helper backs them up as bytes
in the run folder. Otherwise use new filenames and update resource references
within the requested scope. No extra permission is needed for authorized imports.

The importer handles both atlases and individual PNGs, validates geometry, alpha,
padding and destination containment, preserves cell alignment, and scales only
with nearest-neighbor. It does not repair bad artwork or verify subjects/pip counts.
Keep manifests/prompts outside `public/`; retain them until the result is accepted.

When integration is requested, follow `src/AGENTS.md`, update resource paths using
`./images/...`, and check sizing assumptions. Replacing identical paths requires
no registry edit. Run `npm run build` for integration changes and browser-check
affected rendering when possible. Report import validation separately from visual
review and runtime verification. Do not mark all three passed from a successful
crop or build. Report installed paths, any backups, outstanding checks, and the
saved prompt/manifest paths. Do not commit/publish unless requested.
