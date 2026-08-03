# Consultify UI/UX Golden Standard

> ⚠️ **AUTORYTET PRZENIESIONY → [CANON.md](CANON.md)** (od 2026-06-14, v3.0).
> Ten dokument pozostaje **ważny jako szczegół** do końca Fazy 2 (dystrybucja treści do warstw `00–03`). Hierarchię prawdy i governance prowadzi `CANON.md`. „Hierarchy Of Truth" §2 poniżej została zastąpiona przez `CANON.md` §2 — nie traktuj jej jako wiążącej.

Status: `szczegół podległy CANON.md (był: SSOT / GOLDEN STANDARD)`
Date: 2026-05-01
Visual direction: `DBR77 Tech Sexy 2027`
Scope: all Consultify product UI, existing refactors and every new screen/module

## 1. Purpose

Ten dokument jest materiałem migracyjnym. Jedynym źródłem rozstrzygającym autorytet jest `CANON.md`.

Jego zadaniem jest zachowanie wartościowych reguł do czasu przeniesienia ich do kart rodzin komponentów. W konflikcie ten plik nie wygrywa z `CANON.md` ani aktywną kartą rodziny.

Core rule:

> Feature screens do not own visual design. Feature screens compose approved Consultify shells, components and interaction patterns.

Consultify must feel like one global AI SaaS product, not a set of separate tools assembled by different screens.

## 2. Hierarchy Of Truth

When documents conflict, use this order:

1. `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` - final product and visual canon.
2. `CONSULTIFY_UI_UX_OPERATING_STANDARD.md` - operational contract for Cursor, refactors and reviews.
3. `FROZEN_LAYOUTS.md` - frozen layout decisions.
4. `UI_UX_CANON_V3.md` - historical/consolidated v3 canon.
5. Detailed standards in `00-foundation`, `01-shell-layout`, `02-components`, `03-modules`.
6. Reference implementations explicitly named in the docs.
7. Older duplicates, snapshots and legacy screens - context only, never authority.

If the code does not match the standard, the code is a migration candidate. Do not create a third pattern.

## 3. DBR77 Tech Sexy 2027

The target feel is quiet, sharp, premium and technical:

- OpenAI-level calm and confidence.
- Apple-like restraint, rounding discipline and polished states.
- Google/Material-level clarity, accessibility and state semantics.
- Claude/Notion-like document calm where the work is long-form.
- ClickUp/Linear-like density where the work is operational.

The visual language is not decoration. It is a working system for a dense AI consulting product.

### 3.1 Non-Negotiables

- One app, one visual language.
- Dark mode is first-class.
- Light mode must be readable, never washed out.
- Color is semantic signal, not ornament.
- One primary CTA per screen.
- No gradients in operational controls.
- No heavy shadows on content cards.
- No rectangular legacy buttons in modernized UI.
- No mixed button families in one row.
- No ad-hoc toolbars.
- No duplicate UI for the same action.

### 3.2 Surfaces And Depth

Use depth through background, not decoration:

- Layer 0: global chrome/sidebar.
- Layer 1: main working surface.
- Layer 2: cards, panels, sections.
- Layer 3: floating UI such as dropdown, popover, modal, tooltip.
- Layer 4: intelligence/assistive overlays when truly needed.

Rules:

- Dark mode never uses pure black.
- Light mode content base should prefer soft slate, not pure white everywhere.
- Borders are subtle and rare.
- If separation can be achieved by background, spacing or typography, do not add another border.
- Shadows are for floating UI, not default cards.

### 3.3 Typography And Density

Typography is architecture:

- headers use `font-semibold`, not heavy bold,
- large all-caps headers are forbidden,
- all-caps labels are allowed only for tiny metadata,
- body UI is usually `text-sm`,
- metadata is usually `text-xs`,
- dense toolbars may use `text-[11px]` only when readability remains strong.

Density rule:

- pack navigation,
- breathe in content,
- compress repeated chrome,
- never let controls consume the working area.

## 4. Component Law

Every UI element must belong to a named component or named pattern.

Before building UI:

1. Find an approved component/pattern.
2. If it fits, use it.
3. If it almost fits, propose a documented extension.
4. If it does not fit, define a new standard before implementing.

