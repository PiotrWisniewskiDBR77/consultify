# Shared N-Mode Sections — Reusable Card Standard

> **Status:** OBOWIĄZUJĄCY od 2026-02-12  
> **Ostatnia aktualizacja:** 2026-02-12  
> **Zakres:** Wszystkie artefakty (Task, Decision, Notification, Initiative) w N mode i potencjalnie inne widoki.

---

## 1) Zasada główna

Sekcje, które powtarzają się w 2 lub więcej widokach detail view, **MUSZĄ** korzystać ze współdzielonych komponentów z katalogu:

```
src/components/shared/NModeSections/
```

**ZABRONIONE** jest kopiowanie kodu sekcji (inline implementation) do nowych artefaktów.  
Nowe artefakty (np. Initiative, Notification) **MUSZĄ** importować istniejące komponenty.

---

## 2) Katalog współdzielonych sekcji

| Komponent                | Plik                         | Przeznaczenie                                                                            | Używany w      |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------- | -------------- |
| `CommentsCanvas`         | `CommentsCanvas.tsx`         | Wątek komentarzy z priorytetami, filtrem dat, sortowaniem, AI enhance                    | Task, Decision |
| `ActivityLogCanvas`      | `ActivityLogCanvas.tsx`      | Log aktywności ze stat cards i feed chronologicznym                                      | Task, Decision |
| `AttachmentsLinksCanvas` | `AttachmentsLinksCanvas.tsx` | Załączniki (upload/cloud) + powiązane elementy (linked items)                            | Task, Decision |
| `RiskCanvas`             | `RiskCanvas.tsx`             | Rejestr ryzyk z probability/impact/category, score, contingency + mitigation, AI enhance | Task, Decision |
| `GovernanceCanvas`       | `GovernanceCanvas.tsx`       | RACI macierz, Reminders, Escalation rules z CRUD, delivery channels, AI assist           | Task, Decision |

### 2.2) Katalog building blocks (`src/components/shared/NModeBlocks/`)

Niskopoziomowe bloki UI do wielokrotnego użytku WEWNĄTRZ sekcji i w dowolnym kontekście N-mode.

| Komponent          | Plik                   | Przeznaczenie                                                                |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `Callout`          | `Callout.tsx`          | Info/warning/critical/success/purple callout z wariantami, opcjonalną akcją  |
| `ToggleBlock`      | `ToggleBlock.tsx`      | Expandable/collapsible blok z nagłówkiem, badge, controlled/uncontrolled     |
| `EmptyStateInline` | `EmptyStateInline.tsx` | Empty state inline z ikoną, wiadomością, hintem i CTA                        |
| `ChecklistBlock`   | `ChecklistBlock.tsx`   | Interaktywna checklista z progress bar, AI generation, CRUD                  |
| `InlineTable`      | `InlineTable.tsx`      | Lekkie tabele inline (options, KPIs) — generic columns + renderer            |
| `EmbeddedView`     | `EmbeddedView.tsx`     | Embedded lists/tables z mini toolbar, view mode toggle, search, filter, sort |

---

## 3) CommentsCanvas — specyfikacja

### 3.1 Przeznaczenie

Generyczny wątek komentarzy do dowolnego artefaktu. Obsługuje:

- Filtrowanie po dacie (all / today / 7d / 30d)
- Sortowanie (asc / desc)
- Priorytety komentarzy (low / normal / high) z kolorowymi kropkami
- Inline input z AI enhance
- Show more / less (paginacja: 4 → 8 wpisów)
- Usuwanie komentarzy (hover action)

### 3.2 Props (kontrakt)

```typescript
interface CommentsCanvasProps {
  /** Pre-filtered & sorted comments list */
  comments: CommentItem[];
  /** Delete handler */
  onDeleteComment: (id: string) => void;
  /** Current date filter value */
  dateFilter: DateFilter; // 'all' | 'today' | '7d' | '30d'
  /** Date filter change handler */
  onDateFilterChange: (filter: DateFilter) => void;
  /** Current sort order */
  sortOrder: SortOrder; // 'asc' | 'desc'
  /** Sort toggle handler */
  onToggleSort: () => void;
  /** Draft comment text (controlled) */
  commentDraft: string;
  /** Draft text change handler */
  onCommentDraftChange: (value: string) => void;
  /** Submit handler (Enter or Send button) */
  onSubmitComment: () => void;
  /** Current draft priority */
  draftPriority: CommentPriority; // 'low' | 'normal' | 'high'
  /** Priority change handler */
  onDraftPriorityChange: (priority: CommentPriority) => void;
  /** AI enhance handler (omit prop to hide AI button) */
  onAIEnhance?: () => void;
  /** Whether AI enhance is in progress */
  isAIEnhancing?: boolean;
  /** Whether all inputs are locked/disabled (e.g. decision stage locked) */
  locked?: boolean;
  /** Resolve priority → CSS class for colored dot */
  getPriorityDotClass: (priority: CommentPriority) => string;
  /** Resolve comment object → its priority */
  getCommentPriority: (comment: CommentItem) => CommentPriority;
  /** Resolve priority + isActive → button CSS class */
  getPriorityButtonClass: (priority: CommentPriority, isActive: boolean) => string;
  /** Resolve priority → human-readable label */
  getCommentPriorityLabel: (priority: CommentPriority) => string;
  /** Resolve priority → hint/tooltip text */
  getCommentPriorityHint: (priority: CommentPriority) => string;
}
```

