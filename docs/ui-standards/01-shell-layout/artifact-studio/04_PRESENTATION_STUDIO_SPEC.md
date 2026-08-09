# Presentation Studio — specification of an open presentation

Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
Scope: an existing presentation in manual or assisted composition
Priority legend: **P0** required, **P1** important extension, **MISSING** not proven or not implemented

## 1. Scope and OUT

Presentation Studio is a governed workspace for composing, manually correcting, reviewing, presenting and exporting a deck. Assisted Gamma-like composition and manual block editing use one deck, one lifecycle and one shell.

OUT of the open-presentation shell:

- template planning, cloning, CRUD and governance;
- brand-kit, media-registry and operational-governance administration;
- operations health, SLO, watchlists, alerts and benchmark tooling;
- a local AI/Agent panel or second Teresa conversation;
- changes to application Menu 1.

## 2. Anatomy

The screen contains:

1. unchanged application **Menu 1**;
2. one-line artifact **Menu 2**;
3. one contextual **Menu 3**;
4. one collapsible left slides panel;
5. slide canvas;
6. one bottom status/view bar;
7. the application-standard global Teresa surface when opened.

There is no parallel right tool rail and no fourth toolbar. The canvas must remain at least 760 px wide. At narrower widths, the left panel and Teresa arbitrate through collapse/overlay rather than compressing the slide.

## 3. Menu 2

Order:

`Back | type/breadcrumb | editable title | save state | classification | lifecycle | presence | Share | Present | More`

Export remains a secondary Menu 2/More action; Present is the format-specific primary action.

- **Back, title and save (P0):** title is inline editable; save exposes `Saving`, `Saved`, `Conflict`, `Error` and never silently overwrites another version.
- **Classification (P0):** `Public`, `Internal`, `Confidential`; downgrade needs permission, reason, confirmation and audit.
- **Lifecycle (P0):** `Draft → In review → Approved → Final`; presentation lifecycle parity is currently **MISSING**.
- **Share (P0):** collaborators and governed links. Public link only for `Public` artifacts.
- **Present (P0):** primary click starts from the current slide; dropdown contains From current, From beginning and Presenter view.
- **More:** Comments, Sources & assumptions, QA & review, History and Export are P0; Presentation properties and analytics are P1.

Draft PPTX/PDF exports are allowed with visible draft marking and manifest. Final PPTX/PDF are gated by critical QA and current approval. PNG is P1; HTML is OUT until a business scenario is accepted. Privileged override requires permission, reason and audit and never bypasses classification.

## 4. Menu 3 states

Undo and Redo are fixed. All other groups follow the active selection. Teresa is not a fixed Menu 3 command.

### 4.1 Canvas / no object selected

- **New slide (P0):** split action after current, with a layout submenu.
- **Insert (P0):** text, image, table, chart, KPI and callout. Diagram, embedded artifact and AI-generated image are P1.
- **Design (P0):** theme and layout rules; advanced presentation settings are P1.
- **Review (P0):** Comments, Sources and QA entry aliases.
- **View:** Notes and Fit slide are P0; Grid/sorter and guides are P1.

### 4.2 Slide selected

P0: New before/after, Duplicate, Move, Layout, Hide/Show, Lock/Unlock, Comment, Source coverage and Delete. Slide regeneration is a P1 proposal and respects locks.

Structural actions are canonical in the left panel/context menu; Menu 3 contains aliases for the active slide. Hide support requires verification and is **MISSING** if not persisted.

### 4.3 Block/object selected

P0: Edit content, Duplicate, Format, Align, Order, Comment, Source/Refresh and Delete. Group/Ungroup, Distribute, exact size/position and object-level locks are P1 unless needed by an accepted scenario.

A small floating toolbar may retain at most three to five aliases such as Edit, Duplicate and More. It must use the same command handlers and cannot become another toolbar system.

Alignment, layering and grouping require runtime verification; unimplemented commands remain **MISSING**, not enabled placeholders.

