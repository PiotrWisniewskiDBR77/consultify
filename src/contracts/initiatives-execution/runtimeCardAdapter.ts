import {
  cardsForLegacySection,
  INITIATIVE_CARD_KEYS,
  INITIATIVE_WORKSPACE_UTILITY_KEYS,
  type InitiativeCardKey,
} from './cardRegistry';

export const LEGACY_SECTION_COMPONENT_KEYS = [
  'overview',
  'problemDefinition',
  'targetState',
  'scope',
  'tasks',
  'decisions',
  'raid',
  'gates',
  'financialAnalysis',
  'financialImpact',
  'kpis',
  'competencyRequirements',
  'skillsGap',
  'pilot',
  'comments',
  'history',
  'control',
  'team',
  'initiativeTeam',
  'raciEscalation',
  'timeline',
  'resources',
  'stakeholders',
  'dependencies',
  'attachments',
  'linkedItems',
  'tags',
  'reminders',
  'watchers',
] as const;

export type LegacySectionComponentKey = (typeof LEGACY_SECTION_COMPONENT_KEYS)[number];
export type LegacySectionDisposition = 'MAP' | 'SPLIT' | 'UTILITY' | 'MOVE_TO_EXECUTION_PHASE';

export interface LegacySectionResolution {
  componentKey: LegacySectionComponentKey;
  disposition: LegacySectionDisposition;
  cardKeys: InitiativeCardKey[];
  notes: string[];
}

const utilityKeys = new Set<string>(INITIATIVE_WORKSPACE_UTILITY_KEYS);

export function resolveLegacySection(
  componentKey: LegacySectionComponentKey
): LegacySectionResolution {
  if (componentKey === 'pilot') {
    return {
      componentKey,
      disposition: 'MOVE_TO_EXECUTION_PHASE',
      cardKeys: [],
      notes: ['Pilot is a phase/workstream inside the single Execution Case, not a peer card'],
    };
  }

  const cardKeys = cardsForLegacySection(componentKey).map((card) => card.key);
  if (cardKeys.length > 1) {
    return {
      componentKey,
      disposition: 'SPLIT',
      cardKeys,
      notes: ['Legacy content must be partitioned without duplication or silent ownership choice'],
    };
  }
  if (cardKeys.length === 1) {
    return { componentKey, disposition: 'MAP', cardKeys, notes: [] };
  }
  if (utilityKeys.has(componentKey)) {
    return {
      componentKey,
      disposition: 'UTILITY',
      cardKeys: [],
      notes: ['Workspace utility remains available but is not a business card'],
    };
  }

  return {
    componentKey,
    disposition: 'UTILITY',
    cardKeys: [],
    notes: ['Legacy-only helper requires explicit workspace placement'],
  };
}

export interface RuntimeCardCoverageReport {
  resolutions: LegacySectionResolution[];
  implementedCardKeys: InitiativeCardKey[];
  targetOnlyCardKeys: InitiativeCardKey[];
  invalidComponentKeys: string[];
}

export function buildRuntimeCardCoverageReport(
  componentKeys: readonly string[]
): RuntimeCardCoverageReport {
  const allowed = new Set<string>(LEGACY_SECTION_COMPONENT_KEYS);
  const invalidComponentKeys = [...new Set(componentKeys.filter((key) => !allowed.has(key)))];
  const validKeys = [
    ...new Set(componentKeys.filter((key) => allowed.has(key))),
  ] as LegacySectionComponentKey[];
  const resolutions = validKeys.map(resolveLegacySection);
  const implemented = new Set(resolutions.flatMap((resolution) => resolution.cardKeys));
  const implementedCardKeys = INITIATIVE_CARD_KEYS.filter((key) => implemented.has(key));
  const targetOnlyCardKeys = INITIATIVE_CARD_KEYS.filter((key) => !implemented.has(key));

  return { resolutions, implementedCardKeys, targetOnlyCardKeys, invalidComponentKeys };
}
