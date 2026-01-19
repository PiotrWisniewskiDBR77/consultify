# AI Chat Integration Tests Specification

> **Document:** AI_CHAT_INTEGRATION_TESTS.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED  
> **Related:** AI_CHAT_SYSTEM_DESIGN.md, AI_CHAT_INTEGRATION_MAP.md

---

## 📋 Overview

Ten dokument definiuje specyfikację testów integracyjnych dla systemu AI Chat w Consultinity. Zawiera scenariusze testowe, wymagania dotyczące danych testowych, oczekiwane zachowania i edge cases.

---

## 🧪 Test Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI CHAT TEST PYRAMID                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ┌─────────┐                              │
│                        │   E2E   │  ← 10%                       │
│                        │  Tests  │    Full user flows           │
│                       ─┴─────────┴─                             │
│                     ┌─────────────────┐                         │
│                     │   Integration   │  ← 30%                  │
│                     │     Tests       │    API + Components     │
│                    ─┴─────────────────┴─                        │
│                  ┌───────────────────────┐                      │
│                  │      Unit Tests       │  ← 60%               │
│                  │   Services & Utils    │    Individual funcs  │
│                 ─┴───────────────────────┴─                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Test File Structure

```
tests/
├── integration/
│   └── ai-chat/
│       ├── context-injection.test.ts
│       ├── memory-system.test.ts
│       ├── actions-workflow.test.ts
│       ├── conversation-flow.test.ts
│       └── feedback-learning.test.ts
├── e2e/
│   └── ai-chat/
│       ├── full-conversation.spec.ts
│       ├── context-awareness.spec.ts
│       └── action-execution.spec.ts
└── mocks/
    └── ai-chat/
        ├── mockConversations.ts
        ├── mockMessages.ts
        ├── mockActions.ts
        └── mockMemory.ts
```

---

## 🔧 Test Setup

### Mock Data Requirements

```typescript
// tests/mocks/ai-chat/mockConversations.ts
export const mockConversations = {
  // Empty conversation (new chat)
  empty: {
    id: 'conv-empty',
    title: 'Nowa rozmowa',
    messages: [],
  },

  // Conversation with context
  withProjectContext: {
    id: 'conv-project',
    title: 'Digital Transformation Q1',
    projectId: 'proj-dt-2026',
    messages: [
      { role: 'user', content: 'Jakie są główne inicjatywy?' },
      { role: 'ai', content: 'W projekcie Digital Transformation...' },
    ],
  },

  // Conversation with pending action
  withPendingAction: {
    id: 'conv-action',
    title: 'Task creation',
    pendingActions: [
      {
        id: 'action-1',
        type: 'create_task',
        status: 'proposed',
        payload: { task: { title: 'Review documentation' } },
      },
    ],
  },
};
```

```typescript
// tests/mocks/ai-chat/mockMemory.ts
export const mockUserMemory = {
  entries: [
    { key: 'response_length_preference', value: 'concise', category: 'preference' },
    { key: 'communication_style', value: 'formal', category: 'style' },
  ],
};

export const mockOrgMemory = {
  entries: [
    { key: 'company_terminology', value: 'Use "initiatives" not "projects"', category: 'terminology' },
    { key: 'approval_process', value: 'All tasks require PM approval', category: 'procedure' },
  ],
};
```

---

## 📋 Integration Test Scenarios

### 1. Context Injection Tests

**File:** `tests/integration/ai-chat/context-injection.test.ts`

