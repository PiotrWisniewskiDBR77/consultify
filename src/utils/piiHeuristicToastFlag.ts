/**
 * Chat V9 / TRUST T-PM2-lite — kill-switch for the post-send PII
 * heuristic toast.
 *
 * What this gates
 * ---------------
 * When on (default), a headless component mounted at the App root
 * listens for `CHAT_V9_PII_CHECK_EVENT` CustomEvents dispatched by
 * `EnhancedChatInput` right after a message is submitted. The
 * component runs `detectPiiCategories()` on the message and, if
 * any categories hit, emits a single `react-hot-toast` warning with
 * the detected category list and fires a PII-free telemetry event.
 *
 * When off, the listener is detached entirely; the dispatch from
 * the input is a no-op.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_piiHeuristicToast=0|1`.
 *   2. `localStorage["ff.pii_heuristic_toast"]`.
 *   3. `import.meta.env.VITE_PII_HEURISTIC_TOAST`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.pii_heuristic_toast';
const QUERY_KEY = 'ff_piiHeuristicToast';
const ENV_KEY = 'VITE_PII_HEURISTIC_TOAST';

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
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isPiiHeuristicToastEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const PII_HEURISTIC_TOAST_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;

/**
 * CustomEvent name the `EnhancedChatInput` dispatches right after a
 * successful `onSend`. The headless `PiiHeuristicToast` component
 * is the only listener. Exported so input and toast share a single
 * source of truth.
 *
 * Event detail shape: `{ text: string }`. No ids, no attachments,
 * no context — just the raw outgoing text so the heuristic can run
 * locally without a round-trip.
 */
export const CHAT_V9_PII_CHECK_EVENT = 'chat-v9-pii-check';
