# V8 KB public docs browse continuity proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `ddd6f7b2-12bf-4c52-8c6d-dbbb4efbfcb5`

## Scope

Extend anonymous KB continuity on the public `/docs` portal beyond homepage cards so category browse, search, article detail, and article view tracking no longer depend on legacy `knowledge-base/*` reads.

## Shipped path

- added anonymous-safe public bridge routes for:
  - `GET /api/public/kb-v8/articles`
  - `GET /api/public/kb-v8/search`
  - `GET /api/public/kb-v8/articles/:slug`
  - `POST /api/public/kb-v8/articles/:id/view`
- kept public article listing forced to `publicOnly: true`
- blocked anonymous article detail for non-public rows
- updated `src/hooks/useDocs.ts` so public docs browse/search/article hooks prefer the anonymous V8 bridge first, then auth-gated V8, then legacy fallback

## Local verification

- `npm test -- src/routes/v8/__tests__/knowledge-base.routes.test.ts` in `server/`
- `npx vitest run tests/hooks/useDocs.test.tsx tests/unit/services/v8-kb-api.test.ts --maxWorkers=1 --maxConcurrency=1`
- `ReadLints` returned no diagnostics for edited files

## Live staging proof

### Category browse

Fresh route:

- `https://stage.consultinity.ai/docs/guides?ts=1774471900`

Observed requests:

- `GET /api/public/kb-v8/categories?lang=en` -> `200`
- `GET /api/public/kb-v8/articles?category=guides` -> `200`

### Search

Fresh route:

- `https://stage.consultinity.ai/docs/search?q=API&ts=1774471940`

Observed request:

- `GET /api/public/kb-v8/search?q=API&lang=en` -> `200`

Observed UI continuity:

- search results page rendered a real public docs hit (`API Introduction`)

### Article detail + tracking

Fresh route:

- `https://stage.consultinity.ai/docs/api-reference/api-introduction?ts=1774472020`

Observed requests:

- `GET /api/public/kb-v8/articles/api-introduction?lang=en` -> `200`
- `POST /api/public/kb-v8/articles/kb-art-api-intro/view` -> `200`

Observed UI continuity:

- article detail rendered the docs article shell with share action and related links

## Honest closure read

The public `/docs` portal now uses anonymous governed KB reads not only for homepage categories/featured cards, but also for browse, search, article detail, and anonymous view tracking.

The remaining honest public KB gap is no longer `/docs` browse continuity. What remains is a separate landing-surface decision/proof for preview cards outside the docs portal, if that surface stays in scope.
