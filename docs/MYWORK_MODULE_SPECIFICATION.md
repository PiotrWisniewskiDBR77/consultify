# My Work Module - Pełna Specyfikacja Funkcjonalności

> **Status:** OBOWIĄZUJĄCY od 2026-01-29  
> **Ostatnia aktualizacja:** 2026-01-29  
> **Moduły:** Tasks, Decisions, Notifications

---

## Spis treści

1. [Przegląd modułu](#przegląd-modułu)
2. [Tasks - Zarządzanie zadaniami](#tasks---zarządzanie-zadaniami)
3. [Decisions - Zarządzanie decyzjami](#decisions---zarządzanie-decyzjami)
4. [Notifications - System powiadomień](#notifications---system-powiadomień)
5. [Wspólne standardy UI/UX](#wspólne-standardy-uiux)
6. [Integracja z AI Chat](#integracja-z-ai-chat)
7. [Offline Support](#offline-support)

---

## Przegląd modułu

### Cel modułu My Work

My Work to centralny hub operacyjny użytkownika, który:

- **Agreguje** wszystkie elementy wymagające uwagi (Tasks, Decisions, Notifications)
- **Priorytetyzuje** pracę według pilności i wpływu
- **Integruje** z AI dla wsparcia decyzyjnego
- **Wymusza** działanie poprzez system presji (Notifications)

### Architektura widoków

```
My Work
├── Inbox (Triage View)
│   ├── Pending Decisions
│   ├── Blocked Tasks
│   └── Critical Notifications
├── Tasks
│   ├── Task List View
│   └── Task Detail View ← Golden Standard
├── Decisions
│   ├── Decision List View
│   └── Decision Detail View
└── Notifications
    ├── Notification List View
    └── Notification Detail View
```

### Wspólny layout (Golden Standard)

Wszystkie widoki szczegółowe (Task/Decision/Notification) stosują identyczny layout:

- **Header** - fioletowy gradient, 2 przyciski (Save/Mark Read + Chat)
- **Lewa kolumna (2/3)** - treść merytoryczna, rozwijane sekcje
- **Prawa kolumna (1/3)** - Control Panel, metadane, akcje

---

## Tasks - Zarządzanie zadaniami

### Plik źródłowy
`src/components/MyWork/TaskDetailView.tsx`

### Statusy zadań

| Status | Label PL | Label EN | Kolor | Ikona |
|--------|----------|----------|-------|-------|
| `todo` | Do zrobienia | To Do | slate-400 | CheckSquare |
| `in_progress` | W trakcie | In Progress | blue-500 | Clock |
| `review` | Przegląd | Review | purple-500 | Edit3 |
| `done` | Ukończone | Done | emerald-500 | CheckCircle2 |
| `blocked` | Zablokowane | Blocked | red-500 | AlertCircle |

### Priorytety

| Priorytet | Label PL | Label EN | Kolor |
|-----------|----------|----------|-------|
| `low` | Niski | Low | slate-400 |
| `medium` | Średni | Medium | blue-400 |
| `high` | Wysoki | High | orange-400 |
| `critical` | Krytyczny | Critical | red-500 |

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
| Przycisk | Kolor ramki | Kolor tekstu | Funkcja |
|----------|-------------|--------------|---------|
| Save | blue-500/40 | blue-700 | Zapisuje task + draft offline |
| Chat | purple-500/40 | purple-700 | Otwiera AI chat z kontekstem |

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

| Status | Label PL | Label EN | Kolor |
|--------|----------|----------|-------|
| `pending` | Oczekująca | Pending | amber-500 |
| `approved` | Zatwierdzona | Approved | emerald-500 |
| `rejected` | Odrzucona | Rejected | red-500 |
| `deferred` | Odroczona | Deferred | slate-500 |
| `escalated` | Eskalowana | Escalated | orange-500 |

### Kategorie decyzji

| Kategoria | Label PL | Label EN |
|-----------|----------|----------|
| `scope_change` | Zmiana zakresu | Scope Change |
| `budget_change` | Zmiana budżetu | Budget Change |
| `schedule_change` | Zmiana harmonogramu | Schedule Change |
| `resource_allocation` | Alokacja zasobów | Resource Allocation |
| `risk_response` | Odpowiedź na ryzyko | Risk Response |
| `technical` | Techniczna | Technical |
| `strategic` | Strategiczna | Strategic |

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
| Przycisk | Kolor | Warunek |
|----------|-------|---------|
| Approve | emerald | status = pending |
| Reject | red | status = pending |
| Request Info | slate | status = pending |
| Delegate | slate | status = pending |
| Save | purple | zawsze |

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

| Severity | Label PL | Label EN | Kolor | Znaczenie |
|----------|----------|----------|-------|-----------|
| `INFO` | Informacja | Info | blue-500 | Informacyjne |
| `WARNING` | Ostrzeżenie | Warning | amber-500 | Wymaga uwagi |
| `CRITICAL` | Krytyczne | Critical | red-500 | Wymaga natychmiastowej reakcji |

### Kategorie notyfikacji

| Kategoria | Opis |
|-----------|------|
| `ai` | Rekomendacje i alerty AI |
| `task` | Powiadomienia o zadaniach |
| `decision` | Powiadomienia o decyzjach |
| `system` | Alerty systemowe |
| `project` | Powiadomienia projektowe |
| `initiative` | Powiadomienia o inicjatywach |

### Typy notyfikacji

| Typ | Ikona | Kolor | Opis |
|-----|-------|-------|------|
| `TASK_ASSIGNED` | CheckSquare | blue | Przypisano zadanie |
| `TASK_OVERDUE` | Clock | red | Zadanie przeterminowane |
| `TASK_BLOCKED` | AlertCircle | red | Zadanie zablokowane |
| `DECISION_REQUIRED` | Scale | purple | Wymagana decyzja |
| `DECISION_OVERDUE` | Scale | red | Decyzja przeterminowana |
| `INITIATIVE_STARTED` | Target | emerald | Inicjatywa rozpoczęta |
| `INITIATIVE_STALLED` | Target | amber | Inicjatywa wstrzymana |
| `INITIATIVE_COMPLETED` | Target | emerald | Inicjatywa ukończona |
| `AI_RISK_DETECTED` | AlertTriangle | amber | AI wykryło ryzyko |
| `AI_RECOMMENDATION` | Info | purple | Rekomendacja AI |
| `SYSTEM_ALERT` | Bell | slate | Alert systemowy |

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
| Przycisk | Kolor ramki | Funkcja |
|----------|-------------|---------|
| Mark Read | blue-500/40 | Oznacza jako przeczytane |
| Chat | purple-500/40 | Otwiera AI chat z kontekstem |

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

| Rola | Typ notyfikacji | CTA |
|------|-----------------|-----|
| Decydent | Presja, koszt | Decide/Delegate/Escalate |
| Manager | Blokady zespołu | Unblock/Reassign |
| Wykonawca | Na co czeka | Complete/Update |
| Sponsor | Ryzyko strategiczne | Review/Approve |

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
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: 'auto' }}
        exit={{ height: 0 }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

### Przyciski akcji

| Typ | Ramka | Tekst | Użycie |
|-----|-------|-------|--------|
| Primary (Save) | blue-500/40 | blue-700 | Zapisywanie |
| Primary (Chat) | purple-500/40 | purple-700 | Otwieranie czatu |
| Success | emerald-400/60 | emerald-500 | Approve, Complete |
| Danger | red-400/60 | red-500 | Reject, Delete |
| Neutral | slate-300 | slate-500 | Secondary actions |

### Internacjonalizacja

```typescript
const { i18n } = useTranslation();
const isPolish = i18n.language === 'pl';

// Użycie
{isPolish ? 'Tekst polski' : 'English text'}
```

---

## Integracja z AI Chat

### Mechanizm

1. **Przycisk Chat** w headerze każdego widoku
2. Wywołuje `updateWorkspaceFromView(AppView.MY_WORK, entityId, context)`
3. Kontekst trafia do `workspaceContext` w `useConversationStore`
4. AI ma dostęp do pełnych danych encji

### Kontekst przekazywany do AI

#### Task Context
```typescript
{
  type: 'task',
  id: taskId,
  title: string,
  description: string,
  status: string,
  priority: string,
  dueDate: string,
  assignee: string,
  checklist: ChecklistItem[],
  // ... pełne dane taska
}
```

#### Decision Context
```typescript
{
  type: 'decision',
  id: decisionId,
  title: string,
  description: string,
  status: string,
  alternatives: Alternative[],
  risks: RiskItem[],
  // ... pełne dane decyzji
}
```

#### Notification Context
```typescript
{
  type: 'notification',
  id: notificationId,
  notificationType: string,
  severity: string,
  title: string,
  message: string,
  relatedEntity: { type: string, id: string } | null,
  projectId: string | null,
  projectName: string | null,
}
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

## Historia zmian

| Data | Zmiana |
|------|--------|
| 2026-01-29 | Utworzono dokumentację modułu My Work |
| 2026-01-29 | Dodano specyfikację Tasks (Golden Standard) |
| 2026-01-29 | Dodano specyfikację Decisions |
| 2026-01-29 | Dodano specyfikację Notifications z AI Analysis |
| 2026-01-29 | Dodano sekcje: AI Analysis, Related Items, Action Checklist, Comments, Activity Log |
| 2026-01-29 | Ujednolicono layout wszystkich widoków szczegółowych |

---

## Pliki źródłowe

| Komponent | Ścieżka |
|-----------|---------|
| TaskDetailView | `src/components/MyWork/TaskDetailView.tsx` |
| DecisionDetailView | `src/components/MyWork/DecisionDetailView.tsx` |
| NotificationDetailView | `src/components/MyWork/NotificationDetailView.tsx` |
| NotificationsContent | `src/components/MyWork/NotificationsContent.tsx` |
| NotificationQuickActions | `src/components/MyWork/Notifications/NotificationQuickActions.tsx` |
| NotificationDropdown | `src/components/layout/NotificationDropdown.tsx` |
| useNotificationSnooze | `src/hooks/useNotificationSnooze.ts` |

---

## Powiązana dokumentacja

- [Task Panel Specification](./TASK_PANEL_SPECIFICATION.md)
- [Decision Panel Specification](./DECISION_PANEL_SPECIFICATION.md)
- [Task Detail View UI Standard](./ui-standards/task-detail-view.md)
- [Notification Entity Standard](../wdrozenia/standards/entities/06-NOTIFICATION.md)