### 3.3 Typy danych

```typescript
type CommentPriority = 'low' | 'normal' | 'high';
type DateFilter = 'all' | 'today' | '7d' | '30d';
type SortOrder = 'asc' | 'desc';

interface CommentItem {
  id: string;
  authorName?: string;
  content: string;
  createdAt: string; // ISO timestamp
  isAIGenerated?: boolean;
  priority?: CommentPriority;
}
```

### 3.4 Visual standard (MUST)

| Element                      | Specyfikacja                                                    |
| ---------------------------- | --------------------------------------------------------------- |
| **Avatar**                   | `w-6 h-6 rounded-full bg-primary-500/15` — pierwszy znak autora |
| **Priority dot**             | `w-1.5 h-1.5 rounded-full` — kolor zależny od priorytetu        |
| **Priority buttons (L/N/H)** | `w-6 h-6 rounded-full border text-[10px] font-bold`             |
| **AI badge**                 | `text-[9px] text-purple-500 font-medium` — "AI" obok daty       |
| **Date format**              | `toLocaleDateString()`                                          |
| **Delete button**            | `opacity-0 group-hover:opacity-100` — pojawia się na hover      |
| **Empty state**              | Centered text `text-xs text-slate-400`                          |
| **Input border**             | `border-t border-slate-200/40 dark:border-navy-700/40`          |
| **Pagination**               | Max 4 widocznych, po "More" → max 8                             |

### 3.4.1 Composer i interakcje (alignment v1.4)

- Composer action order:
  - `Send` po lewej stronie,
  - `AI` po prawej stronie.
- Hover na wierszu komentarza ujawnia akcję usunięcia.
- Edycja komentarza jest dozwolona (inline lub przez dedykowaną akcję edit).
- Metadane wpisu są obowiązkowe: autor + data/czas.
- Komentarze AI muszą mieć widoczny znacznik `AI`.

### 3.5 Integracja (wzorzec)

Komponent rodzica odpowiada za:

1. Filtrowanie i sortowanie komentarzy **przed** przekazaniem do `comments` prop
2. Mapowanie lokalnego typu `Comment` na `CommentItem` (adapter `useMemo`)
3. Obsługę submit/delete/AI (logika biznesowa + API calls)
4. Dostarczenie funkcji stylowania priorytetów

```tsx
// Przykład użycia w nowym artefakcie:
import { CommentsCanvas } from '@/components/shared/NModeSections/CommentsCanvas';
import type {
  CommentItem,
  CommentPriority,
  DateFilter,
  SortOrder,
} from '@/components/shared/NModeSections/CommentsCanvas';

// W komponencie:
const nModeComments: CommentItem[] = useMemo(
  () =>
    filteredComments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt,
      isAIGenerated: c.isAIGenerated,
      priority: getCommentPriority(c) as CommentPriority,
    })),
  [filteredComments]
);

<CommentsCanvas
  comments={nModeComments}
  onDeleteComment={handleDeleteComment}
  dateFilter={dateFilter}
  onDateFilterChange={setDateFilter}
  sortOrder={sortOrder}
  onToggleSort={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
  commentDraft={draft}
  onCommentDraftChange={setDraft}
  onSubmitComment={submitComment}
  draftPriority={draftPriority}
  onDraftPriorityChange={setDraftPriority}
  onAIEnhance={enhanceWithAI}
  isAIEnhancing={isEnhancing}
  locked={isLocked}
  getPriorityDotClass={getPriorityDotClass}
  getCommentPriority={getCommentPriority}
  getPriorityButtonClass={getPriorityButtonClass}
  getCommentPriorityLabel={getCommentPriorityLabel}
  getCommentPriorityHint={getCommentPriorityHint}
/>;
```

---

## 4) ActivityLogCanvas — specyfikacja

### 4.1 Przeznaczenie

Generyczny log aktywności / audit trail dla dowolnego artefaktu. Obsługuje:

- Summary stat cards (4 metryki: Entries, Changes, Escalations, Collaboration)
- Chronologiczny feed z ikonami typów, timestampami, zmianami old→new
- Opcjonalne custom stat cards (nadpisują domyślne 4)

### 4.2 Props (kontrakt)

