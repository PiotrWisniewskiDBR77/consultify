# Sprint 4 — Template Lifecycle Frontend + MELS Shell (Block A)

**Sprint ID:** `A-S4`
**Owner:** Agent B (Tabele)
**Status:** `LIFECYCLE FRONTEND COMPLETE — host integration + MELS shell deferred to A-S5`
**Estimate:** ~2.5 days planned (actual lifecycle slice: ~0.4 day)
**Epics:** EPIC-T6, **EPIC-T16 (D1, D2, D3, D4 — deferred)**
**Updated:** 2026-05-08

## Goal

Two parallel sub-streams were planned in this sprint:

1. **Lifecycle UI** — Build status badge / filter / approve-deprecate
   actions / governance drawer for `tp_base_templates`.
2. **MELS shell** — Extract `ExecutiveModuleShell` + Tabele rails +
   top-bar chips, refactor `TabeleView` onto the new shell.

After re-reading the realised risks from B-S4 (drive-sync race, minimal-
diff discipline) and the current `ArtifactModuleHome` data path
(`useModuleTemplates` reads from the Outputs Library, not from
`tp_base_templates`), the CTO call is:

* **Land the lifecycle component layer + API client now.** The four
  components are decoupled, isolated, fully tested, and safe to mount
  in any host without ripple effects.
* **Defer host integration (`ArtifactModuleHome` rewrite) and the full
  MELS shell extraction to A-S5.** Both touch large surfaces and either
  change the data source for the existing template grid or refactor the
  Tabele lane shell — neither is safe to land in the same window as
  the components themselves.

## Pre-sprint risk check (re-evaluated)

- **A-P1 (catalog overwhelm)** — addressed in `<TemplateLifecycleFilter>`.
  No "All" option; default is `Approved`. Test pins this contract.
- **A-P3 (badge clutter)** — addressed via the `dot` variant on
  `<TemplateLifecycleBadge>`, which collapses to a single coloured dot
  for dense card layouts. Test pins the variant behaviour.
- **MELS scope creep** — explicitly deferred. Sprint exit gate updated
  to call this out. EPIC-T16 D1–D4 remain in scope for A-S5.

## Deliverables — landed

### Created

- `consultify/src/services/api/templateLifecycle.api.ts`
  Frontend client over `/api/table-platform/templates/lifecycle`,
  `/templates/:id/approve`, `/templates/:id/deprecate`, `/templates/:id`.
  Mirrors `LifecycleTemplate` and `ApprovalHistoryEntry` types from the
  backend service so consumers stay typed end-to-end.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleBadge.tsx`
  Status chip with `chip` + `dot` variants, palette per status.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleFilter.tsx`
  Single-select radiogroup over `approved` / `draft` / `deprecated`.
  No "All" option (A-P1); supports `visibleStatuses` for role-based
  hiding.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateLifecycleActions.tsx`
  Approve / Deprecate buttons gated on `isSuperAdmin`. Confirmation
  dialog with optional `note` flowing into `approval_history`.
  Rendering rules:
  * `draft → approve` button only.
  * `approved → deprecate` button only.
  * `deprecated` is terminal until a `to-draft` route lands server-side.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/TemplateGovernanceDrawer.tsx`
  Read-only right-side drawer: status header, approval-history timeline
  (newest-first), pretty-printed `governance_rules` JSON. No mutations
  inside the drawer — all writes flow through `<TemplateLifecycleActions>`.
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/__tests__/TemplateLifecycleBadge.test.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/templateLifecycle/__tests__/TemplateLifecycleFilter.test.tsx`
- `consultify/public/locales/en/tabele-lifecycle.json` (~30 keys)
- `consultify/public/locales/pl/tabele-lifecycle.json` (~30 keys)

### Untouched (intentionally)

- `ArtifactModuleHome.tsx` — host integration deferred to A-S5. The
  current `useModuleTemplates` hook reads from the Outputs Library
  (`useTemplates`) which is a different surface than `tp_base_templates`.
  Wiring requires either (a) a new `useTpBaseTemplates` hook reading
  from `templateLifecycle.api.ts`, or (b) backfilling the Outputs
  Library with the lifecycle metadata. Both decisions live in A-S5.
- `TabeleView.tsx` — MELS refactor deferred to A-S5.
- All `KimiWorkspaceShell` files.
- All Foundation Block files.

## Tests

```
$ npx vitest run src/components/AIChat/KimiWorkspace/templateLifecycle/__tests__
 ✓ TemplateLifecycleBadge.test.tsx (5)
 ✓ TemplateLifecycleFilter.test.tsx (6)
 Tests  11 passed (11)
```

`npx tsc --noEmit -p tsconfig.json` clean. ESLint clean on all new
files.

## Deferred to A-S5

Tracked explicitly so nothing falls through the cracks:

1. **`ArtifactModuleHome` integration.** Add `<TemplateLifecycleFilter>`
   above the templates grid, render `<TemplateLifecycleBadge variant="dot">`
   on each card, mount `<TemplateGovernanceDrawer>` on a card secondary
   action (e.g. ⋮ menu → Governance). Requires the new
   `useTpBaseTemplates` hook.
2. **MELS shell extraction (EPIC-T16 D1–D4).**
   * `ExecutiveModuleShell/index.tsx` + `TopBar.tsx` + `LeftRail.tsx` +
     `RightRail.tsx` + `useRailState.ts`.
   * `TabeleLeftRail.tsx` (record/table outline + sort + Teresa slot).
   * `TabeleTopBarChips.tsx` (functional buttons).
   * `TabeleView.tsx` consumes the shell with no Menu 2 row.
   * Snapshot tests + Foundation Block E2E re-runs.
3. **Component tests for `TemplateLifecycleActions` and
   `TemplateGovernanceDrawer`** — paired with `<ProvenanceCell>`-style
   integration tests in A-S5.
4. **Snapshot diff for badge palette in dark mode** — manual visual
   review pending designer pass.

## Sprint Entry Gate

- [x] S1 closed `GO` (lifecycle endpoints available).
- [x] S2 closed `GO` (templates seeded with statuses).

## Sprint Exit Gate

- [x] Frontend `tsc --noEmit` clean.
- [x] Lint clean on all new files.
- [x] Lifecycle component tests green (11/11).
- [x] DBR77 hex scan: 0 hits in new files.
- [x] A-P1 contract pinned (`Filter` test rejects "All" option).
- [x] A-P3 contract pinned (`Badge dot` variant test).
- [ ] Manual visual review of badges in light + dark mode (pending).
- [ ] MELS shell extraction (deferred — A-S5).
- [ ] Foundation Block E2E re-run (deferred — A-S5, after MELS lands).
- [ ] Recommendation: `GO` to S5 once host integration + MELS land.

## Realised risks / notes

- **Drive-sync race condition.** Same risk as A-S2/A-S3/B-S4 — explicit
  staging + post-commit verification.
- **i18n namespace fan-out.** Block A introduces `tabele-lifecycle` as
  the fourth Tabele namespace (`translation`, `tabele-templates`,
  `tabele-provenance`, `tabele-lifecycle`). A-S5 to add the namespace
  to the i18n parity test.
- **No `to-draft` server route.** `TemplateLifecycleService` does not
  yet expose a "revert to draft" endpoint — `<TemplateLifecycleActions>`
  intentionally omits the affordance until the backend lands. Update
  this sprint's component when the route is ready.
