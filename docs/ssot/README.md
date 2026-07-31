---
doc_id: ssot-index
truth_type: product-target
status: canonical
owner: product-engineering
last_reviewed: 2026-07-30
---

# Consultinity — katalog źródeł prawdy

To jest profesjonalny punkt wejścia do wiedzy o aplikacji. Katalog nie próbuje
zastąpić kodu, bazy ani runbooków. Odpowiada, gdzie znajduje się rozstrzygająca
prawda i jaki jest poziom jej potwierdzenia.

## Kolejność czytania

1. [`APPLICATION.md`](APPLICATION.md) — czym jest aplikacja, dla kogo i jak
   działa jako całość.
2. [`REPOSITORY_STRUCTURE.md`](REPOSITORY_STRUCTURE.md) — mapa repozytorium i
   przeznaczenie najważniejszych katalogów.
3. [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) — aktualne punkty
   wykonawcze frontendu, backendu, AI i integracji.
4. [`DATA_SECURITY_OPERATIONS.md`](DATA_SECURITY_OPERATIONS.md) — dane,
   tenancy, bezpieczeństwo, środowiska, backup i rollback.
5. [`QUALITY_AND_DELIVERY.md`](QUALITY_AND_DELIVERY.md) — testy, evidence,
   release i definicja dowodu.
6. [`COMPLETENESS_MATRIX.md`](COMPLETENESS_MATRIX.md) — czego naprawdę mamy
   komplet, a czego nadal brakuje.
7. [`../program/WEEKEND_COMPLETION_2026-08-01/README.md`](../program/WEEKEND_COMPLETION_2026-08-01/README.md)
   — aktywny program odbioru i dokończenia aplikacji.
8. [`../FUNCTIONAL_DOCUMENTATION.md`](../FUNCTIONAL_DOCUMENTATION.md) —
   kontrakty 16 pozycji menu.
9. [`registry.json`](registry.json) — rejestr maszynowy.

## Dokumenty zarządzające

- [`COMPLETE_DOCUMENTATION_STANDARD.md`](COMPLETE_DOCUMENTATION_STANDARD.md) —
  obowiązkowy standard kompletności;
- [`DOCUMENT_LIFECYCLE.md`](DOCUMENT_LIFECYCLE.md) — statusy i cykl życia;
- [`RECONCILIATION_BACKLOG.md`](RECONCILIATION_BACKLOG.md) — konflikty i
  porządki pozostające do wykonania;
- [`../SOURCE_OF_TRUTH.md`](../SOURCE_OF_TRUTH.md) — hierarchia autorytetu.

## Zasada wykonawcza

`docs/ssot` rozstrzyga, **gdzie szukać prawdy**. Dla stanu bieżącego ostatnie
słowo mają kod, migracje, konfiguracja właściwego środowiska i wykonany test.
Dla stanu docelowego ostatnie słowo ma zaakceptowany kontrakt produktu.

Dokument zawierający `FINAL`, `MASTER`, `V8`, `SSOT` lub `kanon` w nazwie nie
otrzymuje przez to wyższego autorytetu.
