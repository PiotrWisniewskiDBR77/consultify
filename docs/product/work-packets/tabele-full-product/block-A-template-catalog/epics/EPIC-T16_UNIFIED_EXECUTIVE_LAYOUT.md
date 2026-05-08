# EPIC-T16 — Unified Executive Module Layout (Tabele lane)

**Status:** `IN PROGRESS — D1 + D2 (foundations) + D3..D5 (Tabele lane components) LANDED 2026-05-08; D6..D9 + integration follow-up pending`
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

---

## Update — 2026-05-08 — T16-D1 + T16-D2 (foundations) landed

**Sprint:** EPIC-T16-S1 (foundations).
**Decision (CTO):** Land the shared shell + state machinery as a standalone, side-effect-free package first, then drive Tabele migration in EPIC-T16-S2 with a minimal-diff `TabeleArtifactView` swap. Wordy / Prezentacje migrations remain out of scope per § Non-goals.

### Deliverables landed

- ✅ **T16-D1 — `ExecutiveModuleShell` package**:
  - `consultify/src/components/shared/ExecutiveModuleShell/index.tsx` — composed three-zone layout (TopBar + LeftRail + Canvas + RightRail).
  - `TopBar.tsx` — single 56 px row, MELS-ordered chip strip, presence slot, editable title, back arrow. **No second toolbar row.**
  - `LeftRail.tsx` — outline / item-list rail with mandatory collapse toggle, optional `toolsSlot` (sort/filter/search), optional Teresa AI `bottomSlot` (96..192 px).
  - `RightRail.tsx` — 56 px icon strip + 320..560 px expanded panel; mutually exclusive tools; collapsible to 16 px sliver.
  - `ChipDescriptor.ts` — `TopBarChipDescriptor` shape + `MELS_CHIP_ORDER` constant + `sortChipsByMelsOrder` utility.
  - `shortcuts.ts` — `buildMelsShortcuts` + `useMelsShortcuts` for `⌘\\`, `⌘/`, `⌘K`, `⌘↵`, `⌘⇧A`. Editable-field guard included.
- ✅ **T16-D2 — `useRailState` (foundations subset of D7)**:
  - `useRailState.ts` — collapse + width state; clamps widths to `RAIL_WIDTH_BOUNDS` (left 200..480 px, right 320..560 px); persists to `localStorage` under `mels.rail.{moduleKey}`; SSR-safe; `ephemeral` opt-out for tests / embedded contexts.

### Tests landed (22/22 green)

- `__tests__/useRailState.test.ts` (10 tests) — defaults, toggles, clamping, persistence, restoration, ephemeral, namespacing per moduleKey, resetToDefaults.
- `__tests__/shortcuts.test.ts` (6 tests) — descriptor emission gates, match predicates per documented combo, listener attach/detach lifecycle, editable-field suppression + modifier override.
- `__tests__/ExecutiveModuleShell.test.tsx` (6 tests) — four-zone render, MELS chip ordering, left rail collapse, right rail tool toggle, canvas slot, `data-mels-module` attribute.

Total: **22/22 unit tests green**, 0 linter errors, 0 raw hex literals (DBR77 clean — only Tailwind tokens).

### Deferred to EPIC-T16-S2 (next sprint)

- **T16-D3** — `TabeleLeftRail` (record / table / view outline + sort/filter + Teresa AI slot).
- **T16-D4** — `TabeleTopBarChips` (Internal / Theme / History / QA / Gov / Analytics / Audit / Share / Agent / Run wired to Foundation Block services).
- **T16-D5** — `TabeleRightRail` tool tabs (AI Editor 8 levels / QA Report / Source Pack / Layout / Share / Analytics).
- **T16-D6** — Help-modal listing for the keyboard shortcut display strings (registry already in place; needs UI surface).
- **T16-D7** — Width-resize handles + drag UX (state + clamping already shipped; only the visible drag handle and pointer logic remain).
- **T16-D8 / T16-D9** — Visual review screenshots + DBR77 hex scan (acceptance gate).

### Why split foundations from Tabele lane

`TabeleArtifactView` is the same surface that hosts B-S5a host-integration work (provenance grid gutter, RowDetailPanel banner) and A-S5b (TabeleTemplatesGrid wiring). Landing the shell as a standalone package first avoids a single jumbo diff that would touch the foundation block and the lifecycle/provenance host integration in one commit. The migration in EPIC-T16-S2 is now a pure "swap KimiWorkspaceShell for ExecutiveModuleShell + supply slot props" operation.

### Risk register (foundations)

| Risk | Status |
|---|---|
| `KimiWorkspaceShell` callers regress. | Mitigated — new shell is a sibling; nothing imports it yet. |
| DBR77 raw hex leakage. | Mitigated — manual scan + tests; only Tailwind tokens used. |
| Persistence race when two shells mount the same moduleKey. | Accepted — last-write-wins; documented in `useRailState` JSDoc. Production rarely mounts two executive modules simultaneously. |
| Right rail panel state lost on reload. | Accepted — only collapse state persists. Tool selection is ephemeral by design (panels are tool-action surfaces, not workspaces). |

---

## Update — 2026-05-08 — T16-D3 + T16-D4 + T16-D5 (Tabele lane components) landed

