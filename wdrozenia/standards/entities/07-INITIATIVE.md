# ✅ Standard encji: Initiative (KANON – PMO/PMI change delivery hub)

## Cel

`Initiative` to **najważniejszy artefakt** platformy: łączy strategię, governance i egzekucję w jeden kontrolowany lifecycle.

**Initiative = HUB** uruchamiający i spinający:

- **Tasks** (realna praca / delivery)
- **Decisions** (w tym gate decisions blokujące statusy)
- **Notifications** (presja i routing odpowiedzialności)
- **Economics** (analiza + tracking: CAPEX/OPEX/ROI/NPV, KPI, benefits)
- **RAID** (risks/issues/assumptions/dependencies)
- **Stakeholders** (RACI + watchers/subscribers)
- **Audit/History** (kto/kiedy/co/dlaczego)

Ta encja ma działać **jak “project charter + governance cockpit + execution hub”** w stylu PMO/PMI (bez agile sprintów).

---

## Źródła prawdy w systemie (kod + standardy)

- **Status workflow (kanon)**: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- **Backend source-of-truth**: `server/src/constants/initiativeStatuses.ts`
- **Frontend lifecycle**: `src/services/initiativeLifecycle.ts`
- **Gates (kanon)**: `wdrozenia/workflows/decision-gates/00-OVERVIEW.md` + `wdrozenia/standards/entities/02-DECISION.md`
- **Task (kanon)**: `wdrozenia/standards/entities/01-TASK.md`
- **Notification (kanon)**: `wdrozenia/standards/entities/06-NOTIFICATION.md`

---

## Statusy i moduły (status-driven architecture)

W platformie **status determinuje moduł**, w którym inicjatywa jest “obsługiwana operacyjnie”.

**Kanoniczne statusy (13):**

- Source: `DRAFT`, `PENDING_REVIEW`
- Initiatives: `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED`
- Execution: `EXECUTING`, `BLOCKED`, `DONE`
- Benefits: `TRACKING`
- Terminal: `CANCELLED`, `ARCHIVED`

**Kanoniczne mapowanie modułów:**

- **Tools/Assessment**: `DRAFT`, `PENDING_REVIEW` (inicjatywy “źródłowe” – hipotezy)
- **Initiatives**: `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED` (+ historyczne `CANCELLED`, `ARCHIVED`)
- **Execution**: `SCHEDULED`, `EXECUTING`, `BLOCKED`, `DONE`
- **Benefits**: `TRACKING`
- **Reporting**: wszystkie statusy (read-only)

---

## Gate decisions (bramki) – jak to ma działać

**Gate = Decision**, która:

- ma **Decision Owner + due date**
- ma **konsekwencje braku decyzji** (“blocks X”)
- ma **eskalacje**
- jest **egzekwowana w backendzie** przed zmianą statusu

### Zasada krytyczna

- **Consultant nie wykonuje gate decisions biznesowych**.
- Jedyny wyjątek techniczny: `SUBMIT_FOR_REVIEW` (autor wysyła do review własną pracę).

### Minimalne gates (P0)

- `SUBMIT_FOR_REVIEW`: `DRAFT → PENDING_REVIEW`
- `APPROVE_TO_INITIATIVE`: `PENDING_REVIEW → REVIEW`
- `ACCEPT` (Go/No-Go): `REVIEW → PROMOTED`
- `START_PLANNING` (Resources Commit): `PROMOTED → PLANNING`
- `APPROVE`: `PLANNING → APPROVED`
- `SCHEDULE` (Schedule Lock + dates): `APPROVED → SCHEDULED`
- `START`: `SCHEDULED → EXECUTING`
- `BLOCK/UNBLOCK`
- `COMPLETE`: `EXECUTING → DONE`
- `START_TRACKING`: `DONE → TRACKING`
- `ARCHIVE`: `TRACKING/CANCELLED → ARCHIVED`
- `CANCEL`: większość stanów → `CANCELLED`

**Backend enforcement**: blokada ma generować `initiative.gate_blocked` + routing do ról / RACI / watchers.

---

## Dwa formaty UI inicjatywy (KANON)

To jest świadoma decyzja produktowa: jeden artefakt ma 2 powierzchnie UI.

---

## Templates “card scope” (zakres karty inicjatywy)

To **nie jest “typ inicjatywy”**, tylko **konfiguracja sekcji/artefaktów**, które są widoczne i wymagane na karcie inicjatywy.

### Store (DB)

- `initiative_templates.template_data.cardScope` – deklaratywny zakres sekcji (np. decisions/economics)
- `initiatives.initiative_template_id` – aktualnie wybrany template dla inicjatywy

### Seed (P0)

Publiczne template’y (stabilne ID):

- `tpl-card-lite` – minimalna karta (bez decisions, bez economics)
- `tpl-card-standard` – standard enterprise
- `tpl-card-governance` – governance-heavy (decisions/gates/RAID)
- `tpl-card-economics` – economics-heavy (financial analysis + impact)

### API (P0)

- `GET /api/initiatives/templates` – lista template’ów (public + org)
- `GET /api/initiatives/templates/:templateId` – szczegóły (w tym `cardScope`)
- `PATCH /api/initiatives/:id/template` – zmiana template’u inicjatywy w trakcie lifecycle

### UI (P0)

`InitiativeDocumentView` renderuje sekcje warunkowo zgodnie z `cardScope` (np. ukrycie economics lub decisions).

### 1) Quick Review Drawer (50% width)

Cel: **szybka ocena i orientacja**, bez ciężkiej edycji.

