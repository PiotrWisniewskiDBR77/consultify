/**
 * NMode Completeness — JSON-driven configuration
 *
 * Required fields per artifact type and status.
 * Used by useCompleteness to evaluate completeness and gate readiness.
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

import type { CompletenessConfig } from './types';

/** Canonical status mapping: maps runtime status to config key */
const INITIATIVE_STATUS_TO_CONFIG: Record<string, string> = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'DRAFT',
  REVIEW: 'DRAFT',
  PROMOTED: 'DRAFT',
  PLANNING: 'PLANNING',
  APPROVED: 'PLANNING',
  SCHEDULED: 'PLANNING',
  EXECUTING: 'EXECUTING',
  BLOCKED: 'EXECUTING',
  DONE: 'DONE',
  TRACKING: 'DONE',
  CANCELLED: 'DRAFT',
  ARCHIVED: 'DONE',
};

const DECISION_STATUS_TO_CONFIG: Record<string, string> = {
  PENDING: 'PENDING',
  ESCALATED: 'PENDING',
  APPROVED: 'DECIDED',
  REJECTED: 'DECIDED',
  DEFERRED: 'DECIDED',
  DECIDED: 'DECIDED',
};

const TASK_STATUS_TO_CONFIG: Record<string, string> = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'IN_PROGRESS',
  DONE: 'DONE',
};

const NOTIFICATION_STATUS_TO_CONFIG: Record<string, string> = {
  NEW: 'NEW',
  UNREAD: 'NEW',
  READ: 'READ',
};

const INITIATIVE_CONFIGS: Record<string, Omit<CompletenessConfig, 'artifactType' | 'status'>> = {
  DRAFT: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'name',
            sectionId: 'core',
            fieldPath: 'name',
            label: 'Name',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'description',
            sectionId: 'core',
            fieldPath: 'description',
            label: 'Description',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'owner',
            sectionId: 'core',
            fieldPath: 'ownerId',
            label: 'Owner',
            type: 'select',
            isCritical: true,
          },
        ],
      },
    ],
  },
  PLANNING: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'name',
            sectionId: 'core',
            fieldPath: 'name',
            label: 'Name',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'description',
            sectionId: 'core',
            fieldPath: 'description',
            label: 'Description',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'owner',
            sectionId: 'core',
            fieldPath: 'ownerId',
            label: 'Owner',
            type: 'select',
            isCritical: true,
          },
          {
            id: 'scope',
            sectionId: 'scope',
            fieldPath: 'scope',
            label: 'Scope',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'objectives',
            sectionId: 'scope',
            fieldPath: 'objectives',
            label: 'Objectives',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'kpis',
            sectionId: 'scope',
            fieldPath: 'kpis',
            label: 'KPIs',
            type: 'list',
            isCritical: false,
          },
        ],
      },
    ],
  },
  EXECUTING: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'name',
            sectionId: 'core',
            fieldPath: 'name',
            label: 'Name',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'description',
            sectionId: 'core',
            fieldPath: 'description',
            label: 'Description',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'owner',
            sectionId: 'core',
            fieldPath: 'ownerId',
            label: 'Owner',
            type: 'select',
            isCritical: true,
          },
          {
            id: 'scope',
            sectionId: 'scope',
            fieldPath: 'scope',
            label: 'Scope',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'objectives',
            sectionId: 'scope',
            fieldPath: 'objectives',
            label: 'Objectives',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'timeline',
            sectionId: 'execution',
            fieldPath: 'timeline',
            label: 'Timeline',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'budget',
            sectionId: 'execution',
            fieldPath: 'budget',
            label: 'Budget',
            type: 'number',
            isCritical: false,
          },
          {
            id: 'team',
            sectionId: 'execution',
            fieldPath: 'team',
            label: 'Team',
            type: 'list',
            isCritical: false,
          },
        ],
      },
    ],
  },
  DONE: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'name',
            sectionId: 'core',
            fieldPath: 'name',
            label: 'Name',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'description',
            sectionId: 'core',
            fieldPath: 'description',
            label: 'Description',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'owner',
            sectionId: 'core',
            fieldPath: 'ownerId',
            label: 'Owner',
            type: 'select',
            isCritical: true,
          },
          {
            id: 'results',
            sectionId: 'closure',
            fieldPath: 'results',
            label: 'Results',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'lessons',
            sectionId: 'closure',
            fieldPath: 'lessonsLearned',
            label: 'Lessons Learned',
            type: 'rich_text',
            isCritical: false,
          },
        ],
      },
    ],
  },
};

