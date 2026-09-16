export const MODULES = Object.freeze(
  [
    ['01-chat', '/chat'],
    ['02-my-work', '/my-work'],
    ['03-interview', '/interview'],
    ['04-tools', '/discovery-tools'],
    ['05-assessment', '/assessment'],
    ['06-audits', '/audit-programs'],
    ['07-initiatives', '/initiatives'],
    ['08-projects', '/projects'],
    ['09-execution', '/execution'],
    ['10-results', '/results/kpi'],
    ['11-materials', '/presentations'],
    ['12-meeting', '/meeting'],
    ['13-organization', '/organization/profile'],
    ['14-admin', '/admin/people', ['/admin/team/members']],
    ['15-settings', '/settings/profile'],
    ['16-partners', '/partner/dashboard'],
  ].map(([id, route, canonicalRoutes = []]) =>
    Object.freeze({ id, route, canonicalRoutes: Object.freeze(canonicalRoutes) })
  )
);

export const SURFACE_KINDS = Object.freeze([
  'menu1',
  'menu2',
  'menu3',
  'kebab',
  'right-panel',
  'create',
  'ai',
]);

// DEC-579 (W161): scheduled E2E never uses human accounts. The two principals
// are dedicated, least-privilege service accounts provisioned by CTO.
export const ACTOR_ORGS = Object.freeze([
  {
    actor: 'admin-nw',
    secretPrefix: 'E2E_ADMIN_NW',
    org: 'northwind',
    expectedRole: 'ADMIN',
  },
  {
    actor: 'owner-dbr77',
    secretPrefix: 'E2E_OWNER_DBR77',
    org: 'dbr77',
    expectedRole: 'OWNER',
  },
]);

export const LOCALES = Object.freeze(['en', 'pl']);
export const THEMES = Object.freeze(['light', 'dark']);

export const ORG_NAMES = Object.freeze({
  northwind: 'Northwind Manufacturing Ltd.',
  dbr77: 'DBR77',
});

export function buildVariants() {
  return ACTOR_ORGS.flatMap((principal) =>
    LOCALES.flatMap((locale) =>
      THEMES.map((theme) => Object.freeze({ ...principal, locale, theme }))
    )
  );
}

export function variantKey(variant) {
  return [variant.actor, variant.org, variant.expectedRole, variant.locale, variant.theme]
    .join('-')
    .toLowerCase();
}

export function matrixContract() {
  const variants = buildVariants();
  return {
    variantCount: variants.length,
    modulesPerVariant: MODULES.length,
    moduleRuns: variants.length * MODULES.length,
    requiredSurfaceCells: variants.length * MODULES.length * SURFACE_KINDS.length,
    variantDefinitions: variants.map((variant) => ({ ...variant, key: variantKey(variant) })),
  };
}

export function parseVariant(input) {
  const match = buildVariants().find((variant) => variantKey(variant) === input);
  if (!match) throw new Error(`Unknown E2E-1 variant: ${input}`);
  return match;
}

export function acceptedModuleRoutes(module) {
  return [module.route, ...(module.canonicalRoutes || [])];
}

export function routeMatchesModule(routeAfter, module) {
  const path =
    String(routeAfter || '')
      .split(/[?#]/, 1)[0]
      .replace(/\/+$/, '') || '/';
  return acceptedModuleRoutes(module).some((candidate) => {
    const normalized = String(candidate).replace(/\/+$/, '') || '/';
    return path === normalized || path.startsWith(`${normalized}/`);
  });
}
