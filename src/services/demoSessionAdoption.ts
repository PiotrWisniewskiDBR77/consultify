import { useAppStore } from '../store/useAppStore';

/**
 * The isolated demo tenant provisioned by `POST /auth/register-demo` (and by
 * `POST /demo/toggle` for an already-authenticated user). One shape, one name —
 * every public entry reads the same payload.
 */
export type DemoSessionPayload = {
  id: string;
  organizationId: string;
  locale: 'en' | 'pl';
  expiresAt: string;
  anchorDate: string;
};

/**
 * Pin the isolated demo tenant into the store, and do it BEFORE the caller
 * navigates into the app.
 *
 * WHY the ordering matters: `getHeaders()` in `src/services/api.ts` derives
 * `X-Demo-Mode` and `X-Demo-Session-Org` from `isDemoMode` / `demoSessionOrgId`
 * in this very store. Navigation is what triggers the first burst of app
 * requests, so anything sent before adoption carries no session-org header and
 * the backend resolves it against the shared curated org instead of the user's
 * own seeded copy. There is no later repair: the user has already seen — and
 * possibly written into — the wrong tenant.
 *
 * Kept synchronous and dependency-light on purpose, so a caller can always run
 * it on the line directly above `onSuccess(...)` / `onAuthSuccess(...)`.
 *
 * A missing or null session still flips demo mode on and clears any stale org
 * id, rather than leaving a previous session's tenant pinned.
 */
export function adoptDemoSession(session: DemoSessionPayload | null | undefined): void {
  const store = useAppStore.getState();
  store.setDemoMode(true);
  store.setDemoSessionOrgId(session?.organizationId ?? null);
}
