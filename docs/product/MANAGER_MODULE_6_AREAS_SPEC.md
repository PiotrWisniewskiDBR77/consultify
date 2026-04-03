# Manager Module — 6 Areas Specification

> **Status:** Active SSOT  
> **Parent:** `EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`  
> **UI Pattern:** Table + Preview Pane (Outlook-style) per `table-preview-pane-standard.md`  
> **Data source:** Control Tower queues + lane heuristics + DB tables (initiatives, tasks, decisions, raid_items)

---

## Wspólny wzorzec UX (dotyczy wszystkich 6 areas)

### Layout

Po wyborze kafelka (np. "Action Queue") otwiera się **dynamic tab** w module hub z:

1. **Table (lewa strona, flex-1)** — lista problemów/pozycji
2. **Preview pane (prawa, ~420px)** — podgląd wybranego problemu

### Tabela — kolumny wspólne

| # | Kolumna | Opis |
|---|---------|------|
| 1 | **Severity** | Dot/badge: `critical` (red), `warning` (amber), `info` (blue) |
| 2 | **Problem** | Tytuł problemu (1 linia, truncate) |
| 3 | **Source entity** | Chip: Initiative / Task / Decision / RAID — z nazwą i linkiem |
| 4 | **Root cause** | Krótki opis przyczyny (z `why.detail` lub heuristic insight) |
| 5 | **Impact** | Ile downstream entities jest zagrożonych (z `affectsNext`) |
| 6 | **Days overdue** | Liczba dni przekroczenia (lub "due in X d" dla at-risk) |
| 7 | **Owner** | Assignee/decision-maker avatar + name |
| 8 | **Actions** | Kebab menu (⋮) |

### Kolorowanie wierszy

| Severity | Left border | Row bg (hover) |
|----------|-------------|---------------|
| `critical` | `border-l-4 border-rose-500` | `hover:bg-rose-500/5` |
| `warning` | `border-l-4 border-amber-500` | `hover:bg-amber-500/5` |
| `info` | `border-l-4 border-blue-500` | `hover:bg-blue-500/5` |

### Preview Pane — anatomia

**Header (sticky):**
- Kicker: "Problem Preview"
- Tytuł problemu
- Severity badge
- `Open full` + `Close (X)`

**Body (scroll):**
- **Source entity card** — kliknięty link do Initiative/Task/Decision z pełnym statusem, progress, dates
- **Root cause** — pełny opis z heuristic `why.detail`
- **Downstream impact** — lista `affectsNext` entities (chips z linkami)
- **Timeline** — kiedy problem powstał, ile dni trwa, trend (rising/stable/falling)
- **Related items** — powiązane RAID items, decisions, dependencies

**Footer (sticky):**
- **Quick actions** (zależne od kontekstu):
  - `Replan` — zmień daty/scope
  - `Reassign` — przypisz innego ownera
  - `Escalate` — utwórz eskalację / decision request
  - `Dismiss` — odrzuć signal (z powodem)
  - `AI Zarządzaj` — wygeneruj plan zarządzania

---

## 1. Action Queue

### Co to jest
Kolejka interwencyjna: wszystko, co wymaga **natychmiastowej reakcji managera**. Agreguje najważniejsze problemy z pozostałych 5 areas.

### Pozycje w tabeli (źródło danych)

| Typ pozycji | Źródło DB | Warunek kwalifikacji | Severity |
|------------|-----------|---------------------|----------|
| **Overdue task** | `tasks` WHERE `due_date < NOW()` AND status NOT IN (done, cancelled) | `due_date` w przeszłości, task nie zamknięty | `critical` jeśli >7d overdue, `warning` jeśli 1-7d |
| **Blocked task** | `tasks` WHERE `status = 'blocked'` | Task w statusie blocked | `critical` |
| **Overdue decision** | `decisions` WHERE `deadline < NOW()` AND `status = 'PENDING'` | Decision z przekroczonym deadline | `critical` |
| **High-risk RAID** | `raid_items` WHERE `risk_score >= 15` AND `status = 'OPEN'` | Otwarty risk/issue z krytycznym score | `critical` jeśli score ≥ 18, `warning` jeśli 15-17 |
| **Stale item** | Control Tower `stale` queue | Entity bez update ≥ 14 dni | `warning` |
| **Unassigned task** | `tasks` WHERE `assignee_id IS NULL` AND status active | Task bez właściciela | `warning` |
| **Task without due date** | `tasks` WHERE `due_date IS NULL` AND status active | Task bez terminu | `info` |

