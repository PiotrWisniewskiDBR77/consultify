---
doc_id: macierz-tresc-komorek
status: canonical
truth_type: source-comparison
owner: piotr
established: 2026-08-30
zrodlo_nadrzedne: knowledge/DRD/extracted_content.txt (książka „Digital Pathfinder", Piotr Wiśniewski, PhD)
ekran: src/components/assessment/drd/DRDAssessmentEditor.tsx
poprzednik: docs/program/grafika/MACIERZ_DRD_AUDYT.md (audyt wizualny), docs/program/grafika/DRD_KSIAZKA_KONTRA_KOD.md (osie i skale)
---

# Macierz DRD — czym naprawdę jest treść komórki

## Po co ten dokument

Audyt (`MACIERZ_DRD_AUDYT.md`) ustalił, że komórki macierzy pokazują nieprawdę,
i wskazał dwa miejsca w kodzie jako przyczynę. **Nie odpowiedział na pytanie, co ma
być w komórce zamiast tego.** Ten dokument odpowiada — zestawiając trzy warstwy
obok siebie: **książkę właściciela · dane w kodzie · to, co realnie widać na ekranie**.

Tu **nie zmieniono ani jednej linii** w `src/`, `server/`, `dev-render/`.
To mapa dla następnego robotnika, nie wdrożenie.

## Jak to zmierzono (nie z opisów, z żywego kodu)

1. **Książka:** `knowledge/DRD/extracted_content.txt`, appendix od linii 449;
   oś 1 w liniach 502–933 (drabina 7 poziomów: 530–563, obszary 1A–1I: 566–933).
   Pomocniczo `knowledge/DRD/1. Digitlne processy.pdf` i `knowledge/tool-kb/drd/methodology/v1/`.
2. **Dane:** skrypt tymczasowy importujący **realny** `DRD_STRUCTURE` i **realny**
   `getDRDKnowledge()` — nie odczyt oczami z pliku. Wypisał wszystkie 63 komórki osi 1.
3. **Ekran:** ten sam skrypt **odtworzył dokładnie wyrażenie renderujące komórkę**
   z `DRDAssessmentEditor.tsx:860-890` (filtr `keyTechs` → `slice(0,2)` → fallback
   `title.split(' ').slice(0,3)`). Wynik zweryfikowany wzrokiem na zrzucie
   `evidence/106-macierz-audyt/os1__PRZED__light.png` — **zgodność komórka w komórkę**.

**Sprostowanie audytu przy okazji:** audyt pisze, że kolumna 1F to „siedem razy MES,
sześć z siedmiu komórek fałszywych". Pomiar mówi: **sześć razy dosłownie `MES`, a poziom 6
pokazuje `ERP · MES`**. Fałszywych wprost jest w 1F **pięć** (poziomy 1, 2, 3, 4, 7),
szósta (poziom 6) jest zanieczyszczona. Obraz jest równie zły, liczba była nieprecyzyjna.

---

# CZĘŚĆ 1 — co mówi książka. Oś 1, pełna siatka 9 × 7

Drabina osi 1 jest **wspólna dla wszystkich dziewięciu obszarów** — książka definiuje
ją raz (linie 530–563) i powtarza jako nagłówek `Level N.` w każdym obszarze:

| # | Nazwa poziomu wg książki | Czym jest ten poziom (książka, l. 530–563) |
| --- | --- | --- |
| 1 | **Basic Data Registration** | Wdrożono systemy zbierające i przechowujące podstawowe dane procesu; wprowadzanie ręczne albo przez dedykowaną aplikację. |
| 2 | **Workstation Control** | Narzędzia cyfrowe (soft i hard) na stanowiskach; wymuszają zgodność z opisem pracy i redukują błędy. |
| 3 | **Process Control** | Wszystkie stanowiska procesu spięte jednym systemem zarządzania i kontroli; planowanie, cele, ocena wyników. |
| 4 | **Automation** | Narzędzia automatyzujące zadania powtarzalne i krytyczne — roboty przemysłowe, coboty, AGV. |
| 5 | **Manufacturing Execution Systems (MES)** | Systemy zbierają, analizują i pokazują informacje w skali obszarów; wizualizacja wyników i KPI w czasie rzeczywistym. |
| 6 | **Enterprise Resource Planning (ERP)** | Procesy dzieją się niezależnie od decyzji operatora, wewnątrz zintegrowanego systemu; role zdefiniowane. |
| 7 | **AI Support Algorithms** | Algorytmy uczące się na danych własnych lub zewnętrznych, stale podnoszące precyzję i wydajność procesu. |

**To jest oś pionowa macierzy (etykieta wiersza) — nie treść komórki.**
Treścią komórki jest to, czym ten poziom **różni się w konkretnym obszarze**. Poniżej
9 tabel — po jednym zdaniu na każdą z 63 komórek, prosto z książki.

### 1A · Procesy sprzedaży (l. 566–605)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | Sprzedawcy rejestrują elektronicznie umowy i zamówienia w dedykowanym systemie. |
| 2 | Workstation Control | System raportowy automatycznie generuje raporty z kluczowymi wskaźnikami sprzedaży. |
| 3 | Process Control | Zautomatyzowana kontrola budżetu sprzedaży — system planuje i pilnuje budżetu wg parametrów. |
| 4 | Automation | Sklep online, marketplace, platforma DIY — klient kupuje bez udziału pracownika. |
| 5 | MES | MES raportuje dostawy i logistykę sprzedaży: statusy, terminy, przesyłki. |
| 6 | ERP | Zintegrowany ERP synchronizuje sprzedaż z zakupami, produkcją i finansami. |
| 7 | AI Support | Algorytmy personalizacji oferty, NLP w obsłudze klienta, boty sprzedażowe. |

### 1B · Procesy marketingowe (l. 606–651)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | **CRM** rejestruje dane klienta: kontakty, historię interakcji, preferencje. |
| 2 | Workstation Control | CRM spięty z narzędziami analitycznymi mierzy skuteczność działań marketingowych. |
| 3 | Process Control | SEO i Google Analytics — widoczność w wyszukiwarce i monitoring ruchu/zachowań. |
| 4 | Automation | E-marketing: newslettery, kampanie mailowe, personalizacja wg scenariuszy i segmentów. |
| 5 | MES | MES mierzy konwersję na etapach lejka i punktuje leady wg ich aktywności. |
| 6 | ERP | ERP integruje marketing z resztą firmy: kampanie, dane klientów, analiza wyników. |
| 7 | AI Support | Chatboty i generowanie treści na NLP — szybka odpowiedź i treść personalizowana. |

### 1C · Technologia procesowa i R&D (l. 652–700)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | **CAD** zapisuje podstawowe dane zaprojektowanych rozwiązań technologicznych. |
| 2 | Workstation Control | Symulacje cyfrowe procesów i pracy maszyn pozwalają analizować i kontrolować stanowiska. |
| 3 | Process Control | **FMEA** — identyfikacja potencjalnych błędów, skutków i planów działań zapobiegawczych. |
| 4 | Automation | Druk 3D, VR/AR — szybkie prototypy, weryfikacja projektu, symulacja i szkolenia. |
| 5 | MES | MES prowadzi projekty technologiczne; w rozwoju technologii **Digital Twin jest narzędziem klasy MES**. |
| 6 | ERP | ERP zarządza procesami technologicznymi i wymienia dane o czasach cyklu (wycena, projekt, realizacja). |
| 7 | AI Support | Algorytmy optymalizują technologię, generują propozycje ulepszeń, wskazują obiecujące kierunki badań. |

### 1D · Procesy zakupowe (l. 701–740)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | Cyfrowa rejestracja danych transakcyjnych: dostawcy, produkty, ilości, ceny. |
| 2 | Workstation Control | **MRP** — planowanie zapotrzebowania materiałowego i optymalne plany zamówień. |
| 3 | Process Control | Zautomatyzowany **workflow** obiegu zakupu: złożenie → akceptacja → realizacja → rozliczenie. |
| 4 | Automation | Platformy zakupowe i aukcyjne **B2B**: zamówienia elektroniczne, negocjacje, porównanie ofert. |
| 5 | MES | Systemy klasy MES monitorują KPI zakupowe: koszty, terminy, jakość dostaw, skuteczność negocjacji. |
| 6 | ERP | ERP harmonogramuje zamówienia, śledzi dostawy, obsługuje płatności, integruje z resztą firmy. |
| 7 | AI Support | Algorytmy predykcyjne prognozują ceny surowców i wspierają negocjacje z dostawcami. |

### 1E · Procesy logistyczne (l. 741–783)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | Skanery **RFID / kodów kreskowych** rejestrują lokalizację i identyfikację materiału. |
| 2 | Workstation Control | Lokalizacja w czasie rzeczywistym i **terminale mobilne** do kontroli stanowisk magazynowych. |
| 3 | Process Control | **WMS** nadzoruje przepływ materiału, **EDI** usprawnia wymianę danych z partnerami. |
| 4 | Automation | **AGV** przewożą towar samodzielnie; robotyzacja kompletacji, załadunku i rozładunku. |
| 5 | MES | MES + zaawansowany WMS zintegrowany z **Milkrun / Kanban** optymalizują zapasy i transport wewnętrzny. |
| 6 | ERP | ERP zarządza logistyką: śledzenie towaru, magazyn, zamówienia, integracja z resztą firmy. |
| 7 | AI Support | Algorytmy prognozują popyt, optymalizują poziomy zapasu i rozmieszczenie towaru w magazynie. |

### 1F · Procesy produkcyjne (l. 784–824)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | System **monitoringu i rejestracji danych z maszyn**: czasy pracy, parametry, wydajność, jakość. |
| 2 | Workstation Control | **PLC, sensory i detektory** kontrolują temperaturę, ciśnienie, prędkość i pracę maszyn. |
| 3 | Process Control | **CMMS**, analiza **OEE** i **VSM** — utrzymanie ruchu, efektywność maszyn, mapowanie strumienia wartości. |
| 4 | Automation | **Roboty przemysłowe** i automatyzacja operacji powtarzalnych — wydajność i eliminacja błędu ludzkiego. |
| 5 | MES | **MES na liniach produkcyjnych**: planowanie, zlecenia, śledzenie materiału, kontrola jakości, raportowanie. |
| 6 | ERP | ERP integruje produkcję z planowaniem zasobów, zakupami i sprzedażą. |
| 7 | AI Support | Algorytmy optymalizują plany produkcji i balansują obciążenie linii, m.in. na danych z **digital twin**. |

### 1G · Procesy jakości (l. 825–866)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | **Elektroniczne karty zgodności** — parametry jakościowe, wyniki pomiarów, testy. |
| 2 | Workstation Control | Kontrola jakości **wbudowana w maszyny**: kamery, sensory, analizatory mierzą w czasie rzeczywistym. |
| 3 | Process Control | **Centralny system reakcji na wady**: wykrycie, alert, powiadomienie, działanie korygujące. |
| 4 | Automation | **Roboty i systemy wizyjne** badają jakość automatycznie — wady, wymiary, cechy powierzchni. |
| 5 | MES | **QMS** kontroluje jakość na etapach produkcji: dokumentacja, planowanie, testy, raporty stabilności. |
| 6 | ERP | ERP włącza jakość do reszty firmy: dokumentacja, kontrola procesu, obsługa reklamacji. |
| 7 | AI Support | Algorytmy wyznaczają **zakres** kontroli jakości — które partie wymagają badania szczegółowego. |

### 1H · Zarządzanie finansami (l. 867–904)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | **OCR** i elektroniczny obieg dokumentów wyciągają dane z faktur i umów. |
| 2 | Workstation Control | Narzędzia **kontrolingu finansowego (FC)** monitorują budżety, koszty, rentowność, wskaźniki. |
| 3 | Process Control | **Systemy akceptacji decyzji** koordynują obieg decyzji finansowych i ocenę ryzyka na szczeblach. |
| 4 | Automation | **RPA** automatyzuje powtarzalne zadania: księgowanie faktur, generowanie raportów, analizy. |
| 5 | MES | **Workflow Management Systems** optymalizują procesy finansowe: akceptacja płatności, rozliczanie kosztów. |
| 6 | ERP | ERP daje kontrolę finansową, integrację procesów i dostęp do danych w czasie rzeczywistym. |
| 7 | AI Support | Algorytmy AI i **BI** analizują dane finansowe, raportują, prognozują, wspierają decyzje. |

### 1I · Procesy HR (l. 905–933)

| # | Poziom | Czym jest w tym obszarze |
| --- | --- | --- |
| 1 | Basic Data Registration | **Elektroniczne karty pracy** rejestrują godziny, obecność, dane czasu pracy. |
| 2 | Workstation Control | Systemy **płacowe**: wynagrodzenia, listy płac, deklaracje podatkowe. |
| 3 | Process Control | Rejestracja czasu pracy i obecności — karty zbliżeniowe, **czytniki biometryczne**, aplikacje mobilne. |
| 4 | Automation | **E-kioski i aplikacje webowe** — pracownik sam zarządza danymi, wnioskuje o urlop, sięga po dokumenty. |
| 5 | MES | **HRM** — dane osobowe, oceny, planowanie szkoleń, wynagrodzenia i benefity, zarządzanie karierą. |
| 6 | ERP | Zintegrowany ERP z modułami HR centralizuje dane kadrowe. |
| 7 | AI Support | Algorytmy wspierają rekrutację, zarządzanie talentami, analizę danych HR i planowanie rozwoju. |

**Wniosek z Części 1, kluczowy dla projektu:** w każdym obszarze książka podaje
**jedną wiodącą technologię albo jeden wyróżnik** na poziom (pogrubione wyżej).
Poziom nazywa się wszędzie tak samo; **różnica mieszka w technologii**.

---

# CZĘŚĆ 2 — co jest w kodzie

## 2.1. Drabina poziomów — `src/services/drdStructure.ts` — WIERNA ✔

Wszystkie 9 obszarów osi 1 ma w SSOT te same 7 tytułów, dokładnie z książki:
`Basic Data Registration · Workstation Control · Process Control · Automation ·
MES · ERP · AI Support`. Zmierzone: **na każdym z 7 poziomów liczba unikalnych
tytułów w 9 obszarach = 1**. Opisy (`DRDLevel.description`) są przepisane z książki
niemal dosłownie i **różnią się między obszarami** — to one niosą sens.

**To jest jednocześnie najważniejsze ograniczenie projektowe:**
tytuł poziomu **nie może być treścią komórki**, bo dałby 9 identycznych kolumn.
Dowód nie hipotetyczny — kolumny **1C i 1I są dziś dokładnie tym** (patrz Część 3):
siedem komórek = siedem nazw drabiny, obie kolumny identyczne co do znaku.

## 2.2. Nakładki wiedzy — `drdKnowledgeOverridesAxis1And2.ts` — BOGATE, prawie wierne ✔

Każda para obszar#poziom ma `suggestedTechnologies: string[]`. Lista jest
**uporządkowana: na pozycji 0 stoi wiodąca technologia poziomu**, dalej kontekst.
Zweryfikowane na trafieniach książkowych: `1D#2 → MRP`, `1E#3 → WMS`, `1F#3 → CMMS`,
`1H#4 → RPA`, `1H#5 → Workflow Management`, `1A#7 → NLP`, `1C#4 → 3D Printing`,
`1G#4 → Machine Vision`, `1I#3 → Biometric Readers`. **To dokładnie te słowa,
które książka stawia na tych poziomach.**

**Trzy wpisy mają na pozycji 0 termin z innego poziomu** (jedyne błędy danych, jakie
znalazłem na osi 1):

| Wpis | Dziś `techs[0]` | Książka na tym poziomie | Uwaga |
| --- | --- | --- | --- |
| `1A#1` | `CRM` | rejestracja umów i zamówień | CRM wchodzi u autora dopiero w 1B#1 (marketing) |
| `1A#2` | `CRM` | system raportowy sprzedaży | jw. |
| `1F#4` | `PLC` | roboty przemysłowe, automatyzacja | `PLC` należy do 1F#2; `Cobots` z tej samej listy byłoby trafne |

Reszta list (60/63) ma na pozycji 0 termin zgodny z książką.

## 2.3. Fabryka domyślna — `drdKnowledge.ts:36-…` — pochodna, nie autorska

Tam, gdzie nie ma nakładki, technologie **wywodzone są regexem z opisu poziomu**
(`TECH_RULES`). Komentarz w pliku jest uczciwy i wyjaśnia dlaczego („derive …
primarily from the LEVEL DESCRIPTION … not only from the level title"). Na osi 1
nakładki pokrywają wszystko, więc fabryka nie ma tu wpływu; ma na innych osiach.

## 2.4. Rozjazd: nazwy poziomów po polsku nie istnieją

`DRDLevel` nie ma pól `titlePL` / `descriptionPL`. Nazwy osi i obszarów mają `namePL`,
poziomy — nie. To osobna dziura (opisana w audycie jako 4.4/4.5), niezależna od tego
dokumentu, ale wchodzi w drogę każdej naprawie treści komórki po polsku.

---

# CZĘŚĆ 3 — trzy kolumny: książka · dane · ekran

Kolumna **EKRAN** to nie odczyt z oka — to wynik odtworzenia wyrażenia
z `DRDAssessmentEditor.tsx:860-890`, zweryfikowany na `os1__PRZED__light.png`.

Legenda werdyktu:
**✔ PRAWDA** — to, co widać, książka stawia na tym poziomie ·
**~ ZANIECZYSZCZONA** — pierwszy człon prawdziwy, drugi z innego poziomu ·
**✘ FAŁSZ** — nic z tego, co widać, nie należy do tego poziomu.

| Obszar#poz. | KSIĄŻKA (klucz) | DANE `suggestedTechnologies` (kolejność) | EKRAN dziś | |
| --- | --- | --- | --- | --- |
| 1A#1 | rejestracja umów/zamówień | CRM, Order Management System, Contract & Order Registry | `CRM` | ✘ |
| 1A#2 | system raportowy sprzedaży | CRM, Reporting, KPI Dashboards, … | `CRM` | ✘ |
| 1A#3 | kontrola budżetu sprzedaży | Budgeting, Forecasting, Financial Planning, **CRM**, … | `CRM` | ✘ |
| 1A#4 | sklep online / marketplace | E-commerce Platform, Marketplace Integration, … | `Automation` | ✔ (nazwa poziomu) |
| 1A#5 | MES do raportowania dostaw | MES, WMS, CRM, … | `MES · WMS` | ~ |
| 1A#6 | zintegrowany ERP | ERP, MDM, API Integration, Order Management, **CRM** | `ERP · CRM` | ~ |
| 1A#7 | **AI, personalizacja, NLP, boty** | NLP, Chatbots, ML Models, **CRM**, … | **`CRM`** | **✘** |
| 1B#1 | CRM | CRM, Contact Management, CDP | `CRM` | ✔ |
| 1B#2 | CRM + analityka | CRM, Marketing Automation, … | `CRM` | ✔ |
| 1B#3 | SEO, Google Analytics | SEO Toolkit, Google Analytics, … | `Process Control` | ✔ (nazwa poziomu) |
| 1B#4 | e-marketing, newslettery | Email Marketing, Campaign Automation, …, **CRM** | `CRM` | ✘ |
| 1B#5 | MES mierzy konwersję | MES, CRM, Marketing Automation, … | `MES · CRM` | ~ |
| 1B#6 | ERP | ERP, **CRM**, … | `ERP · CRM` | ~ |
| 1B#7 | chatboty, NLP | NLP, Chatbots, Content Generation, … | `AI Support` | ✔ (nazwa poziomu) |
| 1C#1 | CAD | CAD, PLM/PDM, Design Data Management | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1C#2 | symulacje | CAD, Simulation Tools, PLM/PDM, Digital Twin | `Workstation Control` | ✔ (nazwa poziomu) |
| 1C#3 | FMEA | FMEA, Risk Register, CAPA | `Process Control` | ✔ (nazwa poziomu) |
| 1C#4 | druk 3D, VR/AR | 3D Printing, Rapid Prototyping, …, VR, AR | `Automation` | ✔ (nazwa poziomu) |
| 1C#5 | MES / Digital Twin | MES, Digital Twin, Simulation Models, PLM/PDM | `MES` | ✔ |
| 1C#6 | ERP | ERP, PLM/PDM, API Integration, MDM | `ERP` | ✔ |
| 1C#7 | algorytmy AI | Digital Twin, ML Models, Simulation Models, IoT Data Feeds | `AI Support` | ✔ (nazwa poziomu) |
| 1D#1 | dane transakcyjne | Supplier Registry, Purchase Orders, **MRP**, … | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1D#2 | **MRP** | MRP, Inventory Planning, …, **ERP** | **`ERP`** | **✘** |
| 1D#3 | workflow zakupowy | Workflow Management, Approval Flows, **ERP**, … | `ERP` | ✘ |
| 1D#4 | platformy B2B / aukcje | B2B Procurement Platform, e-Auctions, Supplier Portal, **EDI** | `EDI` | ✘ |
| 1D#5 | MES + KPI zakupowe | MES, KPI Dashboards, Reporting, Supplier Portal, **ERP** | `MES · ERP` | ~ |
| 1D#6 | ERP | ERP, MDM, API Integration, MRP | `ERP` | ✔ |
| 1D#7 | **algorytmy predykcyjne cen** | ML Models, Forecasting, **ERP**, … | **`ERP`** | **✘** |
| 1E#1 | RFID / kody kreskowe | Barcode Scanners, RFID, Label Printers, … | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1E#2 | terminale mobilne, RTLS | Mobile Terminals, Real-time Location, …, **WMS** | `WMS` | ✘ (WMS to poziom 3) |
| 1E#3 | **WMS + EDI** | WMS, EDI, B2B Integration, … | `WMS · EDI` | ✔ **trafienie idealne** |
| 1E#4 | AGV, robotyzacja | AGV, Warehouse Robotics, Route Optimization, **WMS** | `AGV · WMS` | ~ |
| 1E#5 | **MES + WMS + Milkrun/Kanban** | MES, WMS, SCADA, … | `MES · WMS` | ✔ |
| 1E#6 | ERP | ERP, **WMS**, MDM, API Integration | `ERP · WMS` | ~ |
| 1E#7 | **AI: prognoza popytu, zapasy** | ML Models, **WMS**, Forecasting, **AGV**, … | **`WMS · AGV`** | **✘** |
| 1F#1 | monitoring danych z maszyn | Machine Data Logging, PLC & Sensors, **MES**, SCADA | `MES` | ✘ |
| 1F#2 | PLC, sensory, detektory | PLC, Sensors, Industrial Detectors, SCADA, **MES** | `MES` | ✘ |
| 1F#3 | CMMS, OEE, VSM | CMMS, OEE Dashboard, VSM, **MES**, SCADA | `MES` | ✘ |
| 1F#4 | roboty przemysłowe | PLC, **MES**, Cobots, Robot Safety Systems, … | `MES` | ✘ |
| 1F#5 | **MES** | MES, SCADA, OEE Dashboard, PLC, Sensors | `MES` | ✔ |
| 1F#6 | ERP | ERP, **MES**, MDM, API Integration, SCADA | `ERP · MES` | ~ |
| 1F#7 | **AI, digital twin** | Digital Twin, ML Models, **MES**, … | `MES` | ✘ |
| 1G#1 | elektroniczne karty zgodności | Compliance Sheets, Inspection Records, QMS | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1G#2 | kamery, sensory w maszynach | Machine Vision, Cameras, Automated Inspection, QMS, **MES** | `MES` | ✘ |
| 1G#3 | centralny system reakcji na wady | QMS, CAPA, **MES**, Reporting | `MES` | ✘ |
| 1G#4 | roboty i systemy wizyjne | Machine Vision, Cameras, …, QMS, **MES** | `MES` | ✘ |
| 1G#5 | **QMS** (poziom nazwany „MES") | QMS, Quality Planning, Inspection Reporting, **MES**, … | `MES` | ✔ (nazwa poziomu) |
| 1G#6 | ERP | ERP, QMS, CAPA, Reporting | `ERP` | ✔ |
| 1G#7 | **AI wyznacza zakres kontroli** | ML Models, QMS, **MES**, Machine Vision, … | `MES` | ✘ |
| 1H#1 | OCR, obieg dokumentów | OCR, Document Management, Invoice Capture, … | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1H#2 | kontroling finansowy (FC) | **BI**, Data Warehouse, Reporting, … | `BI` | ✘ (BI to poziom 7) |
| 1H#3 | systemy akceptacji decyzji | Workflow Management, Approval Flows, **ERP**, … | `ERP` | ✘ |
| 1H#4 | **RPA** | RPA, Invoice Processing, AP Automation, … | `RPA` | ✔ **trafienie idealne** |
| 1H#5 | **Workflow Management Systems** | Workflow Management, Approval Flows, **ERP**, Reporting | **`ERP`** | **✘** |
| 1H#6 | ERP | ERP, Budgeting, Financial Planning, … | `ERP` | ✔ |
| 1H#7 | AI + **BI** | BI, ML Models, Data Warehouse, Forecasting, … | `BI` | ✔ |
| 1I#1 | elektroniczne karty pracy | Biometric Readers, Time & Attendance, …, HRM | `Basic Data Registration` | ✔ (nazwa poziomu) |
| 1I#2 | systemy płacowe | Payroll System, Tax Declarations, …, HRM | `Workstation Control` | ✔ (nazwa poziomu) |
| 1I#3 | czytniki biometryczne, RCP | Biometric Readers, Time & Attendance, …, HRM | `Process Control` | ✔ (nazwa poziomu) |
| 1I#4 | e-kioski, aplikacje web | Employee Kiosk, Self-Service HR Portal, …, HRM | `Automation` | ✔ (nazwa poziomu) |
| 1I#5 | **HRM** | HRM, Training Planning, Performance Reviews | `MES` | ✔ (nazwa poziomu) |
| 1I#6 | ERP | ERP, HRM, Payroll System, API Integration | `ERP` | ✔ |
| 1I#7 | AI w rekrutacji i rozwoju | ML Models, HRM, NLP, … | `AI Support` | ✔ (nazwa poziomu) |

## 3.1. Rachunek — policzone, nie oszacowane

| | liczba | udział |
| --- | ---: | ---: |
| komórek osi 1 razem | **63** | 100% |
| **✘ FAŁSZ** — pokazana technologia nie należy do tego poziomu | **23** | **37%** |
| ~ ZANIECZYSZCZONA — pierwszy człon prawdziwy, drugi z innego poziomu | 8 | 13% |
| ✔ PRAWDA | 32 | 50% |
| …z tego **sama nazwa poziomu** (prawda, ale zero informacji o obszarze) | 18 | 29% |
| …z tego **trafiona technologia obszaru** (prawda i informacja) | **14** | **22%** |

Fałsz per kolumna: **1F — 5** · **1A, 1D, 1G — po 4** · **1H — 3** · **1E — 2** ·
**1B — 1** · **1C, 1I — 0**.

**Do tego 7 z 7 etykiet wierszy jest zmyślonych** (`Basic / Manual · Digitized ·
Integrated · Automated · Optimized · AI-Driven · Autonomous` zamiast drabiny z SSOT).
Razem na ekranie osi 1 stoi **30 nieprawdziwych podpisów: 23 komórki + 7 etykiet wierszy**.

## 3.2. Gdzie dokładnie urywa się łańcuch

```
KSIĄŻKA                    →  SSOT drdStructure.ts  →  nakładki wiedzy  →  EKRAN
7 nazw poziomów            →  te same 7 nazw ✔      →  —               →  ✘ ZASTĄPIONE
                                                                          zaszytą tablicą :776 / :2051
technologia obszaru+poziomu →  (nie ma w SSOT)      →  techs[0] ✔ 60/63 →  ✘ ODFILTROWANE
                                                                          białą listą 16 skrótów :862 / :2120
opis poziomu               →  description ✔        →  example ✔        →  ✔ dociera (popover)
```

**Dane są w porządku. Wszystko psuje się w ostatnim kroku, w dwóch miejscach
komponentu — i oba są zdublowane w kopii pełnoekranowej.**

## 3.3. Trzecia, niezauważona awaria: kolumny nieodróżnialne

| kolumna | ile RÓŻNYCH treści na 7 komórek |
| --- | ---: |
| 1F Produkcja | **2** (`MES`, `ERP · MES`) |
| 1G Jakość | 3 |
| 1A Sprzedaż · 1D Zakupy · 1H Finanse | po 4 |
| 1B Marketing | 5 |
| 1C R&D · 1E Logistyka · 1I HR | 7 |

Ale 1C i 1I mają „siedem różnych" **tylko dlatego, że pokazują drabinę** — obie kolumny
są **znak w znak identyczne**. Realnie **odróżnialna jest jedna kolumna z dziewięciu: 1E**.

---

# CZĘŚĆ 4 — czym powinna być treść komórki

## 4.1. Werdykt o filtrze 16 skrótów: autor miał rację co do problemu, pomylił się co do narzędzia

Komentarze w kodzie (`:860-861`, jedyne w tym miejscu):

```
{/* Ultra-simple cell: just 2-3 keywords */}
// Prefer key technologies, fallback to short title
```

**Uzasadnienie było i jest nadal aktualne.** Komórka ma zmierzone **150 px**
(`gridTemplateColumns: 240px repeat(N, minmax(150px, 1fr))`, `:771`; w trybie
pełnoekranowym 180 px, `:2046`), czcionka 11 px — mieści około 22–24 znaków w linii.
Lista `suggestedTechnologies` zawiera wpisy w rodzaju `Value Stream Mapping (VSM)`,
`Corrective Action Tracking (CAPA)`, `Master Data Management (MDM)`,
`Customer Data Platform (CDP)` — wrzucone wprost rozwaliłyby siatkę. Autor potrzebował
**reguły długości** i chciał terminów natychmiast rozpoznawalnych. To jest słuszne.

**Błąd jest w instrumencie, nie w intencji.** Zamiast reguły „**krótkie**" wpisano
regułę „**z listy 16**", a to zachowuje się inaczej w dwóch miejscach:

1. **Ignoruje pozycję na liście.** `filter()` bierze skrót z dowolnego miejsca, więc
   końcowe `CRM` w `1A#7 = [NLP, Chatbots, ML Models, CRM, …]` bije wiodące `NLP`.
   Tak powstaje najgorsza komórka ekranu: **szczyt drabiny AI pokazuje CRM**.
2. **Ten sam skrót powtarza się w listach wielu poziomów jednego obszaru** — bo listy
   są kontekstem poziomu, nie etykietą. `MES` występuje w 6 z 7 list obszaru 1F
   (całkiem zasadnie: dane z maszyn *zasilają* MES). Filtr zamienia zasadny kontekst
   w siedem identycznych podpisów.

**Filtr trzeba usunąć, ale jego cel — nie.** Zastąpić go regułą, którą autor faktycznie
opisał: *„jedno krótkie, rozpoznawalne słowo"*.

## 4.2. Co odpada i dlaczego

| Kandydat | Werdykt |
| --- | --- |
| **Nazwa poziomu z metodyki** (`Automation`, `MES`) | ✘ **Odpada jako treść komórki.** Na osi 1 wszystkie 9 obszarów ma te same 7 nazw — dałoby to 9 identycznych kolumn i macierz bez informacji. Dowód na żywym ekranie: kolumny 1C i 1I są dziś dokładnie tym. To samo na osiach 2 i 3 (patrz Część 5). **Nazwa poziomu należy do etykiety wiersza** — tam dziś stoi zmyślenie. |
| **Nazwa poziomu + technologia razem** | ✘ Nazwa poziomu w komórce jest redundantna względem etykiety wiersza, którą czytelnik ma w tym samym rzędzie. Przy 150 px kosztowałaby połowę miejsca i wymusiła ucięcie technologii. |
| **Dwie technologie przez `·`** (dziś) | ✘ Kropka czyta się jak „i", sugerując równorzędną parę, której książka nie stawia. Dwa terminy przy 150 px prawie zawsze wymuszają łamanie albo ucięcie. To jest źródłem wszystkich 8 komórek zanieczyszczonych. |
| **Pełny opis / pierwsze 3 słowa tytułu** | ✘ Zmierzone urwańce: `Ethical, Transparent &`, `Centralized Data &`, `AI as a` (defekt B4 audytu). |

## 4.3. Rekomendacja

> **Komórka niesie JEDEN termin: wiodącą technologię (albo wyróżnik) tego obszaru
> na tym poziomie — z książki. Nazwa poziomu przenosi się na etykietę wiersza.
> Cała reszta zostaje w popoverze.**

Technicznie to `suggestedTechnologies[0]` — pozycja, na którą autorzy nakładek
konsekwentnie wstawiali termin wiodący (zweryfikowane: 60/63 wpisów osi 1 zgodne
z książką).

**Reguła długości zamiast białej listy** — ta, którą autor filtra chciał napisać:

1. jeśli termin zawiera skrót w nawiasie, pokaż **sam skrót**
   (`Value Stream Mapping (VSM)` → `VSM`, `Customer Data Platform (CDP)` → `CDP`,
   `Corrective Action Tracking (CAPA)` → `CAPA`) — to obsługuje wszystkie długie wpisy w danych;
2. resztę pokaż w całości z `line-clamp-2` i pełną treścią w `title=`;
3. **żadnego łączenia dwóch terminów.**

Po tej regule najdłuższy termin na osi 1 ma **24 znaki** (`B2B Procurement Platform`),
na osiach 2–3 **31** (`Contract Performance Management`) — mieści się w dwóch liniach
przy 150 px. Ucięcie przestaje być regułą, staje się wyjątkiem.

**Dlaczego to wystarcza:** komórka nie musi nieść wszystkiego, bo klik otwiera popover
z pełnym opisem poziomu, przykładem dowodu i **całą listą technologii**. Komórka musi
tylko (a) **nie kłamać**, (b) pozwolić przejechać wzrokiem kolumnę i zobaczyć **drogę
rozwoju obszaru** — a tego dziś nie robi ani razu poza 1E.

### Jak wygląda kolumna 1F po tej zmianie

| poziom | dziś | po zmianie |
| --- | --- | --- |
| 7 AI Support | `MES` | `Digital Twin` |
| 6 ERP | `ERP · MES` | `ERP` |
| 5 MES | `MES` | `MES` |
| 4 Automation | `MES` | `Cobots` *(wymaga poprawki danych `1F#4`)* |
| 3 Process Control | `MES` | `CMMS` |
| 2 Workstation Control | `MES` | `PLC` |
| 1 Basic Data Registration | `MES` | `Machine Data Logging` |

Z dwóch różnych treści robi się siedem, wszystkie z książki.

## 4.4. Trzy poprawki danych, które trzeba zrobić razem ze zmianą

Bez nich zostaną **trzy** fałszywe komórki na 63 (zamiast 23):

| Wpis w `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2.ts` | jest | ma być na pozycji 0 |
| --- | --- | --- |
| `1A#1` | `['CRM', 'Order Management System', …]` | `Order Management System` (książka: rejestracja umów i zamówień; CRM należy do 1B#1) |
| `1A#2` | `['CRM', 'Reporting', 'KPI Dashboards', …]` | `Reporting` albo `KPI Dashboards` (książka: system raportowy sprzedaży) |
| `1F#4` | `['PLC', 'MES', 'Cobots', …]` | `Cobots` albo `Industrial Robots` (książka: roboty przemysłowe; `PLC` to poziom 2) |

Te same wpisy poprawić w wariancie `.en.ts`, jeśli mają tam własne listy.

---

# CZĘŚĆ 5 — osie 2 i 3. Werdykt: to NIE jest dziura w danych

Audyt (§4.4) zapisał: *„osie 2 i 3 mają identyczne tytuły poziomów dla wszystkich
obszarów … dziura w danych, do rozstrzygnięcia z książką"*.
**Zweryfikowałem to w książce. Wniosek audytu jest błędny i trzeba go wycofać.**

## 5.1. Fakt z danych (potwierdzony)

Zmierzone na realnym `DRD_STRUCTURE`:

| | tytuły poziomów | opisy poziomów |
| --- | --- | --- |
| oś 2 (5 obszarów × 5 poziomów) | **1 unikalny na każdym poziomie** (identyczne) | **5/5 unikalnych na każdym poziomie** |
| oś 3 (5 × 5) | 1 unikalny na poziomach 1,2,3,5; **2 na poziomie 4** | **5/5 unikalnych na każdym poziomie** |

## 5.2. Fakt z książki — autor zrobił to celowo i napisał dlaczego

Oś 2, `extracted_content.txt:1030-1035`, słowa autora:

> „Due to the wide variety of assessment areas, it was not feasible to assign
> universally descriptive names to the various stages of digital development.
> Thus, the progression … is described simply in terms of advancement from a basic
> level to an expert level."

Oś 3 (l. 1288–1292) trzyma tę samą skalę Basic → Expert. **Kod jest wierny do detalu**:
odtwarza nawet dwa wyjątki, które książka robi na poziomie 4 osi 3 —
`3A → Advanced personalization` (l. 1320) i `3B → Advanced SEM` (l. 1366).

**Nie ma czego wypełnić z książki. Danych nie brakuje — brakuje ich użycia.**

## 5.3. Prawdziwa przyczyna jest ta sama co na osi 1

Macierz osi 2 i 3 jest pusta znaczeniowo nie dlatego, że dane są ubogie, tylko dlatego,
że **fallback pokazuje tytuł poziomu**, który u autora z definicji nie różnicuje.
Różnicujące treści są na wyciągnięcie ręki:

| | `techs[0]` dziś w danych | ile różnych na 25 komórek |
| --- | --- | ---: |
| oś 2 | `E-commerce Platform`, `Community Platform`, `CDP`, `Segmentation Engine`, `Global CDN`, … | **25/25** |
| oś 3 | `B2B Platform`, `Subscription Management`, `Usage Metering`, `Data Marketplace`, `Data Mesh`, … | **25/25** |

Do tego filtr skrótów robi tam własne szkody: `2C#1`, `2C#3`, `2C#4`, `2D#2`, `2D#3`,
`2D#4`, `3E#1` pokazują dziś `CRM` — siedem komórek złapanych na jedno słowo,
dokładnie tak jak `MES` na osi 1.

**Werdykt: jedna zmiana w komponencie naprawia osie 1, 2 i 3 naraz.
Osie 2 i 3 nie wymagają żadnej pracy nad danymi ani pytania do właściciela.**

---

# INSTRUKCJA WDROŻENIOWA dla następnego robotnika

**Kolejność jest obowiązkowa. Kroku 0 nie wolno pominąć** — każda zmiana niżej
musiałaby inaczej być zrobiona dwa razy (defekt C10 audytu).

> ### ⚠ UWAGA O NUMERACH LINII — czytaj przed szukaniem
> Numery `:776` / `:862` / `:2051` / `:2120` w tym dokumencie i w `MACIERZ_DRD_AUDYT.md`
> pochodzą ze stanu z 2026-08-30 rano. **Równolegle trwa polerowanie tego pliku
> (`evidence/grafika/109-macierz-polerowanie/`) i numery już się przesunęły.**
> Zmierzone w trakcie pisania tego dokumentu: **duplikat macierzy został już usunięty**
> — `levelLabels` i `keyTechs` występują w pliku **po jednym razie** (były po dwa).
> **Szukaj po symbolach `levelLabels` i `keyTechs`, nie po numerach.**
> Numery zostawione w Częściach 1–4 służą jako dowód pomiaru, nie jako adres do edycji.

## Krok 0 (warunek wstępny) — usunąć duplikat macierzy

`DRDAssessmentEditor.tsx` trzymał **dwie niezależne kopie** tej samej siatki: widok
zwykły i pełnoekranowy. **Sprawdź `grep -c "keyTechs = \["` — jeśli wynik to `1`,
krok 0 jest już zrobiony** (tak było w chwili pisania) i przechodzisz dalej.
Jeśli `2` — najpierw wyciągnij siatkę do jednego komponentu wewnątrz pliku,
parametryzowanego szerokością kolumny (`minmax(150px)` vs `minmax(180px)`)
i wariantem podpisu. **Kryterium odbioru: zrzut przed/po identyczny piksel w piksel.**

## Krok 1 — etykieta wiersza z metodyki (naprawia 7 z 7 podpisów)

**Plik:** `DRDAssessmentEditor.tsx`, blok `const levelLabels: Record<number, string>`
(w chwili pisania **jedno wystąpienie, ok. `:231`**).

Usunąć zaszytą tablicę `levelLabels` (`Basic / Manual … Autonomous`).
Etykietę brać z SSOT — dokładnie tak, jak już robi popover:
`axis.areas[0].levels.find(l => l.level === n)?.title`, fallback `Level ${n}`.
Na osi 1 wszystkie obszary mają tę samą drabinę (zmierzone: 1 unikalny tytuł na poziom),
więc `areas[0]` jest bezpieczne; na osi 3 poziom 4 różni się między obszarami —
tam etykietą wiersza ma być wariant **najczęstszy** (`Advanced personalization`),
a nie `areas[0]`.

**Efekt:** wiersz „6. AI-Driven" nad komórkami `ERP` znika; wiersze mówią
`1. Basic Data Registration … 7. AI Support`.

## Krok 2 — treść komórki (naprawia 23 komórki osi 1 + 7 na osiach 2–3)

**Plik:** `DRDAssessmentEditor.tsx`, blok `const keyTechs = [` … `displayContent`
(w chwili pisania **jedno wystąpienie, ok. `:283`**).

1. **Usunąć całą tablicę `keyTechs` i `filter(...)`.**
2. Treść komórki = `techs[0]`, po przepuszczeniu przez regułę skracania:
   jeśli termin pasuje do `/^(.+)\s\(([A-Z0-9/]{2,6})\)$/` — pokazać sam skrót z nawiasu;
   w przeciwnym razie cały termin.
3. **Fallback bez `slice(0, 3)`:** gdy `techs` puste — pełny `areaLevelInfo.title`,
   nie trzy pierwsze słowa (naprawia B4: `Centralized Data &`). Uwaga: równoległy
   robotnik dopisał już do tego miejsca wielokropek (`+ (titleWords.length > 3 ? '…' : '')`)
   — to łagodzi objaw, ale nadal ucina; docelowo ma zostać pełny tytuł z `line-clamp-2`.
4. `line-clamp-2` na treści + `title={pełny termin}` na elemencie.
5. **Nie łączyć dwóch terminów.** `·` znika z komórki.

## Krok 3 — trzy poprawki danych

**Plik:** `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2.ts`
(oraz `.en.ts`, jeśli ma własne listy) — przestawić pozycję 0 w `1A#1`, `1A#2`, `1F#4`
wg tabeli w §4.4. **Nie usuwać żadnego terminu z list** — one są kontekstem poziomu
i zasilają popover; zmienia się wyłącznie kolejność.

## Czego NIE robić

- **Nie wstawiać nazwy poziomu do komórki** — daje 9 identycznych kolumn (§4.2). To jest
  najbardziej kuszący i najgorszy z możliwych ruchów.
- **Nie dopisywać nazw poziomów do osi 2 i 3** — autor świadomie ich nie nadał (§5.2).
- Nie ruszać logiki pracy: kierunek wierszy, dolny pasek obszarów, popover, dwa znaczniki,
  Shift+klik, chipy `AS`/`TO` — lista zakazów w `MACIERZ_DRD_AUDYT.md` §5 obowiązuje.
- Nie łączyć tego z krokiem kolorystycznym (audyt, krok 5) — CLAUDE.md #9.

## Odbiór

Zrzuty **wszystkich siedmiu osi × dwa motywy**, do `evidence/` z sufiksem `__PO__`,
zestawione obok `evidence/106-macierz-audyt/*__PRZED__*`.
**Bramka liczbowa (do sprawdzenia skryptem, nie na oko):**
`0` fałszywych komórek na osi 1, `≥ 6` różnych treści w każdej kolumnie osi 1,
`25/25` różnych treści na osiach 2 i 3.
Zmiana dotyka własności intelektualnej właściciela → **akcept na zrzutach przed wejściem**.

---

## Źródła

- `knowledge/DRD/extracted_content.txt` — oś 1: l. 502–933 · oś 2: l. 977–1233 ·
  oś 3: l. 1264–1522. Cytat o nazwach poziomów osi 2: l. 1030–1035.
- `src/services/drdStructure.ts` — drabina i opisy (SSOT, wierne).
- `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2.ts` — technologie per obszar#poziom.
- `src/services/assessmentKnowledge/drdKnowledge.ts:36-…` — `TECH_RULES`, fabryka domyślna.
- `src/components/assessment/drd/DRDAssessmentEditor.tsx:776, 862, 884` (+ kopie `:2051, 2120, 2142`).
- `evidence/106-macierz-audyt/os1__PRZED__light.png` — weryfikacja wzrokowa 63 komórek.
