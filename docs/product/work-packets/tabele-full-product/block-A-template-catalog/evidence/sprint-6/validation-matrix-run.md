# A-S6 Validation Matrix — Execution Log

**Sprint:** A-S6 (Block A · QA Gate)
**Run date:** 2026-05-08
**Runner:** Cursor agent (CTO mode under user delegation)
**Environment:** local CLI on `main` at HEAD (`3fb1f261b` after A-S5 land)

---

## Layer-by-layer execution

### L1 — Static / Lint / Type — `PASS scoped`

- **Lint scoped to A-S5 changes** — `npx eslint src/components/MyWork/table/cells/ src/components/MyWork/table/PlatformCellRenderer.tsx src/components/MyWork/table/__tests__/PlatformCellRenderer.specialized.test.tsx src/types/tablePlatform.ts` → 0 errors, 0 warnings (after `--fix` pass).
- **DBR77 hex scan** — 0 raw hex literals across Block A frontend (`cells/`, `tabeleShell/`, `ExecutiveModuleShell/`) and Block A backend (`SpecializedFieldTypes.ts`).
- **Repo-wide typecheck baseline** — pre-existing red baseline carried over from Foundation Block (per `table-studio-foundation/03_BLOCK_CLOSEOUT.md` § Validation Performed). 0 new TypeScript errors introduced by A-S5 (`npx tsc --noEmit | grep -E '(cells|PlatformCellRenderer|specialized|tablePlatform)'` → empty).

### L2 — Unit (backend) — `PASS — 121/121`

`npx vitest run` on:

| Spec | Tests | Status |
|---|---:|---|
| `TemplateLifecycleService.test.ts` | 20 | PASS |
| `SchemaValidationService.test.ts` | 19 | PASS |
| `SpecializedFieldTypes.test.ts` | 62 | PASS |
| `seeds/__tests__/tabele_consulting_templates.test.ts` | 15 | PASS |
| `seeds/__tests__/tabele_consulting_templates_i18n.test.ts` | 5 | PASS |
| **Total** | **121** | **121 PASS / 0 FAIL** |

Duration: 1.47 s.

### L3 — Component / Frontend — `PASS — 133/133`

`npx vitest run` on:

| Spec | Tests | Status |
|---|---:|---|
| `cells/__tests__/RiskScoreCell.test.tsx` | 12 | PASS |
| `cells/__tests__/PriorityCell.test.tsx` | 8 | PASS |
| `cells/__tests__/AiSummaryCell.test.tsx` | 9 | PASS |
| `cells/__tests__/AiClassificationCell.test.tsx` | 8 | PASS |
| `cells/__tests__/SourceReferenceCell.test.tsx` | 11 | PASS |
| `__tests__/PlatformCellRenderer.specialized.test.tsx` | 7 | PASS |
| `tabeleShell/__tests__/TabeleTopBarChips.test.ts` | 8 | PASS |
| `tabeleShell/__tests__/TabeleLeftRail.test.tsx` | 8 | PASS |
| `tabeleShell/__tests__/TabeleRightRail.test.tsx` | 11 | PASS |
| `tabeleShell/__tests__/TabeleMelsView.test.tsx` | 6 | PASS |
| `ExecutiveModuleShell/__tests__/ExecutiveModuleShell.test.tsx` | 9 | PASS |
| `ExecutiveModuleShell/__tests__/useRailState.test.ts` | 10 | PASS |
| `ExecutiveModuleShell/__tests__/shortcuts.test.ts` | 6 | PASS |
| `ExecutiveModuleShell/__tests__/ShortcutHelpModal.test.tsx` | 8 | PASS |
| `ExecutiveModuleShell/__tests__/RailResizeHandle.test.tsx` | 8 | PASS |
| `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx` | 4 | PASS |
| **Total** | **133** | **133 PASS / 0 FAIL** |

Duration: 3.40 s.

### L4 — Integration (backend routes) — `PASS — 49/49`

`npx vitest run` on:

