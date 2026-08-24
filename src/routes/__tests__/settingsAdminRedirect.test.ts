import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTES } from '../routeConfig';

describe('Settings administrative route redirects (DEC-...-10)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
  const settingsBlock = source.slice(
    source.indexOf(`path={\`${'$'}{ROUTES.SETTINGS.ROOT}/*\`}`),
    source.indexOf('{/* Organization with nested routes - Protected & Error Boundary')
  );

  it('mounts a nested <Routes> for /settings/* rather than a single SettingsView catch-all', () => {
    expect(settingsBlock).toContain('<Routes>');
    const catchAllIndex = settingsBlock.indexOf('path="*"');
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(settingsBlock.slice(catchAllIndex, catchAllIndex + 200)).toContain('<SettingsView');
  });

  it.each([
    ['billing/*', 'ROUTES.SETTINGS.BILLING', 'ROUTES.ADMIN.BILLING'],
    ['organization/*', 'ROUTES.SETTINGS.ORGANIZATION', 'ROUTES.ADMIN.COMMAND'],
    ['tenant-defaults/*', 'ROUTES.SETTINGS.TENANT_DEFAULTS', 'ROUTES.ADMIN.COMMAND'],
  ])('redirects settings %s to the canonical Admin screen', (path, from, to) => {
    const routeIndex = settingsBlock.indexOf(`path="${path}"`);
    expect(routeIndex).toBeGreaterThan(-1);
    const routeSlice = settingsBlock.slice(routeIndex, routeIndex + 260);
    expect(routeSlice).toContain('<RedirectWithTracking');
    expect(routeSlice).toContain(`from={${from}}`);
    expect(routeSlice).toContain(`to={${to}}`);
  });

  it('resolves the three legacy administrative Settings URLs to real Admin routes', () => {
    expect(ROUTES.SETTINGS.BILLING).toBe('/settings/billing');
    expect(ROUTES.SETTINGS.ORGANIZATION).toBe('/settings/organization');
    expect(ROUTES.SETTINGS.TENANT_DEFAULTS).toBe('/settings/tenant-defaults');

    expect(ROUTES.ADMIN.BILLING).toBe('/admin/billing');
    expect(ROUTES.ADMIN.COMMAND).toBe('/admin/command');
  });

  it('keeps the Billing editor out of the Settings menu (no personal billing editor mounts)', () => {
    const settingsViewSource = readFileSync(
      resolve(process.cwd(), 'src/views/SettingsView.tsx'),
      'utf8'
    );
    const billingCaseIndex = settingsViewSource.indexOf("case 'billing':");
    expect(billingCaseIndex).toBeGreaterThan(-1);
    const nextCaseIndex = settingsViewSource.indexOf('case ', billingCaseIndex + 1);
    const billingCaseSlice = settingsViewSource.slice(billingCaseIndex, nextCaseIndex);
    expect(billingCaseSlice).toContain('return null');
    expect(billingCaseSlice).not.toContain('<BillingSettings');
  });
});
