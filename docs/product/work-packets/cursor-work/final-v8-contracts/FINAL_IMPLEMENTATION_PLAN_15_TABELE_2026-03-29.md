# Final Implementation Contract — Tabele (Position 15/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: approved(scope) (P15-A canon frozen; docs-only)

## 1. Executive summary
- **Intent**: Pełna logika Airtable: tabele zwykłe/relacyjne + AI współbuduje jak konkurencja.
- **Primary users**: operatorzy danych i procesu.
- **Success metric**: table operating system: base/multi-table, field governance, views/forms/interfaces, relations/dependencies, AI propose→approval→apply.

## 2. Scope
### 2.1 In-scope
- Base + multi-table model (kanoniczny UX).
- Schema/fields, relations, views, forms, interfaces.
- AI-native table building: describe → plan → approve → build (proposal-driven).

### 2.2 Out-of-scope / non-goals
- Budowa klona Airtable/Coda; kopiowanie UI.

### 2.3 P15-A canon (singular relational grammar + scope approval)

This section is the **scope-approval canon** for Tables v8. It freezes **one relational grammar** so later packets do not invent parallel “truths” (per-module config tables, bespoke record models, or silent AI mutations).

#### 2.3.1 Singular relational grammar: the objects (and what they are not)
Everything in Tables is one of these objects; everything else is a projection, operation, or permission wrapper.

- **Base**: a governed container for multi-table work (membership + permissions + audit boundary).
- **Table**: a named collection of records with a schema (fields) inside a base.
- **Field**: typed schema definition belonging to exactly one table (with options + constraints).
- **Record**: a row instance in a table; the canonical data truth (views/forms/interfaces never create a second truth).
- **Relation**: linked-record semantics connecting records across tables (implemented via relation-capable fields + reciprocal semantics).
- **View**: a saved, named projection over a table (filter/sort/group + visible fields/layout).
- **Form**: a bounded input surface that creates (or updates, if later approved) records in a table.
- **Interface**: a curated operator/consumer surface built on the same base/table/view/record truth (no duplicate storage).

Identifiers (frozen):
- Every object above has a **stable immutable ID** (UUID/ULID) and a mutable display name (where applicable).
- All references across objects use IDs (never names) to survive renames.

#### 2.3.2 Schema canon (base → tables → fields)
Schema is a governed layer; schema changes are never “just UI”.

Field types (canonical posture):
- **Primitive**: text, longText, number, currency, percent, boolean, date, datetime, singleSelect, multiSelect, email, url, phone.
- **People/refs**: user (workspace user reference), org (optional), createdBy/updatedBy (system).
- **Files**: attachment (file references, not embedded blobs in schema).
- **Computed**: formula, lookup, rollup.
- **Relational**: linkedRecord (relation-capable field).

Constraints (baseline, P0):
- **Required** (record cannot be saved if missing).
- **Unique** (within table; canonical enforcement server-side).
- **Default value** (applies on record create).
- **Validation** (type-specific: e.g. number ranges, date bounds, select options).
- **Read-only/system** (createdAt/updatedAt/createdBy/updatedBy not directly editable).

Schema edit operations (explicit):
- Add field / rename field / change field type (bounded, may be destructive) / configure options / remove field (destructive).
- Destructive operations require explicit warnings and produce auditable events (see 2.3.6 + 2.3.9).

#### 2.3.3 Records canon (CRUD + record object semantics)
Records are the canonical truth. Views/forms/interfaces are projections and workflows over the same record set.

Record operations (P0):
- **Create**: create a record (manual or via form; AI only via governed apply).
- **Read**: grid/record-detail readback always reflects the same underlying truth.
- **Update**: update field values subject to type validation and permissions.
- **Delete**: delete record (soft-delete vs hard-delete is implementation detail, but user-facing semantics must be explicit).

Record identity & audit posture:
- Record has stable ID and tableId.
- Minimum system fields are assumed: createdAt, updatedAt, createdBy, updatedBy (even if not always visible in every view).

#### 2.3.4 Relations canon (linked records semantics + explainability)
Relations are first-class because they define cross-table truth.

