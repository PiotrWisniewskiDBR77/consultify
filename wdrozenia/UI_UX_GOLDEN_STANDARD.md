# UI/UX Golden Standard - Consultify

## Wersja: 1.0
## Data: 2026-01-20

---

## 1. Wprowadzenie

Ten dokument definiuje **Golden Standard** interfejsu użytkownika dla wszystkich modułów aplikacji Consultify. Standard oparty jest na komponentach `ModuleHub` i zapewnia spójne doświadczenie użytkownika (UX) we wszystkich częściach systemu.

### Moduły objęte standardem

Wszystkie moduły dostępne z sidebara:
- My Work
- Interview
- Tools
- Assessment (wzorzec referencyjny)
- Initiatives
- Execution
- Benefits
- Economics
- Reports

---

## 2. Architektura komponentów

### 2.1 Hierarchia komponentów

```
ModuleHub
├── ModuleNavBar (górny pasek nawigacji)
│   ├── Search Button
│   ├── Main Tabs (z licznikami)
│   ├── Status Filters (opcjonalne)
│   ├── View Mode Toggle
│   └── Action Button (+ New Item)
├── DynamicTabs (dynamiczne menu dokumentów)
│   ├── List Button
│   └── Document Tabs (max 6)
├── ActiveFilters (aktywne filtry)
└── Content Area
    ├── FilterableTable (widok listy)
    ├── GridView (widok kart)
    ├── KanbanView (widok kanban)
    ├── TimelineView (widok timeline)
    └── CalendarView (widok kalendarza)
```

### 2.2 Lokalizacja plików źródłowych

```
src/components/shared/ModuleHub/
├── ModuleHub.tsx         # Główny kontener
├── ModuleNavBar.tsx      # Pasek nawigacji
├── DynamicTabs.tsx       # Dynamiczne taby dokumentów
├── FilterableTable.tsx   # Tabela z filtrami
├── GridView.tsx          # Widok kart/siatki
├── ActiveFilters.tsx     # Pasek aktywnych filtrów
├── types.ts              # Typy TypeScript
└── index.ts              # Eksporty
```

---

## 3. Górny pasek nawigacji (ModuleNavBar)

### 3.1 Struktura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [🔍] [Tab1 N] [Tab2 N] [Tab3 N] | [Status1] [Status2] ... | [≡][⊞][⊟][📅] [+ New] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Search Button

```tsx
// Styl nieaktywny
className="p-2 rounded-lg border bg-navy-800 border-navy-600 text-slate-400
           hover:text-white hover:border-slate-500"

// Styl aktywny
className="p-2 rounded-lg border bg-primary-500/15 border-primary-500 text-primary-400"
```

**Zachowanie:**
- Kliknięcie rozwija pole wyszukiwania pod paskiem
- Escape lub X zamyka i czyści wyszukiwanie
- Wyszukiwanie w czasie rzeczywistym (debounce 300ms)

### 3.3 Main Tabs (Taby główne)

```tsx
// Styl bazowy
const BUTTON_BASE = `
  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
  border transition-all duration-200
`;

// Styl nieaktywny
const BUTTON_INACTIVE = `
  ${BUTTON_BASE}
  bg-navy-800 border-navy-600 text-slate-300
  hover:bg-navy-700 hover:border-slate-500 hover:text-white
