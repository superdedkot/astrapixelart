"""Experimental, read-only view of Astra's local companion library index."""

import base64
import json
import os
import tomllib
from pathlib import Path


MAX_INDEX_BYTES = 16 * 1024 * 1024
MAX_IMAGE_BYTES = 20 * 1024 * 1024


def companion_directory():
    return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "astra" / "astra" / "config" / "companion"


def read_index(directory):
    path = directory / "library.json"
    if not path.is_file():
        raise ValueError("Индекс библиотеки Astra не найден. Откройте раздел моделей Astra и повторите обновление.")
    if path.stat().st_size > MAX_INDEX_BYTES:
        raise ValueError("Индекс библиотеки слишком большой.")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("schema") != 1:
        raise ValueError("Версия индекса Astra пока не поддерживается.")
    return data


def pixel_character(data, character_id):
    return next((item for item in data.get("characters", [])
                 if item.get("kind") == "pixel" and item.get("id") == character_id), None)


def character_clips(data, character, pack_id=None):
    packs = ([{"id": pack_id}] if pack_id else
             character.get("packs", {}).get("effective") or [{"id": character.get("animset")}])
    result = []
    for reference in packs:
        pack = next((p for p in data.get("animsets", []) if p.get("id") == reference.get("id")), None)
        if not pack:
            continue
        if pack_id and pack.get("kind") != "pixel":
            continue
        for group, settings in (("clips", "sprite"), ("overlay_clips", "overlay")):
            for index, clip in enumerate(pack.get(group, [])):
                result.append((pack, group, index, clip, pack.get(settings, {})))
    return result


def list_library(directory=None):
    directory = Path(directory) if directory is not None else companion_directory()
    data = read_index(directory)
    profiles = []
    for character in data.get("characters", []):
        if character.get("kind") != "pixel":
            continue
        clips = []
        for pack, group, index, clip, settings in character_clips(data, character):
            clips.append({
                "key": f"{pack['id']}|{group}|{index}",
                "name": clip.get("name", "Без названия"),
                "file": clip.get("file", ""),
                "pack": pack.get("name", pack["id"]),
                "overlay": group == "overlay_clips",
                "fps": clip.get("fps_milli", settings.get("fps_milli", 10000)) / 1000,
                "frame": settings.get("frame", 64),
            })
        profiles.append({"id": character["id"], "name": character.get("name", character["id"]),
                         "builtin": bool(character.get("is_builtin")),
                         "active": character["id"] == data.get("active_id"), "clips": clips})
    packs = []
    for pack in data.get("animsets", []):
        if pack.get("kind") != "pixel":
            continue
        character = {"animset": pack["id"]}
        entries = []
        for current, group, index, clip, settings in character_clips(data, character):
            entries.append({"key": f"{current['id']}|{group}|{index}",
                            "name": clip.get("name", "Без названия"),
                            "overlay": group == "overlay_clips",
                            "fps": clip.get("fps_milli", settings.get("fps_milli", 10000)) / 1000})
        packs.append({"id": pack["id"], "name": pack.get("name", pack["id"]), "clips": entries})
    return {"profiles": profiles, "packs": packs, "source": str(directory / "library.json"),
            "notice": "Экспериментальный просмотр локального индекса. Файлы Astra не изменяются. Встроенные PNG могут быть недоступны."}


def safe_asset(base, relative):
    if not isinstance(relative, str) or not relative or ":" in relative or "\\" in relative:
        return None
    base = Path(base).resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base) or target.suffix.lower() != ".png":
        return None
    return target if target.is_file() else None


