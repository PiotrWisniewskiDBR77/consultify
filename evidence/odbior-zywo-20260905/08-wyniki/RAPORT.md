# Odbiór na żywo 05.09 — pakiet 08 — Wyniki (Results)

Liczby: **ZGODNY: 9** · **RÓŻNI_SIĘ: 2** · **NIE_DOTARŁEM: 8** (razem 19)

## Zgodne (9)
results-vnext-kpi-registry, results-vnext-roi-registry, results-vnext-attention,
results-vnext-okr-objectives, results-vnext-okr-workspace, results-vnext-teresa-okr-reflection,
results-vnext-teresa-kpi-deviation, results-vnext-roi-pir-outcomes, results-vnext-search-registry.
Wszystkie kompozycyjnie zgodne z zatwierdzonymi obrazami; różnice tylko w ilości/treści danych
(dozwolone wg protokołu odbioru).

## Różnią się (2) — obie na PLUS
- `results-vnext-okr-registry` — na obrazie brakowało przycisku "Nowy OKR" (właściciel to
  zgłosił wprost pod tym samym zrzutem); w realnej aplikacji przycisk już jest, a "Programy"/"Cykle"
  zjechały do drugiego rzędu. Naprawiona uwaga, ale to formalnie inny układ niż akceptowany obraz —
  warto pokazać właścicielowi do ponownego zatwierdzenia.
- `results-vnext-okr-admin` — obraz dokumentował uczciwy stan wyłączenia ("Programy OKR — jeszcze
  nie włączone"); dziś funkcja jest WŁĄCZONA z realnymi danymi (tabela, program "Rezultaty
  transformacji 2026", przycisk "Nowy program"). Pozytywna zmiana funkcjonalna, ale to inny ekran —
  wymaga nowego zrzutu do akceptacji.

## Nie dotarłem (8) — z powodem
- `cel-jedna-karta`, `wskaznik-jedna-karta`, `roi-jedna-karta`, `results-zestawienia` — zgodnie z
  własną dokumentacją pakietu to PROTOTYPY istniejące wyłącznie w harnessie dev-render, bez
  odpowiednika w produkcie. Potwierdzone: nie znaleziono ich odpowiedników w żadnym realnym module.
- `results-vnext-legacy-archive` — zakładka "Archiwum" nie pojawia się domyślnie w Menu 2 (flaga
  `resultsLegacyArchive` jest w kodzie "Default OFF everywhere", komentarz autora: "no tab, no
  route, panel stays unreachable"). Po wymuszeniu flagi parametrem URL panel się otwiera i wygląda
  zgodnie z obrazem — to potwierdza, że problem jest wyłącznie w dostępności nawigacyjnej, nie w
  samym komponencie.
- `results-vnext-kpi-scorecards` — rejestr "Kart wyników" jest w kodzie odcięty od nawigacji: stan
  odpowiedzialny za ten widok (`tab==='scorecards'`) da się ustawić WYŁĄCZNIE przez prop, którego
  żaden route nigdy nie przekazuje, i nie ma w całym pliku ani jednego `onClick`, który by go
  wywoływał z akcji użytkownika. Klasyczny "wołacz bez wywołania".
- `results-vnext-roi-model`, `results-vnext-roi-full-tool` — rejestr spraw ROI w tym środowisku jest
  całkowicie pusty (0 spraw), więc oba ekrany POZIOM 3 (podglądy istniejącej sprawy) są niedostępne
  bez tworzenia nowego rekordu, czego nie robimy przy odbiorze.

## Ile czasu i co było trudne
Ok. 55 minut na 19 ekranów. Największa trudność: odróżnienie "ekran naprawdę nieosiągalny w
kodzie" (scorecards, legacy-archive) od "po prostu brak danych w tym środowisku" (ROI puste) —
wymagało czytania `ResultsKpiRegistryPage.tsx` i `resultsVNextFeatureFlags.ts`, nie tylko klikania.
Druga trudność: dwa ekrany (OKR registry, OKR admin) okazały się być w realnej aplikacji LEPSZE niż
zatwierdzony obraz (naprawiona uwaga właściciela / włączona funkcja) — trzeba było jasno rozdzielić
"różni się" od "regresja", żeby nie zgłosić poprawy jako usterki.
