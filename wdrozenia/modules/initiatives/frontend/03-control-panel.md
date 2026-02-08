# Initiatives – Control Panel (KANON, PMO/PMI)

## Cel

`Control Panel` w inicjatywie to **kokpit governance** – nie formularz.
Ma umożliwiać sterowanie lifecycle, bramkami i odpowiedzialnością w sposób zrozumiały dla PMO/PMI:

- **Status + moduł** (gdzie inicjatywa “żyje” w systemie)
- **Gate readiness** (co blokuje następny krok i kto ma zatwierdzić)
- **Szybkie metryki** (tasks/decisions/RAID/economics)
- **Wezwania do osób** (request approval / decision owner / due date)
- **Routing notyfikacji** (RACI + watchers + owners)

Kanon statusów i gates: `wdrozenia/standards/03-STATUS-WORKFLOW.md`

---

## Zasada architektury (status-driven)

Moduł jest wnioskiem ze statusu (nie osobnym “phase” wybieranym ręcznie):

- `DRAFT`, `PENDING_REVIEW` → Tools / Assessment (source)
- `REVIEW`, `PROMOTED`, `PLANNING`, `APPROVED`, `SCHEDULED` → Initiatives
- `EXECUTING`, `BLOCKED`, `DONE` → Execution
- `TRACKING` → Benefits
- `CANCELLED`, `ARCHIVED` → historyczne (Reporting / Initiatives)

W UI Control Panel zawsze pokazuje:

- **Current module** (label + opis + link „Go to”)
- **Current status** (label + opis + dotColor)

Źródło prawdy: `server/src/constants/initiativeStatuses.ts` + `src/services/initiativeLifecycle.ts`

---

## Layout Control Panel (P0)

### 1) Header: Module + Status (zawsze widoczne)

**Sekcja**: “Current Module” + “Status” w jednej ramce.

Wyświetla:

- module chip (Tools/Assessment/Initiatives/Execution/Benefits)
- status chip (np. `PLANNING`)
- krótki opis statusu (“Being planned and scoped”)
- link „Go to →” do właściwego modułu

**Reguła UX**: to jest “prawda ekranu” – user zawsze wie gdzie jest i co oznacza stan.

### 2) Priority + Target Date (quick update)

W P0 Control Panel ma **tylko quick update**:

- `priority`
- `targetDate` (albo plannedEnd/target – zależnie od modelu)

**Nie** dodajemy tu ciężkiej edycji charteru/scope (to ma być po lewej).

### 3) Quick Stats (always-on)

Minimum:

- Tasks: `done/total` + `overdue` badge jeśli istnieje
- Decisions: `approved/total` + `pending/escalated` badge
- RAID: `critical count` (HIGH/CRITICAL)

### 4) Gate alert banner (warunkowo, nad Control Panel)

Jeśli next gate jest blokowany (missing/pending):

- banner “Gate decision required” + lista braków (np. “Go/No-Go missing”)
- CTA: “View / Request decision”

### 5) Approval Workflow (P0)

To jest “mięsień sterowania”:

- pokazuje **pending approvals** (Decision typu gate approval)
- pokazuje **next gate** (np. PROMOTE/APPROVE/SCHEDULE)
- pozwala wysłać **request approval** do właściwej roli (sponsor/committee/pmo/business owner)
- pokazuje wymagania gate’a (checklist)

**Wymóg**: AI może tu pełnić rolę “reviewer” (analiza readiness + braków).

---

## Gate Readiness jako narzędzie (P0)

Gate readiness jest renderowane w dwóch miejscach:

- **Prawa kolumna**: skrót + CTA (Approval Workflow)
- **Lewa kolumna**: “Gate Readiness & Timeline” jako sekcja merytoryczna (szczegóły + timeline)

### Kanoniczne gates (P0)

1. `REVIEW → PROMOTED` (Go/No-Go) – decision domain `GOVERNANCE_DECISION_MAKING`
2. `PROMOTED → PLANNING` (Resources Commit) – domain `RESOURCE_RESPONSIBILITY`
3. `APPROVED → SCHEDULED` (Schedule Lock + dates) – domain `SCHEDULE_MILESTONES` + plannedStart/End wymagane
4. Execution close gates (jeśli są pending) blokują `EXECUTING/BLOCKED → DONE`

**Backend enforcement** (to blokuje realnie):

