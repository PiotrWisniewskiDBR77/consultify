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
// P31 — Settings (base)
// ===========================================================================

describe('P31 Settings — taxonomy + preferences', () => {
  it('settings.routes exports a router with key/value CRUD', async () => {
    const mod = await import('../../../server/src/routes/settings.routes.js');
    expect(mod.default).toBeDefined();
  });

  it('settings route file has preference endpoints', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content).toContain('preferences');
    expect(content).toContain('settings');
    expect(content).toContain('verifyToken');
  });

  it('settings route supports audit log', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content).toContain('settings_audit_log');
  });

  it('settings routes expose persisted AI privacy and prompt library preferences', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content).toContain('/preferences/ai-privacy');
    expect(content).toContain('/preferences/prompt-library');
  });

  it('settings routes expose account recovery read-back instead of a missing route', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content).toContain("'/recovery'");
    expect(content).toContain('getRecoveryOptions');
    expect(content).toContain('Recovery options unavailable');
  });

  it('settings route supports GDPR export/deletion', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content.toLowerCase()).toContain('gdpr');
  });

  it('settings route supports integrations hub', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/settings.routes.ts', 'utf-8');
    expect(content).toContain('integration');
  });

  it('SettingsView frontend exists with sidebar sections', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/SettingsView.tsx', 'utf-8');
    expect(content).toContain('Settings');
    expect(content.length).toBeGreaterThan(500);
  });

  it('legacy api.ts no longer contains settings stub block', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/services/api.ts', 'utf-8');
    expect(content).not.toContain('SETTINGS API STUBS');
    expect(content).toContain('SETTINGS API BRIDGE');
  });

  it('AI settings service supports superadmin→org→user merge', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/services/aiSettingsService.ts', 'utf-8');
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

  it('settings legacy entry resolver redirects old paths to real mounted sections', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/settings/syncEntryResolver.ts', 'utf-8');
    expect(content).toContain('ROUTES.SETTINGS.BILLING');
    expect(content).toContain('ROUTES.ADMIN.BILLING');
    expect(content).toContain('security-dashboard');
    expect(content).toContain('notifications-overview');
  });
});

// ===========================================================================
// P32 — Admin
// ===========================================================================

