"""Appearance file persistence in isolated storage and bundled Cyrillic fonts."""
import ast
import asyncio
import json
from pathlib import Path
import re
import struct
from tempfile import TemporaryDirectory
import unittest

ROOT = Path(__file__).resolve().parent.parent


class AppearanceTests(unittest.TestCase):
    def test_file_round_trip_and_validation(self):
        tree = ast.parse((ROOT / "src/plugin.py").read_text(encoding="utf-8"))
        names = {"save_appearance", "load_appearance", "write_text_atomic"}
        methods = [node for node in ast.walk(tree)
                   if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        for method in methods:
            method.decorator_list = []
        import os
        with TemporaryDirectory() as directory:
            scope = dict(PROJECTS_DIR=Path(directory) / "projects", json=json, re=re, os=os)
            exec(compile(ast.Module(body=methods, type_ignores=[]), "appearance", "exec"), scope)
            self.assertIsNone(asyncio.run(scope["load_appearance"](None))["settings"])
            settings = dict(opacity=55, radius=12, blur=7, glass=True, font="pixel", color="#abcdef",
                            panelColor="#411622", controlColor="#ff7775", toggleColor="#cf1c29",
                            secondaryColor="#123456", buttonColor="#abcdef", buttonOpacity=45)
            asyncio.run(scope["save_appearance"](None, settings=settings))
            self.assertEqual(asyncio.run(scope["load_appearance"](None))["settings"], settings)
            for key, value in [("opacity", -1), ("radius", True), ("blur", float("nan")),
                               ("font", "bad"), ("glass", 1), ("color", "red"),
                               ("secondaryColor", "red"), ("buttonColor", "#fff"),
                               ("buttonOpacity", -1), ("buttonOpacity", True),
                               ("buttonOpacity", float("nan"))]:
                with self.subTest(key=key), self.assertRaises(ValueError):
                    asyncio.run(scope["save_appearance"](None, settings={**settings, key: value}))
            self.assertEqual(asyncio.run(scope["load_appearance"](None))["settings"], settings)
            legacy = {key: settings[key] for key in ("opacity", "radius", "blur", "glass", "font", "color")}
            asyncio.run(scope["save_appearance"](None, settings=legacy))
            restored = asyncio.run(scope["load_appearance"](None))["settings"]
            self.assertEqual(restored["secondaryColor"], "#2c2c30")
            self.assertEqual(restored["buttonOpacity"], 8)

    def test_bundled_fonts_have_russian_alphabet(self):
        for name in ("Tiny5.ttf", "Caveat.ttf"):
            data = (ROOT / "ui/fonts" / name).read_bytes()
            u16 = lambda offset: struct.unpack_from(">H", data, offset)[0]
            u32 = lambda offset: struct.unpack_from(">I", data, offset)[0]
            cmap = next(u32(12 + i * 16 + 8) for i in range(u16(4))
                        if data[12 + i * 16:16 + i * 16] == b"cmap")
            tables = [cmap + u32(cmap + 4 + i * 8 + 4) for i in range(u16(cmap + 2))]
            covered = set()
            for table in tables:
                if u16(table) == 4:
                    count = u16(table + 6) // 2
                    ends = table + 14
                    starts = ends + 2 * count + 2
                    deltas = starts + 2 * count
                    offsets = deltas + 2 * count
                    for i in range(count):
                        for code in range(u16(starts + i * 2), u16(ends + i * 2) + 1):
                            offset = u16(offsets + i * 2)
                            glyph = u16(offsets + i * 2 + offset + 2 * (code - u16(starts + i * 2))) if offset else code
                            if glyph or not offset:
                                glyph = (glyph + u16(deltas + i * 2)) & 65535
                            if glyph:
                                covered.add(code)
                elif u16(table) == 12:
                    for i in range(u32(table + 12)):
                        start, end, glyph = struct.unpack_from(">III", data, table + 16 + i * 12)
                        covered.update(range(start + (glyph == 0), end + 1))
            alphabet = set(range(0x410, 0x450)) | {0x401, 0x451}
            self.assertFalse(alphabet - covered, (name, alphabet - covered))


if __name__ == "__main__":
    unittest.main()