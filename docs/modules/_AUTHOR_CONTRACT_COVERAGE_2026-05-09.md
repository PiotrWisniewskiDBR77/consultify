# Module Contract Coverage Manifest — 2026-05-09

Purpose: show what is now covered by the author-level module contracts in `DRD/consultify/docs/modules/`.

## Contract Rule

- `00_META.md` through `07_ACCEPTANCE_AND_TESTS.md` are the canonical author-level contract for each module.
- `SSOT.md` lists source documents migrated into the baseline.
- `RAW_INPUT.md` stores future raw author requirements before normalization.

## Module Coverage

| # | Module | Status | Source count | Primary route |
| --- | --- | --- | ---: | --- |
| 1 | `01_czat` — Czat / Teresa Chat Engine | shipped-core | 7 | `/chat` |
| 2 | `02_moja-praca` — Moja Praca / My Work | shipped-core | 9 | `/my-work` |
| 3 | `03_wywiad` — Wywiad / Interview | shipped | 4 | `/discovery` |
| 4 | `04_narzedzia` — Narzędzia / Tools | shipped | 7 | `/discovery-tools` |
| 5 | `05_inicjatywy` — Inicjatywy | shipped-core | 8 | `/initiatives` |
| 6 | `06_realizacja` — Realizacja / Implementation & PMO | shipped-core | 8 | `/execution` |
| 7 | `07_rezultaty` — Rezultaty / Results & Value Realization | shipped-core | 6 | `/benefits` |
| 8 | `08_finanse` — Finanse / Finance & Intelligence | shipped-partial | 4 | `/economics` |
| 9 | `09_outputs` — Outputs Library | shipped-core | 6 | `/presentations` |
| 10 | `10_dokumenty` — Dokumenty / Document Studio | soon-author-canon | 6 | `/documents` |
| 11 | `11_tabele` — Tabele / Table Studio | soon-author-canon | 6 | `/tables` |
| 12 | `12_prezentacje` — Prezentacje / Presentation Studio | soon-author-canon | 7 | `/presentations` |
| 13 | `13_meeting` — Meeting | soon | 4 | `/meeting` |
| 14 | `14_mcp-iris` — MCP IRIS | soon | 2 | `/mcp/iris` |
| 15 | `15_mcp-marketplace` — MCP Marketplace / DBR77 | soon | 2 | `/mcp/marketplace` |
| 16 | `16_organizacja` — Organizacja / Organization Context | shipped-partial | 5 | `/organization` |
| 17 | `17_panel-administratora` — Panel Administratora | shipped-partial | 5 | `/admin` |
| 18 | `18_ustawienia` — Ustawienia | shipped-partial | 3 | `/settings` |
| 19 | `19_portal-partnerski` — Portal Partnerski | shipped-partial | 5 | `/partner` |

## Known Structural Decisions

- `Tabele Studio` is not a separate folder; it is covered by `11_tabele`.
- `Assessment` remains part of `04_narzedzia` unless the author decides to add a separate sidebar/contract folder.
- `Outputs` owns durable artifact library; `Dokumenty`, `Tabele`, and `Prezentacje` own format runtimes.
- Raw author UI/UX materials remain mirrored in `DRD/consultify/docs/UI_UX/` and `DRD/consultify/docs/RAW/` until a single storage decision is made.

## Recovery Note

- Pre-migration backup: `DRD/consultify/docs/_recovery/modules-pre-author-contract-2026-05-09/`.
