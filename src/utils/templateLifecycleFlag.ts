/**
 * Tabele Block A / EPIC-T6 — feature flag for the template-lifecycle UI
 * (status filter + dot badge + governance drawer in `ArtifactModuleHome`,
 * lane=tabele).
 *
 * Where this flag gates
 * ---------------------
 *   * `ArtifactModuleHome` (lane=tabele): when ON, the templates tab
 *     swaps `useModuleTemplates` (Outputs Library) for
 *     `useTpBaseTemplates` (`tp_base_templates` lifecycle endpoint),
 *     mounts `<TemplateLifecycleFilter>` above the grid and renders
 *     `<TemplateLifecycleBadge variant="dot">` on each card.
 *   * Default OFF until the lifecycle catalog is seeded across staging
 *     + prod (A-S2 seeder coverage). The kill-switch keeps existing
 *     users on the legacy Outputs Library behaviour.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_templateLifecycle=0|1` — operator bypass.
 *   2. `localStorage["ff.template_lifecycle"]` — user / org override.
 *   3. `import.meta.env.VITE_TEMPLATE_LIFECYCLE` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.template_lifecycle';
const QUERY_KEY = 'ff_templateLifecycle';
const ENV_KEY = 'VITE_TEMPLATE_LIFECYCLE';

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

export function isTemplateLifecycleEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TEMPLATE_LIFECYCLE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
