# ⚡ Workflow: Execution Flow (Initiative ↔ Task)

## Cel

Opisać przepływ pracy na poziomie realizacji - jak inicjatywa w statusie EXECUTING jest realizowana poprzez taski, oraz jak status tasków wpływa na status inicjatywy.

---

## Architektura

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  INITIATIVE (status: EXECUTING)                                                  │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │  TASKS                                                                       ││
│  │                                                                              ││
│  │  ┌────────┐  ┌─────────────┐  ┌──────────────────┐  ┌────────┐  ┌─────────┐ ││
│  │  │  TODO  │  │ IN_PROGRESS │  │ PENDING_APPROVAL │  │  DONE  │  │ BLOCKED │ ││
│  │  │   3    │  │      2      │  │        1         │  │   5    │  │    1    │ ││
│  │  └────────┘  └─────────────┘  └──────────────────┘  └────────┘  └─────────┘ ││
│  │                                                                              ││
│  │  Progress: 5/12 = 42%                                                        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Relacja Initiative ↔ Task

### Hierarchia

```
Initiative
├── Task 1 (parent)
│   ├── Subtask 1.1
│   ├── Subtask 1.2
│   └── Subtask 1.3
├── Task 2
├── Task 3 (parent)
│   ├── Subtask 3.1
│   └── Subtask 3.2
└── Task 4
```

### Reguły propagacji statusu

| Warunek | Status Initiative |
|---------|-------------------|
| Min. 1 task IN_PROGRESS | EXECUTING |
| Wszystkie aktywne taski BLOCKED | BLOCKED |
| WSZYSTKIE taski DONE lub CANCELLED | Można przejść do DONE |
| Min. 1 task TODO, 0 IN_PROGRESS | EXECUTING (ale wymaga uwagi) |

### Obliczanie progress

```typescript
initiative.progress = (tasks.filter(t => t.status === 'DONE').length / tasks.length) * 100
```

---

## Task Workflow (szczegółowy)

### Statusy

```
┌────────┐
│  TODO  │  Task utworzony, oczekuje na rozpoczęcie
└───┬────┘
    │ START (Assignee)
    ▼
┌─────────────┐         ┌─────────────┐
│ IN_PROGRESS │ ◀──────▶│   BLOCKED   │
└──────┬──────┘ UNBLOCK └─────────────┘
       │
       │ COMPLETE
       ▼
┌──────────────────┐
│ PENDING_APPROVAL │  (jeśli requiresAcceptance = true)
└────────┬─────────┘
         │
   ┌─────┴─────┐
   │           │
   ▼           ▼
APPROVE    REJECT
   │           │
   ▼           ▼
┌────────┐  ┌─────────────┐
│  DONE  │  │ IN_PROGRESS │
└────────┘  └─────────────┘
```

### Mechanizm zatwierdzania (Acceptance)

Taski mogą wymagać zatwierdzenia przed oznaczeniem jako DONE:

| acceptanceType | Kto zatwierdza |
|----------------|----------------|
| `none` | Brak wymagania |
| `reporter` | Osoba zgłaszająca |
| `initiative_owner` | Właściciel inicjatywy |
| `project_manager` | PM projektu |
| `specific_user` | Konkretna osoba |
| `role_based` | Osoba z określoną rolą |

**Kluczowa reguła**: Assignee NIE MOŻE zatwierdzić własnego tasku.

---

## Role w Execution

| Rola | Uprawnienia Task | Uprawnienia Initiative |
|------|------------------|------------------------|
| **Assignee** | START, COMPLETE, BLOCK | - |
| **Reporter** | APPROVE (jeśli acceptanceType=reporter) | - |
| **Initiative Owner** | Wszystkie operacje na taskach | BLOCK, COMPLETE |
| **PMO** | UNBLOCK, CANCEL | UNBLOCK, monitoring |
| **Sponsor** | APPROVE (eskalacje) | UNBLOCK (decyzje biznesowe) |

---

## Scenariusze

### Scenariusz 1: Normalny flow

```
1. Initiative przechodzi do EXECUTING
2. Taski tworzone w statusie TODO
3. Assignee startuje task → IN_PROGRESS
4. Assignee kończy task → PENDING_APPROVAL (lub DONE)
5. Acceptor zatwierdza → DONE
6. Gdy wszystkie taski DONE → Initiative może przejść do DONE
```

### Scenariusz 2: Blokada tasku

```
1. Task w IN_PROGRESS napotyka problem
2. Assignee oznacza jako BLOCKED (z reason)
3. Powiadomienie do Owner + PMO
4. Decision: UNBLOCK (z rozwiązaniem)
5. Task wraca do IN_PROGRESS
```

### Scenariusz 3: Blokada inicjatywy

```
1. Wszystkie aktywne taski są BLOCKED
2. Initiative automatycznie przechodzi do BLOCKED
3. Wymagana decyzja Sponsor/Steering
4. Po UNBLOCK → Initiative wraca do EXECUTING
```

### Scenariusz 4: Odrzucenie tasku

```
1. Assignee kończy task → PENDING_APPROVAL
2. Acceptor przegląda i odrzuca (REJECT)
3. Task wraca do IN_PROGRESS z komentarzem
4. Assignee poprawia i ponownie wysyła
5. Acceptor zatwierdza → DONE
```

---

## Metryki i KPIs

| Metryka | Opis | Cel |
|---------|------|-----|
| **Cycle Time** | Czas od TODO do DONE | Minimalizować |
| **Lead Time** | Czas od utworzenia do DONE | Minimalizować |
| **Blocked Time** | Czas spędzony w BLOCKED | Minimalizować |
| **Approval Time** | Czas w PENDING_APPROVAL | < 24h |
| **First-time Approval Rate** | % tasków zatwierdzonych za pierwszym razem | > 80% |

---

## Powiadomienia

| Zdarzenie | Odbiorcy |
|-----------|----------|
| Task przypisany | Assignee |
| Task do zatwierdzenia | Acceptor |
| Task zatwierdzony | Assignee, Reporter |
| Task odrzucony | Assignee |
| Task zablokowany | Initiative Owner, PMO |
| Task przeterminowany | Assignee, Initiative Owner |
| Initiative zablokowana | PMO, Sponsor |

---

## Powiązane dokumenty

- Task entity: `wdrozenia/standards/entities/01-TASK.md`
- Initiative lifecycle: `wdrozenia/workflows/initiative-lifecycle/00-OVERVIEW.md`
- Decision gates: `wdrozenia/workflows/decision-gates/00-OVERVIEW.md`
- Pełny cykl pracy: `wdrozenia/workflows/00-WORK-LIFECYCLE.md`
