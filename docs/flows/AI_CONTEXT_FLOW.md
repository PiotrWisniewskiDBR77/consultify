# AI Context Flow

> **Document:** AI_CONTEXT_FLOW.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Related:** FLOW-AI-001

---

## 1. Overview

This document describes how context flows through the AI Chat system - from user action to AI response.

---

## 2. Context Sources

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CONTEXT SOURCES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SOURCE 1: SYSTEM INSTRUCTIONS                                        │    │
│  │ Location: Database (ai_instructions_system)                          │    │
│  │ Manager: SuperAdmin                                                  │    │
│  │ Scope: Platform-wide                                                 │    │
│  │ Content:                                                             │    │
│  │   - Consultinity identity                                            │    │
│  │   - PMO methodology (ISO 21500, PMBOK 7, PRINCE2)                   │    │
│  │   - Response quality guidelines                                      │    │
│  │   - Action permissions                                               │    │
│  │ Update frequency: Rarely (platform updates)                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SOURCE 2: ORGANIZATION INSTRUCTIONS                                  │    │
│  │ Location: Database (ai_instructions_org)                             │    │
│  │ Manager: Admin                                                       │    │
│  │ Scope: Organization-specific                                         │    │
│  │ Content:                                                             │    │
│  │   - Company profile & industry                                       │    │
│  │   - Custom terminology                                               │    │
│  │   - Communication preferences                                        │    │
│  │   - Business rules                                                   │    │
│  │ Update frequency: Monthly/As needed                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SOURCE 3: USER MEMORY                                                │    │
│  │ Location: Database (ai_user_memory) - TO IMPLEMENT                   │    │
│  │ Manager: Auto-collected + User editable                              │    │
│  │ Scope: User-specific                                                 │    │
│  │ Content:                                                             │    │
│  │   - Language preference                                              │    │
│  │   - Detail level (concise/detailed)                                  │    │
│  │   - Communication style                                              │    │
│  │   - Expertise areas                                                  │    │
│  │   - Recent topics                                                    │    │
│  │ Update frequency: After each interaction                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SOURCE 4: WORKSPACE CONTEXT                                          │    │
│  │ Location: Frontend state (AIContext)                                 │    │
│  │ Manager: Auto-captured                                               │    │
│  │ Scope: Current session                                               │    │
│  │ Content:                                                             │    │
│  │   - Current view (Dashboard, MyWork, Assessment...)                  │    │
│  │   - Selected entity (Task, Initiative, Decision...)                  │    │
│  │   - Entity data (title, status, description...)                      │    │
│  │   - PMO Project context                                              │    │
│  │ Update frequency: Real-time (view changes)                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ SOURCE 5: CONVERSATION HISTORY                                       │    │
│  │ Location: Frontend state (useConversationStore)                      │    │
│  │ Manager: Auto-collected                                              │    │
│  │ Scope: Current conversation                                          │    │
│  │ Content:                                                             │    │
│  │   - Previous messages (user + AI)                                    │    │
│  │   - Chat Folder context                                              │    │
│  │   - Focus mode setting                                               │    │
│  │   - Attached files                                                   │    │
│  │ Update frequency: Each message                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Context Flow Sequence

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXT FLOW SEQUENCE                                   │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STEP 1: USER NAVIGATES TO VIEW                                                │
│  ─────────────────────────────────────────────────────────────────────────────│
│  User clicks on Initiative "Process Automation"                                 │
│                                                                                 │
│  ┌─────────────┐                                                               │
│  │   Browser   │ ──► useAppStore.setCurrentView(AppView.Initiatives)           │
│  │             │ ──► usePMOStore.selectInitiative('init_123')                  │
│  └─────────────┘                                                               │
│                                                                                 │
│  STEP 2: CONTEXT UPDATES IN STORES                                             │
│  ─────────────────────────────────────────────────────────────────────────────│
│  Stores update with new context                                                 │
│                                                                                 │
│  ┌─────────────┐     ┌──────────────┐     ┌────────────────┐                  │
│  │ useAppStore │ ──► │ usePMOStore  │ ──► │ AIContext      │                  │
│  │ currentView │     │ initiative   │     │ workspaceContext│                  │
│  └─────────────┘     └──────────────┘     └────────────────┘                  │
│                                                                                 │
│  STEP 3: USER OPENS CHAT (SPLIT MODE)                                          │
│  ─────────────────────────────────────────────────────────────────────────────│
│  User clicks chat icon, enters split-screen mode                                │
│                                                                                 │
│  ┌─────────────┐                                                               │
│  │   Browser   │ ──► useConversationStore.setDisplayMode('split')             │
│  │             │ ──► UnifiedChatPanel renders with context                     │
│  └─────────────┘                                                               │
│                                                                                 │
│  STEP 4: CONTEXT BADGE SHOWS WHAT AI SEES                                      │
│  ─────────────────────────────────────────────────────────────────────────────│
│  ┌────────────────────────────────────────────────────────────────┐           │
│  │ 📋 Initiative: Process Automation                               │           │
│  │    Projekt: Marketing DX • Status: In Progress • Postęp: 45%   │           │
│  └────────────────────────────────────────────────────────────────┘           │
│                                                                                 │
│  STEP 5: USER SENDS MESSAGE                                                    │
│  ─────────────────────────────────────────────────────────────────────────────│
│  User: "What are the next steps for this initiative?"                          │
│                                                                                 │
│  ┌─────────────┐     ┌──────────────────────────────────────────────────────┐ │
│  │ ChatInput   │ ──► │ POST /api/ai/chat/stream                             │ │
│  │             │     │ Body: {                                               │ │
│  │             │     │   message: "What are the next steps...",              │ │
│  │             │     │   conversationId: "conv_456",                         │ │
│  │             │     │   history: [...],                                     │ │
│  │             │     │   context: {                                          │ │
│  │             │     │     focusMode: "project",                             │ │
│  │             │     │     workspaceContext: {                               │ │
│  │             │     │       type: "initiative",                             │ │
│  │             │     │       entityId: "init_123",                           │ │
│  │             │     │       entityName: "Process Automation",               │ │
│  │             │     │       pmoProjectId: "proj_789",                       │ │
│  │             │     │       data: { status, progress, tasks... }            │ │
│  │             │     │     }                                                 │ │
│  │             │     │   }                                                   │ │
│  │             │     │ }                                                     │ │
│  └─────────────┘     └──────────────────────────────────────────────────────┘ │
│                                                                                 │
│  STEP 6: BACKEND BUILDS FULL CONTEXT                                           │
│  ─────────────────────────────────────────────────────────────────────────────│
│  AI Pipeline assembles all 5 layers                                             │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ aiContextBuilder.buildContext(userId, orgId, workspaceContext)          │  │
│  │                                                                          │  │
│  │ 1. Load system instructions from DB                                      │  │
│  │ 2. Load org instructions from DB                                         │  │
│  │ 3. Load user memory from DB (when implemented)                           │  │
│  │ 4. Parse workspace context from request                                  │  │
│  │ 5. Include conversation history from request                             │  │
│  │                                                                          │  │
│  │ Result: Full prompt with all context layers                              │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  STEP 7: AI RESPONSE WITH CONTEXT AWARENESS                                    │
│  ─────────────────────────────────────────────────────────────────────────────│
│  AI: "Based on Process Automation initiative progress (45%), here are          │
│       the recommended next steps for Marketing DX project:                      │
│       1. Complete remaining 3 tasks in current phase...                         │
│       2. Schedule review with stakeholders..."                                  │
│                                                                                 │
│  AI KNOWS:                                                                      │
│  ✓ User is working on "Process Automation" initiative                          │
│  ✓ Initiative is part of "Marketing DX" project                                │
│  ✓ Current progress is 45%                                                     │
│  ✓ There are pending tasks                                                     │
│  ✓ User's communication style (from memory)                                    │
│  ✓ Organization's terminology                                                  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Context by View

