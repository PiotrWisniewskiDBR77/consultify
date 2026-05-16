# Sprint 4 — TabeleView Orchestrator + Builder Deep-Link

**Sprint ID:** `S4`
**Owner:** Agent D (orchestrator + integration)
**Status:** `IMPLEMENTED — targeted validation PASS`
**Wave:** 2 (parallel with Sprint 3)
**Epic:** EPIC-4 (US-4.1, US-4.2, US-4.4)
**Estimate:** ~2 days

## Sprint goal

Build the `TabeleView` orchestrator (mirror of `PrezentacjeView`) and the builder deep-link with transition toast (Option A per D3 working assumption). End-of-sprint output: a Tabele lane that a user can drive from chat to materialized table, where the canvas hydrates with real data and the "Open in Builder" button works.

## Committed user stories

- US-4.1 — `tabeleSystemPrompt.ts` (0.25 d)
- US-4.2 — `TabeleView.tsx` orchestrator (1.5 d)
- US-4.4 — Builder deep-link utility (`tabeleArtifactOpen.ts`) + transition toast (0.5 d)

Total: ~2.25 d single-agent → ~2 d with focus.

## Pre-sprint risk check (against `02_RISK_REGISTER.md`)

- T3 (pipeline content-gen regression) — addressed by 4-lane test from Sprint 2 (already merged).
- T7 (builder deep-link resolver fails for orphan tables) — addressed by error toast.
- P3 (deep-link confuses users) — addressed by new-tab + transition toast + preserved back-nav.
- S5 (JWT in URL) — addressed by `getHeaders()` pattern.

## Sprint Entry Gate

- [ ] Sprint 1 (backend) merged.
- [ ] Sprint 2 (frontend scaffolding) merged.
- [ ] Sprint 3 (preview components) merged.
- [ ] EPIC-4 acceptance criteria reviewed.

## Work plan (2-day breakdown)

### Day 1
- US-4.1 — `tabeleSystemPrompt.ts` constant.
- US-4.4 — `tabeleArtifactOpen.ts`: `buildTableBuilderOpenPath`, `openTableBuilderInNewTab`, `downloadTabeleArtifactCsv`.
- US-4.2 part 1 — `TabeleView.tsx` skeleton (mirror PrezentacjeView): pipeline hook, query params, showHome gating, auto-trigger ladder.

### Day 2
- US-4.2 part 2 — Reopen-from-library effect (load table + records + proposals).
- US-4.2 part 3 — Wire `<TabelePreviewLayout>` callbacks (`onOpenBuilder`, `onOpenProposalQueue`).
- US-4.2 part 4 — Component test (L3.1).
- Replace Sprint 2's placeholder `TabeleView` with the real implementation.
- Sprint demo prep.

## Sprint Exit Gate

- [ ] All committed user stories DONE.
- [ ] L1.1 lint PASS.
- [ ] L1.2 typecheck PASS.
- [ ] L3.1 TabeleView component test PASS.
- [ ] L3.2 KimiWorkspaceShell test (with `lane=tabele` + real preview shape) PASS.
- [ ] Smoke run: `/tabele?view=new` → goal → pipeline → preview hydrates → Open in Builder → new tab opens.
- [ ] Sprint demo (3 min): full happy path.

## Files this sprint will touch

### Created
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (full implementation)
- `consultify/src/components/AIChat/KimiWorkspace/tabeleSystemPrompt.ts`
- `consultify/src/components/AIChat/KimiWorkspace/__tests__/TabeleView.test.tsx`
- `consultify/src/utils/tabeleArtifactOpen.ts`

### Updated (additive only)
- `consultify/src/components/AIChat/KimiWorkspace/index.ts` (+1 export)
- (`consultify/src/routes/AppRoutes.tsx` is already updated in Sprint 2 — Sprint 4 just replaces the placeholder body, no route changes.)

### Untouched (verified)
- `WordyView.tsx`, `ExceleView.tsx`, `PrezentacjeView.tsx`.
- `KimiWorkspaceShell.tsx` (already updated by Sprint 3 — Sprint 4 only consumes).
- `useKimiArtifactPipeline.ts` (already updated by Sprint 2 — Sprint 4 only consumes).

## Subagent prompt (delegation contract)

> **Role:** Agent D (orchestrator + integration specialist).
> **Mission:** Execute Sprint 4 per this card. Mirror `PrezentacjeView.tsx` patterns exactly — do not invent new control flow. Wire the canvas to the pipeline.
>
> **Inputs:**
> - `00_TASK_PACKET.md`
> - `01_VALIDATION_MATRIX.md` (L1.1, L1.2, L3.1, L3.2)
> - `02_RISK_REGISTER.md` (T3, T7, P3, S5)
> - `epics/EPIC-4_INTEGRATION_INTENT_ROUTING_I18N.md` (US-4.1, US-4.2, US-4.4 ACs)
> - Reference: `consultify/src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` (template).
> - Reference: `consultify/src/utils/sheetArtifactOpen.ts` (for `resolveTablePlatformWorkspaceIdForTable`).
>
> **Outputs:**
> - 3 new files + 1 component test.
> - `index.ts` re-export.
> - All tests GREEN.
> - Append "Realized risks" + "Daily evidence" to this card.
> - Hand off to orchestrator (Sprint 5) with the lane working end-to-end.

## Realized risks

- T7 (builder deep-link resolver may fail for orphan tables) remains possible; `openTableBuilderInNewTab` returns `false` and surfaces `tabele.builderUnreachable` instead of same-tab navigation.
- P3 (deep-link context shift) mitigated by opening `/my-work/sheets/:workspaceId/tables/:tableId` in a new tab with a transition toast before `window.open`.
- S5 (JWT in URL) did not fire; builder links contain only workspace/table ids, and CSV download uses an Authorization header when a token is available.
- Sprint dependency note: Agent C preview components are not present in this workspace, so Sprint 4 wires the `ArtifactPreview` Tabele shape and shell callbacks without creating preview UI.

## Daily evidence

- Added `tabeleSystemPrompt.ts` with the governance invariant (`proposal -> approval -> execution -> audit`) and no record-body interpolation.
- Added `tabeleArtifactOpen.ts` with `buildTableBuilderOpenPath`, `openTableBuilderInNewTab`, and `downloadTabeleArtifactCsv`.
- Replaced the Sprint 2 placeholder `TabeleView.tsx` with the full KIMI orchestrator: `useKimiArtifactPipeline('tabele')`, `ArtifactModuleHome lane="tabele"`, `KimiWorkspaceShell lane="tabele"`, query params, template prompt/template artifact ladder, chat-message auto trigger, reopen-from-library hydration, builder open, all-files, and CSV download callbacks.
- Added `tests/components/AIChat/KimiWorkspace/TabeleView.test.tsx` covering home render, `view=new` shell render, system prompt, template prompt auto-trigger, reopen preview hydration, builder utility callback, and CSV utility callback.
- Updated `tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts` to remove the old Sprint 4 placeholder warning expectation.

## Sprint 4 evidence

- Targeted validation PASS:
  `cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify && npx vitest run tests/components/AIChat/KimiWorkspace/TabeleView.test.tsx tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx --maxWorkers=1 --maxConcurrency=1`
- Result: 3 test files PASS, 15 tests PASS.
- Scoped lint diagnostics: PASS, no diagnostics on Sprint 4 changed files.
- Scope audit: Sprint 4 did not edit `WordyView.tsx`, `ExceleView.tsx`, `PrezentacjeView.tsx`, backend source, or `MyWork/table/*`. Workspace already contains unrelated dirty files from other sprint work, including some out-of-scope paths; left untouched.
