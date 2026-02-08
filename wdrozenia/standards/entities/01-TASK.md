<!--
KANON SYSTEMOWY: Task / komunikacja i taskowanie
Ten dokument jest źródłem prawdy dla implementacji Task w My Work / Execution.
-->

## ✅ Standard encji: Task (KANON – komunikacja i taskowanie)

### CEL TASKA (po co istnieje)

Task istnieje po to, aby **przekuć intencję, decyzję lub insight w konkretne działanie**, które:

- ma **jednego właściciela**,
- ma **jasno określony efekt**,
- i da się **rozliczyć**.

Task **nie jest listą zadań**.  
Task jest **najmniejszą jednostką realnej zmiany w organizacji**.

Jeśli coś:

- nie ma właściciela,
- nie ma wpływu,
- nie prowadzi do efektu  
  → **nie powinno być Taskiem**.

✅ Task jest poprawny tylko wtedy, gdy system potrafi odpowiedzieć:  
**„Co się zmieni w organizacji, jeśli ten Task zostanie zamknięty?”**

---

### Rola w systemie

Task to **operacyjny silnik ruchu** (Execution / My Work). Task:

- jest miejscem, gdzie strategia styka się z codzienną pracą,
- może być blokowany przez brak decyzji,
- może generować potrzebę decyzji,
- jest rozliczany przez **efekt**, nie przez „odhaczenie”.

Zasada: **Jeśli Task stoi – organizacja stoi.**

---

### Statusy (kanon minimalny)

> Statusy kanoniczne dla raportowania i UX. Implementacja może mapować na warianty w kodzie.

- `DRAFT`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`
- `CANCELLED` (opcjonalnie)

Wymóg: status musi być **walidowany w backendzie** (transitions) i logowany w audit trail.

---

### Elementy, które muszą być w Tasku (KANON)

#### 1) Tożsamość

- Nazwa (biznesowa, nie techniczna)
- Typ: `analysis | implementation | experiment | escalation`
- Źródło: `report | decision | kpi | ai_insight | manual`
- Powiązanie z inicjatywą / programem

#### 2) Odpowiedzialność i status

- **Jeden właściciel** (`ownerId`) – zawsze ustawiony
- Status (kanon powyżej)
- Priorytet
- Deadline + **aging** (ile czeka; liczone)

#### 3) Kontekst

- Co dokładnie robimy i dlaczego (krótko, konkretnie)
- Scope: co w zakresie / co nie
- Założenia i ograniczenia
- Dane wejściowe / załączniki

#### 4) Plan działania

- Kroki / subtaski
- Zależności
- Możliwość generowania i uzupełniania przez AI (assist, nie zastępstwo)

#### 5) Efekt i rozliczenie

- Oczekiwany efekt (ex ante)
- KPI (link/odniesienie do metryk)
- Rzeczywisty efekt (ex post; wymagane przy DONE)
- Wnioski (lessons learned)

#### 6) Blokady

- Co blokuje Task
- Czy blokada wynika z braku decyzji (wtedy musi być link do Decision)
- Od kiedy jest blokowany (timestamp)

---

### Model danych (minimum – zgodne z kanonem)

- **Identity**: `id`, `title`, `taskIntentType`, `sourceType`, `sourceRef`
- **Workflow**: `status`, `priority`, `dueDate`, `startedAt`, `completedAt`
- **Ownership**: `ownerId` (required), `assigneeId` (optional), `backupAssigneeId` (optional), `createdById`
- **Context**: `initiativeId` (preferred), `projectId` (opcjonalnie), `why`, `scopeIn`, `scopeOut`, `assumptions`, `constraints`
- **Plan**: `steps[]`, `dependencies[]`
- **Outcome**: `expectedOutcome`, `kpiLinks[]`, `actualOutcome`, `lessonsLearned`
- **Blocking**: `blockedSince`, `blockerType`, `blockedByDecisionId` (jeśli dotyczy)
- **Tracking/Audit**: `createdAt`, `updatedAt` + audit trail zmian

---

### Reguły biznesowe (minimum)

- `DONE` wymaga:
  - brak aktywnych blockerów,
  - wypełnionego `actualOutcome` (ex post),
  - oraz (jeśli dotyczy) decision „acceptance”.
- `BLOCKED` wymaga:
  - jawnego powodu,
  - `blockedSince`,
  - oraz jeśli „brak decyzji” → `blockedByDecisionId` lub możliwość utworzenia Decision z prefill.
- Blokada typu „Decision needed” musi być **widoczna w Decision jako „blokuje X tasków”**.

---

### UI/UX (kanon – lekki, ale kompletny)

#### Lista (Tasks)

Domyślne kolumny:

- Task (biznesowa nazwa + typ)
- Owner
- Status
- Priority
- Deadline / Aging (połączone)
- Blocker (np. „Decision: …”)
- Next action (CTA)

#### Detail (Task)

Zasada: **pierwsze na ekranie** są: Owner/Status/Deadline + Effect + Blockers.  
Sekcje (zwijane):

- Context (why, scope in/out, assumptions/constraints)
- Plan (steps/subtasks, dependencies)
- Effect (ex ante/ex post, KPI, wnioski)
- Attachments / Linked items / Comments / History

#### Integracja z Inbox (My Work)

Task w `BLOCKED` albo overdue → generuje **Inbox item** do reakcji, nie tylko powiadomienie.

---

### API (kanon – minimalny zestaw)

- `GET /api/tasks` (filters: `status`, `ownerId`, `assigneeId`, `initiativeId`, `q`, `page`, `pageSize`)
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- Workflow:
  - `PATCH /api/tasks/:id/status` (walidacja + audit + gate decisions jeśli dotyczy)
  - `PATCH /api/tasks/:id/block` / `PATCH /api/tasks/:id/unblock` (jeśli rozdzielamy)

---

### Integracje (must-have)

- **Decisions**:
  - Task może być blokowany przez brak decyzji i musi wtedy wskazywać Decision.
  - Zamknięcie Decision może odblokować Task lub wygenerować taski wdrożeniowe.
- **Reporting**:
  - raporty tygodniowe: DONE / overdue / blocked + aging + “cost of delay” (jeśli dostępny)
  - RAID: taski typu escalation/blocker zasilają Issues
- **Notifications**:
  - notyfikacje nie są feedem – są mechanizmem presji i odpowiedzialności (szczegóły: `06-NOTIFICATION.md`).

---

### DoD (Task)

- Backend: walidacja transitions + audit log + permissions + blokady z linkiem do Decision.
- Frontend: stany loading/error/empty + retry, brak mock fallbacków, kolumny “Blocker/Next action”.
- Testy: min. 1 E2E (create → block by decision → decide → unblock → done z actualOutcome) + test invalid transition.

---

### Historia zmian

- 2026-01-26: utworzono standard Task (kanon minimalny)
- 2026-01-28: zaktualizowano standard Task zgodnie z kanonem „komunikacja i taskowanie”