`;

// Styl aktywny
const BUTTON_ACTIVE = `
  ${BUTTON_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;
```

**Struktura taba:**
```tsx
<button className={isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE}>
  {tab.icon}
  <span>{tab.label}</span>
  <span className="px-1.5 py-0.5 text-xs rounded-full bg-navy-700 text-slate-400">
    {tab.count}
  </span>
</button>
```

### 3.4 Status Filters (opcjonalne)

Używane w modułach z filtrowaniem po statusie (np. Initiatives, Execution).

```tsx
<button className={`
  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
  border transition-all duration-200
  ${isActive 
    ? 'bg-primary-500/15 border-primary-500 text-primary-400'
    : 'bg-navy-800/50 border-navy-600 text-slate-400 hover:text-white hover:border-slate-500'
  }
`}>
  <span className={`w-2 h-2 rounded-full ${filter.color}`} />
  <span>{filter.label}</span>
  <span className="text-slate-500">{filter.count}</span>
</button>
```

### 3.5 View Mode Toggle

```tsx
// Kontener
className="flex items-center bg-navy-950 border border-navy-700 rounded-lg p-1"

// Przycisk widoku
className={`p-1.5 rounded transition-colors ${
  isActive
    ? 'bg-navy-700 text-white shadow-sm'
    : 'text-slate-500 hover:text-slate-300 hover:bg-navy-800/50'
}`}
```

**Dostępne widoki:**
| Widok | Ikona | Użycie |
|-------|-------|--------|
| `table` | List | Wszystkie moduły |
| `grid` | Grid3X3 | Wszystkie moduły |
| `kanban` | Kanban | Initiatives, Execution |
| `timeline` | Calendar | Initiatives, Execution |
| `calendar` | CalendarDays | Execution |
| `matrix` | LayoutGrid | Portfolio |

### 3.6 Action Button (+ New Item)

```tsx
// Styl gradient primary
className="
  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
  bg-gradient-to-r from-primary-500 to-primary-600 text-white
  border border-primary-400/30
  hover:from-primary-400 hover:to-primary-500
  shadow-lg shadow-primary-500/25
  transition-all duration-200
"
```

---

## 4. Dynamiczne menu dokumentów (DynamicTabs)

### 4.1 Struktura

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [≡ List] │ [DRD Name... ●] [X] │ [ADMA Name... ●] [X] │ [+3 ▼]         │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Konfiguracja

- **Max widocznych tabów:** 6
- **Overflow:** dropdown z pozostałymi dokumentami

### 4.3 Kolory lewej krawędzi (border-l)

```tsx
const TYPE_BORDER_COLORS: Record<string, string> = {
  // Assessment frameworks
  DRD: 'border-l-purple-500',
  SIRI: 'border-l-blue-500',
  ADMA: 'border-l-teal-500',
  CMMI: 'border-l-orange-500',
  LEAN: 'border-l-green-500',
  
  // Discovery Tools - Strategic
  SWT: 'border-l-emerald-500',  // SWOT
  PTR: 'border-l-emerald-500',  // PORTER
  // ... pozostałe strategic tools
  
  // Discovery Tools - Operational
  VSM: 'border-l-blue-500',     // Value Stream Map
  SOP: 'border-l-blue-500',
  // ... pozostałe operational tools
  
  // Discovery Tools - Digital
  ROB: 'border-l-purple-500',   // Robotics
  RPA: 'border-l-purple-500',
  // ... pozostałe digital tools
  
  // Discovery Tools - Automation
  PAI: 'border-l-amber-500',
};
```

### 4.4 Status Colors (kropka statusu)

```tsx
const STATUS_COLORS: Record<ItemStatus, string> = {
  draft: 'bg-slate-400',
  in_review: 'bg-amber-400',
  approved: 'bg-emerald-400',
  completed: 'bg-emerald-400',
};
```

### 4.5 Styl taba dokumentu

```tsx
// Styl bazowy
const TAB_BASE = `
  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
  border border-l-2 transition-all duration-200 cursor-pointer
`;

// Nieaktywny
const TAB_INACTIVE = `
  ${TAB_BASE}
  bg-navy-800 border-navy-600 text-slate-400
  hover:bg-navy-700 hover:border-slate-500 hover:text-white
`;

// Aktywny
const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;
```

---

## 5. Widok tabeli (FilterableTable)

### 5.1 Struktura tabeli

```
┌─────────┬────────────────────────────┬──────────┬──────────┬──────────┬─────────┐
│ TYPE ▼  │ NAME                       │ STATUS ▼ │ PROGRESS │ UPDATED  │ ACTIONS │
├─────────┼────────────────────────────┼──────────┼──────────┼──────────┼─────────┤
│ DRD     │ Q1 2026 Digital Maturity   │ ● Approved │ ████ 100% │ 2h ago   │ ⋮      │
│ ADMA    │ Operational Excellence     │ ● In Review│ ███  75% │ 5h ago   │ ⋮      │
│ CMMI    │ Technology Stack Audit     │ ● Draft    │ ██   50% │ 1d ago   │ ⋮      │
└─────────┴────────────────────────────┴──────────┴──────────┴──────────┴─────────┘
```

### 5.2 Nagłówek tabeli

```tsx
<th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
  {column.label}
</th>
```

### 5.3 Wiersz tabeli

```tsx
<tr className="group hover:bg-navy-800/50 cursor-pointer transition-colors">
```

### 5.4 Status Badge

```tsx
const StatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
  const config: Record<ItemStatus, { bg: string; text: string; dot: string; label: string }> = {
    draft: { 
      bg: 'bg-slate-500/20', 
      text: 'text-slate-300', 
      dot: 'bg-slate-400', 
      label: 'Draft' 
    },
    in_review: {
      bg: 'bg-amber-500/20',
      text: 'text-amber-300',
      dot: 'bg-amber-400',
      label: 'In Review',
    },
    approved: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      label: 'Approved',
    },
    completed: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-300',
      dot: 'bg-emerald-400',
      label: 'Completed',
    },
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${bg}`}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </div>
  );
};
```

