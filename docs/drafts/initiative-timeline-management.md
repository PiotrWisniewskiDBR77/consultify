# Initiative Timeline Management — Draft v0.1

> **Status:** DRAFT — do dyskusji  
> **Autor:** AI Assistant  
> **Data:** 2026-02-14  
> **Kontekst:** Separacja Gates od Timeline, zarządzanie harmonogramem inicjatywy z zatwierdzaniem na bramce SCHEDULE (krok 6/7)

---

## 1. Problem Statement

Obecny `TimelineSection` to minimalna karta z 4 polami (start, end, duration, quarter). Nie odzwierciedla tego, że harmonogram inicjatywy:

1. **Ewoluuje przez fazy** — od luźnego "target date" w DRAFT, przez szczegółowy plan w PLANNING, do zablokowanego baseline w SCHEDULED
2. **Wymaga zatwierdzenia** — bramka SCHEDULE (Gate 3: `APPROVED → SCHEDULED`) blokuje daty i tworzy baseline
3. **Podlega śledzeniu odchyleń** — w fazie EXECUTING porównujemy planned vs actual
4. **Zawiera milestony** — kamienie milowe to osobne byty powiązane z harmonogramem, nie z bramkami

**Gates ≠ Timeline.** Gates to proces zatwierdzania (kto, kiedy, jakie warunki). Timeline to dane harmonogramowe (kiedy co się zaczyna/kończy, milestony, baseline, odchylenia).

---

## 2. Architektura rozwiązania

### 2.1 Timeline Section — tryby zależne od statusu

Timeline Section zmienia swój wygląd i zachowanie w zależności od fazy inicjatywy:

```
┌─────────────────────────────────────────────────────────┐
│ Status          │ Tryb Timeline     │ Edycja dozwolona  │
├─────────────────┼───────────────────┼───────────────────┤
│ DRAFT           │ ESTIMATE          │ ✅ Target date    │
│ PENDING_REVIEW  │ ESTIMATE          │ 🔒 Locked         │
│ REVIEW          │ ESTIMATE          │ 🔒 Locked         │
│ PROMOTED        │ PLANNING          │ ✅ Full edit       │
│ PLANNING        │ PLANNING          │ ✅ Full edit       │
│ APPROVED        │ READY_TO_LOCK     │ ⚠️ Review only     │
│ SCHEDULED       │ BASELINED         │ 🔒 Locked+Actuals │
│ EXECUTING       │ TRACKING          │ 🔒 Locked+Actuals │
│ BLOCKED         │ TRACKING_BLOCKED  │ ⚠️ Re-plan option  │
│ DONE            │ COMPLETED         │ 🔒 Read-only      │
│ TRACKING        │ COMPLETED         │ 🔒 Read-only      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Relacja z Gates

```
                    Gates (proces)                  Timeline (dane)
                    ─────────────                   ────────────────
PLANNING →          APPROVE gate wymaga             Timeline musi mieć:
APPROVED            "timeline" w requirements       start, end, ≥1 milestone
                    checklist

APPROVED →          SCHEDULE gate wymaga            Timeline staje się BASELINE
SCHEDULED           "timeline" + "capacity" +       - snapshot dat do ScheduleBaseline
                    PMO Schedule Lock Decision      - daty zamrożone
                                                    - aktywacja variance tracking

EXECUTING →         COMPLETE gate wymaga            Timeline śledzi actuals vs plan
DONE                "all_tasks_done"                - actual start/end widoczne
                                                    - variance w dniach
