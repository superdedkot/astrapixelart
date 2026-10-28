"""Export visible animation frames as a lossless, transparent APNG."""
import base64
import binascii
from io import BytesIO
from pathlib import Path

from PIL import Image


PNG_PREFIX = "data:image/png;base64,"
MAX_FRAMES = 300
MAX_TOTAL_ENCODED = 25_000_000


def save_apng_file(params):
    frames = params.get("frames")
    fps = params.get("fps")

    if not isinstance(frames, list) or not 1 <= len(frames) <= MAX_FRAMES:
        raise ValueError("Для APNG нужно от 1 до 300 кадров.")
    if type(fps) not in (int, float) or not 1 <= fps <= 60:
        raise ValueError("FPS должен быть от 1 до 60.")
    if sum(len(frame) for frame in frames if isinstance(frame, str)) > MAX_TOTAL_ENCODED:
        raise ValueError("Кадры слишком велики для экспорта APNG.")

    result_frames = []
    frame_size = None
    for number, data_url in enumerate(frames, 1):
        if not isinstance(data_url, str) or not data_url.startswith(PNG_PREFIX):
            raise ValueError(f"Кадр {number}: ожидается PNG.")
        try:
            raw = base64.b64decode(data_url[len(PNG_PREFIX):], validate=True)
            if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Не PNG")
            with Image.open(BytesIO(raw)) as source:
                if source.format != "PNG" or getattr(source, "is_animated", False):
                    raise ValueError("Ожидается отдельный кадр PNG")
                if not 1 <= source.width <= 512 or not 1 <= source.height <= 512:
                    raise ValueError("Размер кадра должен быть не больше 512×512.")
                rgba = source.convert("RGBA")
        except (ValueError, binascii.Error, OSError) as error:
            raise ValueError(f"Не удалось прочитать кадр {number}.") from error

        if frame_size is None:
            frame_size = rgba.size
        elif rgba.size != frame_size:
            raise ValueError("Все кадры APNG должны быть одного размера.")
        result_frames.append(rgba)

    from .export_settings import get_export_directory
    downloads = get_export_directory()
    downloads.mkdir(parents=True, exist_ok=True)
    duration = 1000 / fps

    number = 1
    while True:
        name = "astrapixelart.apng" if number == 1 else f"astrapixelart-{number}.apng"
        path = downloads / name
        try:
            with path.open("xb") as output:
                try:
                    result_frames[0].save(
                        output,
                        format="PNG",
                        save_all=True,
                        append_images=result_frames,
                        duration=duration,
                        loop=0,
                        # A separate fallback image keeps even a single or
                        # entirely empty animation in APNG format. It is not
                        # part of playback and adds no delay.
                        default_image=True,
                        # Clear each frame and replace pixels, including alpha.
                        # This prevents trails and accumulating translucency.
                        disposal=1,
                        blend=0,
                    )
                except Exception:
                    output.close()
                    path.unlink(missing_ok=True)
                    raise
            break
        except FileExistsError:
            number += 1

    return {
        "path": str(path),
        "frames": len(result_frames),
        "duration_ms": duration,
    }