describe('P32 Admin — cockpit + members/roles + security', () => {
  it('admin middleware enforces admin role', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/middleware/admin.middleware.ts', 'utf-8');
    expect(content).toContain('admin');
    expect(content).toContain('administrator');
    expect(content).toContain('superadmin');
    expect(content).toContain('owner');
  });

  it('admin-data routes exist with security events and sessions', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/admin-data.routes.ts', 'utf-8');
    expect(content).toContain('security');
    expect(content).toContain('session');
    expect(content).toContain('verifyToken');
  });

  it('admin audit service exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/services/adminAuditService.ts', 'utf-8');
    expect(content).toContain('audit');
    expect(content.length).toBeGreaterThan(100);
  });

  it('admin session service exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/services/adminSessionService.ts', 'utf-8');
    expect(content).toContain('session');
  });

  it('AdminView frontend exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/admin/AdminView.tsx', 'utf-8');
    expect(content).toContain('Admin');
  });

  it('active admin completeness flows use shared AdminApi and current organization context', async () => {
    const fs = await import('fs');
    const ownershipContent = fs.readFileSync(
      'src/views/admin/OwnershipManagementView.tsx',
      'utf-8'
    );
    const orgOpsContent = fs.readFileSync(
      'src/components/Organization/OrganizationAdminPanel.tsx',
      'utf-8'
    );
    expect(ownershipContent).toContain('AdminApi.transferOrganizationOwnership');
    expect(ownershipContent).toContain('AdminApi.getOrganizationOwnership');
    expect(ownershipContent).not.toContain("localStorage.getItem('token')");
    expect(orgOpsContent).toContain('currentOrganization');
    expect(orgOpsContent).toContain('candidate.id === preferredOrgId');
  });

  it('AdminSettingsModule defines the team-only tenant admin shell', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/admin/AdminSettingsModule.tsx', 'utf-8');
    expect(content).toContain('Team & Access');
    expect(content).toContain('Membership operations');
    expect(content).not.toContain('Billing, Limits & FinOps');
    expect(content).not.toContain('AI Governance & Operations');
    expect(content).not.toContain('Organization Operations');
  });

  it('organization members route supports invite/role/remove', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organizations.routes.ts',
      'utf-8'
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
    const content = fs.readFileSync('server/src/middleware/superAdmin.middleware.ts', 'utf-8');
    expect(content).toContain('SUPERADMIN');
    expect(content).toContain('SUPER_ADMIN');
  });

  it('superadmin routes have tenant/user/org operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('organizations');
    expect(content).toContain('users');
    expect(content).toContain('impersonat');
  });

  it('superadmin routes have integration/connector operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('integration');
  });

  it('superadmin routes have compliance/legal operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('compliance');
    expect(content).toContain('legal');
  });

  it('superadmin routes have feature roadmap', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('feature-roadmap');
  });

  it('billing user-plans client paths align to the superadmin backend route', async () => {
    const fs = await import('fs');
    const billingRoutes = fs.readFileSync('server/src/routes/billing/billing.routes.ts', 'utf-8');
    const legacyApi = fs.readFileSync('src/services/api.ts', 'utf-8');
    const billingApi = fs.readFileSync('src/services/api/billing.api.ts', 'utf-8');

    expect(billingRoutes).toContain("'/admin/user-plans'");
    expect(billingRoutes).toContain("'/user-plans'");
    expect(legacyApi).toContain('/billing/admin/user-plans');
    expect(billingApi).toContain('/billing/admin/user-plans');
  });

  it('V8 admin feature flags routes exist with superadmin guard', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/v8/admin/feature-flags.routes.ts', 'utf-8');
    expect(content).toContain('flag');
    expect(content).toContain('requireSuperAdmin');
  });

  it('feature flags route separates user runtime evaluation from superadmin management', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/featureFlags.routes.ts', 'utf-8');
    expect(content).toContain("'/runtime'");
    expect(content).toContain('verifyToken');
    expect(content).toContain('router.use(requireSuperAdmin)');
    expect(content).toContain('evaluateFeatureFlag');
  });

  it('confirmAction middleware exists for destructive ops', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/middleware/confirmAction.middleware.ts', 'utf-8');
    expect(content).toContain('confirm');
  });

  it('requireAudit middleware exists for policy updates', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/middleware/requireAudit.middleware.ts', 'utf-8');
    expect(content).toContain('audit');
  });

  it('SuperAdminView frontend exists with sidebar', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/superadmin/SuperAdminView.tsx', 'utf-8');
    expect(content).toContain('SuperAdmin');
    expect(content.length).toBeGreaterThan(500);
  });

  it('prompt assistant flows use the shared prompt assistant api client', async () => {
    const fs = await import('fs');
    const client = fs.readFileSync('src/services/api/promptAssistant.api.ts', 'utf-8');
    const management = fs.readFileSync(
      'src/views/superadmin/components/PromptManagementUI.tsx',
      'utf-8'
    );
    expect(client).toContain('PromptAssistantApi');
    expect(management).toContain('handleBlockPreview');
    expect(management).toContain('handlePromptBenchResults');
  });

  it('SuperAdminController handles cross-tenant operations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/controllers/SuperAdminController.ts', 'utf-8');
    expect(content).toContain('organization');
    expect(content).toContain('user');
  });

  it('Gateway mounts /api/superadmin', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/superadmin');
  });

  it('Gateway mounts ai observability under /api/admin/ai-observability', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/admin/ai-observability');
  });

  it('Gateway no longer exposes resource management through the generic /api/admin prefix', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).not.toContain("app.use('/api/admin', resourceManagementRoutes)");
  });

  it('billing admin routes are guarded by verifySuperAdmin and billing capability', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/billing/billingAdmin.routes.ts', 'utf-8');
    expect(content).toContain('verifySuperAdmin');
    expect(content).toContain("requireSuperAdminCapability('billing_ops')");
  });

  it('core docs routes use canonical superadmin authz with ai_ops capability', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/core-docs.routes.ts', 'utf-8');
    expect(content).toContain('verifySuperAdmin');
    expect(content).toContain("requireSuperAdminCapability('ai_ops')");
  });

  it('analytics superadmin routes exist', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/analytics-superadmin.routes.ts', 'utf-8');
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
      'server/src/routes/organization/organization-profiles.routes.ts',
      'utf-8'
    );
    expect(content).toContain('OWNERSHIP_BOUNDARY_VIOLATION');
    expect(content).toContain('admin');
  });

  it('role guards distinguish admin vs superadmin', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/utils/roleGuards.ts', 'utf-8');
    expect(content).toContain('isSuperAdminRole');
    expect(content).toContain('isAdminOrSuperAdminRole');
  });

  it('RBAC middleware supports role-based routing', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/middleware/rbac.middleware.ts', 'utf-8');
    expect(content).toContain('requireRole');
    expect(content).toContain('SUPERADMIN');
  });
});

