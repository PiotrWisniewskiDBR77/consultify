# ✅ Standard encji: Decision

## Rola w systemie
Decision to przekrojowy byt „gate / approval”, który:
- **blokuje** przejścia workflow (initiative/task/analysis/assessment/tool),
- ma **owner’a**, **due date** i **impact**,
- generuje **eskalacje** (amber/red),
- jest konsumowany przez **My Work** (Decision Inbox) i **Reporting** (Decisions Required).

## Źródła (dowody)
- Audyt: `wdrozenia/AUDYT_DECISION_MANAGEMENT.md`

## Statusy (kanon, zgodny z audytem)
- `PENDING`
- `APPROVED`
- `REJECTED`
- `ESCALATED` (status; niezależnie od escalation level)

## Escalation level (kanon)
- `none`
- `amber`
- `red`

## Model danych (minimum)
- **Identity**: `id`, `type`, `title`, `description?`
- **Workflow**: `status`, `priority`, `impact`, `dueDate?`, `decidedAt?`
- **Ownership**: `decisionOwnerId`, `requestedById`
- **Context**: `contextType` (`initiative|task|analysis|assessment|tool`), `contextId`
- **Computed**: `daysWaiting`, `isOverdue`, `blockedItemsCount`
- **Escalation**: `escalationLevel`
- **Tracking**: `createdAt`, `updatedAt`

## Reguły biznesowe (minimum)
- Tylko owner (lub rola z permission) może `approve/reject`.
- Eskalacja:
  - `amber/red` wg typu + aging + priorytetu/impactu (reguły progowe).
  - `CRITICAL` lub `HIGH impact` → natychmiastowe `red` (jeśli tak ustalimy jako kanon).
- Decyzje „gate” muszą być sprawdzane przed zmianą statusów Initiative/Task.

## UI/UX (kanon)
- **Decision Inbox**:
  - widoki: My / Awaiting / All
  - filtry: overdue, thisWeek, blocking, critical, high
  - quick actions: approve, reject, escalate
- **Escalation Dashboard**:
  - Red/Amber alerts, blocked items, avg wait time
  - listy: critical decisions, aging, overloaded owners

## API (kanon – minimalny zestaw)
> Nazwy endpointów mogą już istnieć (zgodnie z audytem). Standard opisuje minimum.

- `GET /api/decisions` (filters: `projectId`, `status`, `relatedObjectId`)
- `GET /api/decisions/pending`
- `POST /api/decisions`
- `GET /api/decisions/:id`
- `PUT /api/decisions/:id` (approve/reject/assign)
- `DELETE /api/decisions/:id` (cancel)
- `POST /api/decisions/:id/escalate`
- `GET /api/decisions/:id/history`

## Integracje (must-have)
- **Initiatives**: Go/No-Go, Resources Commit, Schedule Lock (blokady przejść)
- **Execution/Tasks**: blocker resolution, scope change, risk acceptance
- **Reporting**: sekcja „Decisions Required” z overdue + escalated

## DoD (Decision)
- Backend: gate enforcement + escalation logic + audit history + permissions.
- Frontend: inbox + dashboard + quick actions + stany loading/error/empty.
- Testy: min. 1 E2E (create decision → pending → approve) + test escalation.

## Historia zmian
- 2026-01-26: utworzono standard Decision (oparty o audyt)

