# ✅ Standard encji: Task

## Rola w systemie
Task to podstawowa jednostka pracy operacyjnej (Execution / My Work). Task:
- należy do **Initiative** (najczęściej 1..n),
- może generować / wymagać **Decision** (blocker, scope change, acceptance),
- jest źródłem danych do **Reporting** (postęp, RAID, ryzyka, zaległości).

## Statusy (kanon minimalny)
> Docelowo dopasujemy do istniejących statusów w kodzie, ale trzymamy kanon UI/UX + raportowania.

- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`
- `CANCELLED` (opcjonalnie)

## Model danych (minimum)
- **Identity**: `id`, `title`, `description`
- **Workflow**: `status`, `priority`, `dueDate`, `startedAt`, `completedAt`
- **Ownership**: `assigneeId`, `ownerId`, `createdById`
- **Context**: `initiativeId`, (opcjonalnie) `projectId`
- **Tracking**: `createdAt`, `updatedAt`
- **Audit**: powiązanie do audit log (lub osobna tabela logów)

## Reguły biznesowe (minimum)
- `DONE` wymaga: brak otwartych blockerów + (opcjonalnie) decision „acceptance”.
- `BLOCKED` wymaga: reason + (opcjonalnie) decision „blocker resolution”.
- Zmiany statusów muszą być walidowane w backendzie + logowane.

## UI/UX (kanon)
- **List view**: tabela + filtry (status, owner/assignee, dueDate, priority), search.
- **Detail**: drawer lub full view (edytowalne pola, komentarze, historia).
- **Stany**: loading/error/empty z retry (bez mock fallbacków).
- **Powiązania**: widoczna inicjatywa nadrzędna + link do niej.

## API (kanon – minimalny zestaw)
- `GET /api/tasks` (filters: `status`, `assigneeId`, `initiativeId`, `q`, `page`, `pageSize`)
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id` (jeśli dozwolone; w przeciwnym razie soft-delete)
- Workflow:
  - `PATCH /api/tasks/:id/status` (walidacja + audit + gate decisions jeśli dotyczy)

## Integracje
- **Decisions**:
  - Task może wymagać decyzji do przejścia `BLOCKED -> IN_PROGRESS` lub `IN_PROGRESS -> DONE`.
- **Reporting**:
  - raporty tygodniowe: zadania zakończone / zaległe / zablokowane
  - RAID: taski typu issue/blocker mogą zasilać sekcję Issues

## DoD (Task)
- Backend: walidacja status transitions + audit log + permissions.
- Frontend: brak mock fallbacków, stany loading/error/empty, podstawowe filtry.
- Testy: min. 1 test E2E (create → status change → done) + test invalid transition.

## Historia zmian
- 2026-01-26: utworzono standard Task (kanon minimalny)