```

---

## 3. UI Design — Timeline Section (rozbudowany)

### 3.1 Tryb ESTIMATE (DRAFT → REVIEW)

Minimalny widok — tylko target date i orientacyjny kwartał.

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Timeline                                        AI  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⓘ Callout: "Orientacyjne daty — szczegółowy plan      │
│     powstanie po promocji do Initiatives"               │
│                                                         │
│  TARGET DATE        ┌─────────────┐                     │
│                     │ dd/mm/yyyy  │                     │
│                     └─────────────┘                     │
│  TARGET QUARTER     Q2 2026                             │
│                                                         │
│  ESTIMATED DURATION                                     │
│  ┌──────────┐  ┌──────────┐                             │
│  │ 3        │  │ months ▾ │                             │
│  └──────────┘  └──────────┘                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Komponenty:** `Callout` (info variant), date picker, duration selector

### 3.2 Tryb PLANNING (PROMOTED → PLANNING)

Pełny edytor harmonogramu z milestones.

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Timeline                              ⚡ AI   Edit  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PLANNED DATES                                          │
│  ┌───────────────────┐    ┌───────────────────┐         │
│  │ Start: 01/04/2026 │ →  │ End: 30/09/2026   │         │
│  └───────────────────┘    └───────────────────┘         │
│  Duration: 183 days  │  Quarter: Q2-Q3 2026             │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  MINI TIMELINE                                          │
│  ╠══════╦═══════════╦══════════════╦════════╣           │
│  Apr    May    Jun       Jul   Aug    Sep               │
│  ▲            ▲                       ▲                 │
│  Start   M1: MVP Ready          M2: Go-Live            │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  MILESTONES                               + Add        │
│  ┌──────────────────────────────────────────────┐       │
│  │ ◇ MVP Ready          │ 15/06/2026 │ Pending │       │
│  │ ◆ UAT Complete        │ 15/08/2026 │ Pending │       │
│  │ ◇ Go-Live             │ 30/09/2026 │ Pending │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  PHASES (optional)                        + Add        │
│  ┌──────────────────────────────────────────────┐       │
│  │ Discovery    │ 01/04 → 30/04  │  30 days    │       │
│  │ Development  │ 01/05 → 31/07  │  92 days    │       │
│  │ Testing      │ 01/08 → 31/08  │  31 days    │       │
│  │ Rollout      │ 01/09 → 30/09  │  30 days    │       │
│  └──────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Nowe sub-sekcje:**

- **Mini Timeline** — wizualizacja Gantt-lite z milestones (komponent `TimelineBar`)
- **Milestones** — `InlineTable` z inline edit
- **Phases** — opcjonalny breakdown na fazy (komponent `InlineTable`)

### 3.3 Tryb READY_TO_LOCK (APPROVED)

Timeline jest w trybie review — PMO widzi podsumowanie do zatwierdzenia.

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Timeline                    🔒 Awaiting Schedule Lock│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️ Callout (warning): "Harmonogram czeka na           │
│     zatwierdzenie PMO (Schedule Lock). Po zatwierdzeniu │
│     daty zostaną zamrożone jako baseline."              │
│                                                         │
│  PLANNED DATES (read-only)                              │
│  Start: 01/04/2026  →  End: 30/09/2026                 │
│  Duration: 183 days  │  Quarter: Q2-Q3 2026             │
│                                                         │
│  MINI TIMELINE (read-only)                              │
│  ╠══════╦═══════════╦══════════════╦════════╣           │
│  Apr    May    Jun       Jul   Aug    Sep               │
│                                                         │
│  MILESTONES (read-only)                                 │
│  ◇ MVP Ready        │ 15/06/2026                        │
│  ◆ UAT Complete      │ 15/08/2026                        │
│  ◇ Go-Live           │ 30/09/2026                        │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  SCHEDULE READINESS CHECK                               │
│  ✅ Start & end dates defined                           │
│  ✅ At least 1 milestone                                │
│  ✅ Dependencies mapped                                 │
│  ⬜ Capacity confirmed → Go to Resources                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Komponent:** `Callout` (warning), read-only fields, `ChecklistBlock` readiness

### 3.4 Tryb BASELINED / TRACKING (SCHEDULED → EXECUTING)

Po zatwierdzeniu Schedule Lock — daty zamrożone, tracking planned vs actual.

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Timeline                   🔒 Baselined v1   14d ◀  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BASELINE vs ACTUAL                                     │
│  ┌─────────────┬──────────────┬──────────────┬────────┐ │
│  │             │ Planned      │ Actual       │ Δ      │ │
│  ├─────────────┼──────────────┼──────────────┼────────┤ │
│  │ Start       │ 01/04/2026   │ 05/04/2026   │ +4d ⚠ │ │
│  │ End         │ 30/09/2026   │ —            │ —      │ │
│  │ Duration    │ 183 days     │ 162d elapsed │        │ │
│  └─────────────┴──────────────┴──────────────┴────────┘ │
│                                                         │
│  TIME PROGRESS                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ██████████████████████░░░░░░░░░░  65%  │ 64d left │ │
│  └────────────────────────────────────────────────────┘ │
│  ▲ Start: 01/04              ▲ Today           End ▲   │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  MILESTONE TRACKING                                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ✅ MVP Ready   │ Plan: 15/06 │ Actual: 12/06  │-3d│ │
│  │ ⏳ UAT Complete │ Plan: 15/08 │ —              │   │ │
│  │ ○  Go-Live      │ Plan: 30/09 │ —              │   │ │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                         │
│  HEALTH INDICATORS                                      │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │ 🟢 SPI │  │ 🟡 Var │  │ 🟢 Mile│  │ 🔴 Risk│       │
│  │ 1.02   │  │ +4 days│  │ 1/3    │  │ 2 open │       │
│  └────────┘  └────────┘  └────────┘  └────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Nowe elementy:**

- **Baseline vs Actual table** — porównanie dat z `ScheduleBaseline`
- **Variance indicators** — odchylenie w dniach z kolorem (zielony/żółty/czerwony)
- **Milestone tracking** — planned date vs actual date per milestone
- **Health indicators** — SPI (Schedule Performance Index), variance, milestones done, open risks

### 3.5 Tryb COMPLETED (DONE → TRACKING)

Read-only podsumowanie wykonania harmonogramu.

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Timeline                              ✅ Completed   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  EXECUTION SUMMARY                                      │
│  ┌─────────────┬──────────────┬──────────────┬────────┐ │
│  │             │ Planned      │ Actual       │ Δ      │ │
│  ├─────────────┼──────────────┼──────────────┼────────┤ │
│  │ Start       │ 01/04/2026   │ 05/04/2026   │ +4d    │ │
│  │ End         │ 30/09/2026   │ 22/09/2026   │ -8d ✅ │ │
│  │ Duration    │ 183 days     │ 170 days     │ -13d   │ │
│  └─────────────┴──────────────┴──────────────┴────────┘ │
│                                                         │
│  MILESTONES (all resolved)                              │
│  ✅ MVP Ready   │ Plan: 15/06 │ Actual: 12/06  │ -3d   │
│  ✅ UAT Complete │ Plan: 15/08 │ Actual: 20/08  │ +5d   │
│  ✅ Go-Live      │ Plan: 30/09 │ Actual: 22/09  │ -8d   │
│                                                         │
│  FINAL HEALTH: 🟢 On-time (8 days early)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Data Model — rozszerzenia

### 4.1 Nowe pola na `FullInitiative`

```typescript
interface FullInitiative {
  // ... existing fields ...

