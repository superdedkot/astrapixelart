"""Astra Pixel Art."""

import base64
import binascii
import json
import os
import re
import uuid
from dataclasses import replace
from pathlib import Path

from astra_plugin_sdk import Plugin, ui_call, ui_page


PROJECTS_DIR = Path.home() / "AstraPixelArtProjects"
ACTIVE_FILE = PROJECTS_DIR / "active.txt"
VALID_ID = re.compile(r"^[0-9a-f]{32}$")
MAX_PROJECT_BYTES = 30_000_000


def project_path(project_id):
    if not isinstance(project_id, str) or not VALID_ID.fullmatch(project_id):
        raise ValueError("Неверный номер проекта.")
    return PROJECTS_DIR / f"{project_id}.json"


def write_text_atomic(path, text):
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, path)


@ui_page("main", "Astra Pixel Art", "index.html")
class Astrapixelart(Plugin):
    """Редактор пиксель-арта."""

    @ui_call
    async def export_gif(self, **params):
        from .gif_export import save_gif_file
        return save_gif_file(params)

    @ui_call
    async def export_mp4(self, **params):
        from .mp4_export import save_mp4_file
        return save_mp4_file(params)

    @ui_call
    async def export_webm(self, **params):
        from .webm_export import save_webm_file
        return save_webm_file(params)

    @ui_call
    async def save_png(self, **params):
        data_url = params.get("data_url", "")
        prefix = "data:image/png;base64,"

        if not isinstance(data_url, str) or not data_url.startswith(prefix):
            raise ValueError("Не получены данные PNG.")

        encoded = data_url[len(prefix):]
        if len(encoded) > 2_000_000:
            raise ValueError("PNG слишком большой.")

        try:
            png = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error) as error:
            raise ValueError("Данные PNG повреждены.") from error

        if not png.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Полученные данные не являются PNG.")

        downloads = Path.home() / "Downloads"
        downloads.mkdir(parents=True, exist_ok=True)

        number = 1
        while True:
            filename = (
                "astrapixelart.png"
                if number == 1
                else f"astrapixelart-{number}.png"
            )
            path = downloads / filename

            try:
                with path.open("xb") as file:
                    file.write(png)
                break
            except FileExistsError:
                number += 1

        return {"path": str(path)}

    @ui_call
    async def save_project(self, **params):
        project = params.get("project")

        if not isinstance(project, dict):
            raise ValueError("Не получены данные проекта.")

        project_id = project.get("id")
        path = project_path(project_id)
        size = project.get("size")
        layers = project.get("layers")
        colors = project.get("usedColors")

        if size not in (8, 16, 32, 64, 128, 256, 512):
            raise ValueError("Недопустимый размер холста.")
        if not isinstance(layers, list) or not 1 <= len(layers) <= 20:
            raise ValueError("Допускается от 1 до 20 слоёв.")
        if not isinstance(colors, list) or len(colors) > 45:
            raise ValueError("Неверная палитра проекта.")

        for layer in layers:
            if not isinstance(layer, dict):
                raise ValueError("Повреждён слой.")
            data = layer.get("data", "")
            if not isinstance(data, str) or not data.startswith(
                "data:image/png;base64,"
            ):
                raise ValueError("Повреждено изображение слоя.")

        text = json.dumps(project, ensure_ascii=False)
        if len(text.encode("utf-8")) > MAX_PROJECT_BYTES:
            raise ValueError("Проект слишком большой для сохранения.")

        write_text_atomic(path, text)
        write_text_atomic(ACTIVE_FILE, project_id)

        return {"ok": True, "id": project_id}

    @ui_call
    async def save_animation(self, **params):
        animation = params.get("animation")
        if not isinstance(animation, dict):
            raise ValueError("Не получены данные анимации.")
        animation_id = animation.get("id")
        if not isinstance(animation_id, str) or not VALID_ID.fullmatch(animation_id):
            raise ValueError("Неверный номер анимации.")
        size = animation.get("size")
        frames = animation.get("frames")
        layout = animation.get("format")
        fixed = {2, 4, 6, 8, 10, 12, 15}
        if size not in (8, 16, 32, 64, 128, 256, 512):
            raise ValueError("Недопустимый размер кадра.")
        if layout not in fixed and layout != "custom":
            raise ValueError("Недопустимый формат анимации.")
        if not isinstance(frames, list) or not 1 <= len(frames) <= 300:
            raise ValueError("Допускается от 1 до 300 кадров.")
        if layout in fixed and len(frames) != layout:
            raise ValueError("Число кадров не соответствует формату.")
        for frame in frames:
            if not isinstance(frame, dict):
                raise ValueError("Повреждён кадр.")
            layers = frame.get("layers")
            if not isinstance(layers, list) or not 1 <= len(layers) <= 20:
                raise ValueError("В кадре должно быть от 1 до 20 слоёв.")
            for layer in layers:
                if not isinstance(layer, dict) or not isinstance(layer.get("data"), str):
                    raise ValueError("Повреждён слой кадра.")
                if not layer["data"].startswith("data:image/png;base64,"):
                    raise ValueError("Неверное изображение слоя кадра.")
        text = json.dumps(animation, ensure_ascii=False)
        if len(text.encode("utf-8")) > MAX_PROJECT_BYTES:
            raise ValueError("Анимация слишком большая для сохранения.")
        path = PROJECTS_DIR / f"animation-{animation_id}.json"
        write_text_atomic(path, text)
        return {"ok": True, "id": animation_id}

    @ui_call
    async def load_animation(self, **params):
        animation_id = params.get("id")
        if not isinstance(animation_id, str) or not VALID_ID.fullmatch(animation_id):
            raise ValueError("Неверный номер анимации.")
        path = PROJECTS_DIR / f"animation-{animation_id}.json"
        if not path.is_file():
            raise ValueError("Анимация не найдена.")
        if path.stat().st_size > MAX_PROJECT_BYTES:
            raise ValueError("Файл анимации слишком большой.")
        return {"animation": json.loads(path.read_text(encoding="utf-8"))}

    @ui_call
    async def list_animations(self, **params):
        PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
        items = []
        for path in PROJECTS_DIR.glob("animation-*.json"):
            animation_id = path.stem.removeprefix("animation-")
            if not VALID_ID.fullmatch(animation_id):
                continue
            try:
                if path.stat().st_size > MAX_PROJECT_BYTES:
                    continue
                data = json.loads(path.read_text(encoding="utf-8"))
                items.append({
                    "id": animation_id,
                    "name": str(data.get("name", "Без названия"))[:80],
                    "size": data.get("size"),
                    "frames": len(data.get("frames", [])),
                    "updated": path.stat().st_mtime,
                })
            except (OSError, ValueError, TypeError):
                continue
        items.sort(key=lambda item: item["updated"], reverse=True)
        return {"animations": items}
    @ui_call
    async def rename_saved_item(self, **params):
        kind = params.get("kind")
        item_id = params.get("id")
        name = params.get("name")
        if kind not in ("project", "animation"):
            raise ValueError("Неизвестный вид работы.")
        if not isinstance(item_id, str) or not VALID_ID.fullmatch(item_id):
            raise ValueError("Неверный номер работы.")
        if not isinstance(name, str):
            raise ValueError("Укажи название.")
        name = name.strip()
        if not name or len(name) > 80 or any(ord(char) < 32 for char in name):
            raise ValueError("Название должно содержать от 1 до 80 символов.")

        path = (
            project_path(item_id) if kind == "project"
            else PROJECTS_DIR / f"animation-{item_id}.json"
        )
        if not path.is_file():
            raise ValueError("Работа не найдена.")
        if path.stat().st_size > MAX_PROJECT_BYTES:
            raise ValueError("Файл слишком большой.")

        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("id") != item_id:
            raise ValueError("Файл работы повреждён.")
        data["name"] = name
        text = json.dumps(data, ensure_ascii=False)
        if len(text.encode("utf-8")) > MAX_PROJECT_BYTES:
            raise ValueError("Файл слишком большой.")
        write_text_atomic(path, text)
        return {"ok": True, "id": item_id, "name": name}
    @ui_call
    async def delete_saved_item(self, **params):
        kind = params.get("kind")
        item_id = params.get("id")
        if kind not in ("project", "animation"):
            raise ValueError("Неизвестный вид работы.")
        if not isinstance(item_id, str) or not VALID_ID.fullmatch(item_id):
            raise ValueError("Неверный номер работы.")

        if kind == "project":
            path = project_path(item_id)
            try:
                active_id = ACTIVE_FILE.read_text(encoding="utf-8").strip()
            except OSError:
                active_id = ""
            if active_id == item_id:
                raise ValueError("Сначала открой другой Art-проект.")
        else:
            path = PROJECTS_DIR / f"animation-{item_id}.json"

        if not path.is_file():
            raise ValueError("Работа не найдена.")

        trash = PROJECTS_DIR / ".trash"
        trash.mkdir(parents=True, exist_ok=True)
        destination = trash / f"{path.stem}-{uuid.uuid4().hex}.json"
        os.replace(path, destination)
        return {"ok": True}

    @ui_call
    async def list_projects(self, **params):
        PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
        items = []

        for path in PROJECTS_DIR.glob("*.json"):
            if not VALID_ID.fullmatch(path.stem):
                continue

            try:
                with path.open("r", encoding="utf-8") as file:
                    project = json.load(file)

                items.append({
                    "id": path.stem,
                    "name": str(project.get("name", "Без названия"))[:80],
                    "size": project.get("size", 64),
                    "updated": path.stat().st_mtime,
                })
            except (OSError, ValueError, TypeError):
                continue

        items.sort(key=lambda item: item["updated"], reverse=True)

        active_id = ""
        try:
            active_id = ACTIVE_FILE.read_text(encoding="utf-8").strip()
        except OSError:
            pass

        return {"projects": items, "activeId": active_id}

    @ui_call
    async def load_project(self, **params):
        project_id = params.get("id")
        path = project_path(project_id)

        if not path.is_file():
            raise ValueError("Проект не найден.")

        if path.stat().st_size > MAX_PROJECT_BYTES:
            raise ValueError("Файл проекта слишком большой.")

        project = json.loads(path.read_text(encoding="utf-8"))
        return {"project": project}


# @ui_page добавляет вкладку в этот список. Включаем прозрачность
# у созданной вкладки, не меняя обработчики сохранения и проектов.
Astrapixelart._astra_ui_contributions[0] = replace(
    Astrapixelart._astra_ui_contributions[0],
    transparent=True,
)


if __name__ == "__main__":
    Astrapixelart().run()