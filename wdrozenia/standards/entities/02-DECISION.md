<!--
KANON SYSTEMOWY: Decision / komunikacja i taskowanie
Ten dokument jest źródłem prawdy dla implementacji Decision w My Work / całym systemie.
-->

## ✅ Standard encji: Decision (KANON – komunikacja i taskowanie)

### CEL DECYZJI

Decyzja istnieje po to, aby:

- **odblokować działania**,
- **zakończyć niepewność**,
- **przenieść odpowiedzialność** z zespołu na decydenta.

Decyzja nie służy do dyskusji. Służy do **zatrzymania chaosu i ruszenia systemu dalej**.  
Brak decyzji = **ukryta decyzja bez właściciela**.

---

### Rola w systemie

Decision jest:

- formalnym punktem odpowiedzialności,
- jedynym legalnym mechanizmem zdejmowania blokad,
- mostem między analizą a działaniem.

Zasada integracyjna:

- Task może żyć bez decyzji,
- ale **blokada Taska wynikająca z braku decyzji zawsze musi prowadzić do Decision**,
- system musi jasno pokazywać: **„ten brak decyzji blokuje realne działania”**.

---

### Źródła (dowody)

- Audyt: `wdrozenia/AUDYT_DECISION_MANAGEMENT.md`

---

### Statusy (kanon)

> Kanon musi mapować na statusy w kodzie i UI.

- `PROPOSED` / `PENDING` (mapowanie dopuszczalne)
- `APPROVED`
- `REJECTED`
- `IMPLEMENTED` (stan “po wdrożeniu”; może być jawny lub liczony z tasków)
- `ESCALATED` (status; niezależnie od escalation level)

### Escalation level (kanon)

- `none`
- `amber`
- `red`

---

### Elementy, które muszą być w Decision (KANON)

#### 1) Tożsamość decyzji

- Tytuł (forma: „Decydujemy, że…”)
- Typ: strategiczna / operacyjna / finansowa / technologiczna
- Zakres: zespół / zakład / firma
- Decydent (1 osoba)
- Status (kanon powyżej)

#### 2) Kontekst decyzyjny

- Co wywołało decyzję (trigger: Task/KPI/Insight/Report)
- Jaki problem rozwiązuje
- Dlaczego teraz
- Cele biznesowe

#### 3) Opcje decyzyjne

- Opcja A – status quo
- Opcja B – rekomendowana
- Opcja C – alternatywa
  Dla każdej: wpływ, koszt, czas, ryzyka

#### 4) Rekomendacja

- Co rekomendujemy i dlaczego
- Co odrzucamy
- Na jakich założeniach się opieramy

#### 5) Konsekwencje braku decyzji (KLUCZOWE)

- Co jest blokowane (taski, inicjatywy, KPI)
- Koszt braku decyzji (czas / pieniądz / ryzyko)
- Efekt domina
- Punkt krytyczny (od kiedy opóźnienie boli bardziej)

#### 6) Akt decyzji

- Decyzja: tak / nie / warunkowo
- Data
- Warunki (jeśli warunkowo)
- Formalne „zamknięcie niepewności”

#### 7) Przekucie w działanie

- Automatyczne tworzenie tasków
- Odblokowanie istniejących
- Ustawienie KPI monitorujących decyzję

---

### Model danych (minimum)

- **Identity**: `id`, `type`, `decisionStatement`, `title`, `description?`
- **Workflow**: `status`, `priority`, `impact`, `dueDate?`, `criticalAt?`, `decidedAt?`
- **Ownership**: `deciderId` (required), `backupDeciderId?`, `requestedById`
- **Context**: `contextType` (`initiative|task|analysis|assessment|tool`), `contextId`, `whyNow?`, `businessGoals?`
- **Options**: `options[]`, `recommendedOptionId?`, `assumptions?`, `rationale?`, `conditions?`
- **Consequences**: `blockedItems[]`, `costOfDelay?`, `dominoSummary?`
- **Computed**: `daysWaiting`, `isOverdue`, `blockedItemsCount`
- **Escalation**: `escalationLevel`, `escalationChain?`, `escalationLog?`
- **Delegation/Handoff**: delegations log + comments (audit)
- **Tracking**: `createdAt`, `updatedAt`

---

### Reguły biznesowe (minimum)

- Tylko decider (lub rola z permission) może `approve/reject/conditional`.
- Eskalacja:
  - `amber/red` wg typu + aging + priorytetu/impactu (reguły progowe),
  - brak reakcji → eskalacja wg łańcucha eskalacji,
  - decyzja = “cisza” (zamykanie presji notyfikacyjnej).
- Decyzje „gate” muszą być sprawdzane przed zmianą statusów Initiative/Task, jeśli Decision jest wymagane.

---

### UI/UX (kanon – lekki, ale kompletny)

#### Decision List (My Work → Decisions)

Kolumny minimalne:

- Decision statement / title
- Decider
- Status
- Deadline / Critical point (połączone)
- “Blocks X” (liczba blokowanych)
- Next action (CTA: Decide / Delegate / Escalate)

#### Decision Detail

Tryby prezentacji (KANON):

- `D` (D presentation mode: obecny Golden Standard 2/3 + 1/3)
- `N` (N presentation mode: nawigacja + treść strony + properties)
- `C` (C presentation mode: action-first: command bar + taby)

Źródło prawdy: `docs/ui-standards/detail-view-presentation-modes.md`.

Zasada: sekcja **„Konsekwencje braku decyzji”** jest zawsze widoczna (nie chowana na końcu).
Mechaniki:

- Delegacja / przekazanie (z komentarzem i audit trail)
- Eskalacja (łańcuch + log)
- “Create tasks on decision” / “Unblock tasks”

---

### API (kanon – minimalny zestaw)

> Nazwy endpointów mogą już istnieć. Standard opisuje minimum.

- `GET /api/decisions` (filters: `projectId`, `status`, `relatedObjectId`)
- `GET /api/decisions/pending`
- `POST /api/decisions`
- `GET /api/decisions/:id`
- `PUT /api/decisions/:id` (approve/reject/assign)
- `DELETE /api/decisions/:id` (cancel)
- `POST /api/decisions/:id/escalate` (manual)
- `GET /api/decisions/:id/history`
- Delegacje/Stakeholders/Eskalacja: zgodnie z API kontraktem modułu My Work/Decisions

---

### Integracje (must-have)

- **Tasks**: blokady i odblokowania, “blocked by decision”, auto-tasking po decyzji
- **Initiatives**: Go/No-Go, Resources Commit, Schedule Lock
- **Reporting**: sekcja „Decisions Required” z overdue + escalated + “blocks”
- **Notifications**: notyfikacje jako presja (szczegóły: `06-NOTIFICATION.md`)

---

### DoD (Decision)

- Backend: gate enforcement + escalation logic + audit history + permissions + konsekwencje braku decyzji.
- Frontend: inbox/list/detail + quick actions + stany loading/error/empty.
- Testy: min. 1 E2E (create decision → blocks tasks → decide → unblocks/creates tasks) + test escalation.

---

### Historia zmian

- 2026-01-26: utworzono standard Decision (oparty o audyt)
- 2026-01-28: zaktualizowano standard Decision zgodnie z kanonem „komunikacja i taskowanie”
