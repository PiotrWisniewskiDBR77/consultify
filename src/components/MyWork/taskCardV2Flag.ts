const TRUE_VALUES = new Set(['1', 'true', 'on']);

export function isTaskCardV2Enabled(): boolean {
  const buildValue = String(import.meta.env.ENABLE_TASK_CARD_V2 ?? '').toLowerCase();
  if (TRUE_VALUES.has(buildValue)) return true;

  if (typeof window === 'undefined') return false;

  const queryValue = new URLSearchParams(window.location.search).get('ENABLE_TASK_CARD_V2');
  return TRUE_VALUES.has(String(queryValue ?? '').toLowerCase());
}

export const ENABLE_TASK_CARD_V2_DEFAULT = false;