### Kolumny specyficzne

| Kolumna | Opis |
|---------|------|
| **Type** | Badge: `Overdue Task`, `Blocked`, `Decision`, `Risk`, `Stale`, `Unassigned` |
| **Queue** | Z którego Control Tower queue pochodzi: late / blocked / at_risk / stale |

### Akcje w preview footer

| Akcja | Kiedy widoczna | Efekt |
|-------|---------------|-------|
| `Replan` | Overdue task/initiative | Otwiera dialog zmiany due_date |
| `Reassign` | Unassigned lub overloaded | Otwiera picker ownera |
| `Escalate` | Blocked / overdue decision | Tworzy eskalację lub podnosi priorytet decision |
| `Set due date` | Task without due date | Otwiera date picker |
| `Open entity` | Zawsze | Nawigacja do Initiative/Task/Decision w N-mode |

### Czym zarządzamy
- **Priorytetyzacja** — manager decyduje, co zrobić jako pierwsze
- **Triage** — każdy problem wymaga jednej z akcji: replan, reassign, escalate, dismiss
- **Tracking** — ile pozycji jest w kolejce, trend (rośnie/maleje)

---

## 2. Decisions & Approvals

### Co to jest
Centrum decyzyjne: wszystkie decisions wymagające zatwierdzenia, eskalacji lub informacji.

### Pozycje w tabeli (źródło danych)

| Typ pozycji | Źródło DB | Warunek | Severity |
|------------|-----------|---------|----------|
| **Overdue pending decision** | `decisions` WHERE `status = 'PENDING'` AND `deadline < NOW()` | Przekroczony deadline | `critical` |
| **Pending decision (due soon)** | `decisions` WHERE `status = 'PENDING'` AND `deadline` within 7 days | Zbliżający się deadline | `warning` |
| **Pending decision (no deadline)** | `decisions` WHERE `status = 'PENDING'` AND `deadline IS NULL` | Brak deadline = brak governance | `info` |
| **Decision without maker** | `decisions` WHERE `decision_maker_id IS NULL` AND `status = 'PENDING'` | Nikto nie jest odpowiedzialny | `warning` |
| **Deferred decision** | `decisions` WHERE `status = 'DEFERRED'` | Odłożona — wymaga re-evaluation | `info` |

### Kolumny specyficzne

| Kolumna | Opis |
|---------|------|
| **Status** | Badge: `PENDING` (amber), `APPROVED` (green), `DEFERRED` (gray), `REJECTED` (red) |
| **Decision maker** | Avatar + name osoby odpowiedzialnej |
| **Linked initiative** | Chip z nazwą initiative (kliknięty = nawigacja) |
| **Deadline** | Data + "X days overdue" w red lub "in X days" |
| **Blocking** | Ile tasków/initiatives jest zablokowanych przez tę decyzję |

### Preview — dodatkowe sekcje

- **Options** — jakie opcje decyzji są dostępne (z `decisions.options`)
- **Criteria** — kryteria decyzji (z `decisions.criteria`)
- **Blocked downstream** — lista tasks/initiatives czekających na tę decyzję

### Akcje w preview footer

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| `Approve` | Status PENDING | Zmienia status na APPROVED |
| `Reject` | Status PENDING | Zmienia na REJECTED z wymaganym rationale |
| `Defer` | Status PENDING | Zmienia na DEFERRED z nową datą review |
| `Escalate` | Overdue | Podnosi escalation_level, notyfikacja do sponsora |
| `Assign maker` | Brak decision_maker | Otwiera picker osoby |
| `Set deadline` | Brak deadline | Date picker |
| `Request info` | Zawsze | Tworzy komentarz/request do decision ownera |

### Czym zarządzamy
- **Przepustowość decyzyjna** — ile decisions przechodzi/tydzień
- **Decision latency** — średni czas od utworzenia do rozstrzygnięcia
- **Bottleneck detection** — czy jeden decision_maker blokuje wiele decisions

---

## 3. Blockers & Escalations

### Co to jest
Centrum zarządzania blokadami: co stoi, dlaczego stoi, i jak odblokować.

### Pozycje w tabeli (źródło danych)

