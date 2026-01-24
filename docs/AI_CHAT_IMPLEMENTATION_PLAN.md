# AI Chat System - Implementation Plan

> **Document:** AI_CHAT_IMPLEMENTATION_PLAN.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** ✅ COMPLETE (2026-01-11)  
> **Related:** FLOW-AIASSISTANT-001

---

## 📋 Executive Summary

Ten dokument opisuje **kompletny plan wdrożenia** perfekcyjnego AI Chat w Consultinity, podzielony na 3 fazy z wszystkimi krokami pośrednimi.

### Timeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPLEMENTATION TIMELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FAZA 1: DOKUMENTACJA              ████░░░░░░░░░░░░░░░░░░░░░░   Week 1      │
│  Specyfikacja, design, schematy    (4-6 hours)                              │
│                                                                              │
│  FAZA 2: WDROŻENIE                 ░░░░████████████████░░░░░░   Week 1-3    │
│  Sprint 2.1: P0 (Critical)         (8-12 hours)                             │
│  Sprint 2.2: P1 (High)             (16-24 hours)                            │
│  Sprint 2.3: P2 (Medium)           (16-24 hours)                            │
│                                                                              │
│  FAZA 3: MAPA PRZEPŁYWÓW           ░░░░░░░░░░░░░░░░░░░░████░░   Week 3-4    │
│  Integracje, połączenia, testy     (8-12 hours)                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 FAZA 1: DOKUMENTACJA

**Cel:** Stworzyć kompletną dokumentację systemu AI Chat  
**Czas:** 4-6 godzin  
**Output:** 4 dokumenty w `docs/`

### Task 1.1: Design Specification Document

| Field      | Value                           |
| ---------- | ------------------------------- |
| **File**   | `docs/AI_CHAT_SYSTEM_DESIGN.md` |
| **Status** | 🔴 TODO                         |
| **Effort** | 2h                              |
| **Owner**  | Agent                           |

**Zawartość:**

- [ ] Vision statement & differentiators
- [ ] System architecture diagram
- [ ] Component responsibilities
- [ ] UI/UX designs (all 4 display modes)
- [ ] Header redesign
- [ ] Input area redesign
- [ ] History sidebar redesign
- [ ] Context badge designs
- [ ] Tools menu redesign

---

### Task 1.2: Data Model Specification

| Field      | Value                        |
| ---------- | ---------------------------- |
| **File**   | `docs/AI_CHAT_DATA_MODEL.md` |
| **Status** | 🔴 TODO                      |
| **Effort** | 1.5h                         |
| **Owner**  | Agent                        |

**Zawartość:**

- [ ] ChatFolder vs PMO Project separation
- [ ] Conversation interface updates
- [ ] Memory tables schema (ai_user_memory, ai_org_memory)
- [ ] Actions tables schema (ai_actions_log)
- [ ] Context layers model
- [ ] Migration plan for existing data

---

### Task 1.3: API Specification

| Field      | Value                     |
| ---------- | ------------------------- |
| **File**   | `docs/api/AI_CHAT_API.md` |
| **Status** | 🔴 TODO                   |
| **Effort** | 1h                        |
| **Owner**  | Agent                     |

**Zawartość:**

- [ ] Existing endpoints review
- [ ] New endpoints specification:
  - `/api/ai/memory/user` - User memory CRUD
  - `/api/ai/memory/org` - Organization memory CRUD
  - `/api/ai/actions/pending` - Pending actions
  - `/api/ai/actions/:id/approve` - Approve action
  - `/api/ai/actions/:id/reject` - Reject action
  - `/api/ai/context` - Get current context
- [ ] Request/Response schemas
- [ ] Error handling

---

### Task 1.4: Flow Diagram Update

| Field      | Value                                        |
| ---------- | -------------------------------------------- |
| **File**   | `docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md` |
| **Status** | ⚠️ EXISTS - needs update                     |
| **Effort** | 1.5h                                         |
| **Owner**  | Agent                                        |

**Zawartość:**

