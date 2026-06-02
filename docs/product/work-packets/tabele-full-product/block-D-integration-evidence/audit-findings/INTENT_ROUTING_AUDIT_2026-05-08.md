# Intent Routing Audit — Block D / D-S0

**Date:** 2026-05-08
**Scope:** `KimiWorkspaceShell` lane mapping, `TabeleMelsView` right-rail, conversion-button insertion points.

## Current state

- **Lanes are a fixed enum:** `KimiLane = 'wordy' | 'excele' | 'prezentacje' | 'tabele'`. There is no runtime "lane resolver" — each lane has a dedicated route + view (`WordyView`, `ExceleView`, `PrezentacjeView`, `TabeleView`).
- **Tabele has two surfaces:**
  - **Legacy** — `KimiWorkspaceShell lane="tabele"` (chat left, preview right; preview header has Download/PDF cluster).
  - **MELS** — `TabeleMelsView` → `ExecutiveModuleShell` with a typed right-rail tool strip (`buildTabeleRightRailTools`).
- **Right rail tool taxonomy already includes the Block D anchor points:**
  - `search`, `ai-editor`, `qa-report`, `source-pack`, `layout`, **`share`**, `analytics`.
- **No "Convert to X" UI exists today.** This is greenfield for Block D.

## Conversion entry-point options (CTO decision: option B)

| Option | Pros | Cons |
|---|---|---|
| A — Add a new `conversions` right-rail tool with its own panel. | Clean MELS taxonomy; easy to test in isolation. | New icon competes with existing 7 tools; users may not discover it. |
| **B — Reuse the existing `share` right-rail tool** and host conversion buttons inside its panel. | Conversions are conceptually a "share" action (Tabele → Doc/Deck → distribute). Zero new taxonomy. Fewer icons. | Slight semantic stretch — but `share` is already canonical Menu 3 anchor. |
| C — Add buttons to `ExecutiveModuleShell.presenceSlot` (top-bar right cluster). | Highest visibility. | Violates `.cursor/rules/ai-actions-menu3.mdc` — AI actions must live in the right rail, not the top bar. Conversions are AI-driven (use `AiUsageService`). |

**CTO decision:** Option **B** — extend the `share` panel to render a "Conversions" section above the existing share controls. Keep the icon strip identical so users cannot confuse Block D-only features with general MELS controls.

## Form-intake entry point

The user-facing "Create intake form" action is logically a **Form Builder** action, not a right-rail tool. Today, `TabeleView` exposes a "Forms" surface inside the canvas (legacy). Block D will:

1. Keep the Forms surface where it is.
2. Add a "Publish public link" button on each saved form that produces the JWT-tokenized URL.

This avoids touching the right-rail taxonomy for forms, which keeps the MELS axis clean.

## Files that change in Block D

- `src/components/AIChat/KimiWorkspace/tabeleShell/share/TabeleSharePanel.tsx` (NEW) — right-rail "share" panel hosting conversions.
- `src/components/AIChat/KimiWorkspace/tabeleShell/useTabeleRightRailPanels.tsx` — wires the share panel.
- `src/components/AIChat/KimiWorkspace/conversion/TabeleConvertButton.tsx` (NEW) — single-button presentational helper used inside the share panel.
- `src/components/AIChat/KimiWorkspace/formIntake/CreateIntakeFormDialog.tsx` (NEW) — modal launched from `TabeleView`.

Foundation Block files **untouched**:

- `useKimiArtifactPipeline.ts` — read-only.
- `KimiWorkspaceShell.tsx` — read-only (legacy surface ignored; the user's MELS flag is the canonical surface).
- `AppRoutes.tsx` — touched only to add `/public/forms/:token` (already approved by 00_TASK_PACKET).
