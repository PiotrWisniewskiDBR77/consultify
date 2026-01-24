# AI Chat Integration Map

> **Document:** AI_CHAT_INTEGRATION_MAP.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED  
> **Related Flow:** FLOW-AI-001

---

## 1. Overview

This document maps all integration points between the AI Chat system and other modules in Consultinity.

---

## 2. Module Integration Matrix

### 2.1 AI Chat → Other Modules (Outbound)

| Target Module     | Integration Type      | Data Flow                    | Status |
| ----------------- | --------------------- | ---------------------------- | ------ |
| **PMO Projects**  | Context Read          | AI reads project data        | ✅     |
| **Initiatives**   | Context Read + Action | AI reads/creates initiatives | ⚠️     |
| **Tasks**         | Context Read + Action | AI reads/creates tasks       | ⚠️     |
| **Decisions**     | Context Read + Action | AI reads/creates decisions   | 🔴     |
| **Assessments**   | Context Read          | AI assists with assessment   | ✅     |
| **Reports**       | Action                | AI generates reports         | ⚠️     |
| **Notifications** | Action                | AI sends notifications       | 🔴     |
| **Team**          | Context Read          | AI knows team members        | ✅     |
| **Billing**       | Constraint            | AI respects budget limits    | ✅     |

### 2.2 Other Modules → AI Chat (Inbound)

| Source Module  | Integration Type  | Trigger                | Status |
| -------------- | ----------------- | ---------------------- | ------ |
| **My Work**    | Context Injection | User views task        | ✅     |
| **Assessment** | Context Injection | User doing assessment  | ✅     |
| **Initiative** | Context Injection | User views initiative  | ⚠️     |
| **Decision**   | Context Injection | User making decision   | 🔴     |
| **Dashboard**  | Navigation        | User opens chat        | ✅     |
| **Reports**    | Context Injection | User generating report | ⚠️     |
| **Settings**   | Configuration     | Admin configures AI    | ✅     |

---

## 3. Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI CHAT INTEGRATION MAP                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                           ┌───────────────┐                                  │
│                           │   AI CHAT     │                                  │
│                           │    SYSTEM     │                                  │
│                           └───────┬───────┘                                  │
│                                   │                                          │
│     ┌─────────────────────────────┼─────────────────────────────┐           │
│     │                             │                             │           │
│     ▼                             ▼                             ▼           │
│  ┌─────────┐               ┌─────────────┐               ┌──────────┐      │
│  │CONTEXT  │               │  ACTIONS    │               │ LEARNING │      │
│  │PROVIDERS│               │  TARGETS    │               │ SOURCES  │      │
│  └────┬────┘               └──────┬──────┘               └────┬─────┘      │
│       │                           │                           │            │
│  ┌────┴────────────────┐    ┌────┴────────────────┐    ┌────┴──────┐     │
│  │                     │    │                     │    │           │     │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ Feedback  │     │
│  │ │   PMO Projects  │ │    │ │   Tasks         │ │    │ System    │     │
│  │ └─────────────────┘ │    │ └─────────────────┘ │    │           │     │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ Decision  │     │
│  │ │   Initiatives   │ │    │ │   Initiatives   │ │    │ Patterns  │     │
│  │ └─────────────────┘ │    │ └─────────────────┘ │    │           │     │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ Usage     │     │
│  │ │   Tasks         │ │    │ │   Decisions     │ │    │ Analytics │     │
│  │ └─────────────────┘ │    │ └─────────────────┘ │    │           │     │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │    └───────────┘     │
│  │ │   Assessments   │ │    │ │   Reports       │ │                      │
│  │ └─────────────────┘ │    │ └─────────────────┘ │                      │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │                      │
│  │ │   Decisions     │ │    │ │   Notifications │ │                      │
│  │ └─────────────────┘ │    │ └─────────────────┘ │                      │
│  │ ┌─────────────────┐ │    │                     │                      │
│  │ │   Team/Users    │ │    └─────────────────────┘                      │
│  │ └─────────────────┘ │                                                  │
│  │ ┌─────────────────┐ │                                                  │
│  │ │   Reports       │ │                                                  │
│  │ └─────────────────┘ │                                                  │
│  │                     │                                                  │
│  └─────────────────────┘                                                  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                        INFRASTRUCTURE                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │  │
│  │  │   Memory    │  │Instructions │  │   Billing   │  │   Audit    │  │  │
│  │  │   System    │  │     DB      │  │   Limits    │  │    Log     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Context Providers Detail

### 4.1 PMO Projects

```typescript
// AI receives project context when user is working on a project
interface ProjectContext {
  id: string;
  name: string;
  phase: 'assessment' | 'planning' | 'execution' | 'monitoring';
  progress: number;
  initiativeCount: number;
  taskCount: number;
  openDecisions: number;
  assessmentScores?: Record<string, number>;
}

// Source: usePMOStore.currentProject
// Injection point: AIContext.pmoContext.project
```

**Integration Points:**
| Location | Type | Description |
|----------|------|-------------|
| `src/contexts/AIContext.tsx` | Provider | Injects project context |
| `src/store/usePMOStore.ts` | Source | Provides project data |
| `server/src/services/aiContextBuilder.ts` | Consumer | Builds prompt context |