### 4.1 Mapping Table

| AppView       | WorkspaceType | Entity Data        | PMO Project        | Assessment |
| ------------- | ------------- | ------------------ | ------------------ | ---------- |
| `Dashboard`   | empty         | -                  | If selected        | -          |
| `MyWork`      | task          | Task details       | Task's project     | -          |
| `Initiatives` | initiative    | Initiative details | ✓                  | -          |
| `Tasks`       | task          | Task details       | Task's project     | -          |
| `Assessment`  | assessment    | -                  | ✓                  | ✓ Full     |
| `Decisions`   | decision      | Decision details   | Decision's project | -          |
| `Projects`    | project       | Project overview   | ✓                  | -          |
| `Reports`     | report        | Report type        | ✓                  | -          |
| `AIChat`      | _previous_    | _previous_         | _previous_         | _previous_ |

### 4.2 Context Capture Code

```typescript
// src/contexts/AIContext.tsx

export const AIContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentView, selectedObject } = useAppStore();
  const { currentProjectId, currentProject, selectedInitiative } = usePMOStore();
  const { assessmentState } = useAssessmentStore();

  const workspaceContext = useMemo<WorkspaceContext>(() => {
    // Map view to context type
    const viewTypeMap: Record<AppView, WorkspaceType> = {
      [AppView.Dashboard]: 'empty',
      [AppView.MyWork]: selectedObject ? 'task' : 'empty',
      [AppView.Initiatives]: selectedInitiative ? 'initiative' : 'project',
      [AppView.Tasks]: selectedObject ? 'task' : 'project',
      [AppView.Assessment]: 'assessment',
      [AppView.Decisions]: selectedObject ? 'decision' : 'project',
      [AppView.Projects]: 'project',
      [AppView.Reports]: 'report',
      [AppView.AIChat]: previousContext?.type || 'empty',
    };

    const type = viewTypeMap[currentView] || 'empty';

    return {
      type,
      entityId: getEntityId(type, selectedObject, selectedInitiative),
      entityName: getEntityName(type, selectedObject, selectedInitiative),
      pmoProjectId: currentProjectId,
      pmoProjectName: currentProject?.name,
      data: getEntityData(type, selectedObject, selectedInitiative, assessmentState),
      capturedAt: new Date(),
    };
  }, [currentView, selectedObject, selectedInitiative, currentProject, assessmentState]);

  // ... rest of provider
};
```