  // Timeline (existing)
  startDate?: string;
  endDate?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string; // from execution_started_at
  actualEndDate?: string;
  milestones?: Milestone[];
  quarter?: Quarter;

  // Timeline (NEW)
  timelineMode?: 'ESTIMATE' | 'PLANNING' | 'READY_TO_LOCK' | 'BASELINED' | 'TRACKING' | 'COMPLETED';
  estimatedDurationMonths?: number; // For ESTIMATE mode (rough)
  plannedPhases?: TimelinePhase[]; // Phase breakdown
  baselineId?: string; // Reference to ScheduleBaseline
  baselineVersion?: number; // Current baseline version
  timelineLocked?: boolean; // True after SCHEDULE gate
  timelineLockedAt?: string; // Timestamp of lock
  timelineLockedBy?: string; // PMO who locked

  // Health tracking (computed, not stored)
  // schedulePerformanceIndex?: number;    // SPI = planned progress / actual elapsed
  // startVarianceDays?: number;
  // endVarianceDays?: number;
}
```

### 4.2 Nowy interface `TimelinePhase`

```typescript
interface TimelinePhase {
  id: string;
  name: string;
  namePl?: string;
  startDate: string;
  endDate: string;
  order: number;
  color?: string; // For mini-timeline visualization
}
```

### 4.3 Rozszerzenie `Milestone`

```typescript
interface Milestone {
  id: string; // NEW: unique identifier
  name: string;
  date: string; // Planned date
  actualDate?: string; // NEW: actual completion date
  status: 'pending' | 'in_progress' | 'completed' | 'missed'; // EXTENDED
  description?: string; // NEW: optional description
  linkedTaskIds?: string[]; // NEW: linked tasks
}
```

### 4.4 Mapping `timelineMode` z `status`

```typescript
function getTimelineMode(status: InitiativeStatus): TimelineMode {
  const modeMap: Record<string, TimelineMode> = {
    DRAFT: 'ESTIMATE',
    PENDING_REVIEW: 'ESTIMATE',
    REVIEW: 'ESTIMATE',
    PROMOTED: 'PLANNING',
    PLANNING: 'PLANNING',
    APPROVED: 'READY_TO_LOCK',
    SCHEDULED: 'BASELINED',
    EXECUTING: 'TRACKING',
    BLOCKED: 'TRACKING', // With re-baseline option
    DONE: 'COMPLETED',
    TRACKING: 'COMPLETED',
    CANCELLED: 'COMPLETED',
  };
  return modeMap[status] || 'ESTIMATE';
}
```

---

## 5. Komponent — architektura

### 5.1 Hierarchia komponentów

```
TimelineSection (kontener — renderuje odpowiedni tryb)
├── TimelineEstimateView       (ESTIMATE mode)
│   └── Callout, DatePicker, DurationSelector
├── TimelinePlanningView       (PLANNING mode)
│   ├── DateRangeEditor
│   ├── TimelineBar            (mini Gantt)
│   ├── MilestoneTable         (InlineTable)
│   └── PhaseTable             (InlineTable, optional)
├── TimelineReadyToLockView    (READY_TO_LOCK mode)
│   ├── Callout (warning)
│   ├── TimelineBar (read-only)
│   ├── MilestoneTable (read-only)
│   └── ScheduleReadinessCheck (ChecklistBlock)
├── TimelineBaselinedView      (BASELINED/TRACKING mode)
│   ├── BaselineVsActualTable
│   ├── TimeProgressBar
│   ├── MilestoneTrackingTable
│   └── HealthIndicators
└── TimelineCompletedView      (COMPLETED mode)
    ├── ExecutionSummaryTable
    ├── MilestoneTrackingTable (all resolved)
    └── FinalHealthBadge
