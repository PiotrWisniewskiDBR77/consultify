---
doc_id: CORE-ART-006C
truth_type: operations
status: ACCEPTED
owner: codex
product_owner: piotr
priority: P0
depends_on: CORE-ART-006B
last_reviewed: 2026-07-31
---

# CORE-ART-006C — adaptery treści raportu i prezentacji

## Oczekiwany rezultat

Resolver zwraca rzeczywistą treść report i presentation originów. Nie tworzy kopii w
Registry i nie używa placeholderów.

## Report adapter

- źródło: `report_builder_reports` oraz uporządkowane `report_builder_sections`;
- effective section content: `edited_content` ma pierwszeństwo przed `generated_content`;
- zachować format sekcji markdown/json/tiptap w `contentJson`;
- `contentMd` jest wierną projekcją wszystkich sekcji w kolejności;
- origin revision/hash zmienia się po edycji sekcji.

## Presentation adapter

- źródło kanoniczne: `presentation_decks.deck_json` lub właściwe JSON-native pole;
- Markdown jest wyłącznie projekcją decka;
- malformed JSON kończy się `failed` z kontrolowanym błędem, nie placeholderem;
- revision wynika z aktualnej wersji/updated timestamp i zmienia się wraz z deckiem.

## Kryteria

1. Adaptery rejestrują wyłącznie jawne runtime `report` i `presentation`.
2. Każdy query jest tenant-scoped.
3. Report: generated-only, edited precedence, mixed formats i section order są pokryte testami.
4. Presentation: JSON-native canonical, projection, pusta i malformed treść są pokryte testami.
5. Dwa kolejne GET bez zmiany źródła mają ten sam hash i ETag.
6. Edycja originu zmienia revision/hash/ETag i read-back.
7. Brak zmian DB, brak Wave5 mirror i brak adaptera sheet/canvas.
8. Istniejące materialize report/presentation pozostają zielone.

## Dozwolone pliki

- nowe adaptery w `server/src/services/artifacts`;
- rejestracja adapterów przy bezpiecznym bootstrapie resolvera;
- test helpers i testy resolver/route/materialize;
- minimalne użycie istniejących projection utilities.

## Recovery

Usunięcie rejestracji adapterów przywraca fail-closed unsupported runtime bez zmiany danych.

## Odbiór 2026-07-31

Decyzja: **GO**.

- adapter matrix: `6/6 PASS`;
- resolver i content route: `9/9 PASS`;
- materialize route regression: `10/10 PASS`;
- łącznie niezależnie: `25/25 PASS`;
- `git diff --check`: PASS.

Treść pochodzi wyłącznie z tenant-scoped origin. Nie powstaje placeholder ani kopia
kanonicznej treści w Registry.