```typescript
interface ActivityLogCanvasProps {
  /** Sorted activity log entries (pre-sorted by caller) */
  entries: ActivityLogEntry[];
  /** Summary statistics */
  stats: ActivityStats;
  /** Function resolving entry type → icon, label, CSS style */
  typeMeta: (type: string) => ActivityTypeMeta;
  /** Current time filter value */
  timeFilter?: 'all' | '7d' | '30d' | '90d';
  /** Time filter change handler */
  onTimeFilterChange?: (filter: 'all' | '7d' | '30d' | '90d') => void;
  /** Current sort direction */
  sortOrder?: 'desc' | 'asc';
  /** Sort direction change handler */
  onSortOrderChange?: (order: 'desc' | 'asc') => void;
  /** Optional custom stat cards (overrides default 4-card grid) */
  customStats?: { label: { en: string; pl: string }; value: number }[];
}
```

### 4.3 Typy danych

```typescript
interface ActivityLogEntry {
  id: string;
  type: string; // e.g. 'created', 'status_change', 'approved', etc.
  description: string;
  timestamp: string; // ISO timestamp
  userName?: string;
  oldValue?: string;
  newValue?: string;
}

interface ActivityStats {
  total: number;
  edited: number;
  escalations: number;
  collaboration: number;
}

interface ActivityTypeMeta {
  icon: React.ReactNode; // Lucide icon, size={12}
  label: string; // Human label (i18n)
  style: string; // Tailwind classes for icon badge
}
```

### 4.4 Visual standard (MUST)

| Element             | Specyfikacja                                                        |
| ------------------- | ------------------------------------------------------------------- |
| **Stat cards**      | `grid grid-cols-1 md:grid-cols-4 gap-2` — `rounded-xl border`       |
| **Stat label**      | `text-[11px] uppercase tracking-wide text-slate-400`                |
| **Stat value**      | `text-sm font-semibold text-slate-700 dark:text-slate-200`          |
| **Header controls** | Prawy górny róg: time filter (`All/7/30/90`) + sort toggle          |
| **Feed container**  | `rounded-2xl border` z `p-3`                                        |
| **Feed entry**      | `grid grid-cols-[auto_1fr_auto] gap-3` — ikona + treść + type badge |
| **Icon badge**      | `w-6 h-6 rounded-lg border` — kolor z `typeMeta.style`              |
| **Timestamp**       | `text-[11px] text-slate-400` — `toLocaleString()`                   |
| **Type badge**      | `text-[10px] font-mono uppercase tracking-wide text-slate-300`      |
| **Old→New**         | `text-[11px] text-slate-500` — "From: X → To: Y"                    |
| **Empty state**     | `rounded-2xl border-dashed p-6 text-center text-xs`                 |
| **Section title**   | `text-lg font-semibold` — rendered inside component                 |

### 4.5 Obsługiwane typy aktywności

Każdy artefakt definiuje własną mapę `typeMeta`. Poniżej kanoniczne typy:

#### Wspólne (wszystkie artefakty):

| Type            | Icon             | Label (EN)    | Style pattern            |
| --------------- | ---------------- | ------------- | ------------------------ |
| `created`       | Plus/Check       | Created       | `emerald` family         |
| `status_change` | CheckCircle/Flag | Status change | `blue`/`violet` family   |
| `assignment`    | User/UserCheck   | Assignment    | `purple`/`sky` family    |
| `comment`       | MessageSquare    | Comment       | `amber`/`indigo` family  |
| `edit`          | Edit3            | Edit          | `slate`/`cyan` family    |
| `deadline`      | Calendar         | Deadline      | `red`/`rose` family      |
| `priority`      | Flag             | Priority      | `orange`/`violet` family |

#### Decision-specific:

| Type        | Icon    | Label (EN) | Style pattern    |
| ----------- | ------- | ---------- | ---------------- |
| `approved`  | Check   | Approval   | `emerald` family |
| `rejected`  | X       | Rejection  | `red` family     |
| `escalated` | ArrowUp | Escalation | `amber` family   |
| `deferred`  | Clock   | Deferral   | `slate` family   |

### 4.6 Integracja (wzorzec)

