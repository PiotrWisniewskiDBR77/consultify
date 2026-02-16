import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';

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
  portfolio: '/portfolio',
  execution: '/execution',
  roadmap: '/roadmap',
  reports: '/reports/builder',
  assessment: '/assessment',
  interview: '/interview',
  discovery: '/interview',
  'discovery-tools': '/discovery-tools',
  implementation: '/implementation',
  roi: '/roi',
  economics: '/economics',
  'kpi-okr': '/kpi-okr',
  benefits: '/benefits',
  studio: '/studio',
  admin: '/admin',
  settings: '/settings',
  'project-intelligence': '/project-intelligence',
  context: '/context',
  rollout: '/rollout',
  decisions: '/my-work', // Decisions are within My Work
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
      // Handle navigation actions immediately (no confirmation needed)
      if (action.type === ACTION_TYPES.NAVIGATE || action.type === ACTION_TYPES.OPEN_VIEW) {
        const view = String(action.payload?.view || action.payload?.target || '');
        const params = action.payload?.params as Record<string, string> | undefined;
        const route = resolveRoute(view, params);

        if (route) {
          navigate(route);
          toast.success(`Navigating to ${view}`, { duration: 1500, icon: '🧭' });
          return { status: 'success', result: { message: `Navigated to ${view}` } };
        } else {
          toast.error(`Unknown view: "${view}"`, { duration: 3000 });
          return { status: 'cancelled', result: { message: `Unknown view: ${view}` } };
        }
      }

      // Handle find initiative action
      if (action.type === ACTION_TYPES.FIND_INITIATIVE) {
        const initiativeId = String(action.payload?.initiativeId || '');
        const initiativeName = String(action.payload?.name || action.payload?.title || '');
        if (initiativeId) {
          navigate(`/initiatives?id=${initiativeId}`);
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
