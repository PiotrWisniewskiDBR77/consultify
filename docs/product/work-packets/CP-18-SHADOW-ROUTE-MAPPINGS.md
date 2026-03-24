# CP-18: Shadow Mode Route Mappings

## Current mappings: NONE (Phase 0)

Shadow mode infrastructure is deployed but no routes are actively being shadowed yet.
This is intentional — route mappings will be added incrementally as V8 endpoints are verified.

## Planned Phase 1 mappings (after staging verification)

| Legacy endpoint | V8 endpoint | Method | Notes |
|----------------|-------------|--------|-------|
| (to be defined) | (to be defined) | — | Mappings added after V8 health verified on staging |

## How to add a shadow mapping

1. Add entry to `SHADOW_ROUTE_MAPPINGS` in `v8ShadowInterceptor.middleware.ts`
2. Test the mapping locally
3. Deploy and monitor via `/api/v8/admin/shadow/stats`
4. If match rate >= 95% after 100+ comparisons, the route is ready for promotion

## Safety rules

- Shadow mode NEVER affects the user's response
- Legacy response is ALWAYS returned
- V8 call is fire-and-forget (async, non-blocking)
- If V8 call fails, it's logged but doesn't affect anything
- Shadow comparisons are stored for operator review
