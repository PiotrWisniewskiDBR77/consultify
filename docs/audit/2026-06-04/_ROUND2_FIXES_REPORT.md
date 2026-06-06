# Round-2 UI/UX audit + fixes (2026-06-04)

Post-rollout self-audit of screens vs the UI/UX standard + detailed color report, then a fix round.

## Audits produced (read-only, this round)
- `COLOR_USAGE_DETAILED_REPORT.md` — exhaustive color inventory post-remap (token dump, per-module table, offender list).
- `CONFORMANCE_GROUP_A.md` — MyWork, Interview, Decisions, Tools, Assessment.
- `CONFORMANCE_GROUP_B.md` — Execution, Results, Initiatives, Finance, Meeting, Organization.
- `CONFORMANCE_GROUP_C.md` — Admin, Settings, Reports/Outputs, Chat/AIChat, Presentations, DocumentStudio, views.

## Headline audit findings
- **Palette remap works at class-level** — leakage is in LITERALS: ~750 demoted-violet/indigo hexes, 579 inline-style colors, 370 purple/indigo decorative gradients, AIChat off-token dark surfaces, contrast residue.
- **Systemic conformance debt**: (1) empty-state-shown-on-load-failure bug repeated across modules; (2) raw `fixed inset-0` modals instead of `Modal`; (3) form-primitive bypass (~80 `<select>`, ~50 checkbox); (4) hand-rolled chips/spinners in detail screens; (5) Organization bypasses the whole canon; (6) dead `EconomicsHub`.
- Best-conformant references already in repo: ExecutionHub (Menu-3 SSOT), ReportsAndPresentations, FinanceHub.

## Fixes applied this round
### Wave 1 (committed)
- **Empty-on-failure state bug — 6 sites fixed** (the Ideas-class bug → failures looked like "0 items"): `DecisionInbox`, `InterviewHub` (sessions, via existing degraded pattern), `MeetingHub`, `AssessmentHub` (hard-failure branch), `MyWork/Inbox/InboxTriage`, `MyWork/InboxContent`. Now render `ErrorState` with retry, distinct from empty.
- **Off-brand color literal cleanup — 187 files**: demoted-violet/indigo brand hexes → crimson; crimson→indigo/purple/fuchsia decorative gradients → tonal crimson (~150 files); violet rgba glows → crimson; AIChat `dark:bg-[#1a1d2e]` → navy token; off-palette violet-black hexes → navy; Admin crimson-drift nav → primary; brand-default accents → crimson. **0 off-brand violet/fuchsia gradients remain app-wide.** Legit colors (3rd-party logos, charts, user swatches, deck presets, org branding) preserved.

### Wave 2 (committed)
- **Dark-mode contrast — `dark:text-slate-600` → `dark:text-slate-400` across 212 files** (slate-600 on navy was too dark; now legible). + 1 escaped light-mode `text-slate-400` on white → slate-600. Light-mode escapees were otherwise only light-text-on-dark-surface (legit).

## Gates (every wave)
Frontend `tsc --noEmit` = 0 · `eslint . --quiet` = 0 · production build green.

## Deferred to a structural round (need visual review — NOT done blind)
- **Raw `fixed inset-0` modals → `Modal`/`Drawer`** (MyWork detail modals, Interview, Results 9, Initiatives 24, AIChat 14). Structural; do with visual checkpoints.
- **Form-primitive migration** (`<select>`→`SelectField`, checkbox→`Switch`) across Admin/Settings/DocumentStudio (~130 sites). Mechanical but behavior-sensitive.
- **Hand-rolled chips in operational tables** (status rendered inside `FilterableTable`) → chip-system.
- **`RowActionsMenu` rollout** to Economics/Meeting/Organization/Admin (hand-rolled kebabs).
- **Organization module** — bespoke shell bypassing ModuleHub/Menu2/Menu3 → adopt canon (larger rework).
- **Dead code** — remove `EconomicsHub.tsx` (superseded by FinanceHub).
- **Crimson "lightly" triage** — ~6,250 solid `bg-primary/crimson` fills; demote non-CTA fills to tints/neutral (needs visual judgment).
- **`c-*` token adoption** — canonical semantic tokens shipped but under-used; migrate slate/navy call-sites over time.
