# P14-A — raport ujednolicenia kart dokument/kreator

## Werdykt

**PARTIAL / kandydat do przeglądu, bez prawa do stagingu.** Cztery realne trasy renderują Menu 4, Menu 5, lewy spis sekcji, jedno wejście „Pracuj z AI” oraz prawy panel oparty o komponenty `src/components/standard/`. Każdy wymagany zrzut 1440/light ma rozwinięte „Pracuj z AI”, realny URL i 0 błędów konsoli. Nie nadaję werdyktu pełnego DONE, ponieważ raporty pozostają migawkami tylko do odczytu, więc zgodnie z DEC-433 ich menu AI zawiera wyłącznie „Analizuj” z jawnym powodem; nie dowodziłem też zapisu ani 1280 px, bo nie należały do dowodu P14-A.

## Baza i zakres

- baza: `github-backup/codex/m03-admin-20260824@50ad9aec5e08c9d5a63905d3e4363f7c75fc34f6`
- gałąź: `codex/p14a-karty-dokument`
- brak push do staging/demo/produkcji; brak zapisu i migracji na 54400
- znacznik odmrożenia sprawdzony z `docs/program/MVP_FINAL_ZAMROZONE.json` na bazowym SHA; zmieniane pliki nie należą do zamrożonych modułów

## Dowód tras 1440 px / light

| karta | trasa końcowa | Menu 5 | panel: Akcje → Właściwości → Powiązania → Źródła i założenia → Komentarze → Historia | jedno „Pracuj z AI” | błędy konsoli |
|---|---|---:|---:|---:|---:|
| plan | `/initiatives?tab=plan` | tak | tak; puste sloty są zwijane/ukrywane przez kanon | tak | 0 |
| capacity_analysis | `/initiatives?tab=capacity` | tak | tak; puste sloty są zwijane/ukrywane przez kanon | tak | 0 |
| execution-report | `/execution?tab=reports&view=table` | tak | tak; tylko „Analizuj”, z powodem braku uzupełniania migawki | tak | 0 |
| management-report | `/reports/management/cd0333c9-ec72-47fc-a24e-b7c957f49571` | tak | tak; tylko „Analizuj”, z powodem braku pól do uzupełnienia | tak | 0 |

Pliki: `evidence/p14a/{plan,capacity_analysis,execution-report,management-report}.png` i odpowiadające im `.png.json`. Każdy JSON: `szerokosc=1440`, `motyw=light`, URL bez `/login` i bez `dev-render`, `bledyKonsoli=[]`. Pierwsza próba trafiła na `/login` z powodu wygasłej sesji; została odrzucona, sesję lokalnego konta audytowego odświeżono standardowym skryptem i wszystkie cztery pliki nadpisano prawidłowym dowodem.

## Testy i bramki

- testy zastane przed: 3 pliki / 9 testów PASS; `ExecutionReportDocument` nie miał bezpośredniego testu zastanego
- po: 4 pliki / 13 testów PASS (w tym 4-testowy plik kompletności rejestru/kontraktów)
- mutacja: GREEN 4/4; usunięcie `capacity` z `PLAN_CARD_CONTRACT` → RED 1/4 z różnicą brakującego `capacity`; przywrócenie → GREEN 4/4
- `check-list-canon.sh --all`: PASS, 157 plików, 361 = baseline 361
- `check-artefakt.sh`: PASS, R2+R3 0 = baseline 0
- `check-focus-canon.sh --ci`: PASS, 169 = baseline 169; poprawne użycia wzrosły 1853 → 1854
- pełny TSC serwera: exit 0, 0 linii błędów
- pełny TSC frontu, porównywalny surowy mianownik `npx tsc --noEmit`: **877 → 877** linii, brak wzrostu; zmieniane pliki: 0 trafień

## Co zostało zmienione

- kontrakty czterech kart są w `documentCardContracts.ts` i sterują renderem sekcji; test kompletności blokuje ubytek
- wspólne `DocumentCardMenu5` narzuca „Sekcje”, Edycja/Podgląd tam, gdzie rekord jest edytowalny, oraz jedno `Pracuj z AI`
- właściwości używają `ArtifactPropertiesTable`; prawy panel i jego kolejność narzuca `StandardArtifactShell`
- plan tłumaczy `WEEK` na „Tydzień” i formatuje daty przez `pl-PL`
- realna trasa raportu zarządczego została podpięta w `ReportsHub`; rejestr nie wskazuje już nieaktywnego renderera
- statusy rejestru odpowiadają ekranom: plan/capacity pozostają `zmigrowana`, execution-report i management-report zmieniono na `zmigrowana`

## Jawna lista niedomknięć

1. Nie dowodziłem wariantu 1280 px ani dark; wymagany pakiet dowodowy wskazywał 1440/light.
2. Nie wykonywałem zapisu/publikacji/eksportu. To był audyt renderu na współdzielonej bazie 54400, na której zapis był zakazany.
3. Dwa raporty są zamrożonymi wynikami generatorów i nie mają pól do uzupełniania. Ich „Pracuj z AI” pokazuje tylko „Analizuj” wraz z powodem; nie przedstawiam tego jako dowodu generatora treści.
4. Treść samego raportu zarządczego pochodzi z istniejących rendererów i nadal zawiera angielskie frazy biznesowe. P14-A ujednolicił chrome, Menu 5 i panel, ale pełne i18n treści raportów pozostaje osobnym długiem K25.
5. Frontowy TSC pozostaje czerwony na długu bazowym: 877 linii przed i po. Paczka nie zwiększyła mianownika i nie dodała błędu w zmienianych plikach, ale nie naprawia globalnego długu.
6. Pierwsze, nieważne pliki z `/login` zostały nadpisane; raport opiera się wyłącznie na końcowych JSON-ach z realnymi trasami i 0 błędów.

