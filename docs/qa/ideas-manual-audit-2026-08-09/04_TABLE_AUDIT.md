# Table manual audit

Status: **PASS AFTER REPAIR, WITH FINDINGS**

## Pass A — controls and menus

- Presets: Default, Triage, Scoring, Decision Log and Timeline executed.
- View/layout: Table, Kanban, Timeline/Gantt, Calendar, Matrix and Gallery present.
- Data controls: Save view, Filter, Advanced filters, Group, Columns, Add row, Add from template, Save, Undo/Redo present.
- Extended controls: AI Assistant, AI Fill, Framework, More tools, Data, Forms, Interfaces, Models, Workflow, Interface Designer, Form Builder, Webhook Relays, Import CSV, Export CSV, Copy to clipboard.
- Rail: AI, Add row, Columns, Gallery view, Filter, Dashboard, Undo/Redo.
- Row templates: Blank, Idea, Action Item, Risk, Stakeholder, Opportunity, Decision, Requirement and KPI/Metric.
- AI rail: Table AI assistant, AI categorize, Framework generator.
- Decision Log correctly warned that a Decision column was missing and offered `Add decision column`. Timeline did the same for dates. Both repair actions executed; date ranges were populated.
- Destructive import/export and external webhook relay effects were not executed; menu presence only, `NOT VERIFIED`.

## Pass B — business scene from zero

Built and persisted 11 initiatives. Added/named examples include `Asystent ofertowania AI`, `Automatyczna klasyfikacja reklamacji`, `Prognoza churn klientów B2B`, `Copilot dla CSM`. Group by Status worked. Advanced filter `Status contains To Do` returned four rows. Saved views: `AUDIT Status To Do` and `AUDIT AI Search`. Bulk delete changed 11→9 and Undo restored 11. Export CSV produced header plus 11 records and was copied to `exports/table__portfolio-ai__export.csv`.

Evidence: [table__scene__11-row-portfolio-before-refresh.png](screens/table__scene__11-row-portfolio-before-refresh.png), [table__persistence__11-row-after-refresh-route-fixed.png](screens/table__persistence__11-row-after-refresh-route-fixed.png), [table CSV export](exports/table__portfolio-ai__export.csv)

### Chronological friction log

| Step | Result | Clicks | Assessment |
|---|---|---:|---|
| create/name 11 rows | MOŻLIWE | 25+ | NATURALNE 3/5 |
| group + advanced filter | MOŻLIWE | 7 | NATURALNE 4/5 |
| save two views | MOŻLIWE | 8 | PARTIAL; switching views retained a quick filter until manually cleared |
| bulk select/delete/Undo | MOŻLIWE | 5 | OPTYMALNE 4/5 |
| add required Nazwa/Obszar/Koszt/Korzyść/Ryzyko/Właściciel | MOŻLIWE | Columns → New column repeated | exact typed schema created; Nazwa filled for all 11 rows |
| AI `Add a Deadline date column` | MOŻLIWE after repair | example → focus input → Enter → Apply selected | preview showed one date column before mutation; Apply added Deadline and reopen retained it |
| Export CSV and inspect | MOŻLIWE | 3 | file exists and records match |
| refresh/reopen | MOŻLIWE | 2 | 11 rows persisted on canonical Table route |

| Criterion | Result | Reason |
|---|---|---|
| possible | YES | 11-row portfolio, exact typed schema, two views, bulk/undo, AI preview/apply, export and reopen all work |
| natural | YES/PARTIAL | guided missing-column repairs are excellent; the initial empty table gives little orientation until Add from template is opened |
| optimal | PARTIAL | too many advanced products/actions are in one toolbar and duplicate rail actions |

## Findings

- `TB-P1-01` **repaired at the terminal-outcome contract**: Table AI previously closed/cleared after an unsupported platform proposal and looked like a silent success. It now refuses empty/unsupported schema mappings and keeps the assistant open with an actionable error; supported `create_field` operations still proceed to proposal review. The specific transient toast was not captured as screenshot, so the visual copy remains `NOT VERIFIED` despite passing type-check.
- `TB-P2-01`: advanced Data/Forms/Interfaces/Models/Workflow/Webhooks make the default toolbar product-heavy. Move to More tools.
- `TB-P2-02`: Add row and Columns are duplicated in toolbar and rail.
- `TB-P3-01`: initial `0 records` state should foreground templates and one example row.
- `TB-P1-02` **resolved by runtime discovery/retest**: `Columns → New column` exposes Text/Number/Select/Date/Rating/Person/Currency and richer types. Required schema was created and persisted. Evidence: [table__schema__required-columns-11-rows.png](screens/table__schema__required-columns-11-rows.png), [table__persistence__required-schema-ai-after-reopen.png](screens/table__persistence__required-schema-ai-after-reopen.png).
- `TB-P1-03` **repaired**: explicit name+primitive-type commands now deterministically produce a proposal when the platform endpoint cannot provide a renderable operation. `Add a "Deadline" date column` showed preview, was applied, and persisted. Evidence: [table__ai__deadline-column-preview-after-repair.png](screens/table__ai__deadline-column-preview-after-repair.png), [table__ai__deadline-column-applied.png](screens/table__ai__deadline-column-applied.png).
- Interaction finding: the unlabeled button beside the Table AI input is Close, not Submit. Submission requires Enter while focus is in the input; add a labelled Send button to remove this ambiguity.
