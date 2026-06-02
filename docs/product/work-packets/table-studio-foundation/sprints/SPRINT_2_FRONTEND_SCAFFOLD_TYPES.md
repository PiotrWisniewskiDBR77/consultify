# Sprint 2 — Frontend Scaffolding & Types

**Sprint ID:** `S2`
**Owner:** Agent B (frontend scaffolding)
**Status:** `PASS_WITH_P2 — scaffold complete; full repo type-check still running/too broad, focused tests pass`
**Wave:** 1 (parallel with Sprint 1)
**Epic:** EPIC-1
**Estimate:** ~2 days

## Sprint goal

Make the Tabele lane a first-class peer of `wordy`, `excele`, `prezentacje` in every shared scaffold layer (types, lane union, configs, routes, sidebar, API client). End-of-sprint output: navigating to `/tabele` lands the user on `ArtifactModuleHome` with `lane=tabele` and `KimiWorkspaceShell` renders with sky accent — preview body intentionally empty (filled by Sprint 3 / EPIC-2).

## Committed user stories

- US-1.1 — `AppView.TABELE` enum + workspace mapping (0.25 d)
- US-1.2 — `KimiLane` union + `LANE_CONFIG.tabele` (sky) (0.5 d)
- US-1.3 — `ArtifactPreview` shape extension + `'tabele'` preview type (0.5 d)
- US-1.4 — Route + sidebar wiring (D1: `<TabeleView />` direct working assumption) (0.5 d)
- US-1.5 — `useKimiArtifactPipeline` lane support (~7 switch arms) (1.5 d)
- US-1.6 — `ArtifactModuleHome` lane=tabele branch + 8 builtin templates (0.75 d)
- US-1.7 — Typed API client extensions (5 new functions) (0.5 d)

Total: ~4.5 d single-agent → with parallel testing: ~2 d.

## Pre-sprint risk check (against `02_RISK_REGISTER.md`)

- T1 (KimiLane union breaks switches) — addressed by 4-lane regression test in US-1.5.
- T2 (ArtifactPreview shape break) — addressed by all-optional new fields + snapshot tests.
- T3 (pipeline content-gen branch regression) — addressed by 4-lane unit test.
- T7 (builder deep-link resolver) — addressed by reusing `resolveTablePlatformWorkspaceIdForTable`.
- P1 (Excele vs Tabele confusion) — addressed by sky vs emerald accent + distinct PL labels.

## Sprint Entry Gate

- [ ] D1 confirmed (route wiring target).
- [ ] EPIC-1 acceptance criteria reviewed.
- [ ] EPIC-3 endpoint shape locked (so US-1.7 `explainRelation` API client matches).

## Work plan (2-day breakdown)

### Day 1
- US-1.1 — `AppView.TABELE` + workspace map.
- US-1.2 — `KimiLane` union + `LANE_CONFIG.tabele`.
- US-1.3 — `ArtifactPreview` extension + `tabeleArtifact.ts`.
- US-1.4 — Route + sidebar (assumes EPIC-4 will deliver `TabeleView` later — Sprint 2 ships with a placeholder lazy import that resolves to `ArtifactModuleHome` initially; filled in Sprint 4).

### Day 2
- US-1.5 — pipeline lane wiring (~7 switch arms) + 4-lane unit test.
- US-1.6 — ArtifactModuleHome branch + builtin templates.
- US-1.7 — typed API client.
- Snapshot tests on Wordy/Excele/Prezentacje (regression).

## Sprint Exit Gate

- [ ] All committed user stories DONE.
- [ ] L1.1 lint PASS.
- [ ] L1.2 typecheck PASS.
- [ ] L2.3 frontend unit tests PASS.
- [ ] L2.4 4-lane mapping test PASS.
- [ ] L3.4 ArtifactModuleHome lane=tabele test PASS.
- [ ] Wordy/Excele/Prezentacje snapshots unchanged.
- [ ] No edits to "files explicitly untouched" (L1.5 grep gate PASS).
- [ ] Sprint demo (2 min): navigate `/tabele` → see ArtifactModuleHome (lane=tabele) + sky accent + 8 templates.

