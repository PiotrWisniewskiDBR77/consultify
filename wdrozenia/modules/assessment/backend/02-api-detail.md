# Assessment – API Detail (Kontrakty Endpointów)

## Status: ✅ ZAIMPLEMENTOWANE

**Ostatnia aktualizacja:** 2026-02-08

---

## Assessment Workflow v2 – CRUD

### POST `/api/assessment-workflow-v2/`

**Opis:** Utworzenie nowego assessmentu

**Request:**
```json
{
  "name": "Assessment Q1 2026",
  "assessment_type": "DRD",
  "project_id": "optional-project-id"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Assessment Q1 2026",
  "assessment_type": "DRD",
  "status": "DRAFT",
  "organization_id": "org-uuid",
  "completion_percent": 0,
  "confidence_avg": 1,
  "created_at": "2026-02-08T10:00:00Z"
}
```

**Permissions:** `ASSESSMENT_CREATE`

---

### GET `/api/assessment-workflow-v2/:assessmentId`

**Opis:** Pobranie assessmentu z odpowiedziami

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Assessment Q1 2026",
  "assessment_type": "DRD",
  "status": "DRAFT",
  "organization_id": "org-uuid",
  "completion_percent": 45,
  "confidence_avg": 3,
  "answers": {
    "drd": {
      "areas": {
        "1A": { "achievedLevel": 3, "targetLevel": 5, "levelNotes": {} }
      }
    }
  },
  "navigation": { "axisId": 1, "areaId": "1A", "level": 3 },
  "created_at": "2026-02-08T10:00:00Z",
  "updated_at": "2026-02-08T12:00:00Z",
  "updated_by_name": "Jan Kowalski"
}
```

---

### PUT `/api/assessment-workflow-v2/:assessmentId`

**Opis:** Aktualizacja odpowiedzi i completion

**Request:**
```json
{
  "answers": { "drd": { "areas": { "1A": { "achievedLevel": 4 } } } },
  "completionPercent": 55,
  "confidenceAvg": 3,
  "navigation": { "axisId": 1, "areaId": "1B", "level": 1 }
}
```

**Response (200):**
```json
{ "updatedAt": "2026-02-08T12:30:00Z" }
```

---

### DELETE `/api/assessment-workflow-v2/:assessmentId`

**Permissions:** `ASSESSMENT_DELETE` lub globalAdmin

---

## Workflow Transitions

### POST `/:assessmentId/request-review`

**Warunki:** status=DRAFT, completion >= 100%, confidence >= 3

**Request:**
```json
{ "message": "Ready for review" }
```

**Efekt:** DRAFT → IN_REVIEW

---

### POST `/:assessmentId/report`

**Opis:** Generowanie raportu (assessment workflow report)

---

### POST `/:assessmentId/report/approve`

**Warunki:** status=IN_REVIEW

**Efekt:** IN_REVIEW → AWAITING_APPROVAL

---

### POST `/:assessmentId/approve`

**Warunki:** status=AWAITING_APPROVAL

**Efekt:** AWAITING_APPROVAL → APPROVED

---

### POST `/:assessmentId/send-back`

**Opis:** Odesłanie do poprawki

**Request:**
```json
{ "reason": "Brakuje uzasadnień w osi 3" }
```

**Efekt:** IN_REVIEW/AWAITING_APPROVAL → DRAFT

---

## Initiative Generation

### POST `/:assessmentId/generate-initiatives`

**Request:**
```json
{
  "methodologyId": "rice",
  "count": 5,
  "includeChatContext": true,
  "reportId": "optional"
}
```

**Response (200):**
```json
{
  "batchId": "uuid",
  "initiatives": [
    { "id": "uuid", "title": "...", "status": "DRAFT", "priority": "HIGH" }
  ],
  "generatedAt": "2026-02-08T13:00:00Z"
}
```

---

### POST `/:assessmentId/initiative-generation-runs`

**Enterprise generation (50+)**

**Request:**
```json
{
  "mode": "ASSESSMENT_REPORT",
  "methodologyId": "impact-feasibility",
  "requestedCount": 50,
  "batchSize": 7,
  "includeChatContext": true,
  "reportId": "optional",
  "templateId": "optional",
  "consultantBrief": "optional"
}
```

**Response (202):**
```json
{ "runId": "uuid" }
```

---

## Permissions & RBAC

### GET `/:assessmentId/my-role`

**Response:** `{ "role": "editor", "permissions": { ... } }`

### POST/PUT/DELETE `/:assessmentId/roles`

**CRUD dla ról assessmentu (admin, manager, editor, viewer)**

### POST `/:assessmentId/access-requests`

**Wniosek o dostęp**

---

## Middleware

Wszystkie endpointy:
1. `authRateLimiter`
2. `verifyToken` (JWT)
3. `demoContextMiddleware`

---

## Kody odpowiedzi

| Code | Opis |
|------|------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Validation Error |
| 500 | Internal Server Error |