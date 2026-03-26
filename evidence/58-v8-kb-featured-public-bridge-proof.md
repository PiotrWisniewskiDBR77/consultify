# V8 KB featured continuity + public bridge blocker proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `7cfd7272-d70e-417a-8bf5-fdcb48456709` (Railway healthcheck passed; deployment later marked `SUCCESS`)

## Scope

Bounded B-11f follow-up on the remaining public Knowledge Base gap:

- move the public/docs `featured` cards off the legacy featured endpoint
- probe a truly anonymous bridge for `public preview` and `featured`

## Code path shipped

- Added public KB bridge handlers for `GET /public` and `GET /featured` in `server/src/routes/v8/knowledge-base.routes.ts`
- Mounted those handlers ahead of auth in `server/src/routes/v8/index.ts`
- Added dedicated public mount `GET /api/public/kb-v8/*` in `server/src/Gateway.ts`
- Updated `src/hooks/useDocs.ts` to prefer the public KB V8 bridge for `/docs` featured cards
- Updated `src/hooks/useKnowledge.ts` to prefer the public KB V8 bridge for landing preview/featured hooks, then fall back to auth-gated V8, then legacy

## Local verification

- `npm test -- src/routes/v8/__tests__/knowledge-base.routes.test.ts` in `server/` passed
- `npx vitest run tests/unit/services/v8-kb-api.test.ts tests/hooks/useKnowledge.test.tsx tests/hooks/useDocs.test.tsx --maxWorkers=1 --maxConcurrency=2` passed
- no new lint errors on edited files

## Live staging proof: public docs featured cards

Fresh browser tab: `https://stage.consultinity.ai/docs?ts=1774461900`

Observed public docs homepage rendered real featured cards and the network log showed:

- `GET /api/v8/kb/featured?lang=en&limit=6` -> `200`

The same tab still showed legacy docs categories requests returning `401`, but the featured cards themselves were hydrated through the governed KB featured route, confirming a real user-facing continuity move on the public docs surface.

## Live staging blocker: anonymous public bridge still intercepted by auth

Direct anonymous probes on staging returned:

- `GET https://stage.consultinity.ai/api/public/kb-v8/public?lang=en&limit=3` -> `401 {"error":"No token provided"}`
- `GET https://stage.consultinity.ai/api/public/kb-v8/featured?lang=en&limit=6` -> `401 {"error":"No token provided"}`

This means the newly mounted anonymous bridge is still being intercepted by auth somewhere in the live staging stack, even though the docs featured surface can succeed when the browser sends its existing app auth context.

## Honest closure read

What is now proven:

- public/docs featured KB cards are no longer tied only to the legacy featured endpoint; a live browser surface now hits `GET /api/v8/kb/featured` with `200`

What remains blocked:

- truly anonymous `public preview` continuity is not proven
- truly anonymous `featured` continuity via the new `/api/public/kb-v8/*` bridge is not proven
- the next honest move is to locate the staging auth intercept on `/api/public/kb-v8/*` and only then re-run anonymous browser/curl proof
