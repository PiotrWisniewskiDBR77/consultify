#!/usr/bin/env python3
"""Materialize an exact E1 table policy from reviewed structural evidence.

Table names never grant EXPORT or DERIVED authority. A relation is exportable only
when the live catalog proves a path to an organization discriminator. Relations
without such a path fail closed as EXCLUDE_SECURITY until an explicit override
supplies stronger evidence.
"""

from __future__ import annotations

import argparse
import copy
import json
from collections import Counter, deque
from pathlib import Path

TENANT_COLUMNS = ("organization_id", "org_id", "tenant_id")

# Exact reviewed identities whose rows are authentication, credential, session,
# recovery, signing, or token-vault material. This list is intentionally not a
# regex and is covered by a live-identity guard.
CREDENTIAL_TABLES = {
    "public.active_sessions",
    "public.admin_sessions",
    "public.api_keys",
    "public.cloud_sources",
    "public.document_share_links",
    "public.email_verification_tokens",
    "public.integration_api_keys",
    "public.integration_oauth_tokens",
    "public.integration_secrets",
    "public.mfa_login_challenges",
    "public.oauth_links",
    "public.password_resets",
    "public.refresh_tokens",
    "public.scim_tokens",
    "public.sellix_config",
    "public.sso_configs",
    "public.sso_auth_states",
    "public.sso_configurations",
    "public.sso_sessions",
    "public.tp_scim_tokens",
    "public.tp_service_accounts",
    "public.tp_webhook_relays",
    "public.tp_webhooks",
    "public.trusted_devices",
    "public.user_2fa",
    "public.user_api_keys",
    "public.user_mfa",
    "public.user_mfa_methods",
    "public.user_sessions",
    "public.user_webhooks",
    "public.users",
    "public.v10_connector_token_vault",
    "public.v10_connector_auth_challenges",
    "public.verification_tokens",
    "public.webhook_subscriptions",
    "public.webhooks",
}