| Typ pozycji | Źródło DB | Warunek | Severity |
|------------|-----------|---------|----------|
| **Blocked initiative** | `initiatives` WHERE `status = 'BLOCKED'` | Initiative w statusie BLOCKED | `critical` |
| **Blocked task** | `tasks` WHERE `status = 'blocked'` | Task w statusie blocked | `critical` jeśli overdue, `warning` inaczej |
| **Dependency blocker** | `initiative_dependencies` + `task_dependencies` | Predecessor nie ukończony, successor czeka | `warning` |
| **Decision-blocked** | `tasks` WHERE `blocked_by_decision_id IS NOT NULL` | Task czeka na decision | `critical` jeśli decision overdue |
| **Critical RAID issue** | `raid_items` WHERE `type = 'ISSUE'` AND `status = 'OPEN'` | Otwarty Issue (nie Risk, nie Assumption) | `critical` |
| **Escalated item** | `decisions` WHERE `escalation_level > 0` OR `raid_items` WHERE eskalowane | Element z podniesionym poziomem eskalacji | `critical` |

### Kolumny specyficzne

| Kolumna | Opis |
|---------|------|
| **Block type** | Badge: `Status Blocked`, `Dependency`, `Decision Pending`, `Issue`, `Escalated` |
| **Blocked since** | Data od kiedy item jest zablokowany |
| **Blocking entity** | Co blokuje: predecessor initiative/task, decision, issue — chip z linkiem |
| **Cascade count** | Ile downstream entities jest dotknięte (z `affectsNext`) |

### Preview — dodatkowe sekcje

- **Blocker chain** — wizualizacja łańcucha: [blocking entity] → [blocked entity] → [downstream affected]
- **Resolution options** — sugestie: workaround, escalation, scope change, reassignment
- **History** — kiedy status zmienił się na blocked, poprzednie statusy

### Akcje w preview footer

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| `Unblock` | Status blocked | Dialog: podaj resolution, zmień status na active/in_progress |
| `Escalate` | Dependency/decision block | Tworzy formal escalation, notyfikacja |
| `Create workaround` | Dependency block | Tworzy nowy task jako workaround, linkuje |
| `Reassign blocker` | Blocking entity ma ownera | Zmiana ownera blocking entity |
| `Scope reduction` | Long-standing block | Dialog propozycji scope cut z rationale |

### Czym zarządzamy
- **Czas blokady** — ile dni element jest zablokowany
- **Kaskada** — ile downstream items jest zagrożone przez jeden blocker
- **Resolution rate** — ile blokad rozwiązujemy/tydzień
- **Root cause pattern** — czy blokady to dependencies, decisions, czy issues

---

## 4. Resource & Workload

### Co to jest
Dashboard obciążenia zespołu: kto jest przeciążony, kto ma wolne zasoby, gdzie brakuje assignees.

### Pozycje w tabeli (źródło danych)

> **Uwaga:** Ten widok ma **dwa tryby** (toggle w topbar):
> - **By person** — grupowanie po assignee
> - **By problem** — płaska lista problemów workload

#### Tryb "By person" (domyślny)

| Kolumna | Opis |
|---------|------|
| **Person** | Avatar + name |
| **Active tasks** | Liczba tasków in_progress + todo |
| **Overdue** | Liczba overdue tasków (red jeśli >0) |
| **Estimated hours** | Suma estimated_hours otwartych tasków |
| **Due this week** | Ile tasków ma due_date w tym tygodniu |
| **Initiatives** | Ile różnych initiatives pokrywa |
| **Load status** | Badge: `Overloaded` (>10 tasks, red), `Balanced` (4-10, green), `Underloaded` (<4, blue), `Idle` (0, gray) |

Kliknięcie osoby w preview pokazuje listę jej tasków z due dates i statusami.

#### Tryb "By problem" (płaska lista)

| Typ pozycji | Źródło | Warunek | Severity |
|------------|--------|---------|----------|
| **Overloaded person** | `tasks` GROUP BY assignee HAVING count > 10 | Osoba z >10 aktywnych tasków | `critical` jeśli >15, `warning` jeśli 10-15 |
| **Unassigned task** | `tasks` WHERE `assignee_id IS NULL` | Task bez ownera | `warning` |
| **Task without estimate** | `tasks` WHERE `estimated_hours IS NULL` | Brak wyceny pracochłonności | `info` |
| **Overdue task (workload)** | `tasks` WHERE `due_date < NOW()` AND status active | Overdue = workload mismatch | `critical` |
| **Due soon (≤3 days)** | `tasks` WHERE `due_date` within 3 days | Wymaga uwagi w tym tygodniu | `warning` |