Forbidden:

- one-off buttons,
- one-off cards,
- local badge styles,
- local table controls,
- local preview panels,
- local help strips,
- extra control rows between topbar and content.

## 5. Button And Control Standard

### 5.1 Shape

Default modern control shape:

- default height: `h-9`,
- dense toolbar height: `h-8`,
- radius: `rounded-hig-full` or approved pill/soft HIG token,
- icon stroke: consistent, monochrome unless color carries state,
- hover: subtle surface shift,
- active/open: stronger surface shift, not loud fill.

### 5.2 Primary CTA

Primary CTA is the main action of the current screen.

Rules:

- It sits on the far right of `Menu 2` / Module Topbar.
- It uses a clear label, for example `Dodaj`, `New Initiative`, `Create`.
- It does not use a leading `+` icon in `Menu 2`.
- A chevron is allowed if the CTA opens a menu of creation variants.
- It may use the artifact/tool accent color or approved primary accent.
- It must not compete with secondary controls.

Approved example:

`[Dodaj v]`

Rejected examples:

- `[+ Dodaj]` in Module Topbar,
- large gradient CTA in operational chrome,
- multiple colorful CTAs in one screen.

### 5.3 Toolbar Controls

Toolbar controls are not primary CTAs.

Rules:

- `h-9` default, `h-8` for dense `Menu 3`,
- rounded pill family,
- subtle Layer 2/3 surface,
- either all controls in the row have a subtle border or none do,
- no mixed dark/light backgrounds inside one control family,
- no gradient,
- no shadow,
- status color appears as dot/badge, not full-button fill.

### 5.4 Help

`Help` does not belong in the right cluster of `Menu 2`.

Help lives in the global shell/sidebar as a global entry or icon. Local screens may use contextual empty/help content only inside the working surface when it is part of the task, not as a topbar button.

## 6. Module Shell

Consultify module screens use:

1. App Topbar - global, stable.
2. Module Topbar / `Menu 2` - module-level navigation and screen actions.
3. `Menu 3` / Command Row - one contextual row below `Menu 2`.
4. Content surface - table, cards, kanban, timeline, preview, workspace or N-mode canvas.

Every migrated module card must be checked against the operational migration checklist and the
professional UI/UX test procedure in `03-modules/module-hub-standard.md`
(`Instrukcja Przerabiania Karty Modułu` and
`Profesjonalna Procedura Testowania UI/UX Karty I Tabeli`) before it is accepted.

### 6.1 App Topbar

App Topbar is global and stable.

It is not a place for local screen actions. It should not become a second module toolbar.

### 6.2 Module Topbar / Menu 2

Left side:

- search toggle,
- main module tabs.

Right side visual order from far right:

1. Primary CTA.
2. View switcher.
3. Filters.
4. Optional tool/area controls only when the screen genuinely needs them.

Implementation may render left-to-right differently, but the visual order must hold.

Rules:

- `Help` is forbidden here.
- Primary CTA has no leading plus icon.
- View switcher is icon/segmented buttons, not dropdown.
- Filters use specific domain labels, not vague repeated `Wszystkie ...`.

### 6.3 View Switcher

View switcher shows modes as visible buttons/icons.

For a simple list/cards pair:

- `Lista` is always on the left,
- `Karty` / `Grid` is always on the right.

For larger sets, use the approved view mode order and show only available modes. The switcher must still behave as a visible segmented control, not a `Table v` dropdown.

Rejected:

- dropdown `Table` with menu item `Grid`,
- changing icon order per module,
- hiding available views behind generic menus.

### 6.4 Filters

Filters must explain their dimension.

Good labels:

- `Obszar pytań: wszystkie`,
- `Źródło szablonu: wszystkie`,
- `Status: aktywne`,
- `Typ szablonu: wszystkie`,
- `Właściciel: ja`.

Bad labels:

- two adjacent filters both starting with vague `Wszystkie ...`,
- trigger text that does not explain what is filtered,
- repeated filters that look semantically identical.

## 7. Menu 3 / Command Row

There is exactly one `Menu 3` row below Module Topbar.

