"""Agrega la galería negra a los productos que tienen fotos de los dos colores."""
import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BLACK = ROOT / "photos" / "Escaleras" / "Esc negra" / "fotos articulos negro"
OUT = ROOT / "public" / "images" / "productos"
CATALOG = ROOT / "src" / "data" / "catalog.json"
WHITE = "Blanco brillante"
BLACK_NAME = "Negro brillante"


def shot(n: int) -> Path:
    return BLACK / f"06-18 safira {n}.jpg"


# La vista abierta va primero. El número es el archivo "06-18 safira N".
GALLERIES = {
    "escalera-safari-7-peldanos": [1, 2, 3, 4, 5],
    "escalera-safari-6-peldanos": [41, 6, 7],
    "escalera-safari-5-peldanos": [40, 8, 9, 10, 11],
    "escalera-safari-4-peldanos": [36, 39, 12, 13, 14],
    "escalera-safari-3-peldanos": [38, 15, 16, 17],
    "escalera-safari-2-peldanos": [37, 18],
    "banqueta-escalera-plegable": [35, 23, 24, 25],
}


def save_jpeg(src: Path, dest: Path) -> None:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=82, optimize=True)


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_slug = {p["slug"]: p for p in catalog["products"]}
    for slug, nums in GALLERIES.items():
        product = by_slug[slug]
        urls = []
        for i, n in enumerate(nums, start=1):
            dest = OUT / f"{slug}-negro-{i}.jpg"
            save_jpeg(shot(n), dest)
            urls.append(f"/images/productos/{slug}-negro-{i}.jpg")
            print(f"{dest.name}  <-  safira {n}")
        product["imagesByColor"] = {
            WHITE: product["images"],
            BLACK_NAME: urls,
        }
        if BLACK_NAME not in product["colors"]:
            product["colors"] = [WHITE, BLACK_NAME]
    banqueta = by_slug["banqueta-escalera-plegable"]
    banqueta["specs"]["Colores"] = "Blanco / negro brillante"
    banqueta["shortDescription"] = (
        "Banquito escalera plegable de caño de acero, con escalones antideslizantes. Blanco o negro brillante."
    )
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