### Preview (tryb "By person")

**Header:** Person name, role, avatar  
**Body:**
- **Task breakdown** — mini-table: task name, initiative, due_date, status, estimated_hours
- **Initiative spread** — w ilu initiatives uczestniczy
- **Workload trend** — czy obciążenie rośnie/maleje (last 2 weeks)

**Footer:**
- `Reassign tasks` — bulk-reassign selected tasks do innej osoby
- `Smooth schedule` — AI-assisted redistribution propozycja
- `Set capacity` — ustaw max tasks/hours per week

### Preview (tryb "By problem")

Standardowy preview z source entity, root cause, quick actions.

### Czym zarządzamy
- **Balance** — równomierność obciążenia zespołu
- **Capacity planning** — czy mamy zasoby na nowe zadania
- **Risk mitigation** — identyfikacja bus factor (jedna osoba = wiele inicjatyw)
- **Forecast accuracy** — % tasków z estimated_hours

---

## 5. Execution Risk

### Co to jest
Radar ryzyk i opóźnień: co zagraża dostarczeniu, jakie są sygnały wczesnego ostrzegania.

### Pozycje w tabeli (źródło danych)

| Typ pozycji | Źródło | Warunek | Severity |
|------------|--------|---------|----------|
| **Critical risk** | `raid_items` WHERE `type = 'RISK'` AND `risk_score >= 15` | Wysoki risk score | `critical` |
| **High risk** | `raid_items` WHERE `type = 'RISK'` AND `risk_score 10-14` | Podwyższone ryzyko | `warning` |
| **Delay signal (OVERDUE)** | Delay detection service | Task/initiative overdue | `critical` |
| **Delay signal (LATE_FINISH_RISK)** | Delay detection service | Forecast: prawdopodobne opóźnienie | `warning` |
| **Delay signal (LATE_START)** | Delay detection service | Nie rozpoczęto mimo passed planned_start | `warning` |
| **Missing baseline** | `initiatives` WHERE `planned_start_date IS NULL` OR `planned_end_date IS NULL` | Brak baseline = brak kontroli | `info` |
| **Dependency risk** | `raid_items` WHERE `type = 'DEPENDENCY'` AND `status = 'OPEN'` | Otwarta zależność | `warning` |
| **Budget overspend** | Budget service signals | Przekroczenie budżetu | `critical` jeśli >15%, `warning` jeśli 5-15% |

### Kolumny specyficzne

| Kolumna | Opis |
|---------|------|
| **Risk type** | Badge: `Risk`, `Delay`, `Dependency`, `Budget`, `Missing baseline` |
| **Probability** | `LOW` / `MEDIUM` / `HIGH` (z raid_items) lub computed |
| **Impact** | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| **Risk score** | Liczbowy score (0-25) z color gradient |
| **Mitigation** | Czy jest mitigation plan (checkmark / missing) |
| **Mitigation owner** | Kto jest odpowiedzialny za mitygację |

### Preview — dodatkowe sekcje

- **Risk matrix** — pozycja na matrycy probability × impact (mini vizualization)
- **Mitigation plan** — pełny tekst planu mitygacji (edytowalny)
- **Related signals** — inne risk/delay signals dotyczące tego samego entity
- **Historical trend** — jak risk_score zmieniał się w czasie

### Akcje w preview footer

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| `Create mitigation` | Brak mitigation_plan | Otwiera editor planu |
| `Assign mitigation owner` | Brak mitigation_owner | Picker osoby |
| `Escalate risk` | Critical risk bez mitigation | Formal escalation do leadership |
| `Set baseline` | Missing baseline | Date pickers dla planned_start/end |
| `Mark mitigated` | Ma mitigation plan | Zmienia status na MITIGATED |
| `Dismiss signal` | Delay/risk signal | Dismiss z powodem (soft delete) |

### Czym zarządzamy
- **Risk posture** — overall delivery confidence score (computed %)
- **Mitigation coverage** — % risks z aktywnym mitigation plan
- **Signal freshness** — czy reagujemy na nowe sygnały
- **Baseline completeness** — % initiatives z pełnym baseline

---

## 6. People & Change

