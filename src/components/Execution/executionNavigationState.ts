import {
  type ExecutionFunctionId,
  type ExecutionTabOptions,
  resolveExecutionDeepLinkTab,
} from './executionModuleTabs';

export type ExecutionSubview =
  | 'bank'
  | 'work'
  | 'resources'
  | 'risk'
  | 'reports'
  | 'summary'
  | 'rollout';
export type ExecutionSurfaceTab =
  | 'list'
  | 'work'
  | 'resources'
  | 'control'
  | 'reports'
  | 'summary'
  | 'rollout';
export type ExecutionBankView = 'table' | 'kanban' | 'calendar' | 'gantt';
export type ExecutionNavigationIssue =
  | 'SUMMARY_DISABLED'
  | 'UNKNOWN_TAB'
  | 'UNKNOWN_SUBVIEW'
  | 'UNSUPPORTED_ENTITY';

export type ExecutionDocumentIdentity =
  | { kind: 'initiative'; id: string }
  | { kind: 'work' | 'report' | 'intelligence'; id: string };

export interface ExecutionNavigationState {
  functionId: ExecutionFunctionId;
  subview: ExecutionSubview;
  surfaceTab: ExecutionSurfaceTab;
  view: ExecutionBankView;
  initiativeId: string | null;
  executionCaseId: string | null;
  preset: string | null;
  returnContext: string | null;
  documentIdentity: ExecutionDocumentIdentity | null;
  issue: ExecutionNavigationIssue | null;
  params: URLSearchParams;
  hash: string;
}

export interface ExecutionNavigationLocation {
  pathname: string;
  hash: string;
}

export type ExecutionNavigationIntent = 'user' | 'url-sync';

const value = (params: URLSearchParams, key: string): string | null => {
  const result = String(params.get(key) || '').trim();
  return result || null;
};

const splitLocation = (input: string | URLSearchParams) => {
  if (input instanceof URLSearchParams) {
    return { path: '', params: new URLSearchParams(input), hash: '' };
  }
  const raw = String(input || '').trim();
  const hashAt = raw.indexOf('#');
  const hash = hashAt >= 0 ? raw.slice(hashAt) : '';
  const withoutHash = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
  const queryAt = withoutHash.indexOf('?');
  if (queryAt >= 0) {
    return {
      path: withoutHash.slice(0, queryAt),
      params: new URLSearchParams(withoutHash.slice(queryAt + 1)),
      hash,
    };
  }
  if (withoutHash.includes('=')) {
    return { path: '', params: new URLSearchParams(withoutHash), hash };
  }
  return { path: withoutHash, params: new URLSearchParams(), hash };
};

const resolveView = (raw: string | null): ExecutionBankView => {
  switch (raw?.toLowerCase()) {
    case 'grid':
    case 'kanban':
      return 'kanban';
    case 'calendar':
      return 'calendar';
    case 'timeline':
    case 'gantt':
      return 'gantt';
    default:
      return 'table';
  }
};

const defaultSubview = (functionId: ExecutionFunctionId): ExecutionSubview => {
  switch (functionId) {
    case 'work':
      return 'work';
    case 'control':
      return 'risk';
    case 'reports':
      return 'reports';
    default:
      return 'bank';
  }
};

const surfaceFor = (subview: ExecutionSubview): ExecutionSurfaceTab => {
  switch (subview) {
    case 'resources':
      return 'resources';
    case 'summary':
      return 'summary';
    case 'rollout':
      return 'rollout';
    case 'work':
      return 'work';
    case 'risk':
      return 'control';
    case 'reports':
      return 'reports';
    default:
      return 'list';
  }
};

