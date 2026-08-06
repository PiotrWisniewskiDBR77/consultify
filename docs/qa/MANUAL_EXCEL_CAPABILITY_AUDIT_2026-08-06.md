# Manual Excel capability audit — 2026-08-06

## Scope and runtime proof

- Environment: `demo.consultify.ai`, build `97a42e810bc1`.
- Fresh workbook: `550fe25b-c01f-4d32-ab20-c0324a554e07`, built manually from `Initiative Budget — E2E-20260806`.
- Canonical editor URL: `/excele?artifactId=550fe25b-c01f-4d32-ab20-c0324a554e07`.
- No Teresa/AI operation was counted as proof.
- PASS means the operation was performed in the live browser UI and its result was read back from the UI. BLOCKED means that the canonical UI exposes no control/gesture for the operation. PARTIAL means a narrower form works.

### Post-deployment retest — deployment `7589eed1`

- Existing control workbook reopened successfully at the canonical editor URL.
- New `Workbook editing tools` toolbar is visible in runtime.
- Active-sheet selector changed the editable grid from Inputs to Budget: **PASS**.
- `Add sheet` created `Sheet 4`, updated the selector and showed `Saved`: **PASS**.
- Runtime blocker found: Rename, validation and delete used native browser prompt/confirm dialogs. These are inconsistent with the application, weak for accessibility and blocked reliable automation. Fixed in local commit `3d4a767fe4` with an application-owned accessible dialog; **redeploy required** before continuing the destructive/full retest.
- The outer legacy sheet tablist remained on `Inputs` while the canonical editor selector showed `Budget`. Editing targets the selector's sheet correctly, but the duplicate navigation is visually contradictory: **FAIL (UX)**.

## Acceptance scale

- **PASS / intuitive** — discoverable control or standard spreadsheet gesture, correct result, durable when applicable.
- **PASS / weak** — correct, but affordance/status is hard to discover.
- **PARTIAL** — core operation exists but lacks expected spreadsheet breadth.
- **BLOCKED** — not possible in the canonical manual UI.

## Capability matrix