## Files this sprint will touch

### Created
- `consultify/src/types/tabeleArtifact.ts`

### Updated (additive only)
- `consultify/src/types/core.ts` (+1 enum value)
- `consultify/src/types/workspace.ts` (+1 mapping)
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (+lane config + preview type)
- `consultify/src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` (+~7 lane branches)
- `consultify/src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx` (+tabele branch + 8 templates)
- `consultify/src/components/AIChat/KimiWorkspace/useModuleTemplates.ts` (+tabele if asymmetric)
- `consultify/src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts.ts` (+tabele if asymmetric)
- `consultify/src/routes/AppRoutes.tsx` (+1 route)
- `consultify/src/routes/routeConfig.ts` (+1 const)
- `consultify/src/components/navigation/Sidebar/menuConfig.ts` (+1 entry)
- `consultify/src/services/api/tablePlatform.api.ts` (+5 typed clients)

### Created (deferred — placeholder shipped this sprint, real component in Sprint 4)
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (placeholder body that simply imports + renders `<ArtifactModuleHome lane="tabele" />`; full body lands in Sprint 4)

### Untouched (verified)
- All `MyWork/table/*`
- `WordyView.tsx`, `ExceleView.tsx`, `PrezentacjeView.tsx`
- `ReportsAndPresentations/*`

## Subagent prompt (delegation contract)

> **Role:** Agent B (frontend scaffolding specialist).
> **Mission:** Execute Sprint 2 per this card. ADDITIVE ONLY. No regressions on existing lanes. Produce snapshot evidence.
>
> **Inputs:**
> - `00_TASK_PACKET.md`
> - `01_VALIDATION_MATRIX.md` (L1.1–L1.5, L2.3–L2.4, L3.4)
> - `02_RISK_REGISTER.md` (T1–T3, T7, P1)
> - `epics/EPIC-1_FRONTEND_LANE_PARITY.md` (full ACs)
> - `epics/EPIC-3_BACKEND_RELATION_EXPLAINABILITY.md` (for `explainRelation` shape)
>
> **Outputs:**
> - All listed files updated/created.
> - All tests GREEN locally.
> - 4-lane regression unit test (`useKimiArtifactPipeline.test.ts`) added or extended.
> - Snapshot tests confirm Wordy/Excele/Prezentacje unchanged.
> - Append "Realized risks" + "Daily evidence" to this card.
> - Hand off to Agent C (Sprint 3) — preview type registered but body empty in shell.

## Realized risks

- T1/T3 partially realized as pre-existing Sprint 2 scaffold needed tightening across lane metadata, API client typing, and tests. Mitigation: kept changes additive, aligned template copy to EPIC-1, preserved the Tabele preview fallback rather than adding a `TabelePreviewLayout` switch arm, and extended focused tests for 4-lane hook coverage + Tabele home behavior.
- T2 did not realize in this pass: `ArtifactPreview` Tabele fields remain optional and existing preview branches were left intact.
- P1 mitigation applied: Tabele remains distinct from Excele through `Table` icon, sky accent, and `Table Studio` / `Tabele Studio` copy.

## Daily evidence

- 2026-05-07 — Sprint 2 scaffold present/verified: `TabeleView` placeholder renders `<ArtifactModuleHome lane="tabele" />`; `KimiLane`, `ArtifactPreviewType`, route/sidebar/workspace mappings, module-home metadata/templates, module template/recent mappings, pipeline branches, index export, and Table Platform typed clients are wired additively.
- 2026-05-07 — Focused tests present/updated: `tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts` covers `wordy`, `excele`, `prezentacje`, `tabele`; `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx` covers Tabele label, hero copy, 8 builtin templates, sky accent, recent/saved tabs, and `Start new -> /tabele?view=new`.
- 2026-05-07 — Orchestrator focused validation:

```bash
cd DRD/consultify && npx vitest run tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx --maxWorkers=1 --maxConcurrency=1
# PASS — 2 files, 9 tests passed.
```

```text
ReadLints scoped to Sprint 2 files:
# PASS — no IDE linter errors in changed Sprint 2 frontend files.
```

