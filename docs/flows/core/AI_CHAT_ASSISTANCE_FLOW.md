# FLOW-AI-001: AI Chat & Assistance

> **ID:** FLOW-AI-001 | **Status:** 🔄 In Progress | **Priority:** P0  
> **Last Updated:** 2026-01-11 | **Implementation Plan:** `docs/AI_CHAT_IMPLEMENTATION_PLAN.md`

---

## Overview

| Metric                    | Value                                |
| ------------------------- | ------------------------------------ |
| **Completeness**          | 65%                                  |
| **Gaps Identified**       | 6                                    |
| **Gaps Fixed**            | 0                                    |
| **Implementation Status** | Core exists, enhancement in progress |

---

## Purpose

AI jako konsultant, manager i ekspert w Consultinity. Fundamentalna funkcja różnicująca produkt.

---

## Related Documentation

| Document                                     | Description               |
| -------------------------------------------- | ------------------------- |
| `docs/AI_CHAT_SYSTEM_DESIGN.md`              | Full design specification |
| `docs/AI_CHAT_DATA_MODEL.md`                 | Data model & schemas      |
| `docs/api/AI_CHAT_API.md`                    | API specification         |
| `docs/AI_CHAT_IMPLEMENTATION_PLAN.md`        | Implementation tasks      |
| `docs/flows/core/AI_LEARNING_SYSTEM_FLOW.md` | Learning system flow      |

---

## AI Philosophy (User's Vision)

### AI Maturity Journey

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

### AI Roles

| Role           | Current Support              | Full Autonomy                       |
| -------------- | ---------------------------- | ----------------------------------- |
| **Consultant** | Wiedza ekspercka, raporty    | Pełne konsultacje strategiczne      |
| **Manager**    | Sugestie decyzji             | Podejmowanie decyzji w ramach reguł |
| **User**       | Asystowanie przy dokumentach | Tworzenie i realizacja działań      |

---

## Display Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CHAT DISPLAY MODES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MODE 1: FULL-SCREEN (AppView.AIChat)                    ✅ Implemented      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ┌─────────┐ ┌───────────────────────────────────────────────────────┐ │  │
│  │ │ History │ │                   Chat Area                           │ │  │
│  │ │ Sidebar │ │                   (centered)                          │ │  │
│  │ └─────────┘ └───────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  MODE 2: SPLIT-SCREEN                                    ✅ Implemented      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ┌─────────────────────────────────┐ ┌───────────────────────────────┐ │  │
│  │ │        Workspace Content        │ │      Chat Panel (40%)         │ │  │
│  │ └─────────────────────────────────┘ └───────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  MODE 3: COLLAPSED                                       ⚠️ Partial          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Any View                         [💬 Widget]       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Chat Types

| Type                | Context               | Purpose                     | Status |
| ------------------- | --------------------- | --------------------------- | ------ |
| **Global Chat**     | Organization context  | General questions, help     | ✅     |
| **Project Chat**    | Project + initiatives | Project-specific assistance | ✅     |
| **Assessment Chat** | Assessment questions  | Help during assessment      | ✅     |
| **Tool Chat**       | Specific tool context | Tool-specific guidance      | ⚠️     |
| **Decision Chat**   | Decision context      | Help making decisions       | ⚠️     |

---

## Sequence Diagram: AI Chat Flow

