# Tools - Approve API

## Cel
Kontrakt `approve`: walidacje roli/permission, DoD, audit log, aktualizacja statusu.

## Zrodlo
- `server/src/controllers/ToolController.ts` (linie 724-792)
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`

---

## Endpoint

```
POST /api/tools/:toolId/approve
```

## Request

```json
{
  "decisionOwnerId": "user-cto-001",
  "dueDate": "2026-02-10",
  "priority": "high",
  "comment": "Excellent analysis - approved for initiative generation"
}
```

### Parametry

| Parametr | Typ | Wymagany | Domyslna | Opis |
|----------|-----|----------|----------|------|
| `decisionOwnerId` | uuid | Nie | current user | Osoba zatwierdzajaca |
| `dueDate` | date | Nie | +7 dni | Termin na generowanie inicjatyw |
| `priority` | enum | Nie | medium | low, medium, high, critical |
| `comment` | string | Nie | - | Komentarz do zatwierdzenia |

## Response

**Success (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "APPROVED",
  "decisionId": "dec-approve-2026-01-27-001",
  "approvedAt": "2026-01-27T16:45:00Z",
  "approvedBy": {
    "id": "user-cto-001",
    "name": "Jan Nowak",
    "role": "CTO"
  },
  "canGenerateInitiatives": true,
  "nextSteps": [
    "Configure initiative generation parameters",
    "Select methodology (Impact x Feasibility recommended)",
    "Choose number of initiatives (3-7)"
  ]
}
```

**Error (409 - Wrong status):**
```json
{
  "error": "Tool session not in review",
  "details": {
    "current_status": "DRAFT",
    "allowed_status": "REVIEW",
    "suggestion": "First request review before approving"
  }
}
```

**Error (409 - DoD not satisfied):**
```json
{
  "error": "DoD not satisfied",
  "details": {
    "completion_percent": 95,
    "required_completion": 100,
    "confidence_avg": 2.8,
    "required_confidence": 3,
    "missing_criteria": ["completion_percent must be >= 100", "confidence_avg must be >= 3"]
  }
}
```

**Error (403 - Permission denied):**
```json
{
  "error": "Permission denied",
  "details": {
    "required_permission": "TOOLS_APPROVE",
    "user_role": "PROJECT_MANAGER",
    "allowed_roles": ["ADMIN", "SUPERADMIN"],
    "suggestion": "Contact an administrator to approve this tool"
  }
}
```

---

## Walidacje

### 1. Permission
- Wymaga: `TOOLS_APPROVE`
- Role: ADMIN, SUPERADMIN
- Jesli nie: `403 Permission denied`

### 2. Status
- Narzedzie musi byc w statusie `REVIEW`
- Jesli nie: `409 Tool session not in review`

### 3. Definition of Done (DoD)

| Kryterium | Wymagana wartosc | Opis |
|-----------|------------------|------|
| `completion_percent` | >= 100 | Wszystkie sekcje wypelnione |
| `confidence_avg` | >= 3 | Srednia pewnosc >= 3/5 |

### 4. Walidacja danych wejsciowych

| Pole | Walidacja | Blad |
|------|-----------|------|
| `decisionOwnerId` | UUID format, user exists, has TOOLS_APPROVE | Invalid approver |
| `dueDate` | ISO date, future date | Due date must be in the future |
| `priority` | enum: low, medium, high, critical | Invalid priority value |
| `comment` | max 2000 chars | Comment too long |

---

## Efekty

### 1. Decision Record
Tworzy wpis w tabeli `decisions` z `status='approved'`:
```sql
INSERT INTO decisions (
  id, organization_id, project_id, title, type,
  decision_maker_id, deadline, status, created_by, priority, description, resolved_at
) VALUES (
  'dec-approve-2026-01-27-001',
  'org-acme-corp',
  'proj-001',
  'Approval: SWOT Analysis - Manufacturing Division',
  'TOOL_APPROVE',
  'user-cto-001',
  '2026-02-10',
  'approved',
  'user-cto-001',
  'high',
  'Excellent analysis - approved for initiative generation',
  '2026-01-27T16:45:00Z'
);
```

