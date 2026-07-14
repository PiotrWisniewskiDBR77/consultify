/**
 * FAZA C modelu ról PM (spec `Harvard/wdrozenie-100/_SPEC_MODEL_ROL_PM_2026-07-14.md` §2.4/§3).
 *
 * Frontend capability awareness — the infrastructure that lets the UI hide or
 * disable action buttons per project role ONCE the backend rollout flips
 * `CAPABILITY_ENFORCE=enforce`. Until then the backend reports mode='shadow'
 * and this hook's `can()` returns TRUE for everything.
 *
 * ── FAIL-OPEN CONTRACT (critical, do not weaken) ─────────────────────────────
 * `can(capability)` returns TRUE whenever:
 *   • mode !== 'enforce' (shadow — today's default; zero UI change), OR
 *   • the request is still loading, OR
 *   • the request errored / returned no data, OR
 *   • the user is a SUPERADMIN or holds the '*' capability.
 * Only in mode==='enforce' with resolved data does `can()` actually filter.
 * This guarantees flipping nothing on the backend changes nothing in the UI.
 *
 * Data source: GET /api/capabilities/effective?projectId=... (read-only,
 * `server/src/routes/capabilityEffective.routes.ts`). Cached via React Query
 * (the repo's standard fetch-cache) — one fetch per (user, projectId).
 */
import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo } from 'react';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

export type CapabilityMode = 'shadow' | 'enforce';

export interface EffectiveCapabilities {
  capabilities: string[];
  projectRole: string | null;
  applicationRole: string | null;
  platformRole: string | null;
  projectId: string | null;
  mode: CapabilityMode;
}

export interface EffectiveAccessResult {
  /** Fail-open verdict — see contract above. */
  can: (capability: string) => boolean;
  /** Verdict ignoring mode/loading/error — for diagnostics (?debugCapabilities=1). */
  wouldAllow: (capability: string) => boolean;
  mode: CapabilityMode;
  isLoading: boolean;
  error: unknown;
  capabilities: string[];
  projectRole: string | null;
  applicationRole: string | null;
}

/** Mirrors backend `hasEffectiveCapability` (sans SUPERADMIN, handled by caller). */
export function capabilityMatches(capabilities: string[], capability: string): boolean {
  const set = new Set(capabilities);
  if (set.has('*') || set.has(capability)) return true;
  return ['.scoped', '.own', '.assigned', '.delegated'].some((suffix) =>
    set.has(`${capability}${suffix}`)
  );
}

/**
 * Test/dev-render override — lets the capability-gate-demo story and unit
 * tests inject a fixed access state without any network. Production code
 * never mounts this provider, so the default (null) keeps runtime behavior
 * driven purely by the API response.
 */
export const EffectiveAccessOverrideContext = createContext<Partial<
  Pick<EffectiveAccessResult, 'mode' | 'isLoading' | 'error' | 'capabilities'>
> | null>(null);

const QUERY_STALE_TIME_MS = 5 * 60 * 1000;

async function fetchEffectiveCapabilities(
  projectId?: string | null
): Promise<EffectiveCapabilities> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const response = await Api.get(`/capabilities/effective${query}`);
  // Api.get returns an axios-like envelope; unwrap either shape defensively.
  const payload = (
    response?.data && typeof response.data === 'object' && 'capabilities' in response.data
      ? response.data
      : response
  ) as Partial<EffectiveCapabilities> | null;
  return {
    capabilities: Array.isArray(payload?.capabilities) ? payload.capabilities.map(String) : [],
    projectRole: payload?.projectRole ?? null,
    applicationRole: payload?.applicationRole ?? null,
    platformRole: payload?.platformRole ?? null,
    projectId: payload?.projectId ?? null,
    mode: payload?.mode === 'enforce' ? 'enforce' : 'shadow',
  };
}

export function useEffectiveAccess(projectId?: string | null): EffectiveAccessResult {
  const { currentUser } = useAppStore();
  const override = useContext(EffectiveAccessOverrideContext);

  const query = useQuery({
    queryKey: ['effectiveCapabilities', currentUser?.id ?? null, projectId ?? null],
    queryFn: () => fetchEffectiveCapabilities(projectId),
    enabled: !override && Boolean(currentUser?.id),
    staleTime: QUERY_STALE_TIME_MS,
    retry: 1,
  });

  const data = query.data;
  const mode: CapabilityMode = override?.mode ?? data?.mode ?? 'shadow';
  const isLoading = override?.isLoading ?? query.isLoading;
  const error = override?.error ?? query.error ?? null;
  const capabilities = useMemo(
    () => override?.capabilities ?? data?.capabilities ?? [],
    [override?.capabilities, data?.capabilities]
  );
  const platformRole = override ? null : (data?.platformRole ?? null);
  const hasData = override ? !override.isLoading && !override.error : Boolean(data);

  const wouldAllow = useCallback(
    (capability: string): boolean => {
      if (platformRole === 'SUPERADMIN') return true;
      if (!hasData) return true; // no verdict available → optimistic
      return capabilityMatches(capabilities, capability);
    },
    [capabilities, hasData, platformRole]
  );

  const can = useCallback(
    (capability: string): boolean => {
      // FAIL-OPEN: shadow / loading / error / missing data → always allow.
      if (mode !== 'enforce') return true;
      if (isLoading || error != null || !hasData) return true;
      return wouldAllow(capability);
    },
    [mode, isLoading, error, hasData, wouldAllow]
  );

  return {
    can,
    wouldAllow,
    mode,
    isLoading,
    error,
    capabilities,
    projectRole: override ? null : (data?.projectRole ?? null),
    applicationRole: override ? null : (data?.applicationRole ?? null),
  };
}

export default useEffectiveAccess;
