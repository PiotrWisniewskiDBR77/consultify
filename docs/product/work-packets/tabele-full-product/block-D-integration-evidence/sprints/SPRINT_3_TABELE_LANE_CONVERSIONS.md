# Sprint 3 — Tabele Lane Conversion Buttons (Block D)

**Sprint ID:** `D-S3`
**Owner:** Agent B
**Status:** `EXECUTED — GO`
**Estimate:** ~1 day
**Epic:** EPIC-T13
**Closed:** 2026-05-08

## Goal

Surface the "Convert to Document / Convert to Presentation" controls inside
the Tabele lane Menu 3 (right-rail), wired to `TableArtifactConversionService`
shipped in D-S1. Provide a recent-conversions list with deep links and clean
status badges. Honor the right-rail kill switch so the UI stays dark by default
until the workspace is opted in.

## Pre-sprint risk check

- D-P1 (button confusion across lanes): mitigated by reusing the existing
  `share` right-rail tool; no new taxonomy added.
- D-P2 (citation rendering): scoped out — citations remain a downstream
  artifact concern handled by Wordy / Prezentacje renderers in D-S5.

## CTO decisions applied

- **Q15** (`00_CTO_DECISIONS.md`): the conversion controls live in the existing
  right-rail `share` tool inside `TabeleMelsView`. No new tool ID, no new
  Menu-3 button surface in `KimiWorkspaceShell`. This avoids right-rail
  taxonomy drift and keeps Menu-3 placement compliant with
  `.cursor/rules/ai-actions-menu3.mdc`.

## Deliverables

### Created

- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/share/TabeleSharePanel.tsx`
  — orchestrator panel rendered in the right rail's `share` slot.
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/TabeleSharePanel.test.tsx`
  — 5 component tests covering rendering, target switch, source-pack
  selection, optimistic refresh on submit, and recent-conversions list.
- `consultify/src/utils/tabeleConversionsFlag.ts`
  — client-side kill switch (`isTabeleConversionsEnabled`).

### Updated

- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx`
  — wires `TabeleSharePanel` into the `share` panel slot when both
  `isTabeleConversionsEnabled()` and `workspaceId` are present.
- `consultify/src/services/api/tablePlatform.api.ts`
  — adds `TableConversionTarget`, `TableConversionStatus`,
  `TableConversionOutlineHint`, `TableConvertInput`, `TableConvertResult`,
  `TableConversionRecord` types and `convertTable`, `getTableConversion`,
  `listTableConversions` clients.
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/useTabeleRightRailPanels.test.tsx`
  — extended to assert the share-panel slot is wired alongside QA + AI
  Editor + Source Pack panels when the flag is forced enabled.

### Intentionally not changed

- `KimiWorkspaceShell.tsx` — per CTO Q15, the legacy non-MELS shell does
  NOT host the conversion buttons. The Tabele lane uses `TabeleMelsView`
  (MELS shell), so the share panel is rendered through the MELS right rail.
- `public/locales/{en,pl}/translation.json` — i18n keys deferred (English
  copy only in this sprint). The strings used (`Document`, `Presentation`,
  `Live records`, `Convert to …`, status labels) are already covered by
  existing keys in the source-pack and QA panels; new keys will be added in
  D-S5 alongside the Anygravity P0 trial localization sweep.

## Sprint Exit Gate

- [x] Frontend lint clean on changed files (zero new errors / warnings).
- [x] DBR77 hex scan clean on `TabeleSharePanel.tsx` (no raw `#[0-9a-fA-F]{3,6}`
      literals; Tailwind tokens only).
- [x] Component tests green: `TabeleSharePanel.test.tsx` (5/5),
      `useTabeleRightRailPanels.test.tsx` (4/4).
- [x] Tabele lane regression green: 9 files / 57 tests pass under
      `tabeleShell/__tests__`.
- [x] Manual review: the share panel renders inside the MELS right-rail
      `share` slot only — no separate toolbar appears below the canvas, no
      duplicate button on Menu 3, no AI buttons placed on the canvas.
      Compliant with `.cursor/rules/ai-actions-menu3.mdc`.
- [x] Recommendation: `GO` to D-S4.

## Outcome

`GO` to D-S4. See `evidence/sprint-3/validation-matrix-run.md`.
