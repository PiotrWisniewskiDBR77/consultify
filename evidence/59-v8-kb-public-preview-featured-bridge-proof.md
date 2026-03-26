# V8 KB public preview / featured bridge proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `cc7710f9-21ae-4ed6-bf81-7fc23e454b8e`

## Scope

Close `B-11f kb public-preview/featured cleanup` by proving that public KB preview/featured reads no longer require auth-only `/api/v8/*` access.

## Shipped path

- Added anonymous-safe KB bridge reads under `publicKnowledgeBaseRoutes`
- Mounted `/api/public/kb-v8/*` directly in `server/src/index.ts` ahead of the gateway handoff to avoid staged runtime drift on the public path
- Kept public/docs and landing hooks preferring the public bridge first, then auth-gated V8, then legacy fallback

## Local verification

- `npm test -- src/routes/v8/__tests__/knowledge-base.routes.test.ts` in `server/` passed
- `npx vitest run tests/unit/services/v8-kb-api.test.ts tests/hooks/useKnowledge.test.tsx tests/hooks/useDocs.test.tsx --maxWorkers=1 --maxConcurrency=2` passed
- targeted lint checks on edited files passed

## Live staging proof

### Anonymous runtime truth

Direct anonymous probes returned `200` with the governed V8 envelope:

- `GET /api/public/kb-v8/public?lang=en&limit=3` -> `200`
- `GET /api/public/kb-v8/featured?lang=en&limit=6` -> `200`

Observed payload shape:

- `data.articles`
- `meta.version = "v8"`
- `meta.contract = "knowledge_base_read_v1"`

### Public UI continuity

Fresh browser tab:

- `https://stage.consultinity.ai/docs?ts=1774463100`

Observed network request from the live public docs homepage:

- `GET /api/public/kb-v8/featured?lang=en&limit=6` -> `200`

The featured cards rendered on the public `/docs` surface while using the anonymous bridge rather than the auth-gated `/api/v8/kb/featured` fallback.

## Residual gap

The public docs category grid is still on legacy/auth-broken wiring:

- `GET /api/knowledge-base/categories?lang=en` -> `401`

So `B-11f` is closed, but the next honest KB public follow-up is narrower:

- public docs category taxonomy continuity
