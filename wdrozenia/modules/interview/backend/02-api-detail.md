# Interview – API Detail

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `server/src/controllers/InterviewController.ts`

---

## 📋 Szczegółowe Kontrakty API

### 1. Create Session

```http
POST /api/interview/sessions
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Discovery Interview - Company X",
  "projectId": "uuid",           // opcjonalne
  "templateId": "uuid",          // opcjonalne - użyj szablonu
  "assignmentId": "uuid"         // opcjonalne - powiązanie z przydziałem
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "name": "Discovery Interview - Company X",
  "status": "active",
  "progress": 0,
  "createdAt": "2026-01-27T10:00:00Z",
  "userId": "uuid",
  "projectId": "uuid",
  "templateId": "uuid"
}
```

**Errors:**
- `400` - Brak wymaganych pól
- `401` - Brak autoryzacji
- `404` - Template/Project nie istnieje

---

### 2. Update Question (Answer)

```http
PATCH /api/interview/questions/:questionId
Authorization: Bearer {token}
Content-Type: application/json

{
  "answerText": "Firma ma problemy z...",
  "status": "answered",           // not_started | in_progress | answered | needs_follow_up
  "confidenceScore": 4,           // 1-5
  "tags": ["risk", "priority"]    // opcjonalne
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "questionText": "What are your main challenges?",
  "answerText": "Firma ma problemy z...",
  "status": "answered",
  "confidenceScore": 4,
  "tags": ["risk", "priority"],
  "category": "operations",
  "updatedAt": "2026-01-27T10:30:00Z"
}
```

**Status Values:**
| Status | Opis |
|--------|------|
| `not_started` | Pytanie bez odpowiedzi |
| `in_progress` | W trakcie odpowiadania |
| `answered` | Odpowiedziane |
| `needs_follow_up` | Wymaga follow-up |

---

### 3. Create Insight (AI Generation)

```http
POST /api/interview/insights
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionIds": ["uuid1", "uuid2"],  // sesje źródłowe
  "insightType": "risk_assessment",   // typ analizy
  "customPrompt": "Focus on digital transformation risks"  // opcjonalne
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "title": "Risk Assessment",
  "insightType": "risk_assessment",
  "status": "generating",
  "sessionIds": ["uuid1", "uuid2"],
  "createdAt": "2026-01-27T10:00:00Z",
  "createdBy": "uuid"
}
```

**Insight Types:**
| Type | Prompt Template |
|------|-----------------|
| `summary` | Executive summary of key findings |
| `trends` | Identify patterns and trends |
| `problems` | Discover problems and pain points |
| `recommendations` | Generate actionable recommendations |
| `comparison` | Compare across interviews |
| `gaps` | Identify gaps in capabilities |
| `risk_assessment` | Assess risks and threats |
| `opportunity_scan` | Identify opportunities |
| `maturity` | Assess maturity level (1-5) |
| `stakeholder_map` | Map stakeholders and influence |

---

### 4. Get Insight (with content)

```http
GET /api/interview/insights/:id
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "id": "uuid",
  "title": "Risk Assessment",
  "insightType": "risk_assessment",
  "status": "completed",
  "content": "## Risk Assessment\n\n### High Priority Risks\n1. ...",
  "sessionIds": ["uuid1", "uuid2"],
  "metadata": {
    "generationTime": 4500,
    "tokensUsed": 1250,
    "model": "gpt-4"
  },
  "createdAt": "2026-01-27T10:00:00Z",
  "completedAt": "2026-01-27T10:00:05Z"
}
```

**Status Values:**
| Status | Opis |
|--------|------|
| `generating` | AI generuje treść |
| `completed` | Gotowe |
| `failed` | Błąd generowania |

---

### 5. Create Assignment

```http
POST /api/interview/assignments
Authorization: Bearer {token}
Content-Type: application/json

{
  "assigneeUserId": "uuid",
  "templateId": "uuid",
  "projectId": "uuid",           // opcjonalne
  "dueAt": "2026-02-15T23:59:59Z",
  "priority": "high",            // low | medium | high
  "notes": "Please complete by Friday"
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "assigneeUserId": "uuid",
  "templateId": "uuid",
  "status": "pending",
  "dueAt": "2026-02-15T23:59:59Z",
  "priority": "high",
  "createdAt": "2026-01-27T10:00:00Z",
  "createdBy": "uuid"
}
```

