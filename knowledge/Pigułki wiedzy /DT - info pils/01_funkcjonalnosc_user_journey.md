## Funkcjonalność i User Journey platformy Digital Twin

### Opis platformy Digital Twin

Platforma Digital Twin DBR77 to środowisko do tworzenia wirtualnych, w pełni parametrycznych modeli zakładów produkcyjnych, pozwalające na:

- **Modelowanie layoutu**: odzwierciedlenie fizycznej struktury hali (linie, gniazda, magazyny, ciągi komunikacyjne, strefy bezpieczeństwa).
- **Modelowanie procesów**: odwzorowanie procesów technologicznych, logistycznych i pomocniczych, w tym czasy operacji, sekwencje, zależności, zasoby.
- **Symulację przepływów materiałowych i informacji**: analiza przepływów wyrobów, półproduktów, komponentów, operatorów, wózków, AGV, itp.
- **Analizę scenariuszy „co-jeśli”**: testowanie alternatywnych wariantów layoutu, obsady, parku maszynowego, automatyzacji, zmian organizacyjnych.
- **Wsparcie decyzji inwestycyjnych i operacyjnych**: obiektywne wyniki symulacji (KPI, OEE, throughput, WIP, poziom zapasów, wykorzystanie zasobów) oraz rekomendacje CAPEX/OPEX.

System działa w architekturze webowej (SaaS), z dostępem przez przeglądarkę, z możliwością integracji z systemami ERP/MES/IoT w celu automatycznego zasilania danymi.

**Unikalność platformy DBR77** (wg artykułu „Bliźniak Cyfrowy wg DBR77”): Platforma oferuje **graficzno-numeryczne środowisko pracy**. Część graficzna służy odwzorowaniu aktywów produkcyjnych, ludzi i procesów; część numeryczna to **algorytmy uczące się**, które poprzez wielokrotne symulacje wyznaczają optymalne rozwiązania. Połączenie tych dwóch technologii (graficznego modelu z algorytmami symulacyjnymi) jest unikatowym rozwiązaniem na rynku.

**Bliźniak jako „wehikuł czasu”**: Digital Twin umożliwia podróż w przeszłość (analiza zdarzeń historycznych na bazie danych) oraz w przyszłość (symulacje wariantów z wykorzystaniem algorytmów predykcji).

---

### User Journey – od pierwszego logowania do rekomendacji

#### 1. Pierwsze logowanie i onboarding

- **Rejestracja konta organizacji** (rola administratora klienta).
- **Konfiguracja podstawowa**:
  - dodanie zakładów / lokalizacji,
  - zdefiniowanie ról użytkowników (np. Project Lead, Inżynier Procesu, IT, Finance),
  - ustawienie standardów jednostek, kalendarza produkcyjnego, stref czasowych.
- **Onboarding produktowy**:
  - interaktywny tutorial platformy,
  - przykładowy projekt demo,
  - dostęp do bazy wiedzy i szablonów importu danych.

#### 2. Zebranie danych o layoutach, procesach, przepływach i zasobach

- **Layout**:
  - import rzutów hali z plików CAD (DWG, DXF) lub plików graficznych (PNG, PDF) jako podkład,
  - definicja obszarów (linie, gniazda, magazyny, korytarze),
  - ustawienie pozycji maszyn, buforów, punktów załadunku/rozładunku.
- **Procesy technologiczne**:
  - import technologii z ERP/MES (BOM, routing),
  - ręczne definiowanie lub edycja kroków procesu: operacje, czasy, zasoby (maszyna/stanowisko, operator, narzędzia),
  - określenie wariantów technologii (produkty, serie, opcje).
- **Przepływy materiałowe**:
  - konfiguracja ścieżek transportu (ręczny, wózki, przenośniki, AGV),
  - parametry transportu (czasy załadunku, prędkości, pojemności, okna czasowe),
  - przypisanie ścieżek do konkretnych produktów / zleceń.
- **Zasoby**:
  - ewidencja maszyn (typ, wydajność, MTBF, MTTR, kalendarz dostępności),
  - zasoby ludzkie (liczba operatorów, kwalifikacje, zmiany),
  - zasoby logistyczne (wózki, AGV, regały, pojemniki),
  - ograniczenia dostępności (przeglądy, przerwy, święta, zmiany).

