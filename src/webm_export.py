"""Export visible frames as a transparent VP9 WebM sticker."""
import base64
import binascii
import os
import subprocess
import tempfile
import uuid
from io import BytesIO
from pathlib import Path


PNG_PREFIX = "data:image/png;base64,"
MAX_ENCODED = 25_000_000
MAX_FILE_BYTES = 256 * 1024


def save_webm_file(params):
    # Import on export, not on plugin startup.
    from PIL import Image
    import imageio_ffmpeg

    frames = params.get("frames")
    fps = params.get("fps")

    if not isinstance(frames, list) or not frames:
        raise ValueError("Нет кадров для экспорта.")
    if type(fps) not in (int, float) or not 1 <= fps <= 30:
        raise ValueError("Для стикера выбери FPS от 1 до 30.")
    if len(frames) / fps > 3:
        raise ValueError("Стикер должен длиться не больше 3 секунд.")

    encoded_total = 0
    source_size = None
    rgba_frames = []

    for number, data_url in enumerate(frames, 1):
        if not isinstance(data_url, str) or not data_url.startswith(PNG_PREFIX):
            raise ValueError(f"Кадр {number}: ожидается PNG.")
        encoded_total += len(data_url)
        if encoded_total > MAX_ENCODED:
            raise ValueError("Кадры слишком велики для экспорта.")

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
                    raise ValueError("Недопустимый размер PNG.")
                rgba = source.convert("RGBA")
        except (ValueError, binascii.Error, OSError) as error:
            raise ValueError(
                f"Не удалось прочитать кадр {number}."
            ) from error

        if source_size is None:
            source_size = rgba.size
        elif rgba.size != source_size:
            raise ValueError("Все кадры должны быть одного размера.")

        # У нас квадратные холсты. Увеличиваем пиксели без сглаживания.
        if rgba.size != (512, 512):
            rgba = rgba.resize((512, 512), Image.Resampling.NEAREST)
        rgba_frames.append(rgba.tobytes())

    downloads = Path.home() / "Downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix="astrapixelart-webm-", suffix=".webm", dir=downloads
    )
    os.close(descriptor)
    temporary = Path(temporary_name)

    command = [
        imageio_ffmpeg.get_ffmpeg_exe(),
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pixel_format", "rgba",
        "-video_size", "512x512",
        "-framerate", str(fps), "-i", "pipe:0",
        "-an", "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-auto-alt-ref", "0",
        "-b:v", "0", "-crf", "36",
        "-deadline", "good", "-cpu-used", "4",
        str(temporary),
    ]

    try:
        with tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=errors,
            )
            try:
                for frame in rgba_frames:
                    process.stdin.write(frame)
                process.stdin.close()
                result = process.wait(timeout=180)
            except Exception:
                process.kill()
                process.wait()
                raise

            if result != 0:
                errors.seek(0)
                detail = errors.read(500).decode(
                    "utf-8", "replace"
                ).strip()
                raise ValueError(
                    f"FFmpeg не создал WebM: {detail}"
                )

        file_size = temporary.stat().st_size
        if not file_size:
            raise ValueError("Получился пустой WebM.")
        if file_size > MAX_FILE_BYTES:
            raise ValueError(
                f"WebM получился {file_size // 1024} КБ; "
                "для стикера нужно не больше 256 КБ."
            )

        destination = downloads / (
            f"astrapixelart-{uuid.uuid4().hex[:12]}.webm"
        )
        os.replace(temporary, destination)
        return {
            "path": str(destination),
            "frames": len(frames),
            "fps": fps,
            "width": 512,
            "height": 512,
            "bytes": file_size,
        }
    finally:
        temporary.unlink(missing_ok=True)