**Assignment Status:**
| Status | Opis |
|--------|------|
| `pending` | Oczekuje na rozpoczęcie |
| `in_progress` | W trakcie |
| `submitted` | Wysłane do review |
| `approved` | Zatwierdzone |
| `sent_back` | Zwrócone do poprawy |

---

### 6. Create Template

```http
POST /api/interview/templates
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Digital Transformation Discovery",
  "description": "Standard template for DX assessment",
  "status": "draft",             // draft | published
  "questions": [
    {
      "category": "strategy",
      "questionText": "What are your strategic goals?",
      "answerType": "open",      // open | select | scale | boolean | number
      "required": true,
      "order": 1
    },
    {
      "category": "digital",
      "questionText": "Rate your digital maturity",
      "answerType": "scale",
      "scaleMin": 1,
      "scaleMax": 5,
      "required": true,
      "order": 2
    }
  ]
}
```

**Answer Types:**
| Type | Opis |
|------|------|
| `open` | Tekst otwarty |
| `select` | Wybór z listy |
| `scale` | Skala numeryczna |
| `boolean` | Tak/Nie |
| `number` | Wartość liczbowa |

---

### 7. Upload Evidence

```http
POST /api/interview/sessions/:sessionId/evidence
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary]
title: "Q3 Financial Report"
category: "finance"
questionId: "uuid"              // opcjonalne - powiązanie z pytaniem
```

**Response 201:**
```json
{
  "id": "uuid",
  "title": "Q3 Financial Report",
  "fileName": "q3-report.pdf",
  "fileSize": 1024000,
  "mimeType": "application/pdf",
  "category": "finance",
  "questionId": "uuid",
  "uploadedAt": "2026-01-27T10:00:00Z"
}
```

---

### 8. Generate Summary

```http
POST /api/interview/sessions/:sessionId/summary
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "sessionId": "uuid",
  "summary": {
    "strategy": {
      "completedQuestions": 5,
      "totalQuestions": 7,
      "avgConfidence": 4.2,
      "keyFindings": ["Finding 1", "Finding 2"]
    },
    "operations": { ... },
    "digital": { ... },
    "people": { ... },
    "finance": { ... }
  },
  "overallProgress": 85,
  "overallConfidence": 4.0,
  "generatedAt": "2026-01-27T10:00:00Z"
}
```

⚠️ **UWAGA:** Summary zawiera TYLKO FAKTY, bez rekomendacji!

---

### 9. Export Context

```http
POST /api/interview/sessions/:sessionId/export
Authorization: Bearer {token}
Content-Type: application/json

{
  "targetModule": "tools",       // tools | assessment
  "targetId": "uuid"             // opcjonalne - ID docelowego narzędzia/assessment
}
```

**Response 200:**
```json
{
  "exported": true,
  "targetModule": "tools",
  "targetId": "uuid",
  "contextData": {
    "organizationProfile": { ... },
    "keyFindings": [ ... ],
    "gaps": [ ... ]
  }
}
```

---

## 🔐 Error Responses

```json
// 400 Bad Request
{
  "error": "Validation failed",
  "details": {
    "field": "answerText",
    "message": "Answer text is required"
  }
}

// 401 Unauthorized
{
  "error": "Authentication required"
}

// 403 Forbidden
{
  "error": "Permission denied",
  "required": "INTERVIEW_ASSIGN_MANAGE"
}

// 404 Not Found
{
  "error": "Session not found",
  "id": "uuid"
}

// 500 Internal Server Error
{
  "error": "Internal server error",
  "requestId": "uuid"
}
```

---

## ✅ Weryfikacja

```bash
# Test create session
curl -X POST http://localhost:3000/api/interview/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Session"}'

# Test create insight
curl -X POST http://localhost:3000/api/interview/insights \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionIds": ["uuid"], "insightType": "summary"}'
```