---

### 4.2 Initiatives

```typescript
interface InitiativeContext {
  id: string;
  name: string;
  axis: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'draft' | 'planned' | 'in_progress' | 'completed';
  progress: number;
  taskCount: number;
  budget?: {
    estimated: number;
    actual: number;
  };
}

// Source: Selected initiative in workspace view
// Injection point: AIContext.workspaceContext (type: 'initiative')
```

---

### 4.3 Tasks

```typescript
interface TaskContext {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee?: {
    id: string;
    name: string;
  };
  dueDate?: Date;
  initiative?: {
    id: string;
    name: string;
  };
  description?: string;
}

// Source: Selected task in workspace view
// Injection point: AIContext.workspaceContext (type: 'task')
```

---

### 4.4 Assessments

```typescript
interface AssessmentContext {
  id: string;
  frameworkId: string;
  frameworkName: string;
  currentDimension?: {
    id: string;
    name: string;
    currentScore: number;
    targetScore: number;
  };
  overallProgress: number;
  scores: Record<
    string,
    {
      current: number;
      target: number;
    }
  >;
}

// Source: Active assessment session
// Injection point: AIContext.assessmentContext
```

---

### 4.5 Decisions

```typescript
interface DecisionContext {
  id: string;
  title: string;
  type: 'approval' | 'choice' | 'escalation';
  status: 'pending' | 'approved' | 'rejected';
  deadline?: Date;
  stakeholders: string[];
  options?: {
    id: string;
    name: string;
    pros: string[];
    cons: string[];
  }[];
  linkedItems?: {
    type: 'initiative' | 'task' | 'budget';
    id: string;
    name: string;
  }[];
}

// Source: Decision detail view
// Injection point: AIContext.workspaceContext (type: 'decision')
```

---

## 5. Action Targets Detail

### 5.1 Task Creation

```typescript
interface CreateTaskAction {
  type: 'create_task';
  payload: {
    title: string;
    description?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    assigneeId?: string;
    dueDate?: Date;
    initiativeId?: string;
    projectId: string;
  };
}

// Execution: TaskService.createTask()
// Approval: Required for all task creation
```

**Flow:**

```
AI suggests task → User approves → TaskService.createTask() →
→ Task created → Notification to assignee → Audit logged
```

---

### 5.2 Initiative Creation

```typescript
interface CreateInitiativeAction {
  type: 'create_initiative';
  payload: {
    name: string;
    description: string;
    axisId: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedEffort?: string;
    estimatedBudget?: number;
    projectId: string;
  };
}

// Execution: InitiativeService.createInitiative()
// Approval: Required, may need Admin approval for budget > threshold
```

---

### 5.3 Decision Creation

```typescript
interface CreateDecisionAction {
  type: 'create_decision';
  payload: {
    title: string;
    description: string;
    type: 'approval' | 'choice' | 'escalation';
    deadline?: Date;
    stakeholderIds: string[];
    linkedItemId?: string;
    linkedItemType?: string;
    projectId: string;
  };
}

// Execution: DecisionService.createDecision()
// Approval: Required
```

---

### 5.4 Report Generation

```typescript
interface GenerateReportAction {
  type: 'generate_report';
  payload: {
    type: 'status' | 'assessment' | 'initiative' | 'executive';
    projectId: string;
    dateRange?: {
      from: Date;
      to: Date;
    };
    sections?: string[];
    format: 'pdf' | 'html' | 'markdown';
  };
}

// Execution: ReportService.generateReport()
// Approval: Not required (user explicitly requested)
```

---

## 6. View-to-Context Mapping

### 6.1 Automatic Context Injection

| View (AppView) | Context Type       | Data Injected             |
| -------------- | ------------------ | ------------------------- |
| `Dashboard`    | empty              | Organization context only |
| `MyWork`       | task (if selected) | Task details              |
| `Initiatives`  | initiative         | Initiative details        |
| `Tasks`        | task               | Task details              |
| `Assessment`   | assessment         | Assessment progress       |
| `Decisions`    | decision           | Decision details          |
| `Projects`     | project            | Project overview          |
| `Reports`      | report             | Report context            |
| `AIChat`       | varies             | Last workspace context    |

### 6.2 Context Injection Code

```typescript
// src/contexts/AIContext.tsx

const getWorkspaceContext = (): WorkspaceContext => {
  const { currentView, selectedObject } = useAppStore();
  const { currentProjectId, currentProject } = usePMOStore();

  const viewToContextType: Record<AppView, WorkspaceType> = {
    [AppView.MyWork]: 'task',
    [AppView.Initiatives]: 'initiative',
    [AppView.Tasks]: 'task',
    [AppView.Assessment]: 'assessment',
    [AppView.Decisions]: 'decision',
    [AppView.Projects]: 'project',
    [AppView.Dashboard]: 'empty',
    [AppView.AIChat]: 'empty', // Uses previous context
    // ... other views
  };

  return {
    type: viewToContextType[currentView] || 'empty',
    entityId: selectedObject?.id,
    entityName: selectedObject?.name || selectedObject?.title,
    pmoProjectId: currentProjectId,
    pmoProjectName: currentProject?.name,
    data: selectedObject,
    capturedAt: new Date(),
  };
};
```

