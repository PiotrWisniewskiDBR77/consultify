export type NotebookActionSurface =
  | 'format-toolbar'
  | 'format-bubble'
  | 'export-menu'
  | 'note-menu'
  | 'block-menu'
  | 'inline-ai'
  | 'work-rail';

export interface NotebookActionContract {
  id: string;
  surface: NotebookActionSurface;
  effect: string;
  execution: 'editor-command' | 'local-navigation' | 'governed-api' | 'download';
  permission: 'editor-capability' | 'page-read' | 'page-write' | 'server-authoritative';
  outcome: 'editor-state' | 'visible-panel' | 'download' | 'server-receipt-required';
  duplicatePolicy: 'editor-transaction' | 'single-flight-required' | 'idempotency-required' | 'n/a';
}

/**
 * Machine-counted inventory of every retained Notebook command surface.
 *
 * This is deliberately an audit catalogue, not an authorization layer. Server
 * permissions and durable receipts still come from the API. Keeping the two
 * concepts separate prevents a locally rendered control from being mistaken
 * for a qualified mutation capability.
 */
export interface NotebookAuditedAction {
  id: string;
  surface: NotebookActionSurface;
  effect: 'editor' | 'local-ui' | 'server-mutation' | 'download';
  availability: 'editor' | 'page-read' | 'page-write' | 'server-capability';
  implementation: 'implemented' | 'partial' | 'disabled' | 'blocked';
  requiredEvidence: 'editor-transaction' | 'visible-state' | 'server-receipt' | 'download';
  observedEvidence:
    | 'editor-transaction'
    | 'visible-state'
    | 'api-response'
    | 'server-receipt'
    | 'download'
    | 'none';
}

const audited = (
  id: string,
  surface: NotebookActionSurface,
  effect: NotebookAuditedAction['effect'],
  availability: NotebookAuditedAction['availability'],
  requiredEvidence: NotebookAuditedAction['requiredEvidence'],
  implementation: NotebookAuditedAction['implementation'] = 'implemented',
  observedEvidence: NotebookAuditedAction['observedEvidence'] = requiredEvidence
): NotebookAuditedAction => ({
  id,
  surface,
  effect,
  availability,
  implementation,
  requiredEvidence,
  observedEvidence,
});

const auditAvailability = (
  permission: NotebookActionContract['permission']
): NotebookAuditedAction['availability'] => {
  if (permission === 'server-authoritative') return 'server-capability';
  if (permission === 'editor-capability') return 'editor';
  return permission;
};

export const NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS = [
  'undo',
  'redo',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'code',
  'link',
  'align-left',
  'align-center',
  'align-right',
  'align-justify',
  'heading-1',
  'heading-2',
  'heading-3',
  'bullet-list',
  'ordered-list',
  'task-list',
  'blockquote',
  'clear-formatting',
] as const;

export const NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'highlight',
  'link',
] as const;

export const NOTEBOOK_EXPORT_ACTION_IDS = ['trigger', 'markdown', 'pdf', 'docx'] as const;

const formatActions = [
  ...NOTEBOOK_STATIC_TOOLBAR_ACTION_IDS.map((id) =>
    audited(`format:toolbar:${id}`, 'format-toolbar', 'editor', 'editor', 'editor-transaction')
  ),
  ...NOTEBOOK_BUBBLE_TOOLBAR_ACTION_IDS.map((id) =>
    audited(`format:bubble:${id}`, 'format-bubble', 'editor', 'editor', 'editor-transaction')
  ),
];

const exportActions = NOTEBOOK_EXPORT_ACTION_IDS.map((id) =>
  audited(
    `export:${id}`,
    'export-menu',
    id === 'trigger' ? 'local-ui' : 'download',
    'page-read',
    id === 'trigger' ? 'visible-state' : 'download'
  )
);

const blockActions = [
  'block-duplicate',
  'block-move-up',
  'block-move-down',
  'block-delete',
  'block-callout-info',
  'block-callout-warning',
  'block-callout-success',
  'block-callout-critical',
  'block-toggle-open',
  'block-toggle-closed',
  'block-table-row',
  'block-table-column',
  'h1',
  'h2',
  'h3',
  'bullet',
  'ordered',
  'todo',
  'image',
  'quote',
  'date',
  'columns',
  'callout',
  'warning',
  'toggle',
  'divider',
  'table',
  'code',
].map((id) => audited(`block:${id}`, 'block-menu', 'editor', 'editor', 'editor-transaction'));

const blockHandoffs = [
  ['ai-ask', 'local-ui'],
  ['ai-expand', 'local-ui'],
  ['ai-challenge', 'local-ui'],
  ['ai-action', 'local-ui'],
  ['create-task', 'server-mutation'],
  ['create-decision', 'server-mutation'],
  ['save-as-idea', 'server-mutation'],
] as const;

const inlineAiActions = [
  'trigger',
  'shorten',
  'expand',
  'improve',
  'formal',
  'explain',
  'approve',
  'reject',
  'retry',
  'close',
].map((id) =>
  audited(
    `inline-ai:${id}`,
    'inline-ai',
    ['trigger', 'close'].includes(id) ? 'local-ui' : 'server-mutation',
    ['trigger', 'close'].includes(id) ? 'page-read' : 'server-capability',
    ['trigger', 'close'].includes(id) ? 'visible-state' : 'server-receipt',
    ['trigger', 'close'].includes(id) ? 'implemented' : 'partial',
    ['trigger', 'close'].includes(id) ? 'visible-state' : 'api-response'
  )
);

