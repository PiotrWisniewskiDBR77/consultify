# AI Actions Flow

> **Document:** AI_ACTIONS_FLOW.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Related:** FLOW-AI-001

---

## 1. Overview

This document describes how AI can execute actions in the system - from proposing an action to execution and audit logging.

---

## 2. Action Types

### 2.1 Action Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI ACTION TYPES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  NAVIGATION ACTIONS (No approval needed)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ navigate     │ Go to specific view                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  CREATION ACTIONS (Approval required)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ create_task       │ Create new task in project                       │    │
│  │ create_initiative │ Create new initiative in project                 │    │
│  │ create_decision   │ Create decision request                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  UPDATE ACTIONS (May require approval)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ update_task       │ Update task status/details                       │    │
│  │ update_assessment │ Fill assessment score                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  COMMUNICATION ACTIONS (Approval required)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ send_notification │ Send notification to user                        │    │
│  │ schedule_meeting  │ Propose meeting time                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  GENERATION ACTIONS (No approval for content, approval for publish)          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ generate_report   │ Generate AI report                               │    │
│  │ generate_summary  │ Generate summary                                 │    │
│  │ generate_artifact │ Generate code/document                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Action Type Definitions

```typescript
type AIActionType =
  // Navigation
  | 'navigate'

  // Creation
  | 'create_task'
  | 'create_initiative'
  | 'create_decision'

  // Updates
  | 'update_task'
  | 'update_assessment'

  // Communication
  | 'send_notification'
  | 'schedule_meeting'

  // Generation
  | 'generate_report'
  | 'generate_summary'
  | 'generate_artifact';

interface AIAction {
  id: string;
  type: AIActionType;
  title: string;
  description: string;
  icon: string;
  payload: Record<string, any>;

  requiresApproval: boolean;
  autoApproveAfter?: number; // seconds, null = never

  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

  // Audit trail
  conversationId: string;
  messageId: string;
  createdAt: Date;
  executedAt?: Date;
  executionResult?: ActionResult;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

interface ActionResult {
  success: boolean;
  resultId?: string; // ID of created entity
  resultType?: string;
  message?: string;
  error?: string;
}
```

---

## 3. Action Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI ACTION FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 1: DETECTION                                                   │    │
│  │                                                                      │    │
│  │ User asks: "Create a task for implementing SSO"                      │    │
│  │                            │                                         │    │
│  │                            ▼                                         │    │
│  │ AI Response includes action in metadata:                             │    │
│  │ {                                                                    │    │
│  │   type: 'create_task',                                               │    │
│  │   payload: {                                                         │    │
│  │     title: 'Implement SSO Integration',                              │    │
│  │     priority: 'high',                                                │    │
│  │     projectId: 'proj_123'                                            │    │
│  │   }                                                                  │    │
│  │ }                                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 2: PROPOSAL                                                    │    │
│  │                                                                      │    │
│  │ Frontend renders ActionCard in message:                              │    │
│  │                                                                      │    │
│  │ ┌───────────────────────────────────────────────────────────────┐   │    │
│  │ │ 💡 Suggested Action                                           │   │    │
│  │ │                                                               │   │    │
│  │ │ Create Task: "Implement SSO Integration"                      │   │    │
│  │ │ Priority: High • Project: IT Infrastructure                   │   │    │
│  │ │                                                               │   │    │
│  │ │     [✅ Create Task]    [✏️ Edit]    [❌ Dismiss]            │   │    │
│  │ └───────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│              ┌─────────────┼─────────────┐                                  │
│              ▼             ▼             ▼                                  │
│         [Approve]      [Edit]       [Dismiss]                               │
│              │             │             │                                  │
│              │             │             │                                  │
│  ┌───────────┴─────────────┴─────────────┴───────────────────────────────┐ │
│  │ PHASE 3: USER DECISION                                                 │ │
│  │                                                                        │ │
│  │ APPROVE: POST /api/ai/actions/:id/approve                             │ │
│  │ EDIT: Open modal with editable fields → then approve                  │ │
│  │ DISMISS: POST /api/ai/actions/:id/reject { reason: 'Dismissed' }      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│                            ▼ (if approved)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 4: EXECUTION                                                   │    │
│  │                                                                      │    │
│  │ AIActionExecutor.execute(action)                                     │    │
│  │                            │                                         │    │
│  │                            ▼                                         │    │
│  │ switch(action.type) {                                                │    │
│  │   case 'create_task':                                                │    │
│  │     result = await TaskService.create(action.payload);               │    │
│  │     break;                                                           │    │
│  │   case 'create_initiative':                                          │    │
│  │     result = await InitiativeService.create(action.payload);         │    │
│  │     break;                                                           │    │
│  │   // ... other types                                                 │    │
│  │ }                                                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 5: CONFIRMATION                                                │    │
│  │                                                                      │    │
│  │ ActionCard updates to show result:                                   │    │
│  │                                                                      │    │
│  │ ┌───────────────────────────────────────────────────────────────┐   │    │
│  │ │ ✅ Task Created                                                │   │    │
│  │ │                                                               │   │    │
│  │ │ "Implement SSO Integration" has been created                  │   │    │
│  │ │                                                               │   │    │
│  │ │     [📋 View Task]    [➕ Add Subtasks]                       │   │    │
│  │ └───────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                            │                                                 │
│                            ▼                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 6: AUDIT                                                       │    │
│  │                                                                      │    │
│  │ AuditLog.record({                                                    │    │
│  │   action: 'AI_ACTION_EXECUTED',                                      │    │
│  │   actionId: action.id,                                               │    │
│  │   actionType: 'create_task',                                         │    │
│  │   resultId: 'task_789',                                              │    │
│  │   userId: 'user_123',                                                │    │
│  │   organizationId: 'org_456',                                         │    │
│  │   conversationId: 'conv_abc',                                        │    │
│  │   timestamp: new Date()                                              │    │
│  │ });                                                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Approval Matrix

