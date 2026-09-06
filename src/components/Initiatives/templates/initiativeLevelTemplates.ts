/**
 * Initiative Level Templates
 *
 * V3-F01: Template-driven N-mode per InitiativeLevel.
 * 4 levels: quick_win, standard, strategic, transformation.
 */

import type { InitiativeLevelTemplate } from './types';

/** Section keys aligned with SECTION_REGISTRY in sections/registry.ts */
const SECTIONS = {
  overview: 'overview',
  scope: 'scope',
  objectives: 'scope', // objectives live in scope section
  tasks: 'tasks',
  implementation_plan: 'tasks',
  kpis: 'kpis',
  attachments: 'attachments',
  outputs: 'attachments',
  stakeholders: 'stakeholders',
  timeline: 'timeline',
  raid: 'raid',
  risks: 'raid',
  control: 'control',
  governance: 'control',
  resources: 'resources',
  financialImpact: 'financialImpact',
  team: 'team',
  targetState: 'targetState',
  raciEscalation: 'raciEscalation',
  initiativeTeam: 'initiativeTeam',
} as const;

export const INITIATIVE_LEVEL_TEMPLATES: InitiativeLevelTemplate[] = [
  {
    level: 'quick_win',
    label: 'Quick Win',
    description: 'Small improvements done in <1 month. Minimal governance.',
    icon: 'Zap',
    color: 'emerald',
    visibleSections: [
      SECTIONS.overview,
      SECTIONS.scope,
      SECTIONS.tasks,
      SECTIONS.kpis,
      SECTIONS.attachments,
    ],
    requiredFieldsByStatus: {
      DRAFT: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
      ],
      PLANNING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        { sectionId: 'tasks', fieldPath: 'tasks', label: 'Implementation Plan', isCritical: true },
      ],
      EXECUTING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        { sectionId: 'tasks', fieldPath: 'tasks', label: 'Implementation Plan', isCritical: true },
        { sectionId: 'kpis', fieldPath: 'kpis', label: 'KPIs', isCritical: true },
      ],
      DONE: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
      ],
    },
  },
  {
    level: 'standard',
    label: 'Standard',
    description: 'Typical consulting initiatives with full planning.',
    icon: 'Target',
    color: 'blue',
    visibleSections: [
      SECTIONS.overview,
      SECTIONS.scope,
      SECTIONS.stakeholders,
      SECTIONS.tasks,
      SECTIONS.timeline,
      SECTIONS.kpis,
      SECTIONS.attachments,
      SECTIONS.raid,
    ],
    requiredFieldsByStatus: {
      DRAFT: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
      ],
      PLANNING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
      ],
      EXECUTING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
        { sectionId: 'kpis', fieldPath: 'kpis', label: 'KPIs', isCritical: true },
        { sectionId: 'tasks', fieldPath: 'tasks', label: 'Implementation Plan', isCritical: true },
      ],
      DONE: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
      ],
    },
  },
  {
    level: 'strategic',
    label: 'Strategic',
    description: 'Strategic priorities with governance and budget.',
    icon: 'Star',
    color: 'purple',
    visibleSections: [
      SECTIONS.overview,
      SECTIONS.scope,
      SECTIONS.stakeholders,
      SECTIONS.tasks,
      SECTIONS.timeline,
      SECTIONS.kpis,
      SECTIONS.attachments,
      SECTIONS.raid,
      SECTIONS.control,
      SECTIONS.resources,
      SECTIONS.financialImpact,
    ],
    requiredFieldsByStatus: {
      DRAFT: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
      ],
      PLANNING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
        { sectionId: 'resources', fieldPath: 'budgetItems', label: 'Budget', isCritical: true },
        { sectionId: 'control', fieldPath: 'gateRoles', label: 'Governance', isCritical: true },
        {
          sectionId: 'resources',
          fieldPath: 'resourceItems',
          label: 'Resources',
          isCritical: true,
        },
      ],
      EXECUTING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
        { sectionId: 'kpis', fieldPath: 'kpis', label: 'KPIs', isCritical: true },
        { sectionId: 'tasks', fieldPath: 'tasks', label: 'Implementation Plan', isCritical: true },
        { sectionId: 'resources', fieldPath: 'budgetItems', label: 'Budget', isCritical: true },
        { sectionId: 'control', fieldPath: 'gateRoles', label: 'Governance', isCritical: true },
        {
          sectionId: 'resources',
          fieldPath: 'resourceItems',
          label: 'Resources',
          isCritical: true,
        },
      ],
      DONE: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
      ],
    },
  },
  {
    level: 'transformation',
    label: 'Transformation',
    description: 'Major org transformations with full governance.',
    icon: 'Rocket',
    color: 'amber',
    visibleSections: [
      SECTIONS.overview,
      SECTIONS.scope,
      SECTIONS.stakeholders,
      SECTIONS.tasks,
      SECTIONS.timeline,
      SECTIONS.kpis,
      SECTIONS.attachments,
      SECTIONS.raid,
      SECTIONS.control,
      SECTIONS.resources,
      SECTIONS.financialImpact,
      SECTIONS.team,
      SECTIONS.targetState,
      SECTIONS.raciEscalation,
      SECTIONS.initiativeTeam,
    ],
    requiredFieldsByStatus: {
      DRAFT: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
      ],
      PLANNING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
        { sectionId: 'resources', fieldPath: 'budgetItems', label: 'Budget', isCritical: true },
        { sectionId: 'control', fieldPath: 'gateRoles', label: 'Governance', isCritical: true },
        {
          sectionId: 'resources',
          fieldPath: 'resourceItems',
          label: 'Resources',
          isCritical: true,
        },
        { sectionId: 'raid', fieldPath: 'raidItems', label: 'RAID', isCritical: true },
        {
          sectionId: 'financialImpact',
          fieldPath: 'intangibleAssets',
          label: 'Benefits Case',
          isCritical: true,
        },
        {
          sectionId: 'team',
          fieldPath: 'resourceItems',
          label: 'Team Structure',
          isCritical: true,
        },
        {
          sectionId: 'raciEscalation',
          fieldPath: 'gateRoles',
          label: 'Steering Committee',
          isCritical: true,
        },
      ],
      EXECUTING: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
        { sectionId: 'overview', fieldPath: 'level', label: 'Level', isCritical: true },
        { sectionId: 'scope', fieldPath: 'scope', label: 'Scope', isCritical: true },
        { sectionId: 'scope', fieldPath: 'objectives', label: 'Objectives', isCritical: true },
        {
          sectionId: 'stakeholders',
          fieldPath: 'stakeholders',
          label: 'Stakeholders',
          isCritical: true,
        },
        { sectionId: 'timeline', fieldPath: 'timeline', label: 'Timeline', isCritical: true },
        { sectionId: 'kpis', fieldPath: 'kpis', label: 'KPIs', isCritical: true },
        { sectionId: 'tasks', fieldPath: 'tasks', label: 'Implementation Plan', isCritical: true },
        { sectionId: 'resources', fieldPath: 'budgetItems', label: 'Budget', isCritical: true },
        { sectionId: 'control', fieldPath: 'gateRoles', label: 'Governance', isCritical: true },
        {
          sectionId: 'resources',
          fieldPath: 'resourceItems',
          label: 'Resources',
          isCritical: true,
        },
        { sectionId: 'raid', fieldPath: 'raidItems', label: 'RAID', isCritical: true },
        {
          sectionId: 'financialImpact',
          fieldPath: 'intangibleAssets',
          label: 'Benefits Case',
          isCritical: true,
        },
        {
          sectionId: 'team',
          fieldPath: 'resourceItems',
          label: 'Team Structure',
          isCritical: true,
        },
        {
          sectionId: 'raciEscalation',
          fieldPath: 'gateRoles',
          label: 'Steering Committee',
          isCritical: true,
        },
      ],
      DONE: [
        { sectionId: 'overview', fieldPath: 'name', label: 'Name', isCritical: true },
        { sectionId: 'overview', fieldPath: 'description', label: 'Description', isCritical: true },
        { sectionId: 'overview', fieldPath: 'ownerId', label: 'Owner', isCritical: true },
      ],
    },
  },
];