Canonical reference:

- `My Work > Decyzje` is the accepted product reference for `Menu 3` dynamic chips.
- The implementation source of truth is `src/components/shared/ModuleMenu3.tsx`.
- Any module card that needs dynamic tabs, counter chips, status presets, bulk mode or contextual actions must use this visual family rather than local chip/button classes.

It may be:

- dynamic tabs,
- search row,
- bulk action row,
- context counters/status chips.

It must not create two or three rows. It must not be followed by another ad-hoc row before the table/content.

### 7.1 Preset And Status Chips

Rules:

- row surface: `bg-white dark:bg-navy-900` with one calm bottom separator,
- row layout: `flex min-h-8 items-center justify-between gap-3 overflow-x-auto whitespace-nowrap`,
- chip shape: `h-8`, `rounded-full`, `px-2.5`, `gap-1.5`, `text-[11px] font-medium`,
- active chip: purple tint (`border-purple-500/40`, `bg-purple-500/10`, `text-purple-700`, `dark:text-purple-200`),
- inactive chip: quiet slate/navy surface (`bg-slate-100 dark:bg-navy-800`), not white-on-white,
- counter badge: `px-1.5 py-0.5`, `rounded-full`, `text-[10px] font-semibold`, `tabular-nums`,
- the `ALL` / `Wszystkie` chip uses a tiny neutral dot when no semantic icon exists,
- left side starts with `ALL`,
- chips are active filters, not decorative counters,
- only active/useful statuses are shown by default,
- statuses with `0` should not occupy permanent space if they push actions out,
- long chip lists go to overflow/filter, never to a second row.

### 7.2 AI Actions In Menu 3

Functional AI actions belong on the right side of `Menu 3`.

Examples:

- `AI Analizuj zaznaczenie`,
- `AI Triage`,
- `Action Plan`,
- `AI Auto-Schedule`,
- `AI Optimizer`,
- `Napisz kartę`,
- `Wygeneruj cały artefakt`.

Rules:

- `h-8`, pill, same family as `Menu 3` chips,
- icon `Sparkles` when AI is the semantic action,
- disabled/neutral state when selection is empty,
- no large violet CTA row under `Menu 3`,
- no separate AI strip between `Menu 3` and table,
- no duplicate AI action in canvas and `Menu 3`.

### 7.3 View-Local Toolbar

View-local toolbar is allowed only inside the view surface for controls that manipulate that view.

Allowed examples:

- timeline range: `8W`, `12W`, `16W`, `24W`,
- zoom,
- filter specific to a visual surface,
- jump to today,
- lane focus.

Not allowed:

- AI actions,
- module-level filters,
- duplicate view switcher,
- duplicate primary CTA.

## 8. Tables

App tables are the default for dense operational lists.

Approved visual reference:

- `My Work > Pomysły` App Table, accepted 2026-05-02.
- Dark reference: `docs/ui-standards/assets/app-table-golden-reference-dark-2026-05-02.png`.
- Light reference: `docs/ui-standards/assets/app-table-golden-reference-light-2026-05-02.png`.

Enforcement scope:

- every new operational record list/table in `My Work`, `Wywiad`, queues, sessions, templates, insights and initiatives starts from this App Table canon,
- do not create local card-list/table hybrids for operational records unless a compliant App Table view already exists,
- module-local UI may define data semantics, but not its own table anatomy, row chrome, menu settings, checkbox behavior or metadata alignment.

Rules:

- use almost full available width,
- stable row height,
- readable columns,
- resizable columns with intuitive drag direction,
- header filters where useful,
- vertical kebab `⋮` as the row action menu,
- table settings / columns control exists where columns are configurable,
- no duplicate row subtitle if the information belongs in a column,
- no extra help/selection/AI strip between `Menu 3` and the table,
- placeholder `—` instead of crash or raw undefined.

### 8.1 Row Action Menu

The table row action menu is a predictable action router for a single record.

It uses one vertical kebab `⋮` in the `Actions` column and the shared `RowActionsMenu` component. Feature screens must not create custom row dropdowns when `RowActionsMenu` can represent the menu.