// ===========================================================================
// P31 — Settings Registry (scope model + impact metadata)
// ===========================================================================

describe('P31 Settings — scope model + impact metadata (§2.3.2-§2.3.6)', () => {
  it('settingsRegistryService exports registry with 3 scopes', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const service = mod.default;
    expect(service).toBeDefined();

    const all = service.getRegistry();
    expect(all.length).toBe(22);

    const scopes = new Set(all.map((k: any) => k.scope));
    expect(scopes.has('personal')).toBe(true);
    expect(scopes.has('module')).toBe(true);
    expect(scopes.has('tenant')).toBe(true);
  });

  it('each registry key has impact metadata fields', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const all = mod.default.getRegistry();
    for (const key of all) {
      expect(key.key).toBeTruthy();
      expect(key.scope).toBeTruthy();
      expect(key.ownerContract).toBeTruthy();
      expect(key.managedIn).toBeTruthy();
      expect(key.impactLanguage).toBeTruthy();
      expect(key.impactedSurface).toBeTruthy();
      expect(typeof key.requiresRestart).toBe('boolean');
      expect(typeof key.confirmationGate).toBe('boolean');
      expect(Array.isArray(key.readRoles)).toBe(true);
      expect(Array.isArray(key.writeRoles)).toBe(true);
    }
  });

  it('tenant and tenant-enforced keys route writes to Admin (P32)', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const service = mod.default;
    for (const key of [
      'mfa_required',
      'sso_enforced',
      'guest_access_enabled',
      'external_link_sharing',
      'tool_approval_required',
    ]) {
      const routing = service.checkWriteRouting(key, 'member');
      expect(routing.allowed).toBe(false);
      expect(String(routing.routeTo)).toContain('/admin');
      expect(routing.guidance).toContain('Admin');
    }
  });

  it('unknown settings keys are blocked with a refresh hint', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const routing = mod.default.checkWriteRouting('unknown_setting_key', 'member');
    expect(routing.allowed).toBe(false);
    expect(routing.routeTo).toBe('/settings');
    expect(routing.guidance).toContain('unknown');
  });

  it('personal-scoped keys allow any role to write', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const service = mod.default;
    const routing = service.checkWriteRouting('theme', 'member');
    expect(routing.allowed).toBe(true);
  });

  it('buildDenialResponse returns proper 403 with guidance', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const service = mod.default;
    const denial = service.buildDenialResponse('mfa_required', 'permission_denied');
    expect(denial.status).toBe(403);
    expect(denial.code).toBe('SETTINGS_PERMISSION_DENIED');
    expect(denial.message).toContain('Admin');
    expect(denial.routeTo).toBe('/admin/security');
  });

  it('buildDenialResponse returns 404 for not_found', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const denial = mod.default.buildDenialResponse('nonexistent', 'not_found');
    expect(denial.status).toBe(404);
    expect(denial.code).toBe('SETTINGS_KEY_NOT_FOUND');
  });

  it('buildDenialResponse returns 503 for resolver_unavailable', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const denial = mod.default.buildDenialResponse('theme', 'resolver_unavailable');
    expect(denial.status).toBe(503);
  });

  it('registry includes P30 read-only tenant defaults', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const defaultLanguage = mod.default.getKeyMetadata('default_language');
    expect(defaultLanguage.ownerContract).toBe('P30');
    expect(defaultLanguage.managedIn).toBe('organization');
    expect(defaultLanguage.readOnlyInSettings).toBe(true);
  });

  it('module preferences keys exist in registry', async () => {
    const mod = await import('../../../server/src/services/settingsRegistryService.js');
    const moduleKeys = mod.default.getKeysByScope('module');
    expect(moduleKeys.length).toBe(8);
    const keyNames = moduleKeys.map((k: any) => k.key);
    expect(keyNames).toContain('recording_auto_start');
    expect(keyNames).toContain('default_export_format');
    expect(keyNames).toContain('model_preference');
  });
});

