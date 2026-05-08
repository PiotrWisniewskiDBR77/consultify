# Sprint 6 — Source Pack Builder (Block C)

**Sprint ID:** `C-S6`
**Owner:** Agent A (backend) + Agent C (V8 snapshot integration) + Agent B (frontend)
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T12

## Goal

Ship `SourcePackService`, `tp_source_packs` table, candidate ranking with embeddings, ACL filter, V8 snapshot persistence, and `TabeleSourcePackPanel` UI.

## Pre-sprint risk check

C-T7 (ranking perf), C-S2 (ACL filter on candidates).

## Deliverables

- `SourcePackService.ts` with `findCandidates`, `createPack`, `getPack`, `listPacks`.
- Migration adds `tp_source_packs` table.
- Routes mounted before wildcards.
- `TabeleSourcePackPanel.tsx` + `SourceCandidateCard.tsx`.
- Menu 3 button "Source Pack" in `KimiWorkspaceShell` (lane=tabele).
- Tests.

## Files

### Created
- `consultify/server/src/services/tablePlatform/SourcePackService.ts`
- `consultify/server/src/routes/table-platform.source-pack.routes.ts`
- Migration extension to `2026_05_block_c_ai_operator.sql` adding `tp_source_packs`.
- `consultify/src/components/AIChat/KimiWorkspace/sourcePack/TabeleSourcePackPanel.tsx`
- `SourceCandidateCard.tsx`
- Tests.

### Updated
- `consultify/server/src/services/tablePlatform/index.ts`
- `consultify/server/src/index.ts`
- `consultify/src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` (Menu 3 button)
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (panel slot)

## Sprint Exit Gate

- [ ] All endpoints work.
- [ ] Cross-tenant 403 verified.
- [ ] Candidate ranking <2 s on 10k record corpus.
- [ ] Pack creation persists V8 snapshot.
- [ ] Menu 3 button DBR77 compliant.
- [ ] Recommendation: `GO` to S7.
