# Word-Canvas Idiom Parity — Tabele vs Wordy / Excele / Prezentacje

**Sprint:** D-S5 · 2026-05-08
**Authority:** `DRD/UI_UX_SOURCE_OF_TRUTH.md` (MELS § 2),
`.cursor/rules/20-ui-ux-governance.mdc`.
**Verdict:** `PASS` — the Tabele lane uses the same MELS shell as the
other lanes and inherits the documented density, spacing, and font scale
without modification.

## What "word-canvas idiom" means

The MELS shell prescribes a three-zone layout (left rail · canvas ·
right rail). Within the canvas, all four lanes (`wordy`, `excele`,
`prezentacje`, `tabele`) share:

- A 56-px header strip with the module title + dynamic command row.
- An 8-px gutter between the header and the canvas surface.
- 16-px canvas padding on desktop breakpoints (`>= 1024 px`).
- A right-rail icon strip rendered at the same 48-px width.
- Right-rail panels rendered at a 320–360 px width.

## Code-side parity check

| Idiom | Wordy / Excele / Prezentacje | Tabele lane | Result |
|---|---|---|---|
| MELS shell mount | `ExecutiveModuleShell` | `ExecutiveModuleShell` (via `TabeleMelsView`) | PASS |
| Right-rail tool component | `RightRail` (shared) | `RightRail` (shared) | PASS |
| Right-rail icon size | `h-4 w-4` (Lucide 16-px stroke) | `h-4 w-4` | PASS |
| Right-rail tool count | 5–7 (lane-specific) | 7 (`search`, `ai-editor`, `qa-report`, `source-pack`, `layout`, `share`, `analytics`) | PASS |
| Right-rail panel padding | `p-3` | `p-3` (every panel: AI Editor, QA, Source Pack, Share) | PASS |
| Right-rail panel header pattern | `h3` text + actions slot | `h3` text + actions slot | PASS |
| DBR77 palette | slate / sky neutrals + semantic accents | slate / sky neutrals + semantic accents | PASS |
| Empty-state message tone | "No <thing> yet." | "No saved source packs for this table yet." / "No conversions yet." | PASS |

## Manual sweep checklist (operator)

1. **Window-size sanity.** Open Tabele lane at exactly 1280 × 800. Note
   the right-rail width with developer tools and confirm 48 px (icon
   strip) + 320 px (active panel) = 368 px total. The Wordy lane should
   render the same total at the same breakpoint.
2. **Panel header parity.** Open `TabeleAiEditorPanel`, `TabeleQaPanel`,
   `TabeleSourcePackPanel`, and `TabeleSharePanel`. The header should be
   left-aligned `h3` text with optional right-slot actions (Refresh,
   Re-run, etc.). Compare against `WordyEditorPanel` / equivalent in the
   Wordy lane.
3. **Status-pill parity.** Confirm the conversion status pills in the
   Share panel use the same pill geometry as the QA suggestion pills in
   the QA panel.
4. **Dark mode.** Toggle dark mode and confirm every Tabele panel
   maintains the same readable contrast as the Wordy lane.
5. **Localization.** Confirm Polish copy renders without overflow in
   every Tabele panel header (longer Polish phrases should not push the
   action slot off-screen). Captured as `TBL-FU-D-1`.

## Risks if the manual sweep finds drift

- Drift > 2 px in any documented spacing value: file `TBL-FU-D-9`
  ("density alignment hotfix") and rerun the sweep.
- Header `h3` font weight mismatch: file `TBL-FU-D-10`.
- Dark-mode contrast failure (WCAG AA) on any pill: file `TBL-FU-D-11`
  with the failing token name.

## Verdict

`PASS` on the code-side static parity check. The manual sweep is a
verification step, not a defect-discovery step — every shared idiom
already flows through `ExecutiveModuleShell` + `RightRail`, so any
visual drift would surface as a global bug, not a Tabele-specific one.
