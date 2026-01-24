# 🖥️ AGENT 2: Backend & API Tests

## 📋 MISJA

Naprawa testów serwisów backendowych i API - core business logic.

---

## 📁 PLIKI DO NAPRAWY (63 pliki)

### Backend Services (60 plików)

```
tests/unit/backend/tokenService.test.js
tests/unit/backend/partnerService.test.js
tests/unit/backend/referralService.test.js
tests/unit/backend/adkarService.test.js
tests/unit/backend/metricsCollector.test.js
tests/unit/backend/valueRealizationService.test.js
tests/unit/backend/aiActionExecutor.test.js
tests/unit/backend/trialService.test.js
tests/unit/backend/scmsLifecycle.test.js
tests/unit/backend/workqueueService.test.js
tests/unit/backend/outcomeService.test.js
tests/unit/backend/refreshTokenService.test.js
tests/unit/backend/featureFlagService.test.js
tests/unit/backend/docIndexer.test.js
tests/unit/backend/complianceService.test.js
tests/unit/backend/healthRoutes.test.js
tests/unit/backend/organizationService.test.js
tests/unit/backend/aiExternalData.test.js
tests/unit/backend/aiAuditLogger.test.js
tests/unit/backend/connectorService.test.js
tests/unit/backend/healthService.test.js
tests/unit/backend/gamificationService.test.js
tests/unit/backend/stabilizationService.test.js
tests/unit/backend/taskService.test.js
tests/unit/backend/templateService.test.js
tests/unit/backend/rateLimiter.test.js
tests/unit/backend/helpService.test.js
tests/unit/backend/aiProactivityEngine.test.js
tests/unit/backend/workspaceService.test.js
tests/unit/backend/aiResponsePostProcessor.test.js
tests/unit/backend/InitiativeService.test.ts
tests/unit/backend/aiExplainabilityService.test.js
tests/unit/backend/notificationService.test.js
tests/unit/backend/drdAxisValidation.test.js
tests/unit/backend/financialCalculatorService.test.js
tests/unit/backend/metricsService.test.js
tests/unit/backend/webhookService.test.js
tests/unit/backend/currencyService.test.js
tests/unit/backend/initiativeService.legacy.test.js
tests/unit/backend/financialService.test.js
tests/unit/backend/actionDecision.service.test.js
tests/unit/backend/scmsServices.test.js
tests/unit/backend/assessmentServices.test.js
tests/unit/backend/subscriptionService.test.js
tests/unit/backend/stageGateService.test.js
tests/unit/backend/onboardingService.test.js
tests/unit/backend/recommendationEngine.test.js
tests/unit/backend/userService.test.js
tests/unit/backend/knowledgeService.test.js
tests/unit/backend/validationService.test.js
tests/unit/backend/accessPolicyService.test.js
tests/unit/backend/aiService.test.js
tests/unit/backend/aiOrchestrator.test.js
tests/unit/backend/riskService.test.js
tests/unit/backend/tourService.test.js
tests/unit/backend/reportService.test.js
tests/unit/backend/workflowService.test.js
```

### Utils Tests (3 pliki)

```
tests/unit/backend/utils/queryHelpers.test.ts
tests/unit/backend/utils/security.utils.test.ts
tests/unit/backend/utils/typeGuards.test.ts
```

---

## 🗄️ SCHEMAT BAZY DANYCH

### Core Tables

