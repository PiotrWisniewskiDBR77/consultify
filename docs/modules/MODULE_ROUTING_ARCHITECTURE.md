# Module Routing Architecture

## Źródło Prawdy - Konfiguracja Modułów

Dokument definiuje oficjalną strukturę routingu modułów aplikacji Consultinity.

**Data aktualizacji**: 2026-01-20

---

## Przegląd Architektury

Aplikacja wykorzystuje architekturę opartą na statusie inicjatywy (status-driven architecture), gdzie moduły są zorganizowane według cyklu życia inicjatyw transformacyjnych:

```
Assessment → Initiatives → Execution → Benefits
     ↓           ↓            ↓           ↓
   DRAFT    PLANNING     EXECUTING      DONE
            REVIEW       BLOCKED     CANCELLED
            APPROVED                  ARCHIVED
```

---

## Główne Moduły Aplikacji

### 1. AI Chat
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `AI_CHAT` |
| **AppView** | `AppView.AI_CHAT` |
| **Route** | `/chat` |
| **Component** | `AIChatWelcomeView` |
| **Ikona** | `MessageSquare` |

### 2. Interview (Discovery Consultant)
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `INTERVIEW` |
| **AppView** | `AppView.DISCOVERY_CONSULTANT` |
| **Route** | `/discovery` |
| **Component** | `DiscoveryConsultantView` |
| **Ikona** | `Brain` |
| **Lokalizacja** | `src/components/Discovery/DiscoveryConsultantView.tsx` |

### 3. Discovery Tools
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `DISCOVERY_TOOLS` |
| **AppView** | `AppView.DISCOVERY_TOOLS` |
| **Route** | `/discovery-tools` |
| **Component** | `DiscoveryToolsHub` |
| **Ikona** | `Wrench` |
| **Badge** | `new` |
| **Sub-routes** | `/discovery-tools/strategic`, `/discovery-tools/operational`, `/discovery-tools/digital`, `/discovery-tools/process-automation` |

### 4. Assessment
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_ASSESSMENT` |
| **AppView** | `AppView.ASSESSMENT_OVERVIEW` |
| **Route** | `/assessment` |
| **Component** | `AssessmentHubDashboard` |
| **Ikona** | `CheckCircle2` |
| **Sub-routes** | `/assessment/drd`, `/assessment/siri`, `/assessment/adma`, `/assessment/cmmi`, `/assessment/lean` |

### 5. Initiatives
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_INITIATIVES` |
| **AppView** | `AppView.FULL_STEP2_INITIATIVES` |
| **Route** | `/initiatives` |
| **Component** | `InitiativesHub` |
| **Ikona** | `Lightbulb` |
| **Lokalizacja** | `src/components/Initiatives/InitiativesHub.tsx` |

### 6. Execution
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_EXECUTION` |
| **AppView** | `AppView.FULL_STEP5_EXECUTION` |
| **Route** | `/execution` |
| **Component** | `ExecutionHub` |
| **Ikona** | `Rocket` |
| **Lokalizacja** | `src/components/Execution/ExecutionHub.tsx` |
| **Statusy inicjatyw** | `APPROVED`, `EXECUTING`, `BLOCKED`, `DONE` |

### 7. Benefits
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_BENEFITS` |
| **AppView** | `AppView.BENEFITS_REALIZATION` |
| **Route** | `/benefits` |
| **Component** | `BenefitsHub` |
| **Ikona** | `TrendingUp` |
| **Lokalizacja** | `src/components/Benefits/BenefitsHub.tsx` |
| **Statusy inicjatyw** | `DONE`, `CANCELLED`, `ARCHIVED` |

### 8. Economics
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_ECONOMICS` |
| **AppView** | `AppView.ECONOMICS` |
| **Route** | `/economics` |
| **Component** | `EconomicsView` |
| **Ikona** | `Calculator` |
| **Lokalizacja** | `src/views/EconomicsView.tsx` |

### 9. Reports
| Właściwość | Wartość |
|------------|---------|
| **Sidebar ID** | `MODULE_REPORTS` |
| **AppView** | `AppView.FULL_STEP6_REPORTS` |
| **Route** | `/reports` |
| **Component** | `FullReportsView` → `ManagementReportsView` |
| **Ikona** | `BookOpen` |
| **Lokalizacja** | `src/views/FullReportsView.tsx` |

---

## Pliki Konfiguracyjne

### 1. Menu Sidebar
**Lokalizacja**: `src/components/navigation/Sidebar/menuConfig.ts`

Definiuje strukturę menu bocznego z:
- `id` - unikalny identyfikator elementu
- `label` - etykieta wyświetlana (z i18n)
- `icon` - ikona Lucide
- `viewId` - wartość AppView dla nawigacji
- `badge` - opcjonalny badge (`new`, `soon`)

### 2. Mapowanie Route
**Lokalizacja**: `src/routes/routeConfig.ts`

```typescript
// Definicje ścieżek
export const ROUTES = {
  INTERVIEW: '/interview',
  DISCOVERY_CONSULTANT: '/discovery',
  INITIATIVES: '/initiatives',
  EXECUTION: '/execution',
  BENEFITS: '/benefits',
  ECONOMICS: '/economics',
  REPORTS: '/reports',
  // ...
};

// Mapowanie AppView → Route
export const APP_VIEW_TO_ROUTE: Record<AppView, string> = {
  [AppView.DISCOVERY_CONSULTANT]: ROUTES.DISCOVERY_CONSULTANT,
  [AppView.FULL_STEP2_INITIATIVES]: ROUTES.INITIATIVES,
  [AppView.FULL_STEP5_EXECUTION]: ROUTES.EXECUTION,
  [AppView.BENEFITS_REALIZATION]: ROUTES.BENEFITS,
  [AppView.ECONOMICS]: ROUTES.ECONOMICS,
  [AppView.FULL_STEP6_REPORTS]: ROUTES.REPORTS,
  // ...
};
```

### 3. Definicje Route (React Router)
**Lokalizacja**: `src/routes/AppRoutes.tsx`

```tsx
<Route
  path={ROUTES.EXECUTION}
  element={
    <MainLayout breadcrumbs={['Execution']} noPadding>
      <ExecutionHub />
    </MainLayout>
  }