```tsx
import { ActivityLogCanvas } from '@/components/shared/NModeSections/ActivityLogCanvas';
import type {
  ActivityLogEntry as NModeActivityLogEntry,
  ActivityStats,
  ActivityTypeMeta,
} from '@/components/shared/NModeSections/ActivityLogCanvas';

// Mapping entries (pre-sorted):
const nModeActivityEntries: NModeActivityLogEntry[] = useMemo(
  () =>
    activityLogSorted.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      timestamp: e.timestamp,
      userName: e.userName,
      oldValue: e.oldValue,
      newValue: e.newValue,
    })),
  [activityLogSorted]
);

// Stats calculation:
const nModeActivityStats: ActivityStats = useMemo(
  () => ({
    total: activityLog.length,
    edited: activityLog.filter((e) => ['edit', 'status_change'].includes(e.type)).length,
    escalations: activityLog.filter((e) => ['deadline', 'priority'].includes(e.type)).length,
    collaboration: activityLog.filter((e) => ['comment', 'assignment'].includes(e.type)).length,
  }),
  [activityLog]
);

// Type metadata (artifact-specific):
const nModeActivityTypeMeta = (type: string): ActivityTypeMeta => {
  const MAP: Record<string, ActivityTypeMeta> = {
    created: { icon: <Plus size={12} />, label: 'Created', style: '...' },
    // ... artifact-specific types
  };
  return MAP[type] || { icon: <Clock size={12} />, label: type, style: '...' };
};

<ActivityLogCanvas
  entries={nModeActivityEntries}
  stats={nModeActivityStats}
  typeMeta={nModeActivityTypeMeta}
  timeFilter={activityTimeFilter}
  onTimeFilterChange={setActivityTimeFilter}
  sortOrder={activitySortOrder}
  onSortOrderChange={setActivitySortOrder}
/>;
```

### 4.7 Reguła spójności stylów typeMeta (SHOULD)

Aby zachować spójność kolorystyczną między artefaktami, style `typeMeta` powinny używać wzorca:

```
text-{color}-500 bg-{color}-500/10 border-{color}-400/30
```

Gdzie `{color}` jest jednym z: `emerald`, `red`, `amber`, `sky`, `indigo`, `violet`, `cyan`, `slate`, `rose`, `orange`.

**Icon size:** zawsze `size={12}` (12px) w `ActivityLogCanvas`.

---

## 5) AttachmentsLinksCanvas — specyfikacja

### 5.1 Przeznaczenie

Połączony widok załączników (file upload + cloud providers) i powiązanych elementów (linked items).

Uwaga dla nowego standardu `N-mode`:

- jeśli artefakt ma osobną kartę `Related Context` / `Powiązany kontekst`, powiązane elementy powinny żyć w tej karcie,
- `AttachmentsLinksCanvas` może wtedy obsługiwać głównie załączniki albo być rozdzielony na osobne powierzchnie,
- nie dublujemy pełnego bloku linked items / AI-detected links na dole innych kart,
- wyjątek: krótki inline reference w konkretnej karcie, jeśli jest konieczny dla zrozumienia danego pola.

### 5.2 Props (kontrakt)

```typescript
interface AttachmentsLinksCanvasProps {
  /** Uploaded attachments */
  attachments: Attachment[];
  /** Upload handler (file input) */
  onUploadAttachments: (files: FileList) => Promise<void>;
  /** Delete attachment */
  onDeleteAttachment: (id: string) => Promise<void>;
  /** Edit attachment metadata */
  onEditAttachment?: (id: string, patch: Partial<Attachment>) => void;
  /** Linked items list */
  linkedItems: LinkedItem[];
  /** Add linked item */
  onAddLinkedItem: (item: LinkedItem) => Promise<void>;
  /** Remove linked item */
  onRemoveLinkedItem: (item: Pick<LinkedItem, 'id' | 'type'>) => Promise<void>;
  /** Edit linked item */
  onEditLinkedItem?: (key: string, patch: Partial<LinkedItem>) => void;
  /** Navigate to linked item */
  onNavigateLinkedItem?: (item: LinkedItem) => void;
  /** Search for linkable items */
  searchLinkedItems?: (query: string) => Promise<LinkedItem[]>;
  /** Whether view is read-only */
  readOnly?: boolean;
}
```

### 5.3 Visual standard (MUST)

| Element              | Specyfikacja                                             |
| -------------------- | -------------------------------------------------------- |
| **Section layout**   | Dwie sub-sekcje: Attachments + Linked Items              |
| **File card**        | Ikona pliku + nazwa + rozmiar + data + delete action     |
| **Cloud badge**      | Google Drive / OneDrive / Dropbox ikona                  |
| **Linked item card** | Type badge (TASK/DECISION/INITIATIVE) + title + navigate |
| **Empty states**     | Inline empty state z CTA "Upload" / "Link item"          |
| **Read-only**        | Ukrywa przyciski add/delete/edit                         |

---

## 8) GovernanceCanvas / Dependencies / Checklist — alignment notes (v1.4+)

### 8.1 GovernanceCanvas (RACI + Reminders + Escalation)

- Układ referencyjny: 3 tabele widoczne od razu (`RACI`, `Reminders`, `Escalation`).
- Akcje `+ Add ...` w prawym górnym rogu kart tabel (wariant outlined/framed).
- Powiadomienia jako chipy kanałów mogą być kolorowane dla czytelności.
- Pilność nie jest kodowana tym samym kolorem; pilność ma osobny badge.
- Dozwolone multi-role assignment; email może być ukryty na rzecz kontekstu organizacji.

