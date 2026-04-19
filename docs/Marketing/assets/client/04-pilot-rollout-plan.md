# Pilot i rollout — plan wdrożenia

**Dla:** COO, Transformation Officer, CEO (Decision), Owner (Expansion)  
**Cel:** Zmniejszyć ryzyko operacyjne: jasny zakres, obciążenie zespołów, kryteria sukcesu, eskalacje.

---

## 1. Cel pilota (1 akapit)

Pilot ma udowodnić, że Consultify **zmniejsza chaos transformacji** w wybranym zakresie: jest **widoczność execution** (kto dowozi, gdzie są bottlenecki), **metryki sukcesu** zgodne z CFO oraz **akceptowalny footprint** dla IT — bez „big bang” na całą organizację.

**Sukces pilota =** *np. (1) osiągnięcie primary KPI z [`02-roi-measurement-template.md`](./02-roi-measurement-template.md), (2) formalny sign-off COO + delegate CFO na kontynuację, (3) brak krytycznych incydentów security powyżej uzgodnionego progu.*

---

## 2. Zakres (in / out)

| In scope | Out of scope |
|---|---|
| Jeden obszar procesu / jedna jednostka (np. region, fabryka, linia produktów) | Cała grupa / wszystkie kraje naraz |
| Integracje uzgodnione w discovery (np. ticketing, podstawowe źródło danych) | Pełna integracja z każdym legacy bez backlogu |
| Szkolenie championów i super-userów | Przedefiniowanie całego modelu operacyjnego firmy |
| Raportowanie KPI co uzgodniony rytm | Zmiana systemów ERP pod pilot |

---

## 3. Role i RACI (skrót)

| Działanie | R | A | C | I |
|---|---|---|---|---|
| Konfiguracja środowiska i dostępów | IT / DevOps klienta | Sponsor biznesowy | Consultify PM | CISO |
| Mapa procesu i KPI | COO / TO | TO | Consultify | CFO delegate |
| Szkolenie użytkowników | HR / TO | Lider obszaru | Consultify | PMO |
| Integracja z narzędziami PMO | TO | IT | Integrator | COO |
| Akceptacja go/no rollout | Sponsor (Owner/CEO) | COO | CFO, IT | Consultify |

*(R/A/C/I dopasujcie do realnych ról na koncie.)*

---

## 4. Harmonogram (30/60/90)

| Faza | Okres | Deliverable | Kryterium ukończenia |
|---|---|---|---|
| Kick-off | T0–T+7 | Charter, RACI, lista ryzyk, plan komunikacji | Podpisany zakres i lista uczestników |
| Discovery / design | T+7–T+21 | Mapa procesu, definicje KPI, wymagania IT | Zatwierdzony baseline ROI |
| Pilot | T+21–T+75 | System w użyciu, tygodniowe review | Primary KPI zmierzone wg metodyki |
| Decision review | T+75–T+90 | Raport pilota, rekomendacja rollout | Spotkanie komitetu + decyzja |
| Rollout faza 2 | T+90+ | Plan fal, kolejka procesów | Budżet i harmonogram fali 2 |

*Daty wpiszcie pod konto; typowo pilot 60–90 dni kalendarzowych.*

---

## 5. Obciążenie zespołów (COO)

| Zespół | Godziny / tydzień (szacunek) | Ryzyko przeciążenia | Mitygacja |
|---|---:|---|---|
| TO / PMO | *4–8 h* | Konflikt z innymi programami | Ochrona kalendarza sponsora |
| IT | *2–6 h* | Szczyty wdrożeń | Sandbox najpierw, zmiana okna |
| Lider obszaru | *2–4 h* | Operacyjny „day job” | Jasny delegate + agenda tygodniowa |

---

## 6. Eskalacje

| Trigger | Kto decyduje | Akcja |
|---|---|---|
| Opóźnienie > *10* dni roboczych vs plan | Sponsor + PM | Spotkanie naprawcze w 48 h; aktualizacja planu |
| Spadek KPI poniżej uzgodnionego progu | CFO delegate + COO | Analiza przyczyn; plan korekty w *10* dni |
| Incydent bezpieczeństwa (średni/wysoki) | CISO + Consultify | Procedura incydentowa; komunikacja wg SLA |
| Konflikt priorytetów między BU | Sponsor | Decyzja scope / kolejność fal |

---

## 7. Kryteria go/no do roll-outu

- [ ] Primary KPI: *wartość ≥ uzgodnionego targetu* (patrz ROI template)
- [ ] Persistence: *brak regresji w *30* dni po „after”* lub uzasadniony plan naprawczy
- [ ] Akceptacja CFO: *podpis / email* + link do ROI pack
- [ ] Akceptacja IT: *warunki sign-off* z [`03-security-architecture-faq.md`](./03-security-architecture-faq.md)
- [ ] Gotowość organizacji: *lista ról i szkoleń na falę 2*

---

## 8. Roll-out (po pilocie)

**Kolejne fale:** *Kolejne procesy / regiony / BU wg macierzy priorytetu (impact × gotowość).*

**Zależności:** *Integracje, jakość danych, capacity IT, sezonowość biznesu — jedna strona z listą zależności i ownerami.*
