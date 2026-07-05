# Raport z audytu procesów ICT i gotowości AI — Apator SA

- **Document type:** ai_audit_report
- **Audience:** Zarząd Apator SA, Dyrektor IT, Komitet Sterujący Transformacji
- **Goal:** decide
- **Register:** executive
- **Density:** detailed
- **Language style:** consulting
- **Confidentiality:** confidential


## Executive Summary

_Purpose: Top-level synthesis with the decision or recommendation._

Audyt ICT w Apator SA ujawnił średnią dojrzałość technologiczną na poziomie 3.2/5, z jednoczesnym ogromnym, niewykorzystanym potencjałem wartości AI szacowanym na 12 milionów złotych rocznie. Największe możliwości optymalizacji koncentrują się w obszarze predykcyjnego utrzymania ruchu oraz kontroli jakości wizyjnej, gdzie wdrożenie rozwiązań AI może przynieść najszybszy zwrot z inwestycji. Rekomendujemy pilne uruchomienie programu transformacji AI z początkowym budżetem 2.5 miliona złotych na budowę fundamentów danych i realizację pierwszych projektów pilotażowych.

- Stworzenie zunifikowanego jeziora danych integrującego systemy MES, PLM oraz SAP ERP w celu zapewnienia spójności i dostępności danych dla projektów AI.
- Uruchomienie pilotażowego projektu kontroli jakości wizyjnej jako 'Quick Win' z szybkim zwrotem inwestycji i demonstracją wartości AI.
- Inicjowanie prac badawczo-rozwojowych nad systemem predykcyjnego utrzymania ruchu dla kluczowych linii produkcyjnych w celu minimalizacji przestojów.

> **NOTE:** Kluczowy moment decyzyjny dla Zarządu: zatwierdzenie alokacji budżetu na lata 2024/2025 w wysokości 2.5 miliona złotych na sfinansowanie budowy fundamentów danych oraz pierwszego klastra projektów pilotażowych AI. Opóźnienie decyzji ryzykuje utratę przewagi konkurencyjnej i zwiększenie dystansu do liderów branży wdrażających AI.

## Audit Scope

_Purpose: Audit boundaries: in-scope, out-of-scope, sampling and timeframe._

Audyt objął kluczowe komponenty infrastruktury ICT Apator SA niezbędne do wdrożenia rozwiązań AI, ze szczególnym uwzględnieniem środowiska produkcyjnego i systemów korporacyjnych. Zakres analizy obejmował architekturę systemów transakcyjnych (ERP SAP), systemy zarządzania produkcją (MES), systemy inżynierskie (PLM), oraz przepływy danych produkcyjnych w czasie rzeczywistym. Ocena dojrzałości danych i bezpieczeństwa przeprowadzona została w odniesieniu do wymagań wdrożeniowych AI, z uwzględnieniem integracji między systemami i gotowości infrastruktury do przetwarzania dużych zbiorów danych.

| Domain | In Scope | Out of Scope |
| --- | --- | --- |
| ERP SAP | PP (Planowanie Produkcji), MM (Zarządzanie Materiałami), SD (Sprzedaż i Dystrybucja), CO (Kontroling) | FI (Moduł Finansowy), HR (Zarządzanie Kadrami) |
| MES | Dane produkcyjne, OEE, śledzenie partii, planowanie zasobów | Systemy raportowania historycznego starsze niż 3 lata |
| PLM | Dane CAD, BOM, dokumentacja techniczna, wersjonowanie produktów | Archiwum projektów zarchiwizowanych przed 2020 |
| Infrastruktura Danych | Data Lake, hurtownie danych, API integracyjne, streaming danych | Lokalne bazy danych działów, systemy Excelowe |
| Bezpieczeństwo | Dostęp do produkcyjnych API, szyfrowanie danych, polityki dostępu | Fizyczny dostęp do serwerowni, polityki BYOD |

- Audyt przeprowadzony w okresie 4 tygodni (marzec-kwiecień 2024)
- Próbkowanie danych obejmowało 3 kluczowe linie produkcyjne (transformatory, liczniki energii, aparatura kontrolna)
- Analiza 100% transakcyjnych danych z 2023 roku (ponad 2.5M rekordów produkcyjnych)
- Wywiady z 25 kluczowymi interesariuszami (kierownicy produkcji, inżynierowie, analitycy)
- Ocena jakości danych na podstawie 15 kluczowych wskaźników (kompletność, spójność, aktualność)

## Methodology

_Purpose: Method, scope, sources and limitations of the analysis._

