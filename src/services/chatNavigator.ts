/**
 * Chat Navigator (V3-B01)
 * Central navigator service for mechanical transfers from chat to tools/modules.
 * Resolves target routes from NAVIGATE actions and opens entities in dynamic tabs.
 */

import type { NavigateFunction } from 'react-router-dom';

import { useOpenDocumentsStore } from '@/store/openDocumentsStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TargetModule =
  | 'tools'
  | 'initiatives'
  | 'reports'
  | 'presentations'
  | 'excele'
  | 'results'
  | 'assessment'
  | 'interview'
  | 'mywork'
  | 'economics'
  | 'process_flow';

export type TargetSurface = 'list' | 'detail' | 'wizard' | 'builder' | 'dashboard';

export interface NavigateAction {
  type: 'NAVIGATE';
  targetModule: TargetModule;
  entityType?: string;
  entityId?: string;
  surface?: TargetSurface;
  params?: Record<string, string>;
  context?: Record<string, unknown>;
}

export interface NavigateResult {
  success: boolean;
  route?: string;
  error?: string;
  fallbackRoute?: string;
}

// ---------------------------------------------------------------------------
// Route mapping
// ---------------------------------------------------------------------------

const MODULE_ROUTES: Record<TargetModule, { list: string; detail?: (id: string) => string }> = {
  tools: {
    list: '/discovery-tools',
    detail: (id) => `/discovery-tools?docId=${encodeURIComponent(id)}`,
  },
  initiatives: {
    list: '/initiatives',
    detail: (id) => `/initiatives?open=${encodeURIComponent(id)}&mode=doc`,
  },
  reports: {
    // Unified hub (V3-J01): list view is the /reports workspace.
    // Direct editing still lives under /reports/builder/:id.
    list: '/reports',
    detail: (id) => `/reports/builder/${encodeURIComponent(id)}`,
  },
  presentations: {
    list: '/presentations',
    detail: (id) => `/presentations?deck=${encodeURIComponent(id)}`,
  },
  excele: {
    list: '/tabele',
    detail: (id) => `/tabele?artifactId=${encodeURIComponent(id)}`,
  },
  results: {
    list: '/results',
  },
  assessment: {
    list: '/assessment',
    detail: (id) => `/assessment/drd/${encodeURIComponent(id)}`,
  },
  interview: {
    list: '/interview',
    detail: (id) => `/interview/${encodeURIComponent(id)}/session`,
  },
  mywork: {
    list: '/my-work',
  },
  economics: {
    list: '/finance',
    detail: (id) => `/finance?open=${encodeURIComponent(id)}`,
  },
  process_flow: {
    list: '/my-work',
    detail: (id) => `/my-work?ideaId=${encodeURIComponent(id)}&tool=process_flow`,
  },
};

// Module keys for openDocumentsStore (V3-A02)
const MODULE_KEYS: Record<TargetModule, string> = {
  tools: 'tools',
  initiatives: 'initiatives',
  reports: 'reports',
  presentations: 'presentations',
  excele: 'excele',
  results: 'results',
  assessment: 'assessment',
  interview: 'interview',
  mywork: 'mywork',
  economics: 'economics',
  process_flow: 'process_flow',
};

// OpenDocument types from openDocumentsStore
type OpenDocType =
  | 'initiative'
  | 'tool_session'
  | 'report'
  | 'presentation'
  | 'kpi'
  | 'decision'
  | 'task';

const ENTITY_TO_DOC_TYPE: Record<string, OpenDocType> = {
  initiative: 'initiative',
  tool_session: 'tool_session',
  tool: 'tool_session',
  report: 'report',
  presentation: 'presentation',
  assessment: 'report', // assessment sessions map to report-like docs
  interview: 'report', // interview sessions
  valuation: 'report',
  financial_model: 'report',
  financial_statement: 'report',
  financial_analysis: 'report',
  budget: 'report',
  analysis: 'report',
  finance_lane_run: 'report',
};

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Resolves the target route from module + surface + entityId.
 * Returns the route path to navigate to.
 */
function resolveRoute(action: NavigateAction): { route: string; fallbackRoute: string } {
  const config = MODULE_ROUTES[action.targetModule];
  const fallbackRoute = config.list;

  if (!config) {
    return { route: '/chat', fallbackRoute: '/chat' };
  }

  const surface = action.surface?.toLowerCase();
  const entityId = action.entityId?.trim();
  const entityType = (action.entityType || '').toLowerCase();

  // Finance entity-type-specific deep links
  if (action.targetModule === 'economics' && entityId && entityType) {
    const financeRouteMap: Record<string, string> = {
      financial_statement: `/finance/statements/${encodeURIComponent(entityId)}`,
      financial_model: `/finance/models/${encodeURIComponent(entityId)}`,
      financial_analysis: `/finance/analyses/${encodeURIComponent(entityId)}`,
      valuation: `/finance?tab=valuation&open=${encodeURIComponent(entityId)}`,
      budget: `/finance?tab=prediction&open=${encodeURIComponent(entityId)}`,
    };
    const finRoute = financeRouteMap[entityType];
    if (finRoute) return { route: finRoute, fallbackRoute };
  }

  // Entity detail: use detail route if we have entityId and module supports it
  if (entityId && config.detail) {
    return { route: config.detail(entityId), fallbackRoute };
  }

  // Wizard/builder surface
  if (surface === 'wizard' || surface === 'builder') {
    if (action.targetModule === 'reports') {
      return { route: '/reports/builder', fallbackRoute };
    }
    if (action.targetModule === 'tools') {
      return { route: '/discovery-tools', fallbackRoute };
    }
  }

  return { route: fallbackRoute, fallbackRoute };
}

/**
 * Opens an entity in openDocumentsStore for modules that support dynamic tabs.
 * Call this before navigating so the target module can show the document.
 */
function openEntityInStore(action: NavigateAction): void {
  const entityId = action.entityId?.trim();
  if (!entityId) return;

  const moduleKey = MODULE_KEYS[action.targetModule];
  const docType = ENTITY_TO_DOC_TYPE[action.entityType || action.targetModule] || 'initiative';
  const title = (action.context?.title as string) || (action.context?.name as string) || entityId;

  // Only open for modules that support dynamic tabs
  const supportsTabs = ['tools', 'initiatives', 'reports', 'assessment'].includes(
    action.targetModule
  );

  if (!supportsTabs) return;

  const { openDocument } = useOpenDocumentsStore.getState();
  const doc: Parameters<typeof openDocument>[0] = {
    id: entityId,
    type: docType,
    title,
    moduleKey,
    routeKey: `${moduleKey}:${entityId}`,
    dirty: false,
    lastVisitedAt: new Date().toISOString(),
    metadata: action.context,
  };
  openDocument(doc);
}

/**
 * Executes a NAVIGATE action: resolves route, optionally opens entity in store, navigates.
 */
export function executeChatNavigate(
  action: NavigateAction,
  navigate: NavigateFunction
): NavigateResult {
  try {
    const { route, fallbackRoute } = resolveRoute(action);

    // Open entity in dynamic tabs if we have entityId and module supports it
    if (action.entityId) {
      openEntityInStore(action);
    }

    navigate(route);
    return { success: true, route };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const { fallbackRoute } = resolveRoute(action);
    navigate(fallbackRoute);
    return {
      success: false,
      error,
      fallbackRoute,
    };
  }
}
