# V8.1 Evidence - Edukacja Entry Authority Seam

Date: 2026-03-26
Lane: `Edukacja`
Taxonomy: `T4`
Packet: `Packet 2`

## Goal

Close the next active edukacja split by making `/docs` the only canonical KB-backed entry and reducing static
`/knowledge` to compatibility behavior.

## What changed

1. `src/routes/routeConfig.ts`
   - adds canonical `ROUTES.DOCS = '/docs'`
   - maps `AppView.KNOWLEDGE_BASE` and `AppView.KNOWLEDGE_BASE_ARTICLE` to `/docs`
   - resolves both `/docs/*` and legacy `/knowledge*` paths back to the same knowledge-base AppView
2. `src/views/KnowledgeBaseEntryView.tsx`
   - introduces a thin redirect shim from the legacy knowledge-base entry to `/docs`
3. `src/routes/AppRoutes.tsx`
   - mounts the shim at `/knowledge` instead of the old static knowledge surface
4. `tests/unit/routes/routeConfig.test.ts`
   - adds regression for canonical knowledge route authority through `/docs`
5. `tests/components/KnowledgeBaseEntryView.redirect.test.tsx`
   - adds regression for the legacy `/knowledge` redirect target

## Why it matters

Before this packet, edukacja still had two competing public entries:

- `/docs/*` was the API-backed KB surface
- `/knowledge` was a separate static help surface

That kept entry authority split even after the mounted KB fallback seam was fixed.

After this packet, `/docs` is the single canonical edukacja entry and `/knowledge` is explicitly a compatibility alias.

## Verification

- `npx vitest run tests/unit/routes/routeConfig.test.ts tests/components/KnowledgeBaseEntryView.redirect.test.tsx`