| Spec | Tests | Status |
|---|---:|---|
| `template-lifecycle-acl.test.ts` | 9 | PASS |
| `table-platform.schema-proposals-acl-audit.test.ts` | 9 | PASS |
| `table-platform.routes.test.ts` | 22 | PASS |
| `table-platform.relations-explain.test.ts` | 9 | PASS |
| **Total** | **49** | **49 PASS / 0 FAIL** |

Duration: 1.38 s. Cross-tenant ACL audit included for schema-proposals (Foundation Block carry-over) and template-lifecycle (A-S1 deliverable).

### L5 — E2E smoke — `PASS_SCOPED (Foundation) / DEFERRED_OPERATOR (A-S5)`

- Foundation Block E2E (`tests/e2e/smoke/tabele-foundation.spec.ts`) — green at last execution (Foundation Block closeout 2026-05-07). Re-run flag-OFF + flag-ON paths is one of the deferred items in `EPIC-T16-S4b` (requires staging build with `?ff_melsTabele=1`).
- A-S5 specialized cells render only in already-mounted GridView / TabelePreviewLayout surfaces; component tests (L3) cover the registry contract end-to-end. No new E2E spec required for A-S5 (no new route, no new shell mount).

### L6 — Manual / Anygravity — `DEFERRED_OPERATOR`

- Anygravity P0 trial #1 — **PENDING (external)**. Card filed in `evidence/sprint-2/anygravity-p0-trial-1.md` and `DRD/testy_antygravity/TEST_QUEUE.md`. Trial executes once staging carries the Block A migration (template lifecycle columns) + Block B migration (`tp_record_sources` + provenance columns) + 30-template seeder run. See `evidence/sprint-6/anygravity-p0-trial-1-final.md` for re-confirmed scope.
- DBR77 visual review screenshots — code-level token / hex audit PASS (L1.4); visual screenshot capture deferred to operator pass alongside EPIC-T16 D8 visual review (DeckBuilder reference parity).
- EPIC-T16 D8 (visual review) — DEFERRED to operator with same staging dependency.

### L7 — Security / tenant — `PASS — 9/9 + 9/9`

- `template-lifecycle-acl.test.ts` — 9/9 PASS (super-admin scoping for approve / promote / demote endpoints; non-super-admin returns 403; cross-tenant template visibility scoped).
- `table-platform.schema-proposals-acl-audit.test.ts` — 9/9 PASS (carry-over from Foundation Block P0 hotfix; cross-tenant returns 403 on every route).

### L8 — Performance — `PASS_WITH_P2`

- A-S5 cell renderers are lightweight (≤ 100 LOC each, no expensive computation) and render in component-test environment within < 100 ms each (per L3 timings). No dedicated perf benchmark added at this layer.
- 50 k-record GridView benchmark is owned by Block B-S6 (planned next).

---

## Gate decision

**Recommendation:** `GO_WITH_CONSTRAINTS` to A-S7 (Block A closeout).

**Constraints (carry to operator pass + Block A closeout):**

1. Anygravity P0 trial #1 execution against staging (after Block A + Block B migrations land in staging).
2. EPIC-T16 D8 visual review screenshots (Tabele MELS shell vs DeckBuilder reference) — operator pass.
3. EPIC-T16 Foundation Block E2E re-run flag-OFF + flag-ON — operator pass with `?ff_melsTabele=1`.
4. A-FU-S5b (AddColumnDialog UX for specialized field types) — filed as follow-up per CTO Q9.

**Blockers:** none.

**Cross-tenant audit:** clean (18/18 ACL tests pass across template-lifecycle and schema-proposals routes).

---

## Total evidence count

| Layer | Count | Result |
|---|---:|---|
| L1 lint scoped | — | PASS |
| L1 hex scan | — | PASS (0 hits) |
| L2 unit backend | 121 | PASS |
| L3 component frontend | 133 | PASS |
| L4 integration backend | 49 | PASS |
| L5 e2e smoke | — | PASS_SCOPED / DEFERRED |
| L6 manual / Anygravity | — | DEFERRED_OPERATOR |
| L7 security / tenant | 18 | PASS |
| L8 performance | — | PASS_WITH_P2 |
| **Total automated** | **303** | **303 PASS / 0 FAIL** |
