# K2 v3 — pełny manifest delty i importerów

## Werdykt

Pełna delta względem exact base `f2628a0d36af85d97bcbe67b820d728c7c2f2f28` obejmuje **180 plików TSX** w dozwolonych ścieżkach produktu. Statyczne rozwiązanie importów znalazło **93 bezpośrednie testy-importery**, które pokrywają 83/180 zmienionych plików; dla 97/180 nie znaleziono bezpośredniego importera. Do przebiegu dodano własny test kontraktowy K2 oraz dwa zastane source-contract, razem **96 plików testowych**.

Finalny przebieg per plik z `--retry=0`: **93/96 plików RC 0**, **639 GREEN / 3 RED**. Wszystkie trzy RED mają byte-identyczny test oraz byte-identyczną bezpośrednią przyczynę na bazie i kandydacie. K2 nie przedstawia ich jako zielonych.

## Artefakty mianownika

- `evidence/k2-superadmin-i18n-20260915/importer-full-map-v3.tsv` — dokładnie 180 wierszy źródłowych, liczba i lista importerów albo `NONE_FOUND`.
- `evidence/k2-superadmin-i18n-20260915/importer-full-files-v3.txt` — dokładnie 96 uruchomionych plików.
- `evidence/k2-superadmin-i18n-20260915/importer-full-results-v3.tsv` — wynik per plik, liczby testów, czas, blob bazy, blob kandydata i relacja.
- `evidence/k2-superadmin-i18n-20260915/importer-full-failures-v3.log` — pełny stdout/stderr wyłącznie trzech czerwonych przebiegów.

Detektor zebrał pełne `git diff --name-only f2628a0d36..HEAD` w `src/views/superadmin/**` i `src/components/SuperAdmin/**`, następnie rozwiązał statyczne importy względne, `@/` i `src/` z rozszerzeniami `.ts/.tsx` oraz `index.ts/index.tsx` we wszystkich plikach `*.test.*` i `*.spec.*` pod `src/` i `tests/`. Każdy znaleziony importer uruchomiono osobnym poleceniem:

```sh
npx vitest run <dokładny-plik> --retry=0 --reporter=verbose
```

Każde polecenie miało limit 120 sekund. Żaden plik nie osiągnął timeoutu.

## Exact-base comparison

Spośród 96 testów: 94 mają identyczny blob na bazie i kandydacie, jeden test K2 jest nowy, a `LLMManagementView.honesty.test.tsx` został świadomie zaktualizowany w trzech identycznych miejscach z polskiego fallbacku `/własne ID modelu/i` na obowiązujący DEC-461 EN-first `/own model ID/i`. Nie usunięto żadnego przypadku ani asercji; plik kończy 6/6 GREEN. Polski tekst pozostaje w zasobie PL i jest sprawdzany przez kontrakt locale.

Trzy zastane RED:

| Test i wynik | Bezpośrednia przyczyna | Exact base blob | Kandydat blob |
|---|---|---|---|
| `PartnerEconomicsApprovedOut.ui.test.tsx`, 1/2 | brak `Router` dla niezmienionego `PartnerSettlementsView.tsx` | test `29e2b48fcdda5cb197d52f13a2c401af90b40c67`; źródło `cd8302bac3a359e5ba2bf7c7fbfb7e76a0cd22be` | identyczne |
| `resource-management-components.test.tsx`, 0/1 | import nieistniejącego `src/views/admin/BudgetDashboard.tsx` | test `b121ac1781fa0a5391b16a17ae1af44bc746dff8`; źródło `ABSENT` | identyczne |
| `settings-admin-superadmin.p31-33.test.ts`, 78/79 | asercja szuka jednoliniowego `c('platform-operations'`, a niezmienione źródło ma wywołanie wieloliniowe | test `adb180d1e726ec3f8a53daa8f8c17c54819cb380`; `adminNavigation.ts` `fdaced1f365acc0289f9df18188ab1d0de56e590` | identyczne |

Poprzedni manifest v2 był próbką siedmiu plików i pozostaje wyłącznie śladem historycznym. Ten dokument oraz artefakty `importer-full-*` zastępują go jako mianownik odbiorowy v3.
