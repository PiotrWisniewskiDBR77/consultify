/**
 * Chat Action Registry (V3-B02)
 * Holds all action definitions, validates payloads, checks capabilities.
 * Returns only allowed actions for current context.
 */

import type {
  ActionContext,
  ChatActionCapability,
  ChatActionDefinition,
  ChatActionPayload,
  ChatActionType,
} from '@/types/domain/chatActions';
import { ACTION_SCHEMA_VERSION, CHAT_ACTION_DEFINITIONS } from '@/types/domain/chatActions';

// Re-export for modules importing definitions from registry service.
export type { ChatActionDefinition } from '@/types/domain/chatActions';

// ---------------------------------------------------------------------------
// Action lookup
// ---------------------------------------------------------------------------

const DEFINITIONS_BY_TYPE = new Map<ChatActionType, ChatActionDefinition>(
  CHAT_ACTION_DEFINITIONS.map((d) => [d.type, d])
);

export function getActionDefinition(type: ChatActionType): ChatActionDefinition | undefined {
  return DEFINITIONS_BY_TYPE.get(type);
}

export function getAllActionDefinitions(): ChatActionDefinition[] {
  return [...CHAT_ACTION_DEFINITIONS];
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

export function validateActionPayload(action: ChatActionPayload): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const def = getActionDefinition(action.type);

  if (!def) {
    errors.push(`Unknown action type: ${action.type}`);
    return { valid: false, errors };
  }

  const params = action.params ?? {};

  for (const [key, field] of Object.entries(def.payloadSchema)) {
    const value = params[key];
    const missing = value === undefined || value === null || value === '';

    if (field.required && missing) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (!missing && field.type !== 'object') {
      const actualType = typeof value;
      if (field.type === 'number' && actualType !== 'number' && isNaN(Number(value))) {
        errors.push(`Field ${key} must be a number`);
      } else if (field.type === 'boolean' && actualType !== 'boolean') {
        errors.push(`Field ${key} must be a boolean`);
      } else if (field.type === 'string' && actualType !== 'string') {
        errors.push(`Field ${key} must be a string`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Capability checking
// ---------------------------------------------------------------------------

/**
 * Checks if the user has the required capabilities for an action in the given context.
 * Returns capability result with allowed flag and optional reason when disabled.
 */
export function checkCapability(
  action: ChatActionType,
  userRole: string,
  context: ActionContext
): ChatActionCapability {
  const def = getActionDefinition(action);
  if (!def) {
    return { action, allowed: false, reason: 'Unknown action type' };
  }

  const capabilities = context.capabilities ?? [];
  const hasAll = def.requiredCapabilities.every(
    (cap) => capabilities.includes(cap) || userRole === 'SUPERADMIN' || userRole === 'ADMIN'
  );

  if (!hasAll) {
    const missing = def.requiredCapabilities.filter((c) => !capabilities.includes(c));
    return {
      action,
      allowed: false,
      reason: `Missing capabilities: ${missing.join(', ')}`,
    };
  }

  // Context-specific checks
  if (action === 'ASSIGN_INTERVIEW' && !context.projectId) {
    return { action, allowed: false, reason: 'Project context required' };
  }
  if (action === 'RECORD_KPI' && !context.projectId) {
    return { action, allowed: false, reason: 'Project context required' };
  }
  return { action, allowed: true };
}

/**
 * Returns only action definitions that are allowed for the current user/context.
 */
export function getAvailableActions(
  userRole: string,
  context: ActionContext
): ChatActionDefinition[] {
  return CHAT_ACTION_DEFINITIONS.filter((def) => {
    const cap = checkCapability(def.type, userRole, context);
    return cap.allowed;
  });
}

/**
 * Check if a specific action type is allowed.
 */
export function isActionAllowed(
  action: ChatActionType,
  userRole: string,
  context: ActionContext
): boolean {
  return checkCapability(action, userRole, context).allowed;
}
