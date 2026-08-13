export const INITIATIVE_CARD_KEYS = [
  'summary-scope',
  'strategic-fit',
  'success-criteria',
  'outcomes-benefits',
  'kpi',
  'options',
  'financial-analysis',
  'financial-impact',
  'people-team',
  'roles-raci',
  'stakeholders',
  'resources-capacity',
  'dependencies',
  'risk-raid',
  'milestones',
  'timeline',
  'tasks',
  'decisions',
  'gates-approvals',
  'feasibility-completeness',
  'change-adoption',
  'communication-engagement',
  'capabilities-training',
  'technical-specification',
  'attachments-materials',
  'comments-activity-history',
] as const;

export type InitiativeCardKey = (typeof INITIATIVE_CARD_KEYS)[number];

export type InitiativeCardGroup =
  | 'definition-value'
  | 'organization-feasibility'
  | 'plan-governance'
  | 'adoption-evidence-learning';

export interface InitiativeCardDefinition {
  key: InitiativeCardKey;
  group: InitiativeCardGroup;
  label: string;
  truthOwner:
    | 'initiative'
    | 'decision'
    | 'task'
    | 'finance'
    | 'results'
    | 'resource'
    | 'raid'
    | 'materials'
    | 'audit'
    | 'shared-reference';
  legacySectionKeys: readonly string[];
}

export const INITIATIVE_CARD_REGISTRY: Readonly<
  Record<InitiativeCardKey, InitiativeCardDefinition>
> = {
  'summary-scope': {
    key: 'summary-scope',
    group: 'definition-value',
    label: 'Summary / Scope',
    truthOwner: 'initiative',
    legacySectionKeys: ['overview', 'problemDefinition', 'scope'],
  },
  'strategic-fit': {
    key: 'strategic-fit',
    group: 'definition-value',
    label: 'Strategic Fit',
    truthOwner: 'shared-reference',
    legacySectionKeys: [],
  },
  'success-criteria': {
    key: 'success-criteria',
    group: 'definition-value',
    label: 'Success Criteria',
    truthOwner: 'initiative',
    legacySectionKeys: ['targetState'],
  },
  'outcomes-benefits': {
    key: 'outcomes-benefits',
    group: 'definition-value',
    label: 'Outcomes & Benefits',
    truthOwner: 'results',
    legacySectionKeys: ['targetState'],
  },
  kpi: {
    key: 'kpi',
    group: 'definition-value',
    label: 'KPI',
    truthOwner: 'results',
    legacySectionKeys: ['kpis'],
  },
  options: {
    key: 'options',
    group: 'definition-value',
    label: 'Options',
    truthOwner: 'initiative',
    legacySectionKeys: [],
  },
  'financial-analysis': {
    key: 'financial-analysis',
    group: 'definition-value',
    label: 'Financial Analysis',
    truthOwner: 'finance',
    legacySectionKeys: ['financialAnalysis'],
  },
  'financial-impact': {
    key: 'financial-impact',
    group: 'definition-value',
    label: 'Financial Impact',
    truthOwner: 'finance',
    legacySectionKeys: ['financialImpact'],
  },
  'people-team': {
    key: 'people-team',
    group: 'organization-feasibility',
    label: 'People / Team',
    truthOwner: 'resource',
    legacySectionKeys: ['team', 'initiativeTeam'],
  },
  'roles-raci': {
    key: 'roles-raci',
    group: 'organization-feasibility',
    label: 'Roles & RACI',
    truthOwner: 'initiative',
    legacySectionKeys: ['raciEscalation', 'control'],
  },
  stakeholders: {
    key: 'stakeholders',
    group: 'organization-feasibility',
    label: 'Stakeholders',
    truthOwner: 'initiative',
    legacySectionKeys: ['stakeholders'],
  },
  'resources-capacity': {
    key: 'resources-capacity',
    group: 'organization-feasibility',
    label: 'Resources & Capacity',
    truthOwner: 'resource',
    legacySectionKeys: ['resources'],
  },
  dependencies: {
    key: 'dependencies',
    group: 'organization-feasibility',
    label: 'Dependencies',
    truthOwner: 'shared-reference',
    legacySectionKeys: ['dependencies'],
  },
  'risk-raid': {
    key: 'risk-raid',
    group: 'organization-feasibility',
    label: 'Risk & RAID',
    truthOwner: 'raid',
    legacySectionKeys: ['raid'],
  },
  milestones: {
    key: 'milestones',
    group: 'plan-governance',
    label: 'Milestones',
    truthOwner: 'initiative',
    legacySectionKeys: ['tasks'],
  },
  timeline: {
    key: 'timeline',
    group: 'plan-governance',
    label: 'Timeline',
    truthOwner: 'initiative',
    legacySectionKeys: ['timeline'],
  },
  tasks: {
    key: 'tasks',
    group: 'plan-governance',
    label: 'Tasks',
    truthOwner: 'task',
    legacySectionKeys: ['tasks'],
  },
  decisions: {
    key: 'decisions',
    group: 'plan-governance',
    label: 'Decisions',
    truthOwner: 'decision',
    legacySectionKeys: ['decisions'],
  },
  'gates-approvals': {
    key: 'gates-approvals',
    group: 'plan-governance',
    label: 'Gates & Approvals',
    truthOwner: 'decision',
    legacySectionKeys: ['gates', 'control'],
  },
  'feasibility-completeness': {
    key: 'feasibility-completeness',
    group: 'organization-feasibility',
    label: 'Feasibility & Completeness',
    truthOwner: 'initiative',
    legacySectionKeys: ['gates'],
  },
  'change-adoption': {
    key: 'change-adoption',
    group: 'adoption-evidence-learning',
    label: 'Change & Adoption',
    truthOwner: 'initiative',
    legacySectionKeys: [],
  },
  'communication-engagement': {
    key: 'communication-engagement',
    group: 'adoption-evidence-learning',
    label: 'Communication & Engagement',
    truthOwner: 'initiative',
    legacySectionKeys: [],
  },
  'capabilities-training': {
    key: 'capabilities-training',
    group: 'adoption-evidence-learning',
    label: 'Capabilities & Training',
    truthOwner: 'shared-reference',
    legacySectionKeys: ['competencyRequirements', 'skillsGap'],
  },
  'technical-specification': {
    key: 'technical-specification',
    group: 'organization-feasibility',
    label: 'Technical Specification',
    truthOwner: 'shared-reference',
    legacySectionKeys: [],
  },
  'attachments-materials': {
    key: 'attachments-materials',
    group: 'adoption-evidence-learning',
    label: 'Attachments & Materials',
    truthOwner: 'materials',
    legacySectionKeys: ['attachments', 'linkedItems'],
  },
  'comments-activity-history': {
    key: 'comments-activity-history',
    group: 'adoption-evidence-learning',
    label: 'Comments, Activity & History',
    truthOwner: 'audit',
    legacySectionKeys: ['comments', 'history'],
  },
};

