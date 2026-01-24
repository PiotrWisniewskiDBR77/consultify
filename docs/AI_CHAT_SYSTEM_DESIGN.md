# AI Chat System - Design Specification

> **Document:** AI_CHAT_SYSTEM_DESIGN.md  
> **Version:** 2.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED  
> **Flow ID:** FLOW-AIASSISTANT-001

---

## 1. Vision Statement

### 1.1 Core Philosophy

> **Consultinity AI** to nie chatbot - to **cyfrowy partner transformacji**, który rozumie kontekst organizacji, pamięta interakcje, wykonuje działania i uczy się z każdej rozmowy.

### 1.2 AI Maturity Journey

System wspiera organizacje na różnych poziomach dojrzałości AI:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI MATURITY STAGES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  STAGE 1: SCEPTIC                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Firma nie wierzy w AI                                     │   │
│  │ • AI jeszcze mało wie o firmie                              │   │
│  │ • Rola: Doradza, zachęca, uczy się, proponuje               │   │
│  │ • Alertuje jasno o zagrożeniach i możliwościach             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  STAGE 2: PARTNER                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Firma zaczyna ufać AI                                     │   │
│  │ • AI zna kontekst firmy                                     │   │
│  │ • Rola: Tworzy sugestie działań, przygotowuje je            │   │
│  │ • Wspiera tworzenie dokumentacji                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  STAGE 3: AUTONOMY                                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • Pełne zaufanie do AI                                      │   │
│  │ • AI głęboko zna firmę i jej wzorce                         │   │
│  │ • Rola: Tworzy i wykonuje działania                         │   │
│  │ • Podejmuje decyzje w ramach uprawnień                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Competitive Differentiators

