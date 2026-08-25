import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

export const ACTION_TYPES = {
  NAVIGATE: 'NAVIGATE',
  OPEN_VIEW: 'OPEN_VIEW',
  CREATE_TASK: 'CREATE_TASK',
  CREATE_DECISION: 'CREATE_DECISION',
  TRIGGER_WORKFLOW: 'TRIGGER_WORKFLOW',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  FIND_INITIATIVE: 'FIND_INITIATIVE',
} as const;

/**
 * Module/view name → route path mapping.
 * Used by the AI chat to navigate the user to a specific module/screen.
 */
const VIEW_ROUTE_MAP: Record<string, string> = {
  chat: '/chat',
  'ai-chat': '/chat',
  'my-work': '/my-work',
  mywork: '/my-work',
  initiatives: '/initiatives',
  portfolio: '/initiatives',
  execution: '/execution',
  roadmap: '/initiatives',
  reports: '/presentations?tab=documents',
  assessment: '/assessment',
  interview: '/interview',
  discovery: '/interview',
  'discovery-tools': '/discovery-tools',
  implementation: '/execution',
  roi: '/roi',
  economics: '/finance',
  'kpi-okr': '/results',
  benefits: '/results',
  studio: '/studio',
  admin: '/admin',
  settings: '/settings',
  'project-intelligence': '/project-intelligence',
  context: '/context',
  rollout: '/rollout',
  decisions: '/my-work', // Decisions are within My Work
};

const MODULE_ROUTE_MAP: Record<string, string> = {
  chat: '/chat',
  'ai-chat': '/chat',
  tools: '/discovery-tools',
  'discovery-tools': '/discovery-tools',
  discovery: '/discovery-tools',
  assessment: '/assessment',
  initiatives: '/initiatives',
  initiative: '/initiatives',
  reports: '/presentations?tab=documents',
  'report-builder': '/reports/builder',
  report_builder: '/reports/builder',
  presentations: '/presentations',
  presentation: '/presentations',
  results: '/results',
  benefits: '/results',
  economics: '/finance',
  finance: '/finance',
  mywork: '/my-work',
  'my-work': '/my-work',
  notebook: '/my-work?tab=notebook',
  // DEC-2026-08-24-07: canonical Meeting list route (every other entry in
  // this map is already the canonical, non-legacy path).
  calendar: '/meetings',
  radar: '/my-work',
};

const normalizeValue = (value: unknown): string => String(value || '').trim();

const toQueryRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      const list = v.map((x) => String(x)).filter(Boolean);
      if (list.length > 0) out[k] = list.join(',');
      continue;
    }
    if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
      continue;
    }
    out[k] = String(v);
  }
  return out;
};

const withQuery = (baseRoute: string, params: Record<string, string>): string => {
  if (!params || Object.keys(params).length === 0) return baseRoute;
  const search = new URLSearchParams(params).toString();
  return search ? `${baseRoute}?${search}` : baseRoute;
};

type NavigateContract = {
  targetModule?: string;
  module?: string;
  view?: string;
  target?: string;
  entityType?: string;
  entityId?: string;
  id?: string;
  surface?: string;
  params?: Record<string, unknown>;
  sourceType?: string;
  sourceId?: string;
  sourceName?: string;
  templateId?: string;
};

