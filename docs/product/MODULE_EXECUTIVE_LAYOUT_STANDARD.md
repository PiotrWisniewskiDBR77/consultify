# Module Executive Layout Standard (MELS)

**Status:** `LOCKED — 2026-05-08`
**Owner:** Cursor agent (CTO mode) under user delegation
**Scope:** Wordy (`/wordy`), Tabele (`/tabele`), Prezentacje (`/prezentacje`) — the three "executive" modules where users author finished artifacts.
**Reference implementation:** `DeckBuilder` (Prezentacje module). Screenshots: `DRD/consultify/docs/product/work-packets/tabele-full-product/_assets/reference-screens/2026-05-08_deck-builder_*.png`.

This document is the canonical layout contract. Any future executive-module surface that diverges from MELS is a violation requiring an explicit waiver in the relevant block closeout.

---

## 1. Why MELS exists

The three executive modules — Wordy, Tabele, Prezentacje — share a common authoring loop: select / generate an artifact → edit it in a document-style canvas → publish or share. Today they ship divergent layouts:

- Wordy: Menu 2 horizontal tab bar + Word-canvas.
- Tabele (Foundation Block): KimiWorkspaceShell with right-slot AI buttons.
- Prezentacje (DeckBuilder): three-zone layout (left rail / canvas / right rail) + top bar with all functional buttons; **no Menu 2**.

DeckBuilder's layout is the most mature and the user has selected it as the canonical pattern. MELS codifies it so Wordy and Tabele converge on the same shape.

---