| Feature                          | ChatGPT | Claude         | Perplexity | **Consultinity AI** |
| -------------------------------- | ------- | -------------- | ---------- | ------------------- |
| PMO Context Awareness            | ❌      | ❌             | ❌         | ✅                  |
| Split-Screen Workspace           | ❌      | ✅ (Artifacts) | ❌         | ✅                  |
| Organizational Memory            | ❌      | ✅ (Projects)  | ❌         | ✅                  |
| Action Execution                 | ❌      | ❌             | ❌         | ✅                  |
| Standards Compliance (ISO/PMBOK) | ❌      | ❌             | ❌         | ✅                  |
| Voice Conversation               | ✅      | ❌             | ❌         | ✅                  |
| Multi-focus Modes                | ❌      | ❌             | ✅         | ✅                  |
| Business Actions with Approval   | ❌      | ❌             | ❌         | ✅                  |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONSULTINITY AI CHAT                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        PRESENTATION LAYER                             │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │   │ Full-Screen │  │ Split-View  │  │  Floating   │  │ Contextual │  │   │
│  │   │    Chat     │  │    Chat     │  │   Widget    │  │   Assist   │  │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  │                           │                                           │   │
│  │                           ▼                                           │   │
│  │   ┌────────────────────────────────────────────────────────────────┐ │   │
│  │   │                    UnifiedChatPanel                             │ │   │
│  │   │  ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────────┐ │ │   │
│  │   │  │  Input   │ │  Messages   │ │  Actions   │ │  Artifacts   │ │ │   │
│  │   │  │  Area    │ │    List     │ │   Panel    │ │    Panel     │ │ │   │
│  │   │  └──────────┘ └─────────────┘ └────────────┘ └──────────────┘ │ │   │
│  │   └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         STATE LAYER (Zustand)                         │   │
│  │                                                                       │   │
│  │   ┌────────────────┐  ┌────────────────┐  ┌─────────────────────┐   │   │
│  │   │ Conversation   │  │    Chat        │  │     AI Context      │   │   │
│  │   │    Store       │  │   Folders      │  │       Store         │   │   │
│  │   │                │  │    Store       │  │                     │   │   │
│  │   │ • messages     │  │ • folders      │  │ • workspaceContext  │   │   │
│  │   │ • conversations│  │ • assignments  │  │ • pmoContext        │   │   │
│  │   │ • displayMode  │  │ • templates    │  │ • screenContext     │   │   │
│  │   └────────────────┘  └────────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          API LAYER                                    │   │
│  │                                                                       │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │   │
│  │   │ /chat/stream│  │/conversations│  │ /ai/memory  │  │/ai/actions │  │   │
│  │   │    SSE      │  │    REST     │  │    REST     │  │    REST    │  │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         INTELLIGENCE LAYER                            │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │                      AI Pipeline                             │    │   │
│  │   │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────────┐  │    │   │
│  │   │  │ Context │→│ Prompt   │→│   LLM   │→│ Post-Processing │  │    │   │
│  │   │  │ Builder │ │ Assembly │ │ Gateway │ │ (Actions, etc)  │  │    │   │
│  │   │  └─────────┘ └──────────┘ └─────────┘ └─────────────────┘  │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │   ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐    │   │
│  │   │  Memory        │  │  Learning      │  │   Instructions     │    │   │
│  │   │  Manager       │  │  Engine        │  │      DB            │    │   │
│  │   └────────────────┘  └────────────────┘  └────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component              | Responsibility                        | File Location                                  | Status             |
| ---------------------- | ------------------------------------- | ---------------------------------------------- | ------------------ |
| **UnifiedChatPanel**   | Main chat UI, messages, input         | `src/components/AIChat/UnifiedChatPanel.tsx`   | ✅ Exists          |
| **ConversationStore**  | Conversations, messages, display mode | `src/store/useConversationStore.ts`            | ✅ Exists          |
| **ChatFolderStore**    | Chat folders (organize conversations) | `src/store/useChatProjectStore.ts`             | ⚠️ Rename needed   |
| **AIContext**          | PMO/Workspace context injection       | `src/contexts/AIContext.tsx`                   | ✅ Exists          |
| **EnhancedChatInput**  | Input area with voice, files, tools   | `src/components/AIChat/EnhancedChatInput.tsx`  | ✅ Exists          |
| **ChatHistorySidebar** | Conversation history, folders         | `src/components/AIChat/ChatHistorySidebar.tsx` | ⚠️ UI fixes needed |
| **ContextBadge**       | Show what AI sees                     | NEW: `src/components/AIChat/ContextBadge.tsx`  | 🔴 To create       |
| **ActionCard**         | AI action proposals                   | NEW: `src/components/AIChat/ActionCard.tsx`    | 🔴 To create       |
| **AI Pipeline**        | LLM orchestration, streaming          | `server/src/routes/ai.routes.ts`               | ✅ Exists          |
| **Memory Manager**     | User/Org memory persistence           | NEW: `server/src/services/aiMemoryManager.ts`  | 🔴 To create       |
| **Learning Engine**    | Feedback → Instruction generation     | NEW: `server/src/services/aiLearningEngine.ts` | 🔴 To create       |

---

## 3. Display Modes

### 3.1 Mode Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHAT DISPLAY MODES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODE 1: FULL-SCREEN (default)                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ┌─────────┐ ┌───────────────────────────────────────────────────────┐ │  │
│  │ │         │ │                                                       │ │  │
│  │ │ History │ │                   Chat Area                           │ │  │
│  │ │ Sidebar │ │                   (centered, max-width)               │ │  │
│  │ │         │ │                                                       │ │  │
│  │ │ Folders │ │                   [Messages]                          │ │  │
│  │ │         │ │                                                       │ │  │
│  │ │ Chats   │ │                   [Enhanced Input]                    │ │  │
│  │ └─────────┘ └───────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Use case: Dedicated AI conversations, brainstorming, deep work             │
│                                                                              │
│  MODE 2: SPLIT-SCREEN                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ┌─────────────────────────────────┐ ┌───────────────────────────────┐ │  │
│  │ │                                 │ │                               │ │  │
│  │ │        Workspace Content        │ │      Chat Panel (40%)         │ │  │
│  │ │    (Task, Initiative, etc.)     │ │                               │ │  │
│  │ │                                 │ │      AI sees this content     │ │  │
│  │ │    ← User works here            │ │      and can help with it     │ │  │
│  │ │                                 │ │                               │ │  │
│  │ └─────────────────────────────────┘ └───────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Use case: Working on specific task/initiative with AI assistance           │
│                                                                              │
│  MODE 3: COLLAPSED (minimized)                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                    Any View                         ┌───────────┐    │  │
│  │                                                     │    AI     │    │  │
│  │                                                     │  Widget   │    │  │
│  │                                                     │           │    │  │
│  │                                                     │    [💬]   │    │  │
│  │                                                     └───────────┘    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Use case: Quick access to AI while working on other tasks                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Mode Transitions

