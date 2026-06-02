# Validation Matrix — Table Studio Foundation Block

**Block ID:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Template basis:** `.cursor/SPRINT_GATE_CHECKLIST.md` (Sprint Exit Gate)
**Status:** `PLANNED`

This matrix is binding for Sprint 6 (QA Gate). Every row must be GREEN (or have explicit `PASS_WITH_P2` mitigation) before the block can claim DoD.

---

## Layer 1 — Static / Lint / Type

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L1.1 | Frontend lint | `cd DRD/consultify && npm run lint` | 0 errors, 0 new warnings | Agent D |
| L1.2 | Frontend typecheck | `cd DRD/consultify && npm run type-check` | exit 0 | Agent D |
| L1.3 | Backend typecheck | `cd DRD/consultify/server && npm run typecheck` | exit 0 | Agent A |
| L1.4 | DBR77 hex literal scan (new files only) | `rg -n "#[0-9a-fA-F]{3,6}\b" DRD/consultify/src/components/AIChat/KimiWorkspace/tabelePreview DRD/consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` | 0 hits OR all hits inside comments | Agent C |
| L1.5 | Untouched-files guard | `git diff --name-only main...HEAD \| grep -E "(MyWork/table/(ViewRouter\|TableDataProvider\|TableToolbar\|TableTabStrip\|tableTypes)\|table-platform\.routes\.ts\|TableContextService\|ChatToSchemaService\|AuditService\|RelationService\|WordyView\|PrezentacjeView\|ExceleView\|ReportsAndPresentations)"` | 0 hits | Orchestrator |

## Layer 2 — Unit Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L2.1 | `RelationExplainabilityService` | `cd DRD/consultify/server && npm run test -- RelationExplainabilityService` | green; covers happy path, ACL filter, empty relations, malformed record | Agent A |
| L2.2 | All backend unit tests (regression) | `cd DRD/consultify/server && npm run test:backend` | no new failures vs main baseline | Agent A |
| L2.3 | Frontend unit tests (regression) | `cd DRD/consultify && npm run test:unit` | green | Agent D |
| L2.4 | `useKimiArtifactPipeline` 4-lane mapping | `cd DRD/consultify && vitest run tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts` | green for `wordy`, `excele`, `prezentacje`, `tabele` | Agent D |

## Layer 3 — Component Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L3.1 | `TabeleView` home → generation → preview | `cd DRD/consultify && vitest run tests/components/AIChat/KimiWorkspace/TabeleView.test.tsx` | green: home renders, goal triggers pipeline, preview switches to `tabele` | Agent D |
| L3.2 | `KimiWorkspaceShell` lane=tabele rendering | `cd DRD/consultify && vitest run tests/components/AIChat/KimiWorkspace/KimiWorkspaceShell.test.tsx` | green: sky accent, label "Tabele Studio" / "Tabele" PL | Agent D |
| L3.3 | `TabelePreviewLayout` sectioned render | `cd DRD/consultify && vitest run tests/components/AIChat/KimiWorkspace/tabelePreview` | green: cover, KPI, schema, records, relations, rationale all render | Agent C |
| L3.4 | `ArtifactModuleHome` lane=tabele | `cd DRD/consultify && vitest run tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx` | green: 8 builtin templates render, "Tabele" laneLabel, sky accent | Agent D |

## Layer 4 — Integration Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L4.1 | `GET /api/table-platform/tables/:tableId/records/:recordId/relations/explain` happy path | `cd DRD/consultify && npm run test:integration -- table-platform.relations-explain` | 200, payload shape `{relations:[{targetTableId, targetRecordId, reason, confidence, evidence[]}]}` | Agent A |
| L4.2 | Cross-tenant 403 on `relations/explain` | same suite | actor from tenant A asking about table in tenant B → 403 | Agent A |
| L4.3 | ACL filter on `relations/explain` (records actor cannot read are excluded) | same suite | rendered relations exclude records where actor lacks read permission | Agent A |
| L4.4 | ACL audit on existing `/schema/proposals/*` (READ-ONLY; report only) | manual + new `tests/integration/routes/table-platform.schema-proposals-acl-audit.test.ts` (new test file, no source edits) | every governance route checks tenant; any miss = P0 finding (does NOT block this block; filed as follow-up) | Agent A |

## Layer 5 — E2E Smoke

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L5.1 | `/tabele?view=new` → generate → preview → deep link | `cd DRD/consultify && npx playwright test tests/e2e/smoke/tabele-foundation.spec.ts --project=chromium --workers=1` | passes against staging | Agent D |
| L5.2 | Sidebar Tabele entry visible & navigates correctly | same suite | passes | Agent D |
| L5.3 | Reopen-from-library deep link `?artifactId=...` | same suite | preview hydrates from library data | Agent D |

## Layer 6 — Manual / Anygravity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L6.1 | P0 trial card filed in `DRD/testy_antygravity/TEST_QUEUE.md` | per `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md` | card filed; trial executed; result recorded | Orchestrator |
| L6.2 | DBR77 visual review | side-by-side with `color-system.md` swatches | screenshots attached to closeout | Agent C |
| L6.3 | Menu 3 placement audit | grep + visual: AI buttons only in shell header right-slot | 0 violations | Orchestrator |
| L6.4 | Word-canvas idiom parity vs Wordy | side-by-side screenshot | sectioned layout, typography hierarchy match | Agent C |

## Layer 7 — Security / Tenant

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L7.1 | Tenant scope on every new endpoint | code review + integration test | every read/write path resolves `tenant_id` from auth | Agent A |
| L7.2 | No silent execution of AI schema mutations | code review | every governance call returns `proposalId`; no auto-execute path | Agent A |
| L7.3 | Prompt-injection guard | code review of `RelationExplainabilityService` reasoning | record snippets are quote-fenced; no tool-call acceptance from record body | Agent A |
| L7.4 | Relation explanation ACL filter | integration test L4.3 | targets actor cannot read are excluded | Agent A |

## Layer 8 — Performance / Capacity (light)

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L8.1 | `relations/explain` p95 ≤ 500 ms on 50-record fixture | `tests/integration/perf/relations-explain.bench.test.ts` | p95 < 500 ms | Agent A |
| L8.2 | Tabele preview render < 100 ms for 25 rows × 10 cols | profile in component test | render < 100 ms | Agent C |

---

## Sprint Exit Gate (per `.cursor/SPRINT_GATE_CHECKLIST.md`)

- [ ] L1.1–L1.5 GREEN
- [ ] L2.1–L2.4 GREEN
- [ ] L3.1–L3.4 GREEN
- [ ] L4.1–L4.3 GREEN; L4.4 reported (P0 if any leak)
- [ ] L5.1–L5.3 GREEN
- [ ] L6.1–L6.4 RECORDED
- [ ] L7.1–L7.4 GREEN
- [ ] L8.1–L8.2 GREEN
- [ ] DoD checklist in `00_TASK_PACKET.md` §5 fully checked
- [ ] Release recommendation set: `GO` / `GO_WITH_CONSTRAINTS` / `NO_GO`

---

## Baseline / Reference

- Existing 3-step preflight: `API`, `DB-Compat`, `UI Smoke` per `DRD/testy_antygravity/TESTING_OPERATING_SYSTEM.md`.
- Test config: `consultify/vitest.config.ts`, `consultify/playwright.config.ts`, `consultify/playwright.smoke.config.ts`.
- Baseline must be captured BEFORE Sprint 1 starts and stored in `evidence/` subfolder of this packet (created on demand).