Canonical order:

1. Open - the stable entry into the full record/artifact. This is always the first action.
2. Tool shortcut - optional direct entry into the record's specific tool/workspace, for example `Process Flow`, `Recommendation Map`, `Definition`, `Lineage`. If present, it is the second action in the same top block as `Open`, without a separator.
3. Context actions - table-specific and status-specific actions, for example `Approve`, `Reject`, `Snooze`, `Record data`.
4. AI - `AI Chat` and `AI Insights`.
5. Convert to - operational objects such as `Initiative`, `Task`, `Decision`, `Team Chat`.
6. Create output - `Presentation`, `Report`, `Table` when output runtime is available; otherwise disabled/coming soon.
7. Manage - `Edit`, `Duplicate`, `Tag`, `Archive`, `Change status`.
8. Danger - destructive actions; `Delete` is always last and separated.

Rules:

- The top block always starts with `Open`; direct tool shortcuts sit directly under it.
- Every row menu item has a leading icon, including `Open`, so the vertical rhythm stays symmetrical.
- The context section may change per table and per row status.
- The lower sections keep the same mental model across the product.
- Do not expose too many actions at once. If a section has more than 3-4 options, use a grouped entry such as `Convert to...` or `Create output...`.
- `AI Chat` sends the record as context into chat.
- `AI Insights` generates a short analysis and sends the conclusions into chat.
- Red styling is reserved for danger actions.

Status, priority and category indicators:

- use badge/dot + label,
- color must be readable in dark and light modes,
- do not use weak colored text on weak colored background,
- color is signal, not decoration.

Table chips and badges:

- table chips follow the canonical `StatusChip`, `PriorityChip`, `MetaChip`, `ToolChip`, `SlaChip` / `DueChip` semantics from `03-modules/app-table-standard.md`,
- metadata chips are neutral, not brand-colored,
- tool/artifact chips are almost neutral and may use a colored icon, but must not look like a CTA,
- status and priority chips may use color only as a compact signal with readable text,
- the same module must not define multiple local color maps for the same chip meaning.

Accepted App Table color grid:

- all App Tables must use the approved color grid from `00-foundation/color-system.md`,
- selected, focused and checked rows use brand-aligned `primary/violet-blue` tint, a `4px` left accent and visible inset ring,
- light mode table contrast must be ClickUp/Linear-level readable, not washed out,
- dark mode tables must have real but thin separators and calm high-contrast chips,
- local feature screens must not define their own table surface, row-state or chip color grid.

### 8.2 DBR77 2027 App Table Color Contract

Status: `APPROVED / ENFORCED`

This contract is mandatory for every operational table in Consultify (`My Work`, `Wywiad`, queues, sessions, templates, insights, initiatives, and all future table-first modules).

#### Assumptions

- Table color is semantic signal only. It is not visual decoration.
- Chrome stays monochromatic (`slate/navy`) and color appears mainly in data/state chips.
- A module may define domain labels, but not its own color grammar.
- The same meaning must use the same color in table, preview pane, list rows, and card variant.
- Light mode must stay high-contrast; dark mode must avoid neon/glow surfaces.

#### Canonical semantic mapping (single map for whole product)

| Semantic meaning | Allowed palette | Typical examples |
|---|---|---|
| Neutral / informational / inactive | `slate` | `draft`, `paused`, `archived`, metadata-only states |
| Active execution / assigned work | `blue` | `in_progress`, `assigned`, `working`, `started` |
| Attention / pending review / near due | `amber` | `submitted`, `in_review`, `pending_review`, `generating`, due in `1-3 days` |
| Positive completion / approved outcome | `emerald` | `approved`, `completed`, `accepted`, `promoted` |
| Risk / failure / rejection / overdue | `rose` | `failed`, `rejected`, `sent_back`, `blocked`, overdue or due today |
| Brand selection/focus only | `primary/violet` | selected/focused/checked row state, focus rings, primary CTA |

Rules:

- `primary/violet` is forbidden as decorative metadata chip fill.
- `blue/amber/emerald/rose` are signal palettes, never full-row decorative backgrounds.
- If a new domain status appears, map it to one of the six rows above; do not add a seventh palette locally.