```typescript
type ChatDisplayMode = 'full' | 'split' | 'collapsed';

// State in useConversationStore
interface ConversationState {
  displayMode: ChatDisplayMode;
  previousView: AppView | null; // For returning after full-screen
  workspaceContext: WorkspaceContext | null;
}

// Transitions
// full → split: User clicks split icon, AI gets workspace context
// split → full: User clicks expand icon
// any → collapsed: User clicks minimize
// collapsed → split: User clicks widget while on workspace view
// collapsed → full: User clicks widget while on non-workspace view
```

---

## 4. UI Components Design

### 4.1 Header Design

**CURRENT (Problems):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [🕐] ✨ AI Assistant  •  Context-aware • empty   [✨][📖][📂][🔍][🌐]│
└──────────────────────────────────────────────────────────────────────┘

❌ "Context-aware • empty" looks broken and confusing
❌ Focus mode icons not labeled - users don't know what they do
❌ No conversation title visible
❌ Too many unlabeled icons
```

**PROPOSED (Solution):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [≡]  [+ Nowy czat]  │  [Conversation Title]  │  Focus: [All ▼]     │
│                      │                         │                      │
│                      │  📂 Projekt: Marketing  │        [⬜][⬛]      │
└──────────────────────────────────────────────────────────────────────┘

✅ Clear "New Chat" button (not "Nowa sesja strategiczna")
✅ Conversation title visible and editable
✅ Context shown as badge (Project name)
✅ Focus mode as labeled dropdown
✅ Display mode toggles (split/full)
```

### 4.2 Context Badge Component

**Purpose:** Show users what information AI has access to

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTEXT BADGE VARIANTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Variant 1: NO CONTEXT (general chat)                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ ✨ Rozmowa ogólna                                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  Shows when: No workspace context, general questions                        │
│                                                                              │
│  Variant 2: PMO PROJECT CONTEXT                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 📂 Projekt: Marketing Digital Transformation 2026                     │   │
│  │    Faza: Assessment • Postęp: 45%                                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  Shows when: User is viewing/working on a PMO project                       │
│                                                                              │
│  Variant 3: SPECIFIC ENTITY CONTEXT                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 📋 Task: Implement SSO Integration                                    │   │
│  │    Projekt: IT Infrastructure • Status: In Progress                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  Shows when: User is in split-view working on specific task/initiative      │
│                                                                              │
│  Variant 4: ASSESSMENT CONTEXT                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ 🎯 Assessment: DRD - Procesy Cyfrowe                                  │   │
│  │    Aktualny: 3 • Docelowy: 5 • Gap: 2 poziomy                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│  Shows when: User is completing assessment                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Component Interface:**

```typescript
interface ContextBadgeProps {
  context: WorkspaceContext | null;
  variant?: 'compact' | 'detailed';
  onClick?: () => void; // Navigate to context source
}

// Renders based on context.type:
// 'empty' → Variant 1
// 'project' → Variant 2
// 'task' | 'initiative' | 'decision' → Variant 3
// 'assessment' → Variant 4
```

