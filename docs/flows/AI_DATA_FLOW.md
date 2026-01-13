# AI Chat Data Flow

> **Document:** AI_DATA_FLOW.md  
> **Version:** 1.0  
> **Created:** 2026-01-11  
> **Status:** APPROVED  
> **Related:** FLOW-AIASSISTANT-001, AI_CONTEXT_FLOW.md

---

## 📋 Overview

Ten dokument opisuje przepływ danych w systemie AI Chat - jakie dane AI odczytuje, jakie zapisuje, oraz polityki prywatności i retencji danych.

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI CHAT DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────┐     READ      ┌──────────────────┐                        │
│  │  User Input      │──────────────▶│                  │                        │
│  └──────────────────┘               │                  │                        │
│                                     │                  │     WRITE              │
│  ┌──────────────────┐     READ      │   AI PIPELINE    │────────────────────┐   │
│  │  Workspace       │──────────────▶│                  │                    │   │
│  │  Context         │               │  • Context       │                    ▼   │
│  └──────────────────┘               │    Building      │  ┌──────────────────┐  │
│                                     │  • LLM Call      │  │  Conversations   │  │
│  ┌──────────────────┐     READ      │  • Response      │  │  Table           │  │
│  │  PMO Data        │──────────────▶│    Processing    │  └──────────────────┘  │
│  │  (Projects,      │               │  • Action        │                    │   │
│  │   Initiatives,   │               │    Detection     │                    │   │
│  │   Tasks)         │               │                  │                    ▼   │
│  └──────────────────┘               │                  │  ┌──────────────────┐  │
│                                     │                  │  │  Messages        │  │
│  ┌──────────────────┐     READ      │                  │  │  Table           │  │
│  │  User Memory     │──────────────▶│                  │  └──────────────────┘  │
│  └──────────────────┘               │                  │                    │   │
│                                     │                  │                    │   │
│  ┌──────────────────┐     READ      │                  │                    ▼   │
│  │  Org Memory      │──────────────▶│                  │  ┌──────────────────┐  │
│  └──────────────────┘               │                  │  │  AI Actions      │  │
│                                     │                  │  │  Log             │  │
│  ┌──────────────────┐     READ      │                  │  └──────────────────┘  │
│  │  PMO Standards   │──────────────▶│                  │                    │   │
│  │  (ISO, PMBOK,    │               └──────────────────┘                    │   │
│  │   PRINCE2)       │                                                       │   │
│  └──────────────────┘                                                       │   │
│                                                                              │   │
│                              ┌────────────────────────────────────────────┐  │   │
│                              │          WRITE (Conditional)               │  │   │
│                              ├────────────────────────────────────────────┤  │   │
│                              │                                            │  │   │
│                              │  ┌─────────────┐  ┌─────────────┐         │◀─┘   │
│                              │  │ User Memory │  │ Feedback    │         │      │
│                              │  │ Updates     │  │ Log         │         │      │
│                              │  └─────────────┘  └─────────────┘         │      │
│                              │                                            │      │
│                              │  ┌─────────────┐  ┌─────────────┐         │      │
│                              │  │ PMO Objects │  │ Artifacts   │         │      │
│                              │  │ (via Action)│  │ Store       │         │      │
│                              │  └─────────────┘  └─────────────┘         │      │
│                              │                                            │      │
│                              └────────────────────────────────────────────┘      │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📖 Data Read Operations

### 1. User Input Data

| Data Type | Source | Purpose | Sensitivity |
|-----------|--------|---------|-------------|
| Message content | User input | Primary query | Medium |
| Attachments | File upload | Context enhancement | High |
| Voice input | Microphone | STT conversion | Medium |
| Focus mode | UI selection | Response filtering | Low |

### 2. Workspace Context Data

| Data Type | Source | Purpose | Sensitivity |
|-----------|--------|---------|-------------|
| Current view | AppStore | Context awareness | Low |
| Entity ID | URL/Store | Specific item focus | Low |
| Entity name | PMO data | Display & context | Low |
| Entity data | PMO stores | Rich context | Medium |
| Project ID | PMO context | Project scope | Low |