```

### 5.2 Shared sub-components (nowe building blocks)

| Komponent                | Opis                                            | Użycie w                         |
| ------------------------ | ----------------------------------------------- | -------------------------------- |
| `TimelineBar`            | Mini Gantt — horyzontalna oś czasu z milestones | Planning, ReadyToLock, Baselined |
| `BaselineVsActualTable`  | Tabela planned vs actual z variance             | Baselined, Completed             |
| `MilestoneTrackingTable` | Lista milestones z planned/actual dates         | Planning, Baselined, Completed   |
| `HealthIndicators`       | 4 mini-karty: SPI, Variance, Milestones, Risks  | Baselined                        |
| `ScheduleReadinessCheck` | Checklist gotowości do Schedule Lock            | ReadyToLock                      |

### 5.3 Reuse istniejących building blocks

- `Callout` — info/warning komunikaty zależne od trybu
- `InlineTable` — milestones table, phases table
- `ChecklistBlock` — schedule readiness check
- `EmptyStateInline` — "No milestones yet" + CTA

---

## 6. Integracja z Gate workflow

### 6.1 Gate APPROVE — wymaganie "timeline"

Obecne sprawdzenie w `GateReadinessSection`:

```typescript
case 'timeline':
  return !!targetDate;  // ← zbyt uproszczone
```

**Proponowana zmiana:**

```typescript
case 'timeline':
  return !!plannedStartDate
    && !!plannedEndDate
    && milestones.length >= 1;
```

### 6.2 Gate SCHEDULE — nowe wymaganie "schedule_complete"

Dodaj nowe wymaganie do `GATE_CONFIG.SCHEDULE`:

```typescript
SCHEDULE: {
  // ... existing ...
  requirements: ['timeline', 'capacity', 'dependencies', 'schedule_complete'],
}
```

Gdzie:

```typescript
case 'schedule_complete':
  return !!plannedStartDate
    && !!plannedEndDate
    && milestones.length >= 1
    && phases?.length >= 1;   // Co najmniej 1 faza zdefiniowana
