import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  clearFlagCache,
  getAllOrgFlags,
  getV8Flags,
  isV8Enabled,
  isV8ShadowMode,
  setV8OrgFlag,
} from '../featureFlagService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const TENANT_ORG_ID = 'dbr77';
const USER_ID = '00000000-0000-4000-8000-000000000003';

// ==========================================
// TESTS
// ==========================================

describe('featureFlagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearFlagCache();
    process.env.NODE_ENV = 'test';
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

    it('returns true when global is on, table exists, but org has no explicit flags yet in non-production', async () => {
      mockDbAll.mockResolvedValue([]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(true);
    });

    it('returns true when org has at least one enabled module', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(true);
    });

    it('returns false when all org modules are explicitly disabled', async () => {
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

    it('returns false for a specific explicitly disabled module', async () => {
      mockDbAll.mockResolvedValue([
        { module: 'chat', enabled: 1 },
        { module: 'finance', enabled: 0 },
      ]);

      const result = await isV8Enabled(ORG_ID, 'finance');

      expect(result).toBe(false);
    });

    it('returns false in production when org has no explicit flags yet', async () => {
      process.env.NODE_ENV = 'production';
      mockDbAll.mockResolvedValue([]);

      const result = await isV8Enabled(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns true for a specific module when no explicit flags exist yet in non-production', async () => {
      mockDbAll.mockResolvedValue([]);

      const result = await isV8Enabled(ORG_ID, 'chat');

      expect(result).toBe(true);
    });

    it('returns false for a specific module in production when no explicit flags exist yet', async () => {
      process.env.NODE_ENV = 'production';
      mockDbAll.mockResolvedValue([]);

      const result = await isV8Enabled(ORG_ID, 'chat');

      expect(result).toBe(false);
    });

    it('accepts tenant-style organization ids', async () => {
      mockDbAll.mockResolvedValue([{ module: 'chat', enabled: 1 }]);

      const result = await isV8Enabled(TENANT_ORG_ID);

      expect(result).toBe(true);
      expect(mockDbAll).toHaveBeenCalledWith(expect.any(String), [TENANT_ORG_ID], {
        fallback: false,
      });
    });

    it('rejects blank organizationId', async () => {
      await expect(isV8Enabled('')).rejects.toThrow();
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

    it('falls back to the original public migration table when the v8 schema table is absent', async () => {
      mockDbAll
        .mockRejectedValueOnce(new Error('relation "v8.v8_feature_flags" does not exist'))
        .mockResolvedValueOnce([{ module: 'workspace', enabled: 1 }]);

      await expect(getV8Flags(ORG_ID)).resolves.toEqual({ workspace: true });
      expect(mockDbAll.mock.calls[0]?.[0]).toContain('v8.v8_feature_flags');
      expect(mockDbAll.mock.calls[1]?.[0]).toContain('FROM v8_feature_flags');
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

    it('accepts tenant-style organization ids', async () => {
      mockDbAll.mockResolvedValue([{ module: 'results', enabled: 1 }]);

      const flags = await getV8Flags(TENANT_ORG_ID);

      expect(flags).toEqual({ results: true });
      expect(mockDbAll).toHaveBeenCalledWith(expect.any(String), [TENANT_ORG_ID], {
        fallback: false,
      });
    });

    it('rejects blank organizationId', async () => {
      await expect(getV8Flags('   ')).rejects.toThrow();
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
      expect(sql).toContain('INSERT INTO v8.v8_feature_flags');
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
        /v8_feature_flags table does not exist/
      );
    });

    it('upserts into the original public migration table when the v8 schema table is absent', async () => {
      mockDbRun
        .mockRejectedValueOnce(new Error('relation "v8.v8_feature_flags" does not exist'))
        .mockResolvedValueOnce({ success: true });

      await setV8OrgFlag(ORG_ID, 'workspace', true, USER_ID);

      expect(mockDbRun).toHaveBeenCalledTimes(2);
      expect(mockDbRun.mock.calls[0]?.[0]).toContain('INSERT INTO v8.v8_feature_flags');
      expect(mockDbRun.mock.calls[1]?.[0]).toContain('INSERT INTO v8_feature_flags');
    });

    it('rejects invalid module name', async () => {
      await expect(setV8OrgFlag(ORG_ID, 'invalid_module' as any, true)).rejects.toThrow();
    });

    it('accepts tenant-style organization ids', async () => {
      await setV8OrgFlag(TENANT_ORG_ID, 'chat', true);

      expect(mockDbRun).toHaveBeenCalledTimes(1);
      expect(mockDbRun.mock.calls[0]?.[1]?.[0]).toBe(`${TENANT_ORG_ID}:chat`);
      expect(mockDbRun.mock.calls[0]?.[1]?.[1]).toBe(TENANT_ORG_ID);
    });

    it('rejects blank organizationId', async () => {
      await expect(setV8OrgFlag('', 'chat', true)).rejects.toThrow();
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

    it('returns true when table does not exist in non-production', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockTableExists.mockResolvedValue(false);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(true);
    });

    it('accepts tenant-style organization ids', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue({ enabled: 1 });

      const result = await isV8ShadowMode(TENANT_ORG_ID);

      expect(result).toBe(true);
      expect(mockDbGet).toHaveBeenCalledWith(expect.any(String), [TENANT_ORG_ID], {
        fallback: false,
      });
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

    it('returns true when no shadow_mode row exists in non-production', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue(null);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(true);
    });

    it('returns false in production when table does not exist', async () => {
      process.env.NODE_ENV = 'production';
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockTableExists.mockResolvedValue(false);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
    });

    it('returns false in production when no shadow_mode row exists', async () => {
      process.env.NODE_ENV = 'production';
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      mockDbGet.mockResolvedValue(null);

      const result = await isV8ShadowMode(ORG_ID);

      expect(result).toBe(false);
    });

    it('rejects blank organizationId', async () => {
      mockFeatureFlags.ENABLE_V8_SHADOW_MODE = true;
      await expect(isV8ShadowMode('')).rejects.toThrow();
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
        {
          organization_id: ORG_ID,
          module: 'finance',
          enabled: 0,
          updated_at: '2026-03-24T01:00:00Z',
        },
      ]);

      const result = await getAllOrgFlags();

      expect(result).toEqual([
        {
          organizationId: ORG_ID,
          module: 'chat',
          enabled: true,
          updatedAt: '2026-03-24T00:00:00Z',
        },
        {
          organizationId: ORG_ID,
          module: 'finance',
          enabled: false,
          updatedAt: '2026-03-24T01:00:00Z',
        },
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
