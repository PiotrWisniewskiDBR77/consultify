import { describe, it, expect, vi, afterEach } from 'vitest';
import OnboardingService from '../../server/src/services/onboardingService.js';

const mocks = vi.hoisted(() => {
  const db = {
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn((sql, params, cb) => cb(null, [])),
    serialize: vi.fn((cb) => cb()),
  };

  const sqlite = {
    runAsync: vi.fn().mockResolvedValue({ lastID: 1, changes: 1 }),
    getAsync: vi.fn(),
    allAsync: vi.fn().mockResolvedValue([]),
    withTransaction: vi.fn((cb) => cb(db)),
  };

  const ai = {
    generateFirstValuePlan: vi.fn(),
  };

  // Setup the manual callback handlers once
  db.get.mockImplementation((sql, params, cb) => {
    const result = sqlite.getAsync(sql, params);
    if (result && typeof result.then === 'function') {
      result.then((res) => cb(null, res)).catch(cb);
    } else {
      cb(null, result);
    }
  });

  db.run.mockImplementation((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    const actualParams = typeof params === 'function' ? [] : params;
    const result = sqlite.runAsync(sql, actualParams);
    if (result && typeof result.then === 'function') {
      result.then((res) => callback.call(res, null)).catch(callback);
    } else {
      callback.call(result, null);
    }
  });

  return { db, sqlite, ai };
});

// Hoisted mocks
vi.mock('../../server/src/database/Database.js', () => ({
  getDatabase: () => mocks.db,
  default: mocks.db,
}));

vi.mock('../../server/src/database/sqliteAsync.js', () => mocks.sqlite);

vi.mock('../../server/src/services/aiService.js', () => ({
  getAiService: () => Promise.resolve(mocks.ai),
  default: {
    getAiService: () => Promise.resolve(mocks.ai),
    generateFirstValuePlan: (...args) => mocks.ai.generateFirstValuePlan(...args),
  },
}));

describe('Onboarding to Initiatives Link (Phase E->F)', () => {
  const testOrgId = 'org-test-123';
  const testUserId = 'user-test-456';

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generatePlan', () => {
    it('should generate a plan with a stable planId', async () => {
      mocks.sqlite.getAsync.mockResolvedValueOnce({
        transformation_context: JSON.stringify({ role: 'PM', problems: 'test' }),
        onboarding_plan_version: 1,
        onboarding_status: 'IN_PROGRESS',
        organization_type: 'PAID',
      });

      mocks.ai.generateFirstValuePlan.mockResolvedValueOnce({
        plan_title: 'Test Plan',
        steps: [],
        suggested_initiatives: [],
      });

      const result = await OnboardingService.generatePlan(testOrgId, testUserId);

      expect(result.planId).toBeDefined();
      expect(result.planId).toMatch(/^onbplan-org-test-123-v\d+$/);
      expect(result.plan.planId).toBe(result.planId);
    });
  });

  describe('acceptPlan', () => {
    it('should create initiatives with created_from_plan_id set', async () => {
      const mockPlan = {
        planId: 'onbplan-org-test-123-v2',
        steps: [],
        suggested_initiatives: [
          { id: 'init-0', title: 'Initiative 1', summary: 'Sum 1', hypothesis: 'Hyp 1' },
        ],
      };

      mocks.sqlite.getAsync.mockResolvedValueOnce({
        onboarding_plan_snapshot: JSON.stringify(mockPlan),
        onboarding_status: 'GENERATED',
        onboarding_accept_idempotency_key: null,
      });

      const insertCalls = [];
      mocks.sqlite.runAsync.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO initiatives')) {
          insertCalls.push({ sql, params });
        }
        return Promise.resolve({ changes: 1 });
      });

      const result = await OnboardingService.acceptPlan(testOrgId, testUserId, {});

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);

      expect(insertCalls.length).toBeGreaterThan(0);
      const initiativeInsert = insertCalls.find((c) => c.sql.includes('INSERT INTO initiatives'));
      expect(initiativeInsert).toBeDefined();
      expect(initiativeInsert.sql).toContain('created_from_plan_id');
      expect(initiativeInsert.params).toContain('onbplan-org-test-123-v2');
    });
  });

  describe('End-to-End: Plan Generation -> Acceptance -> Initiative Linkage', () => {
    it('should maintain created_from_plan_id through full flow', async () => {
      mocks.sqlite.getAsync.mockResolvedValueOnce({
        transformation_context: JSON.stringify({ role: 'PM', problems: 'test' }),
        onboarding_plan_version: 5,
        onboarding_status: 'IN_PROGRESS',
        organization_type: 'PAID',
      });

      mocks.ai.generateFirstValuePlan.mockResolvedValueOnce({
        plan_title: 'E2E Plan',
        steps: [],
        suggested_initiatives: [
          { id: 'init-e2e', title: 'E2E Init', summary: 'S', hypothesis: 'H' },
        ],
      });

      const genResult = await OnboardingService.generatePlan(testOrgId, testUserId);

      mocks.sqlite.getAsync.mockResolvedValueOnce({
        onboarding_plan_snapshot: JSON.stringify(genResult.plan),
        onboarding_status: 'GENERATED',
        onboarding_accept_idempotency_key: null,
      });

      const insertCalls = [];
      mocks.sqlite.runAsync.mockImplementation((sql, params) => {
        if (sql.includes('INSERT INTO initiatives')) {
          insertCalls.push(params);
        }
        return Promise.resolve({ changes: 1 });
      });

      const accResult = await OnboardingService.acceptPlan(testOrgId, testUserId, {});

      expect(accResult.success).toBe(true);
      for (const params of insertCalls) {
        expect(params).toContain('onbplan-org-test-123-v6');
      }
    });
  });
});
