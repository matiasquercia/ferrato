"""Comprime las fotos de photos/ y actualiza catalog.json. No sube los originales."""
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "photos"
OUT = ROOT / "public" / "images" / "productos"
CATALOG = ROOT / "src" / "data" / "catalog.json"
MAX_SIDE = 1600

# Carpeta o archivo → slug. Las negras no tienen código de peldaño: no se mezclan.
SOURCES = {
    "escalera-safari-fija-2-peldanos": [PHOTOS / "Esc. fija 2012"],
    "escalera-safari-2-peldanos": [PHOTOS / "Escaleras" / "2 2002"],
    "escalera-safari-3-peldanos": [PHOTOS / "Escaleras" / "3 2003"],
    "escalera-safari-4-peldanos": [PHOTOS / "Escaleras" / "4 2004"],
    "escalera-safari-5-peldanos": [PHOTOS / "Escaleras" / "5 2005"],
    "escalera-safari-6-peldanos": [PHOTOS / "Escaleras" / "6 2006"],
    "escalera-safari-7-peldanos": [PHOTOS / "Escaleras" / "7 2007"],
    "banqueta-escalera-plegable": [PHOTOS / "Banqueta blanca 2001"],
    "banqueta-escalera-plegable-reforzada": [PHOTOS / "Banqueta Aluminio 2011"],
    "tender-de-pie-basico": [PHOTOS / "Tenders" / "balcon 9.jpg"],
    "tender-de-pie-con-alas": [PHOTOS / "Tenders" / "Balcon ala liviano.jpg"],
    "tender-de-pie-con-alas-reforzado": [PHOTOS / "Tenders" / "Balcon ala R.jpg"],
    "tender-extensible-de-pared-45x7": [PHOTOS / "Tenders" / "Extensible 7 varillas.jpg"],
    "tender-extensible-de-pared-60x7": [PHOTOS / "Tenders" / "Extensible 9 varillas.jpg"],
    "tabla-de-planchar-basica": [PHOTOS / "Tablas de planchar" / "2501"],
    "tabla-de-planchar-esencial": [PHOTOS / "Tablas de planchar" / "2502"],
    "tabla-de-planchar-premier": [PHOTOS / "Tablas de planchar" / "2540"],
    "tabla-de-planchar-silver": [PHOTOS / "Tablas de planchar" / "2550"],
    "agarradera-de-seguridad": [PHOTOS / "Pasamanos" / "pasamanos.jpg"],
}


def sort_key(path: Path):
    name = path.name.lower()
    nums = [int(n) for n in re.findall(r"\d+", name)]
    # "esc comun" es un detalle; la vista completa (esc 5.jpg, etc.) va primero.
    detail = "comun" in name
    return (detail, "(" in name, nums, name)


def collect(sources: list[Path]) -> list[Path]:
    files: list[Path] = []
    for src in sources:
        if src.is_file():
            files.append(src)
        elif src.is_dir():
            files.extend(p for p in src.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
        else:
            raise SystemExit(f"No existe: {src}")
    return sorted(files, key=sort_key)


def save_jpeg(src: Path, dest: Path) -> None:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=82, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    by_slug = {p["slug"]: p for p in catalog["products"]}
    for slug, sources in SOURCES.items():
        files = collect(sources)
        if slug not in by_slug:
            raise SystemExit(f"Slug desconocido: {slug}")
        urls = []
        for i, src in enumerate(files, start=1):
            dest = OUT / f"{slug}-{i}.jpg"
            save_jpeg(src, dest)
            urls.append(f"/images/productos/{slug}-{i}.jpg")
            print(f"{slug}-{i}.jpg  <-  {src.relative_to(PHOTOS)}")
        by_slug[slug]["images"] = urls
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{sum(len(p['images']) for p in catalog['products'])} fotos en el catálogo.")


if __name__ == "__main__":
    main()
