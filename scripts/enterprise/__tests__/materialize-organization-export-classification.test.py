import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).parents[1] / "materialize-organization-export-classification.py"
SPEC = importlib.util.spec_from_file_location("materialize_policy", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(MODULE)


def row(table, columns=(), foreign_keys=()):
    return {
        "schema": "public",
        "table": table,
        "columns": [{"name": name} for name in columns],
        "foreignKeys": list(foreign_keys),
    }


class MaterializePolicyTest(unittest.TestCase):
    def test_structural_proof_not_name_grants_export(self):
        inventory = {
            "baseCommit": "base",
            "schemaSnapshotSha256": "schema",
            "tables": [
                row("organizations", ["id"]),
                row("looks_global", ["id", "organization_id"]),
                row(
                    "looks_tenant_owned",
                    ["id", "parent_id"],
                    [{"column": "parent_id", "parentSchema": "public", "parentTable": "looks_global", "parentColumn": "id"}],
                ),
                row("organization_named_but_unscoped", ["id"]),
            ],
        }
        old_credentials = MODULE.CREDENTIAL_TABLES
        old_derived = MODULE.DERIVED_OVERRIDES
        MODULE.CREDENTIAL_TABLES = set()
        MODULE.DERIVED_OVERRIDES = {}
        try:
            semantic = {
                "entries": [
                    {"schema": "public", "table": name, "family": "SOURCE_TEST", "sources": [{"path": __file__, "lines": [1]}], "sourceEvidence": __file__}
                    for name in ("organizations", "looks_global", "looks_tenant_owned")
                ]
            }
            result = MODULE.materialize(inventory, {"tables": []}, semantic)
        finally:
            MODULE.CREDENTIAL_TABLES = old_credentials
            MODULE.DERIVED_OVERRIDES = old_derived
        by_name = {item["table"]: item for item in result["tables"]}
        self.assertEqual(by_name["looks_global"]["category"], "EXPORT")
        self.assertEqual(by_name["looks_tenant_owned"]["category"], "EXPORT")
        self.assertEqual(by_name["organization_named_but_unscoped"]["category"], "EXCLUDE_SECURITY")
        self.assertEqual(by_name["organization_named_but_unscoped"]["exclusionBasis"], "NO_PROVABLE_TENANT_BOUNDARY")

    def test_exact_overrides_beat_structural_export(self):
        inventory = {
            "baseCommit": "base",
            "schemaSnapshotSha256": "schema",
            "tables": [
                row("organizations", ["id"]),
                row("credential_store", ["id", "organization_id"]),
                row("marker", ["id"]),
            ],
        }
        old_credentials = MODULE.CREDENTIAL_TABLES
        old_derived = MODULE.DERIVED_OVERRIDES
        MODULE.CREDENTIAL_TABLES = {"public.credential_store"}
        MODULE.DERIVED_OVERRIDES = {
            "public.marker": {
                "family": "TEST_DERIVED",
                "reason": "The marker is rebuilt by the exact test procedure.",
                "sourceEvidence": "scripts/enterprise/__tests__/materialize-organization-export-classification.test.py",
                "derivedFrom": {
                    "kind": "REBUILD_PROCEDURE",
                    "sourcePath": "scripts/enterprise/__tests__/materialize-organization-export-classification.test.py",
                    "procedure": "Run the exact test procedure to rebuild this marker.",
                },
            }
        }
        try:
            semantic = {
                "entries": [
                    {"schema": "public", "table": "organizations", "family": "SOURCE_TEST", "sources": [{"path": __file__, "lines": [1]}], "sourceEvidence": __file__}
                ]
            }
            result = MODULE.materialize(inventory, {"tables": []}, semantic)
        finally:
            MODULE.CREDENTIAL_TABLES = old_credentials
            MODULE.DERIVED_OVERRIDES = old_derived
        by_name = {item["table"]: item for item in result["tables"]}
        self.assertEqual(by_name["credential_store"]["category"], "EXCLUDE_SECURITY")
        self.assertEqual(by_name["marker"]["category"], "DERIVED")

    def test_state_requires_exact_business_lifecycle_identity(self):
        inventory = {
            "baseCommit": "base",
            "schemaSnapshotSha256": "schema",
            "tables": [row("organizations", ["id"]), row("workflow", ["id", "organization_id", "state"])],
        }
        semantic = {
            "entries": [
                {"schema": "public", "table": name, "family": "SOURCE_TEST", "sources": [{"path": __file__, "line": 1, "kind": "SQL_INSERT_INTO"}], "sourceEvidence": __file__}
                for name in ("organizations", "workflow")
            ]
        }
        old_credentials = MODULE.CREDENTIAL_TABLES
        old_derived = MODULE.DERIVED_OVERRIDES
        old_lifecycle = MODULE.BUSINESS_LIFECYCLE_STATE_TABLES
        MODULE.CREDENTIAL_TABLES = set()
        MODULE.DERIVED_OVERRIDES = {}
        try:
            MODULE.BUSINESS_LIFECYCLE_STATE_TABLES = set()
            with self.assertRaisesRegex(ValueError, "unreviewed exportable state column"):
                MODULE.materialize(inventory, {"tables": []}, semantic)
            MODULE.BUSINESS_LIFECYCLE_STATE_TABLES = {"public.workflow"}
            result = MODULE.materialize(inventory, {"tables": []}, semantic)
        finally:
            MODULE.CREDENTIAL_TABLES = old_credentials
            MODULE.DERIVED_OVERRIDES = old_derived
            MODULE.BUSINESS_LIFECYCLE_STATE_TABLES = old_lifecycle
        workflow = next(item for item in result["tables"] if item["table"] == "workflow")
        self.assertIn("state", workflow["projection"])
        self.assertNotIn("state", workflow["excludedColumns"])


if __name__ == "__main__":
    unittest.main()