```typescript
describe('AI Chat Context Injection', () => {
  describe('WorkspaceContext', () => {
    it('should inject project context when on project view', async () => {
      // Setup
      const projectId = 'proj-123';
      mockAppStore.setCurrentView(AppView.PROJECT_OVERVIEW);
      mockAppStore.setCurrentProjectId(projectId);

      // Execute
      const context = await AIContext.buildWorkspaceContext();

      // Assert
      expect(context.type).toBe('project');
      expect(context.entityId).toBe(projectId);
      expect(context.entityName).toBeDefined();
    });

    it('should inject task context when on task detail', async () => {
      // Setup
      const taskId = 'task-456';
      mockAppStore.setCurrentView(AppView.TASK_DETAIL);
      mockAppStore.setSelectedTaskId(taskId);

      // Execute
      const context = await AIContext.buildWorkspaceContext();

      // Assert
      expect(context.type).toBe('task');
      expect(context.entityId).toBe(taskId);
      expect(context.entityData?.status).toBeDefined();
    });

    it('should return empty context when no specific view', async () => {
      // Setup
      mockAppStore.setCurrentView(AppView.DASHBOARD);

      // Execute
      const context = await AIContext.buildWorkspaceContext();

      // Assert
      expect(context.type).toBe('empty');
    });
  });

  describe('MemoryContext', () => {
    it('should include user memory in AI prompt', async () => {
      // Setup
      mockMemoryService.getUserMemory.mockResolvedValue(mockUserMemory);

      // Execute
      const prompt = await AIContext.buildFullPrompt('User question');

      // Assert
      expect(prompt).toContain('concise');
      expect(prompt).toContain('formal');
    });

    it('should include org memory in AI prompt', async () => {
      // Setup
      mockMemoryService.getOrganizationMemory.mockResolvedValue(mockOrgMemory);

      // Execute
      const prompt = await AIContext.buildFullPrompt('User question');

      // Assert
      expect(prompt).toContain('initiatives');
      expect(prompt).toContain('PM approval');
    });
  });
});
```

### 2. Memory System Tests

**File:** `tests/integration/ai-chat/memory-system.test.ts`

```typescript
describe('AI Memory System', () => {
  describe('User Memory CRUD', () => {
    it('should fetch user memory on chat init', async () => {
      // Execute
      await MemoryService.getUserMemory();

      // Assert
      expect(Api.getUserMemory).toHaveBeenCalled();
    });

    it('should update user memory from feedback', async () => {
      // Setup
      const feedback = {
        lengthFeedback: 'too-long',
        rating: 'negative',
      };

      // Execute
      await MemoryService.learnFromFeedback(feedback);

      // Assert
      expect(Api.updateUserMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'response_length',
          value: 'concise',
        })
      );
    });

    it('should cache memory for 5 minutes', async () => {
      // First call
      await MemoryService.getUserMemory();
      
      // Second call within cache window
      await MemoryService.getUserMemory();

      // Assert - only one API call
      expect(Api.getUserMemory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memory Context Building', () => {
    it('should build memory context string for AI', async () => {
      // Setup
      mockMemoryService.getUserMemory.mockResolvedValue(mockUserMemory);
      mockMemoryService.getOrganizationMemory.mockResolvedValue(mockOrgMemory);

      // Execute
      const context = await MemoryService.buildMemoryContext();

      // Assert
      expect(context).toContain('## User Preferences');
      expect(context).toContain('## Organization Context');
    });
  });
});
```

### 3. Actions Workflow Tests

**File:** `tests/integration/ai-chat/actions-workflow.test.ts`

