---
doc_id: funkcje-odbior-195
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 195 — dokument pokazywalny · NIE SCALAĆ (FIX-195/Opus wydany)

Oceny: mechanizm **B** · realna ścieżka **D** · harness **D** · uczciwość **A−**.
Mutacje F1/granulacji odtworzone w obie strony. Licencja: 1 formalne przekroczenie
(addytywny test — nieszkodliwe).

## ★★ Sedno: gałąź POGARSZA realną ścieżkę (zmierzono izolacją 1 zmiennej)
Nowy prompt („4-6 paragraphs") → model zwraca GOŁĄ TABLICĘ → `safeParseJson`
odrzuca (isRecord) → `llm_prose_fallback` → ZERO prozy modelu (3/3 przebiegi).
Stary prompt → `{"blocks":[…]}` → proza wchodzi. Naprawa jednolinijkowa
(akceptacja tablicy + wrap) — sprawdzona przez odbiór: po niej 1 wywołanie,
8 granularnych bloków, eksport działa.

## Harness R4 — konstrukcyjnie martwy
`tests/setup.ts:895` podmienia global.fetch na atrapę → ŻADEN test vitest nie
wykona realnego wywołania (dlatego dzień 190 używał SKRYPTU tsx). Plus: brak
`llmConfigService.initialize()` (dostawca=openai), mutacja-tautologia (Z32),
PASS bez klucza zamiast skip. F3 niedomknięte.

## Pozostałe zmierzone
- F1-resztka: token „plan" (polski homograf w obviousEnglish) amber-uje W PEŁNI
  ugruntowane polskie akapity; test day190 OSŁABIONY przemilczanie (fixture bez
  „Plan" przy starej nazwie testu).
- Straż N-9 zgubiona w gałęzi podziału (tabela GFM może dostać znacznik).
- `sourceRefs=0` → 100% bloków amber. Callout: brak Markdown i znacznika.
- Okładka 2/24 etykiet (reszta = luka nazewnicza, niezgłoszona).
- 4 czerwone parity DOCX (renderer zmienił output; gałąź list gubi
  pageBreakBefore/docxStyleId profilu DRD).
- DEC-317 liczy WYWOŁANIA funkcji; 1 wywołanie = do 5 żądań HTTP (circuit breaker)
  — do świadomości przy budżetach.
- Plik wydobyty przez odbiór: 439 słów, QA `403 qa_blocking` (brak Executive
  Summary/sekcji decyzyjnej dla board_report; gęstość 52<100), proza = parafraza
  4 zdań źródła bez liczb/terminów/właścicieli/pytania decyzyjnego.
  **WŁAŚCICIELOWI NIE POKAZYWAĆ.**

## FIX-195 (Opus): (1) parser-wrap tablicy; (2) probe jako skrypt tsx z initialize
+ realną mutacją granicy + uczciwym skip; (3) parity: naprawić zgubione
pageBreakBefore/docxStyleId w gałęzi list i rozstrzygnąć snapshoty; (4) straż N-9
w gałęzi podziału; (5) polskie homografy (plan/total/impact/owner/timing — wg
tabeli 190) poza regexem flagującym dla pl + przywrócony fixture „Plan" w teście
day190 z asercją nowego zachowania; (6) callout: markdownRuns.
## Decyzja właściciela: granulacja vs próg gęstości QA (pytanie zadane osobno).
