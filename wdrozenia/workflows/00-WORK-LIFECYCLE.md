# 🔄 Pełny cykl życia pracy w aplikacji Consultinity

## Cel dokumentu

Ten dokument opisuje **kompletny flow pracy** w aplikacji - od momentu pojawienia się pomysłu na inicjatywę, przez jej planowanie, realizację, aż po śledzenie korzyści. Obejmuje zarówno poziom **Initiative** jak i **Task**.

## Kanon ról i założeń (must-read)
Ten flow zakłada jedno rozumienie ról i delegacji w projektach (nie wszystkie role muszą istnieć w każdym projekcie):
- `wdrozenia/workflows/01-ROLES-AND-ASSUMPTIONS.md`

---

## 📊 Architektura przepływu pracy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CONSULTINITY - WORK LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   DISCOVERY  │    │  INITIATIVES │    │  EXECUTION   │    │   BENEFITS   │   │
│  │              │    │              │    │              │    │              │   │
│  │  Tools       │───▶│  Planning    │───▶│  Tasks       │───▶│  Tracking    │   │
│  │  Assessment  │    │  Approval    │    │  Delivery    │    │  KPIs        │   │
│  │  Interview   │    │  Scheduling  │    │  Monitoring  │    │  ROI         │   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                                                  │
│  FAZA 1              FAZA 2              FAZA 3              FAZA 4             │
│  Odkrywanie          Planowanie          Realizacja          Korzyści           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 FAZA 1: Odkrywanie (Discovery)

### Moduły źródłowe

| Moduł | Opis | Wynik |
|-------|------|-------|
| **Tools** | Narzędzia analityczne (SWOT, Porter, Growth Paths, etc.) | Inicjatywy z analizy |
| **Assessment** | Oceny dojrzałości (DRD, SIRI, ADMA, CMMI, LEAN) | Inicjatywy z oceny |
| **Interview** | Wywiady z interesariuszami | Inicjatywy z wywiadów |

### Przepływ w Fazie 1

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FAZA 1: DISCOVERY                                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐                                                                │
│  │   DRAFT     │  Consultant tworzy/edytuje inicjatywę                          │
│  │  (Autor)    │  • Tytuł, opis, oś strategiczna                                │
│  └──────┬──────┘  • Wstępna hipoteza wartości                                   │
│         │                                                                        │
│         │ SUBMIT_FOR_REVIEW (Consultant)                                         │
│         │ Wymagania: tytuł, opis min. 50 znaków, oś                             │
│         ▼                                                                        │
│  ┌─────────────────┐                                                            │
│  │ PENDING_REVIEW  │  PM/Lead weryfikuje jakość                                 │
│  │   (PM/Lead)     │  • Kompletność danych                                      │
│  └────────┬────────┘  • Sensowność biznesowa                                    │
│           │           • Zgodność z celami projektu                              │
│           │                                                                      │
│     ┌─────┴─────┐                                                               │
│     │           │                                                               │
│     ▼           ▼                                                               │
│  APPROVE    SEND_BACK                                                           │
│  (→ FAZA 2)  (→ DRAFT)                                                          │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Role w Fazie 1

| Rola | Uprawnienia |
|------|-------------|
| **Consultant** | Tworzy, edytuje DRAFT, wysyła do review |
| **Project Manager / Lead** | Przegląda, zatwierdza lub odsyła |

> Jeśli projekt nie ma osobnej roli reviewer/PMO, odbiór jakości pełni Project Manager (delegacje w `01-ROLES-AND-ASSUMPTIONS.md`).

---

## 📋 FAZA 2: Planowanie i zatwierdzanie (Initiatives)

