/**
 * Chat V10 / V10-RSN-022 — feature flag for presentation layer.
 *
 * Runtime contract lives in
 * `src/models/reasoning/PresentationLayer.ts`. Default OFF —
 * Wave A seed pins the PRESENTATION_FORMATS catalogue,
 * Presentation shape, buildPresentation, and runtime invariants;
 * Wave B wires the full LLM-driven text rendering pipeline.
 */

const LS_KEY = 'ff.reasoning_presentation_layer';
const QUERY_KEY = 'ff_reasoning_presentation_layer';
const ENV_KEY = 'VITE_REASONING_PRESENTATION_LAYER';

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

export function isReasoningPresentationLayerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_PRESENTATION_LAYER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
