# Materials visual screenshot acceptance — 2026-08-06

**Target deployment:** `e9af278c`

**Runtime identity note:** the DEMO badge still shows the base metadata SHA `97a42e810bc1`. Acceptance is tied to the deployed functional fingerprint: Word advanced toolbar plus collapse/duplicate, Excel import plus chart creation, and PowerPoint manual block operations/new slide. The badge is therefore recorded as stale metadata, not a standalone failure.

**Evidence directory:** [`docs/qa/evidence/materials-visual-e9af278c/`](evidence/materials-visual-e9af278c/)

## Matrix

| Surface | 1280 light | 1440 light | 1280 dark | 1440 dark | Verdict |
|---|---:|---:|---:|---:|---|
| Word editor | PASS | PASS | PASS | PASS | Responsive toolbar wraps without clipping; outline, canvas and rails remain usable. |
| Excel editor | PASS | PASS | FAIL | FAIL | P1 contrast defect on imported conditional-format cells; fixed in code with theme-aware semantic tokens, pending deployment proof. |
| PowerPoint editor | FAIL | FAIL | FAIL | FAIL | P1: app sidebar + slide rail + right tools + Teresa compress the 1280 canvas to about 230 px; at 1440 the command top bar is not visible. Most slide thumbnails are technically truthful but microscopically unreadable. |
| Word Template Architect | PASS | PASS | PASS | PASS | Form, registry and command row remain readable; no legacy graphics. |
| Excel template library | PASS | PASS | PASS | PASS | Consistent cards and semantic spreadsheet identity; long names truncate honestly. |
| PowerPoint Template Architect | PASS | PASS | PASS | PASS | Form, registry and disabled state have sufficient hierarchy and contrast. |

## State and control evidence

| State | Evidence | Verdict |
|---|---|---|
| Toolbars and menus | Word and Excel editor captures; PPT builder captures | PASS Word/Excel; FAIL PPT command-row visibility. |
| Empty/generating | `word-empty-entry-dark.png` | PASS: named progress, progressbar and Stop recovery action. |
| Loading | `ppt-loading-dark.png` | PASS: content-shaped loading state appears before the deck resolves. |
| Error | `ppt-error-dark.png` | PASS: explicit “Failed to load presentation deck”, reason and Retry. |
| Thumbnails | PPT editor captures | FAIL P1: thumbnails do not provide legible content recognition at 1280/1440. |

## Release disposition

- **Word:** PASS.
- **Excel:** PASS after the token-based conditional-format contrast fix is deployed and the dark screenshot is repeated.
- **Template builders/library:** PASS.
- **PowerPoint:** FAIL P1 until responsive rails/command row and thumbnail legibility are corrected in the dedicated PPT batch.

No PPT source file was changed during this sweep because the PPT manual-editing agent owned those files concurrently.
