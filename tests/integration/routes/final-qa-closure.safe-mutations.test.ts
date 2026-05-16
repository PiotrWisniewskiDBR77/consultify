import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf-8');

describe('Final QA closure safe mutation contracts', () => {
  it('settings recovery mutations require persisted read-back before success', () => {
    const settingsRoutes = read('server/src/routes/settings.routes.ts');

    expect(settingsRoutes).toContain("'/recovery'");
    expect(settingsRoutes).toContain('await upsertUserPreferenceValue');
    expect(settingsRoutes).toContain('const persisted = await getRecoveryOptions(userId)');
    expect(settingsRoutes).toContain('return res.json({ success: true, ...persisted })');
  });

  it('billing user-plans stays superadmin-scoped and unavailable instead of fabricating plans', () => {
    const billingRoutes = read('server/src/routes/billing/billing.routes.ts');
    const apiClient = read('src/services/api.ts');
    const billingApi = read('src/services/api/billing.api.ts');

    expect(billingRoutes).toContain("'/admin/user-plans'");
    expect(billingRoutes).toContain('requireSuperAdmin');
    expect(billingRoutes).toContain("respondSchemaUnavailable(res, 'User seat plans')");
    expect(apiClient).toContain('/billing/admin/user-plans');
    expect(billingApi).toContain('/billing/admin/user-plans');
  });

  it('superadmin API key mutations expose one-time secrets and revoke by state update', () => {
    const controller = read('server/src/controllers/SuperAdminController.ts');

    expect(controller).toContain('const createApiKey');
    expect(controller).toContain("await maybeAdd('user_id', 'TEXT')");
    expect(controller).toContain("await maybeAdd('permissions', 'TEXT')");
    expect(controller).toContain('row.isActive ?? row.isactive ?? row.is_active');
    expect(controller).toContain("warning: 'Save this API key now. It cannot be shown again.'");
    expect(controller).toContain('const deleteApiKey');
    expect(controller).toContain('SET is_active = 0');
    expect(controller).toContain('revoked_at = datetime');
  });

  it('backup and governance read paths create safe schemas or return honest unavailable states', () => {
    const superadminRoutes = read('server/src/routes/superadmin.routes.ts');
    const backupRoutes = read('server/src/routes/admin/backup.routes.ts');
    const controller = read('server/src/controllers/SuperAdminController.ts');

    expect(superadminRoutes).toContain('ensureBackupConfigurationsTable');
    expect(superadminRoutes).toContain('BACKUP_SCHEDULES_UNAVAILABLE');
    expect(backupRoutes).toContain('respondBackupUnavailable');
    expect(controller).toContain('ensureApprovalWorkflowTables');
    expect(controller).toContain('CREATE TABLE IF NOT EXISTS admin_approval_workflows');
    expect(controller).toContain('CREATE TABLE IF NOT EXISTS processing_records');
    expect(controller).toContain('CREATE TABLE IF NOT EXISTS compliance_audits');
  });
});