---

## 7. Data Flow Diagrams

### 7.1 Context Flow (User → AI)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │     │   Frontend   │     │   Backend    │
│   Actions    │     │   Stores     │     │  AI Pipeline │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ Opens Initiative   │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ Updates            │
       │                    │ selectedObject     │
       │                    │                    │
       │ Opens Chat (split) │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ AIContext.         │
       │                    │ workspaceContext   │
       │                    │────────────────────►
       │                    │                    │
       │ Sends message      │                    │
       │───────────────────►│                    │
       │                    │                    │
       │                    │ POST /chat/stream  │
       │                    │ + context payload  │
       │                    │────────────────────►
       │                    │                    │
       │                    │                    │ AI has full
       │                    │                    │ context:
       │                    │                    │ - Initiative
       │                    │                    │ - Project
       │                    │                    │ - User memory
```

### 7.2 Action Flow (AI → System)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   AI Chat    │     │   Action     │     │   Service    │     │   Database   │
│   Response   │     │   Executor   │     │   Layer      │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ Proposes action    │                    │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ Save pending       │                    │
       │                    │────────────────────────────────────────►│
       │                    │                    │                    │
       │◄───────────────────│ Show ActionCard    │                    │
       │                    │                    │                    │
       │ User approves      │                    │                    │
       │───────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │ Execute action     │                    │
       │                    │───────────────────►│                    │
       │                    │                    │                    │
       │                    │                    │ Create entity      │
       │                    │                    │───────────────────►│
       │                    │                    │                    │
       │                    │                    │◄───────────────────│
       │                    │                    │ entity_id          │
       │                    │◄───────────────────│                    │
       │                    │                    │                    │
       │                    │ Update action      │                    │
       │                    │ status = executed  │                    │
       │                    │────────────────────────────────────────►│
       │                    │                    │                    │
       │◄───────────────────│ Show confirmation  │                    │
```

---

## 8. Integration Dependencies

### 8.1 Required Services

| Service                | Used For                   | Critical             |
| ---------------------- | -------------------------- | -------------------- |
| `usePMOStore`          | Project/Initiative context | ✅ Yes               |
| `useConversationStore` | Chat state                 | ✅ Yes               |
| `useAppStore`          | Current view, navigation   | ✅ Yes               |
| `TaskService`          | Task actions               | ⚠️ For actions       |
| `InitiativeService`    | Initiative actions         | ⚠️ For actions       |
| `DecisionService`      | Decision actions           | ⚠️ For actions       |
| `ReportService`        | Report generation          | ⚠️ For reports       |
| `NotificationService`  | Send notifications         | ⚠️ For notifications |

### 8.2 API Dependencies

```
AI Chat System
├── /api/ai/chat/stream       ← Core (required)
├── /api/conversations/*      ← Core (required)
├── /api/projects/*           ← Context (required)
├── /api/initiatives/*        ← Context (required)
├── /api/tasks/*              ← Context + Actions
├── /api/decisions/*          ← Context + Actions
├── /api/assessments/*        ← Context
├── /api/reports/*            ← Actions
├── /api/notifications/*      ← Actions
└── /api/ai/memory/*          ← Memory (to implement)
```

---

## 9. Error Handling

### 9.1 Context Failures

| Error                    | Handling                  | User Impact                     |
| ------------------------ | ------------------------- | ------------------------------- |
| Project not found        | Use empty context         | AI lacks project context        |
| Entity not accessible    | Use project-level context | AI lacks entity details         |
| Memory load failed       | Proceed without memory    | AI doesn't remember preferences |
| Instructions load failed | Use default instructions  | AI uses generic responses       |

### 9.2 Action Failures

| Error               | Handling           | User Feedback                               |
| ------------------- | ------------------ | ------------------------------------------- |
| Service unavailable | Retry with backoff | "Unable to complete action, retrying..."    |
| Validation error    | Show errors        | "Cannot create: [validation errors]"        |
| Permission denied   | Block action       | "You don't have permission for this action" |
| Budget exceeded     | Block action       | "Action blocked: AI budget exceeded"        |

---

## 10. Testing Requirements

### 10.1 Integration Tests

| Test               | Description                    | Priority |
| ------------------ | ------------------------------ | -------- |
| Context injection  | Verify context flows correctly | P0       |
| Action execution   | Verify actions create entities | P0       |
| Memory persistence | Verify memory saves/loads      | P1       |
| Permission checks  | Verify action permissions      | P1       |
| Error handling     | Verify graceful failures       | P1       |

### 10.2 E2E Tests

| Scenario             | Steps                                      | Expected                    |
| -------------------- | ------------------------------------------ | --------------------------- |
| Task creation via AI | User asks AI to create task → Approves     | Task appears in task list   |
| Split-screen context | Open initiative → Open chat → Ask about it | AI knows initiative details |
| Memory persistence   | Set preference → New session → Check       | AI remembers preference     |

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_
