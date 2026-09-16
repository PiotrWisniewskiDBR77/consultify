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
    ['14-admin', '/admin/people'],
    ['15-settings', '/settings/profile'],
    ['16-partners', '/partner/dashboard'],
  ].map(([id, route]) => Object.freeze({ id, route }))
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

// Wpis 89 names three people and Tomek's two materially different roles.
// Irina and Kasia exercise independent ADMIN sessions in Northwind; Tomek
// provides the Northwind ADMIN / DBR77 OWNER cross-tenant pair.
export const ACTOR_ORGS = Object.freeze([
  { actor: 'irina', org: 'northwind', expectedRole: 'ADMIN' },
  { actor: 'kasia', org: 'northwind', expectedRole: 'ADMIN' },
  { actor: 'tomek', org: 'northwind', expectedRole: 'ADMIN' },
  { actor: 'tomek', org: 'dbr77', expectedRole: 'OWNER' },
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
