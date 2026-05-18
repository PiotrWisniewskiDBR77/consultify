/**
 * Chat V10 / V10-AGT-026 — feature flag for the TraceCollector
 * contract (OTel-compatible spans, trace-tree reconstruction,
 * budget-per-span invariants).
 *
 * Runtime contract lives in
 * `src/models/agent/TraceCollector.ts`. Default OFF — Wave A
 * seed pins the 4-kind span catalogue, the Span shape with
 * budgetUsage, the O(n) tree builder, and the four completeness
 * invariants; the Wave B trace exporter binds span emission to
 * this shape.
 */

const LS_KEY = 'ff.agent_trace_collector';
const QUERY_KEY = 'ff_agent_trace_collector';
const ENV_KEY = 'VITE_AGENT_TRACE_COLLECTOR';

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

export function isAgentTraceCollectorEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_TRACE_COLLECTOR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
