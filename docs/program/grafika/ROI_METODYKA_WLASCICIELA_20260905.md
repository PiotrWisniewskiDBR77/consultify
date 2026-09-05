---
doc_id: roi-metodyka-wlasciciela-20260905
status: canonical
truth_type: product-decision
established: 2026-09-05
decided_by: Piotr (właściciel) — tekst przekazany w rozmowie odbiorowej MVP, zapisany bez skrótów
---

# ROI — metodyka właściciela (pełna analiza wskaźnikowa inwestycji niefinansowej)

## Konstrukcja narzędzia w Wynikach (słowa właściciela)

> „ROI jest proste, bo tutaj mamy po prostu jedną tabelę, a pod tabelą już bezpośrednio mamy analitykę dla danego ROI. Każdy ROI zawiera kartę typu N, w której znajdują się: najpierw elementy związane z założeniami, potem karta z wyliczeniami, a na koniec analiza, czy wszystko zostało dostarczone. Obejmuje to opis prawdziwości realizacji założeń oraz podliczenie wyniku analizy ROI po realizacji.”

Pełna, podręcznikowa **analiza wskaźnikowa inwestycji niefinansowej** — np. zakupu maszyny, robotyzacji, wdrożenia systemu IT, automatyzacji magazynu, modernizacji linii czy projektu digitalizacji — powinna być traktowana nie jako policzenie jednego ROI, lecz jako **kompletny proces oceny ekonomicznej projektu inwestycyjnego**. Jej zadaniem jest odpowiedzieć na cztery pytania: **Ile naprawdę kosztuje inwestycja? Jaką wartość ekonomiczną będzie generowała? Jak szybko i z jaką rentownością odzyskamy kapitał? Jak duże jest ryzyko, że założone efekty nie zostaną osiągnięte?**

## 1. Przedmiot i cel analizy
Opisać: przedmiot inwestycji, problem biznesowy, zakres techniczny, zakres organizacyjny, czas realizacji, przewidywany okres eksploatacji, **wariant bazowy (Business as Usual — co wydarzy się bez inwestycji)**, alternatywne warianty. Inwestycji nie porównuje się do abstrakcyjnego „zera”. Jeżeli bez automatyzacji firma musiałaby zatrudnić za dwa lata 10 operatorów, koszt tych operatorów jest częścią uzasadnienia.

## 2. Horyzont analizy
3 lata (IT/technologia), 5 lat (typowe inwestycje przemysłowe), 7–10 lat (maszyny, infrastruktura, energetyka), dłużej (budynki). Horyzont = ekonomiczny okres życia, nie okres amortyzacji księgowej.

## 3. Nakłady inwestycyjne — CAPEX
CAPEX = zakup + instalacja + integracja + infrastruktura + uruchomienie + szkolenia + inne (transport, montaż, fundamenty, energetyka, pneumatyka, robot, chwytaki, bezpieczeństwo, software, licencje startowe, integracja ERP/MES, inżynieria, testy, odbiory). **Contingency 5–15 % CAPEX** wg dojrzałości projektu.

## 4. Zmiana kapitału obrotowego
Investment₀ = CAPEX + ΔNWC (zapasy materiałów, części, WIP, należności, gotówka operacyjna). Uwolnienie 1 mln zapasów = realny efekt cash-flow.

## 5. Koszty operacyjne projektu
Tylko **incremental OPEX**: Relevant Cost = Cost(with) − Cost(without). Energia, materiały, części, maintenance, software, abonamenty, cloud, serwis, kalibracja, przeglądy, specjaliści, ubezpieczenie, szkolenia, cyberbezpieczeństwo.

## 6–14. Korzyści ekonomiczne — identyfikowane oddzielnie, sumowane później
- **Praca**: Benefit = ΔFTE × pełny koszt zatrudnienia (nie netto).
- **Produktywność**: wzrost output nie jest automatycznie korzyścią — sprawdzić popyt, sprzedawalność, wąskie gardło; Benefit = dodatkowa sprzedaż × **marża kontrybucyjna** (nie przychód).
- **Jakość**: ScrapCost₀ − ScrapCost₁; Quality Cost = Scrap + Rework + Claims + Warranty.
- **Przestoje**: Reduced Downtime × ekonomiczny koszt przestoju (utracona marża, nadgodziny, przezbrojenia, kary, utrata sprzedaży).
- **Energia**: (Energy₀ − Energy₁) × cena; analogicznie gaz, woda, sprężone powietrze, ciepło, chłód.
- **Maintenance**: Maintenance₀ − Maintenance₁ (części, roboczogodziny, serwis, awarie, prewencja, utracony czas).
- **Zapasy**: Cash Release = Inventory₀ − Inventory₁ oraz roczny Benefit = redukcja × carrying cost rate.
- **Uniknięte koszty (Avoided Costs)**: zatrudnienie, zmiana, maszyna, hala, magazyn, outsourcing, awarie, kary, koszty środowiskowe.
- **Wartość rezydualna**: CFₙ = OperatingCFₙ + RVₙ.

## 15. Przepływy pieniężne
CFₜ = CashBenefitsₜ − CashCostsₜ − CAPEXₜ − ΔNWCₜ (+ podatki w wariancie pełnym). **Analizujemy cash flow, nie wynik księgowy.** Amortyzacja nie jest wydatkiem, ale daje tax shield.

## 16–19. Wskaźniki statyczne
- ROI = roczna korzyść netto / inwestycja × 100 %.
- ROIₙ = (suma korzyści − suma kosztów) / inwestycja × 100 % — **zawsze z horyzontem** (ROI 3Y, ROI 5Y).
- Payback Period = nakład / roczny CF (przy nierównych — kumulacyjnie).
- ARR = średni roczny zysk księgowy / średnia inwestycja (pomocniczo).

