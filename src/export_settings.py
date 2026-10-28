"""Persistent export destination, independent of appearance and project files."""
import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import Lock


_picker_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="export-folder")
_picker_lock = Lock()
_picker_future = None


def start_directory_picker():
    global _picker_future
    with _picker_lock:
        if _picker_future is None:
            _picker_future = _picker_executor.submit(choose_export_directory)
    return {"pending": True}


def poll_directory_picker():
    global _picker_future
    with _picker_lock:
        if _picker_future is None:
            return {"cancelled": True}
        if not _picker_future.done():
            return {"pending": True}
        future, _picker_future = _picker_future, None
    directory = future.result()
    return {"directory": directory, "cancelled": directory is None}


def settings_path():
    return Path.home() / "AstraPixelArtProjects" / "export-settings.json"


def list_export_directories(value=None):
    directory = Path(value).expanduser() if value else Path.home()
    if not directory.is_absolute() or not directory.is_dir():
        raise ValueError("Укажи полный путь к существующей папке.")
    directory = directory.resolve()
    folders = []
    try:
        for child in directory.iterdir():
            try:
                if child.is_dir():
                    folders.append({"name": child.name, "path": str(child)})
            except OSError:
                continue
    except OSError as error:
        raise ValueError("Нет доступа к содержимому папки. Выбери другую.") from error
    folders.sort(key=lambda item: item["name"].casefold())
    drives = [str(Path(f"{letter}:\\")) for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
              if Path(f"{letter}:\\").is_dir()] if os.name == "nt" else ["/"]
    return {"directory": str(directory), "parent": str(directory.parent),
            "folders": folders, "drives": drives}


def get_export_directory():
    path = settings_path()
    if not path.exists():
        return Path.home() / "Downloads"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        value = data["directory"]
        if not isinstance(value, str) or not Path(value).is_absolute():
            raise ValueError()
        return Path(value)
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ValueError("Не удалось прочитать папку экспорта. Выбери её заново в настройках.") from error


def save_export_directory(value):
    if not isinstance(value, str):
        raise ValueError("Укажи путь к папке экспорта.")
    directory = Path(value.strip()).expanduser() if value.strip() else Path.home() / "Downloads"
    if not directory.is_absolute():
        raise ValueError("Укажи полный путь к папке.")
    directory.mkdir(parents=True, exist_ok=True)
    # Check actual write permission before remembering the destination.
    with tempfile.TemporaryFile(dir=directory):
        pass
    path = settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump({"directory": str(directory)}, output, ensure_ascii=False)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return str(directory)


def choose_export_directory():
    if os.name != "nt":
        raise ValueError("На этой системе укажи путь вручную.")
    script = """
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Astra Pixel Art: export folder'
$dialog.SelectedPath = $env:APA_EXPORT_DIRECTORY
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
try {
    if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        [Console]::Write($dialog.SelectedPath)
    }
} finally { $dialog.Dispose(); $owner.Dispose() }
"""
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-STA", "-EncodedCommand", encoded],
        capture_output=True, timeout=180,
        env={**os.environ, "APA_EXPORT_DIRECTORY": str(get_export_directory())},
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if result.returncode:
        raise ValueError("Не удалось открыть выбор папки. Укажи путь вручную.")
    value = result.stdout.decode("utf-8-sig").strip()
    return save_export_directory(value) if value else None