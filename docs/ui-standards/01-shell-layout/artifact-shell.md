# Artifact Shell Future Standard (N/C)

> Status: FUTURE STANDARD (approved for next iterations)  
> Date: 2026-02-15 (v2.0 — "Tech Sexy" refinement)  
> Scope: All artifact detail views (`initiative`, `task`, `decision`, `notification`, next artifacts)  
> Goal: Keep a consistent, stable, enterprise-grade shell structure across the app.
>
> **Changelog v2.0:** Alignment z "Tech Sexy" visual language — invisible borders, depth layers, refined spacing.

---

## 1) Shared architecture (mandatory)

Every artifact detail view uses the same 4-layer shell:

1. **Title Header Bar**
2. **Properties/Status Strip**
3. **CTA Action Bar**
4. **N-mode Content Area** (Left Nav + Canvas)

This shell is common and reusable. Artifact-specific logic changes content, not structure.

---

## 2) Header Bar standard

Order from left to right:

1. Back to previous tool/module
2. Status color indicator (dot/symbol)
3. Artifact name/title (editable on early stages where allowed)
4. Artifact index/ID
5. Link/permalink + link-between-artifacts tools
6. Save button
7. Chat button (context transfer to chat)
8. View mode switcher (`N` / `C`)

Visual:

- Tło header: Layer 1 (`bg-navy-900`) — separacja od content przez zmianę tła, **nie border-bottom**
- "Sticky elevation": gdy header jest sticky i treść scrolluje pod nim, pojawia się subtelny `shadow-hig-sm` (jedyny dozwolony cień na non-floating elemencie)
- Same height across all artifacts
- **Brak borderu** między headerem a content area — separacja wyłącznie przez tło + opcjonalny sticky shadow

Behavior:

- Save button is **always visible**
- If nothing to save: reduce visual prominence (not hidden)
- If dirty: increase prominence
- Permalink/link controls are treated as standard controls and should be visible by default

---

## 3) Mode switcher standard

- Final target mode set: **`N` + `C` only**
- `D` mode may exist temporarily as legacy/transition mode
- Long-term UX and documentation must treat `N/C` as canonical

---

## 4) Properties strip standard

- Always **6 fields** for symmetry and visual consistency
- Field content depends on artifact type/context
- Inputs/selects/chips in this strip must have the same control height, border weight, and corner radius
- No mixed control heights inside the strip

---

## 5) CTA action bar standard

- Left side: context/business action buttons
- Right side: global AI CTA for current screen
- In top CTA bar: **only one AI CTA**
- Section-level AI actions are allowed inside section canvases (not in top CTA bar)

---

## 6) N-mode left navigation standard

- Same fixed width for all artifacts: **220px**
- Section labels should be designed for one-line display
- Drag handle for reorder: visible on hover (not permanently visible)
- Badge counters are allowed but optional; no globally forced usage
- Left nav width is non-negotiable and should not vary per artifact

Fallback for long labels:

- Use `ellipsis` + tooltip
- Never expand nav item to two lines

---

## 7) Spatial and sizing baseline tokens (v1)

Adopt one baseline and keep it global:

- `--artifact-header-h: 48px`
- `--artifact-properties-h: 60px`
- `--artifact-actionbar-h: 36px`
- `--artifact-field-h: 32px`
- `--artifact-btn-h: 28px`
- `--artifact-nav-item-h: 30px`
- `--artifact-stack-gap: 12px`
- `--artifact-canvas-gap: 14px`
- `--artifact-nav-canvas-gutter: 20px`
- `--artifact-radius: 12px`
- `--artifact-left-nav-w: 220px`

Implementation note:

- Minor rendering tolerance (`+/- 2px`) is acceptable per browser/platform,
  but target values are canonical.

---

## 8) Initiative N-mode canonical order (approved)

1. Initiative Scope
2. Success Criteria
3. KPI
4. Financial Analysis
5. Financial Impact
6. Team
7. RACI
8. Resources
9. Dependencies
10. Risk & RAID
11. Milestones
12. Timeline
13. Tasks
14. Decisions
15. Gates
16. Technical Specification
17. Attachments
18. Comments
19. Activity Log

