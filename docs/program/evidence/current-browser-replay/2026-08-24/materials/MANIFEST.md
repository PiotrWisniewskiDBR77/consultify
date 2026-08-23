# Materials current-runtime replay — 2026-08-24

- Integration source: `codex/final-mvp-integration-20260823`
- Source baseline before this change: `cff8647fe6965ecb1a5e9ca30fff95c791dab549`
- Browser runtime: `http://127.0.0.1:4390`
- Visible runtime marker: `LOCAL @cc8848eb7d33`
- Explicit review query: `sampleData=materials-vnext`
- Database writes: none
- Railway / shared staging writes: none

## Registry readback

Route: `/presentations?tab=all&ownerReview=4&sampleData=materials-vnext`

Observed in the browser DOM:

- `All 3`, `Document 1`, `Presentation 1`, `Sheet 1`;
- `Plan transformacji operacyjnej` — Document, DOCX, Ready, approved;
- `Transformacja operacyjna — decyzja 90 dni` — Presentation, PPTX, Ready, approved;
- `Model korzyści transformacji` — Sheet (model), XLSX, Ready, approved.

Screenshot: `materials-all-registry.jpg`

SHA-256: `43b1a9f6947b7085e70f0b7f3ff43109f0745ae7a37d33d3f896bda05fcdd30f`

## Full-card truth

The current runtime does not contain canonical records for these explicit review IDs.
The document route opens Document Studio but returns `Nie znaleziono tego dokumentu`.

## Recovered canonical Materials lane

A read-only identity check found the already-running isolated Materials owner runtime:

- frontend: `http://127.0.0.1:4342`;
- API: `http://127.0.0.1:4341` (`/api/health` = `200`);
- database: local PostgreSQL `consultify_w3_materials_owner_recovered_20260823` on loopback;
- no database, Railway or staging mutation was performed.

The canonical registry contains one presentation, `Plan transformacji — 90 dni`. Opening it from the registry cold-opens the full Deck Builder with four slides, slide navigation, editing controls, presentation mode, comments, AI actions and the Teresa side panel. Evidence: `materials-presentation-full-card-4342.jpg`.

The deterministic fixture deep-links prove that the two records missing from the common registry projection were not lost:

- `/document-studio/b1120000-0000-4000-8000-000000000001` cold-opens `Plan transformacji operacyjnej` in the full Document Studio with two populated sections, formatting, QA/review, AI Editor, share and DOCX/PDF export controls. Evidence: `materials-document-full-card-4342.jpg`;
- `/excele?ff_excele=1&artifactId=b1180000-0000-4000-8000-000000000001` cold-opens the real `Budżet pilotażu` workbook with one XLSX sheet, download/preview and history/release controls. Evidence: `materials-sheet-full-card-4342.jpg`.

The remaining defect is now bounded: Document and Sheet exist and their full cards work, but the recovered common Materials registry exposes only the Presentation row. Repairing/rebuilding those two registry projections and proving row-to-card navigation remains integration work. Persistence mutations and exports were not executed in this read-only replay.
The attempted presentation and workbook paths are not mounted canonical routes and fall
back to Chat. Therefore this replay proves the registry/table integration only. It does
not claim DOC/PPT/XLSX cold-open, persistence, export, or owner acceptance.