Semantics (frozen):
- A relation is represented by a **linkedRecord field** that stores a set of target record IDs.
- Every relation has an explainable **reciprocal posture**:
  - **Bidirectional (default)**: linking A→B implies B has a reciprocal view of the link (via reciprocal field or implicit backref).
  - **Unidirectional (P1)**: only if explicitly approved later; not assumed for P15-B closure.

Cardinality posture (product truth):
- Baseline storage is **many-to-many** (a link field can point to multiple records).
- **One-to-many / one-to-one** are expressed as constraints on top of the same mechanism:
  - one-to-one: enforce max 1 link on both sides,
  - one-to-many: enforce max 1 link on the “many” side (or the inverse, depending on declared direction).
- Cardinality constraints, if enabled, must be enforced server-side and explained in UI (clear error on violation).

Referential integrity (bounded, P0):
- Link values must always point to existing records; stale links resolve to explicit degraded placeholders (see 2.3.8).
- Deleting a record must define what happens to incoming links:
  - baseline: links to the deleted record become invalid and surface as a degraded placeholder until cleaned (no silent data rewrite),
  - optional (P1): cascading unlink with explicit approval.

Explainability rule:
- User can always answer: “what table do these linked records come from?”, “is it one-to-many or many-to-many?”, “what happens when a record is deleted?”

#### 2.3.5 Views canon (saved views + query discipline)
Views are the operating system layer: stable saved projections, not ephemeral filters.

View object (P0):
- Saved view belongs to a table and has its own stable ID.
- Baseline view config includes:
  - **filters** (field/operator/value),
  - **sorts** (field + direction),
  - **grouping** (0..1 grouping key baseline; multi-level grouping is P1),
  - **visible fields/columns** (order + hidden fields),
  - optional view type metadata (grid/kanban/timeline/etc. as available in the product).

View semantics (frozen):
- A view never changes the underlying record truth; it only changes what is displayed and how it is queried.
- Saved view changes are auditable and permissioned separately from record edits (see 2.3.7).

#### 2.3.6 Forms & interfaces canon (bounded P0 vs explicit P1)
Forms/interfaces are part of Tables OS only if they sit on the same truth.

P0 (bounded, required for P15-B lane closure):
- **Form (create-record)**:
  - targets exactly one table,
  - has an ordered list of fields + per-field required/visible posture,
  - performs type validation and constraint checks on submit,
  - creates a record and returns a stable record link (or success receipt).
- **Interface (curated surface)**:
  - targets base/table/view and surfaces records without duplicating them,
  - may be read-only by default; bounded field edits are allowed only if permissions permit,
  - must include “source of truth” pointers (which base/table/view am I looking at?).

P1 (explicitly not required unless later approved):
- Update-record forms, multi-step forms/workflows, public forms with complex auth, interface page-builder parity, cross-table dashboards, custom components library.

#### 2.3.7 Permissions + lock semantics (frozen)
We freeze “who can mutate what” to prevent accidental schema corruption and silent governance drift.

Roles/postures (conceptual; exact role names may differ, but semantics must hold):
- **Base owner/admin**: can change base membership and all permissions; can edit schema, views, interfaces.
- **Schema editor**: can add/rename/remove/change fields; can create/modify relations.
- **Data editor**: can create/update/delete records (subject to field-level restrictions).
- **View editor**: can create/rename/modify saved views (filters/sorts/group/visible fields).
- **Interface builder**: can create/modify interfaces (curated surfaces) but cannot change schema unless also schema editor.
- **Viewer**: read-only across records and views; cannot mutate schema/views/interfaces.
- **Form submitter (bounded)**: can create records via a specific form if explicitly allowed; cannot browse base by default.

Lock semantics (truth posture):
- **Schema lock** (table-level): schema becomes read-only for non-admins; record operations may still be allowed.
- **View lock** (view-level): a view can be locked to prevent accidental edits to its configuration; record edits in that view may still be allowed.
- **Interface lock** (interface-level): interface config becomes read-only; underlying records remain governed by record permissions.
- Locks must be **enforced server-side** and reflected in UI as explicit “read-only/locked” cues (no silent failures).