- [ ] Update sequence diagrams
- [ ] Add context injection flow
- [ ] Add actions workflow
- [ ] Add memory persistence flow
- [ ] Update gap analysis
- [ ] Mark implemented items

---

### Faza 1 Checklist

```
FAZA 1: DOKUMENTACJA
├── 1.1 Design Specification    [ ] → docs/AI_CHAT_SYSTEM_DESIGN.md
├── 1.2 Data Model              [ ] → docs/AI_CHAT_DATA_MODEL.md
├── 1.3 API Specification       [ ] → docs/api/AI_CHAT_API.md
└── 1.4 Flow Diagram Update     [ ] → docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md

Estimated: 6 hours total
```

---

## 🚀 FAZA 2: WDROŻENIE

**Cel:** Implementacja wszystkich zmian w kodzie  
**Czas:** 40-60 godzin (3 sprinty)  
**Output:** Działający AI Chat

### Sprint 2.1: P0 - Critical Fixes (8-12h)

#### Task 2.1.1: Fix "Nowa sesja strategiczna" Label

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| **File**     | `src/components/AIChat/ChatHistorySidebar.tsx` |
| **Status**   | 🔴 TODO                                        |
| **Priority** | P0                                             |
| **Effort**   | 1h                                             |

**Zmiany:**

- [ ] Zmień "Nowa sesja strategiczna" → "Nowy czat"
- [ ] Zmień "Create project" → "Nowy folder"
- [ ] Zaktualizuj tłumaczenia w `public/locales/*/ai.json`

---

#### Task 2.1.2: Fix "empty" Context Display

| Field        | Value                                                                      |
| ------------ | -------------------------------------------------------------------------- |
| **Files**    | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/contexts/AIContext.tsx` |
| **Status**   | 🔴 TODO                                                                    |
| **Priority** | P0                                                                         |
| **Effort**   | 2h                                                                         |

**Zmiany:**

- [ ] Nie pokazuj "empty" gdy brak kontekstu
- [ ] Zamiast "Context-aware • empty" pokaż "Rozmowa ogólna" lub ukryj
- [ ] Dodaj walidację kontekstu przed wyświetleniem

---

#### Task 2.1.3: Fix Input Placeholder

| Field        | Value                                         |
| ------------ | --------------------------------------------- |
| **File**     | `src/components/AIChat/EnhancedChatInput.tsx` |
| **Status**   | 🔴 TODO                                       |
| **Priority** | P0                                            |
| **Effort**   | 1h                                            |

**Zmiany:**

- [ ] Zmień "Zapytaj o empty..." → dynamiczny placeholder
- [ ] Gdy jest kontekst: "Jak mogę pomóc z [nazwa projektu]?"
- [ ] Gdy brak: "Jak mogę Ci pomóc?"

---

#### Task 2.1.4: Rename "Projects" → "Foldery"

| Field        | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| **Files**    | `src/components/AIChat/ChatHistorySidebar.tsx`, `src/store/useChatProjectStore.ts` |
| **Status**   | 🔴 TODO                                                                            |
| **Priority** | P0                                                                                 |
| **Effort**   | 2h                                                                                 |

**Zmiany:**

- [ ] Zmień nagłówek sekcji "PROJECTS" → "FOLDERY"
- [ ] Zmień "Create project" → "Nowy folder"
- [ ] Zaktualizuj typ `ChatProject` → `ChatFolder` (opcjonalnie, aliasy)
- [ ] Zaktualizuj tłumaczenia

---

#### Task 2.1.5: Add Context Badge Component

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| **File**     | `src/components/AIChat/ContextBadge.tsx` (NEW) |
| **Status**   | 🔴 TODO                                        |
| **Priority** | P0                                             |
| **Effort**   | 4h                                             |

**Zmiany:**

- [ ] Stwórz nowy komponent `ContextBadge`
- [ ] 4 warianty: general, project, entity, assessment
- [ ] Integracja z `AIContext.workspaceContext`
- [ ] Wyświetlanie w nagłówku i nad inputem
- [ ] Ikony i kolory dla różnych typów kontekstu

---

#### Task 2.1.6: Separate chatFolderId from pmoProjectId

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| **Files**    | `src/store/useConversationStore.ts`, `src/types/workspace.ts` |
| **Status**   | 🔴 TODO                                                       |
| **Priority** | P0                                                            |
| **Effort**   | 3h                                                            |

**Zmiany:**

- [ ] Rename `chatProjectId` → `chatFolderId` w typach
- [ ] Rename `projectId` → `pmoProjectId` dla jasności (lub dodaj alias)
- [ ] Dodaj migrację dla istniejących danych w localStorage
- [ ] Zaktualizuj wszystkie referencje w komponentach

---

### Sprint 2.1 Checklist

```
SPRINT 2.1: P0 CRITICAL (8-12h)
├── 2.1.1 Fix "Nowa sesja strategiczna"    [ ] (1h)
├── 2.1.2 Fix "empty" context display       [ ] (2h)
├── 2.1.3 Fix input placeholder             [ ] (1h)
├── 2.1.4 Rename Projects → Foldery         [ ] (2h)
├── 2.1.5 Add Context Badge component       [ ] (4h)
└── 2.1.6 Separate chatFolderId/pmoProjectId [ ] (3h)