function resolveFunctionAndSubview(
  rawTab: string | null,
  rawSubview: string | null,
  options: ExecutionTabOptions,
  path: string
): Pick<ExecutionNavigationState, 'functionId' | 'subview' | 'surfaceTab' | 'issue'> {
  const tab = resolveExecutionDeepLinkTab(
    rawTab || (/(^|\/)rollout\/?$/i.test(path) ? 'rollout' : 'list')
  );
  let functionId: ExecutionFunctionId;
  let subview: ExecutionSubview;
  let issue: ExecutionNavigationIssue | null = null;

  if (tab === 'resources') {
    functionId = 'work';
    subview = 'resources';
  } else if (tab === 'summary') {
    functionId = 'reports';
    subview = 'summary';
    issue = options.summaryOneLookEnabled ? null : 'SUMMARY_DISABLED';
  } else if (tab === 'rollout') {
    functionId = 'reports';
    subview = 'rollout';
  } else if (tab === 'control') {
    functionId = 'control';
    subview = 'risk';
  } else if (tab === 'work') {
    functionId = 'work';
    subview = 'work';
  } else if (tab === 'reports') {
    functionId = 'reports';
    subview = 'reports';
  } else if (['list', 'bank', 'execution-bank', 'realizacje'].includes(tab)) {
    functionId = 'list';
    subview = 'bank';
  } else {
    functionId = 'list';
    subview = 'bank';
    issue = 'UNKNOWN_TAB';
  }

  if (rawSubview) {
    const candidate = rawSubview.toLowerCase();
    const legal =
      (functionId === 'work' && ['work', 'resources'].includes(candidate)) ||
      (functionId === 'reports' && ['reports', 'summary', 'rollout'].includes(candidate)) ||
      (functionId === 'list' && candidate === 'bank') ||
      (functionId === 'control' && ['risk', 'control'].includes(candidate));
    if (legal) {
      subview = candidate === 'control' ? 'risk' : (candidate as ExecutionSubview);
      if (subview === 'summary' && !options.summaryOneLookEnabled) {
        issue = 'SUMMARY_DISABLED';
      }
    } else if (!issue) {
      issue = 'UNKNOWN_SUBVIEW';
      subview = defaultSubview(functionId);
    }
  }

  return {
    functionId,
    subview,
    surfaceTab:
      subview === 'summary' && !options.summaryOneLookEnabled ? 'reports' : surfaceFor(subview),
    issue,
  };
}

export function parseExecutionNavigationState(
  input: string | URLSearchParams,
  options: ExecutionTabOptions
): ExecutionNavigationState {
  const { path, params, hash } = splitLocation(input);
  const resolved = resolveFunctionAndSubview(
    value(params, 'tab'),
    value(params, 'subview'),
    options,
    path
  );
  const openId = value(params, 'open');
  const mode = value(params, 'mode')?.toLowerCase();
  const entityType = value(params, 'entityType')?.toLowerCase();
  const transientInitiative = openId && (mode === 'doc' || mode === 'initiative');
  const coldInitiativeId = value(params, 'initiativeId');
  const unsupportedEntity = Boolean(entityType && entityType !== 'initiative');
  const documentKind = value(params, 'documentKind')?.toLowerCase();
  const documentId = value(params, 'documentId');
  const unsupportedDocument = Boolean(
    documentId && !['work', 'report', 'intelligence'].includes(documentKind || '')
  );
  const unsupportedIdentity = unsupportedEntity || unsupportedDocument;
  const typedDocument: ExecutionDocumentIdentity | null =
    documentId && ['work', 'report', 'intelligence'].includes(documentKind || '')
      ? { kind: documentKind as 'work' | 'report' | 'intelligence', id: documentId }
      : null;
  const initiativeId = unsupportedIdentity
    ? null
    : transientInitiative
      ? openId
      : typedDocument
        ? null
        : coldInitiativeId;
  const identity: ExecutionDocumentIdentity | null = unsupportedIdentity
    ? null
    : transientInitiative && initiativeId
      ? { kind: 'initiative', id: initiativeId }
      : (typedDocument ?? (initiativeId ? { kind: 'initiative', id: initiativeId } : null));
  const navigation =
    transientInitiative && !unsupportedEntity
      ? { functionId: 'list' as const, subview: 'bank' as const, surfaceTab: 'list' as const }
      : resolved;
  const explicitPreset = value(params, 'preset');
  const kokpitPreset = value(params, 'kokpit');
  const requestedSummary =
    value(params, 'tab')?.toLowerCase() === 'summary' ||
    value(params, 'subview')?.toLowerCase() === 'summary';
  const preset =
    explicitPreset ??
    ((navigation.subview === 'summary' || requestedSummary) &&
    ['ryzyka', 'rozstrzygniecia'].includes(kokpitPreset || '')
      ? kokpitPreset
      : null);

  return {
    ...navigation,
    view: resolveView(value(params, 'view')),
    initiativeId,
    executionCaseId: value(params, 'executionCaseId'),
    preset,
    returnContext: value(params, 'returnContext'),
    documentIdentity: identity,
    issue: unsupportedIdentity ? 'UNSUPPORTED_ENTITY' : resolved.issue,
    params,
    hash,
  };
}