### Przepływ w Fazie 2

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FAZA 2: INITIATIVES (Planowanie i zatwierdzanie)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐                                                                │
│  │   REVIEW    │  Przegląd biznesowy (Go/No-Go)                                 │
│  │ (Go/No-Go)  │  • Zgodność strategiczna                                       │
│  └──────┬──────┘  • Wstępna ocena ROI                                           │
│         │         • Identyfikacja ryzyk                                         │
│         │                                                                        │
│    ┌────┴────┐                                                                  │
│    │         │                                                                  │
│    ▼         ▼                                                                  │
│  ACCEPT   REJECT                                                                │
│    │      (→ DRAFT)                                                             │
│    ▼                                                                            │
│  ┌─────────────┐                                                                │
│  │  PROMOTED   │  Uznana za wartą planowania                                    │
│  └──────┬──────┘  • Wstępna struktura tasków                                    │
│         │         • Wstępna ekonomika                                           │
│         │                                                                        │
│         │ START_PLANNING (PMO)                                                  │
│         ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │  PLANNING   │  Planowanie operacyjne                                         │
│  └──────┬──────┘  • Szczegółowe taski                                           │
│         │         • Timeline / roadmap                                          │
│         │         • Economic Analysis                                           │
│         │         • Przypisanie zespołu                                         │
│         │                                                                        │
│         │ APPROVE (Steering Committee)                                          │
│         ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │  APPROVED   │  Zaakceptowana strategicznie i finansowo                       │
│  └──────┬──────┘  • Zatwierdzona ekonomika                                      │
│         │         • Zatwierdzony scope                                          │
│         │         • Zatwierdzony owner                                          │
│         │                                                                        │
│         │ SCHEDULE (PMO)                                                        │
│         ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │  SCHEDULED  │  Przypisana do harmonogramu                                    │
│  └─────────────┘  • Daty start/koniec                                           │
│                   • Baseline timeline                                           │
│                   → Przejście do FAZA 3                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Role w Fazie 2

| Rola | Uprawnienia |
|------|-------------|
| **Project Sponsor** | ACCEPT / REJECT w REVIEW |
| **Steering Committee** | APPROVE w PLANNING (eskalacje) |
| **PMO** | START_PLANNING, SCHEDULE |
| **Initiative Owner** | Edycja, uzupełnianie danych |

### Artefakty wymagane

| Status | Wymagane artefakty |
|--------|-------------------|
| REVIEW | Opis, Owner, Wstępny scope, Risk flags (min. 1) |
| PLANNING | Taski, Timeline, Economic Analysis |
| APPROVED | Zatwierdzona ekonomika, scope, owner |
| SCHEDULED | Timeline baseline, Taski z datami |

---

## ⚡ FAZA 3: Realizacja (Execution)

### Przepływ w Fazie 3

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FAZA 3: EXECUTION (Realizacja)                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐         ┌─────────────┐                                        │
│  │  EXECUTING  │ ◀──────▶│   BLOCKED   │                                        │
│  └──────┬──────┘ UNBLOCK └──────┬──────┘                                        │
│         │                       │                                               │
│         │                       │ CANCEL                                        │
│         │                       ▼                                               │
│         │                ┌─────────────┐                                        │
│         │                │  CANCELLED  │                                        │
│         │                └─────────────┘                                        │
│         │                                                                        │
│         │ COMPLETE (wszystkie taski DONE)                                       │
│         ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │    DONE     │  Delivery zakończone                                           │
│  └─────────────┘  → Przejście do FAZA 4                                         │
│                                                                                  │
│  ═══════════════════════════════════════════════════════════════════════════    │
│                                                                                  │
│  POZIOM TASKÓW (wewnątrz EXECUTING):                                            │
│                                                                                  │
│  ┌────────┐                                                                     │
│  │  TODO  │  Task utworzony, oczekuje na rozpoczęcie                            │
│  └───┬────┘                                                                     │
│      │ START                                                                    │
│      ▼                                                                          │
│  ┌─────────────┐         ┌─────────────┐                                        │
│  │ IN_PROGRESS │ ◀──────▶│   BLOCKED   │                                        │
│  └──────┬──────┘ UNBLOCK └─────────────┘                                        │
│         │                                                                        │
│         │ COMPLETE                                                              │
│         ▼                                                                        │
│  ┌──────────────────┐                                                           │
│  │ PENDING_APPROVAL │  (jeśli requiresAcceptance = true)                        │
│  └────────┬─────────┘                                                           │
│           │                                                                      │
│     ┌─────┴─────┐                                                               │
│     │           │                                                               │
│     ▼           ▼                                                               │
│  APPROVE    REJECT / CHANGES_REQUESTED                                          │
│     │           │                                                               │
│     ▼           ▼                                                               │
│  ┌────────┐  ┌─────────────┐                                                    │
│  │  DONE  │  │ IN_PROGRESS │ (poprawki)                                         │
│  └────────┘  └─────────────┘                                                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Role w Fazie 3