EXACT_COLUMN_EXCLUSIONS = {
    "public.integration_webhooks": {
        "columns": ["webhook_secret"],
        "reason": "Webhook signing material is excluded while tenant-owned delivery configuration remains exportable.",
        "sourceEvidence": "server/migrations/256_integrations_system.sql:125; server/src/services/integrations/integrationService.ts",
    },
    "public.interview_distributions": {
        "columns": ["recipient_email", "recipient_name", "public_token", "revoked_by"],
        "reason": "DEC-493 preserves distribution business state while removing recipient identity, public access tokens, and revoker identity.",
        "sourceEvidence": "server/src/services/interviewEnterpriseService.ts:298,356,380,403,412",
    },
    "public.interview_ai_parse_log": {"columns": ["applied_by"], "reason": "DEC-493 removes the applying person identity while preserving parsed interview content.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_assignment_events": {"columns": ["actor_id"], "reason": "DEC-493 removes actor identity while preserving assignment governance history.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_candidate_handoffs": {"columns": ["created_by"], "reason": "DEC-493 removes creator identity while preserving governed candidate handoff content.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_evidence_access_log": {"columns": ["actor_id", "ip_address"], "reason": "DEC-493 removes actor and network identity while preserving evidence access history.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_insight_activity": {"columns": ["user_id"], "reason": "DEC-493 removes user identity while preserving insight activity history.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_inference_runs": {"columns": ["created_by"], "reason": "DEC-493 removes creator identity while preserving inference provenance and results.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
    "public.interview_report_packs": {"columns": ["created_by"], "reason": "DEC-493 removes creator identity while preserving report-pack business content.", "sourceEvidence": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json"},
}

# `state` is frequently business lifecycle data. It is never excluded by name.
# Every exportable occurrence in the measured schema must instead be reviewed
# here. OAuth/PKCE credential state remains protected because its exact tables
# are excluded in full by CREDENTIAL_TABLES.
BUSINESS_LIFECYCLE_STATE_TABLES = {
    "public.artifact_handoff_proposals",
    "public.artifact_lineage_operation_claims",
    "public.finance_prediction_conflict_resolutions",
    "public.chat_target_mapping_receipts",
    "public.lane_decisions",
    "public.method_sessions",
    "public.myw_agent_materialization_proposals",
    "public.partner_organizations",
    "public.teresa_proposals",
    "public.v8_ai_suggestions",
    "public.v8_execution_runs",
    "public.v8_lane_decisions",
    "public.v8_notification_records",
    "public.v8_workspace_sessions",
}

SENSITIVE_COLUMN_NAMES = {
    "access_token", "access_token_encrypted", "api_key", "api_key_hash", "backup_codes",
    "backup_codes_json", "challenge_hash", "claim_fencing_token", "claim_owner_token",
    "claim_token", "client_ip_hash", "client_secret", "client_secret_encrypted", "code_hash",
    "confirmation_token", "cookie_id", "credential_hash", "credential_id", "email_change_token",
    "email_verification_token", "encrypted_key", "encrypted_token_blob", "execution_fencing_token",
    "execution_owner_token", "fencing_token", "hmac_secret", "ip_hash", "key_hash",
    "lease_fencing_token", "lease_token", "link_token", "mfa_backup_codes", "mfa_recovery_email",
    "mfa_secret", "new_credential_ref", "old_credential_ref", "owner_token", "password",
    "password_hash", "pkce_verifier", "private_key", "public_jwt_secret", "public_token",
    "push_token", "recovery_email", "refresh_token", "refresh_token_encrypted",
    "refresh_token_hash", "resume_token", "resume_token_hash", "retrieval_scope_token", "secret",
    "secret_hash", "secret_key", "session_token", "session_token_hash", "share_link_token",
    "share_password", "share_token", "signing_secret", "token", "token_hash", "token_jti",
    "tracking_token", "unsubscribe_token", "user_agent_hash", "verification_token", "viewer_token",
    "webhook_secret",
}

SEMANTIC_OVERRIDES = {
    identity: ("INTEGRATIONS" if identity == "public.integration_webhooks" else "INTERVIEW", f"EXPLICIT_POLICY docs/ssot/organization-export-explicit-semantic-overrides.e1.json::{identity}")
    for identity in {
        "public.integration_webhooks", "public.interview_ai_parse_log", "public.interview_answers",
        "public.interview_assignment_events", "public.interview_messages", "public.interview_template_questions",
        "public.interview_candidate_handoffs", "public.interview_evidence_access_log",
        "public.interview_insight_activity", "public.interview_inference_runs",
        "public.interview_report_packs", "public.interview_distributions",
    }
}

DERIVED_OVERRIDES = {
    "public._migration_518_done": {
        "family": "MIGRATION_CONTROL",
        "reason": "The single completion marker is deterministically recreated by applying migration 518 and contains no tenant-authored content.",
        "sourceEvidence": "server/migrations/518_interview_tool_report_templates.sql:179-180",
        "derivedFrom": {
            "kind": "REBUILD_PROCEDURE",
            "sourcePath": "server/migrations/518_interview_tool_report_templates.sql",
            "procedure": "Run migration 518 to recreate the single completion marker deterministically.",
        },
    }
}


def identity(row: dict) -> str:
    return f"{row['schema']}.{row['table']}"


def column_names(row: dict) -> set[str]:
    return {column["name"] for column in row.get("columns", [])}


def direct_column(row: dict) -> str | None:
    columns = column_names(row)
    return next((column for column in TENANT_COLUMNS if column in columns), None)


def compute_paths(rows: list[dict]) -> dict[str, list[dict]]:
    by_id = {identity(row): row for row in rows}
    paths: dict[str, list[dict]] = {}
    queue = deque()
    for table_id, row in by_id.items():
        if table_id == "public.organizations" or direct_column(row):
            paths[table_id] = []
            queue.append(table_id)

    # A child becomes owned only through an exact live FK edge into an already
    # owned parent. Stable sorting makes the chosen proof deterministic when
    # more than one valid path exists.
    children: dict[str, list[tuple[str, dict]]] = {}
    for child_id, row in by_id.items():
        for fk in row.get("foreignKeys", []):
            parent_id = f"{fk['parentSchema']}.{fk['parentTable']}"
            children.setdefault(parent_id, []).append((child_id, fk))
    for edges in children.values():
        edges.sort(key=lambda item: (item[0], json.dumps(item[1], sort_keys=True)))

    while queue:
        parent_id = queue.popleft()
        for child_id, fk in children.get(parent_id, []):
            if child_id in paths:
                continue
            paths[child_id] = [
                {
                    "column": fk["column"],
                    "parentSchema": fk["parentSchema"],
                    "parentTable": fk["parentTable"],
                    "parentColumn": fk["parentColumn"],
                },
                *paths[parent_id],
            ]
            queue.append(child_id)
    return paths


def materialize(inventory: dict, approved: dict, semantic_index: dict | None = None, v8_dispositions: dict | None = None, public_dispositions: dict | None = None) -> dict:
    rows = copy.deepcopy(inventory["tables"])
    by_id = {identity(row): row for row in rows}
    approved_by_id = {f"{row['schema']}.{row['table']}": row for row in approved["tables"]}
    semantic_by_id = {
        f"{row['schema']}.{row['table']}": row for row in (semantic_index or {}).get("entries", [])
    }
    v8_disposition_by_id = {
        row["identity"]: row for row in (v8_dispositions or {}).get("entries", [])
    }
    public_disposition_by_id = {
        row["identity"]: row for row in (public_dispositions or {}).get("entries", [])
    }
    expected_inactive_v8 = {
        table_id for table_id, row in semantic_by_id.items()
        if table_id.startswith("v8.") and not row.get("sources")
    }
    if v8_dispositions is not None and set(v8_disposition_by_id) != expected_inactive_v8:
        raise ValueError("v8 dispositions must exactly cover schema-v8 relations without qualified active writers")
    missing_credentials = sorted(CREDENTIAL_TABLES - by_id.keys())
    if missing_credentials:
        raise ValueError(f"credential identities missing from live inventory: {missing_credentials}")
    missing_approved = sorted(approved_by_id.keys() - by_id.keys())
    if missing_approved:
        raise ValueError(f"approved identities missing from live inventory: {missing_approved}")

    paths = compute_paths(rows)
    expected_public_dispositions = {
        table_id for table_id in paths
        if table_id.startswith("public.")
        and table_id not in approved_by_id
        and table_id not in SEMANTIC_OVERRIDES
        and table_id not in CREDENTIAL_TABLES
        and not semantic_by_id.get(table_id, {}).get("sources")
        and table_id not in DERIVED_OVERRIDES
    }
    if public_dispositions is not None and set(public_disposition_by_id) != expected_public_dispositions:
        raise ValueError("public dispositions must exactly cover tenant-owned public relations without semantic writer evidence")
    decisions = []
    for table_id in sorted(by_id):
        row = by_id[table_id]
        base = {"schema": row["schema"], "table": row["table"]}
        if table_id in DERIVED_OVERRIDES:
            decision = {**base, "category": "DERIVED", **DERIVED_OVERRIDES[table_id]}
        elif table_id in public_disposition_by_id and public_disposition_by_id[table_id]["classification"] == "EXCLUDE_SECURITY":
            disposition = public_disposition_by_id[table_id]
            decision = {
                **base,
                "category": "EXCLUDE_SECURITY",
                "family": disposition["family"],
                "reason": disposition["reason"],
                "sourceEvidence": "; ".join(disposition["sourceEvidence"]),
                "exclusionBasis": disposition["exclusionBasis"],
                "publicDisposition": True,
            }
        elif table_id in CREDENTIAL_TABLES:
            decision = {
                **base,
                "category": "EXCLUDE_SECURITY",
                "family": "SECURITY_CREDENTIALS_AND_SESSIONS",
                "reason": "The reviewed relation contains authentication, credential, session, recovery, signing, or token-vault material and is excluded in full.",
                "sourceEvidence": f"staging-schema-inventory.json::{table_id}; reviewed exact credential identity list",
                "exclusionBasis": "CREDENTIAL_OR_SESSION_MATERIAL",
            }
        elif table_id in v8_disposition_by_id:
            disposition = v8_disposition_by_id[table_id]
            decision = {
                **base,
                "category": "EXCLUDE_SECURITY",
                "family": "V8_CREDENTIAL_SECURITY" if disposition["disposition"] == "SECURITY_CREDENTIAL_STATE" else "V8_HISTORICAL_INACTIVE",
                "reason": disposition["reason"],
                "sourceEvidence": "; ".join(disposition["sourceEvidence"]),
                "exclusionBasis": disposition["exclusionBasis"],
                "v8Disposition": disposition["disposition"],
            }
        elif table_id in paths and (
            table_id in approved_by_id
            or semantic_by_id.get(table_id, {}).get("sources")
            or table_id in SEMANTIC_OVERRIDES
            or public_disposition_by_id.get(table_id, {}).get("classification") == "EXPORT"
        ):
            previous = approved_by_id.get(table_id, {})
            semantic = semantic_by_id.get(table_id, {})
            override_family, override_source = SEMANTIC_OVERRIDES.get(table_id, (None, None))
            public_disposition = public_disposition_by_id.get(table_id)
            column = direct_column(row)
            if table_id == "public.organizations":
                ownership = {"kind": "ORGANIZATION_ROOT", "column": "id"}
                evidence = "staging-schema-inventory.json::public.organizations primary organization root"
            elif column:
                ownership = {"kind": "DIRECT_COLUMN", "column": column}
                evidence = f"staging-schema-inventory.json::{table_id} live column {column}"
            else:
                ownership = {"kind": "FOREIGN_KEY_PATH", "path": paths[table_id]}
                evidence = f"staging-schema-inventory.json::{table_id} exact live FK path to tenant root"
            decision = {
                **base,
                "category": "EXPORT",
                "family": previous.get("family", public_disposition.get("family") if public_disposition else override_family or semantic.get("family", "SEMANTIC_SOURCE_MISSING")),
                "reason": previous.get(
                    "reason",
                    "The live schema proves this tenant-owned relation through an exact organization discriminator or foreign-key path.",
                ),
                "sourceEvidence": previous.get("sourceEvidence", "; ".join(public_disposition["sourceEvidence"]) if public_disposition else override_source or semantic.get("sourceEvidence", evidence)),
                "ownership": ownership,
                "semanticEvidence": (
                    [{"kind": "PUBLIC_BUSINESS_DISPOSITION", "path": "docs/ssot/organization-export-public-business-dispositions.e1.json", "identity": table_id}]
                    if public_disposition
                    else
                    [{"kind": "EXPLICIT_POLICY", "path": "docs/ssot/organization-export-explicit-semantic-overrides.e1.json", "identity": table_id}]
                    if table_id in SEMANTIC_OVERRIDES
                    else semantic.get("sources", [])
                ),
            }
        else:
            has_tenant_path = table_id in paths
            decision = {
                **base,
                "category": "EXCLUDE_SECURITY",
                "family": "ACTIVE_SEMANTIC_POLICY_MISSING" if has_tenant_path else "NO_PROVABLE_TENANT_BOUNDARY",
                "reason": (
                    "The relation has a structural tenant path but no active semantic writer or reviewed privacy contract, so export fails closed."
                    if has_tenant_path
                    else "The live schema proves no organization discriminator or foreign-key path, so exporting rows could cross tenant boundaries."
                ),
                "sourceEvidence": (
                    f"organization-export-semantic-source-index.e1.json::{table_id} ACTIVE_SEMANTIC_SOURCE_MISSING"
                    if has_tenant_path
                    else f"staging-schema-inventory.json::{table_id} reviewed ownership graph has no tenant path"
                ),
                "exclusionBasis": "ACTIVE_SEMANTIC_POLICY_MISSING" if has_tenant_path else "NO_PROVABLE_TENANT_BOUNDARY",
            }
        if decision["category"] == "EXPORT":
            live_columns = [column["name"] for column in row["columns"]]
            has_state = "state" in live_columns
            if has_state and table_id not in BUSINESS_LIFECYCLE_STATE_TABLES:
                raise ValueError(f"unreviewed exportable state column: {table_id}.state")
            if table_id in BUSINESS_LIFECYCLE_STATE_TABLES and not has_state:
                raise ValueError(f"reviewed lifecycle state column absent from live schema: {table_id}.state")
            exact_policy = EXACT_COLUMN_EXCLUSIONS.get(table_id, {})
            excluded = {column for column in live_columns if column in SENSITIVE_COLUMN_NAMES}
            excluded.update(exact_policy.get("columns", []))
            column_policy = {
                "reason": exact_policy.get("reason", "The exact projection excludes reviewed credential, session, signing, access-link, and recovery columns; all remaining columns are explicitly listed."),
                "sourceEvidence": exact_policy.get("sourceEvidence", decision["sourceEvidence"]),
            }
            missing_exclusions = sorted(excluded - set(live_columns))
            if missing_exclusions:
                raise ValueError(f"column exclusions absent from {table_id}: {missing_exclusions}")
            decision["projection"] = [column for column in live_columns if column not in excluded]
            decision["excludedColumns"] = [column for column in live_columns if column in excluded]
            decision["columnPolicy"] = {
                "reason": column_policy["reason"],
                "sourceEvidence": column_policy["sourceEvidence"],
            }
            decision["columnDecisions"] = [
                {
                    "column": column,
                    "category": "EXCLUDE_SECURITY_COLUMN" if column in excluded else "EXPORT_COLUMN",
                    "reason": (
                        column_policy["reason"]
                        if column in excluded
                        else "The exact reviewed policy classifies this state as business lifecycle data, not credential exchange state."
                        if column == "state"
                        else "The semantic table policy explicitly includes this non-security business column."
                    ),
                    "sourceEvidence": column_policy["sourceEvidence"] if column in excluded else decision["sourceEvidence"],
                }
                for column in live_columns
            ]
        decision["reviewScope"] = "TABLE_CATEGORY_OWNERSHIP_AND_EXACT_COLUMNS; runtime completeness remains independently gated"
        decisions.append(decision)

    counts = Counter(row["category"] for row in decisions)
    return {
        "policyVersion": "tenant-export-classification-e1-complete-1",
        "baseCommit": inventory["baseCommit"],
        "schemaSnapshotSha256": inventory["schemaSnapshotSha256"],
        "authorityRule": "Only the exact identities materialized here are classified; names and catalog discovery alone grant no export or derivation authority.",
        "rules": [
            "Exact reviewed credential identities are EXCLUDE_SECURITY.",
            "An exact live organization discriminator or foreign-key path is required for EXPORT.",
            "A relation without a provable tenant path is EXCLUDE_SECURITY.",
            "DERIVED requires an exact override with a checked repository rebuild source.",
        ],
        "counts": {**{key: counts.get(key, 0) for key in ("EXPORT", "EXCLUDE_SECURITY", "DERIVED")}, "total": len(decisions)},
        "tables": decisions,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--approved", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--semantic-index", type=Path)
    parser.add_argument("--v8-dispositions", type=Path)
    parser.add_argument("--public-dispositions", type=Path)
    parser.add_argument("--csv-out", type=Path)
    parser.add_argument("--required-exclusions-out", type=Path)
    parser.add_argument("--required-lifecycle-state-out", type=Path)
    args = parser.parse_args()
    result = materialize(
        json.loads(args.inventory.read_text(encoding="utf-8")),
        json.loads(args.approved.read_text(encoding="utf-8")),
        json.loads(args.semantic_index.read_text(encoding="utf-8")) if args.semantic_index else None,
        json.loads(args.v8_dispositions.read_text(encoding="utf-8")) if args.v8_dispositions else None,
        json.loads(args.public_dispositions.read_text(encoding="utf-8")) if args.public_dispositions else None,
    )
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.csv_out:
        import csv

        with args.csv_out.open("w", encoding="utf-8", newline="") as handle:
            fieldnames = ("schema", "table", "category", "family", "reason", "sourceEvidence", "exclusionBasis", "ownership")
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            for decision in result["tables"]:
                writer.writerow(
                    {
                        **{key: decision.get(key, "") for key in fieldnames},
                        "ownership": json.dumps(
                            decision.get("ownership", decision.get("derivedFrom", {})),
                            sort_keys=True,
                            separators=(",", ":"),
                        ),
                    }
                )
    if args.required_exclusions_out:
        required = {
            "policyVersion": "organization-export-required-column-exclusions-e1-1",
            "tables": [
                {
                    "schema": decision["schema"],
                    "table": decision["table"],
                    "columns": decision["excludedColumns"],
                    "sourceEvidence": decision["columnPolicy"]["sourceEvidence"],
                }
                for decision in result["tables"]
                if decision["category"] == "EXPORT" and decision["excludedColumns"]
            ],
        }
        args.required_exclusions_out.write_text(json.dumps(required, indent=2) + "\n", encoding="utf-8")
    if args.required_lifecycle_state_out:
        lifecycle = {
            "policyVersion": "organization-export-required-lifecycle-state-e1-1",
            "credentialStateRule": "Credential exchange state is excluded through exact whole-table CREDENTIAL_TABLES entries; business lifecycle state is exported only for the identities below.",
            "tables": [
                {"schema": identity.split(".", 1)[0], "table": identity.split(".", 1)[1], "column": "state"}
                for identity in sorted(BUSINESS_LIFECYCLE_STATE_TABLES)
            ],
        }
        args.required_lifecycle_state_out.write_text(json.dumps(lifecycle, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["counts"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
