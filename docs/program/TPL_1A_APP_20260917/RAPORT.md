# TPL-1a — trzy bazy systemowe w aplikacji (W185 v2)

**Wynik wykonawcy: READY.** Pakiet domyka warstwę aplikacji dla trzech zaakceptowanych baz TEMPLATE-1 obecnych na linii: DOC-BASE, DECK-BASE i SHEET-BASE. Template Library pokazuje na karcie akcje **Build / Edit · Use template · Duplicate** i prowadzi do właściwego kanonicznego runtime, zamiast gubić tożsamość rekordu indeksu.

## Zachowanie

- `Build / Edit` otwiera konkretny Document Template Architect, Deck Template Architect albo Workbook Template Builder po `canonicalTemplateId`.
- Baza systemowa pozostaje read-only: `Build / Edit` jest wyłączone z jasnym komunikatem, a `Use template` i `Duplicate` pozostają dostępne.
- Kopia organizacji ma aktywne `Build / Edit`.
- `Duplicate` nie kieruje już arkusza do Report Buildera; zachowuje runtime dokumentu, decka i arkusza.
- Te same trzy akcje są dostępne w galerii, menu wiersza i prawym panelu karty. Etykiety są jawne w EN i PL.
- Osierocone i wycofane wpisy zachowują dotychczasowe blokady użycia.

## Dowód wizualny

- `evidence/template-library-card-actions-light.png` — realny `TemplatesTabContent`/`TemplatesGalleryView`, karta organizacji, widoczne Build / Edit · Use template · Duplicate.
- `evidence/template-library-system-readonly-dark.png` — realna karta systemowa w dark mode; Build / Edit jest wyłączone, Use i Duplicate aktywne.

Oba zrzuty powstały w istniejącym dev-render `materialy-template-library-slice`, po pełnym załadowaniu realnych komponentów i i18n. Nie użyto osobnej makiety HTML.

## Bramka W185

- własne jednorazowe stanowisko: `/Users/piotrwisniewski/Developer/codex-lock-ci/b-tpl1a-v2-w185-20260917`, czyste `npm ci --ignore-scripts` z `package-lock.json`;
- `npm ls @types/node`: **22.19.3**;
- frontend TSC, to samo stanowisko i polecenie: linia **152 / RC=2**, kandydat **152 / RC=2**, diff diagnostyk pusty;
- server TSC z lock-ci: **0 / RC=0**;
- testy końcowe: **4 pliki / 46 testów PASS**;
- mutacja: zdjęcie `disabled` z Build / Edit na wzorcu systemowym daje **1 failed / 1 passed, RC=1**; po przywróceniu **2/2 PASS**;
- ESLint delty: **0 błędów / 12 zastanych ostrzeżeń, RC=0**;
- `git diff --check`: PASS.

## Zakres

Nie zmieniono migracji TEMPLATE-1, danych, serwera, plików toru A ani ustawień wdrożenia. Pakiet korzysta z zaakceptowanych baz i kanonicznego adaptera już obecnych na linii `3960d78fec`.
