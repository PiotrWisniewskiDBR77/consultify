/**
 * DRD_KNOWLEDGE_OVERRIDES — Oś 1 (Procesy Cyfrowe, 9 obszarów × 7 poziomów)
 *                         + Oś 2 (Produkty Cyfrowe, 5 obszarów × 5 poziomów)
 *
 * Oxford O1 · partia 1 · 2026-07-02
 *
 * Format pytań: behawioralne — pytamy o zachowanie, artefakt lub zdarzenie,
 * NIE o samoocenę. Wzorzec z kanonu §9.2:
 *   „Kiedy ostatnio X? Pokażcie ten przypadek."
 *   „Co system zrobił, gdy Y? Jaki log/zrzut macie?"
 *
 * Pole `example` pełni rolę `expectedEvidence` (typ DRDLevelKnowledge nie ma
 * osobnego pola dowodowego; wpinamy je tutaj jako wskazówkę dla konsultanta).
 *
 * Języki: pytania PL (runtime), plik EN: knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis1-2.en.md
 */

import type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';

export const DRD_OVERRIDES_AXIS_1_2: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> =
  {
    // ================================================================
    // OŚ 1A — PROCESY SPRZEDAŻY (7 poziomów)
    // ================================================================

    '1A#1': {
      questions: [
        'Pokażcie ostatnie 10 zamówień w systemie — jak szybko od podpisania umowy trafił do niego wpis: tego samego dnia, kilka dni później, czy na koniec miesiąca?',
        'Kiedy handlowiec zamknął umowę bez wpisania jej do systemu? Jak to wyszło na jaw?',
        'Jak wygląda „zapis umowy" w systemie: pełne pola kontrahenta/produktu/wartości, czy tylko numer i data?',
      ],
      example:
        'Dowód: lista zamówień z datami wpisu vs datami podpisania (eksport z systemu); wydruk lub zrzut przykładowej umowy/zlecenia z wypełnionymi polami. Akceptowalny poziom: 100% zleceń z miesiąca bieżącego wpisanych w ciągu 24h.',
      suggestedTechnologies: ['CRM', 'Order Management System', 'Contract & Order Registry'],
    },

    '1A#2': {
      questions: [
        'Pokaż dashboard/raport sprzedażowy z zeszłego tygodnia — skąd pochodzi, kto go wygenerował i ile czasu zajęło przygotowanie?',
        'Jakie KPI sprzedażowe śledzicie automatycznie (np. konwersja, pipeline, AVG deal size), a jakie liczą ludzie ręcznie?',
        'Kiedy ostatnio raport sprzedażowy ujawnił problem, który wcześniej był niewidoczny? Opisz przypadek.',
      ],
      example:
        'Dowód: zrzut ekranu aktywnego raportu/dashboardu z datą wygenerowania; lista dostępnych KPI w narzędziu raportowym; historia wysłanych raportów (np. z e-maila lub CRM). Sygnał poziomu II: raport generuje się automatycznie, nie z ręcznego eksportu.',
      suggestedTechnologies: ['CRM', 'Reporting', 'KPI Dashboards', 'Performance Monitoring'],
    },

    '1A#3': {
      questions: [
        'Jak przebiega kontrola budżetu sprzedaży: system ostrzega o przekroczeniu planu w czasie rzeczywistym, czy dowiadujecie się po miesiącu z raportu?',
        'Pokaż, gdzie w systemie jest plan sprzedaży na bieżący kwartał i jak jest porównywany z wykonaniem na bieżąco.',
        'Kto może zmienić budżet sprzedażowy w systemie i jaki ślad zostawia ta zmiana?',
      ],
      example:
        'Dowód: zrzut widoku „plan vs wykonanie" z datą bieżącą; log zmian budżetu; parametry na podstawie których system wygenerował plan (historyczne dane, wskaźniki). Kluczowy sygnał poziomu III: budżet jest w systemie, a nie w arkuszu Excel menedżera.',
      suggestedTechnologies: [
        'Budgeting',
        'Forecasting',
        'Financial Planning',
        'CRM',
        'Sales Analytics',
      ],
    },

    '1A#4': {
      questions: [
        'Ile zamówień w ostatnim miesiącu złożyli klienci samodzielnie (sklep online/marketplace/platforma B2B) bez kontaktu z handlowcem? Jaki to % całości?',
        'Opisz ścieżkę klienta od wejścia na platformę do złożenia zamówienia — gdzie interweniuje człowiek, a gdzie system?',
        'Co się dzieje w systemie, gdy klient złoży zamówienie poza godzinami pracy — czy trafia do kolejki i realizacja startuje automatycznie?',
      ],
      example:
        'Dowód: raport zamówień z oznaczeniem kanału (online vs handlowiec); zrzut ścieżki zamówienia w panelu klienta; log zamówień spoza godzin pracy z timestampami. Sygnał poziomu IV: przynajmniej jeden segment klientów kupuje bez udziału handlowca.',
      suggestedTechnologies: [
        'E-commerce Platform',
        'Marketplace Integration',
        'Self-service Ordering',
        'B2B Procurement Platform',
      ],
    },

    '1A#5': {
      questions: [
        'Jak dane o dostawach/logistyce trafiają do procesu sprzedaży — ręczny telefon do magazynu, czy system odpytuje MES/WMS automatycznie przy tworzeniu zamówienia?',
        'Kiedy klient pyta o status dostawy, skąd handlowiec bierze informację: z systemu w jednym kliknięciu, czy dzwoni do logistyki?',
        'Pokaż raport z ostatniego miesiąca łączący dane sprzedaży z danymi dostaw (terminy realizacji, opóźnienia per klient).',
      ],
      example:
        'Dowód: zrzut widoku zamówienia z automatycznie dociągniętym statusem dostawy z systemu logistycznego; raport łączący dane sprzedaży i logistyki; screenshot integracji API lub widoku MES w CRM. Sygnał: handlowiec widzi status dostawy bez wychodzenia z CRM.',
      suggestedTechnologies: ['MES', 'WMS', 'CRM', 'OEE Dashboard', 'Warehouse Analytics'],
    },

    '1A#6': {
      questions: [
        'Pokaż, jak sprzedaż, zapasy, należności i marżowość są widoczne w jednym widoku systemowym — bez ręcznego łączenia danych z kilku programów.',
        'Kiedy ostatnio zmienił się warunek handlowy (cena, termin, limit kredytowy) — jak system to obsłużył i jaką ścieżką przeszła zmiana?',
        'Opisz przepływ danych od zamówienia klienta przez produkcję/zakupy do fakturowania — w ilu systemach odbywa się „przepisywanie" danych przez człowieka?',
      ],
      example:
        'Dowód: mapa integracji systemów (ERP → CRM → WMS → Finance) z datą aktualizacji; demo widoku order-to-cash w ERP bez przeskakiwania między systemami; liczba miejsc ręcznego przepisywania danych (cel: 0). Sygnał poziomu VI: jedno zamówienie widoczne we wszystkich modułach bez ręcznej synchronizacji.',
      suggestedTechnologies: [
        'ERP',
        'Master Data Management (MDM)',
        'API Integration',
        'Order Management',
        'CRM',
      ],
    },

    '1A#7': {
      questions: [
        'Pokaż przykład personalizacji oferty wygenerowanej przez algorytm AI dla konkretnego klienta — skąd wzięły się rekomendacje i jak zareagował klient?',
        'Czy chatbot lub bot sprzedażowy obsługuje jakiekolwiek zapytania handlowe? Ile interakcji miesięcznie i jaki % kończy się bez eskalacji do człowieka?',
        'Jak mierzycie skuteczność algorytmu rekomendacji — jaki uplift konwersji lub AVG order value w porównaniu do grupy bez rekomendacji?',
      ],
      example:
        'Dowód: log interakcji chatbota z ostatniego tygodnia ze wskaźnikiem rozwiązania; A/B test raport algorytmu rekomendacji (grupa z AI vs bez AI); przykładowa oferta personalizowana z metadanymi algorytmu. Sygnał poziomu VII: AI rekomenduje, człowiek zatwierdza lub przegląda wyjątki.',
      suggestedTechnologies: [
        'NLP',
        'Chatbots',
        'ML Models',
        'CRM',
        'Personalization Engine',
        'Customer Service Automation',
      ],
    },

    // ================================================================
    // OŚ 1B — PROCESY MARKETINGOWE (7 poziomów)
    // ================================================================

    '1B#1': {
      questions: [
        'Gdzie przechowujecie dane kontaktowe klientów pozyskanych w ostatnim kwartale — w CRM, arkuszu Excel, czy na różnych listach handlowców?',
        'Jak wygląda wpis nowego kontaktu w CRM: jakie pola są wypełniane obowiązkowo, a jakie zostają puste po 30 dniach od dodania?',
        'Kiedy ostatnio utraciliście klienta lub szansę sprzedaży przez brak dostępu do historii kontaktu (np. odejście handlowca)?',
      ],
      example:
        'Dowód: liczba kontaktów w CRM z datą ostatniej aktualizacji; % rekordów z wypełnionymi polami kluczowymi (email, firma, segment, źródło); raport brakujących danych (blank fields). Sygnał poziomu I: CRM istnieje i jest używany przez co najmniej 80% handlowców.',
      suggestedTechnologies: ['CRM', 'Contact Management', 'Customer Data Platform (CDP)'],
    },

    '1B#2': {
      questions: [
        'Jakie wskaźniki marketingowe (np. CPL, CTR, MQL) śledzicie w CRM lub narzędziu analitycznym na bieżąco, a nie tylko na koniec kwartału?',
        'Pokaż raport skuteczności ostatniej kampanii emailowej — open rate, CTR, konwersja, koszt pozyskania leada.',
        'Jak decydujecie o realokacji budżetu kampanii w trakcie miesiąca: na podstawie danych z systemu, czy intuicji menedżera?',
      ],
      example:
        'Dowód: zrzut dashboardu marketingowego z datą ostatniego odświeżenia; raport kampanii z CRM (wysłane, otwarte, kliknięte, skonwertowane); historia decyzji budżetowych z uzasadnieniem opartym o dane. Sygnał: kampanie oceniane w ciągu 48h, nie po miesiącu.',
      suggestedTechnologies: [
        'CRM',
        'Marketing Automation',
        'Campaign Tracking',
        'Reporting',
        'KPI Dashboards',
      ],
    },

    '1B#3': {
      questions: [
        'Pokaż wyniki z Google Analytics lub Search Console za ostatnie 30 dni — ile sesji z organiki, jakie są top landing pages i jaka konwersja?',
        'Jak optymalizujecie treści SEO: audyt słów kluczowych, monitoring pozycji, aktualizacja treści — jak często i kto to robi?',
        'Kiedy ostatnio dane z Google Analytics wpłynęły na decyzję o zmianie treści lub struktury strony — opisz przypadek.',
      ],
      example:
        'Dowód: eksport danych z Google Analytics lub Search Console (nie screenshot — realny raport); plan optymalizacji SEO z datami i właścicielami; przykład zmiany treści z udokumentowanym wpływem na ruch. Sygnał poziomu III: SEO jest procesem cyklicznym, nie jednorazowym projektem.',
      suggestedTechnologies: [
        'SEO Toolkit',
        'Google Analytics',
        'Search Console',
        'Content Analytics',
        'Web Analytics',
      ],
    },

    '1B#4': {
      questions: [
        'Opisz ostatnią kampanię e-mail marketingową: jak segmentowaliście bazę, jakie miała scenariusze automatyczne i co uruchamiało kolejny krok?',
        'Ile kampanii email/SMS działa aktualnie w trybie automatycznym (triggerowane zdarzeniem, a nie ręczną wysyłką)? Pokaż listę aktywnych automatyzacji.',
        'Jak personalizowane są treści w wysyłkach — imię, segment, historia zakupów, czy coś bardziej zaawansowanego?',
      ],
      example:
        'Dowód: zrzut ekranu listy aktywnych automatyzacji w platformie e-mail marketingowej (Mailchimp, HubSpot, Klaviyo itp.); raport kampanii z parametrami segmentacji; A/B test wynik dla wariantu z personalizacją vs bez. Sygnał poziomu IV: ≥3 automatyzacje aktywne jednocześnie, triggerowane zachowaniem klienta.',
      suggestedTechnologies: [
        'Email Marketing',
        'Campaign Automation',
        'Personalization Engine',
        'CRM',
        'Marketing Automation',
      ],
    },

    '1B#5': {
      questions: [
        'Jak mierzycie jakość leadów marketingowych (scoring) i gdzie ten scoring jest widoczny dla handlowca w CRM?',
        'Pokaż ścieżkę klienta przez lejek sprzedażowy: w którym momencie MQL staje się SQL i jak jest to określone (reguła w systemie vs ocena handlowca)?',
        'Jaka jest konwersja MQL→SQL→zamknięcie w ostatnim kwartale i skąd bierzecie te dane?',
      ],
      example:
        'Dowód: konfiguracja scoringu leadów w systemie (reguły, wagi, progi); raport konwersji MQL→SQL→Win z ostatnich 90 dni; zrzut widoku leada z wynikiem scoringowym w CRM. Sygnał: konwersja śledzona automatycznie, nie z ręcznego przeglądu pipeline.',
      suggestedTechnologies: ['MES', 'CRM', 'Marketing Automation', 'Lead Scoring', 'BI'],
    },

    '1B#6': {
      questions: [
        'Jak kampanie marketingowe są synchronizowane z działaniami sprzedaży i produkcji w systemie — czy ERP/CRM wie o trwającej promocji i uwzględnia ją w cennikach/stanach?',
        'Pokaż, jak zarządzacie danymi klientów w jednym miejscu dla marketingu, sprzedaży i obsługi klienta — czy to jeden system, czy dane są synchronizowane?',
        'Kiedy ostatni raz kampania marketingowa spowodowała kryzys logistyczny (zbyt duży popyt nieprzewidziany przez produkcję/zakupy)? Jak system powinien był to przewidzieć?',
      ],
      example:
        'Dowód: diagram integracji Marketing Automation ↔ CRM ↔ ERP; przykład kampanii z powiązanymi wpisami po stronie produkcji/zakupów; single customer view raport. Sygnał: kampania tworzona z widocznością stanów i mocy produkcyjnej.',
      suggestedTechnologies: [
        'ERP',
        'CRM',
        'Marketing Automation',
        'Customer Data Platform (CDP)',
        'API Integration',
      ],
    },

    '1B#7': {
      questions: [
        'Czy używacie chatbota lub algorytmu NLP do obsługi zapytań marketingowych/sprzedażowych? Ile interakcji tygodniowo i jaki jest wskaźnik samodzielnego rozwiązania?',
        'Jak generujecie treści marketingowe wspomagane AI (opisy produktów, posty, newslettery) — jaki % treści ma wkład AI i jak mierzycie jakość?',
        'Opisz przypadek, gdy AI zasugerowała grupę docelową kampanii lub kanał, który okazał się zaskakująco skuteczny.',
      ],
      example:
        'Dowód: log chatbota z ostatnich 7 dni (volume, containment rate, escalation rate); przykład treści wygenerowanej przez AI z metadanymi (model, prompt, review); raport kampanii z segmentem wygenerowanym przez algorytm. Sygnał poziomu VII: AI jest w pętli decyzyjnej kampanii, nie tylko narzędziem copywritera.',
      suggestedTechnologies: [
        'NLP',
        'Chatbots',
        'Content Generation',
        'Customer Service Automation',
        'ML Models',
      ],
    },

    // ================================================================
    // OŚ 1C — TECHNOLOGIA PROCESOWA I R&D (7 poziomów)
    // ================================================================

    '1C#1': {
      questions: [
        'Pokaż projekt lub komponent technologiczny zaprojektowany w CAD w ostatnim miesiącu — gdzie są przechowywane pliki, kto ma dostęp i jak jest zarządzana wersja?',
        'Jak wygląda rejestracja nowego rozwiązania technicznego: istnieje centralny rejestr projektów R&D z datami, statusem i przypisanym inżynierem?',
        'Co się dzieje z dokumentacją techniczną, gdy inżynier odchodzi z firmy — czy wiedza zostaje w systemie, czy znika wraz z nim?',
      ],
      example:
        'Dowód: rejestr projektów CAD z datami i wersjami (PDM/PLM lub folder sieciowy z wersjonowaniem); przykładowy projekt z historią zmian; procedura archiwizacji dokumentacji technicznej. Sygnał: każdy rysunek ma autora, wersję i datę — nie ma „ostatecznych_final_v3" bez daty.',
      suggestedTechnologies: ['CAD', 'PLM/PDM', 'Design Data Management'],
    },

    '1C#2': {
      questions: [
        'Pokaż symulację procesu lub stanowiska przeprowadzoną w ostatnim kwartale — narzędzie, parametry i wniosek z symulacji.',
        'Jak symulacje cyfrowe wpłynęły na decyzje projektowe (np. zmiana układu linii, dobór parametrów maszyny) — opisz konkretny przypadek z mierzalnym efektem.',
        'Ile czasu zajmuje przejście od koncepcji do pierwszej symulacji cyfrowej nowego procesu/stanowiska?',
      ],
      example:
        'Dowód: raport z symulacji (np. z Tecnomatix, Arena, SimPy, SolidWorks Simulation) z datą i wnioskami; decyzja projektowa uzasadniona wynikami symulacji (protokół, e-mail zarządu); czas od koncepcji do pierwszej symulacji (cel: <2 tyg.). Sygnał: symulacja poprzedza decyzję, nie dokumentuje jej po fakcie.',
      suggestedTechnologies: ['CAD', 'Simulation Tools', 'PLM/PDM', 'Digital Twin'],
    },

    '1C#3': {
      questions: [
        'Pokaż ostatnią analizę FMEA — kto ją przeprowadził, kiedy, dla jakiego procesu i jakie działania naprawcze z niej wynikły?',
        'Jak FMEA jest aktualizowana: po każdej zmianie procesu automatycznie (system wymusza), czy tylko gdy ktoś pamięta?',
        'Ile „otwartych" akcji naprawczych z FMEA jest zaległych powyżej 90 dni i kto to monitoruje?',
      ],
      example:
        'Dowód: arkusz FMEA z datą ostatniej aktualizacji, numerem RPN i statusem działań; lista otwartych akcji naprawczych z właścicielami i terminami; procedura wyzwalająca aktualizację FMEA przy zmianie procesu. Sygnał poziomu III: FMEA żyje po wdrożeniu — nie leży w szufladzie.',
      suggestedTechnologies: ['FMEA', 'Risk Register', 'Corrective Action Tracking (CAPA)'],
    },

    '1C#4': {
      questions: [
        'Ile prototypów lub testów procesowych zostało wykonanych w technologiach cyfrowych (druk 3D, VR/AR) w ostatnim roku, vs tradycyjnymi metodami?',
        'Pokaż ostatni prototyp z druku 3D lub symulację VR/AR — jakie pytanie inżynierskie rozwiązały, jaki czas zaoszczędziły vs metoda tradycyjna?',
        'Jak szkolicie operatorów z nowych procesów — instrukcja papierowa, video, czy środowisko VR/AR?',
      ],
      example:
        'Dowód: rejestr prototypów 3D z ostatnich 12 miesięcy (model, cel, wynik); czas od projektu do gotowego prototypu (cel: dni, nie tygodnie); protokół szkolenia VR/AR lub lista ukończonych sesji. Sygnał: prototypowanie cyfrowe jest domyślnym krokiem, nie wyjątkiem przy budżecie.',
      suggestedTechnologies: [
        '3D Printing',
        'Rapid Prototyping',
        'Design Verification',
        'Virtual Reality (VR)',
        'Augmented Reality (AR)',
      ],
    },

    '1C#5': {
      questions: [
        'Jak zarządzacie projektami technologicznymi: harmonogram, zasoby, kamienie milowe — w jakimś systemie klasy MES/PM, czy na tablicy i w e-mailach?',
        'Kiedy ostatnio projekt R&D przekroczył termin lub budżet — czy system wykrył to wcześniej (alert o ryzyku), czy dowiedzieliście się post factum?',
        'Pokaż ścieżkę krytyczną aktualnie realizowanego projektu technologicznego w systemie zarządzania projektami.',
      ],
      example:
        'Dowód: zrzut aktywnego projektu R&D w narzędziu PM (Jira, Asana, MS Project, MES) z harmonogramem i statusem; raport KPI projektu (termin, budżet, zasoby); alert/powiadomienie systemowe o ryzyku przekroczenia kamienia milowego. Sygnał: project manager widzi status bez pytania każdego inżyniera.',
      suggestedTechnologies: ['MES', 'Digital Twin', 'Simulation Models', 'PLM/PDM'],
    },

    '1C#6': {
      questions: [
        'Jak projekty technologiczne są synchronizowane z harmonogramem produkcji i zakupami w ERP — czy daty wdrożenia nowej technologii są widoczne w planie produkcji?',
        'Opisz przepływ danych od projektu technologicznego (czasy cyklu, parametry procesu) do wyceny oferty handlowej — ile jest ręcznego przeklejania między systemami?',
        'Kiedy ostatnio dane z ERP (np. koszty materiałowe, czas realizacji) wpłynęły na decyzję o zmianie projektu technologicznego jeszcze w fazie R&D?',
      ],
      example:
        'Dowód: integracja PLM/CAD ↔ ERP z mapą danych (które pola przepływają automatycznie); przykład wyceny projektu opartej na danych z ERP (nie z arkusza inżyniera); protokół design review z danymi kosztowymi z systemu. Sygnał: inżynier widzi koszt materiałowy w PLM, nie po fakcie w ERP.',
      suggestedTechnologies: ['ERP', 'PLM/PDM', 'API Integration', 'Master Data Management (MDM)'],
    },

    '1C#7': {
      questions: [
        'Opisz przypadek, gdy algorytm AI zaproponował optymalizację parametrów procesu lub wykrył potencjalny obszar innowacji, którego inżynierowie wcześniej nie rozważali.',
        'Jak AI wspiera R&D: analiza patentów, przegląd literatury, generowanie hipotez — jakie narzędzia, ile czasu oszczędzają?',
        'Pokaż dashboard optymalizacji procesu technologicznego zasilanego przez algorytm AI — jakie parametry optymalizuje i jak mierzymy efekt?',
      ],
      example:
        'Dowód: raport z narzędzia AI do analizy patentów lub optymalizacji procesu; udokumentowany przypadek zmiany projektu z rekomendacji AI (z metryką oszczędności); pętla alert AI → decyzja inżyniera → wynik (closed loop). Sygnał: AI jest w procesie R&D, nie po jego zakończeniu.',
      suggestedTechnologies: ['Digital Twin', 'ML Models', 'Simulation Models', 'IoT Data Feeds'],
    },

    // ================================================================
    // OŚ 1D — PROCESY ZAKUPOWE (7 poziomów)
    // ================================================================

    '1D#1': {
      questions: [
        'Pokaż rejestr dostawców w systemie — ile aktywnych dostawców i jakie pola danych są wypełnione dla każdego (dane kontaktowe, kategoria, warunki, certyfikaty)?',
        'Jak rejestrujecie nowe zamówienie zakupowe: manualnie w systemie przez kupca, czy jest jakiś automatyczny trigger (np. stan magazynowy)?',
        'Co się stało z ostatnim zamówieniem złożonym telefonicznie lub e-mailem — czy trafiło do systemu, czy pozostało poza nim?',
      ],
      example:
        'Dowód: lista dostawców z systemu z % wypełnienia kluczowych pól; przykładowe zamówienie zakupowe z wszystkimi polami (dostawca, pozycje, ceny, termin); log zamówień z ostatniego miesiąca. Sygnał: 100% zamówień powyżej progu (np. 1000 PLN) rejestrowanych w systemie dzień po złożeniu.',
      suggestedTechnologies: ['Supplier Registry', 'Purchase Orders', 'MRP', 'Contract & Order Registry'],
    },

    '1D#2': {
      questions: [
        'Jak planujecie zapasy i harmonogram zamawiania — MRP generuje propozycje automatycznie, czy kupiec sam decyduje kiedy zamówić?',
        'Pokaż przykład propozycji zakupowej wygenerowanej przez MRP z ostatniego tygodnia — jakie dane weszły (stany, BOM, lead time) i co system zaproponował?',
        'Ile razy w ostatnim miesiącu doszło do braków materiałowych niespodziewanych przez MRP — co jest ich przyczyną?',
      ],
      example:
        'Dowód: zrzut listy propozycji zakupowych MRP z datą wygenerowania i parametrami; raport braki materiałowe vs plan MRP (accuracy); protokół korekty parametrów MRP po analizie odchyleń. Sygnał: MRP accuracy ≥ 85% (propozycje realizowane bez ręcznej nadpisywanej).',
      suggestedTechnologies: ['MRP', 'Inventory Planning', 'Reorder Point Optimization', 'ERP'],
    },

    '1D#3': {
      questions: [
        'Pokaż ostatnie 5 zamówień zakupowych powyżej progu wymagającego akceptacji — jak przebiegał obieg akceptacji i ile czasu zajął każdy krok?',
        'Kto może zatwierdzić zakup powyżej 50 tys. PLN i jak to jest wymuszone przez system (a nie „bo tak zawsze robiliśmy")?',
        'Ile zamówień czeka aktualnie na zatwierdzenie i od ilu dni — gdzie to widać w systemie?',
      ],
      example:
        'Dowód: log workflow zakupowego z ostatnich 30 dni (kto zatwierdził, kiedy, czas oczekiwania); konfiguracja progów i akceptantów w systemie; raport zamówień przekraczających SLA akceptacji. Sygnał poziomu III: zero zamówień „z pominięciem" systemu — każdy zakup ma ślad cyfrowy.',
      suggestedTechnologies: ['Workflow Management', 'Approval Flows', 'ERP', 'Process Orchestration'],
    },

    '1D#4': {
      questions: [
        'Czy korzystacie z platform B2B do przetargów, aukcji lub porównania ofert dostawców? Pokaż ostatni przetarg — ile ofert wpłynęło, jak były porównywane?',
        'Jaki % zakupów w ostatnim roku przeszedł przez platformę elektroniczną (nie e-mail/telefon)? Jaka jest oszczędność kosztowa na tych zakupach vs tradycyjne?',
        'Jak dostawca składa ofertę lub potwierdza zamówienie — przez portal/platformę, czy mailem do kupca?',
      ],
      example:
        'Dowód: raport transakcji z platformy zakupowej (liczba przetargów, dostawców, oszczędności %); zrzut panelu dostawcy w portalu; porównanie kosztu zakupu platformowego vs tradycyjnego z ostatnich 12 miesięcy. Sygnał: platforma B2B obsługuje ≥30% wartości zakupów.',
      suggestedTechnologies: ['B2B Procurement Platform', 'e-Auctions', 'Supplier Portal', 'EDI'],
    },

    '1D#5': {
      questions: [
        'Jakie KPI zakupowe monitorujecie na bieżąco (np. OTIF dostawcy, koszt zakupu, jakość dostaw) i w jakim narzędziu?',
        'Pokaż ranking dostawców z ostatniego kwartału według jakości i terminowości — skąd pochodzą dane i jak często jest aktualizowany?',
        'Kiedy ostatnio ocena KPI zakupowego doprowadziła do renegocjacji umowy lub zmiany dostawcy — opisz przypadek.',
      ],
      example:
        'Dowód: dashboard KPI zakupowych z aktualną datą (OTIF, cena vs budżet, jakość); scorecard dostawcy z ostatnich 90 dni; protokół renegocjacji lub zmiany dostawcy z uzasadnieniem opartym o dane. Sygnał: decyzja o zmianie dostawcy poparta danymi z systemu, nie tylko opinią kupca.',
      suggestedTechnologies: ['MES', 'KPI Dashboards', 'Reporting', 'Supplier Portal', 'ERP'],
    },

    '1D#6': {
      questions: [
        'Jak zakupy są zintegrowane z planowaniem produkcji i finansami w systemie — czy zmiana planu produkcji automatycznie aktualizuje zapotrzebowanie zakupowe?',
        'Pokaż przepływ zamówienia od zatwierdzenia w ERP przez wysyłkę do dostawcy, przyjęcie towaru i zaksięgowanie faktury — ile jest manualnych kroków?',
        'Kiedy ostatnio odchylenie w zakupach (opóźnienie, wyższa cena) było widoczne w systemie produkcji jeszcze przed fizycznym problemem?',
      ],
      example:
        'Dowód: mapa procesu Purchase-to-Pay w ERP z oznaczeniem kroków automatycznych vs manualnych; raport czasu cyklu P2P (zamówienie → faktura zapłacona); integracja MRP ↔ zakupy ↔ finanse z diagramem przepływu danych. Sygnał: < 3 kroki ręczne w pełnym cyklu P2P.',
      suggestedTechnologies: ['ERP', 'Master Data Management (MDM)', 'API Integration', 'MRP'],
    },

    '1D#7': {
      questions: [
        'Czy stosujecie algorytmy predykcyjne do prognozowania cen surowców lub komponentów? Pokaż ostatnią prognozę i jak wpłynęła na decyzję zakupową.',
        'Jak AI wspomaga negocjacje z dostawcami — czy system podpowiada optymalną cenę docelową, moment zakupu lub alternatywnego dostawcę?',
        'Opisz przypadek, gdy algorytm wcześniej niż kupiec wykrył ryzyko wzrostu cen i firma zabezpieczyła się kontraktem forward.',
      ],
      example:
        'Dowód: raport prognozy cen z algorytmu (z dokładnością vs rzeczywistość); decyzja zakupowa oparta na rekomendacji AI z udokumentowaną oszczędnością; lista aktywnych alertów cenowych z systemu. Sygnał: AI wpływa na harmonogram i wartość co najmniej 20% zakupów.',
      suggestedTechnologies: ['ML Models', 'Forecasting', 'ERP', 'B2B Procurement Platform'],
    },

    // ================================================================
    // OŚ 1E — PROCESY LOGISTYCZNE (7 poziomów)
    // ================================================================

    '1E#1': {
      questions: [
        'Pokaż, jak skanujecie towar przy przyjęciu na magazyn — co system rejestruje i jak szybko pozycja jest widoczna w stanie magazynowym?',
        'Ile pozycji magazynowych nie ma kodu kreskowego lub RFID i jak jest zarządzana ich identyfikacja?',
        'Kiedy ostatnio pomyliliście towar lub wydaliście złą pozycję — co zawiodło w procesie identyfikacji?',
      ],
      example:
        'Dowód: zrzut procesu przyjęcia towaru ze skanera (timestamp, pozycja, liczba, lokalizacja); % pozycji magazynowych z kodem/RFID; log błędów wydania (pomyłki) z ostatnich 90 dni. Sygnał: 100% ruchów magazynowych (przyjęcia, wydania, przesunięcia) rejestrowanych przez skaner, nie ręcznie.',
      suggestedTechnologies: ['Barcode Scanners', 'RFID', 'Label Printers', 'Inventory Scanning'],
    },

    '1E#2': {
      questions: [
        'Jak pracownik magazynowy w czasie rzeczywistym sprawdza lokalizację i ilość towaru — mobilny terminal, aplikacja, czy idzie do komputera stacjonarnego?',
        'Pokaż, jak wygląda pick-list dla pracownika: papierowy wydruk, terminal mobilny, czy voice picking/AR?',
        'Ile czasu zajmuje zlokalizowanie towaru na magazynie, gdy zapytanie przychodzi z działu handlowego lub produkcji?',
      ],
      example:
        'Dowód: zrzut ekranu terminala mobilnego lub aplikacji WMS w użyciu (nie w demo); czas odpowiedzi na zapytanie o lokalizację towaru (SLA: <2 min); raport aktywności terminali (liczba transakcji dziennie na terminal). Sygnał: każdy ruch w magazynie potwierdzany przez terminal w czasie rzeczywistym.',
      suggestedTechnologies: ['Mobile Terminals', 'Real-time Location', 'Inventory Updates', 'WMS'],
    },

    '1E#3': {
      questions: [
        'Jak WMS zarządza procesem od zamówienia do wysyłki — pokaż przepływ zlecenia w systemie od momentu pojawienia się zamówienia do wygenerowania listu przewozowego.',
        'Czy korzystacie z EDI do wymiany danych z dostawcami lub odbiorcami? Jakie dokumenty (zamówienia, awiza, faktury) przechodzą przez EDI?',
        'Kiedy ostatnio WMS automatycznie zaproponował optymalną lokalizację dla nowego towaru — na jakiej podstawie?',
      ],
      example:
        'Dowód: zrzut workflow zamówienia w WMS (statusy: nowe → picking → pakowanie → wysłane); konfiguracja EDI z listą partnerów i dokumentów; log optymalizacji lokalizacji magazynowej. Sygnał: całość od zamówienia do listu przewozowego w jednym systemie bez ręcznego przepisywania.',
      suggestedTechnologies: ['WMS', 'EDI', 'B2B Integration', 'Barcode/RFID', 'Warehouse Analytics'],
    },

    '1E#4': {
      questions: [
        'Ile pojazdów AGV lub robotów magazynowych jest aktywnych na co dzień i jaki % transportu wewnętrznego jest zautomatyzowany?',
        'Pokaż dane o dostępności i wydajności AGV z ostatniego tygodnia — ile cykli, ile awarii, jaki czas przestoju?',
        'Jak robot/AGV współpracuje z WMS: czy WMS generuje zlecenie transportowe automatycznie, gdy AGV jest dostępny?',
      ],
      example:
        'Dowód: dashboard AGV z KPI (cykle/h, dostępność %, czas przestoju); integracja WMS ↔ AGV z diagramem przepływu zlecenia; raport porównujący wydajność z AGV vs przed wdrożeniem. Sygnał: AGV obsługuje ≥50% transportów wewnętrznych bez poleceń manualnych.',
      suggestedTechnologies: ['AGV', 'Warehouse Robotics', 'Route Optimization', 'WMS'],
    },

    '1E#5': {
      questions: [
        'Jak Milkrun lub Kanban jest zintegrowany z WMS i systemem produkcji — czy WMS automatycznie triggeruje trasę milkrun na podstawie zużycia materiałów?',
        'Pokaż KPI przepływu materiałów wewnętrznych z ostatniego miesiąca — lead time kompletacji, dokładność pickingu, fill rate.',
        'Kiedy ostatnio zakłócenie w logistyce wewnętrznej (brak, opóźnienie) zostało wykryte przez system przed zatrzymaniem linii produkcyjnej?',
      ],
      example:
        'Dowód: konfiguracja Kanban/Milkrun w systemie z powiązaniem z WMS; raport KPI logistyki wewnętrznej (lead time kompletacji, dokładność pickingu); zdarzenie systemowe „alert brak → milkrun trigger" z logu. Sygnał: linia produkcyjna nie zatrzymuje się przez braki generowane przez niewidzialność przepływu materiałów.',
      suggestedTechnologies: ['MES', 'WMS', 'SCADA', 'OEE Dashboard', 'Barcode/RFID'],
    },

    '1E#6': {
      questions: [
        'Jak logistyka (magazyn, transport, dostawy) jest widoczna w ERP razem z zamówieniami, produkcją i finansami — czy to jeden widok, czy trzeba łączyć raporty z kilku systemów?',
        'Pokaż, jak zamówienie klienta przechodzi z modułu sprzedaży do modułu magazynowego i transportowego w ERP — ile kroków jest automatycznych?',
        'Jak rozliczacie koszty logistyczne (magazyn, transport) per zamówienie lub per klienta w ERP — czy to możliwe z jednym kliknięciem?',
      ],
      example:
        'Dowód: demonstracja lub zrzuty ekranu przepływu Order-to-Ship w ERP (od zamówienia do dokumentu WZ/listu przewozowego); raport kosztu logistyki per klient/kanał; czas od zamówienia do wysyłki śledzony automatycznie w ERP. Sygnał: 0 ręcznych transferów danych między modułami logistyki i sprzedaży.',
      suggestedTechnologies: ['ERP', 'WMS', 'Master Data Management (MDM)', 'API Integration'],
    },

    '1E#7': {
      questions: [
        'Jak AI optymalizuje poziomy zapasów — czy system rekomenduje min/max/reorder point per SKU dynamicznie na podstawie popytu i lead time, czy są to stałe parametry?',
        'Opisz ostatni przypadek, gdy algorytm AI zaproponował zmianę lokalizacji towaru w magazynie, żeby skrócić czas pickingu — co osiągnęliście?',
        'Jak prognoza popytu AI wpływa na decyzje o uzupełnieniu zapasów — z jaką dokładnością i jak często algorytm mija się z rzeczywistością?',
      ],
      example:
        'Dowód: raport forecast accuracy AI vs rzeczywistość (MAPE lub MAE za ostatnie 90 dni); historia zmian parametrów min/max generowanych przez AI; mapa magazynu z historią optymalizacji lokalizacji przez algorytm. Sygnał: rotacja zapasów poprawiła się o ≥15% po wdrożeniu AI vs poprzedni rok.',
      suggestedTechnologies: ['ML Models', 'WMS', 'Forecasting', 'AGV', 'Route Optimization'],
    },

    // ================================================================
    // OŚ 1F — PROCESY PRODUKCYJNE (7 poziomów)
    // ================================================================

    '1F#1': {
      questions: [
        'Pokaż, jakie dane zbieracie z maszyn produkcyjnych automatycznie — jakie parametry, z jaką częstotliwością i gdzie lądują?',
        'Które maszyny w zakładzie zbierają dane cyfrowo, a które wymagają ręcznego zapisu przez operatora? Jaki to %?',
        'Kiedy ostatnio dane z maszyny pomogły wyjaśnić przyczynę wady produktu lub przestoju?',
      ],
      example:
        'Dowód: lista maszyn z planem hali z oznaczeniem, które zbierają dane automatycznie (OT asset inventory); przykładowy log parametrów maszynowych z ostatniej zmiany; raport wykorzystany do analizy przyczyn wady z danymi z maszyny. Sygnał: ≥70% maszyn na liniach krytycznych zbiera dane bez udziału operatora.',
      suggestedTechnologies: ['Machine Data Logging', 'PLC & Sensors', 'MES', 'SCADA'],
    },

    '1F#2': {
      questions: [
        'Pokaż, które parametry procesu są monitorowane przez PLC/sensory w czasie rzeczywistym i co system robi automatycznie, gdy parametr wyjdzie poza normę?',
        'Ile alarmów PLC/SCADA zostało wygenerowanych w ostatnim tygodniu i jaki % był prawdziwych (nie-falsepositive)?',
        'Jak operator dowiaduje się o problemie na linii — przez alarm w systemie, czy dlatego że „coś nie brzmi jak zwykle"?',
      ],
      example:
        'Dowód: konfiguracja alarmów PLC z listą monitorowanych parametrów i progów; raport alarmów z ostatnich 7 dni (true alarm rate); instrukcja operatora z opisem reakcji na alarm (nie „zadzwoń do mistrza"). Sygnał: operator reaguje na alarm systemu przed defektem produktu, nie po.',
      suggestedTechnologies: ['PLC', 'Sensors', 'Industrial Detectors', 'SCADA', 'MES'],
    },

    '1F#3': {
      questions: [
        'Pokaż wskaźnik OEE dla głównej linii produkcyjnej z ostatniego miesiąca — jak jest mierzony, kto go analizuje i jakie działania podjęto w odpowiedzi na odchylenia?',
        'Jak CMMS zarządza harmonogramem przeglądów i konserwacji — czy zlecenia PM są generowane automatycznie przez system, czy przez planistę utrzymania ruchu?',
        'Gdzie jest Value Stream Map aktualnie obowiązującej linii produkcyjnej i kiedy była ostatnio aktualizowana?',
      ],
      example:
        'Dowód: raport OEE (Dostępność × Wydajność × Jakość) z ostatnich 30 dni z trendem; plan przeglądów z CMMS (zlecenia PM z datami i wykonawcami); VSM z aktualną datą i oznaczonymi marnotrawstwami. Sygnał: OEE > 65% jest punktem wyjścia dla działań doskonalących, nie tylko informacją historyczną.',
      suggestedTechnologies: ['CMMS', 'OEE Dashboard', 'Value Stream Mapping (VSM)', 'MES', 'SCADA'],
    },

    '1F#4': {
      questions: [
        'Ile stanowisk na głównej linii produkcyjnej jest w pełni zautomatyzowanych (robot/automat bez udziału operatora) i jaki % to stanowi w całym procesie?',
        'Pokaż dane o przestojach robotów z ostatniego miesiąca — jaka dostępność, jakie najczęstsze przyczyny awarii?',
        'Jak robot lub automat jest przeprogramowywany przy zmianie asortymentu — ile zajmuje to czasu i kto to wykonuje?',
      ],
      example:
        'Dowód: mapa linii produkcyjnej z oznaczeniem stanowisk zautomatyzowanych; raport OEE/dostępności robotów z ostatnich 90 dni; czas przestawienia (changeover) przy zmianie produktu z logiem. Sygnał: automatyzacja dotyczy stanowisk, gdzie błąd ludzki był główną przyczyną defektów.',
      suggestedTechnologies: ['PLC', 'MES', 'Cobots', 'Robot Safety Systems', 'Automation Cells'],
    },

    '1F#5': {
      questions: [
        'Pokaż, jak MES zarządza zleceniami produkcyjnymi w czasie rzeczywistym — od momentu pojawienia się zlecenia do jego zamknięcia, co system robi automatycznie?',
        'Jak operator na hali widzi, co ma produkować, w jakiej kolejności i na jakim stanowisku — papierowy rozkaz roboty, terminal MES, czy screen przy maszynie?',
        'Kiedy ostatnio MES automatycznie zmienił kolejkę produkcyjną w odpowiedzi na zakłócenie (np. awaria maszyny, brak materiału)?',
      ],
      example:
        'Dowód: zrzut kolejki zleceń produkcyjnych w MES z datą; log automatycznej zmiany kolejności przy zakłóceniu; raport realizacji zleceń (on-time, kompletność, odchylenia ilościowe). Sygnał: operator nie drukuje papierowego rozkazu — widzi zlecenie na ekranie i potwierdza wykonanie w systemie.',
      suggestedTechnologies: ['MES', 'SCADA', 'OEE Dashboard', 'PLC', 'Sensors'],
    },

    '1F#6': {
      questions: [
        'Jak ERP synchronizuje plan produkcji z zakupami, sprzedażą i finansami — czy zmiana zamówienia klienta natychmiast widoczna jest w planie materiałowym i harmonogramie?',
        'Ile systemów (ERP, MES, WMS, QMS) jest zintegrowanych ze sobą w czasie rzeczywistym na hali produkcyjnej — pokaż mapę integracji.',
        'Jak często „plan ERP" i „rzeczywistość na hali" się rozchodzą i co system robi automatycznie, żeby wyrównać różnicę?',
      ],
      example:
        'Dowód: mapa integracji systemów (ERP ↔ MES ↔ WMS ↔ QMS) z flow danych; demo zmiany zamówienia klienta → automatycznej aktualizacji planu produkcji i materiałowego; raport odchyleń plan vs wykonanie z trendami. Sygnał: czas od zmiany zamówienia do aktualizacji planu produkcji < 1h bez ręcznej interwencji.',
      suggestedTechnologies: ['ERP', 'MES', 'Master Data Management (MDM)', 'API Integration', 'SCADA'],
    },

    '1F#7': {
      questions: [
        'Pokaż przypadek, gdy AI zoptymalizowała harmonogram produkcji — jakie parametry optymalizowała (czas przezbrojeń, OEE, termin dostawy) i o ile się poprawiły?',
        'Czy używacie cyfrowego bliźniaka (digital twin) do planowania lub optymalizacji produkcji? Pokaż ostatnią symulację i decyzję na jej podstawie.',
        'Jak AI wykrywa anomalie w procesie produkcyjnym przed wystąpieniem wady lub awarii — przykład z logu predykcji.',
      ],
      example:
        'Dowód: raport optymalizacji harmonogramu AI (before/after OEE, changeover time, OTIF); symulacja digital twin z udokumentowaną decyzją; log predykcji anomalii z ostatnich 30 dni (true positive rate). Sygnał: AI-scheduler działa na żywych danych, nie tylko jako demo.',
      suggestedTechnologies: ['Digital Twin', 'ML Models', 'MES', 'Simulation Models', 'IoT Data Feeds'],
    },

    // ================================================================
    // OŚ 1G — PROCESY JAKOŚCI (7 poziomów)
    // ================================================================

    '1G#1': {
      questions: [
        'Pokaż, jak wygląda elektroniczny protokół kontroli jakości z ostatniej zmiany — kto go wypełnił, jakie parametry, co się stało z wynikami poniżej normy?',
        'Ile protokołów jakości z ostatniego tygodnia jest w formie papierowej, ile elektronicznej — i gdzie trafiają po wypełnieniu?',
        'Kiedy ostatnio kontrola jakości wykryła problem, który był widoczny w danych zanim doszło do reklamacji klienta?',
      ],
      example:
        'Dowód: przykładowy elektroniczny protokół kontroli z systemu (nie skan papieru) z datą i podpisem cyfrowym; % protokołów elektronicznych vs papierowych z ostatnich 30 dni; raport niezgodności z datą wykrycia vs datą reklamacji. Sygnał: 100% protokołów kontroli w formie cyfrowej wprowadzanej w miejscu kontroli.',
      suggestedTechnologies: ['Compliance Sheets', 'Inspection Records', 'QMS'],
    },

    '1G#2': {
      questions: [
        'Które parametry jakościowe (wymiary, masa, wygląd, skład) są mierzone automatycznie przez maszyny lub systemy wizyjne, a które przez pracownika z przymiarką?',
        'Pokaż raport wyników kontroli automatycznej z ostatniej doby — jak szybko do systemu trafia wynik pomiaru po pobraniu próbki?',
        'Kiedy ostatnio kamera lub czujnik wykrył wadę, której nie widział kontroler wizualny — opisz przypadek.',
      ],
      example:
        'Dowód: lista stanowisk z automatyczną kontrolą jakości (maszyna, parametr, SPC chart); raport false positive/false negative z systemu wizyjnego z ostatnich 90 dni; czas od pomiaru do wpisu w QMS. Sygnał: automatyczna kontrola obejmuje ≥50% krytycznych parametrów jakościowych.',
      suggestedTechnologies: ['Machine Vision', 'Cameras', 'Automated Inspection', 'QMS', 'MES'],
    },

    '1G#3': {
      questions: [
        'Co dzieje się w systemie, gdy kontrola jakości wykryje niezgodność — pokaż automatyczny przepływ od wykrycia do podjęcia decyzji o zatrzymaniu/kontynuacji?',
        'Kto jest alarmowany przez system przy przekroczeniu limitu kontrolnego i jaki jest oczekiwany czas reakcji (SLA)?',
        'Ile alertów jakościowych z ostatniego tygodnia zakończyło się działaniem korygującym, a ile zostało zamkniętych bez działania?',
      ],
      example:
        'Dowód: diagram przepływu NC (niezgodność) w systemie QMS z automatycznym routingiem; raport alertów jakościowych z ostatnich 30 dni z czasem reakcji i wynikiem; % alertów z podjętym działaniem korygującym. Sygnał: czas od wykrycia niezgodności do poinformowania właściwych osób < 15 minut.',
      suggestedTechnologies: ['QMS', 'Corrective Action Tracking (CAPA)', 'MES', 'Reporting'],
    },

    '1G#4': {
      questions: [
        'Pokaż roboty lub zaawansowane systemy wizyjne używane do automatycznej kontroli jakości — jakie defekty wykrywają i z jaką dokładnością?',
        'Jak porównuje się wskaźnik wykrywalności defektów: system automatyczny vs kontroler wizualny — dane z ostatnich 3 miesięcy?',
        'Co się dzieje z detektowanymi przez robota/kamerę wadami: automatyczna segregacja, zatrzymanie linii, czy tylko rejestracja?',
      ],
      example:
        'Dowód: specyfikacja systemu wizyjnego z typami wykrywanych defektów; raport porównawczy dokładności detekcji (robot vs human inspection); log automatycznych akcji po detekcji wady (zatrzymanie → rejestracja → segregacja). Sygnał: system automatyczny zastąpił lub wsparł 100% inspekcji wizualnej na krytycznych pozycjach.',
      suggestedTechnologies: ['Machine Vision', 'Cameras', 'Automated Inspection', 'QMS', 'MES'],
    },

    '1G#5': {
      questions: [
        'Pokaż, jak QMS zarządza całym cyklem życia dokumentu jakościowego: od utworzenia, przez zatwierdzenie, dystrybucję, do rewizji — co jest automatyczne?',
        'Jak mierzycie stabilność procesu (np. Cp, Cpk, SPC) i gdzie są widoczne te wskaźniki dla menedżera jakości?',
        'Kiedy ostatnio raport z QMS doprowadził do zmiany systemowej (nie jednorazowej) w procesie produkcyjnym — opisz przypadek.',
      ],
      example:
        'Dowód: lista aktywnych dokumentów QMS z datami rewizji i właścicielami; karta SPC lub raport Cp/Cpk z ostatnich 30 dni; zmiana systemu produkcyjnego udokumentowana jako konsekwencja analizy QMS. Sygnał: QMS jest źródłem inicjatyw doskonalących, nie tylko archiwum certyfikatów.',
      suggestedTechnologies: ['QMS', 'Quality Planning', 'Inspection Reporting', 'MES', 'Reporting'],
    },

    '1G#6': {
      questions: [
        'Jak QMS jest zintegrowany z ERP w procesie obsługi reklamacji — czy reklamacja klienta automatycznie tworzy NC w QMS i połączoną notę korygującą w finansach?',
        'Pokaż raport jakości połączony z danymi kosztowymi — ile kosztuje nas brak jakości (wewnętrzny vs zewnętrzny) w ostatnim kwartale?',
        'Jak dane jakościowe z produkcji wpływają na parametry zakupowe (np. ocenę dostawcy) — czy to automatyczny przepływ, czy ręczna analiza co kwartał?',
      ],
      example:
        'Dowód: integracja QMS ↔ ERP (mapa przepływu reklamacja → NC → nota kredytowa); raport cost of poor quality (COPQ) z ostatnich 3 miesięcy; automatyczny wpływ oceny jakości dostawcy na raiting w module zakupów ERP. Sygnał: koszty jakości widoczne w rachunkowości zarządczej, nie tylko w raporcie działu jakości.',
      suggestedTechnologies: ['ERP', 'QMS', 'Corrective Action Tracking (CAPA)', 'Reporting'],
    },

    '1G#7': {
      questions: [
        'Pokaż, jak algorytm AI decyduje, które partie produkcyjne wymagają pełnej kontroli jakości, a które mogą być zwolnione na podstawie danych procesu.',
        'Jak AI przewiduje defekty przed ich wystąpieniem — z jaką wyprzedzeniem i jaką dokładnością w ostatnich 90 dniach?',
        'Opisz przypadek, gdy predykcja AI jakości pozwoliła uniknąć reklamacji lub kosztownego przeróbki — jaka była miara oszczędności?',
      ],
      example:
        'Dowód: raport predykcji AI jakości z precision/recall za ostatnie 90 dni; log partii zwolnionych bez pełnej kontroli na podstawie rekomendacji AI (i ich wyniki); kalkulacja kosztów unikniętych dzięki predykcji. Sygnał: AI-driven sampling zastąpił calendar-based lub 100% inspection na co najmniej jednej linii.',
      suggestedTechnologies: ['ML Models', 'QMS', 'MES', 'Machine Vision', 'IoT Data Feeds'],
    },

    // ================================================================
    // OŚ 1H — ZARZĄDZANIE FINANSAMI (7 poziomów)
    // ================================================================

    '1H#1': {
      questions: [
        'Pokaż, jak przetwarzacie przychodzące faktury — skanowanie OCR, ręczne przepisywanie, czy e-faktura wchodzi automatycznie do systemu?',
        'Ile czasu zajmuje zaksięgowanie faktury od jej otrzymania do pojawienia się w rozrachunkach — i ile tego czasu to ręczna praca?',
        'Gdzie przechowujecie dokumenty finansowe (faktury, umowy, noty) — papierowe archiwum, lokalny dysk, DMS z wyszukiwaniem pełnotekstowym?',
      ],
      example:
        'Dowód: log przetworzonych faktur z ostatniego miesiąca z typem (OCR/manual/EDI); czas cyklu fakturowania (data wpływu → data zaksięgowania) z percentylami; lista systemów DMS z wyszukiwarką. Sygnał: >80% faktur przetwarzanych bez ręcznego przepisywania danych.',
      suggestedTechnologies: ['OCR', 'Document Management', 'Invoice Capture', 'AP Automation'],
    },

    '1H#2': {
      questions: [
        'Pokaż aktualny dashboard finansowy (FC) z kluczowymi wskaźnikami — skąd pochodzi i jak często jest aktualizowany (real-time, daily, monthly)?',
        'Jak menedżer finansowy sprawdza odchylenia od budżetu: wchodzi do systemu i widzi, czy czeka na raport od analityka?',
        'Jakie KPI finansowe (np. DSO, marża brutto, burn rate) macie skonfigurowane jako automatyczne alerty?',
      ],
      example:
        'Dowód: zrzut dashboardu FC z datą ostatniego odświeżenia; lista alertów finansowych z systemu (KPI, progi, odbiorcy); raport variance analysis z ostatniego miesiąca (plan vs actuals z drilldown). Sygnał: CFO widzi bieżące wyniki bez raportu od controllera.',
      suggestedTechnologies: ['BI', 'Data Warehouse', 'Reporting', 'KPI Dashboards', 'Budgeting'],
    },

    '1H#3': {
      questions: [
        'Pokaż, jak wygląda proces akceptacji płatności lub kosztów powyżej progu — kto zatwierdza, ile to trwa i gdzie widać status oczekujących decyzji?',
        'Kto może zaksięgować koszt powyżej 100 tys. PLN i jak system wymusza ścieżkę akceptacji (a nie tylko politykę na papierze)?',
        'Ile wniosków finansowych czeka aktualnie na akceptację i od ilu dni — pokaż tę listę z systemu.',
      ],
      example:
        'Dowód: konfiguracja matrycy akceptacji w systemie (kwoty, role, eskalacje); raport oczekujących akceptacji z datami; czas cyklu procesu akceptacji (wniosek → decyzja) z percentylami za ostatni miesiąc. Sygnał: zero zatwierdzonych płatności poza systemem — pełny ślad audytowy.',
      suggestedTechnologies: ['Workflow Management', 'Approval Flows', 'ERP', 'Process Orchestration'],
    },

    '1H#4': {
      questions: [
        'Jakie procesy finansowe są obsługiwane przez RPA — np. automatyczne przetwarzanie wyciągów bankowych, matching faktur, raporty? Ile godzin miesięcznie to oszczędza?',
        'Pokaż bota RPA w akcji lub jego log z ostatniego tygodnia — ile transakcji obsłużył i ile wyjątków (błędów) przekazał do człowieka?',
        'Jak mierzycie jakość procesów zautomatyzowanych przez RPA — jakie mają SLA i error rate?',
      ],
      example:
        'Dowód: lista uruchomionych botów RPA z zakresem zadań i wolumenem tygodniowym; raport błędów/wyjątków (error rate < 5%); kalkulacja oszczędności godzin FTE miesięcznie dzięki RPA. Sygnał: RPA działa 24/7 na co najmniej 2 procesach finansowych bez nadzoru.',
      suggestedTechnologies: ['RPA', 'Invoice Processing', 'AP Automation', 'Financial Posting'],
    },

    '1H#5': {
      questions: [
        'Pokaż workflow finansowy zarządzający procesem od wniosku do płatności — kto, co, w jakiej kolejności, z jakimi SLA?',
        'Jak system ślędzi status każdego zadania finansowego (np. zatwierdzenie faktury, uzgodnienie konta) — kto widzi zaległości?',
        'Kiedy ostatnio system workflow finansowego automatycznie eskalował zaległe zadanie do menedżera wyższego szczebla?',
      ],
      example:
        'Dowód: mapa workflow finansowego (wizualna, nie opisowa) z SLA per krok; raport zaległości z systemu (overdue tasks z datami i właścicielami); log eskalacji automatycznych z ostatnich 30 dni. Sygnał: każde zadanie finansowe ma właściciela, termin i widoczność w systemie.',
      suggestedTechnologies: ['Workflow Management', 'Approval Flows', 'ERP', 'Reporting'],
    },

    '1H#6': {
      questions: [
        'Jak finanse są zintegrowane z pozostałymi modułami w ERP — czy zamówienie zakupu automatycznie generuje rezerwację budżetu, a faktura automatycznie trafia do rozrachunków?',
        'Pokaż sprawozdanie finansowe wygenerowane z ERP w ciągu ostatniego tygodnia — jak długo zajęło przygotowanie i ile danych uzupełniono ręcznie poza systemem?',
        'Ile „równoległych arkuszy Excel" działa w firmie obok ERP do zarządzania finansami?',
      ],
      example:
        'Dowód: demo generowania P&L lub balance sheet z ERP (czas generowania < 10 min); lista modułów ERP zintegrowanych z finansami (mapa data flow); liczba „shadow spreadsheets" zidentyfikowanych w ostatnim audycie IT. Sygnał: sprawozdanie finansowe zamknięcia miesiąca < 3 dni roboczych.',
      suggestedTechnologies: ['ERP', 'Budgeting', 'Financial Planning', 'Reporting', 'API Integration'],
    },

    '1H#7': {
      questions: [
        'Jak AI lub BI wspierają prognozowanie finansowe — czy model automatycznie generuje scenariusze (base/worst/best) na bazie danych historycznych i założeń makro?',
        'Pokaż ostatni raport analityczny przygotowany z pomocą AI — jakie pytanie biznesowe odpowiedział i ile czasu zaoszczędził vs ręczna analiza?',
        'Jak AI wykrywa anomalie w danych finansowych (np. fraud, duplikaty faktur, nieuzasadnione odchylenia) — przykład z ostatnich 3 miesięcy.',
      ],
      example:
        'Dowód: model prognozowania finansowego AI z accuracy za ostatnie 6 miesięcy (MAPE); raport analityczny z zaznaczonymi wnioskami AI; log anomalii wykrytych przez AI z klasyfikacją (prawdziwe/fałszywe alarmy). Sygnał: prognoza finansowa AI jest używana przez CFO w procesie decyzyjnym, nie tylko generowana.',
      suggestedTechnologies: ['BI', 'ML Models', 'Data Warehouse', 'Forecasting', 'Budgeting'],
    },

    // ================================================================
    // OŚ 1I — PROCESY HR (7 poziomów)
    // ================================================================

    '1I#1': {
      questions: [
        'Jak ewidencjonujecie czas pracy pracowników — papierowe karty, system kadrowy, RCP (czytnik kart/biometryczny)?',
        'Ile czasu zajmuje menedżerowi HR potwierdzenie obecności pracownika w wybranym dniu z miesiąc temu — od pytania do odpowiedzi?',
        'Co się dzieje z kartą czasu pracy nowego pracownika w pierwszym tygodniu — wpisywana ręcznie, czy automatycznie generowana po założeniu konta?',
      ],
      example:
        'Dowód: zrzut systemu RCP lub ewidencji czasu pracy z przykładowym dniem; % pracowników z elektroniczną ewidencją czasu (cel: 100%); czas od złożenia wniosku o potwierdzenie obecności do odpowiedzi (SLA < 5 min z systemu). Sygnał: 100% pracowników rejestruje czas w systemie, zero kart papierowych.',
      suggestedTechnologies: ['Biometric Readers', 'Time & Attendance', 'Access Control', 'HRM'],
    },

    '1I#2': {
      questions: [
        'Jak przebiega proces wypłaty wynagrodzeń — jak długo trwa zamknięcie listy płac i ile kroków wymaga ręcznej weryfikacji?',
        'Pokaż, jak system kadrowo-płacowy oblicza podatki, ZUS i wynagrodzenia netto — czy jest to w pełni automatyczne, czy ktoś „sprawdza liczby" w arkuszu?',
        'Kiedy ostatnio błąd w liście płac został wykryty przez system przed wypłatą (a nie przez pracownika po wypłacie)?',
      ],
      example:
        'Dowód: raport czasu zamknięcia listy płac z ostatnich 6 miesięcy (cel: < 3 dni); log weryfikacji automatycznej listy płac (co system sprawdza); historia wykrytych błędów płacowych (pre vs post wdrożenie systemu). Sygnał: lista płac zamykana przez system, nie przez księgową z kalkulatorem.',
      suggestedTechnologies: ['Payroll System', 'Tax Declarations', 'Salary Management', 'HRM'],
    },

    '1I#3': {
      questions: [
        'Jak pracownik rejestruje wejście i wyjście — karta zbliżeniowa, odcisk palca, aplikacja mobilna? Co widzi menedżer w czasie rzeczywistym?',
        'Pokaż raport obecności z ostatniego tygodnia — jak jest generowany i kto go przegląda przed zatwierdzeniem do płac?',
        'Co dzieje się w systemie, gdy pracownik nie pojawia się bez zgłoszenia — czy system alertuje menedżera automatycznie?',
      ],
      example:
        'Dowód: zrzut raportu obecności z systemu RCP z datą; konfiguracja alertów nieobecności (do kogo, kiedy, jak szybko); czas od nieobecności do alertu w systemie (SLA < 30 min). Sygnał: menedżer wie o nieplanowanej nieobecności z systemu, nie od kolegi z pracy.',
      suggestedTechnologies: ['Biometric Readers', 'Time & Attendance', 'Access Control', 'HRM'],
    },

    '1I#4': {
      questions: [
        'Czy pracownicy mogą samodzielnie złożyć wniosek urlopowy, zmienić dane osobowe lub pobrać dokumenty przez system/kiosk/aplikację mobilną?',
        'Pokaż ścieżkę wniosku urlopowego od złożenia do zatwierdzenia i naliczenia w systemie płacowym — ile trwa i ile kroków jest automatycznych?',
        'Ile wniosków pracowniczych (urlop, nadgodziny, delegacja) z ostatniego miesiąca przeszło przez system vs wiadomości e-mail/papier?',
      ],
      example:
        'Dowód: zrzut panelu samoobsługowego pracownika; czas cyklu wniosku urlopowego (złożenie → zatwierdzenie → naliczenie) z logu; % wniosków elektronicznych vs papierowych z ostatnich 30 dni. Sygnał: >90% wniosków pracowniczych składanych przez system, nie e-mailem do HR.',
      suggestedTechnologies: ['Employee Kiosk', 'Self-Service HR Portal', 'Digital Forms', 'HRM'],
    },

    '1I#5': {
      questions: [
        'Pokaż, jak HRM zarządza planowaniem szkoleń — skąd system wie, które szkolenia są potrzebne dla konkretnego pracownika i kiedy je przypomina?',
        'Jak ocena pracownicza (performance review) jest przeprowadzana i przechowywana w systemie — formularz papierowy po skanowaniu, czy natywnie elektroniczny?',
        'Jak ścieżka kariery pracownika jest udokumentowana w HRM i kto ją aktualizuje po każdej zmianie stanowiska/kompetencji?',
      ],
      example:
        'Dowód: zrzut profilu pracownika w HRM z historią stanowisk, szkoleń i ocen; raport zaplanowanych szkoleń z najbliższych 90 dni wygenerowany automatycznie; matryca kompetencji zespołu z aktualną datą. Sygnał: HRM jest źródłem decyzji o szkoleniach, nie arkusz Excel kierownika.',
      suggestedTechnologies: ['HRM', 'Training Planning', 'Performance Reviews'],
    },

    '1I#6': {
      questions: [
        'Jak moduł HR jest zintegrowany z ERP (produkcja, koszty, projekty) — czy koszt pracy jest automatycznie alokowany do zleceń produkcyjnych lub projektów?',
        'Pokaż raport kosztów HR zintegrowany z wynikami finansowymi firmy — jak szybko możesz uzyskać koszt robocizny per projekt lub dział za bieżący miesiąc?',
        'Gdy pracownik zmienia dział lub stanowisko, jak automatycznie zmienia się jego profil w systemie (płace, szkolenia, dostępy, koszty)?',
      ],
      example:
        'Dowód: konfiguracja integracji HRM ↔ ERP (alokacja kosztów pracy); raport koszt robocizny per projekt/dział z ERP za bieżący miesiąc; log automatycznej zmiany konfiguracji pracownika po zmianie stanowiska. Sygnał: koszt pracy widziany przez menedżera projektu w ERP, nie przesyłany mailem przez HR.',
      suggestedTechnologies: ['ERP', 'HRM', 'Payroll System', 'API Integration'],
    },

    '1I#7': {
      questions: [
        'Jak AI wspiera rekrutację: screening CV, dopasowanie kandydatów, planowanie rozmów — ile czasu oszczędza rekruter i jak mierzycie jakość doboru?',
        'Czy system HR analizuje dane o pracownikach w celu przewidywania rotacji lub identyfikacji talentów — pokaż przykład takiej analizy.',
        'Jak AI personalizuje plany rozwojowe pracowników na podstawie danych o kompetencjach, wynikach i ścieżkach innych pracowników?',
      ],
      example:
        'Dowód: raport AI screeningu CV (precision kandydatów do 1. rozmowy vs ręczny przegląd); predykcja rotacji z accuracy za ostatnie 6 miesięcy; przykład spersonalizowanego planu szkoleniowego wygenerowanego przez AI vs standard. Sygnał: time-to-hire skrócił się o ≥20% po wdrożeniu AI w rekrutacji.',
      suggestedTechnologies: ['ML Models', 'HRM', 'NLP', 'Training Planning', 'Performance Reviews'],
    },

    // ================================================================
    // OŚ 2A — PRODUKTY CYFROWE (5 poziomów)
    // ================================================================

    '2A#1': {
      questions: [
        'Jakie produkty cyfrowe (e-booki, pliki, materiały do pobrania lub streamingu) oferujecie klientom i jak są dostarczane po zakupie?',
        'Pokaż ścieżkę zakupu i dostarczenia produktu cyfrowego — gdzie klient płaci, gdzie pobiera, jak fast jest dostarczenie?',
        'Ile unikalne produkty cyfrowe sprzedaliście w ostatnim miesiącu i jaki % przychodów to stanowi?',
      ],
      example:
        'Dowód: lista produktów cyfrowych w sklepie z ceną i opisem; raport sprzedaży za ostatnie 30 dni (liczba transakcji, przychód, typ produktu); czas od zakupu do dostępu klienta do produktu (SLA: natychmiastowy lub <5 min). Sygnał: produkt cyfrowy jest sprzedawany regularnie, nie tylko jako projekt pilotażowy.',
      suggestedTechnologies: ['E-commerce Platform', 'Digital Delivery', 'Payment Integration'],
    },

    '2A#2': {
      questions: [
        'Czy te same treści są dostępne przez różne kanały lub formaty (np. ebook + audiobook + wideo, aplikacja na iOS i Android) — pokaż przykład.',
        'Jak zarządzacie dystrybucją treści multimedialnych na różne platformy — osobne uploadowania do każdej, czy jeden system dystrybucji?',
        'Które platformy streamingowe lub urządzenia są obsługiwane przez wasze produkty i jak testujecie kompatybilność?',
      ],
      example:
        'Dowód: lista formatów dostępnych per tytuł/produkt; zrzut panelu zarządzania dystrybucją multi-platform; raport oglądania/słuchania per platformę i urządzenie. Sygnał: treść wgrywana raz, dystrybuowana automatycznie na ≥3 platformy/formaty.',
      suggestedTechnologies: ['Content Management', 'Multi-platform Distribution', 'Streaming Platform'],
    },

    '2A#3': {
      questions: [
        'Jakie zaawansowane funkcje mają wasze produkty cyfrowe poza samą treścią — personalizacja, AI, interakcja z innymi użytkownikami?',
        'Pokaż przykład personalizacji w produkcie (np. rekomendacje oparte na historii użycia, adaptacja treści) — jak działa i jakie dane zbiera?',
        'Jak mierzycie zaangażowanie użytkowników w funkcje cyfrowe produktu (completion rate, time in app, powroty)?',
      ],
      example:
        'Dowód: opis funkcji zaawansowanych w produkcie (nie w prezentacji sprzedażowej — w działającym produkcie); raport engagement metrics z ostatnich 30 dni; A/B test personalizacji z wynikiem. Sygnał: użytkownicy wracają do produktu z powodu cyfrowych funkcji, nie tylko treści.',
      suggestedTechnologies: ['Mobile App', 'Personalization Engine', 'Analytics SDK', 'AI Features'],
    },

    '2A#4': {
      questions: [
        'Opisz, jak użytkownik aktywnie wpływa na produkt lub środowisko — np. tworzy własne treści, dostosowuje ścieżkę nauki, współpracuje z innymi użytkownikami.',
        'Ile aktywnie tworzących (nie tylko konsumujących) użytkowników macie miesięcznie i jaki to % bazy?',
        'Pokaż funkcję, gdzie decyzja użytkownika zmienia stan produktu w sposób trwały i wpływa na jego doświadczenie (nie tylko preferencje UI).',
      ],
      example:
        'Dowód: raport User-Generated Content (liczba, typy, aktywność twórcza) z ostatnich 30 dni; zrzut funkcji kolaboratywnej lub konfiguracyjnej dostępnej dla użytkownika; DAU/MAU ratio (cel: >30% aktywna baza). Sygnał: produkt ma cechy platformy — wartość rośnie wraz z liczbą aktywnych użytkowników.',
      suggestedTechnologies: ['Interactive Platform', 'Collaboration Features', 'User Analytics', 'Gamification'],
    },

    '2A#5': {
      questions: [
        'Jakie technologie AI lub uczenia maszynowego wbudowane są w wasz produkt cyfrowy — jak działają i jaki mierzalny efekt przynoszą użytkownikowi?',
        'Czy produkt jest dostępny jako SaaS lub platforma chmurowa — pokaż architekturę i model skalowania.',
        'Jak dane generowane przez użytkowników produktu tworzą wartość dla samego produktu (pętla uczenia maszynowego, personalizacja, benchmark)?',
      ],
      example:
        'Dowód: opis architektury AI w produkcie (nie roadmapa — działające funkcje); raport użycia funkcji AI z metrykami biznesowymi (retention, NPS, conversion); model danych zamkniętej pętli uczenia. Sygnał: AI jest rdzeń propozycji wartości, nie gadżet w dokumentacji.',
      suggestedTechnologies: ['ML Models', 'Cloud Platform', 'AI Features', 'Data Flywheel'],
    },

    // ================================================================
    // OŚ 2B — PRODUKTY SPOŁECZNOŚCIOWE (5 poziomów)
    // ================================================================

    '2B#1': {
      questions: [
        'Czy prowadzicie społeczność online wokół produktu lub marki — forum, grupa, platforma? Ile aktywnych członków ma i jak często posty się pojawiają?',
        'Jakie zasoby (pliki, narzędzia, wiedza) udostępniacie użytkownikom do wspólnego użycia i jak zarządzacie prawami dostępu?',
        'Kto moderuje społeczność i jak mierzycie jej zdrowie (aktywność, retencja, samowystarczalność)?',
      ],
      example:
        'Dowód: zrzut aktywnej społeczności z datą i liczbą postów/tygodniowo; raport aktywnych użytkowników z ostatnich 30 dni; lista udostępnionych zasobów z liczbą pobrań/użyć. Sygnał: społeczność jest aktywna bez inicjatyw firmowych — użytkownicy sami tworzą treści.',
      suggestedTechnologies: ['Community Platform', 'Forum', 'Knowledge Base', 'File Sharing'],
    },

    '2B#2': {
      questions: [
        'Pokaż przykład projektu lub dyskusji prowadzonej przez społeczność użytkowników — jak przebiega kolaboracja i jakie narzędzia jej służą?',
        'Ile % treści w społeczności pochodzi od użytkowników (UGC) vs od firmy — i jak ten wskaźnik zmienił się rok do roku?',
        'Kiedy ostatnio wspólna praca w społeczności doprowadziła do rozwiązania problemu lub stworzenia produktu?',
      ],
      example:
        'Dowód: raport UGC (user generated content) vs firmowe treści z ostatnich 90 dni; przykład projektu kooperacyjnego z historią kontrybucji; wskaźnik samo-rozwiązania problemów w społeczności (bez interwencji firmy). Sygnał: >50% treści tworzą użytkownicy, nie firma.',
      suggestedTechnologies: ['Collaboration Platform', 'Project Wiki', 'Version Control', 'Forum'],
    },

    '2B#3': {
      questions: [
        'Jak zorganizowane jest mentorowanie i dzielenie się wiedzą ekspercką w społeczności — czy jest to formalne (program, role) czy spontaniczne?',
        'Pokaż przykład wartości wygenerowanej przez eksperta ze społeczności — ktoś, kto pomógł innemu użytkownikowi lepiej niż wsparcie firmy.',
        'Jak identyfikujecie i wyróżniacie ekspertów w społeczności i jak to wpływa na ich aktywność?',
      ],
      example:
        'Dowód: lista zidentyfikowanych ekspertów w społeczności z ich wkładem (posty, rozwiązane problemy, materiały); raport odpowiedzi udzielonych przez ekspertów z community vs support firmowy; program ekspertów z opisem benefitów. Sygnał: eksperci ze społeczności odpowiadają na pytania szybciej niż helpdesk firmy.',
      suggestedTechnologies: ['Expert Community', 'Reputation System', 'Knowledge Base', 'Mentoring Platform'],
    },

    '2B#4': {
      questions: [
        'Jak społeczność współtworzy materiały, projekty lub artefakty — konkretne przykłady z ostatniego kwartału.',
        'Pokaż narzędzie do współtworzenia treści przez użytkowników — jak jest zarządzane własność/licensing wkładów?',
        'Ile treści wygenerowanych przez społeczność jest używanych przez firmę (w produktach, marketingu, dokumentacji)?',
      ],
      example:
        'Dowód: lista wspólnych projektów/artefaktów z historią kontrybucji; regulamin własności treści UGC; raport reużycia treści społecznościowej przez firmę z ostatnich 12 miesięcy. Sygnał: firma i społeczność współtworzą wartość w jawnym modelu — nie firma konsumuje UGC bez reciprocity.',
      suggestedTechnologies: ['Co-creation Platform', 'Contribution Tracking', 'Licensing Management'],
    },

    '2B#5': {
      questions: [
        'Jak społeczność użytkowników wpływa na decyzje produktowe — vote na funcje, beta testing, advisory board? Pokaż ostatni przykład wdrożonej sugestii społeczności.',
        'Jaki mechanizm decyzyjny daje użytkownikom realny wpływ na kierunek platformy/produktu?',
        'Ile % roadmapy produktowej pochodzi bezpośrednio z propozycji społeczności w ostatnim roku?',
      ],
      example:
        'Dowód: raport votowania funkcji (feature requests) z listą wdrożonych propozycji i datami; udokumentowana decyzja produktowa z powołaniem na feedback społeczności; wyniki badania NPS/CSAT z segmentem „zaangażowana społeczność" vs reszta. Sygnał: roadmapa zawiera ≥30% pozycji zainicjowanych przez społeczność.',
      suggestedTechnologies: ['Product Roadmap Tool', 'Feature Voting', 'Community Governance', 'Beta Program'],
    },

    // ================================================================
    // OŚ 2C — PRODUKTY ICT (5 poziomów)
    // ================================================================

    '2C#1': {
      questions: [
        'Jakie dane o klientach zbieracie przez ICT — skąd, jak często, co z nimi robicie? Pokaż przykładowy dashboard z danymi klientów.',
        'Jak dane z różnych kanałów kontaktu z klientem (strona, e-mail, spotkanie, wsparcie) są łączone w jednym profilu klienta?',
        'Który dział w firmie jest właścicielem danych klienta i jak zapewnia ich aktualność?',
      ],
      example:
        'Dowód: zrzut profilu klienta w platformie analitycznej lub CRM z danymi z różnych kanałów; mapa źródeł danych klienta; raport completeness profilu klienta (% wypełnionych kluczowych pól). Sygnał: firma wie więcej o zachowaniu klienta niż sam klient o sobie.',
      suggestedTechnologies: ['Customer Data Platform (CDP)', 'Analytics', 'CRM', 'Web Analytics'],
    },

    '2C#2': {
      questions: [
        'Pokaż, jak ICT personalizuje ofertę dla klienta — jakiego algorytmu używacie i skąd biorą się rekomendacje dla konkretnego klienta?',
        'Jakie mierniki skuteczności personalizacji śledzicie (CTR rekomendacji, uplift konwersji, avg. order value)?',
        'Kiedy personalizacja spowodowała mierzalny wzrost sprzedaży lub zaangażowania — opisz eksperyment.',
      ],
      example:
        'Dowód: raport systemu rekomendacji z metrykami (click-through rate, conversion uplift) za ostatnie 90 dni; A/B test personalizacji z grupą kontrolną; przykład rekomendacji dla fikcyjnego profilu klienta z wyjaśnieniem algorytmu. Sygnał: personalizacja zwiększa konwersję o ≥10% vs wariant bez niej.',
      suggestedTechnologies: ['Recommendation Engine', 'ML Models', 'Customer Data Platform (CDP)', 'A/B Testing'],
    },

    '2C#3': {
      questions: [
        'Jakie kanały komunikacji z klientem są obsługiwane przez ICT (chat, email, telefon VoIP, portal self-service) i jak szybko klient dostaje odpowiedź w każdym kanale?',
        'Czy dane z wszystkich kanałów komunikacji są widoczne dla agenta obsługi w jednym miejscu — pokaż widok agenta podczas rozmowy z klientem.',
        'Ile % zapytań klientów jest rozwiązywane bez eskalacji do człowieka (przez bot, FAQ, portal)?',
      ],
      example:
        'Dowód: raport SLA obsługi klienta per kanał (first response time, resolution time); zrzut widoku agenta z historią kontaktu multi-channel; containment rate chatbota/portalu z ostatnich 30 dni. Sygnał: klient nie musi powtarzać swojego problemu po zmianie kanału komunikacji.',
      suggestedTechnologies: ['Helpdesk', 'Chatbots', 'CRM', 'Omni-channel Platform', 'Self-service Portal'],
    },

    '2C#4': {
      questions: [
        'Jak CRM i marketing automation personalizują komunikację z klientem automatycznie — pokaż sekwencję triggered emails lub spersonalizowane powiadomienia z ostatnich 2 tygodni.',
        'Co wyzwala automatyczną kampanię lub wiadomość do klienta (zdarzenie, zachowanie, data) i jak jest segmentowana?',
        'Jak mierzycie, czy automatyczna personalizacja poprawia doświadczenie klienta (NPS, retencja, CSAT)?',
      ],
      example:
        'Dowód: lista aktywnych automatyzacji CRM/MA z triggerami i targetingiem; raport wyników automatycznych kampanii vs ręcznych; korelacja personalizacji z wynikami NPS/retencji. Sygnał: klient otrzymuje właściwą wiadomość w właściwym momencie bez manualnej interwencji marketera.',
      suggestedTechnologies: ['CRM', 'Marketing Automation', 'Personalization Engine', 'Customer Journey Platform'],
    },

    '2C#5': {
      questions: [
        'Jak ICT służy jako motor innowacji produktowej — jakie technologie (big data, AI, predykcja) doprowadziły do nowych produktów lub funkcji w ostatnich 12 miesiącach?',
        'Pokaż przykład produktu lub usługi, która istnieje tylko dlatego, że firma posiada dane i możliwości ICT niedostępne konkurencji.',
        'Jak analizujecie trendy i potrzeby klientów przez dane, żeby wyprzedzić rynek — jaki jest proces i jakie narzędzia?',
      ],
      example:
        'Dowód: dokument innowacji produktowej z ostatnich 12 miesięcy z powiązaniem do danych ICT; unikalny produkt/usługa niemożliwa do skopiowania bez posiadanych danych; raport trendów klientowskich wygenerowany przez analitykę big data. Sygnał: ICT jest źródłem przewagi konkurencyjnej, nie tylko narzędziem operacyjnym.',
      suggestedTechnologies: ['Big Data Analytics', 'ML Models', 'Predictive Analytics', 'Customer Intelligence'],
    },

    // ================================================================
    // OŚ 2D — DOPASOWANIE PRODUKTU DO OCZEKIWAŃ KLIENTA (5 poziomów)
    // ================================================================

    '2D#1': {
      questions: [
        'Pokaż, jak zbieracie preferencje zakupowe klientów i jak wpływają one na ofertę — konkretny mechanizm, nie intencja.',
        'Przez ile kanałów można kupić wasz produkt i jak zapewniacie spójne doświadczenie (ceny, dostępność, warunki) we wszystkich kanałach?',
        'Kiedy ostatnio dane o zachowaniu klienta doprowadziły do zmiany w asortymencie lub sposobie prezentacji oferty?',
      ],
      example:
        'Dowód: raport multi-channel analytics z udziałem sprzedaży per kanał; historia zmian asortymentu/prezentacji opartych na danych; mapa ścieżki klienta z oznaczonym punktem decyzji. Sygnał: oferta jest spójna niezależnie od kanału kontaktu klienta z produktem.',
      suggestedTechnologies: ['Customer Data Platform (CDP)', 'Multi-channel Analytics', 'Product Catalog'],
    },

    '2D#2': {
      questions: [
        'Pokaż, jak produkt jest dostosowany do różnych segmentów klientów — jakie segmenty zdefiniowaliście i jakie różnice w ofercie istnieją per segment?',
        'Skąd wiecie, że segmentacja trafia w realne potrzeby — jakie dane walidują definicję segmentów?',
        'Pokaż rekomendacje dla różnych profilów klientów (nowy vs powracający, segment A vs B) — jak się różnią.',
      ],
      example:
        'Dowód: definicja segmentów klientów z kryteriami i liczbiami; raport skuteczności oferty per segment (konwersja, AOV, retention); przykład dwóch różnych wariantów oferty dla różnych segmentów z tego samego produktu. Sygnał: segmenty są mierzone i zarządzane, nie tylko narysowane na slajdzie.',
      suggestedTechnologies: ['Segmentation Engine', 'CRM', 'Personalization Engine', 'Analytics'],
    },

    '2D#3': {
      questions: [
        'Jak cena produktu dostosowuje się do warunków rynkowych, popytu lub profilu klienta — dynamiczne cenowanie, segmentowe, czy stały cennik dla wszystkich?',
        'Przez jakie kanały klient może skontaktować się z supportem i jaki jest czas odpowiedzi — mierzony z systemu, nie z deklaracji.',
        'Kiedy cena produktu zmieniła się w ostatnim miesiącu i co to wywołało (system, decyzja menedżera)?',
      ],
      example:
        'Dowód: raport zmian cen z ostatnich 90 dni z uzasadnieniem (trigger: dane vs decyzja); konfiguracja modelu cenowego w systemie (czy to możliwe automatycznie?); raport SLA obsługi klienta per kanał. Sygnał: przynajmniej jeden element cenowy dostosowuje się automatycznie na bazie danych.',
      suggestedTechnologies: ['Pricing Engine', 'CRM', 'E-commerce Platform', 'Customer Support Platform'],
    },

    '2D#4': {
      questions: [
        'Pokaż, jak doświadczenie użytkownika jest personalizowane na poziomie indywidualnym — nie tylko per segment, ale per osoba.',
        'Jakie dane o konkretnym kliencie system używa do personalizacji i skąd je ma (behavior, purchase, preferences, context)?',
        'Kiedy personalizacja indywidualna przyniosła mierzalny efekt biznesowy — A/B test lub case study z danymi.',
      ],
      example:
        'Dowód: profil użytkownika z danymi personalizacyjnymi (historia, preferencje, kontekst); raport A/B test personalizacji 1-to-1 vs segmentowej vs bez personalizacji; przykład automatycznie spersonalizowanego e-maila lub widoku z logu wysyłki. Sygnał: każdy aktywny użytkownik dostaje inną wersję doświadczenia.',
      suggestedTechnologies: ['1-to-1 Personalization', 'Real-time Decisioning', 'CRM', 'Recommendation Engine'],
    },

    '2D#5': {
      questions: [
        'Czy oferujecie produkt dostosowany do zamówienia (configured-to-order lub made-to-order) z pomocą narzędzi cyfrowych — pokaż konfigurator i jak trafia do realizacji.',
        'Jak AI lub ML przewiduje ewolucję potrzeb klienta i jak produkty reagują na tę predykcję?',
        'Opisz produkt lub usługę zaprojektowaną w całości na podstawie danych klientów (data-driven product design) w ostatnich 12 miesiącach.',
      ],
      example:
        'Dowód: konfigurator produktu online z przepływem do realizacji; raport trafności predykcji potrzeb klientów; dokumentacja procesu data-driven product design z konkretnymi decyzjami opartymi o dane. Sygnał: klient może skonfigurować i zamówić unikatowy produkt bez ingerencji człowieka.',
      suggestedTechnologies: ['Product Configurator', 'ML Models', 'Predictive Analytics', 'CPQ (Configure-Price-Quote)'],
    },

    // ================================================================
    // OŚ 2E — SKALOWALNOŚĆ PRODUKTU (5 poziomów)
    // ================================================================

    '2E#1': {
      questions: [
        'W jakim geograficznym zasięgu dostępny jest wasz produkt cyfrowy — tylko lokalnie (jedno miasto/region), czy szerzej?',
        'Co technicznie i regulacyjnie ogranicza dostępność produktu poza obecnym rynkiem?',
        'Jaki % przychodów pochodzi spoza lokalizacji głównego rynku?',
      ],
      example:
        'Dowód: mapa dostępności produktu z datą; lista barier ekspansji (techniczne/regulacyjne/językowe) z szacowanym kosztem przezwyciężenia; raport przychodów per region. Sygnał: bariery ekspansji są znane i skwantyfikowane — nie „możemy wejść wszędzie" na poziomie deklaracji.',
      suggestedTechnologies: ['E-commerce Platform', 'Geolocation', 'Multi-currency Support'],
    },

    '2E#2': {
      questions: [
        'Czy produkt jest dostępny w kilku krajach lub regionach — w jakich i od kiedy? Jakie adaptacje wymagało wejście na każdy rynek?',
        'Pokaż metryki wzrostu na rynkach ekspansji vs rynku macierzystym z ostatnich 12 miesięcy.',
        'Jaka jest retention i NPS na nowym rynku w porównaniu z rynkiem macierzystym — i co różnice te mówią o dopasowaniu produktu?',
      ],
      example:
        'Dowód: raport przychodów i użytkowników per kraj z trendem 12 mies.; dokumentacja adaptacji produktu per rynek (język, płatności, regulacje); NPS per rynek z ostatniego kwartału. Sygnał: nowy rynek pokazuje ≥60% retention macierzystego w ciągu 6 miesięcy.',
      suggestedTechnologies: ['Multi-language Support', 'Local Payment Methods', 'Compliance Management'],
    },

    '2E#3': {
      questions: [
        'Czy wasz produkt jest dostępny przez globalne platformy (App Store, Google Play, marketplace, chmura) — pokaż listing i metryki tam.',
        'Jak produkt radzi sobie na globalnych platformach w porównaniu z lokalnymi alternatywami — co mówią dane o pobraniach, ocenach, konwersji?',
        'Jakie funkcje platformy globalnej wykorzystujecie do zwiększenia zasięgu (globalne rekomendacje, featured placement, cross-store promotions)?',
      ],
      example:
        'Dowód: zrzut listingu na globalnej platformie z datą i ocenami; raport pobrań/instalacji per kraj z globalnej platformy; historia zmian w opisie lub funkcjach produktu podyktowanych algorytmem platformy. Sygnał: produkt generuje organiczny ruch z globalnej platformy bez aktywnego marketingu lokalnego.',
      suggestedTechnologies: ['App Store Optimization (ASO)', 'Global Marketplace', 'Cloud Distribution'],
    },

    '2E#4': {
      questions: [
        'W ilu krajach/regionach produkt jest aktywnie sprzedawany z lokalną adaptacją (język, waluta, regulacje, UI/UX)? Pokaż te rynki.',
        'Jak proces lokalizacji produktu wygląda — jaki czas i koszt wejścia na nowy rynek po decyzji strategicznej?',
        'Jakie mechanizmy w produkcie pozwalają na szybkie dodanie nowego rynku (internacjonalizacja w kodzie, moduły lokalizacyjne)?',
      ],
      example:
        'Dowód: lista rynków z dokumentacją adaptacji per rynek; czas wdrożenia na nowy rynek (time-to-market) z historii ekspansji; architektura produktu z wyróżnionymi modułami i18n/l10n. Sygnał: czas wejścia na nowy rynek jest < 3 miesiące, nie 1,5 roku.',
      suggestedTechnologies: ['i18n/l10n Framework', 'Multi-currency', 'Local Compliance Tools', 'CDN'],
    },

    '2E#5': {
      questions: [
        'Czy produkt jest dostępny globalnie bez geograficznych ograniczeń — w ilu krajach i jak obsługujecie lokalne wymagania regulacyjne?',
        'Jak architektura techniczna produktu wspiera globalną skalowalność (CDN, multi-region deployment, disaster recovery)?',
        'Pokaż przykład adaptacji kulturowej produktu, która wykroczyła poza tłumaczenie tekstu (UX, ikony, przykłady, format dat).',
      ],
      example:
        'Dowód: raport użycia produktu per kraj (mapa ciepła świata) z ostatnich 30 dni; dokumentacja architektury multi-region z SLA dostępności; przykład A/B test adaptacji kulturowej z wynikami. Sygnał: produkt obsługuje ≥20 krajów z lokalnym SLA i lokalnymi płatnościami bez dedykowanego oprogramowania per kraj.',
      suggestedTechnologies: ['Global CDN', 'Multi-region Cloud', 'i18n/l10n', 'Global Payment Gateway'],
    },
  };
