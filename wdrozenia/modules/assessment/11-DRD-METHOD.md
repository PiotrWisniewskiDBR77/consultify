# DRD — Digital Readiness Diagnosis (Digital Roadmap / “Digital Pathfinder”)

## Co to jest DRD i po co to robimy

**DRD** to metoda diagnozy dojrzałości cyfrowej firmy, która:

- porządkuje transformację w **osiach** (obszarach zmian),
- pozwala wystawić **ocenę dojrzałości** w **obszarach** w ramach osi,
- prowadzi do **inicjatyw transformacyjnych** (roadmapy), zamiast “raportu dla raportu”.

W Consultify DRD jest wykorzystywane jako narzędzie **Assessment → Report → Approval → Generowanie inicjatyw (DRAFT)**.

## Źródło kanoniczne

Treść i struktura poniżej bazuje na Twoich materiałach w `knowledge/`:

- `knowledge/0. Wprowadzenie .pdf` (opis osi transformacji),
- `knowledge/1. Digitlne processy.pdf` (oś 1 — appendix z poziomami i obszarami),
- `knowledge/2. Digitalne produkty.pdf` (oś 2),
- `knowledge/3. digitlane modele .pdf` (oś 3),
- `knowledge/4. Big data.pdf` (oś 4),
- `knowledge/5. Kultura.pdf` (oś 5),
- `knowledge/6. Cyberbezpieczenstwo .pdf` (oś 6),
- `knowledge/7. Os AI opis.pdf` (oś 7 — AI readiness; materiał wewnętrzny).

## Jak prowadzić DRD (procedura warsztatowa)

### 1) Przygotowanie (przed warsztatem)

- Zbierz kontekst: branża, typ produkcji (job shop/batch/continuous), liczba zakładów, architektura IT/OT, kluczowe KPI i bottlenecks.
- Ustal uczestników: właściciel procesu + IT/OT + finanse + HR + jakość + produkcja + logistyka + sprzedaż/marketing.
- Poproś o 10–20 artefaktów (przykłady): mapa procesów, lista systemów, architektura sieci, KPI/OEE, plan produkcji, raporty jakości, polityki cyber, budżet/portfolio inicjatyw.

### 2) Zbieranie danych (wywiad + shopfloor)

- Wywiad ustrukturyzowany wg osi i obszarów (poniżej masz pytania).
- “Gemba” / shopfloor: sprawdź realne użycie systemów, integracje, jakość danych, automatyzacje, cyber-higienę.
- Notuj **dowody** (linki, screeny, nazwy systemów, raporty, procedury, daty).

### 3) Scoring (warsztat)

- Dla każdego obszaru wybierz poziom, kierując się zasadą: **jeśli nie spełnia warunków poziomu wyższego — zostaje na niższym**.
- Jeśli firma ma “elementy poziomu 5”, ale działa to tylko w jednym gnieździe i bez utrzymania — oceniaj jak poziom 3/4 (zależnie od osi).

### 4) Walidacja + wnioski

- Zrób szybki “reality check” z liderami: 3 największe rozjazdy vs percepcja.
- Zidentyfikuj luki (gap) i **z czego wynikają** (brak danych, brak integracji, brak kompetencji, brak governance).
- Ustal cele (target) i priorytety inicjatyw (max kilka na oś, zgodnie z zasadami modułu).

## Skale ocen (ważne różnice)

- **Oś 1 i 4**: skala **1–7** (bardziej techniczna, “od rejestracji danych” do “AI”).
- **Oś 2 i 3**: skala **1–5** (od “basic” do “expert”).
- **Oś 5 i 6**: w źródle kanonicznym występuje skala **1–6** dla większości obszarów (oraz “typy” przywództwa w 5A).  
  W UI/implementacji systemowej możesz spotkać uproszczenie do 1–5 — jeśli tak, mapuj **6 → 5**.
- **Oś 7 (AI)**: skala **1–5** (materiał wewnętrzny).

## Struktura DRD (osie i obszary)

### Oś 1 — Procesy cyfrowe (1A–1I) — skala 1–7

**Cel osi:** ocena cyfryzacji procesów “end-to-end” (od rejestracji danych po automatyzację i AI).

**Znaczenie poziomów 1–7 (ramowo):**