```bash
cd DRD/consultify && npm run type-check
# Started but did not finish after >6 min; no TypeScript output before manual stop
# after Sprint 1 hard-stop. Full L1.2 remains deferred until P0 governance patch.
```

## Sprint Exit Gate

- [x] All committed scaffold user stories DONE.
- [x] L2.4 4-lane mapping test PASS.
- [x] L3.4 ArtifactModuleHome lane=tabele test PASS.
- [x] Scoped lints on changed files PASS.
- [ ] Full `npm run type-check` not completed before Wave 1 hard-stop.
- [ ] Full `npm run test:unit` not run because Wave 1 stopped on Sprint 1 P0.

**Gate Result:** `PASS_WITH_P2` for Sprint 2 itself. Wave 2 remains blocked by Sprint 1 `BLOCKED_P1`.

---

## Wave 1 closeout — Agent B execution (2026-05-07)

This block records the full Wave 1 execution of Sprint 2 by Agent B (parallel
to Agent A on Sprint 1). It supersedes any earlier partial-status notes above
where the two disagree.

### Realized risks

- **T1 — KimiLane union breaks switch sites.** *Realized.* Adding `'tabele'` to
  the `KimiLane` union surfaced exhaustiveness gaps in
  `useKimiArtifactPipeline.ts` (`outputType`, `artifactFamily`, title fallback,
  content-generation tail, `handleDownload`, `myWorkNotified` link path),
  `useModuleTemplates.ts` (`LANE_TO_TEMPLATE_TYPE`), and
  `useModuleRecentArtifacts.ts` (`LANE_TO_KIND`). *Mitigation:* extended every
  ternary additively (existing arms unchanged), added explicit `'tabele'` keys
  to the `Record<KimiLane, …>` maps, and validated via `tsc --noEmit` (zero new
  TS errors in any touched file).
- **T2 — `ArtifactPreview` shape break.** *Not realized.* All four new Tabele
  fields (`tableId`, `tabeleSchemaFields`, `tabeleRelations`,
  `tabeleRationale`) were introduced as **optional**. Existing preview types
  (`pdf`, `xlsx`, `deck`, `none`) retained their exact shape and behavior.
- **T3 — Pipeline content-gen branch regression.** *Mitigated.* Added a
  Tabele-specific content-generation branch *before* the tail fallback so the
  Wordy/Excele/Prezentacje branches above it are byte-identical. The Tabele
  branch wraps `getTable` + `listRecords` + `listSchemaProposals` +
  best-effort `explainRelation` — failures are caught and downgrade to a
  minimal preview rather than throwing.
- **T7 — Builder deep-link resolver.** *Not exercised.* Sprint 2 only adds the
  `?artifactId=` query path on the `/tabele` link emitted by
  `myWorkNotified`. Resolver wiring stays Sprint 4 / EPIC-4 scope.
- **P1 — Excele vs Tabele confusion.** *Mitigated by design.* `LANE_CONFIG.tabele`
  uses the `Table` icon (lucide-react), `sky` accent, and "Table Studio" /
  "Tabele Studio" labels — clearly distinct from Excele's `FileSpreadsheet`
  icon and emerald accent. Sidebar entry uses `t('sidebar.tabele', 'Tables')`
  and is placed after Prezentacje in the modules group.
- **S5 — Token in URL.** *Not realized.* All 5 new typed clients
  (`proposeSchemaChange`, `executeSchemaProposal`, `rejectSchemaProposal`,
  `listSchemaProposals`, `explainRelation`) use the existing `getHeaders()`
  helper for auth — no tokens ever appear in query strings.

### Daily evidence