#### 3. Integracja z danymi historycznymi (ERP/MES/IoT)

- **Źródła danych**:
  - ERP (zlecenia produkcyjne, BOM, routing, koszty),
  - MES (czasy rzeczywiste, przestoje, scrap, wydajność),
  - IoT/SCADA (stany maszyn, sygnały, liczniki sztuk, prędkości),
  - WMS/TMS (przepływy magazynowe i logistyczne).
- **Tryby integracji**:
  - import plików (CSV, Excel),
  - integracja przez API (REST/GraphQL),
  - strumienie danych (IoT feed – MQTT, OPC UA, inne protokoły).
- **Walidacja danych**:
  - automatyczne sprawdzanie kompletności (brakujące parametry),
  - wykrywanie anomalii (skrajne wartości, niespójności),
  - raport błędów dla działu IT / właścicieli procesów.

#### 4. Budowa modelu symulacyjnego

- **Mapowanie danych do obiektów symulacyjnych**:
  - produkty → encje przepływu,
  - maszyny → zasoby przetwarzające,
  - operatorzy → zasoby ludzkie,
  - trasy → ścieżki transportowe,
  - zlecenia produkcyjne → scenariusze obciążenia.
- **Definicja logiki procesów**:
  - sekwencje operacji (routing),
  - zasady kolejkowania (FIFO, LIFO, priorytety, dynamiczne reguły),
  - reguły planowania (np. minimalizacja przezbrojeń vs maksymalizacja throughputu),
  - reguły awarii i przestojów (rozkłady losowe, dane historyczne).
- **Konfiguracja parametrów symulacji**:
  - horyzont symulacji (dzień, tydzień, miesiąc),
  - ziarno losowości (replikacje),
  - KPI do śledzenia (OEE, throughput, WIP, lead time, poziom wykorzystania).

#### 5. Kalibracja modelu

- **Uwzględnianie odchyleń** (kluczowe dla platformy DBR77):
  - analiza danych historycznych pozwala zmierzyć odchylenia od planowanych działań,
  - w symulacjach uwzględniane są potencjalne zdarzenia nieplanowane (awaryjność maszyn, zmienność czasów, absencje),
  - dzięki temu wyniki symulacji zbliżają się do realnego świata, a nie idealnego scenariusza.
- **Porównanie modelu z rzeczywistością**:
  - uruchomienie symulacji dla scenariusza „as-is” przy użyciu danych historycznych,
  - porównanie wyników (produktywność, OEE, czasy przejścia, poziomy zapasów) z realnymi danymi.
- **Dostrajanie parametrów**:
  - korekta rozkładów czasów operacji (średnia, odchylenie),
  - urealnienie parametrów awarii i mikroprzestojów,
  - doprecyzowanie kalendarzy zmian, przerw i przezbrojeń,
  - weryfikacja przepustowości transportu wewnętrznego.
- **Akceptacja modelu**:
  - wspólna sesja (klient + konsultanci + zespół DBR77),
  - zatwierdzenie, że model odtwarza rzeczywistość w granicach tolerancji (np. ±5–10% dla kluczowych KPI),
  - zamrożenie wersji modelu „as-is” jako referencyjnego punktu odniesienia.

#### 6. Analiza scenariuszy

- **Tworzenie scenariuszy „to-be”**:
  - zmiany layoutu (relokacja maszyn, dodanie linii, skrócenie ścieżek),
  - automatyzacja (robotyzacja stanowisk, przenośniki, AGV),
  - zmiany organizacyjne (liczba operatorów, podział ról, nowe harmonogramy zmian),
  - zmiany w polityce planowania (wielkości partii, priorytety zleceń, okna dostaw).
- **Symulacje wielowariantowe**:
  - porównywanie scenariuszy przy tym samym popycie,
  - ocena wrażliwości na zmiany (popyt, awaryjność, absencja),
  - analiza ryzyka (scenariusze pesymistyczne/realistyczne/optymistyczne).
- **Analiza wąskich gardeł**:
  - identyfikacja obszarów o najwyższym stopniu wykorzystania,
  - analiza kolejek i czasów oczekiwania,
  - analiza wpływu usunięcia konkretnego wąskiego gardła na całą linię/zakład.

