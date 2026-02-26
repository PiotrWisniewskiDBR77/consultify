/**
 * useChatActionCapabilities (V3-B02)
 * Hook that provides available actions for current context.
 */

import { useMemo } from 'react';

import { checkCapability, getAvailableActions } from '@/services/chatActionRegistry';
import type { ChatActionDefinition } from '@/types/domain/chatActions';
import type { ActionContext, ChatActionType } from '@/types/domain/chatActions';

export interface UseChatActionCapabilitiesResult {
  availableActions: ChatActionDefinition[];
  isActionAllowed: (type: ChatActionType) => boolean;
  getDisabledReason: (type: ChatActionType) => string | undefined;
}

export function useChatActionCapabilities(
  context: ActionContext,
  userRole: string = 'USER'
): UseChatActionCapabilitiesResult {
  return useMemo(() => {
    const availableActions = getAvailableActions(userRole, context);

    const isActionAllowed = (type: ChatActionType): boolean => {
      return checkCapability(type, userRole, context).allowed;
    };

    const getDisabledReason = (type: ChatActionType): string | undefined => {
      const cap = checkCapability(type, userRole, context);
      return cap.allowed ? undefined : cap.reason;
    };

    return {
      availableActions,
      isActionAllowed,
      getDisabledReason,
    };
  }, [context, userRole]);
}

export default useChatActionCapabilities;