```
┌──────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────┐
│ User │    │ Chat API │    │ AI Pipeline  │    │ LLM      │    │ Memory  │
└──┬───┘    └────┬─────┘    └──────┬───────┘    └────┬─────┘    └────┬────┘
   │             │                 │                 │               │
   │ Send msg    │                 │                 │               │
   │────────────►│                 │                 │               │
   │             │ POST /stream    │                 │               │
   │             │────────────────►│                 │               │
   │             │                 │                 │               │
   │             │                 │ Load Layer 1: System Instructions    │
   │             │                 │───────────────────────────────────►│
   │             │                 │◄───────────────────────────────────│
   │             │                 │                 │               │
   │             │                 │ Load Layer 2: Org Instructions       │
   │             │                 │───────────────────────────────────►│
   │             │                 │◄───────────────────────────────────│
   │             │                 │                 │               │
   │             │                 │ Load Layer 3: User Memory           │
   │             │                 │───────────────────────────────────►│
   │             │                 │◄───────────────────────────────────│
   │             │                 │                 │               │
   │             │                 │ Get Layer 4: Workspace Context      │
   │             │                 │ (from request payload)              │
   │             │                 │                 │               │
   │             │                 │ Get Layer 5: Conversation History   │
   │             │                 │ (from request payload)              │
   │             │                 │                 │               │
   │             │                 │ Build Prompt    │               │
   │             │                 │────────────────►│               │
   │             │                 │                 │ Generate      │
   │             │                 │◄────────────────│ (stream)      │
   │             │                 │                 │               │
   │             │ SSE: thought    │                 │               │
   │◄────────────│◄────────────────│                 │               │
   │             │ SSE: text       │                 │               │
   │◄────────────│◄────────────────│                 │               │
   │             │ SSE: action     │                 │               │
   │◄────────────│◄────────────────│                 │               │
   │             │ SSE: [DONE]     │                 │               │
   │◄────────────│◄────────────────│                 │               │
   │             │                 │                 │               │
   │             │                 │ Update Memory   │               │
   │             │                 │───────────────────────────────────►│
```

---

## Context Layers (5 Layers)

```
┌────────────────────────────────────────────────────────────────────┐
│                        PROMPT CONSTRUCTION                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LAYER 1: SYSTEM INSTRUCTIONS (SuperAdmin managed)      ✅ Exists  │
│  ├── Consultinity identity & philosophy                            │
│  ├── PMO standards (ISO 21500, PMBOK 7, PRINCE2)                   │
│  ├── Assessment guidance                                           │
│  ├── Reporting standards                                           │
│  └── Decision support rules                                        │
│  Source: ai_instructions_system table                              │
│                                                                    │
│  LAYER 2: ORGANIZATION INSTRUCTIONS (Admin managed)     ✅ Exists  │
│  ├── Company-specific guidelines                                   │
│  ├── Industry context                                              │
│  ├── Preferred terminology                                         │
│  └── Custom workflows                                              │
│  Source: ai_instructions_org table                                 │
│                                                                    │
│  LAYER 3: USER MEMORY (auto-collected)                  🔴 Missing │
│  ├── User preferences                                              │
│  ├── Recent interactions                                           │
│  ├── Assigned projects/initiatives                                 │
│  └── Expertise areas                                               │
│  Source: ai_user_memory table (to create)                          │
│                                                                    │
│  LAYER 4: WORKSPACE CONTEXT (real-time)                 ⚠️ Partial │
│  ├── Current view (My Work, Assessment, Initiative)                │
│  ├── Selected entity (Task ID, Initiative ID)                      │
│  ├── Entity data (title, status, description)                      │
│  └── Current PMO Project context                                   │
│  Source: AIContext.workspaceContext                                │
│                                                                    │
│  LAYER 5: CONVERSATION (session-based)                  ✅ Exists  │
│  ├── Current chat history                                          │
│  ├── Chat Folder context (if assigned)                             │
│  ├── Focus mode selected                                           │
│  └── Attached files/documents                                      │
│  Source: useConversationStore                                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## AI Actions Configuration

Admin konfiguruje co AI może robić:

```typescript
interface AIActionsConfig {
  // Per project or organization
  allowedActions: {
    suggestInitiatives: boolean;
    createDraftInitiatives: boolean;
    createTasks: boolean;
    assignTasks: boolean;
    updateTaskStatus: boolean;
    createDecisionRequests: boolean;
    makeRecommendations: boolean;
    sendNotifications: boolean;
    modifyBudgets: boolean; // High risk - usually false
    approveItems: boolean; // High risk - usually false
  };

