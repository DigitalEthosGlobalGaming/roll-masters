"""Exercise importer invariants with newly created synthetic images only."""

import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from import_assets import ImportFailure, import_assets


class ImportTests(unittest.TestCase):
    def setUp(self):
        test_root = Path(__file__).resolve().parents[4] / "tmp/game-assets"
        test_root.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="import-test-", dir=test_root)
        # Verify recursive cleanup stays under this workspace's scratch directory.
        self.assertTrue(Path(self.temp.name).resolve().is_relative_to(test_root.resolve()))
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.run = self.repo / "tmp" / "run"
        (self.run / "generated").mkdir(parents=True)
        # Two distinct synthetic subjects in transparent cells.
        image = Image.new("RGBA", (16, 8))
        image.paste((180, 100, 20, 255), (2, 2, 6, 6))
        image.paste((70, 100, 150, 255), (10, 2, 14, 6))
        image.save(self.run / "generated" / "atlas.png")
        self.manifest = {
            "version": 1,
            "sources": [{"id": "sheet", "file": "generated/atlas.png", "size": [16, 8]}],
            "assets": [
                {"source": "sheet", "rect": [0, 0, 8, 8], "output": "medieval/first.png", "size": [4, 4]},
                {"source": "sheet", "rect": [8, 0, 8, 8], "output": "medieval/second.png"},
            ],
        }

    def execute(self, **kwargs):
        (self.run / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")
        return import_assets(self.run, self.repo, **kwargs)

    def test_staging_and_install_preserve_transparency_alignment_and_colours(self):
        report = self.execute()
        self.assertFalse(report["applied"])
        self.assertFalse((self.repo / "public").exists())
        with Image.open(self.run / "processed/medieval/first.png") as image:
            self.assertEqual(image.size, (4, 4))
            self.assertEqual(image.getpixel((0, 0))[3], 0)
            self.assertEqual(image.getpixel((1, 1)), (180, 100, 20, 255))
            colours = {image.getpixel((x, y)) for y in range(4) for x in range(4)}
            self.assertEqual(colours, {(0, 0, 0, 0), (180, 100, 20, 255)})
        report = self.execute(apply=True)
        self.assertTrue(report["applied"])
        self.assertEqual((self.repo / "public/images/medieval/second.png").read_bytes(),
                         (self.run / "processed/medieval/second.png").read_bytes())

    def test_collision_preflight_and_byte_backup(self):
        old = self.repo / "public/images/medieval/second.png"
        old.parent.mkdir(parents=True)
        old.write_bytes(b"existing opaque bytes must not be decoded")
        with self.assertRaises(ImportFailure):
            self.execute(apply=True)
        self.assertFalse((self.repo / "public/images/medieval/first.png").exists())
        report = self.execute(apply=True, replace_existing=True)
        backup = Path(report["assets"][1]["backup"])
        self.assertEqual(backup.read_bytes(), b"existing opaque bytes must not be decoded")
        with self.assertRaises(ImportFailure):
            self.execute(apply=True, replace_existing=True)

    def test_bad_geometry_and_names_rejected_without_staging(self):
        mutations = [
            ("rect", [12, 0, 8, 8]), ("rect", [0, 0, 0, 8]),
            ("rect", [-1, 0, 8, 8]), ("size", [4, 3]),
            ("output", "../escape.png"), ("output", "medieval/CON.png"),
            ("output", "medieval/con.png"), ("output", "C:/escape.png"),
            ("output", "medieval/first.png"),
        ]
        original = dict(self.manifest["assets"][1])
        for key, value in mutations:
            with self.subTest(key=key, value=value):
                self.manifest["assets"][1] = {**original, key: value}
                with self.assertRaises(ImportFailure):
                    self.execute()
                self.assertFalse((self.run / "processed").exists())

    def test_overlap_rejected(self):
        self.manifest["assets"][1]["rect"] = [4, 0, 8, 8]
        with self.assertRaisesRegex(ImportFailure, "overlapping"):
            self.execute()

    def test_opaque_empty_clipped_and_wrong_size_sources_rejected(self):
        for variant in ("opaque", "empty", "clipped", "size"):
            with self.subTest(variant=variant):
                image = Image.new("RGBA", (16, 8))
                image.paste((90, 80, 70, 255), (2, 2, 6, 6))
                image.paste((90, 80, 70, 255), (10, 2, 14, 6))
                if variant == "opaque":
                    image.putalpha(255)
                elif variant == "empty":
                    image.putalpha(0)
                elif variant == "clipped":
                    image.putpixel((0, 2), (90, 80, 70, 255))
                else:
                    image = image.resize((8, 8))
                image.save(self.run / "generated/atlas.png")
                with self.assertRaises(ImportFailure):
                    self.execute()

    def test_individual_png_whole_canvas_import(self):
        self.manifest["assets"] = [self.manifest["assets"][0]]
        self.manifest["assets"][0]["rect"] = [0, 0, 16, 8]
        self.manifest["assets"][0]["size"] = [16, 8]
        self.assertEqual(len(self.execute()["assets"]), 1)

    def test_source_must_be_inside_generated(self):
        self.manifest["sources"][0]["file"] = "../../public/images/old.png"
        with self.assertRaises(ImportFailure):
            self.execute()

    def test_symlink_escape_is_rejected(self):
        outside = Path(self.temp.name) / "outside"
        outside.mkdir()
        link = self.run / "generated/link"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("OS does not permit creating symlinks")
        self.manifest["sources"][0]["file"] = "generated/link/stolen.png"
        with self.assertRaises(ImportFailure):
            self.execute()


if __name__ == "__main__":
    unittest.main()
