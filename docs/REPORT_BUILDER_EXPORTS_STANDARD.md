## Report Builder — Export Standard (PDF / DOCX / PPTX)

This document captures the **current export baseline** and the **quality conventions** we follow to reach “consulting-grade” outputs (IBM/EY/BCG style) for the Report Builder.

### Supported export endpoints

- **PDF**: `GET /api/report-builder/:id/export/pdf`
- **Word (DOCX)**: `GET /api/report-builder/:id/export/docx`
  - Backward compatible alias: `GET /api/report-builder/:id/export/doc`
- **PowerPoint (PPTX)**: `GET /api/report-builder/:id/export/pptx`

### Quality baseline we enforce now

- **PDF (pdfkit)**
  - **Title page** is separate from content pages.
  - **Header/footer** on every content page (client + report title, “Confidential”, page numbering).
  - Page numbering uses `bufferPages: true` to render numbers after content is generated.

- **DOCX (real Word document)**
  - Export generates a **real `.docx`** (not HTML saved as `.doc`).
  - Basic structure is preserved:
    - Cover-like title block
    - Section headings
    - Bullets / paragraphs
  - Footer includes a basic page indicator.

- **PPTX (pptxgenjs)**
  - Slide layout explicitly uses **16:9** (`LAYOUT_16x9`).
  - Default deck typography is “consulting-safe”:
    - Title: `Calibri Light`
    - Body: `Calibri`
  - **Slide numbers** enabled on content slides and dividers.
  - Long sections are split into multiple slides more aggressively (smaller chunk size).

### “Blocks via API” baseline

To move beyond hardcoded block palettes, dev seeding adds a curated **system block library** into `report_builder_block_types`.

- **Seeder**: `server/scripts/seed-dbr77-fill-all-tables.ts`
- **Behavior**: inserts system blocks (`organization_id = NULL`, `is_system = 1`) via `INSERT OR IGNORE`.

Seeded examples:

- `consulting_takeaway`: Key Takeaway (Slide headline)
- `consulting_implications`: Implications / “So what”
- `consulting_decisions`: Decisions needed (table)
- `consulting_risks_register`: Risks register (table)
- `consulting_2x2`: 2x2 prioritization (matrix)
- `consulting_benchmark_bar`: Benchmark chart data (chart)
- `consulting_roadmap`: Roadmap (Now/Next/Later)

### Next upgrades (shortlist)

- **PDF**: switch to HTML→PDF for pixel-perfect layout (optional fallback to pdfkit).
- **DOCX**: richer formatting (tables, callouts, images), TOC, branded header.
- **PPTX**: dedicated slide layouts per block kind (chart/table/matrix) + speaker notes.