### 8.2 Dependencies presentation

- Sekcja ma utrzymywać nagłówek tabeli nawet w stanie pustym.
- `+ Add dependency` w prawym górnym rogu, bez ciężkiego tła (outlined/light).
- Globalna akcja AI (`Analyze dependencies`) pozostaje w górnym CTA,
  a nie obok lokalnego przycisku add.
- Sugestie AI są edytowalne przed zatwierdzeniem.

### 8.3 ChecklistBlock presentation

- Jedyny manualny add action: top-right `+ Add item` (bez duplikatu pod listą).
- W stanie pustym renderowany jest 1 domyślny pusty wiersz do edycji.
- Na hover elementu listy ujawnia się usuwanie (ikona kosza).
- Widoczny licznik postępu (`done/total`) obok nagłówka sekcji.

## 5b) RiskCanvas — specyfikacja

### 5b.1 Przeznaczenie

Generyczny rejestr ryzyk dla dowolnego artefaktu. Obsługuje:

- Lista kart ryzyk posortowanych po score (P x I)
- Selektory probability / impact / category
- Score badge z kolorami zależnymi od poziomu
- Textareas contingency + mitigation z quick-action buttons
- AIFieldEnhancer per pole ryzyka
- Legenda poziomów
- AI generate risks button (opcjonalnie)
- Lock state (readOnly dla np. zamkniętego etapu decyzji)

### 5b.2 Props (kontrakt)

```typescript
interface RiskCanvasProps {
  /** Risk items (unsorted — component sorts by score internally) */
  risks: RiskItem[];
  /** Add new empty risk */
  onAddRisk: () => void;
  /** Update fields on a risk */
  onUpdateRisk: (id: string, updates: Partial<RiskItem>) => void;
  /** Remove a risk by id */
  onRemoveRisk: (id: string) => void;
  /** AI generate risks handler (omit to hide AI button) */
  onAIGenerate?: () => void;
  /** Whether AI generation is in progress */
  isGeneratingAI?: boolean;
  /** Whether inputs are locked/read-only */
  locked?: boolean;
  /** Artifact type for AIFieldEnhancer context */
  artifactType: 'task' | 'decision' | 'initiative' | 'notification';
  /** Artifact context for AIFieldEnhancer */
  artifactContext: { title: string; status: string; priority: string; type: string };
  /** Unique prefix for AI field keys (e.g. 't' for task, 'n' for decision) */
  fieldKeyPrefix: string;
}
```

### 5b.3 Typy danych

```typescript
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RiskItem {
  id: string;
  title: string;
  probability: RiskLevel;
  impact: RiskLevel;
  category?: string;
  mitigation: string;
  contingency: string;
}
```

### 5b.4 Visual standard (MUST)

| Element           | Specyfikacja                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **Risk card**     | `p-5 rounded-xl bg-slate-50/20 dark:bg-navy-900/25 space-y-5`                            |
| **Title input**   | `text-sm font-medium bg-transparent`                                                     |
| **Score badge**   | `px-1.5 py-0.5 rounded border text-[10px] font-semibold` — kolor zależny od score        |
| **Selectors**     | `grid grid-cols-1 md:grid-cols-3 gap-2` — probability / impact / category                |
| **Two-column**    | `grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6` — contingency + mitigation              |
| **Textarea**      | `min-h-[92px] text-xs bg-transparent border-b`                                           |
| **Quick buttons** | `text-[10px] px-1.5 py-0.5 rounded border` — red for contingency, emerald for mitigation |
| **Level legend**  | `text-[10px]` badges w kolorach poszczególnych poziomów                                  |
| **Empty state**   | `AlertTriangle` icon + centered text + CTA                                               |
| **Delete**        | `opacity-0 group-hover:opacity-100` — hover reveal                                       |

### 5b.5 Score calculation

```
Score = riskLevelToScore(probability) × riskLevelToScore(impact)
Mapping: low=1, medium=2, high=3, critical=4
Range: 1-16

Colors:
- Score >= 12: red (critical)
- Score >= 8:  amber (high)
- Score >= 4:  yellow (medium)
- Score < 4:   emerald (low)
```

### 5b.6 Integracja (wzorzec)

```tsx
import { RiskCanvas } from '@/components/shared/NModeSections/RiskCanvas';

<RiskCanvas
  risks={risks}
  onAddRisk={addRisk}
  onUpdateRisk={updateRisk}
  onRemoveRisk={removeRisk}
  onAIGenerate={generateRisksAI}
  isGeneratingAI={isGeneratingRisks}
  locked={isLocked}
  artifactType="task"
  artifactContext={{ title, status, priority, type: 'task' }}
  fieldKeyPrefix="t"
/>;
```

Komponent rodzica odpowiada za:

1. State management (`risks`, `setRisks`)
2. Mutacje (`addRisk`, `updateRisk`, `removeRisk`) — z ewentualnym lock check
3. AI generation logic (`generateRisksAI`)
4. Dostarczenie `artifactContext` i `fieldKeyPrefix`

---

## 6) Sekcje specyficzne per artefakt (NIE współdzielone)

Poniższe sekcje **różnią się** między artefaktami i NIE powinny być w `NModeSections/`:

### Task-specific:

| Sekcja               | ID                  | Opis                                         |
| -------------------- | ------------------- | -------------------------------------------- |
| Task Scope           | `description-scope` | Scope + expected outcome + related items     |
| Implementation Ideas | `implementation`    | Lista pomysłów implementacyjnych z votingiem |
| Checklist            | `checklist`         | Checklista z progress counter                |
| Dependencies         | `dependencies`      | Gantt-style dependency management            |

### Decision-specific:

| Sekcja               | ID                  | Opis                                            |
| -------------------- | ------------------- | ----------------------------------------------- |
| Decision Scope       | `context-problem`   | Scope + additional context                      |
| Options & Trade-offs | `options-tradeoffs` | Tabela alternatyw z pros/cons                   |
| Consequences         | `consequences`      | Scenariusze AI (optimistic/neutral/pessimistic) |

#### Decision `Options & Trade-offs` — standard interakcji (v1.7)

- Sekcja zachowuje model dual-path:
  - manual: lokalny przycisk `+ Add option` w prawym górnym rogu sekcji,
  - AI: globalna akcja CTA `Generate options`.
- AI nie zastępuje manualnej ścieżki tworzenia opcji.
- `+ Add option` w wariancie outlined/light, spójnie z innymi sekcjami tabelarycznymi.
- Minimalny kontrakt danych opcji:
  - tytuł opcji,
  - `Pros`,
  - `Cons`.
- Każda akcja na opcji (add/edit/delete/generate) powinna zasilać `Activity Log`.

### Zrealizowane ekstrakcje (z inline do shared):

| Sekcja            | ID (Task)    | ID (Decision)           | Status           | Uwagi                                                                                                  |
| ----------------- | ------------ | ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| RACI & Escalation | `governance` | `governance-escalation` | **Zrealizowane** | `GovernanceCanvas` — pełny CRUD RACI/Reminders/Escalation z modali, delivery channels, AI suggestions. |

### Nazewnictwo pierwszej sekcji (scope-first)

Pierwsza sekcja każdego artefaktu używa wspólnej konwencji `... Scope`:

- `Task Scope`
- `Decision Scope`
- `Notification Scope`
- `Initiative Scope`

### Initiative `Success Criteria` card (N-mode baseline)

- Karta składa się z 3 podkart: `Target State`, `Success Criteria`, `Deliverables`.
- W nagłówku całej karty nie pokazujemy dodatkowego przycisku `AI`.
- W podkartach:
  - `+ Add item` jest lekką akcją tekstową (bez ramki),
  - `AI` pozostaje lokalną akcją podkarty.
- Wiersz checklisty: checkbox -> tekst inline -> delete na hover.

---

## 6b) GovernanceCanvas — specyfikacja

### 6b.1 Przeznaczenie

Ujednolicona sekcja RACI & Escalation do dowolnego artefaktu. Obsługuje:

- **RACI Table** — macierz odpowiedzialności z CRUD na stakeholderach
- **Reminders Table** — zarządzanie przypomnień before/after due
- **Escalation Table** — reguły eskalacji z progami W/C, trybami, delivery channels
- **Modals** — edycja/dodawanie z pełną konfiguracją kanałów (core + integration + sync targets)
- **AI** — opcjonalne suggestowanie RACI, reminders, escalation via callbacki
- **Locked state** — dla read-only artefaktów (np. Decision stage lock)

### 6b.2 Props (kontrakt)

```typescript
interface GovernanceCanvasProps {
  stakeholders: Stakeholder[];
  setStakeholders: React.Dispatch<React.SetStateAction<Stakeholder[]>>;
  reminders: ReminderRuleWithDelivery[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderRuleWithDelivery[]>>;
  escalationRules: EscalationRuleWithConfig[];
  setEscalationRules: React.Dispatch<React.SetStateAction<EscalationRuleWithConfig[]>>;
  users: GovernanceUser[];
  artifactId: string;
  locked?: boolean;
  onAISuggestStakeholders?: () => void;
  isSuggestingStakeholders?: boolean;
  onAISuggestReminders?: () => void;
  isSuggestingReminders?: boolean;
  onAISuggestEscalations?: () => void;
  isSuggestingEscalations?: boolean;
  onAISuggestStakeholderDraft?: () => void;
}
```

### 6b.3 Eksportowane typy

- `GovernanceCanvasProps`, `GovernanceUser`
- `ReminderRuleWithDelivery`, `EscalationRuleWithConfig`
- `EscalationMode`, `CoreDeliveryChannel`, `IntegrationChannel`, `DeliveryConfig`