#### 2.3.8 Schema drift posture (rename/remove impacts)
Schema drift must be predictable. When automatic repair is unsafe, we degrade explicitly.

Rename field (predictable update, P0):
- References update by field ID; displayed name changes everywhere (views, forms, interfaces, formulas) without breaking.

Remove field (explicit degraded state, P0):
- If a view/form/interface references a removed field:
  - it surfaces as **Missing field** (with the removed field’s last-known name if available),
  - the surface remains readable, but configuration edits require resolving the missing reference,
  - record data for that field is not silently re-mapped to another field.

Type change (bounded, may be destructive):
- If a type change would invalidate existing data or downstream computed fields, it must:
  - require explicit approval,
  - produce a preview/diff (counts of affected records),
  - and on failure, remain atomic (no partial silent corruption).

Relations drift:
- If a relation target table/field is removed, dependent lookup/rollup fields degrade explicitly (“Broken relation”) until repaired.

#### 2.3.9 AI governed contract (describe → plan → preview/diff → approve → materialize; NO silent writes)
AI is a governed builder. It may propose changes, but never applies them silently.

Workflow (mandatory):
1. **Describe** (user intent in NL)
2. **Plan** (AI proposal payload)
3. **Preview/diff** (human-reviewable changes)
4. **Approve / Reject** (explicit user action)
5. **Materialize** (apply operations with audit + rollback posture)

Plan payload must include (minimum):
- **Targets**: baseId, tableIds (existing) and/or newTable specs.
- **Schema ops**: fields to add/rename/remove/change type, with full type configs + constraints.
- **Relations ops**: linkedRecord fields to add/configure; reciprocal semantics; cardinality constraints if any.
- **Views ops**: saved views to create/update (filters/sorts/grouping/visible fields).
- **Forms/interfaces ops**: only within P0 bounds unless explicitly flagged as P1 and rejected by default.
- **Diff summary**: counts of adds/renames/removes; risk flags for destructive ops.
- **Atomicity statement**: apply is atomic; any failure produces no partial write.

Audit/log requirements (frozen):
- Every apply creates an auditable event containing: actor, timestamp, object IDs touched, operations list, before/after snapshot pointers, and outcome (success/failure + reason).
- The UI must expose a human-readable “what changed” summary after apply.

#### 2.3.10 Anti-duplicate gate (one Tables OS canon)
- Do **not** create per-module “config tables” or parallel storage that re-implements Tables semantics.
- If another module needs structured data, it must either:
  - use Tables OS (base/table/fields/records/views), or
  - explicitly propose a new canon as a separate packet and get scope approval.

#### 2.3.11 Error/degraded posture (minimum scenarios)
Minimum scenarios that must be handled with explicit, recoverable UX posture:
1. **Permission denied (schema edit)**: operation blocked; explain which permission is required.
2. **Permission denied (record edit/delete)**: no partial edits; show read-only state.
3. **Schema lock active**: schema UI is read-only; attempts to mutate show “locked” reason.
4. **View/interface config drift** (missing field): surfaces “Missing field” and a repair action.
5. **Relation integrity violation** (cardinality constraint): link blocked with a clear error.
6. **Stale version / concurrency mismatch**: reject with refresh required; preserve user context.
7. **AI plan invalid** (fails validation): cannot approve/apply; show validation errors and allow regenerate.
8. **AI apply failure**: atomic rollback; show what failed; proposal remains to retry or discard.
9. **Query/view execution error**: show degraded state; record truth remains accessible.
10. **Large base performance degradation**: degrade animations/rendering; never drop records/links silently.

