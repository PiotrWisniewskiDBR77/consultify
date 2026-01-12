# Consultify AI - API Reference

## Overview

Base URL: `/api/llm`

Authentication: Bearer Token (JWT) for protected endpoints

**Last Updated:** 30 December 2025

---

## Architecture Updates (v2.0)

The AI system has been consolidated into a unified pipeline with capability-based routing.

### Key Changes

- **Unified Pipeline:** All AI operations now go through `aiPipeline.js` with 48 registered capabilities
- **Enterprise Features:** Quality validation, PII detection, learning system integrated
- **Multi-Provider Fallback:** Automatic failover across 12 LLM providers
- **PMO Compliance:** All operations mapped to ISO 21500 / PMBOK 7 / PRINCE2 domains

### Capability Registry

| Category | Capabilities |
|----------|-------------|
| Diagnosis | `diagnose`, `deepDiagnose` |
| Generation | `generateList`, `generateTable`, `generateInitiatives`, `generateObservations`, `generateFirstValuePlan` |
| Tasks | `suggestTasks`, `generateTaskInsight`, `generateExecutionStrategy` |
| Initiatives | `validateInitiative`, `enrichInitiative`, `generateInsights`, `generateStrategicFit` |
| Roadmap | `buildRoadmap`, `validateRoadmap`, `explainRoadmap`, `optimizeRoadmap`, `reviewQuarter`, `rebalanceRoadmap` |
| Chat | `chat`, `chat_simple` |
| Reports | `generateReportSectionContent`, `parseReportEditIntent` |

See `docs/AI_ENTERPRISE_AUDIT_REPORT.md` for complete capability documentation.

---

## Public Endpoints (No Auth Required)

### Health Check

```http
GET /api/llm/health-check-ai
```

**Response:**
```json
{
  "status": "OK",
  "version": "FAILOVER-READY"
}
```

---

### Diagnose

Self-diagnostic endpoint for troubleshooting.

```http
GET /api/llm/diagnose
```

**Response:**
```json
{
  "version": "1.2.0-DIAGNOSTIC-V2",
  "timestamp": "2024-12-27T12:00:00.000Z",
  "checks": [
    { "name": "llm_providers_table", "status": "OK" },
    { "name": "providers_count", "value": 4 },
    { "name": "active_providers", "value": 4 },
    { "name": "api_connection", "status": "OK", "details": "Pong" }
  ],
  "repairs": [],
  "status": "OK"
}
```

---

### Redis Status

```http
GET /api/llm/redis-status
```

**Response:**
```json
{
  "redis": {
    "connected": true,
    "status": "healthy",
    "latency": 1
  },
  "fallback": "none",
  "timestamp": "2024-12-27T12:00:00.000Z"
}
```

---

### Observability Status

```http
GET /api/llm/observability-status
```

**Response:**
```json
{
  "observability": {
    "langfuse": {
      "enabled": true,
      "configured": true,
      "baseUrl": "https://cloud.langfuse.com"
    },
    "pricingModels": 15
  },
  "timestamp": "2024-12-27T12:00:00.000Z"
}
```

---

### Alerting Status

```http
GET /api/llm/alerting-status
```

**Response:**
```json
{
  "alerting": {
    "enabled": true,
    "channels": {
      "slack": true,
      "discord": false,
      "webhook": false
    },
    "throttledAlerts": 0
  },
  "timestamp": "2024-12-27T12:00:00.000Z"
}
```

---

### Metrics (Prometheus)

```http
GET /api/llm/metrics
GET /api/llm/metrics?format=json
```

**Response (Prometheus format):**
```
# HELP ai_requests_total Total AI requests
# TYPE ai_requests_total counter
ai_requests_total{capability="chat",model="gpt-4o",status="success"} 150
```

---

## Protected Endpoints (Auth Required)

### V2 Chat (Main Pipeline)

```http
POST /api/llm/v2/chat
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "prompt": "What is the DRD methodology?",
  "messages": [
    { "role": "user", "content": "Previous message" }
  ],
  "capability": "chat",
  "screenContext": {
    "_meta": { "title": "Assessment View" },
    "currentAxis": "processes",
    "currentScore": 3
  },
  "options": {
    "stream": false,
    "maxTokens": 1000
  }
}
```

**Response:**
```json
{
  "content": "The DRD (Digital Readiness Diagnostic) methodology...",
  "metadata": {
    "model": "gpt-4o",
    "tokensUsed": 245,
    "cost": 0.00245,
    "latency": 1234
  },
  "toolCalls": []
}
```

---

### Magic Wand

```http
POST /api/llm/magic-wand
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "fieldType": "justification",
  "axisId": "processes",
  "score": 3,
  "existingText": "Partial text...",
  "action": "suggest"
}
```

**Actions:**
- `suggest` - Generate new content
- `complete` - Complete partial text
- `correct` - Fix grammar and style
- `evidence` - Suggest evidence documents
- `target` - Suggest target level

**Response:**
```json
{
  "suggestion": "Generated content...",
  "mode": "AI_GENERATED",
  "confidence": 0.85
}
```

---

### Generate Report Section

```http
POST /api/llm/generate-report-section
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "reportId": "uuid",
  "sectionType": "executive_summary",
  "axisId": "processes",
  "language": "pl"
}
```

