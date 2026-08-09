# Materials visual screenshot acceptance — 2026-08-06

**Initial target deployment:** `e9af278c`

**Focused re-acceptance deployment:** Railway `0df01551` (2026-08-07)

**Runtime identity note:** the DEMO badge still shows the base metadata SHA `97a42e810bc1`. Acceptance is tied to the deployed functional fingerprint: Word advanced toolbar plus collapse/duplicate, Excel import plus chart creation, and PowerPoint manual block operations/new slide. The badge is therefore recorded as stale metadata, not a standalone failure.

**Evidence directory:** [`docs/qa/evidence/materials-visual-e9af278c/`](evidence/materials-visual-e9af278c/)

**Focused re-acceptance evidence:** [`docs/qa/evidence/materials-visual-0df01551/`](evidence/materials-visual-0df01551/)

**Final focused deployment:** Railway `1440ad3a` (2026-08-07)

**Final evidence:** [`docs/qa/evidence/materials-visual-1440ad3a/`](evidence/materials-visual-1440ad3a/)

## Final focused recapture — `1440ad3a`

| Surface | 1280 light | 1440 light | 1280 dark | 1440 dark | Verdict |
|---|---:|---:|---:|---:|---|
| Excel conditional formatting | PASS | PASS | FAIL | FAIL | Light: B5 computes to dark `rgb(71, 85, 105)` on `rgb(220, 239, 234)`. Dark: the deployed cell still has no inline foreground and inherits `rgb(184, 196, 214)` on the same pale fill, only **1.48:1** contrast. |
| PowerPoint command row | PASS | PASS | PASS | PASS | Stable recapture after theme/layout settlement reports `topbar.y = 48` and `scrollTop = 0` at both widths and themes; the complete command row is visible below the global header. |
| PowerPoint canvas / right tools / Teresa | PASS | PASS | PASS | PASS | At 1280 the canvas remains 992 px wide, right tools remain a 56 px overlay rail and Teresa is a 360 px overlay. At 1440 the standard expanded layout remains usable. |
| PowerPoint thumbnails | FAIL | PASS | FAIL | PASS | Full 16:9 thumbnails and truthful captions pass at 1440. At 1280 the compact left rail correctly stays 48 px, but focus expands it to 200 px while its list retains `visibility:hidden`; the overlay is blank and thumbnails cannot be reached. |

**Final disposition:** PowerPoint command-row and central-canvas P1 defects are closed. Release remains **FAIL P1** for Excel dark conditional-format contrast and the inaccessible 1280 PowerPoint thumbnail overlay. No source code was changed during this final recapture.

**Robust-fix deployment:** Railway `e296c7fd` (2026-08-07)

**Robust-fix evidence:** [`docs/qa/evidence/materials-visual-e296c7fd/`](evidence/materials-visual-e296c7fd/)

## Robust-fix recapture — `e296c7fd`

| Surface | 1280 light | 1440 light | 1280 dark | 1440 dark | Verdict |
|---|---:|---:|---:|---:|---|
| Excel imported fill without `fontColor` | PASS | PASS | FAIL | FAIL | The new inline contract is present (`color` and `-webkit-text-fill-color: var(--c-text)`), but dark `--c-text` resolves to `rgb(244,247,251)` while the imported fill stays pale `rgb(220,239,234)`: only **1.11:1** contrast. Foreground selection alone cannot make a fixed light import theme-safe. |
| PowerPoint 1280 thumbnail rail | PASS | — | — | — | Focus expands the rail from 48 to 200 px; list and thumbnails resolve to `visibility:visible` and the list to `pointer-events:auto`. Full 16:9 previews and truthful captions are visible in the overlay. |
| PowerPoint 1280 command row | FAIL cold load / PASS after focus | — | — | — | After a cold reload the top bar is at `y=-8`; focusing the rail scrolls/settles it to `y=48` with `scrollTop=0`. The row is usable after interaction, but the cold-load `y>=0` acceptance condition is not yet deterministic. |

**Robust-fix disposition:** the 1280 thumbnail-rail P1 is closed. Release remains **FAIL P1** because Excel dark contrast is 1.11:1 and the PowerPoint command row can still begin above the viewport on cold load. This was a docs-only recapture; no runtime source file was changed.

## Focused re-acceptance — 2026-08-07

| Surface | 1280 light | 1440 light | 1280 dark | 1440 dark | Verdict |
|---|---:|---:|---:|---:|---|
| Excel conditional formatting | — | — | FAIL | FAIL | Deployed DOM still carries imported `rgb(220, 239, 234)` background with inherited `rgb(184, 196, 214)` text on B5. The token-based source fix is not present in the rendered inline style; deployment proof remains open. |
| PowerPoint canvas and rails | PASS | PASS | PASS | PASS | At 1280 the canvas is 992 px wide; left/right rails use the compact 48/56 px overlay policy and Teresa no longer consumes layout width. |
| PowerPoint command row | FAIL | FAIL | FAIL | FAIL | The deck root used `h-screen` inside an 852 px host area. The host scrolled by 48 px, placing the 56 px command row at `y=0` (1440) or `y=-56` (1280), under/outside the global header. Corrected locally to `h-full`; new deployment proof required. |
| PowerPoint thumbnails | PASS | PASS | PASS | PASS | Full 16:9 compositions render without misleading crop; captions provide truthful readable slide identity. At 1280 the compact rail intentionally reveals the thumbnails as an overlay on hover/focus. |

**Focused disposition:** PowerPoint responsive canvas/rails and thumbnail truthfulness are accepted. Excel dark conditional contrast and PowerPoint command-row visibility remain release-blocking until the corrected sources are deployed and recaptured.

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