#### 7. Rekomendacje inwestycyjne i operacyjne

- **Generowanie rekomendacji**:
  - wskazanie inwestycji CAPEX (maszyny, linie, automatyzacja, magazyny),
  - rekomendacje operacyjne (organizacja zmian, balansowanie linii, polityka planowania),
  - wykaz spodziewanych korzyści (zwiększenie przepustowości, redukcja WIP, skrócenie lead time, poprawa OEE).
- **Ocena finansowa**:
  - szacowanie nakładów CAPEX i OPEX,
  - kalkulacja ROI, NPV, okresu zwrotu,
  - porównanie kilku scenariuszy pod kątem relacji korzyści → koszt.
- **Przygotowanie materiałów dla zarządu**:
  - raporty PDF/PowerPoint z kluczowymi wynikami,
  - dashboardy interaktywne online (KPI, mapy cieplne, wykresy przepływów),
  - paczka danych do dalszej analizy (Excel, CSV).

---

### Kluczowe moduły funkcjonalne

#### Moduł modelowania layoutu

- **Funkcje**:
  - import planów hali (CAD/grafika),
  - edytor 2D/3D do rozmieszczania maszyn, linii, magazynów, stref,
  - parametryzacja obiektów (wymiary, strefy bezpieczeństwa, kierunki ruchu),
  - definicja ciągów komunikacyjnych (drogi wózków, trasy AGV, ścieżki operatorów).
- **Korzyści**:
  - szybkie tworzenie i modyfikacja layoutów,
  - wizualne wykrywanie potencjalnych kolizji lub nieergonomicznych rozwiązań,
  - możliwość generowania alternatywnych wariantów layoutu do porównania.
- **3D + VR/AR** (wg dt-website): walidacja w skali 1:1 na PC, w VR lub AR; wykorzystanie w przeglądach zarządczych i walidacji inwestycji CAPEX.

#### Moduł symulacji przepływów

- **Symulacja dyskretno-wydarzeniowa**:
  - oparcie o zdarzenia (start/stop operacji, przyjazd/wyjazd, awaria),
  - modelowanie kolejek, zasobów, opóźnień, awarii, przezbrojeń.
- **Parametryzacja przepływów**:
  - różne typy produktów i ścieżek procesowych,
  - zmienność czasów (rozkłady losowe),
  - odzwierciedlenie dynamiki rzeczywistej produkcji.
- **Wyniki**:
  - przepustowość linii i zakładu,
  - rozkład WIP i stanów magazynowych,
  - czasy przejścia zleceń, poziom obsługi klienta.
- **Symulacja stochastyczna** (wg strony dt-website): uruchamianie scenariuszy z uwzględnieniem odchyleń wywodzonych z danych historycznych—nie tylko założeń idealnych; wybór decyzji odpornych na zmienność rzeczywistości.

#### Moduł analizy wąskich gardeł

- **Identyfikacja ograniczeń**:
  - ranking zasobów według stopnia wykorzystania,
  - analiza długości kolejek i czasu oczekiwania,
  - lokalizacja statycznych i dynamicznych wąskich gardeł.
- **Wizualizacja**:
  - mapy cieplne obciążenia zasobów,
  - wykresy Gantta, histogramy obciążenia, timeline’y zdarzeń,
  - interaktywne „drill-down” do pojedynczych zasobów i zleceń.
- **Wnioski**:
  - wskazanie, które inwestycje lub zmiany organizacyjne przynoszą największy efekt w usuwaniu ograniczeń.

#### Moduł testowania scenariuszy CAPEX

- **Definicja scenariuszy inwestycyjnych**:
  - dodanie/modernizacja linii lub maszyn,
  - wdrożenie automatyzacji/robotyzacji,
  - przebudowa layoutu, rozbudowa hal, magazynów.
- **Ocena skutków**:
  - wpływ na przepustowość, OEE, czas realizacji, WIP, obsadę,
  - identyfikacja wtórnych wąskich gardeł po zmianach.
- **Porównanie scenariuszy**:
  - ranking scenariuszy wg KPI technicznych i finansowych,
  - analiza wrażliwości na zmiany popytu i parametrów pracy.

#### Moduł dashboardów zarządczych

- **Dashboardy operacyjne**:
  - OEE, dostępność, wydajność, jakość,
  - wykorzystanie zasobów, poziom WIP, lead time.
