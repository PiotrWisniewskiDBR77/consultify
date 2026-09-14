# Organization export classification rules — F2-E E1

Status: **complete table-category checkpoint; runtime E1 remains incomplete.** This document does not declare the archive, privacy projection, streaming path, permissions, or runtime proofs complete and does not authorize a table absent from the explicit decisions file.

## Authority boundary

The live PostgreSQL catalog is the denominator, never the runtime allowlist. A table is classified only by an exact `{schema, table}` entry materialized in `organization-export-classification-decisions.e1-wip.json`. Prefixes, suffixes, regular expressions and product-sounding names never assign `EXPORT`, `EXCLUDE_SECURITY` or `DERIVED`. The materializer may prove ownership from the exact live discriminator or foreign-key chain, then writes the resulting schema-qualified identity to the reviewed policy; runtime code consumes the exact policy, not catalog discovery.

The classification order is explicit:

1. prove whether the relation contains authentication, credential or session material;
2. prove whether the relation is reproducible from named canonical sources or a named repository procedure;
3. otherwise prove tenant ownership through an exact organization discriminator or foreign-key chain before assigning the table category `EXPORT`;
4. fail closed as `EXCLUDE_SECURITY` when no tenant boundary can be proved;
5. separately prove counterparty behavior and a safe column projection before runtime delivery.

## EXPORT

`EXPORT` means the organization owns the business record and the runtime contract supplies all of the following:

- an exact schema-qualified identity;
- a direct organization discriminator or a reviewed FK path to a tenant-owned parent;
- separately named counterparty columns that never grant owner access;
- an explicit projection of every included column;
- explicit excluded columns for credentials and person identification;
- a family-specific privacy projector where content rules depend on confidentiality or provenance;
- a source pointer to the writer and policy evidence.

DEC-493 requires Interview content and personal-task content to remain in the export while person identification is excluded. Therefore table-level `EXPORT` is insufficient proof for those families: their final acceptance also requires column/privacy tests showing preserved content and absent identity for both JSON and CSV.

## EXCLUDE_SECURITY

`EXCLUDE_SECURITY` covers exact relations whose rows are credentials, authentication/session state or equivalent security material, plus relations for which the live graph proves no tenant boundary. The export service must not emit them. A table name resembling `token`, `session` or `secret` is only a review signal; it is not a classification rule. Audit records about authentication events are not automatically credential material and require separate review.

## DERIVED

`DERIVED` means every row can be recreated deterministically and carries no unique business history. It requires one structured `derivedFrom` form:

- `TABLES`: a non-empty, unique list of schema-qualified source tables. Every source must be present in the same inventory, must be `EXPORT` or another valid `DERIVED`, and the dependency graph must be acyclic and terminate in exported business sources.
- `REBUILD_PROCEDURE`: a repository-relative `sourcePath` under `server/`, `src/`, `scripts/` or `docs/ssot/`, plus an actionable sentence describing the rebuild procedure.

A cache, snapshot, queue, receipt, outbox row or aggregate is not `DERIVED` merely because its name suggests one. Immutable receipts, audit events, delivery history, user edits and snapshots that preserve otherwise unavailable state are business history and require `EXPORT` or a deliberate security exclusion.

## Counts and CI guard

The verifier recomputes `public`, `v8`, `total`, `classified` and `unresolved` from the rows and rejects inconsistent declared counts. It rejects duplicate identities, missing family/reason, unknown classifications, malformed `derivedFrom`, absent/self/security sources and cycles. A newly discovered relation is emitted as `UNRESOLVED`, so the guard remains red even if declared counts are falsified.

Current measured table-category state on schema `bf580f…`:

- live denominator: 1930 (`public=1809`, `v8=121`);
- exact existing v9 table categories at baseline: 25 (`EXPORT=21`, `EXCLUDE_SECURITY=4`);
- materialized categories after the fourth independent HOLD correction: 1930 (`EXPORT=1379`, `EXCLUDE_SECURITY=550`, `DERIVED=1`);
- `UNRESOLVED=0` at the table-category gate.

The correction removes generated `SOURCE_*` family labels and accepts semantic evidence only when an independent parser finds an executable SQL relation reference or an exact reviewed export-policy entry after comments are stripped. SQL evidence is schema-aware: an unqualified application relation resolves only to `public`, while a `v8` relation requires an exact `v8.<table>` token on the recorded source line. Of 121 physical `v8` relations, 119 fail closed as `EXCLUDE_SECURITY` because they have no exact schema-qualified active writer; `v8.v8_feature_flags` and `v8.v8_shadow_comparisons` retain `EXPORT` from exact qualified writers. Relations without active evidence fail closed unless they have an exact entry in `organization-export-explicit-semantic-overrides.e1.json`. Each `EXPORT` row carries an exact `projection`, `excludedColumns`, a decision for every live column, and parser-verifiable source evidence. A separate required-exclusions policy makes security mutations fail even if both the projection and the per-column decision are altered together.

`state` is not a globally sensitive column name. Exact credential relations such as `public.sso_auth_states` and `public.v10_connector_auth_challenges` remain excluded in full, while the 13 exportable measured business lifecycle `state` columns are listed in `organization-export-required-lifecycle-state-exports.e1.json` and must remain in their projections. The verifier rejects both removing one of those columns and adding an exportable `state` without an exact lifecycle entry.

Column privacy, archive generation, streaming, resume, progress, permissions, audit events and runtime proof remain separate E1 gates.