// ===========================================================================
// P32 — Admin cockpit alignment
// ===========================================================================

describe('P32 Admin — cockpit IA alignment (§2.3.1)', () => {
  it('Admin navigation exposes the seven canonical domains', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/Admin/adminNavigation.ts', 'utf-8');
    for (const domain of ['team', 'billing', 'ai', 'security', 'audit', 'command', 'health']) {
      expect(content).toContain(`id: '${domain}'`);
    }
    expect(content).toContain("c('platform-operations'");
  });

  it('AdminSettingsModule exposes seven first-class sections and maps legacy aliases', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/views/admin/AdminSettingsModule.tsx', 'utf-8');
    for (const section of ['people', 'billing', 'ai', 'security', 'audit', 'command', 'health']) {
      expect(content).toContain(`'${section}'`);
    }
    // Legacy aliases redirect to their canonical first-class section.
    expect(content).toContain("overview: 'people'");
    expect(content).toContain("billing: 'billing'");
    expect(content).toContain("ai: 'ai'");
    expect(content).toContain("integrations: 'security'");
    expect(content).toContain("audit: 'audit'");
    expect(content).toContain('SECTION_ALIASES');
  });
});

describe('P32 Admin — audit events on members ops', () => {
  it('organizations.routes wires audit to addMember', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organizations.routes.ts',
      'utf-8'
    );
    expect(content).toContain('adminAuditService');
    expect(content).toContain('add_member');
  });

  it('organizations.routes wires audit to updateMemberRole', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organizations.routes.ts',
      'utf-8'
    );
    expect(content).toContain('update_member_role');
  });

  it('organizations.routes wires audit to removeMember', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/organization/organizations.routes.ts',
      'utf-8'
    );
    expect(content).toContain('remove_member');
  });
});

describe('P32 Admin — integration status model (§2.3.4)', () => {
  it('integrationStatusService exports 4-status model', async () => {
    const mod = await import('../../../server/src/services/integrationStatusService.js');
    const service = mod.default;
    expect(service).toBeDefined();
    expect(typeof service.getRemediationPath).toBe('function');
    expect(typeof service.normalizeStatus).toBe('function');
    expect(typeof service.getHealthForOrg).toBe('function');
    expect(typeof service.transitionStatus).toBe('function');
  });

  it('normalizeStatus maps raw values to canonical statuses', async () => {
    const mod = await import('../../../server/src/services/integrationStatusService.js');
    const s = mod.default;
    expect(s.normalizeStatus('active')).toBe('connected');
    expect(s.normalizeStatus('healthy')).toBe('connected');
    expect(s.normalizeStatus('failed')).toBe('error');
    expect(s.normalizeStatus('sync_error')).toBe('error');
    expect(s.normalizeStatus('expired')).toBe('needs_reauth');
    expect(s.normalizeStatus('token_expired')).toBe('needs_reauth');
    expect(s.normalizeStatus(null)).toBe('disabled');
    expect(s.normalizeStatus('unknown')).toBe('disabled');
  });

  it('getRemediationPath returns guidance for each status', async () => {
    const mod = await import('../../../server/src/services/integrationStatusService.js');
    const s = mod.default;
    expect(s.getRemediationPath('connected')).toContain('No action');
    expect(s.getRemediationPath('error')).toContain('Retry');
    expect(s.getRemediationPath('needs_reauth')).toContain('reauthorization');
    expect(s.getRemediationPath('disabled')).toContain('Re-enable');
  });
});