```

### 6.3 Efekt Schedule Lock

Po zatwierdzeniu bramki SCHEDULE:

1. Backend tworzy `ScheduleBaseline` z aktualnych dat
2. Ustawia `timelineLocked = true`, `baselineVersion = 1`
3. Timeline Section przełącza się na tryb `BASELINED`
4. Daty stają się read-only (edycja wymaga Re-baseline)

### 6.4 Re-baseline (opcjonalne, v2)

W fazie EXECUTING, jeśli nastąpi duże odchylenie:

1. Owner/PMO może zażądać "Re-baseline"
2. Tworzy nowy `ScheduleBaseline` (version + 1)
3. Wymaga zatwierdzenia Decision
4. Stare i nowe baseline widoczne w historii

---

## 7. AI Integration

### 7.1 Existing AI: `handleGenerateAI('timeline')`

Rozszerzyć prompt AI o:

- Generowanie milestones na podstawie scope i tasks
- Estymacja phases na podstawie complexity
- Sugestia realistic timeline na podstawie team size i dependencies

### 7.2 New AI hints (non-blocking)

```typescript
interface TimelineAIHints {
  suggestedDuration?: string; // "Based on scope, suggest 6 months"
  riskToTimeline?: string; // "3 open risks may delay by 2-4 weeks"
  capacityWarning?: string; // "Team at 120% capacity in July"
  milestoneSpacing?: string; // "Gap between M1 and M2 is too large"
}
```

---

## 8. i18n — nowe klucze

```typescript
const timelineI18n = {
  // Mode labels
  'timeline.mode.estimate': { en: 'Estimate', pl: 'Szacunek' },
  'timeline.mode.planning': { en: 'Planning', pl: 'Planowanie' },
  'timeline.mode.readyToLock': { en: 'Awaiting Schedule Lock', pl: 'Oczekuje na zamrożenie' },
  'timeline.mode.baselined': { en: 'Baselined', pl: 'Zbazlinowany' },
  'timeline.mode.tracking': { en: 'Tracking', pl: 'Śledzenie' },
  'timeline.mode.completed': { en: 'Completed', pl: 'Zakończony' },

  // Section labels
  'timeline.plannedDates': { en: 'Planned Dates', pl: 'Planowane daty' },
  'timeline.actualDates': { en: 'Actual Dates', pl: 'Rzeczywiste daty' },
  'timeline.baseline': { en: 'Baseline', pl: 'Bazowy plan' },
  'timeline.variance': { en: 'Variance', pl: 'Odchylenie' },
  'timeline.milestones': { en: 'Milestones', pl: 'Kamienie milowe' },
  'timeline.phases': { en: 'Phases', pl: 'Fazy' },
  'timeline.duration': { en: 'Duration', pl: 'Czas trwania' },
  'timeline.daysLeft': { en: 'days left', pl: 'dni do końca' },
  'timeline.daysOverdue': { en: 'days overdue', pl: 'dni po terminie' },
  'timeline.progress': { en: 'Time Progress', pl: 'Postęp czasu' },
  'timeline.healthIndicators': { en: 'Health Indicators', pl: 'Wskaźniki zdrowia' },
  'timeline.scheduleReadiness': { en: 'Schedule Readiness', pl: 'Gotowość harmonogramu' },

  // Callout messages
  'timeline.callout.estimate': {
    en: 'Approximate dates — detailed plan will be created after promotion to Initiatives.',
    pl: 'Orientacyjne daty — szczegółowy plan powstanie po promocji do Inicjatyw.',
  },
  'timeline.callout.readyToLock': {
    en: 'Timeline awaiting PMO approval (Schedule Lock). After approval, dates will be frozen as baseline.',
    pl: 'Harmonogram czeka na zatwierdzenie PMO (Schedule Lock). Po zatwierdzeniu daty zostaną zamrożone jako baseline.',
  },
  'timeline.callout.baselined': {
    en: 'Timeline is locked. Dates reflect the approved baseline v{version}.',
    pl: 'Harmonogram zamrożony. Daty odzwierciedlają zatwierdzony baseline v{version}.',
  },

  // Milestone statuses
  'timeline.milestone.pending': { en: 'Pending', pl: 'Oczekujący' },
  'timeline.milestone.inProgress': { en: 'In Progress', pl: 'W toku' },
  'timeline.milestone.completed': { en: 'Completed', pl: 'Ukończony' },
  'timeline.milestone.missed': { en: 'Missed', pl: 'Pominięty' },

  // Health
  'timeline.health.spi': { en: 'SPI', pl: 'WHP' }, // Wskaźnik Harmonogramu Pracy
  'timeline.health.onTime': { en: 'On time', pl: 'W terminie' },
  'timeline.health.atRisk': { en: 'At risk', pl: 'Zagrożony' },
  'timeline.health.delayed': { en: 'Delayed', pl: 'Opóźniony' },
};
```

---

## 9. Implementacja — etapy

### Etap 1: Refaktor TimelineSection (MVP)

- [ ] Dodaj `getTimelineMode()` helper
- [ ] Rozdziel `TimelineSection` na sub-views per tryb
- [ ] Wzbogać ESTIMATE mode o estimated duration
- [ ] Wzbogać PLANNING mode o milestones inline table
- [ ] Dodaj Callout z kontekstem trybu
- [ ] Zachowaj kompatybilność z istniejącymi danymi

### Etap 2: Baseline & Tracking

- [ ] Implementuj `TimelineBaselinedView` z planned vs actual
- [ ] Dodaj `BaselineVsActualTable` sub-component
- [ ] Rozszerz `checkRequirement('timeline')` w Gates
- [ ] Dodaj milestone tracking (actual dates)
- [ ] Dodaj `HealthIndicators` component

### Etap 3: Schedule Lock Integration

- [ ] Rozszerz backend: endpoint tworzący ScheduleBaseline przy SCHEDULE gate
- [ ] Dodaj `timelineLocked` flag na initiative
- [ ] Implementuj `TimelineReadyToLockView` z readiness checklist
- [ ] Integruj z `ScheduleBaseline` model (istniejący w typach)

### Etap 4: Mini Timeline Visualization

- [ ] Implementuj `TimelineBar` — mini Gantt component
- [ ] Dodaj milestones na timeline bar
- [ ] Dodaj phases kolorystykę
- [ ] Responsywność dla wąskich ekranów

### Etap 5: AI & Polish

- [ ] Rozszerz AI generation o milestones suggestion
- [ ] Dodaj AI hints (capacity warning, risk to timeline)
- [ ] Re-baseline flow (v2)
- [ ] Timeline w widoku Roadmap (integration)

---

## 10. Props Contract (TypeScript)

```typescript
/** TimelineSection — main container */
interface TimelineSectionProps extends InitiativeSectionProps {
  // Inherits from InitiativeSectionProps: sectionType, expanded, onToggle, readonly
}

