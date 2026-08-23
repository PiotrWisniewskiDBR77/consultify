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
The attempted presentation and workbook paths are not mounted canonical routes and fall
back to Chat. Therefore this replay proves the registry/table integration only. It does
not claim DOC/PPT/XLSX cold-open, persistence, export, or owner acceptance.
