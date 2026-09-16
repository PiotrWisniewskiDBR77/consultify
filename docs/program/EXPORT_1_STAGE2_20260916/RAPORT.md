# EXPORT-1 — etap 2 (Wpisy 125, 131, DEC-543)

## Wynik

Eksport prezentacji jest ostrzeżeniem jakościowym, a nie bramką. Wszystkie cztery trasy eksportu wywołują przegląd, ale niezależnie od wyniku przechodzą do renderera. Wynik przeglądu jest dostępny w nagłówkach odpowiedzi i w `warnings[]` zwracanym przez klienta frontendu.

Pakiet bazuje na wspólnej linii obu okien `70d366f158` (Wpis 146) i zawiera poprawkę EXPORT-1 1b z Wpisu 144. Nie zmienia plików toru A.

## Kontrakt DEC-543

- `enforceQualityGateForExport` zwraca status 200 i `success: true` również wtedy, gdy przegląd ma ustalenia;
- payload zachowuje `result`, `scorecard` i `warnings[]`;
- odpowiedź plikowa przenosi `X-Presentation-Quality-Result`, `X-Presentation-Quality-Warning-Count` i zakodowane `X-Presentation-Quality-Warnings`;
- `Access-Control-Expose-Headers` udostępnia te trzy nagłówki klientowi przeglądarkowemu;
- dotychczasowy parametr override pozostaje czytany dla kompatybilności, ale nie decyduje już o przejściu eksportu;
- kontrakt regresyjny nie oczekuje już `422 QUALITY_GATE_BLOCKED`.

## Deck Builder

- nagłówek ma przycisk `Export PPTX` obok `Present` (U-49);
- przycisk korzysta z produkcyjnej trasy eksportu i pokazuje panel Review, gdy pobrany plik ma ostrzeżenia;
- trasa Deck Buildera generuje PPTX przez `BoardDeckExportService.exportPresentationDeck`, czyli rodzinę ośmiu zaakceptowanych layoutów EXPORT-1;
- `Fix with AI` przekazuje do regeneracji slajdu dokładną, ludzką treść uwagi z panelu Review jako `instruction`.

## Dowód zachowania

RealPG działał na lokalnie odtworzonym dumpie z 11.09. Utrwalony deck `ateliertoys-demo-session-1bd9863714-mtx5ce5c--deck--forward-board-readout` (`Atelier Forward — 2015 Board Readout`) miał 9 ustaleń jakościowych. Nowy kontrakt zwrócił `status=200`, `success=true` i 9 ostrzeżeń.

Artefakt `dowody/deck-builder-export.pptx` został wygenerowany bezpośrednio przez adapter Deck Buildera po końcowym rebase. `slides_test.py` nie wykrył przepełnień. Render trzech slajdów i montaż `dowody/deck-builder-montage.png` potwierdzają użycie zaakceptowanej rodziny: okładka, slajd treści i slajd decyzji.

## Walidacja

- testy skupione: **5 plików / 31 PASS**;
- RealPG: **1 plik / 1 PASS**;
- Playwright Chromium: **2 / 2 PASS**, w tym pobranie pliku z ostrzeżeniem odczytanym z nagłówka;
- backend TypeScript: **RC=0**;
- pełny root TypeScript: baza `70d366f158` **169 / RC=2**, kandydat **169 / RC=2**; logi bajtowo identyczne, SHA-256 `4a99c5977f42948a26c86b9a24e67c315d075115bf11ad45cb6a28ba198907b9`, delta 0;
- `slides_test.py`: **PASS**, 0 przepełnień;
- integralność pakietu OOXML: **PASS**, 3 slajdy, 0 ustaleń;
- geometria: **PASS**, 3 slajdy 16:9, 0 ustaleń i 0 ostrzeżeń;
- `git diff --check`: **PASS**.

Szczegółowy receipt znajduje się w `dowody/verification.txt`.
