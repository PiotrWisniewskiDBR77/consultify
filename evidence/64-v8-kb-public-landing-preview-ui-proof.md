# V8 KB public landing preview continuity proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `fda65628-1733-4d31-a1df-f3e984af2e72`

## Scope

Close the last honest public KB continuity gap outside `/docs` by proving that the canonical public landing surface now renders the landing knowledge preview and hydrates it through the anonymous V8 bridge.

## Shipped path

- identified that the live public root route renders `src/views/ProductEntryPage.tsx`, not `src/views/PublicLandingPage.tsx`
- added `KnowledgePreviewSection` to `ProductEntryPage` so the canonical public landing surface now includes the landing KB preview cards
- added `tests/components/ProductEntryPage.kb-preview.test.tsx` to prevent future route-to-surface drift from silently dropping the preview section again

## Local verification

- `npx vitest run tests/components/ProductEntryPage.kb-preview.test.tsx tests/hooks/useDocs.test.tsx tests/hooks/useKnowledge.test.tsx`
- `ReadLints` returned no diagnostics for:
  - `src/views/ProductEntryPage.tsx`
  - `tests/components/ProductEntryPage.kb-preview.test.tsx`

## Live staging proof

### Deployment state

- `railway service status --environment staging --service consultify --json` returned:
  - `deploymentId: fda65628-1733-4d31-a1df-f3e984af2e72`
  - `status: SUCCESS`
  - `stopped: false`
- `GET https://stage.consultinity.ai/ping` -> `200` (`pong`)

### Fresh anonymous landing probe

Using a fresh Playwright browser context with no existing cookies:

- opened `https://stage.consultinity.ai/`
- waited for initial hydration
- scrolled the landing page to force lower public sections into view

Observed landing UI continuity:

- landing body contained `Knowledge Base`
- landing body contained `Discover Our Expertise`
- landing body contained `Access Full Knowledge Base`
- landing body contained `Read Full Article`

Observed governed network continuity:

- `GET /api/public/kb-v8/public?lang=en&limit=3` -> `200`

Observed sample payload from the live public bridge:

- `kb-art-api-intro` / `api-introduction`
- `kb-art-first-assessment` / `first-assessment-10-minutes`

### Direct API confirmation

- `GET /api/public/kb-v8/public?lang=en&limit=3` -> `200`
- response returned `3` public preview articles

## Honest closure read

The canonical public landing surface now proves real anonymous KB preview continuity through the governed V8 bridge, not just the `/docs` portal.

This closes the last previously declared public KB gap from the ledger. `Help / Knowledge Base` now has closure-grade staging proof across:

- authenticated Help Center listing/search/read/tracking
- anonymous `/docs` homepage, browse, search, article detail, and anonymous view tracking
- anonymous public landing preview cards through `/api/public/kb-v8/public`
