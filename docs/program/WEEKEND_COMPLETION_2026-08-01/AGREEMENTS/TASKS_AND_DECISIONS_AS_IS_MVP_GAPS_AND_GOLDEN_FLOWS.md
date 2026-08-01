---
document_id: TASKS-DECISIONS-AS-IS-MVP-GAPS
module: My Work / Tasks + Decisions
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Tasks + Decisions — AS-IS, luki MVP i odbiór

## 1. Stan udowodniony w repozytorium

| Obszar | Dowód | Ocena |
| --- | --- | --- |
| Tasks views | `MyTasksListContent`, `TasksKanbanBoard`, `TasksCalendarView` | real |
| Task detail | `TaskDetailView`, modal, typed card contract | real/partial |
| Task workflow | `taskWorkflowService` z guardami 8 statusów | real |
| Task services | assignment, advisor, recurrence, section generation | real/partial |
| Decisions views | `DecisionsPanelContent`, Kanban, Timeline | real |
| Decision detail | detail/preview/bottleneck/review next, typed cards | real/partial |
| Decision workflow | `decisionWorkflowService` proposed-review-approve-published | real |
| Decision governance | delegation, escalation, copilot, audit/memory/playbooks | real/partial |
| Tests | component, integration i e2e istnieją | nierówna pełnia golden flow |

`real/partial` oznacza, że kod istnieje, ale nie dowodzi kompletnego, spójnego
przepływu produktowego na świeżych danych i wszystkich rolach.

## 2. Najważniejsze rozjazdy

### P0 — przed stabilnym staging

1. Rozdzielić workflow status decyzji od business outcome i wykonać bezpieczną
   migrację istniejących wartości.
2. Ujednolicić lifecycle Task między listą, Kanbanem, Calendar, detail, API,
   filtrami, licznikami i bulk actions.
3. Udowodnić proposal/confirmation/read-back dla Decision → Task oraz przejść do
   Initiative/Execution; usunąć każdy ukryty downstream write.
4. Zdefiniować i egzekwować readiness/done gates wraz z evidence i wyjątkiem.
5. Domknąć tenant/project ACL, project roles i prawo do approve/delegate/escalate.
6. Zapewnić niezawodny audit log dla zmian ownera, terminu, statusu, approval,
   publikacji, reopen i amendment.
7. Zapewnić notification dedupe, actionable deep links i właściwe read/unread.

### P1 — jakość MVP

1. Wspólne zachowanie filtrów, saved views, selection i powrotu we wszystkich
   trybach widoku.
2. Capacity/overload warnings oparte na projektach, czasie i dostępności.
3. Pełne zależności: blocks/blocked-by/related/duplicate oraz widoczny impact.
4. Recurrence jako template → nowe instancje, bez mutowania historii.
5. Kontrolowany task/decision import i synchronizacja przez connector platform.
6. AI diff, provenance, confidence i quality feedback na wszystkich generacjach.
7. Accessibility, mobile i czytelne stany empty/error/degraded/conflict.

### P2 — po golden flows

- workload forecasting i scenariusze portfela;
- playbooki decyzji i uczenie na outcome bez automatycznego mandatu;
- zaawansowane quorum/conditional approvals;
- mierzenie jakości decyzji post factum i skuteczności estymacji tasków.

## 3. Otwarte rozstrzygnięcia właściciela

| ID | Rekomendacja | Alternatywa |
| --- | --- | --- |
| TD-D1 | domyślny Task = 4 karty rdzenia; AI/picker dodaje pozostałe | wszystkie 10 zawsze widoczne |
| TD-D2 | Task Governance: Teresa asystuje, człowiek zatwierdza | brak AI w governance |
| TD-D3 | Dependencies w Task: AI pisze draft na podstawie danych | wyłącznie karta danych |
| TD-D4 | Implementation/Risk otrzymują backend prompt keys i wspólny audit | pozostają ad-hoc w frontendzie |
| TD-D5 | opublikowana Decision jest wersjonowana; zmiana = amendment | bezpośrednia edycja published |
| TD-D6 | evidence wymagane zależnie od typu/ryzyka taska | evidence wymagane dla każdego taska |

Do czasu decyzji implementacja nie może utrwalić sprzecznego zachowania. Dla
staging rekomendowane są warianty z kolumny „Rekomendacja”.

## 4. Pakiet testów odbiorowych

### GF-TASK-01 — od sygnału do wykonania

Źródło tworzy proposal taska → użytkownik widzi provenance i AI diff → przypisuje
projekt/ownera/termin → readiness gate → wykonanie → blocker → review → evidence
→ done → source read-back. Sprawdzić role, audit, Inbox, Calendar i rollback błędu.

### GF-DEC-01 — od pytania do opublikowanej decyzji

Decision draft → AI dossier → review z odesłaniem → decider wybiera outcome →
approve/publish → propozycje tasków → akceptacja właścicieli → read-back. Wynik i
workflow status muszą pozostać rozdzielone.

### GF-DEC-02 — bottleneck i eskalacja

Decision blokuje task/initiative → SLA mija → decider i project lead dostają
jedno deduplikowane wezwanie → delegacja lub eskalacja → rozstrzygnięcie →
odblokowanie zależności z audytem.

### GF-CHANGE-01 — zmiana decyzji

Amendment opublikowanej decyzji pokazuje zależne taski i impact → approval →
ownerzy przyjmują/odrzucają propozycje zmian → system nie ogłasza sukcesu przed
read-backiem wszystkich wymaganych ownerów.

### GF-VIEW-01 — parytet widoków

Te same filtry i scope w List/Kanban/Calendar lub Timeline; detail zachowuje
powrót; niedozwolony drag jest blokowany i wyjaśniony; bulk pokazuje diff.

## 5. Definition of Done dokumentacji i runtime

Dokumentacyjnie pakiet jest gotowy po zatwierdzeniu TD-D1–TD-D6. Runtime jest
gotowy do odbioru dopiero po zielonym wykonaniu golden flows na świeżej bazie,
dla ownera, członka projektu, reviewera/decidera i użytkownika bez uprawnień,
oraz po potwierdzeniu tenant isolation, retry/idempotency i owner read-back.
