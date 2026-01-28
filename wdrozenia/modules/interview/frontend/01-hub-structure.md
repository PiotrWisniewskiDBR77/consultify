# Interview – Hub Structure

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/Interview/InterviewHub.tsx`  
**Pattern:** ModuleHub (ClickUp-like workspace)

---

## 📋 Struktura UI

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ NavBar: [Inbox] [Sessions] [Templates] [Insights] [Assigned]    │
│         + Dynamic tabs for open documents                       │
├─────────────────────────────────────────────────────────────────┤
│ ContextBar: Search | Filters | Actions (New Session, etc.)      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌────────────────────────────────────────┐  │
│  │              │  │                                        │  │
│  │  Category    │  │  Main Content Area                     │  │
│  │  Sidebar     │  │  (Questions/Notes/Evidence/Summary)    │  │
│  │              │  │                                        │  │
│  │  - Strategy  │  │  ┌────────────────────────────────┐   │  │
│  │  - Operations│  │  │ Tab: Questions | Notes | ...   │   │  │
│  │  - Digital   │  │  ├────────────────────────────────┤   │  │
│  │  - People    │  │  │                                │   │  │
│  │  - Finance   │  │  │  Question List (task-style)    │   │  │
│  │              │  │  │  - [ ] Question 1              │   │  │
│  │  Progress:   │  │  │  - [✓] Question 2              │   │  │
│  │  3/5 done    │  │  │  - [ ] Question 3              │   │  │
│  │              │  │  │                                │   │  │
│  └──────────────┘  │  └────────────────────────────────┘   │  │
│                    │                                        │  │
│                    └────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Company Facts Panel (Right sidebar)                       │  │
│  │ - Organization Profile                                    │  │
│  │ - Key Metrics                                             │  │
│  │ - Gaps Identified                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Główne Taby (NavBar)

| Tab | Opis | Komponent |
|-----|------|-----------|
| **Inbox** | Przydzielone do mnie wywiady | `InboxView` |
| **Sessions** | Lista wszystkich sesji | `SessionsListView` |
| **Templates** | Biblioteka szablonów | `TemplatesView` |
| **Insights** | Wygenerowane AI insights | `InsightsView` |
| **Assigned** | Przydziały które zarządzam | `AssignedView` |

### Dynamiczne Taby

- Otwarte dokumenty (sesje, szablony) pojawiają się jako dodatkowe taby
- Max 6 otwartych dokumentów
- Zamykanie przez X na tabie

---

## 📂 Kategorie (Sidebar)

| Kategoria | Ikona | Kolor |
|-----------|-------|-------|
| Strategy | 🎯 Target | Blue |
| Operations | ⚙️ Cog | Orange |
| Digital | 💻 Monitor | Purple |
| People | 👥 Users | Green |
| Finance | 💰 DollarSign | Yellow |

### Progress Indicator

```tsx
<div className="progress-section">
  <span>Progress: {completedCategories}/{totalCategories}</span>
  <ProgressBar value={progress} />
</div>
```

---

## 🔧 Komponenty

### InterviewHub.tsx

```tsx
export const InterviewHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('inbox');
  const [openDocuments, setOpenDocuments] = useState<Document[]>([]);
  const { user } = useAuth();

  // Taby główne
  const mainTabs = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'sessions', label: 'Sessions', icon: FileText },
    { id: 'templates', label: 'Templates', icon: Layout },
    { id: 'insights', label: 'Insights', icon: Sparkles },
    { id: 'assigned', label: 'Assigned', icon: Users },
  ];

  return (
    <ModuleHub
      title="Discovery Interview"
      tabs={mainTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      openDocuments={openDocuments}
      onDocumentClose={handleDocumentClose}
      contextActions={getContextActions(activeTab, user)}
    >
      {renderContent(activeTab)}
    </ModuleHub>
  );
};
```

### CategorySidebar.tsx

```tsx
export const CategorySidebar: React.FC<Props> = ({ 
  categories, 
  activeCategory, 
  onCategoryChange,
  progress 
}) => {
  return (
    <aside className="w-64 border-r">
      <div className="p-4">
        <h3>Categories</h3>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "w-full p-3 rounded-lg",
              activeCategory === cat.id && "bg-blue-50"
            )}
          >
            <cat.icon className="w-4 h-4" />
            <span>{cat.name}</span>
            <Badge>{cat.completed}/{cat.total}</Badge>
          </button>
        ))}
      </div>
      <div className="p-4 border-t">
        <span>Progress: {progress.completed}/{progress.total}</span>
        <Progress value={progress.percent} />
      </div>
    </aside>
  );
};
```

---

## 🎨 Context Actions (per tab)

| Tab | Akcje |
|-----|-------|
| Inbox | - |
| Sessions | New Session |
| Templates | New Template |
| Insights | Generate Insight |
| Assigned | Assign Interview |

### RBAC

```tsx
const getContextActions = (tab: string, user: User) => {
  const actions = [];
  
  if (tab === 'sessions') {
    actions.push({ label: 'New Session', onClick: openNewSessionModal });
  }
  
  if (tab === 'templates' && hasPermission(user, 'INTERVIEW_TEMPLATE_MANAGE')) {
    actions.push({ label: 'New Template', onClick: openTemplateBuilder });
  }
  
  if (tab === 'assigned' && hasPermission(user, 'INTERVIEW_ASSIGN_MANAGE')) {
    actions.push({ label: 'Assign Interview', onClick: openAssignModal });
  }
  
  return actions;
};
```

---

## 📊 Stany UI

### Loading State

```tsx
if (isLoading) {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" />
      <span>Loading interviews...</span>
    </div>
  );
}
```

### Error State

```tsx
if (error) {
  return (
    <div className="p-6 bg-red-50 rounded-lg">
      <AlertCircle className="w-6 h-6 text-red-500" />
      <p>{error}</p>
      <Button onClick={retry}>Retry</Button>
    </div>
  );
}
```

### Empty State

```tsx
if (sessions.length === 0) {
  return (
    <div className="text-center p-12">
      <FileText className="w-12 h-12 mx-auto text-gray-400" />
      <h3>No interview sessions yet</h3>
      <p>Start your first discovery interview</p>
      <Button onClick={openNewSessionModal}>New Session</Button>
    </div>
  );
}
```

---

## ✅ Weryfikacja

- [ ] 5 głównych tabów widoczne
- [ ] Dynamiczne taby dla otwartych dokumentów
- [ ] Category sidebar z progress
- [ ] Context actions per tab
- [ ] RBAC dla przycisków
- [ ] Loading/Error/Empty states
- [ ] Brak mock data