### 4.3 Enhanced Input Area Design

**CURRENT:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Zapytaj o empty...                                                   │
│                                                                       │
│  [+] [🔧]                                          [🎤] [🎵]          │
└──────────────────────────────────────────────────────────────────────┘

❌ "Zapytaj o empty..." - confusing placeholder
❌ Icons without labels
❌ No context indication
```

**PROPOSED:**

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ 📂 Marketing DX  •  Initiative: Automation Phase 1            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                                                                 │  │
│  │  Jak mogę Ci pomóc z Automation Phase 1?                       │  │
│  │                                                                 │  │
│  │  [Type your message...]                                         │  │
│  │                                                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  [📎 Dodaj plik]  [🔧 Narzędzia]              [🎤]  [📨 Wyślij]     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘

✅ Context badge shows WHAT AI sees
✅ Smart placeholder based on context
✅ Clear button labels
✅ Voice button simplified (toggles mode)
```

**Smart Placeholder Logic:**

```typescript
function getSmartPlaceholder(context: WorkspaceContext | null): string {
  if (!context || context.type === 'empty') {
    return 'Jak mogę Ci pomóc?';
  }

  switch (context.type) {
    case 'project':
      return `Jak mogę pomóc z projektem ${context.entityName}?`;
    case 'task':
      return `Masz pytanie o zadanie "${context.entityName}"?`;
    case 'initiative':
      return `Jak mogę pomóc z inicjatywą "${context.entityName}"?`;
    case 'assessment':
      return `Potrzebujesz pomocy z oceną ${context.entityName}?`;
    case 'decision':
      return `Pomóc Ci podjąć decyzję?`;
    default:
      return 'Jak mogę Ci pomóc?';
  }
}
```

### 4.4 History Sidebar Design

**CURRENT:**

```
┌────────────────────┐
│ Historia        [X]│
│                    │
│ [+ Nowa sesja     ]│  ← Problem: Too formal
│ [  strategiczna   ]│
│                    │
│ 🔍 Szukaj rozmów...│
│                    │
│ PROJECTS           │  ← Problem: Confuses with PMO Projects
│ [📁+ Create project]│
│                    │
│ Brak rozmów        │
│ Rozpocznij nowy...│
│                    │
│ [📦 Archiwum]      │
└────────────────────┘
```

**PROPOSED:**

```
┌────────────────────────────┐
│ Historia              [X]  │
│                            │
│ [+ Nowy czat]              │  ← Clear, simple
│                            │
│ 🔍 Szukaj rozmów...        │
│                            │
│ FOLDERY                    │  ← Renamed: no confusion
│ ├── 📁 Marketing DX        │     with PMO Projects
│ │   └── (3 rozmowy)        │
│ ├── 📁 Operations Review   │
│ └── [+ Nowy folder]        │
│                            │
│ OSTATNIE ROZMOWY           │  ← Clear grouping
│ ├── Dzisiaj                │
│ │   ├── Assessment Q&A     │
│ │   └── Budget planning    │
│ ├── Wczoraj                │
│ │   └── Team structure     │
│ └── Ten tydzień            │
│     └── Initiative review  │
│                            │
│ [📦 Archiwum (5)]          │  ← Shows count
└────────────────────────────┘

Key Changes:
✅ "Nowa sesja strategiczna" → "Nowy czat"
✅ "PROJECTS" → "FOLDERY"
✅ Time-based grouping for recent chats
✅ Archive shows conversation count
```

### 4.5 Tools Menu Redesign

**CURRENT:**

```
┌──────────────────────────────┐
│ TRYBY AI                      │
│ ├── Głęboka analiza    [○]   │  ← Not clear, not implemented
│ ├── Wyszukiwanie w sieci[○]  │  ← Not implemented
│ └── Pokaż rozumowanie  [○]   │
│                               │
│ NARZĘDZIA PMO                 │
│ ├── Rozpocznij ocenę   [↗]   │
│ ├── Generuj inicjatywy [↗]   │
│ ├── Oblicz ROI         [↗]   │
│ └── Utwórz raport      [↗]   │
│                               │
│ POŁĄCZENIA                    │
│ ├── Zarządzaj konektorami    │  ← Not implemented
│ └── Bazy wiedzy              │  ← Not implemented
└──────────────────────────────┘
```

