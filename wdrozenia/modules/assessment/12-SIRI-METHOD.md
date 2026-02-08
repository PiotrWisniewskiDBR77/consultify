# SIRI — Smart Industry Readiness Index (Industry 4.0 readiness)

## Co to jest SIRI i po co to robimy

**SIRI** to metoda oceny gotowości zakładu produkcyjnego do transformacji Industry 4.0. W praktyce dostarcza:

- ocenę dojrzałości na **16 wymiarach** (Assessment Matrix),
- identyfikację priorytetów (na podstawie logiki TIER / prioritisation),
- wspólny język dla IT/OT, produkcji i zarządu.

W module `Assessment` SIRI służy jako drugi “framework” obok DRD (z możliwością raportu i inicjatyw).

## Źródła (publiczne i wewnętrzne)

- Materiał publiczny o programie i strukturze SIRI (3 building blocks / 8 pillars / 16 dimensions):  
  `https://assets.incit.org/wp-content/uploads/2025/05/22143720/SIRI-Factsheet-February-2025.pdf`

W kodzie Consultify jest uproszczona struktura SIRI w `src/services/siriStructure.ts` (8 wymiarów + 16 “prioritisation areas”). Ten plik jest przydatny do UI, ale **kanoniczny opis metody** dla konsultanta powinien bazować na **16 wymiarach**.

## Jak prowadzić SIRI (procedura warsztatowa)

### 1) Planowanie i przygotowanie

- Ustal zakres: pojedynczy zakład / wiele zakładów, linie, krytyczne procesy.
- Zaplanuj uczestników: produkcja, UR, jakość, logistyka/SCM, IT/OT, BHP/Facility, finanse, HR.
- Poproś o dane: architektura IT/OT, lista systemów, KPI (OEE, scrap, OTIF), mapa procesów, plany inwestycji.

### 2) Ewaluacja (wywiad + factory tour)

- Najpierw “banding” dla 16 wymiarów (0–5) — **na podstawie dowodów**.
- Wizyta na produkcji (tour) jest kluczowa, bo SIRI ocenia realną integrację i użycie.

### 3) Analiza i debrief

- Zrób radar/heatmapę 16 wymiarów.
- Wyprowadź 3–6 priorytetów (zwykle “wąskie gardła” w integracji, danych, kompetencjach).
- Ustal 12–24 miesięczny plan: quick wins + fundamenty + inicjatywy strategiczne.

## Skala ocen 0–5 (Assessment Matrix)

W SIRI stosuje się **6 bandów** na wymiar:

- **0 — Not started**: brak inicjatyw/planów, dominują metody tradycyjne.
- **1 — Defined**: świadomość i pierwsze pilotaże, ale wąsko i bez skali.
- **2 — Digital**: digitalizacja w silosach, podstawowe dane.
- **3 — Integrated**: integracja między funkcjami, widoczność “near real-time”.
- **4 — Automated**: automatyzacja decyzji/sterowania (predykcja, optymalizacja).
- **5 — Intelligent**: samooptymalizujące operacje i uczenie się systemów.

> Zasada scoringu: jeśli firma spełnia elementy poziomu \(n+1\), ale brak utrzymania/standardów/skalowania — oceniaj jako \(n\).

## 16 wymiarów SIRI (kanoniczna lista) i pytania

Poniżej lista 16 wymiarów w układzie 3 filarów (Process / Technology / Organisation). Dla każdego podaję:

- **co oceniamy**,
- **typowe dowody**,
- **pytania diagnostyczne**.

### A) Process (3 wymiary)

#### P1. Operations (Vertical Integration)

