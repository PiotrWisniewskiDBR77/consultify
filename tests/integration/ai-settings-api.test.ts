import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbGet, dbRun } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('uuid', () => ({ v4: () => 'u1' }));

describe('AI settings service - REAL_CODE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    vi.resetModules();
  });

  it('getSuperAdminSettings returns defaults when DB row is missing', async () => {
    const AISettingsService = (await import('../../server/src/services/aiSettingsService.ts'))
      .default;
    const settings = await AISettingsService.getSuperAdminSettings();
    expect(settings).toEqual(expect.objectContaining({ default_provider: expect.any(String) }));
  });

  it('updateSuperAdminSettings writes settings and audit entry', async () => {
    const AISettingsService = (await import('../../server/src/services/aiSettingsService.ts'))
      .default;
    await AISettingsService.updateSuperAdminSettings(
      { default_provider: 'gpt-4o-mini' },
      { actorId: 'u1', actorRole: 'SUPERADMIN' }
    );
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO superadmin_ai_settings'),
      expect.any(Array)
    );
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_settings_audit'),
      expect.any(Array)
    );
  });

  it('getEffectiveSettings merges superadmin + org + user overrides', async () => {
    dbGet
      .mockResolvedValueOnce({ id: 'global', default_provider: 'x', fallback_chain: '[]' }) // superadmin
      .mockResolvedValueOnce({ organization_id: 'org-1', policy_level: 'ASSISTED' }) // org
      .mockResolvedValueOnce({ user_id: 'u1', response_style: 'concise' }); // user

    const AISettingsService = (await import('../../server/src/services/aiSettingsService.ts'))
      .default;
    const eff = await AISettingsService.getEffectiveSettings('u1', 'org-1');
    expect(eff.policy_level).toBe('ASSISTED');
    expect(eff.response_style).toBe('concise');
    expect(eff.default_provider).toBeDefined();
  });

  it('generateComplianceReport rejects unavailable PDF export explicitly', async () => {
    const AISettingsService = (await import('../../server/src/services/aiSettingsService.ts'))
      .default;
    await expect(AISettingsService.generateComplianceReport('org-1', 'SOC2', 'pdf')).rejects.toMatchObject({
      statusCode: 503,
      code: 'FEATURE_UNAVAILABLE',
    });
  });

  it('getAuditLog queries audit table with paging', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'a1' }]);
    dbGet.mockResolvedValueOnce({ total: 1 });
    const AISettingsService = (await import('../../server/src/services/aiSettingsService.ts'))
      .default;
    const res = await AISettingsService.getAuditLog({ limit: 10, offset: 0 });
    expect(res).toEqual(expect.objectContaining({ total: 1, rows: expect.any(Array) }));
  });
});