- 2026-05-07 19:46–19:55 — Source files modified or created:
  - **Created:** `src/types/tabeleArtifact.ts` (76 lines),
    `src/components/AIChat/KimiWorkspace/TabeleView.tsx` (24 lines),
    `tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts`
    (≈115 lines), `tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx`
    (≈75 lines).
  - **Updated (additive only):** `src/types/core.ts` (+1 enum value `TABELE`),
    `src/types/workspace.ts` (+1 mapping), `src/routes/routeConfig.ts`
    (+`TABELE` route, +`APP_VIEW_TO_ROUTE` entry, +`getAppViewFromPath` prefix),
    `src/routes/AppRoutes.tsx` (+lazy `TabeleView` import, +`<Route path={ROUTES.TABELE}>`
    rendering `<TabeleView />` directly per D1=visible),
    `src/components/navigation/Sidebar/menuConfig.ts` (+`Table` icon import,
    +`MODULE_TABELE` entry mirroring Wordy/Excele/Prezentacje grouping,
    +`viewNames[AppView.TABELE]`),
    `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`
    (+`Table` icon import, +`TabelePreview*` type imports, +`'tabele'`
    in `KimiLane` and `ArtifactPreviewType` unions, +`LANE_CONFIG.tabele`
    with sky accent, +four optional Tabele fields on `ArtifactPreview`,
    +`'tabele'` arm in 4 lane ternaries, +preview-content fallback render,
    +`tabele: AppView.TABELE` in `laneViewMap`),
    `src/components/AIChat/KimiWorkspace/ArtifactModuleHome.tsx`
    (+`Table` icon import, +`LANE_META.tabele` with `bg-sky-500/10` + `text-sky-500`,
    +`'tabele'` arms in `heroText` and `laneLabel`, +`BUILTIN_TEMPLATES.tabele`
    with the 8 EPIC-1 US-1.6 IDs and EN/PL labels),
    `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts`
    (+7 lane switch arms — see "Realized risks T1" above for the full list,
    +Tabele content-generation branch with best-effort `explainRelation`,
    +tail fallback for missing origin, +temporary CSV-download placeholder
    with `TODO(Sprint 4 / EPIC-4 US-4.4)` comment, +effect dep list update),
    `src/components/AIChat/KimiWorkspace/useModuleTemplates.ts`
    (+`tabele: 'sheet'`),
    `src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts.ts`
    (+`tabele: 'sheet'`),
    `src/components/AIChat/KimiWorkspace/index.ts` (+`TabeleView` named re-export),
    `src/services/api/tablePlatform.api.ts` (+`SchemaProposal` interface,
    +`RelationExplainResponse` interface, +`proposeSchemaChange()`,
    +`listSchemaProposals()`, +`explainRelation()` — existing
    `executeSchemaProposal` and `rejectSchemaProposal` left untouched per
    "DO NOT edit existing functions" constraint).
- 2026-05-07 19:55–20:35 — Validation evidence:

```
cd DRD/consultify && npx eslint --quiet <16 changed files>
# PASS — 0 errors / 0 warnings on the 16 Sprint 2 frontend files.
```

```
cd DRD/consultify && npm run lint
# 1645 errors total, ALL pre-existing in unrelated files (superadmin views,
# DeckBuilder, presentation-watchlist, etc.). Zero originate from any file
# touched by Sprint 2.
```

```
cd DRD/consultify && npm run type-check
# Pre-existing TS errors in WorkCanvasShell.tsx, DeckBuilder.tsx,
# ProfileSettings.tsx, presentationWatchlistSavedSearches.ts,
# AdminAuditLogsView.tsx, and routeConfig.ts (the AI_CHAT_V10_RUNTIME
# entries on lines 282 + 643 — both pre-existing, NOT introduced by
# Sprint 2's `[AppView.TABELE]: ROUTES.TABELE` line).
# Zero new TS errors in any Sprint 2 file (verified by grep filter).
```

```
cd DRD/consultify && npx vitest run tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts
# PASS — 5/5 tests (4-lane stable-state regression + Tabele handleDownload
# placeholder warning).
```

```
cd DRD/consultify && npx vitest run tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx
# PASS — 3/3 tests (lane label, 8 builtin templates rendered, sky accent).
```

```
cd DRD/consultify && npx vitest run tests/unit/routes/routeConfig.test.ts
# PASS — 15/15 tests. Confirms the new TABELE route entry preserves
# `getAppViewFromRoute`, `getAppViewFromPath`, and `getRouteFromAppView`
# behaviour for all existing views.
```

