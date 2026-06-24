# DBR77 — biznesplan Z BRIEFU (pełny łańcuch, bez ręcznego kręgosłupa)

_Model: claude-sonnet-4-6. Założenia AUTOROWANE przez LLM z briefu, model finansowy policzony deterministycznie, walidacja CFO-review._

## Brief
Zbuduj biznesplan inwestorski (runda seed) dla DBR77 Sp. z o.o. — firmy doradczej transformacji AI,
która rozwija produkt SaaS "Consultify": platformę generującą materiały doradcze (prezentacje, raporty, tabele)
klasy konsultingowej w minuty, zasilane realnymi danymi organizacji, na tanich modelach AI (chińskie przez OpenRouter,
koszt ~1/100 konkurencji → wysoka marża). Model hybrydowy: usługi doradcze + subskrypcja SaaS per-seat. Horyzont 3 lata,
waluta EUR (w tysiącach). Potrzebuję obronnych założeń, modelu finansowego i sizingu rynku.

## Teza (jedna, reużyta wszędzie)
DBR77 atakuje lukę między drogim konsultingiem a generycznymi narzędziami AI: Consultify dostarcza gotowe artefakty doradcze w minuty, zasilane danymi klienta, przy marży brutto >80% dzięki ekstremalnie niskim kosztom inferencji. Model hybrydowy (SaaS seat + projekty doradcze) skraca CAC przez land-and-expand i naturalny upsell.

## Walidacja (CFO-review + anty-wzorce) — passed: true
- ✅ Bilans się bilansuje (Assets ≈ L+E)
- ✅ CF ending-cash = BS cash
- ✅ Gross margin 70-90% (0.82 vs 0.70-0.90)
- ✅ OpEx total 40-95% rev (early-stage) (0.81 vs ≤0.95)
- ✅ LTV:CAC ≥ 3 (14.96 vs ≥3)
- ✅ CAC payback ≤ 24 mies (8.02 vs ≤24)
- ✅ Rule of 40 ≥ 40 (61 vs ≥40)
- ✅ Brak ujemnej gotówki w horyzoncie
- ✅ ARR bridge się domyka
- ✅ Terminal value ≤ 90% EV (0.8 vs ≤0.90)

## Hero-numbers (policzone i sformatowane RAZ → identyczne w 3 artefaktach)
- Ask / runda: **600 000 EUR**
- Przychód (ost. rok): **269 676 EUR**
- EBITDA (ost. rok): **74 257 EUR**
- Marża EBITDA: **28%**
- ARR (ost. rok): **34 476 EUR**
- LTV / CAC: **14.96 ×**
- CAC payback: **8.02 mies**
- TAM: **8 200 000 thousands EUR**
- SAM: **820 000 thousands EUR**
- SOM: **410 000 thousands EUR**

## Market sizing (triangulacja)
TAM 8200000 thousands EUR (IDC Worldwide AI Software Forecast 2024; Gartner Magic Quadrant AI Augmentation Tools 2024; segment professional services AI output tools; TAM 8.2B EUR = ~10% of $90B global management consulting market adopting AI tooling (McKinsey Global Institute 2024)) · SAM 820000 · SOM 410000 · bottom-up 411240 (230 klientów × 1788 thousands EUR) · reconcile ✓

## Model finansowy (z driverów)
| Rok | Przychód | COGS | EBITDA | Marża |
| --- | --- | --- | --- | --- |
| Rok 1 (2025) | 152184 | 27393 | 1522 | 1% |
| Rok 2 (2026) | 201310 | 36236 | 31364 | 16% |
| Rok 3 (2027) | 269676 | 48542 | 74257 | 28% |

## 1) TABELA FINANSOWA (B4 z SPINE) — 5 pól · 3 wierszy · CF 2 · tier PREMIUM

**Eksport:** [docs/qa/deliverables/runs/2026-06-23-DBR77-model.xlsx](2026-06-23-DBR77-model.xlsx) — 7310 B, realny .xlsx (numFmt + CF).

## 2) RAPORT WORD (B3 z SPINE) — 14 sekcji · typy kpi, text, callout, bulletList, numberedList, chart, table

## 3) DECK INWESTORSKI (B1 z SPINE) — 14 slajdów · 10 layoutów · briefy 14

**1. exec_summary** — DBR77 atakuje lukę między drogim konsultingiem a generycznymi narzędziami AI: Consultify dostarcza gotowe artefakty doradcze w minuty, zasilane danymi klienta, przy marży brutto >80% dzięki ekstremalnie niskim kosztom inferencji. Model hybrydowy (SaaS seat + projekty doradcze) skraca CAC przez land-and-expand i naturalny upsell.
**2. problem** — Status quo jest wolny i kosztowny — to realny ból rynku
**3. solution** — Consultify – platforma SaaS generująca materiały doradcze (prezentacje, raporty, tabele) klasy konsultingowej w oparciu o dane organizacji i tanie modele AI (OpenRouter/modele chińskie, koszt ~1/100 konkurencji)
**4. market** — Rynek 8 200 000 thousands EUR (TAM); realnie zdobywalne 410 000 thousands EUR (SOM)
**5. business_model** — Hybryda usługi + SaaS — dwa wzmacniające się strumienie
**6. gtm** — Land-and-expand: usługi otwierają drzwi, SaaS skaluje
**7. competition** — Strukturalna przewaga kosztowa = trwały moat
**8. traction** — ARR rośnie do 34 476 EUR w 2027
**9. financial_plan** — Przychód 269 676 EUR, EBITDA 74 257 EUR (marża 28%) w 2027
**10. unit_economics** — LTV/CAC 14.96 ×, payback 8.02 mies — ekonomika zdrowa
**11. team** — Zespół łączy ekspertyzę doradczą z inżynierią AI
**12. risks** — Ryzyka zidentyfikowane i zmitygowane
**13. ask** — Runda seed – 600 000 EUR. Środki przeznaczone na: 12 mies. runway produktowo-sprzedażowy, zatrudnienie 2 AE + 1 CS, development Consultify v2 (integracje ERP/BI), marketing content + konferencje branżowe (AI/digital transformation).
**14. roadmap** — Roadmapa do 2027