### 5.5 Progress Bar

```tsx
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          progress === 100 ? 'bg-emerald-500' :
          progress >= 75 ? 'bg-blue-500' :
          progress >= 50 ? 'bg-amber-500' :
          'bg-slate-500'
        }`}
        style={{ width: `${progress}%` }}
      />
    </div>
    <span className="text-xs text-slate-400 w-8">{progress}%</span>
  </div>
);
```

### 5.6 Actions (hover)

```tsx
<div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <button className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white">
    <Eye size={14} />
  </button>
  <button className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white">
    <Edit size={14} />
  </button>
  <button className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white">
    <MoreVertical size={14} />
  </button>
</div>
```

---

## 6. Widok kart/siatki (GridView)

### 6.1 Grid layout

```tsx
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
```

### 6.2 Struktura karty

```
┌─────────────────────────────────────┐
│ DRD                            ⋮   │  <- Header: TYPE + menu
├─────────────────────────────────────┤
│ Q1 2026 Digital Maturity            │  <- Title (max 2 lines)
│ Assessment                          │
├─────────────────────────────────────┤
│ ████████████████████████████ 100%   │  <- Progress bar
├─────────────────────────────────────┤
│ ● Approved              2h ago      │  <- Footer: status + date
└─────────────────────────────────────┘
```

### 6.3 Kolory kart według typu

```tsx
const TYPE_COLORS: Record<string, string> = {
  // Assessment frameworks
  DRD: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  SIRI: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  ADMA: 'from-teal-500/20 to-teal-600/10 border-teal-500/30',
  CMMI: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  LEAN: 'from-green-500/20 to-green-600/10 border-green-500/30',
  
  // Tool categories
  strategic: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  operational: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  digital: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  automation: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
};
```

### 6.4 Styl karty

```tsx
<div className={`
  group relative bg-gradient-to-br ${typeColor}
  border rounded-xl overflow-hidden cursor-pointer
  hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/30
  transition-all duration-200
`}>
```

### 6.5 Quick View Button (hover)

```tsx
<button className="
  absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
  p-3 rounded-full bg-primary-500 text-white
  opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100
  shadow-lg shadow-primary-500/25
  transition-all duration-200
">
  <Eye size={20} />
</button>
```

### 6.6 New Item Card

```tsx
<button className="
  flex flex-col items-center justify-center gap-2
  min-h-[180px] rounded-xl border-2 border-dashed border-navy-600
  text-slate-500 hover:text-primary-400 hover:border-primary-500/50
  transition-all
">
  <Plus size={24} />
  <span className="text-sm font-medium">{newItemLabel}</span>
</button>
```

---

## 7. Typografia i kolory

### 7.1 Paleta kolorów

| Nazwa | Wartość | Użycie |
|-------|---------|--------|
| `navy-950` | #0a0f1a | Tło główne |
| `navy-900` | #0d1424 | Tło komponentów |
| `navy-800` | #131b2e | Tło przycisków, inputów |
| `navy-700` | #1e293b | Bordery |
| `navy-600` | #334155 | Bordery (hover) |
| `primary-500` | #8b5cf6 | Akcent główny (fiolet) |
| `primary-400` | #a78bfa | Akcent (hover) |
| `slate-300` | #cbd5e1 | Tekst główny |
| `slate-400` | #94a3b8 | Tekst pomocniczy |
| `slate-500` | #64748b | Tekst nieaktywny |

### 7.2 Status Colors

| Status | Dot | Background | Text |
|--------|-----|------------|------|
| Draft | `bg-slate-400` | `bg-slate-500/20` | `text-slate-300` |
| In Review | `bg-amber-400` | `bg-amber-500/20` | `text-amber-300` |
| Approved | `bg-emerald-400` | `bg-emerald-500/20` | `text-emerald-300` |
| Completed | `bg-emerald-400` | `bg-emerald-500/20` | `text-emerald-300` |
| Blocked | `bg-rose-400` | `bg-rose-500/20` | `text-rose-300` |
| Executing | `bg-cyan-400` | `bg-cyan-500/20` | `text-cyan-300` |

### 7.3 Typografia

| Element | Klasy |
|---------|-------|
| Nagłówek tabeli | `text-xs font-medium text-slate-400 uppercase tracking-wider` |
| Tytuł w tabeli | `text-sm text-white font-medium` |
| Tekst pomocniczy | `text-xs text-slate-400` |
| Badge TYPE | `font-mono text-xs font-bold text-slate-300` |
| Licznik w tabie | `text-xs rounded-full bg-navy-700 text-slate-400` |

---

## 8. Typy TypeScript

### 8.1 Podstawowe typy

```typescript
// Typ taba modułu
export type ModuleTab = 'list' | 'reports' | 'initiatives';

