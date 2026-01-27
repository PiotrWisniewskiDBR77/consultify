# Tools - API List

## Cel
Lista endpointow Tools z kontraktami (referencja do implementacji).

## Zrodla
- Kod: `server/src/routes/tools.routes.ts`
- Controller: `server/src/controllers/ToolController.ts`
- Validators: `server/src/validators/tool.validators.ts`

---

## Endpointy

### 1. POST /api/tools
Utworzenie nowej sesji narzedzia.

**Request:**
```json
{
  "toolType": "dynamic-swot",
  "name": "SWOT Analysis - Q1 2026",
  "projectId": "uuid"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "DRAFT",
  "toolType": "dynamic-swot",
  "name": "SWOT Analysis - Q1 2026",
  "createdAt": "2026-01-27T10:00:00Z"
}
```

**Walidacja:**
- `toolType` - required, string, enum: dynamic-swot, market-forces, growth-paths, portfolio-priority, risk-uncertainty
- `name` - required, string, min 3 chars, max 200 chars
- `projectId` - optional, uuid format

---

### 2. GET /api/tools
Lista sesji narzedzi dla organizacji.

**Query params:**
| Parametr | Typ | Domyslna | Opis |
|----------|-----|----------|------|
| `projectId` | uuid | - | Filtr po projekcie |
| `status` | string | - | DRAFT, REVIEW, APPROVED, COMPLETED |
| `toolType` | string | - | dynamic-swot, market-forces, etc. |
| `category` | string | - | strategic, operational, digital, automation |
| `limit` | number | 50 | Max 100 |
| `offset` | number | 0 | Paginacja |
| `sortBy` | string | updatedAt | name, createdAt, updatedAt, progress |
| `sortOrder` | string | desc | asc, desc |
| `search` | string | - | Wyszukiwanie po nazwie |
| `createdBy` | uuid | - | Filtr po autorze |

**Response:**
```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "SWOT Analysis - Manufacturing Division",
      "toolType": "dynamic-swot",
      "status": "APPROVED",
      "progress": 100,
      "confidenceAvg": 4.2,
      "projectId": "proj-001",
      "createdBy": "user-123",
      "createdAt": "2026-01-15T08:30:00Z",
      "updatedAt": "2026-01-25T14:20:00Z",
      "reviewRequestedAt": "2026-01-20T10:00:00Z",
      "approvedAt": "2026-01-22T16:45:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Porter Analysis - European Market",
      "toolType": "market-forces",
      "status": "REVIEW",
      "progress": 100,
      "confidenceAvg": 3.8,
      "projectId": "proj-002",
      "createdBy": "user-456",
      "createdAt": "2026-01-18T09:15:00Z",
      "updatedAt": "2026-01-26T11:30:00Z",
      "reviewRequestedAt": "2026-01-26T11:30:00Z",
      "approvedAt": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Growth Strategy - APAC Expansion",
      "toolType": "growth-paths",
      "status": "DRAFT",
      "progress": 65,
      "confidenceAvg": 3.2,
      "projectId": "proj-003",
      "createdBy": "user-789",
      "createdAt": "2026-01-22T13:00:00Z",
      "updatedAt": "2026-01-27T09:45:00Z",
      "reviewRequestedAt": null,
      "approvedAt": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "BCG Matrix - Product Portfolio Q1",
      "toolType": "portfolio-priority",
      "status": "DRAFT",
      "progress": 40,
      "confidenceAvg": 2.5,
      "projectId": "proj-001",
      "createdBy": "user-123",
      "createdAt": "2026-01-24T07:30:00Z",
      "updatedAt": "2026-01-26T16:00:00Z",
      "reviewRequestedAt": null,
      "approvedAt": null
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "Risk Assessment - Digital Transformation",
      "toolType": "risk-uncertainty",
      "status": "COMPLETED",
      "progress": 100,
      "confidenceAvg": 4.5,
      "projectId": "proj-004",
      "createdBy": "user-456",
      "createdAt": "2026-01-10T10:00:00Z",
      "updatedAt": "2026-01-20T12:00:00Z",
      "reviewRequestedAt": "2026-01-15T09:00:00Z",
      "approvedAt": "2026-01-18T14:30:00Z"
    }
  ],
  "total": 47,
  "limit": 50,
  "offset": 0
}
```

