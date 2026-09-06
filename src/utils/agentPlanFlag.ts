/**
 * HP-4 fundament — feature flag for "Uruchom agenta z Teresy" (tryb Plan).
 *
 * Where this flag gates
 * ----------------------
 *   - `AgentPlanPanel` (src/components/AIChat/AgentPlanPanel.tsx) — the right-hand
 *     plan panel (steps, per-step status, approve/cancel). Wołający renderuje
 *     panel TYLKO gdy `isAgentPlanEnabled()` zwraca true.
 *   - Backend router `server/src/routes/ai/agent-plan.routes.ts` istnieje
 *     niezależnie od tej flagi (flaga jest wyłącznie front-end/UI-facing —
 *     patrz reguła #7 CLAUDE.md, ekran za flagą OFF do akceptu Piotra na
 *     zrzutach), ale dopóki żaden wywołujący nie woła klienta
 *     (`src/services/api/agentPlan.api.ts`), backend jest martwym kodem z
 *     perspektywy usera niezależnie od stanu flagi.
 *   - Przy OFF (default): zero zmian w istniejącym UI — panel nigdy się nie
 *     montuje, czat Teresy zachowuje się 1:1 jak dziś.
 *
 * Resolution order (highest wins) — wzorzec `backToChatButtonFlag.ts`:
 *   1. URL query `?ff_agentPlan=0|1` — operator bypass.
 *   2. `localStorage["ff.agent_plan"]` — user / org override.
 *   3. `import.meta.env.VITE_AGENT_PLAN` — build-time default.
 *   4. Default: ON (flip bez SHA, akcept Piotra; HP-4 domknięty i zweryfikowany
 *      wizualnie w dev-render).
 */

const LS_KEY = 'ff.agent_plan';
const QUERY_KEY = 'ff_agentPlan';
const ENV_KEY = 'VITE_AGENT_PLAN';

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
    // HP-4 domknięty (wejście /agent-plan + sidebar + silnik PlanBuilder),
    // zweryfikowany wizualnie w dev-render (light+dark, pełny flow) → default ON.
    return parsed === null ? true : parsed;
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

export function isAgentPlanEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const AGENT_PLAN_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
