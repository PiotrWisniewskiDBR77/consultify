/**
 * Shared Method Kernel — demo bypass of the pack-readiness gate.
 *
 * `MethodSessionService.createSession` legitimately refuses to start a
 * production session against a pack whose `readiness` is not `released` or
 * `pilot` (`pack_not_released`, see MethodPackRegistry.canStartSession). The
 * DRD pack currently sits at `methodology_review` — see
 * `src/method-core/methods/drd/compileDrdPack.ts` — so with the gate honoured
 * literally, NOTHING can demo the vertical slice end-to-end yet.
 *
 * The browser-local mirror (`src/method-core/methods/drd/drdSessionRuntime.ts`)
 * already bypasses this on the client, unconditionally, with only a visible
 * notice as the safeguard. CLAUDE.md rule #7 requires more than a notice
 * once this goes over HTTP: the bypass must be structurally incapable of
 * reaching a production environment, not just discouraged by convention.
 *
 * ★ THIS FUNCTION IS THE ENTIRE ENFORCEMENT MECHANISM — the route handler
 * MUST call it and MUST NOT itself re-derive "is this prod" from anywhere
 * else. Kept pure (no process.env read baked in, no I/O) specifically so a
 * unit test can assert the production-rejects-bypass invariant WITHOUT
 * booting a process with NODE_ENV=production — which would also disable the
 * sanctioned localhost:55440 test-database escape hatch
 * (`databaseTargetResolver.ts`) and make the rest of this suite impossible
 * to run. See `http.integration.test.ts`'s "production config rejects demo
 * bypass" case for the direct call.
 *
 * Three independent gates, ALL required:
 *  1. NOT a production environment (`env.NODE_ENV !== 'production'`) — this
 *     alone is unconditional and cannot be overridden by any flag or request
 *     body. A caller cannot opt back into the bypass from a prod deploy by
 *     setting `demoBypass: true` on the request — see test below.
 *  2. The operator has explicitly turned the capability on for this
 *     deployment (`env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS === 'true'`).
 *     Absent (unset) by default — an unconfigured dev box does NOT silently
 *     bypass just because it isn't prod.
 *  3. The calling client explicitly asked for it on THIS request
 *     (`requestedByClient === true`) — a normal create-session call is never
 *     silently upgraded into a bypassed one.
 *
 * ★ WHAT BYPASS DOES NOT DO: it never writes `method_packs.readiness`. A
 * bypassed session can be created against a `methodology_review` pack, but
 * the pack itself never becomes, and can never be queried as, `released` or
 * `pilot` through this path — "bez możliwości uzyskania produkcyjnego
 * approval/released" is satisfied structurally (no code path here issues an
 * UPDATE method_packs ... SET readiness), not by a promise.
 */

export interface DemoBypassEnv {
  readonly [key: string]: string | undefined;
  readonly NODE_ENV?: string;
  readonly METHOD_CORE_DEMO_BYPASS_PACK_READINESS?: string;
}

export function isProductionEnvironment(env: DemoBypassEnv): boolean {
  return env.NODE_ENV === 'production';
}

export function isDemoBypassOperatorEnabled(env: DemoBypassEnv): boolean {
  return env.METHOD_CORE_DEMO_BYPASS_PACK_READINESS === 'true';
}

/**
 * The one function route handlers call. `requestedByClient` is whatever the
 * request body's `demoBypass` field carried, coerced to a strict boolean by
 * the caller (never trust a truthy string from JSON).
 */
export function isDemoBypassAllowed(env: DemoBypassEnv, requestedByClient: boolean): boolean {
  if (!requestedByClient) return false;
  if (isProductionEnvironment(env)) return false;
  return isDemoBypassOperatorEnabled(env);
}

export const DEMO_BYPASS_NOTICE =
  'Sesja utworzona z pominięciem bramki gotowości packa (demo bypass) — pack NIE jest released/pilot. ' +
  'To jest ŚCIEŻKA DEMONSTRACYJNA, wyłączona strukturalnie na produkcji i domyślnie wyłączona wszędzie ' +
  'indziej. Gotowość packa (method_packs.readiness) nie została i nie może zostać przez ten mechanizm zmieniona.';
