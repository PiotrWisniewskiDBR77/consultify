# 🔄 AGENT 3: Integration Tests

## 📋 MISJA

Naprawa testów integracyjnych - testują flow między komponentami i pełne scenariusze użytkownika.

---

## 📁 PLIKI DO NAPRAWY (80+ plików)

### Core Integration (46 plików)

```
tests/integration/aiFailure.test.js
tests/integration/rapidlean-observations.test.js
tests/integration/superadmin-api-endpoints.test.ts
tests/integration/superadmin-database-schema.test.ts
tests/integration/apiOptimization.test.ts
tests/integration/storage_security.test.js
tests/integration/auth.test.ts
tests/integration/initiatives.test.js
tests/integration/chat/streaming.test.ts
tests/integration/chat/artifacts.test.ts
tests/integration/chat/thinking-steps.test.ts
tests/integration/tasks.test.js
tests/integration/llmHealth.test.js
tests/integration/aiPlaybookBranching.test.js
tests/integration/actionExecution.test.js
tests/integration/admin/admin-navigation.test.ts
tests/integration/aiLayersIntegration.test.js
tests/integration/databaseHealth.test.js
tests/integration/aiExplainability.test.js
tests/integration/backend/planLimits.test.js
tests/integration/metricsFullFlow.test.js
tests/integration/auth.test.js  ← WZORZEC DO KOPIOWANIA
tests/integration/organization-management.workflow.test.js
tests/integration/settlementService.test.js
tests/integration/tasks.test.ts
tests/integration/apiResilience.test.js
tests/integration/assessmentOverview.integration.test.js
tests/integration/megatrend.test.js
tests/integration/transactions.test.js
tests/integration/apiFullFlow.test.js
tests/integration/database.integration.test.ts
tests/integration/ai-enterprise-verification.test.js
tests/integration/trialDemoIntegration.test.js
tests/integration/rapidlean-error-handling.test.js
tests/integration/workflow_scenarios.test.ts
tests/integration/routing/superadmin-routing.test.ts
tests/integration/routing/superadmin-navigation.test.ts
tests/integration/idempotency.test.js
tests/integration/projects.test.js
tests/integration/performance/dbOptimization.test.ts
tests/integration/actionDecision.test.js
tests/integration/studio-api.test.ts
tests/integration/legal.test.ts
tests/integration/helpPlaybooks.test.js
tests/integration/external-services.test.ts
tests/integration/transaction.test.js
```

### Route Integration (34 pliki)

```
tests/integration/routes/pinned-prompts.test.js
tests/integration/routes/billingPhase2.test.js
tests/integration/routes/pmoContext.test.js
tests/integration/routes/ai-performance.test.js
tests/integration/routes/llm.test.js
tests/integration/routes/knowledge.test.js
tests/integration/routes/scenarios.test.js
tests/integration/routes/ai-training.test.js
tests/integration/routes/stage-gates.test.js
tests/integration/routes/aiCoach.test.js
tests/integration/routes/assessment.test.js
tests/integration/routes/initiatives.test.js
tests/integration/routes/execution.test.js
tests/integration/routes/tasks.test.js
tests/integration/routes/legal.test.js
tests/integration/routes/ai.test.js
tests/integration/routes/aiAnalytics.test.js
tests/integration/routes/superadmin-support.test.js
tests/integration/routes/superadmin-system.test.js
tests/integration/routes/superadmin-iam.test.js
tests/integration/routes/access-control.test.js
tests/integration/routes/superadmin-revenue.test.js
tests/integration/routes/superadmin-customers.test.js
tests/integration/routes/economicsFinancials.test.js
tests/integration/routes/governanceAdmin.test.js
tests/integration/routes/help.test.js
tests/integration/routes/analyticsAdvanced.test.js
tests/integration/routes/superadmin-ai-platform.test.js
tests/integration/routes/baselines.test.js
tests/integration/routes/daily-brief.test.js
tests/integration/routes/governance.test.js
tests/integration/routes/managementReports.test.js
tests/integration/routes/initiative-generator.test.js
tests/integration/routes/conversations.test.js
```

---

## 🏆 WZORZEC - KOPIUJ Z TEGO PLIKU

**Plik wzorcowy:** `tests/integration/auth.test.js`

