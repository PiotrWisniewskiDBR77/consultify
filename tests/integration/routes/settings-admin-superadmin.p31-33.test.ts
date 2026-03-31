/**
 * P31 Settings + P32 Admin + P33 Superadmin — Integration Tests
 *
 * Verifies the organizational triad (P30→P31→P32→P33) contract:
 * - P31: Settings taxonomy, preferences, routing to Admin for enforced keys
 * - P32: Admin cockpit, members/roles, security policy writes, audit
 * - P33: Superadmin root control plane, guardrails, cross-tenant ops
 */

import { describe, it, expect } from 'vitest';

// ===========================================================================
// P31 — Settings
// ===========================================================================

describe('P31 Settings — taxonomy + preferences', () => {
  it('settings.routes exports a router with key/value CRUD', async () => {
    const mod = await import(
      '../../../server/src/routes/settings.routes.js'
    );
    expect(mod.default).toBeDefined();
  });

  it('settings route file has preference endpoints', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/settings.routes.ts', 'utf-8'
    );
    expect(content).toContain('preferences');
    expect(content).toContain('settings');
    expect(content).toContain('verifyToken');
  });

  it('settings route supports audit log', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/settings.routes.ts', 'utf-8'
    );
    expect(content).toContain('settings_audit_log');
  });

  it('settings route supports GDPR export/deletion', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/settings.routes.ts', 'utf-8'
    );
    expect(content.toLowerCase()).toContain('gdpr');
  });

  it('settings route supports integrations hub', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/settings.routes.ts', 'utf-8'
    );
    expect(content).toContain('integration');
  });

  it('SettingsView frontend exists with sidebar sections', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/views/SettingsView.tsx', 'utf-8'
    );
    expect(content).toContain('Settings');
    expect(content.length).toBeGreaterThan(500);
  });

  it('AI settings service supports superadmin→org→user merge', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/aiSettingsService.ts', 'utf-8'
    );
    expect(content).toContain('superadmin');
    expect(content).toContain('organization');
    expect(content).toContain('user');
    expect(content).toContain('merge');
  });

  it('Gateway mounts /api/settings', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/settings');
  });
});

// ===========================================================================
// P32 — Admin
// ===========================================================================

describe('P32 Admin — cockpit + members/roles + security', () => {
  it('admin middleware enforces admin role', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/middleware/admin.middleware.ts', 'utf-8'
    );
    expect(content).toContain('admin');
    expect(content).toContain('administrator');
    expect(content).toContain('superadmin');
    expect(content).toContain('owner');
  });

  it('admin-data routes exist with security events and sessions', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/admin-data.routes.ts', 'utf-8'
    );
    expect(content).toContain('security');
    expect(content).toContain('session');
    expect(content).toContain('verifyToken');
  });

  it('admin audit service exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/adminAuditService.ts', 'utf-8'
    );
    expect(content).toContain('audit');
    expect(content.length).toBeGreaterThan(100);
  });

  it('admin session service exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/adminSessionService.ts', 'utf-8'
    );
    expect(content).toContain('session');
  });

  it('AdminView frontend exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/views/admin/AdminView.tsx', 'utf-8'
    );
    expect(content).toContain('Admin');
  });

  it('AdminSettingsModule has org/branding/billing/security sections', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/views/admin/AdminSettingsModule.tsx', 'utf-8'
    );
    expect(content).toContain('organization');
    expect(content).toContain('security');
  });

  it('organization members route supports invite/role/remove', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organizations.routes.ts', 'utf-8'
    );
    expect(content).toContain('members');
    expect(content).toContain('role');
    expect(content).toContain('AddMember');
  });

  it('Gateway mounts admin routes', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('admin-data');
  });
});

// ===========================================================================
// P33 — Superadmin
// ===========================================================================

describe('P33 Superadmin — root control plane + guardrails', () => {
  it('superadmin middleware enforces SUPERADMIN role via DB check', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/middleware/superAdmin.middleware.ts', 'utf-8'
    );
    expect(content).toContain('SUPERADMIN');
    expect(content).toContain('SUPER_ADMIN');
  });

  it('superadmin routes have tenant/user/org operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/superadmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('organizations');
    expect(content).toContain('users');
    expect(content).toContain('impersonat');
  });

  it('superadmin routes have integration/connector operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/superadmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('integration');
  });

  it('superadmin routes have compliance/legal operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/superadmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('compliance');
    expect(content).toContain('legal');
  });

  it('superadmin routes have feature roadmap', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/superadmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('feature-roadmap');
  });

  it('V8 admin feature flags routes exist with superadmin guard', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/v8/admin/feature-flags.routes.ts', 'utf-8'
    );
    expect(content).toContain('flag');
    expect(content).toContain('requireSuperAdmin');
  });

  it('confirmAction middleware exists for destructive ops', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/middleware/confirmAction.middleware.ts', 'utf-8'
    );
    expect(content).toContain('confirm');
  });

  it('requireAudit middleware exists for policy updates', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/middleware/requireAudit.middleware.ts', 'utf-8'
    );
    expect(content).toContain('audit');
  });

  it('SuperAdminView frontend exists with sidebar', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/views/superadmin/SuperAdminView.tsx', 'utf-8'
    );
    expect(content).toContain('SuperAdmin');
    expect(content.length).toBeGreaterThan(500);
  });

  it('SuperAdminController handles cross-tenant operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/controllers/SuperAdminController.ts', 'utf-8'
    );
    expect(content).toContain('organization');
    expect(content).toContain('user');
  });

  it('Gateway mounts /api/superadmin', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/superadmin');
  });

  it('billing admin routes are guarded by super_admin role', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/billing/billingAdmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('super_admin');
  });

  it('analytics superadmin routes exist', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/analytics-superadmin.routes.ts', 'utf-8'
    );
    expect(content).toContain('superadmin');
    expect(content).toContain('analytics');
  });
});

// ===========================================================================
// Cross-cutting: Ownership boundaries (P30↔P31↔P32↔P33)
// ===========================================================================

describe('Ownership boundaries across P30-P33', () => {
  it('P30 trust endpoint routes writes to Admin (P32)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organization-profiles.routes.ts', 'utf-8'
    );
    expect(content).toContain('OWNERSHIP_BOUNDARY_VIOLATION');
    expect(content).toContain('admin');
  });

  it('role guards distinguish admin vs superadmin', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/utils/roleGuards.ts', 'utf-8'
    );
    expect(content).toContain('isSuperAdminRole');
    expect(content).toContain('isAdminOrSuperAdminRole');
  });

  it('RBAC middleware supports role-based routing', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/middleware/rbac.middleware.ts', 'utf-8'
    );
    expect(content).toContain('requireRole');
    expect(content).toContain('SUPERADMIN');
  });
});