**Response:**
```json
{
  "content": "Generated section content...",
  "metadata": {
    "tokensUsed": 500,
    "model": "gpt-4o"
  }
}
```

---

### Search Knowledge Base (RAG)

```http
POST /api/llm/search
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "How to assess data management maturity?",
  "limit": 5,
  "minSimilarity": 0.7
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "Data management maturity is assessed...",
      "source": "DRD Methodology v2",
      "similarity": 0.89
    }
  ]
}
```

---

## Admin Endpoints (Super Admin Only)

### Get System Prompts

```http
GET /api/llm/prompts
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "key": "system_chat",
    "description": "Main AI Chat System Prompt",
    "content": "You are a senior consultant...",
    "is_active": true,
    "version": 1
  }
]
```

---

### Update System Prompt

```http
PUT /api/llm/prompts/:key
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Updated prompt content...",
  "description": "Updated description"
}
```

---

### Circuit Breaker Status

```http
GET /api/llm/circuits
Authorization: Bearer <token>
```

**Response:**
```json
{
  "circuits": {
    "openai": { "state": "CLOSED", "failureCount": 0 },
    "anthropic": { "state": "CLOSED", "failureCount": 0 }
  },
  "overall": "CLOSED"
}
```

---

### Reset Circuit Breaker

```http
POST /api/llm/circuits/:provider/reset
Authorization: Bearer <token>
```

---

### Rate Limit Status

```http
GET /api/llm/rate-limits
Authorization: Bearer <token>
```

---

### Usage Statistics

```http
GET /api/llm/control/usage
Authorization: Bearer <token>
```

---

### Audit Logs

```http
GET /api/llm/audit/stats
Authorization: Bearer <token>
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 401 | Unauthorized - Token missing or invalid |
| 403 | Forbidden - Insufficient permissions |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (circuit breaker open) |

---

## Streaming Responses

For real-time streaming, use the `stream: true` option:

```javascript
const response = await fetch('/api/llm/v2/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    prompt: 'Hello',
    options: { stream: true }
  })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = new TextDecoder().decode(value);
  // Process chunk
}
```

---

## Rate Limits

| Capability | Limit (per minute) |
|------------|-------------------|
| chat | 60 |
| magic_wand | 30 |
| generation | 10 |

---

## AI Security Endpoints

### Audit Logs

```http
GET /api/ai-security/audit-logs
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `riskLevel` - Filter by HIGH, MEDIUM, LOW
- `flagged` - Show only flagged entries (true/false)
- `startDate` - Filter start date (ISO format)
- `endDate` - Filter end date (ISO format)
- `userId` - Filter by user ID
- `action` - Filter by action type

**Response:**
```json
{
  "success": true,
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2024-12-30T12:00:00Z",
      "user_id": "user-uuid",
      "action": "ai_request",
      "risk_level": "LOW",
      "flagged": false,
      "model_used": "gpt-4o",
      "tokens_used": 1250,
      "cost_usd": 0.0025
    }
  ],
  "total": 100
}
```

---

### Security Summary

```http
GET /api/ai-security/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total_requests": 15000,
  "flagged_requests": 12,
  "high_risk": 5,
  "medium_risk": 45,
  "low_risk": 14950,
  "period": "last_30_days"
}
```

---

### Export Audit Logs

```http
GET /api/ai-security/audit-logs/export
Authorization: Bearer <token>
```

**Query Parameters:**
- `format` - Export format (csv, json)
- Additional filters same as audit-logs endpoint

**Response:** Binary file download

---

## Prompt Management Endpoints

### List Prompts

```http
GET /api/ai-prompts
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": "uuid",
      "name": "Chat Assistant",
      "category": "chat",
      "description": "Main chat prompt",
      "system_prompt": "You are...",
      "version": 3,
      "is_active": true
    }
  ]
}
```

---

### Get Prompt Versions

```http
GET /api/ai-prompts/:id/versions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "versions": [
    {
      "version": 3,
      "changed_at": "2024-12-30T10:00:00Z",
      "changed_by": "user-uuid",
      "change_reason": "Updated tone"
    }
  ]
}
```

---

### Update Prompt

```http
PUT /api/ai-prompts/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated name",
  "system_prompt": "Updated prompt content...",
  "is_active": true
}
```

---

### Test Prompt

```http
POST /api/ai-prompts/:id/test
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "variables": {
    "user_name": "Test User"
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": "Generated test response..."
}
```

---

## Pipeline Capabilities API

### Process Request (Internal)

The unified pipeline is used internally by all AI endpoints. Direct usage:

```javascript
const { aiPipeline } = require('./services/ai/aiPipeline');

const result = await aiPipeline.process({
  capability: 'suggestTasks',
  prompt: 'Generate tasks for digital transformation',
  userId: 'user-uuid',
  organizationId: 'org-uuid',
  projectId: 'proj-uuid',
  stream: false
});
```

### Available Capabilities

| Capability | Role | Max Tokens |
|------------|------|------------|
| `diagnose` | ANALYST | 2000 |
| `generateInitiatives` | CONSULTANT | 4000 |
| `suggestTasks` | IMPLEMENTER | 2000 |
| `validateInitiative` | GATEKEEPER | 1500 |
| `buildRoadmap` | STRATEGIST | 3000 |
| `simulateEconomics` | FINANCE | 2500 |
| `chat` | CONSULTANT | 2000 |

---

*Last updated: 30 December 2025*

