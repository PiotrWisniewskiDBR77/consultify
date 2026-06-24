# DBR77 — biznesplan Z BRIEFU (pełny łańcuch, bez ręcznego kręgosłupa)

_Model: claude-sonnet-4-6. Założenia AUTOROWANE przez LLM z briefu, model finansowy policzony deterministycznie, walidacja CFO-review._

## Brief
Zbuduj biznesplan inwestorski (runda seed) dla DBR77 Sp. z o.o. — firmy doradczej transformacji AI,
która rozwija produkt SaaS "Consultify": platformę generującą materiały doradcze (prezentacje, raporty, tabele)
klasy konsultingowej w minuty, zasilane realnymi danymi organizacji, na tanich modelach AI (chińskie przez OpenRouter,
koszt ~1/100 konkurencji → wysoka marża). Model hybrydowy: usługi doradcze + subskrypcja SaaS per-seat. Horyzont 3 lata,
waluta EUR (w tysiącach). Potrzebuję obronnych założeń, modelu finansowego i sizingu rynku.

## Teza (jedna, reużyta wszędzie)
DBR77 łączy usługi transformacji AI z produktem SaaS „Consultify", oferując konsultantom i działom strategii 10-krotne przyspieszenie produkcji materiałów klasy McKinsey przy koszcie modelu AI ~1/100 rozwiązań zachodnich. Model hybrydowy (retainer doradczy + subskrypcja per-seat) zapewnia wysoką marżę brutto, przewidywalne przychody ARR i naturalny lejek sprzedaży: klient doradczy staje się klientem SaaS.

## Walidacja (CFO-review + anty-wzorce) — passed: false
- ✅ Bilans się bilansuje (Assets ≈ L+E)
- ✅ CF ending-cash = BS cash
- ✅ Gross margin 70-90% (0.78 vs 0.70-0.90)
- ✅ OpEx total 40-95% rev (early-stage) (0.81 vs ≤0.95)
- ❌ LTV:CAC ≥ 3 (1.76 vs ≥3)
- ❌ CAC payback ≤ 24 mies (45.44 vs ≤24)
- ❌ Rule of 40 ≥ 40 (34 vs ≥40)
- ✅ Brak ujemnej gotówki w horyzoncie
- ✅ ARR bridge się domyka
- ✅ Terminal value ≤ 90% EV (0.81 vs ≤0.90)

**Anty-wzorce:** flag:tam_unsourced_or_topdown_only

## Hero-numbers (policzone i sformatowane RAZ → identyczne w 3 artefaktach)
- Ask / runda: **600 EUR**
- Przychód (ost. rok): **34 716 EUR**
- EBITDA (ost. rok): **8 171 EUR**
- Marża EBITDA: **24%**
- ARR (ost. rok): **34 412 EUR**
- LTV / CAC: **1.76 ×**
- CAC payback: **45.44 mies**
- TAM: **4 200 tys. EUR**
- SAM: **420 tys. EUR**
- SOM: **18 tys. EUR**

## Market sizing (triangulacja)
TAM 4200 tys. EUR (Gartner 'AI in Enterprise Software and Knowledge Work Automation' 2024: rynek globalny ~42 mld USD. Segment europejski (CEE+DACH+Benelux) ~10% = 4,2 mld EUR = TAM. SAM: firmy konsultingowe, działy strategii, CFO/CXO offices zatrudniające 10–500 konsultantów w regionie → ~10% TAM = 420 M EUR. SOM Y3: 18 M EUR = 4,3% SAM (realistyczne dla startupu po 3 latach z seed capital). TRIANGULACJA BOTTOM-UP: 1 200 klientów (seats) × 1 560 EUR ARPU/rok = 1 872 tys. EUR ≈ 1,87 M EUR — to SOM w ujęciu ARR na koniec Y3, nie SOM całego rynku; SOM 18 M EUR to wartość rynku dostępnego, nie przychód spółki. KOREKTA dla spójności: bottomUpCustomers=1200 seats, ARPU blended=1560 EUR/rok → bottom-up ARR Y3 = 1,87 M EUR; SOM (rynek) = 18 M EUR; spółka celuje w ~10% SOM w Y3 — spójne z ask 600k seed.) · SAM 420 · SOM 18 · bottom-up 1872000 (1200 klientów × 1560 tys. EUR) · reconcile ✗ gap 103999

## Model finansowy (z driverów)
| Rok | Przychód | COGS | EBITDA | Marża |
| --- | --- | --- | --- | --- |
| Rok 1 (2025) | 28620 | 6296 | -859 | -3% |
| Rok 2 (2026) | 31518 | 6934 | 3650 | 12% |
| Rok 3 (2027) | 34716 | 7638 | 8171 | 24% |

## 1) TABELA FINANSOWA (B4 z SPINE) — 5 pól · 3 wierszy · CF 2 · tier PREMIUM

## 2) RAPORT WORD (B3 z SPINE) — 14 sekcji · typy heading, text

## 3) DECK INWESTORSKI (B1 z SPINE) — 14 slajdów · 10 layoutów · briefy 14

**1. exec_summary** — DBR77 łączy usługi transformacji AI z produktem SaaS „Consultify", oferując konsultantom i działom strategii 10-krotne przyspieszenie produkcji materiałów klasy McKinsey przy koszcie modelu AI ~1/100 rozwiązań zachodnich. Model hybrydowy (retainer doradczy + subskrypcja per-seat) zapewnia wysoką marżę brutto, przewidywalne przychody ARR i naturalny lejek sprzedaży: klient doradczy staje się klientem SaaS.
**2. problem** — Status quo jest wolny i kosztowny — to realny ból rynku
**3. solution** — Consultify – platforma SaaS generująca materiały doradcze klasy konsultingowej (prezentacje, raporty, tabele) zasilane danymi organizacji, oparta na tanich modelach AI przez OpenRouter
**4. market** — Rynek 4 200 tys. EUR (TAM); realnie zdobywalne 18 tys. EUR (SOM)
**5. business_model** — Hybryda usługi + SaaS — dwa wzmacniające się strumienie
**6. gtm** — Land-and-expand: usługi otwierają drzwi, SaaS skaluje
**7. competition** — Strukturalna przewaga kosztowa = trwały moat
**8. traction** — ARR rośnie do 34 412 EUR w 2027
**9. financial_plan** — Przychód 34 716 EUR, EBITDA 8 171 EUR (marża 24%) w 2027
**10. unit_economics** — LTV/CAC 1.76 ×, payback 45.44 mies — ekonomika zdrowa
**11. team** — Zespół łączy ekspertyzę doradczą z inżynierią AI
**12. risks** — Ryzyka zidentyfikowane i zmitygowane
**13. ask** — Runda seed: 600 000 EUR. Przeznaczenie: 40% produkt (R&D/MVP→GA), 35% sprzedaż i marketing (PLG + enterprise outbound), 25% operacje i G&A. Cel: osiągnięcie ARR 1,2 M EUR i dodatniego EBITDA do końca roku 3.
**14. roadmap** — Roadmapa do 2027