1. **Rejestracja danych** (podstawowa digitalizacja, ewidencja)
2. **Kontrola stanowiska** (narzędzia na stanowisku, raportowanie)
3. **Kontrola procesu** (planowanie, KPI, budżety, przepływ)
4. **Automatyzacja** (automatyzacja zadań / przepływów / roboty)
5. **MES** (monitoring i sterowanie wykonaniem, KPI “real-time”)
6. **ERP** (integracja procesów w systemie klasy enterprise)
7. **AI** (predykcje, rekomendacje, autonomizacja decyzji)

#### 1A. Procesy sprzedaży

- **Poziomy (skrót):**
  - 1: ewidencja ofert/umów/zamówień w systemie.
  - 2: raportowanie i analiza sprzedaży (dashboardy, KPI).
  - 3: automatyczna kontrola budżetu/plan sprzedaży.
  - 4: automaty sprzedaży (e-commerce/marketplace/DIY).
  - 5: powiązanie z realizacją dostaw (monitoring statusów).
  - 6: sprzedaż zintegrowana z ERP (produkcja/zakupy/finanse).
  - 7: AI personalizuje ofertę i wspiera obsługę (NLP, boty).
- **Pytania diagnostyczne:**
  - Czy wszystkie zamówienia/oferty są w jednym systemie i mają jednolity identyfikator?
  - Jak wygląda planowanie i kontrola budżetu sprzedaży (kto, jak często, na jakich danych)?
  - Czy klient może kupić bez udziału handlowca (kanały cyfrowe)?
  - Czy status realizacji zamówienia jest widoczny w czasie zbliżonym do rzeczywistego?
  - Czy istnieją algorytmy rekomendacji/personalizacji lub automatyczne odpowiedzi/klasyfikacje?

#### 1B. Procesy marketingowe

- **Poziomy (skrót):**
  - 1: CRM do danych bazowych klienta.
  - 2: analityka efektywności działań (KPI, CRM+analityka).
  - 3: SEO/GA i kontrola działań online.
  - 4: automatyzacja kampanii (newslettery, segmentacja, automaty).
  - 5: mierzenie konwersji i scoring leadów.
  - 6: marketing zintegrowany z ERP (procesy i dane wspólne).
  - 7: AI/NLP w komunikacji (chatboty, generowanie treści, personalizacja).
- **Pytania diagnostyczne:**
  - Czy dane marketingowe i sprzedażowe są w jednym “źródle prawdy” (lub mają mapowanie)?
  - Czy kampanie są automatyczne (scenariusze) czy ręczne?
  - Jak mierzycie konwersję i jakość leadów (definicje, narzędzia)?
  - Czy rekomendacje/personalizacja są oparte o dane behawioralne?
  - Jak wygląda obsługa klienta (kanały, SLA, automatyzacje)?

#### 1C. Technologia procesu i R&D

- **Poziomy (skrót):**
  - 1: narzędzia projektowe (CAD) i ewidencja danych projektowych.
  - 2: symulacje/virtual commissioning na stanowiskach.
  - 3: FMEA i kontrola ryzyka błędów konstrukcyjnych/procesowych.
  - 4: automatyzacja prototypowania (3D print, VR/AR, szybkie testy).
  - 5: zarządzanie projektami i “digital twin” dla rozwoju technologii.
  - 6: ERP obejmuje R&D/technologię (cykle, integracje z ofertowaniem/realizacją).
  - 7: AI wspiera optymalizację technologii i badania (analiza danych, propozycje usprawnień).
- **Pytania diagnostyczne:**
  - Czy istnieje spójny “thread” danych od R&D → technologia → produkcja?
  - Jak identyfikujecie i zarządzacie ryzykiem (FMEA/FTA/8D)?
  - Czy testujecie procesy/linie w symulacji lub VR/AR?
  - Czy macie digital twin (w jakim sensie: model, dane, pętla sterowania)?
  - Jak AI wspiera R&D (np. analiza danych testowych, optymalizacja parametrów)?

#### 1D. Zakupy

- **Poziomy (skrót):**
  - 1: cyfrowa ewidencja transakcji i dostawców.
  - 2: MRP/planowanie materiałowe.
  - 3: workflow zakupowy (wniosek → akceptacja → zamówienie → rozliczenie).
  - 4: platformy B2B/aukcje, porównania ofert.
  - 5: KPI zakupowe w systemie (koszt, termin, jakość, skuteczność negocjacji).
  - 6: zakupy w ERP z integracją z produkcją i finansami.
  - 7: AI wspiera prognozę cen i negocjacje (predykcje, analizy rynku).
