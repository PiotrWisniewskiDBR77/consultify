/**
 * Gate Policy Engine (canonical workflow enforcement)
 *
 * Goal: centralize "can we do this gate action?" logic so it is:
 * - consistent across modules
 * - testable
 * - compatible with role delegation (small projects)
 *
 * This is intentionally minimal in v1. We will expand per module (Tools/Assessment/Initiatives/etc.)
 * once parallel artifact work is merged.
 */
export type GateContextType =
  | 'interview_assignment'
  | 'tool_session'
  | 'assessment'
  | 'initiative'
  | 'task'
  | 'economic_analysis'
  | 'benefits';

export type GateAction =
  // Interview
  'SUBMIT_INTERVIEW' | 'SEND_BACK_INTERVIEW' | 'APPROVE_INTERVIEW';

export type GateDecision =
  | { allow: true }
  | { allow: false; error: string; code?: 'FORBIDDEN' | 'INVALID_STATE' | 'MISSING_DATA' };

export interface GatePolicyInput {
  action: GateAction;
  contextType: GateContextType;
  user: { id: string; organizationId: string; role?: string };
  context: Record<string, unknown>;
}

/**
 * Minimal policy engine.
 * - We keep authorization primarily permission-based at routing layer.
 * - Here we enforce lifecycle/state preconditions (submitted-only, etc.)
 */
export function evaluateGatePolicy(input: GatePolicyInput): GateDecision {
  const { action, contextType, context } = input;

  // Interview Assignment gates
  if (contextType === 'interview_assignment') {
    const status = String((context as any)?.assignment?.status || (context as any)?.status || '');
    const hasSession = Boolean(
      (context as any)?.assignment?.session_id || (context as any)?.session_id
    );

    if (action === 'SUBMIT_INTERVIEW') {
      if (!hasSession)
        return { allow: false, code: 'MISSING_DATA', error: 'Assignment has no session yet' };
      if (status !== 'in_progress' && status !== 'submitted' && status !== 'sent_back') {
        return {
          allow: false,
          code: 'INVALID_STATE',
          error: 'Only in_progress or already submitted assignments can be submitted',
        };
      }
      return { allow: true };
    }

    if (action === 'SEND_BACK_INTERVIEW') {
      if (!hasSession)
        return { allow: false, code: 'MISSING_DATA', error: 'Assignment has no session yet' };
      if (status !== 'submitted') {
        return {
          allow: false,
          code: 'INVALID_STATE',
          error: 'Only submitted assignments can be sent back',
        };
      }
      return { allow: true };
    }

    if (action === 'APPROVE_INTERVIEW') {
      if (!hasSession)
        return { allow: false, code: 'MISSING_DATA', error: 'Assignment has no session yet' };
      if (status !== 'submitted') {
        return {
          allow: false,
          code: 'INVALID_STATE',
          error: 'Only submitted assignments can be approved',
        };
      }
      return { allow: true };
    }
  }

  // Default: unknown action/context treated as forbidden for safety
  return {
    allow: false,
    code: 'FORBIDDEN',
    error: 'Gate policy not defined for this action/context',
  };
}
