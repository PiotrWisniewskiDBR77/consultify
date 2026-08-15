import { ROUTES } from '@/routes/routeConfig';

export type OrganizationSurface =
  | 'profile'
  | 'goals'
  | 'challenges'
  | 'strategy'
  | 'claims'
  | 'knowledge-graph';

export const ORGANIZATION_OWNER_REGISTRY = {
  profile: {
    route: ROUTES.ORGANIZATION.PROFILE,
    writer: '/api/organization-profiles/:orgId',
  },
  goals: {
    route: ROUTES.ORGANIZATION.GOALS,
    writer: '/api/organization-context-store',
  },
  challenges: {
    route: ROUTES.ORGANIZATION.CHALLENGES,
    writer: '/api/organization-context-store',
  },
  strategy: {
    route: ROUTES.ORGANIZATION.STRATEGY,
    writer: '/api/organization-context-store',
  },
  claims: {
    route: ROUTES.ORGANIZATION.PROFILE,
    writer: '/api/organization-context',
  },
  'knowledge-graph': {
    route: `${ROUTES.ORGANIZATION.ROOT}/knowledge-graph`,
    writer: '/api/knowledge-graph',
  },
} as const satisfies Record<OrganizationSurface, { route: string; writer: string }>;

export const ORGANIZATION_ADMIN_HANDOFFS = {
  members: ROUTES.ADMIN.PEOPLE,
  competencies: ROUTES.ADMIN.OPERATIONS,
  billing: ROUTES.ADMIN.BILLING,
  limits: ROUTES.ADMIN.BILLING,
  domains: ROUTES.ADMIN.OPERATIONS,
  branding: ROUTES.ADMIN.OPERATIONS,
} as const;

export const LEGACY_CONTEXT_REDIRECTS = {
  [ROUTES.CONTEXT_BUILDER.ROOT]: ROUTES.ORGANIZATION.ROOT,
  [ROUTES.CONTEXT_BUILDER.PROFILE]: ROUTES.ORGANIZATION.PROFILE,
  [ROUTES.CONTEXT_BUILDER.GOALS]: ROUTES.ORGANIZATION.GOALS,
  [ROUTES.CONTEXT_BUILDER.CHALLENGES]: ROUTES.ORGANIZATION.CHALLENGES,
  [ROUTES.CONTEXT_BUILDER.MEGATRENDS]: ROUTES.DISCOVERY_TOOLS.STRATEGIC_MEGATRENDS,
  [ROUTES.CONTEXT_BUILDER.STRATEGY]: ROUTES.ORGANIZATION.STRATEGY,
} as const;

export function organizationSectionRoute(section: OrganizationSurface): string {
  return ORGANIZATION_OWNER_REGISTRY[section].route;
}
