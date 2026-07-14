/**
 * M14 — Execution cockpit feature flags (default OFF, live-safe).
 *
 * New cockpit surfaces (Intelligence panel, Gantt baseline, What-if sandbox) ship
 * behind flags so they land in code without changing the live cockpit until a
 * deliberate flip + pixel-verify. Resolution order (first wins): URL query →
 * localStorage → Vite build env → default false.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';

type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  intelligence: {
    query: 'ff_execIntel',
    localStorage: 'ff.exec_intelligence',
    env: 'VITE_EXEC_INTELLIGENCE_ENABLED',
  },
  ganttBaseline: {
    query: 'ff_ganttBaseline',
    localStorage: 'ff.exec_gantt_baseline',
    env: 'VITE_EXEC_GANTT_BASELINE_ENABLED',
  },
  whatIfSandbox: {
    query: 'ff_whatIf',
    localStorage: 'ff.exec_whatif',
    env: 'VITE_EXEC_WHATIF_ENABLED',
  },
  rolloutStages: {
    query: 'ff_rolloutStages',
    localStorage: 'ff.exec_rollout_stages',
    env: 'VITE_EXEC_ROLLOUT_STAGES_ENABLED',
  },
  benefits: {
    query: 'ff_benefits',
    localStorage: 'ff.exec_benefits',
    env: 'VITE_EXEC_BENEFITS_ENABLED',
  },
  // #77 / Z94 — Kokpit menedżera „pełna wizja McKinsey" (Summary one-look).
  // Nowa zakładka jednego spojrzenia (on-time / wartość vs plan / obłożenie /
  // TOP ryzyka / decyzje-do-podjęcia). Default OFF do akceptu Piotra (reguła #7).
  summaryOneLook: {
    query: 'ff_summaryOneLook',
    localStorage: 'ff.exec_summary_onelook',
    env: 'VITE_EXEC_SUMMARY_ONELOOK_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type ExecutionFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/** True when the given execution cockpit feature is enabled (default OFF). */
export function isExecutionFlagEnabled(flag: ExecutionFlag): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  if (readEnv(keys.env)) return true;
  // D-D (2026-06-29): verified-ready M14 cockpit (Intelligence/What-If/Rollout/
  // Benefits/ganttBaseline) defaults ON everywhere EXCEPT public production
  // (consultify.ai). Demo/stage/dev → ON; prod stays env-gated (D-G = no prod).
  // Reversible: drop this line to restore default-OFF.
  return !isPublicProductionHost(typeof window !== 'undefined' ? window.location.hostname : '');
}

export const EXECUTION_FLAG_KEYS = FLAGS;