#### Chip contract by chip type

| Chip type | Contract |
|---|---|
| `MetaChip` | Always neutral (`slate/navy`). No semantic color fills. |
| `ToolChip` | Neutral surface; optional subtle colored icon only when it clarifies tool meaning. |
| `StatusChip` | Uses canonical semantic mapping table above; readable contrast in both modes. |
| `PriorityChip` | Neutral pill + small semantic dot/icon. Do not encode priority with a full bright background. |
| `DueChip` / `SlaChip` | Neutral when healthy; `amber` for near due, `rose` for overdue/today. |

#### Enforcement

- Screen acceptance is blocked if any table uses local ad-hoc status colors.
- Screen acceptance is blocked if the same status meaning has different colors across views in one module.
- Every table migration/review must include an explicit color audit against this contract and `00-foundation/color-system.md`.
- Any requested exception must be added to this file first; code cannot become the precedent.

App Table row anatomy:

- each row is a compact operational record, not an Excel-like grid line,
- title is the primary object; description is short contextual support,
- description/justification is visible by default as the second line under the title,
- secondary row text uses the same neutral color family as the title with lighter weight/opacity, not a separate accent color,
- secondary text must not appear only on hover and hover must not change row height,
- the table settings popover exposes a persisted `Show row description` / `Pokaż opis / uzasadnienie` checkbox at the bottom; disabling it hides the second line while keeping calm row padding,
- metadata columns are vertically centered and scan like signals,
- overflow counts use pills/counters, not loose text,
- row actions are quiet utility chrome until hover/open.

Column behavior:

- App Tables fill the available width; resizing one column must not make the whole table collapse or stop filling the screen,
- the primary/title column has a real width contract and a right-edge resizer, so the boundary between `Title` and the first metadata column is controllable,
- metadata headers are centered inside their columns; the title header remains left-aligned,
- App Tables prefer content-aware defaults: metadata columns start wide enough for common chips, dates and tools, and chip cells do not wrap unless unavoidable,
- horizontal scroll is acceptable when it preserves scan quality; forced two-line metadata is not a premium default,
- resize handles must behave like Excel boundaries: dragging a separator moves that separator, so one adjacent column grows by the same amount the other adjacent column shrinks,
- resize handles are small boundary grips, not wide invisible overlays; the user must know exactly which separator is being dragged,
- total table width remains stable during boundary resize; do not implement resize as “change one column and let the browser recalculate the rest,”
- configurable tables expose a `Settings2` table view settings button in the right header/action corner,
- simple column visibility settings open as a small anchored menu/popover under the icon, not a blocking modal,
- required columns are visible and disabled in the settings menu,
- the actions header may be icon-only; do not show redundant `Actions/Akcje` text when the table settings icon owns that corner.

Selection and scroll chrome:

- table checkboxes are utility controls and must stay visually quiet,
- dense row checkboxes should be small, neutral and never dominate the row,
- unchecked row checkboxes in premium App Tables reveal on hover/focus like ClickUp; checked/selected/focused rows keep them visible,
- scrollbars must have reserved space/gutter and must not cover row actions, help, bug-report or side floating controls.

## 9. Cards, Grid And Kanban

Cards are allowed when the user benefits from visual scanning rather than column scanning.

Card anatomy:

- artifact/tool identity,
- title,
- 1-2 key signals,
- status/progress,
- kebab `⋮` actions,
- optional direct open action only if it speeds work.

Rules:

- cards use the same actions semantics as tables,
- card buttons follow the same button family and density,
- status color is marker/badge, not large decorative background,
- kanban cards use the card anatomy in a compact form,
- drag and drop changes real workflow state or is not shown as affordance.

## 10. Timeline

Timeline is a view mode, not a separate application.

Approved direction:

- same `Menu 2` and `Menu 3` as table view,
- alert/risk strip can appear inside the timeline surface,
- bars are readable and encode progress,
- overdue/late markers are visible,
- current day line is clear but not loud.

Timeline header density:

- month and week header must stay compact,
- preferred compact week notation: `W18 (27)` or `W18 / 27`,
- the number in parentheses/slash is the first day of the week,
- month row must be minimal if shown,
- do not waste vertical space before the work surface.