#### 2.3.12 Acceptance checklist (scope approval; testable)
- [ ] I can explain the canon objects: base, table, field, record, relation, view, form, interface (and that records are the truth).
- [ ] Every object has a stable ID; renames do not break references.
- [ ] Field types and constraints are explicit (required/unique/default/validation) and enforced server-side.
- [ ] I can create/read/update/delete records (subject to permissions) and see consistent readback across surfaces.
- [ ] Linked records are explainable and consistent; cardinality constraints (if enabled) are enforced with clear errors.
- [ ] Views are saved objects with filters/sorts/grouping/visible fields; changing a view never mutates record truth.
- [ ] Forms create records with validation; interfaces are curated surfaces on the same truth (no duplicate data).
- [ ] Locks (schema/view/interface) produce explicit read-only cues and are enforced server-side.
- [ ] Schema drift is predictable: rename updates cleanly; remove/type-change produces explicit degraded state or previewed destructive change.
- [ ] AI never performs silent writes; every change goes through plan → preview/diff → explicit approve → atomic apply with audit log.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md`
- Benchmark: `docs/strategy/TABELE_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 tabele` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md`).
- Benchmark doc: `docs/strategy/TABELE_V8_BENCHMARK.md` (Airtable/Coda posture).

### 4.2 Local Softs evidence (concrete artifacts)
- **Airtable (relational grammar: linked records + views + interfaces + automations + governance cues)**:
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/understanding-linked-record-relationships-in-airtable.html` (linked record relationships: relacje jako core model).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/timeline-view-overview.html` (Timeline view: view types jako first-class; permissions per role).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/formula-field-reference.html` (Formula field reference: operator-grade field logic).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/legacy-interface-designer-functionality.html` (Interface Designer: interface layer jako osobna powierzchnia UX).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/airtable-automations.html` (Automations: workflow triggers/actions jako część table OS).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/record-templates.html` (Record templates: reusable scaffolds).
  - `Softs/0 tabele/AirTable/Archive.zip :: support.airtable.com/docs/ai-field-agent-build-prototype.html` (AI Field agent: “build prototype”; AI jako workflow w tabelach).
- **Coda (docs-plus-data + connected views + formulas + automations)**:
  - `Softs/0 tabele/Coda.zip :: Coda/coda.io/resources/guides/introduction-to-tables.html` (tables jako data model w dokumencie; connected views).
  - `Softs/0 tabele/Coda.zip :: Coda/coda.io/resources/guides/introduction-to-table-views.html` (views jako sposób pracy z tym samym modelem).
  - `Softs/0 tabele/Coda.zip :: Coda/coda.io/formulas.html` (formula library: “everything cool after =”).
  - `Softs/0 tabele/Coda.zip :: Coda/coda.io/resources/guides/how-automations-work-and-what-they-do.html` (automations: repetitive tasks on autopilot).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “jedna relacyjna gramatyka + views/forms/interfaces na tej samej prawdzie”, nie “pełna Airtable/Coda platform parity”.**

- **Relational core (Airtable linked records)**:
  - Relacje (linked records) są first-class: user rozumie jak działa relacja i jakie ma konsekwencje w UI.
  - Relacje są spójne w read/write (brak “view shows X, record shows Y”).
- **Views as first-class operating modes (Airtable timeline + Coda views)**:
  - View types (grid/kanban/timeline etc. w deklarowanym zakresie) są stabilne i powtarzalne.
  - Permission posture dla operacji na views jest jasny (kto może tworzyć/lockować/edytować).
- **Field logic (Airtable formulas + Coda formulas)**:
  - Formuły/field logic mają przewidywalny kontrakt i są częścią “operator OS”, nie hackiem.
- **Interfaces layer (Airtable Interface Designer posture)**:
  - Interfaces (operator UI) budują się na tym samym modelu danych; nie tworzą alternatywnej prawdy.
- **Automation posture (Airtable + Coda)**:
  - Automations są bounded, ale realne: trigger/action + audyt i recovery (bez silent failure).
- **AI-native building as governed proposals (Airtable AI field agent)**:
  - AI proponuje schema/fields/relations/views (plan) → user zatwierdza → materializacja; rezultat audytowalny.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_TABELE_2026-03-29.md` + `TABLE_MISSING_CAPABILITIES_MATRIX_V8.md` + readiness `TABLE_V8_READINESS_AUDIT.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Singular relational grammar | one coherent product model | “lacks one calm, singular relational grammar” | Domknąć jedną gramatykę: schema→records→views→docs-plus-data | P0 |