```sql
-- Projects
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    owner_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assignee_id TEXT,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initiatives
CREATE TABLE initiatives (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    priority TEXT DEFAULT 'medium',
    estimated_cost REAL,
    estimated_benefit REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Assessments
CREATE TABLE assessments (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    organization_id TEXT NOT NULL,
    framework TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Teams
CREATE TABLE teams (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📝 WZORZEC TESTU

```javascript
/**
 * [Service] Unit Tests
 *
 * Tests for [ServiceName] business logic
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

// Import the actual service
import ProjectService from '../../server/src/services/ProjectService.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-backend-${workerId}.db`;
});

describe('ProjectService', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;

  beforeAll(async () => {
    await initializeDatabase();

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Test Org', 'pro', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role) VALUES (?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, `test-${Date.now()}@test.com`, 'hash', 'ADMIN'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    await new Promise((r) =>
      db.run(`DELETE FROM projects WHERE organization_id = ?`, [testOrgId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM users WHERE organization_id = ?`, [testOrgId], () => r())
    );
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('create', () => {
    it('should create a project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        organizationId: testOrgId,
        ownerId: testUserId,
      };

      const result = await ProjectService.create(projectData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Project');
      expect(result.organizationId).toBe(testOrgId);

      // Cleanup
      if (result.id) {
        await new Promise((r) =>
          db.run(`DELETE FROM projects WHERE id = ?`, [result.id], () => r())
        );
      }
    });

    it('should fail without required fields', async () => {
      await expect(ProjectService.create({})).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('should return project by ID', async () => {
      // Setup: create a project
      const projectId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO projects (id, organization_id, name, owner_id) VALUES (?, ?, ?, ?)`,
          [projectId, testOrgId, 'Get Test Project', testUserId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Test
      const project = await ProjectService.getById(projectId);

      expect(project).toBeDefined();
      expect(project.id).toBe(projectId);
      expect(project.name).toBe('Get Test Project');

      // Cleanup
      await new Promise((r) => db.run(`DELETE FROM projects WHERE id = ?`, [projectId], () => r()));
    });

    it('should return null for non-existent ID', async () => {
      const project = await ProjectService.getById('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('update', () => {
    it('should update project fields', async () => {
      // Setup
      const projectId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO projects (id, organization_id, name, owner_id) VALUES (?, ?, ?, ?)`,
          [projectId, testOrgId, 'Original Name', testUserId],
          () => resolve()
        );
      });

      // Test
      const result = await ProjectService.update(projectId, { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');

      // Cleanup
      await new Promise((r) => db.run(`DELETE FROM projects WHERE id = ?`, [projectId], () => r()));
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      // Setup
      const projectId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO projects (id, organization_id, name, owner_id) VALUES (?, ?, ?, ?)`,
          [projectId, testOrgId, 'Delete Me', testUserId],
          () => resolve()
        );
      });

      // Test
      await ProjectService.delete(projectId);

      // Verify
      const deleted = await ProjectService.getById(projectId);
      expect(deleted).toBeNull();
    });
  });
});
```

---

## 🔍 ZNAJDOWANIE FAŁSZYWYCH TESTÓW

```bash
# Znajdź fałszywe asercje
grep -rn --include="*.test.js" --include="*.test.ts" \
    -E "expect\((true|false|[0-9]+)\)\.toBe" \
    tests/unit/backend/

# Znajdź testy z hardkodowanymi mockami (do weryfikacji)
grep -rn --include="*.test.js" "mockResolvedValue\|mockReturnValue" tests/unit/backend/ | head -20
```

---

## ⚠️ UWAGI SPECJALNE

### Dla serwisów z mockami

Jeśli test używa mocków zamiast prawdziwej bazy:

1. **Oceń** czy mock testuje coś wartościowego
2. **Jeśli tak** - zostaw, ale dodaj komentarz
3. **Jeśli nie** - przepisz na prawdziwy test z bazą

### Przykład PRZED (z mockiem):

```javascript
// ❌ Test z mockiem - nic nie testuje
const mockService = {
  create: vi.fn().mockResolvedValue({ id: '123', name: 'Test' }),
};

it('should create', async () => {
  const result = await mockService.create({ name: 'Test' });
  expect(result.id).toBe('123'); // Zawsze przejdzie!
});
```

### Przykład PO (prawdziwy test):

```javascript
// ✅ Prawdziwy test z bazą
it('should create project in database', async () => {
  const result = await ProjectService.create({
    name: 'Test Project',
    organizationId: testOrgId,
  });

  expect(result.id).toBeDefined();

  // Weryfikacja w bazie
  const dbProject = await new Promise((resolve) => {
    db.get('SELECT * FROM projects WHERE id = ?', [result.id], (_, row) => resolve(row));
  });
  expect(dbProject.name).toBe('Test Project');
});
```

---

## ✅ CHECKLIST

- [ ] Przejrzyj każdy plik serwisu
- [ ] Zidentyfikuj testy z mockami vs prawdziwe testy
- [ ] Napraw fałszywe asercje
- [ ] Dodaj testy dla brakujących przypadków (errors, edge cases)
- [ ] Uruchom: `npm run test:backend`

---

## 📞 POMOC

Lokalizacja serwisów: `server/src/services/`
Schemat bazy: `server/src/database/schema/`
