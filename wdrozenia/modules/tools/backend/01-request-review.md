# Tools - Request Review API

## Cel
Kontrakt `request-review`: walidacje DoD, tworzenie decision record, audit log.

## Zrodla
- `server/src/controllers/ToolController.ts` (linie 654-721)
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`

---

## Endpoint

```
POST /api/tools/:toolId/request-review
```

## Request

```json
{
  "decisionOwnerId": "user-pmo-director-001",
  "dueDate": "2026-02-05",
  "priority": "high",
  "comment": "SWOT analysis complete - ready for strategic review"
}
```

### Parametry

| Parametr | Typ | Wymagany | Domyslna | Opis |
|----------|-----|----------|----------|------|
| `decisionOwnerId` | uuid | Nie | current user | Osoba odpowiedzialna za decyzje |
| `dueDate` | date | Nie | +7 dni | Termin podjecia decyzji |
| `priority` | enum | Nie | medium | low, medium, high, critical |
| `comment` | string | Nie | - | Komentarz do review |

## Response

**Success (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "REVIEW",
  "decisionId": "dec-2026-01-27-001",
  "reviewRequestedAt": "2026-01-27T14:30:00Z",
  "decisionOwner": {
    "id": "user-pmo-director-001",
    "name": "Anna Kowalska",
    "role": "PMO Director"
  },
  "dueDate": "2026-02-05",
  "priority": "high"
}
```

**Error (409 - DoD not satisfied):**
```json
{
  "error": "DoD not satisfied",
  "details": {
    "completion_percent": 85,
    "required_completion": 100,
    "confidence_avg": 2.5,
    "required_confidence": 3,
    "missing_criteria": [
      "completion_percent must be >= 100",
      "confidence_avg must be >= 3"
    ]
  }
}
```

**Error (409 - Wrong status):**
```json
{
  "error": "Tool session not in draft",
  "details": {
    "current_status": "REVIEW",
    "allowed_status": "DRAFT"
  }
}
```

**Error (403 - Permission denied):**
```json
{
  "error": "Permission denied",
  "details": {
    "required_permission": "TOOLS_REQUEST_REVIEW",
    "user_role": "USER",
    "allowed_roles": ["ADMIN", "PROJECT_MANAGER", "SUPERADMIN"]
  }
}
```

---

## Walidacje

### 1. Status
- Narzedzie musi byc w statusie `DRAFT`
- Jesli nie: `409 Tool session not in draft`

### 2. Definition of Done (DoD)
```typescript
const requireDoD = (session: ToolSessionRow): boolean => {
  return (session.completion_percent || 0) >= 100 
      && (session.confidence_avg || 0) >= 3;
};
```

| Kryterium | Wymagana wartosc | Opis |
|-----------|------------------|------|
| `completion_percent` | >= 100 | Wszystkie wymagane pola wypelnione |
| `confidence_avg` | >= 3 | Srednia pewnosc odpowiedzi (skala 1-5) |

### 3. Permission
- Wymaga: `TOOLS_REQUEST_REVIEW`
- Role: ADMIN, PROJECT_MANAGER, SUPERADMIN
- Jesli nie: `403 Permission denied`

### 4. Walidacja danych wejsciowych

| Pole | Walidacja | Blad |
|------|-----------|------|
| `decisionOwnerId` | UUID format, user exists | Invalid decision owner |
| `dueDate` | ISO date, future date | Due date must be in the future |
| `priority` | enum: low, medium, high, critical | Invalid priority value |
| `comment` | max 1000 chars | Comment too long |

---

## Efekty

### 1. Decision Record
Tworzy wpis w tabeli `decisions`:
```sql
INSERT INTO decisions (
  id, organization_id, project_id, title, type,
  decision_maker_id, deadline, status, created_by, priority, description
) VALUES (
  'dec-2026-01-27-001',
  'org-acme-corp',
  'proj-001',
  'Review request: SWOT Analysis - Manufacturing Division',
  'TOOL_REVIEW',
  'user-pmo-director-001',
  '2026-02-05',
  'pending',
  'user-123',
  'high',
  'SWOT analysis complete - ready for strategic review'
);
```

### 2. Tool Decision
Tworzy/aktualizuje wpis w `tool_decisions`:
```sql
INSERT INTO tool_decisions (
  id, tool_session_id, decision_type, status, decision_id, created_by, created_at
) VALUES (
  'td-001',
  '550e8400-e29b-41d4-a716-446655440001',
  'REQUEST_REVIEW',
  'PENDING',
  'dec-2026-01-27-001',
  'user-123',
  '2026-01-27T14:30:00Z'
);
```

