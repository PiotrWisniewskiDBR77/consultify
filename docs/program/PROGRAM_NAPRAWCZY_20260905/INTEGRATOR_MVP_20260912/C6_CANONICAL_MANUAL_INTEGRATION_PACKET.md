# C6 canonical MANUAL_HUB current-content checkpoint

Exact source: **459069bf0e93d1b4a485e33d5e42856d8e2dab85**, parent **7017c7854b118eba50391cb1fb37f531f5627876**. Clean worktree verified. Normal commit hooks completed successfully (`commit-canonical-manual.log`); final server tsc exit 0 (`server-tsc-canonical-manual-final.log`). This is a bounded current-content resolver, not full E4/export/MVP acceptance.

## Source and integration

Six changed paths and SHA-256 hashes are in `canonical-manual-manifest.json` alongside exact test fullNames. Preceding lineage checkpoint adds seven canonical store contracts; the present delta adds verified MANUAL_HUB source_proposal/initiative current content only. Apply narrowly after reconciled export prerequisites, never merge held base 0025 wholesale. Root RC2 rollback-discard fix, CSV manifest and UI disclosure are independent prerequisites/changes; author tests are not combined RC2 proof.

- `server/src/routes/__tests__/organization-export-canonical.gateway.pg.test.ts`
- `server/src/services/__tests__/organizationExportCanonicalContract.test.ts`
- `server/src/services/organizationExportCanonicalContract.ts`
- `server/src/services/organizationExportContract.ts`
- `server/src/services/organizationExportManualInitiativeContent.ts`
- `server/src/services/organizationExportService.ts`

## Behavior and privacy

Full content requires same-org approved project, exact source proposal identity/version, MANUAL_HUB provenance, its sole own evidence URI, CURRENT source and same-org SOURCE_REGISTRATION relation with matching proposal/source versions. Current proposal aggregate version 1, candidate version 2 and initiative source proposalVersion 2 retain their actual distinct meanings. Unsupported, ambiguous, foreign or additional private-reference provenance falls back to lineage metadata with unresolved completeness. Credential redaction still applies. Current-parent authorization does not expose audit/card/history or typed child payloads.

## Evidence

Author unit denominator: 13 identical fullNames. Extra-reference mutation: 12 PASS/1 FAIL; registration relation bypass: 11 PASS/2 FAIL; restored final: 13 PASS. Real ApiGateway/JWT/PG denominator: one identical scenario; relaxed reference guard causes private content leakage and 1 FAIL; restored source 1 PASS. All JSON filenames/counts/fullNames are preserved in the manifest.

The real scenario uses fresh A/B organizations: POST project → source proposal → registration → PATCH metadata → GET canonical initiative. JSON and CSV contain edited owned content and exclude foreign and unverified private-reference content. SQL readback preserves initiative v2, source aggregate v1, candidate v2, source version 1, registration lineage, six own command receipts, audit versions 1/2. Full six-store row snapshots remain unchanged by export. The private-reference fixture is not an actual Interview bridge writer and does not prove that bridge. Absence of a legacy mirror table is not a staging compatibility proof.

Independent scope review reported 13/13 unit and 1/1 Gateway PASS against all six matching hashes. Its independent output/report remains separately owned by scope.

## Runtime identity and schema seed

Local 6457 is verified Colima SSH forwarding to cx-codex6-pg, database cx6_export_contract, user consultify. Original cx6_swieza was read only for actual catalog and schema. API 4216 is temporary per test and closes afterward. No test/build/tsc processes remain active. Resources were returned by scope and handed exclusively to root for combined retest; author will not access DB/API during root ownership.

Only ten actual schema-only canonical tables were added to disposable DB (`canonical-schema.sql`, `canonical-schema-apply.log`), plus the standard PRODUCT governance seed from migration 932 (organization *, DEFAULT, consultify-standard v1/STANDARD, separationOfDuties true, selfApproval false). It is a product configuration seed, not copied customer data or a fake lifecycle approval. Seven export canonical catalog shapes match actual source column types/PK/FK (`canonical-catalog-comparison.json`, `canonical-business-catalog.jsonl`). Fresh fixture records are cleaned only by their own IDs; standard policy remains. No restore/reset or production operation.

## Reproduction

Unit: RUN_DB_TESTS=0 MOCK_DB=true NODE_ENV=test npx vitest run --root server --config <WT>/server/vitest.config.ts src/services/__tests__/organizationExportCanonicalContract.test.ts --retry=0 --maxWorkers=1 --reporter=json --outputFile=<NEW_OUT>.json

Gateway: the external `run-test.py` reads the existing private local connection configuration without printing it. Copy it externally and change hardcoded WT/OUT for independent evidence. Set ENABLE_V8_GLOBAL=true RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce ENABLE_TEST_AUTH_BYPASS=false ENABLE_INITIATIVE_UNIFIED_READ=true; run with a new prefix and src/routes/__tests__/organization-export-canonical.gateway.pg.test.ts. It supplies RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DB_MANAGED_SCHEMA=false NODE_ENV=test and the explicit C6_EXPORT_TEST_DATABASE guard. Never overwrite author outputs. Coordinate exclusive 6457/4216 first.

## Remaining denominator

Current MANUAL_HUB is covered; source-backed initiatives, arbitrary revisions, sensitive historical content, tasks/decisions and Materials remain open. Seven lineage tables are not seven complete business exports. Business writer in v8 remains NOT_PROVEN (119/121 namespace collisions); no business routing/search_path/flag bypass was introduced. Full tenant completeness remains false whenever unresolved rows/tables exist. No purge/retention or held delete/AI budget acceptance is implied.
