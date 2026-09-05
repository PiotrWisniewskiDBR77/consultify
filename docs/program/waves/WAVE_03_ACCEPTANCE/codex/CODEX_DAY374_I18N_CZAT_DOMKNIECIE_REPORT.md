# CODEX DAY 374 — i18n Czat, domknięcie

Data: 2026-09-05
Branch: `codex/day374-i18n-czat-domkniecie-20260905`
Marker: `8f60ab998734adcdf61a080f4e1270c3dbdffceb`
Wynik: **PARTIAL / NIE DOMKNIĘTO pełnego mianownika R3**

## R0 — granice

Przeczytałem pełną instrukcję z `github-backup/grafika/m03-20260902` przed pracą. Testy mają bronić zachowania prawdziwego resolvera i18next, a nie tekstu źródła. Polska wartość nie może być kopią EN bez uzasadnionego wyjątku. Nie rozszerzałem napraw poza rodzinę i licencję zapisu instrukcji.

Tip gałęzi instrukcji był potomkiem markera (`0 6` dla marker…HEAD po commitach dyżuru); marker był osiągalny. Porty wyłączne 6445/5585 i cały zakres 6438–6448/5578–5588 były wolne. Postgres i runtime nie były uruchamiane, ponieważ wybrano dozwolony wariant C (testy jednostkowe).

## Wynik mianownika

| Zakres | Przed | Po | Wynik |
|---|---:|---:|---|
| R2, literały klasy (b) | 43 | 0 w licencjonowanej rodzinie | GREEN |
| R3, klucze klasy (a) | 194 | 141 | **PARTIAL** |
| R4, potwierdzone defekty klasy (c) | 0 | 0 | GREEN |
| R4, martwe/poza modułem `addDriver` | 2 | 2 | bez naprawy, zgodnie z licencją |
| R5, właściwa ścieżka `canvas.aiMenu.tooLong` | brak | istnieje w PL i EN | GREEN |
| R6, identyczne `Rebaseline` w badanym pliku | 1 | 0 | GREEN |

R3 zmniejszył się z 194 do 141 wystąpień: `skan-r4.py` pokazuje 5, `skan-r5.py` 136. Pełny mianownik wejściowy jest w `evidence/i18n-czat/skan-374-r3-pelna-lista.txt`.

## Dlaczego R3 pozostaje PARTIAL

Pięciu wystąpień w `UnifiedChatPanel.tsx` nie można domknąć przez samo dopisanie liścia: w słownikach ich ścieżki nadrzędne są już stringami (`myWork.tasks.createdFromChatToast`, `chat.initiativeHandoff.createdDraft`, `myWork.initiatives.createdFromChatToast`, `aiChat.errors.messageSaveFailed`). Zmiana istniejącego kształtu/wartości słownika przekracza wąską licencję „dopisania brakującego klucza”.

Pozostałe 136 wystąpień kart również nie zostało dopisanych mechanicznie. Klucz `myWork.ideas.plantInGarden` ma dwa różne fallbacki: „Plant” i „Plant in Idea Garden”; jedna wartość słownikowa nie zachowuje obu znaczeń. To STOP merytoryczny, nie powód do zgadywania. R3 wymaga osobnego rozstrzygnięcia modelu kluczy i rozszerzonej licencji.

## Zmiany wykonane

- R2: przetłumaczono akcje Canvas, operacje oczekujące, akcje datasetu, nagłówki/aria artefaktów, Reset i masowe potwierdzenie usuwania rozmów. Workflow ledger pozostawiono po angielsku zgodnie z decyzją nadzorcy.
- R3: dodano bezkolizyjne klucze nagłówka/historii i SystemHealth; toast brzmi dokładnie: „Pomysł zapisany, otwieram Moją Pracę”.
- R4: ponownie potwierdzono 25 kandydatów: 0 defektów w rodzinie; 2 `addDriver` martwe tutaj, z konsumentami Finance poza zakresem.
- R5: przeniesiono `tooLong` z błędnej ścieżki `initiatives.suggestedChangesPanel` do `canvas.aiMenu`; zmiana netto liczby liści R5 wynosi zero.
- R6: PL `Ustal nowy punkt odniesienia`; domyślny skaner rozszerzono o `src/components/AIChat` i `src/utils/canvas`, baseline podniesiono do 451 plików / 789 ternary, maksimum pozostawiono 4.

