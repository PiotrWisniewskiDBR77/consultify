from __future__ import annotations

import csv
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path


REQUIRED_FILES = ("article_EN.md", "article_PL.md", "article_DE.md")
ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = ROOT / "_LP_UPLOAD_READY"
ARCHIVE_ROOT = OUTPUT_ROOT / "_archives"


@dataclass(frozen=True)
class ProductConfig:
    name: str
    source_root: Path
    expected_count: int = 50


PRODUCTS = (
    ProductConfig("Consultify", ROOT / "Consultify" / "Blog"),
    ProductConfig("IoT", ROOT / "IoT" / "Blog"),
    ProductConfig("IRIS", ROOT / "IRIS" / "Blog"),
    ProductConfig("DT", ROOT / "DT" / "Blog"),
    ProductConfig("Marketplace", ROOT / "Marketplace" / "Blog"),
    ProductConfig("Vector", ROOT / "Vector" / "Blog"),
)


def is_article_dir(path: Path) -> bool:
    if not path.is_dir():
        return False
    if path.name.startswith("00_") or path.name.startswith("_archive_"):
        return False
    return all((path / filename).is_file() for filename in REQUIRED_FILES)


def collect_article_dirs(source_root: Path) -> list[Path]:
    article_dirs = [path for path in source_root.iterdir() if is_article_dir(path)]
    return sorted(article_dirs, key=lambda path: path.name)


def write_product_manifest(product_dir: Path, article_dirs: list[Path]) -> None:
    manifest_path = product_dir / "upload_manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["slug", "article_EN", "article_PL", "article_DE"])
        for article_dir in article_dirs:
            writer.writerow(
                [
                    article_dir.name,
                    f"{article_dir.name}/article_EN.md",
                    f"{article_dir.name}/article_PL.md",
                    f"{article_dir.name}/article_DE.md",
                ]
            )


def write_product_readme(product_dir: Path, product: ProductConfig, article_dirs: list[Path]) -> None:
    readme_path = product_dir / "README.md"
    lines = [
        f"# {product.name} LP Upload Package",
        "",
        "This directory contains only upload-ready article bodies.",
        "",
        "Rules baked into this export:",
        "",
        "- includes only article folders with `article_EN.md`, `article_PL.md`, and `article_DE.md`",
        "- excludes `00_*` operational files and folders",
        "- excludes `_archive_*` folders",
        "- excludes package metadata files such as `publish.md`, `cta.md`, `social.md`, `seo.md`, `sources.md`, and `image-prompts.md`",
        "",
        f"Expected article count: `{product.expected_count}`",
        f"Exported article count: `{len(article_dirs)}`",
        "",
        "Use `upload_manifest.csv` as the operator index for this product batch.",
        "Use the matching archive in `_archives/` when the LP workflow is faster with one compressed batch per product.",
        "",
    ]
    readme_path.write_text("\n".join(lines), encoding="utf-8")


def sha256_for_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def archive_product(product: ProductConfig, product_dir: Path) -> dict[str, object]:
    archive_base = ARCHIVE_ROOT / product.name
    archive_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=product_dir.parent, base_dir=product_dir.name))
    return {
        "archive": str(archive_path.relative_to(ROOT)),
        "archive_sha256": sha256_for_file(archive_path),
        "archive_size_bytes": archive_path.stat().st_size,
    }


def export_product(product: ProductConfig) -> dict[str, object]:
    article_dirs = collect_article_dirs(product.source_root)
    if len(article_dirs) != product.expected_count:
        raise ValueError(
            f"{product.name}: expected {product.expected_count} article folders, found {len(article_dirs)}"
        )

    product_dir = OUTPUT_ROOT / product.name
    if product_dir.exists():
        shutil.rmtree(product_dir)
    product_dir.mkdir(parents=True, exist_ok=True)

    for article_dir in article_dirs:
        target_dir = product_dir / article_dir.name
        target_dir.mkdir()
        for filename in REQUIRED_FILES:
            shutil.copy2(article_dir / filename, target_dir / filename)

    write_product_manifest(product_dir, article_dirs)
    write_product_readme(product_dir, product, article_dirs)
    archive_info = archive_product(product, product_dir)

    return {
        "product": product.name,
        "source_root": str(product.source_root.relative_to(ROOT)),
        "export_root": str(product_dir.relative_to(ROOT)),
        "count": len(article_dirs),
        "first_slug": article_dirs[0].name,
        "last_slug": article_dirs[-1].name,
        **archive_info,
    }


def write_summary(summary: list[dict[str, object]]) -> None:
    summary_path = OUTPUT_ROOT / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    integrity_path = OUTPUT_ROOT / "integrity_manifest.csv"
    with integrity_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "product",
                "count",
                "export_root",
                "archive",
                "archive_sha256",
                "archive_size_bytes",
                "first_slug",
                "last_slug",
            ]
        )
        for item in summary:
            writer.writerow(
                [
                    item["product"],
                    item["count"],
                    item["export_root"],
                    item["archive"],
                    item["archive_sha256"],
                    item["archive_size_bytes"],
                    item["first_slug"],
                    item["last_slug"],
                ]
            )

    readme_path = OUTPUT_ROOT / "README.md"
    lines = [
        "# DBR77 LP Upload Ready Packages",
        "",
        "This directory is a clean export layer for LP knowledge-base upload.",
        "",
        "Each product directory contains:",
        "",
        "- exactly `50` article folders",
        "- only `article_EN.md`, `article_PL.md`, and `article_DE.md`",
        "- `upload_manifest.csv` for operator control",
        "- one product archive per batch in `_archives/`",
        "- `integrity_manifest.csv` with archive checksums and size",
        "",
        "Generated products:",
        "",
    ]
    for item in summary:
        lines.append(f"- `{item['product']}`: `{item['count']}` article folders")
    lines.extend(
        [
            "",
            "Use this export layer instead of browsing raw product `Blog/` roots during live upload.",
            "",
        ]
    )
    readme_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)

    summary = [export_product(product) for product in PRODUCTS]
    write_summary(summary)

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