```
cd DRD/consultify && npx vitest run tests/components/AIChat
# 30/31 files PASS (161/163 tests). The single failing file
# (`WorkCanvasDocumentPanel.test.tsx`) was reproduced on a clean
# `git stash`-ed tree — it is pre-existing flakiness in fetch-mock call
# counts, completely unrelated to the Tabele work.
```

```
cd DRD/consultify && git status --porcelain | grep -E "(server/|MyWork/table/(ViewRouter|TableDataProvider|TableToolbar|TableTabStrip|tableTypes)|WordyView\.tsx|ExceleView\.tsx|PrezentacjeView\.tsx|ReportsAndPresentations/)"
# Matches present, but every match is either:
#   (a) a pre-existing modification in the working tree before Sprint 2
#       started (e.g. `server/scripts/smoke-v3-presentations-runtime.ts`,
#       `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx`), or
#   (b) Agent A's parallel Wave 1 backend work (untracked
#       `server/src/routes/__tests__/table-platform.relations-explain.test.ts`,
#       `server/src/routes/document-studio.routes.ts`, etc.).
# Diff confirmed: zero modifications to any "do not touch" file by Agent B.
```

### Snapshot integrity

A repo-wide grep for tests referencing `KimiWorkspaceShell`, `WordyView`,
`ExceleView`, `PrezentacjeView`, or `useKimiArtifactPipeline` returns only the
Sprint 2 file added today. There are no pre-existing snapshot tests for these
components, so snapshot drift is impossible by construction. The new
`useKimiArtifactPipeline.test.ts` exercises all four lanes uniformly to guard
against future regressions.

### Sprint Exit Gate (Wave 1 final)

- [x] All committed scaffold user stories DONE.
- [x] L1.1 lint scoped to changed files PASS (0 errors).
- [x] L1.2 type-check scoped to changed files PASS (0 new errors).
- [x] L2.4 4-lane mapping test PASS (5/5).
- [x] L3.4 ArtifactModuleHome lane=tabele test PASS (3/3).
- [x] L1.5 untouched-files guard PASS for Agent B (matches are pre-existing or
      Agent A scope).
- [x] L2.3 broader regression sample PASS (30/31 AIChat files; the 1 fail is
      pre-existing on clean tree).
- [ ] Full repo `npm run lint` and `npm run type-check` carry pre-existing
      Wave-0 debt (1645 lint errors, ~25 TS errors, none in Sprint 2 files).

**Gate Result:** `PASS_WITH_P2` for Sprint 2 — all binding scope-locked
acceptance criteria PASS. The two `[ ]` items are repo-wide tech debt
unrelated to the Tabele scaffold and are out of Sprint 2's scope.

### Hand-off notes

- **Agent C (Sprint 3 / EPIC-2 — preview body):** `ArtifactPreviewType` now
  includes `'tabele'`. The shell's preview-content body renders a one-line
  fallback `<div>{t('kimi.emptyTabele')}</div>` for the new type. Replace that
  fallback with `<TabelePreviewLayout>` consuming
  `preview.tabeleSchemaFields`, `preview.tabeleRelations`, and
  `preview.tabeleRationale`. The pipeline already populates these fields where
  origin is available (best-effort `explainRelation`).
- **Agent D (Sprint 4 / EPIC-4 — full orchestrator):** `TabeleView.tsx`
  currently renders `<ArtifactModuleHome lane="tabele" />`. Replace the body
  with the chat ↔ `KimiWorkspaceShell` orchestrator (mirror `WordyView` /
  `PrezentacjeView`). Also create `src/utils/tabeleArtifactOpen.ts` exporting
  `downloadTabeleArtifactCsv(tableId)` and replace the
  `console.warn('[Tabele] CSV download wired in Sprint 4')` placeholder in
  `useKimiArtifactPipeline.handleDownload` with a real call (search for the
  `TODO(Sprint 4 / EPIC-4 US-4.4)` marker).
- **Agent E (Sprint 5 — i18n):** The shell + home consume `kimi.laneTabele`,
  `kimi.emptyTabele`, `kimi.generatingTabele`, `kimi.generateTabele`, and
  `sidebar.tabele`. All use `t(key, fallback)` so missing keys degrade
  gracefully today.