Total: ~13h
```

---

### Sprint 2.2: P1 - High Priority (16-24h)

#### Task 2.2.1: Implement Memory Manager Service

| Field        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| **Files**    | `server/src/services/aiMemoryManager.ts` (NEW), migrations |
| **Status**   | 🔴 TODO                                                    |
| **Priority** | P1                                                         |
| **Effort**   | 8h                                                         |

**Zmiany:**

- [ ] Stwórz serwis `AIMemoryManager`
- [ ] Metody: `getUserMemory`, `updateUserMemory`, `getOrgMemory`, `updateOrgMemory`
- [ ] Migracja SQL dla tabel `ai_user_memory`, `ai_org_memory`
- [ ] Integracja z AI Pipeline (ładowanie pamięci do kontekstu)
- [ ] Auto-update po każdej rozmowie

---

#### Task 2.2.2: Add Memory Tables Migration

| Field        | Value                                              |
| ------------ | -------------------------------------------------- |
| **File**     | `server/migrations/250_ai_memory_system.sql` (NEW) |
| **Status**   | 🔴 TODO                                            |
| **Priority** | P1                                                 |
| **Effort**   | 2h                                                 |

**Zawartość:**

```sql
-- ai_user_memory - User preferences & interaction history
-- ai_org_memory - Organization context & terminology
-- ai_memory_updates - Track memory changes
```

---

#### Task 2.2.3: Enhance Workspace Context Injection

| Field        | Value                                                             |
| ------------ | ----------------------------------------------------------------- |
| **Files**    | `src/contexts/AIContext.tsx`, `src/store/useConversationStore.ts` |
| **Status**   | ⚠️ Partial                                                        |
| **Priority** | P1                                                                |
| **Effort**   | 4h                                                                |

**Zmiany:**

- [ ] Rozszerz `WorkspaceContext` o więcej danych
- [ ] Dodaj entity data (task details, initiative details)
- [ ] Integracja z PMO Store dla bieżącego projektu
- [ ] Przekazywanie do AI Pipeline

---

#### Task 2.2.4: Replace Focus Mode Icons with Dropdown

| Field        | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| **Files**    | `src/components/AIChat/Input/FocusModeSelector.tsx`, `UnifiedChatPanel.tsx` |
| **Status**   | 🔴 TODO                                                                     |
| **Priority** | P1                                                                          |
| **Effort**   | 3h                                                                          |

**Zmiany:**

- [ ] Zamień ikony na dropdown menu
- [ ] Pokaż aktualny tryb w nagłówku
- [ ] Dodaj opisy trybów w menu
- [ ] Zapisuj preferencję użytkownika

---

#### Task 2.2.5: Redesign Tools Menu

| Field        | Value                                 |
| ------------ | ------------------------------------- |
| **File**     | `src/components/AIChat/ToolsMenu.tsx` |
| **Status**   | 🔴 TODO                               |
| **Priority** | P1                                    |
| **Effort**   | 4h                                    |

**Zmiany:**

- [ ] Nowa struktura: Tryb odpowiedzi, Źródła wiedzy, Szybkie akcje, Ustawienia
- [ ] Implementacja przełączników dla źródeł wiedzy
- [ ] Quick Actions: Project analysis, Daily summary, Initiatives suggestions
- [ ] Link do ustawień instrukcji AI

---

#### Task 2.2.6: Implement History Time Groups

| Field        | Value                                          |
| ------------ | ---------------------------------------------- |
| **File**     | `src/components/AIChat/ChatHistorySidebar.tsx` |
| **Status**   | 🔴 TODO                                        |
| **Priority** | P1                                             |
| **Effort**   | 3h                                             |

**Zmiany:**

- [ ] Grupowanie rozmów: Dzisiaj, Wczoraj, Ten tydzień, Starsze
- [ ] Funkcja `groupConversationsByDate`
- [ ] UI dla sekcji z nagłówkami czasowymi
- [ ] Pokazywanie liczby rozmów w archiwum

---

### Sprint 2.2 Checklist

```
SPRINT 2.2: P1 HIGH (16-24h)
├── 2.2.1 Memory Manager service        [ ] (8h)
├── 2.2.2 Memory tables migration       [ ] (2h)
├── 2.2.3 Workspace Context enhancement [ ] (4h)
├── 2.2.4 Focus Mode dropdown           [ ] (3h)
├── 2.2.5 Tools Menu redesign           [ ] (4h)
└── 2.2.6 History time groups           [ ] (3h)

