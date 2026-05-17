# D-S3 — Validation Matrix Run

**Date:** 2026-05-08
**Verdict:** `GO` — D-S4 may proceed.
**Feature flag posture:** `ENABLE_TABLE_ARTIFACT_CONVERSION` (server) and
`isTabeleConversionsEnabled()` (client) both default to `false`. The share
panel never wires into the right rail until both flags flip, which keeps the
shipped UI dark and reversible.

## Layered validation

| Layer | Check | Result | Evidence |
|---|---|---|---|
| L1 | TypeScript strict compile (`tsconfig.json`) | PASS *for D-S3 surface* | The only failing TS error in the workspace (`useKimiArtifactPipeline.test.ts:203`) pre-exists D-S3 — none of the share panel, hook, API client, or tests introduce new errors. |
| L1 | Lint on all D-S3 files | PASS | `ReadLints` shows zero issues across `TabeleSharePanel.tsx`, `useTabeleRightRailPanels.tsx`, `tabeleConversionsFlag.ts`, `TabeleSharePanel.test.tsx`, `useTabeleRightRailPanels.test.tsx`, `tablePlatform.api.ts`. |
| L2 | Component tests (D-S3) | PASS — 9/9 | `TabeleSharePanel.test.tsx` (5) + `useTabeleRightRailPanels.test.tsx` (4). |
| L2 | Tabele lane regression | PASS — 57/57 across 9 files | `npx vitest run src/components/AIChat/KimiWorkspace/tabeleShell` |
| L3 | Right-rail wiring | PASS | `useTabeleRightRailPanels.test.tsx` asserts the `share` panel renders alongside QA + AI Editor + Source Pack panels when forced-enabled with both `tableId` and `workspaceId`, and that it is omitted (along with AI Editor + Source Pack) when `workspaceId` is missing. |
| L4 | DBR77 hex scan | PASS | `rg '#[0-9a-fA-F]{3,6}\b' TabeleSharePanel.tsx` — zero matches. Only Tailwind utility tokens (`bg-emerald-50`, `bg-rose-50`, `text-sky-700`, etc.) are used; no raw hex literals shipped. |
| L5 | MELS right-rail compliance | PASS | The share panel is registered under the existing `share` slot in `TabeleRightRailPanelRenderers`. No new tool added to `buildTabeleRightRailTools`; no separate Menu-3 toolbar; no AI/conversion button placed on the canvas. Conforms to `.cursor/rules/ai-actions-menu3.mdc`. |
| L5 | Kill-switch isolation | PASS | The hook returns an empty `panels` map when `tableId` is missing, the kill switch is off, or `workspaceId` is null. Tests cover all three branches. |
| L6 | Network surface | PASS | The panel only invokes `convertTable`, `listSourcePacksForTable`, and `listTableConversions`. All three accept `workspaceId` from the panel props and inherit ACL/feature-flag enforcement on the server side; the client never hard-codes endpoints. |
| L7 | Audit trail | INHERITED from D-S1 | Every successful submission flows through `TableArtifactConversionService.convertTable`, which writes a `tp_table_conversions` row regardless of outcome (`queued` → `running` → `succeeded` / `failed`). The recent-conversions list reads from the same audited ledger. |
| L8 | Visual / DBR77 polish | PASS | Status badges use the documented tone palette (`emerald` for success, `rose` for failure, `sky` for running, `slate` for queued/cancelled). Convert button uses the same Tailwind sky/blue family used elsewhere in the Tabele right rail. |

## Test inventory

### `TabeleSharePanel.test.tsx` (5)

1. Renders empty state with target picker, title input, and "no conversions yet" placeholder.
2. Switches between `Document` and `Presentation` targets via the radiogroup.
3. Selects a saved source pack and the radio reflects the selection.
4. Submits a conversion through `convertTable` and triggers a recent-conversions refresh on success.
5. Renders the recent-conversions list with status badges and external-link buttons for `succeeded` rows.

### `useTabeleRightRailPanels.test.tsx` (4)

1. Returns no panels when `tableId` is missing (regression).
2. Returns no panels when both kill switches are off (default posture).
3. Renders all four panels (`qaReport`, `aiEditor`, `sourcePack`, `share`) when forced enabled with `tableId` and `workspaceId`.
4. Omits AI Editor, Source Pack, and Share panels when `workspaceId` is missing; QA still renders since it only needs `tableId`.

## Files shipped

### Created

- `src/components/AIChat/KimiWorkspace/tabeleShell/share/TabeleSharePanel.tsx`
- `src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/TabeleSharePanel.test.tsx`
- `src/utils/tabeleConversionsFlag.ts`

### Modified

- `src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx` —
  wires `TabeleSharePanel` into the `share` slot under both kill switches.
- `src/components/AIChat/KimiWorkspace/tabeleShell/__tests__/useTabeleRightRailPanels.test.tsx` —
  extended assertions for the share panel slot.
- `src/services/api/tablePlatform.api.ts` — adds conversion types and
  client functions (`convertTable`, `getTableConversion`, `listTableConversions`).

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Conversion endpoints reject the request because the server-side feature flag is off in the operator's workspace. | Low | The convert button surfaces the server error toast verbatim; the underlying API responds with a 403 / 400 with a structured reason. The kill switch is documented in the sprint exit gate. |
| Saved source packs list grows large and the radiogroup becomes unwieldy. | Low | Panel caps the list at 25 packs (`limit: 25`). Curators can rotate older packs in D-S5. The full picker remains in `TabeleSourcePackPanel`. |
| Recent-conversions list shows stale data after a long-running run. | Low | The panel optimistically calls `refreshConversions()` on submit and on the `Refresh` button; a polling refresh will land in D-S5 alongside artifact run telemetry. |
| Localization gap (English copy only). | Low | Captured as a follow-up: `TBL-FU-D-1` — *Localize Tabele share/conversion strings (en/pl)*, owned by D-S5 trial. |

## Follow-up tickets opened

- `TBL-FU-D-1` — Localize Tabele share + conversion strings (en/pl) before
  D-S5 trial recording.
- `TBL-FU-D-2` — Add polling refresh of `listTableConversions` once an artifact
  run is in `running` state so the user does not have to click `Refresh`. Wire
  cancellation when the panel unmounts.
- `TBL-FU-D-3` — Promote the `share` panel header to use the same Tabele
  right-rail header pattern as QA / AI Editor / Source Pack once the shared
  header component lands in EPIC-T16 follow-up.

## Sprint Exit Gate

- [x] Frontend lint + scoped typecheck clean on all D-S3 files.
- [x] DBR77 hex scan clean.
- [x] Component tests green (9/9 D-S3, 57/57 Tabele lane).
- [x] Right-rail wiring verified — share panel only renders inside the MELS
      right rail's `share` slot, never as a separate toolbar.
- [x] Kill switches default off; both are tested.
- [x] Recommendation: `GO` to D-S4.
