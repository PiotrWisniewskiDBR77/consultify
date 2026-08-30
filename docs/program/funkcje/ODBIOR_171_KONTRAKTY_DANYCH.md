---
doc_id: funkcje-odbior-171
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 171 — kontrakty danych · SCALONO PO FIX-171

★ FIX-171 wykonany (`7f2a2d37e0`): font-mono przywrócony, pin bazy zdjęty (test
przenośny — 4/4 na obcej bazie), dowód HTTP waluty przez realny Gateway
(z poprawnym prefiksem `/api/v8/finance-v2/...` — zlecenie FIX podało błędny;
robotnik zweryfikował i poprawił). Mutacja waluty→null: 2 testy czerwone,
przywrócenie → 4/4. Scalono do linii integracyjnej.

Gałąź `codex/day171-kontrakty-danych-20260830` (2 commity nad `514c60b355`).
Odbiór: własny kontener 6080, migracje idempotentne, **3 mutacje odtworzone
niezależnie** (waluta→null, nazwa KPI→NULL, procent bez ×100 — każda czerwona,
po przywróceniu 3/3 zielone). Oceny: mechanika **A−** · dojście do ekranu **B** ·
dowody **A−**. Zero zmyślonych walut (honest-null), formatter współdzielony
nietknięty, łańcuch waluty realnie dojeżdża do 3 ekranów Finansów — w tym
prawdziwa naprawa: zakładki methods/sensitivity wcześniej NIGDY nie ładowały
`results` (`ValuationWorkspace.tsx:287-289`), więc sama zmiana DTO by nie starczyła.

## FIX-171 przed scaleniem (drobne, korekcyjne)
1. `kpiScorecardPresenters.tsx:392` — usunięta klasa `font-mono` (zmiana wyglądu
   wbrew B5, niezgłoszona) → przywrócić.
2. **Pin bazy `cx171` w teście** (`day171.data-contracts.pg.test.ts:34`) — klasa
   Z31, TRZECI raz w programie (170, 171): poza bazą o tej nazwie test rzuca
   w beforeAll i nic nie biegnie → odpiąć.
3. Pole `currency` trasy `GET /valuation/variants/:id/results` bez ŻADNEGO testu
   HTTP → dopisać test przez realny Gateway.

## Do rejestru
Tooltip `title={row.addedBy}` dodany poza literalną licencją (korzystny, zostaje —
odnotowany). Bramka „zrzut 3 ekranów Finansów" otwarta — przejmie ją pakiet
odbiorczy modułu Finanse (styk z grafiką).