```typescript
describe('AI Actions Workflow', () => {
  describe('Action Proposal', () => {
    it('should detect action in AI response', async () => {
      // Setup
      const aiResponse = `
        I'll create a task for you.
        
        [ACTION:create_task]
        {
          "title": "Review Q1 report",
          "priority": "high"
        }
        [/ACTION]
      `;

      // Execute
      const actions = parseActionsFromResponse(aiResponse);

      // Assert
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('create_task');
      expect(actions[0].payload.task.title).toBe('Review Q1 report');
    });

    it('should add action to store as proposed', async () => {
      // Setup
      const action = {
        type: 'create_task',
        title: 'Create task',
        payload: { task: { title: 'Test' } },
      };

      // Execute
      useAIActionsStore.getState().proposeAction(action);

      // Assert
      const pending = useAIActionsStore.getState().getPendingActions();
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe('proposed');
    });
  });

  describe('Action Approval', () => {
    it('should execute action on approval', async () => {
      // Setup
      const actionId = 'action-123';
      mockActionsStore.actions = [{ id: actionId, status: 'proposed' }];

      // Execute
      await useAIActionsStore.getState().approveAction(actionId);

      // Assert
      expect(Api.executeAIAction).toHaveBeenCalledWith(actionId, expect.any(Object));
    });

    it('should update status after execution', async () => {
      // Setup
      const actionId = 'action-123';
      Api.executeAIAction.mockResolvedValue({ success: true, createdId: 'task-new' });

      // Execute
      await useAIActionsStore.getState().approveAction(actionId);

      // Assert
      const action = useAIActionsStore.getState().getActionById(actionId);
      expect(action?.status).toBe('executed');
    });
  });

  describe('Action Dismissal', () => {
    it('should mark action as dismissed', async () => {
      // Setup
      const actionId = 'action-123';

      // Execute
      await useAIActionsStore.getState().dismissAction(actionId);

      // Assert
      const action = useAIActionsStore.getState().getActionById(actionId);
      expect(action?.status).toBe('dismissed');
    });
  });
});
```

### 4. Conversation Flow Tests

**File:** `tests/integration/ai-chat/conversation-flow.test.ts`

```typescript
describe('AI Chat Conversation Flow', () => {
  describe('New Conversation', () => {
    it('should create conversation on first message', async () => {
      // Setup
      mockConversationStore.activeConversationId = null;

      // Execute
      await handleSendMessage('Hello AI');

      // Assert
      expect(Api.createConversation).toHaveBeenCalled();
      expect(useConversationStore.getState().activeConversationId).toBeDefined();
    });

    it('should generate title after first exchange', async () => {
      // Setup
      const convId = 'conv-new';
      mockConversationStore.activeMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'ai', content: 'Hi there!' },
      ];

      // Execute - after AI response
      await onStreamDone('Hi there!', [], []);

      // Assert
      expect(Api.generateConversationTitle).toHaveBeenCalledWith(convId);
    });
  });

  describe('Message Streaming', () => {
    it('should display streaming content in real-time', async () => {
      // Setup
      const { result } = renderHook(() => useAIStream());

      // Execute
      act(() => {
        result.current.startStream('Question', [], undefined);
      });

      // Simulate SSE events
      mockSSE.emit('data', { content: 'Part 1' });
      mockSSE.emit('data', { content: ' Part 2' });

      // Assert
      expect(result.current.streamedContent).toBe('Part 1 Part 2');
    });

    it('should handle thinking steps', async () => {
      // Setup
      const onThinkingUpdate = jest.fn();
      const { result } = renderHook(() => useAIStream({ onThinkingUpdate }));

      // Execute
      mockSSE.emit('data', { thinking: { title: 'Analyzing', status: 'active' } });

      // Assert
      expect(onThinkingUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ title: 'Analyzing' })])
      );
    });
  });

  describe('Conversation History', () => {
    it('should group conversations by date', () => {
      // Setup
      const conversations = [
        { id: '1', updatedAt: new Date() }, // Today
        { id: '2', updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Yesterday
        { id: '3', updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last week
      ];

      // Execute
      const groups = groupConversations(conversations);

      // Assert
      expect(groups.today).toHaveLength(1);
      expect(groups.yesterday).toHaveLength(1);
      expect(groups.thisWeek).toHaveLength(1);
    });
  });
});
```

### 5. Feedback Learning Tests

**File:** `tests/integration/ai-chat/feedback-learning.test.ts`

