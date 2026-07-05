# DocxStyler parity — before/after sample (Vegas Fala 6 / task #43)

DOCX was the weakest of the three deliverable stylers: it delegated all
visuals to Word's named styles and carried no palette of its own, so output
drifted to flat slate greys while **DeckStyler** (navy `#0C447C` + teal
`#1D9E75`) and **WorkbookStyler** (navy header fills + teal color-scales)
already shared one brand chord. This run brings DOCX to parity.

Both `.docx` files render the SAME representative executive memo (cover, two
tone-driven callouts, a pull-quote, a KPI strip, and a deliberately 10-column
table to exercise the overflow guard). Only the styler changed.

| file | renderer |
|------|----------|
| `before.docx` / `before-xml-markers.json` | base `9108fcf0dd` (pre-change) |
| `after.docx` / `after-xml-markers.json` | this branch (`feat/docx-styler-parity`) |

## Machine-checkable chrome delta (from `*-xml-markers.json`)

| marker | before | after |
|--------|:------:|:-----:|
| navy `0C447C` table-header / KPI fills in document | 0 | 8 |
| navy heading color in styles.xml (H1/TOC) | 0 | 3 |
| navy-soft `1B5FA8` H2 color in styles.xml | 0 | 2 |
| teal `1D9E75` accent rule in document (cover + H1) | 0 | 2 |
| teal in styles.xml (H1 hairline + Callout spine) | 0 | 2 |
| callout soft fills (success `EAF6F1` / danger `FBECEC`) | 0 / 0 | 1 / 1 |
| crimson `C0392B` **as danger STATUS only** | 0 | 3 |
| table column-fold marker (`+3 more`) | absent | present |
| **legacy slate table-header `E2E8F0`** | 10 | **0** |
| **legacy slate heading `0F172A`** | 7 | **0** |

Doctrine held: navy is the dominant chrome, teal the accent, and crimson
appears ONLY as the `danger` status accent — never as a fill or border.
Zero crimson in the chrome path.

Regenerate with the ad-hoc script pattern in the PR (renders schema →
`renderDocumentSchemaToDocxBuffer` → unzip → count markers). The scripts were
scratch-only and are not committed.
