---
doc_id: CORE-ART-006
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-005
last_reviewed: 2026-07-31
---

# CORE-ART-006 — kanoniczna treść i read-back artefaktów

Artifact Registry pozostaje katalogiem i wskaźnikiem pochodzenia. Nie duplikujemy do
niego treści. Kanoniczny resolver odczytuje rzeczywisty origin runtime i zwraca wspólny,
wersjonowany envelope.

## Paczki

1. `006A` — wspólny DTO V1, walidacja i zgodność legacy;
2. `006B` — registry resolver i endpoint content/read-back;
3. `006C` — adaptery report i presentation;
4. `006D` — adapter sheet ze stabilnym snapshotem i completeness;
5. `006E` — ujednolicenie Work Canvas i neutralizacja placeholdera Wave5;
6. `006F` — pełne materialize → content read-back E2E.

## Zasady niepodlegające negocjacji

- brak destrukcyjnej migracji;
- origin runtime pozostaje źródłem prawdy;
- brak placeholderów udających treść kanoniczną;
- JSON-native content nie może mieć statusu `synced` bez dowodu rewizji/hash;
- preview skrócony nie może być przedstawiany jako pełny eksport;
- tenant scope i stabilny hash/ETag na każdej ścieżce odczytu.

## Odbiór programu 2026-08-01

Decyzja: **GO**. Paczki `006A–006F` zaakceptowane. Registry pozostaje katalogiem,
origin runtime źródłem prawdy, a report/presentation/sheet/Canvas/Wave5 mają jawny
kontrakt content i sprawdzony read-back.
