# Repository Cleanup Ledger

This ledger records the first cleanup pass, the authority of noisy areas, and the action taken or intentionally deferred.

## Area Inventory

| Area | Category | Canonical replacement or authority | Proposed action | Risk |
| --- | --- | --- | --- | --- |
| `docs/product/` | `canonical` with mixed generations | `docs/product/DOCUMENTATION_REGISTRY.md` | Keep, tighten registry and read-order notes | High |
| `docs/ui-standards/` | `canonical` plus local snapshot duplicates | `docs/ui-standards/README.md` and `docs/ui-standards/FROZEN_LAYOUTS.md` | Keep canon, remove local suffixed duplicates, add authority note | Low |
| `docs/strategy/` | `canonical` strategy namespace with version overlap | `docs/strategy/README.md` | Keep, clarify current execution reference and historical planning status | Medium |
| `docs/plans/` | `active-working` plus `historical` exports | `docs/plans/README.md` | Keep plans, classify exports as historical, remove local numbered duplicates | Low |
| `wdrozenia/` | `historical` tracked implementation tree | `docs/` for canon, `wdrozenia/README.md` for classification | Preserve, do not expand as SSOT, add classification stub | High |
| `Consulitinity przegląd/` | `historical` audit evidence tree | `docs/` for canon, `Consulitinity przegląd/README.md` for classification | Preserve as evidence, do not use as product authority | Medium |
| `Softs/` | `external-reference` local corpus | `docs/cleanup/SOFTS_REFERENCE_HANDLING.md` | Keep outside canonical flow, handle in separate benchmark program | High |
| `data/sample-reports/` | mixed `canonical samples` and local duplicates | non-suffixed sample files | Keep canonical samples, defer duplicate sweep until sample ownership pass | Medium |
| `data/knowledge/` | local benchmark and sample material with duplicate clutter | none yet | Defer until provenance and retention policy is defined | High |

## First-Pass Actions Completed

| Path pattern | Action | Result |
| --- | --- | --- |
| `docs/ui-standards/**/* 2.md` and `* 3.md` | local duplicate removal | completed in this cleanup pass |
| `docs/plans/* 2.md` and `* 3.md` | local duplicate removal | completed in this cleanup pass |
| `Consulitinity przegląd/* 2.md` and `* 3.md` | local duplicate removal | completed in this cleanup pass |
| `docs/*` top-level indexes | authority and historical-link tightening | completed in this cleanup pass |
| `wdrozenia/` and `Consulitinity przegląd/` | parallel-tree classification stubs | completed in this cleanup pass |

## Deferred By Design

These areas were intentionally not moved or deleted in the first pass:

- tracked historical documents in `wdrozenia/`
- tracked audit evidence in `Consulitinity przegląd/`
- local benchmark corpora under `Softs/`
- noisy sample and knowledge duplicates under `data/` that need provenance review

## Decision Notes

- `docs/` remains the canonical home for tracked long-term documentation.
- `docs/cleanup/` is the repository hygiene SSOT.
- Numbered suffix copies are treated as local garbage unless a unique-content review proves otherwise.