### 4.1 Default Approval Requirements

| Action Type         | Requires Approval | Auto-Approve After | Can Override  |
| ------------------- | ----------------- | ------------------ | ------------- |
| `navigate`          | ❌ No             | -                  | -             |
| `create_task`       | ✅ Yes            | Never              | Admin can set |
| `create_initiative` | ✅ Yes            | Never              | Admin can set |
| `create_decision`   | ✅ Yes            | Never              | Admin can set |
| `update_task`       | ⚠️ Depends        | 30s for status     | Admin can set |
| `update_assessment` | ❌ No (advisory)  | -                  | -             |
| `send_notification` | ✅ Yes            | 60s                | Admin can set |
| `schedule_meeting`  | ✅ Yes            | Never              | -             |
| `generate_report`   | ❌ No (preview)   | -                  | -             |
| `generate_artifact` | ❌ No (preview)   | -                  | -             |

### 4.2 Organization Configuration

```typescript
// Admin can configure AI action permissions per organization
interface AIActionsConfig {
  organizationId: string;

  allowedActions: {
    suggestInitiatives: boolean; // Can AI suggest initiatives?
    createDraftInitiatives: boolean; // Can AI create draft initiatives?
    createTasks: boolean; // Can AI create tasks?
    assignTasks: boolean; // Can AI assign tasks to users?
    updateTaskStatus: boolean; // Can AI update task status?
    createDecisionRequests: boolean; // Can AI create decisions?
    makeRecommendations: boolean; // Can AI make recommendations?
    sendNotifications: boolean; // Can AI send notifications?
    modifyBudgets: boolean; // HIGH RISK - usually false
    approveItems: boolean; // HIGH RISK - usually false
  };

  approvalSettings: {
    // Who can approve AI actions?
    createInitiatives: 'user' | 'admin' | 'owner';
    createTasks: 'user' | 'admin' | 'owner';
    assignTasks: 'admin' | 'owner';
    sendNotifications: 'user' | 'admin';
  };

  // Autonomy level (affects defaults)
  autonomyLevel: 'advisory' | 'assisted' | 'autonomous';
}
```

---

## 5. Action Execution Service

### 5.1 Service Architecture

```typescript
// server/src/services/aiActionExecutor.ts

export class AIActionExecutor {
  constructor(
    private taskService: TaskService,
    private initiativeService: InitiativeService,
    private decisionService: DecisionService,
    private notificationService: NotificationService,
    private reportService: ReportService,
    private auditLogger: AuditLogger
  ) {}

  async execute(action: AIAction, userId: string): Promise<ActionResult> {
    // Validate action
    this.validateAction(action);

    // Check permissions
    await this.checkPermissions(action, userId);

    // Execute based on type
    const result = await this.executeByType(action);

    // Update action status
    await this.updateActionStatus(action.id, 'executed', result);

    // Audit log
    await this.auditLogger.logAIAction(action, result, userId);

    return result;
  }

  private async executeByType(action: AIAction): Promise<ActionResult> {
    switch (action.type) {
      case 'create_task':
        return this.executeCreateTask(action.payload);

      case 'create_initiative':
        return this.executeCreateInitiative(action.payload);

      case 'create_decision':
        return this.executeCreateDecision(action.payload);

      case 'update_task':
        return this.executeUpdateTask(action.payload);

      case 'send_notification':
        return this.executeSendNotification(action.payload);

      case 'generate_report':
        return this.executeGenerateReport(action.payload);

      case 'navigate':
        // Navigation is handled client-side
        return { success: true, message: 'Navigation triggered' };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeCreateTask(payload: CreateTaskPayload): Promise<ActionResult> {
    try {
      const task = await this.taskService.create({
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        assigneeId: payload.assigneeId,
        dueDate: payload.dueDate,
        initiativeId: payload.initiativeId,
        projectId: payload.projectId,
        createdBy: 'ai', // Mark as AI-created
      });

      return {
        success: true,
        resultId: task.id,
        resultType: 'task',
        message: `Task "${task.title}" created successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ... other execute methods
}
```

### 5.2 API Endpoints

```typescript
// server/src/routes/ai.actions.routes.ts

