# V8 KB public docs category taxonomy continuity proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `c51b93b1-4e17-43f2-aeb4-36d04e42cdef`

## Scope

Close `B-11g public docs category taxonomy continuity` by proving that the public `/docs` homepage no longer depends on the legacy/auth-broken KB category route.

## Shipped path

- Added anonymous-safe category listing to `publicKnowledgeBaseRoutes`
- Kept the anonymous bridge mounted at `/api/public/kb-v8/*`
- Updated `src/hooks/useDocs.ts` so public docs categories prefer `/api/public/kb-v8/categories`

## Local verification

- `npm test -- src/routes/v8/__tests__/knowledge-base.routes.test.ts` in `server/` passed
- `npx vitest run tests/hooks/useDocs.test.tsx --maxWorkers=1 --maxConcurrency=1` passed
- targeted lint checks on edited files passed

## Live staging proof

Fresh browser tab:

- `https://stage.consultinity.ai/docs?ts=1774465400`

Observed network requests from the live public docs homepage:

- `GET /api/public/kb-v8/categories?lang=en` -> `200`
- `GET /api/public/kb-v8/featured?lang=en&limit=6` -> `200`

Observed UI continuity:

- category grid rendered real public docs taxonomy cards
- featured article cards rendered underneath from the same anonymous bridge family

## Honest closure read

The public docs homepage is now using governed anonymous KB reads for both category taxonomy and featured cards.

Remaining KB public gap is narrower than before:

- if we want a browser-surface proof for the marketing landing `KnowledgePreviewSection`, we still need to surface or verify that dedicated public landing route separately