const DECISION_CONFIGS: Record<string, Omit<CompletenessConfig, 'artifactType' | 'status'>> = {
  PENDING: {
    requiredSections: [
      {
        id: 'core',
        label: 'Context',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'context',
            sectionId: 'core',
            fieldPath: 'context',
            label: 'Context',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'options',
            sectionId: 'core',
            fieldPath: 'options',
            label: 'Options',
            type: 'list',
            isCritical: true,
          },
        ],
      },
    ],
  },
  DECIDED: {
    requiredSections: [
      {
        id: 'core',
        label: 'Context',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'context',
            sectionId: 'core',
            fieldPath: 'context',
            label: 'Context',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'options',
            sectionId: 'core',
            fieldPath: 'options',
            label: 'Options',
            type: 'list',
            isCritical: true,
          },
          {
            id: 'selectedOption',
            sectionId: 'outcome',
            fieldPath: 'selectedOption',
            label: 'Selected Option',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'rationale',
            sectionId: 'outcome',
            fieldPath: 'rationale',
            label: 'Rationale',
            type: 'rich_text',
            isCritical: true,
          },
          {
            id: 'owner',
            sectionId: 'outcome',
            fieldPath: 'decisionOwnerId',
            label: 'Decision Owner',
            type: 'select',
            isCritical: true,
          },
        ],
      },
    ],
  },
};

const TASK_CONFIGS: Record<string, Omit<CompletenessConfig, 'artifactType' | 'status'>> = {
  TODO: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'assignee',
            sectionId: 'core',
            fieldPath: 'assigneeId',
            label: 'Assignee',
            type: 'select',
            isCritical: true,
          },
        ],
      },
    ],
  },
  IN_PROGRESS: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'assignee',
            sectionId: 'core',
            fieldPath: 'assigneeId',
            label: 'Assignee',
            type: 'select',
            isCritical: true,
          },
          {
            id: 'dueDate',
            sectionId: 'core',
            fieldPath: 'dueDate',
            label: 'Due Date',
            type: 'date',
            isCritical: true,
          },
        ],
      },
    ],
  },
  DONE: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'assignee',
            sectionId: 'core',
            fieldPath: 'assigneeId',
            label: 'Assignee',
            type: 'select',
            isCritical: true,
          },
          {
            id: 'completionNotes',
            sectionId: 'core',
            fieldPath: 'completionNotes',
            label: 'Completion Notes',
            type: 'rich_text',
            isCritical: false,
          },
        ],
      },
    ],
  },
};

const NOTIFICATION_CONFIGS: Record<string, Omit<CompletenessConfig, 'artifactType' | 'status'>> = {
  NEW: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'message',
            sectionId: 'core',
            fieldPath: 'message',
            label: 'Message',
            type: 'rich_text',
            isCritical: true,
          },
        ],
      },
    ],
  },
  READ: {
    requiredSections: [
      {
        id: 'core',
        label: 'Core',
        fields: [
          {
            id: 'title',
            sectionId: 'core',
            fieldPath: 'title',
            label: 'Title',
            type: 'text',
            isCritical: true,
          },
          {
            id: 'message',
            sectionId: 'core',
            fieldPath: 'message',
            label: 'Message',
            type: 'rich_text',
            isCritical: true,
          },
        ],
      },
    ],
  },
};

function getConfigKey(
  artifactType: string,
  status: string,
  statusMap: Record<string, string>
): string {
  const normalized = String(status || '')
    .toUpperCase()
    .trim();
  return statusMap[normalized] ?? statusMap['*'] ?? normalized;
}

export function getCompletenessConfig(
  artifactType: 'initiative' | 'decision' | 'task' | 'notification',
  status: string
): CompletenessConfig | null {
  const statusKey = String(status || '')
    .toUpperCase()
    .trim();
  let configKey: string;
  let configs: Record<string, Omit<CompletenessConfig, 'artifactType' | 'status'>>;

  switch (artifactType) {
    case 'initiative':
      configKey = INITIATIVE_STATUS_TO_CONFIG[statusKey] ?? 'DRAFT';
      configs = INITIATIVE_CONFIGS;
      break;
    case 'decision':
      configKey = DECISION_STATUS_TO_CONFIG[statusKey] ?? 'PENDING';
      configs = DECISION_CONFIGS;
      break;
    case 'task':
      configKey = TASK_STATUS_TO_CONFIG[statusKey] ?? 'TODO';
      configs = TASK_CONFIGS;
      break;
    case 'notification':
      configKey = NOTIFICATION_STATUS_TO_CONFIG[statusKey] ?? 'NEW';
      configs = NOTIFICATION_CONFIGS;
      break;
    default:
      return null;
  }

  const base = configs[configKey];
  if (!base) return null;

  return {
    artifactType,
    status: statusKey,
    ...base,
  };
}
