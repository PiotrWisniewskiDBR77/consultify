# AI Chat System - Data Model Specification

> **Document:** AI_CHAT_DATA_MODEL.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED

---

## 1. Overview

This document defines the data model for the AI Chat system, including:

- Chat Folders (conversation organization)
- Conversations and Messages
- Memory System (User/Org)
- AI Actions and Approvals
- Context structures

---

## 2. Chat Folders (Previously "Chat Projects")

### 2.1 Naming Clarification

| Old Name              | New Name             | Reason                            |
| --------------------- | -------------------- | --------------------------------- |
| `ChatProject`         | `ChatFolder`         | Avoid confusion with PMO Projects |
| `chatProjectId`       | `chatFolderId`       | Clearer field name                |
| `useChatProjectStore` | `useChatFolderStore` | Consistent naming                 |

### 2.2 ChatFolder Interface

```typescript
/**
 * ChatFolder - Organizational folder for conversations
 * Similar to Claude's "Projects" - NOT the same as PMO Projects
 */
interface ChatFolder {
  id: string;

  // Organization
  organizationId: string;
  createdBy: string; // userId

  // Display
  name: string;
  description?: string;
  color: string; // Hex color for UI
  icon: string; // Icon name or emoji

  // AI Customization
  customInstructions?: string; // Custom AI instructions for this folder
  defaultFocusMode?: FocusMode;

  // Statistics
  conversationCount: number;
  lastActivityAt: Date;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

// Example:
const marketingFolder: ChatFolder = {
  id: 'folder_123',
  organizationId: 'org_456',
  createdBy: 'user_789',
  name: 'Marketing DX Discussions',
  description: 'All conversations about Marketing Digital Transformation',
  color: '#3B82F6',
  icon: '📁',
  customInstructions: 'Focus on marketing automation and customer journey topics.',
  defaultFocusMode: 'project',
  conversationCount: 5,
  lastActivityAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 2.3 Database Schema

```sql
-- Chat Folders (previously chat_projects)
CREATE TABLE chat_folders (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    created_by TEXT NOT NULL,

    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    icon TEXT DEFAULT '📁',

    custom_instructions TEXT,
    default_focus_mode TEXT DEFAULT 'all',

    conversation_count INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_chat_folders_org ON chat_folders(organization_id);
CREATE INDEX idx_chat_folders_user ON chat_folders(created_by);
```

---

## 3. Conversations

### 3.1 Conversation Interface

```typescript
interface Conversation {
  id: string;

  // Organization
  organizationId: string;
  userId: string; // Owner

  // Title
  title: string;
  titleSource: 'auto' | 'user'; // Auto-generated or user-edited

  // Chat Organization (Folder)
  chatFolderId?: string | null; // Which folder this belongs to

  // PMO Context (Business Project)
  pmoProjectId?: string | null; // Which PMO project this relates to

  // Statistics
  messageCount: number;
  lastMessageAt: Date;

  // State
  starred: boolean;
  archived: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Example:
const conversation: Conversation = {
  id: 'conv_123',
  organizationId: 'org_456',
  userId: 'user_789',
  title: 'Budget Planning Discussion',
  titleSource: 'auto',
  chatFolderId: 'folder_123', // Organized in Marketing folder
  pmoProjectId: 'proj_456', // Has context from Marketing DX project
  messageCount: 15,
  lastMessageAt: new Date(),
  starred: false,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

### 3.2 Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ChatFolder    │     │  Conversation   │     │   PMO Project   │
│   (organize)    │────<│                 │>────│   (context)     │
│                 │     │                 │     │                 │
│ Marketing talks │     │ Budget planning │     │ Marketing DX    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ has many
                                 ▼
                        ┌─────────────────┐
                        │ ConversationMsg │
                        │                 │
                        │ User: "Hi"      │
                        │ AI: "Hello!"    │
                        └─────────────────┘

Legend:
├──< = Folder contains many conversations (organizational)
>──┤ = Conversation gets context from PMO Project (reference)
```

### 3.3 Database Schema

```sql
-- Conversations
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    title TEXT NOT NULL,
    title_source TEXT DEFAULT 'auto',

    -- Chat organization (folder)
    chat_folder_id TEXT,

    -- PMO context (business project)
    pmo_project_id TEXT,

    -- Statistics
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,

    -- State
    starred INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (chat_folder_id) REFERENCES chat_folders(id),
    FOREIGN KEY (pmo_project_id) REFERENCES projects(id)
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_folder ON conversations(chat_folder_id);
CREATE INDEX idx_conversations_project ON conversations(pmo_project_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
```

---

## 4. Conversation Messages

### 4.1 Message Interface

```typescript
interface ConversationMessage {
  id: string;
  conversationId: string;

  // Content
  role: 'user' | 'ai' | 'system';
  content: string;
  messageType: 'text' | 'voice' | 'file' | 'action';

  // AI Response Metadata
  metadata?: {
    // Thinking process
    thinkingSteps?: ThinkingStep[];

    // Generated artifacts
    artifacts?: Artifact[];

    // Proposed actions
    actions?: AIAction[];

    // Citations/sources
    citations?: Citation[];

    // Voice metadata
    voiceTranscript?: string;
    voiceDuration?: number;

    // Model info
    model?: string;
    tokenCount?: number;
  };

  // Feedback
  feedback?: {
    rating: 'like' | 'dislike' | null;
    comment?: string;
    correction?: string;
  };

  // Metadata
  createdAt: Date;
  editedAt?: Date;
}

interface ThinkingStep {
  id: string;
  type: 'analysis' | 'research' | 'planning' | 'reasoning';
  content: string;
  timestamp: Date;
}

interface Artifact {
  id: string;
  type: 'code' | 'document' | 'chart' | 'table' | 'diagram';
  title: string;
  content: string;
  language?: string; // For code artifacts
}

interface Citation {
  id: string;
  source: string;
  url?: string;
  excerpt: string;
}
```

### 4.2 Database Schema

```sql
-- Conversation Messages
CREATE TABLE conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,

    role TEXT NOT NULL, -- 'user', 'ai', 'system'
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',

    -- AI metadata (JSON)
    metadata TEXT,

    -- Feedback (JSON)
    feedback TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX idx_messages_created ON conversation_messages(created_at);
```

---

## 5. Memory System

### 5.1 User Memory

```typescript
/**
 * UserMemory - Personal AI memory for each user
 * Auto-collected from interactions, editable by user
 */
interface UserMemory {
  id: string;
  userId: string;
  organizationId: string;

  // Preferences
  preferences: {
    language: string; // 'pl', 'en', etc.
    detailLevel: 'concise' | 'balanced' | 'detailed';
    communicationStyle: 'formal' | 'casual' | 'technical';
    timezone: string;
  };

  // Expertise & Context
  expertise: string[]; // ['project management', 'lean', 'IT']
  recentTopics: string[]; // Last 20 discussed topics

  // Interaction Stats
  interactionCount: number;
  lastInteractionAt: Date;
  averageSessionLength: number; // minutes

  // Learned Preferences
  learnedPreferences: {
    preferredReportFormat?: string;
    commonQuestions?: string[];
    frequentActions?: string[];
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### 5.2 Organization Memory

```typescript
/**
 * OrganizationMemory - Shared AI context for organization
 * Managed by Admin, used for all users in org
 */
interface OrganizationMemory {
  id: string;
  organizationId: string;

  // Company Context
  industry: string;
  companySize: 'startup' | 'small' | 'medium' | 'enterprise';
  strategicContext: string; // Company description, goals

  // Custom Terminology
  terminology: Record<string, string>; // {'DRD': 'Digital Readiness Diagnostic'}

  // Learned Patterns
  decisionPatterns: {
    type: string;
    commonOutcome: string;
    avgTimeToDecision: number;
  }[];

  assessmentInsights: {
    framework: string;
    avgCurrentScore: number;
    avgTargetScore: number;
    commonGaps: string[];
  }[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastAnalyzedAt: Date;
}
```

### 5.3 Database Schema

```sql
-- User Memory
CREATE TABLE ai_user_memory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,

    -- Preferences (JSON)
    preferences TEXT DEFAULT '{}',

    -- Context (JSON arrays)
    expertise TEXT DEFAULT '[]',
    recent_topics TEXT DEFAULT '[]',

    -- Stats
    interaction_count INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMP,
    average_session_length INTEGER DEFAULT 0,

    -- Learned (JSON)
    learned_preferences TEXT DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX idx_user_memory_user ON ai_user_memory(user_id);

-- Organization Memory
CREATE TABLE ai_org_memory (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,

    -- Company context
    industry TEXT,
    company_size TEXT,
    strategic_context TEXT,

    -- Terminology (JSON)
    terminology TEXT DEFAULT '{}',

    -- Patterns (JSON)
    decision_patterns TEXT DEFAULT '[]',
    assessment_insights TEXT DEFAULT '[]',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_analyzed_at TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE UNIQUE INDEX idx_org_memory_org ON ai_org_memory(organization_id);
```

---

## 6. AI Actions

### 6.1 Action Interface

```typescript
type AIActionType =
  | 'navigate'
  | 'create_task'
  | 'create_initiative'
  | 'create_decision'
  | 'update_task'
  | 'update_assessment'
  | 'send_notification'
  | 'generate_report'
  | 'generate_artifact';

interface AIAction {
  id: string;
  conversationId: string;
  messageId: string;

  // Action Definition
  type: AIActionType;
  title: string;
  description: string;
  icon: string;

  // Payload
  payload: Record<string, any>;

  // Approval
  requiresApproval: boolean;
  autoApproveAfter?: number; // seconds, null = never

  // Status
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

  // Execution
  executedAt?: Date;
  executionResult?: {
    success: boolean;
    resultId?: string; // ID of created entity
    error?: string;
  };

  // Audit
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;

  // Metadata
  createdAt: Date;
}

// Example: Create Initiative Action
const createInitiativeAction: AIAction = {
  id: 'action_123',
  conversationId: 'conv_456',
  messageId: 'msg_789',

  type: 'create_initiative',
  title: 'Create Initiative',
  description: 'Process Automation Phase 1',
  icon: '💡',

  payload: {
    name: 'Process Automation Phase 1',
    axisId: 'axis_processes',
    priority: 'high',
    estimatedEffort: '6 months',
    description: 'Automate key business processes...',
    projectId: 'proj_456',
  },

  requiresApproval: true,
  autoApproveAfter: null,

  status: 'pending',
  createdAt: new Date(),
};
```

### 6.2 Database Schema

```sql
-- AI Actions
CREATE TABLE ai_actions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Action definition
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '💡',

    -- Payload (JSON)
    payload TEXT NOT NULL,

    -- Approval
    requires_approval INTEGER DEFAULT 1,
    auto_approve_after INTEGER, -- seconds

    -- Status
    status TEXT DEFAULT 'pending',

    -- Execution
    executed_at TIMESTAMP,
    execution_result TEXT, -- JSON

    -- Audit
    approved_by TEXT,
    approved_at TIMESTAMP,
    rejected_by TEXT,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (message_id) REFERENCES conversation_messages(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_ai_actions_conversation ON ai_actions(conversation_id);
CREATE INDEX idx_ai_actions_status ON ai_actions(status);
CREATE INDEX idx_ai_actions_user ON ai_actions(user_id, status);
```

---

## 7. Context Structures

### 7.1 Workspace Context

```typescript
type WorkspaceType =
  | 'empty' // No specific context
  | 'project' // PMO Project view
  | 'initiative' // Initiative detail
  | 'task' // Task detail
  | 'decision' // Decision detail
  | 'assessment' // Assessment in progress
  | 'report' // Report view
  | 'dashboard'; // Dashboard view

interface WorkspaceContext {
  type: WorkspaceType;

  // Entity reference
  entityId?: string;
  entityName?: string;

  // PMO Project (parent context)
  pmoProjectId?: string;
  pmoProjectName?: string;

  // Additional data
  data?: {
    // For task
    taskStatus?: string;
    taskPriority?: string;
    assignee?: string;

    // For initiative
    initiativeAxis?: string;
    initiativeProgress?: number;

    // For assessment
    assessmentFramework?: string;
    currentScore?: number;
    targetScore?: number;

    // For decision
    decisionType?: string;
    deadline?: Date;
  };

  // Timestamp
  capturedAt: Date;
}

// Example: Task context
const taskContext: WorkspaceContext = {
  type: 'task',
  entityId: 'task_123',
  entityName: 'Implement SSO Integration',
  pmoProjectId: 'proj_456',
  pmoProjectName: 'IT Infrastructure Upgrade',
  data: {
    taskStatus: 'in_progress',
    taskPriority: 'high',
    assignee: 'John Doe',
  },
  capturedAt: new Date(),
};
```

### 7.2 Focus Mode

```typescript
type FocusMode =
  | 'all' // All knowledge sources
  | 'pmo_docs' // PMO standards only (ISO, PMBOK, PRINCE2)
  | 'project' // Current project data
  | 'knowledge' // Organization knowledge bases
  | 'web'; // Web search enabled

interface FocusModeConfig {
  mode: FocusMode;

  // For 'project' mode
  projectId?: string;

  // For 'knowledge' mode
  knowledgeBaseIds?: string[];

  // For 'web' mode
  webSearchEnabled: boolean;
  webSearchDomains?: string[]; // Restrict to domains
}
```

---

## 8. Migration Plan

### 8.1 Rename chat_projects → chat_folders

```sql
-- Migration: Rename chat_projects to chat_folders
-- File: server/migrations/250_rename_chat_folders.sql

-- Step 1: Create new table
CREATE TABLE chat_folders AS SELECT * FROM chat_projects;

-- Step 2: Rename column in conversations
ALTER TABLE conversations
RENAME COLUMN chat_project_id TO chat_folder_id;

-- Step 3: Update foreign key
-- (handled by application layer as SQLite doesn't support FK modification)

-- Step 4: Drop old table (after verification)
-- DROP TABLE chat_projects;
```

### 8.2 Add Memory Tables

```sql
-- Migration: Add AI Memory System
-- File: server/migrations/251_ai_memory_system.sql

-- User Memory
CREATE TABLE IF NOT EXISTS ai_user_memory (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    preferences TEXT DEFAULT '{"language":"pl","detailLevel":"balanced","communicationStyle":"casual"}',
    expertise TEXT DEFAULT '[]',
    recent_topics TEXT DEFAULT '[]',
    interaction_count INTEGER DEFAULT 0,
    last_interaction_at TIMESTAMP,
    average_session_length INTEGER DEFAULT 0,
    learned_preferences TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Organization Memory
CREATE TABLE IF NOT EXISTS ai_org_memory (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    organization_id TEXT NOT NULL UNIQUE,
    industry TEXT,
    company_size TEXT,
    strategic_context TEXT,
    terminology TEXT DEFAULT '{}',
    decision_patterns TEXT DEFAULT '[]',
    assessment_insights TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_analyzed_at TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_memory_org ON ai_user_memory(organization_id);
```

### 8.3 Add Actions Table

```sql
-- Migration: Add AI Actions
-- File: server/migrations/252_ai_actions.sql

CREATE TABLE IF NOT EXISTS ai_actions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '💡',
    payload TEXT NOT NULL,
    requires_approval INTEGER DEFAULT 1,
    auto_approve_after INTEGER,
    status TEXT DEFAULT 'pending',
    executed_at TIMESTAMP,
    execution_result TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP,
    rejected_by TEXT,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_actions_conv ON ai_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON ai_actions(status, user_id);
```

---

## 9. Store Updates

### 9.1 useConversationStore Updates

```typescript
// src/store/useConversationStore.ts

interface ConversationState {
  // ... existing fields
  // RENAMED: chatProjectId → chatFolderId
  // conversations now use chatFolderId
}

// Migration for localStorage
const migrateLocalStorage = () => {
  const stored = localStorage.getItem('conversation-storage');
  if (stored) {
    const data = JSON.parse(stored);
    if (data.state?.conversations) {
      data.state.conversations = data.state.conversations.map((conv: any) => ({
        ...conv,
        chatFolderId: conv.chatProjectId || conv.chatFolderId,
        // Remove old field
        chatProjectId: undefined,
      }));
      localStorage.setItem('conversation-storage', JSON.stringify(data));
    }
  }
};
```

### 9.2 useChatFolderStore (renamed)

```typescript
// src/store/useChatFolderStore.ts (renamed from useChatProjectStore)

interface ChatFolderState {
  folders: ChatFolder[];
  activeFolderId: string | null;

  // Actions
  fetchFolders: () => Promise<void>;
  createFolder: (folder: Partial<ChatFolder>) => Promise<ChatFolder>;
  updateFolder: (id: string, updates: Partial<ChatFolder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveConversationToFolder: (conversationId: string, folderId: string | null) => Promise<void>;

  // Queries
  getConversationsInFolder: (folderId: string) => Conversation[];
  getUnorganizedConversations: () => Conversation[];
}
```

---

## 10. Related Documents

- **Design Specification:** `docs/AI_CHAT_SYSTEM_DESIGN.md`
- **Implementation Plan:** `docs/AI_CHAT_IMPLEMENTATION_PLAN.md`
- **API Specification:** `docs/api/AI_CHAT_API.md`

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_