/** Internal: resolved from InitiativeContext */
interface TimelineContextData {
  mode: TimelineMode;

  // Dates
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  targetDate: string | null;

  // Computed
  duration: number | null; // days
  timelineProgress: number; // 0-100
  daysRemaining: number | null;
  isOverdue: boolean;

  // Milestones
  milestones: Milestone[];
  phases: TimelinePhase[];

  // Baseline
  baselineVersion: number | null;
  timelineLocked: boolean;
  startVarianceDays: number | null;
  endVarianceDays: number | null;

  // Health
  schedulePerformanceIndex: number | null;
  milestonesDone: number;
  milestonesTotal: number;

  // Actions
  setStartDate: (date: string | null) => void;
  setEndDate: (date: string | null) => void;
  addMilestone: (milestone: Partial<Milestone>) => void;
  updateMilestone: (id: string, data: Partial<Milestone>) => void;
  removeMilestone: (id: string) => void;
  addPhase: (phase: Partial<TimelinePhase>) => void;
  updatePhase: (id: string, data: Partial<TimelinePhase>) => void;
  removePhase: (id: string) => void;
}

type TimelineMode =
  | 'ESTIMATE'
  | 'PLANNING'
  | 'READY_TO_LOCK'
  | 'BASELINED'
  | 'TRACKING'
  | 'COMPLETED';
```

---

## 11. Podsumowanie decyzji projektowych

| Decyzja                     | Wybór                 | Uzasadnienie                                                                                  |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| Timeline ≠ Gates            | Osobne sekcje         | Gates = proces governance. Timeline = dane harmonogramowe. Jasna separacja odpowiedzialności. |
| Timeline mode = f(status)   | Automatyczny          | Nie wymaga ręcznego przełączania. Tryb wynika z fazy lifecycle.                               |
| Baseline przy SCHEDULE gate | Automatyczny snapshot | Zgodne z istniejącym `ScheduleBaseline` w typach core.ts.                                     |
| Milestones w Timeline       | Inline table          | Zgodne ze standardem `InlineTable` z building-blocks.md.                                      |
| Phases = optional           | Opcjonalne            | Nie każda inicjatywa wymaga podziału na fazy.                                                 |
| Health indicators           | Tylko w TRACKING      | Nie mają sensu przed execution.                                                               |
| Re-baseline                 | v2 feature            | Złożona logika approval, najpierw MVP.                                                        |

---

## 12. Otwarte pytania

1. **Czy phases powinny być odrębnym modelem DB czy polem JSON na initiative?** — Sugestia: JSON array, tak jak milestones.
2. **Czy mini-timeline (Gantt-lite) powinien być osobnym shared blokiem w NModeBlocks?** — Sugestia: Tak, jako `TimelineBar` — może być reużyty w Roadmap view.
3. **Czy chcemy "Schedule Lock Decision" jako osobny typ Decision?** — Istniejący `SCHEDULE_MILESTONES` w `GATE_DEFINITIONS` może wystarczyć.
4. **Jak obsłużyć re-baseline w kontekście historii?** — Czy ScheduleBaseline powinien przechowywać wiele wersji z diffem?
5. **Czy AI powinien proponować milestones automatycznie przy przejściu do PLANNING?** — UX question: proactive vs on-demand.
