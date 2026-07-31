---
doc_id: CORE-ART-006F
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006E-B
last_reviewed: 2026-07-31
---

# CORE-ART-006F — materialize → real content read-back E2E

## Cel

Testowo udowodnić dla report, presentation i sheet pełny przepływ:
plan → approval → materialize → registry origin → content endpoint → stable ETag → origin edit
→ changed read-back. Produkcja nie jest zmieniana, chyba że test ujawni osobny błąd FIX.

## Zakres

- rozszerzenie wyłącznie testowego SQLite substrate o brakujące kolumny i tabele content;
- trzy realne flow przez istniejące artifact-runs routes;
- artifacts content route zamontowany w tej samej testowej aplikacji;
- deterministyczne fixtures rzeczywistej treści origin runtime.

## Kryteria

1. `artifactId`, response origin i primary registry link są zgodne.
2. Envelope V1 ma właściwy kind/schema/provenance i zawiera realną treść fixture.
3. Treść nigdy nie zawiera placeholdera Wave5 mirror.
4. Dwa GET bez zmiany mają identyczny hash/ETag; `If-None-Match` daje 304.
5. Edycja report section zmienia effective edited content, revision/hash/ETag.
6. Edycja native deck zmienia slides projection, revision/hash/ETag.
7. Edycja sheet record zmienia pageHash/contentHash/ETag; originRevision pozostaje jawnie null.
8. Nowy ETag ponownie daje 304.
9. Brak zmian produkcyjnych i brak migracji DB w tej paczce.

## Recovery

Zmiany dotyczą tylko testów i ich SQLite helpera; rollback nie dotyka danych ani runtime.

## Odbiór 2026-08-01

Decyzja: **GO**.

- trzy realne materialize/read-back flows w jednym suite: `8/8 PASS`;
- report, presentation i sheet potwierdzają origin link, V1 content, ETag/304 i zmianę po edycji;
- `git diff --check`: PASS;
- paczka nie zmienia kodu produkcyjnego.