## 2. The standard layout — three zones + top bar

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar (single line — replaces Menu 2)                                   │
│                                                                          │
│ ←  Module > Title           [Internal · Theme · History · QA · Gov ·    │
│                              Analytics · Audit · Share · Agent · Run]    │
├────┬─────────────────────────┬───────────────────────────────────┬──────┤
│ M1 │ Left Rail               │ Canvas                            │ R    │
│    │ (item list / outline /  │ (Word-document idiom, scrollable, │ Rail │
│    │  slide sorter)          │  sectioned, document-style)       │      │
│    │                         │                                   │      │
│    │ + Sort, filter, search  │  ★ canonical authoring surface ★  │      │
│    │ + Collapse toggle ★     │                                   │      │
│    │ + Teresa AI (bottom)    │                                   │      │
└────┴─────────────────────────┴───────────────────────────────────┴──────┘
```

### Zone A — Top bar (replaces Menu 2)

A single 56 px row containing:

1. **Left cluster (back / breadcrumb / title):** back arrow → "Outputs > {Module} > {Title}". Title is editable inline.
2. **Center cluster (functional buttons):** module-relevant action chips: `Internal` (confidentiality), `Theme/Motyw`, `History`, `QA`, `Governance`, `Analytics`, `Audit`, `Share/Udostępnij`, `Agent` toggle, `Run/Prezentuj`.
3. **Right cluster (presence / status):** collaborator avatars, connection status dot, version indicator.

**Constraints:**
- **No second toolbar** below the top bar. Menu 2 is removed; its actions become functional chips here.
- All chips visible by default; overflow into a `…` menu only when viewport < 1280 px wide.
- DBR77 monochrome with semantic accents only on dot indicators (governance verdict, confidentiality).
- Action chips use the existing `Chip` primitive from `KimiWorkspaceShell`; no per-module styling drift.
- Module-specific buttons (e.g. `Prezentuj` for decks, `Run query` for tables, `Export` for docs) live in this cluster but on the right side of the center group.

### Zone B — Left rail (item list)

A 240 – 320 px wide column showing:

- **Module-specific item list:**
  - **Wordy:** document outline / section headings.
  - **Tabele:** record list / table list / view list (depending on selection).
  - **Prezentacje:** slide sorter (current behavior).
- Sort / filter / search controls at top.
- **Collapse toggle ★** on the rail's right edge — user-pinned state persists per module.
- Teresa AI assistant panel anchored to the bottom (~128 px tall). Collapsible.

**Constraints:**
- Single scroll axis (vertical).
- Width is user-resizable between 200 px and 480 px; persisted per module.
- Collapse toggle is a **mandatory** affordance on every module (this is the gap the user flagged on the screenshots).

### Zone C — Canvas

The main authoring surface. Centered layout with max-width 880 – 1024 px. Word-document idiom across all three modules:

- **Wordy:** native Word canvas (existing).
- **Tabele:** sectioned Word-canvas with Cover / KPI / Schema / Records / Relations / Rationale (Foundation Block deliverable; MELS confirms it stays).
- **Prezentacje:** Card canvas (existing — slides rendered as document-flow cards).

**Constraints:**
- Centered with neutral page background.
- No floating toolbars over the canvas.
- N-mode embedding via `EmbeddedView` is allowed inside the canvas, never beside it.

### Zone D — Right rail

A 56 px narrow icon strip with module tools, expanded on click into a 320 – 480 px panel:

- **Wordy:** Search content, formatting tools, citations, comments, document tools.
- **Tabele:** Search records, AI Editor (8 levels), QA Report, Source Pack, Layout, Share, Analytics.
- **Prezentacje:** Search deck, Theme, Layout, Share, Analytics, Video, Document tools, Master toggle (current behavior).

**Constraints:**
- Right rail is the **only** place for module tool buttons. AI buttons that would otherwise live in Menu 3 land here too (per `.cursor/rules/ai-actions-menu3.mdc` — MELS reinterprets "Menu 3" as the right rail of an executive module). The rule's intent (no AI buttons floating in canvas) is preserved.
- Icons stack vertically; clicking an icon opens a side-panel that shares the rail's coordinate space.
- Right rail is collapsible to a 0 px sliver via a chevron at top.

---

## 3. Behaviors and invariants

### 3.1 Mandatory affordances (per executive module)

- [x] Top bar with at least: back, breadcrumb, title (editable), Internal/Confidentiality, History, Share, Agent toggle, primary run-button.
- [x] Left rail with: item list, sort/filter, collapse toggle, Teresa AI bottom slot.
- [x] Canvas with Word-document idiom.
- [x] Right rail with module tools and search.

### 3.2 Forbidden patterns

- ❌ Menu 2 (a separate horizontal toolbar under the top bar). Use top bar chips.
- ❌ Floating tool overlays inside the canvas.
- ❌ AI action buttons placed below the canvas, beside metadata, or as a fourth toolbar row.
- ❌ Per-module accent color overrides outside the existing semantic palette (sky for Tabele, emerald for Wordy/data, indigo for Prezentacje — all fixed in `color-system.md`).

### 3.3 Responsive behavior

- ≥ 1440 px: full layout, both rails expanded if user pinned them.
- 1200 – 1439 px: right rail collapses to icon strip; left rail keeps width.
- 1024 – 1199 px: right rail icon-only; left rail collapses by default; can expand.
- < 1024 px: canvas-only with both rails as togglable drawers from edges.

### 3.4 Keyboard shortcuts (cross-module)

- `Cmd/Ctrl + \` toggle left rail.
- `Cmd/Ctrl + /` toggle right rail.
- `Cmd/Ctrl + K` open command palette.
- `Cmd/Ctrl + Enter` invoke primary run-button (Run query / Open in builder / Present).
- `Cmd/Ctrl + Shift + A` toggle Agent (Teresa) panel.

---

## 4. Component contract (frontend)

A new shared shell component `ExecutiveModuleShell` SHOULD be extracted from existing `DeckBuilder` and `KimiWorkspaceShell` so all three modules import the same chrome:

```ts
// consultify/src/components/shared/ExecutiveModuleShell/index.tsx
export interface ExecutiveModuleShellProps {
  module: 'wordy' | 'tabele' | 'prezentacje';
  title: string;
  onTitleChange?: (next: string) => void;
  topBarChips: TopBarChipDescriptor[];     // Internal, Theme, History, QA, ...
  leftRail: ReactNode;                     // module-supplied
  centerCanvas: ReactNode;                 // module-supplied
  rightRail: RightRailDescriptor;          // structured: panels[] + toolbar icons
  collapseLeftRailDefault?: boolean;
  collapseRightRailDefault?: boolean;
  primaryRunButton?: { label: string; onClick: () => void; intent?: 'primary' | 'soft' };
  onAgentToggle?: () => void;
  agentOpen?: boolean;
  collaborators?: CollabUser[];
  governanceVerdict?: GovernanceVerdict | null;
  confidentiality?: 'public' | 'internal' | 'confidential';
}
```

The shell handles:
- Layout + responsive collapsing.
- Keyboard shortcuts.
- Persistent rail widths (localStorage per module).
- DBR77 styling.
- Top bar overflow menu.

Modules supply only their content for left rail, canvas, and right rail.

---

## 5. Migration scope

| Module | Current state | MELS gap | Owning packet |
|---|---|---|---|
| **Prezentacje** | Compliant (reference) | Add formal `ExecutiveModuleShell` extraction; left-rail collapse toggle currently missing on some viewport sizes (per user screenshots). | Follow-up program (post-Tabele) |
| **Tabele** | Foundation Block uses `KimiWorkspaceShell`; non-compliant (right-slot only, no left rail outline list, no module tool right rail) | Major: refactor to `ExecutiveModuleShell` shape; build Tabele left rail (record list + sort) and right rail (AI Editor / QA / Source Pack panels). | **EPIC-T16 in Block A of `tabele-full-product` program.** |
| **Wordy** | Menu 2 horizontal toolbar | Major: remove Menu 2; convert chips into top bar; build left rail outline. | Follow-up program (post-Tabele) |

**Sequencing (CTO):**

1. **Now (Block A of current program):** EPIC-T16 — Tabele lane adopts MELS via new `ExecutiveModuleShell`. Prezentacje is left as-is (already close to MELS); Wordy stays on Menu 2 until follow-up program.
2. **After current program closes `GO`:** open follow-up program `executive-layout-unification` to migrate Wordy + tighten Prezentacje.

This sequencing avoids cross-module coordination overhead during the Tabele program while honoring the user's directive to make all three converge.

---

## 6. Acceptance criteria for MELS compliance

A module is MELS-compliant when ALL of the following are true:

- [ ] Top bar exists, ≤ 56 px tall, contains title + functional chips; **no Menu 2**.
- [ ] Left rail exists with item list, sort/filter, collapse toggle, Teresa bottom slot.
- [ ] Canvas uses Word-document idiom; centered; max-width 1024 px.
- [ ] Right rail exists with module tools + search; collapsible to 0 px.
- [ ] Both rails resizable and persistently collapsed/expanded per user.
- [ ] Keyboard shortcuts implemented per § 3.4.
- [ ] DBR77 hex scan: 0 raw hex literals in module shell + rails.
- [ ] AI buttons exclusively in right rail (no canvas placement).
- [ ] No second toolbar row anywhere in the module.
- [ ] Visual review against reference screens: shape and spacing match within 10 % tolerance.

---

## 7. Cross-references

- Reference screens: `DRD/consultify/docs/product/work-packets/tabele-full-product/_assets/reference-screens/2026-05-08_deck-builder_*.png`.
- Reference implementation: `DRD/consultify/src/components/Presentations/DeckBuilder/`.
- AI placement rule: `.cursor/rules/ai-actions-menu3.mdc` (MELS reinterprets Menu 3 = right rail of executive module).
- UI governance: `.cursor/rules/20-ui-ux-governance.mdc`.
- Color system: `DRD/consultify/docs/ui-standards/00-foundation/color-system.md`.
- Foundation Block (Tabele lane): `DRD/consultify/docs/product/work-packets/table-studio-foundation/`.
- Active program: `DRD/consultify/docs/product/work-packets/tabele-full-product/`.
- EPIC-T16: `DRD/consultify/docs/product/work-packets/tabele-full-product/block-A-template-catalog/epics/EPIC-T16_UNIFIED_EXECUTIVE_LAYOUT.md`.

---

## 8. Sign-off

- Decided: 2026-05-08 (CTO mode under user delegation).
- Reviewer (UI/UX): pending block kick-off.
- Reviewer (Frontend lead): pending EPIC-T16 entry.
- Migration plan owner: Block A of current program (Tabele); follow-up program for Wordy + Prezentacje hardening.