**PROPOSED:**

```
┌──────────────────────────────┐
│ 🎯 TRYB ODPOWIEDZI            │
│ ├── [●] Standardowy          │  ← Default, fast responses
│ ├── [○] Deep Thinking        │  ← Shows reasoning steps
│ └── [○] Research Mode        │  ← Longer, more thorough
│                               │
│ 🔍 ŹRÓDŁA WIEDZY              │
│ ├── [✓] PMO Standards        │  ← ISO, PMBOK, PRINCE2
│ ├── [✓] Ten projekt          │  ← Current project data
│ ├── [○] Bazy wiedzy org      │  ← Organization knowledge
│ └── [○] Web (real-time)      │  ← Web search
│                               │
│ ⚡ SZYBKIE AKCJE               │
│ ├── 📊 Analiza projektu      │  ← Generate analysis
│ ├── 📝 Podsumowanie dnia     │  ← Daily brief
│ ├── 💡 Sugestie inicjatyw    │  ← Generate initiatives
│ └── 📈 Raport statusu        │  ← Status report
│                               │
│ ⚙️ USTAWIENIA                  │
│ └── Instrukcje dla AI        │  ← Custom instructions
└──────────────────────────────┘

Key Changes:
✅ Clear sections with icons
✅ Knowledge sources as toggles
✅ Quick actions for common tasks
✅ Link to AI instructions settings
```

---

## 5. Chat Folders vs PMO Projects

### 5.1 Concept Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TWO TYPES OF "PROJECTS"                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐      │
│  │       CHAT FOLDERS          │  │        PMO PROJECTS              │      │
│  │       (organizacja czatów)  │  │        (projekty biznesowe)      │      │
│  ├─────────────────────────────┤  ├─────────────────────────────────┤      │
│  │                             │  │                                 │      │
│  │  Purpose:                   │  │  Purpose:                       │      │
│  │  Organize conversations     │  │  Digital Transformation         │      │
│  │                             │  │  Programs                       │      │
│  │  Examples:                  │  │                                 │      │
│  │  • "Marketing DX talks"     │  │  Examples:                      │      │
│  │  • "Budget planning"        │  │  • "Digital Transformation 2026"│      │
│  │  • "Personal brainstorms"   │  │  • "Lean Manufacturing Impl"    │      │
│  │                             │  │  • "Customer Experience Program"│      │
│  │  Contains:                  │  │                                 │      │
│  │  • Multiple conversations   │  │  Contains:                      │      │
│  │  • Custom AI instructions   │  │  • Assessment results           │      │
│  │                             │  │  • Initiatives                  │      │
│  │  Store: useChatFolderStore  │  │  • Tasks, Decisions             │      │
│  │  Field: chatFolderId        │  │  • Roadmap                      │      │
│  │                             │  │                                 │      │
│  │                             │  │  Store: usePMOStore             │      │
│  │                             │  │  Field: pmoProjectId            │      │
│  └─────────────────────────────┘  └─────────────────────────────────┘      │
│                                                                              │
│  RELATIONSHIP:                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                                                                       │   │
│  │   Chat Folder: "Marketing discussions"                               │   │
│  │       │                                                               │   │
│  │       ├── Chat 1: "Budget planning" ──────┐                          │   │
│  │       │                                    │                          │   │
│  │       ├── Chat 2: "Team structure"        │ ← These chats have       │   │
│  │       │                                    │   context from the       │   │
│  │       └── Chat 3: "Timeline review" ──────┘   PMO Project            │   │
│  │                                    ▲                                  │   │
│  │                                    │ pmoProjectId reference          │   │
│  │                                    │                                  │   │
│  │   PMO Project: "Marketing Digital Transformation 2026"               │   │
│  │       ├── Assessment (completed)                                     │   │
│  │       ├── 5 Initiatives                                              │   │
│  │       └── 23 Tasks                                                   │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 UI Naming Convention