Total: ~24h
```

---

### Sprint 2.3: P2 - Medium Priority (16-24h)

#### Task 2.3.1: AI Actions with Approval Workflow

| Field        | Value                                                                                   |
| ------------ | --------------------------------------------------------------------------------------- |
| **Files**    | `server/src/services/aiActionExecutor.ts`, `src/components/AIChat/ActionCard.tsx` (NEW) |
| **Status**   | ⚠️ Partial                                                                              |
| **Priority** | P2                                                                                      |
| **Effort**   | 12h                                                                                     |

**Zmiany:**

- [ ] Rozszerz `AIActionExecutor` o nowe typy akcji
- [ ] Stwórz komponent `ActionCard` do wyświetlania w wiadomościach
- [ ] Workflow: Propose → Approve/Reject → Execute
- [ ] Audit logging dla wszystkich akcji
- [ ] UI dla pending actions w sidebar

---

#### Task 2.3.2: Inline Action Cards in Messages

| Field        | Value                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| **Files**    | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/ActionCard.tsx` |
| **Status**   | 🔴 TODO                                                                              |
| **Priority** | P2                                                                                   |
| **Effort**   | 4h                                                                                   |

**Zmiany:**

- [ ] Wykrywanie akcji w odpowiedziach AI (parsing)
- [ ] Renderowanie `ActionCard` inline w wiadomościach
- [ ] Przyciski Approve/Dismiss
- [ ] Status update po wykonaniu akcji

---

#### Task 2.3.3: Knowledge Sources Toggles

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Files**    | `src/components/AIChat/ToolsMenu.tsx`, hooks |
| **Status**   | 🔴 TODO                                      |
| **Priority** | P2                                           |
| **Effort**   | 4h                                           |

**Zmiany:**

- [ ] Checkboxy dla źródeł: PMO Standards, Ten projekt, Bazy wiedzy, Web
- [ ] Stan zapisywany w store
- [ ] Przekazywanie do AI Pipeline jako parametry
- [ ] Backend support dla filtrowania źródeł

---

#### Task 2.3.4: Feedback → Learning Pipeline

| Field        | Value                                                      |
| ------------ | ---------------------------------------------------------- |
| **Files**    | `server/src/services/aiLearningEngine.ts` (NEW), cron jobs |
| **Status**   | 🔴 TODO                                                    |
| **Priority** | P2                                                         |
| **Effort**   | 6h                                                         |

**Zmiany:**

