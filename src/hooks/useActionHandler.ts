import { useCallback, useState } from 'react';

export const ACTION_TYPES = {
  NAVIGATE: 'NAVIGATE',
  OPEN_VIEW: 'OPEN_VIEW',
  CREATE_TASK: 'CREATE_TASK',
  CREATE_DECISION: 'CREATE_DECISION',
  TRIGGER_WORKFLOW: 'TRIGGER_WORKFLOW',
} as const;

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

  const executeAction = useCallback(async (action: ActionPayload): Promise<ActionResult> => {
    if (action.requiresConfirmation) {
      const pending = { ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
      setPendingActions((prev) => [...prev, pending]);
      return { status: 'pending', actionId: pending.id };
    }

    setIsExecuting(true);
    try {
      return {
        status: 'success',
        result: { message: 'Action executed' },
      };
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const confirmAction = useCallback(async (actionId: string, confirmed: boolean): Promise<ActionResult> => {
    setPendingActions((prev) => prev.filter((action) => action.id !== actionId));
    return confirmed
      ? { status: 'success', actionId }
      : { status: 'cancelled', actionId };
  }, []);

  return {
    executeAction,
    confirmAction,
    pendingActions,
    isExecuting,
  };
};

export default useActionHandler;
