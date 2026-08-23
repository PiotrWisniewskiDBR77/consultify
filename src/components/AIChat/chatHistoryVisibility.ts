import type { ChatProjectScope } from '../../store/useChatProjectStore';

export function requiresOrganizationVisibilityConsent(
  destinationScope: ChatProjectScope | undefined,
  sourceScope: ChatProjectScope | undefined
): boolean {
  return destinationScope === 'team' && sourceScope !== 'team';
}