| Current UI              | Proposed UI          | Reason                            |
| ----------------------- | -------------------- | --------------------------------- |
| "Projects" (sidebar)    | "Foldery"            | Avoid confusion with PMO Projects |
| "Create project"        | "Nowy folder"        | Clearer purpose                   |
| "Project context" badge | "📂 Projekt: [name]" | Show PMO Project context          |
| "chatProjectId" field   | "chatFolderId"       | Clearer in code                   |

---

## 6. Context System

### 6.1 Five Context Layers

When AI receives a message, it gets context from 5 layers:

```
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 1: SYSTEM (Platform-wide)                                   │
│  ├── Consultinity identity & philosophy                            │
│  ├── PMO standards (ISO 21500, PMBOK 7, PRINCE2)                   │
│  ├── Response quality guidelines                                   │
│  └── Action capabilities and limits                                │
│  Source: ai_instructions_system table (SuperAdmin managed)         │
└────────────────────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 2: ORGANIZATION (Tenant-specific)                           │
│  ├── Company profile & industry                                    │
│  ├── Custom terminology                                            │
│  ├── Preferred communication style                                 │
│  └── Organization-specific instructions                            │
│  Source: ai_instructions_org table (Admin managed)                 │
└────────────────────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 3: USER MEMORY (Personal)                                   │
│  ├── User preferences (detail level, language, style)              │
│  ├── Expertise areas                                               │
│  ├── Recent interaction patterns                                   │
│  └── Learned preferences from feedback                             │
│  Source: ai_user_memory table (Auto-collected)                     │
└────────────────────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 4: WORKSPACE (What user is viewing)                         │
│  ├── Current view (My Work, Assessment, Initiative, etc.)          │
│  ├── Selected entity (Task ID, Initiative ID, etc.)                │
│  ├── Entity data (title, status, description, etc.)                │
│  └── Current PMO Project context                                   │
│  Source: AIContext.workspaceContext (Real-time)                    │
└────────────────────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  LAYER 5: CONVERSATION (Chat session)                              │
│  ├── Current conversation history                                  │
│  ├── Chat Folder context (if assigned)                             │
│  ├── Focus mode selected                                           │
│  └── Attached files/documents                                      │
│  Source: useConversationStore (Session-based)                      │
└────────────────────────────────────────────────────────────────────┘
```

### 6.2 Context Flow Diagram

```
┌──────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────┐
│ User │    │ Chat API │    │ AI Orchestr. │    │ LLM      │    │ Memory  │
└──┬───┘    └────┬─────┘    └──────┬───────┘    └────┬─────┘    └────┬────┘
   │             │                 │                 │               │
   │ Send msg    │                 │                 │               │
   │────────────►│ Process         │                 │               │
   │             │────────────────►│                 │               │
   │             │                 │ Load Layer 1    │               │
   │             │                 │ (System instr)  │               │
   │             │                 │                 │               │
   │             │                 │ Load Layer 2    │               │
   │             │                 │ (Org instr)     │               │
   │             │                 │                 │               │
   │             │                 │ Load Layer 3    │               │
   │             │                 │─────────────────────────────────►
   │             │                 │◄─────────────────────────────────
   │             │                 │ (User memory)   │               │
   │             │                 │                 │               │
   │             │                 │ Get Layer 4     │               │
   │             │                 │ (Workspace ctx) │               │
   │             │                 │                 │               │
   │             │                 │ Get Layer 5     │               │
   │             │                 │ (Conv history)  │               │
   │             │                 │                 │               │
   │             │                 │ Build Prompt    │               │
   │             │                 │────────────────►│               │
   │             │                 │                 │ Generate      │
   │             │                 │◄────────────────│               │
   │             │                 │                 │               │
   │             │                 │ Update Memory   │               │
   │             │                 │─────────────────────────────────►
   │             │◄────────────────│                 │               │
   │◄────────────│ Stream response │                 │               │
```