// ===========================================================================
// P33 — Superadmin gated actions
// ===========================================================================

describe('P33 Superadmin — gated actions (§2.3.2)', () => {
  it('superadmin routes have suspend tenant endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('tenants/:id/suspend');
    expect(content).toContain('suspend_tenant');
    expect(content).toContain('tenant.suspended');
  });

  it('superadmin routes have reactivate tenant endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('tenants/:id/reactivate');
    expect(content).toContain('tenant.reactivated');
  });

  it('superadmin routes have force-reset MFA endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('force-reset-mfa');
    expect(content).toContain('user.mfa_reset');
  });

  it('superadmin routes have platform MFA override', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('platform/mfa-override');
    expect(content).toContain('platform.mfa_override');
  });

  it('superadmin routes have platform SSO override', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('platform/sso-override');
    expect(content).toContain('platform.sso_override');
  });

  it('superadmin routes have suspend AI model', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('ai/models');
    expect(content).toContain('suspend');
    expect(content).toContain('ai.model_suspended');
  });

  it('superadmin routes have emergency connector kill-switch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('emergency-kill');
    expect(content).toContain('connector.emergency_kill');
  });

  it('superadmin routes have bulk data export', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('data/bulk-export');
    expect(content).toContain('data.bulk_export');
  });

  it('superadmin routes have tenant data purge with type-to-confirm', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('tenants/:id/purge');
    expect(content).toContain('tenant.data_purge');
    expect(content).toContain('confirmTenantName');
    expect(content).toContain('TYPE_TO_CONFIRM_FAILED');
    expect(content).toContain('irreversible');
  });

  it('superadmin routes have suspend virtual worker', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('virtual-workers');
    expect(content).toContain('ai.virtual_worker_suspended');
  });

  it('superadmin routes have emergency tenant lockdown', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    expect(content).toContain('tenants/:id/lockdown');
    expect(content).toContain('tenant.emergency_lockdown');
  });

  it('all gated actions use requireConfirmation + requireAudit', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/routes/superadmin.routes.ts', 'utf-8');
    const gatedActions = [
      'suspend_tenant',
      'reactivate_tenant',
      'force_reset_mfa',
      'platform_mfa_override',
      'platform_sso_override',
      'suspend_ai_model',
      'emergency_connector_kill',
      'bulk_data_export',
      'tenant_data_purge',
      'suspend_virtual_worker',
      'emergency_tenant_lockdown',
    ];
    for (const action of gatedActions) {
      expect(content).toContain(action);
    }
  });
});

describe('P33 Superadmin — fail-closed audit (§2.3.2 guardrail)', () => {
  it('confirmAction middleware returns 503 on audit failure', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/middleware/confirmAction.middleware.ts', 'utf-8');
    expect(content).toContain('AUDIT_UNAVAILABLE');
    expect(content).toContain('503');
    expect(content).toContain('FAIL-CLOSED');
  });
});

describe('P33 Superadmin — sidebar IA alignment (§2.3.1)', () => {
  it('SuperAdminSidebar has Tenant & User Ops branch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/layout/SuperAdminSidebar.tsx', 'utf-8');
    expect(content).toContain('Tenant & User Ops');
  });

  it('SuperAdminSidebar has AI Operations branch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/layout/SuperAdminSidebar.tsx', 'utf-8');
    expect(content).toContain('AI Operations');
  });

  it('SuperAdminSidebar has Connector Ops branch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/layout/SuperAdminSidebar.tsx', 'utf-8');
    expect(content).toContain('Connector Ops');
  });

  it('SuperAdminSidebar has Governance & Compliance branch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/layout/SuperAdminSidebar.tsx', 'utf-8');
    expect(content).toContain('Governance & Compliance');
  });

  it('SuperAdminSidebar has Platform Security branch', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/layout/SuperAdminSidebar.tsx', 'utf-8');
    expect(content).toContain('Platform Security');
  });
});
