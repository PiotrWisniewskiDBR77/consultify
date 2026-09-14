#!/usr/bin/env python3
"""Build a deterministic organization-export schema inventory from live catalog TSVs.

The input files must be produced from pg_catalog/information_schema on the database
being measured. This tool does not infer export authority. It deliberately leaves
new relations UNRESOLVED until an explicit policy review classifies them.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path


ALLOWED_SCHEMAS = {"public", "v8"}


def read_tsv(path: Path):
    with path.open(encoding="utf-8", newline="") as handle:
        yield from csv.reader(handle, delimiter="\t")


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--columns", type=Path, required=True)
    parser.add_argument("--primary-keys", type=Path, required=True)
    parser.add_argument("--foreign-keys", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--schema-sha256", required=True)
    parser.add_argument("--base-commit", required=True)
    parser.add_argument(
        "--approved-policy",
        type=Path,
        help="Optional measured list of already approved table identities from the base contract.",
    )
    args = parser.parse_args()

    tables: dict[tuple[str, str], dict] = {}
    for row in read_tsv(args.columns):
        if len(row) != 6:
            raise SystemExit(f"invalid columns row: {row!r}")
        schema, table, ordinal, column, data_type, nullable = row
        if schema not in ALLOWED_SCHEMAS:
            raise SystemExit(f"unexpected schema: {schema}")
        key = (schema, table)
        entry = tables.setdefault(
            key,
            {
                "schema": schema,
                "table": table,
                "classification": "UNRESOLVED",
                "family": "UNREVIEWED",
                "reason": "Awaiting explicit owner/privacy/derivation review; catalog discovery grants no export authority.",
                "columns": [],
                "primaryKey": [],
                "foreignKeys": [],
            },
        )
        entry["columns"].append(
            {
                "ordinal": int(ordinal),
                "name": column,
                "type": data_type,
                "nullable": nullable == "t",
            }
        )

    for row in read_tsv(args.primary_keys):
        if len(row) != 3:
            raise SystemExit(f"invalid primary-key row: {row!r}")
        schema, table, columns = row
        tables[(schema, table)]["primaryKey"] = columns.split(",") if columns else []

    for row in read_tsv(args.foreign_keys):
        if len(row) != 6:
            raise SystemExit(f"invalid foreign-key row: {row!r}")
        schema, table, column, parent_schema, parent_table, parent_column = row
        tables[(schema, table)]["foreignKeys"].append(
            {
                "column": column,
                "parentSchema": parent_schema,
                "parentTable": parent_table,
                "parentColumn": parent_column,
            }
        )

    ordered = [tables[key] for key in sorted(tables)]
    if args.approved_policy:
        approved_document = json.loads(args.approved_policy.read_text(encoding="utf-8"))
        for approved in approved_document.get("tables", []):
            key = (approved["schema"], approved["table"])
            if key not in tables:
                raise SystemExit(f"approved policy identity missing from live schema: {key}")
            entry = tables[key]
            for field in ("category", "family", "reason", "sourceEvidence"):
                if not isinstance(approved.get(field), str) or not approved[field].strip():
                    raise SystemExit(f"approved policy {key} is missing explicit {field}")
            entry["classification"] = approved["category"]
            entry["family"] = approved["family"]
            entry["reason"] = approved["reason"]
            entry["sourceEvidence"] = approved["sourceEvidence"]
            if approved["category"] == "EXPORT":
                if "ownership" not in approved:
                    raise SystemExit(f"approved EXPORT policy {key} is missing ownership")
                entry["ownership"] = approved["ownership"]
                for field in (
                    "projection",
                    "excludedColumns",
                    "columnPolicy",
                    "columnDecisions",
                    "semanticEvidence",
                ):
                    if field not in approved:
                        raise SystemExit(f"approved EXPORT policy {key} is missing {field}")
                    entry[field] = approved[field]
            if approved["category"] == "EXCLUDE_SECURITY":
                if "exclusionBasis" not in approved:
                    raise SystemExit(f"approved EXCLUDE_SECURITY policy {key} is missing exclusionBasis")
                entry["exclusionBasis"] = approved["exclusionBasis"]
            if approved["category"] == "DERIVED":
                if "derivedFrom" not in approved:
                    raise SystemExit(f"approved DERIVED policy {key} is missing derivedFrom")
                entry["derivedFrom"] = approved["derivedFrom"]
    counts = defaultdict(int)
    for entry in ordered:
        counts[entry["schema"]] += 1
        entry["foreignKeys"].sort(
            key=lambda item: (
                item["column"],
                item["parentSchema"],
                item["parentTable"],
                item["parentColumn"],
            )
        )
    if counts != {"public": 1809, "v8": 121}:
        raise SystemExit(f"unexpected staging inventory counts: {dict(counts)}")

    classified = sum(entry["classification"] != "UNRESOLVED" for entry in ordered)
    document = {
        "contractPurpose": "F2-E E1 live-schema classification baseline",
        "baseCommit": args.base_commit,
        "schemaSnapshotSha256": args.schema_sha256,
        "sourceFiles": {
            "columns": {"path": args.columns.name, "sha256": file_sha256(args.columns)},
            "primaryKeys": {
                "path": args.primary_keys.name,
                "sha256": file_sha256(args.primary_keys),
            },
            "foreignKeys": {
                "path": args.foreign_keys.name,
                "sha256": file_sha256(args.foreign_keys),
            },
        },
        "counts": {
            "public": counts["public"],
            "v8": counts["v8"],
            "total": len(ordered),
            "classified": classified,
            "unresolved": len(ordered) - classified,
        },
        "authorityRule": "Catalog discovery never grants export authority.",
        "tables": ordered,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(document["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