```typescript
describe('Feedback Learning System', () => {
  describe('Immediate Feedback', () => {
    it('should update memory on length feedback', async () => {
      // Setup
      const feedback = {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        rating: 'negative',
        lengthFeedback: 'too-long',
      };

      // Execute
      await FeedbackLearningService.submitFeedback(feedback);

      // Assert
      expect(MemoryService.updateUserMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'response_length_preference',
          value: 'concise',
        })
      );
    });

    it('should update memory on style feedback', async () => {
      // Setup
      const feedback = {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        rating: 'negative',
        styleFeedback: 'too-formal',
      };

      // Execute
      await FeedbackLearningService.submitFeedback(feedback);

      // Assert
      expect(MemoryService.updateUserMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'communication_style',
          value: 'casual',
        })
      );
    });
  });

  describe('Pattern Learning', () => {
    it('should detect length tendency from multiple feedbacks', async () => {
      // Setup - multiple "too-long" feedbacks
      for (let i = 0; i < 5; i++) {
        await FeedbackLearningService.submitFeedback({
          messageId: `msg-${i}`,
          conversationId: 'conv-1',
          rating: 'negative',
          lengthFeedback: 'too-long',
        });
      }

      // Assert - should infer tendency
      expect(MemoryService.updateUserMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'response_length_tendency',
          value: 'shorter',
          source: 'inferred',
        })
      );
    });
  });

  describe('Prompt Suggestions', () => {
    it('should generate suggestions from memory', async () => {
      // Setup
      mockMemoryService.getUserMemory.mockResolvedValue({
        entries: [
          { key: 'response_length_preference', value: 'concise' },
          { key: 'communication_style', value: 'formal' },
        ],
      });

      // Execute
      const suggestions = await FeedbackLearningService.getPromptSuggestions();

      // Assert
      expect(suggestions).toContain('Provide concise, focused responses.');
      expect(suggestions).toContain('Use a professional, formal tone.');
    });
  });
});
```

---

## 🔍 E2E Test Scenarios

### 1. Full Conversation Flow

**File:** `tests/e2e/ai-chat/full-conversation.spec.ts`

```typescript
describe('E2E: Full AI Conversation', () => {
  beforeEach(async () => {
    await loginAsUser('test@example.com');
    await navigateTo('/ai-chat');
  });

  it('should complete full conversation cycle', async () => {
    // 1. Send initial message
    await page.fill('[data-testid="chat-input"]', 'What are my tasks for today?');
    await page.click('[data-testid="send-button"]');

    // 2. Wait for AI response
    await page.waitForSelector('[data-testid="ai-message"]');
    
    // 3. Verify response rendered
    const response = await page.textContent('[data-testid="ai-message"]');
    expect(response).toBeTruthy();

    // 4. Provide feedback
    await page.click('[data-testid="thumbs-up"]');
    await page.waitForSelector('[data-testid="feedback-thank-you"]');

    // 5. Verify conversation saved
    await page.reload();
    const history = await page.$$('[data-testid="conversation-item"]');
    expect(history.length).toBeGreaterThan(0);
  });
});
```

### 2. Context Awareness

**File:** `tests/e2e/ai-chat/context-awareness.spec.ts`

```typescript
describe('E2E: Context Awareness', () => {
  it('should show context badge when on project view', async () => {
    // Navigate to project
    await navigateTo('/projects/proj-123');
    
    // Open AI chat
    await page.click('[data-testid="ai-chat-trigger"]');

    // Verify context badge
    const badge = await page.waitForSelector('[data-testid="context-badge"]');
    const badgeText = await badge.textContent();
    expect(badgeText).toContain('Project');
  });

  it('should use context in AI response', async () => {
    // On project view
    await navigateTo('/projects/proj-123');
    await page.click('[data-testid="ai-chat-trigger"]');

    // Ask generic question
    await page.fill('[data-testid="chat-input"]', 'What should I focus on?');
    await page.click('[data-testid="send-button"]');

    // Response should mention project
    await page.waitForSelector('[data-testid="ai-message"]');
    const response = await page.textContent('[data-testid="ai-message"]');
    expect(response).toContain('Digital Transformation'); // Project name
  });
});
```

### 3. Action Execution