### 6b.4 Visual standard

| Element       | Styl                                                            |
| ------------- | --------------------------------------------------------------- |
| Table card    | `bg-white/70 dark:bg-navy-900/70 rounded-2xl border h-[340px]`  |
| Modal overlay | `fixed inset-0 z-[120] bg-black/60`                             |
| Modal dialog  | `rounded-3xl shadow-2xl max-w-2xl p-6`                          |
| Channel chip  | `px-2 py-1 rounded-md border text-[11px]` active: purple accent |
| Badge         | `px-1.5 py-0.5 rounded border text-[10px]`                      |
| AI button     | Purple accent z `Sparkles` icon                                 |

### 6b.5 Wzorzec integracji (parent)

```tsx
<GovernanceCanvas
  stakeholders={stakeholders}
  setStakeholders={setStakeholders}
  reminders={reminders as ReminderRuleWithDelivery[]}
  setReminders={setReminders as any}
  escalationRules={escalationRules}
  setEscalationRules={setEscalationRules}
  users={users}
  artifactId={taskId || decisionId || 'new'}
  locked={isDecisionStageLocked}
  onAISuggestStakeholders={suggestStakeholdersAI}
  isSuggestingStakeholders={isSuggestingStakeholders}
  onAISuggestEscalations={suggestEscalationsAI}
  isSuggestingEscalations={isSuggestingEscalations}
/>
```

---

## 6c) NModeBlocks — building blocks (specyfikacja zbiorcza)

Katalog: `src/components/shared/NModeBlocks/`

### 6c.1 Callout

Blok informacyjny z wariantami wizualnymi.

| Prop       | Typ                                                          | Opis                      |
| ---------- | ------------------------------------------------------------ | ------------------------- |
| `variant`  | `'info' \| 'warning' \| 'critical' \| 'success' \| 'purple'` | Wariant wizualny          |
| `icon`     | `LucideIcon`                                                 | Custom ikona (opcjonalna) |
| `title`    | `string`                                                     | Nagłówek (opcjonalny)     |
| `children` | `ReactNode`                                                  | Treść callout             |
| `compact`  | `boolean`                                                    | Mniejszy padding i tekst  |
| `action`   | `{ label, onClick }`                                         | Opcjonalny link/przycisk  |

### 6c.2 ToggleBlock

Expandable/collapsible blok. Controlled lub uncontrolled.

| Prop          | Typ                       | Opis                       |
| ------------- | ------------------------- | -------------------------- |
| `title`       | `string`                  | Nagłówek                   |
| `badge`       | `string \| number`        | Badge obok tytułu          |
| `defaultOpen` | `boolean`                 | Start state (uncontrolled) |
| `open`        | `boolean`                 | Controlled state           |
| `onToggle`    | `(open: boolean) => void` | Toggle handler             |
| `icon`        | `ReactNode`               | Ikona przed tytułem        |
| `children`    | `ReactNode`               | Treść                      |

### 6c.3 EmptyStateInline

Empty state w obrębie sekcji z CTA.

| Prop      | Typ                            | Opis                          |
| --------- | ------------------------------ | ----------------------------- |
| `icon`    | `LucideIcon`                   | Ikona (default: Inbox)        |
| `message` | `string`                       | Główna wiadomość              |
| `hint`    | `string`                       | Dodatkowa wskazówka           |
| `action`  | `{ label, onClick, disabled }` | CTA button                    |
| `dashed`  | `boolean`                      | Border dashed (default: true) |

### 6c.4 ChecklistBlock

Interaktywna checklista z progress tracking.

| Prop             | Typ                  | Opis                               |
| ---------------- | -------------------- | ---------------------------------- |
| `items`          | `ChecklistItem[]`    | Lista elementów                    |
| `onToggle`       | `(id) => void`       | Toggle completion                  |
| `onUpdateText`   | `(id, text) => void` | Edycja tekstu                      |
| `onAdd`          | `() => void`         | Dodaj element                      |
| `onRemove`       | `(id) => void`       | Usuń element                       |
| `onAIGenerate`   | `() => void`         | AI generate (opcjonalny)           |
| `isGeneratingAI` | `boolean`            | AI loading state                   |
| `locked`         | `boolean`            | Read-only                          |
| `showProgress`   | `boolean`            | Pokaż progress bar (default: true) |

### 6c.5 InlineTable

Lekka tabela (bez sortowania, bez paginacji).

| Prop           | Typ                      | Opis                        |
| -------------- | ------------------------ | --------------------------- |
| `columns`      | `InlineTableColumn<T>[]` | Definicje kolumn z renderem |
| `data`         | `T[]`                    | Dane wierszy                |
| `rowKey`       | `(row, idx) => string`   | Key extractor               |
| `emptyMessage` | `string`                 | Wiadomość pustego stanu     |
| `caption`      | `string`                 | Nagłówek tabeli             |
| `compact`      | `boolean`                | Mniejszy padding            |
| `striped`      | `boolean`                | Paski na wierszach          |