const buildNavigateRoute = (payload: NavigateContract): string | null => {
  const targetModuleRaw =
    normalizeValue(payload.targetModule) ||
    normalizeValue(payload.module) ||
    normalizeValue(payload.view) ||
    normalizeValue(payload.target);
  if (!targetModuleRaw) return null;

  const moduleKey = targetModuleRaw.toLowerCase().replace(/\s+/g, '-');
  const surface = normalizeValue(payload.surface).toLowerCase();
  const entityType = normalizeValue(payload.entityType).toLowerCase();
  const params = toQueryRecord(payload.params);
  const entityId =
    normalizeValue(payload.entityId) || normalizeValue(payload.id) || params.entityId;
  const baseRoute = MODULE_ROUTE_MAP[moduleKey] || VIEW_ROUTE_MAP[moduleKey];

  if (!baseRoute) return null;

  if (moduleKey === 'initiatives' || moduleKey === 'initiative') {
    if (entityId) {
      return withQuery('/initiatives', { open: entityId, mode: 'doc' });
    }
    if (surface === 'wizard' || surface === 'new' || surface === 'create' || params.new === '1') {
      return withQuery('/initiatives', { new: '1' });
    }
    return withQuery('/initiatives', params);
  }

  if (moduleKey === 'tools' || moduleKey === 'discovery-tools' || moduleKey === 'discovery') {
    if (entityId) {
      return withQuery('/discovery-tools', { docId: entityId });
    }
    return withQuery('/discovery-tools', params);
  }

  if (moduleKey === 'presentations' || moduleKey === 'presentation') {
    // Scalenie wejść prezentacji 2026-07-27: `/presentations/wizard` jest
    // teraz redirect-only. "Nowa/z szablonu" prezentacja idzie przez
    // kanoniczne wejście Teresy (/prezentacje), z tym samym parametrem
    // (`templateArtifactId`), jakiego oczekuje PrezentacjeView + POST
    // /presentations/decks/from-template (R1.1, 26.07). Ten hook nie ma dziś
    // żadnego wywołującego w src/ (grep potwierdzony 2026-07-27) — poprawka
    // na przyszłość, bez zmiany zachowania w praktyce.
    const templateArtifactId = normalizeValue(payload.templateId) || params.templateId || '';
    const wantsWizard =
      surface === 'wizard' || surface === 'new' || surface === 'create' || params.new === '1';

    if (wantsWizard) {
      const wizardParams: Record<string, string> = {};
      if (templateArtifactId) wizardParams.templateArtifactId = templateArtifactId;
      return withQuery('/prezentacje', wizardParams);
    }

    if (entityId) {
      return `/presentations/builder/${encodeURIComponent(entityId)}`;
    }

    return withQuery('/presentations', params);
  }

  if (moduleKey === 'reports' || moduleKey === 'report-builder' || moduleKey === 'report_builder') {
    const sourceType = normalizeValue(payload.sourceType) || params.sourceType || '';
    const sourceId = normalizeValue(payload.sourceId) || params.sourceId || '';
    const sourceName = normalizeValue(payload.sourceName) || params.sourceName || '';
    const templateId = normalizeValue(payload.templateId) || params.templateId || '';
    const wantsWizard =
      surface === 'wizard' ||
      surface === 'new' ||
      surface === 'create' ||
      params.new === '1' ||
      Boolean(sourceType && sourceId);
    if (wantsWizard) {
      const wizardParams: Record<string, string> = {
        new: '1',
      };
      if (sourceType) wizardParams.sourceType = sourceType;
      if (sourceId) wizardParams.sourceId = sourceId;
      if (sourceName) wizardParams.sourceName = sourceName;
      if (templateId) wizardParams.templateId = templateId;
      return withQuery('/reports/builder', wizardParams);
    }

    if (entityId) {
      // Report Builder route supports direct report id.
      if (entityType.includes('builder') || entityType.includes('report')) {
        return `/reports/builder/${encodeURIComponent(entityId)}`;
      }
      return withQuery('/reports/builder', { docId: entityId });
    }
    // Default "Reports" surface is the unified hub under Presentations.
    return withQuery('/presentations', { tab: 'reports', ...params });
  }

  return withQuery(baseRoute, params);
};

export type ActionPayload = {
  type: string;
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
};

type PendingAction = ActionPayload & {
  id: string;
};

type ActionResult = {
  status: 'success' | 'pending' | 'cancelled';
  actionId?: string;
  result?: { message?: string };
};

