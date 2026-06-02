# Validation Matrix — Block B: Record Provenance

**Block ID:** `TABELE_BLOCK_B_RECORD_PROVENANCE`
**Template basis:** `.cursor/SPRINT_GATE_CHECKLIST.md`
**Status:** `PLANNED`

---

## Layer 1 — Static / Lint / Type

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L1.1 | Frontend lint | `cd DRD/consultify && npm run lint` | 0 errors | Agent D |
| L1.2 | Frontend typecheck | `cd DRD/consultify && npm run type-check` | exit 0 | Agent D |
| L1.3 | Backend typecheck | `cd DRD/consultify/server && npm run typecheck` | exit 0 | Agent A |
| L1.4 | DBR77 hex scan on new components | `rg -n "#[0-9a-fA-F]{3,6}\b" DRD/consultify/src/components/MyWork/table/provenance DRD/consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleProvenanceColumn.tsx` | 0 hits | Agent C |
| L1.5 | i18n keys | `cd DRD/consultify && npm run i18n:check` | green | Agent C |
| L1.6 | Untouched-files guard | git diff for Foundation Block files (except `TabelePreviewLayout.tsx`) | 0 hits | Orchestrator |

## Layer 2 — Unit Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L2.1 | `RecordSourcesService` | `npm run test -- RecordSourcesService` | green: CRUD + ACL filter + cross-tenant + 4 source types | Agent A |
| L2.2 | `ConfidenceScoringService` | `npm run test -- ConfidenceScoringService` | green: algorithm with mocked inputs | Agent A |
| L2.3 | `ValidationStatusService` | `npm run test -- ValidationStatusService` | green: AI-only / human-only state transitions | Agent A |
| L2.4 | Frontend unit | `npm run test:unit` | regression green | Agent D |

## Layer 3 — Component Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L3.1 | `SourcePopover` | `vitest run tests/components/MyWork/table/provenance/SourcePopover.test.tsx` | renders with mock sources, "Add source" works | Agent B |
| L3.2 | `ConfidenceBar` | `vitest run tests/components/MyWork/table/provenance/ConfidenceBar.test.tsx` | renders gradient based on score; hides when ≥0.7 | Agent B |
| L3.3 | `ValidationBadge` | same path / ValidationBadge | 4 variants render | Agent B |
| L3.4 | `AddSourceDialog` | same path / AddSourceDialog | 4 source type tabs render | Agent B |
| L3.5 | `TabeleProvenanceColumn` | `tabelePreview/TabeleProvenanceColumn.test.tsx` | renders inside Tabele preview records section | Agent B |
| L3.6 | `GridView` integration | `tests/components/MyWork/table/GridView.test.tsx` | confidence + validation render in row gutter when flag on | Agent B |

## Layer 4 — Integration Tests

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L4.1 | `POST /records/:id/sources` happy path | `npm run test:integration -- record-sources` | 201, source row created | Agent A |
| L4.2 | `GET /records/:id/sources` ACL filter | same suite | actor without read access on linked record gets sources filtered out | Agent A |
| L4.3 | `DELETE /records/:id/sources/:sid` happy path | same suite | 200, audit row written | Agent A |
| L4.4 | Cross-tenant 403 on all 3 endpoints | `record-sources-acl.test.ts` | 403 in every cross-tenant case | Agent A |
| L4.5 | Confidence recompute on record write | integration test | mutating a record recomputes score; audit row written | Agent A |
| L4.6 | Migration up/down on staging snapshot | `npm run migrate:test` | up + down clean | Agent C |

## Layer 5 — E2E Smoke

| # | Scope | Command | Pass criterion | Owner |
|---|---|---|---|---|
| L5.1 | Add source to a record via grid | `npx playwright test tests/e2e/smoke/tabele-provenance.spec.ts --project=chromium --workers=1` | source popover opens, source added, refresh shows source | Agent D |
| L5.2 | Confidence bar visibility on low-score records | same suite | bar visible on rows with score <0.7 | Agent D |
| L5.3 | Validation badge flips on "Mark verified" click | same suite | badge transitions from `?` to `✓ AI` to `✓` | Agent D |
| L5.4 | Tabele Word-canvas records section shows provenance | same suite | source/confidence column renders | Agent D |

## Layer 6 — Manual / Anygravity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L6.1 | DBR77 visual review for popover, bar, badge | side-by-side with `color-system.md` | screenshots attached | Agent C |
| L6.2 | Menu 3 placement audit | grep + visual | no provenance buttons outside row gutter / popover | Orchestrator |
| L6.3 | Word-canvas idiom for records section | side-by-side with Foundation Block records section | shape-and-density parity | Agent C |
| L6.4 | Audit trail review | manual: trigger source add/remove, status flip; check audit logs | every mutation logged with actor + before + after | Agent A |

## Layer 7 — Security / Tenant

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L7.1 | Tenant resolution on every endpoint | code review + L4.4 | every endpoint reads `tenant_id` | Agent A |
| L7.2 | Source content rendering ACL filter | code review + L4.2 | resolved sources go through `PermissionsService.canRead` | Agent A |
| L7.3 | AI auto-validation invariant | code review | service rejects requests to set `human_validated` from AI service caller | Agent A |
| L7.4 | Validation status flip audit | code review | every flip logs actor + reason | Agent A |
| L7.5 | Source URL injection scan | code review | URL source type validates against allow-list scheme (`https`, `consultify://`) | Agent A |

## Layer 8 — Performance / Capacity

| # | Scope | Method | Pass criterion | Owner |
|---|---|---|---|---|
| L8.1 | 50 k records grid render with provenance bars | profile in component test or staging | p95 < 100 ms | Agent B |
| L8.2 | Confidence recompute on bulk write 1000 records | benchmark | < 5 s total | Agent A |
| L8.3 | Migration runtime on 1M record staging | benchmark | < 30 s | Agent C |

---

## Sprint Exit Gate (per `.cursor/SPRINT_GATE_CHECKLIST.md`)

- [ ] L1.1–L1.6 GREEN
- [ ] L2.1–L2.4 GREEN
- [ ] L3.1–L3.6 GREEN
- [ ] L4.1–L4.6 GREEN
- [ ] L5.1–L5.4 GREEN
- [ ] L6.1–L6.4 RECORDED
- [ ] L7.1–L7.5 GREEN
- [ ] L8.1–L8.3 GREEN
- [ ] DoD checklist in `00_TASK_PACKET.md` §5 fully checked
- [ ] Release recommendation: `GO` / `GO_WITH_CONSTRAINTS` / `NO_GO`