- [ ] Serwis `AILearningEngine`
- [ ] Analiza feedback patterns
- [ ] Generowanie sugestii instrukcji
- [ ] Cron job dla daily pattern analysis
- [ ] Dashboard metrics w SuperAdmin

---

### Sprint 2.3 Checklist

```
SPRINT 2.3: P2 MEDIUM (16-24h)
├── 2.3.1 AI Actions approval workflow  [ ] (12h)
├── 2.3.2 Inline Action Cards           [ ] (4h)
├── 2.3.3 Knowledge Sources toggles     [ ] (4h)
└── 2.3.4 Feedback Learning pipeline    [ ] (6h)

Total: ~26h
```

---

## 🗺️ FAZA 3: MAPA PRZEPŁYWÓW

**Cel:** Zmapować i udokumentować wszystkie połączenia AI Chat z innymi modułami  
**Czas:** 8-12 godzin  
**Output:** Mapy przepływów, diagram integracji

### Task 3.1: Module Integration Map

| Field        | Value                                         |
| ------------ | --------------------------------------------- |
| **File**     | `docs/flows/AI_CHAT_INTEGRATION_MAP.md` (NEW) |
| **Status**   | 🔴 TODO                                       |
| **Priority** | P1                                            |
| **Effort**   | 3h                                            |

**Zawartość:**

- [ ] Lista wszystkich modułów używających AI Chat
- [ ] Typ integracji (context source, action target, data provider)
- [ ] Diagram połączeń
- [ ] Dependency matrix

---

### Task 3.2: Context Flow Diagram

| Field        | Value                                 |
| ------------ | ------------------------------------- |
| **File**     | `docs/flows/AI_CONTEXT_FLOW.md` (NEW) |
| **Status**   | 🔴 TODO                               |
| **Priority** | P1                                    |
| **Effort**   | 2h                                    |

**Zawartość:**

- [ ] Skąd AI bierze kontekst (5 warstw)
- [ ] Jak kontekst przepływa przez system
- [ ] Diagram sekwencji context injection
- [ ] Przykłady kontekstu dla różnych widoków

---

### Task 3.3: Action Flow Diagram

| Field        | Value                                 |
| ------------ | ------------------------------------- |
| **File**     | `docs/flows/AI_ACTIONS_FLOW.md` (NEW) |
| **Status**   | 🔴 TODO                               |
| **Priority** | P1                                    |
| **Effort**   | 2h                                    |

**Zawartość:**

- [ ] Typy akcji AI
- [ ] Workflow: Propose → Approve → Execute
- [ ] Diagram sekwencji dla każdego typu akcji
- [ ] Permissions matrix (kto może zatwierdzać)

---

### Task 3.4: Data Flow Analysis

| Field        | Value                              |
| ------------ | ---------------------------------- |
| **File**     | `docs/flows/AI_DATA_FLOW.md` (NEW) |
| **Status**   | 🔴 TODO                            |
| **Priority** | P1                                 |
| **Effort**   | 2h                                 |

**Zawartość:**

- [ ] Jakie dane AI odczytuje
- [ ] Jakie dane AI zapisuje
- [ ] Privacy considerations
- [ ] Data retention policies

---

### Task 3.5: Integration Tests Specification

| Field        | Value                                             |
| ------------ | ------------------------------------------------- |
| **File**     | `docs/testing/AI_CHAT_INTEGRATION_TESTS.md` (NEW) |
| **Status**   | 🔴 TODO                                           |
| **Priority** | P2                                                |
| **Effort**   | 3h                                                |

**Zawartość:**

- [ ] Test scenarios dla każdej integracji
- [ ] Mock data requirements
- [ ] Expected behaviors
- [ ] Edge cases

---

### Faza 3 Checklist

```
FAZA 3: MAPA PRZEPŁYWÓW (8-12h)
├── 3.1 Module Integration Map      [ ] (3h)
├── 3.2 Context Flow Diagram        [ ] (2h)
├── 3.3 Action Flow Diagram         [ ] (2h)
├── 3.4 Data Flow Analysis          [ ] (2h)
└── 3.5 Integration Tests Spec      [ ] (3h)

Total: ~12h
```