- **Pytania diagnostyczne:**
  - Jak działa planowanie materiałowe (MRP) i na jakich danych bazuje?
  - Czy akceptacje zakupów są cyfrowe i audytowalne?
  - Czy macie porównywanie dostawców/ofert na danych (TCO, jakość, ryzyko)?
  - Jak monitorujecie KPI zakupowe i jak to wpływa na decyzje?
  - Czy używacie analityki/predykcji cen surowców/komponentów?

#### 1E. Logistyka

- **Poziomy (skrót):**
  - 1: rejestracja i identyfikacja (barcode/RFID).
  - 2: mobilne terminale i RTLS do kontroli stanowisk/logistyki.
  - 3: WMS + EDI i kontrola przepływu.
  - 4: automatyzacja (AGV, robot pick, automaty magazynowe).
  - 5: MES/WMS + Kanban/Milkrun (optymalizacja i integracja z produkcją).
  - 6: logistyka w ERP (zamówienia, śledzenie, integracje).
  - 7: AI optymalizuje zapasy i alokację (prognoza, rozmieszczenie).
- **Pytania diagnostyczne:**
  - Jak identyfikujecie materiał (standardy etykiet, spójność w systemach)?
  - Czy macie WMS i czy jest zintegrowany z produkcją i zakupami?
  - Czy transport wewnętrzny jest zautomatyzowany (AGV/AMR)?
  - Jak wygląda sterowanie zapasami (Kanban, min/max, prognozy)?
  - Czy stosujecie optymalizację opartą o dane/AI (slotting, forecast)?

#### 1F. Produkcja

- **Poziomy (skrót):**
  - 1: rejestracja danych z maszyn (czasy, parametry, jakość).
  - 2: PLC/sensory i kontrola stanowisk.
  - 3: CMMS, OEE, VSM i kontrola procesu.
  - 4: automatyzacja/robotyzacja operacji.
  - 5: MES na liniach (planowanie wykonania, śledzenie, raportowanie).
  - 6: ERP integruje planowanie i zasoby (MRP/APS/finanse).
  - 7: AI optymalizuje harmonogramy i obciążenia (również na digital twin).
- **Pytania diagnostyczne:**
  - Czy dane z maszyn są zbierane automatycznie i w jakiej rozdzielczości?
  - Czy OEE jest liczone “real-time” i czy prowadzi do działań?
  - Czy plan produkcji i jego wykonanie są spięte w MES/ERP?
  - Co jest zrobotyzowane i jak utrzymujecie automatyzacje (MTTR/MTBF)?
  - Czy macie predykcyjne utrzymanie ruchu / optymalizację planu przez AI?

#### 1G. Jakość

- **Poziomy (skrót):**
  - 1: cyfrowe karty kontroli / arkusze zgodności.
  - 2: kontrola jakości na maszynach (kamery, sensory, analizatory).
  - 3: centralny system reagowania na wady (alerty, CAPA).
  - 4: automatyczna kontrola (roboty + vision).
  - 5: QMS kontroluje jakość na etapach (plany kontroli, raporty, stabilność).
  - 6: jakość w ERP (reklamacje, dokumentacja, integracje).
  - 7: AI optymalizuje zakres kontroli i wykrywa wzorce wad (risk-based QC).
- **Pytania diagnostyczne:**
  - Czy plany kontroli i wyniki są cyfrowe i powiązane z partią/serialem?
  - Czy wykrywanie wad jest automatyczne (vision) czy manualne?
  - Jak działa CAPA (czas reakcji, skuteczność, audytowalność)?
  - Czy QMS jest zintegrowany z produkcją i ERP?
  - Czy wykorzystujecie AI do predykcji wad / sterowania kontrolą (SPC/vision)?

#### 1H. Finanse

- **Poziomy (skrót):**
  - 1: OCR i elektroniczny obieg dokumentów finansowych.
  - 2: narzędzia kontrolingu (budżetowanie, raportowanie).
  - 3: system akceptacji decyzji i kontrola decyzyjna.
  - 4: RPA w procesach finansowych (faktury, raporty).
  - 5: workflow finansowy (akceptacje, rozliczenia, śledzenie zadań).
  - 6: finanse w ERP (real-time, integracje).
  - 7: AI/BI do prognoz i decyzji (forecast, anomalia, rekomendacje).
