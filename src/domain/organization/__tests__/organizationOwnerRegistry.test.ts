import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/routes/routeConfig';

import {
  LEGACY_CONTEXT_REDIRECTS,
  ORGANIZATION_ADMIN_HANDOFFS,
  ORGANIZATION_OWNER_REGISTRY,
  organizationSectionRoute,
} from '../organizationOwnerRegistry';

describe('organization owner and deep-link registry', () => {
  it('assigns one canonical writer to every mounted organization data surface', () => {
    expect(ORGANIZATION_OWNER_REGISTRY).toEqual({
      profile: { route: '/organization/profile', writer: '/api/organization-profiles/:orgId' },
      goals: { route: '/organization/goals', writer: '/api/organization-context-store' },
      challenges: {
        route: '/organization/challenges',
        writer: '/api/organization-context-store',
      },
      strategy: { route: '/organization/strategy', writer: '/api/organization-context-store' },
      claims: { route: '/organization/profile', writer: '/api/organization-context' },
      'knowledge-graph': {
        route: '/organization/knowledge-graph',
        writer: '/api/knowledge-graph',
      },
    });
  });

  it('keeps every legacy context deep-link redirect-only', () => {
    expect(LEGACY_CONTEXT_REDIRECTS).toEqual({
      '/context': '/organization',
      '/context/profile': '/organization/profile',
      '/context/goals': '/organization/goals',
      '/context/challenges': '/organization/challenges',
      '/context/megatrends': ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS,
      '/context/strategy': '/organization/strategy',
    });
  });

  it('makes administration an explicit handoff rather than an Organization writer', () => {
    expect(ORGANIZATION_ADMIN_HANDOFFS).toEqual({
      members: ROUTES.ADMIN.PEOPLE,
      competencies: ROUTES.ADMIN.OPERATIONS,
      billing: ROUTES.ADMIN.BILLING,
      limits: ROUTES.ADMIN.BILLING,
      domains: ROUTES.ADMIN.OPERATIONS,
      branding: ROUTES.ADMIN.OPERATIONS,
    });
    expect(organizationSectionRoute('knowledge-graph')).toBe('/organization/knowledge-graph');
  });
});
