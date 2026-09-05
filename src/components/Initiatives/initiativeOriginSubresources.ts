import type { InitiativeDocumentOrigin } from './initiativeDocumentSource';

export interface OriginAwareSubresourceLoad<T = unknown> {
  load: () => Promise<T>;
  onLoaded: (value: T) => void;
  onSkipped: () => void;
  onUnavailable: () => void;
}

/**
 * Runtime-v1, interview and showcase records do not live in the planning store.
 * An unknown origin deliberately keeps the historical probing behaviour: older
 * payloads do not consistently carry documentOrigin yet.
 */
export function shouldReadPlanningSubresources(
  origin: InitiativeDocumentOrigin | null | undefined
): boolean {
  return origin == null || origin === 'v8-planning';
}

export function runOriginAwareInitiativeSubresource<T>(
  origin: InitiativeDocumentOrigin | null | undefined,
  operation: OriginAwareSubresourceLoad<T>
): Promise<void> {
  if (!shouldReadPlanningSubresources(origin)) {
    operation.onSkipped();
    return Promise.resolve();
  }

  return operation.load().then(operation.onLoaded).catch(operation.onUnavailable);
}