// Tryby widoku
export type ViewMode = 'table' | 'grid' | 'kanban' | 'timeline' | 'calendar' | 'matrix';

// Status elementu
export type ItemStatus = 'draft' | 'in_review' | 'approved' | 'completed';

// Otwarty dokument (dla DynamicTabs)
export interface OpenDocument {
  id: string;
  type: 'assessment' | 'tool' | 'report' | 'initiative';
  subType: string; // DRD, SWOT, VSM, etc.
  name: string;
  status: ItemStatus;
  hasUnsavedChanges?: boolean;
}

// Konfiguracja taba
export interface TabConfig {
  id: ModuleTab;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

// Przycisk kategorii (dla Discovery Tools)
export interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  onClick: () => void;
}
```

### 8.2 Props ModuleHub

```typescript
interface ModuleHubProps {
  // Tab configuration
  tabs: TabConfig[];
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;

  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // Search
  onSearch: (query: string) => void;

  // Dynamic documents
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onCloseDocument: (id: string) => void;
  onShowList: () => void;

  // Filters
  activeFilters: FilterChip[];
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;

  // Actions - Assessment style (single button)
  onNewItem?: () => void;
  newItemLabel?: string;

  // Actions - Discovery Tools style (4 category buttons)
  categoryButtons?: CategoryButton[];

  // Status filters (for Initiatives module)
  statusFilters?: StatusFilter[];
  activeStatusFilter?: string | null;
  onStatusFilterChange?: (status: string | null) => void;

  // Available view modes
  availableViewModes?: ViewMode[];

  // Content
  children: React.ReactNode;
}
```

---

## 9. Implementacja w modułach

### 9.1 Wzorzec użycia ModuleHub

```tsx
import {
  ModuleHub,
  ModuleTab,
  ViewMode,
  OpenDocument,
  FilterChip,
  FilterableTable,
  GridView,
} from '@/components/shared/ModuleHub';