### 3. PMO Data (Read-Only)

| Data Type | Source Table | Purpose | Access Control |
|-----------|--------------|---------|----------------|
| Projects | `projects` | Project context | Team member |
| Initiatives | `initiatives` | Initiative details | Team member |
| Tasks | `tasks` | Task information | Assignee/Team |
| Decisions | `decisions` | Decision history | Stakeholders |
| Assessments | `assessment_responses` | Maturity data | Org admin |
| Reports | `reports` | Historical reports | Team member |

### 4. Memory Data

| Data Type | Source Table | Purpose | Retention |
|-----------|--------------|---------|-----------|
| User preferences | `ai_user_memory` | Personalization | Indefinite |
| User expertise | `ai_user_memory` | Response calibration | Indefinite |
| Org context | `ai_org_memory` | Business terminology | Indefinite |
| Org procedures | `ai_org_memory` | Process awareness | Indefinite |

### 5. Knowledge Base Data

| Data Type | Source | Purpose | Updates |
|-----------|--------|---------|---------|
| ISO 21500 | Static files | Standard compliance | Manual |
| PMBOK 7 | Static files | Best practices | Manual |
| PRINCE2 | Static files | Governance | Manual |
| Custom KB | `knowledge_bases` | Org-specific | User upload |

---

## 📝 Data Write Operations

### 1. Always Written (Every Interaction)

```typescript
// Conversation record
interface ConversationWrite {
  id: string;
  user_id: string;
  organization_id: string;
  title: string;
  last_message_at: Date;
  message_count: number;
  // NO message content stored here
}

// Message record
interface MessageWrite {
  id: string;
  conversation_id: string;
  role: 'user' | 'ai';
  content: string;  // Encrypted at rest
  token_count: number;
  model_used: string;
  created_at: Date;
}
```

### 2. Conditionally Written

| Data Type | Condition | Table | TTL |
|-----------|-----------|-------|-----|
| AI Actions | Action detected | `ai_actions_log` | 90 days |
| Feedback | User provided | `ai_feedback` | 1 year |
| Artifacts | Generated | `ai_artifacts` | With conversation |
| Memory updates | Learning triggered | `ai_user_memory` | Indefinite |

### 3. PMO Writes (Requires Approval)

| Action Type | Target Table | Approval Required | Audit Log |
|-------------|--------------|-------------------|-----------|
| create_task | `tasks` | Yes | Yes |
| update_task | `tasks` | Yes (if status change) | Yes |
| create_initiative | `initiatives` | Yes | Yes |
| create_decision | `decisions` | Yes | Yes |
| update_assessment | `assessment_responses` | Yes (high risk) | Yes |

---

## 🔐 Privacy Considerations

### Data Classification

| Level | Data Types | Protection |
|-------|------------|------------|
| **Public** | PMO standards, Help content | None required |
| **Internal** | Project names, Initiative titles | Org boundary |
| **Confidential** | Message content, Assessments | Encryption + Access control |
| **Restricted** | Financial data, Personal info | Encryption + Audit + Approval |

### Access Control Matrix

| Role | Read Own | Read Team | Read Org | Write Memory | Execute Actions |
|------|----------|-----------|----------|--------------|-----------------|
| User | ✅ | ❌ | ❌ | ✅ Own | ✅ Low risk |
| Team Lead | ✅ | ✅ | ❌ | ✅ Own | ✅ Medium risk |
| Org Admin | ✅ | ✅ | ✅ | ✅ Org | ✅ All |
| SuperAdmin | ✅ | ✅ | ✅ | ✅ All | ✅ All |

### PII Handling

```typescript
// PII Detection in AI Pipeline
const PII_PATTERNS = {
  email: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
};

// PII is:
// 1. Never sent to external LLM providers
// 2. Masked in logs
// 3. Encrypted at rest
// 4. Subject to GDPR deletion requests
```

---

## 📊 Data Retention Policies

### Retention Schedule

