from __future__ import annotations

import json
from pathlib import Path


BLOGS_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = BLOGS_ROOT.parent


def to_workspace_prefixed_path(path: Path) -> str:
    """
    Meta convention in this repo uses workspace-relative paths prefixed with 'Blogs/'.
    """
    rel = path.resolve().relative_to(WORKSPACE_ROOT.resolve())
    return str(rel).replace("\\", "/")


def main() -> None:
    meta_files = sorted(BLOGS_ROOT.glob("**/assets/images/*.meta.json"))
    updated = 0
    skipped = 0
    missing_png = 0

    for meta_path in meta_files:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        if "output_path" in data and str(data["output_path"]).strip():
            skipped += 1
            continue

        # expected png lives next to meta file
        png_path = meta_path.with_suffix("")  # strips .json -> .meta
        if png_path.name.endswith(".meta"):
            png_path = png_path.with_suffix("")  # strips .meta -> base filename
        png_path = png_path.with_suffix(".png")

        if not png_path.exists():
            missing_png += 1
            continue

        data["output_path"] = to_workspace_prefixed_path(png_path)
        meta_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        updated += 1

    print(f"META_TOTAL={len(meta_files)}")
    print(f"UPDATED={updated}")
    print(f"SKIPPED_ALREADY_HAS_OUTPUT_PATH={skipped}")
    print(f"MISSING_PNG_FOR_META={missing_png}")


if __name__ == "__main__":
    main()