export const useActionHandler = () => {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const navigate = useNavigate();

  /**
   * Resolve a view name (from AI) to an actual route path.
   * Supports both exact route paths (e.g. "/initiatives") and
   * friendly names (e.g. "initiatives", "my-work", "execution").
   */
  const resolveRoute = useCallback(
    (view: string, params?: Record<string, string>): string | null => {
      if (!view) return null;

      const normalized = view.toLowerCase().trim().replace(/\s+/g, '-');

      // If it already looks like a route path, use it directly
      if (normalized.startsWith('/')) {
        return normalized;
      }

      const route = VIEW_ROUTE_MAP[normalized];
      if (!route) return null;

      // Append query params if provided (e.g. ?id=xxx&tab=yyy)
      if (params && Object.keys(params).length > 0) {
        const search = new URLSearchParams(params).toString();
        return `${route}?${search}`;
      }

      return route;
    },
    []
  );

  const executeAction = useCallback(
    async (action: ActionPayload): Promise<ActionResult> => {
      const normalizedType = String(action.type || '')
        .trim()
        .toUpperCase();
      const payload = (action.payload || {}) as NavigateContract & {
        apiCall?: string;
        data?: Record<string, unknown>;
        copyText?: string;
      };

      if (payload.apiCall || normalizedType === 'EXECUTE') {
        setIsExecuting(true);
        try {
          const result = await Api.genericPost(payload.apiCall || '', payload.data || {});
          return {
            status: result?.success === false ? 'cancelled' : 'success',
            result: {
              message:
                result?.message ||
                result?.data?.message ||
                (result?.success === false ? 'API action failed' : 'Action executed'),
            },
          };
        } catch (error) {
          toast.error('Failed to execute action');
          return {
            status: 'cancelled',
            result: {
              message: error instanceof Error ? error.message : 'Failed to execute action',
            },
          };
        } finally {
          setIsExecuting(false);
        }
      }

      if (normalizedType === 'COPY') {
        const textToCopy = String(payload.copyText || '');
        if (textToCopy) {
          await navigator.clipboard.writeText(textToCopy);
          toast.success('Copied');
          return { status: 'success', result: { message: 'Copied to clipboard' } };
        }
      }

      // Handle navigation actions immediately (no confirmation needed)
      if (
        normalizedType === ACTION_TYPES.NAVIGATE ||
        normalizedType === ACTION_TYPES.OPEN_VIEW ||
        String(action.type || '')
          .trim()
          .toLowerCase() === 'navigate'
      ) {
        const view = String(
          payload.view || payload.target || payload.targetModule || payload.module || ''
        );
        const route =
          buildNavigateRoute(payload) ||
          resolveRoute(view, toQueryRecord((payload as NavigateContract).params));
        const targetModule = String(payload.targetModule || payload.module || payload.view || '');
        const entityType = String(payload.entityType || '');
        const entityId = String(payload.entityId || payload.id || '');

        trackFunnelEvent('chat_action_clicked', {
          actionType: action.type,
          targetModule: targetModule || view || 'unknown',
          entityType: entityType || null,
          hasEntityId: Boolean(entityId),
          surface: payload.surface || null,
        });

        if (route) {
          navigate(route);
          toast.success(`Navigating to ${targetModule || view || 'module'}`, {
            duration: 1500,
            icon: '🧭',
          });
          return {
            status: 'success',
            result: { message: `Navigated to ${targetModule || view || route}` },
          };
        } else {
          const fallbackRoute = MODULE_ROUTE_MAP[String(targetModule).toLowerCase()] || '/chat';
          navigate(fallbackRoute);
          toast.error(`Unknown target. Opened fallback: "${fallbackRoute}"`, { duration: 3000 });
          trackFunnelEvent('chat_action_failed', {
            actionType: action.type,
            targetModule: targetModule || view || 'unknown',
            reason: 'unknown_route',
            fallbackRoute,
          });
          return {
            status: 'cancelled',
            result: { message: `Unknown target route for ${targetModule || view}` },
          };
        }
      }

      // Handle find initiative action
      if (action.type === ACTION_TYPES.FIND_INITIATIVE) {
        const initiativeId = String(action.payload?.initiativeId || '');
        const initiativeName = String(action.payload?.name || action.payload?.title || '');
        if (initiativeId) {
          navigate(`/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`);
          toast.success(`Opening initiative: ${initiativeName || initiativeId}`, {
            duration: 2000,
            icon: '🎯',
          });
          return {
            status: 'success',
            result: { message: `Navigated to initiative ${initiativeId}` },
          };
        }
        // If no ID, navigate to initiatives list with search
        if (initiativeName) {
          navigate(`/initiatives?search=${encodeURIComponent(initiativeName)}`);
          toast.success(`Searching for: ${initiativeName}`, { duration: 2000, icon: '🔍' });
          return {
            status: 'success',
            result: { message: `Searching for initiative: ${initiativeName}` },
          };
        }
        navigate('/initiatives');
        return { status: 'success', result: { message: 'Navigated to initiatives' } };
      }

      // C10.3: Handle SEND_NOTIFICATION action
      if (action.type === ACTION_TYPES.SEND_NOTIFICATION) {
        const title = String(action.payload?.title || action.payload?.message || '');
        const message = String(action.payload?.body || action.payload?.content || title);
        const severity = String(action.payload?.severity || 'info');
        if (title) {
          try {
            await Api.post('/notifications', {
              title,
              message,
              type: 'ADMIN_BROADCAST',
              scope: 'PROJECT',
              severity,
            });
            toast.success(`Notification sent: ${title}`, { duration: 2000, icon: '🔔' });
            return { status: 'success', result: { message: `Notification created: ${title}` } };
          } catch (err) {
            toast.error('Failed to send notification');
            return { status: 'cancelled', result: { message: 'Failed to send notification' } };
          }
        }
        toast.error('Notification title is required');
        return { status: 'cancelled', result: { message: 'Missing notification title' } };
      }

      // Handle CREATE_TASK action
      if (action.type === ACTION_TYPES.CREATE_TASK) {
        const title = String(action.payload?.title || action.payload?.name || '');
        if (!title) {
          toast.error('Task title is required');
          return { status: 'cancelled', result: { message: 'Missing task title' } };
        }
        setIsExecuting(true);
        try {
          await Api.post('/tasks', {
            title,
            description: String(action.payload?.description || ''),
            priority: String(action.payload?.priority || 'medium'),
            status: 'todo',
            dueDate: action.payload?.dueDate || null,
            initiativeId: action.payload?.initiativeId || null,
          });
          toast.success(`Task created: ${title}`, { duration: 2000, icon: '✅' });
          return { status: 'success', result: { message: `Task created: ${title}` } };
        } catch (err) {
          toast.error('Failed to create task');
          return { status: 'cancelled', result: { message: 'Failed to create task' } };
        } finally {
          setIsExecuting(false);
        }
      }

      // Handle CREATE_DECISION action
      if (action.type === ACTION_TYPES.CREATE_DECISION) {
        const title = String(action.payload?.title || action.payload?.name || '');
        if (!title) {
          toast.error('Decision title is required');
          return { status: 'cancelled', result: { message: 'Missing decision title' } };
        }
        setIsExecuting(true);
        try {
          await Api.post('/decisions', {
            title,
            description: String(action.payload?.description || ''),
            priority: String(action.payload?.priority || 'medium'),
            status: 'pending',
            dueDate: action.payload?.dueDate || null,
            initiativeId: action.payload?.initiativeId || null,
          });
          toast.success(`Decision created: ${title}`, { duration: 2000, icon: '⚖️' });
          return { status: 'success', result: { message: `Decision created: ${title}` } };
        } catch (err) {
          toast.error('Failed to create decision');
          return { status: 'cancelled', result: { message: 'Failed to create decision' } };
        } finally {
          setIsExecuting(false);
        }
      }

      // Handle TRIGGER_WORKFLOW action
      if (action.type === ACTION_TYPES.TRIGGER_WORKFLOW) {
        const workflowName = String(action.payload?.workflow || action.payload?.name || '');
        if (!workflowName) {
          toast.error('Workflow name is required');
          return { status: 'cancelled', result: { message: 'Missing workflow name' } };
        }
        setIsExecuting(true);
        try {
          await Api.post('/workflows/trigger', {
            workflow: workflowName,
            params: action.payload?.params || {},
            initiativeId: action.payload?.initiativeId || null,
          });
          toast.success(`Workflow triggered: ${workflowName}`, { duration: 2000, icon: '⚡' });
          return { status: 'success', result: { message: `Workflow triggered: ${workflowName}` } };
        } catch (err) {
          toast.error('Failed to trigger workflow');
          return { status: 'cancelled', result: { message: 'Failed to trigger workflow' } };
        } finally {
          setIsExecuting(false);
        }
      }

      // For actions requiring confirmation, queue them
      if (action.requiresConfirmation) {
        const pending = {
          ...action,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        setPendingActions((prev) => [...prev, pending]);
        return { status: 'pending', actionId: pending.id };
      }

      // Unknown action type
      toast.error(`Unknown action type: ${action.type}`);
      return { status: 'cancelled', result: { message: `Unknown action type: ${action.type}` } };
    },
    [navigate, resolveRoute]
  );

  const confirmAction = useCallback(
    async (actionId: string, confirmed: boolean): Promise<ActionResult> => {
      setPendingActions((prev) => prev.filter((action) => action.id !== actionId));
      return confirmed ? { status: 'success', actionId } : { status: 'cancelled', actionId };
    },
    []
  );

  return {
    executeAction,
    confirmAction,
    pendingActions,
    isExecuting,
    resolveRoute,
    VIEW_ROUTE_MAP,
  };
};

export default useActionHandler;
