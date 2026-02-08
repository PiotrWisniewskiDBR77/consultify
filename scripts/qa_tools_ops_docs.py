#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OPS_DIR = ROOT / "wdrozenia" / "modules" / "tools" / "catalog" / "operations"


def count_references(md: str) -> int:
    # Count list bullets under "## 14. References" section (simple heuristic).
    m = re.search(r"^## 14\. References\b.*?$([\s\S]*)", md, flags=re.M)
    if not m:
        return 0
    tail = m.group(1)
    # Stop at next heading if present (shouldn't, since last section).
    tail = re.split(r"^##\s+", tail, flags=re.M)[0]
    return len(re.findall(r"^\s*-\s+", tail, flags=re.M))


def has_placeholders(md: str) -> bool:
    return bool(re.search(r"\bTBD\b|\bTODO\b", md))


def has_min_faq(md: str, min_count: int = 8) -> bool:
    # Count numbered FAQ items in "### FAQ" blocks.
    # Heuristic: find any "### FAQ" section and count "^\d+\." lines until next "###".
    for m in re.finditer(r"^### FAQ\b.*?$([\s\S]*?)(?=^###\s|\Z)", md, flags=re.M):
        block = m.group(1)
        n = len(re.findall(r"^\s*\d+\.\s+", block, flags=re.M))
        if n >= min_count:
            return True
    return False


def has_core_sections(md: str) -> bool:
    required = [
        "## Metadata",
        "## 1. Purpose",
        "## 2. Concept",
        "## 3. Inputs",
        "## 4. Step-by-step method",
        "## 5. Outputs",
        "## 6. UI / Graphic specification",
        "## 7. Worked example",
        "## 8. Implementation spec",
        "## 9. AI spec",
        # allow older label variants; we accept either
        # - "## 10. Consultant Report Specification" (preferred)
        # - "## 10. Consultant report spec" (older ops docs)
        # We'll check this separately.
        "## 11. Video storyboard",
        "## 12. Knowledge base extraction pack",
        # allow variants: "Additional resources" vs "Additional Resources & Learning Links"
        # We'll check this separately.
        "## 14. References",
    ]
    base_ok = all(r in md for r in required)
    report_ok = ("## 10. Consultant Report Specification" in md) or ("## 10. Consultant report spec" in md)
    additional_ok = ("## 13. Additional" in md) or ("## 13. Additional resources" in md) or ("## 13. Additional Resources & Learning Links" in md)
    return base_ok and report_ok and additional_ok


def main() -> int:
    files = sorted([p for p in OPS_DIR.glob("*.md") if p.name != "00-INDEX.md"])
    if not files:
        print("No ops tool docs found.")
        return 2

    failed = 0
    for p in files:
        md = p.read_text(encoding="utf-8")
        errs = []
        if has_placeholders(md):
            errs.append("contains TBD/TODO")
        if not has_core_sections(md):
            errs.append("missing one or more required sections")
        refs = count_references(md)
        if refs < 3:
            errs.append(f"references<{3} (found {refs})")
        if not has_min_faq(md, 8):
            errs.append("FAQ<8")

        if errs:
            failed += 1
            print(f"[FAIL] {p.name}: {', '.join(errs)}")
        else:
            print(f"[OK]   {p.name}")

    print()
    print(f"Checked {len(files)} files. Failed: {failed}.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

