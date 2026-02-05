## Assessment – Initiative GenerationRuns (Enterprise 50+)

## Cel

`GenerationRun` to enterprise-orchestracja generowania portfela inicjatyw (np. 50+) z zachowaniem:

- **stabilności** (sub-batche, retry)
- **audytu** (run + batches + linkowanie)
- **deterministycznego scope** (run przypięty do assessmentu i opcjonalnie raportu)

## Dane (DB)

- `assessment_initiative_generation_runs`
  - `mode`: `ASSESSMENT_REPORT` | `REPORT_ONLY`
  - `requested_count`, `batch_size`, `status`: `RUNNING|SUCCEEDED|PARTIAL|FAILED|CANCELLED`
  - `inputs_json` (odpowiedzi z wizardu), `stats_json` (postęp/retry)
- `assessment_initiative_batches` (rozszerzone)
  - `run_id` (opcjonalne, dla powiązania batchy z run)
  - `report_id` (opcjonalne)
- `assessment_initiative_links`
  - **kanoniczna lista inicjatyw “należących do assessmentu”** (Manage view)

## Mode (źródła)

### `ASSESSMENT_REPORT`

- Źródła: `assessments.answers_json` + opcjonalnie kontekst raportu (`reportId`)
- Wymóg: assessment `APPROVED`

### `REPORT_ONLY`

- Źródła: treść raportu + opcjonalny `consultantBrief`
- Wymóg: assessment `APPROVED` + raport musi należeć do assessmentu i organizacji

## API (Assessment workflow v2)

### Create run

`POST /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs`

Body:

- `mode`: `ASSESSMENT_REPORT|REPORT_ONLY`
- `methodologyId`
- `requestedCount` (1..200)
- `batchSize` (1..7, default 7)
- `includeChatContext` (optional)
- `reportId` (required for `REPORT_ONLY`)
- `templateId` (optional; card-scope)
- `consultantBrief` (optional)

Response:

- `202 { runId }`

### Progress

`GET /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId`

Zwraca:

- `generatedCount`, `batchesPlanned`, `batchesSucceeded`, `batchesFailed`
- `status` + `error` (jeśli dotyczy)

### Preview initiatives for run

`GET /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId/initiatives`

Zwraca listę ostatnio wygenerowanych inicjatyw (limit 200) dla UX “preview”.

### Bulk submit for review

`POST /api/assessment-workflow-v2/:assessmentId/initiative-generation-runs/:runId/submit-for-review`

Efekt:

- masowa zmiana statusu: `DRAFT → PENDING_REVIEW` (dla inicjatyw z run)

## UX (Wizard)

Wizard jest dostępny w dwóch miejscach:

- **AssessmentHub → Initiatives tab** (global) – wybór assessmentu
- **Manage assessment → Initiatives tab** – assessment preselected

Wizard wspiera:

- wybór `mode`
- metodologię
- ilość inicjatyw (np. 50+)
- wybór template card-scope
- `consultantBrief`
- preview po ukończeniu
- bulk submit

## Statusy i “pierwsza publikacja”

- Po generacji inicjatywy są **`DRAFT`** (Assessment module scope)
- Po **Submit for review** przechodzą na **`PENDING_REVIEW`**
- Po akcji gate (PM/Lead/PMO) **`PENDING_REVIEW → REVIEW`** inicjatywy stają się widoczne globalnie w module Initiatives

