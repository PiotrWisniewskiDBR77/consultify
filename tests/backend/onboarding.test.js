import { describe, test, expect, vi, afterEach } from 'vitest';
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

describe('Onboarding Service Verification', () => {
  const mockOrgId = 'org-123';
  const mockUserId = 'user-456';

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('saveContext', () => {
    test('Should validate and update organization context', async () => {
      mocks.sqlite.runAsync.mockResolvedValue({ changes: 1 });

      const context = { role: 'CTO', problems: 'Scaling', industry: 'Tech' };
      const result = await OnboardingService.saveContext(mockOrgId, context);

      expect(result.success).toBe(true);
      expect(result.status).toBe('IN_PROGRESS');
      expect(mocks.sqlite.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE organizations'),
        expect.arrayContaining([expect.any(String), mockOrgId])
      );
    });

    test('Should reject context without required fields', async () => {
      await expect(OnboardingService.saveContext(mockOrgId, {})).rejects.toThrow(
        'Missing required field'
      );
    });
  });

  describe('generatePlan', () => {
    test('Should fetch context and call AI Service', async () => {
      const mockContext = {
        role: 'CEO',
        industry: 'Tech',
        problems: 'Growth',
        urgency: 'High',
        targets: 'Revenue',
      };

      mocks.sqlite.getAsync.mockResolvedValue({
        transformation_context: JSON.stringify(mockContext),
        onboarding_plan_version: 0,
        organization_type: 'PAID',
      });

      mocks.sqlite.runAsync.mockResolvedValue({ changes: 1 });

      const mockPlan = {
        plan_title: 'Growth Plan',
        steps: [{ title: 'Step 1' }],
        suggested_initiatives: [{ title: 'Init 1' }],
      };
      mocks.ai.generateFirstValuePlan.mockResolvedValue(mockPlan);

      const result = await OnboardingService.generatePlan(mockOrgId, mockUserId);

      expect(mocks.sqlite.getAsync).toHaveBeenCalled();
      expect(mocks.ai.generateFirstValuePlan).toHaveBeenCalledWith(mockContext, mockUserId);
      expect(result.plan).toBeDefined();
      expect(result.planVersion).toBe(1);
    });
  });

  describe('acceptPlan', () => {
    test('Should create initiatives with idempotency', async () => {
      const mockPlan = {
        suggested_initiatives: [
          { id: 'init-0', title: 'Init 1', summary: 'S1', hypothesis: 'H1' },
          { id: 'init-1', title: 'Init 2', summary: 'S2', hypothesis: 'H2' },
        ],
      };

      mocks.sqlite.getAsync.mockResolvedValue({
        onboarding_plan_snapshot: JSON.stringify(mockPlan),
        onboarding_status: 'GENERATED',
        onboarding_accept_idempotency_key: null,
      });

      mocks.sqlite.runAsync.mockResolvedValue({ changes: 1 });

      const result = await OnboardingService.acceptPlan(mockOrgId, mockUserId, {
        acceptedInitiativeIds: ['init-0', 'init-1'],
        idempotencyKey: 'test-key-123',
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(2);
      expect(result.idempotent).toBe(false);
    });

    test('Should be idempotent on duplicate request', async () => {
      mocks.sqlite.getAsync.mockResolvedValue({
        onboarding_plan_snapshot: '{}',
        onboarding_status: 'GENERATED',
        onboarding_accept_idempotency_key: 'test-key-123',
      });

      const result = await OnboardingService.acceptPlan(mockOrgId, mockUserId, {
        idempotencyKey: 'test-key-123',
      });

      expect(result.success).toBe(true);
      expect(result.idempotent).toBe(true);
      expect(result.createdCount).toBe(0);
    });
  });
});