- **Pytania diagnostyczne:**
  - Jak wygląda obieg faktur i jak dużo jest ręcznej pracy?
  - Czy controlling ma “jedną wersję prawdy” i stałe cykle raportowe?
  - Jak zarządzacie decyzjami finansowymi (kto zatwierdza, jakie progi)?
  - Czy procesy finansowe są zautomatyzowane (RPA) i utrzymywane?
  - Czy prognozy i rekomendacje są oparte o BI/AI (i czy trafne)?

#### 1I. HR

- **Poziomy (skrót):**
  - 1: ewidencja czasu pracy (karty).
  - 2: payroll i podstawowe systemy płacowe.
  - 3: rejestracja czasu/obecności (karty/biometria/mobilne).
  - 4: samoobsługa HR (e-kioski, portale).
  - 5: HRM (oceny, szkolenia, wynagrodzenia, ścieżki).
  - 6: HR w ERP (centralizacja danych).
  - 7: AI wspiera rekrutację i rozwój (analiza danych, planowanie).
- **Pytania diagnostyczne:**
  - Jak rejestrujecie czas i obecność — i czy dane są wiarygodne?
  - Czy pracownicy mają samoobsługę (wnioski urlopowe, dokumenty, dane)?
  - Czy macie system rozwoju kompetencji i planowania szkoleń oparty o dane?
  - Czy dane HR są zintegrowane z planowaniem zasobów (produkcja/projekty)?
  - Czy AI jest używane w rekrutacji / planowaniu rozwoju (i jakie są zasady)?

---

### Oś 2 — Produkty cyfrowe (2A–2E) — skala 1–5

**Cel osi:** na ile oferta i produkt “niesie cyfrową wartość” (forma, doświadczenie, personalizacja, skalowalność).

**Znaczenie poziomów 1–5 (ramowo):** Basic → Intermediate → Advanced → Interactive → Expert.

#### 2A. Produkty cyfrowe (forma elektroniczna)

- **Poziomy (skrót):**
  - 1: proste treści cyfrowe (download/stream).
  - 2: multimedia i dostęp wielokanałowy.
  - 3: aplikacje/oprogramowanie z dodatkowymi funkcjami (np. personalizacja).
  - 4: interaktywne produkty (współtworzenie/VR/gry/narzędzia).
  - 5: “expert” — AI/ML/blockchain lub platformy/VR klasy enterprise.
- **Pytania:**
  - Co w produkcie jest “cyfrowe” (artefakt, aplikacja, dane, usługa)?
  - Czy produkt działa wieloplatformowo i ma spójne doświadczenie?
  - Jakie elementy są personalizowane i na jakich danych?
  - Czy użytkownik współtworzy/konfiguruje produkt (interakcja)?
  - Czy AI jest “feature” czy fundamentem propozycji wartości?

#### 2B. Produkty społecznościowe (community-based)

- **Poziomy (skrót):**
  - 1: społeczność dzieli zasoby.
  - 2: współpraca przy projektach/dyskusjach.
  - 3: mentoring/eksperci wspierają innych.
  - 4: społeczność tworzy treści.
  - 5: współwłasność i wpływ na rozwój produktu/ekosystemu.
- **Pytania:**
  - Czy istnieje społeczność użytkowników i jaką ma rolę w rozwoju produktu?
  - Jak zbieracie feedback i jak szybko trafia do backlogu?
  - Czy są mechanizmy współtworzenia treści/rozszerzeń?
  - Czy użytkownicy mają wpływ na roadmapę (głosowania, RFC)?
  - Jak mierzona jest aktywność i retencja community?

#### 2C. Produkty oparte o ICT (ICT-based products)

- **Poziomy (skrót):**
  - 1: analityka danych klientów.
  - 2: personalizacja oferty na danych.
  - 3: komunikacja i interakcja (support, chatboty).
  - 4: automatyzacja i personalizacja obsługi (CRM + automaty).
  - 5: ICT jako źródło innowacji (big data/AI/ML → nowe produkty).