Excluded for this canonical version:

- Overview
- Pilot
- Watchers
- Standalone Intelligence tab

---

## 9) Template-driven visibility contract

- `visibleSections[key] = true` -> mapped tab visible
- `visibleSections[key] = false` -> mapped tab hidden
- If explicit `visibleSections` exists, it is the source of truth
- No automatic "show all defaults" override when explicit template visibility exists

---

## 10) Definition of Done (UI shell)

A change to artifact detail UI is done only if:

- 4-layer shell is preserved
- N/C mode behavior is unchanged and stable
- Left nav width remains 220px
- Strip/control/button heights follow canonical tokens
- Save visibility logic follows standard (visible but low prominence when clean)
- Top CTA bar has max one AI CTA on the right
- Labels in left nav remain one-line with ellipsis fallback
- PL/EN labels are provided where applicable
- Dark mode styling is preserved with equivalent contrast
- **v2.0:** Separacja między warstwami shell przez zmianę tła, nie border (patrz: visual-language.md sekcja 3-4)
- **v2.0:** Ikony w shell są outline, mono-weight, kolor = kolor tekstu (patrz: visual-language.md sekcja 10)
- **v2.0:** Hover states to zmiana tła, nie zmiana koloru tekstu/borderu

---

## 11) Section content interaction standard (v1.1)

### 11.1 Typography hierarchy inside thematic unit

Each thematic unit (section block/table-like content area) must keep a stable hierarchy:

- Screen title (artifact-level title) — highest emphasis
- Thematic unit title (e.g., `Description & Context`) — second level
- Field title (e.g., `PROBLEM`) — small uppercase/semibold
- Field helper/description under title — smaller and visually softer
- Placeholder hint — readable but lower contrast than actual content
- User-entered content — primary readability layer

Spacing between these layers must be consistent across units.

### 11.2 Section AI button (position and behavior)

- AI button for section text processing is always anchored to the **top-right corner**
  of the thematic unit header row.
- Presence of additional buttons (e.g., `+ Add item`) must not move AI button position.
- AI button scope is local to the current thematic unit/field.

### 11.3 AI menu actions (localized)

AI quick menu is localized to selected app language (PL/EN) and includes:

- Improve
- Shorten
- Expand
- Formal tone
- Undo (visible only when AI already modified this unit)

Undo rule:

- Single-step undo only (revert last AI operation for this unit).

### 11.4 Add-button visual variants

Two visual variants are allowed:

- **Light add button** (default): subtle `+ Add ...`, low visual weight.
- **Framed add button** (table-internal context): when inside framed table surfaces
  (e.g., RACI), button uses matching border/frame style.

### 11.5 More/Less overflow behavior

- Default threshold for showing `More`: overflow beyond ~4 visible lines.
- Some units may have larger default viewport; `More` appears only after exceeding
  that unit's configured visible content area.
- `More/Less` control sits in the lower-right area of the content unit.

### 11.6 List filter and sort controls

For larger list-like units, use two standardized controls:

- **Time filter** (left): dropdown, default `All`, with options:
  - All
  - Last 7 days
  - Last 30 days
  - Last 90 days
- **Sort direction** (right): toggle between:
  - newest -> oldest (default)
  - oldest -> newest

### 11.7 Comment composer action alignment

In comment composer rows:

- AI action is right-aligned (consistent with section action philosophy)
- `Send` action is placed on the left side (or below, when layout requires wrap)
- For current canonical implementation, **left-side Send** is the approved standard

---

## 12) Table standards (v1.2)

### 12.1 Generic table style (all artifacts)

- Table cards are minimalist and highly readable.
- Table title sits in the same canonical header position as other thematic units.
- Critical values (status/priority/risk) may use semantic color when needed.
- Column widths must be tuned to avoid unnecessary wrapping for standard values.
- Right side of each row contains row-level actions.
- Bottom-left table summary/stat (e.g. `1/3 done`) is a preferred standard pattern.

