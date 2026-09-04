const ENV_KEY = 'VITE_VF1_DYNAMIC_SWOT_SEVEN_STAGES';

function parse(raw: unknown): boolean {
  return ['1', 'true', 'on'].includes(String(raw ?? '').trim().toLowerCase());
}

/** Fala 2: brak zmiennej i każda nierozpoznana wartość oznaczają OFF. */
export function isDynamicSwotSevenStagesEnabled(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parse(meta.env?.[ENV_KEY]);
  } catch {
    return false;
  }
}

export const DYNAMIC_SWOT_SEVEN_STAGES_ENV_KEY = ENV_KEY;