- **Pytania:**
  - Jakie kanały kontaktu klienta są “spięte” (omnichannel)?
  - Czy personalizacja jest segmentowa czy indywidualna?
  - Jak wygląda automatyzacja obsługi (routing, odpowiedzi, SLA)?
  - Czy dane klientów są wykorzystywane do innowacji produktu?
  - Jak zarządzacie prywatnością i zgodami (RODO)?

#### 2D. Dopasowanie do oczekiwań klienta

- **Poziomy (skrót):**
  - 1: spójność kanałów i podstawowa analiza preferencji.
  - 2: segmentacja i dopasowanie per segment.
  - 3: elastyczne modele cenowe + wsparcie komunikacji.
  - 4: indywidualna personalizacja doświadczenia.
  - 5: konfiguracja/produkcja na zamówienie (mass customization).
- **Pytania:**
  - Jak mierzycie satysfakcję i dopasowanie (NPS, churn, usage)?
  - Czy ceny/oferty adaptują się do segmentu/warunków rynkowych?
  - Czy UI/produkt dostosowuje się do zachowań użytkownika?
  - Czy klient może skonfigurować produkt “pod siebie”?
  - Jak szybko reagujecie na zmiany oczekiwań rynku?

#### 2E. Skalowalność produktu

- **Poziomy (skrót):**
  - 1: lokalnie, brak skalowania.
  - 2: region/rynki sąsiednie.
  - 3: globalne platformy (cloud, marketplace) + częściowe adaptacje.
  - 4: wiele rynków, lokalizacje i zgodność regulacyjna.
  - 5: globalnie, multi-kulturowo, bez ograniczeń geograficznych.
- **Pytania:**
  - Czy architektura i proces delivery pozwalają skalować bez “heroics”?
  - Jak wyglądają deploye, obserwowalność, wsparcie klientów w wielu krajach?
  - Czy macie lokalizacje językowe/walutowe i compliance?
  - Jak zarządzacie wydajnością i kosztami w skali?
  - Czy istnieje plan ekspansji oparty o dane (CAC/LTV, kanały)?

---

### Oś 3 — Cyfrowe modele biznesowe (3A–3E) — skala 1–5

**Cel osi:** czy firma potrafi monetyzować cyfrowo (kanały, platformy, usługi, dane).

#### 3A. E-commerce

- **Poziomy (skrót):**
  - 1: sklep online / podstawowa platforma sprzedaży.
  - 2: integracje, zarządzanie zapasem, analiza danych.
  - 3: zaawansowana wizualizacja i rekomendacje.
  - 4: głęboka personalizacja i omnichannel.
  - 5: AI/IoT/VR/blockchain — “expert” (immersive, inteligentne kanały).
- **Pytania:** kanały, integracje, rekomendacje, personalizacja, automaty.

#### 3B. Platformy (platform solutions)

- **Poziomy (skrót):**
  - 1: użycie platformy do transakcji.
  - 2: własna platforma łącząca sprzedawców i klientów.
  - 3: ekosystem (partnerzy, narzędzia analityczne, programy).
  - 4: SEM (marketplace + SaaS).
  - 5: SEM + community (współpraca, wsparcie, wiedza).
- **Pytania:** model opłat, efekty sieciowe, governance, API/SDK, community.

#### 3C. As-a-Service

- **Poziomy (skrót):**
  - 1: prosta usługa w modelu umów długoterminowych.
  - 2: subskrypcja/taryfy + wsparcie.
  - 3: pay-per-use zasobów/assetów.
  - 4: płatność za wynik (outcome) + personalizacja.
  - 5: dostawca przejmuje proces biznesowy end-to-end.
- **Pytania:** jak mierzony jest usage/outcome, SLA, ryzyko, integracje danych.

#### 3D. Współdzielenie zasobów (asset sharing)

- **Poziomy (skrót):**
  - 1: zasoby wirtualne (pliki, aplikacje).
  - 2: zasoby fizyczne (sprzęt, narzędzia, pojazdy).
  - 3: wiedza i kompetencje (usługi ekspertów).
  - 4: outsourcing zasobów w czasie (managed assets).
  - 5: platforma kompleksowych rozwiązań biznesowych (integracja usług).
- **Pytania:** marketplace zasobów, rozliczenia, zaufanie, standardy, monitoring.

#### 3E. Monetyzacja danych

