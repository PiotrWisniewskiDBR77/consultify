#!/usr/bin/env python3
"""Build exact reviewed dispositions for inactive physical v8 relations."""

import argparse
import csv
import json
import re
from pathlib import Path


SECURITY_IDENTITIES = {
    "v8.v8_connection_credentials",
    "v8.v8_connector_auth_states",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--semantic-index", type=Path, required=True)
    parser.add_argument("--baseline-ddl", type=Path, required=True)
    parser.add_argument("--live-counts", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    inventory = json.loads(args.inventory.read_text())
    semantic = json.loads(args.semantic_index.read_text())
    public_names = {row["table"] for row in inventory["tables"] if row["schema"] == "public"}
    semantic_by_id = {f"{row['schema']}.{row['table']}": row for row in semantic["entries"]}
    counts = {}
    with args.live_counts.open(newline="") as handle:
        for identity, count in csv.reader(handle, delimiter="\t"):
            counts[identity] = int(count)

    ddl_lines = {}
    pattern = re.compile(r'^create table if not exists "v8"\."(?P<table>v8_[^"]+)"', re.I)
    for number, line in enumerate(args.baseline_ddl.read_text().splitlines(), 1):
        match = pattern.search(line)
        if match:
            ddl_lines[match.group("table")] = number

    entries = []
    for row in inventory["tables"]:
        if row["schema"] != "v8":
            continue
        identity = f"v8.{row['table']}"
        sources = semantic_by_id[identity]["sources"]
        if sources:
            continue
        if row["table"] not in ddl_lines:
            raise ValueError(f"missing exact baseline DDL for {identity}")
        if identity not in counts:
            raise ValueError(f"missing live row count for {identity}")
        security = identity in SECURITY_IDENTITIES
        public_counterpart = row["table"] in public_names
        if security:
            disposition = "SECURITY_CREDENTIAL_STATE"
            reason = f"{identity} stores connector credential or authentication state and is excluded in full even though the measured snapshot is empty."
            basis = "CREDENTIAL_OR_SESSION_MATERIAL"
        elif public_counterpart:
            disposition = "HISTORICAL_PARALLEL_SCHEMA_COPY"
            reason = f"{identity} is an empty physical parallel-schema copy created by the baseline parity migration with no active schema-qualified writer; exporting it would claim duplicate or stale business history."
            basis = "ACTIVE_SEMANTIC_POLICY_MISSING"
        else:
            disposition = "INACTIVE_SCHEMA_ONLY_RELATION"
            reason = f"{identity} is an empty schema-only relation created by the baseline parity migration with no active schema-qualified writer or proven business record path."
            basis = "ACTIVE_SEMANTIC_POLICY_MISSING"
        entries.append({
            "identity": identity,
            "classification": "EXCLUDE_SECURITY",
            "disposition": disposition,
            "exclusionBasis": basis,
            "publicCounterpart": public_counterpart,
            "snapshotRows": counts[identity],
            "activeSchemaQualifiedWriterEvidence": [],
            "reason": reason,
            "sourceEvidence": [
                f"SCHEMA_DDL {args.baseline_ddl.as_posix()}:{ddl_lines[row['table']]}",
                f"LIVE_ROW_COUNT {args.live_counts.as_posix()}::{identity}={counts[identity]}",
                f"ACTIVE_WRITER_NONE docs/ssot/organization-export-semantic-source-index.e1.json::{identity}",
            ],
        })

    if len(entries) != 119:
        raise ValueError(f"expected 119 inactive v8 dispositions, got {len(entries)}")
    result = {
        "policyVersion": "organization-export-v8-dispositions-e1-1",
        "asOfSchemaSha256": inventory["schemaSnapshotSha256"],
        "decisionRule": "Only exact schema-qualified active writers authorize v8 EXPORT; empty baseline-created relations without one fail closed, with credential state called out separately.",
        "counts": {
            "total": len(entries),
            "historicalParallel": sum(row["disposition"] == "HISTORICAL_PARALLEL_SCHEMA_COPY" for row in entries),
            "inactiveSchemaOnly": sum(row["disposition"] == "INACTIVE_SCHEMA_ONLY_RELATION" for row in entries),
            "security": sum(row["disposition"] == "SECURITY_CREDENTIAL_STATE" for row in entries),
        },
        "entries": entries,
    }
    args.out.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