### 6c.6 EmbeddedView

Embedded list/table z mini toolbar (linked database style).

| Prop           | Typ                  | Opis                       |
| -------------- | -------------------- | -------------------------- |
| `title`        | `string`             | Tytuł sekcji               |
| `count`        | `number`             | Badge z liczbą elementów   |
| `viewModes`    | `EmbeddedViewMode[]` | Dostępne widoki            |
| `activeMode`   | `EmbeddedViewMode`   | Aktualny widok             |
| `onModeChange` | `(mode) => void`     | Zmiana widoku              |
| `onAdd`        | `() => void`         | Dodaj nowy element         |
| `onLink`       | `() => void`         | Połącz istniejący          |
| `onOpenFull`   | `() => void`         | Otwórz pełny widok         |
| `onSearch`     | `(query) => void`    | Szukaj                     |
| `onFilter`     | `() => void`         | Filtruj                    |
| `onSort`       | `() => void`         | Sortuj                     |
| `readOnly`     | `boolean`            | Read-only                  |
| `loading`      | `boolean`            | Loading overlay            |
| `children`     | `ReactNode`          | Treść (lista/tabela/board) |

---

## 7) Zasady rozszerzania (MUST)

### 7.1 Dodawanie nowego artefaktu

1. Sprawdź, które sekcje pokrywają się z istniejącymi (`CommentsCanvas`, `ActivityLogCanvas`, `AttachmentsLinksCanvas`, `RiskCanvas`, `GovernanceCanvas`)
2. Zaimportuj i użyj istniejących komponentów — **NIE kopiuj kodu**
3. Przygotuj adapter `useMemo` mapujący lokalne typy na typy komponentu
4. Sekcje unikalne dla artefaktu implementuj inline w `*DetailView.tsx`

### 7.2 Dodawanie nowej współdzielonej sekcji

Gdy sekcja pojawia się w 2+ artefaktach:

1. Wyekstrahuj komponent do `src/components/shared/NModeSections/NewSectionCanvas.tsx`
2. Zdefiniuj interfejs props z generycznymi typami (nie zakładaj konkretnego artefaktu)
3. Dodaj `locked?: boolean` prop jeśli artefakt może być w stanie read-only
4. Użyj `useTranslation` dla i18n (PL/EN)
5. Dodaj export w `src/components/shared/NModeSections/index.ts`
6. Zaktualizuj ten dokument

### 7.3 Naming convention

- Komponent: `{Section}Canvas` (np. `CommentsCanvas`, `ActivityLogCanvas`)
- Plik: `{Section}Canvas.tsx`
- Typy eksportowane z tego samego pliku
- Prefix `NMode` w typach importowanych z aliasem (np. `NModeActivityLogEntry`)

---

## 8) Migration checklist

Przy migracji inline sekcji na współdzielony komponent:

- [ ] Zidentyfikuj wszystkie różnice między implementacjami w różnych artefaktach
- [ ] Wybierz "golden" implementację (zazwyczaj ta z `CommentsCanvas`/`ActivityLogCanvas`)
- [ ] Upewnij się, że `locked` prop jest obsługiwany (Decision stage lock)
- [ ] Zamień inline JSX na `<ComponentCanvas {...mappedProps} />`
- [ ] Dodaj adapter `useMemo` mapujący lokalne typy
- [ ] Usuń nieużywane stany lokalne (np. `showMoreComments`, `hoveredCommentPriority`)
- [ ] Usuń nieużywane importy (np. `DateFilterSortControl` jeśli było używane tylko inline)
- [ ] Sprawdź linter i TypeScript
- [ ] Przetestuj wizualnie oba artefakty

---

## Historia zmian

- 2026-02-12: Utworzenie dokumentu. Ujednolicono Comments i Activity Log między Task a Decision (migracja na CommentsCanvas i ActivityLogCanvas). Opisano standard dla 3 współdzielonych sekcji N-mode.
- 2026-02-12: Dodano RiskCanvas — wyekstrahowano sekcję Risk & Impact z Task i Decision do wspólnego komponentu. Opisano standard, kontrakt, typy i wzorce integracji.
- 2026-02-12: Dodano GovernanceCanvas — pełna ekstrakcja RACI, Reminders i Escalation (CRUD + modali + delivery channels + AI) do współdzielonego komponentu. RACI & Escalation nie jest już odłożone.
- 2026-02-12: Dodano katalog NModeBlocks — 6 building blocks (Callout, ToggleBlock, EmptyStateInline, ChecklistBlock, InlineTable, EmbeddedView). Biblioteka N-mode jest teraz kompletna.
