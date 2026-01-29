# CMMI — Capability Maturity Model Integration (wersja warsztatowa w Consultify)

## Po co CMMI w module Assessment

W Consultify CMMI jest wykorzystywane jako metoda oceny **dojrzałości procesowej** organizacji (nie “technologicznej”):

- jak planujecie i kontrolujecie pracę,
- jak zarządzacie wymaganiami, jakością i ryzykiem,
- czy macie standardy organizacyjne i pomiar,
- czy potraficie ciągle doskonalić.

> Uwaga: **oficjalna certyfikacja CMMI** wymaga akredytowanego “Lead Appraiser”. Tu opisujemy **użycie operacyjne** jako narzędzie diagnostyczne i roadmapę inicjatyw.

## Struktura w Consultify

Źródło w kodzie: `src/services/cmmiStructure.ts`

- **Skala 1–5** (Initial → Optimizing)
- **3 kategorie** praktyk:
  - **Doing** (Realizacja)
  - **Managing** (Zarządzanie)
  - **Enabling** (Wsparcie organizacyjne)
- **20 Practice Areas** (obszarów praktyk) z kodami.

## Skala dojrzałości 1–5 (jak interpretować)

1. **Initial** — ad hoc, zależne od ludzi, reaktywne.
2. **Managed** — dyscyplina “projektowa”, plan i kontrola w ramach inicjatyw.
3. **Defined** — standardy organizacyjne, powtarzalność, tailoring.
4. **Quantitatively Managed** — pomiar, statystyka, przewidywalność, baselines.
5. **Optimizing** — ciągłe doskonalenie, innowacje, zapobieganie defektom.

### Jak liczyć wynik “overall”

W implementacji Consultify przyjmujemy regułę z ducha CMMI:

- **overall maturity level = minimum** z ocen wszystkich Practice Areas  
  (żeby być na poziomie \(N\), wszystkie obszary muszą być co najmniej na \(N\)).

Dodatkowo liczona bywa średnia (do porównań), ale **nie jest “certyfikacją”**.

## Jak prowadzić ocenę (procedura)

1. **Zbierz artefakty**: SOP/procesy, szablony, repozytorium wymagań, definicje Done, raporty jakości, rejestr ryzyk, standard CM, audyty, KPI.

2. **Wywiad wg Practice Areas** (poniżej pytania) + szybka walidacja dowodów.

3. **Scoring**: oceniaj poziom, który jest _powtarzalny_ i _utrzymany_ (nie jednorazowy).

4. **Gaps & plan**:

- wybierz docelowy poziom (często 3 lub 4),
- wygeneruj luki (co jest < target),
- zamień luki na inicjatywy (szablony, procesy, narzędzia, szkolenia, metryki).

## Kategorie i Practice Areas (20)

### 1) Doing (Realizacja) — “dostarcz wartość”

1. **EST — Estimating (Szacowanie)**
   - Dowody: estymaty, historyczne dane, model kosztu/zasobów, re-estymaty.
   - Pytania: Jak estymujecie? Na jakich danych? Jak mierzycie błąd estymacji?

2. **PAD — Planning (Planowanie)**
   - Dowody: plan projektu/inicjatywy, harmonogram, zakres, zależności, kamienie.
   - Pytania: Jak zarządzacie zakresem? Jak często aktualizujecie plan? Kto zatwierdza zmiany?

3. **MC — Monitor & Control (Monitorowanie i kontrola)**
   - Dowody: statusy, burndown/KPI, actions, retros, raporty odchyleń.
   - Pytania: Jak wykrywacie odchylenia? Jak działają działania korygujące? Jak eskalujecie?

4. **PI — Peer Reviews (Przeglądy koleżeńskie)**
   - Dowody: checklisty review, zapisy PR/CR, listy defektów, decyzje.
   - Pytania: Co podlega review? Jak mierzycie skuteczność review? Czy jest kultura feedbacku?

5. **PQA — Process Quality Assurance (Zapewnienie jakości procesu)**
   - Dowody: audyty zgodności, standardy, niezgodności, CAPA.
   - Pytania: Kto weryfikuje zgodność? Jak często? Co robicie z niezgodnościami?

6. **RDM — Requirements Development & Management (Opracowanie i zarządzanie wymaganiami)**
   - Dowody: backlog/spec, traceability, analizy, akceptacje, zmiany.
   - Pytania: Jak pozyskujecie wymagania? Jak utrzymujecie spójność? Jak walidujecie z interesariuszami?

7. **RM — Requirements Management (Zarządzanie wymaganiami)**
   - Dowody: kontrola zmian, baseline, impact analysis, workflow.
   - Pytania: Jak zarządzacie zmianą wymagań? Czy jest impact analysis? Jak komunikujecie zmianę?

