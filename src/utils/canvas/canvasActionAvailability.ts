import type {
  CanvasActionAvailability,
  CanvasActionGroup,
  CanvasActionId,
  CanvasDocumentState,
  CanvasRuntimeCapabilities,
} from '@/types/canvasWorkspace';

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

const actionLabels: Record<CanvasActionId, string> = {
  copy: 'Copy Markdown',
  share: 'Share Canvas document',
  save: 'Save Canvas document',
  close: 'Close Canvas',
  'view-document': 'Document view',
  'view-md': 'Markdown view',
  'create-presentation': 'Create presentation',
  // #86b: this action materializes a spreadsheet resource (see
  // server/src/routes/work-canvas.routes.ts — outputType 'table' -> 'spreadsheet'),
  // NOT the idea-table (StandardTable/Idea Table) tool. Doktryna: Tabela(idea)≠Excel
  // (oblicz) — label must say "sheet", not "table", to avoid promising the wrong tool.
  'create-table': 'Create sheet',
  'create-report': 'Create report',
  'send-to-idea': 'Send to idea',
  'save-as-note': 'Save as note',
  'create-initiative': 'Create initiative',
  // C3
  'create-decision': 'Capture decision',
  'create-task': 'Create task',
};

function availability(
  actionId: CanvasActionId,
  status: CanvasActionAvailability['status'],
  reason?: string
): CanvasActionAvailability {
  return {
    actionId,
    group: actionGroups[actionId],
    label: actionLabels[actionId],
    status,
    reason,
  };
}

export function getCanvasActionAvailability(
  actionId: CanvasActionId,
  documentState: CanvasDocumentState | null,
  capabilities: CanvasRuntimeCapabilities = {}
): CanvasActionAvailability {
  const hasDocument = Boolean(documentState);
  const hasContent = Boolean(documentState?.contentMd?.trim());

  if (!hasDocument && actionId !== 'close') {
    return availability(actionId, 'disabled_no_active_document', 'No active Canvas document.');
  }

  if (actionId === 'copy' && !hasContent) {
    return availability(actionId, 'disabled_no_active_document', 'Nothing to copy yet.');
  }

  if (actionId === 'share' && !capabilities.canShare) {
    // P0-2 — the share runtime exists; a disabled button means the user lacks
    // the canvas.share capability, so say that instead of "coming soon".
    return availability(
      actionId,
      'disabled_missing_permission',
      'Brak uprawnień do udostępniania / No permission to share.'
    );
  }

  if (actionId === 'create-presentation' && !capabilities.canCreatePresentation) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Presentation output runtime is unavailable.'
    );
  }

  if (actionId === 'create-table' && !capabilities.canCreateTable) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Sheet output runtime is unavailable.'
    );
  }

  if (actionId === 'create-report' && !capabilities.canCreateReport) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Report output runtime is unavailable.'
    );
  }

  if (actionId === 'send-to-idea' && !capabilities.canSendToIdea) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Idea handoff runtime is unavailable.'
    );
  }

  if (actionId === 'save-as-note' && !capabilities.canSaveAsNote) {
    return availability(actionId, 'disabled_missing_runtime', 'Note save runtime is unavailable.');
  }

  if (actionId === 'create-initiative' && !capabilities.canCreateInitiative) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Initiative creation runtime is unavailable.'
    );
  }

  // C3 — new workspace targets surfaced by the converged shell.
  if (actionId === 'create-decision' && !capabilities.canCreateDecision) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Decision capture runtime is unavailable.'
    );
  }

  if (actionId === 'create-task' && !capabilities.canCreateTask) {
    return availability(
      actionId,
      'disabled_missing_runtime',
      'Task creation runtime is unavailable.'
    );
  }

  return availability(actionId, 'enabled');
}

export function getCanvasActionAvailabilities(
  actionIds: CanvasActionId[],
  documentState: CanvasDocumentState | null,
  capabilities: CanvasRuntimeCapabilities = {}
): CanvasActionAvailability[] {
  return actionIds.map((actionId) =>
    getCanvasActionAvailability(actionId, documentState, capabilities)
  );
}
