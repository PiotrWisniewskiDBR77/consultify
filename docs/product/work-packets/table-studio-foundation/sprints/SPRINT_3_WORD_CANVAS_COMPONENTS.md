# Sprint 3 — Word-Canvas Preview Components

**Sprint ID:** `S3`
**Owner:** Agent C (preview components)
**Status:** `BLOCKED — pending Sprint 2 merge`
**Wave:** 2 (parallel with Sprint 4)
**Epic:** EPIC-2
**Estimate:** ~2 days

## Sprint goal

Render the Tabele artifact preview as a Word-style document canvas: cover header, KPI strip, schema-as-document-blocks, records-as-table, relations-as-chips, AI rationale section. Pure presentational; no business logic. End-of-sprint output: when `preview.type === 'tabele'`, the shell renders a full sectioned canvas; side-by-side screenshot vs Wordy passes parity review.

## Committed user stories

- US-2.1 — `TabelePreviewLayout` (1 d)
- US-2.2 — `TabeleSchemaBlock` (0.5 d)
- US-2.3 — `TabeleRelationChip` with explainability tooltip (0.75 d)
- US-2.4 — `TabeleRationaleSection` (0.75 d)
- US-2.5 — `KimiWorkspaceShell` switch-arm for `'tabele'` (0.5 d)
- US-2.6 — DBR77 audit + responsive (0.5 d)

Total: ~4 d single-agent → with focused execution: ~2 d.

## Pre-sprint risk check (against `02_RISK_REGISTER.md`)

- P2 (heavy preview for tiny tables) — addressed by auto-collapse logic.
- P4 (DBR77 drift) — addressed by L1.4 hex literal scan + visual review.
- P5 (canvas idiom diverges from Wordy) — addressed by side-by-side screenshot review.
- P6 (proposal queue without affordances confuses) — addressed by status pill + link to existing review surface only.

## Sprint Entry Gate

- [ ] Sprint 2 merged (ArtifactPreview shape + tabeleArtifact.ts types available).
- [ ] EPIC-2 acceptance criteria reviewed.
- [ ] Wordy preview reference screenshot captured for parity baseline.

## Work plan (2-day breakdown)

### Day 1
- US-2.1 — TabelePreviewLayout skeleton (cover + KPI + section scaffolds).
- US-2.2 — TabeleSchemaBlock (Word-paragraph idiom).
- US-2.3 — TabeleRelationChip (with @floating-ui tooltip).

### Day 2
- US-2.4 — TabeleRationaleSection.
- US-2.5 — Shell switch-arm wiring.
- US-2.6 — DBR77 audit pass + responsive checks + dark-mode contrast checks.
- Component tests (L3.3) green.
- Side-by-side screenshot vs Wordy.

## Sprint Exit Gate

- [ ] All committed user stories DONE.
- [ ] L1.1 lint PASS.
- [ ] L1.2 typecheck PASS.
- [ ] L1.4 DBR77 hex scan PASS.
- [ ] L3.2 KimiWorkspaceShell lane=tabele test PASS.
- [ ] L3.3 TabelePreviewLayout sectioned render test PASS.
- [ ] L8.2 render < 100 ms for 25 rows × 10 cols PASS.
- [ ] Side-by-side screenshot vs Wordy: parity confirmed (L6.4).
- [ ] Reduced-motion + dark-mode + responsive checks PASS.
- [ ] Sprint demo (3 min): render preview via Storybook-like fixture or `__fixtures__/` — walk through every section.

## Files this sprint will touch

### Created
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection.tsx`
- `consultify/tests/components/AIChat/KimiWorkspace/tabelePreview/TabelePreviewLayout.test.tsx`
- `consultify/tests/components/AIChat/KimiWorkspace/tabelePreview/TabeleSchemaBlock.test.tsx`
- `consultify/tests/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip.test.tsx`
- `consultify/tests/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection.test.tsx`

### Updated (additive only)
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (+1 switch arm in `ArtifactPreviewPane`)

### Untouched (verified)
- All EPIC-1 files from Sprint 2 are read-only here (just consumed).
- `WordyView.tsx`, `ExceleView.tsx`, `PrezentacjeView.tsx`.

## Subagent prompt (delegation contract)

> **Role:** Agent C (preview components specialist + DBR77 enforcer).
> **Mission:** Execute Sprint 3 per this card. Build pure presentational components. NO business logic, NO data fetch. Deliver visual parity with Wordy.
>
> **Inputs:**
> - `00_TASK_PACKET.md`
> - `01_VALIDATION_MATRIX.md` (L1.1, L1.2, L1.4, L3.2, L3.3, L6.2, L6.4, L8.2)
> - `02_RISK_REGISTER.md` (P2, P4, P5, P6)
> - `epics/EPIC-2_WORD_CANVAS_PREVIEW.md` (full ACs)
> - Reference: `consultify/docs/ui-standards/00-foundation/color-system.md` (DBR77 tokens)
> - Reference: `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` lines 432–451 (Wordy preview idiom for parity).
>
> **Outputs:**
> - 4 new component files + 4 test files.
> - Shell switch-arm wired.
> - Side-by-side parity screenshot saved to `evidence/sprint-3/` subfolder of this packet.
> - DBR77 hex-scan output (should be empty).
> - Append "Realized risks" + "Daily evidence" to this card.
> - Hand off to Agent D (Sprint 4) with the canvas ready to be driven by the orchestrator.

## Realized risks

- **P2 — heavy preview for tiny tables:** mitigated with initial auto-collapse for schema sections with `<= 3` fields and relation sections with `0` relations.
- **P4 — DBR77 drift:** mitigated by using Tailwind DBR77 neutral/semantic tokens only; hex scan over `tabelePreview` + `KimiWorkspaceShell.tsx` returned no matches.
- **P5 — Word-canvas idiom divergence:** mitigated with a sectioned document canvas (cover, KPI strip, schema blocks, records, relations, rationale) rather than a bare grid.
- **P6 — proposal queue affordance confusion:** rationale section renders a proposal status pill and only shows the review affordance when a callback is supplied; no AI action buttons were added inside the canvas.

## Daily evidence

- **2026-05-07 / Sprint 3 Agent C:** created pure presentational preview components under `src/components/AIChat/KimiWorkspace/tabelePreview`.
- **Shell wiring:** replaced the Sprint 2 `preview.type === 'tabele'` fallback in `KimiWorkspaceShell.tsx` with `TabelePreviewLayout`; existing `pdf`, `xlsx`, and `deck` branches were left unchanged.
- **Component coverage:** added `tests/components/AIChat/KimiWorkspace/tabelePreview/*.test.tsx` for layout sections, compact auto-collapse, schema governance block behavior, relation chip tooltip/loading behavior, and rationale disclosure/proposal status behavior.
- **Requested validation:** `npx vitest run tests/components/AIChat/KimiWorkspace/tabelePreview tests/components/AIChat/KimiWorkspace/ArtifactModuleHome.test.tsx tests/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.test.ts --maxWorkers=1 --maxConcurrency=1` → PASS, 6 files / 19 tests.
- **DBR77 scan:** shell `rg` was unavailable in this environment (`command not found: rg`); equivalent workspace ripgrep scan for `#[0-9a-fA-F]{3,6}\b` over `src/components/AIChat/KimiWorkspace/tabelePreview` and `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` → no matches.
- **Not completed in this sprint:** side-by-side Wordy screenshot evidence and full lint/typecheck remain for Sprint 6 / QA gate.
