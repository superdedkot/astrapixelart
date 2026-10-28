"""Read-only library checks, using only a temporary fixture."""
import base64
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.astra_library import list_library, preview_clip, safe_asset


class AstraLibraryTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.pack = self.directory / "pack"
        self.pack.mkdir()
        self.png = b"\x89PNG\r\n\x1a\nfixture"
        (self.pack / "dance.png").write_bytes(self.png)
        self.data = {"schema": 1, "active_id": "copy", "characters": [
            {"id": "original", "name": "Original", "kind": "pixel", "is_builtin": True, "animset": "builtin"},
            {"id": "copy", "name": "Copy", "kind": "pixel", "animset": "edited"},
            {"id": "vrm", "kind": "vrm"}], "animsets": [
                {"id": "builtin", "clips": [{"name": "idle", "file": "builtin:nayu/idle.png"}]},
                {"id": "edited", "dir": str(self.pack), "sprite": {"frame": 64, "fps_milli": 10000},
                 "clips": [{"name": "dance", "file": "dance.png", "fps_milli": 5800, "speed_pct": 50}],
                 "overlay_clips": [{"name": "rain", "file": "builtin:rain.png"}]}]}
        self.write_index()

    def write_index(self):
        (self.directory / "library.json").write_text(json.dumps(self.data), encoding="utf-8")

    def test_two_pixel_profiles_and_active_copy(self):
        result = list_library(self.directory)
        self.assertEqual([p["id"] for p in result["profiles"]], ["original", "copy"])
        self.assertTrue(result["profiles"][1]["active"])
        self.assertEqual(result["profiles"][1]["clips"][0]["fps"], 5.8)
        self.assertTrue(result["profiles"][1]["clips"][1]["overlay"])

    def test_local_preview_and_no_writes(self):
        before = {p: p.read_bytes() for p in self.directory.rglob("*") if p.is_file()}
        result = preview_clip("copy", "edited|clips|0", self.directory)
        self.assertTrue(result["available"])
        self.assertEqual(base64.b64decode(result["dataUrl"].split(",")[1]), self.png)
        self.assertEqual(result["fps"], 2.9)
        self.assertEqual(before, {p: p.read_bytes() for p in self.directory.rglob("*") if p.is_file()})

    def test_builtin_is_explicitly_unavailable(self):
        self.assertFalse(preview_clip("original", "builtin|clips|0", self.directory)["available"])

    def test_detached_pixel_pack_can_be_previewed_without_changing_profile(self):
        self.data["animsets"].append({"id": "detached", "kind": "pixel", "dir": str(self.pack),
                                      "sprite": {"frame": 64},
                                      "clips": [{"name": "idle", "file": "dance.png"}]})
        self.write_index()
        before = (self.directory / "library.json").read_bytes()
        result = list_library(self.directory)
        self.assertEqual([p["id"] for p in result["packs"]], ["detached"])
        self.assertTrue(preview_clip("original", "detached|clips|0", self.directory,
                                     pack_id="detached")["available"])
        self.assertEqual(before, (self.directory / "library.json").read_bytes())
        for pack_id in ("missing", "edited"):
            with self.assertRaises(ValueError):
                preview_clip("original", "detached|clips|0", self.directory, pack_id=pack_id)

    def test_invalid_profile_and_clip(self):
        for profile, clip in [("vrm", "edited|clips|0"), ("copy", "../dance.png")]:
            with self.assertRaises(ValueError):
                preview_clip(profile, clip, self.directory)

    def test_paths_cannot_escape(self):
        for name in ("../outside.png", "C:/outside.png", "\\outside.png", "builtin:idle.png", "dance.txt"):
            self.assertIsNone(safe_asset(self.pack, name))

    def test_bad_png(self):
        (self.pack / "dance.png").write_bytes(b"not a PNG")
        with self.assertRaises(ValueError):
            preview_clip("copy", "edited|clips|0", self.directory)

    def builtin_fixture(self, container=".trash/animpacks"):
        self.data["animsets"] += [
            {"id": "builtin:nayu-2d-anims", "kind": "pixel", "sprite": {"frame": 64},
             "clips": [{"name": "idle", "file": "clips/idle.png"}]},
            {"id": "reference", "kind": "pixel", "sprite": {"frame": 64},
             "clips": [{"name": "idle", "file": "builtin:nayu-2d-anims/idle.png"}]},
        ]
        folder = self.directory / "pack" / container / "builtin-nayu-2d-anims-copy-2-123"
        (folder / "clips").mkdir(parents=True)
        (folder / "clips" / "idle.png").write_bytes(self.png)
        (folder / "animpack.toml").write_text(
            '[animpack]\nkind="pixel"\n[sprite]\nframe=64\n'
            '[[clips]]\nname="idle"\nfile="clips/idle.png"\n', encoding="utf-8")
        self.write_index()
        return folder

    def test_builtin_reference_reads_archived_png_without_writes(self):
        for container in ["animpacks", ".trash/animpacks", ".pre-migration-123/animsets"]:
            with self.subTest(container=container):
                self.builtin_fixture(container)
                before = {p: p.read_bytes() for p in self.directory.rglob("*") if p.is_file()}
                for pack in ["reference", "builtin:nayu-2d-anims"]:
                    result = preview_clip("copy", f"{pack}|clips|0", self.directory, pack_id=pack)
                    self.assertTrue(result["available"])
                    self.assertEqual(base64.b64decode(result["dataUrl"].split(",")[1]), self.png)
                    self.assertIn("сохранённая версия", result["source"])
                self.assertEqual(before, {p: p.read_bytes() for p in self.directory.rglob("*") if p.is_file()})

    def test_fallback_requires_matching_metadata_and_safe_path(self):
        folder = self.builtin_fixture()
        for content in [
            '[animpack]\nkind="vrm"\n[[clips]]\nname="idle"\nfile="clips/idle.png"',
            '[animpack]\nkind="pixel"\n[sprite]\nframe=128\n[[clips]]\nname="idle"\nfile="clips/idle.png"',
            '[animpack]\nkind="pixel"\n[[clips]]\nname="different"\nfile="clips/idle.png"',
            '[animpack]\nkind="pixel"\n[[clips]]\nname="idle"\nfile="../idle.png"',
            'invalid toml',
        ]:
            (folder / "animpack.toml").write_text(content, encoding="utf-8")
            self.assertFalse(preview_clip("copy", "reference|clips|0", self.directory,
                                          pack_id="reference")["available"])

    def test_direct_local_image_wins_over_archive(self):
        self.builtin_fixture()
        pack = next(item for item in self.data["animsets"] if item["id"] == "builtin:nayu-2d-anims")
        pack["dir"] = str(self.pack)
        (self.pack / "clips").mkdir()
        direct = self.png + b"edited"
        (self.pack / "clips" / "idle.png").write_bytes(direct)
        self.write_index()
        result = preview_clip("copy", "builtin:nayu-2d-anims|clips|0", self.directory,
                              pack_id="builtin:nayu-2d-anims")
        self.assertEqual(base64.b64decode(result["dataUrl"].split(",")[1]), direct)
        self.assertIn("Локальный PNG", result["source"])

    def test_missing_and_unsupported_index(self):
        self.data["schema"] = 99
        self.write_index()
        with self.assertRaises(ValueError):
            list_library(self.directory)
        (self.directory / "library.json").unlink()
        with self.assertRaises(ValueError):
            list_library(self.directory)


if __name__ == "__main__":
    unittest.main()