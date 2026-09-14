#!/usr/bin/env python3
"""Build exact table-to-executable-SQL or reviewed-policy evidence.

Comments and plain identifier occurrences are deliberately ignored. A source is
accepted only when executable code contains a parser-recognizable SQL relation
reference or an existing export contract contains an exact table field.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

# Generated export policy is an output of classification, never independent
# evidence that a business relation has a real writer or reviewed source.
SKIP_NAMES = {
    "PostgresDatabase.ts",
    "DatabaseInitializer.ts",
    "conflictTargets.ts",
    "organizationExportEnterpriseContract.generated.ts",
}
SQL_REFERENCE = re.compile(
    r"\b(?P<verb>INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM|JOIN)\s+(?:(?P<schema>public|v8)\.)?[\"`']?(?P<table>[A-Za-z_][A-Za-z0-9_]*)[\"`']?",
    re.I,
)
CONTRACT_REFERENCE = re.compile(r"\btable\s*:\s*['\"](?P<table>[A-Za-z_][A-Za-z0-9_]*)['\"]")


def strip_comments(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", lambda match: "\n" * match.group(0).count("\n"), source, flags=re.S)
    return re.sub(r"(^|\s)//[^\n]*", lambda match: match.group(1), source)


def line_number(source: str, offset: int) -> int:
    return source.count("\n", 0, offset) + 1


def family_for(path: str) -> str:
    normalized = path.lower()
    rules = (
        ("interview", "INTERVIEW"), ("task", "TASKS"), ("initiative", "INITIATIVES"),
        ("project", "PROJECTS_PMO"), ("finance", "FINANCE"), ("assessment", "ASSESSMENT"),
        ("audit", "AUDIT_COMPLIANCE"), ("tool", "TOOLS"), ("presentation", "PRESENTATIONS"),
        ("knowledge", "KNOWLEDGE_MATERIALS"), ("notebook", "KNOWLEDGE_MATERIALS"),
        ("security", "ADMIN_SECURITY"), ("auth", "ADMIN_SECURITY"), ("admin", "ADMIN_SECURITY"),
        ("setting", "SETTINGS"), ("ai", "PLATFORM_AI"), ("chat", "COLLABORATION"),
        ("collab", "COLLABORATION"), ("report", "REPORTING"), ("partner", "PARTNER"),
        ("v8", "V8_PLATFORM"), ("organization", "ORGANIZATION_GOVERNANCE"),
    )
    return next((family for needle, family in rules if needle in normalized), "OPERATIONS")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--repository-root", type=Path, default=Path("."))
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    identities = {f"{row['schema']}.{row['table']}" for row in inventory["tables"]}
    refs: dict[str, list[dict]] = defaultdict(list)
    source_root = args.repository_root / "server" / "src"
    for source_path in source_root.rglob("*"):
        if (
            not source_path.is_file() or source_path.suffix not in {".ts", ".js"}
            or "__tests__" in source_path.parts or source_path.name in SKIP_NAMES
            or ".generated." in source_path.name
        ):
            continue
        relative = source_path.relative_to(args.repository_root).as_posix()
        source = strip_comments(source_path.read_text(encoding="utf-8", errors="ignore"))
        for match in SQL_REFERENCE.finditer(source):
            table = match.group("table")
            # PostgreSQL's application search_path resolves unqualified names
            # to public in this repository. Such a writer cannot authorize a
            # same-named physical mirror in the v8 schema.
            schema = match.group("schema") or "public"
            table_id = f"{schema}.{table}"
            if table_id not in identities:
                continue
            verb = re.sub(r"\s+", "_", match.group("verb").upper())
            refs[table_id].append({"path": relative, "line": line_number(source, match.start()), "kind": f"SQL_{verb}"})
        if source_path.name.startswith("organizationExport") and source_path.name.endswith("Contract.ts"):
            for match in CONTRACT_REFERENCE.finditer(source):
                table = match.group("table")
                table_id = f"public.{table}"
                if table_id in identities:
                    refs[table_id].append({"path": relative, "line": line_number(source, match.start()), "kind": "EXPORT_POLICY"})

    kind_rank = {"EXPORT_POLICY": 0, "SQL_INSERT_INTO": 1, "SQL_UPDATE": 2, "SQL_DELETE_FROM": 3, "SQL_FROM": 4, "SQL_JOIN": 5}
    entries = []
    for row in inventory["tables"]:
        table_id = f"{row['schema']}.{row['table']}"
        seen = set()
        table_refs = []
        for ref in sorted(refs.get(table_id, []), key=lambda item: (kind_rank[item["kind"]], item["path"], item["line"])):
            key = (ref["path"], ref["line"], ref["kind"])
            if key not in seen:
                seen.add(key)
                table_refs.append(ref)
        selected = table_refs[:5]
        family = family_for(selected[0]["path"]) if selected else "EXECUTABLE_SEMANTIC_SOURCE_MISSING"
        entries.append({
            "schema": row["schema"], "table": row["table"], "family": family,
            "sources": selected,
            "sourceEvidence": "; ".join(f"{ref['kind']} {ref['path']}:{ref['line']}" for ref in selected) or "EXECUTABLE_SEMANTIC_SOURCE_MISSING",
        })
    result = {
        "purpose": "Exact executable SQL/export-policy evidence for E1 table semantics",
        "parserRule": "comments ignored; SQL verb relation reference must resolve to exact schema identity (unqualified application SQL resolves only to public), or exact existing export contract table field authorizes public only",
        "count": len(entries), "missing": sum(not entry["sources"] for entry in entries),
        "excludedDiscoverySources": sorted(SKIP_NAMES), "entries": entries,
    }
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"entries": len(entries), "missing": result["missing"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
