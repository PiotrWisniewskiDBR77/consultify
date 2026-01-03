# AI System Architecture

## Enterprise AI Readiness Documentation

Version: 2.0.0  
Last Updated: January 2026  
Status: **Production Ready**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Security Model](#security-model)
6. [Performance SLOs](#performance-slos)
7. [API Reference](#api-reference)
8. [Configuration](#configuration)
9. [Monitoring & Observability](#monitoring--observability)

---

## Overview

ConsultifyAI is an enterprise-grade AI assistant system designed for project management and consulting workflows. The system implements:

- **4-Layer Memory System**: Session, Project, Organization, and User preferences
- **Multi-Provider LLM Support**: OpenAI, Anthropic, Google, with automatic failover
- **Circuit Breaker Pattern**: Fault-tolerant provider switching
- **Human-in-the-Loop Actions**: AI proposes, users approve
- **Enterprise Security**: Multi-tenant isolation, audit trails, RBAC

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │ UnifiedChatPanel │  │ PendingActions   │  │ AIMemoryMetricsDashboard │   │
│  │ - Full/Split mode│  │ Indicator        │  │ - Token usage            │   │
│  │ - Streaming      │  │ - Quick approve  │  │ - Latency P95/P99        │   │
│  │ - Feedback       │  │ - Quick reject   │  │ - Cost tracking          │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
│           │                     │                          │                 │
│           └─────────────────────┼──────────────────────────┘                 │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         useAIStream Hook                              │   │
│  │                  - SSE streaming connection                           │   │
│  │                  - Reconnection logic                                 │   │
│  │                  - Partial response recovery                          │   │
│  └────────────────────────────────┬─────────────────────────────────────┘   │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (Node.js)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                           API GATEWAY                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │ Auth         │  │ Rate Limiter │  │ Request      │                  │ │
│  │  │ Middleware   │  │              │  │ Validator    │                  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         AI ORCHESTRATOR                                 │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ AIContextBuilder                                                  │  │ │
│  │  │ - 6-layer context assembly                                        │  │ │
│  │  │ - Workspace awareness                                             │  │ │
│  │  │ - Project/org memory injection                                    │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │ │
│  │  │ AIMemoryManager     │  │ AIActionExecutor                        │  │ │
│  │  │ - Session memory    │  │ - Action proposals                      │  │ │
│  │  │ - Project memory    │  │ - Approval workflow                     │  │ │
│  │  │ - Org memory        │  │ - HITL learning                         │  │ │
│  │  │ - Token management  │  │ - Regulatory mode                       │  │ │
│  │  │ - Auto trimming     │  │ - Notification integration              │  │ │
│  │  └─────────────────────┘  └─────────────────────────────────────────┘  │ │
│  └────────────────────────────────┬───────────────────────────────────────┘ │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          LLM SERVICE LAYER                              │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │ CircuitBreakerService (Consolidated)                              │  │ │
│  │  │ - Per-provider circuit states                                     │  │ │
│  │  │ - Auto-recovery                                                   │  │ │
│  │  │ - State persistence                                               │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │ │
│  │  │ OpenAI        │  │ Anthropic      │  │ Google (Gemini)        │   │ │
│  │  │ Provider      │  │ Provider       │  │ Provider               │   │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         METRICS & MONITORING                            │ │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌──────────────────┐   │ │
│  │  │ AIHealthService   │  │ AIMemoryMetrics   │  │ RAGMetrics       │   │ │
│  │  │ - P95/P99 latency │  │ Service           │  │ Service          │   │ │
│  │  │ - Provider health │  │ - Token tracking  │  │ - Precision      │   │ │
│  │  │ - Circuit status  │  │ - Cost savings    │  │ - Recall         │   │ │
│  │  └───────────────────┘  └───────────────────┘  └──────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (SQLite/PostgreSQL)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ ai_project_memory  │  │ ai_actions         │  │ ai_feedback        │    │
│  │ ai_org_memory      │  │ ai_partial_resp    │  │ ai_latency_metrics │    │
│  │ ai_user_prefs      │  │ approval_patterns  │  │ ai_memory_metrics  │    │
│  │ conversations      │  │ circuit_breaker    │  │ rag_quality_metrics│    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. AIOrchestrator (`server/services/aiOrchestrator.js`)

Main entry point for AI requests. Responsibilities:
- Token billing enforcement
- Context building
- Memory management
- Response streaming

### 2. AIMemoryManager (`server/services/aiMemoryManager.js`)

Manages the 4-layer memory system:

| Layer | Scope | Persistence | Use Case |
|-------|-------|-------------|----------|
| Session | User session | In-memory | Current conversation |
| Project | Project | Database | Project decisions, transitions |
| Organization | Organization | Database | Governance patterns, style |
| User Preferences | User | Database | Tone, education mode |

Key methods:
- `estimateTokens(text)` - Token counting
- `trimMemory(memory, maxTokens)` - Automatic trimming
- `getRelevantMemory(query, context)` - Relevance-based retrieval
- `cleanupOldMemory(projectId, maxAgeDays)` - Data retention

### 3. AIActionExecutor (`server/services/aiActionExecutor.js`)

Human-in-the-Loop action system:
- `requestAction()` - Propose action for approval
- `approveAction()` - Approve with HITL learning
- `rejectAction()` - Reject with pattern learning
- `getPendingActions()` - List awaiting approval

### 4. CircuitBreakerService (`server/services/circuitBreakerService.js`)

Consolidated fault tolerance:
- Per-provider circuit states (CLOSED, OPEN, HALF_OPEN)
- Exponential backoff retry
- State persistence across restarts
- Alerting integration

---

## Data Flow

### Chat Request Flow

```
1. User sends message
   └── UnifiedChatPanel.tsx
       └── useAIStream hook
           └── POST /api/ai/chat/stream
               └── AI Orchestrator
                   ├── Token billing check
                   ├── Context building (6 layers)
                   │   ├── System prompt
                   │   ├── Organization context
                   │   ├── Project context
                   │   ├── Memory context
                   │   ├── Pending actions
                   │   └── Workspace context
                   ├── LLM service (with circuit breaker)
                   └── Stream response via SSE
```

### Action Approval Flow

```
1. AI proposes action
   └── AIActionExecutor.requestAction()
       ├── Regulatory mode check
       ├── Role guard check
       ├── Policy check
       ├── HITL pattern check (auto-decide?)
       └── Create pending action
           └── NotificationService.create()

2. User reviews action
   └── PendingActionsIndicator / ActionProposalView
       └── Approve/Reject click
           └── PATCH /api/ai/actions/:id/approve
               └── AIActionExecutor.approveAction()
                   └── ApprovalPatternService.recordDecision()
```

---

## Security Model

### Multi-Tenant Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORGANIZATION BOUNDARY                         │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │ Organization A       │    │ Organization B       │            │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │            │
│  │ │ Project A1      │ │    │ │ Project B1      │ │            │
│  │ │ - Memory A1     │ │ ✕  │ │ - Memory B1     │ │            │
│  │ │ - Actions A1    │ │ NO │ │ - Actions B1    │ │            │
│  │ └─────────────────┘ │ ACCESS │ └─────────────────┘ │          │
│  │ ┌─────────────────┐ │    │ ┌─────────────────┐ │            │
│  │ │ Project A2      │ │    │ │ Project B2      │ │            │
│  │ └─────────────────┘ │    │ └─────────────────┘ │            │
│  └─────────────────────┘    └─────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Security Controls

1. **Authentication**: JWT token verification on all endpoints
2. **Authorization**: RBAC with project-level roles
3. **Data Isolation**: Organization ID filtering on all queries
4. **Prompt Injection Defense**: Input sanitization, jailbreak detection
5. **Audit Trail**: All AI operations logged with correlation ID

---

## Performance SLOs

| Metric | P95 Target | P99 Target | Measurement |
|--------|------------|------------|-------------|
| Chat Response | < 2000ms | < 5000ms | aiHealthService.getPercentileLatencies() |
| Memory Retrieval | < 100ms | < 200ms | ai_memory_metrics |
| Action Creation | < 500ms | < 1000ms | Direct DB |
| Health Check | < 100ms | < 200ms | /api/ai/health |

---

## API Reference

### Chat Endpoints

#### POST `/api/ai/chat`
Non-streaming chat request.

```json
{
  "message": "string",
  "history": [{"role": "user|ai", "content": "string"}],
  "context": {
    "screenContext": "string",
    "projectId": "string",
    "selectedObjectId": "string"
  }
}
```

#### POST `/api/ai/chat/stream`
SSE streaming chat request. Same payload as above.

Response: Server-Sent Events
```
data: {"text": "partial response..."}
data: {"text": " more text"}
data: [DONE]
```

### Memory Endpoints

#### GET `/api/ai/memory/metrics?period=7`
Get memory usage metrics for dashboard.

#### GET `/api/ai/memory/current?projectId=xxx`
Get current memory state for a project.

#### GET `/api/ai/memory/latency?hours=24`
Get latency percentiles.

### Action Endpoints

#### GET `/api/ai/actions/pending`
Get pending actions awaiting approval.

#### PATCH `/api/ai/actions/:id/approve`
Approve a pending action.

#### PATCH `/api/ai/actions/:id/reject`
Reject a pending action.

### Health Endpoints

#### GET `/api/ai/health`
Overall AI system health.

---

## Configuration

### Environment Variables

```bash
# LLM Providers
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=ant-xxx
GOOGLE_AI_KEY=xxx

# AI Configuration
AI_DEFAULT_MODEL=gpt-4o
AI_MAX_TOKENS=128000
AI_TEMPERATURE=0.7

# Circuit Breaker
CB_FAILURE_THRESHOLD=5
CB_RESET_TIMEOUT=60000

# Memory Management
MEMORY_MAX_TOKENS=50000
MEMORY_CLEANUP_DAYS=90
```

---

## Monitoring & Observability

### Dashboards

1. **AI Memory Dashboard** (`AIMemoryMetricsDashboard.tsx`)
   - Token usage trends
   - Memory efficiency
   - Latency percentiles
   - Cost savings

2. **AI Health Dashboard** (Admin Settings)
   - Provider status
   - Circuit breaker states
   - Error rates

### Cron Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Memory Cleanup | Weekly Sun 2AM | Clean old project memory |
| Feedback Consolidation | Daily 4AM | Learn from feedback |
| Metrics Aggregation | Daily 1AM | Aggregate hourly to daily |
| Partial Response Cleanup | Hourly | Remove stale streaming data |

### Alerts

- Circuit breaker opened
- P95 latency > 3s
- Error rate > 5%
- Token budget exceeded

---

## Changelog

### v2.0.0 (January 2026)
- Added token control and automatic trimming
- Consolidated circuit breaker implementation
- Added memory metrics dashboard
- Added RAG quality metrics
- Enhanced streaming resilience
- Added pending actions inline indicator
- Added multi-tenant security tests
- Added prompt injection tests
- Added k6 load testing suite
- Added E2E test coverage