export function shouldPreserveExecutionNavigationInput(
  issue: ExecutionNavigationIssue | null
): boolean {
  return issue !== null && issue !== 'SUMMARY_DISABLED';
}

export function executionNavigationTarget(
  params: URLSearchParams,
  location: ExecutionNavigationLocation
): { pathname: string; search: string; hash: string } {
  const search = params.toString();
  return {
    pathname: location.pathname,
    search: search ? `?${search}` : '',
    hash: location.hash,
  };
}

export function executionNavigationCommit(
  params: URLSearchParams,
  location: ExecutionNavigationLocation,
  intent: ExecutionNavigationIntent
): {
  to: { pathname: string; search: string; hash: string };
  options: { replace: boolean };
} {
  return {
    to: executionNavigationTarget(params, location),
    options: { replace: intent === 'url-sync' },
  };
}

export function executionInitiativeIdFromDocument(documentId: string | null): string | null {
  const id = String(documentId || '').trim();
  return id && !id.includes(':') ? id : null;
}

export function executionFunctionIdForSurface(surface: string): ExecutionFunctionId {
  if (surface === 'resources') return 'work';
  if (surface === 'summary' || surface === 'rollout') return 'reports';
  if (surface === 'work' || surface === 'control' || surface === 'reports') return surface;
  return 'list';
}

export function executionSubviewForSurface(surface: string): ExecutionSubview {
  if (surface === 'resources' || surface === 'summary' || surface === 'rollout') return surface;
  if (surface === 'work') return 'work';
  if (surface === 'control') return 'risk';
  if (surface === 'reports') return 'reports';
  return 'bank';
}

export function serializeExecutionNavigationState(
  state: ExecutionNavigationState,
  current: URLSearchParams = state.params
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('tab', state.functionId);
  const canonicalSubview = defaultSubview(state.functionId);
  if (state.subview === canonicalSubview) next.delete('subview');
  else next.set('subview', state.subview);
  next.set('view', state.view);

  const initiativeId =
    state.documentIdentity?.kind === 'initiative'
      ? state.documentIdentity.id
      : state.documentIdentity
        ? null
        : state.initiativeId;
  if (initiativeId) next.set('initiativeId', initiativeId);
  else next.delete('initiativeId');
  if (state.documentIdentity && state.documentIdentity.kind !== 'initiative') {
    next.set('documentKind', state.documentIdentity.kind);
    next.set('documentId', state.documentIdentity.id);
  } else {
    next.delete('documentKind');
    next.delete('documentId');
  }
  if (state.executionCaseId) next.set('executionCaseId', state.executionCaseId);
  else next.delete('executionCaseId');
  if (state.preset) next.set('preset', state.preset);
  else next.delete('preset');
  if (state.subview === 'summary' && state.preset) next.set('kokpit', state.preset);
  else next.delete('kokpit');
  if (state.returnContext) next.set('returnContext', state.returnContext);
  else next.delete('returnContext');

  next.delete('open');
  next.delete('mode');
  next.delete('entityType');
  return next;
}
