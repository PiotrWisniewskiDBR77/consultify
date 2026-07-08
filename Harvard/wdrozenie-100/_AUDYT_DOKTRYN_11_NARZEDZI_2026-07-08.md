# Audyt 11 dokumentów doktryny — kompletność / poprawność / kodowalność (2026-07-08)

Cel: ocenić SAME dokumenty `_TOOLS_DOKTRYNA/*.md` jako specyfikacje dla programisty (niezależnie od tego, co już zaimplementowano w silnikach) — 3 kryteria: czy dokument jest kompletny, czy poprawnie opisuje metodykę, i czy programista mógłby zakodować silnik WYŁĄCZNIE na jego podstawie.

## Tabela wyników

| Narzędzie | Kompletność | Poprawność | Kodowalność | Werdykt |
|---|---|---|---|---|
| automation-pipeline | 4/6 | 6/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| constraint-control | 4/6 | 6/6 | 3/6 | WYMAGA UZUPEŁNIEŃ |
| control-tower | 3/6 | 5/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| data-inventory | 3/6 | 5/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| decision-engine | 3/6 | 5/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| digital-value-pool | 3/6 | 5/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| integration-diagnostic | 4/6 | 6/6 | 3/6 | WYMAGA UZUPEŁNIEŃ |
| legacy-analyzer | 4/6 | 6/6 | 3/6 | WYMAGA UZUPEŁNIEŃ |
| logistics-automation | 4/6 | 5/6 | 3/6 | WYMAGA UZUPEŁNIEŃ |
| robotics-feasibility | 3/6 | 5/6 | 2/6 | WYMAGA UZUPEŁNIEŃ |
| vsm-builder | 4/6 | 6/6 | 3/6 | WYMAGA UZUPEŁNIEŃ |

**11/11 WYMAGA UZUPEŁNIEŃ.** Wzorzec jest w 100% spójny między niezależnymi recenzjami (różne wywołania, różne narzędzia) — to nie przypadek pojedynczego dokumentu, tylko systemowa cecha całego zestawu.

## Diagnoza systemowa

Wszystkie 11 dokumentów to **znakomite doktryny konsultingowe** (stąd poprawność 5-6/6 wszędzie: rodowód metodyk, terminologia, worked examples są rzetelne i spójne — VSM/TOC/DBR, DAMA-DMBOK, Gartner EIM/Control Tower/dojrzałość integracji, McKinsey TIME/6R, SDG decision quality, RPA/IDP continuum, itd.). Ale żaden z nich nie jest kompletną **specyfikacją wykonawczą** dla programisty. We wszystkich 11 powtarzają się te same 5 luk:

1. **Drabina pogłębiająca (deepening ladder) — nieobecna lub szczątkowa w każdym dokumencie.** Żaden nie zawiera logiki rozgałęzień pytań ("jeśli odpowiedź X → dopytaj Y"). To jednolita, całkowita luka we wszystkich 11.
2. **Brak wzorów agregacji / progów decyzyjnych.** Metryki, punktacje i macierze są nazwane i opisane jakościowo, ale bez konkretnych wag, skal czy progów odcięcia (np. "wysoki impact" bez liczby).
3. **Brak formalnego schematu danych.** Inputy opisane prozą, bez typów pól, enumów, kardynalności — programista musi projektować model danych sam.
4. **Reguły insightów jako przykłady, nie predykaty.** Katalogi insightów (5-9 na narzędzie) są jakościowo bogate, ale nie mają zdefiniowanych warunków wyzwalania (trigger conditions z progami).
5. **Brak formalnego schematu wyjścia/konkluzji.** Worked examples pokazują kształt wyniku narracyjnie, ale bez zdefiniowanej struktury pól.

Kilka dokumentów ma dodatkowo pojedyncze wewnętrzne niespójności (np. constraint-control: `validation` hardkodowane zamiast realnej walidacji w silniku — ale to już dotyczy kodu, nie doktryny; robotics-feasibility: sprzeczna definicja ROI między dwoma blokami wzorów; vsm-builder: 2 z 8 insightów wymagają danych, których sekcja inputów nie zbiera — np. szeregu czasowego WIP, gdy model zbiera tylko snapshot).

## Wniosek dla programu

Dokumenty doktryny są gotowe jako **brief metodyczny i materiał promptowy dla warstwy LLM generującej insighty** (do tego są bardzo dobre). NIE są gotowe jako **deterministyczna specyfikacja inżynierska** — każdy programista budujący silnik wyłącznie z tych dokumentów musiałby wymyślić: wagi, progi, schemat danych, drzewo decyzyjne i drabinę pytań. To dokładnie zgadza się z tym, co widać w już zbudowanych silnikach (panel A "Merytoryka" konsekwentnie zgłasza "X zahardkodowane/nieoperacjonalizowane" jako braki — bo doktryna nie dawała im punktu odniesienia).

**Rekomendacja:** przed lub równolegle z dalszym fixowaniem silników w panelu, rozważyć osobną falę pracy: dopisanie warstwy algorytmicznej (wzory, progi, schemat danych, drabina pytań, reguły trigger→insight) do 11 dokumentów doktryny, tak by przyszłe audyty A ("czy silnik zgadza się z doktryną") miały jednoznaczny punkt odniesienia zamiast oceniać "czy silnik rozsądnie zgadł to, czego doktryna nie precyzuje".

---
*Audyt wykonany przez 11 równoległych, niezależnych recenzji (model opus), każda WYŁĄCZNIE na podstawie treści dokumentu doktryny, bez porównania z kodem silnika.*
