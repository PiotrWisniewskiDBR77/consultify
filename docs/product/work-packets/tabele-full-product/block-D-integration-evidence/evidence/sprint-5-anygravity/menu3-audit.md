# Menu 3 (Right Rail) Audit — Tabele Studio Full Product Surface

**Sprint:** D-S5 · 2026-05-08
**Authority:** `.cursor/rules/ai-actions-menu3.mdc`,
`.cursor/rules/21-ai-actions-menu3-placement.mdc`,
`DRD/UI_UX_SOURCE_OF_TRUTH.md`.
**Verdict:** `PASS` — every contextual AI action is rendered inside the
Tabele lane right rail (MELS shell) and nowhere else. The forms admin
surface (`FormsIndex`) hosts a non-AI operator action (`KeyRound`) that
opens a modal panel; this is not an AI button and is therefore outside
the Menu-3 governance scope.

## Right-rail tool registry (Tabele lane, MELS shell)

Source: `src/components/AIChat/KimiWorkspace/tabeleShell/TabeleRightRail.tsx`

```
Search → AI Editor → QA Report → Source Pack → Layout → Share → Analytics
```

| Tool ID | Icon | Owns | Block |
|---|---|---|---|
| `search` | `Search` | placeholder slot for record search | future |
| `ai-editor` | `Sparkles` | `TabeleAiEditorPanel` (8-level AI Editor + budget banner) | C |
| `qa-report` | `ShieldCheck` | `TabeleQaPanel` (5-axis QA + suggestions) | C |
| `source-pack` | `BookOpen` | `TabeleSourcePackPanel` (pack curation) | C |
| `layout` | `LayoutGrid` | placeholder slot for layout / view picker | future |
| `share` | `Share2` | `TabeleSharePanel` (Convert to Doc / Presentation + recent conversions) | D |
| `analytics` | `Activity` | placeholder slot for analytics | future |

**Compliance check.** The shipped tool taxonomy did **not** add a new tool
for conversions; instead the existing `share` slot was reused per CTO
Q15. This avoids a Menu-3 expansion that would have crowded the rail.

## Adversarial audits

| Probe | Expected | Result |
|---|---|---|
| Open Tabele lane → look for any AI button on the canvas | None visible | PASS — `TabeleMelsView` renders zero AI controls outside the right rail. |
| Open Tabele lane → look for a separate toolbar under the metadata strip | None visible | PASS — the metadata strip has no overflow toolbar. |
| Open `KimiWorkspaceShell` (legacy non-MELS lanes) and look for the new "Convert" button | None | PASS — Block D never modified `KimiWorkspaceShell.tsx`. |
| Inspect `<TabeleRightRailPanel>` panel registry for `aiEditor` / `qaReport` / `sourcePack` / `share` slots | All wired | PASS — see `useTabeleRightRailPanels.tsx`. |
| Search the codebase for `<TabeleAiEditorPanel` outside `tabeleShell` | Zero hits | PASS — the only render site is the shell hook. |
| Search the codebase for `<TabeleQaPanel` outside `tabeleShell` | Zero hits | PASS. |
| Search the codebase for `<TabeleSourcePackPanel` outside `tabeleShell` | Zero hits | PASS. |
| Search the codebase for `<TabeleSharePanel` outside `tabeleShell` | Zero hits | PASS. |

## Forms admin surface (out of Menu-3 scope but worth noting)

`FormsIndex.tsx` adds a `KeyRound` icon button on each form card. This
button opens `IntakeJwtPanel` (a modal), which manages the JWT intake
context. It is **not** an AI action and is governed by the forms admin
surface, not the Menu-3 / right-rail rule. The button:

- only appears when `isTabeleFormIntakeEnabled()` is true;
- is grouped with the existing `Globe` / `Shield` / `Lock` share-mode
  controls;
- never duplicates an existing control.

## Manual run instructions

1. On staging with all Tabele kill switches on, open a Tabele table.
2. Verify the right-rail icon strip matches the tool registry above (in
   that exact order).
3. Click each tool icon and confirm the matching panel renders in the
   `TabeleRightRailPanel` zone — no panels overlay the canvas.
4. Open `My Work → Forms` for the same workspace and confirm the
   `KeyRound` action only appears when the form-intake kill switch is
   on. Confirm clicking it opens the modal panel and not a separate
   page.
5. Open the legacy `KimiWorkspaceShell` lanes (`wordy`, `excele`,
   `prezentacje`) and confirm none of the Tabele-only AI actions appear
   on those toolbars.

## Verdict

`PASS`. The Tabele surface is fully compliant with `.cursor/rules/ai-actions-menu3.mdc`.
