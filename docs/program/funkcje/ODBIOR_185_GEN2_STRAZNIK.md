---
doc_id: funkcje-odbior-185
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 185 — GEN-2 strażnik · SCALONO PO FIX-185 · GEN-2 zostaje PARTIAL

★ FIX-185 wykonany (`2e8bf7fe11`): test prose na kontrakcie D-8, tabele GFM nigdy
nie dostają znacznika (mutacja czerwona→zielona, 19/19 root-configiem). Scalono.

Kod R1 (B+): liczby-założenia zachowywane i oznaczane, mutacja odbioru mocniejsza
niż wykonawcy (6→3 czerwone→6), łańcuch do DOCX potwierdzony NIEZALEŻNYM renderem
odbioru (styl `AssumptionBody` + `[Assumption — needs source]`). Raport wzorowo
uczciwy (A−) — poza jednym: teza T3 „obalona" była fałszywa.

## ★★ ODKRYCIE: DRUGIE źródło „Treść usunięta" — żywy powód pustych dokumentów
`documentContentGenerator.ts:135-136,148,182,194,198` — heurystyka `obviousEnglish`
kasuje POLSKIE zdania za słowo „plan" i wstawia „Treść usunięta" nawet do NAGŁÓWKA
sekcji (pomiar odbioru przez realną granicę produkcyjną). **→ DYŻUR 190, priorytet
najwyższy w kolejce treści.**

## Plik dowodowy: ocena D — atrapa
Ręczny fixture z zaszytym `isAssumption`, omija naprawiany kod (dowód: znacznik
dyżuru NIEoznaczony, choć silnik by go oznaczył). ~50 słów vs 61 z dnia 90.
Przyczyna: sprzeczność instrukcji (Z15 zakaz LLM vs R2 wymóg LLM) — STOP wykonawcy
ZASADNY, błąd autorski nadzorcy. **Właścicielowi NIE pokazywać.**

## FIX-185 (przed scaleniem)
1. Czerwony zastany test `documentBlockProseGenerator.test.ts:148` zaktualizować
   do kontraktu D-8 (kategoria przewidziana instrukcją, zabrakło licencji).
2. N-9: tabele GFM z liczbami dostają po R1 doklejone ` _[Assumption]_` łamiące
   ostatni wiersz — wyłączyć znacznik dla bloków tabelowych + test.

## Do kolejki / decyzji
- **Dyżur 190**: drugie źródło kasowania (obviousEnglish) — z dowodem plikiem
  przez REALNĄ ścieżkę + licencją na LLM (wzór z instrukcji dnia 90).
- Errata szkieletu: Z15 znoszone automatycznie, gdy pozycja wymaga realnego LLM.
- **Decyzja właściciela**: angielski znacznik `[Assumption — needs source]`
  w polskim dokumencie zarządowym — zostawić czy przetłumaczyć?