Zastosowano hybrydowe podejście analityczne łączące ilościową analizę logów systemowych z jakościową oceną poprzez wywiady z interesariuszami. Analiza ilościowa obejmowała przetwarzanie danych z systemów ERP, MES i PLM w celu identyfikacji wzorców operacyjnych i ineffektywności. Równocześnie przeprowadzono 15 pogłębionych wywiadów z kluczowymi menedżerami i specjalistami w celu zrozumienia procesów biznesowych, wyzwań i aspiracji cyfrowych. Podejście to pozwoliło na uzyskanie holistycznego obrazu dojrzałości ICT oraz realistycznej oceny potencjału wdrożenia rozwiązań AI w kontekście strategicznych celów Apator SA.

- 15 wywiadów z interesariuszami (Zarząd, IT, Produkcja)
- Tabele systemu SAP ERP (dane finansowe i operacyjne)
- Historyczne dane z systemów MES (produkcja)
- Metadane z systemu PLM (cykl życia produktu)
- Logi bezpieczeństwa sieci i systemów

> **NOTE:** Kluczowe ograniczenie: Dostępność danych w czasie rzeczywistym z niektórych przestarzałych sterowników PLC była ograniczona, co wymagało ekstrapolacji do analizy OEE (Overall Equipment Effectiveness).

## Current State

_Purpose: Substantive section "Current State" relevant to the document goal._

Current ICT architecture at Apator SA reveals a fragmented landscape despite having a robust SAP ERP backbone serving as the core transactional system. The manufacturing execution systems (MES) operate as isolated islands, primarily focused on shop floor data collection without seamless integration to the ERP layer. Similarly, the Product Lifecycle Management (PLM) system maintains design and engineering data in silos, preventing end-to-end visibility across the product development-to-manufacturing continuum. This architectural fragmentation creates significant data flow bottlenecks, requiring manual interventions and data reconciliation processes that delay decision-making and inhibit real-time operational insights.

| System | Maturity Level | Data Quality | Integration Status |
| --- | --- | --- | --- |
| SAP ERP | 4 | High | Partial |
| MES | 2 | Medium | Limited |
| PLM | 2 | Low | Isolated |
| Infrastructure | 3 | Medium | Adequate |

> **NOTE:** Brak scentralizowanego data lake zmusza do ręcznego eksportu/importu danych, co skutkuje 24-godzinnym opóźnieniem w analityce produkcyjnej. Ta bariera uniemożliwia wdrożenie rozwiązań AI wymagających przetwarzania danych w czasie rzeczywistym.

Security baseline assessment confirms Apator SA maintains ISO 27001 certification with established information security management systems covering access controls, network security, and incident response procedures. However, the organization lacks specific AI governance frameworks including model versioning protocols, data ethics guidelines, and algorithmic bias mitigation strategies. The current security policies do not address unique AI risks such as model drift, adversarial attacks, or explainability requirements. This governance gap presents a significant challenge for scaling AI initiatives beyond proof-of-concept stage, particularly in regulated energy sector applications where audit trails and model transparency are mandatory.

## AI Opportunities

_Purpose: Substantive section "AI Opportunities" relevant to the document goal._

Introduction to the value pool: Analysis revealed high potential in operational efficiency and demand forecasting.

## Risks and Constraints

_Purpose: Material risks and constraints with explicit mitigation._

Krajobraz ryzyka transformacji AI w Apator SA koncentruje się na dwóch kluczowych obszarach: zadłużeniu technologicznym oraz zarządzaniu zmianą organizacyjną. Zadłużenie technologiczne, widoczne w przestarzałych systemach sterowania (PLC) i silosach danych między ERP, MES a PLM, stanowi fundamentalne zagrożenie dla płynności i jakości danych, które są paliwem dla AI. Równie istotne są wyzwania związane ze zmianą organizacyjną. Opór pracowników operacyjnych, brak odpowiednich kompetencji cyfrowych oraz niewystarczająca komunikacja wizji transformacji mogą skutecznie zablokować wdrożenie i adopcję nowych rozwiązań. Skuteczne zarządzanie tymi ryzykami, poprzez dedykowane programy modernizacji i kompleksowe strategie wdrażania zmian, jest warunkiem koniecznym sukcesu.

| Opis Ryzyka | Prawdopodobieństwo | Wpływ | Plan Mitigacji |
| --- | --- | --- | --- |
| Integracja z przestarzałymi systemami PLC nie powiodła się, uniemożliwiając pozyskanie danych o produkcji w czasie rzeczywistym. | Średnia | Wysoki | Wstępny audyt kompatybilności, zastosowanie bramek danych (data gateways), pilotaż w jednym segmencie produkcji. |
| Opór pracowników produkcyjnych wobec nowych systemów AI, postrzeganych jako narzędzie kontroli lub zagrożenie dla miejsc pracy. | Wysoka | Średni | Wczesne włączanie pracowników w projekt, transparentna komunikacja korzyści, programy szkoleń i systemy motywacyjne. |
| Niska jakość i niekompletność danych historycznych z systemów MES/ERP, prowadząca do niskiej dokładności modeli predykcyjnych. | Wysoka | Wysoki | Inicjatywa „Data Cleansing & Governance”, ustandaryzowanie punktów pobierania danych, wdrożenie procesów walidacji. |
| Wyciek wrażliwych danych produkcyjnych lub klientów podczas przetwarzania przez modele AI w chmurze. | Niska | Krytyczny | Architektura hybrydowa (on-premise dla kluczowych danych), rygorystyczne polityki bezpieczeństwa, audyty dostawców. |
| Niewystarczający zwrot z inwestycji (ROI) z pierwszych inicjatyw AI, prowadzący do utraty zaufania zarządu. | Średnia | Wysoki | Priorytetyzacja projektów o najszybszym zwrocie (quick wins), realisticzne modelowanie biznescase, ciągły monitoring KPI. |