### 3. Status Update
```sql
UPDATE tool_sessions 
SET status = 'REVIEW', 
    review_requested_at = '2026-01-27T14:30:00Z', 
    updated_at = '2026-01-27T14:30:00Z'
WHERE id = '550e8400-e29b-41d4-a716-446655440001';
```

### 4. Audit Log
```sql
INSERT INTO audit_log (
  id, organization_id, user_id, action, resource_type, resource_id, details, created_at
) VALUES (
  'audit-001',
  'org-acme-corp',
  'user-123',
  'tool_review_requested',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '{"decisionId": "dec-2026-01-27-001", "priority": "high", "dueDate": "2026-02-05"}',
  '2026-01-27T14:30:00Z'
);
```

### 5. Notyfikacje
```sql
INSERT INTO notifications (
  id, user_id, type, title, message, resource_type, resource_id, created_at
) VALUES (
  'notif-001',
  'user-pmo-director-001',
  'TOOL_REVIEW_REQUEST',
  'New tool review request',
  'SWOT Analysis - Manufacturing Division requires your review',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '2026-01-27T14:30:00Z'
);
```

---

## Flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [DRAFT] ─────────────────────────────────────────────────────────────────► │
│      │                                                                      │
│      │  User clicks "Request Review"                                        │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  VALIDATION LAYER                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ Check Status│  │ Check DoD   │  │ Check Perm  │  │ Validate   │ │   │
│  │  │ == DRAFT    │  │ >= 100%     │  │ REQUEST_REV │  │ Input Data │ │   │
│  │  │             │  │ conf >= 3   │  │             │  │            │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         │                │                │               │        │   │
│  │         ▼                ▼                ▼               ▼        │   │
│  │  ┌──────────────────────────────────────────────────────────────┐ │   │
│  │  │                    All validations pass?                      │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│              ┌───────────────┴───────────────┐                             │
│              │                               │                             │
│              ▼ YES                           ▼ NO                          │
│  ┌─────────────────────────┐    ┌─────────────────────────┐               │
│  │  EFFECT LAYER           │    │  RETURN ERROR           │               │
│  │  1. Create Decision     │    │  409 / 403 / 400        │               │
│  │  2. Create ToolDecision │    │                         │               │
│  │  3. Update Status       │    │                         │               │
│  │  4. Audit Log           │    │                         │               │
│  │  5. Send Notification   │    │                         │               │
│  └───────────┬─────────────┘    └─────────────────────────┘               │
│              │                                                             │
│              ▼                                                             │
│  [REVIEW] ◄────────────────────────────────────────────────────────────── │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementacja (kod)

