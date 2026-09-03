import type { TFunction } from 'i18next';

export type InterviewObjectType =
  | 'assignment'
  | 'inbox'
  | 'session'
  | 'template'
  | 'insight'
  | 'initiative';

export type InterviewActionSurface = 'row' | 'preview';

export interface InterviewActionDefinition {
  id: string;
  i18nKey: string;
  surfaces: readonly InterviewActionSurface[];
  operation: string;
  omittedReason?: string;
}

const both = ['row', 'preview'] as const;

/**
 * Domain SSOT for Interview action discovery. The matrix deliberately stores
 * no callbacks: callers bind the existing, permission-aware handler. That
 * keeps one vocabulary/route contract without moving authorization to the UI.
 */
export const INTERVIEW_ACTION_MATRIX: Record<
  InterviewObjectType,
  readonly InterviewActionDefinition[]
> = {
  assignment: [
    {
      id: 'start',
      i18nKey: 'interview.hub.start',
      surfaces: both,
      operation: 'startInterviewAssignment',
    },
    {
      id: 'continue',
      i18nKey: 'interview.hub.continue',
      surfaces: both,
      operation: 'GET /api/interview/sessions/:id',
    },
    {
      id: 'fix',
      i18nKey: 'interview.hub.fixResubmit',
      surfaces: both,
      operation: 'GET /api/interview/sessions/:id',
    },
    {
      id: 'approve',
      i18nKey: 'interview.hub.approve',
      surfaces: both,
      operation: 'handleOpenApproveModal',
    },
    {
      id: 'send-back',
      i18nKey: 'interview.hub.sendBack3',
      surfaces: both,
      operation: 'handleOpenSendBackModal',
    },
    {
      id: 'reassign',
      i18nKey: 'interview.hub.reassign',
      surfaces: both,
      operation: 'handleReassignAssignment',
    },
    {
      id: 'remind',
      i18nKey: 'interview.hub.sendReminder',
      surfaces: both,
      operation: 'handleOpenReminderModal',
    },
    {
      id: 'escalate',
      i18nKey: 'interview.hub.escalateNow',
      surfaces: both,
      operation: 'handleEscalateNow',
    },
    {
      id: 'edit',
      i18nKey: 'interview.hub.edit',
      surfaces: both,
      operation: 'existing assignment edit flow',
    },
    {
      id: 'archive',
      i18nKey: 'interview.hub.archive',
      surfaces: both,
      operation: 'POST /api/interview/assignments/:id/archive',
    },
    {
      id: 'restore',
      i18nKey: 'interview.hub.restore',
      surfaces: both,
      operation: 'POST /api/interview/assignments/:id/restore',
    },
    {
      id: 'delay',
      i18nKey: 'interview.hub.delay',
      surfaces: both,
      operation: 'handleDelayAssignment',
    },
  ],
  inbox: [
    {
      id: 'start',
      i18nKey: 'interview.hub.start',
      surfaces: both,
      operation: 'startInterviewAssignment',
    },
    {
      id: 'continue',
      i18nKey: 'interview.hub.continue',
      surfaces: both,
      operation: 'GET /api/interview/sessions/:id',
    },
    {
      id: 'fix',
      i18nKey: 'interview.hub.fixResubmit',
      surfaces: both,
      operation: 'GET /api/interview/sessions/:id',
    },
    {
      id: 'edit',
      i18nKey: 'interview.hub.edit',
      surfaces: both,
      operation: 'startInterviewAssignment',
    },
    {
      id: 'delay',
      i18nKey: 'interview.hub.delay',
      surfaces: both,
      operation: 'handleDelayAssignment',
    },
  ],
  session: [
    {
      id: 'approve',
      i18nKey: 'interview.hub.approve',
      surfaces: both,
      operation: 'handleApproveAssignment',
    },
    {
      id: 'send-back',
      i18nKey: 'interview.hub.sendBack2',
      surfaces: both,
      operation: 'handleOpenSendBackModal',
    },
    {
      id: 'remind',
      i18nKey: 'interview.hub.remind',
      surfaces: both,
      operation: 'handleOpenReminderModal',
    },
    {
      id: 'generate-insight',
      i18nKey: 'interview.hub.generateAiInsights',
      surfaces: both,
      operation: 'existing insight generation flow',
    },
    {
      id: 'archive',
      i18nKey: 'interview.hub.archive',
      surfaces: both,
      operation: 'POST /api/interview/sessions/:id/archive',
    },
    {
      id: 'restore',
      i18nKey: 'interview.hub.restore',
      surfaces: both,
      operation: 'POST /api/interview/sessions/:id/restore',
    },
    {
      id: 'trash',
      i18nKey: 'interview.hub.moveToTrash',
      surfaces: both,
      operation: 'POST /api/interview/sessions/:id/trash',
    },
    {
      id: 'delete',
      i18nKey: 'interview.hub.deleteForever',
      surfaces: both,
      operation: 'DELETE /api/interview/sessions/:id',
    },
    {
      id: 'delay',
      i18nKey: 'interview.hub.delay',
      surfaces: both,
      operation: 'handleDelayAssignment',
    },
  ],
  template: [
    {
      id: 'use',
      i18nKey: 'interview.hub.useTemplate',
      surfaces: both,
      operation: 'POST /api/interview/templates/:id/use',
    },
    {
      id: 'assign',
      i18nKey: 'interview.hub.assign',
      surfaces: both,
      operation: 'existing assign modal',
    },
    {
      id: 'clone',
      i18nKey: 'interview.hub.cloneTemplate',
      surfaces: both,
      operation: 'POST /api/interview/templates/:id/clone',
    },
    {
      id: 'edit',
      i18nKey: 'interview.hub.editTemplate',
      surfaces: both,
      operation: 'existing template editor',
    },
    {
      id: 'toggle-default',
      i18nKey: 'interview.hub.setAsDefault',
      surfaces: both,
      operation: 'POST /api/interview/templates/:id/default',
    },
    {
      id: 'archive',
      i18nKey: 'interview.hub.archiveTemplate',
      surfaces: both,
      operation: 'POST /api/interview/templates/:id/archive',
    },
    {
      id: 'restore',
      i18nKey: 'interview.hub.restoreTemplate',
      surfaces: both,
      operation: 'POST /api/interview/templates/:id/restore',
    },
    {
      id: 'delete',
      i18nKey: 'interview.hub.deleteTemplate',
      surfaces: both,
      operation: 'DELETE /api/interview/templates/:id',
    },
  ],
  insight: [
    {
      id: 'fork',
      i18nKey: 'interview.hub.fork',
      surfaces: both,
      operation: 'existing fork handler',
    },
    {
      id: 'export-tools',
      i18nKey: 'interview.hub.tools',
      surfaces: ['row'],
      operation: 'existing Tools export handler',
      omittedReason: 'Preview export stays in Details kebab (§7.3).',
    },
    {
      id: 'export-assessment',
      i18nKey: 'interview.hub.assessment',
      surfaces: both,
      operation: 'existing Assessment export handler',
    },
    {
      id: 'archive',
      i18nKey: 'interview.hub.archive',
      surfaces: both,
      operation: 'existing insight lifecycle handler',
    },
    {
      id: 'restore',
      i18nKey: 'interview.hub.restore',
      surfaces: both,
      operation: 'existing insight lifecycle handler',
    },
    {
      id: 'delete',
      i18nKey: 'interview.hub.delete',
      surfaces: both,
      operation: 'existing insight delete handler',
    },
  ],
  initiative: [
    {
      id: 'send-to-review',
      i18nKey: 'interview.hub.sendToReview',
      surfaces: both,
      operation: 'existing initiative status handler',
    },
    {
      id: 'approve-to-initiatives',
      i18nKey: 'interview.hub.approveAndMoveForward',
      surfaces: both,
      operation: 'existing initiative status handler + InitiativeDocumentView route',
    },
    {
      id: 'back-to-draft',
      i18nKey: 'interview.hub.backToDraft',
      surfaces: both,
      operation: 'existing initiative status handler',
    },
    {
      id: 'open-module',
      i18nKey: 'interview.hub.openInInitiatives',
      surfaces: both,
      operation: 'InitiativeDocumentView route',
    },
  ],
};

export function getInterviewActionDefinition(type: InterviewObjectType, id: string) {
  const definition = INTERVIEW_ACTION_MATRIX[type].find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown Interview action: ${type}.${id}`);
  return definition;
}

export function interviewActionMeta(type: InterviewObjectType, id: string, t: TFunction) {
  const definition = getInterviewActionDefinition(type, id);
  return { id: definition.id, label: t(definition.i18nKey) };
}
