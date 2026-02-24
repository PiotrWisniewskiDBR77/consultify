# My Work Module — Complete Specification

> **Status:** ACTIVE  
> **Last updated:** 2026-02-24  
> **Modules:** Executive, Inbox, Focus, Tasks, Decisions, Notebook, Ideas  
> **Architecture:** `docs/architecture/MYWORK_ARCHITECTURE.md`

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [Notebook — Living Knowledge Engine](#notebook---living-knowledge-engine)
3. [Tasks — Zarządzanie zadaniami](#tasks---zarządzanie-zadaniami)
4. [Decisions — Zarządzanie decyzjami](#decisions---zarządzanie-decyzjami)
5. [Notifications — System powiadomień](#notifications---system-powiadomień)
6. [Wspólne standardy UI/UX](#wspólne-standardy-uiux)
7. [AI Chat Integration](#ai-chat-integration)
8. [Offline Support](#offline-support)
9. [Focus — Personal Kanban + AI Coach](#focus--personal-kanban--ai-coach)
10. [Ideas — Idea Garden & Mind Map](#ideas--idea-garden--mind-map)
11. [Executive Dashboard](#executive-dashboard)
12. [Inbox — Triage Center](#inbox--triage-center)
13. [Cross-Tab EventBus](#cross-tab-eventbus)
14. [Origin Tracking](#origin-tracking)
15. [Shared Components](#shared-components-new)
16. [Changelog](#changelog)
17. [Source Files](#source-files)

---

## Module Overview

### Purpose

My Work is the user's personal operational hub. It unifies all work items — tasks, decisions, ideas, notes, and notifications — into a single integrated workflow with AI assistance at every step.

### Design Principles

- **Cross-tab synergy** — Tabs share state via an EventBus (Zustand slice). A change in one tab (e.g., completing a task in Focus) triggers refresh in all related tabs (Tasks, Executive).
- **Origin tracking** — Every artifact knows where it came from. Tasks created from Ideas or Notebook pages carry `source_type` / `source_id` fields so the user can always navigate back.
- **AI-first** — Each tab has a dedicated AI persona (system prompt). The chat panel knows the user's current workload and can create artifacts directly.
- **Proactive, not reactive** — Morning briefings, nudge strips, predictive signals, and smart note routing surface insights before the user asks.

### Architecture Overview

```
My Work
├── Executive (Admin/Manager only) — KPI dashboard, work patterns, team performance
├── Inbox — Triage incoming items, AI auto-triage, bulk actions
├── Focus — Today/This Week/Later kanban, AI Coach, Plan My Day, Nudge Strip
├── Tasks — List/Kanban/Calendar views, focus badges, triage badges, origin badges
├── Decisions — List/Kanban views, review-next flow, AI decision briefs
├── Notebook — TipTap editor, slash commands, KnowledgePulse, smart routing
└── Ideas — Garden/List/Cards/MindMap views, promote flow, AI evaluation
```

### Layout (Golden Standard)

All detail views use `NModeLayout` with:

- **NModeHeader** — gradient header, Save + Chat buttons, locked state support
- **NModeCanvas** — main content area with collapsible sections
- **NModePropertiesStrip** — metadata sidebar
- **Shared sections** — Comments, Activity, Attachments, Related Context, AI Connections

---

## Notebook - Living Knowledge Engine

Notebook w My Work to **warstwa wiedzy**, a nie “miejsce na luźne notatki”. Jego celem jest przechwytywanie i rozwijanie ważnych wątków strategicznych i operacyjnych, które **jeszcze nie mają wdrażalnego aspektu**, ale będą wpływać na przyszłe decyzje i działania.

- **Dlaczego**: najcenniejsza wiedza powstaje „przed wdrożeniem” — jako hipotezy, obserwacje, sygnały, ryzyka, wnioski z analiz i rozmów.
- **Outcome**: użytkownik ma poczucie, że notatki **żyją** — system podpowiada je w odpowiednim kontekście pracy i pomaga łączyć je z treściami w Consultify.
- **Zasada produktu**: system ma być proaktywny, ale nie agresywny — podpowiada i wzbogaca, nie nadpisuje treści użytkownika.

Dokument produktu (cel i sens modułu): `docs/modules/LIVING_NOTEBOOK_MODULE.md`

---

## Tasks - Zarządzanie zadaniami

### Plik źródłowy

`src/components/MyWork/TaskDetailView.tsx`

### Statusy zadań

| Status        | Label PL     | Label EN    | Kolor       | Ikona        |
| ------------- | ------------ | ----------- | ----------- | ------------ |
| `todo`        | Do zrobienia | To Do       | slate-400   | CheckSquare  |
| `in_progress` | W trakcie    | In Progress | blue-500    | Clock        |
| `review`      | Przegląd     | Review      | purple-500  | Edit3        |
| `done`        | Ukończone    | Done        | emerald-500 | CheckCircle2 |
| `blocked`     | Zablokowane  | Blocked     | red-500     | AlertCircle  |

### Priorytety

| Priorytet  | Label PL  | Label EN | Kolor      |
| ---------- | --------- | -------- | ---------- |
| `low`      | Niski     | Low      | slate-400  |
| `medium`   | Średni    | Medium   | blue-400   |
| `high`     | Wysoki    | High     | orange-400 |
| `critical` | Krytyczny | Critical | red-500    |

### Sekcje w lewej kolumnie

#### 1. Task Description

- Pole tekstowe z opisem zadania
- Placeholder: "Describe the task..."

#### 2. Expected Outcome

- Oczekiwany rezultat zadania
- Pole tekstowe

#### 3. Comments (Collapsible)

- Lista komentarzy z możliwością odpowiedzi
- Lajkowanie komentarzy
- Licznik przy nagłówku

#### 4. Risk Analysis (Collapsible)

- Lista ryzyk z macierzą probability/impact
- Kategorie: technical, business, operational, financial, legal
- AI Generate button
- Mitigation i contingency plans

#### 5. Alternatives (Collapsible)

- Alternatywne podejścia do realizacji
- Pros/Cons dla każdej alternatywy
- Możliwość oznaczenia jako recommended
- AI Generate button

#### 6. Implementation Ideas (Collapsible)

- Pomysły na realizację zadania
- Głosowanie na pomysły
- Status: idea → considered → selected → rejected
- Źródło: manual / ai / team

#### 7. Checklist (Collapsible)

- Interaktywna lista kontrolna
- Progress bar w nagłówku
- Dodawanie/usuwanie elementów
- Checkbox dla każdego elementu

#### 8. Tags (Collapsible)

- Kolorowe tagi
- Dodawanie/usuwanie tagów

### Sekcje w prawej kolumnie

#### 1. Deadline Alert Banner

- Wyświetla się gdy task jest przeterminowany
- Czerwony alert z liczbą dni spóźnienia

#### 2. Action Buttons (Header)

| Przycisk | Kolor ramki   | Kolor tekstu | Funkcja                       |
| -------- | ------------- | ------------ | ----------------------------- |
| Save     | blue-500/40   | blue-700     | Zapisuje task + draft offline |
| Chat     | purple-500/40 | purple-700   | Otwiera AI chat z kontekstem  |

#### 3. Control Panel (Collapsible)

- **Badge** `#task-XXX` - po prawej stronie nagłówka
- **Initiative** - dropdown z dostępnymi inicjatywami
- **Status** - dropdown ze statusami
- **Priority** - dropdown z priorytetami
- **Owner** - wybór właściciela
- **Assignee** - wybór wykonawcy
- **Due Date** - data terminu
- **Start Date** - data rozpoczęcia
- **Blocked Reason** - tylko gdy status = blocked

#### 4. AI Insights (Collapsible)

- Wskazówki wygenerowane przez AI
- Typy: recommendation, warning, prediction, optimization
- Wskaźnik pewności (low/medium/high)
- Akcje: Apply, Dismiss

#### 5. Dependencies (Collapsible)

- Sekcja "Blokuje" - taski blokowane przez ten task
- Sekcja "Blokowane przez" - taski blokujące ten task
- Warning gdy blokowane przez nieukończone taski

#### 6. Stakeholders (RACI) (Collapsible)

- Role: Responsible, Accountable, Consulted, Informed
- Ustawienia powiadomień per stakeholder

#### 7. Reminders & Escalation (Collapsible)

- Przypomnienia przed/po terminie
- Reguły eskalacji
- Progi czasowe

#### 8. Attachments (Collapsible)

- Upload plików
- Podgląd miniatur
- Download/Delete

#### 9. Linked Items (Collapsible)

- Powiązania z innymi elementami
- Typy: task, decision, risk, issue, document, external
- Relacje: blocks, blocked_by, relates_to, duplicates, parent, child

#### 10. Evidence & Acceptance (Collapsible)

- Wymagane typy dowodów: DOCUMENT, DATA, DEMO, APPROVAL
- Lista załączonych dowodów z weryfikacją
- Toggle "Wymaga akceptacji"
- Wybór akceptującego

#### 11. Strategic Contribution (Collapsible)

- PROCESS_CHANGE - Zmiana procesu
- BEHAVIOR_CHANGE - Zmiana zachowania
- CAPABILITY_CHANGE - Zmiana zdolności

### Workflow zadania

```
┌──────┐     ┌─────────────┐     ┌────────┐     ┌──────┐
│ Todo │────▶│ In Progress │────▶│ Review │────▶│ Done │
└──┬───┘     └──────┬──────┘     └────┬───┘     └──────┘
   │                │                 │
   │                ▼                 │
   │          ┌─────────┐             │
   └─────────▶│ Blocked │◀────────────┘
              └─────────┘
```

---

## Decisions - Zarządzanie decyzjami

### Plik źródłowy

`src/components/MyWork/DecisionDetailView.tsx`

### Statusy decyzji

| Status      | Label PL     | Label EN  | Kolor       |
| ----------- | ------------ | --------- | ----------- |
| `pending`   | Oczekująca   | Pending   | amber-500   |
| `approved`  | Zatwierdzona | Approved  | emerald-500 |
| `rejected`  | Odrzucona    | Rejected  | red-500     |
| `deferred`  | Odroczona    | Deferred  | slate-500   |
| `escalated` | Eskalowana   | Escalated | orange-500  |

### Kategorie decyzji

| Kategoria             | Label PL            | Label EN            |
| --------------------- | ------------------- | ------------------- |
| `scope_change`        | Zmiana zakresu      | Scope Change        |
| `budget_change`       | Zmiana budżetu      | Budget Change       |
| `schedule_change`     | Zmiana harmonogramu | Schedule Change     |
| `resource_allocation` | Alokacja zasobów    | Resource Allocation |
| `risk_response`       | Odpowiedź na ryzyko | Risk Response       |
| `technical`           | Techniczna          | Technical           |
| `strategic`           | Strategiczna        | Strategic           |

### Sekcje w lewej kolumnie

#### 1. Problem Description / Context

- Opis problemu wymagającego decyzji
- Kontekst sytuacyjny

#### 2. Comments (Collapsible)

- Dyskusja nad decyzją
- Odpowiedzi i lajki

#### 3. Risk Analysis (Collapsible)

- Ryzyka związane z decyzją
- Macierz probability/impact
- AI Generate

#### 4. Alternatives (Collapsible)

- Alternatywne opcje decyzyjne
- Pros/Cons
- Impact Score (scope, schedule, cost, quality)
- Confidence level
- AI Generate

### Sekcje w prawej kolumnie

#### 1. Deadline Alert Banner

- Alert o przeterminowanej decyzji

#### 2. Action Buttons

| Przycisk     | Kolor   | Warunek          |
| ------------ | ------- | ---------------- |
| Approve      | emerald | status = pending |
| Reject       | red     | status = pending |
| Request Info | slate   | status = pending |
| Delegate     | slate   | status = pending |
| Save         | purple  | zawsze           |

#### 3. Control Panel (Collapsible)

- Initiative
- Status
- Priority
- Category
- Due Date
- Requested by (read-only)
- Decider (editable)

#### 4. Stakeholders (RACI)

- Interesariusze z rolami RACI
- Ustawienia powiadomień

#### 5. Reminders & Escalation

- Przypomnienia
- Reguły eskalacji

#### 6. Attachments

- Dokumenty wspierające decyzję

#### 7. Linked Items

- Powiązane taski, ryzyka, dokumenty

### Workflow decyzji

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│ Pending │────▶│ Approved │     │ Rejected │
└────┬────┘     └──────────┘     └──────────┘
     │                ▲                ▲
     │                │                │
     ▼                │                │
┌──────────┐          │                │
│ Deferred │──────────┴────────────────┘
└────┬─────┘
     │
     ▼
┌───────────┐
│ Escalated │
└───────────┘
```

---

## Notifications - System powiadomień

### Plik źródłowy

`src/components/MyWork/NotificationDetailView.tsx`

### Cel notyfikacji (Kanon)

Notyfikacje istnieją po to, aby:

- **Zapobiegać bezruchowi** w organizacji
- **Eskalować brak decyzji**
- **Utrzymywać napięcie decyzyjne**
- **Sterować zachowaniem organizacji**

> ⚠️ Notyfikacje NIE służą do informowania. Służą do **wymuszania działań**.

### Poziomy ważności (Severity)

| Severity   | Label PL    | Label EN | Kolor     | Znaczenie                      |
| ---------- | ----------- | -------- | --------- | ------------------------------ |
| `INFO`     | Informacja  | Info     | blue-500  | Informacyjne                   |
| `WARNING`  | Ostrzeżenie | Warning  | amber-500 | Wymaga uwagi                   |
| `CRITICAL` | Krytyczne   | Critical | red-500   | Wymaga natychmiastowej reakcji |

### Kategorie notyfikacji

| Kategoria    | Opis                         |
| ------------ | ---------------------------- |
| `ai`         | Rekomendacje i alerty AI     |
| `task`       | Powiadomienia o zadaniach    |
| `decision`   | Powiadomienia o decyzjach    |
| `system`     | Alerty systemowe             |
| `project`    | Powiadomienia projektowe     |
| `initiative` | Powiadomienia o inicjatywach |

### Typy notyfikacji

| Typ                    | Ikona         | Kolor   | Opis                    |
| ---------------------- | ------------- | ------- | ----------------------- |
| `TASK_ASSIGNED`        | CheckSquare   | blue    | Przypisano zadanie      |
| `TASK_OVERDUE`         | Clock         | red     | Zadanie przeterminowane |
| `TASK_BLOCKED`         | AlertCircle   | red     | Zadanie zablokowane     |
| `DECISION_REQUIRED`    | Scale         | purple  | Wymagana decyzja        |
| `DECISION_OVERDUE`     | Scale         | red     | Decyzja przeterminowana |
| `INITIATIVE_STARTED`   | Target        | emerald | Inicjatywa rozpoczęta   |
| `INITIATIVE_STALLED`   | Target        | amber   | Inicjatywa wstrzymana   |
| `INITIATIVE_COMPLETED` | Target        | emerald | Inicjatywa ukończona    |
| `AI_RISK_DETECTED`     | AlertTriangle | amber   | AI wykryło ryzyko       |
| `AI_RECOMMENDATION`    | Info          | purple  | Rekomendacja AI         |
| `SYSTEM_ALERT`         | Bell          | slate   | Alert systemowy         |

### Sekcje w lewej kolumnie

#### 1. What's Happening (Collapsible)

- **Co się dzieje** - główny komunikat
- **Dlaczego to ważne** - kontekst biznesowy
- **Co jest blokowane** - wpływ na inne elementy

#### 2. AI Analysis (Collapsible) ⭐ NOWE

- **Priorytet** - CRITICAL/HIGH/MEDIUM/LOW
- **Analiza wpływu** - opis konsekwencji
- **Rekomendacja AI** - sugerowane działanie
- **Przycisk "Zapytaj AI"** - otwiera chat z kontekstem

#### 3. Expected Action / Checklist (Collapsible)

- **Oczekiwana akcja** - co użytkownik powinien zrobić
- **Interaktywna checklista** - kroki do wykonania
- Automatycznie generowana na podstawie typu notyfikacji

#### 4. Related Items (Collapsible)

- Powiązane zadania/decyzje/inicjatywy
- Projekt źródłowy
- Linki do nawigacji

#### 5. Comments (Collapsible)

- Komentarze do notyfikacji
- Przygotowane do rozbudowy

#### 6. Activity Log (Collapsible)

- Historia aktywności
- Kiedy utworzono
- Kiedy przeczytano

### Sekcje w prawej kolumnie

#### 1. Action Buttons (Header)

| Przycisk  | Kolor ramki   | Funkcja                      |
| --------- | ------------- | ---------------------------- |
| Mark Read | blue-500/40   | Oznacza jako przeczytane     |
| Chat      | purple-500/40 | Otwiera AI chat z kontekstem |

#### 2. Control Panel (Collapsible)

- **Badge** `#notif-XXX` - identyfikator
- **Type** - typ notyfikacji
- **Severity** - poziom ważności
- **Category** - kategoria
- **Created** - data utworzenia
- **Read at** - data przeczytania
- **Primary CTA** - główna akcja (zależna od typu)
- **Mute** - wycisz podobne
- **Delete** - usuń notyfikację

#### 3. Stakeholders (Collapsible)

- Interesariusze powiązani z notyfikacją
- Przygotowane do rozbudowy

#### 4. Why You Got It

- Wyjaśnienie dlaczego użytkownik otrzymał notyfikację
- Rola użytkownika (decider/owner/manager/sponsor)

### Treść notyfikacji (Kanon 4-liniowy)

Każda notyfikacja MUSI odpowiadać na:

1. **Co się dzieje** - konkretny fakt
2. **Dlaczego to ważne** - wpływ biznesowy
3. **Co jest blokowane** - konsekwencje braku działania
4. **Jakiej akcji oczekujemy** - jednoznaczny CTA

### Triggery notyfikacji

Notyfikacje MUSZĄ powstawać z:

- Brak decyzji / decyzja overdue
- Blokada taska (blocked by decision)
- Przekroczony próg kosztu opóźnienia
- Aging (brak ruchu / brak aktualizacji)
- Shadow execution (próba pchania taska bez decyzji)

### Routing (adresaci)

| Rola      | Typ notyfikacji     | CTA                      |
| --------- | ------------------- | ------------------------ |
| Decydent  | Presja, koszt       | Decide/Delegate/Escalate |
| Manager   | Blokady zespołu     | Unblock/Reassign         |
| Wykonawca | Na co czeka         | Complete/Update          |
| Sponsor   | Ryzyko strategiczne | Review/Approve           |

### Snooze Mechanism

Użytkownik może odroczyć notyfikację:

- **1 godzina**
- **4 godziny**
- **Jutro**
- **Następny tydzień**
- **Custom** - własna data/godzina

Snoozed notifications:

- Znikają z głównej listy
- Wracają po upływie czasu
- Persystowane w localStorage (offline support)

### Anti-spam

- Cooldown per `(eventType, entityId, recipientId)`
- Agregacja podobnych zdarzeń w jedno powiadomienie

---

## Wspólne standardy UI/UX

### Header (Golden Standard)

```css
/* Gradient fioletowy */
bg-gradient-to-r from-white/80 via-purple-50/30 to-white/80
dark:from-navy-900/80 dark:via-purple-900/20 dark:to-navy-900/80

/* Efekty */
backdrop-blur-xl
rounded-2xl
border border-purple-200/40 dark:border-purple-500/20
shadow-lg shadow-purple-500/10 dark:shadow-purple-500/20
ring-1 ring-purple-500/10 dark:ring-purple-400/10
```

### Glassmorphism Cards

```css
bg-white/70 dark:bg-navy-900/70
backdrop-blur-xl
rounded-2xl
border border-slate-200/60 dark:border-navy-700/60
shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50
```

### Collapsible Sections Pattern

```tsx
<motion.div className="glassmorphism-card">
  {/* Header - zawsze widoczny */}
  <motion.button onClick={toggle}>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-[color]-500/10">
        <Icon size={18} className="text-[color]-500" />
      </div>
      <span className="font-semibold">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      {count > 0 && <span className="text-xs">{count}</span>}
      <ChevronDown className={expanded ? 'rotate-180' : ''} />
    </div>
  </motion.button>

  {/* Content - animowany */}
  <AnimatePresence>
    {expanded && (
      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

### Przyciski akcji

| Typ            | Ramka          | Tekst       | Użycie            |
| -------------- | -------------- | ----------- | ----------------- |
| Primary (Save) | blue-500/40    | blue-700    | Zapisywanie       |
| Primary (Chat) | purple-500/40  | purple-700  | Otwieranie czatu  |
| Success        | emerald-400/60 | emerald-500 | Approve, Complete |
| Danger         | red-400/60     | red-500     | Reject, Delete    |
| Neutral        | slate-300      | slate-500   | Secondary actions |

### Internacjonalizacja

```typescript
const { i18n } = useTranslation();
const isPolish = i18n.language === 'pl';

// Użycie
{
  isPolish ? 'Tekst polski' : 'English text';
}
```

---

## AI Chat Integration

### Architecture

The AI Chat panel in MyWork is deeply integrated at three levels:

1. **Per-tab system prompts** — Each tab (Executive, Inbox, Focus, Tasks, Decisions, Notebook, Ideas) sets a dedicated system prompt that defines the AI's persona (e.g., "C-level strategic advisor" for Executive, "Productivity coach" for Focus).

2. **Contextual enrichment** — The system prompt is automatically prepended with a workload summary fetched from `GET /my-work/context-summary` every 5 minutes (tasks due today, pending decisions, inbox items, etc.).

3. **Action bridge** — Chat can execute actions via `/task` and `/decision` commands, calling `POST /my-work/chat-actions` on the backend.

### "Ask AI" Flow

Every detail view (Task, Decision, Idea, Notebook) has an "Ask AI" button that:

1. Calls `buildAskAIMessage()` from `shared/askAiHelper.ts`
2. Generates a contextual kickoff message with entity data (title, status, priority, due date, description, project)
3. Sets `chatKickoffMessage` in the Zustand store
4. Opens the chat panel via `toggleChatCollapse()`
5. The chat auto-sends the kickoff message on next render

### Quick Prompts per Tab

| Tab | Example Prompts |
|---|---|
| Executive | "Give me a 30-second briefing", "What needs my attention most?" |
| Inbox | "Auto-triage my inbox", "Summarize new items since yesterday" |
| Focus | "Optimize my Today column", "What should I tackle first?", "Estimate my capacity" |
| Tasks | "Reprioritize my tasks for today", "Which tasks should I delegate?" |
| Decisions | "Summarize pending decisions", "Risk analysis for this decision" |
| Notebook | "Summarize this note", "Extract action items", "Find related artifacts" |
| Ideas | "Evaluate this idea", "What questions should I explore?", "Suggest connections" |

### Chat Commands

| Command | Action |
|---|---|
| `/task <title>` | Creates a personal task via `POST /my-work/chat-actions` |
| `/decision <title>` | Creates a decision draft via `POST /my-work/chat-actions` |

### Context Passed to AI

```typescript
// Entity context (via buildAskAIMessage)
{
  entityType: 'task' | 'decision' | 'idea' | 'notebook',
  title: string,
  status?: string,
  priority?: string,
  dueDate?: string,
  description?: string,
  projectName?: string
}

// Workload context (via GET /context-summary, prepended to system prompt)
// "User has 5 tasks due today (2 completed), 3 pending decisions,
//  7 new inbox items. Top priorities: [Task X], [Decision Y]."
```

### Session Context Carry-over

The system saves/restores chat context between visits:
- On tab change or document open → `POST /my-work/session-context` saves `{ lastViewedItems, activeTab, chatTopics }`
- On return visit → `GET /my-work/session-context` restores previous context
```

---

## Offline Support

### Draft Persistence

Wszystkie widoki zapisują draft do localStorage:

```typescript
// Klucz
`consultinity-task-draft:${taskId}`
`consultinity-decision-draft:${decisionId}`

// Zawartość
{
  ...formData,
  savedAt: timestamp
}
```

### Snooze Persistence

```typescript
// Klucz
'consultinity-snoozed-notifications'

// Zawartość
{
  [notificationId]: {
    snoozedAt: timestamp,
    snoozedUntil: timestamp
  }
}
```

### Zachowanie

1. **Save** - zawsze najpierw zapisuje do localStorage
2. **Chat** - zapisuje draft przed otwarciem czatu
3. **Reload** - odczytuje draft przy ponownym otwarciu
4. **Sync** - synchronizuje z API gdy online

---

## Focus — Personal Kanban + AI Coach

### Component

`src/components/MyWork/Focus/FocusView.tsx`

### Columns

| Column | Purpose |
|---|---|
| Today | Items planned for today |
| This Week | Items for the current week |
| Later | Backlog / deferred items |

### AI Features in Focus

| Feature | Component | Trigger |
|---|---|---|
| **Nudge Strip** | `Focus/NudgeStrip.tsx` | Auto-loaded, shows top 2-3 nudges |
| **AI Priority Coach** | `Focus/AICoachPanel.tsx` | Toggle button, fetches `GET /priority-advice` |
| **AI Plan My Day** | `Focus/AIPlanView.tsx` | Toggle button, fetches `POST /focus/ai-plan` |
| **Delegation Advisor** | `shared/DelegationModal.tsx` | Enhanced with AI suggestions from `GET /delegation-suggestions` |

### Focus ↔ Tasks Sync

Tasks in the list view display which Focus column they belong to via focus badges (Today / This Week / Later).

---

## Ideas — Idea Garden & Mind Map

### Component

`src/components/MyWork/IdeaDetailView.tsx`

### Views

- **List** — sortable table
- **Cards** — maturity-based card grid
- **Garden** — visual maturity journey
- **MindMap** — graph with AI-suggested connections (`IdeasMindMap.tsx`)

### Promote CTA Strip

When an idea reaches the ready/summary stage, a prominent action bar appears:

| Button | Action |
|---|---|
| Create Tasks | Converts idea → task set with `source_type: 'idea'` |
| Decision | Creates a decision with `source_type: 'idea'` |
| Initiative | Converts idea → initiative proposal |

### AI Features

- **AI Evaluation** via `/my-work/my-ideas/:id/develop`
- **AI Connections** widget (`shared/AIConnections.tsx`) showing cross-entity relationships

---

## Executive Dashboard

### Component

`src/components/MyWork/Executive/ExecutiveDashboard.tsx`

### Widgets

| Widget | Description |
|---|---|
| KPI Grid | Tiles with deep-link navigation (overdue → Tasks?filter=overdue) |
| Action Required Strip | Urgent items with inline actions |
| Decision Queue Preview | Pending decisions with time-waiting |
| Portfolio Health Score | Composite score visualization |
| Team Performance | Team capacity and status |
| Work Patterns | Velocity, completion time, overdue rate, AI insights |

---

## Inbox — Triage Center

### Component

`src/components/MyWork/InboxContent.tsx`

### Triage Actions

| Action | Effect |
|---|---|
| Accept Today | Adds to Focus/Today |
| Accept This Week | Adds to Focus/This Week |
| Delegate | Opens delegation flow |
| Snooze | Hides temporarily |
| Dismiss | Removes from inbox |

### AI Auto-Triage

Button "AI Auto-Triage" calls `POST /my-work/inbox/auto-triage`:
- Classifies all pending items with confidence scores
- High confidence (> 0.7) → auto-applies with undo
- Low confidence → shows as suggestion

---

## Cross-Tab EventBus

### Implementation

Zustand slice in `uiSlice.ts`:

```typescript
myWorkEvent: {
  type: 'item:completed' | 'item:created' | 'item:moved' |
        'item:triaged' | 'item:converted' | 'item:updated' | 'item:deleted';
  entityType: 'task' | 'decision' | 'idea' | 'notebook' | 'inbox';
  entityId: string;
  meta?: Record<string, unknown>;
  timestamp: number;
} | null;
```

### Flow

1. Detail view emits event via `emitMyWorkEvent()`
2. `MyWorkHub.tsx` watches for changes and increments `refreshTrigger`
3. All child tab components include `refreshTrigger` in their data-fetching `useEffect` dependency arrays
4. Data refreshes automatically without full page reload

---

## Origin Tracking

### Database

```sql
ALTER TABLE tasks ADD COLUMN source_type TEXT;     -- 'idea' | 'notebook' | 'decision'
ALTER TABLE tasks ADD COLUMN source_id TEXT;
ALTER TABLE decisions ADD COLUMN source_type TEXT;
ALTER TABLE decisions ADD COLUMN source_id TEXT;
```

### UI

Origin badges appear in detail views:
- "Created from Idea: {title}" with click-to-navigate
- "Created from Notebook: {title}" with click-to-navigate
- "Created from Decision: {title}" with click-to-navigate

---

## Shared Components (New)

| Component | Path | Purpose |
|---|---|---|
| `PostDecisionFollowUp` | `shared/PostDecisionFollowUp.tsx` | Modal for follow-up task creation after decision |
| `RelatedContext` | `shared/RelatedContext.tsx` | Cross-entity related items (KnowledgePulse expansion) |
| `AIConnections` | `shared/AIConnections.tsx` | AI-discovered semantic relationships |
| `ConvertToMenu` | `shared/ConvertToMenu.tsx` | Universal "Convert to..." dropdown |
| `askAiHelper` | `shared/askAiHelper.ts` | `buildAskAIMessage()` for contextual chat |
| `MorningBriefCard` | `MorningBriefCard.tsx` | Daily briefing card with AI recommendations |
| `NudgeStrip` | `Focus/NudgeStrip.tsx` | Proactive nudge alerts |
| `AICoachPanel` | `Focus/AICoachPanel.tsx` | Priority Coach with ranked recommendations |
| `AIPlanView` | `Focus/AIPlanView.tsx` | AI-generated time-blocked schedule |

---

## Changelog

| Date | Change |
| ---------- | --- |
| 2026-01-29 | Created module documentation (Tasks, Decisions, Notifications) |
| 2026-01-29 | Added golden standard layout, AI Analysis, collapsible sections |
| 2026-02-24 | **Major update** — Added Focus, Ideas, Executive, Inbox, Notebook sections |
| 2026-02-24 | Added Cross-Tab EventBus (Zustand `myWorkEvent`) |
| 2026-02-24 | Added Origin Tracking (`source_type`/`source_id`) |
| 2026-02-24 | Added per-tab AI system prompts and quick prompts |
| 2026-02-24 | Added "Ask AI" buttons in all detail views |
| 2026-02-24 | Added Chat→Action bridge (`/task`, `/decision` commands) |
| 2026-02-24 | Added Morning Briefing (`MorningBriefCard`) |
| 2026-02-24 | Added AI Priority Coach (`AICoachPanel`) |
| 2026-02-24 | Added Proactive Nudges (`NudgeStrip`) |
| 2026-02-24 | Added AI Decision Briefs |
| 2026-02-24 | Added Predictive Signals in `/signals` endpoint |
| 2026-02-24 | Added AI Auto-Triage for Inbox |
| 2026-02-24 | Added Work Pattern Analysis for Executive |
| 2026-02-24 | Added AI Weekly Review via Notebook template |
| 2026-02-24 | Added Predictive Focus Planning (`AIPlanView`) |
| 2026-02-24 | Added AI Delegation Advisor |
| 2026-02-24 | Added Smart Note Routing |
| 2026-02-24 | Added KnowledgePulse expansion to Tasks + Decisions (`RelatedContext`) |
| 2026-02-24 | Added AI Relationships Graph (`AIConnections`) |
| 2026-02-24 | Added Context Carry-over between sessions |
| 2026-02-24 | Added Notebook slash commands: `/task`, `/decision`, `/idea` |
| 2026-02-24 | Added Post-Decision Follow-Up modal |
| 2026-02-24 | Added Idea Promote CTA strip |
| 2026-02-24 | Added Focus/Triage/Origin badges in Tasks list |
| 2026-02-24 | Added Executive deep links with filter context |
| 2026-02-24 | Added Universal ConvertToMenu component |

---

## Source Files

### Main Components

| Component | Path |
| --- | --- |
| MyWorkHub | `src/components/MyWork/MyWorkHub.tsx` |
| MorningBriefCard | `src/components/MyWork/MorningBriefCard.tsx` |
| CommandPalette | `src/components/MyWork/CommandPalette.tsx` |

### Detail Views

| Component | Path |
| --- | --- |
| TaskDetailView | `src/components/MyWork/TaskDetailView.tsx` |
| DecisionDetailView | `src/components/MyWork/DecisionDetailView.tsx` |
| IdeaDetailView | `src/components/MyWork/IdeaDetailView.tsx` |
| NotificationDetailView | `src/components/MyWork/NotificationDetailView.tsx` |

### Tab Content

| Component | Path |
| --- | --- |
| InboxContent | `src/components/MyWork/InboxContent.tsx` |
| FocusView | `src/components/MyWork/Focus/FocusView.tsx` |
| MyTasksListContent | `src/components/MyWork/MyTasksListContent.tsx` |
| TasksKanbanBoard | `src/components/MyWork/TasksKanbanBoard.tsx` |
| TasksCalendarView | `src/components/MyWork/TasksCalendarView.tsx` |
| DecisionsPanelContent | `src/components/MyWork/DecisionsPanelContent.tsx` |
| DecisionsKanbanBoard | `src/components/MyWork/DecisionsKanbanBoard.tsx` |
| DecisionReviewNext | `src/components/MyWork/DecisionReviewNext.tsx` |
| NotebookContent | `src/components/MyWork/NotebookContent.tsx` |
| MyIdeasListContent | `src/components/MyWork/MyIdeasListContent.tsx` |
| IdeasMindMap | `src/components/MyWork/IdeasMindMap.tsx` |
| ExecutiveDashboard | `src/components/MyWork/Executive/ExecutiveDashboard.tsx` |

### Focus Subcomponents

| Component | Path |
| --- | --- |
| NudgeStrip | `src/components/MyWork/Focus/NudgeStrip.tsx` |
| AICoachPanel | `src/components/MyWork/Focus/AICoachPanel.tsx` |
| AIPlanView | `src/components/MyWork/Focus/AIPlanView.tsx` |
| FocusBoard | `src/components/MyWork/Focus/FocusBoard.tsx` |

### Notebook Subcomponents

| Component | Path |
| --- | --- |
| SlashMenu | `src/components/MyWork/notebook/SlashMenu.tsx` |
| KnowledgePulse | `src/components/MyWork/notebook/KnowledgePulse.tsx` |
| NewPageModal | `src/components/MyWork/notebook/NewPageModal.tsx` |
| ActionItemsPanel | `src/components/MyWork/notebook/ActionItemsPanel.tsx` |
| ConvertChecklistModal | `src/components/MyWork/notebook/ConvertChecklistModal.tsx` |

### Shared Components

| Component | Path |
| --- | --- |
| askAiHelper | `src/components/MyWork/shared/askAiHelper.ts` |
| PostDecisionFollowUp | `src/components/MyWork/shared/PostDecisionFollowUp.tsx` |
| RelatedContext | `src/components/MyWork/shared/RelatedContext.tsx` |
| AIConnections | `src/components/MyWork/shared/AIConnections.tsx` |
| ConvertToMenu | `src/components/MyWork/shared/ConvertToMenu.tsx` |
| DelegationModal | `src/components/MyWork/shared/DelegationModal.tsx` |
| LinkedItemsSection | `src/components/MyWork/shared/LinkedItemsSection.tsx` |
| AIInsightSection | `src/components/MyWork/shared/AIInsightSection.tsx` |

### Backend

| File | Purpose |
| --- | --- |
| `server/src/routes/my-work.routes.ts` | 60+ API endpoints |
| `server/src/services/ai/taskAdvisorService.ts` | AI Priority Coach |
| `server/src/services/ai/proactiveNudges.ts` | Proactive nudges (8 methods) |
| `server/src/services/ai/aiMemoryService.ts` | Cross-session memory |
| `server/migrations/20260311_origin_tracking.sql` | Origin tracking schema |

### State Management

| File | Slice/Fields |
| --- | --- |
| `src/store/slices/uiSlice.ts` | `myWorkEvent`, `chatSystemPrompt`, `chatQuickPrompts`, `chatKickoffMessage`, `myWorkIntent` |

---

## Related Documentation

- [Architecture Reference](./architecture/MYWORK_ARCHITECTURE.md) — Full API list, component tree, database schema
- [Dashboard Flow](./flows/core/MYWORK_DASHBOARD_FLOW.md) — User flow diagrams
- [Notebook Module](./modules/LIVING_NOTEBOOK_MODULE.md) — Notebook product vision
- [UI Standards](./ui-standards/README.md) — Shared component standards
- [Recommendations](./mywork-recommendations.md) — Source material for feature planning
