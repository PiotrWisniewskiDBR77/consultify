# 🚨 INSTRUKCJA ODBUDOWY UTRACONYCH PLIKÓW

## Co się stało

W dniu 19.01.2026 nastąpiła utrata kodu z powodu:
1. `lint-staged` automatycznie zrobił `git stash` i nie przywrócił zmian
2. Następnie wykonano `git clean -fd` które usunęło nowe (untracked) pliki

## Twoje zadanie

**Odbuduj plik/pliki które były tworzone w tym wątku.**

Masz dostęp do:
- Historii naszej rozmowy w tym wątku
- Planów i dokumentacji w `docs/`
- Istniejącego kodu w projekcie

**ZASADY:**
1. Przeczytaj całą historię tego wątku
2. Znajdź kod który był tworzony
3. Odtwórz go w odpowiednich plikach
4. Użyj `checkpoint "opis"` po każdym utworzonym pliku (alias do szybkiego commita)

---

## Lista utraconych plików do odbudowy

### Moduł Economics/Benefits (FAZA: complete_4_modules)
```
src/services/initiativeLifecycle.ts              (+348 linii)
src/components/Execution/ExecutionTimelineView.tsx    (+567 linii)
src/components/Execution/ExecutionWorkloadView.tsx    (+515 linii)
src/components/Execution/ExecutionDetailPanel.tsx     (+564 linii)
src/components/Benefits/ROIAnalysisView.tsx           (+532 linii)
src/components/Benefits/KPICreateModal.tsx            (+451 linii)
src/components/Benefits/Sparkline.tsx                 (+156 linii)
src/components/Benefits/LessonsLearnedPanel.tsx       (+572 linii)
src/components/shared/StatusChangeToast.tsx           (+109 linii)
src/components/Reports/Management/ExecutiveDashboardReport.tsx  (+467 linii)
src/components/Reports/Management/BenefitsRealizationReport.tsx (+482 linii)
server/migrations/281_complete_modules_demo_seed.sql  (+1108 linii)
```

### AI Chat Features (FAZA 2: Share Conversations)
```
server/migrations/283_conversation_sharing.sql        (+40 linii)
server/src/routes/share.routes.ts                     (+502 linii)
src/components/AIChat/Messages/InlineThinkingStream.tsx (+112 linii)
server/migrations/281_knowledge_hub.sql               (+241 linii)
server/src/services/ai/knowledgeHubService.ts         (+847 linii)
src/components/AIChat/KnowledgeHubPanel.tsx           (+901 linii)
server/src/services/ai/instructionService.ts          (+614 linii)
src/components/settings/ai/AIInstructionsTab.tsx      (+673 linii)
server/src/services/ai/webSearchService.ts            (+574 linii)
server/src/jobs/aiPatternAggregator.ts                (+328 linii)
server/src/services/ai/imageService.ts                (+412 linii)
src/components/AIChat/ImageAttachment.tsx             (+365 linii)
server/migrations/282_conversation_branches.sql       (+43 linii)
src/components/AIChat/BranchSelector.tsx              (+325 linii)
```

### Discovery Tools Module
```
src/store/useToolStore.ts                             (+984 linii)
src/hooks/useToolAI.ts                                (+305 linii)
src/services/toolPrompts.ts                           (+391 linii)
src/components/DiscoveryTools/ToolHeader.tsx          (+259 linii)
src/components/DiscoveryTools/ToolCanvas.tsx          (+314 linii)
src/components/DiscoveryTools/ToolActionBar.tsx       (+162 linii)
src/components/DiscoveryTools/SummaryStep.tsx         (+281 linii)
src/components/DiscoveryTools/SWOTMatrix.tsx          (+222 linii)
src/components/DiscoveryTools/SWOTQuadrantStep.tsx    (+390 linii)
src/components/DiscoveryTools/index.tsx               (+7 linii)
```

### AI Context Integration
```
Modyfikacje w /chat/stream route - przekazywanie pełnego kontekstu:
- projectId z workspaceContext
- screenContext 
- focusMode
```

---

## Kontekst funkcjonalny

### initiativeLifecycle.ts
Service do zarządzania cyklem życia inicjatyw - statusy, przejścia, walidacja.

### ExecutionTimelineView.tsx
Widok timeline dla wykonania inicjatyw - Gantt-like view z milestones.

### KnowledgeHubPanel.tsx
Panel w AI Chat do zarządzania bazą wiedzy - upload dokumentów, embeddings, search.

### useToolStore.ts
Zustand store dla Discovery Tools - przechowuje stan narzędzi strategicznych (SWOT, Porter, etc.), historię konwersacji, wyekstrahowane encje.

### share.routes.ts
API endpoints do udostępniania konwersacji przez publiczne linki.

### BranchSelector.tsx
Komponent do wyboru branchy w konwersacji AI (jak w Claude).

---

## Jak odbudować

1. **Przeczytaj historię wątku** - znajdź kod który był pisany
2. **Sprawdź powiązane pliki** - np. dla `ExecutionTimelineView.tsx` sprawdź `ExecutionHub.tsx`
3. **Sprawdź dokumentację** - pliki w `docs/` zawierają plany
4. **Odtwórz kod** - pisz plik od nowa
5. **Zapisz natychmiast:**
   ```bash
   git add [plik] && git commit -m "recover: [nazwa pliku]"
   ```

---

## WAŻNE - Po odbudowaniu

Po każdym odbudowanym pliku **natychmiast commituj**:

```bash
checkpoint "recover: ExecutionTimelineView.tsx"
```

Lub ręcznie:
```bash
git add -A && git commit -m "recover: [opis]"
```

**NIE CZEKAJ** z commitami - rób je co plik!

---

## Powiązana dokumentacja

- `docs/AI_CHAT_IMPLEMENTATION_PLAN.md` - plan AI Chat features
- `docs/modules/DISCOVERY_TOOLS_MODULE.md` - spec Discovery Tools
- `docs/flows/` - diagramy przepływów
- `.cursor/plans/` - plany Cursor