const STATUS_TO_CONFIG: Record<string, string> = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'DRAFT',
  REVIEW: 'DRAFT',
  PROMOTED: 'DRAFT',
  PLANNING: 'PLANNING',
  APPROVED: 'PLANNING',
  SCHEDULED: 'PLANNING',
  EXECUTING: 'IN_EXECUTION',
  BLOCKED: 'IN_EXECUTION',
  DONE: 'DONE',
  TRACKING: 'DONE',
  CANCELLED: 'DRAFT',
  ARCHIVED: 'DONE',
};

export function getInitiativeLevelTemplate(level: string): InitiativeLevelTemplate | null {
  const normalized = level?.toLowerCase().trim();
  return INITIATIVE_LEVEL_TEMPLATES.find((t) => t.level === normalized) ?? null;
}

export function getConfigKeyForStatus(status: string): string {
  const normalized = String(status || '')
    .toUpperCase()
    .trim();
  return STATUS_TO_CONFIG[normalized] ?? 'DRAFT';
}

/** List-type field paths for completeness calculation */
const LIST_FIELD_PATHS = new Set([
  'kpis',
  'stakeholders',
  'tasks',
  'budgetItems',
  'resourceItems',
  'raidItems',
  'gateRoles',
  'intangibleAssets',
]);