---

## 5. Prompt Construction

### 5.1 Layer Assembly

```typescript
// server/src/services/aiContextBuilder.ts

export async function buildPromptContext(
  userId: string,
  organizationId: string,
  workspaceContext: WorkspaceContext,
  conversationHistory: Message[],
  focusMode: FocusMode
): Promise<PromptContext> {
  // LAYER 1: System Instructions
  const systemInstructions = await loadSystemInstructions(focusMode);

  // LAYER 2: Organization Instructions
  const orgInstructions = await loadOrgInstructions(organizationId);

  // LAYER 3: User Memory
  const userMemory = await loadUserMemory(userId);

  // LAYER 4: Workspace Context (from request)
  const workspacePrompt = formatWorkspaceContext(workspaceContext);

  // LAYER 5: Conversation History (from request)
  const historyPrompt = formatConversationHistory(conversationHistory);

  // Assemble final prompt
  return {
    systemPrompt: [
      systemInstructions,
      orgInstructions,
      userMemory ? formatUserMemory(userMemory) : '',
    ]
      .filter(Boolean)
      .join('\n\n'),

    contextPrompt: [workspacePrompt, historyPrompt].filter(Boolean).join('\n\n'),

    metadata: {
      hasWorkspaceContext: workspaceContext.type !== 'empty',
      hasUserMemory: !!userMemory,
      focusMode,
      tokenEstimate: estimateTokens(/* ... */),
    },
  };
}
```

### 5.2 Prompt Template

```markdown
# System Context (Layer 1 + 2)

You are Consultinity AI, a digital transformation consultant...
[System instructions]

## Organization Context

Company: {org.name}
Industry: {org.industry}
[Org instructions and terminology]

## User Preferences (Layer 3)

Preferred language: {user.language}
Detail level: {user.detailLevel}
Expertise: {user.expertise.join(', ')}

# Current Context (Layer 4)

User is currently viewing: {workspace.type}
{workspace.type === 'initiative' ? `Initiative: ${workspace.entityName}
Project: ${workspace.pmoProjectName}
Status: ${workspace.data.status}
Progress: ${workspace.data.progress}%
Pending tasks: ${workspace.data.pendingTaskCount}` : ''}

# Conversation History (Layer 5)

{history.map(m => `${m.role}: ${m.content}`).join('\n')}

# User's Message

{currentMessage}
```

---

## 6. Context Persistence

### 6.1 What Gets Persisted

| Data                    | Storage        | Duration        |
| ----------------------- | -------------- | --------------- |
| Conversation history    | Database       | Permanent       |
| User memory/preferences | Database       | Permanent       |
| Workspace context       | Not stored     | Session only    |
| Focus mode              | localStorage   | Browser session |
| Selected entity         | Frontend state | View session    |

### 6.2 Memory Update Flow

```
User interaction → AI responds → Extract learnings → Update memory

Example:
1. User asks "Give me a detailed analysis" (after asking for brief)
2. AI provides detailed response
3. System detects preference change
4. Updates ai_user_memory.preferences.detailLevel = 'detailed'
5. Next interaction uses updated preference
```

---

## 7. Error Handling

### 7.1 Context Errors

| Error                         | Fallback                  | Impact                 |
| ----------------------------- | ------------------------- | ---------------------- |
| System instructions not found | Use hardcoded defaults    | AI less guided         |
| Org instructions not found    | Skip layer                | AI less customized     |
| User memory not found         | Create empty memory       | AI doesn't personalize |
| Workspace context invalid     | Use 'empty' type          | AI lacks task context  |
| Entity not accessible         | Use project-level context | AI lacks details       |

### 7.2 Graceful Degradation

```typescript
async function safeLoadContext(
  userId: string,
  orgId: string,
  workspace: WorkspaceContext
): Promise<PromptContext> {
  const results = await Promise.allSettled([
    loadSystemInstructions(),
    loadOrgInstructions(orgId),
    loadUserMemory(userId),
  ]);

  const [system, org, user] = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`Context layer ${i + 1} failed:`, r.reason);
    return null;
  });

  // Continue with whatever we could load
  return buildPrompt(system, org, user, workspace);
}
```

---

## 8. Performance Considerations

### 8.1 Token Budget

| Layer                | Typical Tokens | Max Tokens |
| -------------------- | -------------- | ---------- |
| System instructions  | 500            | 1000       |
| Org instructions     | 300            | 800        |
| User memory          | 100            | 300        |
| Workspace context    | 200            | 500        |
| Conversation history | 1000           | 4000       |
| **Total context**    | **2100**       | **6600**   |

### 8.2 Optimization Strategies

1. **Lazy loading**: Only load org instructions if different from cached
2. **History truncation**: Keep last N messages, summarize older ones
3. **Context compression**: Summarize large entity data
4. **Caching**: Cache system instructions (rarely change)

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_