- **Co oceniamy:** projektowanie i sterowanie operacjami na shopfloor oraz integrację danych od stanowiska do poziomu zarządzania.
- **Dowody:** MES/SCADA, OEE real-time, traceability, plan wykonania vs wykonanie, standardy danych, raporty jakości.
- **Pytania:**
  - Czy plan produkcji i wykonanie są spięte w jednym przepływie (MES/ERP/APS)?
  - Czy dane z maszyn są zbierane automatycznie i używane do decyzji (nie tylko “logi”)?
  - Czy jest pełna identyfikowalność partii/serialu i powiązanie z jakością?
  - Jak wygląda zarządzanie odchyleniami (alerty, eskalacje, CAPA)?

#### P2. Supply Chain (Horizontal Integration)

- **Co oceniamy:** integrację i widoczność przepływu materiałów oraz informacji w łańcuchu dostaw (wewnątrz i z partnerami).
- **Dowody:** WMS/TMS, EDI, widoczność zapasów, OTIF, forecast, integracje z dostawcami/klientami.
- **Pytania:**
  - Czy macie aktualny obraz zapasów i WIP oraz ich jakości (real-time/near real-time)?
  - Czy integrujecie dane z dostawcami i klientami (EDI/API/portale)?
  - Jak planujecie i reagujecie na zmienność (demand/supply)?
  - Czy decyzje o zapasie/zakupach są wspierane predykcją/optimizacją?

#### P3. Product Lifecycle (Integrated Product Lifecycle)

- **Co oceniamy:** “digital thread” od R&D i konstrukcji do produkcji i serwisu.
- **Dowody:** PLM, CAD/CAM integracje, BOM/MBOM, zmiany inżynierskie, digital twin (rozumiany jako model + dane).
- **Pytania:**
  - Czy BOM/zmiany inżynierskie są spójne i kontrolowane (CM) w całym cyklu?
  - Jak szybko przenosicie zmiany z konstrukcji na produkcję?
  - Czy dane eksploatacyjne wracają do R&D (feedback loop)?
  - Czy istnieje digital twin dla produktu/procesu (i do czego realnie służy)?

### B) Technology (9 wymiarów = 3 obszary × 3 poziomy)

#### T1. Shop Floor Automation

- **Co oceniamy:** automatyzację na poziomie gniazd/stanowisk/robotyki.
- **Dowody:** roboty/coboty, CNC, automaty podawania, automaty kontroli jakości.
- **Pytania:** co jest zautomatyzowane, jak mierzycie efekty, jak utrzymujecie (MTBF/MTTR), jak integrujecie z danymi.

#### T2. Shop Floor Connectivity

- **Co oceniamy:** łączność OT, sensory, IIoT, edge, standardy komunikacji.
- **Dowody:** sieci OT, gatewaye, protokoły, segmentacja, zbieranie danych z maszyn.
- **Pytania:** jakie protokoły i standardy, cyber-segmentacja, latency, pokrycie danych, jakość sygnału.

#### T3. Shop Floor Intelligence

- **Co oceniamy:** analitykę i AI na shopfloor (predykcja UR, vision QC, optymalizacja).
- **Dowody:** modele predykcyjne, systemy SPC, vision AI, rekomendacje.
- **Pytania:** czy modele są wpięte w decyzje, jak monitorujecie drift, jaka jest skuteczność (precision/recall, oszczędności).

#### T4. Enterprise Automation

- **Co oceniamy:** automatyzację procesów biznesowych (workflow, RPA, E2E).
- **Dowody:** automatyzacje w finansach/zakupach/HR/sprzedaży, BPM/RPA, SLA.
- **Pytania:** ile kroków jest “straight-through”, gdzie są ręczne bottlenecks, jak wygląda audytowalność.

#### T5. Enterprise Connectivity

- **Co oceniamy:** integracje systemów IT (ERP/CRM/BI), API, chmura, integracja z OT.
- **Dowody:** architektura integracji (ESB/iPaaS), API, katalog danych, SSO, MDM.
- **Pytania:** czy jest “single source of truth”, jak rozwiązujecie master data, jak wygląda integracja IT/OT.

#### T6. Enterprise Intelligence

