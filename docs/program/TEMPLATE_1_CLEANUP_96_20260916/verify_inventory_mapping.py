#!/usr/bin/env python3
"""Compare the migration's immutable 96-row mapping with INWENTARZ.csv."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


DECISIONS = {"ZOSTAJE": "KEEP", "PRZEBUDOWA": "REBUILD", "LECI": "DEPRECATE"}
ROW_RE = re.compile(
    r"\((\d+),'(KEEP|REBUILD|DEPRECATE)','(DOC-BASE|DECK-BASE|SHEET-BASE)',"
    r"'([^']+)'(?:,'([^']+)')?\)"
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("migration", type=Path)
    args = parser.parse_args()

    migration_rows = {}
    for match in ROW_RE.finditer(args.migration.read_text()):
        nr, decision, family, runtime, record_id = match.groups()
        migration_rows[int(nr)] = {
            "decision": decision,
            "family": family,
            "runtime": runtime,
            "id": record_id,
        }

    with args.inventory.open(newline="") as handle:
        inventory_rows = {int(row["nr"]): row for row in csv.DictReader(handle)}

    errors = []
    expected_nrs = set(range(1, 97))
    if set(migration_rows) != expected_nrs:
        errors.append("migration row numbers are not exactly 1..96")
    if set(inventory_rows) != expected_nrs:
        errors.append("inventory row numbers are not exactly 1..96")

    for nr in sorted(expected_nrs & set(migration_rows) & set(inventory_rows)):
        actual = migration_rows[nr]
        expected = inventory_rows[nr]
        if actual["decision"] != DECISIONS.get(expected["decyzja"]):
            errors.append(f"row {nr}: decision mismatch")
        if nr <= 92 and actual["runtime"] != expected["runtime"]:
            errors.append(f"row {nr}: runtime mismatch")
        if nr >= 93:
            replacement_runtime = {
                "Presentation": "presentation_template",
                "Sheet": "sheet_template",
            }.get(expected["format"])
            if expected["runtime"] != "(brak rekordu kanonicznego)":
                errors.append(f"row {nr}: CSV no longer marks the canonical source as missing")
            if actual["runtime"] != replacement_runtime:
                errors.append(f"row {nr}: replacement runtime mismatch")
        if actual["id"] != expected["id"]:
            errors.append(f"row {nr}: id mismatch")

    decision_counts = Counter(row["decision"] for row in migration_rows.values())
    family_counts = Counter(row["family"] for row in migration_rows.values())
    runtime_counts = Counter(row["runtime"] for row in migration_rows.values())
    expected_counts = {"KEEP": 20, "REBUILD": 16, "DEPRECATE": 60}
    if dict(decision_counts) != expected_counts:
        errors.append(f"decision counts mismatch: {dict(decision_counts)}")

    receipt = {
        "status": "PASS" if not errors else "FAIL",
        "denominator": len(migration_rows),
        "decisionCounts": dict(sorted(decision_counts.items())),
        "familyCounts": dict(sorted(family_counts.items())),
        "runtimeCounts": dict(sorted(runtime_counts.items())),
        "errors": errors,
    }
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