### 12.2 Add button in table headers

Two allowed variants:

- **Light add button** (default for lightweight list units)
  - subtle text-first treatment
  - no heavy background fill
- **Framed/outlined add button** (table-frame context)
  - used when button is visually inside framed table surface
  - consistent with section border style

For task table (`+ Add task`):

- canonical style is **outlined** with white text and no heavy fill background.

### 12.3 Row actions

- Default pattern for list rows:
  - up to two inline icon actions
  - plus vertical kebab menu (`...`) for expandable action set
- Kebab orientation is **vertical** (not horizontal).

### 12.4 RACI table specifics

- RACI follows the same table architecture as generic list tables.
- Neutral visual style is default; no mandatory alert coloring for base cells.
- `Notifications` column may use color-coded chips for readability.
- Row actions in RACI:
  - two inline icons
  - plus vertical kebab menu for extended actions
- `+ Add person` should use the framed/outlined variant aligned to the table surface.

---

## 13) Idea and risk section standards (v1.3)

### 13.1 Implementation Ideas block

Idea entries use a fixed 4-zone row structure:

1. **Left vote zone**: up/down voting and score signal.
2. **Meta header zone**: source and type labels (e.g., `Manual` / `AI`, `Idea`).
3. **Content zone**: idea title + detailed description.
4. **Right action zone**: AI refine action + delete action.

Section-level actions:

- In section header (top-right): `+ Add idea` (manual path).
- In top CTA bar (right side): AI generation action (e.g., `Create Ideas`).

Both manual and AI creation actions may coexist by default.  
One may be hidden contextually (permissions/read-only/workflow lock) if needed.

### 13.2 Risk management block (`Risk & Impact` / `Risk & RAID`)

Action placement is strictly split by layer:

- **Top CTA bar (global)**: AI risk analysis action (e.g., `Analyze risks`).
- **Section header (top-right, local)**: one manual `+ Add risk` action only.

Rules:

- Do not duplicate `+ Add risk` in lower area when top-right add action already exists.
- Do not place additional AI action next to local `+ Add risk` in section header
  if the global CTA already provides risk analysis.

Content structure:

- Keep risk severity legend visible (`Low`, `Medium`, `High`, `Critical`).
- Keep risk count visible.
- Risk record uses clear split:
  - left side: risk statement / materialization fallback,
  - right side: mitigation / response plan.
- Local AI field actions remain allowed for text assist in both columns.

---

## 14) Checklist, Dependencies, Comments standards (v1.4)

### 14.1 Checklist block

- Section title `Checklist` follows canonical section header placement.
- Manual add action: one top-right `+ Add item` action in section header.
- AI action lives in top CTA bar (e.g., `Create Checklist`).
- Remove duplicate add action under the list (e.g., `+ Add another item`).
- Progress counter (`done/total`) must be visible in section header area.
- Checklist item behavior:
  - checkbox toggle for completion,
  - inline editable text,
  - delete icon appears on hover for the row.

Empty-state rule:

- when checklist is empty, initialize with one default empty editable row (focused),
  while still keeping top-right `+ Add item`.

### 14.2 Dependencies block

- Section title `Dependencies` follows canonical placement.
- Section header top-right action: `+ Add dependency` (manual only, outlined/framed style).
- Top CTA bar right-side AI action: `Analyze dependencies` / `Ustal zależności`.
- AI action in section header should not duplicate global CTA action.
- Do not duplicate `+ Add dependency` in lower section area.

Empty-state rule:

- show table shell with headers even when there are no rows,
  plus neutral empty-state message (`No dependencies yet`).

Dependencies AI behavior:

- AI proposes dependency links only,
- user can accept/edit/reject suggestions before applying.

### 14.3 Comments block

What remains canonical:

- section title and top-right `+ Add comments`,
- top CTA AI comments action,
- chronological comments list with filters and sort controls.

