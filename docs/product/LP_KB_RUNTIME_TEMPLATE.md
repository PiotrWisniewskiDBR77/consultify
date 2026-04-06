# LP Knowledge Base Runtime Template

## Purpose

This document extracts the runtime pattern that LP repositories should mirror from the Consultify implementation.

## Server Pattern

### Public KB routes

Use the same public route shape as:

- `server/src/routes/v8/knowledge-base.routes.ts`
- mounted publicly from `server/src/index.ts` at `/api/public/kb-v8`

Authenticated routes can also mirror the V8 mount under `/api/v8/kb`.

### Service layer

Mirror:

- `server/src/services/KnowledgeBaseService.ts`

This service should own reads for:

- categories
- articles
- search
- collections
- tags
- related articles
- locale fallback
- public-only filtering

### Database model

Base tables come from:

- `server/migrations/739_knowledge_base_public_articles.sql`

Extended KB runtime features come from:

- `server/migrations/741_kb_collections_tags_surfaces.sql`

Minimum model to mirror:

- `kb_categories`
- `kb_category_translations`
- `kb_articles`
- `kb_article_translations`
- `kb_collections`
- `kb_collection_translations`
- `kb_tags`
- `kb_tag_translations`
- `kb_article_collections`
- `kb_article_tags`
- `kb_surface_bindings`

## Frontend Pattern

Mirror these public pages:

- `src/views/knowledge/KnowledgeBaseHomePage.tsx`
- `src/views/knowledge/KnowledgeBaseCategoryPage.tsx`
- `src/views/knowledge/KnowledgeBaseArticlePage.tsx`

Mirror these data hooks/clients:

- `src/hooks/useDocs.ts`
- `src/hooks/useKnowledge.ts`
- `src/services/api/v8/kb.ts`

## Runtime Configuration

LP repos should not hardcode Consultify-specific slugs or domains.

Configure per site/product:

- `productKey`
- category slug prefix
- brand name
- canonical base URL
- JSON-LD publisher
- optional per-category visual treatment

## Static Assets

Serve public KB images from:

- `/kb/<productKey>/<slug>/...`

Consultify server already serves `/kb` from `public/kb` in `server/src/index.ts`.

LP repos should keep the same serving pattern.

## Content Import Pattern

Use:

- `server/scripts/import-kb-product.ts`
- `server/scripts/kb-import-products.json`

The importer should read:

- `Blogs/_LP_KB_READY/<Product>/knowledge_base_manifest.json`
- `Blogs/_LP_KB_READY/<Product>/relation_manifest.json`
- `Blogs/<Product>/Blog/<NN_topic_slug>/article_EN.md`
- optional sidecars and assets

## Smoke Checklist

After rollout in an LP repo, verify:

1. categories load publicly
2. article listing loads publicly
3. article detail works in `EN`, `PL`, `DE`
4. category filtering is product-scoped
5. article body does not expose metadata header lines
6. recommendation links stay inside the intended product sectioning
7. thumbnail URLs only exist when real assets exist