**Zasada:** drawer jest “review-grade”, a nie “edit-grade”. Ma prowadzić do pełnej karty.

Minimalne sekcje w drawer (P0):

- **Status + module** + szybkie CTA (np. Submit for review / Request decision)
- **Gate readiness**: co blokuje następny krok (Decision missing / dates missing / economics missing)
- **Next milestone / timeline snapshot**
- **Top RAID** (np. 3 najważniejsze)
- **Tasks/Decisions summary** (liczniki + top blockers)
- **Ownership** (Business Owner / Initiative Owner / Sponsor)
- CTA: **Open full card**

### 2) Full Card (Document View w DynamicTabs)

Cel: **pełna karta jako “hub”**, jedyne miejsce do kompletnego prowadzenia inicjatywy.

Tryby prezentacji (KANON):

- `D` (D presentation mode: obecny Golden Standard 2/3 + 1/3)
- `N` (N presentation mode: nawigacja + treść strony + properties)
- `C` (C presentation mode: action-first: command bar + taby)

Źródło prawdy: `docs/ui-standards/01-shell-layout/presentation-modes.md`.

**Układ UI/UX (jak Task/Decision Golden Standard):**

- **Lewa kolumna**: treść merytoryczna (collapsible sections)
- **Prawa kolumna**: Control/sterowanie + metryki + governance

Minimalne wymagane elementy pełnej karty (P0):

- **Opis/Charter** (problem, cel, scope, success criteria)
- **Comments**
- **Tasks** (create/link; status summary; zależność od milestone)
- **Decisions** (create/request; pokazuj “blocks”)
- **RAID** (risk/issue/assumption/dependency)
- **Gate readiness + timeline (gates)** (w tym AI wnioski)
- **Economics integration** (link + snapshot)
- **Stakeholders**: RACI + watchers/subscribers + routing notyfikacji
- **Reminders & escalation** (dla decisions/tasks)
- **History/Audit**

**Docelowo (P1/P2)**:

- baselines vs actual (schedule/cost) + tolerancje
- change control (change request → decision → baseline update)
- benefits realization plan (KPI baseline/target/owner/measurement cadence)
- raportowanie (steering pack) generowane z danych inicjatywy

---

## Model danych (minimum – PMO/PMI, bez agile)

### Identity / klasyfikacja

- `id`, `name/title`
- `sourceType`, `sourceId` (traceability: tool session / assessment report / interview)
- `axis` (strategic/operational/transformational/compliance)
- `priority` (CRITICAL/HIGH/MEDIUM/LOW)
- `status` (kanon)

### Ownership / governance

- `ownerBusinessId` (Business Owner)
- `ownerExecutionId` (Initiative Owner / Execution Owner)
- `sponsorId`
- `pmoOwnerId` (opcjonalnie)

### Charter (merytoryka)

- `problemStatement`, `objective`, `scopeIn/scopeOut`
- `successCriteria`, `deliverables`, `assumptions`, `constraints`

### Plan / harmonogram

- `plannedStartDate`, `plannedEndDate`
- `milestones[]` (w tym milestone-gates)
- `dependencies[]` (do innych initiatives/tasks)

### Execution linkage

- `tasks[]` / task count by status
- `decisions[]` / gate decisions + operational decisions

### Economics & benefits

- `capex/opex`, `roi/npv`, `annualBenefit`
- `baselineKpis[]` + `targets[]` + `measurementCadence`

### Risk management (RAID)

- `raidItems[]` (risk/issue/assumption/dependency; owner; severity; due; status)

### Stakeholders & comms

- `stakeholders[]` (R/A/C/I)
- `watchers[]` (subscribers)
- `commsPlan` (P1: message/cadence/audience/channel)

### Audit

- `history[]` (status change, gate blocks/unblocks, owner changes, schedule/economics changes)

---

## Integracje i reguły systemowe (must-have)

### Task → Initiative

- Task może mieć `initiativeId`
- Task statusy / blokady muszą wpływać na “readiness” inicjatywy (np. “cannot complete if pending tasks” – P0 lite)

### Decision → Initiative

- Decisions w inicjatywie są dwóch typów:
  - **gate decisions**: blokują status
  - **operational decisions**: odblokowują pracę (np. scope change)

### Notification routing (inicjatywa jako hub)

Adresaci wynikają z grafu odpowiedzialności:

- Owners + sponsor + PMO
- Stakeholders (RACI) + watchers
- Decider dla decyzji (Decision Owner)

Każda notyfikacja ma Primary CTA: “Decide”, “Open task”, “Resolve blocker”, “Request decision”.

---

## AI w inicjatywie (KANON)

AI w inicjatywie ma 3 role:

- **Komentator** (sugeruje treści, ryzyka, luki, checklisty)
- **Asystent planowania** (timeline, dependencies, capacity conflicts)
- **Asystent governance** (czy gate readiness spełnione; co brakuje)

Zasada UI: w sekcjach które mają **AI i +New**, przyciski:

- **+New po lewej**
- **AI po prawej**

---

## DoD (Definition of Done) dla Initiative (P0)

- Jest jeden kanoniczny full view (DynamicTabs) + jeden drawer quick review.
- Statusy, widoczność i CTA są spójne z `initiativeStatuses.ts` i `initiativeLifecycle.ts`.
- Gate readiness jest egzekwowane w backendzie i czytelne w UI.
- Initiative ma w jednym miejscu: Tasks + Decisions + Economics + RAID + Stakeholders + History.
- Event-driven notifications działają wg routing rules.