function inferFieldType(fieldPath: string): 'text' | 'rich_text' | 'select' | 'list' {
  if (LIST_FIELD_PATHS.has(fieldPath)) return 'list';
  if (fieldPath === 'ownerId' || fieldPath === 'level') return 'select';
  if (fieldPath === 'description' || fieldPath === 'objectives' || fieldPath === 'scope')
    return 'rich_text';
  return 'text';
}

/**
 * Build CompletenessConfig from initiative level template for use with useCompleteness.
 */
export function buildCompletenessConfigFromTemplate(
  template: InitiativeLevelTemplate,
  status: string
): {
  artifactType: 'initiative';
  status: string;
  requiredSections: Array<{
    id: string;
    label: string;
    fields: Array<{
      id: string;
      sectionId: string;
      fieldPath: string;
      label: string;
      type: 'text' | 'rich_text' | 'select' | 'list';
      isCritical: boolean;
    }>;
  }>;
} | null {
  const configKey = getConfigKeyForStatus(status);
  const fields = template.requiredFieldsByStatus[configKey];
  if (!fields || fields.length === 0) return null;

  const bySection = new Map<
    string,
    Array<{
      id: string;
      sectionId: string;
      fieldPath: string;
      label: string;
      type: 'text' | 'rich_text' | 'select' | 'list';
      isCritical: boolean;
    }>
  >();
  for (const f of fields) {
    const type = f.type ?? inferFieldType(f.fieldPath);
    const id = `${f.sectionId}_${f.fieldPath}`;
    const list = bySection.get(f.sectionId) ?? [];
    list.push({
      id,
      sectionId: f.sectionId,
      fieldPath: f.fieldPath,
      label: f.label,
      type: type as 'text' | 'rich_text' | 'select' | 'list',
      isCritical: f.isCritical,
    });
    bySection.set(f.sectionId, list);
  }

  const requiredSections = Array.from(bySection.entries()).map(([sectionId, fields]) => ({
    id: sectionId,
    label: sectionId.charAt(0).toUpperCase() + sectionId.slice(1),
    fields,
  }));

  return {
    artifactType: 'initiative' as const,
    status: configKey,
    requiredSections,
  };
}