router.get('/actions/pending', verifyToken, async (req, res) => {
  const { userId, organizationId } = req.user;
  const { conversationId } = req.query;

  const actions = await aiActionsRepo.findPending({
    userId,
    organizationId,
    conversationId,
  });

  res.json({ success: true, data: { actions } });
});

router.post('/actions/:id/approve', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const { payloadModifications } = req.body;

  // Get action
  const action = await aiActionsRepo.findById(id);
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  // Verify user can approve
  await verifyApprovalPermission(action, userId);

  // Apply any modifications
  if (payloadModifications) {
    action.payload = { ...action.payload, ...payloadModifications };
  }

  // Mark as approved
  await aiActionsRepo.update(id, {
    status: 'approved',
    approvedBy: userId,
    approvedAt: new Date(),
  });

  // Execute
  const result = await aiActionExecutor.execute(action, userId);

  res.json({ success: true, data: { actionId: id, status: 'executed', result } });
});

router.post('/actions/:id/reject', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { userId } = req.user;
  const { reason } = req.body;

  await aiActionsRepo.update(id, {
    status: 'rejected',
    rejectedBy: userId,
    rejectedAt: new Date(),
    rejectionReason: reason || 'Rejected by user',
  });

  res.json({ success: true, data: { actionId: id, status: 'rejected' } });
});
```

---

## 6. Frontend Components

### 6.1 ActionCard Component

```tsx
// src/components/AIChat/ActionCard.tsx

interface ActionCardProps {
  action: AIAction;
  onApprove: (action: AIAction, modifications?: any) => Promise<void>;
  onReject: (action: AIAction, reason?: string) => Promise<void>;
  onEdit: (action: AIAction) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onApprove, onReject, onEdit }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(action);
    } finally {
      setIsLoading(false);
    }
  };

  // Render based on status
  if (action.status === 'executed') {
    return (
      <div className="action-card action-card--success">
        <div className="action-card__header">
          <span className="action-card__icon">✅</span>
          <span className="action-card__title">{getActionSuccessTitle(action)}</span>
        </div>
        <div className="action-card__body">{action.executionResult?.message}</div>
        <div className="action-card__actions">
          {action.executionResult?.resultId && (
            <button onClick={() => navigateToResult(action)}>{t('ai.actions.view_result')}</button>
          )}
        </div>
      </div>
    );
  }

  if (action.status === 'rejected') {
    return (
      <div className="action-card action-card--rejected">
        <div className="action-card__header">
          <span className="action-card__icon">❌</span>
          <span className="action-card__title">{t('ai.actions.rejected')}</span>
        </div>
      </div>
    );
  }

  // Pending status
  return (
    <div className="action-card action-card--pending">
      <div className="action-card__header">
        <span className="action-card__icon">{action.icon}</span>
        <span className="action-card__title">{action.title}</span>
      </div>

      <div className="action-card__body">
        <p>{action.description}</p>
        <ActionPayloadPreview payload={action.payload} type={action.type} />
      </div>

      <div className="action-card__actions">
        <button className="btn btn-primary" onClick={handleApprove} disabled={isLoading}>
          {isLoading ? t('common.loading') : t('ai.actions.approve')}
        </button>
        <button className="btn btn-secondary" onClick={() => onEdit(action)}>
          {t('ai.actions.edit')}
        </button>
        <button className="btn btn-ghost" onClick={() => onReject(action)}>
          {t('ai.actions.dismiss')}
        </button>
      </div>
    </div>
  );
};
```

### 6.2 Action Detection in Messages

```tsx
// src/components/AIChat/UnifiedChatPanel.tsx