def find_builtin_copy(directory, data, pack, group, clip, settings):
    """Read matching materialized assets; never modify or restore Astra packages."""
    reference = clip.get("file", "")
    if reference.startswith("builtin:"):
        namespace, separator, filename = reference[len("builtin:"):].partition("/")
        if not separator:
            return None
    elif str(pack.get("id", "")).startswith("builtin:"):
        namespace = pack["id"][len("builtin:"):]
        filename = Path(reference).name
    else:
        return None
    original = next((item for item in data.get("animsets", [])
                     if item.get("id") == f"builtin:{namespace}" and item.get("kind") == "pixel"), None)
    if original is None or "/" in filename or "\\" in filename or ":" in filename:
        return None
    original_clip = next((item for item in original.get(group, [])
                          if item.get("name") == clip.get("name") and
                          Path(item.get("file", "")).name == filename), None)
    if original_clip is None:
        return None
    root = Path(directory) / "pack"
    # Active materializations outrank archived/deleted copies. Bound discovery to
    # immediate package folders, not arbitrary recursive filesystem searches.
    containers = [(root / "animpacks", "Локальная копия")]
    containers += [(path / "animsets", "Резервная копия до миграции")
                   for path in sorted(root.glob(".pre-migration-*")) if path.is_dir()]
    containers.append((root / ".trash" / "animpacks", "Копия из корзины Astra"))
    settings_key = "overlay" if group == "overlay_clips" else "sprite"
    for container, label in containers:
        if not container.is_dir():
            continue
        for folder in sorted(container.iterdir()):
            if not folder.name.startswith(f"builtin-{namespace}-copy"):
                continue
            if not folder.is_dir() or not folder.resolve().is_relative_to(root.resolve()):
                continue
            manifest = folder / "animpack.toml"
            if not manifest.is_file() or manifest.stat().st_size > MAX_INDEX_BYTES:
                continue
            try:
                candidate = tomllib.loads(manifest.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
            if candidate.get("animpack", {}).get("kind") != "pixel":
                continue
            if candidate.get(settings_key, {}).get("frame", 64) != settings.get("frame", 64):
                continue
            for entry in candidate.get(group, []):
                relative = entry.get("file", "")
                if entry.get("name") != clip.get("name") or Path(relative).name != filename:
                    continue
                asset = safe_asset(folder, relative)
                if asset:
                    return asset, f"{label}: {asset}. Это сохранённая версия, она может отличаться от встроенной."
    return None


def preview_clip(character_id, clip_key, directory=None, pack_id=None):
    directory = Path(directory) if directory is not None else companion_directory()
    data = read_index(directory)
    character = pixel_character(data, character_id)
    if not character:
        raise ValueError("2D-профиль не найден. Обновите список.")
    entry = next((item for item in character_clips(data, character, pack_id)
                  if f"{item[0]['id']}|{item[1]}|{item[2]}" == clip_key), None)
    if entry is None:
        raise ValueError("Анимация не найдена. Обновите список.")
    pack, group, index, clip, settings = entry
    relative = clip.get("file", "")
    # Only paths named by the index, never arbitrary paths from the UI.
    asset = None
    source = ""
    for base in ((pack.get("dir"),) if pack_id else (character.get("dir"), pack.get("dir"))):
        if base:
            asset = safe_asset(base, relative)
            if asset:
                break
    if asset is not None:
        source = f"Локальный PNG: {asset}"
    else:
        fallback = find_builtin_copy(directory, data, pack, group, clip, settings)
        if fallback:
            asset, source = fallback
    if asset is None:
        return {"available": False, "message": "Изображение встроено в Astra или отсутствует на диске. Выберите выше пакет с локальной копией PNG: копия профиля может всё ещё ссылаться на встроенный пакет. Воспроизведение и копирование доступны после загрузки изображения."}
    if asset.stat().st_size > MAX_IMAGE_BYTES:
        raise ValueError("PNG больше 20 МБ.")
    content = asset.read_bytes()
    if len(content) > MAX_IMAGE_BYTES or not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Неподходящий PNG.")
    return {"available": True, "source": source, "dataUrl": "data:image/png;base64," + base64.b64encode(content).decode("ascii"),
            "frame": settings.get("frame", 64),
            "fps": clip.get("fps_milli", settings.get("fps_milli", 10000)) / 1000 * clip.get("speed_pct", 100) / 100,
            "loops": clip.get("loops", True)}