```javascript
/**
 * [Feature] Integration Tests
 *
 * Full flow tests for [feature]
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../server/src/index.js';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Assessment Full Flow', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testProjectId;
  let testToken;
  const testEmail = `integration-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();

    // Create organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Integration Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create project
    testProjectId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, organization_id, name, owner_id, status) VALUES (?, ?, ?, ?, ?)`,
        [testProjectId, testOrgId, 'Integration Test Project', testUserId, 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'TestPass123!' });
    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    await new Promise((r) =>
      db.run(`DELETE FROM assessments WHERE project_id = ?`, [testProjectId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], () => r())
    );
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('Complete Assessment Workflow', () => {
    let assessmentId;

    it('Step 1: should create new assessment', async () => {
      const res = await request(app)
        .post('/api/assessments')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          projectId: testProjectId,
          framework: 'DRD',
          name: 'Test Assessment',
        });

      expect([200, 201]).toContain(res.status);
      if (res.body.assessment) {
        assessmentId = res.body.assessment.id;
        expect(assessmentId).toBeDefined();
      }
    });

    it('Step 2: should get assessment details', async () => {
      if (!assessmentId) return; // Skip if step 1 failed

      const res = await request(app)
        .get(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.assessment.id).toBe(assessmentId);
    });

    it('Step 3: should update assessment answers', async () => {
      if (!assessmentId) return;

      const res = await request(app)
        .put(`/api/assessments/${assessmentId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          answers: {
            axis1: { score: 3, notes: 'Test notes' },
          },
        });

      expect([200, 204]).toContain(res.status);
    });

    it('Step 4: should complete assessment', async () => {
      if (!assessmentId) return;

      const res = await request(app)
        .post(`/api/assessments/${assessmentId}/complete`)
        .set('Authorization', `Bearer ${testToken}`);

      expect([200, 204]).toContain(res.status);
    });

    it('Step 5: should list completed assessments', async () => {
      const res = await request(app)
        .get('/api/assessments')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ projectId: testProjectId });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.assessments || res.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent assessment', async () => {
      const res = await request(app)
        .get('/api/assessments/non-existent-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect([404, 400]).toContain(res.status);
    });

    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/assessments');

      expect([401, 403]).toContain(res.status);
    });
  });
});
```

---

## 🔍 ZNAJDOWANIE FAŁSZYWYCH TESTÓW

```bash
# Znajdź fałszywe asercje
grep -rn --include="*.test.js" --include="*.test.ts" \
    -E "expect\((true|false|[0-9]+)\)\.toBe\((true|false|[0-9]+)\)" \
    tests/integration/

# Znajdź testy bez HTTP requests (prawdopodobnie fałszywe)
grep -L "request(app)" tests/integration/*.test.js | head -10
```

---

## 📊 SCENARIUSZE DO PRZETESTOWANIA

### User Flows

1. **Registration → Login → Profile Setup**
2. **Create Project → Add Assessment → Complete → View Report**
3. **Create Initiative → Add Tasks → Track Progress**
4. **Invite User → Accept Invitation → Join Team**

### Admin Flows

1. **Admin Login → User Management → Role Assignment**
2. **Organization Setup → Billing → Subscription**
3. **SuperAdmin → System Config → Feature Flags**

### Error Scenarios

1. **Invalid Token → 401**
2. **Missing Permissions → 403**
3. **Resource Not Found → 404**
4. **Validation Error → 400**
5. **Rate Limiting → 429**

---

## ⚠️ UWAGI SPECJALNE

### Dla testów flow

- Używaj zmiennych do przekazywania danych między krokami
- Każdy krok powinien być niezależny (używaj `if (!id) return;`)
- Cleanup na końcu w odwrotnej kolejności

### Przykład flow testu:

```javascript
describe('Complete User Journey', () => {
    let userId, projectId, taskId;

    it('Step 1: Register', async () => {
        const res = await request(app).post('/api/auth/register')...
        userId = res.body.user.id;
    });

    it('Step 2: Create Project', async () => {
        if (!userId) return;
        const res = await request(app).post('/api/projects')...
        projectId = res.body.project.id;
    });

    it('Step 3: Create Task', async () => {
        if (!projectId) return;
        const res = await request(app).post('/api/tasks')...
        taskId = res.body.task.id;
    });

    // Cleanup
    afterAll(async () => {
        if (taskId) await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
        if (projectId) await db.run('DELETE FROM projects WHERE id = ?', [projectId]);
        if (userId) await db.run('DELETE FROM users WHERE id = ?', [userId]);
    });
});
```

---

## ✅ CHECKLIST

- [ ] Przejrzyj plik wzorcowy `tests/integration/auth.test.js`
- [ ] Sprawdź każdy plik na liście
- [ ] Zidentyfikuj fałszywe asercje i brakujące HTTP requesty
- [ ] Napraw używając wzorca powyżej
- [ ] Uruchom: `npm run test:integration`

---

## 📞 POMOC

API Endpoints: `server/src/routes/`
Wzorcowy test: `tests/integration/auth.test.js`
