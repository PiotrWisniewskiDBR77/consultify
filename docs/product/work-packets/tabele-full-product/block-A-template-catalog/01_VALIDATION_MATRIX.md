# Validation Matrix — Block A: Template Catalog

**Block ID:** `TABELE_BLOCK_A_TEMPLATE_CATALOG`
**Template basis:** `.cursor/SPRINT_GATE_CHECKLIST.md`
**Status:** `PLANNED`

Every row must be GREEN (or `PASS_WITH_P2` with explicit mitigation) before block exits `GO`.

---

## Layer 1 — Static / Lint / Type

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L1.1 | Frontend lint | `cd DRD/consultify && npm run lint` | 0 errors | Agent D |
| L1.2 | Frontend typecheck | `cd DRD/consultify && npm run type-check` | exit 0 | Agent D |
| L1.3 | Backend typecheck | `cd DRD/consultify/server && npm run typecheck` | exit 0 | Agent A |
| L1.4 | DBR77 hex scan on new components | `rg -n "#[0-9a-fA-F]{3,6}\b" DRD/consultify/src/components/MyWork/table/cells DRD/consultify/src/components/AIChat/KimiWorkspace/templateLifecycle` | 0 hits | Agent C |
| L1.5 | i18n keys present | `cd DRD/consultify && npm run i18n:check` | new keys present in EN + PL; no missing | Agent C |
| L1.6 | Untouched-files guard | git diff check on Foundation Block files | 0 hits | Orchestrator |

## Layer 2 — Unit Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L2.1 | `TemplateLifecycleService` | `cd DRD/consultify/server && npm run test -- TemplateLifecycleService` | green: approve, deprecate, list filtering, owner check, cross-tenant 403 | Agent A |
| L2.2 | `SpecializedFieldTypes` validators | `cd DRD/consultify/server && npm run test -- SpecializedFieldTypes` | green: each of 5 types has happy path + invalid input + edge case | Agent A |
| L2.3 | `tabele_consulting_templates` seeder | `cd DRD/consultify/server && npm run test -- tabele_consulting_templates` | green: 30 entries; 12 status=approved; 18 status=draft; schema_snapshot well-formed | Agent A |
| L2.4 | Frontend cell renderer tests | `cd DRD/consultify && vitest run tests/components/MyWork/table/cells` | green: 5 renderer test files | Agent B |

## Layer 3 — Component Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L3.1 | `TemplateLifecycleBadge` | `vitest run tests/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.test.tsx` | renders `approved`, `draft`, `deprecated` variants | Agent B |
| L3.2 | `TemplateLifecycleFilter` | `vitest run tests/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.test.tsx` | filters BUILTIN_TEMPLATES by status | Agent B |
| L3.3 | `ArtifactModuleHome` lane=tabele with lifecycle | `vitest run tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx` | renders 12 approved by default; toggling shows draft | Agent B |
| L3.4 | `AddColumnDialog` shows 5 new field types | `vitest run tests/components/MyWork/table/AddColumnDialog.test.tsx` | new types listed; selecting yields proper default options | Agent B |

## Layer 4 — Integration Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L4.1 | `POST /templates/:id/approve` happy path | `npm run test:integration -- template-lifecycle` | 200, status flips, audit log entry | Agent A |
| L4.2 | `POST /templates/:id/deprecate` happy path | same suite | 200, status=deprecated, badge updated | Agent A |
| L4.3 | Cross-tenant 403 on lifecycle endpoints | same suite | every approve/deprecate from foreign tenant → 403 | Agent A |
| L4.4 | `GET /templates?status=approved` filter | same suite | returns only approved templates for current tenant | Agent A |
| L4.5 | Migration up/down on staging snapshot | manual + `npm run migrate:test` | up applies; down reverts; row count preserved | Agent C |

## Layer 5 — E2E Smoke

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L5.1 | `/tabele` shows 12 approved templates | `npx playwright test tests/e2e/smoke/tabele-template-catalog.spec.ts --project=chromium --workers=1` | 12 cards visible by default; toggle to All shows 30 | Agent D |
| L5.2 | New field type column added via AddColumnDialog | same suite | `risk_score` column appears in grid with proper rendering | Agent D |
| L5.3 | Approve via UI flips badge | same suite | super-admin clicks approve → badge changes; non-admin sees disabled | Agent D |

## Layer 6 — Manual / Anygravity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L6.1 | Anygravity P0 trial #1 | per `ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md` after S2 | trial card filed, executed, PASS recorded | Orchestrator |
| L6.2 | DBR77 visual review of 5 new cell types | side-by-side with `color-system.md` | screenshots attached | Agent C |
| L6.3 | Lifecycle filter UI review | screenshot of toggle and badges | matches design system | Agent C |
| L6.4 | Template catalog content review | review 30 templates manually for consulting fidelity | 30/30 plausible for consulting use cases | Orchestrator |

## Layer 7 — Security / Tenant

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L7.1 | Tenant resolution on every new endpoint | code review + L4.3 | every new endpoint reads `tenant_id` from auth | Agent A |
| L7.2 | Owner / super-admin check on approve | code review | non-admin gets 403 | Agent A |
| L7.3 | No silent template promotion | code review | promotion always returns updated template + writes audit row | Agent A |
| L7.4 | `source_reference` field never exposes raw source content without ACL check | code review | resolution goes through `PermissionsService` | Agent A |

## Layer 8 — Performance / Capacity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L8.1 | Template seed time on 30 entries | benchmark in S2 | < 5 s on staging | Agent A |
| L8.2 | `ArtifactModuleHome` render time with 30 cards | profile in component test | < 200 ms for first paint | Agent B |
| L8.3 | Migration runtime | benchmark on staging snapshot | < 30 s on 1M records baseline | Agent C |

---

## Sprint Exit Gate (per `.cursor/SPRINT_GATE_CHECKLIST.md`)

- [ ] L1.1–L1.6 GREEN
- [ ] L2.1–L2.4 GREEN
- [ ] L3.1–L3.4 GREEN
- [ ] L4.1–L4.5 GREEN
- [ ] L5.1–L5.3 GREEN
- [ ] L6.1–L6.4 RECORDED
- [ ] L7.1–L7.4 GREEN
- [ ] L8.1–L8.3 GREEN
- [ ] DoD checklist in `00_TASK_PACKET.md` §5 fully checked
- [ ] Release recommendation: `GO` / `GO_WITH_CONSTRAINTS` / `NO_GO`

---

## Baseline / Reference

- Existing `TemplateService` baseline tests: `consultify/server/src/services/tablePlatform/__tests__/`.
- Test config: `consultify/vitest.config.ts`, `consultify/playwright.config.ts`.
- Foundation Block precedent: `DRD/consultify/docs/product/work-packets/table-studio-foundation/01_VALIDATION_MATRIX.md`.