### Co to jest
Zarządzanie ludźmi i zmianą: ownership gaps, stakeholder coverage, adopcja, komunikacja.

### Pozycje w tabeli (źródło danych)

| Typ pozycji | Źródło | Warunek | Severity |
|------------|--------|---------|----------|
| **Initiative without owner** | `initiatives` WHERE `owner_execution_id IS NULL` AND status active | Brak execution ownera | `critical` |
| **Initiative without sponsor** | `initiatives` WHERE `sponsor_id IS NULL` AND status active | Brak sponsora | `warning` |
| **Initiative without dates** | `initiatives` WHERE `planned_start_date IS NULL` OR `planned_end_date IS NULL` | Brak ram czasowych | `warning` |
| **Tasks without assignee** | `tasks` WHERE `assignee_id IS NULL` AND status active | Unassigned task | `warning` |
| **Single point of failure** | `initiatives` GROUP BY `owner_execution_id` HAVING count > 3 | Jedna osoba = >3 initiatives | `warning` |
| **Low ownership clarity** | Computed: % initiatives with owner < 60% | Systemowy problem governance | `critical` jeśli <40%, `warning` jeśli 40-60% |
| **Stale initiative** | `initiatives` WHERE `updated_at` < NOW() - 14 days AND status active | Brak aktywności = brak ownership | `info` |

### Kolumny specyficzne

| Kolumna | Opis |
|---------|------|
| **Gap type** | Badge: `No Owner`, `No Sponsor`, `No Dates`, `Unassigned`, `Bus Factor`, `Stale` |
| **Entity** | Initiative/Task name z linkiem |
| **Current owner** | Avatar + name (lub "—" jeśli brak) |
| **Team coverage** | Ile osób jest zaangażowanych w tę initiative |
| **Last activity** | Data ostatniego update |

### Preview — dodatkowe sekcje

- **Ownership map** — kto jest owner_business, owner_execution, sponsor
- **Team members** — lista osób przypisanych do tasków tej initiative
- **Stakeholder gaps** — brakujące role (RACI-style)
- **Activity log** — ostatnie zmiany statusów, assignees

### Akcje w preview footer

| Akcja | Kiedy | Efekt |
|-------|-------|-------|
| `Assign owner` | No owner | Picker: owner_execution_id |
| `Assign sponsor` | No sponsor | Picker: sponsor_id |
| `Set dates` | No dates | Date pickers |
| `Distribute work` | Bus factor / overloaded owner | Propozycja redistrybucji |
| `Send nudge` | Stale initiative | Notification do ownera |
| `Create RACI` | Systemowy gap | Generuje RACI matrix draft |

### Czym zarządzamy
- **Ownership coverage** — % initiatives z przypisanym ownerem
- **Governance completeness** — % z pełnym zestawem (owner + sponsor + dates)
- **Bus factor** — max initiatives per person
- **Engagement** — frequency of updates (proxy for adoption)

---

## Priorytet implementacji

| Faza | Area | Uzasadnienie |
|------|------|-------------|
| 1 | **Action Queue** | Agreguje najważniejsze; daje natychmiastową wartość |
| 1 | **Blockers & Escalations** | Kluczowe dla delivery — odblokowanie = postęp |
| 2 | **Decisions & Approvals** | Governance bottleneck detection |
| 2 | **Execution Risk** | Proactive risk management |
| 3 | **Resource & Workload** | Capacity balancing |
| 3 | **People & Change** | Organizational health |

---

## Wspólny model danych (TypeScript)

```typescript
interface ManagerProblemRow {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  problemType: string;
  sourceEntityType: 'INITIATIVE' | 'TASK' | 'DECISION' | 'RAID_ITEM';
  sourceEntityId: string;
  sourceEntityName: string;
  rootCause: string;
  impactCount: number;
  daysOverdue: number | null;
  ownerId: string | null;
  ownerName: string | null;
  queueOrigin: 'late' | 'at_risk' | 'blocked' | 'overloaded' | 'stale' | 'heuristic';
  createdAt: string;
  relatedEntityIds: string[];
}
```

---

## Referencje

- `docs/ui-standards/03-modules/app-table-standard.md`
- `docs/ui-standards/03-modules/table-preview-pane-standard.md`
- `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
- `src/components/shared/TableWithPreviewLayout.tsx`
- `src/components/Execution/Manager/types.ts`
- `server/src/services/v8/laneHeuristics/types.ts`
