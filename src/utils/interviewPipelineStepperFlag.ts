/**
 * Module 10 (Wywiad — Interview) — feature flag for the top-level numbered
 * pipeline stepper (① Szablony → ② Przydzielone → ③ Inbox → ④ Dopuszczenie →
 * ⑤ Wnioski → ⑥ Inicjatywy).
 *
 * Decision D-03 (Harvard/wdrozenie-100/M10-wywiad.md, D-03 → "zbudować wg
 * 2026-06-06"): surface the interview module as a numbered process pipeline with
 * per-stage state badges, replacing the implicit numeral-prefixed flat tab labels
 * with an explicit stepper rendered above the content.
 *
 * Gated because InterviewHub is LIVE on prod (VTS wave 2, ~131 users) and this is
 * a top-level navigation change. Default OFF: with the flag off, behaviour is
 * byte-identical to current prod (the existing numbered tab bar). Turn ON via
 * `?ff_interviewPipelineStepper=1` to validate in preview before rollout.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_interviewPipelineStepper=0|1` — operator bypass for QA/staging.
 *   2. `localStorage["ff.interview_pipeline_stepper"]` — user / org override.
 *   3. `import.meta.env.VITE_INTERVIEW_PIPELINE_STEPPER` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.interview_pipeline_stepper';
const QUERY_KEY = 'ff_interviewPipelineStepper';
const ENV_KEY = 'VITE_INTERVIEW_PIPELINE_STEPPER';

/** Stable flag keys (resolution order: query > localStorage > env > default OFF). */
export const INTERVIEW_PIPELINE_STEPPER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[ENV_KEY]
    );
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.location?.search) return null;
    const params = new URLSearchParams(window.location.search);
    return parseFlag(params.get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorageOverride(): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

/**
 * Whether the top-level interview pipeline stepper should render. Default OFF
 * (D-03). When OFF the existing numbered tab bar is the only navigation.
 */
export function isInterviewPipelineStepperEnabled(): boolean {
  const queryOverride = readQueryOverride();
  if (queryOverride !== null) return queryOverride;

  const lsOverride = readLocalStorageOverride();
  if (lsOverride !== null) return lsOverride;

  return readEnvFlag();
}