export const INITIATIVE_WORKSPACE_UTILITY_KEYS = [
  'tags',
  'reminders',
  'watchers',
  'control',
  'linkedItems',
] as const;

export type InitiativeWorkspaceUtilityKey = (typeof INITIATIVE_WORKSPACE_UTILITY_KEYS)[number];

export function isInitiativeCardKey(value: string): value is InitiativeCardKey {
  return Object.prototype.hasOwnProperty.call(INITIATIVE_CARD_REGISTRY, value);
}

export function cardsForLegacySection(sectionKey: string): InitiativeCardDefinition[] {
  return INITIATIVE_CARD_KEYS.map((key) => INITIATIVE_CARD_REGISTRY[key]).filter((definition) =>
    definition.legacySectionKeys.includes(sectionKey)
  );
}

export interface InitiativeCardSelection {
  included: readonly InitiativeCardKey[];
  omitted: readonly InitiativeCardKey[];
  order: readonly InitiativeCardKey[];
}

export function validateCardSelection(selection: InitiativeCardSelection): string[] {
  const errors: string[] = [];
  const included = new Set(selection.included);
  const omitted = new Set(selection.omitted);
  const order = new Set(selection.order);

  if (included.size !== selection.included.length) errors.push('included contains duplicates');
  if (omitted.size !== selection.omitted.length) errors.push('omitted contains duplicates');
  if (order.size !== selection.order.length) errors.push('order contains duplicates');

  for (const key of INITIATIVE_CARD_KEYS) {
    const membershipCount = Number(included.has(key)) + Number(omitted.has(key));
    if (membershipCount !== 1) errors.push(`${key} must be exactly included or omitted`);
    if (!order.has(key)) errors.push(`${key} is missing from order`);
  }

  if (order.size !== INITIATIVE_CARD_KEYS.length) {
    errors.push(`order must contain exactly ${INITIATIVE_CARD_KEYS.length} canonical cards`);
  }

  return errors;
}