/>
```

### 4. Enum AppView
**Lokalizacja**: `src/types/core.ts`

```typescript
export enum AppView {
  AI_CHAT = 'AI_CHAT',
  INTERVIEW = 'INTERVIEW',
  DISCOVERY_CONSULTANT = 'DISCOVERY_CONSULTANT',
  DISCOVERY_TOOLS = 'DISCOVERY_TOOLS',
  ASSESSMENT_OVERVIEW = 'ASSESSMENT_OVERVIEW',
  FULL_STEP2_INITIATIVES = 'FULL_STEP2_INITIATIVES',
  FULL_STEP5_EXECUTION = 'FULL_STEP5_EXECUTION',
  BENEFITS_REALIZATION = 'BENEFITS_REALIZATION',
  ECONOMICS = 'ECONOMICS',
  FULL_STEP6_REPORTS = 'FULL_STEP6_REPORTS',
  // ...
}
```

---

## Przepływ Nawigacji

```
User klika w Sidebar
       ↓
MenuItem.viewId (np. AppView.FULL_STEP5_EXECUTION)
       ↓
APP_VIEW_TO_ROUTE[viewId] → '/execution'
       ↓
navigate('/execution')
       ↓
React Router dopasowuje Route
       ↓
Renderuje ExecutionHub w MainLayout
```

### Implementacja w Sidebar

```typescript
// src/components/navigation/Sidebar/Sidebar.tsx (lub menuConfig.ts)
onClick={() => {
  const route = APP_VIEW_TO_ROUTE[item.viewId];
  if (route) {
    navigate(route);
  }
  setCurrentView(item.viewId);
}}
```

---

## Komponenty Hub (ModuleHub Pattern)

Moduły Execution i Benefits używają wzorca `ModuleHub` zapewniającego:

### Zakładki (Tabs)
- **list** - Widok Kanban/tabela
- **reports** - Timeline/analityka
- **initiatives** - Workload/ROI

### Tryby Widoku (ViewMode)
- `table` - widok tabeli
- `grid` - widok kart
- `kanban` - tablica Kanban

### Struktura Komponentu Hub

```tsx
<ModuleHub
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  onSearch={setSearchQuery}
  openDocuments={openDocuments}
  activeDocumentId={activeDocumentId}
  onDocumentSelect={setActiveDocumentId}
  onDocumentClose={handleCloseDocument}
>
  {renderContent()}
</ModuleHub>
```

---

## Eksporty Modułów

### Benefits Module
**Lokalizacja**: `src/components/Benefits/index.ts`

```typescript
export { BenefitsHub } from './BenefitsHub';
```

### Execution Module
**Lokalizacja**: `src/components/Execution/index.ts`

```typescript
export { ExecutionHub } from './ExecutionHub';
export { BenefitsTracker } from './BenefitsTracker';
```

---

## Statusy Inicjatyw i Przypisanie do Modułów

| Status | Moduł | Opis |
|--------|-------|------|
| `DRAFT` | Assessment | Inicjatywa w fazie definiowania |
| `PLANNING` | Initiatives | Planowanie zasobów i harmonogramu |
| `REVIEW` | Initiatives | Oczekuje na zatwierdzenie |
| `APPROVED` | Initiatives/Execution | Zatwierdzona, gotowa do realizacji |
| `EXECUTING` | Execution | Aktywnie realizowana |
| `BLOCKED` | Execution | Zablokowana przez problem |
| `DONE` | Benefits | Zakończona pomyślnie |
| `CANCELLED` | Benefits | Anulowana |
| `ARCHIVED` | Benefits | Zarchiwizowana |

---

## Weryfikacja Połączeń

### Checklist

- [ ] Menu Sidebar ma `viewId` dla każdego modułu
- [ ] `APP_VIEW_TO_ROUTE` zawiera mapowanie dla każdego `AppView`
- [ ] `AppRoutes.tsx` ma definicję `<Route>` dla każdej ścieżki
- [ ] Komponent jest poprawnie lazy-loaded
- [ ] Eksport komponentu istnieje w `index.ts` modułu

### Testowanie Połączenia

```bash
# Sprawdź czy komponent istnieje
ls -la src/components/[Module]/[Component].tsx

# Sprawdź eksporty
grep "export.*Hub" src/components/[Module]/index.ts

# Sprawdź route
grep "ROUTES.[MODULE]" src/routes/AppRoutes.tsx

# Sprawdź mapowanie
grep "[AppView.VIEW_NAME]" src/routes/routeConfig.ts
```

---

## Historia Zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-20 | Utworzenie dokumentacji | AI Assistant |
| 2026-01-20 | Usunięcie badge 'soon' z Economics i Reports | User |
| 2026-01-20 | Naprawienie błędów TypeScript w ExecutionHub | AI Assistant |

---

## Powiązane Dokumenty

- [NAVIGATION_STRUCTURE.md](./NAVIGATION_STRUCTURE.md) - Nawigacja Admin/SuperAdmin
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) - Architektura aplikacji
- [DISCOVERY_CONSULTANT_MODULE.md](./DISCOVERY_CONSULTANT_MODULE.md) - Moduł Interview
- [DISCOVERY_TOOLS_MODULE.md](./DISCOVERY_TOOLS_MODULE.md) - Moduł Discovery Tools
