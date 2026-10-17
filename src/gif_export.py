"""Export visible animation frames as a transparent GIF."""
import base64
import binascii
from io import BytesIO
from pathlib import Path

from PIL import Image


PNG_PREFIX = "data:image/png;base64,"
MAX_FRAMES = 300
MAX_TOTAL_ENCODED = 25_000_000


def save_gif_file(params):
    frames = params.get("frames")
    fps = params.get("fps")

    if not isinstance(frames, list) or not 1 <= len(frames) <= MAX_FRAMES:
        raise ValueError("Для GIF нужно от 1 до 300 кадров.")
    if type(fps) not in (int, float) or not 1 <= fps <= 60:
        raise ValueError("FPS должен быть от 1 до 60.")
    if sum(len(frame) for frame in frames if isinstance(frame, str)) > MAX_TOTAL_ENCODED:
        raise ValueError("Кадры слишком велики для экспорта GIF.")

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
                if source.format != "PNG":
                    raise ValueError("Не PNG")
                if source.width < 1 or source.height < 1 or (
                    source.width > 512 or source.height > 512
                ):
                    raise ValueError("Размер кадра должен быть не больше 512×512.")
                rgba = source.convert("RGBA")
        except (ValueError, binascii.Error, OSError) as error:
            raise ValueError(f"Не удалось прочитать кадр {number}.") from error

        if frame_size is None:
            frame_size = rgba.size
        elif rgba.size != frame_size:
            raise ValueError("Все кадры GIF должны быть одного размера.")

        # GIF умеет только полную прозрачность. Резервируем цвет №0
        # для прозрачных пикселей, остальные 255 — для рисунка.
        colors = rgba.convert("RGB").quantize(
            colors=255, method=Image.Quantize.MEDIANCUT
        )
        alpha = rgba.getchannel("A").tobytes()
        indices = bytes(
            color + 1 if opacity >= 128 else 0
            for color, opacity in zip(colors.tobytes(), alpha)
        )
        gif_frame = Image.frombytes("P", rgba.size, indices)
        palette = (colors.getpalette() or [])[:255 * 3]
        palette += [0] * (255 * 3 - len(palette))
        gif_frame.putpalette([0, 0, 0] + palette)
        gif_frame.info["transparency"] = 0
        gif_frame.info["disposal"] = 2
        result_frames.append(gif_frame)

    downloads = Path.home() / "Downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    duration = max(10, round(1000 / fps / 10) * 10)

    number = 1
    while True:
        name = "astrapixelart.gif" if number == 1 else f"astrapixelart-{number}.gif"
        path = downloads / name
        try:
            with path.open("xb") as output:
                try:
                    result_frames[0].save(
                        output,
                        format="GIF",
                        save_all=True,
                        append_images=result_frames[1:],
                        duration=duration,
                        loop=0,
                        transparency=0,
                        disposal=2,
                        optimize=False,
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