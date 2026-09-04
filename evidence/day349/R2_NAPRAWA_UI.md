# Dyżur 349 — R2: naprawa UI i dowody mutacyjne

## Diff produktu

- `src/components/shared/ModuleHub/FilterableTable.tsx:1565-1571`: wiersz z widocznymi akcjami dostaje `tabIndex=0`, nawet bez handlera kliknięcia.
- `src/components/standard/StandardPreview.tsx:353-368`: blok Relations jest zawsze renderowany, z `relations ?? []` i własną etykietą pustego stanu.
- `src/components/shared/TableWithPreviewLayout.tsx:223-232`: zamknięcie oddaje fokus istniejącemu otwieraczowi, a po jego zniknięciu fokusuje kontener.

Nie zmieniono żadnej asercji.

## Dowody mutacyjne

1. `FilterableTable`: po skopiowaniu poprawionej wersji do scratch cofnięto wyłącznie warunek `tabIndex`; komenda `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run --retry=0 ...filterableTable.r04-2a.test.tsx -t 'Shift.F10 na wierszu'` dała `1 failed`, `mutation_exit=1`, oczekiwano `tabindex="0"`, otrzymano `null`. Przywrócenie przez `cp .../FilterableTable.fixed.tsx .../FilterableTable.tsx` dało `1 passed`, `restored_exit=0`.
2. `StandardPreview`, przypadek bez propa: po cofnięciu renderowania obowiązkowego bloku ta sama komenda z filtrem dwóch przypadków dała czerwień `Unable to find ... No relations`, `mutation_exit=1`. Po przywróceniu przez `cp .../StandardPreview.fixed.tsx .../StandardPreview.tsx` pełny przemiar końcowy potwierdził zieleń.
3. `StandardPreview`, własna etykieta: ta sama pojedyncza mutacja jest wspólną przyczyną i w tym samym przebiegu dała drugą niezależną czerwień `Unable to find ... Brak powiązań`; po przywróceniu pełny przemiar potwierdził zieleń.
4. `TableWithPreviewLayout`: po cofnięciu fallbacku do wcześniejszego `requestAnimationFrame(() => returnFocusRef.current?.focus())` przypadek `gdy element otwierający zniknął` dał `1 failed`, `mutation_exit=1` (`mutation-focus-red.json`). Przywrócenie przez `cp .../TableWithPreviewLayout.fixed.tsx .../TableWithPreviewLayout.tsx` dało `1 passed`, `restored_exit=0` (`mutation-focus-green.json`).

Po wszystkich przywróceniach `git diff` zawiera wyłącznie trzy zamierzone poprawki produktu i ten dowód — żadnej mutacji.

## Pełny przemiar nazw

- Przed: `ui-przed.json`, SHA-256 `07860c9218818518193c93c95e4e780253e77518ce9989bc0be9809c12d577d6`, `62/58/4`.
- Po: `ui-po.json`, SHA-256 `cb8854a335a989b675c7d7cb9f2e4a14671c2e16791ca3d5b81357f8f4f0366b`, `62/62/0`.
- `przed-nazwy.txt` i `po-nazwy.txt` mają identyczny SHA-256 `7395e7c4ffcd7f2d84cbafce3dd439bca5a0f5c66f2048eb04e6024c537b8e29`; `diff` ma kod `0`: żadna pełna nazwa nie zniknęła ani nie została dodana.

## Bezpieczniki kanonu

Po zmianach: `check-focus-canon.sh --ci` = `0`; `check-list-canon.sh` = `0`; `check-artefakt.sh` = `0`. Testy UI były czysto jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`); pułapki RealPG/JWT nie leżą na ich ścieżce, a maskowanie retry wyłączono przez `--retry=0`.
