# Tools - Testy

## Cel

Zebrac minimum testow unit/API/E2E dla modulu Tools.

## Zrodla

- `tests/unit/backend/tool.validators.test.ts`
- `tests/unit/backend/tools.routes.test.ts`
- `tests/e2e/tools-to-initiatives.spec.ts`
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md` (sekcja "Testy")

---

## Istniejace testy

### 1. Unit Tests - Validators

**Plik:** `tests/unit/backend/tool.validators.test.ts`

```typescript
describe('Tool validators', () => {
  describe('CreateToolSessionSchema', () => {
    it('accepts valid tool session payload', () => {
      const result = CreateToolSessionSchema.safeParse({
        toolType: 'dynamic-swot',
        name: 'Dynamic SWOT - Q1 Analysis',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing toolType', () => {
      const result = CreateToolSessionSchema.safeParse({
        name: 'Test Session',
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].path).toContain('toolType');
    });

    it('rejects empty name', () => {
      const result = CreateToolSessionSchema.safeParse({
        toolType: 'dynamic-swot',
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional projectId', () => {
      const result = CreateToolSessionSchema.safeParse({
        toolType: 'market-forces',
        name: 'Porter Analysis',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GenerateInitiativesSchema', () => {
    it('rejects generate initiatives count > 7', () => {
      const result = GenerateInitiativesSchema.safeParse({
        methodologyId: 'impact-feasibility',
        count: 8,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toContain('7');
    });

    it('rejects generate initiatives count < 1', () => {
      const result = GenerateInitiativesSchema.safeParse({
        methodologyId: 'impact-feasibility',
        count: 0,
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid count range', () => {
      [1, 3, 5, 7].forEach((count) => {
        const result = GenerateInitiativesSchema.safeParse({
          methodologyId: 'value-effort',
          count,
        });
        expect(result.success).toBe(true);
      });
    });

    it('requires methodologyId', () => {
      const result = GenerateInitiativesSchema.safeParse({
        count: 5,
      });
      expect(result.success).toBe(false);
    });

    it('accepts all valid methodologies', () => {
      const methodologies = [
        'impact-feasibility',
        'value-effort',
        'risk-compliance',
        'customer-market',
        'operational-efficiency',
      ];
      methodologies.forEach((methodologyId) => {
        const result = GenerateInitiativesSchema.safeParse({
          methodologyId,
          count: 3,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('SendBackSchema', () => {
    it('requires send back comment', () => {
      const result = SendBackSchema.safeParse({ comment: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid comment', () => {
      const result = SendBackSchema.safeParse({
        comment: 'Please add more details to the Threats section',
      });
      expect(result.success).toBe(true);
    });

    it('rejects comment over 2000 chars', () => {
      const result = SendBackSchema.safeParse({
        comment: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateToolSessionSchema', () => {
    it('accepts partial update session', () => {
      const result = UpdateToolSessionSchema.safeParse({
        completionPercent: 80,
      });
      expect(result.success).toBe(true);
    });

    it('accepts full update payload', () => {
      const result = UpdateToolSessionSchema.safeParse({
        answers: { context: { goal: 'Test' } },
        completionPercent: 100,
        confidenceAvg: 4.5,
        contextSnapshot: { org: {}, chat: [], initiatives: [] },
      });
      expect(result.success).toBe(true);
    });

    it('validates completionPercent range', () => {
      expect(UpdateToolSessionSchema.safeParse({ completionPercent: -1 }).success).toBe(false);
      expect(UpdateToolSessionSchema.safeParse({ completionPercent: 101 }).success).toBe(false);
      expect(UpdateToolSessionSchema.safeParse({ completionPercent: 50 }).success).toBe(true);
    });

    it('validates confidenceAvg range', () => {
      expect(UpdateToolSessionSchema.safeParse({ confidenceAvg: 0 }).success).toBe(false);
      expect(UpdateToolSessionSchema.safeParse({ confidenceAvg: 6 }).success).toBe(false);
      expect(UpdateToolSessionSchema.safeParse({ confidenceAvg: 3.5 }).success).toBe(true);
    });
  });
});
```

**Pokrycie:** 15 testow

---

### 2. Unit Tests - Routes (Sanity)

**Plik:** `tests/unit/backend/tools.routes.test.ts`

```typescript
describe('Tools Routes', () => {
  describe('Route configuration', () => {
    it('should have POST /api/tools route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/' && r.route?.methods?.post)).toBe(
        true
      );
    });

    it('should have GET /api/tools route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/' && r.route?.methods?.get)).toBe(
        true
      );
    });

    it('should have GET /api/tools/:toolId route', () => {
      expect(
        toolsRouter.stack.some((r) => r.route?.path === '/:toolId' && r.route?.methods?.get)
      ).toBe(true);
    });

    it('should have PUT /api/tools/:toolId route', () => {
      expect(
        toolsRouter.stack.some((r) => r.route?.path === '/:toolId' && r.route?.methods?.put)
      ).toBe(true);
    });

    it('should have POST /api/tools/:toolId/request-review route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/:toolId/request-review')).toBe(true);
    });

    it('should have POST /api/tools/:toolId/approve route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/:toolId/approve')).toBe(true);
    });

    it('should have POST /api/tools/:toolId/send-back route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/:toolId/send-back')).toBe(true);
    });

    it('should have POST /api/tools/:toolId/generate-initiatives route', () => {
      expect(toolsRouter.stack.some((r) => r.route?.path === '/:toolId/generate-initiatives')).toBe(
        true
      );
    });

    it('should have GET /api/tools/:toolId/generated-initiatives route', () => {
      expect(
        toolsRouter.stack.some((r) => r.route?.path === '/:toolId/generated-initiatives')
      ).toBe(true);
    });
  });

  describe('Business logic helpers', () => {
    it('should enforce max initiatives count', () => {
      const count = 8;
      expect(count).toBeGreaterThan(MAX_INITIATIVES_COUNT);
    });

    it('should accept valid methodology', () => {
      const validMethodologies = ['impact-feasibility', 'value-effort', 'risk-compliance'];
      validMethodologies.forEach((m) => {
        expect(VALID_METHODOLOGIES.includes(m)).toBe(true);
      });
    });

    it('should calculate DoD correctly', () => {
      expect(requireDoD({ completion_percent: 100, confidence_avg: 3 })).toBe(true);
      expect(requireDoD({ completion_percent: 99, confidence_avg: 3 })).toBe(false);
      expect(requireDoD({ completion_percent: 100, confidence_avg: 2.9 })).toBe(false);
    });

    it('should normalize status correctly', () => {
      expect(normalizeStatus('draft')).toBe('DRAFT');
      expect(normalizeStatus('DRAFT')).toBe('DRAFT');
      expect(normalizeStatus('Draft')).toBe('DRAFT');
    });
  });
});
```

**Pokrycie:** 13 testow

---

### 3. E2E Tests - Full Flow

**Plik:** `tests/e2e/tools-to-initiatives.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tools -> Initiatives Flow', () => {
  let toolId: string;
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    // Login and get token
    const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { email: 'admin@test.com', password: 'test' },
    });
    const { token } = await loginResponse.json();
    headers = { Authorization: `Bearer ${token}` };
  });

  test('creates tool session successfully', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: {
        toolType: 'dynamic-swot',
        name: 'E2E Test - SWOT Analysis',
        projectId: 'proj-e2e-001',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe('DRAFT');
    toolId = data.id;
  });

  test('updates tool session with DoD data', async ({ request }) => {
    const response = await request.put(`${API_BASE_URL}/api/tools/${toolId}`, {
      headers,
      data: {
        answers: {
          context: { goal: 'E2E Test Goal', scope: 'E2E Test Scope' },
          items: [
            { id: 's1', quadrant: 'strengths', text: 'Strength 1' },
            { id: 's2', quadrant: 'strengths', text: 'Strength 2' },
            { id: 'w1', quadrant: 'weaknesses', text: 'Weakness 1' },
            { id: 'w2', quadrant: 'weaknesses', text: 'Weakness 2' },
            { id: 'o1', quadrant: 'opportunities', text: 'Opportunity 1' },
            { id: 'o2', quadrant: 'opportunities', text: 'Opportunity 2' },
            { id: 't1', quadrant: 'threats', text: 'Threat 1' },
            { id: 't2', quadrant: 'threats', text: 'Threat 2' },
          ],
          correlations: [
            { from: 's1', to: 'o1', type: 'leverage' },
            { from: 'w1', to: 'o2', type: 'address' },
            { from: 's2', to: 't1', type: 'defend' },
          ],
        },
        completionPercent: 100,
        confidenceAvg: 4,
        contextSnapshot: { org: { name: 'E2E Corp' }, chat: [], initiatives: [] },
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.completionPercent).toBe(100);
  });

  test('requests review successfully', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/tools/${toolId}/request-review`, {
      headers,
      data: {
        priority: 'high',
        dueDate: '2026-02-15',
        comment: 'E2E test review request',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('REVIEW');
    expect(data.decisionId).toBeDefined();
  });

  test('rejects request review without DoD', async ({ request }) => {
    // Create new session without DoD
    const createResponse = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: { toolType: 'dynamic-swot', name: 'No DoD Session' },
    });
    const { id: newToolId } = await createResponse.json();

    const response = await request.post(`${API_BASE_URL}/api/tools/${newToolId}/request-review`, {
      headers,
      data: {},
    });

    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.error).toBe('DoD not satisfied');
  });

  test('approves tool successfully', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/api/tools/${toolId}/approve`, {
      headers,
      data: {
        priority: 'high',
        comment: 'E2E test approval',
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('APPROVED');
    expect(data.canGenerateInitiatives).toBe(true);
  });

  test('rejects approval without permission', async ({ request }) => {
    // Login as regular user
    const loginResponse = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { email: 'user@test.com', password: 'test' },
    });
    const { token } = await loginResponse.json();
    const userHeaders = { Authorization: `Bearer ${token}` };

    // Create and request review for new session
    const createResponse = await request.post(`${API_BASE_URL}/api/tools`, {
      headers: userHeaders,
      data: { toolType: 'dynamic-swot', name: 'User Session' },
    });
    const { id: userToolId } = await createResponse.json();

    // Try to approve (should fail)
    const response = await request.post(`${API_BASE_URL}/api/tools/${userToolId}/approve`, {
      headers: userHeaders,
      data: {},
    });

    expect(response.status()).toBe(403);
  });

  test('generates initiatives successfully', async ({ request }) => {
    const response = await request.post(
      `${API_BASE_URL}/api/tools/${toolId}/generate-initiatives`,
      {
        headers,
        data: {
          methodologyId: 'impact-feasibility',
          count: 3,
          includeChatContext: true,
        },
      }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.batchId).toBeDefined();
    expect(data.initiatives).toHaveLength(3);

    data.initiatives.forEach((initiative: any) => {
      expect(initiative.id).toBeDefined();
      expect(initiative.title).toBeDefined();
      expect(initiative.status).toBe('DRAFT');
    });
  });

  test('rejects generate with count > 7', async ({ request }) => {
    const response = await request.post(
      `${API_BASE_URL}/api/tools/${toolId}/generate-initiatives`,
      {
        headers,
        data: {
          methodologyId: 'value-effort',
          count: 10,
        },
      }
    );

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('limit 7');
  });

  test('lists generated initiatives', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/api/tools/${toolId}/generated-initiatives`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.initiatives.length).toBeGreaterThan(0);
    expect(data.batches.length).toBeGreaterThan(0);
  });

  test('send back to draft flow', async ({ request }) => {
    // Create new session
    const createResponse = await request.post(`${API_BASE_URL}/api/tools`, {
      headers,
      data: { toolType: 'market-forces', name: 'Send Back Test' },
    });
    const { id: sendBackToolId } = await createResponse.json();

    // Update with DoD
    await request.put(`${API_BASE_URL}/api/tools/${sendBackToolId}`, {
      headers,
      data: {
        answers: { context: { industry: 'Tech' }, forces: {} },
        completionPercent: 100,
        confidenceAvg: 4,
      },
    });

    // Request review
    await request.post(`${API_BASE_URL}/api/tools/${sendBackToolId}/request-review`, {
      headers,
      data: {},
    });

    // Send back
    const response = await request.post(`${API_BASE_URL}/api/tools/${sendBackToolId}/send-back`, {
      headers,
      data: { comment: 'Please add more details to competitive analysis' },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('DRAFT');
  });

  test('full UI flow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'test');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navigate to Tools
    await page.click('[data-testid="nav-discovery-tools"]');
    await page.waitForSelector('[data-testid="tools-hub"]');

    // Create new session
    await page.click('[data-testid="category-strategy"]');
    await page.click('[data-testid="tool-dynamic-swot"]');
    await page.waitForSelector('[data-testid="tool-workspace"]');

    // Fill in data
    await page.fill('[data-testid="context-goal"]', 'UI Test Goal');
    await page.fill('[data-testid="context-scope"]', 'UI Test Scope');

    // Add SWOT items
    await page.click('[data-testid="add-strength"]');
    await page.fill('[data-testid="item-text"]', 'UI Test Strength');
    await page.click('[data-testid="save-item"]');

    // Verify progress updates
    await expect(page.locator('[data-testid="completion-percent"]')).toContainText('%');
  });
});
```

**Pokrycie:** 12 testow E2E

---

## Plan testow (do rozbudowy)

### Unit Tests - Backend

| Test                   | Opis                                    | Priorytet | Status |
| ---------------------- | --------------------------------------- | --------- | ------ |
| `requireDoD`           | Walidacja DoD (completion + confidence) | P1        | ✅     |
| `normalizeStatus`      | Normalizacja statusu (uppercase)        | P2        | ✅     |
| `ensurePermission`     | Sprawdzanie permissions                 | P1        | ⬜     |
| `createDecisionRecord` | Tworzenie decision                      | P2        | ⬜     |
| `upsertToolDecision`   | Insert/update tool_decisions            | P2        | ⬜     |
| `buildPrompt`          | Budowanie prompta AI                    | P2        | ⬜     |
| `normalizeInitiatives` | Normalizacja output AI                  | P2        | ⬜     |
| `fallbackInitiatives`  | Generowanie fallback                    | P2        | ⬜     |
| `calculateCompletion`  | Obliczanie completion %                 | P1        | ⬜     |
| `calculateConfidence`  | Obliczanie confidence                   | P1        | ⬜     |

### Unit Tests - Frontend

| Test                       | Opis                                    | Priorytet | Status |
| -------------------------- | --------------------------------------- | --------- | ------ |
| `ToolWorkspace`            | Render, status display, DoD check       | P1        | ⬜     |
| `GenerateInitiativesModal` | Count validation, methodology selection | P1        | ⬜     |
| `ToolReviewPanel`          | Gaps display, approve/send back buttons | P2        | ⬜     |
| `ToolContextPanel`         | Completion checker, confidence display  | P2        | ⬜     |
| `ToolHeader`               | Request review button states            | P2        | ⬜     |
| `RequestReviewModal`       | Form validation, submission             | P2        | ⬜     |
| `DoDStatusCard`            | Gaps display, criteria list             | P2        | ⬜     |
| `MethodologySelector`      | Radio selection, preview update         | P3        | ⬜     |
| `CountSelector`            | Preset and custom count                 | P3        | ⬜     |
| `ContextOptions`           | Checkbox states                         | P3        | ⬜     |

### Integration Tests - API

| Test                        | Opis                               | Priorytet | Status |
| --------------------------- | ---------------------------------- | --------- | ------ |
| `request-review bez DoD`    | 409 DoD not satisfied              | P1        | ✅     |
| `approve bez roli`          | 403 Permission denied              | P1        | ✅     |
| `generate bez approval`     | 409 Tool session not approved      | P1        | ⬜     |
| `generate count > 7`        | 400 Initiative count exceeds limit | P1        | ✅     |
| `send-back bez komentarza`  | 400 Comment is required            | P2        | ⬜     |
| `create z invalid toolType` | 400 Invalid tool type              | P2        | ⬜     |
| `update z invalid data`     | 400 Validation error               | P2        | ⬜     |
| `get non-existent tool`     | 404 Not found                      | P2        | ⬜     |
| `cross-org access`          | 403 Forbidden                      | P1        | ⬜     |
| `rate limit exceeded`       | 429 Too many requests              | P3        | ⬜     |

### E2E Tests

| Test                   | Opis                                    | Priorytet | Status |
| ---------------------- | --------------------------------------- | --------- | ------ |
| `Full flow`            | DRAFT -> REVIEW -> APPROVED -> Generate | P1        | ✅     |
| `Send back flow`       | DRAFT -> REVIEW -> DRAFT (rejected)     | P2        | ✅     |
| `Fallback initiatives` | Generate bez AI (timeout)               | P3        | ⬜     |
| `UI flow`              | Klikanie przez UI zamiast API           | P2        | ✅     |
| `Multi-user flow`      | PM creates, Admin approves              | P2        | ⬜     |
| `Concurrent edits`     | Two users editing same tool             | P3        | ⬜     |
| `Session recovery`     | Browser refresh during edit             | P3        | ⬜     |
| `Export/Import`        | Export to JSON, import back             | P3        | ⬜     |
| `Mobile responsive`    | Full flow on mobile viewport            | P3        | ⬜     |
| `Accessibility`        | Keyboard navigation, screen reader      | P3        | ⬜     |

---

## Scenariusze GWT (Given-When-Then)

### Scenario 1: Request Review z DoD

```gherkin
Given tool session "SWOT-001" w statusie DRAFT
  And completion_percent = 100
  And confidence_avg = 4.2
  And user "pm@company.com" ma role PROJECT_MANAGER
When user klika "Request Review"
  And wybiera due date "2026-02-15"
  And wybiera priority "high"
  And klika "Send to review"
Then status zmienia sie na REVIEW
  And decision record jest utworzony z type "TOOL_REVIEW"
  And tool_decisions zawiera wpis z status "PENDING"
  And audit_log zawiera wpis "tool_review_requested"
  And notyfikacja jest wyslana do reviewerow
```

### Scenario 2: Request Review bez DoD

```gherkin
Given tool session "SWOT-002" w statusie DRAFT
  And completion_percent = 75
  And confidence_avg = 2.5
When user probuje wyslac do review
Then przycisk "Request Review" jest disabled
  And tooltip pokazuje "Missing: Add 1 opportunity, Add 2 threats, Create 2 correlations"
  And API zwraca 409 "DoD not satisfied" jesli wywolane bezposrednio
```

### Scenario 3: Approve bez roli

```gherkin
Given tool session "SWOT-003" w statusie REVIEW
  And user "pm@company.com" ma role PROJECT_MANAGER
  And PROJECT_MANAGER nie ma permission TOOLS_APPROVE
When user probuje zatwierdzic
Then przycisk "Approve" jest ukryty lub disabled
  And API zwraca 403 "Permission denied"
  And status pozostaje REVIEW
```

### Scenario 4: Generate z count > 7

```gherkin
Given tool session "SWOT-004" w statusie APPROVED
  And user ma permission TOOLS_GENERATE_INITIATIVES
When user wpisuje count = 10 w custom input
Then input jest ograniczony do max 7
  And preview pokazuje 7 inicjatyw
  And API waliduje count <= 7
```

### Scenario 5: Generate z metodyka

```gherkin
Given tool session "SWOT-005" w statusie APPROVED
  And user wybiera methodology "value-effort"
  And user wybiera count = 4
When user klika "Generate Drafts"
Then AI generuje 4 inicjatywy
  And kazda inicjatywa ma category = "Operations"
  And kazda inicjatywa ma priority = "P2"
  And kazda inicjatywa ma risk = "Low"
  And inicjatywy sa zapisane w tabeli initiatives z source_type = "tool"
```

### Scenario 6: Send back z feedbackiem

```gherkin
Given tool session "SWOT-006" w statusie REVIEW
  And user "admin@company.com" ma permission TOOLS_APPROVE
When user klika "Send back"
  And wpisuje comment "Please add competitive analysis to Threats"
  And klika "Confirm"
Then status zmienia sie na DRAFT
  And decision record jest utworzony z status "rejected"
  And review_requested_at jest zresetowane na NULL
  And notyfikacja z feedbackiem jest wyslana do autora
```

### Scenario 7: AI fallback

```gherkin
Given tool session "SWOT-007" w statusie APPROVED
  And AI service jest niedostepny (timeout)
When user generuje 3 inicjatywy
Then system wykonuje 2 proby (retry)
  And po 2 nieudanych probach generuje fallback initiatives
  And fallback initiatives maja title "Dynamic SWOT Initiative 1/2/3"
  And fallback initiatives maja tag "review-needed"
  And user widzi toast "Generated with fallback data"
```

---

## Testy niefunkcjonalne

| Test          | Kryterium                                     | Priorytet | Metoda           |
| ------------- | --------------------------------------------- | --------- | ---------------- |
| Performance   | Generowanie <= 10s dla 7 inicjatyw            | P2        | Load test        |
| Performance   | Lista sesji < 200ms dla 100 items             | P2        | Load test        |
| Performance   | Auto-save < 500ms                             | P2        | Timing           |
| Security      | Tylko role z uprawnieniami moga wykonac akcje | P1        | Penetration test |
| Security      | Cross-org access blocked                      | P1        | Security test    |
| Security      | SQL injection prevention                      | P1        | Security test    |
| Reliability   | Retry dla AI 1x, brak duplikatow w batchu     | P2        | Integration test |
| Reliability   | Graceful degradation przy AI failure          | P2        | Chaos test       |
| Timeout       | AI timeout 8s (konfigurowalne)                | P2        | Config test      |
| Scalability   | 100 concurrent users                          | P3        | Load test        |
| Accessibility | WCAG 2.1 AA compliance                        | P3        | Axe audit        |

---

## Uruchamianie testow

### Unit tests

```bash
# Wszystkie unit testy
npm run test

# Tylko tool validators
npm run test -- tests/unit/backend/tool.validators.test.ts

# Tylko tool routes
npm run test -- tests/unit/backend/tools.routes.test.ts

# Z coverage
npm run test -- --coverage tests/unit/backend/tool*.test.ts
```

### E2E tests

```bash
# Wymaga uruchomionego backendu
npm run dev:server &

# Wszystkie E2E
npm run test:e2e

# Tylko tools flow
npm run test:e2e -- tests/e2e/tools-to-initiatives.spec.ts

# Z UI (headed mode)
npm run test:e2e -- --headed tests/e2e/tools-to-initiatives.spec.ts

# Debug mode
npm run test:e2e -- --debug tests/e2e/tools-to-initiatives.spec.ts
```

### Wszystkie testy modulu

```bash
# Grep pattern
npm run test -- --grep "tool"

# Specific files
npm run test -- tests/unit/backend/tool*.test.ts tests/e2e/tools*.spec.ts
```

---

## Coverage targets

| Obszar              | Target              | Obecny |
| ------------------- | ------------------- | ------ |
| Validators          | 90%                 | ~85%   |
| Controller          | 80%                 | ~70%   |
| Service             | 80%                 | ~65%   |
| Routes              | 70%                 | ~60%   |
| Frontend components | 70%                 | ~50%   |
| E2E flows           | 100% critical paths | ~80%   |

---

## Pliki zrodlowe

- `tests/unit/backend/tool.validators.test.ts`
- `tests/unit/backend/tools.routes.test.ts`
- `tests/e2e/tools-to-initiatives.spec.ts`
- `server/src/validators/tool.validators.ts`
- `server/src/controllers/ToolController.ts`
- `server/src/services/ToolInitiativeService.ts`
