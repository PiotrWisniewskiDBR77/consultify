# Document Studio — specification of an open document

Status: `APPROVED_SPEC / RUNTIME_PARTIAL`
Scope: an existing document after materialization or resume
Priority legend: **P0** required, **P1** important extension, **MISSING** not proven or not implemented

## 1. Scope and OUT

Document Studio is a governed workspace for completing, reviewing and exporting a professional document. It retains manual editing, evidence, comments, versions and AI proposals without attempting to reproduce all of Microsoft Word.

OUT of the open-document shell:

- Template Architect and template CRUD, approval, deprecation and structure management;
- source-pack, brand-voice, audience-profile and asset-registry administration;
- manifest, runtime and operational diagnostics;
- a local AI Editor or a second Teresa conversation;
- changes to application Menu 1.

## 2. Anatomy

The screen has exactly these persistent layers:

1. unchanged application **Menu 1**;
2. one-line artifact **Menu 2**;
3. one contextual **Menu 3**;
4. one collapsible left structure panel;
5. document canvas;
6. one bottom status/view bar;
7. the application-standard global Teresa surface when opened.

There is no fourth toolbar and no second right rail. At 1440 px the document canvas must remain at least 680 px wide. At narrower widths, panels collapse or become overlays rather than compressing the canvas.

## 3. Menu 2

Order:

`Back | type/breadcrumb | editable title | save state | classification | lifecycle | presence | Share | Export | More`

Required behaviour:

- **Back (P0):** returns to Documents/Materials.
- **Title (P0):** inline edit; Enter commits, Escape cancels; conflicts are explicit.
- **Save (P0):** `Saving`, `Saved`, `Conflict`, `Error`; save state is separate from lifecycle.
- **Classification (P0):** `Public`, `Internal`, `Confidential`; default `Internal`. Downgrading classification requires permission, confirmation, reason and audit.
- **Lifecycle (P0):** `Draft → In review → Approved → Final`. Editing an approved/final document creates a new draft revision and makes the approval stale.
- **Share (P0):** invitation and governed link workflow. Public links are possible only for `Public` artifacts.
- **Export (P0):** one menu, not parallel Download buttons.
- **More:** Comments, Sources & assumptions, QA & review and History are P0; Document properties are P1.

Export modes:

- draft DOCX/PDF (**P0**) and Markdown (**P1**) are allowed with visible `DRAFT / NOT APPROVED` marking and a version-bound manifest;
- final DOCX/PDF (**P0**) are blocked by critical QA, missing/current approval or an invalid lifecycle state;
- privileged override requires a dedicated permission, selected gates, a meaningful reason, confirmation and append-only audit;
- override never bypasses classification for public sharing.

## 4. Menu 3 states

Menu 3 is driven by a shared command registry. Undo and Redo remain fixed. Teresa is **not** a fixed Menu 3 item.

### 4.1 No selection / caret

- **Insert (P0):** paragraph, heading, bullet/numbered list, table, image, chart, KPI, callout; page/section break is P1 until real support is proven.
- **Style (P0):** Normal, H1, H2, H3.
- **Find (P0)** and Replace (**P1**).
- **Review (P0):** add comment when anchorable, Sources & assumptions, QA.
- **View (P1):** paged/continuous view only when pagination is real; outline, zoom and fit are aliases of bottom-bar commands.
- block from content library is **P1**; library administration is OUT.

### 4.2 Selected text

Visible P0 commands: Style, Bold, Italic, Underline, List, Link and Comment. Overflow contains source attachment and Mark as assumption (**P0**), plus strike, highlight, colour, clear formatting, alignment, indentation and quote (**P1**).

`Pass to Teresa` is available contextually, not as a permanent Menu 3 control.

### 4.3 Selected section

Add, Rename, Duplicate, Move, Comment, Source coverage and Delete are **P0**. Collapse and change level are **P1**. Regeneration is a **P1 proposal**, never a silent mutation.

Structural commands are canonical in the left-panel row/context menu; Menu 3 may expose aliases for the active section.

### 4.4 Table/cell

P0: insert/delete rows and columns, delete table, merge/split cells, alignment, wrapping, header-row semantics, Comment and Source. Sorting, number formats, creating a chart, distributing rows/columns, borders and repeating headers are P1 unless required by an accepted scenario.

Most Office-like table mutation commands are currently **MISSING or require runtime verification**; renderer presence is not implementation evidence.

### 4.5 Image

P0: Replace, Crop, Fit/Fill, Align, Wrap, Alternative text, Comment, Source/provenance and Delete. Exact dimensions, caption and download original are P1. Crop, wrap and alt-text persistence are **MISSING/verification required**.

### 4.6 Chart, KPI or special block

P0: Edit data/content, change type/variant, format, source, refresh linked data, comment and delete. A refresh that changes values must show a preview/diff before application. Advanced axes, labels, legend and dimensions are P1.

### 4.7 Multi-selection, read-only and conflict

- multi-selection shows only the safe intersection of supported commands;
- approved/final/read-only views retain Copy, Find, permitted Comments, Sources, QA, History and Teresa questions; material editing requires a new revision;
- during a save conflict mutations remain blocked until `Reload latest` or `Keep mine` is selected;
- generation exposes Stop only while the stream is truly abortable and never hides a synchronous fallback.

## 5. Left panel

The single panel is named **Structure**. Default width is 264 px, minimum 224 px and maximum 320 px.