### 2. Tool Decision
Tworzy/aktualizuje wpis w `tool_decisions`:
```sql
INSERT INTO tool_decisions (
  id, tool_session_id, decision_type, status, decision_id, created_by, created_at
) VALUES (
  'td-approve-001',
  '550e8400-e29b-41d4-a716-446655440001',
  'APPROVE_TOOL',
  'APPROVED',
  'dec-approve-2026-01-27-001',
  'user-cto-001',
  '2026-01-27T16:45:00Z'
);
```

### 3. Status Update
```sql
UPDATE tool_sessions 
SET status = 'APPROVED', 
    approved_at = '2026-01-27T16:45:00Z', 
    approved_by = 'user-cto-001',
    updated_at = '2026-01-27T16:45:00Z'
WHERE id = '550e8400-e29b-41d4-a716-446655440001';
```

### 4. Audit Log
```sql
INSERT INTO audit_log (
  id, organization_id, user_id, action, resource_type, resource_id, details, created_at
) VALUES (
  'audit-approve-001',
  'org-acme-corp',
  'user-cto-001',
  'tool_approved',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '{"decisionId": "dec-approve-2026-01-27-001", "priority": "high", "comment": "Excellent analysis"}',
  '2026-01-27T16:45:00Z'
);
```

### 5. Notyfikacje
```sql
-- Notyfikacja do autora narzedzia
INSERT INTO notifications (
  id, user_id, type, title, message, resource_type, resource_id, created_at
) VALUES (
  'notif-approve-001',
  'user-123',
  'TOOL_APPROVED',
  'Your tool has been approved',
  'SWOT Analysis - Manufacturing Division has been approved. You can now generate initiatives.',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '2026-01-27T16:45:00Z'
);

-- Notyfikacja do PMO
INSERT INTO notifications (
  id, user_id, type, title, message, resource_type, resource_id, created_at
) VALUES (
  'notif-approve-002',
  'user-pmo-001',
  'TOOL_APPROVED',
  'Tool approved - ready for initiatives',
  'SWOT Analysis - Manufacturing Division approved by Jan Nowak',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '2026-01-27T16:45:00Z'
);
```

---

## Flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [REVIEW] ────────────────────────────────────────────────────────────────► │
│      │                                                                      │
│      │  Approver clicks "Approve"                                           │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  VALIDATION LAYER                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ Check Perm  │  │ Check Status│  │ Check DoD   │  │ Validate   │ │   │
│  │  │ TOOLS_APPR  │  │ == REVIEW   │  │ >= 100%     │  │ Input Data │ │   │
│  │  │ ADMIN/SUPER │  │             │  │ conf >= 3   │  │            │ │   │
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
│  │  5. Send Notifications  │    │                         │               │
│  └───────────┬─────────────┘    └─────────────────────────┘               │
│              │                                                             │
│              ▼                                                             │
│  [APPROVED] ◄──────────────────────────────────────────────────────────── │
│      │                                                                      │
│      │  canGenerateInitiatives = true                                      │
│      │                                                                      │
│      ▼                                                                      │
│  [Generate Initiatives Modal opens automatically]                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Send Back to Draft

### Endpoint
```
POST /api/tools/:toolId/send-back
```

### Request
```json
{
  "comment": "Analiza wymaga uzupelnienia w nastepujacych obszarach:\n1. Brakuje analizy konkurencji w sekcji Threats\n2. Korelacje S-O sa niepelne\n3. Prosze dodac dane liczbowe do Strengths"
}
```