**Sprint:** EPIC-T16-S2 (Tabele lane components, presentational layer).
**Decision (CTO):** Land the Tabele lane component layer as a standalone, presentational, side-effect-free package — `tabeleShell/`. Defer the `TabeleView.tsx` swap (replacing the `KimiWorkspaceShell` mount with `ExecutiveModuleShell`) to EPIC-T16-S3 because that diff also touches the Foundation Block control flow (pipeline / preview / handlers), and we want a clean review surface.

### Deliverables landed

- ✅ **T16-D4 — `TabeleTopBarChips`**:
  - `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/TabeleTopBarChips.tsx`.
  - `buildTabeleTopBarChips({ handlers, state, labels })` returns a `TopBarChipDescriptor[]` array honouring the documented MELS canonical chip order: Internal → Theme → History → QA → Governance → Analytics → Audit → Share → Agent → Run.
  - Confidentiality dot tone tracks `state.confidentiality` (public=success, internal=info, confidential=danger).
  - Governance dot tone tracks `state.governanceVerdict` (PASS=success, PASS_WITH_P2/BLOCKED_P1=warning, BLOCKED_P0=danger, INCONCLUSIVE=neutral).
  - Run chip is `kind: 'primary'` and respects `runEnabled=false`.
  - Agent chip is `kind: 'toggle'`, reflects `state.agentOpen`.
  - Missing handlers render the matching chip as disabled — lane gating without breaking the strip.
  - i18n labels can be overridden via `labels` prop (default labels in English).

- ✅ **T16-D3 — `TabeleLeftRail`** (presentational):
  - `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/TabeleLeftRail.tsx`.
  - Default outline = Foundation Block sections in canonical order: Cover / KPI / Schema / Records / Relations / Rationale.
  - Caller may override via `items` prop (e.g. record list, view list, recent records).
  - `activeItemId` drives the highlighted row (`data-active="true"`).
  - Optional badge per item (count + tone — neutral/success/warning/danger/info).
  - Optional `toolsSlot` rendered above the outline (sort/filter/search input goes here).
  - Empty state with caller-supplied `emptyLabel`.

- ✅ **T16-D5 — `TabeleRightRail`**:
  - `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/TabeleRightRail.tsx`.
  - `buildTabeleRightRailTools({ state, labels })` returns a `RightRailToolDescriptor[]` in MELS spec order: Search records → AI Editor (8 levels) → QA Report → Source Pack → Layout → Share → Analytics. Per .cursor/rules/ai-actions-menu3.mdc, AI buttons land here exclusively.
  - QA tool icon shows badge + warning dot when `qaFindingsCount > 0`.
  - Source Pack tool shows badge + tone (success/warning/danger) when count + tone supplied.
  - AI Editor disabled when `aiEditorEnabled === false` (e.g. before artifact materialisation).
  - `<TabeleRightRailPanel>` mounts the matching panel for the active tool id; falls back to `fallback` for unknown ids.

### Tests landed (27/27 green)

- `__tests__/TabeleTopBarChips.test.ts` (8 tests, node env) — order assertion against `MELS_CHIP_ORDER`, confidentiality + governance dot tone mapping, missing-handler gating, primary kind on Run, toggle kind on Agent, custom labels, analytics gating.
- `__tests__/TabeleLeftRail.test.tsx` (8 tests, jsdom) — default outline order matches Foundation Block, custom items override, active flag, onSelect with id, disabled item suppresses onSelect, badge rendering with tone, empty state, tools slot mount.
- `__tests__/TabeleRightRail.test.tsx` (11 tests, jsdom) — tool order matches spec, AI Editor gating, QA badge + tone presence/absence, Source Pack badge + tone, custom labels, panel mounting by id, null active id, unknown id with/without fallback.

Total: **49/49 unit tests green across S1+S2** (22 from foundations + 27 from Tabele lane). 0 linter errors. 0 raw hex literals.

### Why split component layer from `TabeleView.tsx` swap

`TabeleView.tsx` (lines 124–446) wraps `KimiWorkspaceShell` and forwards a tightly-coupled props bag (`taskSteps`, `totalSteps`, `completedSteps`, `isGenerating`, `isCompleted`, `preview`, `onReplay`, `onRemix`, `onDownload`, `onPreviewFile`, `onAllFiles`, `onStartGeneration`, `chatSystemPrompt`). Migrating this to `ExecutiveModuleShell` requires either:
1. A pure prop translation (adapter), or
2. A deeper refactor of how `useKimiArtifactPipeline` exposes its state.

Either path produces a single jumbo diff that overlaps with B-S5a host integration and A-S5b TabeleTemplatesGrid wiring. EPIC-T16-S3 (separate sprint) will:
- Add `isMelsTabeleEnabled()` frontend flag (default OFF).
- Branch `TabeleView` between the legacy `KimiWorkspaceShell` path and a new `ExecutiveModuleShell` mount that consumes the components landed in this sprint.
- Verify Foundation Block E2E specs still pass (artifact open → KPI → Schema → Records → Relations → Rationale).
- Drop the legacy branch only after the flag is graduated.

### Deferred to EPIC-T16-S3 + S4

- **T16-D2 (lane swap)** — replace `KimiWorkspaceShell` mount inside `TabeleView.tsx` with `ExecutiveModuleShell` + `tabeleShell/` adapters, behind `isMelsTabeleEnabled()`.
- **T16-D6** — Help-modal listing for shortcut display strings (registry already shipped in S1).
- **T16-D7** — Width-resize drag handle UX (state + clamping shipped in S1).
- **T16-D8 / D9** — Visual review screenshots + DBR77 hex scan acceptance (after S3 swap so the screenshots reflect the final shape).