| Data Type | Default Retention | Compliance Basis | Deletion Method |
|-----------|-------------------|------------------|-----------------|
| Conversations | 2 years | Business need | Soft delete → Hard delete |
| Messages | 2 years | With conversation | Cascade |
| AI Actions Log | 90 days | Audit trail | Auto-purge |
| Feedback | 1 year | Product improvement | Anonymize → Delete |
| User Memory | Until deletion | User consent | GDPR request |
| Org Memory | Until org deletion | Business need | Cascade |
| Artifacts | With conversation | Storage limit | Cascade |

### GDPR Compliance

```typescript
// User data export
async function exportUserData(userId: string): Promise<UserDataExport> {
  return {
    conversations: await getConversations(userId),
    messages: await getMessages(userId),
    memory: await getUserMemory(userId),
    feedback: await getFeedback(userId),
    actions: await getActionsLog(userId),
  };
}

// User data deletion (Right to be Forgotten)
async function deleteUserData(userId: string): Promise<void> {
  await deleteConversations(userId);
  await deleteMessages(userId);
  await deleteUserMemory(userId);
  await deleteFeedback(userId);
  await anonymizeActionsLog(userId);
}
```

---

## 🔄 Data Synchronization

### Real-time Updates

| Data Type | Sync Method | Latency | Conflict Resolution |
|-----------|-------------|---------|---------------------|
| Messages | WebSocket (SSE) | <100ms | Server wins |
| Actions status | Polling (30s) | <30s | Last write wins |
| Memory | On-demand | On next request | Merge |

### Offline Support

```typescript
// Offline queue for messages
interface OfflineMessage {
  localId: string;
  content: string;
  attachments: LocalFile[];
  queuedAt: Date;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

// Sync on reconnect
async function syncOfflineMessages(): Promise<void> {
  const pending = await getOfflineMessages();
  for (const msg of pending) {
    try {
      await sendMessage(msg);
      await markSynced(msg.localId);
    } catch (err) {
      await markFailed(msg.localId, err);
    }
  }
}
```

---

## 📈 Data Metrics & Monitoring

### Key Metrics Tracked

| Metric | Purpose | Retention | Dashboard |
|--------|---------|-----------|-----------|
| Messages/day | Usage | 1 year | Analytics |
| Token usage | Cost | 1 year | Billing |
| Response time | Performance | 30 days | Operations |
| Error rate | Reliability | 30 days | Operations |
| Action approval rate | UX | 90 days | Product |

### Audit Logging

```sql
-- ai_audit_log table
CREATE TABLE ai_audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action_type VARCHAR(50),  -- 'read', 'write', 'delete', 'export'
  resource_type VARCHAR(50), -- 'conversation', 'message', 'memory', 'action'
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT
);

-- Index for compliance queries
CREATE INDEX idx_audit_user ON ai_audit_log(user_id, timestamp);
CREATE INDEX idx_audit_org ON ai_audit_log(organization_id, timestamp);
```

---

## 🛡️ Security Measures

### Encryption

| Data State | Method | Key Management |
|------------|--------|----------------|
| In Transit | TLS 1.3 | Auto-renewed certs |
| At Rest | AES-256 | AWS KMS |
| In Memory | N/A (transient) | Process isolation |

### Access Logging

All data access is logged with:
- User ID
- Timestamp
- Resource accessed
- Action performed
- IP address
- Success/failure

### Rate Limiting

| Operation | Limit | Window | Action on Exceed |
|-----------|-------|--------|------------------|
| Messages | 60 | 1 min | Queue |
| Actions | 10 | 1 min | Reject |
| Memory updates | 30 | 1 min | Queue |
| Data export | 1 | 1 hour | Reject |

---

## 📋 Checklist: Data Flow Compliance

- [x] All data sources documented
- [x] All data destinations documented
- [x] Access control defined
- [x] PII handling specified
- [x] Retention policies set
- [x] GDPR compliance implemented
- [x] Audit logging enabled
- [x] Encryption configured
- [x] Rate limiting active

---

_Document Version: 1.0_  
_Last Updated: 2026-01-11_  
_Status: APPROVED_
