/**
 * Chat V10 / V10-OUT-006 — feature flag for TimeSavedCalibration
 * (calibrates time_saved_ms magnitudes across users, closed
 * CALIBRATION_METHODS catalogue, pure calibrateTimeSaved reducer,
 * model_estimate confidence constraint).
 *
 * Runtime contract lives in
 * `src/models/outcome/TimeSavedCalibration.ts`. Default OFF —
 * Wave A seed pins the calibration shapes and five runtime invariants;
 * Wave B aggregation scheduler and persistence bind to this contract.
 */

const LS_KEY = 'ff.outcome_time_saved_calibration';
const QUERY_KEY = 'ff_outcome_time_saved_calibration';
const ENV_KEY = 'VITE_OUTCOME_TIME_SAVED_CALIBRATION';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isOutcomeTimeSavedCalibrationEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const OUTCOME_TIME_SAVED_CALIBRATION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
