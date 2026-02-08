# Decision Panel - Pełna Specyfikacja UI/UX

## Spis treści

1. [Przegląd](#przegląd)
2. [Architektura komponentów](#architektura-komponentów)
3. [Układ (Layout)](#układ-layout)
4. [Komponenty lewej kolumny](#komponenty-lewej-kolumny)
5. [Komponenty prawej kolumny](#komponenty-prawej-kolumny)
6. [Stany i konfiguracje](#stany-i-konfiguracje)
7. [Stylowanie](#stylowanie)
8. [Internacjonalizacja](#internacjonalizacja)
9. [Workflow i logika](#workflow-i-logika)

---

## Przegląd

Decision Panel to komponent do zarządzania decyzjami w aplikacji. Składa się z dwóch kolumn:

- **Lewa kolumna (2/3 szerokości)**: Główna treść decyzji
- **Prawa kolumna (1/3 szerokości)**: Panel kontrolny i metadane

### Główne cechy:

- Wszystkie sekcje domyślnie **zwinięte**
- Dyskretne **liczniki elementów** przy strzałce rozwijania
- **Przyciski akcji** z subtelnymi kolorowymi ramkami (outline style)
- Pełna **internacjonalizacja** (PL/EN)
- **Animacje** z Framer Motion

---

## Architektura komponentów

### Plik główny

```
src/components/MyWork/DecisionDetailView.tsx
```

### Komponenty współdzielone (src/components/MyWork/shared/)

```
├── index.ts                    # Eksporty
├── AlternativesSection.tsx     # Alternatywy z pros/cons
├── AttachmentsSection.tsx      # Załączniki
├── CommentsSection.tsx         # Komentarze
├── DeadlineAlertBanner.tsx     # Banner alertu terminu
├── DelegationModal.tsx         # Modal delegacji
├── EscalationRulesSection.tsx  # Przypomnienia i eskalacja
├── LinkedItemsSection.tsx      # Powiązania
├── RiskAssessmentCompact.tsx   # Analiza ryzyka
├── StakeholdersSection.tsx     # Interesariusze (RACI)
├── DecisionReadinessBar.tsx    # Pasek gotowości (nieużywany obecnie)
└── ImpactAssessmentCompact.tsx # Ocena wpływu (nieużywany obecnie)
```

---

## Układ (Layout)

### Struktura główna

```tsx
<div className="h-full flex flex-col bg-white dark:bg-navy-950">
  {/* Header - Tytuł */}
  <header>...</header>

  {/* Content - Dwie kolumny */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Lewa kolumna - 2/3 */}
    <div className="lg:col-span-2">...</div>

    {/* Prawa kolumna - 1/3 */}
    <div className="space-y-4 lg:sticky lg:top-6">...</div>
  </div>
</div>
```

### Responsywność

- Mobile: Jedna kolumna, prawa pod lewą
- Desktop (lg+): Dwie kolumny, prawa sticky

---

## Komponenty lewej kolumny

### 1. Header (Tytuł decyzji)

```tsx
<header className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-800">
  <div className="flex items-center gap-4">
    {/* Przycisk powrotu */}
    <button onClick={onClose}>
      <ChevronLeft />
    </button>

    {/* Tytuł - edytowalny input */}
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder="Decision title..."
      className="text-xl font-bold bg-transparent border-none..."
    />
  </div>
</header>
```

### 2. Problem Description / Context

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl...">
  <div className="flex items-center gap-3 mb-3">
    <FileText className="text-blue-500" />
    <span>Problem description / context</span>
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

```tsx
<CommentsSection
  comments={comments}
  onAddComment={handleAddComment}
  onDeleteComment={handleDeleteComment}
  onLikeComment={handleLikeComment}
  currentUserId={currentUserId}
  expanded={expandedSections.has('comments')}
  onToggleExpand={() => toggleSection('comments')}
/>
```

**Interfejs Comment:**

```typescript
interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  likes: number;
  likedByMe: boolean;
  parentId?: string;
  replies?: Comment[];
}
```

### 4. Risk Analysis (Collapsible)

```tsx
<RiskAssessmentCompact
  risks={risks}
  onAdd={addRisk}
  onUpdate={updateRisk}
  onRemove={removeRisk}
  onGenerateAI={generateRisksAI}
  isGenerating={isGeneratingRisks}
  expanded={expandedSections.has('risk')}
  onToggleExpand={() => toggleSection('risk')}
/>
```

**Interfejs RiskItem:**

```typescript
interface RiskItem {
  id: string;
  title: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category?: string;
  mitigation?: string;
  contingency?: string;
}
```

### 5. Alternatives (Collapsible)

```tsx
<AlternativesSection
  alternatives={alternatives}
  selectedAlternativeId={selectedAlternativeId}
  status={status}
  onAdd={addAlternative}
  onUpdate={updateAlternative}
  onRemove={removeAlternative}
  onSetRecommended={setRecommendedAlternative}
  onSelect={selectAlternative}
  onGenerateAI={generateAlternativesAI}
  isGenerating={isGeneratingAlternatives}
  expanded={expandedSections.has('alternatives')}
  onToggleExpand={() => toggleSection('alternatives')}
/>
```

**Interfejs Alternative:**

```typescript
interface Alternative {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedCost?: number;
  estimatedDuration?: string;
  isRecommended: boolean;
  impactScore?: {
    scope: 'low' | 'medium' | 'high';
    schedule: 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
    quality: 'low' | 'medium' | 'high';
  };
  riskLevel?: 'low' | 'medium' | 'high';
  confidence?: 'low' | 'medium' | 'high';
}
```

---

## Komponenty prawej kolumny

### 1. Deadline Alert Banner

```tsx
<DeadlineAlertBanner dueDate={dueDate} status={status} />
```

- Pokazuje się tylko gdy decyzja jest przeterminowana
- Wyświetla liczbę dni spóźnienia

### 2. Action Buttons (Przyciski akcji)

```tsx
<motion.div className="space-y-2">
  {/* Primary Actions - tylko dla pending */}
  {decisionId && isPending && (
    <>
      <div className="grid grid-cols-2 gap-2">
        {/* Approve - zielona ramka */}
        <motion.button className="border border-emerald-400/60 text-emerald-500...">
          <Check /> Approve
        </motion.button>

        {/* Reject - czerwona ramka */}
        <motion.button className="border border-red-400/60 text-red-500...">
          <X /> Reject
        </motion.button>
      </div>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-2">
        <motion.button className="border border-slate-300...">
          <HelpCircle /> Request Info
        </motion.button>
        <motion.button className="border border-slate-300...">
          <Share2 /> Delegate
        </motion.button>
      </div>
    </>
  )}

  {/* Save - fioletowa ramka, zawsze widoczny */}
  <motion.button className="border border-purple-400/60 text-purple-500...">
    <Save /> Save Changes
  </motion.button>
</motion.div>
```

**Styl przycisków (Outline):**

```css
/* Domyślnie */
border border-[color]-400/60 text-[color]-500

/* Hover */
hover:border-[color]-500 hover:bg-[color]-500/10

/* Kolory */
- Approve: emerald
- Reject: red
- Request Info / Delegate: slate
- Save: purple
```

### 3. Control Panel (Collapsible)

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 rounded-2xl...">
  {/* Header - kliknięcie rozwija/zwija */}
  <motion.button onClick={() => toggleSection('control')}>
    <Flag /> Control
    <ChevronDown />
  </motion.button>

  {/* Content */}
  <AnimatePresence>
    {expandedSections.has('control') && (
      <motion.div>
        {/* Initiative */}
        <div>
          <label>Initiative</label>
          <select>
            <option>Standalone decision</option>
            {availableInitiatives.map(...)}
          </select>
        </div>

        {/* Status */}
        <div>
          <label>Status</label>
          <Dropdown options={STATUS_CONFIG} />
        </div>

        {/* Priority */}
        <div>
          <label>Priority</label>
          <Dropdown options={PRIORITY_CONFIG} />
        </div>

        {/* Category */}
        <div>
          <label>Category</label>
          <Dropdown options={CATEGORY_CONFIG} />
        </div>

        {/* Due Date */}
        <div>
          <label>Due</label>
          <input type="date" />
        </div>

        {/* Requested by / Decider */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>Requested by</label>
            <div>{requesterName}</div>
          </div>
          <div>
            <label>Decider</label>
            <select>{users.map(...)}</select>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

### 4. Stakeholders (RACI) - Collapsible

```tsx
<StakeholdersSection
  stakeholders={stakeholders}
  availableUsers={users}
  onAdd={(userId, role, notificationSettings) => {...}}
  onUpdate={(id, updates) => {...}}
  onRemove={(id) => {...}}
/>
```

**Interfejs Stakeholder:**

```typescript
interface Stakeholder {
  id: string;
  decisionId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: 'responsible' | 'accountable' | 'consulted' | 'informed';
  notificationSettings: StakeholderNotificationSettings;
  notifiedAt?: string;
  acknowledgedAt?: string;
}

interface StakeholderNotificationSettings {
  enabled: boolean;
  triggers: NotificationTrigger[];
  channels: {
    email: boolean;
    inApp: boolean;
  };
}

type NotificationTrigger =
  | 'on_create'
  | 'on_update'
  | 'on_comment'
  | 'on_status_change'
  | 'on_deadline_approaching'
  | 'on_decision_made';
```

### 5. Reminders & Escalation - Collapsible

```tsx
<EscalationRulesSection
  reminders={reminders}
  escalation={escalation}
  thresholds={thresholds}
  availableUsers={users}
  onRemindersChange={setReminders}
  onEscalationChange={setEscalation}
  onThresholdsChange={setThresholds}
  dueDate={dueDate}
/>
```

**Interfejs ReminderRule:**

```typescript
interface ReminderRule {
  id: string;
  type: 'before_due' | 'after_due';
  days: number;
  recipients: 'requester' | 'decider' | 'both' | 'stakeholders';
  inAppNotification: boolean;
  emailNotification: boolean;
  message?: string;
  enabled: boolean;
}
```

**Interfejs EscalationRule:**

```typescript
interface EscalationRule {
  id: string;
  enabled: boolean;
  escalateTo: string;
  escalateToName?: string;
  afterDays: number;
  message?: string;
}
```

**Układ formularza przypomnienia (Grid 2 kolumny):**

```
┌─────────────────┬─────────────────┐
│ Kiedy           │ Dni             │
│ [Before due ▼]  │ [3        ]     │
├─────────────────┴─────────────────┤
│ Do kogo                           │
│ [Decider                       ▼] │
├─────────────────┬─────────────────┤
│ Powiadomienie   │ Email           │
│ [🔔 In-app ◯]   │ [✉️ Send  ◯]    │
├─────────────────┴─────────────────┤
│ Treść (opcjonalnie)               │
│ [                              ]  │
└───────────────────────────────────┘
```

### 6. Attachments - Collapsible

```tsx
<AttachmentsSection
  attachments={attachments}
  onUpload={handleUploadAttachments}
  onDelete={handleDeleteAttachment}
  onDownload={handleDownloadAttachment}
  expanded={expandedSections.has('attachments')}
  onToggleExpand={() => toggleSection('attachments')}
/>
```

**Interfejs Attachment:**

```typescript
interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy?: string;
}
```

### 7. Linked Items - Collapsible

```tsx
<LinkedItemsSection
  items={linkedItems}
  onAdd={handleAddLink}
  onRemove={handleRemoveLink}
  searchItems={searchLinkedItems}
  expanded={expandedSections.has('linkedItems')}
  onToggleExpand={() => toggleSection('linkedItems')}
/>
```

**Interfejs LinkedItem:**

```typescript
interface LinkedItem {
  id: string;
  targetId: string;
  targetType: 'task' | 'decision' | 'risk' | 'issue' | 'document' | 'external';
  targetTitle: string;
  targetStatus?: string;
  relationshipType: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicates' | 'parent' | 'child';
  url?: string;
  createdAt: string;
}
```

---

## Stany i konfiguracje

### STATUS_CONFIG

```typescript
const STATUS_CONFIG = {
  pending: {
    label: { en: 'Pending', pl: 'Oczekująca' },
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  approved: {
    label: { en: 'Approved', pl: 'Zatwierdzona' },
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  rejected: {
    label: { en: 'Rejected', pl: 'Odrzucona' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
  deferred: {
    label: { en: 'Deferred', pl: 'Odroczona' },
    color: 'bg-slate-500',
    textColor: 'text-slate-500',
  },
  escalated: {
    label: { en: 'Escalated', pl: 'Eskalowana' },
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
  },
};
```

### PRIORITY_CONFIG

```typescript
const PRIORITY_CONFIG = {
  low: {
    label: { en: 'Low', pl: 'Niski' },
    color: 'bg-slate-400',
    textColor: 'text-slate-500',
  },
  medium: {
    label: { en: 'Medium', pl: 'Średni' },
    color: 'bg-blue-400',
    textColor: 'text-blue-500',
  },
  high: {
    label: { en: 'High', pl: 'Wysoki' },
    color: 'bg-orange-400',
    textColor: 'text-orange-500',
  },
  critical: {
    label: { en: 'Critical', pl: 'Krytyczny' },
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
};
```

### CATEGORY_CONFIG

```typescript
const CATEGORY_CONFIG = {
  scope_change: { label: { en: 'Scope Change', pl: 'Zmiana zakresu' }, icon: Layers },
  budget_change: { label: { en: 'Budget Change', pl: 'Zmiana budżetu' }, icon: FileText },
  schedule_change: { label: { en: 'Schedule Change', pl: 'Zmiana harmonogramu' }, icon: Calendar },
  resource_allocation: {
    label: { en: 'Resource Allocation', pl: 'Alokacja zasobów' },
    icon: Users,
  },
  risk_response: { label: { en: 'Risk Response', pl: 'Odpowiedź na ryzyko' }, icon: AlertTriangle },
  technical: { label: { en: 'Technical', pl: 'Techniczna' }, icon: FileText },
  strategic: { label: { en: 'Strategic', pl: 'Strategiczna' }, icon: Star },
};
```

---

## Stylowanie

### Wzorzec panelu zwijanego (Collapsible Panel)

```tsx
<motion.div className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
  {/* Header - zawsze widoczny */}
  <motion.button
    whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
    whileTap={{ scale: 0.98 }}
    onClick={onToggleExpand}
    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
  >
    {/* Lewa strona - ikona + tytuł */}
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-[color]-500/10 dark:bg-[color]-500/20">
        <Icon size={18} className="text-[color]-500 dark:text-[color]-400" />
      </div>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</span>
    </div>

    {/* Prawa strona - licznik + strzałka */}
    <div className="flex items-center gap-2">
      {count > 0 && (
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{count}</span>
      )}
      <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronDown size={18} className="text-slate-400" />
      </motion.div>
    </div>
  </motion.button>

  {/* Content - animowany */}
  <AnimatePresence>
    {expanded && (
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: 'auto' }}
        exit={{ height: 0 }}
        className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
      >
        <div className="p-4">{/* Zawartość */}</div>
      </motion.div>
    )}
  </AnimatePresence>
</motion.div>
```

### Kolory ikon w nagłówkach

| Sekcja        | Kolor ikony    | Klasa tła                               |
| ------------- | -------------- | --------------------------------------- |
| Comments      | purple         | `bg-purple-500/10`                      |
| Risk Analysis | emerald/orange | `bg-emerald-500/10` (zależy od poziomu) |
| Alternatives  | amber          | `bg-amber-500/10`                       |
| Control       | purple         | `bg-purple-500/10`                      |
| Stakeholders  | blue           | `bg-blue-500/10`                        |
| Reminders     | amber          | `bg-amber-500/10`                       |
| Attachments   | blue           | `bg-blue-500/10`                        |
| Linked Items  | purple         | `bg-purple-500/10`                      |

### Wspólne klasy dla inputów

```typescript
const INPUT_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-400';

const SELECT_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-400 cursor-pointer';

const LABEL_CLASS = 'text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block';
```

### Pusty stan (Empty State)

```tsx
<div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
  <Icon size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
  <p className="text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
  {!readOnly && (
    <button className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 transition-colors">
      <Plus size={14} />
      {addButtonText}
    </button>
  )}
</div>
```

---

## Internacjonalizacja

### Wzorzec

```typescript
const { i18n } = useTranslation();
const isPolish = i18n.language === 'pl';

// Użycie
{
  isPolish ? 'Tekst polski' : 'English text';
}

// Lub z konfiguracji
{
  isPolish ? config.label.pl : config.label.en;
}
```

### Wszystkie tłumaczenia

| EN                            | PL                        |
| ----------------------------- | ------------------------- |
| Problem description / context | Opis problemu / kontekst  |
| Comments                      | Komentarze                |
| Risk Analysis                 | Analiza ryzyka            |
| Alternatives                  | Alternatywy               |
| Control                       | Sterowanie                |
| Stakeholders (RACI)           | Interesariusze (RACI)     |
| Reminders & Escalation        | Przypomnienia i eskalacja |
| Attachments                   | Załączniki                |
| Linked Items                  | Powiązania                |
| Approve                       | Zatwierdź                 |
| Reject                        | Odrzuć                    |
| Request Info                  | Więcej info               |
| Delegate                      | Deleguj                   |
| Save Changes                  | Zapisz zmiany             |
| Add                           | Dodaj                     |
| Delete                        | Usuń                      |
| Cancel                        | Anuluj                    |
| Before due                    | Przed terminem            |
| After due                     | Po terminie               |
| days                          | dni                       |
| Decider                       | Decydent                  |
| Requester                     | Zgłaszający               |
| Both                          | Obaj                      |
| All Stakeholders              | Wszyscy interesariusze    |
| In-app                        | W aplikacji               |
| Send email                    | Wyślij email              |
| Message (optional)            | Treść (opcjonalnie)       |
| Standalone decision           | Samodzielna decyzja       |
| Initiative                    | Inicjatywa                |
| Status                        | Status                    |
| Priority                      | Priorytet                 |
| Category                      | Kategoria                 |
| Due                           | Termin                    |
| Requested by                  | Zgłosił                   |

---

## Workflow i logika

### Przepływ stanu decyzji

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

### Logika przycisków akcji

```typescript
// Przyciski Approve/Reject/Request Info/Delegate widoczne tylko gdy:
decisionId && status === 'pending';

// Przycisk Save zawsze widoczny
```

### Funkcje obsługi

```typescript
const handleApprove = async () => {
  setStatus('approved');
  // API call
  toast.success('Decision approved');
};

const handleReject = async () => {
  setStatus('rejected');
  // API call
  toast.success('Decision rejected');
};

const handleRequestMoreInfo = async () => {
  // Otwórz modal lub dodaj komentarz
  toast.info('Request sent');
};

const handleSave = async () => {
  setSaving(true);
  // API call z wszystkimi danymi
  setSaving(false);
  toast.success('Changes saved');
};
```

### Zarządzanie sekcjami rozwijanymi

```typescript
const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([]));

const toggleSection = (section: string) => {
  setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    return next;
  });
};
```

### Generowanie AI (Risks, Alternatives)

```typescript
const generateRisksAI = async () => {
  setIsGeneratingRisks(true);
  // Symulacja API call
  await new Promise(resolve => setTimeout(resolve, 2000));

  const aiRisks: RiskItem[] = [
    { id: '...', title: 'AI Generated Risk', probability: 'medium', impact: 'high', ... }
  ];

  setRisks([...risks, ...aiRisks]);
  setIsGeneratingRisks(false);
  toast.success('AI generated risks');
};
```

---

## Podsumowanie

Ten dokument stanowi pełną specyfikację Decision Panel, którą można użyć jako wzorzec do budowy podobnych komponentów:

- Task Panel
- Risk Panel
- Issue Panel
- Change Request Panel

Kluczowe elementy do zachowania spójności:

1. **Layout**: Dwie kolumny (2/3 + 1/3)
2. **Collapsible sections**: Ten sam wzorzec animacji i stylów
3. **Liczniki**: Dyskretne, koło strzałki
4. **Przyciski**: Outline style z subtelnymi kolorami
5. **Formularze**: Ujednolicone rozmiary inputów
6. **Empty states**: Dashed border + ikona + przycisk
7. **Internacjonalizacja**: isPolish ? pl : en
