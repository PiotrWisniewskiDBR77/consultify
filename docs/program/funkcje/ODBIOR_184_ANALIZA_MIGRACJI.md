---
doc_id: funkcje-odbior-184
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 184 — plan migracji legacy→kanon · ODRZUCONY DO POPRAWY (B) · FIX-184 wydany

Gałąź `codex/day184-analiza-migracji-20260830` (2 commity). Diff czysty (2 pliki .md).
Pomiary wykonawcy REALNE — audytor odtworzył każdą liczbę co do jedności (24 trasy,
35/68/18 mutacji, 322 czytelników, rozliczenie „22" wzorowe). Dobre i zostaje:
odrzucenie surowego SQL (inwarianta 6 tabel — plan poprawił nawet moją „5"),
szeregowanie per sprawa, forward-repair zamiast rollbacku, ledger cutover.

## ★★ ODKRYCIE ODBIORU — koszt D-7 może być zaniżony o rząd wielkości
**Nie istnieje żadne polecenie tworzące `execution_case`.** Jedyna geneza:
`handoffAcceptance.ts:245-251` (łańcuch: agregat initiative → pakiet handoff →
request → decide(ACCEPTED) → sprawa v1). Migracja zadania wymaga więc NAJPIERW
zbudowania domu kanonicznego per inicjatywa. Pierwszym krokiem dyżuru wykonania
MUSI być pomiar denominatora (aktywne sprawy vs distinct initiative_id w tasks)
— wynik idzie do właściciela PRZED startem wykonania.

## Poprawki FIX-184 (blokujące: 1-2)
1. Rozdział A4.0 „Budowa domu kanonicznego" (łańcuch genezy + pomiar denominatora).
2. Usunąć niepodparte `DAY161_FRESH_MIGRATION_GATE=PASS` (napisu nie ma w logach)
   albo dołożyć artefakt z realnym wyjściem bramki.
3. A5: zestaw opcji dla `POST /api/my-work/personal-tasks` (montaż BEZ bramy,
   pisze do tasks) — warianty z kosztem, nie „nie wiadomo".
4. `risks`/`alternatives`: mechanizm Z-2 (`TaskController.ts:3071` ← trasa za bramą
   → kolumny puste) + propozycja miejsca w kanonie.
5. A1/A2 do formy żądanej: atrybucja kolumna→migracja plik:linia; tabela 24 tras
   `plik:linia — co robi — za/poza bramą`.
6. Koperta: dopisać `expectedCaseVersion` (wymagane pole payloadu, executionWork.ts:129).

Bonus odbioru: pin Z31 w teście dyżuru 160 potwierdzony (`day160...test.ts:68`,
baza cx160) — PIĄTY przypadek; do sprzątnięcia zbiorczego.