## Dowody zachowania i mutacje

Końcowy przebieg: 5 plików testowych, 13/13 testów GREEN. Użyto prawdziwego i18next z `fallbackLng:false`; test R2 renderuje realny `CanvasArtifactBlockRenderer`, a R5 wywołuje realną granicę `requestCanvasQuickAI`.

- R2: podmiana PL `canvas.actions.createPresentation` na EN dała 2 RED; przywrócenie dało 3 GREEN.
- R3: podmiana zatwierdzonego toastu na EN dała 2 RED; przywrócenie dało 2 GREEN.
- R5: podmiana PL `canvas.aiMenu.tooLong` na EN dała 2 RED; przywrócenie dało 2 GREEN.
- R6: przywrócenie `Rebaseline/Rebaseline` zwiększyło wynik 4→5 i dało `exit 1`; polska wartość przywróciła 4 i `exit 0`.

Szerszy zestaw WorkCanvas: 27 GREEN / 11 RED; błędy obejmowały historyczne zapytanie „Markdown view”, a ToolsMenu nie odkrył testów. Nie jest to dowód pełnej regresji. Pełny `tsc` zakończył się OOM przy limicie około 4 GiB po około 194 s — typecheck pozostaje NOT_PROVEN.

## Bramki końcowe

- liście słowników: PL 35294→35385, EN 33154→33243; asymetria +91/+89 wynika z rzeczywiście dodanych kluczy i istniejących kolizji strukturalnych, więc nie deklaruję wymaganej symetrii;
- `focus-canon=0`, `list-canon=0`, `artefakt=0`;
- reachability: nadal `exit 1`, dokładnie te same 49 pre-istniejących plików; trzy testy Day374 dopisano wyłącznie do `testOnlyFiles`;
- etykiety: 451 plików, 789 ternary, 4 odziedziczone trafienia SWOT, `exit 0`;
- `skan-r4.py`: 5; `skan-r5.py`: 136.

## Commity

- `bb4cbaeb78` — pomiar mianownika R1
- `d71471cf53` — R2, literały Canvas
- `5085a40730` — bezkolizyjna część R3
- `410fe95e57` — potwierdzenie R4
- `669dd0e90f` — R5
- `ac8203a31f` — R6 i rozszerzenie bezpiecznika

`git show --stat` każdego commita sprawdzono podczas pracy; lista zmienionych ścieżek nie zawiera `server/src/**`, konfiguracji testów, workflowów, CanvasVersionHistory, CanvasAIFloatingMenu, CanvasRichEditor, Economics/panels ani macierzy MODULE_ACCEPTANCE.

## TWIERDZENIA NIEZWERYFIKOWANE

- Brak zrzutów UI PL/EN i brak dev-render; akceptacja wizualna nie jest udowodniona.
- Brak pełnego typechecku z powodu OOM.
- Brak zielonej szerokiej regresji WorkCanvas (27/38 GREEN).
- Test R3 sprawdza realny resolver, lecz nie renderuje komponentu R3; zachowanie komponentów R3 pozostaje PARTIAL.
- Nie uruchamiano PostgreSQL, runtime ani ścieżki HTTP; nie ma dowodu produkcyjnego ani integracyjnego.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

- Rozstrzygnięcie kolizji rodzic-string/liść i dwóch znaczeń `myWork.ideas.plantInGarden`, następnie domknięcie 141 wystąpień R3.
- Defekty `finance.m16.*.addDriver` w `Economics/panels/**` — poza modułem i licencją dyżuru.
- Osobny run wizualny PL/EN oraz naprawa/kwalifikacja 11 czerwonych testów szerokiej regresji.

## Deklaracja kanałów zewnętrznych

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. W praktyce baza nie została uruchomiona; zdanie o jej zawartości jest wymaganym oświadczeniem instrukcji, a nie wynikiem zapytania SQL.