  approvalRequired: {
    // Which actions need human approval
    createInitiatives: boolean;
    createTasks: boolean;
    assignTasks: boolean;
  };

  autonomyLevel: 'advisory' | 'assisted' | 'autonomous';
}
```

---

## Gap Analysis

### GAP-AI-001: UI Labels & Context Display 🔴 NEW

| Attribute    | Value                     |
| ------------ | ------------------------- |
| **Priority** | P0 - CRITICAL             |
| **Effort**   | 4h                        |
| **Impact**   | UX issues, user confusion |

**Problems:**

- "Nowa sesja strategiczna" → should be "Nowy czat"
- "Context-aware • empty" shown when no context
- "Zapytaj o empty..." placeholder
- "PROJECTS" confuses with PMO Projects

**Solution:**

- Task 2.1.1: Fix labels in ChatHistorySidebar
- Task 2.1.2: Fix empty context display
- Task 2.1.3: Smart placeholder
- Task 2.1.4: Rename Projects → Foldery
- Task 2.1.5: Add ContextBadge component

---

### GAP-AI-002: AI Memory System 🔴

| Attribute    | Value                                |
| ------------ | ------------------------------------ |
| **Priority** | P1 - HIGH                            |
| **Effort**   | 12h                                  |
| **Impact**   | AI nie pamięta kontekstu użytkownika |

**Solution:**

- Task 2.2.1: Memory Manager service
- Task 2.2.2: Memory tables migration
- Integration with AI Pipeline

---

### GAP-AI-003: AI Actions with Approval 🔴

| Attribute    | Value                         |
| ------------ | ----------------------------- |
| **Priority** | P2 - MEDIUM                   |
| **Effort**   | 16h                           |
| **Impact**   | AI nie może wykonywać działań |

**Solution:**

- Task 2.3.1: Actions approval workflow
- Task 2.3.2: ActionCard component
- Audit logging

---

### GAP-AI-004: Workspace Context Enhancement ⚠️

| Attribute    | Value                              |
| ------------ | ---------------------------------- |
| **Priority** | P1 - HIGH                          |
| **Effort**   | 4h                                 |
| **Impact**   | AI nie zawsze widzi pełny kontekst |

**Solution:**

- Task 2.2.3: Enhance WorkspaceContext
- Pass more entity data to AI

---

### GAP-AI-005: Focus Mode UI ⚠️

| Attribute    | Value                 |
| ------------ | --------------------- |
| **Priority** | P1 - HIGH             |
| **Effort**   | 3h                    |
| **Impact**   | Niejasne ikony trybów |

**Solution:**

- Task 2.2.4: Replace icons with dropdown
- Clear labels for each mode

---

### GAP-AI-006: Tools Menu Incomplete 🔴

| Attribute    | Value                         |
| ------------ | ----------------------------- |
| **Priority** | P1 - HIGH                     |
| **Effort**   | 4h                            |
| **Impact**   | Some features not implemented |

**Solution:**

- Task 2.2.5: Tools Menu redesign
- Knowledge source toggles
- Quick actions

---

## Implementation Status

### Implemented ✅

| Component          | Location                                       | Notes                  |
| ------------------ | ---------------------------------------------- | ---------------------- |
| UnifiedChatPanel   | `src/components/AIChat/UnifiedChatPanel.tsx`   | Main UI                |
| EnhancedChatInput  | `src/components/AIChat/EnhancedChatInput.tsx`  | Input with voice/files |
| ChatHistorySidebar | `src/components/AIChat/ChatHistorySidebar.tsx` | History panel          |
| ConversationStore  | `src/store/useConversationStore.ts`            | State management       |
| ChatProjectStore   | `src/store/useChatProjectStore.ts`             | Folder management      |
| AIContext          | `src/contexts/AIContext.tsx`                   | Context provider       |
| useAIStream        | `src/hooks/useAIStream.ts`                     | SSE streaming          |
| AI Routes          | `server/src/routes/ai.routes.ts`               | Backend API            |
| AI Pipeline        | `server/src/services/aiPipeline.ts`            | Orchestration          |

### To Implement 🔴

| Component        | Location                                  | Sprint |
| ---------------- | ----------------------------------------- | ------ |
| ContextBadge     | `src/components/AIChat/ContextBadge.tsx`  | 2.1    |
| ActionCard       | `src/components/AIChat/ActionCard.tsx`    | 2.3    |
| AIMemoryManager  | `server/src/services/aiMemoryManager.ts`  | 2.2    |
| AILearningEngine | `server/src/services/aiLearningEngine.ts` | 2.3    |
| Memory tables    | `server/migrations/251_*.sql`             | 2.2    |

---

## API Endpoints

### Existing ✅

| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| POST   | `/api/ai/chat/stream`             | Stream AI response (SSE) |
| POST   | `/api/conversations`              | Create conversation      |
| GET    | `/api/conversations`              | List conversations       |
| GET    | `/api/conversations/:id`          | Get conversation         |
| POST   | `/api/conversations/:id/messages` | Add message              |
| GET    | `/api/conversations/:id/messages` | Get messages             |

### To Add 🔴

| Method | Endpoint                      | Description         | Sprint |
| ------ | ----------------------------- | ------------------- | ------ |
| GET    | `/api/ai/memory/user`         | Get user memory     | 2.2    |
| PUT    | `/api/ai/memory/user`         | Update user memory  | 2.2    |
| GET    | `/api/ai/memory/org`          | Get org memory      | 2.2    |
| PUT    | `/api/ai/memory/org`          | Update org memory   | 2.2    |
| GET    | `/api/ai/actions/pending`     | Get pending actions | 2.3    |
| POST   | `/api/ai/actions/:id/approve` | Approve action      | 2.3    |
| POST   | `/api/ai/actions/:id/reject`  | Reject action       | 2.3    |
| GET    | `/api/chat-folders`           | List folders        | 2.1    |
| POST   | `/api/chat-folders`           | Create folder       | 2.1    |

---

## Database Schema

### Existing Tables ✅

```sql
-- conversations - Chat conversations
-- conversation_messages - Chat messages
-- ai_instructions_system - SuperAdmin instructions
-- ai_instructions_org - Admin instructions
-- ai_feedback - User feedback on AI responses
```

### To Create 🔴

```sql
-- chat_folders (rename from chat_projects)
-- ai_user_memory
-- ai_org_memory
-- ai_actions
```

See `docs/AI_CHAT_DATA_MODEL.md` for full schema.

---

## Related Flows

| Flow ID             | Name                  | Relationship                 |
| ------------------- | --------------------- | ---------------------------- |
| FLOW-ASSESSMENT-001 | Assessment Execution  | AI assists during assessment |
| FLOW-REPORT-001     | Report Generation     | AI generates report content  |
| FLOW-DECISION-001   | Decision System       | AI recommends decisions      |
| FLOW-AILEARNING-001 | AI Learning           | AI learns from feedback      |
| FLOW-TASK-001       | Task Management       | AI can create/update tasks   |
| FLOW-INITIATIVE-001 | Initiative Management | AI can suggest initiatives   |

---

## Changelog

| Date       | Change                              | Author |
| ---------- | ----------------------------------- | ------ |
| 2026-01-11 | Added 6 new gaps, updated structure | Agent  |
| 2026-01-11 | Added implementation status section | Agent  |
| 2026-01-11 | Linked to design documentation      | Agent  |
| 2026-01-10 | Initial document creation           | Agent  |

---

_Flow Status: 🔄 In Progress_  
_Next Review: After Sprint 2.1 completion_
