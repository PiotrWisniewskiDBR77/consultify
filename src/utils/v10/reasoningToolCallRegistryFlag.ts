/**
 * Chat V10 / V10-RSN-005 — feature flag for the reasoning tool-call registry.
 *
 * Runtime contract lives in
 * `src/models/reasoning/ToolCallRegistry.ts`. Default OFF —
 * Wave A seed pins the tool-call-kind catalogue, ToolCallDescriptor
 * shape, closed auth / side-effect classes, and the four runtime
 * invariants; Wave B wires ACL enforcement, span emission, and
 * the budget-aware invocation path.
 */

const LS_KEY = 'ff.reasoning_tool_call_registry';
const QUERY_KEY = 'ff_reasoning_tool_call_registry';
const ENV_KEY = 'VITE_REASONING_TOOL_CALL_REGISTRY';

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

export function isReasoningToolCallRegistryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_TOOL_CALL_REGISTRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
