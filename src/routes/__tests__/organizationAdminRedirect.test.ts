import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ROUTES } from '../routeConfig';

describe('Organization administrative route redirects (DEC-...-10)', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');
  const organizationBlock = source.slice(
    source.indexOf(`path={\`${'$'}{ROUTES.ORGANIZATION.ROOT}/*\`}`),
    source.indexOf('{/* Admin with nested routes - Protected (ADMIN role) & Error Boundary */}')
  );

  it('mounts a nested <Routes> for /organization/* rather than a single OrganizationView catch-all', () => {
    expect(organizationBlock).toContain('<Routes>');
    expect(organizationBlock).toContain('<Route path="*" element={<OrganizationView />} />');
  });

  it.each([
    ['members/*', 'ROUTES.ORGANIZATION.MEMBERS', 'ROUTES.ADMIN.PEOPLE'],
    ['billing/*', 'ROUTES.ORGANIZATION.BILLING', 'ROUTES.ADMIN.BILLING'],
    ['limits/*', 'ROUTES.ORGANIZATION.LIMITS', 'ROUTES.ADMIN.BILLING'],
    ['domains/*', 'ROUTES.ORGANIZATION.DOMAINS', 'ROUTES.ADMIN.OPERATIONS'],
    ['branding/*', 'ROUTES.ORGANIZATION.BRANDING', 'ROUTES.ADMIN.OPERATIONS'],
  ])('redirects organization %s to the canonical Admin screen', (path, from, to) => {
    const routeIndex = organizationBlock.indexOf(`path="${path}"`);
    expect(routeIndex).toBeGreaterThan(-1);
    const routeSlice = organizationBlock.slice(routeIndex, routeIndex + 260);
    expect(routeSlice).toContain('<RedirectWithTracking');
    expect(routeSlice).toContain(`from={${from}}`);
    expect(routeSlice).toContain(`to={${to}}`);
  });

  it('resolves the five legacy administrative Organization URLs to real Admin routes', () => {
    expect(ROUTES.ORGANIZATION.MEMBERS).toBe('/organization/members');
    expect(ROUTES.ORGANIZATION.BILLING).toBe('/organization/billing');
    expect(ROUTES.ORGANIZATION.LIMITS).toBe('/organization/limits');
    expect(ROUTES.ORGANIZATION.DOMAINS).toBe('/organization/domains');
    expect(ROUTES.ORGANIZATION.BRANDING).toBe('/organization/branding');

    expect(ROUTES.ADMIN.PEOPLE).toBe('/admin/people');
    expect(ROUTES.ADMIN.BILLING).toBe('/admin/billing');
    expect(ROUTES.ADMIN.OPERATIONS).toBe('/admin/operations');
  });
});
