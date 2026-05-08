# EPIC-T16 — Unified Executive Module Layout (Tabele lane)

**Status:** `PLANNED — added 2026-05-08`
**Block:** A (Template Catalog) of `tabele-full-product` program.
**Driver:** User-supplied UX directive on 2026-05-08 — converge executive modules (Wordy / Tabele / Prezentacje) on a single layout patterned after `DeckBuilder` (Prezentacje).
**Standard:** `DRD/consultify/docs/product/MODULE_EXECUTIVE_LAYOUT_STANDARD.md` (MELS).

This epic delivers the **Tabele lane** of MELS. Wordy and Prezentacje are out-of-scope here; they migrate in a follow-up program.

---

## Goal

Refactor the Tabele frontend shell so it follows MELS:

- Top bar (single row) with module title + functional chips (Internal / Theme / History / QA / Governance / Analytics / Audit / Share / Agent / primary run-button). **No Menu 2.**
- Left rail with record/table outline + sort/filter + collapse toggle + Teresa AI bottom slot.
- Center canvas keeps the Foundation Block Word-document idiom (Cover / KPI / Schema / Records / Relations / Rationale).
- Right rail with module tools + search (AI Editor 8 levels / QA Report / Source Pack / Layout / Share / Analytics).

After this epic, Tabele's chrome equals DeckBuilder's chrome up to module-specific content.

## Non-goals

- Wordy migration (separate program).
- Prezentacje hardening / collapse-toggle polish (separate program).
- New AI features beyond the existing 8-level AI Editor and QA Report from Foundation Block.
- Changes to canvas content (KPI / Schema / Records sections stay as designed in `12_TABLE_STUDIO_DESIGN_DECISIONS.md`).

## Constraints

- **Reuse, don't fork.** Extract a new shared component `ExecutiveModuleShell` from existing patterns (`KimiWorkspaceShell` + `DeckBuilder`) and have Tabele consume it. This makes the follow-up Wordy migration mostly a wiring task.
- DBR77 monochrome only. No hex literals in the shell.
- Persistent rail widths and collapsed state per module.
- Keyboard shortcuts per MELS § 3.4.
- AI buttons land in the right rail only (Menu 3 rule preserved).

## Deliverables

| ID | Deliverable | Sprint | Owner |
|---|---|---|---|
| T16-D1 | `ExecutiveModuleShell` component (new shared shell). | A-S4 | Frontend lead |
| T16-D2 | Tabele view refactored to consume `ExecutiveModuleShell`. | A-S4 | Frontend |
| T16-D3 | Tabele left rail: record/table outline + sort/filter + collapse toggle + Teresa AI slot. | A-S4 | Frontend |
| T16-D4 | Tabele top bar chips (functional buttons) replacing any leftover Menu 2 row. | A-S4 | Frontend |
| T16-D5 | Tabele right rail tools panel (AI Editor / QA Report / Source Pack hooked into Foundation Block services). | A-S5 | Frontend |
| T16-D6 | Keyboard shortcuts: `Cmd/Ctrl+\`, `Cmd/Ctrl+/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+Enter`, `Cmd/Ctrl+Shift+A`. | A-S5 | Frontend |
| T16-D7 | Persistent rail state (localStorage namespaced by module). | A-S5 | Frontend |
| T16-D8 | Visual review: side-by-side screenshots vs. reference deck-builder screens; ≤ 10 % shape deviation. | A-S6 | UX reviewer |
| T16-D9 | DBR77 hex scan on shell + rails: 0 raw hex literals. | A-S6 | QA |

## Architecture sketch

```
consultify/src/components/shared/ExecutiveModuleShell/
├── index.tsx                 # Layout shell + responsive collapsing
├── TopBar.tsx                # Title + chips + run button + presence
├── LeftRail.tsx              # Wraps caller-supplied list + sort + collapse
├── RightRail.tsx             # Icon strip + side-panel docking
├── ChipDescriptor.ts         # TopBarChipDescriptor shape
├── useRailState.ts           # localStorage-backed widths + collapsed flags
├── shortcuts.ts              # Keyboard shortcut registry
└── styles.module.css         # DBR77 tokens only