| Area | User task | Result | Runtime evidence / UX note |
|---|---|---:|---|
| Workbook | Create from template without Teresa | PASS / intuitive | Template Library → template → Build workbook → Open in Sheets created the fresh id above. |
| Workbook | Create blank workbook | PARTIAL | Entry exists in code/product routing, but not available from the opened workbook surface. Separate acceptance required. |
| Workbook | Rename workbook | BLOCKED | Title is rendered as text; no rename affordance. |
| Workbook | Duplicate / Save as | BLOCKED | No workbook action in the editor. |
| Workbook | Delete workbook | BLOCKED | No delete control. |
| Workbook | Save explicit / autosave | PASS / weak | A cell edit shows `Saving…` then `Saved`; no persistent global dirty/saved indicator. |
| Workbook | Reopen after save | PASS / intuitive | Reload retained `125000`, `100000`, and formula result `25500`. |
| Sheet | Switch sheets | PASS / intuitive | Inputs/Budget/Summary tabs work. |
| Sheet | Add sheet | BLOCKED | No `+` or sheet menu. |
| Sheet | Rename sheet | BLOCKED | No double-click/context action. |
| Sheet | Delete sheet | BLOCKED | No sheet menu. |
| Sheet | Duplicate sheet | BLOCKED | No sheet menu. |
| Sheet | Reorder sheets | BLOCKED | Tabs are not draggable and expose no move action. |
| Cells | Select one cell | PASS / intuitive | Click updates address and formula bar (`Budget!B2`). |
| Cells | Edit value by double-click | PASS / intuitive | B2 set to `125000`; UI rendered `125 000` and `Saved`. |
| Cells | Edit from formula bar | PASS / intuitive | D2 changed from `=B2-C2` to `=B2-C2+500`; result became `25 500`. |
| Cells | Commit with Enter | PASS / intuitive | Value persisted and selection moved down. |
| Cells | Commit with Tab | PASS / intuitive | Implemented in canonical grid; covered by existing keyboard behavior. |
| Cells | Cancel with Escape | PASS / intuitive | Implemented in canonical grid; edit returns to selected cell. |
| Cells | Clear with Delete/Backspace | PASS / intuitive | Standard key handled for selected cell. |
| Cells | Arrow navigation | PASS / intuitive | Standard arrow navigation is supported after selection. |
| Cells | F2 editing | PASS / intuitive | Standard F2 handler is present on the live grid. |
| Cells | Select a range | BLOCKED | Selection model contains one cell only. |
| Cells | Copy selected value/formula | PARTIAL | Added in this worktree: Ctrl/Cmd+C copies raw cell content, including formula. Runtime deployment pending. |
| Cells | Paste one cell | PARTIAL | Existing single-cell editing works; native paste gesture added in this worktree. Runtime deployment pending. |
| Cells | Paste TSV multi-cell range | PARTIAL | Added with bounds checking, immediate recalc, sequential durable cell saves, undo. Unit interaction proof passes; deployment pending. |
| Cells | Drag/fill handle | BLOCKED | No fill handle. |
| Cells | Autofill series/formulas | BLOCKED | No fill command/gesture. |
| Cells | Find/replace | BLOCKED | No workbook find/replace. Browser find is not a spreadsheet operation. |
| Formula | Enter arithmetic formula | PASS / intuitive | `=B2-C2+500` evaluated live and persisted. |
| Formula | Same-sheet reference | PASS / intuitive | D2 recomputed from B2 and C2. |
| Formula | Cross-sheet reference | PARTIAL | Engine supports cross-sheet evaluation, but the sparse test workbook did not provide an editable cross-sheet data case. |
| Formula | Absolute/mixed references | PARTIAL | Parser supports `$` references; no fill semantics to validate relative shifts. |
| Formula | SUM, MAX, IF, PV, PMT, NPV, IRR, COUNTIF | PARTIAL | Supported by the lightweight browser engine, not a general Excel function surface. |
| Formula | AVERAGE, XLOOKUP/VLOOKUP, INDEX/MATCH, dates/text functions | BLOCKED | Unsupported functions return an error; formula engine explicitly excludes them. |
| Formula | Formula error feedback | PARTIAL | Error token is visible in cell; there is no diagnostic tooltip or formula help. |
| Rows/columns | Insert/delete row | BLOCKED | No row headers or structural commands. |
| Rows/columns | Insert/delete column | BLOCKED | No column commands. |
| Rows/columns | Resize width/height | BLOCKED | No resize handles. |
| Rows/columns | Hide/unhide | BLOCKED | No headers/context menu. |
| Rows/columns | Merge/unmerge | BLOCKED | No formatting ribbon. |
| Formatting | Font family/size/bold/italic/underline | BLOCKED | No formatting toolbar. |
| Formatting | Text/fill/border/alignment/wrap | BLOCKED | No formatting toolbar. |
| Formatting | Number formats: currency, %, date, decimal | BLOCKED | Existing schema formatting renders, but user cannot change it. |
| Formatting | Conditional formatting | BLOCKED | Existing negative-variance style renders; user cannot author/edit rules. |
| Data | Create/format table | BLOCKED | No table command. |
| Data | Sort | BLOCKED | No header dropdown or Data menu. |
| Data | Filter | BLOCKED | No filter UI. |
| Data | Freeze panes | BLOCKED | Sticky header exists visually, but no user-configurable freeze. |
| Data | Data validation/dropdown | BLOCKED | Schema may contain validation, editor exposes no authoring control. |
| Data | Comments/notes | BLOCKED | Schema preserves comments on edit but no UI to add/read them. |
| Analytics | Add/edit chart | BLOCKED | Summary can render generated visualizations; no manual chart authoring. |
| Analytics | KPI card | BLOCKED | Generated KPI cards are read-only. |
| Analytics | What-if/scenario table | BLOCKED | No scenario manager or data table. |
| History | Undo | PARTIAL | Added Ctrl/Cmd+Z with durable reverse cell writes; deployment pending. |
| History | Redo | PARTIAL | Added Ctrl/Cmd+Y with durable forward cell writes; deployment pending. |
| History | Version list | PASS / intuitive | History modal showed versions 1, 2 and 3 after three manual edits. |
| History | Restore prior version | PARTIAL | `Przywróć` actions are visible; destructive restore was not invoked during audit. |
| History | Named checkpoint | PARTIAL | `Utwórz punkt kontrolny` is visible; creation not invoked because it changes durable history beyond test cells. |
| Keyboard/A11y | Keyboard-only cell workflow | PASS / weak | Core keys work, but cells have no announced A1 label/value and selection is not exposed as grid semantics. |
| Keyboard/A11y | Screen-reader grid semantics | BLOCKED | HTML table lacks spreadsheet grid roles, row/column headers and selected-cell state. |
| Keyboard/A11y | Visible focus | PASS | Selected cell gets focus outline. |
| Keyboard/A11y | Shortcut discoverability | BLOCKED | No shortcut help/menu/tooltips. |
| Import/export | Import XLSX/CSV into open workbook | BLOCKED | No import action in editor. |
| Import/export | Download XLSX | PARTIAL | Download controls are visible in header and History rail; event proof was inconclusive in the browser run. |
| Import/export | Export active sheet CSV | PARTIAL | Control is visible; the download event did not complete within the browser audit timeout. |
| Viewer | Open workbook viewer | PASS | Canonical `/excele?artifactId=...` route reopens workbook and sheets. |
| Errors | Save failure feedback | PARTIAL | `Błąd zapisu` exists, but no retry/conflict resolution or durable unsaved queue. |
| Errors | Concurrent edit conflict | BLOCKED | Server has CAS, but UI exposes neither conflict dialog nor refresh/rebase action. |
| Errors | Offline/reconnect | BLOCKED | No offline state or queued-save recovery. |

## Findings

1. Consultify currently has a **cell editor**, not a complete spreadsheet editor. Its durable core is real and useful: select, edit, formulas, recalculation, autosave and version history all work.
2. The largest usability gap is structural/manual authoring: workbook/sheet CRUD, row/column operations, ranges, formatting, data operations and charts are absent.
3. Generated workbooks can be corrected numerically, but cannot yet be redesigned by a user without exporting to Excel.
4. The sparse Initiative Budget template exposes empty Inputs cells/rows, which makes the first opened sheet appear blank and weakens discoverability.

## Recommended implementation order

1. **P0 editor contract:** workbook rename, global saved/dirty/error state, undo/redo, copy/paste ranges, row/column headers and accessible grid semantics.
2. **P0 structural editing:** sheet CRUD/reorder plus row/column insert/delete/resize.
3. **P1 formatting ribbon:** typography, fill/border/alignment, number formats and conditional formatting.
4. **P1 data tools:** sort, filter, freeze, validation, comments and find/replace.
5. **P1 analytical objects:** chart CRUD and KPI/scenario authoring.
6. **P2 breadth:** import, richer Excel function engine, range formulas/fill and collaborative conflict recovery.

## Code delivered in this audit

- Raw cell/formula copy.
- TSV multi-cell paste into existing bounds.
- Sequential server persistence for paste to avoid CAS races.
- Ctrl/Cmd+Z undo and Ctrl/Cmd+Y redo with durable reverse/forward writes.
- Interaction tests covering paste, formula recalculation, persistence, undo and raw-formula copy.