| Rola | Uprawnienia |
|------|-------------|
| **Initiative Owner** | Zarządzanie taskami, BLOCK, COMPLETE |
| **Team Member** | Wykonywanie tasków, aktualizacja statusu |
| **PMO** | Monitoring, eskalacje, UNBLOCK |
| **Project Sponsor** | UNBLOCK (decyzje biznesowe) |

### Mechanizm zatwierdzania Tasków

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  TASK ACCEPTANCE WORKFLOW                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Konfiguracja przy tworzeniu tasku:                                             │
│                                                                                  │
│  requiresAcceptance: boolean        // Czy wymaga zatwierdzenia                 │
│  acceptanceType:                    // Kto zatwierdza                           │
│    - 'none'                         // Brak wymagania                           │
│    - 'reporter'                     // Osoba zgłaszająca                        │
│    - 'initiative_owner'             // Właściciel inicjatywy                    │
│    - 'project_manager'              // PM projektu                              │
│    - 'specific_user'                // Konkretna osoba (acceptorId)             │
│    - 'role_based'                   // Dowolna osoba z określoną rolą           │
│                                                                                  │
│  Reguły:                                                                        │
│  1. Assignee NIE MOŻE sam zatwierdzić swojego tasku                             │
│  2. Każda decyzja zapisywana w acceptanceHistory                                │
│  3. Reject/Changes = powrót do IN_PROGRESS                                      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📈 FAZA 4: Śledzenie korzyści (Benefits)

### Przepływ w Fazie 4

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  FAZA 4: BENEFITS (Śledzenie korzyści)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────┐                                                                │
│  │  TRACKING   │  Śledzenie efektów biznesowych                                 │
│  └─────────────┘                                                                │
│                                                                                  │
│  Artefakty:                                                                     │
│  • Benefits Records - zapis osiągniętych korzyści                               │
│  • KPI baseline + target - metryki przed/po                                     │
│  • ROI calculation - obliczenie zwrotu z inwestycji                             │
│  • Lessons learned - wnioski na przyszłość                                      │
│                                                                                  │
│  Zakończenie:                                                                   │
│  • Decyzja Business Ownera o zamknięciu trackingu                               │
│  • Lub automatycznie po upływie zdefiniowanego okresu                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Role w Fazie 4

| Rola | Uprawnienia |
|------|-------------|
| **Business Owner** | Wprowadzanie danych, zamknięcie trackingu |
| **PMO** | Monitoring, raportowanie |

---

## 🔗 Integracja między poziomami

### Initiative ↔ Task

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  RELACJA INITIATIVE - TASK                                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  INITIATIVE (status: EXECUTING)                                                 │
│  ├── Task 1 (status: DONE)                                                      │
│  ├── Task 2 (status: IN_PROGRESS)                                               │
│  ├── Task 3 (status: PENDING_APPROVAL)                                          │
│  ├── Task 4 (status: TODO)                                                      │
│  └── Task 5 (status: BLOCKED)                                                   │
│                                                                                  │
│  Reguły:                                                                        │
│  • Initiative EXECUTING → gdy min. 1 task IN_PROGRESS                           │
│  • Initiative BLOCKED → gdy wszystkie aktywne taski BLOCKED                     │
│  • Initiative DONE → gdy WSZYSTKIE taski DONE lub CANCELLED                     │
│                                                                                  │
│  Progress:                                                                       │
│  • initiative.progress = (tasks.DONE / tasks.total) * 100                       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Decision Points

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DECISION POINTS (Punkty decyzyjne)                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Na poziomie INITIATIVE:                                                        │
│  • REVIEW → PROMOTED (Go/No-Go decision)                                        │
│  • PLANNING → APPROVED (Budget/Scope approval)                                  │
│  • BLOCKED → EXECUTING (Unblock decision)                                       │
│  • DONE → TRACKING (Benefits tracking decision)                                 │
│                                                                                  │
│  Na poziomie TASK:                                                              │
│  • BLOCKED → IN_PROGRESS (Blocker resolution)                                   │
│  • PENDING_APPROVAL → DONE (Acceptance decision)                                │
│  • Scope change (Change request)                                                │
│                                                                                  │
│  Każda decyzja:                                                                 │
│  • Zapisywana w tabeli decisions                                                │
│  • Powiązana z initiative_id lub task_id                                        │
│  • Zawiera: decision_type, outcome, rationale, decided_by, decided_at           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 👥 Matryca ról i uprawnień

### Poziom Initiative