| Record/context quality | record is usable object | “record/context weaker than benchmark” | Wzmocnić record detail + docs-plus-data composition na deklarowanym lane | P0 |
| Interfaces/forms maturity | UX surfaces on same truth | “interface/form/governance later” | Zbudować minimalne forms/interfaces na tej samej prawdzie (bounded) | P1 |
| Governance foundation | permissions reinforce model | “governance should reinforce model” | Ujednolicić permission/lock semantics dla schema/views/forms | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Base/multi-table + manage fields + relations + saved views + forms/interfaces + AI schema proposal są spójne i reviewable.
- Relational grammar jest “explainable”: user potrafi powiedzieć co jest schema, co jest record, co jest view, co jest interface.
- AI “describe→plan→approve→build” ma preview/diff i nie robi silent writes.

### 5.2 Tests
- Integracyjne: create base → add tables/fields → linked records → create views → create form/interface → permissions/lock checks.
- Regression: schema change → views/interfaces aktualizują się przewidywalnie (albo pokazują czytelny degraded state).
- Contract tests: AI plan payload → approval → materialization → audit/log + rollback posture.

### 5.3 Staging proof checklist
- Demo: “zbuduj mini-OS” (2 tabele + relacja + 2 views + 1 form/interface) + operacje na rekordach.
- Demo: NL→schema proposal→approval→materialization + późniejsza edycja bez utraty spójności.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (readiness/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P15-A — Singular relational grammar (scope approval)
- **Goal**: jedna gramatyka: schema→records→views→interfaces (bounded), bez Airtable parity.
- **Inputs required**: decyzje o minimalnym modelu relacyjnym + permissions/lock semantics.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “schema drift posture” spisana.
- **Evidence**: scope approval + linkowane benchmarki/readiness.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze minimal relational model (schema/records/views/interfaces) and “explainable grammar”.
  - Freeze permissions/lock semantics and schema drift posture (degraded vs automatic updates).
  - Freeze AI plan→approve→materialize contract (no silent writes).
- **DoD**:
  - Approved(scope): one relational grammar is explicit and testable; non-goals clear.

#### P15-B — Base→records→views→forms/interfaces closure
- **Goal**: domknąć mini-OS lane (2 tables + relation + views + interface) na jednej prawdzie.
- **Acceptance**: schema change ma przewidywalny readback (lub jawny degraded); AI plan ma preview/diff.
- **Evidence**: integracyjne testy + staging demo “mini-OS”.
- **Tasks**:
  - Implement the mini-OS lane end-to-end (2 tables + relation + views + interface) on one truth.
  - Implement schema change behavior with predictable readback or explicit degraded state.
  - Add integration/regression tests (5.2) and run staging demos (5.3).
- **Staging proof script (click-by-click)**:
  1. Create a base with 2 tables and a relation; add fields; create linked records.
  2. Create 2 saved views and 1 form/interface (bounded); verify all surfaces reflect the same truth.
  3. Use AI: describe→plan→preview/diff→approve→materialize (no silent writes).
  4. Change schema (rename/add/remove bounded field) and verify views/interfaces update predictably or show explicit degraded.
  5. Check permissions/lock (bounded) and confirm denied actions are explicit.
- **DoD**:
  - Mini-OS demo passes; schema drift posture is honest; AI materialization is governed.

#### P15-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P15-A/B/C.
  - Validate rollback: disable AI materialization; preserve read-only and export.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw schema+records+views, potem interfaces/forms (P1) i governance hardening.

### 8.3 Rollback plan
- Wyłącz AI materialization; zachowaj read-only i eksport; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: brak jednej gramatyki relacyjnej (produkt rozjechany).
- Ryzyko: schema drift psuje views/interfaces bez czytelnego degraded.
- Decyzje: minimalny zakres form/interfaces + ich governance.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P15-A | approved(scope) |  | N/A (docs-only scope approval) | N/A | §2.3 canon frozen: relational grammar + permissions/locks + drift posture + AI no-silent-writes contract + anti-duplicate gate + degraded posture + acceptance checklist |
| P15-B |  |  |  |  |  |
| P15-C |  |  |  |  |  |