- `InitiativeController.updateInitiativeStatus` waliduje gates i wysyła `initiative.gate_blocked` przy próbie przejścia

### Stany gate readiness

Każdy gate ma status:

- `MISSING` – nie ma decyzji (lub brak wymaganych pól)
- `PENDING` – decyzja jest, ale nie zatwierdzona
- `APPROVED` – spełnione

### CTA w gate readiness

W P0 CTA musi istnieć zawsze:

- “Request decision / Request approval” (tworzy decision z prefill: owner/due/gateType)
- “View decision” (otwiera DecisionDetailView)

---

## Routing notyfikacji z Control Panel (P0)

Kanon notyfikacji: `wdrozenia/standards/entities/06-NOTIFICATION.md`

### Kto dostaje powiadomienia (inicjatywa jako hub)

Adresaci wynikają z grafu odpowiedzialności:

- Business Owner, Initiative Owner, Sponsor, PMO
- Decision Owner (dla gate/operational decisions)
- Stakeholders (RACI: A/C/I) + watchers/subscribers

### Minimalne eventy (P0)

- `initiative.status_changed`
- `initiative.gate_blocked`
- `initiative.owner_changed`
- `decision.created/updated/overdue/decided` (gdy dotyczy initiative)
- `task.created/blocked/unblocked/overdue/done` (gdy dotyczy initiative)

**Primary CTA** w notyfikacji:

- Decide / Delegate / Escalate (Decision)
- Open task / Resolve blocker (Task)
- Open initiative (gate blocked / status change)

---

## Reguły per status: co Control Panel pokazuje i jakie CTA daje (P0)

> Ten rozdział jest “specyfikacją UX”: co user widzi w Control Panel zależnie od statusu.

### DRAFT / PENDING_REVIEW (Tools/Assessment)

Cel: dopracowanie hipotezy + weryfikacja przez PM/Lead.

CTA:

- `Submit for review` (DRAFT → PENDING_REVIEW)
- `Send back` / `Approve to initiative` (dla roli PM/Lead)

Gate readiness:

- P0: minimalna checklista kompletności (title/description/axis/value hypothesis)

### REVIEW

Cel: biznesowe Go/No-Go.

CTA:

- “Request Go/No-Go decision” (jeśli MISSING)
- “View decision” (jeśli PENDING)
- “Accept (→ PROMOTED)” (tylko jeśli gate APPROVED i rola ma permission)
- “Reject (→ DRAFT)” (tylko jeśli permission)

### PROMOTED

Cel: przygotować do planowania, ale bez pełnego zobowiązania.

CTA:

- “Request Resources Commit decision” (jeśli MISSING/PENDING)
- “Start planning (→ PLANNING)” (jeśli gate APPROVED i permission)

### PLANNING

Cel: plan operacyjny: tasks + timeline + RAID + economics snapshot.

CTA:

- “Request APPROVE decision” (Steering)
- “Approve (→ APPROVED)” (Steering, po spełnieniu artefaktów)

### APPROVED

Cel: formalnie zatwierdzona inicjatywa, trzeba ją zaplanować w roadmapie.

CTA:

- “Request Schedule Lock decision” (PMO)
- “Schedule (→ SCHEDULED)” (tylko jeśli gate APPROVED + daty ustawione)

### SCHEDULED

Cel: inicjatywa w roadmapie, gotowa do startu.

CTA:

- “Start execution (→ EXECUTING)” (PMO albo automatycznie)

### EXECUTING / BLOCKED

Cel: delivery.

CTA:

- “Block” / “Unblock” (role-dependent)
- “Request operational decision” (scope/budget/risk acceptance)
- “Complete (→ DONE)” (jeśli tasks/decisions OK)

### DONE / TRACKING

Cel: potwierdzenie delivery + tracking korzyści.

CTA:

- “Start tracking (→ TRACKING)” (Business Owner)
- “Archive” (po TRACKING lub po CANCELLED) – PMO

### CANCELLED / ARCHIVED

Cel: historyczne.

CTA:

- brak CTA operacyjnych, tylko eksport / podgląd audytu.

---

## AI w Control Panel (P0)

AI w Control Panel działa jako:

- **komentator** (sugeruje “co brakuje do gate” i “co jest ryzykiem”)
- **asystent** (proponuje next steps: tasks/decisions/raid)

Wymagania UX:

- AI nie wykonuje akcji workflow
- AI podpowiada treści, checklisty, ryzyka, komunikaty do stakeholderów
