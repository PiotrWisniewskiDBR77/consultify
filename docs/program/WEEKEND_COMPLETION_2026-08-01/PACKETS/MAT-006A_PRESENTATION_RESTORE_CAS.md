---
doc_id: MAT-006A
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006C
last_reviewed: 2026-07-31
---

# MAT-006A — Presentation restore z optimistic concurrency

## Problem

Restore trwałej wersji prezentacji nadpisywał live deck bez expected-version. Równoległy
autosave lub edycja innego użytkownika mogły zostać utracone pomiędzy wyborem snapshotu
a wykonaniem restore.

## Rezultat

- restore wymaga `expectedVersion`;
- backend wykonuje tenant-scoped, atomowy CAS po `organization_id + version`;
- stale request otrzymuje `409 VERSION_CONFLICT` z wersją serwera i klienta;
- po udanym restore frontend wykonuje canonical GET;
- główny `serverVersionRef` buildera synchronizuje się z wersją zwróconą przez restore,
  więc kolejny autosave nie używa starego tokenu;
- konflikt nie wykonuje read-back ani nie aplikuje lokalnie wybranej wersji.

## Odbiór 2026-07-31

Decyzja: **GO**.

- frontend history/restore: `4/4 PASS`;
- real-SQL autosave/version/restore contract: `7/7 PASS`;
- razem: `11/11 PASS`;
- frontend `npm run type-check`: PASS;
- brak migracji i zmian generator/export/share.

## Znane granice

Zapis recovery snapshotu live deck jest best-effort po udanym CAS; awaria tabeli historii
nie cofa samego restore. Pełny wizard→generate→edit→reopen→restore→export→share E2E oraz
zamiana fail-soft pustej historii na kontrolowany `unavailable` pozostają w `MAT-006B`.