```typescript
static requestReview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    const { toolId } = req.params;
    const { decisionOwnerId, dueDate, priority, comment } = req.body;
    
    // 1. Permission check
    const allowed = await ensurePermission(req, 'TOOLS_REQUEST_REVIEW');
    if (!allowed) {
      res.status(403).json({ 
        error: 'Permission denied',
        details: {
          required_permission: 'TOOLS_REQUEST_REVIEW',
          user_role: user.role,
          allowed_roles: ['ADMIN', 'PROJECT_MANAGER', 'SUPERADMIN']
        }
      });
      return;
    }

    // 2. Get session
    const session = await queryHelpers.queryOne(
      `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`,
      [toolId, user.organizationId]
    );

    if (!session) {
      res.status(404).json({ error: 'Tool session not found' });
      return;
    }

    // 3. Status check
    if (normalizeStatus(session.status) !== 'DRAFT') {
      res.status(409).json({ 
        error: 'Tool session not in draft',
        details: {
          current_status: session.status,
          allowed_status: 'DRAFT'
        }
      });
      return;
    }

    // 4. DoD check
    if (!requireDoD(session)) {
      res.status(409).json({ 
        error: 'DoD not satisfied',
        details: {
          completion_percent: session.completion_percent || 0,
          required_completion: 100,
          confidence_avg: session.confidence_avg || 0,
          required_confidence: 3,
          missing_criteria: getMissingCriteria(session)
        }
      });
      return;
    }

    // 5. Validate decision owner if provided
    if (decisionOwnerId) {
      const ownerExists = await queryHelpers.queryOne(
        `SELECT id FROM users WHERE id = ? AND organization_id = ?`,
        [decisionOwnerId, user.organizationId]
      );
      if (!ownerExists) {
        res.status(400).json({ error: 'Invalid decision owner' });
        return;
      }
    }

    const now = new Date().toISOString();
    const effectiveOwnerId = decisionOwnerId || user.id;
    const effectiveDueDate = dueDate || addDays(new Date(), 7).toISOString().split('T')[0];
    const effectivePriority = priority || 'medium';

    // 6. Create decision record
    const decisionId = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO decisions (
        id, organization_id, project_id, title, type,
        decision_maker_id, deadline, status, created_by, priority, description
      ) VALUES (?, ?, ?, ?, 'TOOL_REVIEW', ?, ?, 'pending', ?, ?, ?)`,
      [
        decisionId,
        user.organizationId,
        session.project_id,
        `Review request: ${session.name}`,
        effectiveOwnerId,
        effectiveDueDate,
        user.id,
        effectivePriority,
        comment || null
      ]
    );

    // 7. Create tool decision
    await queryHelpers.queryRun(
      `INSERT INTO tool_decisions (
        id, tool_session_id, decision_type, status, decision_id, created_by, created_at
      ) VALUES (?, ?, 'REQUEST_REVIEW', 'PENDING', ?, ?, ?)`,
      [uuidv4(), toolId, decisionId, user.id, now]
    );

    // 8. Update status
    await queryHelpers.queryRun(
      `UPDATE tool_sessions SET status = 'REVIEW', review_requested_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, toolId]
    );

    // 9. Audit log
    await logAudit(user.organizationId, user.id, 'tool_review_requested', 'tool_session', toolId, {
      decisionId,
      priority: effectivePriority,
      dueDate: effectiveDueDate,
      decisionOwnerId: effectiveOwnerId
    });

    // 10. Send notification
    await sendNotification({
      userId: effectiveOwnerId,
      type: 'TOOL_REVIEW_REQUEST',
      title: 'New tool review request',
      message: `${session.name} requires your review`,
      resourceType: 'tool_session',
      resourceId: toolId
    });

    res.json({ 
      id: toolId, 
      status: 'REVIEW',
      decisionId,
      reviewRequestedAt: now,
      decisionOwner: { id: effectiveOwnerId },
      dueDate: effectiveDueDate,
      priority: effectivePriority
    });
  }
);

// Helper function
function getMissingCriteria(session: ToolSessionRow): string[] {
  const criteria: string[] = [];
  if ((session.completion_percent || 0) < 100) {
    criteria.push('completion_percent must be >= 100');
  }
  if ((session.confidence_avg || 0) < 3) {
    criteria.push('confidence_avg must be >= 3');
  }
  return criteria;
}
```

---

## Przykladowe scenariusze

### Scenariusz 1: Sukces - pelne dane
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440001/request-review \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "decisionOwnerId": "user-pmo-001",
    "dueDate": "2026-02-05",
    "priority": "high",
    "comment": "Ready for review"
  }'

# Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "REVIEW",
  "decisionId": "dec-001"
}
```

### Scenariusz 2: Blad - DoD niespelnione
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440002/request-review \
  -H "Authorization: Bearer token"

# Response: 409 Conflict
{
  "error": "DoD not satisfied",
  "details": {
    "completion_percent": 75,
    "required_completion": 100,
    "confidence_avg": 2.5,
    "required_confidence": 3
  }
}
```

### Scenariusz 3: Blad - zly status
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440003/request-review \
  -H "Authorization: Bearer token"

# Response: 409 Conflict
{
  "error": "Tool session not in draft",
  "details": {
    "current_status": "APPROVED",
    "allowed_status": "DRAFT"
  }
}
```

### Scenariusz 4: Blad - brak uprawnien
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440004/request-review \
  -H "Authorization: Bearer user-token"

# Response: 403 Forbidden
{
  "error": "Permission denied",
  "details": {
    "required_permission": "TOOLS_REQUEST_REVIEW",
    "user_role": "USER"
  }
}
```

---

## Metryki i monitoring

| Metryka | Opis | Alert threshold |
|---------|------|-----------------|
| `tools.request_review.success` | Liczba udanych request review | - |
| `tools.request_review.dod_failed` | Liczba odrzucen przez DoD | > 50% |
| `tools.request_review.permission_denied` | Liczba odrzucen przez permissions | > 10/h |
| `tools.request_review.latency_ms` | Czas odpowiedzi | > 500ms |