Composer alignment rule:

- `Send` is on the left side,
- AI action is on the right side.

Comment row interactions:

- on hover: show delete action icon,
- comments are editable (inline or via edit action),
- each comment shows author + timestamp,
- comments generated by AI are explicitly marked with AI indicator.

---

## 15) RACI + Reminders + Escalation standards (v1.5)

The My Work implementation is the reference ("gold standard") for this compound section.

### 15.1 Structure

On section load, show three visible tables:

1. `RACI` (responsibility matrix)
2. `Reminders`
3. `Escalation rules`

Each table:

- has add action in top-right (`+ Add person`, `+ Add reminder`, `+ Add escalation`),
- uses framed/outlined add style aligned to table card.

### 15.2 RACI behavior

- Multi-role assignment is allowed.
- Email column is optional; space can be reallocated to org/source display
  (`Internal` / `External` organization context).
- Row actions:
  - up to two inline icons,
  - plus vertical kebab menu (`...`) for extended actions.

### 15.3 Notifications chips in governance tables

- Notification channel uses color-coded chip for readability.
- Priority is not encoded by channel color.
- Priority must be represented by a separate dedicated badge/field.

Recommended channel color mapping:

- In-app -> blue
- Email -> violet
- Slack -> emerald
- Teams -> cyan
- SMS (future) -> orange
- Webhook/API -> slate

### 15.4 AI support policy

- RACI analysis/generation is optional support, never mandatory.
- AI assists users to detect missing assignments or gaps;
  users remain decision-makers and editors.

---

## 16) Activity Log standard (v1.6)

### 16.1 Layout and structure

- `Activity Log` section keeps canonical section title placement.
- Four KPI cards stay at the top of the section (`Entries`, `Changes`, `Escalations`, `Collaboration`).
- Chronological event feed is rendered below KPI cards.

### 16.2 Filter controls (required)

- In section header top-right, show standardized filtering controls:
  - time dropdown (`All`, `Last 7 days`, `Last 30 days`, `Last 90 days`),
  - optional sort toggle (`newest -> oldest` default, `oldest -> newest`).
- Controls must follow shared list-filter styling used in other N-mode list sections.

### 16.3 Feed row content

- Every row shows:
  - activity icon/type,
  - activity description,
  - timestamp,
  - actor/source (when available).
- Empty state remains visible and readable when no entries exist.

---

## 17) Options & Trade-offs standard (v1.7)

### 17.1 Action model (manual + AI)

- Section supports two parallel creation paths:
  - manual path via top-right `+ Add option`,
  - AI path via top CTA right action (`Generate options`).
- AI is support, never the only entry path.
- `+ Add option` uses outlined/light variant (no heavy fill background).

### 17.2 Placement rules

- In section header top-right: `+ Add option` (manual, local action).
- In top CTA right area: one AI action for this section (`Generate options`).
- Do not duplicate `+ Add option` in lower content zones.

### 17.3 Manual form minimum contract

Required fields:

- `Option title`
- `Pros` (at least one item or non-empty text)
- `Cons` (at least one item or non-empty text)

Optional fields:

- effort/cost chips
- risk note
- recommendation flag
- owner/dependency hints

### 17.4 Validation and quality guardrails

- Prevent saving fully empty option cards.
- Keep text limits to avoid unusable long entries.
- Show inline validation under invalid fields (not only toast).
- New option should open in editable state immediately after add.

### 17.5 Ordering and lifecycle

- Default ordering: newest -> oldest (unless artifact overrides for business reason).
- Each option supports: edit, delete, and optional pin/reorder when list grows.
- Activity log records: add/edit/delete/generate actions for traceability.

---

## 18) Scope Card standard (v1.8)

### 18.1 Unified naming

The first section in every artifact should follow one naming family:

- `Task Scope`
- `Decision Scope`
- `Notification Scope`
- `Initiative Scope`

No mixed legacy naming (`Definition`, `Description & Context`, etc.) in first section labels.

### 18.2 Shared structure

