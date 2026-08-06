# Manual Template Builders Capability Audit — 2026-08-06

## Scope and method

Manual, no-Teresa audit of Word, Excel and PowerPoint template authoring. The audit combines a signed-in DEMO runtime walkthrough with source/API contract inspection. Runtime entry point: `Documents → Template Library → New template`; tested build badge: `97a42e810bc1` (the page exposed functionality from the later successful deployment despite the stale badge).

Rating: **PASS** works manually and is reasonably discoverable; **PARTIAL** exists but is incomplete or split across surfaces; **FAIL** has no honest user path; **UNPROVEN** could not be safely completed without creating/deleting durable production data.

## Cross-tool executive result

The library launcher is strong and visually canonical: one `New template` action opens three explicit format cards, followed by the same three start modes (blank, AI, clone). After that point the experience fragments:

- Word opens `Document Template Architect`, a governed draft/approve registry.
- PowerPoint opens its own presentation architect with the richest outline and publish lifecycle.
- Excel blank mode opens the shared `TemplateBuilderFlow`, while existing Excel templates also use the workbook-template registry/runtime.

The shared `TemplateBuilder` supports all three formats in code, but it is not the canonical blank editor for Word and PowerPoint. Consequently identical concepts have different labels, save semantics and lifecycle controls.

## Entry, library and lifecycle

| Capability | Word | Excel | PowerPoint | Evidence / usability |
| --- | --- | --- | --- | --- |
| Open template library | PASS | PASS | PASS | One canonical Template Library with All/Documents/Presentations/Sheets tabs, table/grid switch and status counters. |
| Create from blank | PASS | PASS | PASS | Runtime launcher exposes format → `Od czystego`; Word routes to its architect, Excel to shared builder, PPT to presentation architect. |
| Create with AI | PASS | PASS | PASS | Launcher exposes a peer `Z AI` mode. Not used in this manual-only audit. |
| Clone existing | PASS | PASS | PASS | Launcher exposes `Na bazie istniejącego`; canonical resolution differs by runtime. |
| Open existing | PASS | PASS | PASS | Registry rows and row-action menus are visible. Word registry showed draft and approved records with versions. |
| Rename template | PASS | PASS | PASS | Word/PPT architect forms and shared builder title/properties expose name editing. |
| Save draft | PASS | PARTIAL | PASS | Word/PPT explicitly model drafts. Shared Excel builder says `Zapisz jako szablon` and performs a create POST; draft status is not explained at action time. |
| Validate before publish | PARTIAL | FAIL | PARTIAL | Word/PPT impose structural/server validation at approval. Shared Excel builder only disables save for an empty name; no visible quality/validation summary. |
| Publish / approve | PASS | FAIL in shared blank builder | PASS | Word has approve/deprecate actions; PPT has `Approve & publish`; shared builder has save only. |
| Use template to generate | PASS | PASS | PASS | Canonical use routes exist: Document Studio Mode 3, workbook template selection, and presentation generation. |
| Edit after save | PASS | PARTIAL | PASS | Governed architects support editing/cloning drafts. Shared builder accepts only `initialDraft` and its API only POSTs a new record; no canonical reopen/update contract. |
| Version history | PASS | PARTIAL | PASS | Word registry displays `v0.1/v1.0`; PPT model and architect expose versions. Shared builder has no history UI. |
| Deprecate / withdraw | PASS | FAIL | PASS | Word/PPT expose governed retirement. Shared builder exposes none. |
| Delete draft | PARTIAL | FAIL | PASS | PPT explicitly offers withdraw/delete draft. Word exposes lifecycle row actions but destructive runtime was not invoked. Shared builder cannot delete a persisted template. |

## Structure and editing contract

| Capability | Word | Excel | PowerPoint | Evidence / usability |
| --- | --- | --- | --- | --- |
| Add structure item | PASS | PASS | PASS | Sections / sheets / slides. |
| Rename item | PASS | PASS | PASS | Section title, sheet name and slide title are editable. |
| Remove item | PASS | PASS | PASS | All editors prevent an empty template or validate minimum structure. |
| Reorder item | PASS | PASS | PASS | Up/down actions exist across the three editors. Shared builder lacks drag reorder despite showing a grip icon. |
| Item type/archetype | PASS | PASS | PASS | Word block type/depth, Excel column types/validation, PPT slide archetype/layout. |
| Formula/validation schema | N/A | PASS | N/A | Excel sheet editor exposes column type, formulas/validation-oriented schema and sheet CRUD. |
| Layout selection | PARTIAL | PARTIAL | PASS | PPT has archetype preview/layout policy. Word layout is mostly document-type/section blueprint. Excel layout is structural, not page/dashboard composition. |
| Style/theme | PARTIAL | PARTIAL | PASS | Shared builder offers only a theme reference backed by three demo options; Word architect is governance-first; PPT has the strongest theme/layout surface. |
| Variables/placeholders | PARTIAL | PARTIAL | PARTIAL | Structural prompts and AI-filled toggles exist, but no common variable catalog, type system, required/default values or unused-variable diagnostics. |
| Preview | PARTIAL | PARTIAL | PASS | Shared PPT cards have silhouette preview; Word has structure preview, not rendered DOCX; Excel has schema editing, not a representative generated workbook preview. |
| Keyboard operation | PARTIAL | PARTIAL | PARTIAL | Structure cards are keyboard selectable and buttons are labeled. Actions were visually hidden until hover; fixed to reveal on `focus-within`. No documented builder shortcut map. |
| Undo/redo | FAIL | FAIL | PARTIAL | Shared builder and Word template architect do not expose local undo/redo. PPT editor has richer history through its deck tooling, but template-outline operations do not present a uniform undo contract. |