## 20–25. Wskaźniki dynamiczne
- NPV = −I₀ + Σ CFₜ/(1+r)ᵗ; NPV>0 tworzy wartość, =0 pokrywa koszt kapitału, <0 niszczy wartość.
- Discounted Payback: kiedy Σ DCFₜ ≥ I₀.
- IRR: stopa, przy której NPV = 0; akceptacja gdy IRR > wymagany zwrot.
- PI = PV(przyszłe CF) / nakład; >1 opłacalny.
- BCR = PV(korzyści) / PV(kosztów).

## 26–27. Break-even i margines bezpieczeństwa
Przy jakiej wartości kluczowej zmiennej NPV = 0 (ilu operatorów, ile sztuk, jaki uptime, jaka sprzedaż). Margin of Safety = odległość planu od break-even.

## 28–29. Wrażliwość i scenariusze
Wrażliwość: pojedyncze zmienne ±20 % (CAPEX, koszt pracy, wolumen, energia, produktywność, uptime, scrap, serwis) → wpływ na NPV/IRR/ROI/Payback → **value drivers**. Scenariusze: minimum **Conservative / Base / Upside**, dla każdego CF, ROI, Payback, NPV, IRR, PI.

## 30. Ryzyko
Techniczne, wdrożeniowe, CAPEX, operacyjne, popytu, organizacyjne (redukcja FTE niemożliwa), technologiczne, dostawcy — z mitygacjami.

## 31–32. KPI operacyjne i łańcuch KPI → pieniądze
OEE, Availability, Performance, Quality, throughput, cycle/lead/changeover time, downtime, scrap, rework, FPY, MTBF, MTTR, WIP, rotacja zapasów, energia/szt., roboczogodziny/szt. Każda korzyść wyprowadzona z KPI: **zmiana procesu → zmiana KPI → efekt operacyjny → efekt ekonomiczny → cash flow → NPV/ROI** (np. OEE 62→72 % → capacity 1,0→1,15 M → +80 000 szt. × 12 zł marży = 960 000 zł/rok).

## 33–35. Klasy korzyści i ocena wielokryterialna
**Hard Benefits** (FTE, materiał, energia, scrap, maintenance, marża), **Avoided Costs**, **Soft Benefits** (ergonomia, bezpieczeństwo, jakość danych, decyzje, zadowolenie, odporność, know-how — raportowane, **nie monetyzowane sztucznie**), **Strategic Benefits** (nowy rynek, skalowalność, kompetencja, niezależność od pracowników, time-to-market, compliance, bezpieczeństwo dostaw). Scoring wielokryterialny (NPV 25 %, IRR 15 %, Payback 15 %, Ryzyko 15 %, Strategic Fit 10 %, Operational Impact 10 %, Scalability 5 %, ESG/Safety 5 %) do priorytetyzacji CAPEX.

## 36–41. Zasady metodologiczne
Warianty: Option 0 do nothing / 1 minimalna modernizacja / 2 pełna automatyzacja / 3 outsourcing-leasing-RaaS-SaaS — każdy z CAPEX, OPEX, NPV, IRR, Payback, risk. **Finansowanie ≠ ekonomika** (najpierw czy sensowna, potem jak sfinansować). Podatki i tax shield = Depreciation × TaxRate w pełnym modelu. **Sunk costs poza analizą.** **Opportunity cost w analizie** (własna hala ma wartość najmu). **Zakaz podwójnego liczenia** (OEE ↔ downtime ↔ throughput) — każda korzyść ma własną logikę finansową.

## 42. Pełna struktura raportu inwestycyjnego
I Executive Summary (Investment, CAPEX, Annual Benefit, ROI, Payback, NPV, IRR, PI, Recommendation) · II Business Case (problem, cel, zakres, wariant bazowy) · III Operational Baseline (proces, KPI, koszty) · IV Target State (proces, target KPI) · V Investment Costs (CAPEX, implementation, working capital, OPEX) · VI Benefit Model (labor, throughput, quality, downtime, maintenance, energy, inventory, avoided) · VII Cash Flow Model (rok 0–n) · VIII Investment Ratios (ROI, ARR, PP, DPP, NPV, IRR, PI, BCR) · IX Scenario Analysis · X Sensitivity Analysis · XI Risk Analysis · XII Strategic Assessment · XIII Recommendation (**GO / CONDITIONAL GO / NO-GO**).

## 43. Wskaźniki w jednym miejscu
CAPEX (ile inwestujemy) · Annual Net Benefit · ROI · Payback · Discounted Payback · NPV · IRR · PI · BCR · Break-even · Margin of Safety — nad nimi trzy warstwy: **Operational KPI + Risk + Strategic Value**.

## 44. Post Investment Review
Po 3, 6, 12 miesiącach: Expected vs Actual per KPI (CAPEX, Output, FTE saving, Annual benefit, Payback) z wariancją. Zamyka cykl: Idea → Baseline → Business Case → Investment → Implementation → Measurement → Benefit Realization.

## Sedno
**Problem → Baseline → Investment → Operational Change → KPI → Economic Benefit → Cash Flow → ROI/NPV/IRR → Risk → Decision → Post Audit.** Samo ROI i Payback to uproszczony business case; kompetentna analiza pokazuje ekonomikę, cash flow, wartość pieniądza w czasie, ryzyko, wrażliwość, zmianę KPI operacyjnych i faktyczną realizację korzyści po wdrożeniu.