Each scope section keeps the same macro layout:

1. Section title (`... Scope`)
2. Top-right local AI action (field-level support)
3. `Related to` / reference block (when available)
4. Structured text blocks (problem/scope/context-like content)
5. Overflow control (`More/Less`) when content exceeds visible area

### 18.3 CTA-level AI

- In top CTA right side, use one global AI action:
  - `Generate scope` / `Generuj scope`
- This action complements local AI field actions; it does not replace them.

### 18.4 Scope card behavior rules

- Scope content should be split into table-like sub-cards for readability.
- Sub-cards support manual resizing (bottom-right drag handle) in implementations that support resizable text surfaces.
- If content exceeds default visible area, `More/Less` control must be available.
- Keep PL/EN parity for labels and helper text.

---

## 19) Initiative unfinished cards redesign backlog (N-mode, v1.9)

The following 10 initiative cards are standardized for N-mode rebuild, based on existing N patterns (Task/Decision):

1. `Success Criteria` (keep current good N implementation as baseline)
2. `KPI`
3. `Financial Analysis`
4. `Financial Impact`
5. `Resources`
6. `Milestones`
7. `Risk & RAID`
8. `Timeline`
9. `Decisions`
10. `Gates`

### 19.1 Common card shell for these sections

- Header title on left.
- Header actions on right:
  - manual `+ Add`/`+ New` (outlined/light),
  - local AI button (`AI`).
- Body as table/card surface with minimal borders and readable spacing.
- Empty state always shows canonical message + optional add CTA.

### 19.2 Decisions card special rule

- `Decisions` should follow task-table ergonomics:
  - table rows with key fields (`title`, `type`, `status`, `due`),
  - right-side row actions,
  - top-right `+ New` for manual creation,
  - optional AI generation action.

### 19.3 Per-card shape proposal (implementation baseline)

For consistency, each card keeps:

- left title + icon,
- right actions (`+ New`/`+ Add` outlined + `AI`),
- one primary body surface (table/form/summary),
- explicit empty-state.

Card-level blueprint:

1. `Success Criteria`

- `Success Criteria` is the first initiative card and reference baseline.
- Header row: only section title (no extra AI button on this header line).
- Three stacked sub-cards:
  - `Target State`
  - `Success Criteria`
  - `Deliverables`
- Sub-card actions:
  - `+ Add item` must be lightweight text action (no framed/outlined button),
  - local `AI` action remains on sub-card level.
- Checklist row behavior:
  - round checkbox on left,
  - inline editable text in center,
  - delete icon on row hover.

2. `KPI`

- Table/list of KPI rows (`name`, `unit`, `baseline`, `current`, `target`).
- Top-right `+ New` opens compact inline form.
- KPI rows are persisted via initiative KPI endpoints (not local-only draft state).
- KPI tracking continuity rule: KPI created in Initiative card must be visible in Benefits module KPI tracking for the same initiative.

3. `Financial Analysis`

- Two upper finance cards (`CAPEX`, `OPEX`) and lower metric row (`ROI`, `NPV`, `Payback`).
- AI allowed for estimate proposal.

4. `Financial Impact`

- P&L block (`Revenue`, `Cost savings`) + realization progress bar.
- AI allowed for impact narrative / estimation assist.

5. `Resources`

- Budget field + resources allocation list + tools/infrastructure chips.
- Manual add resource + AI proposal path.

6. `Milestones`

- Table-driven list (`title`, `status`, `date`) sourced from milestone tasks.
- Top-right `+ New` creates milestone task.

7. `Risk & RAID`

- RAID summary counters + prioritized row list.
- Manual add item and AI risk discovery in header.

8. `Timeline`

- Start/end date controls, duration, quarter and time-progress bar.
- Overdue signal must remain visible.

9. `Decisions`

- Task-like table with row actions and create flow.
- Empty state includes clear add CTA.

10. `Gates`

- Gate timeline visualization, readiness checklist, approval request actions.
- AI supports readiness hints only (user remains decision-maker).