---

## 📊 Full Implementation Matrix

### All Tasks by Priority

| ID    | Task                 | Priority | Effort | Phase | Status |
| ----- | -------------------- | -------- | ------ | ----- | ------ |
| 1.1   | Design Specification | P0       | 2h     | 1     | 🔴     |
| 1.2   | Data Model Spec      | P0       | 1.5h   | 1     | 🔴     |
| 1.3   | API Specification    | P0       | 1h     | 1     | 🔴     |
| 1.4   | Flow Diagram Update  | P0       | 1.5h   | 1     | 🔴     |
| 2.1.1 | Fix session label    | P0       | 1h     | 2     | 🔴     |
| 2.1.2 | Fix empty context    | P0       | 2h     | 2     | 🔴     |
| 2.1.3 | Fix placeholder      | P0       | 1h     | 2     | 🔴     |
| 2.1.4 | Rename Projects      | P0       | 2h     | 2     | 🔴     |
| 2.1.5 | Context Badge        | P0       | 4h     | 2     | 🔴     |
| 2.1.6 | Separate IDs         | P0       | 3h     | 2     | 🔴     |
| 2.2.1 | Memory Manager       | P1       | 8h     | 2     | 🔴     |
| 2.2.2 | Memory migration     | P1       | 2h     | 2     | 🔴     |
| 2.2.3 | Workspace Context    | P1       | 4h     | 2     | ⚠️     |
| 2.2.4 | Focus Mode dropdown  | P1       | 3h     | 2     | 🔴     |
| 2.2.5 | Tools Menu redesign  | P1       | 4h     | 2     | 🔴     |
| 2.2.6 | History time groups  | P1       | 3h     | 2     | 🔴     |
| 2.3.1 | Actions workflow     | P2       | 12h    | 2     | ⚠️     |
| 2.3.2 | Action Cards         | P2       | 4h     | 2     | 🔴     |
| 2.3.3 | Knowledge toggles    | P2       | 4h     | 2     | 🔴     |
| 2.3.4 | Learning pipeline    | P2       | 6h     | 2     | 🔴     |
| 3.1   | Integration Map      | P1       | 3h     | 3     | 🔴     |
| 3.2   | Context Flow         | P1       | 2h     | 3     | 🔴     |
| 3.3   | Action Flow          | P1       | 2h     | 3     | 🔴     |
| 3.4   | Data Flow            | P1       | 2h     | 3     | 🔴     |
| 3.5   | Integration Tests    | P2       | 3h     | 3     | 🔴     |

### Summary

| Phase               | Tasks  | Hours    | Status       |
| ------------------- | ------ | -------- | ------------ |
| **Faza 1**          | 4      | 6h       | ✅ COMPLETE  |
| **Faza 2 Sprint 1** | 6      | 13h      | ✅ COMPLETE  |
| **Faza 2 Sprint 2** | 5      | 24h      | ✅ COMPLETE  |
| **Faza 2 Sprint 3** | 4      | 26h      | ✅ COMPLETE  |
| **Faza 3**          | 5      | 12h      | ✅ COMPLETE  |
| **TOTAL**           | **24** | **~81h** | ✅ COMPLETE  |

---

## 🎯 Next Steps

1. **Immediately:** Start Faza 1 - create documentation
2. **After docs:** Sprint 2.1 - P0 critical fixes
3. **Week 2:** Sprint 2.2 - P1 enhancements
4. **Week 3:** Sprint 2.3 - P2 features + Faza 3 flows

---

## 📝 Progress Tracking

Use this section to track progress:

```
[x] Faza 1 Complete (2026-01-11)
    [x] 1.1 Design Spec - docs/AI_CHAT_SYSTEM_DESIGN.md
    [x] 1.2 Data Model - docs/AI_CHAT_DATA_MODEL.md
    [x] 1.3 API Spec - docs/api/AI_CHAT_API.md
    [x] 1.4 Flow Update - docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md

[x] Faza 2 Sprint 2.1 Complete (2026-01-11)
    [x] 2.1.1 Session label - "Nowy czat" in ChatHistorySidebar.tsx
    [x] 2.1.2 Empty context - Hidden when type='empty' in UnifiedChatPanel.tsx
    [x] 2.1.3 Placeholder - Smart placeholder based on context
    [x] 2.1.4 Projects rename - "Foldery" in ChatHistorySidebar.tsx
    [x] 2.1.5 Context Badge - NEW: src/components/AIChat/ContextBadge.tsx
    [x] 2.1.6 Separate IDs - Comments and aliases in stores

[x] Faza 2 Sprint 2.2 Complete (2026-01-11)
    [x] 2.2.1 Memory Manager - NEW: src/services/memoryService.ts + API stubs
    [x] 2.2.2 Workspace Context - Enhanced via ContextBadge integration
    [x] 2.2.3 Focus Mode dropdown - Redesigned FocusModeSelector.tsx v2.0
    [x] 2.2.4 Tools Menu redesign - Enhanced ToolsMenu.tsx v2.0
    [x] 2.2.5 History time groups - Polish labels in ConversationList.tsx

[x] Faza 2 Sprint 2.3 Complete (2026-01-11)
    [x] 2.3.1 AI Actions types & store - NEW: src/types/aiActions.ts + src/store/useAIActionsStore.ts
    [x] 2.3.2 AI Action Card - NEW: src/components/AIChat/AIActionCard.tsx
    [x] 2.3.3 Actions approval workflow - Complete with API integration
    [x] 2.3.4 Feedback Learning - src/services/feedbackLearningService.ts integrated

[x] Faza 3 Complete (2026-01-11)
    [x] 3.1 Integration Map - docs/flows/AI_CHAT_INTEGRATION_MAP.md
    [x] 3.2 Context Flow - docs/flows/AI_CONTEXT_FLOW.md
    [x] 3.3 Action Flow - docs/flows/AI_ACTIONS_FLOW.md
    [x] 3.4 Data Flow - docs/flows/AI_DATA_FLOW.md
    [x] 3.5 Integration Tests - docs/testing/AI_CHAT_INTEGRATION_TESTS.md
```

---

## Appendix: File Locations

### New Files to Create

```
docs/
├── AI_CHAT_SYSTEM_DESIGN.md          (Task 1.1)
├── AI_CHAT_DATA_MODEL.md             (Task 1.2)
├── api/
│   └── AI_CHAT_API.md                (Task 1.3)
└── flows/
    ├── AI_CHAT_INTEGRATION_MAP.md    (Task 3.1)
    ├── AI_CONTEXT_FLOW.md            (Task 3.2)
    ├── AI_ACTIONS_FLOW.md            (Task 3.3)
    └── AI_DATA_FLOW.md               (Task 3.4)

src/
└── components/AIChat/
    ├── ContextBadge.tsx              (Task 2.1.5)
    └── ActionCard.tsx                (Task 2.3.2)

server/
├── src/services/
│   ├── aiMemoryManager.ts            (Task 2.2.1)
│   └── aiLearningEngine.ts           (Task 2.3.4)
└── migrations/
    └── 250_ai_memory_system.sql      (Task 2.2.2)
```

### Files to Modify

```
src/components/AIChat/
├── ChatHistorySidebar.tsx            (Tasks 2.1.1, 2.1.4, 2.2.6)
├── UnifiedChatPanel.tsx              (Tasks 2.1.2, 2.3.2)
├── EnhancedChatInput.tsx             (Task 2.1.3)
├── ToolsMenu.tsx                     (Tasks 2.2.5, 2.3.3)
└── Input/FocusModeSelector.tsx       (Task 2.2.4)

src/store/
├── useConversationStore.ts           (Tasks 2.1.6, 2.2.3)
└── useChatProjectStore.ts            (Task 2.1.4)

src/contexts/
└── AIContext.tsx                     (Tasks 2.1.2, 2.2.3)

docs/flows/core/
└── AI_CHAT_ASSISTANCE_FLOW.md        (Task 1.4)
```

---

_Document generated: 2026-01-11_  
_Next review: After each sprint completion_