export const MyModuleHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ModuleTab>('list');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const tabs: TabConfig[] = [
    { id: 'list', label: 'Items', icon: <FileText size={16} />, count: items.length },
    { id: 'reports', label: 'Reports', icon: <FileBarChart size={16} />, count: reports.length },
    { id: 'initiatives', label: 'Initiatives', icon: <Lightbulb size={16} />, count: initiatives.length },
  ];

  return (
    <ModuleHub
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onSearch={setSearchQuery}
      openDocuments={openDocuments}
      activeDocumentId={activeDocumentId}
      onSelectDocument={setActiveDocumentId}
      onCloseDocument={handleCloseDocument}
      onShowList={handleShowList}
      activeFilters={activeFilters}
      onRemoveFilter={handleRemoveFilter}
      onClearFilters={handleClearFilters}
      onNewItem={handleNewItem}
      newItemLabel="New Item"
      availableViewModes={['table', 'grid']}
    >
      {renderContent()}
    </ModuleHub>
  );
};
```

### 9.2 Konfiguracja widoków według modułu

| Moduł | Widoki | Status Filters |
|-------|--------|----------------|
| My Work | table | - |
| Interview | table, grid | - |
| Tools | table, grid | - |
| Assessment | table, grid | - |
| Initiatives | table, grid, kanban, timeline | REVIEW, APPROVED, PLANNING |
| Execution | table, grid, kanban, timeline, calendar | EXECUTING, BLOCKED, DONE |
| Benefits | table, grid | DONE |
| Economics | table | - |
| Reports | table | - |

---

## 10. Checklist zgodności

Każdy moduł musi spełniać następujące kryteria:

### 10.1 Wymagane elementy

- [ ] Używa `ModuleHub` jako główny kontener
- [ ] Implementuje `ModuleNavBar` z odpowiednimi tabami
- [ ] Obsługuje `DynamicTabs` dla otwartych dokumentów (max 6)
- [ ] Posiada Search functionality
- [ ] Posiada View Mode toggle (minimum table + grid)
- [ ] Ma przycisk akcji głównej (+ New Item)
- [ ] Tabela zgodna z `FilterableTable` (kolumny: TYPE, NAME, STATUS, PROGRESS, UPDATED, ACTIONS)
- [ ] Karty zgodne z `GridView`
- [ ] Status badges używają standardowych kolorów

### 10.2 Opcjonalne elementy

- [ ] Status Filters (dla modułów z workflow)
- [ ] Category Buttons (dla modułów z kategoriami)
- [ ] Kanban view (dla modułów z drag & drop)
- [ ] Timeline view (dla modułów z harmonogramem)
- [ ] Calendar view (dla modułów z terminami)

---

## 11. Historia zmian

| Wersja | Data | Autor | Zmiany |
|--------|------|-------|--------|
| 1.0 | 2026-01-20 | System | Inicjalna wersja dokumentu |

---

## 12. Audyt zgodności modułów (2026-01-20)

### 12.1 Moduły zgodne z ModuleHub

| Moduł | Plik Hub | Status | Uwagi |
|-------|----------|--------|-------|
| **Assessment** | `AssessmentModuleHub.tsx` | ✅ Zgodny | Wzorzec referencyjny |
| **Initiatives** | `InitiativesHub.tsx` | ✅ Zgodny | Pełna integracja |
| **Execution** | `ExecutionHub.tsx` | ✅ Zgodny | 5 widoków, RAID, Decisions |
| **Benefits** | `BenefitsHub.tsx` | ✅ Zgodny | 3 taby, KPI tracking |
| **Reports** | `ReportsHub.tsx` | ✅ Zgodny | Generator, Templates, Schedules |
| **Economics** | `EconomicsHub.tsx` | ✅ Zgodny | Zmigrowany 2026-01-20, 3 taby: Catalog, Results, Compare |
| **Discovery Tools** | `DiscoveryToolsHub.tsx` | ✅ Zgodny | 3 taby, 4 category buttons |

### 12.2 Moduły z uzasadnionymi wyjątkami

| Moduł | Plik | Status | Uzasadnienie |
|-------|------|--------|--------------|
| **My Work** | `MyWorkView.tsx` | ⚠️ Dashboard | Używa SplitLayout (65/35) - specyficzny dashboard z WorkCenter + NotificationsHub. Różni się od standardu ze względu na funkcję agregacji zadań użytkownika. |
| **Interview** | `InterviewView.tsx` | ⚠️ Workspace | Używa własnego workspace pattern - sesje wywiadu, historia. Moduł kontekstowy (nie lista elementów). |
| **Tools Landing** | `DiscoveryToolsView.tsx` | ⚠️ Landing | Katalog kategorii narzędzi z nawigacją do podwidoków. Różni się ze względu na hierarchiczną strukturę (4 kategorie → 31 narzędzi). |

### 12.3 Rekomendacje

1. ~~**Economics** - PILNE: Migrować do ModuleHub~~ ✅ ZREALIZOWANE 2026-01-20
2. **Interview** - OPCJONALNIE: Rozważyć ModuleHub dla history view (lista sesji)
3. **Tools Landing** - BRAK ZMIAN: Landing page z nawigacją jest uzasadniony architekturą modułu
4. **My Work** - BRAK ZMIAN: Dashboard pattern jest uzasadniony dla centrum pracy użytkownika

### 12.4 Komponenty współdzielone - wykorzystanie

```
ModuleHub używany przez:
├── src/components/assessment/AssessmentModuleHub.tsx
├── src/components/assessment/AssessmentHub.tsx
├── src/components/Initiatives/InitiativesHub.tsx
├── src/components/Execution/ExecutionHub.tsx
├── src/components/Benefits/BenefitsHub.tsx
├── src/components/Reports/Management/ReportsHub.tsx
├── src/components/Economics/EconomicsHub.tsx
└── src/components/Discovery/DiscoveryToolsHub.tsx
```

---

## 13. Historia zmian

| Wersja | Data | Autor | Zmiany |
|--------|------|-------|--------|
| 1.0 | 2026-01-20 | System | Inicjalna wersja dokumentu |
| 1.1 | 2026-01-20 | System | Dodano audyt zgodności modułów |
| 1.2 | 2026-01-20 | System | Migracja EconomicsView do EconomicsHub z ModuleHub pattern |

---

*Dokument jest częścią pakietu wdrożeniowego Consultify. Wszystkie moduły muszą być zgodne z tym standardem.*