const renderMessage = (message: ConversationMessage) => {
  const actions = message.metadata?.actions || [];

  return (
    <div className="message">
      <div className="message__content">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {actions.length > 0 && (
        <div className="message__actions">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={handleApproveAction}
              onReject={handleRejectAction}
              onEdit={handleEditAction}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## 7. AI Response with Actions

### 7.1 Action Detection in Backend

```typescript
// server/src/services/aiActionDetector.ts

export function detectActions(aiResponse: string, context: PromptContext): AIAction[] {
  const actions: AIAction[] = [];

  // Pattern 1: Explicit action markers in response
  // AI can output: [ACTION:create_task:{"title":"...","priority":"high"}]
  const actionPattern = /\[ACTION:(\w+):({.*?})\]/g;
  let match;
  while ((match = actionPattern.exec(aiResponse)) !== null) {
    const [, type, payloadJson] = match;
    try {
      const payload = JSON.parse(payloadJson);
      actions.push(createAction(type as AIActionType, payload, context));
    } catch (e) {
      console.warn('Failed to parse action:', match[0]);
    }
  }

  // Pattern 2: Natural language detection
  // "I can create a task for this" → suggest create_task
  if (actions.length === 0) {
    const suggestedActions = detectNaturalLanguageActions(aiResponse, context);
    actions.push(...suggestedActions);
  }

  return actions;
}

function createAction(
  type: AIActionType,
  payload: Record<string, any>,
  context: PromptContext
): AIAction {
  return {
    id: generateId(),
    type,
    title: getActionTitle(type),
    description: getActionDescription(type, payload),
    icon: getActionIcon(type),
    payload: {
      ...payload,
      projectId: payload.projectId || context.workspaceContext?.pmoProjectId,
    },
    requiresApproval: actionRequiresApproval(type),
    status: 'pending',
    conversationId: context.conversationId,
    messageId: context.currentMessageId,
    createdAt: new Date(),
  };
}
```

### 7.2 Streaming with Actions

```typescript
// server/src/routes/ai.routes.ts

router.post('/chat/stream', verifyToken, async (req, res) => {
  // ... setup SSE

  const fullResponse = await streamAIResponse(req.body, (chunk) => {
    res.write(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`);
  });

  // After streaming complete, detect actions
  const actions = detectActions(fullResponse, context);

  if (actions.length > 0) {
    // Save actions to DB
    for (const action of actions) {
      await aiActionsRepo.create(action);
    }

    // Send actions to client
    res.write(`data: ${JSON.stringify({ type: 'actions', actions })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
});
```

---

## 8. Audit Trail

### 8.1 Logged Events

| Event           | Data Logged                       | Retention |
| --------------- | --------------------------------- | --------- |
| Action proposed | Action details, conversation ID   | 90 days   |
| Action approved | Action ID, approver, timestamp    | Permanent |
| Action rejected | Action ID, rejecter, reason       | 90 days   |
| Action executed | Action ID, result, entity created | Permanent |
| Action failed   | Action ID, error details          | 90 days   |

### 8.2 Audit Log Schema

```sql
CREATE TABLE ai_actions_audit (
    id TEXT PRIMARY KEY,
    action_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'proposed', 'approved', 'rejected', 'executed', 'failed'

    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    conversation_id TEXT,

    action_type TEXT NOT NULL,
    action_payload TEXT, -- JSON

    -- For execution events
    result_id TEXT,
    result_type TEXT,
    error_message TEXT,

    -- Approval events
    approved_by TEXT,
    rejected_by TEXT,
    rejection_reason TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (action_id) REFERENCES ai_actions(id)
);

CREATE INDEX idx_audit_org ON ai_actions_audit(organization_id, created_at);
CREATE INDEX idx_audit_user ON ai_actions_audit(user_id, created_at);
```

---

## 9. Security Considerations

### 9.1 Permission Checks

```typescript
async function verifyActionPermission(
  action: AIAction,
  userId: string,
  organizationId: string
): Promise<void> {
  const config = await loadAIActionsConfig(organizationId);

  // Check if action type is allowed
  const actionTypeToPermission: Record<AIActionType, keyof typeof config.allowedActions> = {
    create_task: 'createTasks',
    create_initiative: 'suggestInitiatives',
    create_decision: 'createDecisionRequests',
    // ...
  };

  const permissionKey = actionTypeToPermission[action.type];
  if (permissionKey && !config.allowedActions[permissionKey]) {
    throw new ForbiddenError(`Action type ${action.type} is not allowed for this organization`);
  }

  // Check user role for approval
  const requiredRole = config.approvalSettings[action.type];
  if (requiredRole) {
    const userRole = await getUserRole(userId, organizationId);
    if (!hasRequiredRole(userRole, requiredRole)) {
      throw new ForbiddenError(`User does not have permission to approve ${action.type} actions`);
    }
  }
}
```

### 9.2 Rate Limiting

```typescript
const ACTION_LIMITS = {
  create_task: { max: 10, window: '1h' },
  create_initiative: { max: 5, window: '1h' },
  send_notification: { max: 20, window: '1h' },
};

async function checkActionRateLimit(
  actionType: AIActionType,
  organizationId: string
): Promise<void> {
  const limit = ACTION_LIMITS[actionType];
  if (!limit) return;

  const count = await countRecentActions(actionType, organizationId, limit.window);
  if (count >= limit.max) {
    throw new RateLimitError(
      `Too many ${actionType} actions. Limit: ${limit.max} per ${limit.window}`
    );
  }
}
```

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_