## Recommended Initiatives

_Purpose: Substantive section "Recommended Initiatives" relevant to the document goal._

Nasza metodologia priorytetyzacji opiera się na dwuetapowym podejściu. W pierwszej kolejności skupiamy się na inicjatywach rozwiązujących kluczowe wąskie gardła danych, które stanowią fundament dla dalszych transformacji AI. Dopracowanie architektury danych i integracji systemów (ERP-MES-PLM) umożliwi efektywne wdrożenie kolejnych rozwiązań. W drugim etapie wybieramy przypadki użycia o najwyższym ROI i najszybszym czasie realizacji, gwarantującym szybkie zwroty z inwestycji i budowanie zaufania interesariuszy. Takie podejście minimalizuje ryzyko projektowe i maksymalizuje wartość biznesową w horyzoncie 18-24 miesięcy.

| Initiative Name | Description | Required Capabilities | Budget Estimate | Expected Kpi Improvement |
| --- | --- | --- | --- | --- |
| Predykcyjne utrzymanie ruchu | AI do przewidywania awarii maszyn na podstawie danych sensorowych i historii serwisowej | IoT platforma, analiza time-series, integracja z MES | 2.4M PLN | ↓ 15% przestoje, ↑ 25% MTBF |
| Wizyjna kontrola jakości | System computer vision do automatycznego wykrywania wad produktów na linii produkcyjnej | Kamery przemysłowe, deep learning, integracja z PLM | 1.8M PLN | ↑ 20% prędkość detekcji, ↓ 30% koszty reklamacji |
| Prognozowanie popytu | Model ML do prognozowania zapotrzebowania na produkty z wykorzystaniem danych SAP i rynkowych | Dane SAP, zewnętrzne API, modelowanie prognostyczne | 1.2M PLN | ↓ 10% koszty zapasów, ↑ 15% dostępność produktów |

## Implementation Roadmap

_Purpose: Substantive section "Implementation Roadmap" relevant to the document goal._

Strategia wdrożenia transformacji AI w Apator SA opiera się na trójfazowym podejściu, które minimalizuje ryzyko i maksymalizuje wartość biznesową. Faza 1 (Miesiące 1-6) skupia się na budowie fundamentów technologicznych oraz realizacji szybkich zwycięstw (quick wins) w obszarze kontroli jakości wizyjnej i podstawowej analityki danych. Faza 2 (Miesiące 7-15) koncentruje się na skalowaniu predyktywnego utrzymania ruchu oraz rozbudowie infrastruktury danych. Faza 3 (Miesiące 16-24) obejmuje zaawansowaną optymalizację procesów produkcyjnych, automatyzację ofertowania i wdrożenie kompleksowych modeli AI prognozowania popytu. Każda faza zawiera jasno zdefiniowane cele biznesowe, KPI i punkty kontrolne dla zapewnienia zgodności z strategicznymi priorytetami Apator SA.

- Miesiąc 3: Uruchomienie Data Lake z integracją danych produkcyjnych z MES i PLM
- Miesiąc 6: Wyniki pilotażowego wdrożenia kontroli jakości wizyjnej na linii produkcyjnej A
- Miesiąc 9: Zakończenie budowy fundamentów analitycznych i modeli bazowych predykcji awarii
- Miesiąc 12: Wdrożenie modelu predyktywnego utrzymania ruchu dla kluczowych maszyn produkcyjnych
- Miesiąc 18: Pełnoskalowe wdrożenie automatyzacji ofertowania z integracją SAP
- Miesiąc 24: Zakończenie fazy optymalizacji zaawansowanej i osiągnięcie pełnej dojrzałości AI

## Appendix

_Purpose: Substantive section "Appendix" relevant to the document goal._

- A. Detailed System Architecture Diagrams
- B. Interview Transcripts Summary
- C. Raw Data Quality Logs
- D. Vendor Evaluation Matrix


## Sources

- document: Apator SA — Raport roczny 2024 (apator-raport-2024)
- interview: Warsztaty diagnostyczne IT/OT (marzec 2026) (warsztaty-it-ot-2026)
- dataset: Inwentaryzacja systemów ICT — SAP/MES/PLM (inwentaryzacja-ict)