**File:** `tests/e2e/ai-chat/action-execution.spec.ts`

```typescript
describe('E2E: Action Execution', () => {
  it('should execute task creation action', async () => {
    // Start conversation
    await navigateTo('/ai-chat');
    await page.fill('[data-testid="chat-input"]', 'Create a task to review the Q1 report');
    await page.click('[data-testid="send-button"]');

    // Wait for action card
    await page.waitForSelector('[data-testid="action-card"]');

    // Approve action
    await page.click('[data-testid="approve-action"]');

    // Wait for execution
    await page.waitForSelector('[data-testid="action-executed"]');

    // Verify task created
    await navigateTo('/my-work/tasks');
    const task = await page.waitForSelector('text=Review the Q1 report');
    expect(task).toBeTruthy();
  });

  it('should allow editing action before approval', async () => {
    // ... similar setup
    await page.click('[data-testid="edit-action"]');
    await page.fill('[data-testid="action-title-input"]', 'Updated title');
    await page.click('[data-testid="save-and-approve"]');
    // ... verify
  });
});
```

---

## 🎯 Edge Cases

### Network Failures

```typescript
describe('Edge Case: Network Failures', () => {
  it('should handle API timeout gracefully', async () => {
    // Setup slow network
    Api.chatWithAIStream.mockImplementation(() => 
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
    );

    // Execute
    await sendMessage('Test');

    // Assert - should show error message
    expect(screen.getByText(/nie udało się/i)).toBeInTheDocument();
  });

  it('should queue messages when offline', async () => {
    // Go offline
    mockNavigator.onLine = false;

    // Send message
    await sendMessage('Offline message');

    // Assert - should show queued indicator
    expect(screen.getByText(/oczekuje/i)).toBeInTheDocument();
  });
});
```

### Concurrent Actions

```typescript
describe('Edge Case: Concurrent Actions', () => {
  it('should handle multiple pending actions', async () => {
    // Setup - 3 pending actions
    for (let i = 0; i < 3; i++) {
      useAIActionsStore.getState().proposeAction({
        type: 'create_task',
        title: `Task ${i}`,
        payload: { task: { title: `Task ${i}` } },
      });
    }

    // Assert - all shown
    const pending = useAIActionsStore.getState().getPendingActions();
    expect(pending).toHaveLength(3);
  });

  it('should prevent double approval', async () => {
    // Setup
    const actionId = 'action-123';

    // Double-click approve
    const approve1 = useAIActionsStore.getState().approveAction(actionId);
    const approve2 = useAIActionsStore.getState().approveAction(actionId);

    await Promise.all([approve1, approve2]);

    // Assert - only one execution
    expect(Api.executeAIAction).toHaveBeenCalledTimes(1);
  });
});
```

### Memory Conflicts

```typescript
describe('Edge Case: Memory Conflicts', () => {
  it('should merge conflicting memory updates', async () => {
    // Concurrent updates
    await Promise.all([
      MemoryService.updateUserMemory({ key: 'pref', value: 'a' }),
      MemoryService.updateUserMemory({ key: 'pref', value: 'b' }),
    ]);

    // Last write wins
    const memory = await MemoryService.getUserMemory(true);
    expect(memory.entries.find(e => e.key === 'pref')?.value).toBe('b');
  });
});
```

---

## ✅ Test Coverage Requirements

| Category | Min Coverage | Current |
|----------|--------------|---------|
| Context Injection | 90% | - |
| Memory System | 85% | - |
| Actions Workflow | 90% | - |
| Conversation Flow | 80% | - |
| Feedback Learning | 85% | - |
| **Overall** | **85%** | - |

---

## 🚀 Running Tests

```bash
# Unit tests
npm run test:unit -- --grep "ai-chat"

# Integration tests
npm run test:integration -- --grep "ai-chat"

# E2E tests
npm run test:e2e -- --spec "ai-chat"

# Full suite
npm run test:ai-chat
```

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_  
_Status: APPROVED_
