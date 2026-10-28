"""APNG checks: python -m unittest discover -s tests -p test_apng_export.py."""
import base64
from io import BytesIO
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.apng_export import PNG_PREFIX, save_apng_file  # noqa: E402


def png_data(image):
    output = BytesIO()
    image.save(output, format="PNG")
    return PNG_PREFIX + base64.b64encode(output.getvalue()).decode("ascii")


class ApngExportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.home = Path(self.temporary.name)
        home_patch = patch("src.apng_export.Path.home", return_value=self.home)
        home_patch.start()
        self.addCleanup(home_patch.stop)
        self.first = Image.new("RGBA", (4, 4))
        self.first.putpixel((0, 0), (255, 0, 0, 255))
        self.first.putpixel((1, 1), (20, 40, 60, 128))
        self.second = Image.new("RGBA", (4, 4))
        self.second.putpixel((2, 2), (0, 255, 0, 200))

    def export(self, images=None, fps=12):
        if images is None:
            images = [self.first, self.second]
        return save_apng_file({"frames": [png_data(im) for im in images], "fps": fps})

    def test_round_trip_preserves_pixels_transparency_order_and_loop(self):
        result = self.export()
        self.assertEqual(result["frames"], 2)
        self.assertEqual(Path(result["path"]).suffix, ".apng")
        with Image.open(result["path"]) as animation:
            self.assertEqual(animation.format, "PNG")
            self.assertTrue(animation.is_animated)
            self.assertTrue(animation.info["default_image"])
            self.assertEqual(animation.n_frames, 3)
            self.assertEqual(animation.info["loop"], 0)
            for index, expected in enumerate([self.first, self.second]):
                animation.seek(index + 1)
                self.assertEqual(animation.convert("RGBA").tobytes(), expected.tobytes())
                self.assertAlmostEqual(animation.info["duration"], 1000 / 12, delta=0.001)

    def test_single_frame_still_has_apng_control_chunk(self):
        result = self.export([self.first])
        self.assertIn(b"acTL", Path(result["path"]).read_bytes())
        with Image.open(result["path"]) as animation:
            self.assertEqual(animation.n_frames, 2)
            animation.seek(1)
            self.assertEqual(animation.convert("RGBA").tobytes(), self.first.tobytes())

    def test_repeated_and_empty_frames_preserve_appearance_and_total_time(self):
        empty = Image.new("RGBA", (4, 4))
        images = [self.first, self.first, empty, empty, self.second]
        result = self.export(images, fps=60)
        with Image.open(result["path"]) as animation:
            total = 0
            for index in range(1, animation.n_frames):
                animation.seek(index)
                duration = animation.info["duration"]
                expected_index = round(total / (1000 / 60))
                self.assertEqual(animation.convert("RGBA").tobytes(), images[expected_index].tobytes())
                total += duration
            self.assertAlmostEqual(total, len(images) * 1000 / 60, delta=0.01)

    def test_entirely_empty_animation_remains_apng(self):
        empty = Image.new("RGBA", (4, 4))
        result = self.export([empty, empty])
        with Image.open(result["path"]) as animation:
            self.assertTrue(animation.is_animated)
            total = 0
            for index in range(1, animation.n_frames):
                animation.seek(index)
                self.assertEqual(animation.convert("RGBA").tobytes(), empty.tobytes())
                total += animation.info["duration"]
            self.assertAlmostEqual(total, 2000 / 12, delta=0.001)

    def test_existing_export_is_not_overwritten(self):
        first = self.export()
        original = Path(first["path"]).read_bytes()
        second = self.export()
        self.assertNotEqual(first["path"], second["path"])
        self.assertEqual(Path(second["path"]).name, "astrapixelart-2.apng")
        self.assertEqual(Path(first["path"]).read_bytes(), original)

    def test_rejects_invalid_parameters_without_writing_files(self):
        frame = png_data(self.first)
        invalid = [
            {"frames": [], "fps": 12},
            {"frames": [frame] * 301, "fps": 12},
            {"frames": "not a list", "fps": 12},
            *({"frames": [frame], "fps": fps} for fps in
              [None, True, "12", 0, 61, float("nan"), float("inf")]),
            {"frames": [None], "fps": 12},
            {"frames": ["data:image/jpeg;base64,AAAA"], "fps": 12},
            {"frames": [PNG_PREFIX + "!invalid!"], "fps": 12},
            {"frames": [PNG_PREFIX + base64.b64encode(b"not png").decode()], "fps": 12},
            {"frames": [frame, png_data(Image.new("RGBA", (2, 2)))], "fps": 12},
            {"frames": [png_data(Image.new("RGBA", (513, 1)))], "fps": 12},
        ]
        for params in invalid:
            with self.subTest(params=str(params)[:100]):
                with self.assertRaises(ValueError):
                    save_apng_file(params)
        self.assertFalse((self.home / "Downloads").exists())

    def test_rejects_excessive_encoded_data(self):
        with patch("src.apng_export.MAX_TOTAL_ENCODED", 10):
            with self.assertRaises(ValueError):
                self.export()

    def test_failed_save_removes_partial_output(self):
        frame = png_data(self.first)
        with patch.object(Image.Image, "save", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                save_apng_file({"frames": [frame], "fps": 12})
        self.assertEqual(list((self.home / "Downloads").iterdir()), [])


if __name__ == "__main__":
    unittest.main()