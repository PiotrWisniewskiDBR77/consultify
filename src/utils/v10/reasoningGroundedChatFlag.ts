/**
 * Chat V10 / V10-RSN-016 — feature flag for grounded_chat workload contract.
 *
 * Runtime contract lives in
 * `src/models/reasoning/GroundedChat.ts`. Default OFF —
 * Wave A seed pins the GROUNDED_CHAT_BUDGET_TIERS catalogue,
 * GROUNDED_CHAT_BUDGETS, GROUNDED_CHAT_MIN_COVERAGE, GroundedChatRequest
 * shape, buildGroundedChatRequest, and runtime invariants; Wave B wires
 * the full retrieval + grounding pipeline and TrustBundle emission.
 */

const LS_KEY = 'ff.reasoning_grounded_chat';
const QUERY_KEY = 'ff_reasoning_grounded_chat';
const ENV_KEY = 'VITE_REASONING_GROUNDED_CHAT';

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

export function isReasoningGroundedChatEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_GROUNDED_CHAT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
