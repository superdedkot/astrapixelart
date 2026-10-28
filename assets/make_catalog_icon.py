"""Generate the catalogue icon for Astra Pixel Art."""

from pathlib import Path

from PIL import Image, ImageDraw


image = Image.new("RGB", (32, 32), "#4c172e")
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((1, 1, 30, 30), radius=6, fill="#793049", outline="#f69b87")
draw.rectangle((5, 5, 26, 26), fill="#ffe1c7")
draw.rectangle((7, 7, 24, 24), fill="#f6c8b9")
draw.polygon([(8, 17), (8, 10), (12, 13), (17, 12), (21, 9),
              (22, 18), (19, 22), (11, 22)], fill="#45203b")
draw.polygon([(10, 17), (10, 13), (13, 15), (17, 14), (20, 12),
              (20, 18), (18, 20), (12, 20)], fill="#fff1df")
draw.rectangle((12, 17, 13, 18), fill="#4c172e")
draw.rectangle((17, 17, 18, 18), fill="#4c172e")
draw.point((15, 19), fill="#e76a81")
draw.polygon([(17, 25), (24, 18), (28, 22), (21, 29)], fill="#4c172e")
draw.polygon([(18, 24), (24, 18), (26, 20), (20, 26)], fill="#ffc060")
draw.polygon([(17, 25), (20, 26), (21, 28), (15, 29)], fill="#f8e1c8")
draw.polygon([(24, 18), (27, 15), (30, 18), (27, 21)], fill="#f5899e")
draw.line((21, 23, 25, 19), fill="#fff5af")
draw.line((24, 7, 24, 11), fill="#fff3b0")
draw.line((22, 9, 26, 9), fill="#fff3b0")

image.resize((128, 128), Image.Resampling.NEAREST).save(
    Path(__file__).resolve().parent.parent / "icon.png", optimize=True
)