### Response
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "DRAFT",
  "decisionId": "dec-sendback-2026-01-27-001",
  "sentBackAt": "2026-01-27T17:00:00Z",
  "sentBackBy": {
    "id": "user-cto-001",
    "name": "Jan Nowak",
    "role": "CTO"
  },
  "feedback": "Analiza wymaga uzupelnienia w nastepujacych obszarach:\n1. Brakuje analizy konkurencji w sekcji Threats\n2. Korelacje S-O sa niepelne\n3. Prosze dodac dane liczbowe do Strengths",
  "nextSteps": [
    "Address the feedback points",
    "Update the analysis",
    "Request review again when ready"
  ]
}
```

### Walidacje

| Warunek | Blad | Kod |
|---------|------|-----|
| Status != REVIEW | Tool session not in review | 409 |
| comment.length < 10 | Comment must be at least 10 characters | 400 |
| comment.length > 2000 | Comment too long | 400 |
| Brak permission TOOLS_APPROVE | Permission denied | 403 |

### Efekty
- Tworzy decision record z `status='rejected'`
- Resetuje `approved_at` i `review_requested_at` na NULL
- Loguje do `audit_log` jako `tool_sent_back`
- Wysyla notyfikacje do autora z feedbackiem

### SQL dla Send Back
```sql
-- Decision record
INSERT INTO decisions (
  id, organization_id, project_id, title, type,
  decision_maker_id, status, created_by, description, resolved_at
) VALUES (
  'dec-sendback-2026-01-27-001',
  'org-acme-corp',
  'proj-001',
  'Rejected: SWOT Analysis - Manufacturing Division',
  'TOOL_REJECT',
  'user-cto-001',
  'rejected',
  'user-cto-001',
  'Analiza wymaga uzupelnienia...',
  '2026-01-27T17:00:00Z'
);