consultify/src/components/Tabele/
├── TabeleArtifactView.tsx    # Consumes ExecutiveModuleShell; supplies left/right/canvas content
├── TabeleLeftRail.tsx        # Record / table outline + sort/filter + Teresa AI slot
├── TabeleRightRail.tsx       # AI Editor / QA Report / Source Pack tabs
└── TabeleTopBarChips.tsx     # Internal / Theme / History / QA / Gov / Analytics / Audit / Share / Agent / Run
```

## Acceptance criteria

- [ ] `ExecutiveModuleShell` rendered in Tabele view; Foundation Block flow unchanged for end-users (artifact open → KPI → Schema → Records → Relations → Rationale).
- [ ] Top bar present, **no horizontal Menu 2 row** anywhere in Tabele.
- [ ] Left rail present with record/table outline, sort/filter, collapse toggle, Teresa AI bottom slot.
- [ ] Right rail present with AI Editor (8 levels), QA Report, Source Pack, Layout, Share, Analytics — all reachable in ≤ 2 clicks.
- [ ] Keyboard shortcuts work and are listed in `?` help modal.
- [ ] Rail widths and collapsed state persist across reload.
- [ ] DBR77 hex scan clean.
- [ ] Visual review approved (vs reference screens).
- [ ] No regression in Foundation Block flows: artifact open / Source Pack click-through / governance verdict still pass their existing E2E specs.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Refactor scope creep into Wordy / Prezentacje. | Medium | High | EPIC-T16 acceptance is **Tabele lane only**. Wordy + Prezentacje hardening is a separate program. |
| `KimiWorkspaceShell` callers regress. | Medium | Medium | Keep `KimiWorkspaceShell` intact; make `ExecutiveModuleShell` a sibling. Migrate Tabele to the new shell, not vice versa. |
| Right rail panels (AI Editor / QA Report / Source Pack) are currently rendered elsewhere; rewiring may break selectors. | Medium | Medium | Map current selectors → new placements in A-S5; update E2E specs in same sprint. |
| MELS § 6 acceptance ambiguous (10 % tolerance). | Low | Low | UX reviewer signs off in A-S6 with annotated screenshot diff. |

## Sequencing within Block A

EPIC-T16 lands in the frontend phase of Block A:

- **A-S4 (Lifecycle Frontend):** D1, D2, D3, D4 — shell extraction + Tabele top bar + left rail.
- **A-S5 (Field Types Frontend):** D5, D6, D7 — right rail tool panels + shortcuts + persistence.
- **A-S6 (QA Gate):** D8, D9 — visual review + DBR77 scan.
- **A-S7 (Closeout):** sign-off recorded in `03_BLOCK_CLOSEOUT.md`.

Rationale: A-S4 already touches `TabeleArtifactView`, A-S5 already adds new field types into the same view. Adding T16 to these sprints avoids a separate frontend pass and keeps lane-A tight.

## Dependencies

- Foundation Block services (`tablePlatform.aiEditor`, `tablePlatform.qaReport`, `tablePlatform.sourcePack`) — already shipped; must remain stable through the program.
- DBR77 token set — stable.
- Block B does not depend on T16; backend lane proceeds in parallel.

## Out-of-scope follow-ups (tracked in program-level roadmap)

- F-LAYOUT-1: Migrate Wordy to `ExecutiveModuleShell` (remove Menu 2).
- F-LAYOUT-2: Tighten Prezentacje to MELS § 6 (formal collapse toggle, shared shell adoption).
- F-LAYOUT-3: Promote `ExecutiveModuleShell` to design-system package (post-MVP).

These follow-ups are queued for the `executive-layout-unification` follow-up program and are NOT acceptance criteria for the current program.
