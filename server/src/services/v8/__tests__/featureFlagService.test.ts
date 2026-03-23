import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

// ==========================================
// HOISTED MOCKS (vi.mock factories are hoisted above imports)
// ==========================================

const { mockDbRun, mockDbGet, mockDbAll, mockTableExists, mockFeatureFlags } = vi.hoisted(() => ({
  mockDbRun: vi.fn().mockResolvedValue({ success: true }),
  mockDbGet: vi.fn().mockResolvedValue(null),
  mockDbAll: vi.fn().mockResolvedValue([]),
  mockTableExists: vi.fn().mockResolvedValue(true),
  mockFeatureFlags: {
    ENABLE_V8_GLOBAL: true,
    ENABLE_V8_SHADOW_MODE: false,
  },
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
  tableExists: (...args: unknown[]) => mockTableExists(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../config/FeatureFlags.js', () => ({
  featureFlags: mockFeatureFlags,
}));

import {
  isV8Enabled,
  getV8Flags,
  setV8OrgFlag,
  isV8ShadowMode,
  getAllOrgFlags,
  clearFlagCache,
} from '../featureFlagService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const USER_ID = '00000000-0000-4000-8000-000000000003';

// ==========================================
// TESTS
// ==========================================

describe('featureFlagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFlagCache();
    mockFeatureFlags.ENABLE_V8_GLOBAL = true;
    mockFeatureFlags.ENABLE_V8_SHADOW_MODE = false;
    mockTableExists.mockResolvedValue(true);
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue({ success: true });
  });

  // ==========================================
  // isV8Enabled
  // ==========================================

  describe('isV8Enabled', () => {
    it('returns false when ENABLE_V8_GLOBAL is off', async () => {
      mockFeatureFlags.ENABLE_V8_GLOBAL = false;

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(false);
      expect(mockTableExists).not.toHaveBeenCalled();
    });

    it('returns false when global is on but flag table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns false when global is on, table exists, but org has no flags', async () => {
      mockDbAll.mockResolvedValue([]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns true when org has at least one enabled module', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(true);
    });

    it('returns false when all org modules are disabled', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 0 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns true for a specific enabled module', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID, 'chat');

      expect(result).toBe(true);
    });

    it('returns false for a specific disabled module', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID, 'finance');

      expect(result).toBe(false);
    });

    it('rejects invalid UUID for organizationId', async () => {
      await expect(isV8Enabled('not-a-uuid')).rejects.toThrow(ZodError);
    });
  });

  // ==========================================
  // getV8Flags
  // ==========================================

  describe('getV8Flags', () => {
    it('returns empty object when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      const flags = await getV8Flags(ORG_ID);

      expect(flags).toEqual({});
    });

    it('returns parsed flags from DB rows', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
        { module: 'results', enabled: 1 },
      ]);

      const flags = await getV8Flags(ORG_ID);

      expect(flags).toEqual({ chat: true, finance: false, results: true });
    });

    it('uses cache on second call', async () => {
      mockDbAll.mockResolvedValue([{ module: 'chat', enabled: 1 }]);

      const first = await getV8Flags(ORG_ID);
      const second = await getV8Flags(ORG_ID);

      expect(first).toEqual(second);
      // tableExists called once for first call, not again for cached second call
      // (first call: flagTableExists + dbAll; second call: cache hit)
      expect(mockDbAll).toHaveBeenCalledTimes(1);
    });

    it('cache is per-org', async () => {
      mockDbAll
        .mockResolvedValueOnce([{ module: 'chat', enabled: 1 }])
        .mockResolvedValueOnce([{ module: 'finance', enabled: 1 }]);

      const flagsOrg1 = await getV8Flags(ORG_ID);
      const flagsOrg2 = await getV8Flags(OTHER_ORG_ID);

      expect(flagsOrg1).toEqual({ chat: true });
      expect(flagsOrg2).toEqual({ finance: true });
      expect(mockDbAll).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid UUID', async () => {
      await expect(getV8Flags('bad')).rejects.toThrow(ZodError);
    });
  });

  // ==========================================
  // setV8OrgFlag
  // ==========================================

  describe('setV8OrgFlag', () => {
    it('inserts/upserts a flag and clears cache', async () => {
      // Pre-populate cache
      mockDbAll.mockResolvedValue([{ module: 'chat', enabled: 0 }]);
      await getV8Flags(ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(1);

      await setV8OrgFlag(ORG_ID, 'chat', true, USER_ID);

      expect(mockDbRun).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDbRun.mock.calls[0];
      expect(sql).toContain('INSERT INTO v8_feature_flags');
      expect(params[0]).toBe(`${ORG_ID}:chat`);
      expect(params[1]).toBe(ORG_ID);
      expect(params[2]).toBe('chat');
      expect(params[3]).toBe(1); // enabled = true → 1

      // Cache should be cleared — next getV8Flags should hit DB again
      mockDbAll.mockResolvedValue([{ module: 'chat', enabled: 1 }]);
      await getV8Flags(ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(2);
    });

    it('throws when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      await expect(setV8OrgFlag(ORG_ID, 'chat', true)).rejects.toThrow(
        /v8_feature_flags table does not exist/,
      );
    });

    it('rejects invalid module name', async () => {
      await expect(setV8OrgFlag(ORG_ID, 'invalid_module' as any, true)).rejects.toThrow(ZodError);
    });

    it('rejects invalid UUID', async () => {
      await expect(setV8OrgFlag('not-uuid', 'chat', true)).rejects.toThrow(ZodError);
    });
  });

  // ==========================================
  // isV8ShadowMode
  // ==========================================

  describe('isV8ShadowMode', () => {
    it('returns false when ENABLE_V8_SHADOW_MODE is off', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = false;

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
      expect(mockTableExists).not.toHaveBeenCalled();
    });

    it('returns false when table does not exist', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockTableExists.mockResolvedValue(false);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns true when shadow_mode row is enabled', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue({ enabled: 1 });

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(true);
    });

    it('returns false when shadow_mode row is disabled', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue({ enabled: 0 });

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns false when no shadow_mode row exists', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue(null);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
    });

    it('rejects invalid UUID', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      await expect(isV8ShadowMode('bad-id')).rejects.toThrow(ZodError);
    });
  });

  // ==========================================
  // getAllOrgFlags
  // ==========================================

  describe('getAllOrgFlags', () => {
    it('returns empty array when table does not exist', async () => {
      mockTableExists.mockResolvedValue(false);

      const result = await getAllOrgFlags();

      expect(result).toEqual([]);
    });

    it('maps DB rows to typed objects', async () => {
      mockDbAll.mockResolvedValue([
        { organization_id: ORG_ID, module: 'chat', enabled: 1, updated_at: '2026-03-24T00:00:00Z' },
        { organization_id: ORG_ID, module: 'finance', enabled: 0, updated_at: '2026-03-24T01:00:00Z' },
      ]);

      const result = await getAllOrgFlags();

      expect(result).toEqual([
        { organizationId: ORG_ID, module: 'chat', enabled: true, updatedAt: '2026-03-24T00:00:00Z' },
        { organizationId: ORG_ID, module: 'finance', enabled: false, updatedAt: '2026-03-24T01:00:00Z' },
      ]);
    });
  });

  // ==========================================
  // clearFlagCache
  // ==========================================

  describe('clearFlagCache', () => {
    it('clears cache for a specific org', async () => {
      mockDbAll.mockResolvedValue([{ module: 'chat', enabled: 1 }]);
      await getV8Flags(ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(1);

      clearFlagCache(ORG_ID);

      await getV8Flags(ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(2);
    });

    it('clears all caches when no orgId provided', async () => {
      mockDbAll
        .mockResolvedValueOnce([{ module: 'chat', enabled: 1 }])
        .mockResolvedValueOnce([{ module: 'finance', enabled: 1 }]);

      await getV8Flags(ORG_ID);
      await getV8Flags(OTHER_ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(2);

      clearFlagCache();

      mockDbAll
        .mockResolvedValueOnce([{ module: 'chat', enabled: 1 }])
        .mockResolvedValueOnce([{ module: 'finance', enabled: 1 }]);

      await getV8Flags(ORG_ID);
      await getV8Flags(OTHER_ORG_ID);
      expect(mockDbAll).toHaveBeenCalledTimes(4);
    });
  });
});
