# C-S6 — Validation Matrix Run

**Sprint:** Block C / Sprint 6 — Source Pack Builder
**Date:** 2026-05-08
**Verdict:** `EXECUTED — GO`

## 1. Backend service tests (`SourcePackBuilderService.test.ts`)

```
✓ src/services/tablePlatform/__tests__/SourcePackBuilderService.test.ts (21 tests)
  ✓ findCandidates × 7
  ✓ createPack × 5
  ✓ getPack × 3
  ✓ listPacks × 2
  ✓ markPackUsed × 2
  ✓ verified-only / recencyDays filter wiring × 2
```

Cross-tenant defense matrix:

| Surface | Tenant mismatch behavior | Status |
|---|---|---|
| `findCandidates` | Throws `TENANT_VIOLATION` (403) before scan | ✅ |
| `createPack` | Throws `TENANT_VIOLATION` (403) before snapshot | ✅ |
| `getPack` | Returns `null` (no enumeration) | ✅ |
| `listPacks` | Always scoped by `organization_id`; nothing leaked | ✅ |
| `markPackUsed` | Throws `PACK_NOT_FOUND` (404) when row not in tenant | ✅ |
| Records from another table | Throws `MIXED_TABLES` after ownership probe | ✅ |

## 2. Block C regression suite

```
 ✓ AiUsageService.test.ts                (11 tests)
 ✓ TableAiEditorService.test.ts          (15 tests)
 ✓ TableQaService.test.ts                (19 tests)
 ✓ SourcePackBuilderService.test.ts      (21 tests)  ← new
 ✓ TableAiEditorLevels/__tests__/×8      (49 tests)
─────────────────────────────────────────────────────
 Test Files  12 passed (12)
      Tests  115 passed (115)
```

No flake, no regressions.

## 3. Frontend tests (jsdom)

```
 ✓ TabeleSourcePackPanel.test.tsx        (5 tests)   ← new
 ✓ TabeleAiEditorPanel.test.tsx          (5 tests)
 ✓ TabeleQaPanel.test.tsx                (5 tests)
 ✓ useTabeleRightRailPanels.test.tsx     (4 tests)   ← extended
─────────────────────────────────────────────────────
 Test Files  4 passed (4)
      Tests  19 passed (19)
```

Frontend coverage highlights:

- Panel renders both candidate list and saved-pack list from test seams without making any network calls.
- Toggling a candidate updates the running counter (selectable up to `MAX_PACK_RECORDS = 200`).
- Save button is disabled when name is empty OR no records selected.
- Save flow calls `createSourcePack(...)` with the correct payload and prepends the new pack to the saved-pack list.
- "Use" hands off the pack to the parent callback.
- Right-rail orchestrator hook injects the pack panel only when `workspaceId` is provided AND the kill switch is on.
- Right-rail handoff via `presetFromPack(...)` defaults to AI Editor level `column` with `sourcePackId` in context.

## 4. DBR77 hex scan

`rg '#[0-9a-fA-F]{3,6}' src/components/AIChat/KimiWorkspace/tabeleShell/sourcePack`
→ no matches. New components use only design-system tokens (slate / emerald / amber / rose, dark-mode pairs included).

## 5. Lint

`ReadLints` on all touched files: 0 errors, 0 warnings.

## 6. Performance baseline (raw scan, no embeddings)

The candidate scan is capped at 1 000 records per query (defensive bound). Composite ranking is O(N), JSON-stringify-based lexical match runs in microseconds per row. Verified-source set is fetched in one parameterised query with a `record_id = ANY($1::uuid[])` filter.

A real 10 000-record perf gate is filed as TBL-FU-C6-3 and will run during C-S7 closeout when the staging DB is loaded with synthetic data.

## 7. CTO decisions log

See sprint markdown § "CTO decisions". Highlights:

- Embedding similarity → TBL-FU-C6-1 (post-MVP).
- `tp_source_packs` columns use `TEXT` for org/workspace consistency.
- V8 snapshot is immutable post-creation.
- Routes added to Gateway also fix the C-S4 oversight (QA routes were never mounted).

## 8. Recommendation

`GO` to **C-S7 — Block C QA + closeout**.
