---
doc_id: CORE-ART-006E-A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006D
last_reviewed: 2026-07-31
---

# CORE-ART-006E-A — jeden kanon odczytu i zapisu Work Canvas

## Problem

Route i `workCanvasService` czytają inne pola. Truthiness w fallbackach potrafi wskrzesić
starą treść, a zmiana JSON może pozostawić stary Markdown oznaczony jako zsynchronizowany.
Snapshot wersji nie zachowuje formatu, a restore interpretuje go według bieżącego draftu.

## Oczekiwany rezultat

Jedna czysta funkcja rozwiązuje envelope z rekordu, a jedna tworzy spójny dual-write.
Route i service zwracają identyczny kanon. Restore jawnie inferuje format starszej wersji.

## Kryteria

1. Legalny `canonical_format` jest autorytatywny; NULL różni się od pustej treści.
2. Markdown używa `content_md` nawet gdy `''`; legacy fallback tylko dla NULL i stringu.
3. JSON używa native JSON; fallback legacy tylko dla prawdziwej wartości structured.
4. JSON mutation bez nowej projekcji oznacza Markdown jako stale/missing.
5. Przejścia markdown↔json czyszczą przeciwne pole i zachowują spójny legacy dual-write.
6. Route mapper i service mapper dają identyczny Envelope V1.
7. Version restore inferuje format z snapshotu, nie z bieżącego draftu; ambiguous legacy → `legacy/v0`.
8. Restore wykonuje read-back i zachowuje optimistic conflict guard.
9. Brak migracji DB i brak zmian Wave5.

## Recovery

Wspólny helper jest addytywny; rollback przywraca stare mappery bez zmiany istniejących danych.

## Odbiór 2026-07-31

Decyzja: **GO**.

- canonical transition/restore matrix: `6/6 PASS`;
- route smoke: `3/3 PASS`;
- pełny frontend typecheck: PASS;
- `git diff --check`: PASS.

Review wykrył i naprawił dwie regresje przed GO: pusty Markdown nie może być `synced`,
a `toDraft` nie może nadpisywać obliczonego statusu starym polem z rekordu.
