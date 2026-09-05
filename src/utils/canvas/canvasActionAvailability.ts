import type { TFunction } from 'i18next';

import type {
  CanvasActionAvailability,
  CanvasActionGroup,
  CanvasActionId,
  CanvasDocumentState,
  CanvasRuntimeCapabilities,
} from '@/types/canvasWorkspace';

const fallbackT = ((_key: string, fallback: string) => fallback) as TFunction;

const actionGroups: Record<CanvasActionId, CanvasActionGroup> = {
  copy: 'file',
  share: 'file',
  save: 'file',
  close: 'file',
  'view-document': 'view',
  'view-md': 'view',
  'create-presentation': 'output',
  'create-table': 'output',
  'create-report': 'output',
  'send-to-idea': 'workspace',
  'save-as-note': 'workspace',
  'create-initiative': 'workspace',
  // C3 — converged actions surfaced from WorkCanvasShell.
  'create-decision': 'workspace',
  'create-task': 'workspace',
};

const actionLabels = (t: TFunction): Record<CanvasActionId, string> => ({
  copy: t('canvas.actions.copyMarkdown', 'Copy Markdown'),
  share: t('canvas.actions.shareDocument', 'Share Canvas document'),
  save: t('canvas.actions.saveDocument', 'Save Canvas document'),
  close: t('canvas.actions.close', 'Close Canvas'),
  'view-document': t('canvas.actions.documentView', 'Document view'),
  'view-md': t('canvas.actions.markdownView', 'Markdown view'),
  'create-presentation': t('canvas.actions.createPresentation', 'Create presentation'),
  // #86b: this action materializes a spreadsheet resource (see
  // server/src/routes/work-canvas.routes.ts — outputType 'table' -> 'spreadsheet'),
  // NOT the idea-table (StandardTable/Idea Table) tool. Doktryna: Tabela(idea)≠Excel
  // (oblicz) — label must say "sheet", not "table", to avoid promising the wrong tool.
  'create-table': t('canvas.actions.createSheet', 'Create sheet'),
  'create-report': t('canvas.actions.createReport', 'Create report'),
  'send-to-idea': t('canvas.actions.sendToIdea', 'Send to idea'),
  'save-as-note': t('canvas.actions.saveAsNote', 'Save as note'),
  'create-initiative': t('canvas.actions.createInitiative', 'Create initiative'),
  // C3
  'create-decision': t('canvas.actions.captureDecision', 'Capture decision'),
  'create-task': t('canvas.actions.createTask', 'Create task'),
});

function availability(
  actionId: CanvasActionId,
  status: CanvasActionAvailability['status'],
  t: TFunction,
  reason?: string
): CanvasActionAvailability {
  return {
    actionId,
    group: actionGroups[actionId],
    label: actionLabels(t)[actionId],
    status,
    reason,
  };
}

export function getCanvasActionAvailability(
  actionId: CanvasActionId,
  documentState: CanvasDocumentState | null,
  capabilities: CanvasRuntimeCapabilities = {},
  t: TFunction = fallbackT
): CanvasActionAvailability {
  const hasDocument = Boolean(documentState);
  const hasContent = Boolean(documentState?.contentMd?.trim());

  if (!hasDocument && actionId !== 'close') {
    return availability(actionId, 'disabled_no_active_document', t, 'No active Canvas document.');
  }

  if (actionId === 'copy' && !hasContent) {
    return availability(actionId, 'disabled_no_active_document', t, 'Nothing to copy yet.');
  }

  if (actionId === 'share' && !capabilities.canShare) {
    // P0-2 — the share runtime exists; a disabled button means the user lacks
    // the canvas.share capability, so say that instead of "coming soon".
    return availability(
      actionId,
      'disabled_missing_permission',
      t,
      'Brak uprawnień do udostępniania / No permission to share.'
    );
  }

  if (actionId === 'create-presentation' && !capabilities.canCreatePresentation) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Presentation output runtime is unavailable.'
    );
  }

  if (actionId === 'create-table' && !capabilities.canCreateTable) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Sheet output runtime is unavailable.'
    );
  }

  if (actionId === 'create-report' && !capabilities.canCreateReport) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Report output runtime is unavailable.'
    );
  }

  if (actionId === 'send-to-idea' && !capabilities.canSendToIdea) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Idea handoff runtime is unavailable.'
    );
  }

  if (actionId === 'save-as-note' && !capabilities.canSaveAsNote) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Note save runtime is unavailable.'
    );
  }

  if (actionId === 'create-initiative' && !capabilities.canCreateInitiative) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Initiative creation runtime is unavailable.'
    );
  }

  // C3 — new workspace targets surfaced by the converged shell.
  if (actionId === 'create-decision' && !capabilities.canCreateDecision) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Decision capture runtime is unavailable.'
    );
  }

  if (actionId === 'create-task' && !capabilities.canCreateTask) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      t,
      'Task creation runtime is unavailable.'
    );
  }

  return availability(actionId, 'enabled', t);
}

export function getCanvasActionAvailabilities(
  actionIds: CanvasActionId[],
  documentState: CanvasDocumentState | null,
  capabilities: CanvasRuntimeCapabilities = {},
  t: TFunction = fallbackT
): CanvasActionAvailability[] {
  return actionIds.map((actionId) =>
    getCanvasActionAvailability(actionId, documentState, capabilities, t)
  );
}
