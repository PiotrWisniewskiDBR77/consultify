# 531 - V8.1 Help / Knowledge Base must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Help / Baza wiedzy` must-have closure

## Problem before closeout

- The customer-facing KB already treated `/docs` as canonical, but key docs surfaces still had locale drift and defaulted to hardcoded `en`.
- `/docs/api` exposed a large mock API explorer, which overstated product readiness and created a false authority surface.
- Docs home still advertised a fully published API reference even though the API docs page was not real.
- Legacy knowledge tests still targeted non-existent `/knowledge/new` and article editor routes instead of the real customer documentation flow.
- `DocsArticleView` assumed `IntersectionObserver` existed, making the article surface brittle in some runtime/test environments.

## What landed

### 1. Locale truth for canonical docs

- `src/layouts/DocsLayout.tsx`
  - now derives docs language from active i18n state,
  - passes the active language to `useDocsCategories`,
  - localizes core shell copy used by the customer docs chrome.

- `src/views/docs/DocsHomeView.tsx`
  - now resolves both categories and featured articles using active i18n language,
  - no longer hardcodes featured article reads to `en`,
  - localizes the main customer-facing docs copy that anchors the docs homepage.

- `src/views/docs/DocsCategoryView.tsx`
  - now uses active docs language for category and article list reads,
  - localizes key empty/search/readback messages.

- `src/views/docs/DocsSearchView.tsx`
  - now uses active docs language for docs search,
  - localizes key search-state messaging.

- `src/views/docs/DocsArticleView.tsx`
  - now fetches the article using active docs language,
  - localizes key not-found/share/readback text.

### 2. Honest API docs surface

- `src/views/docs/DocsApiReferenceView.tsx`
  - replaced the fake mock API explorer with an explicit placeholder,
  - now clearly states that the live API reference is not yet published,
  - prevents `/docs/api` from pretending to be an authoritative endpoint catalog.

- `src/views/docs/DocsHomeView.tsx`
  - updated API card messaging to match the honest `/docs/api` placeholder,
  - removed copy that implied a complete live REST reference already existed.

### 3. Canonical route cleanup

- `src/views/KnowledgeBaseEntryView.tsx`
  - remains the redirect shim from legacy `/knowledge` entry to canonical `/docs`.

- `tests/e2e/knowledge/knowledge-base.spec.ts`
  - no longer targets dead `/knowledge/new` / `/knowledge/articles/.../edit` paths,
  - now targets:
    - `/knowledge -> /docs`,
    - `/docs/search`,
    - `/docs/api`.

### 4. Runtime guard for article view

- `src/views/docs/DocsArticleView.tsx`
  - now guards the TOC scroll-spy effect when `IntersectionObserver` is unavailable,
  - prevents article rendering from failing in non-browser or limited browser environments.

## Automated verification

Passed:

- `npx vitest run tests/components/docs/DocsHomeView.locale.test.tsx tests/components/docs/DocsArticleView.locale.test.tsx tests/components/docs/DocsApiReferenceView.placeholder.test.tsx tests/components/KnowledgeBaseEntryView.redirect.test.tsx`

Coverage includes:

- docs home uses active i18n locale for categories and featured reads,
- docs article uses active i18n locale for article reads,
- legacy `/knowledge` entry still redirects to canonical `/docs`,
- `/docs/api` remains an honest placeholder instead of a fake live explorer.

## Manual acceptance checklist

- Open `/knowledge` and confirm it redirects to `/docs`.
- Open `/docs` in PL and EN and confirm homepage article/category reads follow the active locale.
- Open a docs article in PL and confirm article fetch/readback uses PL instead of silently falling back to EN.
- Open `/docs/api` and confirm the page explicitly says the interactive API reference is not published yet.
- Confirm docs homepage API card does not overpromise a live API explorer.
- Open docs article view in an environment without `IntersectionObserver` support and confirm the article still renders.

## Residual risk

- `DocsHomeView` and some other docs surfaces still contain a wider set of marketing-style copy that could be further normalized under full i18n keys later.
- `KnowledgeBaseView.tsx` remains an unused legacy/static surface in the repo; this packet removed misleading route tests first, but the file itself is still debt.
- `GlobalHelpSearch` / `useGlobalHelpSearch` remain dead or at least non-primary surfaces; they were not reintroduced in this must-have closure.
- A true live API reference still needs a real publication path or OpenAPI-backed renderer; this packet intentionally stopped pretending that it already exists.

## Status

- `Help / Baza wiedzy` now has a clearer canonical docs truth, better locale coherence, honest API-docs behavior, and real route tests aligned with the live customer KB.
- Current closure status: code landed, focused tests green, manual acceptance still required.