### 4.4 Text editing inside a block

P0: text style, Bold, Italic, Underline, bullet/numbered list, Link, alignment and Comment. Block commands move into overflow while text editing is active.

### 4.5 Table, chart and image

- **Table P0:** edit data; insert/delete rows and columns; merge/split; header semantics; comment/source. Most structural table editing is **MISSING/verification required**.
- **Chart P0:** edit data, change chart type, refresh source, format, comment/source. Axes, labels and legend details are P1.
- **Image P0:** replace, crop, fit/fill, align/order, alternative text, comment/source and delete. Crop and alt-text persistence require verification.

### 4.6 Multi-selection, locked, read-only and conflict

- multi-selection presents only commands valid for every selected object;
- locked slides/blocks reject manual and AI mutation and are reported as skipped in proposals;
- approved/final content requires a new draft revision before material change;
- during version conflict, mutations remain blocked until `Reload latest` or `Keep mine` is chosen.

## 5. Left slides panel

The single default P0 mode is **Slides**, using thumbnails. Default width is 264 px, minimum 224 px and maximum 320 px.

Rows show slide number, thumbnail and only real badges: hidden, locked, stale source, open comments or critical QA. Click selects; drag reorders; kebab/context exposes New before/after, Duplicate, Cut/Copy/Paste, Layout, Hide, Lock, Comment, Source coverage and Delete.

Grid/sorter is a P1 replacement canvas view, not a second simultaneous left panel. Multi-select is P1. Deck sections/groups are P1 only after a stable model exists; otherwise OUT.

## 6. Canvas and bottom bar

The canvas retains the existing deck/cards model, CardCanvas, renderers, source traceability and stable slide/block IDs. Selection must distinguish slide, block and text-editing states. Gamma-like generation and manual editing are actions over this same model, not separate products or shells.

The bottom bar remains 32–36 px and includes:

- Slide n/N (**P0**);
- persistent owner-approved **Teresa shortcut (P0)** opening the global conversation;
- persistent **Notes toggle (P0)**;
- zoom out/value/in and Fit slide (**P0**);
- Grid/sorter and guides (**P1**).

It does not duplicate save, lifecycle, QA, share, export or process status.

## 7. Context menus

All context actions resolve through the same command registry as Menu 3, left panel and shortcuts. Ordering is Clipboard → edit/format → structure/layout → review/source → Teresa → destructive. Shift+F10 is required.

- **Slide:** New before/after, Cut/Copy/Paste, Duplicate, Layout, Hide, Lock, Comment, Source coverage, Teresa, Delete.
- **Block:** Cut/Copy/Paste, Duplicate, Group, Order, Align, Edit/Format, Comment, Source/Refresh, Teresa, Delete.
- **Blank canvas:** Paste, New slide, Insert, Select all, Grid/guides (P1), Teresa with active-slide context.
- **Text:** clipboard, Link, Comment, Source, Teresa presets and Clear formatting.
- **Table:** clipboard, row/column, Merge/Split, Edit data, Format, Comment/Source, Teresa, Delete.
- **Chart:** Copy, Edit data, Change type, Refresh, Format, Comment/Source, Teresa, Delete.
- **Image:** clipboard, Replace, Crop, Fit, Alternative text, Order/Align, Comment/Source, Teresa, Delete.

## 8. Present and Presenter

The Menu 2 Present split button is canonical:

1. **From current slide (P0)** — also the primary click;
2. **From beginning (P0)**;
3. **Presenter view (P0)**;
4. Presentation settings (**P1**, only for real supported options);
5. Copy presentation link (**P1**, only for Public and publish-eligible artifacts).

Audience mode hides the shell, comments, notes and Teresa. Presenter view shows current and next slide, notes, timer and controls without leaking author information to the audience output. Escape returns to the exact prior slide, selection and panel state. Drafts may be presented internally with a visible Draft indication; public publishing remains gated.