---

### 3. GET /api/tools/:toolId
Pobranie szczegolów sesji narzedzia.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "organization_id": "org-acme-corp",
  "project_id": "proj-001",
  "tool_type": "dynamic-swot",
  "name": "SWOT Analysis - Manufacturing Division",
  "status": "REVIEW",
  "completion_percent": 100,
  "confidence_avg": 4.2,
  "answers": {
    "context": {
      "goal": "Identify strategic opportunities for manufacturing optimization",
      "scope": "European manufacturing facilities",
      "timeframe": "Q1-Q2 2026"
    },
    "items": [
      { "id": "s1", "quadrant": "strengths", "text": "Strong brand recognition", "impact": 4 },
      { "id": "s2", "quadrant": "strengths", "text": "Experienced workforce", "impact": 5 },
      { "id": "s3", "quadrant": "strengths", "text": "Modern equipment", "impact": 4 },
      { "id": "w1", "quadrant": "weaknesses", "text": "High production costs", "impact": 4 },
      { "id": "w2", "quadrant": "weaknesses", "text": "Limited automation", "impact": 3 },
      { "id": "o1", "quadrant": "opportunities", "text": "Market expansion in Asia", "impact": 5 },
      { "id": "o2", "quadrant": "opportunities", "text": "Green technology adoption", "impact": 4 },
      { "id": "t1", "quadrant": "threats", "text": "Rising material costs", "impact": 4 },
      { "id": "t2", "quadrant": "threats", "text": "New competitors", "impact": 3 }
    ],
    "correlations": [
      { "from": "s1", "to": "o1", "type": "leverage", "strength": 4 },
      { "from": "w2", "to": "o2", "type": "address", "strength": 5 },
      { "from": "s2", "to": "t2", "type": "defend", "strength": 3 }
    ]
  },
  "contextSnapshot": {
    "org": {
      "name": "Acme Corporation",
      "industry": "Manufacturing",
      "size": "Enterprise (5000+ employees)"
    },
    "chat": [
      { "role": "user", "content": "What are our main competitive advantages?" },
      { "role": "assistant", "content": "Based on the analysis, your main advantages are..." }
    ],
    "initiatives": [
      { "id": "init-001", "title": "Automation Upgrade Program", "status": "IN_PROGRESS" },
      { "id": "init-002", "title": "Cost Reduction Initiative", "status": "DRAFT" }
    ]
  },
  "generatedInitiatives": [
    { "id": "gen-001", "title": "Implement lean manufacturing practices", "status": "DRAFT" },
    { "id": "gen-002", "title": "Expand to Asian markets", "status": "DRAFT" },
    { "id": "gen-003", "title": "Green technology investment program", "status": "DRAFT" }
  ],
  "decisions": [
    { "decision_type": "REQUEST_REVIEW", "status": "APPROVED", "decision_id": "dec-001", "created_at": "2026-01-20T10:00:00Z" },
    { "decision_type": "APPROVE_TOOL", "status": "PENDING", "decision_id": "dec-002", "created_at": "2026-01-22T09:00:00Z" }
  ],
  "permissions": {
    "canRequestReview": false,
    "canApproveTool": true,
    "canGenerate": true,
    "canEdit": false,
    "canDelete": false
  },
  "created_by": "user-123",
  "created_at": "2026-01-15T08:30:00Z",
  "updated_at": "2026-01-25T14:20:00Z",
  "review_requested_at": "2026-01-20T10:00:00Z",
  "approved_at": null
}
```

---

### 4. PUT /api/tools/:toolId
Aktualizacja sesji narzedzia (auto-save).

**Request:**
```json
{
  "answers": {
    "context": {
      "goal": "Updated strategic goal",
      "scope": "Global operations",
      "timeframe": "2026 Full Year"
    },
    "items": [
      { "id": "s1", "quadrant": "strengths", "text": "Strong brand recognition", "impact": 4 },
      { "id": "s2", "quadrant": "strengths", "text": "Experienced workforce", "impact": 5 }
    ],
    "correlations": []
  },
  "completionPercent": 85,
  "confidenceAvg": 3.8,
  "contextSnapshot": {
    "org": {
      "name": "Acme Corporation",
      "industry": "Manufacturing"
    },
    "chat": [
      { "role": "user", "content": "Help me identify weaknesses" },
      { "role": "assistant", "content": "Based on your data..." }
    ],
    "initiatives": []
  }
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "updatedAt": "2026-01-27T12:30:00Z",
  "completionPercent": 85,
  "confidenceAvg": 3.8
}
```

---

### 5. POST /api/tools/:toolId/request-review
Wyslanie narzedzia do review.

**Request:**
```json
{
  "decisionOwnerId": "user-manager-001",
  "dueDate": "2026-02-01",
  "priority": "high",
  "comment": "Ready for PMO review - all quadrants complete"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "REVIEW",
  "decisionId": "dec-003",
  "reviewRequestedAt": "2026-01-27T14:00:00Z"
}
```

**Walidacja:**
| Warunek | Blad | Kod |
|---------|------|-----|
| Status != DRAFT | Tool session not in draft | 409 |
| completion_percent < 100 | DoD not satisfied | 409 |
| confidence_avg < 3 | DoD not satisfied | 409 |
| Brak permission | Permission denied | 403 |

**Efekty:**
- Tworzy decision record w tabeli `decisions`
- Tworzy wpis w `tool_decisions`
- Loguje do `audit_log` jako `tool_review_requested`
- Wysyla notyfikacje do decision owner

---

### 6. POST /api/tools/:toolId/approve
Zatwierdzenie narzedzia.

**Request:**
```json
{
  "decisionOwnerId": "user-director-001",
  "dueDate": "2026-02-05",
  "priority": "medium",
  "comment": "Approved - excellent analysis quality"
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "APPROVED",
  "decisionId": "dec-004",
  "approvedAt": "2026-01-27T16:00:00Z"
}
```

**Walidacja:**
| Warunek | Blad | Kod |
|---------|------|-----|
| Status != REVIEW | Tool session not in review | 409 |
| completion_percent < 100 | DoD not satisfied | 409 |
| confidence_avg < 3 | DoD not satisfied | 409 |
| Brak permission TOOLS_APPROVE | Permission denied | 403 |

**Efekty:**
- Tworzy decision record z status=approved
- Aktualizuje `tool_decisions`
- Loguje do `audit_log` jako `tool_approved`
- Odblokowuje generowanie inicjatyw

---

### 7. POST /api/tools/:toolId/send-back
Odeslanie narzedzia do draft.

**Request:**
```json
{
  "comment": "Brakuje analizy konkurencji w sekcji Threats. Prosze uzupelnic przed ponownym wyslaniem."
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "DRAFT",
  "decisionId": "dec-005",
  "sentBackAt": "2026-01-27T17:00:00Z"
}
```

**Walidacja:**
| Warunek | Blad | Kod |
|---------|------|-----|
| Status != REVIEW | Tool session not in review | 409 |
| comment.length < 1 | Comment is required | 400 |
| Brak permission TOOLS_APPROVE | Permission denied | 403 |

**Efekty:**
- Tworzy decision record z status=rejected
- Resetuje `approved_at` i `review_requested_at`
- Loguje do `audit_log` jako `tool_sent_back`
- Wysyla notyfikacje do autora

---

### 8. POST /api/tools/:toolId/generate-initiatives
Generowanie inicjatyw z narzedzia.

**Request:**
```json
{
  "methodologyId": "impact-feasibility",
  "count": 5,
  "includeChatContext": true,
  "decisionOwnerId": "user-pmo-001",
  "dueDate": "2026-02-10",
  "priority": "high"
}
```

**Response:**
```json
{
  "batchId": "batch-001-2026-01-27",
  "initiatives": [
    {
      "id": "init-gen-001",
      "title": "Implement lean manufacturing practices across EU facilities",
      "description": "Deploy lean methodology to reduce waste and improve efficiency by 25%",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "$2.5M annual savings"
    },
    {
      "id": "init-gen-002",
      "title": "Establish strategic partnership with Asian distributors",
      "description": "Enter APAC market through distribution partnerships in Japan and South Korea",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "$5M revenue potential"
    },
    {
      "id": "init-gen-003",
      "title": "Green technology investment program",
      "description": "Invest in sustainable manufacturing technologies to reduce carbon footprint",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P2",
      "risk": "Low",
      "estimatedValue": "$1M cost reduction + ESG compliance"
    },
    {
      "id": "init-gen-004",
      "title": "Workforce upskilling initiative",
      "description": "Train 500 employees on Industry 4.0 technologies",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P2",
      "risk": "Low",
      "estimatedValue": "15% productivity increase"
    },
    {
      "id": "init-gen-005",
      "title": "Supply chain diversification project",
      "description": "Reduce dependency on single suppliers by establishing alternative sources",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "Risk mitigation + 10% cost optimization"
    }
  ],
  "generatedAt": "2026-01-27T18:00:00Z",
  "aiModel": "gpt-4-turbo",
  "processingTime": "4.2s"
}
```

**Walidacja:**
| Warunek | Blad | Kod |
|---------|------|-----|
| Status != APPROVED | Tool session not approved | 409 |
| count > 7 | Initiative count exceeds limit 7 | 400 |
| count < 1 | Initiative count must be at least 1 | 400 |
| Brak methodologyId | methodologyId is required | 400 |
| answers_json puste | Missing tool context for generation | 409 |
| Brak permission | Permission denied | 403 |

**Metodologie:**
| ID | Nazwa | Category | Priority | Risk | Use Case |
|----|-------|----------|----------|------|----------|
| `impact-feasibility` | Impact x Feasibility | Strategy | P1 | Medium | Strategic planning, high-impact decisions |
| `value-effort` | Value x Effort | Operations | P2 | Low | Operational improvements, quick wins |
| `risk-compliance` | Risk/Compliance | Process Auto | P1 | High | Regulatory, compliance, risk mitigation |
| `customer-market` | Customer/Market | Digital | P2 | Medium | Customer experience, market expansion |
| `operational-efficiency` | Operational Efficiency | Operations | P2 | Low | Cost reduction, process optimization |

**Efekty:**
- Tworzy batch w `tool_initiative_batches`
- Generuje inicjatywy przez AI (z retry i fallback)
- Zapisuje inicjatywy w `initiatives` z `source_type='tool'`
- Tworzy linki w `tool_initiative_links`
- Loguje do `audit_log` jako `initiatives_generated`

---

### 9. GET /api/tools/:toolId/generated-initiatives
Lista inicjatyw wygenerowanych z narzedzia.

**Response:**
```json
{
  "initiatives": [
    {
      "id": "init-gen-001",
      "title": "Implement lean manufacturing practices across EU facilities",
      "status": "DRAFT",
      "batch_id": "batch-001-2026-01-27",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "created_at": "2026-01-27T18:00:00Z"
    },
    {
      "id": "init-gen-002",
      "title": "Establish strategic partnership with Asian distributors",
      "status": "IN_PROGRESS",
      "batch_id": "batch-001-2026-01-27",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "created_at": "2026-01-27T18:00:00Z"
    },
    {
      "id": "init-gen-003",
      "title": "Green technology investment program",
      "status": "DRAFT",
      "batch_id": "batch-001-2026-01-27",
      "category": "Strategy",
      "priority": "P2",
      "risk": "Low",
      "created_at": "2026-01-27T18:00:00Z"
    }
  ],
  "batches": [
    {
      "id": "batch-001-2026-01-27",
      "methodology_id": "impact-feasibility",
      "initiatives_count": 5,
      "include_chat_context": true,
      "generated_by": "user-123",
      "created_at": "2026-01-27T18:00:00Z"
    }
  ],
  "total": 5
}
```

---

## Kody bledow

| Kod | Nazwa | Opis | Przyklad |
|-----|-------|------|----------|
| 400 | Bad Request | Blad walidacji danych wejsciowych | Invalid toolType, count > 7 |
| 401 | Unauthorized | Brak lub nieprawidlowy token | Token expired |
| 403 | Forbidden | Brak uprawnien do akcji | User lacks TOOLS_APPROVE |
| 404 | Not Found | Zasob nie istnieje | Tool session not found |
| 409 | Conflict | Konflikt stanu | Wrong status, DoD not satisfied |
| 422 | Unprocessable Entity | Dane poprawne ale nie mozna przetworzyc | AI generation failed |
| 429 | Too Many Requests | Rate limit exceeded | Max 10 generations per hour |
| 500 | Internal Server Error | Blad serwera | Database connection failed |
| 503 | Service Unavailable | Usluga niedostepna | AI service timeout |

---

## Permissions

| Permission | Role | Opis | Akcje |
|------------|------|------|-------|
| `TOOLS_VIEW` | USER, ADMIN, PROJECT_MANAGER, SUPERADMIN | Podglad narzedzi | GET /api/tools, GET /api/tools/:id |
| `TOOLS_CREATE` | ADMIN, PROJECT_MANAGER, SUPERADMIN | Tworzenie sesji | POST /api/tools |
| `TOOLS_EDIT` | ADMIN, PROJECT_MANAGER, SUPERADMIN | Edycja sesji | PUT /api/tools/:id |
| `TOOLS_REQUEST_REVIEW` | ADMIN, PROJECT_MANAGER, SUPERADMIN | Wysylanie do review | POST /api/tools/:id/request-review |
| `TOOLS_APPROVE` | ADMIN, SUPERADMIN | Zatwierdzanie / odrzucanie | POST /api/tools/:id/approve, send-back |
| `TOOLS_GENERATE_INITIATIVES` | ADMIN, PROJECT_MANAGER, SUPERADMIN | Generowanie inicjatyw | POST /api/tools/:id/generate-initiatives |
| `TOOLS_DELETE` | SUPERADMIN | Usuwanie sesji | DELETE /api/tools/:id |

---

## Rate Limits

| Endpoint | Limit | Okres | Opis |
|----------|-------|-------|------|
| POST /api/tools | 20 | 1h | Tworzenie sesji |
| PUT /api/tools/:id | 100 | 1h | Auto-save (debounced) |
| POST /generate-initiatives | 10 | 1h | Generowanie AI (kosztowne) |
| GET /api/tools | 200 | 1h | Lista sesji |

---

## Przykladowe scenariusze

### Scenariusz 1: Pelny flow SWOT
```
1. POST /api/tools { toolType: "dynamic-swot", name: "Q1 Analysis" }
2. PUT /api/tools/:id { answers: {...}, completionPercent: 100 }
3. POST /api/tools/:id/request-review { priority: "high" }
4. POST /api/tools/:id/approve {}
5. POST /api/tools/:id/generate-initiatives { count: 5, methodologyId: "impact-feasibility" }
```

### Scenariusz 2: Odrzucenie i poprawa
```
1. POST /api/tools/:id/request-review {}
2. POST /api/tools/:id/send-back { comment: "Brakuje analizy" }
3. PUT /api/tools/:id { answers: {...updated...} }
4. POST /api/tools/:id/request-review {}
5. POST /api/tools/:id/approve {}
```
