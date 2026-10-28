"""Export visible PNG frames to an MP4 with a white background."""
import base64
import binascii
import os
import subprocess
import tempfile
import uuid
from io import BytesIO
from pathlib import Path


PNG_PREFIX = "data:image/png;base64,"
MAX_FRAMES = 300
MAX_ENCODED = 25_000_000


def save_mp4_file(params):
    # Import only when exporting: a missing dependency must not stop
    # the rest of the plugin from starting.
    from PIL import Image
    import imageio_ffmpeg

    frames = params.get("frames")
    fps = params.get("fps")
    if not isinstance(frames, list) or not 1 <= len(frames) <= MAX_FRAMES:
        raise ValueError("Для MP4 нужно от 1 до 300 кадров.")
    if type(fps) not in (int, float) or not 1 <= fps <= 60:
        raise ValueError("FPS должен быть от 1 до 60.")

    total = 0
    size = None
    raw_frames = []
    for number, data_url in enumerate(frames, 1):
        if not isinstance(data_url, str) or not data_url.startswith(PNG_PREFIX):
            raise ValueError(f"Кадр {number}: ожидается PNG.")
        total += len(data_url)
        if total > MAX_ENCODED:
            raise ValueError("Кадры слишком велики для экспорта MP4.")

        try:
            raw = base64.b64decode(
                data_url[len(PNG_PREFIX):], validate=True
            )
            if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("Не PNG")
            with Image.open(BytesIO(raw)) as source:
                if source.format != "PNG" or not (
                    1 <= source.width <= 512 and
                    1 <= source.height <= 512
                ):
                    raise ValueError("Неверный формат или размер")
                rgba = source.convert("RGBA")
        except (ValueError, binascii.Error, OSError) as error:
            raise ValueError(f"Не удалось прочитать кадр {number}.") from error

        if size is None:
            size = rgba.size
        elif rgba.size != size:
            raise ValueError("Все кадры должны быть одного размера.")

        white = Image.new("RGBA", size, (255, 255, 255, 255))
        white.alpha_composite(rgba)
        raw_frames.append(white.convert("RGB").tobytes())

    from .export_settings import get_export_directory
    downloads = get_export_directory()
    downloads.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix="astrapixelart-mp4-", suffix=".mp4", dir=downloads
    )
    os.close(descriptor)
    temporary = Path(temporary)
    destination = downloads / f"astrapixelart-{uuid.uuid4().hex[:12]}.mp4"

    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pixel_format", "rgb24",
        "-video_size", f"{size[0]}x{size[1]}",
        "-framerate", str(fps), "-i", "pipe:0",
        "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
        "-movflags", "+faststart", str(temporary),
    ]

    try:
        with tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(
                command, stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL, stderr=errors
            )
            try:
                for frame in raw_frames:
                    process.stdin.write(frame)
                process.stdin.close()
                result = process.wait(timeout=180)
            except Exception:
                process.kill()
                process.wait()
                raise

            if result != 0:
                errors.seek(0)
                detail = errors.read(500).decode("utf-8", "replace").strip()
                raise ValueError(f"FFmpeg не создал MP4: {detail}")

        if temporary.stat().st_size == 0:
            raise ValueError("Получился пустой MP4.")
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)

    return {
        "path": str(destination),
        "frames": len(frames),
        "fps": fps,
        "width": size[0],
        "height": size[1],
    }