## 9. Teresa handoff

Only the global Teresa conversation is used. The bottom shortcut supplies screen context. Contextual `Pass to Teresa` attaches the active text, slide, block, table, chart or image.

The envelope includes artifact and version IDs, title, classification, lifecycle, permissions, stable slide/block IDs and accessible source references. Selection chips return to the object.

Mutation follows `proposal → slide/block diff → Accept/Reject → autosave/version`. Locked items are listed as skipped before acceptance. Material acceptance makes previous approval stale. No local `teresaOpen`, AI Editor or Agent Activity surface remains in the target shell.

## 10. Governance workflows

- **Comments:** slide/block anchors, create, reply, resolve, reopen, soft delete and counts. Reply/reopen/count parity with DOC is currently **MISSING P0**.
- **Sources & assumptions:** merge Evidence, SourceTraceability and Relations. Show source, freshness, exact use and refresh preview.
- **QA & review:** merge quality gates, governance and approval. Full PPT lifecycle/approval and privileged export override parity are **MISSING P0**.
- **History:** merge versions, audit log and agent history into one timeline. Restore creates a new version; comments are preserved or explicitly detached.
- **Share:** merge collaborators, link controls and P1 analytics. Public link fails closed for Internal/Confidential.

## 11. Migration classification

**KEEP:** deck/cards store, autosave/conflict, slide add/reorder/duplicate/delete/lock, block edit/duplicate/delete/move/refresh, theme, speaker notes, PresentMode, base comments, share/collaboration, quality gates, versions, proposal accept/reject and PPTX/PDF export.

**MOVE:** artifact controls into one Menu 2; slide/block/text/table/chart/image actions into dynamic Menu 3; slide actions into left context; Teresa, Notes and view controls into bottom; Present into its split button.

**MERGE:** Evidence + Relations; Quality + Governance + Approval; Versions + Audit log + Agent history; all export routes in one Export menu; local AI/Agent surfaces into global Teresa.

**REMOVE:** duplicate legacy topbars/chip rows, permanent right tool rail, local split Teresa/Agent panel, Agent Activity as a primary user tool, duplicated floating-toolbar implementations, raw runtime/operation labels and template/admin commands.

## 12. P0 gaps

Before release, evidence must close:

- PPT lifecycle transitions and full approval workflow;
- comment replies, reopen, counts and stable range/block anchors;
- common classification mutation and public-link gate;
- final export gate and audited override;
- common evidence/source envelope;
- persisted Hide slide if absent;
- alignment and layering commands required for professional manual correction;
- table editing, chart data/type editing, image crop/alt text;
- shared Teresa context/proposal envelope and locked-item semantics.

## 13. Acceptance

P0 acceptance requires:

- unchanged Menu 1, one-line Menu 2 and exactly one contextual Menu 3;
- one left panel, no persistent right tool rail and only global Teresa on the right;
- bottom Teresa and Notes shortcuts retained; no fixed Teresa in Menu 3;
- verified Menu 3/context states for canvas, slide, block, text, table, chart, image, multi-selection, lock, read-only and conflict;
- shared command handlers across Menu 3, context, left, floating aliases and shortcuts;
- autosave/conflict and undo survive reload;
- AI proposals visibly skip locked items and never silently overwrite;
- Present from current/start and Presenter view prevent notes/Teresa leakage and restore editor state on Escape;
- comments, sources, QA and history navigate to stable slide/block anchors;
- draft export succeeds with marking; final export and public links fail closed; override is permissioned and audited;
- restore creates a version and preserves/detaches comments honestly;
- keyboard, Shift+F10, Escape, focus return, non-colour status labels and critical hit areas are verified;
- runtime evidence at 1920, 1440, 1280 and 1024 px proves a canvas of at least 760 px and deterministic overflow.

Renderer or button presence alone is not PASS. Every P0 mutation needs persistence/reload, permission, lifecycle, audit and undo/recovery evidence.
