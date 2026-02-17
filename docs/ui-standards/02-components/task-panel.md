# Task Panel - Pełna Specyfikacja UI/UX

> **Status:** OBOWIĄZUJĄCY od 2026-01-29  
> **Ostatnia aktualizacja:** 2026-01-29  
> **Plik źródłowy:** `src/components/MyWork/TaskDetailView.tsx`

## Spis treści

1. [Przegląd](#przegląd)
2. [Golden Standard (2026-01-29)](#golden-standard-2026-01-29)
3. [Różnice względem Decision Panel](#różnice-względem-decision-panel)
4. [Układ (Layout)](#układ-layout)
5. [Komponenty lewej kolumny](#komponenty-lewej-kolumny)
6. [Komponenty prawej kolumny](#komponenty-prawej-kolumny)
7. [Stany i konfiguracje](#stany-i-konfiguracje)
8. [Workflow i logika](#workflow-i-logika)
9. [Nowe sekcje](#nowe-sekcje)

---

## Przegląd

Task Panel został przebudowany według wzorca Decision Panel (Golden Standard). Składa się z dwóch kolumn:

- **Lewa kolumna (2/3 szerokości)**: Opis zadania, oczekiwany rezultat, komentarze, analiza ryzyka, alternatywy, pomysły realizacji, checklist, tagi
- **Prawa kolumna (1/3 szerokości)**: AI Insights, Dependencies, Panel kontrolny, stakeholders, reminders, attachments, links, evidence & acceptance, strategic contribution

### Główne cechy:

- Wszystkie sekcje domyślnie **zwinięte**
- Dyskretne **liczniki elementów** przy strzałce rozwijania
- **Przyciski akcji** z subtelnymi kolorowymi ramkami (outline style) + glassmorphism
- Pełna **internacjonalizacja** (PL/EN)
- **Animacje** z Framer Motion
- **Tech-sexy UI** z gradientami i efektami blur
- **AI-powered** generowanie ryzyk, alternatyw, pomysłów i wskazówek
- **Offline support** - draft zapisywany do localStorage

---

## Golden Standard (2026-01-29)

### Uproszczony Header

Od 2026-01-29 header zawiera **tylko 2 przyciski**:

| Przycisk | Kolor ramki            | Kolor tekstu      | Funkcja                       |
| -------- | ---------------------- | ----------------- | ----------------------------- |
| **Save** | `border-blue-500/40`   | `text-blue-700`   | Zapisuje task + draft offline |
| **Chat** | `border-purple-500/40` | `text-purple-700` | Otwiera AI chat z kontekstem  |

### Usunięte przyciski

Następujące przyciski zostały **celowo usunięte** z headera:

- Start
- Complete
- Block
- Delegate
- Delete

Status zadania zmienia się teraz wyłącznie przez dropdown w sekcji Control.

### Badge Task ID

Badge `#task-XXX` przeniesiony do sekcji **Control** (prawa kolumna), wyświetlany po prawej stronie nagłówka sekcji.

### Offline Draft

Każdy Save i Chat najpierw zapisuje draft do localStorage:

```
consultinity-task-draft:{taskId}
```

### Design System:

```css
/* Glassmorphism cards */
bg-white/70 dark:bg-navy-900/70
backdrop-blur-xl
rounded-2xl
border border-slate-200/60 dark:border-navy-700/60
shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50

/* Gradient backgrounds */
bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/30
dark:from-navy-950 dark:via-navy-900 dark:to-navy-950

/* Decorative blobs */
bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-full blur-3xl
```

---

## Różnice względem Decision Panel

| Aspekt                 | Decision Panel                                   | Task Panel                               |
| ---------------------- | ------------------------------------------------ | ---------------------------------------- |
| Główne akcje           | Approve / Reject                                 | Start / Complete / Delete                |
| Specyficzne sekcje     | -                                                | Checklist, Tags, Implementation Ideas    |
| Wspólne sekcje         | Risk Analysis, Alternatives                      | Risk Analysis, Alternatives              |
| Statusy                | pending, approved, rejected, deferred, escalated | todo, in_progress, review, done, blocked |
| Główny cel             | Podjęcie decyzji                                 | Wykonanie pracy                          |
| AI Insights            | ❌                                               | ✅                                       |
| Dependencies           | ❌                                               | ✅                                       |
| Evidence & Acceptance  | ❌                                               | ✅                                       |
| Strategic Contribution | ❌                                               | ✅                                       |

---

## Układ (Layout)

### Struktura główna

```tsx
<div className="h-full flex flex-col bg-gradient-to-br from-slate-50...">
  {/* Header - Tytuł */}
  <header className="flex-shrink-0 px-6 py-4 border-b...">
    <ChevronLeft /> {/* Powrót */}
    <input value={title} /> {/* Tytuł */}
  </header>

  {/* Content - Dwie kolumny */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Lewa kolumna - 2/3 */}
    <div className="lg:col-span-2 space-y-4">
      {/* Task Description */}
      {/* Comments */}
      {/* Checklist */}
      {/* Tags */}
    </div>

    {/* Prawa kolumna - 1/3 */}
    <div className="space-y-4 lg:sticky lg:top-6">
      {/* Deadline Alert */}
      {/* Action Buttons */}
      {/* Control Panel */}
      {/* Stakeholders */}
      {/* Reminders & Escalation */}
      {/* Attachments */}
      {/* Linked Items */}
    </div>
  </div>
</div>
```

---

## Komponenty lewej kolumny

### 1. Header (Tytuł zadania)

```tsx
<header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-800">
  <div className="flex items-center gap-4">
    <motion.button onClick={onClose}>
      <ChevronLeft size={20} />
    </motion.button>
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Task title..."
      className="flex-1 text-xl font-bold bg-transparent..."
    />
  </div>
</header>
```

### 2. Task Description

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl p-5...">
  <div className="flex items-center gap-3 mb-3">
    <div className="p-2 rounded-xl bg-blue-500/10">
      <FileText size={16} className="text-blue-500" />
    </div>
    <span className="text-sm font-semibold">Task description</span>
  </div>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    rows={4}
    className="w-full px-3 py-2 rounded-lg..."
  />
</motion.div>
```

### 3. Comments (Collapsible)

Identyczny komponent jak w Decision Panel.

### 4. Checklist (Collapsible) - SPECYFICZNE DLA TASKS

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl...">
  {/* Header z progress bar */}
  <motion.button onClick={() => toggleSection('checklist')}>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-emerald-500/10">
        <CheckSquare size={18} className="text-emerald-500" />
      </div>
      <span>Checklist</span>
    </div>
    <div className="flex items-center gap-3">
      {/* Progress bar */}
      <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      {/* Counter */}
      <span className="text-xs text-slate-400">
        {completed}/{total}
      </span>
      <ChevronDown />
    </div>
  </motion.button>

  {/* Content */}
  <AnimatePresence>
    {expanded && (
      <motion.div>
        {checklist.map((item) => (
          <div className="flex items-center gap-3 group">
            <input type="checkbox" checked={item.completed} />
            <input type="text" value={item.text} />
            <button onClick={() => remove(item.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={addItem}>
          <Plus size={14} /> Add item
        </button>
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

**Interfejs Checklist:**

```typescript
interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}
```

### 5. Tags (Collapsible) - SPECYFICZNE DLA TASKS

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl...">
  <motion.button onClick={() => toggleSection('tags')}>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-pink-500/10">
        <Tag size={18} className="text-pink-500" />
      </div>
      <span>Tags</span>
    </div>
    <div className="flex items-center gap-2">
      {tags.length > 0 && <span className="text-xs text-slate-400">{tags.length}</span>}
      <ChevronDown />
    </div>
  </motion.button>

  <AnimatePresence>
    {expanded && (
      <motion.div className="p-4">
        {/* Tags list */}
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span className="px-2.5 py-1 rounded-full text-xs bg-pink-100 text-pink-700">
              {tag}
              <button onClick={() => removeTag(tag)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        {/* Add tag input */}
        <div className="flex gap-2">
          <input value={newTag} placeholder="New tag..." />
          <button onClick={addTag}>
            <Plus size={16} />
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

---

## Komponenty prawej kolumny

### 1. Deadline Alert Banner

Identyczny komponent jak w Decision Panel.

### 2. Action Buttons

```tsx
<motion.div className="space-y-2">
  {/* Primary Actions - zależne od statusu */}
  {taskId && !isDone && (
    <div className="grid grid-cols-2 gap-2">
      {/* Start - tylko dla todo */}
      {status === 'todo' && (
        <motion.button
          onClick={handleStartTask}
          className="border border-blue-400/60 text-blue-500..."
        >
          <Play size={18} /> Start
        </motion.button>
      )}

      {/* Complete - dla in_progress i review */}
      {(status === 'in_progress' || status === 'review') && (
        <motion.button
          onClick={handleCompleteTask}
          className="border border-emerald-400/60 text-emerald-500..."
        >
          <Check size={18} /> Complete
        </motion.button>
      )}

      {/* Delete - zawsze */}
      <motion.button onClick={handleDelete} className="border border-red-400/60 text-red-500...">
        <Trash2 size={18} /> Delete
      </motion.button>
    </div>
  )}

  {/* Save - zawsze */}
  <motion.button
    onClick={handleSave}
    className="w-full border border-purple-400/60 text-purple-500..."
  >
    <Save size={18} /> Save Changes
  </motion.button>
</motion.div>
```

**Kolory przycisków:**
| Akcja | Kolor ramki | Kolor tekstu |
|-------|-------------|--------------|
| Start | blue-400/60 | blue-500 |
| Complete | emerald-400/60 | emerald-500 |
| Delete | red-400/60 | red-500 |
| Save | purple-400/60 | purple-500 |

### 3. Control Panel (Collapsible)

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl...">
  <motion.button onClick={() => toggleSection('control')}>
    <Flag /> Control
    <ChevronDown />
  </motion.button>

  <AnimatePresence>
    {expanded && (
      <div className="p-4 space-y-3">
        {/* Initiative */}
        <Dropdown
          label="Initiative"
          value={initiativeId}
          options={availableInitiatives}
          emptyOption="Standalone task"
        />

        {/* Status */}
        <Dropdown label="Status" value={status} options={STATUS_CONFIG} />

        {/* Priority */}
        <Dropdown label="Priority" value={priority} options={PRIORITY_CONFIG} />

        {/* Due Date */}
        <DateInput label="Due Date" value={dueDate} />

        {/* Owner / Assignee */}
        <div className="grid grid-cols-2 gap-3">
          <Select label="Owner" value={ownerId} options={users} />
          <Select label="Assignee" value={assigneeId} options={users} />
        </div>

        {/* Blocked Reason - tylko gdy status === 'blocked' */}
        {status === 'blocked' && (
          <textarea label="Blocked Reason" value={blockedReason} className="border-red-200..." />
        )}
      </div>
    )}
  </AnimatePresence>
</motion.div>
```

### 4-7. Pozostałe sekcje

Identyczne jak w Decision Panel:

- **Stakeholders (RACI)**
- **Reminders & Escalation**
- **Attachments**
- **Linked Items**

---

## Stany i konfiguracje

### STATUS_CONFIG

```typescript
const STATUS_CONFIG = {
  todo: {
    label: { en: 'To Do', pl: 'Do zrobienia' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
    icon: CheckSquare,
  },
  in_progress: {
    label: { en: 'In Progress', pl: 'W trakcie' },
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    icon: Clock,
  },
  review: {
    label: { en: 'Review', pl: 'Przegląd' },
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    icon: Edit3,
  },
  done: {
    label: { en: 'Done', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    icon: CheckCircle2,
  },
  blocked: {
    label: { en: 'Blocked', pl: 'Zablokowane' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: AlertCircle,
  },
};
```

### PRIORITY_CONFIG

Identyczny jak w Decision Panel.

---

## Workflow i logika

### Przepływ stanu zadania

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

### Logika przycisków akcji

```typescript
// Start - tylko dla todo
if (status === 'todo') {
  showStartButton = true;
}

// Complete - dla in_progress i review
if (status === 'in_progress' || status === 'review') {
  showCompleteButton = true;
}

// Delete - zawsze gdy taskId istnieje i nie done
if (taskId && status !== 'done') {
  showDeleteButton = true;
}

// Save - zawsze
showSaveButton = true;
```

### Funkcje obsługi

```typescript
const handleStartTask = () => {
  setStatus('in_progress');
  setStartDate(new Date().toISOString().split('T')[0]);
  toast.success('Task started');
};

const handleCompleteTask = () => {
  setStatus('done');
  toast.success('Task completed');
};

const handleDelete = async () => {
  if (!confirm('Are you sure?')) return;
  await Api.delete(`/tasks/${taskId}`);
  toast.success('Task deleted');
  onClose();
};

const handleSave = async () => {
  if (!title.trim()) {
    toast.error('Title is required');
    return;
  }
  // ... save logic
};
```

### Checklist Progress

```typescript
const checklistProgress = useMemo(() => {
  if (checklist.length === 0) return 0;
  return Math.round((checklist.filter((c) => c.completed).length / checklist.length) * 100);
}, [checklist]);
```

---

## Tłumaczenia specyficzne dla Task Panel

| EN               | PL                  |
| ---------------- | ------------------- |
| Task description | Opis zadania        |
| Checklist        | Lista kontrolna     |
| Tags             | Tagi                |
| To Do            | Do zrobienia        |
| In Progress      | W trakcie           |
| Review           | Przegląd            |
| Done             | Ukończone           |
| Blocked          | Zablokowane         |
| Start            | Rozpocznij          |
| Complete         | Ukończ              |
| Delete           | Usuń                |
| Owner            | Właściciel          |
| Assignee         | Wykonawca           |
| Blocked Reason   | Powód blokady       |
| Standalone task  | Samodzielne zadanie |
| Add item         | Dodaj element       |
| New tag          | Nowy tag            |

---

---

## Nowe sekcje

### 1. Expected Outcome (Oczekiwany rezultat)

Pole tekstowe opisujące co ma być efektem zadania.

```tsx
<textarea
  value={expectedOutcome}
  placeholder="Co ma być efektem tego zadania?"
  className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80..."
/>
```

### 2. Risk Analysis (Analiza ryzyka)

Reuse komponentu `RiskAssessmentCompact` z Decision Panel.

- Lista ryzyk z probability/impact matrix
- AI Generate button
- Kategorie: technical, business, operational, financial, legal

### 3. Alternatives (Alternatywy)

Reuse komponentu `AlternativesSection` z Decision Panel.

- Lista alternatywnych podejść z pros/cons
- Widok porównawczy
- AI Generate button
- Możliwość oznaczenia jako recommended

### 4. Implementation Ideas (Pomysły realizacji)

**NOWY komponent** specyficzny dla Tasks.

```typescript
interface ImplementationIdea {
  id: string;
  title: string;
  description: string;
  source: 'manual' | 'ai' | 'team';
  status: 'idea' | 'considered' | 'selected' | 'rejected';
  votes: number;
  votedByMe: boolean;
}
```

Features:

- Głosowanie na pomysły
- Status tracking
- AI Generate button
- Sortowanie po głosach

### 5. Dependencies (Zależności)

**NOWY komponent** do zarządzania zależnościami między zadaniami.

```typescript
interface TaskDependency {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus?: string;
  type: 'blocks' | 'blocked_by';
}
```

Features:

- Sekcja "Blokuje" (tasks that this task blocks)
- Sekcja "Blokowane przez" (tasks blocking this task)
- Warning gdy blokowane przez nieukończone taski
- Link do otwarcia powiązanego taska

### 6. AI Insights (Wskazówki AI)

**NOWY komponent** do wyświetlania AI-generowanych wskazówek.

```typescript
interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'prediction' | 'optimization';
  title: string;
  description: string;
  confidence: 'low' | 'medium' | 'high';
  createdAt: string;
  actionable?: boolean;
  actionText?: string;
}
```

Features:

- 4 typy wskazówek z różnymi kolorami
- Wskaźnik pewności (3 kropki)
- Akcje (Apply, Dismiss)
- Generate button

### 7. Evidence & Acceptance (Dowody i akceptacja)

**NOWY komponent** do zarządzania dowodami i procesem akceptacji.

```typescript
type EvidenceType = 'DOCUMENT' | 'DATA' | 'DEMO' | 'APPROVAL';

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  verified?: boolean;
  verifiedAt?: string;
}
```

Features:

- Wybór wymaganych typów dowodów
- Lista załączonych dowodów z weryfikacją
- Toggle "Wymaga akceptacji"
- Wybór typu akceptacji (manual/automatic)
- Wybór akceptującego
- Sign-off button

### 8. Strategic Contribution (Wkład strategiczny)

**NOWY komponent** do określenia wpływu strategicznego zadania.

Opcje:

- **PROCESS_CHANGE** - Zmiana procesu
- **BEHAVIOR_CHANGE** - Zmiana zachowania
- **CAPABILITY_CHANGE** - Zmiana zdolności

Multi-select z checkboxami.

---

## Podsumowanie

Task Panel został przebudowany według Golden Standard z Decision Panel + rozszerzony o nowe funkcje:

### Wspólne z Decision Panel:

1. **Layout**: Dwie kolumny (2/3 + 1/3)
2. **Collapsible sections**: Ten sam wzorzec animacji
3. **Liczniki**: Dyskretne, koło strzałki
4. **Przyciski**: Outline style z glassmorphism
5. **Formularze**: Ujednolicone rozmiary inputów
6. **Risk Analysis**: Identyczny komponent
7. **Alternatives**: Identyczny komponent

### Specyficzne dla Task:

- **Checklist** z progress barem
- **Tags** z kolorowymi badges
- **Implementation Ideas** - brainstorming pomysłów
- **Dependencies** - zależności między taskami
- **AI Insights** - wskazówki AI
- **Evidence & Acceptance** - dowody i akceptacja
- **Strategic Contribution** - wkład strategiczny
- **Expected Outcome** - oczekiwany rezultat

### UI/UX Enhancements:

- **Glassmorphism** - przezroczyste karty z blur
- **Gradient backgrounds** - subtelne gradienty tła
- **Decorative blobs** - dekoracyjne elementy w tle
- **Shadow effects** - cienie dla głębi
- **AI-powered** - generowanie przez AI
