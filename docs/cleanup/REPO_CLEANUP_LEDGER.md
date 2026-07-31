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

## Second-Pass Actions Completed (2026-03-31)

| Path pattern | Action | Result |
| --- | --- | --- |
| `ARCHITECTURE_DECISIONS_TAB.md` | `git mv` → `docs/architecture/` | completed |
| `CHANGELOG_RESOURCE_MANAGEMENT.md` | `git mv` → `docs/architecture/` | completed |
| `HOSTING_RECOMMENDATIONS.md` | `git mv` → `docs/deployment/` | completed |
| `RAILWAY_DEPLOYMENT.md`, `RAILWAY_SETUP.md` | `git mv` → `docs/deployment/` | completed |
| `TEST_REPORT_DECISIONS_TAB.md`, `test-decisions-manual.md` | `git mv` → `docs/testing/` | completed |
| `odpowiedzi/` + `odpowiedzi.zip` | `git mv` → `docs/odpowiedzi/` | completed |
| `env.production.template` | `git mv` → `config/` | completed |
| `start-londyn.sh` | `git rm --cached` (already in .gitignore) | untracked |
| `verify-rec-map-blocker.mjs` | `git rm --cached` | untracked |
| `_archived_backups/*.tar.gz` | `git rm --cached` | untracked |
| `docs/.../final-v8-contracts/` (outer, pre-closure) | moved to `_quarantine/pre-closure-contracts/`, untracked | 35 stale contracts removed from git |
| `debug-*`, `test-*`, `inspect-*`, `capture-*`, `reproduce-*` (root) | moved to `_quarantine/root-debug-artifacts/` and `_quarantine/root-test-scripts/` | local only |
| `DECISION_TAB_FIX.md`, `REC_MAP_CRASH_EVIDENCE.md` | moved to `_quarantine/` | local only |
| `.gitignore` | added: `Softs/`, `App_for_ideas/`, `Consulitinity przegląd/`, `Logo consultinity/`, `_archived_backups/`, `test-drafts/`, `test-screenshots/` | updated |
| `.dockerignore` | added: `Softs`, `App_for_ideas`, `Consulitinity przegląd`, `Logo consultinity`, `Piotr_Tools`, `Plast-met`, `_quarantine`, `_backup`, `_archived_backups`, `_analysis`, `.cursor`, `.claude`, `.codex-worktrees`, `.tmp`, `screenshots`, `exports` | updated |

## Deferred By Design

These areas were intentionally not moved or deleted:

- tracked historical documents in `wdrozenia/` (298 files, deployment history)
- `Consulitinity przegląd/` — local-only (now in .gitignore), not tracked
- `App_for_ideas/` — local-only (now in .gitignore), not tracked
- `Logo consultinity/` — local-only (now in .gitignore), not tracked
- local benchmark corpora under `Softs/` (now in .gitignore + .railwayignore + .dockerignore)
- noisy sample and knowledge duplicates under `data/` that need provenance review

## Third-Pass Information Architecture (2026-07-30)

| Obszar | Działanie | Wynik |
| --- | --- | --- |
| `docs/ssot/` | zbudowano kompletny punkt wejścia: produkt, repo, architektura, dane/security/ops, jakość i kompletność | completed |
| menu funkcjonalne | zarejestrowano kontrakty dla 16/16 pozycji | completed |
| `docs/README.md`, root `README.md` | usunięto bezwarunkowe deklaracje gotowości i metryk bez świeżego dowodu | completed |
| kontrola SSOT | rozszerzono o wymagany komplet plików | completed |
| lokalne sekrety | sprawdzono tracking nazw `.env`, credentials i secrets | brak śledzonych lokalnych env/credentials |
| `out/`, `tmp/`, `uploads/` | wykryto historycznie śledzone artefakty | deferred; wymaga osobnej migracji Git |
| root reports | trzy unikalne raporty przeniesiono do `docs/testing/reports/`; generator audytu zaktualizowano | completed |
| `knowledge/` | duży korpus źródeł, w tym pliki binarne | deferred; wymaga provenance/licensing review |

### Safety decision

W trzecim przebiegu nie wykonywano masowych przenosin ani usuwania plików
śledzonych. Repo zawiera roczną historię i artefakty, których unikalności nie
można bezpiecznie rozstrzygnąć po nazwie. Następna redukcja rozmiaru powinna
mieć osobny backup, manifest hashy, owner decision i plan odtworzenia.

## Decision Notes

- `docs/` remains the canonical home for tracked long-term documentation.
- `docs/cleanup/` is the repository hygiene SSOT.
- Numbered suffix copies are treated as local garbage unless a unique-content review proves otherwise.
- `_quarantine/` is local-only (in .gitignore) — safe holding area for files removed from tracking.