- **Poziomy (skrót):**
  - 1: zbieranie danych klientów/procesów.
  - 2: analiza trendów i wzorców.
  - 3: personalizacja ofert na danych.
  - 4: sprzedaż/udostępnianie danych lub płatne analizy.
  - 5: nowe produkty/usługi oparte o dane i AI.
- **Pytania:** źródła danych, jakość, zgody, produkty danych, revenue stream.

---

### Oś 4 — Zarządzanie danymi (4A–4E) — skala 1–7

**Cel osi:** czy firma potrafi zbierać, przechowywać, komunikować i przetwarzać dane na potrzeby decyzji i automatyzacji.

#### 4A. Zbieranie danych

- **Poziomy (skrót):**
  - 1: ręczne deklaracje/formularze/papier.
  - 2: kody kreskowe/QR.
  - 3: RFID.
  - 4: sensory z maszyn (parametry procesu) w czasie rzeczywistym.
  - 5: mobile/RTLS — dane o działaniach i pracy (aplikacje, urządzenia).
  - 6: sensory środowiskowe/obiekty fizyczne (IoT) + integracje.
  - 7: kontrola optyczna (kamery + analiza obrazu).
- **Pytania:** jakie źródła, rozdzielczość, automatyzacja, jakość, governance.

#### 4B. Przechowywanie danych

- **Poziomy (skrót):**
  - 1: papier/archiwum.
  - 2: jeden lokalny nośnik/stanowisko.
  - 3: rozproszone dyski lokalne (brak centralizacji).
  - 4: lokalna chmura (on-prem cloud).
  - 5: chmura publiczna (AWS/GCP/Azure etc).
  - 6: chmura prywatna (dedykowana).
  - 7: podejście hybrydowe (edge + private + public wg danych).
- **Pytania:** “single source of truth”, backup, retencja, klasyfikacja danych, dostęp.

#### 4C. Komunikacja danych

- **Poziomy (skrót):**
  - 1: raporty papierowe.
  - 2: raporty e-mail.
  - 3: Ethernet (LAN).
  - 4: Industrial Ethernet + protokoły przemysłowe.
  - 5: sieci bezprzewodowe.
  - 6: WAN/LAN (oddziały, VPN, MPLS).
  - 7: architektura chmurowa / mikroserwisy (dostęp “anywhere”).
- **Pytania:** segmentacja IT/OT, bezpieczeństwo, niezawodność, opóźnienia, standardy.

#### 4D. Analiza Big Data

- **Poziomy (skrót):**
  - 1: DBMS (bazy danych).
  - 2: ETL (zbieranie i ładowanie z wielu źródeł).
  - 3: wizualizacje (dashboardy, heatmapy).
  - 4: analiza rozproszona (np. Spark/Hadoop).
  - 5: zarządzanie jakością danych (DQ).
  - 6: symulacje danych (synthetic/sandbox).
  - 7: algorytmy ML (anomalie, klasyfikacja, predykcje).
- **Pytania:** pipeline, częstotliwość odświeżania, jakość, modele ML, decyzje na danych.

#### 4E. Przetwarzanie danych (Computing)

- **Poziomy (zgodnie ze źródłem DRD):**
  - 1: PC (lokalne obliczenia).
  - 2: edge computing (blisko źródła danych).
  - 3: wirtualne maszyny (virtual compute).
  - 4: GPU (przyspieszenia równoległe).
  - 5: cloud computing (IaaS/PaaS/SaaS dla obliczeń).
  - 6: HPC (high-performance computing).
  - 7: klastry komputerowe (distributed clusters).
- **Pytania:** gdzie liczycie (edge/cloud), skalowanie, koszt, latency, bezpieczeństwo, ML workload.

---

### Oś 5 — Kultura transformacji (5A–5E) — typy + skala 1–6

**Cel osi:** czy kultura i kompetencje organizacji umożliwiają transformację, a nie tylko “zakup technologii”.

#### 5A. Postawy przywódcze (typy 1–6, nie “lepsze/gorsze”)

- **Typy (skrót):**
  - T1: pasywny (brak wsparcia innowacji).
  - T2: autokratyczny (decyzje centralnie, niski udział zespołu).
  - T3: dyrektywny (wysokie wymagania + narzędzia/zasoby).
  - T4: wspierający (bezpieczeństwo psychologiczne, motywowanie).
  - T5: innowator (ryzyko, eksperymenty, zmiana).
  - T6: transformacyjny (wizja, etyka, odrzucenie status quo, rozwój ludzi).
