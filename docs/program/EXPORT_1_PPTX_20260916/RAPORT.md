# EXPORT-1 — etap PPTX i poprawka 1b (W128)

Implementacja rozszerza istniejący `UnifiedExportService` o `exportBoardDeckPptx`. Osiem ról layoutu odpowiada zaakceptowanemu `deck-board.pptx`: `cover`, `agenda`, `section`, `content-one`, `content-two`, `table`, `chart`, `decision`.

## Kontrakt i kompatybilność

- Dotychczasowe `renderPptx` i `exportPptx` pozostają zgodne dla pozostałych żywych wołaczy usługi.
- Nowy renderer jest szczegółem formatu pod `server/src/services/export/pptx/`; publiczną granicą pozostaje `UnifiedExportService`.
- Nowy `BoardDeckExportService` jest produkcyjnym adapterem rodziny. `work-canvas` i `partnerToolkitResources` wołają go bezpośrednio, więc oba eksporty PPTX podmieniają treść w zatwierdzonym układzie zamiast utrzymywać własne layouty.
- Tabela i wykres są natywnymi, edytowalnymi obiektami OOXML.
- Deck zapisuje motyw Aptos/Aptos Display, a runy nie zawierają literalnych nazw fontów.
- Stopka łączy Consultify, nazwę klienta i poufność; okładka wskazuje Consultify · DBR77 i miejsce na logo klienta.
- Kolory `85182F` i martwy `B42318` nie występują.
- Renderer usuwa wyłącznie nadmiarowe wpisy masterów, które `pptxgenjs@4.0.1` dodaje do `[Content_Types].xml` bez odpowiadających im części. Kontrola integralności kończy się `finding_count=0`.

## Parytet wizualny slajdów 4 i 6–8

- slajd 4 ma etykietę `SO WHAT` nad kluczowym komunikatem;
- slajd 6 ma 7 wierszy, wysokości liczone z treści, zebra, pogrubioną pierwszą kolumnę oraz pogrubiony total z górną krawędzią;
- slajd 7 ma jedną serię OEE w jednym kolorze, osobną linię celu 78% i etykiety wartości;
- slajd 8 ma wypełnioną Option A, metadane `£410k · MES Line 3` oraz pas `DECISION OWNER · DUE BY · LINKED RAID` w dolnej części.

Automat `compare-board-deck.mjs` mierzy liczbę i wysokości wierszy, dwie serie wykresu, etykiety wartości, trzy pola decyzji, metadane opcji, wypełnienie rekomendowanej karty oraz brak literalnego Arial w całym XML, w tym `ppt/charts/**` i `ppt/slideMasters/**`. Pozycje X/Y tabeli, wykresu i trzech pól decyzji są normalizowane względem wymiaru slajdu i mieszczą się w tolerancji 0,05 osi względem zaakceptowanego PPTX.

Artefakt odbiorowy nie korzysta z fixture danych. `server/scripts/export1-board-deck-proof.ts` czyta `dowody/northwind-dump-20260911.json`, czyli read-only snapshot z dumpu 11.09 (SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`). Snapshot zachowuje identyfikatory organizacji, inicjatyw i KPI, sześć pomiarów OEE, cel 78%, budżety £410k/£520k oraz ryzyko MES użyte na slajdach 7–8.

## Dowód renderera bez Aptos

Maszyna dowodowa nie ma Aptos: `fc-list | rg -i Aptos` zwraca pusty wynik, a `fc-match Aptos` wskazuje `Verdana.ttf`. Zrzuty `northwind-board-deck-slide-{6,7,8}.png` są więc dowodem realnej substytucji renderera bez osadzania fontu. Substytucja nie zmienia kontraktu OOXML: motyw nadal wskazuje Aptos, a fonty są theme-driven.

## Walidacja

- testy renderera i dwóch produkcyjnych adapterów: **2 pliki / 6 PASS**;
- `parity.json`: `PASS` dla 8 slajdów, 1 layoutu OOXML, 1 mastera, 1 wykresu, 1 tabeli, cech kompozycji 6–8, zaakceptowanej palety, Aptos theme, zera literalnego Arial, co-brandingu i braku `85182F`;
- `inspect_presentation_package_integrity.py --fail-on-findings`: PASS, 8 slajdów, 1 wykres, 0 ustaleń;
- `inspect_presentation_layout_geometry.py --fail-on-findings`: PASS, 8 slajdów, 16:9, natywna tabela na slajdzie 6, 0 ustaleń;
- końcowe rozmiary i SHA-256 pliku oraz PNG są zapisane w `dowody/final-sha256.txt`.

Receipt poprawki 1b na bazie `facf323157a822453f472bee8cdfedd68938e526`:

- backend `tsc --noEmit`: **0** błędów;
- pełny root/frontend TSC na tej samej instalacji: baza **169 / RC=2** → kandydat **169 / RC=2**; logi są bajtowo identyczne, delta 0;
- testy backend: **2 pliki / 6 PASS**;
- frontend: 0 zmienionych plików;
- ESLint zmienionych plików: PASS po odfiltrowaniu zastanych ostrzeżeń;
- `diff --check`: PASS; hooki są uruchamiane przy freeze.
