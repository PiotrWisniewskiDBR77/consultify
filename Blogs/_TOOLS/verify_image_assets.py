from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = ROOT.parent


def main() -> None:
    meta_files = sorted(ROOT.glob("**/assets/images/*.meta.json"))
    missing: list[dict[str, str]] = []
    ok = 0

    for meta_path in meta_files:
        try:
            data = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            missing.append(
                {
                    "meta_path": str(meta_path),
                    "output_path": "",
                    "reason": "invalid_json",
                }
            )
            continue

        output_path = data.get("output_path", "")
        if not output_path:
            missing.append(
                {
                    "meta_path": str(meta_path),
                    "output_path": "",
                    "reason": "missing_output_path",
                }
            )
            continue

        out = Path(output_path)
        if not out.is_absolute():
            # Most meta files store output paths like "Blogs/<Product>/.../file.png"
            # which should be resolved from the workspace root, not from the Blogs directory.
            if output_path.startswith("Blogs/"):
                out = (WORKSPACE_ROOT / output_path).resolve()
            else:
                out = (ROOT / output_path).resolve()
        if out.exists():
            ok += 1
        else:
            missing.append(
                {
                    "meta_path": str(meta_path),
                    "output_path": str(out),
                    "reason": "missing_binary",
                }
            )

    print(f"META_FILES={len(meta_files)}")
    print(f"BINARIES_PRESENT={ok}")
    print(f"BINARIES_MISSING={len(missing)}")

    report_path = ROOT / "_WORK" / "image_ops" / "DBR77_IMAGE_ASSET_MISSING_REPORT.json"
    report_path.write_text(json.dumps(missing, indent=2), encoding="utf-8")
    print(f"WROTE={report_path}")

    # show a short sample
    for row in missing[:10]:
        print(f"- {row['reason']}: {row['output_path']} (meta={row['meta_path']})")


if __name__ == "__main__":
    main()