| Akcja | Consultant | PM/Lead | Initiative Owner | PMO | Sponsor | Steering |
|-------|:----------:|:-------:|:----------------:|:---:|:-------:|:--------:|
| Create DRAFT | ✅ | ✅ | - | - | - | - |
| Edit DRAFT | ✅ | ✅ | - | - | - | - |
| SUBMIT_FOR_REVIEW | ✅ | - | - | - | - | - |
| SEND_BACK | - | ✅ | - | ✅ | - | - |
| APPROVE_TO_INITIATIVE | - | ✅ | - | ✅ | - | - |
| ACCEPT/REJECT | - | - | - | - | ✅ | ✅ |
| START_PLANNING | - | - | - | ✅ | - | - |
| APPROVE | - | - | - | - | - | ✅ |
| SCHEDULE | - | - | - | ✅ | - | - |
| START | - | - | - | ✅ | - | - |
| BLOCK/UNBLOCK | - | - | ✅ | ✅ | ✅ | ✅ |
| COMPLETE | - | - | ✅ | ✅ | - | - |
| START_TRACKING | - | - | - | - | ✅* | - |
| CANCEL | - | - | - | ✅ | - | ✅ |

*Business Owner

### Poziom Task

| Akcja | Assignee | Reporter | Initiative Owner | PM | PMO |
|-------|:--------:|:--------:|:----------------:|:--:|:---:|
| Create Task | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Task | ✅ | ✅ | ✅ | ✅ | ✅ |
| START (TODO→IN_PROGRESS) | ✅ | - | ✅ | - | - |
| COMPLETE (→PENDING_APPROVAL) | ✅ | - | - | - | - |
| APPROVE Task | - | ✅* | ✅* | ✅* | - |
| REJECT Task | - | ✅* | ✅* | ✅* | - |
| BLOCK | ✅ | - | ✅ | ✅ | ✅ |
| UNBLOCK | - | - | ✅ | ✅ | ✅ |

*Zależnie od acceptanceType

---

## 📊 Widoczność w modułach UI

| Moduł | Initiative Statuses | Task Statuses | Główne role |
|-------|---------------------|---------------|-------------|
| **Tools** | DRAFT, PENDING_REVIEW | - | Consultant, PM |
| **Assessment** | DRAFT, PENDING_REVIEW | - | Consultant, PM |
| **Interview** | DRAFT, PENDING_REVIEW | - | Consultant, PM |
| **Initiatives** | REVIEW → SCHEDULED | TODO (planning) | PMO, Sponsor, Steering |
| **Execution** | EXECUTING, BLOCKED, DONE | Wszystkie | Owner, Team, PMO |
| **My Work** | (własne) | (przypisane) | Wszyscy |
| **Benefits** | TRACKING | - | Business Owner, PMO |
| **Reports** | Wszystkie (read-only) | Wszystkie (read-only) | Wszyscy |

---

## 🔔 Powiadomienia

### Na poziomie Initiative

| Zdarzenie | Odbiorcy |
|-----------|----------|
| Nowa inicjatywa do review | PM/Lead |
| Inicjatywa zatwierdzona do Initiatives | Initiative Owner, PMO |
| Inicjatywa odrzucona | Autor (Consultant) |
| Inicjatywa wymaga decyzji | Sponsor / Steering |
| Inicjatywa zablokowana | PMO, Sponsor |
| Inicjatywa ukończona | Business Owner, PMO |

### Na poziomie Task

| Zdarzenie | Odbiorcy |
|-----------|----------|
| Task przypisany | Assignee |
| Task wymaga zatwierdzenia | Acceptor |
| Task zatwierdzony | Assignee, Reporter |
| Task odrzucony | Assignee |
| Task zablokowany | Initiative Owner, PMO |
| Task przeterminowany | Assignee, Initiative Owner |

---

## 📁 Powiązane dokumenty

- Status Workflow: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- Encja Task: `wdrozenia/standards/entities/01-TASK.md`
- Encja Decision: `wdrozenia/standards/entities/02-DECISION.md`
- Tool Report (Tools): `wdrozenia/standards/entities/04-TOOL-REPORT.md`
- Assessment Report: `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md`
- Role i uprawnienia: `wdrozenia/standards/07-ROLES-PERMISSIONS.md`
- API Contracts: `wdrozenia/standards/04-API-CONTRACTS.md`

---

## Historia zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-27 | Utworzenie dokumentu - pełny cykl życia pracy | Agent |
