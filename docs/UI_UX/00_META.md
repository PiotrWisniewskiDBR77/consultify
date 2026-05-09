---
uiux_doc_id: UIUX_META
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# META — UI/UX author canon

## Purpose

Zdefiniować metadane, zakres i reguły kanoniczności dla katalogu `DRD/consultify/docs/UI_UX/`.

## Goal

Utrzymać autorskie SSOT UI/UX dla całej aplikacji: shell, moduły, stany, komunikaty, AI UX, bezpieczeństwo UI.

## Non-goals

- Opisywanie implementacji kodu (to należy do `docs/modules/*/CODEMAP.md` i dokumentów architektury).
- Duplikowanie szczegółowych standardów technicznych, jeśli już istnieją (preferuj link + autorska interpretacja).

## One SSOT discipline (dual-write rule)

Żeby naprawdę utrzymać **jedno** źródło prawdy (bez dryfu), obowiązuje zasada:

- **MUST**: Każda nowa decyzja UI/UX i każda zmiana standardu jest zapisywana **najpierw** w `DRD/consultify/docs/UI_UX/` (AUTHOR_CANON).
- **MUST**: Jeśli zmiana dotyczy “patternu implementacyjnego” (shell/layout/component/interaction standard), to **w tej samej zmianie** uzupełniamy również właściwy dokument w `DRD/consultify/docs/ui-standards/` (operacyjny SSOT implementacji).
- **MUST NOT**: Dodawać nowych standardów/patternów wyłącznie w `docs/ui-standards/` bez wpisu i mapowania w AUTHOR_CANON.
- **MUST NOT**: Traktować `docs/ui-standards/*` jako “drugiego kanonu produktowego” — jego rola to egzekucja i szczegóły implementacyjne; intencja i rozstrzygnięcia żyją w AUTHOR_CANON.

Konsekwencja:

- `docs/ui-standards/*` pozostaje szczegółowym SSOT implementacyjnym,
- `DRD/consultify/docs/UI_UX/*` pozostaje nadrzędnym SSOT autorskim,
- a “jedno miejsce prawdy” utrzymujemy przez **dual-write** + mapowanie w `05_SOURCES_AUDIT_MAP.md`.

## Source of truth (conflict order)

1. `DRD/consultify/docs/UI_UX/*` (AUTHOR_CANON)
2. `DRD/UI_UX_SOURCE_OF_TRUTH.md` (global UI/UX invariants + PASS/BLOCKED + toast protocol)
3. `DRD/consultify/docs/ui-standards/*` (patterns / standards)
4. Kontrakty modułowe: `DRD/consultify/docs/modules/<module>/*`
5. Raporty, work-packety, screeny (history)

## Decision workflow

Zmiany UI/UX:

1. Dopisz raw input do `99_RAW_INPUT.md`.
2. Zapisz normatywnie w pliku docelowym (np. `01_*`, `35_*`, `42_*`).
3. Dodaj wpis do `04_DECISION_LOG.md`.
4. Dodaj kryteria i evidence w `63_*` / `64_*`.

## Open questions (max 3)

1. Które pliki z “Proponowanego układu” w `README.md` tworzymy od razu jako pełny scaffold, a które “na żądanie”?
2. Czy `UI_UX_SOURCE_OF_TRUTH.md` ma zostać “wciągnięty” do AUTHOR_CANON 1:1, czy tylko mapowany przez linki i selektywne normy?
3. Jaki jest kanoniczny zestaw screenshotów referencyjnych dla shell + 3 kluczowych modułów (do `90_REFERENCE_SCREENS.md`)?