8. **TS — Technical Solution (Rozwiązanie techniczne)**
   - Dowody: architektura, design docs, decyzje techniczne, standardy.
   - Pytania: Jak projektujecie rozwiązania? Jak zarządzacie długiem technicznym? Jak porównujecie alternatywy?

9. **VER — Verification (Weryfikacja)**
   - Dowody: testy, kryteria akceptacji, QA, wyniki, automaty.
   - Pytania: Co to znaczy “spełnia wymagania”? Jakie testy są automatyczne? Jak zarządzacie defektami?

10. **VAL — Validation (Walidacja)**

- Dowody: UAT, pilotaże, dane użycia, feedback klienta, protokoły odbioru.
- Pytania: Jak dowodzicie, że rozwiązanie działa w realnym użyciu? Jak zbieracie feedback i iterujecie?

### 2) Managing (Zarządzanie) — “zarządzaj pracą i ryzykiem”

11. **CAR — Causal Analysis & Resolution (Analiza przyczynowa i rozwiązywanie)**

- Dowody: RCA (5Why/Ishikawa), postmortems, działania zapobiegawcze.
- Pytania: Czy robicie RCA po incydentach? Jak wdrażacie działania? Jak mierzycie skuteczność?

12. **CM — Configuration Management (Zarządzanie konfiguracją)**

- Dowody: repo, wersjonowanie, release notes, kontrola artefaktów, baselines.
- Pytania: Co jest “configuration item”? Jak kontrolujecie wersje? Jak odtwarzacie stan środowiska?

13. **DAR — Decision Analysis & Resolution (Analiza decyzji i rozwiązywanie)**

- Dowody: kryteria decyzyjne, scoring, protokoły decyzji, ADR.
- Pytania: Jak podejmujecie decyzje (buy vs build, vendor)? Jak dokumentujecie? Kto akceptuje?

14. **RSKM — Risk & Opportunity Management (Ryzyka i szanse)**

- Dowody: rejestr ryzyk, ocena P×I, plany mitigacji, monitoring.
- Pytania: Jak identyfikujecie ryzyka? Jak często przeglądacie? Jak zamieniacie szanse w inicjatywy?

15. **SAM — Supplier Agreement Management (Zarządzanie umowami z dostawcami)**

- Dowody: umowy/SLA, KPI dostawców, ocena, audyty, reklamację.
- Pytania: Jak mierzycie dostawców? Jak zarządzacie zmianą zakresu? Jak kontrolujecie ryzyko vendor lock-in?

### 3) Enabling (Wsparcie) — “zbuduj zdolność organizacji”

16. **GOV — Governance (Governance)**

- Dowody: komitety, RACI, polityki, portfolio, gate decisions.
- Pytania: Kto ma prawo decyzji? Jak działa governance portfela? Jak egzekwujecie standardy?

17. **II — Implementation Infrastructure (Infrastruktura wdrożeniowa)**

- Dowody: narzędzia CI/CD, środowiska, standardy, platformy, runbooks.
- Pytania: Jak szybko dostarczacie zmiany? Jak wygląda obserwowalność? Jak utrzymujecie środowiska?

18. **OT — Organizational Training (Szkolenia organizacyjne)**

- Dowody: plan szkoleń, matryce kompetencji, certyfikacje, onboarding.
- Pytania: Jak planujecie kompetencje? Jak mierzycie efekty szkoleń? Jak utrzymujecie wiedzę w organizacji?

19. **PCM — Process Management (Zarządzanie procesami)**

- Dowody: katalog procesów, SOP, wersjonowanie, właściciele procesów, tailoring.
- Pytania: Czy procesy są zdefiniowane i używane? Jak je zmieniacie? Jak utrzymujecie spójność między zespołami?

20. **MPM — Managing Performance & Measurement (Wydajność i pomiary)**

- Dowody: KPI/OKR, baselines, dashboardy, reguły pomiaru, definicje metryk.
- Pytania: Jakie metryki są kluczowe? Czy są porównywalne w czasie? Jak metryki wpływają na decyzje?

## DoD dla “poziomu” (praktyczna checklista)

Żeby uznać, że obszar jest na poziomie \(N\), oczekuj:

- **Artefaktów** (szablony, rejestry, raporty) i dowodu użycia,
- **Roli właściciela** (kto odpowiada),
- **Rytuałów** (jak często jest przegląd),
- **Pomiary** (dla 4–5: metryki, baselines, analiza trendów),
- **Ciągłego doskonalenia** (dla 5: RCA, zapobieganie, wdrażanie innowacji).
