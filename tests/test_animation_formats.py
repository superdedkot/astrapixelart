"""Validate saving layouts without importing the plugin or using real storage."""
import ast
import asyncio
import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory
import unittest


class AnimationFormatTests(unittest.TestCase):
    def setUp(self):
        source = Path(__file__).resolve().parent.parent / "src" / "plugin.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        method = next(node for node in ast.walk(tree)
                      if isinstance(node, ast.AsyncFunctionDef) and node.name == "save_animation")
        method.decorator_list = []
        module = ast.Module(body=[method], type_ignores=[])
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        scope = {
            "json": json, "VALID_ID": re.compile(r"^[0-9a-f]{32}$"),
            "MAX_PROJECT_BYTES": 1000000, "PROJECTS_DIR": self.directory,
            "write_text_atomic": lambda path, text: path.write_text(text, encoding="utf-8"),
        }
        exec(compile(module, str(source), "exec"), scope)
        self.save = scope["save_animation"]

    def test_fixed_and_custom_layouts_round_trip(self):
        for layout, count in [(9, 9), (16, 16), (20, 20), (21, 21), ("custom", 7), ("custom", 13)]:
            with self.subTest(layout=layout, count=count):
                animation = {
                    "id": "a" * 32, "size": 8, "format": layout,
                    "frames": [{"layers": [{"data": "data:image/png;base64,fixture"}]}]
                              * count,
                }
                asyncio.run(self.save(None, animation=animation))
                saved = json.loads((self.directory / f"animation-{'a' * 32}.json").read_text())
                self.assertEqual(saved["format"], layout)
                self.assertEqual(len(saved["frames"]), count)

    def test_fixed_layout_rejects_wrong_count(self):
        for layout in [9, 16, 20, 21]:
            with self.subTest(layout=layout), self.assertRaises(ValueError):
                asyncio.run(self.save(None, animation={
                    "id": "a" * 32, "size": 8, "format": layout, "frames": [{}] * 7,
                }))