- **Jak oceniać:** zidentyfikuj **dominujący** typ i 1–2 typy wspierające (bo realnie bywają mieszane).
- **Pytania:** kto podejmuje decyzje, jak traktuje się błędy, jak finansuje się eksperymenty, jak wygląda komunikacja wizji.

#### 5B. Gotowość na zmianę (1–6)

- **Poziomy (skrót):**
  - 1: rozpoznanie potrzeby zmiany.
  - 2: koalicja zmiany (zespół, sponsorzy).
  - 3: poszukiwanie wizji i strategii.
  - 4: komunikowanie wizji (dwukierunkowo).
  - 5: wdrażanie zmiany (inicjatywy, kryteria postępu).
  - 6: instytucjonalizacja zmiany (w kulturze i sposobie pracy).
- **Pytania:** czy jest sponsor, czy są rytuały komunikacji, czy są KPI zmiany, czy zmiana jest “normą”.

#### 5C. Ciągły rozwój kompetencji (1–6)

- **Poziomy (skrót):**
  - 1: kontakt zewnętrzny (targi/konferencje).
  - 2: szkolenia wewnętrzne.
  - 3: szkolenia zewnętrzne.
  - 4: self-learning (platformy, książki, kursy).
  - 5: praca w zespołach projektowych (learning-by-doing).
  - 6: mentoring (systemowe rozwijanie juniorów).
- **Pytania:** budżet szkoleniowy, plan kompetencji, ścieżki, udział w projektach, mierzenie efektywności.

#### 5D. Kultura innowacji (1–6)

- **Poziomy (skrót):**
  - 1: promowanie pomysłów (hackathony, platformy idei).
  - 2: eksperymentowanie (prototypy, pilotaże).
  - 3: analiza trendów rynkowych (aktywnie).
  - 4: akceptacja błędów (uczenie się).
  - 5: R&D w strategii firmy (ciągłe, nie “ad hoc”).
  - 6: współpraca zewnętrzna w strategii (startup/uczelnia/partnerzy).
- **Pytania:** ile inicjatyw jest eksperymentem, jak szybko prototypujecie, jak działają partnerstwa.

#### 5E. Dostępność zasobów (1–6)

- **Poziomy (skrót):**
  - 1: dostęp do kapitału (plan finansowania inicjatyw).
  - 2: dostęp do szkoleń (ścieżki rozwoju).
  - 3: dostęp do ekspertów (wew./zew.).
  - 4: dostęp do danych (systemy, bezpieczeństwo, użycie).
  - 5: dostęp do technologii (narzędzia + wsparcie).
  - 6: dostęp do partnerów (ekosystem, współpraca).
- **Pytania:** budżety, czas pracowników, priorytety, dostęp do narzędzi, partnerzy technologiczni.

---

### Oś 6 — Cyberbezpieczeństwo (6A–6E) — skala 1–6

**Cel osi:** dojrzałość cyber jako warunek przetrwania (nie tylko “IT problem”).

#### 6A. Strategia i zarządzanie ryzykiem

- **Poziomy (skrót):**
  - 1: brak strategii i polityk.
  - 2: analiza ryzyka.
  - 3: plan działań.
  - 4: polityki bezpieczeństwa (standardy/procedury).
  - 5: HR w strategii (szkolenia, kompetencje).
  - 6: monitoring i ocena skuteczności (audyty, testy, logi).

#### 6B. Ochrona sieci i systemów

- **Poziomy (skrót):**
  - 1: firewalle.
  - 2: antywirus.
  - 3: IDS.
  - 4: SIEM/IDS korelujące zdarzenia.
  - 5: autoryzacja i uwierzytelnianie.
  - 6: VPN (bezpieczne kanały, segmentacja połączeń).

#### 6C. Ochrona danych

- **Poziomy (skrót):**
  - 1: szyfrowanie.
  - 2: polityka haseł i bezpieczne przechowywanie.
  - 3: kontrola dostępu (role, audyt).
  - 4: backup i disaster recovery.
  - 5: monitoring i detekcja zagrożeń.
  - 6: weryfikacja tożsamości (np. certyfikaty/biometria) + procesy.

#### 6D. Edukacja i jakość systemów (security training)

