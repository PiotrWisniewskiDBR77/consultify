import { addFeedbackBreadcrumb } from '@/services/feedbackCollector';

const RECOVERABLE_MARK_PREFIX = 'consultify:react-recoverable';
const MAX_RECOVERABLE_LABEL_LENGTH = 120;

function normalizeRecoverableMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return 'unknown';
}

export function handleReactRecoverableError(reason: unknown): void {
  const normalizedMessage = normalizeRecoverableMessage(reason);
  const label = `recoverable:${normalizedMessage}`.slice(0, MAX_RECOVERABLE_LABEL_LENGTH);

  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(`${RECOVERABLE_MARK_PREFIX}:${Date.now()}`);
    }
  } catch {
    // Keep recoverable-error telemetry fail-soft.
  }

  try {
    addFeedbackBreadcrumb({ kind: 'custom', label });
  } catch {
    // Keep recoverable-error telemetry fail-soft.
  }
}

