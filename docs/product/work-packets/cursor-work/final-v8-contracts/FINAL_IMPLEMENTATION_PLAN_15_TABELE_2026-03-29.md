# Final Implementation Contract — Tabele (Position 15/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

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