const railActions = [
  ['tab-work', 'local-ui', 'page-read', 'visible-state'],
  ['tab-context', 'local-ui', 'page-read', 'visible-state'],
  ['close', 'local-ui', 'page-read', 'visible-state'],
  ['retry-save', 'server-mutation', 'server-capability', 'server-receipt'],
  ['load-theirs', 'server-mutation', 'server-capability', 'server-receipt'],
  ['keep-mine', 'server-mutation', 'server-capability', 'server-receipt'],
  ['visibility-private', 'server-mutation', 'server-capability', 'server-receipt'],
  ['visibility-project', 'server-mutation', 'server-capability', 'server-receipt'],
  ['verification-status', 'server-mutation', 'server-capability', 'server-receipt'],
  ['review-cadence', 'server-mutation', 'server-capability', 'server-receipt'],
  ['mark-reviewed', 'server-mutation', 'server-capability', 'server-receipt'],
  ['open-teresa', 'local-ui', 'page-read', 'visible-state'],
] as const;

export const buildNotebookCrossSurfaceActionAudit = (): readonly NotebookAuditedAction[] => [
  ...Object.values(NOTEBOOK_ACTION_REGISTRY).map((item) =>
    audited(
      `note:${item.id}`,
      item.surface,
      item.execution === 'governed-api'
        ? 'server-mutation'
        : item.execution === 'download'
          ? 'download'
          : 'local-ui',
      item.execution === 'governed-api' ? 'server-capability' : auditAvailability(item.permission),
      item.outcome === 'server-receipt-required'
        ? 'server-receipt'
        : item.outcome === 'download'
          ? 'download'
          : 'visible-state',
      item.execution === 'governed-api' ? 'blocked' : 'implemented',
      item.execution === 'governed-api'
        ? 'none'
        : item.execution === 'download'
          ? 'download'
          : 'visible-state'
    )
  ),
  ...(
    ['initiative', 'task', 'decision', 'idea', 'assessment', 'report', 'presentation'] as const
  ).map((target) => {
    const item = notebookConvertActionContract(target);
    return audited(
      `note:${item.id}`,
      item.surface,
      item.execution === 'governed-api' ? 'server-mutation' : 'local-ui',
      item.execution === 'governed-api' ? 'server-capability' : auditAvailability(item.permission),
      item.outcome === 'server-receipt-required' ? 'server-receipt' : 'visible-state',
      item.execution === 'governed-api' ? 'blocked' : 'implemented',
      item.execution === 'governed-api' ? 'none' : 'visible-state'
    );
  }),
  ...formatActions,
  ...exportActions,
  ...blockActions,
  ...blockHandoffs.map(([id, effect]) =>
    audited(
      `block:${id}`,
      'block-menu',
      effect,
      effect === 'server-mutation' ? 'server-capability' : 'page-read',
      effect === 'server-mutation' ? 'server-receipt' : 'visible-state',
      effect === 'server-mutation' ? 'partial' : 'implemented',
      effect === 'server-mutation' ? 'api-response' : 'visible-state'
    )
  ),
  ...inlineAiActions,
  ...railActions.map(([id, effect, availability, evidence]) =>
    audited(
      `rail:${id}`,
      'work-rail',
      effect,
      availability,
      evidence,
      effect === 'server-mutation' ? 'partial' : 'implemented',
      effect === 'server-mutation' ? 'api-response' : 'visible-state'
    )
  ),
];

const contract = (
  id: string,
  surface: NotebookActionSurface,
  effect: string,
  execution: NotebookActionContract['execution'],
  permission: NotebookActionContract['permission'],
  outcome: NotebookActionContract['outcome'],
  duplicatePolicy: NotebookActionContract['duplicatePolicy']
): NotebookActionContract => ({
  id,
  surface,
  effect,
  execution,
  permission,
  outcome,
  duplicatePolicy,
});

export const NOTEBOOK_ACTION_REGISTRY = {
  export: contract(
    'export',
    'note-menu',
    'Export the current note',
    'download',
    'page-read',
    'download',
    'single-flight-required'
  ),
  'version-history': contract(
    'version-history',
    'note-menu',
    'Open note version history',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  sources: contract(
    'sources',
    'note-menu',
    'Reveal sources and attachments',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  verification: contract(
    'verification',
    'note-menu',
    'Open Work governance',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  share: contract(
    'share',
    'note-menu',
    'Open a local email-client handoff; no server share is created',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  'expand-document': contract(
    'expand-document',
    'note-menu',
    'Create a document draft from the note',
    'governed-api',
    'page-write',
    'server-receipt-required',
    'single-flight-required'
  ),
  'connection-graph': contract(
    'connection-graph',
    'note-menu',
    'Open the connection graph',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  'ask-ai': contract(
    'ask-ai',
    'note-menu',
    'Open a governed AI proposal flow',
    'local-navigation',
    'page-read',
    'visible-panel',
    'n/a'
  ),
  delete: contract(
    'delete',
    'note-menu',
    'Delete the current note',
    'governed-api',
    'page-write',
    'server-receipt-required',
    'idempotency-required'
  ),
} as const satisfies Record<string, NotebookActionContract>;

export const notebookConvertActionContract = (target: string): NotebookActionContract =>
  ['initiative', 'task', 'decision'].includes(target)
    ? contract(
        `convert-${target}`,
        'note-menu',
        `Create a governed ${target} from the note`,
        'governed-api',
        'server-authoritative',
        'server-receipt-required',
        'idempotency-required'
      )
    : contract(
        `convert-${target}`,
        'note-menu',
        `Open a reviewed ${target} handoff from the note`,
        'local-navigation',
        'page-read',
        'visible-panel',
        'n/a'
      );

export const getNotebookActionContract = (id: string): NotebookActionContract | null => {
  if (id.startsWith('convert-')) return notebookConvertActionContract(id.slice('convert-'.length));
  return NOTEBOOK_ACTION_REGISTRY[id as keyof typeof NOTEBOOK_ACTION_REGISTRY] ?? null;
};
