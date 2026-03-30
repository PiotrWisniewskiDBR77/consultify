# Final Implementation Contract — Inicjatywy (Position 11/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Dopięcie UI/UX + AI: wypełnianie całości/fragmentów, “zrób inicjatywę”, poprawianie tekstów.
- **Primary users**: PMO/manager/owner.
- **Success metric**: initiative jako „living object” z triage→plan→execute→change→report, z AI wpiętym w realny operating model.

## 2. Scope
### 2.1 In-scope
- Initiative lifecycle + UX coherence + AI propose/fill (bez silent writes).
- Handoff do `Wdrożenia`, `KPI`, `Kalendarz`.

### 2.2 Out-of-scope / non-goals
- Kopiowanie UI liderów; „projektowy everything tool” bez granic.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`
- Benchmark: `docs/product/PROJECT_MANAGEMENT_V8_BENCHMARK.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Projekty` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Linear (projects/initiatives posture + workflow/status grammar)**:
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/projects.html` (Projects jako units of work: outcome/date, progress graph, notifications; integracja issue+docs).
  - `Softs/0 Projekty/Linear.zip :: Linear/linear.appx/docs/configuring-workflows.html` (status workflow: order/categories; status+automation jako governance powierzchnia).
- **ClickUp (dashboards + dependencies + templates posture)**:
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6312197753239-Intro-to-Dashboards.html` (operator dashboards).
  - `Softs/0 Projekty/Clickup help.zip :: Clickup help/help.clickup.com/hc/en-us/articles/6309155073303-Intro-to-Dependency-Relationships.html` (dependency relationships: blocking/waiting semantics).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/createtaskfromtemplate.html` (templates jako API surface; task-from-template).
  - `Softs/0 Projekty/Clickup dev.zip :: Clickup dev/developer.clickup.com/reference/adddependency.html` (dependency jako mutacja; “waiting on / blocking”).
- **monday.com (portfolio/timeline + dashboards/widgets as surfaces)**:
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-connect_project_to_portfolio-mutation.html` (connect project→portfolio).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/changelog/new-timeline-items-query-and-mutations.html` (timeline items query + mutations).
  - `Softs/0 Projekty/Monday dev.zip :: Monday dev/developer.monday.com/api-reference/reference/dashboards-and-widgets.html` (dashboards/widgets jako first-class surface).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “initiative jako living object z uczciwą mutacją i spójnym lifecycle”, nie “pełna PM suite parity”.**

- **Project as a first-class object (Linear)**:
  - Inicjatywa ma wyraźny outcome, horyzont czasu, status, i progress readback.
  - Inicjatywa agreguje pracę (issues/tasks) + opcjonalne dokumenty/artefakty bez split-truth.
- **Status/workflow governance (Linear workflows)**:
  - Statusy i przejścia są spójne, stabilne pod write pressure; użytkownik rozumie “co się stało i dlaczego”.
  - Zmiany statusu mają audyt i nie rozjeżdżają widoków (read/write coherence).
- **Operator drill-down surfaces (ClickUp dashboards)**:
  - Widoki status/plan nie są dekoracyjne: prowadzą do akcji i pokazują “next action”.
- **Dependencies & constraints (ClickUp dependencies)**:
  - Zależności i ograniczenia są first-class (blocking/waiting) i wpływają na plan/wykonanie.
- **Templates + AI fill as a governed workflow (templates posture)**:
  - “Zrób inicjatywę” = template/scaffold + uzupełnienie fragmentów, ale bez silent writes; musi istnieć review/accept.
- **Portfolio/Timeline posture (monday)**:
  - Inicjatywy muszą wspierać co najmniej minimalny portfolio/timeline readback (bez przejęcia Wdrożeń).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_INICJATYWY_2026-03-29.md` + benchmark `PROJECT_MANAGEMENT_V8_BENCHMARK.md`.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Write confidence (read/write coherence) | writes must be believable | “write-family truth trails read-side maturity” | Domknąć save + lifecycle transitions, żeby wszystkie widoki mówią tę samą prawdę | P0 |
| Schema resilience | stable under expected variation | “schema resilience remains a concern” | Zbudować fallback/guards na drift + zachować status truth | P0 |
| Downstream spine continuity | initiative context travels | “continuity into execution/results medium” | Wzmocnić bridges do `Wdrożenia`/`KPI`/`Finanse` na deklarowanej ścieżce | P1 |
| Operator polish | calmer workflows | “PM polish later” | Po write-truth: dopracować UX statusów i “why changed” cues | P1

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Initiative można stworzyć z wielu entry points; ma spójny lifecycle i AI pomaga w decomposition/summary bez łamania governance.
- Po każdej mutacji: status/plan widoki są spójne (read/write coherence).
- “Zrób inicjatywę” działa jako governed scaffold: user widzi proposal i akceptuje zmiany (no silent writes).

### 5.2 Tests
- Integracyjne: create → update → status transition → downstream handoff (`Wdrożenia`/`KPI`) bez utraty kontekstu.
- Regression: schema drift w spodziewanym zakresie → UI nie psuje status truth i nie gubi danych.
- Contract tests: AI propose payload → review/accept → audit/log.

### 5.3 Staging proof checklist
- Demo: “create initiative” (min. 2 entry points) → plan → status change → handoff do `Wdrożenia`.
- Demo: AI scaffold (“zrób inicjatywę”) → review → accept → widoki spójne po zapisie.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (detailed plan/SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P11-A — Initiative write-truth canon + scope approval
- **Goal**: jeden lifecycle + jedna prawda (read/write coherence), bez “Jira parity”.
- **Inputs required**: status grammar + audit/log baseline; handoff do `Wdrożenia`.
- **Acceptance**: scope zatwierdzony; non-goals jawne; “no silent writes” spisane.
- **Evidence**: scope approval + linkowane benchmarki.

#### P11-B — Lifecycle transitions + downstream spine closure
- **Goal**: create→update→status transition→handoff z zachowaniem kontekstu.
- **Acceptance**: widoki po zapisie są spójne; schema drift ma guards (bounded).
- **Evidence**: integracyjne testy + staging demo (2 entry points).

#### P11-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).

### 8.2 Rollout strategy
- Najpierw write-truth i lifecycle, potem “PM polish” (P1) i rozszerzenia.

### 8.3 Rollback plan
- Wyłącz AI scaffold i automaty; zachowaj CRUD+read; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: write-truth nie dogania read → “system kłamie”.
- Ryzyko: schema drift psuje status truth.
- Decyzje: minimalny zestaw statusów i ich konsekwencje (handoff).

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P11-A |  |  |  |  |  |
| P11-B |  |  |  |  |  |
| P11-C |  |  |  |  |  |

