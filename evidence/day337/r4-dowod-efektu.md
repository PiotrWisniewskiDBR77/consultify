# R4 — dowód efektu zamiast samej sygnatury

Wybrano kontrakt efektu, ponieważ otwarcie kreatora konektora jest bezpośrednio obserwowalne w DOM jako widoczny dialog z tekstem `Nowy konektor danych`.

## Mutacja B przed bezpiecznikiem

Zmiana tymczasowa: `onClick: () => setShowConnectorWizard(true)` → `onClick: () => {}`.

Stary test enumeracji pozostał GREEN, a inventory i hash nie zmieniły się: 82 / `2ccdd150921460e4c625d469f7cc73bf1604a6b45f52bb62947b92a627f78db1`. Log: `/private/tmp/cx-day337-idee-enumeracja-artefakty/r4-mutation-before-green.log`.

## Nowy bezpiecznik

Pełna nazwa:

`Idea tools — complete DOM control inventory idea-table-timeline-stuck: Importuj dane opens the connector wizard`

Test otwiera menu `idea-table-bar-overflow`, wybiera `idea-table-overflow-import-data`, a następnie sprawdza widoczność dialogu i tekst `Nowy konektor danych`.

Baseline GREEN: 1 passed, 7 skipped (`r4-effect-green-valid.log`). Pierwsza próba z matcherem `toBeVisible()` była błędem przyrządu Vitest/Locator i nie jest liczona jako dowód produktu.

Ta sama MUTACJA B po bezpieczniku: RED na `expect(await dialog.isVisible()).toBe(true)`; pełna nazwa jak wyżej; 1 failed, 7 skipped (`r4-effect-mutation-red.log`).

Po przywróceniu przez `cp`: pełny pakiet 7 wykonanych PASS, 0 FAIL, 1 pending (`r4-final-green.json`). Diff produktu pusty.

## Pokrycie

Dowiedziony efekt: 12 istniejących wyzwalaczy menu + 1 kontrolka `Importuj dane` = **13 z nowego mianownika 308 (4,2%)**. Pozostałe 295 sygnatur nadal nie ma dowodu efektu w tym przyrządzie; enumeracja i hash dowodzą ich obecności, nie działania.