## Visual canon and intuitiveness

### PASS

- Launcher cards use current typography, neutral surfaces, Lucide icons and clear descriptive copy.
- Template Library uses the canonical table, status chips, filters, counters and split create action.
- Shared builder uses `ExecutiveModuleShell`, standard left structure rail, canvas and right properties rail.
- Focus rings use `c-focus`; destructive actions use semantic danger styling rather than crimson primary styling.
- Buttons have accessible names; the Word architect runtime exposed labelled form controls and a real table registry.

### Issues

1. **P0 lifecycle parity:** Excel blank builder can create but cannot approve/publish, reopen/update, version, deprecate or delete. This is the largest functional gap.
2. **P0 semantic fragmentation:** `Save as template`, `Draft template`, and `Approve & publish` mean different state transitions without a shared lifecycle indicator.
3. **P1 preview parity:** Word and Excel cannot render a faithful representative output before approval. Structure-only preview is insufficient to judge a template.
4. **P1 variables:** no shared variable editor or validation contract across formats.
5. **P1 reorder affordance:** the shared structure list displays a grip but implements only arrow buttons, so it visually promises drag-and-drop that does not exist.
6. **P1 theme data:** `DEMO_THEME_OPTIONS` is hard-coded; the UI copy claims organization Brand Kit integration that the shared builder does not actually load.
7. **P1 destructive safety:** shared builder element deletion is immediate and has no undo/confirmation. It is only a local draft mutation, but still easy to trigger accidentally.

## Runtime walkthrough evidence

- Template Library loaded 97 records and exposed status breakdown: 46 approved, 49 published and 2 drafts.
- `New template` exposed Word, presentation and workbook choices with current descriptive copy.
- Word → blank opened `Document Template Architect`, not Teresa, with template name, document type, required purpose, audience, language, optional AI refinement and disabled `Draft template` until required data is supplied.
- Word registry displayed both draft (`v0.1`) and approved (`v1.0`) records, section counts and row-action menus.
- Durable create/publish/delete actions were not submitted because the audit did not need to pollute the production-like DEMO registry. Their contracts were verified from the corresponding API/UI code.

## Independent fixes delivered

- Excel shared builder left rail now correctly says **Arkusze**, not **Kolumny** (the rail lists workbook sheets).
- Hidden structure actions now become visible on keyboard focus through `group-focus-within`, matching their existing accessible labels and focus rings.

## Acceptance standard for “manual template builder complete”

All three formats must satisfy the same state machine and vocabulary:

`New draft → validate → preview representative output → approve/publish → use → create editable new version → deprecate/archive`, with explicit status, version and recovery at every step.

Completion additionally requires:

1. structure CRUD and reorder without Teresa;
2. format-specific layout/style controls;
3. typed variables with required/default/sample values and diagnostics;
4. faithful Word/Excel/PPT preview;
5. version comparison and restore;
6. safe draft deletion and published-template deprecation;
7. one visual/accessibility standard and consistent action names.

Current result: **Word PARTIAL+, Excel PARTIAL, PowerPoint PARTIAL+**. Structure editing is viable; cross-tool lifecycle, preview and variable parity are not yet complete.

## Excel runtime lifecycle follow-up — 2026-08-07

Signed-in DEMO test used the disposable organization template `QA Excel Lifecycle 20260807 0011` and no Teresa/AI generation.

| Step | Result | Runtime evidence |
| --- | --- | --- |
| Create blank template | PASS | Format → `Od czystego` → organization scope opened the workbook builder. |
| Manual schema authoring | PASS | Created `Budget` and `Milestones`; added text/list validation, currency/date columns, formats and starter values. |
| Validate | PASS | Selecting list validation without values immediately changed the command to `Błędy: 1` and disabled Save; completing the list restored `Walidacja: OK`. |
| Save draft | PASS | Save returned a success toast and opened the workbook-template use surface. |
| Instantiate/use | PASS | `Build workbook` created an XLSX-backed workbook with both sheets and preserved starter values (`Operations`, `1 400 000`, `875 000`). Runtime reported `Model verified ✓ (0 notes)`. |
| Reopen/edit/update | **FAIL → FIXED IN CODE, AWAITING DEPLOY** | Library `Edit` incorrectly routed a Sheet template to `/reports/builder?...&edit=true`. Fix `c6d564bb60` routes with the canonical template id to `PersistedTemplateBuilder`. |
| Approve/version/deprecate/delete | BLOCKED BY REOPEN ROUTE | Lifecycle controls cannot be reached on the currently served build until the routing fix is deployed. |

Additional evidence: the page badge reported `DEMO @97a42e810bc1`, not the deployment identifier `bf6d50e7` supplied for this acceptance run. The runtime-created template was also labelled `Legacy` in the central library even though its canonical workbook record and artifact-index id both existed. This label should be audited separately because it obscures the lifecycle authority visible to the user.

The routing repair adds an explicit Sheet edit contract, URL deep link (`editWorkbookTemplateId=<canonical id>`), persisted full-screen builder overlay, save refresh and safe return to Template Library. Contract/unit/component suite: **28/28 passing**.
