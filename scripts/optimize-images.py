"""Regenerate local responsive assets. Requires Python 3 and Pillow (pip install Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public' / 'images'
output = root / 'optimized'
output.mkdir(exist_ok=True)
for source in (root / 'productos').glob('*.jpg'):
    with Image.open(source) as image:
        for width in (320, 640, 960):
            resized = image.copy()
            resized.thumbnail((width, width), Image.Resampling.LANCZOS)
            resized.save(output / f'{source.stem}-{width}.webp', 'WEBP', quality=80, method=6)