The P0 mode is Outline: hierarchical sections with title, disclosure, active state and honest badges for assumptions, source gaps, open comments or critical QA. Selection synchronizes the canvas, Menu 3 and bottom position.

Row actions are revealed through keyboard-accessible kebab/context controls: add before/after, rename, duplicate, move, collapse, comment, source coverage and delete. Drag is canonical for reorder; keyboard movement is required.

A Pages mode is P1 only if true pagination exists. Fake thumbnails are prohibited. The current permanent action row beneath every section is removed.

## 6. Canvas and bottom bar

The canvas is document-first: readable paper in the dark shell, stable section/block IDs and clear selection. Existing paragraph, heading, list, callout, table, chart, KPI, image, risk and roadmap renderers are retained.

The open-document canvas removes the technical `Document preview` wrapper, duplicate download toolbar, `Open in Sheets Builder` header action and `Start over` action. A validated table-specific handoff may return later as P1.

The 32–36 px bottom bar contains:

- Section n/N (**P0**), word/selection count (**P1**), real page n/N only with pagination (**P1**);
- outline toggle (**P0**);
- zoom out/value/in and Fit width (**P0**);
- page/continuous view and language/spell status (**P1**);
- the owner-approved persistent **Teresa shortcut (P0)**, opening the global application conversation.

It does not duplicate save, lifecycle, QA, export or process progress.

## 7. Context menus

Every context entry invokes the same command ID and handler as Menu 3 or the left panel. Order is Clipboard → edit/format → structure → review/source → Teresa → destructive. First level is limited to 8–12 items. Shift+F10 is required.

- **Text:** Cut/Copy/Paste, Link, Comment, Attach source/Mark assumption, Pass to Teresa, Clear formatting.
- **Section:** Add before/after, Rename, Duplicate, Move, Collapse, Comment, Source coverage, Teresa, Delete.
- **Table/cell:** clipboard, row/column commands, Merge/Split, Format, Create chart, Comment/Source, Teresa, Delete table.
- **Image:** clipboard, Replace, Crop, Wrap, Alternative text, Comment/Source, Teresa, Delete.
- **Chart/KPI:** Copy, Edit data, Change type, Refresh source, Format, Comment/Source, Teresa, Delete.
- **Blank canvas:** Paste, Insert, Find, document-context Teresa and Properties (P1).

## 8. Teresa handoff

Document Studio uses only the global Teresa conversation. The bottom shortcut sends screen context. A contextual `Pass to Teresa` action additionally attaches a deliberate selection.

The context envelope includes artifact ID, immutable/current version ID, title, classification, lifecycle, user permissions, stable object IDs, section path and accessible source references. A chip such as `Selected text · Executive recommendation · v7 · Internal` returns to the anchor.

Mutation requests follow `proposal → diff → Accept/Reject → autosave/version`. Acceptance of a material proposal makes prior approval stale. Transformative requests require scope confirmation. Teresa never receives linked-source data unavailable to the user.

## 9. Governance workflows

- **Comments:** open/resolved/all, counts, create, reply, resolve, reopen, author-only soft delete and anchor navigation. Restore preserves threads; missing anchors become `Detached` and can be re-anchored.
- **Sources & assumptions:** merge the current Sources and Evidence surfaces. Show source type, date, freshness, coverage, permissions and exact uses. Raw source-pack lifecycle and IDs are OUT.
- **QA & review:** merge QA, approvals and user-facing governance. Self-approval is forbidden. Material edits stale approval. Manifest Gate is removed.
- **History:** merge Activity, schema diff, snapshots, rollback and AI audit into a human timeline. Restore creates a new version and never deletes later versions.

## 10. Migration classification

**KEEP:** ExecutiveModuleShell foundations, TipTap/manual save, conflict handling, undo/redo, outline capability, block renderers, comments, source references, QA engine, approvals API, snapshots/diff, share links, export and generation warnings.

**MOVE:** title/status/share/export into Menu 2; editing and insertion into Menu 3; structural actions into left context; zoom/outline/Teresa into bottom; content-library insertion into Insert.

**MERGE:** Sources + Evidence; QA + Approvals + governance; Activity + diff + snapshots + audit; all export actions; Share surfaces; Teresa + AI Editor + inline AI into global handoff/proposals.

**REMOVE:** local AI Editor, duplicate Teresa tool, Manifest Gate UI, technical `Schema diff` label, duplicate export/download controls, permanent section action rows, redundant governance chip, raw IDs/tokens and template/admin commands.

## 11. Acceptance

P0 acceptance requires:

- unchanged Menu 1 and exactly one-line Menu 2 plus one Menu 3;
- one left panel, no fourth toolbar and no local/right AI surface beside global Teresa;
- verified Menu 3 and context states for text, section, table, image, special block, multi-selection, read-only and conflict;
- one command handler shared by Menu 3, context, shortcut and left-panel aliases;
- resume failure never opens a blank intake;
- edit/autosave/undo/conflict work after reload;
- comments, sources, QA and history deep-link to stable anchors;
- draft export succeeds with marking; final export gates and audited override work;
- self-approval fails; material changes stale approval;
- restore creates a version and preserves/detaches comments honestly;
- public links fail closed for non-Public artifacts;
- keyboard, Shift+F10, Escape, focus return, non-colour status labels and critical hit areas are verified;
- runtime evidence at 1920, 1440, 1280 and 1024 px proves a canvas of at least 680 px and deterministic overflow.

UI presence alone is not PASS. Each implemented P0 command needs persistence/reload, permission, lifecycle, audit and recovery evidence.