- **Dashboardy inwestycyjne**:
  - scenariusze CAPEX vs KPI,
  - ROI, NPV, okres zwrotu,
  - mapa ryzyk i wrażliwości.
- **Funkcje**:
  - filtry po czasie, linii, produkcie, scenariuszu,
  - eksport wykresów i tabel,
  - integracja z narzędziami BI (np. Power BI).

#### Moduł generowania raportów ROI i eksportu dla zarządu

- **Raport ROI**:
  - opis scenariusza wyjściowego („as-is”) i docelowego („to-be”),
  - lista założeń i ograniczeń,
  - szczegółowa kalkulacja korzyści (oszczędności, wzrost przychodów, redukcja CAPEX).
- **Formaty eksportu**:
  - PDF (prezentacja zarządcza),
  - PPTX (slajdy do rady nadzorczej/komitetu inwestycyjnego),
  - XLSX/CSV (dane do dalszych analiz).
- **Personalizacja**:
  - logotyp klienta,
  - struktura zgodna z wewnętrznymi szablonami korporacji,
  - możliwość dodawania komentarzy i rekomendacji konsultantów.

#### Moduł porównania scenariuszy „as-is vs to-be”

- **Funkcje**:
  - zestawienie KPI „as-is” vs „to-be” (w tabelach i wykresach),
  - wskazanie procentowych i absolutnych różnic,
  - wizualizacja na layoutach (np. mapy cieplne).
- **Scenariusze wielowariantowe**:
  - porównanie wielu wariantów „to-be” pomiędzy sobą i względem „as-is”,
  - ranking scenariuszy wg zdefiniowanych kryteriów (np. ROI, throughput, CAPEX).

#### Wsparcie podejmowania decyzji

- **Obiektywne dane** z modelu zamiast opinii i intuicji.
- **Transparentne założenia** – każdy parametr może być prześledzony i zmieniony.
- **Symulacja ryzyka** – możliwość testowania negatywnych scenariuszy przed inwestycją.
- **Ustrukturyzowany proces decyzyjny** – materiał dla komitetu inwestycyjnego, zarządu, rady nadzorczej.
- **Warstwa zatwierdzenia przez człowieka** (Human approval layer): AI i symulacje wspierają analizę, lecz ostateczna odpowiedzialność za decyzje pozostaje po stronie zarządu klienta.

---

### Implementacja krok po kroku (wg dt-website)

1. **Object description** – definicja zakresu, ograniczeń i fizycznej rzeczywistości do modelowania (strefy, dostęp, BHP).
2. **Process block diagram** – mapowanie przepływu i logiki: wejścia, wyjścia, bufory, zasoby, reguły routingu i priorytety.
3. **Asset completion** – dodanie maszyn, stanowisk, transportu, ludzi i kontenerów materiałowych z istotnymi atrybutami.
4. **Layout on the floor** – rozmieszczenie zasobów w 3D i wczesna walidacja ograniczeń.
5. **Load times & data** – import czasów cyklu, przezbrojeń, zmienności i śladów historycznych (manual → Excel → API).
6. **Simulate variants + KPIs** – uruchamianie wariantów scenariuszy (w tym odchyleń) i decyzje na podstawie mierzalnych wyników.

---

### Typowe Use Cases (wg dt-website)

- **Greenfield / major expansion** – projektowanie nowego obiektu lub rozbudowy w 3D, testowanie w ruchu, walidacja przed CAPEX.
- **Layout change, relocation, line rebuild** – planowanie sekwencji przenosin, walidacja buforów i ścieżek transportowych, minimalizacja downtime.
- **Intralogistyka (Milkrun + Kanban) pod zmienność** – optymalizacja replenishmentu, tras i buforów; symulacja z odchyleniami (scrap, opóźnienia).
- **Magazyn – throughput i slotting** – symulacja operacji magazynowych, identyfikacja wąskich gardeł, walidacja obsady.
- **Balansowanie linii i obsady** – symulacja przypisań ludzi do stanowisk z uwzględnieniem zmienności i absencji.
- **Presales / Showroom (dostawcy)** – interaktywne demo 3D, modele maszyn w ruchu, materiał sprzedażowy, linki do zdalnych prezentacji.

