# UI/UX DONE Cards Evidence Runbook

Status: `READY_FOR_CAPTURE`
Date: 2026-05-03
Scope: `Wave A + Wave B cards marked DONE`

## 1) Goal

Collect the mandatory visual package for each DONE card in a consistent way, with minimal operator ambiguity.

Required shots per card:
- Light mode
- Dark mode
- Menu 3 active
- Selected row (checkbox visible)
- Settings popover (if applicable)
- Empty/error/degraded state (if flow exists)

## 2) Capture protocol (same for all cards)

1. Open the card in app runtime and wait for data to fully load.
2. Set browser zoom to `100%` and keep viewport width stable for all shots.
3. Capture `Light` first, then `Dark` from the same place.
4. Open `Menu 3` and capture visible right-side command actions.
5. Select one representative row and confirm checkbox visibility before capture.
6. Open settings popover (`Settings2`/table config) and capture.
7. Trigger one degraded state (empty, unavailable, validation error, import fail, etc.) and capture.

## 3) File naming convention

Use:
`<card-slug>__<evidence-type>__<mode>__<date>.png`

Examples:
- `mywork-inbox__menu3-active__light__2026-05-03.png`
- `assessment__selected-row__dark__2026-05-03.png`
- `execution__degraded-state__light__2026-05-03.png`

## 4) DONE card checklist

| Card | Owner | Target date | Light | Dark | Menu 3 | Selected row | Settings popover | Empty/error/degraded |
|---|---|---|---|---|---|---|---|---|
| `My Work > Inbox` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `My Work > Tasks` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Interview > all tabs` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Discovery Tools` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Assessment` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Execution` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Results` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Economics` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Meeting` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |
| `Reports & Presentations` | `TBD` | `TBD` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` | `TODO` |

## 4.1) Evidence storage path (recommended)

- `docs/ui-standards/evidence/<card-slug>/`
- Keep all six required captures per card in a single folder.
- File manifest template: `docs/ui-standards/evidence/EXPECTED_FILES_TEMPLATE.csv`
- Assignment template: `docs/ui-standards/evidence/ASSIGNMENT_TEMPLATE.csv`

## 5) Acceptance gate

A card can stay `DONE` only when:
- all required evidence shots are present,
- screenshots are readable in both modes,
- Menu 3 action visibility is proven,
- selected-row and settings-popover behavior is visible and consistent with App Table contract.

## 6) Automation (fast path)

Use npm commands from repo root:
- `npm run evidence:sync` - sync `STATUS.md` and assignment statuses from existing screenshots
- `npm run evidence:check` - generate final gate report with missing files list
- `npm run evidence:daily -- YYYY-MM-DD` - generate/update day report for selected date
- `npm run evidence:final` - generate closure summary snapshot
- `npm run evidence:refresh` - run sync + check + final in one command