---

## 7. AI Actions System

### 7.1 Action Types

```typescript
type AIActionType =
  // Navigation
  | 'navigate' // Go to specific view

  // Creation
  | 'create_task' // Create a new task
  | 'create_initiative' // Create a new initiative
  | 'create_decision' // Create a decision request

  // Updates
  | 'update_task' // Update task status/details
  | 'update_assessment' // Fill assessment score

  // Communication
  | 'send_notification' // Notify team member
  | 'schedule_meeting' // Propose meeting

  // Generation
  | 'generate_report' // Generate AI report
  | 'generate_summary' // Generate summary
  | 'generate_artifact'; // Generate code/document
```

### 7.2 Action Card UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  💬 AI Response:                                                     │
│  "Based on your assessment gap in Processes (3→5), I recommend      │
│   creating an initiative for Process Automation."                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ 💡 Suggested Action                                            │ │
│  │                                                                │ │
│  │ Create Initiative: "Process Automation Phase 1"                │ │
│  │ Axis: Processes • Priority: High • Effort: 6 months           │ │
│  │                                                                │ │
│  │     [✅ Create Initiative]    [❌ Dismiss]                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 Action Approval Flow

```
User asks → AI proposes action → User clicks Approve
                                        │
                                        ▼
                              Action executed in system
                                        │
                                        ▼
                              Confirmation shown
                              [📋 View Initiative] [➕ Add Tasks]
                                        │
                                        ▼
                              Audit logged
```

---

## 8. Voice System

### 8.1 Voice Modes

| Mode           | Trigger   | Behavior                                  | Use Case                |
| -------------- | --------- | ----------------------------------------- | ----------------------- |
| **Dictation**  | Click mic | Speech → Text in input field, manual send | Typing alternative      |
| **Voice Chat** | Hold mic  | Speech → Text → AI → Speech response      | Hands-free conversation |

### 8.2 Voice UI States

```
Default:          Recording:         Processing:
[🎤]              [🔴 Recording]     [⏳ Processing]

Voice Chat:       Speaking:
[🎵 Active]       [🔊 AI Speaking]
```

---

## 9. Success Metrics

### 9.1 User Experience KPIs

| Metric                     | Target  | Measurement        |
| -------------------------- | ------- | ------------------ |
| Time to first response     | < 3s    | Frontend analytics |
| User satisfaction rating   | > 4.2/5 | Feedback system    |
| Context accuracy           | > 90%   | User corrections   |
| Action execution success   | > 95%   | Backend logs       |
| Voice recognition accuracy | > 95%   | User corrections   |

### 9.2 Business KPIs

| Metric                              | Target | Measurement     |
| ----------------------------------- | ------ | --------------- |
| AI interactions/user/day            | > 5    | Analytics       |
| Tasks created via AI                | > 20%  | Backend logs    |
| Assessment completion rate          | > 80%  | Backend logs    |
| User retention (AI users vs non-AI) | +30%   | Cohort analysis |

---

## 10. Related Documents

- **Implementation Plan:** `docs/AI_CHAT_IMPLEMENTATION_PLAN.md`
- **Data Model:** `docs/AI_CHAT_DATA_MODEL.md`
- **API Specification:** `docs/api/AI_CHAT_API.md`
- **Flow Documentation:** `docs/flows/core/AI_CHAT_ASSISTANCE_FLOW.md`
- **Learning System:** `docs/flows/core/AI_LEARNING_SYSTEM_FLOW.md`

---

_Document Version: 2.0_  
_Last Updated: 2026-01-11_  
_Status: APPROVED for Implementation_
