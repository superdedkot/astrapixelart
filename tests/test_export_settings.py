"""Export destinations are tested only in temporary directories."""
import base64
import ast
import asyncio
import binascii
from io import BytesIO
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src import export_settings
from src.apng_export import save_apng_file
from src.gif_export import save_gif_file
from src.mp4_export import save_mp4_file
from src.webm_export import save_webm_file


class ExportSettingsTests(unittest.TestCase):
    def test_builtin_folder_browser(self):
        target = self.home / "Рисунки"
        target.mkdir()
        (target / "Кадры").mkdir()
        (target / "image.png").write_bytes(b"test")
        result = export_settings.list_export_directories(str(target))
        self.assertEqual(result["directory"], str(target.resolve()))
        self.assertEqual(result["parent"], str(self.home.resolve()))
        self.assertEqual([item["name"] for item in result["folders"]], ["Кадры"])
        with self.assertRaises(ValueError):
            export_settings.list_export_directories("relative")

    def test_picker_requests_return_without_waiting_for_dialog(self):
        from concurrent.futures import Future
        future = Future()
        with patch.object(export_settings, "_picker_future", None), patch.object(export_settings._picker_executor, "submit", return_value=future) as submit:
            self.assertEqual(export_settings.start_directory_picker(), {"pending": True})
            export_settings.start_directory_picker()
            submit.assert_called_once()
            self.assertEqual(export_settings.poll_directory_picker(), {"pending": True})
            future.set_result("C:\\Exports")
            self.assertEqual(export_settings.poll_directory_picker()["directory"], "C:\\Exports")
            self.assertTrue(export_settings.poll_directory_picker()["cancelled"])
        failed = Future()
        failed.set_exception(ValueError("dialog error"))
        with patch.object(export_settings, "_picker_future", failed):
            with self.assertRaises(ValueError):
                export_settings.poll_directory_picker()
            self.assertIsNone(export_settings._picker_future)

    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        mock = patch("pathlib.Path.home", return_value=self.home)
        mock.start()
        self.addCleanup(mock.stop)

    def test_default_save_reload_reset_and_invalid_path(self):
        self.assertEqual(export_settings.get_export_directory(), self.home / "Downloads")
        target = self.home / "Экспорт рисунков" / "новая папка"
        export_settings.save_export_directory(str(target))
        self.assertTrue(target.is_dir())
        self.assertEqual(export_settings.get_export_directory(), target)
        for value in (None, "relative/path"):
            with self.assertRaises(ValueError):
                export_settings.save_export_directory(value)
        file = self.home / "file.txt"
        file.write_text("keep")
        with self.assertRaises(OSError):
            export_settings.save_export_directory(str(file))
        self.assertEqual(export_settings.get_export_directory(), target)
        export_settings.save_export_directory("")
        self.assertEqual(export_settings.get_export_directory(), self.home / "Downloads")

    def test_all_animation_exports_use_chosen_folder(self):
        target = self.home / "Экспорт"
        export_settings.save_export_directory(str(target))
        buffer = BytesIO()
        Image.new("RGBA", (8, 8), (200, 50, 80, 255)).save(buffer, format="PNG")
        frame = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
        for export in (save_gif_file, save_apng_file, save_mp4_file, save_webm_file):
            with self.subTest(export=export.__name__):
                result = export({"frames": [frame], "fps": 12})
                path = Path(result["path"])
                self.assertEqual(path.parent, target)
                self.assertGreater(path.stat().st_size, 0)
        source = Path(__file__).resolve().parent.parent / "src/plugin.py"
        tree = ast.parse(source.read_text(encoding="utf-8"))
        method = next(node for node in ast.walk(tree) if isinstance(node, ast.AsyncFunctionDef) and node.name == "save_png")
        method.decorator_list = []
        scope = dict(__package__="src", base64=base64, binascii=binascii)
        exec(compile(ast.Module(body=[method], type_ignores=[]), str(source), "exec"), scope)
        result = asyncio.run(scope["save_png"](None, data_url=frame))
        self.assertEqual(Path(result["path"]).parent, target)
        self.assertTrue(Path(result["path"]).is_file())

    def test_picker_cancel_and_unicode_selection(self):
        from types import SimpleNamespace
        with patch.object(export_settings.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=b"")):
            self.assertIsNone(export_settings.choose_export_directory())
            self.assertFalse(export_settings.settings_path().exists())
        target = self.home / "Кадры кота"
        with patch.object(export_settings.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=str(target).encode("utf-8-sig"))):
            self.assertEqual(export_settings.choose_export_directory(), str(target))
        self.assertEqual(export_settings.get_export_directory(), target)


if __name__ == "__main__":
    unittest.main()