- **Co oceniamy:** analitykę i AI na poziomie firmy (forecast, planowanie, optymalizacja).
- **Dowody:** BI/analytics, prognozy popytu, optymalizacje planu, controlling.
- **Pytania:** czy decyzje są data-driven, jak mierzona jest trafność prognoz, kto odpowiada za dane i modele.

#### T7. Facility Automation

- **Co oceniamy:** automatyzację infrastruktury zakładu (BMS, energia, media).
- **Dowody:** BMS, automaty HVAC, monitoring energii, automaty alarmów.
- **Pytania:** jakie systemy facility, jak sterujecie energią, czy są automatyczne scenariusze oszczędności.

#### T8. Facility Connectivity

- **Co oceniamy:** łączność i monitoring infrastruktury (sensory, smart metering).
- **Dowody:** liczniki, sensory środowiskowe, sieci, integracje z BI/BMS.
- **Pytania:** czy dane facility są zintegrowane z produkcją (np. energia na produkt), jak wygląda cyber dla BMS.

#### T9. Facility Intelligence

- **Co oceniamy:** analitykę i AI dla facility/sustainability (optymalizacja energii i przestrzeni).
- **Dowody:** analityka energii, predykcje, raporty ESG, optymalizacje.
- **Pytania:** czy macie modele predykcyjne, jak wyznaczacie KPI energetyczne, czy jest pętla optymalizacji.

### C) Organisation (4 wymiary)

#### O1. Workforce Learning & Development

- **Co oceniamy:** systemowe rozwijanie kompetencji I4.0 (IT/OT/data/lean).
- **Dowody:** matryce kompetencji, programy reskilling, akademie, certyfikacje.
- **Pytania:** jak planujecie kompetencje pod roadmapę, jaki jest budżet i KPI szkoleń, jak wdrażacie nowe role.

#### O2. Leadership Competency

- **Co oceniamy:** kompetencje liderów w transformacji (change, data, decyzje).
- **Dowody:** governance transformacji, rytuały, sponsorzy, portfolio.
- **Pytania:** kto jest sponsorem, jak zapadają decyzje inwestycyjne, jak liderzy mierzą postęp i uczą organizację.

#### O3. Strategy & Governance

- **Co oceniamy:** spójność strategii i mechanizmów sterowania (portfolio, standardy, bezpieczeństwo).
- **Dowody:** strategia cyfrowa, architektura docelowa, budżety, komitety, polityki.
- **Pytania:** czy jest roadmapa 12–36 m-cy, jakie są kryteria priorytetyzacji, jak zarządzacie ryzykiem.

#### O4. Inter & Intra-company Collaboration

- **Co oceniamy:** współpracę międzydziałową i z partnerami (dane, procesy, projekty).
- **Dowody:** cross-functional teams, umowy integracyjne, wspólne KPI, platformy współpracy.
- **Pytania:** czy KPI są wspólne end-to-end, jak rozwiązujecie konflikty priorytetów, jak współdzielicie dane z partnerami.

## Uwaga: mapowanie do implementacji w Consultify (8 wymiarów)

W UI/implementacji możesz spotkać uproszczenie do 8 wymiarów:

- Process: Operations / Supply Chain / Product Lifecycle (3)
- Technology: Automation / Connectivity / Intelligence (3)
- Organisation: Talent Readiness / Structure & Management (2)

**Jak mapować 16 → 8:**

- Operations = P1
- Supply Chain = P2
- Product Lifecycle = P3
- Automation = T1 + T4 + T7 (średnia / najsłabsze ogniwo)
- Connectivity = T2 + T5 + T8
- Intelligence = T3 + T6 + T9
- Talent Readiness = O1 + O2
- Structure & Management = O3 + O4

Jeśli raportujesz “po kanonicznemu”, trzymaj 16 wymiarów. Jeśli integrujesz z UI — agreguj wg powyższej reguły.
