# V8.1 Evidence - Edukacja T4 Acceptance

Date: 2026-03-26
Lane: `Edukacja`
Taxonomy: `T4`
Decision: `accepted bounded lane`

## Acceptance basis

`Edukacja` is ready for bounded `T4` acceptance because the active KB/help bridge now has one coherent public chain:

1. the live `/docs` surface follows the mounted KB-backed read chain
2. the dead fallback path was removed in Packet 1
3. legacy `/knowledge` now redirects into `/docs` instead of acting as a second authority surface

## Why this is enough

The bounded lane goal was not a standalone academy or a broader learning product. The goal was to make the documented
`Edukacja via Help / Knowledge Base` bridge honest on the active public surface.

That split is now closed without reopening:

- standalone `Edukacja` navigation
- partner certification depth
- broad landing/mobile education redesign

## Evidence chain

- `evidence/194-v81-edukacja-split-brain-map.md`
- `evidence/195-v81-edukacja-kb-fallback-seam.md`
- `evidence/196-v81-edukacja-entry-authority-seam.md`

## Verification

- `npx vitest run tests/hooks/useDocs.test.tsx`
- `npx vitest run tests/unit/routes/routeConfig.test.ts tests/components/KnowledgeBaseEntryView.redirect.test.tsx`