-- Reset tool session
UPDATE tool_sessions 
SET status = 'DRAFT', 
    approved_at = NULL, 
    review_requested_at = NULL,
    updated_at = '2026-01-27T17:00:00Z'
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- Audit log
INSERT INTO audit_log (
  id, organization_id, user_id, action, resource_type, resource_id, details
) VALUES (
  'audit-sendback-001',
  'org-acme-corp',
  'user-cto-001',
  'tool_sent_back',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '{"decisionId": "dec-sendback-2026-01-27-001", "reason": "Analiza wymaga uzupelnienia..."}'
);
```

---

## Implementacja (kod)

```typescript
static approveTool = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user;
    const { toolId } = req.params;
    const { decisionOwnerId, dueDate, priority, comment } = req.body;

    // 1. Permission check
    const allowed = await ensurePermission(req, 'TOOLS_APPROVE');
    if (!allowed) {
      res.status(403).json({ 
        error: 'Permission denied',
        details: {
          required_permission: 'TOOLS_APPROVE',
          user_role: user.role,
          allowed_roles: ['ADMIN', 'SUPERADMIN'],
          suggestion: 'Contact an administrator to approve this tool'
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
    if (normalizeStatus(session.status) !== 'REVIEW') {
      res.status(409).json({ 
        error: 'Tool session not in review',
        details: {
          current_status: session.status,
          allowed_status: 'REVIEW',
          suggestion: 'First request review before approving'
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

    const now = new Date().toISOString();
    const effectiveOwnerId = decisionOwnerId || user.id;
    const effectiveDueDate = dueDate || addDays(new Date(), 7).toISOString().split('T')[0];
    const effectivePriority = priority || 'medium';

    // 5. Create decision record (approved)
    const decisionId = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO decisions (
        id, organization_id, project_id, title, type,
        decision_maker_id, deadline, status, created_by, priority, description, resolved_at
      ) VALUES (?, ?, ?, ?, 'TOOL_APPROVE', ?, ?, 'approved', ?, ?, ?, ?)`,
      [
        decisionId,
        user.organizationId,
        session.project_id,
        `Approval: ${session.name}`,
        effectiveOwnerId,
        effectiveDueDate,
        user.id,
        effectivePriority,
        comment || null,
        now
      ]
    );

    // 6. Create tool decision
    await queryHelpers.queryRun(
      `INSERT INTO tool_decisions (
        id, tool_session_id, decision_type, status, decision_id, created_by, created_at
      ) VALUES (?, ?, 'APPROVE_TOOL', 'APPROVED', ?, ?, ?)`,
      [uuidv4(), toolId, decisionId, user.id, now]
    );

    // 7. Update status
    await queryHelpers.queryRun(
      `UPDATE tool_sessions 
       SET status = 'APPROVED', approved_at = ?, approved_by = ?, updated_at = ? 
       WHERE id = ?`,
      [now, user.id, now, toolId]
    );

    // 8. Audit log
    await logAudit(user.organizationId, user.id, 'tool_approved', 'tool_session', toolId, {
      decisionId,
      priority: effectivePriority,
      comment
    });

    // 9. Send notifications
    await sendNotification({
      userId: session.created_by,
      type: 'TOOL_APPROVED',
      title: 'Your tool has been approved',
      message: `${session.name} has been approved. You can now generate initiatives.`,
      resourceType: 'tool_session',
      resourceId: toolId
    });

    // 10. Get approver info for response
    const approver = await queryHelpers.queryOne(
      `SELECT id, name, role FROM users WHERE id = ?`,
      [user.id]
    );

    res.json({ 
      id: toolId, 
      status: 'APPROVED',
      decisionId,
      approvedAt: now,
      approvedBy: approver,
      canGenerateInitiatives: true,
      nextSteps: [
        'Configure initiative generation parameters',
        'Select methodology (Impact x Feasibility recommended)',
        'Choose number of initiatives (3-7)'
      ]
    });
  }
);
```

---

## UI Integration

Po zatwierdzeniu narzedzia:
1. Frontend otrzymuje `status: 'APPROVED'`
2. Automatycznie otwiera sie `GenerateInitiativesModal`
3. Uzytkownik moze wygenerowac inicjatywy

```typescript
// ToolWorkspace.tsx
const handleApprove = async () => {
  try {
    setIsApproving(true);
    const result = await Api.approveTool(toolSessionId, {
      priority: 'high',
      comment: approvalComment
    });
    
    setToolStatus(result.status || 'APPROVED');
    setShowGenerateModal(true);  // Auto-open generate modal
    
    toast.success('Tool approved! You can now generate initiatives.');
    
    // Track analytics
    analytics.track('tool_approved', {
      toolId: toolSessionId,
      toolType,
      decisionId: result.decisionId
    });
  } catch (err: any) {
    toast.error(err?.message || 'Failed to approve tool');
  } finally {
    setIsApproving(false);
  }
};
```

---

## Przykladowe scenariusze

### Scenariusz 1: Sukces - zatwierdzenie
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440001/approve \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high",
    "comment": "Excellent analysis"
  }'

# Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "APPROVED",
  "canGenerateInitiatives": true
}
```

### Scenariusz 2: Send back z feedbackiem
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440002/send-back \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "Please add competitive analysis to Threats section"
  }'

# Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "status": "DRAFT",
  "feedback": "Please add competitive analysis to Threats section"
}
```

### Scenariusz 3: Blad - brak uprawnien
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440003/approve \
  -H "Authorization: Bearer pm-token"

# Response: 403 Forbidden
{
  "error": "Permission denied",
  "details": {
    "required_permission": "TOOLS_APPROVE",
    "user_role": "PROJECT_MANAGER",
    "allowed_roles": ["ADMIN", "SUPERADMIN"]
  }
}
```

---

## Metryki i monitoring

| Metryka | Opis | Alert threshold |
|---------|------|-----------------|
| `tools.approve.success` | Liczba zatwierdzen | - |
| `tools.approve.rejected` | Liczba odrzucen (send back) | - |
| `tools.approve.rejection_rate` | % odrzucen | > 40% |
| `tools.approve.avg_review_time` | Sredni czas review | > 48h |
| `tools.approve.permission_denied` | Liczba prob bez uprawnien | > 5/h |
| `tools.approve.latency_ms` | Czas odpowiedzi | > 500ms |
