/**
 * USPOJNIENIE C1/C2 — współdzielone fragmenty promptu CARD_CONTENT_FORMULA §A3.
 *
 * SSOT: docs/standards/CARD_CONTENT_FORMULA.md §A3.
 *
 * Audyt 2026-06-26 wykazał, że §A3 trafiło tylko do generatorów PEŁNYCH KART
 * (assessment + initiativeGenerationService), a generatory LEKKICH KANDYDATÓW
 * (ToolInitiativeService, proposeEngineService) — których schemat to tytuł +
 * opis (+ kategoria/priorytet) — nie miały żadnej doktryny jakości.
 *
 * Wstrzykiwanie pełnego §A3 (KPI baseline→target, RAID, milestones) do promptu
 * zwracającego 5-polowy JSON byłoby niespójne ze schematem i myliło model.
 * Dlatego LITE = podzbiór §A3 dotyczący WYŁĄCZNIE pól, które te generatory
 * faktycznie produkują: jakość action-title, ugruntowany opis, format hipotezy.
 */
export const CARD_CONTENT_FORMULA_A3_LITE = `
CARD_CONTENT_FORMULA §A3 (zakres dla kandydatów inicjatyw):
- Tytuł = action-title ≤14 słów, opisuje KONKRETNĄ zmianę z miarą, nie ogólnik.
  ŹLE: "Poprawa procesu". DOBRZE: "Skrócenie czasu obsługi zgłoszeń o 30% do Q3".
- Opis: zwięzły, ugruntowany w przyczynie ŹRÓDŁOWEJ (nie objaw), wskazuje mierzalny
  efekt. Jeśli to możliwe, ujmij hipotezę w formie "Jeśli [działanie] to [wynik
  mierzalny] bo [przesłanka]".
- Każdy kandydat = realny wysiłek zmiany (projekt/program), nie aspiracja.
- Zachowaj język źródła (PL pozostaje PL); akronimy §A5 (KPI, ROI, RAID, MECE) bez tłumaczenia.
`;

/**
 * Pełny §A3 — dla generatorów PEŁNYCH KART (KPI/RAID/scope/milestones/sizing).
 * Trzymany tu jako SSOT; assessment posiada lokalną kopię z powodów historycznych.
 */
export const CARD_CONTENT_FORMULA_A3_FULL = `
CARD_CONTENT_FORMULA §A3 — Każda wygenerowana inicjatywa musi spełniać:
- Tytuł: action-title ≤14 słów, konkretna zmiana (nie "Poprawa X" lecz "Zwiększenie X o Y% do Z")
- Problem (problem_statement): 120–250 słów, przyczyny ŹRÓDŁOWE, ugruntowane w danych
- Hipoteza: format "Jeśli [działanie] to [wynik mierzalny] bo [przesłanka]"
- Streszczenie (summary): 40–90 słów, czym jest + jaki efekt
- KPI: ≥2 (≥1 primary) — każdy z baseline→target + kierunek + jednostka; brak baseline → "do ustalenia" + powód
- Scope-in: min 3 konkretnych elementów
- Scope-out: min 3 pozycji MECE (co NIE jest objęte, odwołania do innych inicjatyw)
- Rezultaty (deliverables): min 4 konkretnych, rzeczownikowych
- Kryteria sukcesu (success_criteria): min 4, mierzalne/obserwowalne
- Kryteria zatrzymania (kill_criteria): min 2, konkretny warunek stop
- Kamienie milowe (milestones): min 3, fazowane 0–3/3–6/6–12 mies.
- RAID: ≥2 RISK + ≥1 ASSUMPTION + ≥1 DEPENDENCY; każdy z probability+impact+mitigation_plan
- Sizing/ROI: rząd wielkości + ROI + jawne założenia (kwota/%/dni + logika)
- Właściciel (owner): przypisany owner_business_id lub rola
- Język: WYŁĄCZNIE polski (poza akronimami §A5: KPI, RAID, RACI, ROI, MECE, itp.)
`;