AI:

- additional timeline AI actions still go to the right side of `Menu 3`,
- local timeline toolbar remains for visual controls only.

## 11. Preview Pane

Preview pane is the preferred pattern for important lists where quick review matters.

Rules:

- preview is part of the table surface, not a random side widget,
- single click opens/selects preview,
- double click or explicit action opens full detail,
- header contains title, pin/close/open when relevant,
- `Open` must look like a real button,
- footer contains quick actions that mirror full-view workflow,
- action set depends on context but follows one visual family,
- no fake actions and no missing core actions in important preview panes.

## 12. N-mode Detail

`N-mode` is the canonical document/page-first work mode.

Structure:

- left rail with card/section names,
- central canvas taking the remaining working width,
- title/header line,
- properties/status strip,
- compact workflow action row,
- working cards in the canvas.

Rules:

- left rail is navigation, not an action toolbar,
- central canvas is the primary work area,
- top control area must be compact enough that the first work card appears high in the viewport,
- properties strip is workflow, not decorative metadata,
- status/priority/owner/date affect actions, validation, AI context and audit,
- workflow actions stay in one line on desktop where possible,
- secondary actions go to `More`.

### 12.1 N-mode Cards

Every N-mode card has:

- stable `cardId`,
- title,
- optional description,
- clear data scope,
- AI role,
- default/optional/required visibility,
- body sections where needed.

Cards can be expanded/collapsed where useful. Card visibility is controlled through `Card View Settings` near save/view controls, not through random toggles.

If there is a dedicated `Related Context` card, full related context and AI-detected links must not be duplicated in other card footers.

### 12.2 AI In N-mode

Three levels:

- field AI - improve/generate a field,
- section AI - improve/generate a section,
- card AI - improve/generate a card.

Functional AI that creates or rewrites major structure belongs in `Menu 3`, not inside random canvas buttons.

## 13. C-mode

`C-mode` is planned, not approved for full use yet.

Direction:

- ClickUp-inspired,
- action-first,
- more horizontal top structure,
- more breathing room on sides,
- more minimalist than N-mode.

Runtime rule until approved:

- `N` is default,
- choosing `C` shows `C-mode wkrótce`,
- the app must not load an unfinished C-mode view,
- no data or draft state can be lost by trying C-mode.

## 14. Reference Screens

Approved or near-approved references:

- `Implementation > Zestawienie` - strong module hub/table reference; only remove plus from CTA.
- `Implementation > Timeline` - strong timeline direction; compact timeline header.
- `Initiatives > Portfolio` - good table/status/menu direction; remove extra row and place AI action in `Menu 3`.
- `Tools > Biblioteka` - current negative example for Help, plus CTA and dropdown view switcher.
- `Interview > Szablony` - current negative example for vague filters and Help in topbar.

Reference screens are not copied blindly. They are used to identify the pattern, then cleaned to this standard.

## 15. Review And Approval Process

Every component/screen migration follows:

1. Describe the current element and location.
2. Compare it with this Golden Standard.
3. Decide: approved, approved with correction, rejected, or needs new standard.
4. Update docs if the decision creates a new reusable rule.
5. Implement only the approved scope.
6. Freeze the approved pattern as reference.

No improvisation during migration. Documentation evolves deliberately as decisions are made.

## 16. Definition Of Done For UI Work

A UI change is done only when:

- it uses an approved shell/pattern,
- buttons match the button taxonomy,
- `Menu 2` and `Menu 3` rules are respected,
- no extra toolbar row was introduced,
- AI actions are in the right place,
- table/card/timeline/preview anatomy matches the relevant standard,
- dark and light mode are readable,
- empty/loading/error states are honest,
- permissions/locked state are respected,
- labels are domain-specific and understandable,
- the implementation does not create a new local design language.

## 17. Cursor Rule

Cursor must read this document before UI work.

If a request conflicts with this document, Cursor must either:

- explain the conflict and propose the compliant implementation, or
- ask for explicit approval to change the standard.

Cursor must not silently create a competing UI/UX pattern.