- **Poziomy (skrót):**
  - 1: opis systemu szkoleń.
  - 2: plan wdrożenia szkoleń (różne formy).
  - 3: system testów bezpieczeństwa.
  - 4: auditorzy wewnętrzni.
  - 5: plan audytów cyber.
  - 6: ISO 27001 (certyfikacja ISMS).

#### 6E. Plany awaryjne

- **Poziomy (skrót):**
  - 1: identyfikacja zagrożeń.
  - 2: priorytety w incydencie.
  - 3: procedury postępowania.
  - 4: regularne szkolenia awaryjne.
  - 5: testy planów (scenariusze).
  - 6: dokumentacja i ciągłe doskonalenie.

**Pytania przekrojowe (oś 6):**

- Czy IT i OT są segmentowane, a dostęp jest “least privilege”?
- Czy macie incident response (RACI, czasy, playbooki)?
- Jak wygląda backup/restore testowany w praktyce?
- Jakie są top 3 ryzyka cyber dla procesu produkcyjnego i danych klientów?

---

### Oś 7 — AI Readiness & Integration (7A–7E) — skala 1–5

**Cel osi:** ocena gotowości do wdrażania i skalowania AI (dane, procesy, produkt, governance, ludzie).

#### 7A. Data Exposure & AI Foundations

- 1: dane rozproszone, brak gotowości.
- 2: dane uporządkowane, ale silosy.
- 3: pierwsza centralizacja + ETL i pierwsze projekty ML.
- 4: architektura “AI-ready” (governance, near-real-time, katalog, quality).
- 5: autonomiczna inteligencja danych (self-healing, drift monitoring, data-as-product).

#### 7B. AI-Augmented Processes

- 1: izolowane eksperymenty.
- 2: automatyzacje wspierające pracę (RPA/GenAI “assistant”).
- 3: zintegrowane wsparcie decyzyjne (rekomendacje ML).
- 4: procesy półautonomiczne (AI wykonuje część kroków, człowiek nadzoruje).
- 5: pełna orkiestracja autonomiczna (closed-loop operations).

#### 7C. AI in Products & Services

- 1: brak komponentów AI w produktach.
- 2: AI jako dodatek (feature).
- 3: AI jako kluczowy komponent produktu.
- 4: produkt “AI-driven” (uczy się, adaptuje, real-time).
- 5: produkty AI-native (model biznesowy oparty o AI, agenci, digital twin closed-loop).

#### 7D. AI Governance, Safety & Ethics

- 1: brak governance (spontaniczne użycie).
- 2: podstawowe polityki użycia (jeszcze nieegzekwowane).
- 3: firmowy framework governance (role, procesy akceptacji, dokumentacja modeli).
- 4: monitoring i kontrola cyklu życia (audyt, ryzyka, compliance).
- 5: dojrzałe governance (ciągłe testy, bezpieczeństwo, zgodność, “responsible AI by design”).

#### 7E. AI Empowerment of Employees

- 1: użycie incydentalne, prywatne.
- 2: szkolenia podstawowe i narzędzia wspierające.
- 3: rutyny pracy z AI w zespołach (prompty, playbooki, QA).
- 4: szerokie wykorzystanie (role, KPI, wsparcie, automaty).
- 5: organizacja “AI-augmented” (kompetencje, narzędzia, standardy w całej firmie).

**Pytania przekrojowe (oś 7):**

- Czy dane są dostępne i ustandaryzowane dla modeli (katalog, jakość, integracje)?
- Czy AI jest wpięte w procesy i systemy (a nie “obok”)?
- Jak mierzycie wartość (czas, koszt, jakość, ryzyko) i utrzymujecie modele?
- Jakie są zasady bezpieczeństwa i compliance (np. EU AI Act, RODO, tajemnica)?

## Minimalny zestaw dowodów (evidence) do raportu

- Lista systemów IT/OT (ERP, MES, WMS, QMS, CMMS, CRM, BI, data platform).
- Przykładowe raporty KPI (produkcja/jakość/logistyka/sprzedaż).
- Diagram integracji (przynajmniej high-level).
- Polityki/procedury cyber + wyniki testów/backup/IR.
- Przykłady inicjatyw cyfrowych (portfolio) i ich wyniki.
- Dla AI: polityki użycia, przykłady przypadków użycia, monitoring/QA.
