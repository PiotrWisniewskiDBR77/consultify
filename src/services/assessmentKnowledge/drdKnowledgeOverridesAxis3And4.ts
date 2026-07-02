/**
 * DRD_KNOWLEDGE_OVERRIDES — Oś 3 (Cyfrowe Modele Biznesowe, 5 obszarów × 5 poziomów)
 *                         + Oś 4 (Zarządzanie Danymi, 5 obszarów × 7 poziomów)
 *
 * Oxford O1 · partia 2 · 2026-07-02
 *
 * Format pytań: behawioralne — pytamy o zachowanie, artefakt lub zdarzenie,
 * NIE o samoocenę. Wzorzec z kanonu §9.2:
 *   „Kiedy ostatnio X? Pokażcie ten przypadek."
 *   „Co system zrobił, gdy Y? Jaki log/zrzut macie?"
 *
 * Pole `example` pełni rolę `expectedEvidence` (typ DRDLevelKnowledge nie ma
 * osobnego pola dowodowego; wpinamy je tutaj jako wskazówkę dla konsultanta).
 *
 * Języki: pytania PL (runtime), plik EN: knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis3-4.en.md
 */

import type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';

export const DRD_OVERRIDES_AXIS_3_4: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> =
  {
    // ================================================================
    // OŚ 3A — MODELE E-COMMERCE (5 poziomów)
    // ================================================================

    '3A#1': {
      questions: [
        'Pokaż aktywny sklep internetowy lub listing na marketplace — ile SKU jest dostępnych online i jaki % całego asortymentu to stanowi?',
        'Jak zamówienie złożone online trafia do realizacji — czy ktoś ręcznie przepisuje je do systemu magazynowego, czy integracja działa automatycznie?',
        'Jaki % całkowitych przychodów generuje kanał online w ostatnim kwartale — pokaż raport sprzedaży z podziałem na kanały.',
      ],
      example:
        'Dowód: zrzut sklepu online z datą i listą produktów; raport zamówień online vs stacjonarnych z ostatnich 30 dni; czas od złożenia zamówienia online do pojawienia się w systemie realizacji (SLA: <5 min). Sygnał: sklep online jest aktywny i generuje regularne zamówienia, nie tylko testowe.',
      suggestedTechnologies: [
        'E-commerce Platform',
        'Order Management System',
        'Marketplace Integration',
      ],
    },

    '3A#2': {
      questions: [
        'Na ilu platformach e-commerce lub marketplace jednocześnie sprzedajecie — pokaż listę aktywnych integracji i wolumen zamówień per platforma.',
        'Jak zarządzacie stanem magazynowym synchronicznie we wszystkich kanałach sprzedaży — co się dzieje, gdy ten sam produkt sprzedaje się jednocześnie w sklepie własnym i na marketplace?',
        'Jakie narzędzia analityczne śledzą skuteczność sprzedaży per kanał online i jak często menedżer ogląda te dane?',
      ],
      example:
        'Dowód: mapa integracji e-commerce (kanały, systemy, synchronizacja stanów); raport sprzedaży per kanał z ostatnich 90 dni; log zdarzenia „oversell" lub jego brak (synchronizacja stanów działa). Sygnał: firma sprzedaje na ≥2 platformach z synchronicznym zarządzaniem stanem — bez manualnego pilnowania.',
      suggestedTechnologies: [
        'Multi-channel E-commerce',
        'Inventory Sync',
        'Marketplace Integration',
        'Sales Analytics',
      ],
    },

    '3A#3': {
      questions: [
        'Pokaż konfigurator produktu lub zaawansowane narzędzie wizualizacji dostępne dla klienta online — jak klient personalizuje zamówienie przed zakupem?',
        'Jak dane o historii zakupów klientów są używane do personalizacji oferty w sklepie online — pokaż konkretny mechanizm rekomendacji, nie plany.',
        'Kiedy ostatnio zmieniliście wygląd lub strukturę sklepu na podstawie danych analitycznych (np. heatmap, funnel, A/B test) — co konkretnie zmieniliście i jaki był efekt?',
      ],
      example:
        'Dowód: zrzut konfiguratora produktu w działaniu; raport wyników A/B testu zmiany na stronie produktu; log rekomendacji per sesja klienta z ostatnich 7 dni. Sygnał: strona sklepu jest aktywnie optymalizowana na podstawie danych — nie zaprojektowana raz i zapomniana.',
      suggestedTechnologies: [
        'Product Configurator',
        'Recommendation Engine',
        'A/B Testing',
        'Web Analytics',
        'Heatmap Tools',
      ],
    },

    '3A#4': {
      questions: [
        'Pokaż przykład oferty automatycznie dostosowanej do konkretnego klienta lub segmentu — jak system decyduje, co pokazać i czego nie?',
        'Jak zaawansowane są integracje z marketplace — czy macie API integrację ze wszystkimi kanałami i jak zarządzacie polityką cenową cross-channel?',
        'Jak mierzycie Customer Lifetime Value i jak CLV wpływa na strategię cenową lub ofertową per segment?',
      ],
      example:
        'Dowód: raport personalizacji (wyniki per segment: konwersja, AOV, retention vs brak personalizacji); konfiguracja cross-channel pricing policy z systemu; raport CLV segmentów z ostatnich 12 miesięcy. Sygnał: każdy klient widzi ofertę wygenerowaną na podstawie jego profilu — nie jednakową stronę produktów dla wszystkich.',
      suggestedTechnologies: [
        'Personalization Engine',
        'Cross-channel Commerce',
        'CLV Analytics',
        'Dynamic Pricing',
      ],
    },

    '3A#5': {
      questions: [
        'Jakie technologie AI, IoT lub blockchain są wbudowane w proces sprzedaży online — pokaż działające funkcje, nie roadmapę.',
        'Jak doświadczenie zakupowe online różni się od konkurencji technologicznie — co możecie pokazać klientowi, czego nie może zobaczyć u rywali (VR, AR, AI assistant)?',
        'Pokaż dane o konwersji i retencji klientów z funkcjami AI/technologicznymi vs bez nich — jaki mierzalny efekt przynosi technologia?',
      ],
      example:
        'Dowód: demo działającej funkcji AI/AR/VR w sklepie online (nie mockup); raport konwersji z AI assistant lub visual search vs kanał klasyczny; opis architektury technicznej e-commerce z zaznaczeniem elementów AI/IoT. Sygnał: technologia AI jest produkcyjnie wdrożona i mierzalnie poprawia wskaźniki sprzedaży online.',
      suggestedTechnologies: [
        'AI Commerce Engine',
        'AR Product Visualization',
        'Conversational Commerce',
        'Blockchain Supply Chain',
        'IoT Integration',
      ],
    },

    // ================================================================
    // OŚ 3B — ROZWIĄZANIA PLATFORMOWE (5 poziomów)
    // ================================================================

    '3B#1': {
      questions: [
        'Czy korzystacie z platform B2B do zakupów lub sprzedaży — pokaż ostatnią transakcję platformową i jak przebiega rozliczenie.',
        'Jak platforma B2B, z której korzystacie, pomogła zoptymalizować zakupy lub dotrzeć do nowych klientów — opisz konkretny przykład z danymi.',
        'Ile % zakupów lub sprzedaży przechodzi przez platformy zewnętrzne a ile jest realizowane bezpośrednio — raport z ostatnich 12 miesięcy.',
      ],
      example:
        'Dowód: screenshot aktywnego konta na platformie B2B z datą ostatniej transakcji; raport wolumenu zakupów/sprzedaży per platforma; kalkulacja oszczędności lub dodatkowego przychodu z platformy vs kanał tradycyjny. Sygnał: platforma jest aktywnym kanałem, nie tylko kontem testowym.',
      suggestedTechnologies: [
        'B2B Platform',
        'E-procurement',
        'Supplier Portal',
        'Marketplace Analytics',
      ],
    },

    '3B#2': {
      questions: [
        'Czy prowadzicie własną platformę, na której zewnętrzni dostawcy lub partnerzy oferują produkty/usługi klientom — pokaż liczbę aktywnych dostawców i wolumen transakcji.',
        'Jak zarządzacie doświadczeniem klientów na platformie, gdy za transakcję odpowiada zewnętrzny dostawca — co kontrolujecie, a co delegujecie?',
        'Jakie narzędzia analityczne i wsparcie oferujecie dostawcom na platformie — pokaż panel dostawcy.',
      ],
      example:
        'Dowód: zrzut panelu operatora platformy z liczbą aktywnych dostawców i produktów; raport wolumenu GMV za ostatnie 90 dni; panel analityczny dostawcy z dostępnymi metrykami. Sygnał: platforma ma ≥5 aktywnych zewnętrznych dostawców i generuje powtarzalne transakcje.',
      suggestedTechnologies: [
        'Marketplace Platform',
        'Vendor Management',
        'Platform Analytics',
        'Multi-vendor E-commerce',
      ],
    },

    '3B#3': {
      questions: [
        'Jak platforma łączy dostawców, partnerów i klientów w ekosystem tworzący synergię — pokaż konkretny przykład wartości, której żaden uczestnik nie mógłby stworzyć samodzielnie.',
        'Jakie narzędzia do analizy rynku lub wspólnych promocji oferujecie uczestnikom ekosystemu — pokaż przykład kampanii platformowej.',
        'Jak mierzycie zdrowie ekosystemu — GMV, retencja dostawców, NPS uczestników — i jak często przeglądacie te metryki?',
      ],
      example:
        'Dowód: raport ekosystemu (GMV, liczba aktywnych uczestników, retention dostawców) z ostatnich 90 dni; przykład wspólnej promocji lub narzędzia analitycznego dla uczestników; NPS dostawców i klientów z ostatniego kwartału. Sygnał: ekosystem rośnie bez aktywnego pozyskiwania przez firmę — sieciowy efekt widzialny w danych.',
      suggestedTechnologies: [
        'Ecosystem Platform',
        'Partner Portal',
        'Loyalty Programme',
        'Market Analytics',
        'Co-marketing Tools',
      ],
    },

    '3B#4': {
      questions: [
        'Jakie aplikacje SaaS są dostępne na waszej platformie poza podstawowym marketplace — pokaż katalog aplikacji i liczbę aktywnych użytkowników per aplikacja.',
        'Jak zarządzacie integracjami zewnętrznych dostawców SaaS z waszą platformą — czy macie API marketplace i program partnerski?',
        'Jaki % przychodów platformy pochodzi z aplikacji SaaS vs transakcji marketplace — i jak ten wskaźnik zmienił się rok do roku?',
      ],
      example:
        'Dowód: katalog aplikacji SaaS na platformie z cenami i liczbą użytkowników; dokumentacja API dla deweloperów z przykładami integracji; raport przychodów SaaS vs GMV z ostatnich 12 miesięcy. Sygnał: platforma ma ≥3 aktywne integracje SaaS generujące powtarzalny przychód z subskrypcji.',
      suggestedTechnologies: [
        'SaaS Marketplace',
        'API Platform',
        'Developer Portal',
        'App Store Management',
      ],
    },

    '3B#5': {
      questions: [
        'Jak społeczność użytkowników platformy aktywnie współtworzy wartość — content, wsparcie, innowacje — pokaż mierzalne przykłady z ostatnich 90 dni.',
        'Jak zarządzacie governance platformy — czy użytkownicy mają realny wpływ na kierunek rozwoju i zasady uczestnictwa?',
        'Jaki % problemów technicznych lub pytań użytkowników jest rozwiązywanych przez społeczność bez angażowania supportu firmy?',
      ],
      example:
        'Dowód: raport aktywności społeczności (posty, rozwiązane problemy, UGC) z ostatnich 30 dni; mechanizm głosowania na funkcje lub regulamin współzarządzania; community-containment rate z helpdesk (% spraw rozwiązanych przez społeczność). Sygnał: społeczność jest zdrowa — ludzie wracają, pomagają sobie nawzajem i mają realny wpływ na platformę.',
      suggestedTechnologies: [
        'Community Platform',
        'Governance Tools',
        'Feature Voting',
        'Self-service Community Support',
      ],
    },

    // ================================================================
    // OŚ 3C — MODEL AS-A-SERVICE (5 poziomów)
    // ================================================================

    '3C#1': {
      questions: [
        'Czy oferujecie klientom długoterminowe umowy serwisowe zamiast lub obok jednorazowej sprzedaży — pokaż przykładową umowę i jej zakres.',
        'Ile aktywnych umów serwisowych macie i jaki generują przychód w stosunku do sprzedaży jednorazowej — raport z ostatnich 12 miesięcy.',
        'Jak mierzony jest poziom wykonania umów serwisowych — SLA, KPI, recenzja — i co się dzieje gdy dostawca nie spełnia umowy?',
      ],
      example:
        'Dowód: przykładowa umowa serwisowa z zakresem, SLA i ceną; raport liczby aktywnych umów i przychodów cyklicznych (MRR/ARR); historia naruszenia SLA z ostatnich 12 miesięcy i sposób obsługi. Sygnał: przychód cykliczny z umów serwisowych stanowi ≥10% całości — i rośnie.',
      suggestedTechnologies: [
        'Service Contract Management',
        'SLA Monitoring',
        'Customer Success Platform',
        'MRR Analytics',
      ],
    },

    '3C#2': {
      questions: [
        'Jakie modele subskrypcyjne lub taryfowe oferujecie i jak są wycenione — pokaż cennik i porównaj z konkurencją.',
        'Jak monitorujecie i gwarantujecie ciągłość i jakość usługi w modelu subskrypcyjnym — co klient dostaje za abonament, gdy coś nie działa?',
        'Jakie jest churn rate (wskaźnik rezygnacji) z modeli subskrypcyjnych w ostatnich 12 miesiącach i co jest główną przyczyną odejść?',
      ],
      example:
        'Dowód: cennik subskrypcji z opisem tiers i SLA per tier; raport churn rate z ostatnich 12 miesięcy z analizą przyczyn; dashboard monitoringu usługi dla klientów. Sygnał: churn rate < 5% miesięcznie i model subskrypcyjny ma pozytywny NPS (>30).',
      suggestedTechnologies: [
        'Subscription Management',
        'Billing Platform',
        'Churn Analytics',
        'Customer Health Score',
      ],
    },

    '3C#3': {
      questions: [
        'Czy oferujecie model płatności za czas lub użycie zasobów (pay-per-use, time-based) — jak jest mierzony i fakturowany?',
        'Pokaż dane o typowym wzorcu użycia klienta w modelu pay-per-use — jak zmienia się zużycie w cyklu tygodniowym/miesięcznym i co to mówi o modelu?',
        'Jak elastyczność modelu as-a-time/as-a-resource wpłynęła na pozyskanie klientów, którzy wcześniej nie mogli sobie pozwolić na zakup jednorazowy?',
      ],
      example:
        'Dowód: dashboard zużycia zasobów per klient z granulacją dzienną/godzinową; przykładowa faktura z modelu pay-per-use z pozycjami; raport nowych klientów pozyskanych dzięki elastyczności cenowej. Sygnał: klienci aktywnie zarządzają swoim zużyciem bo system to umożliwia — nie dostają jednej stawki za wszystko.',
      suggestedTechnologies: [
        'Usage-based Billing',
        'Metering System',
        'Resource Monitoring',
        'Flexible Pricing Engine',
      ],
    },

    '3C#4': {
      questions: [
        'Czy dostarczacie usługi w modelu outcome-based (płatność za wynik, nie za czas/zasób) — pokaż kontrakt i jak mierzycie osiągnięty wynik.',
        'Jak negocjujecie i definiujecie „wynik" z klientem na wejściu kontraktu outcome-based — co jest mierzalne, co jest sporne i jak rozwiązujecie spory?',
        'Pokaż przykład projektu outcome-based z ostatnich 12 miesięcy: co było wynikiem, czy został osiągnięty i jak wpłynął na relację z klientem.',
      ],
      example:
        'Dowód: kontrakt outcome-based z definicją KPI i metodyką pomiaru; raport osiągniętych vs zakontraktowanych wyników z ostatnich 12 miesięcy; historia sporów i sposobu ich rozwiązania. Sygnał: firma ma ≥3 aktywne kontrakty outcome-based i track record ich realizacji poparty danymi.',
      suggestedTechnologies: [
        'Contract Performance Management',
        'Outcome Measurement',
        'KPI Dashboards',
        'Value-based Pricing',
      ],
    },

    '3C#5': {
      questions: [
        'Czy zarządzacie pełnym procesem biznesowym klienta jako BPO lub kompleksowy dostawca usług zarządzanych — co konkretnie przejęliście i jak mierzycie efektywność?',
        'Jak integrujecie się z systemami klienta przy zarządzaniu jego procesem — jakie dane wymieniacie i jak często?',
        'Pokaż raport efektywności zarządzanego procesu klienta z ostatnich 3 miesięcy — jaką wartość stworzyliście ponad to, co klient robiłby sam?',
      ],
      example:
        'Dowód: SLA umowy BPO/MSP z zakresem przejętych procesów; raport wyników zarządzanego procesu (KPI poprawa vs baseline); integracja systemów z architekturą data exchange. Sygnał: klient może zmierzyć poprawę swoich wyników biznesowych dzięki outsourcingowi procesu — i mówi to publicznie (case study).',
      suggestedTechnologies: [
        'Managed Service Platform',
        'Process Automation',
        'Client Reporting Portal',
        'BPO Analytics',
      ],
    },

    // ================================================================
    // OŚ 3D — MODELE WSPÓŁDZIELENIA ZASOBÓW (5 poziomów)
    // ================================================================

    '3D#1': {
      questions: [
        'Jakie zasoby cyfrowe (pliki, aplikacje, dane, treści) udostępniacie innym firmom lub użytkownikom — na jakiej zasadzie i za ile?',
        'Jak zarządzacie prawami dostępu do udostępnianych zasobów cyfrowych — kto może skorzystać, kto nie, jak to jest kontrolowane?',
        'Ile aktywnych użytkowników korzysta z waszych udostępnianych zasobów cyfrowych miesięcznie i jaki generują przychód?',
      ],
      example:
        'Dowód: lista udostępnianych zasobów cyfrowych z modelem licencjonowania i cennikiem; raport aktywnych użytkowników/subskrybentów z ostatnich 30 dni; przykład faktury za dostęp do zasobu cyfrowego. Sygnał: zasoby cyfrowe są współdzielone w modelu zorganizowanym, nie ad-hoc przez pendrive czy e-mail.',
      suggestedTechnologies: [
        'Digital Asset Management',
        'License Management',
        'Access Control',
        'Content Delivery',
      ],
    },

    '3D#2': {
      questions: [
        'Czy oferujecie wynajem fizycznych zasobów (maszyny, pojazdy, nieruchomości, sprzęt) za pośrednictwem platformy cyfrowej — pokaż jak klient rezerwuje i płaci.',
        'Jak monitorujecie stan i lokalizację fizycznych zasobów wynajmowanych klientom — co widzi klient, a co widzi wasza operacja?',
        'Ile aktywnych wypożyczeń jest aktualnie aktywnych i jaka jest średnia wartość wypożyczenia — raport z systemu.',
      ],
      example:
        'Dowód: zrzut platformy rezerwacyjnej z dostępnymi zasobami i kalendarzem; dashboard monitoringu stanu zasobów w czasie rzeczywistym; raport wypożyczeń (liczba, wartość, OTIF) z ostatnich 90 dni. Sygnał: klient może zarezerwować, odebrać i zwrócić zasób bez kontaktu z człowiekiem po stronie firmy.',
      suggestedTechnologies: [
        'Asset Rental Platform',
        'IoT Asset Tracking',
        'Booking System',
        'Fleet Management',
      ],
    },

    '3D#3': {
      questions: [
        'Czy udostępniacie wiedzę, kompetencje lub pracę intelektualną innym podmiotom w modelu sharing — pokaż przykład i model rozliczenia.',
        'Jak platforma łączy „dostarczycieli wiedzy" (ekspertów, freelancerów) z „odbiorcami" (firmami, uczącymi się) — co jest waszą rolą w tym modelu?',
        'Jak weryfikujecie jakość wiedzy lub kompetencji udostępnianych przez platformę — oceny, certyfikaty, próbki pracy?',
      ],
      example:
        'Dowód: zrzut platformy knowledge sharing z profilami ekspertów i recenzjami; raport dopasowań ekspert-klient z ostatnich 30 dni; mechanizm oceny jakości z przykładami. Sygnał: platforma ma aktywnych dostawców wiedzy z udokumentowanymi wynikami — nie tylko bazę pustych profili.',
      suggestedTechnologies: [
        'Knowledge Marketplace',
        'Expert Matching',
        'Skill Verification',
        'Learning Platform',
      ],
    },

    '3D#4': {
      questions: [
        'Jak rozliczacie klientów za czas użycia fizycznych zasobów — jest to automatyczne na podstawie danych z urządzenia/sensora, czy ręczne?',
        'Co dzieje się gdy zasób jest uszkodzony lub zagubiony w trakcie wynajmu — jak system to wykrywa i jak przebiega proces reklamacyjny?',
        'Jak optymalizujecie dostępność zasobów (minimalizacja przestojów, maksymalizacja utilization) — jakie narzędzia i dane do tego używacie?',
      ],
      example:
        'Dowód: log rozliczeń za ostatni miesiąc z breakdown per zasób (czas użycia, kwota); raport utilization zasobów (% czasu aktywnego vs przestoje) z trendem; historia reklamacji z logu systemu (czas wykrycia, czas rozwiązania). Sygnał: utilization ≥70% — zasoby pracują, nie stoją.',
      suggestedTechnologies: [
        'Usage Metering',
        'Asset Utilization Analytics',
        'Damage Detection',
        'Dynamic Availability',
      ],
    },

    '3D#5': {
      questions: [
        'Czy udostępniacie infrastrukturę IT, narzędzia analityczne lub usługi logistyczne innym firmom jako kompleksowe rozwiązania biznesowe — pokaż przykład.',
        'Jak skalujecie model sharing zasobów biznesowych — co ogranicza wzrost i jak zamierzacie to przezwyciężyć?',
        'Jakie jest ROI dla klientów korzystających z waszego modelu sharing vs posiadanie własnych zasobów — pokaż kalkulację lub case study.',
      ],
      example:
        'Dowód: case study klienta korzystającego z udostępnionej infrastruktury/logistyki z kalkulacją oszczędności; raport skalowalności modelu (liczba klientów vs koszt obsługi na klienta); dokumentacja architektury rozwiązania. Sygnał: model sharing ma ekonomię skali — koszt obsługi kolejnego klienta jest niższy niż pierwszego.',
      suggestedTechnologies: [
        'Shared Infrastructure Platform',
        'White-label Services',
        'Capacity Management',
        'Multi-tenant Architecture',
      ],
    },

    // ================================================================
    // OŚ 3E — MODELE MONETYZACJI DANYCH (5 poziomów)
    // ================================================================

    '3E#1': {
      questions: [
        'Jakie dane o klientach zbieracie i w jakim celu — pokaż rejestr przetwarzanych danych (RODO) i jak są wykorzystywane do poprawy oferty.',
        'Kto w firmie jest właścicielem danych klientów i odpowiada za ich aktualność oraz jakość — jak mierzycie completeness danych?',
        'Kiedy ostatnio dane o zachowaniu klientów doprowadziły do konkretnej zmiany w produkcie lub ofercie — opisz przypadek z datą i mierzalnym efektem.',
      ],
      example:
        'Dowód: rejestr przetwarzania danych (RODO) z listą zbiorów i celów; raport jakości danych klientów (% wypełnienia kluczowych pól); przykład zmiany w ofercie wynikającej z analizy danych z datą decyzji. Sygnał: firma używa danych klientów do podejmowania decyzji, nie tylko do wysyłania newsletterów.',
      suggestedTechnologies: [
        'CRM',
        'Customer Data Platform (CDP)',
        'Data Quality Tools',
        'GDPR Compliance',
      ],
    },

    '3E#2': {
      questions: [
        'Jakie zaawansowane analizy danych klientów prowadzicie — segmentacja, kohorty, churn prediction — i kto je robi: analityk BI, narzędzie automatyczne, czy Excel?',
        'Pokaż raport analityczny z ostatnich 30 dni, który ujawnił nieoczekiwany wzorzec zachowania klientów lub nową szansę rynkową.',
        'Jak często zarząd lub dyrektorzy podejmują decyzje biznesowe powołując się wprost na dane z systemu analitycznego — czy istnieje taka kultura?',
      ],
      example:
        'Dowód: raport analityczny z systemu BI (nie Excel) z datą; przykład decyzji zarządu z przypisanym źródłem danych (minutes ze spotkania); lista zaplanowanych analiz cyklicznych z częstotliwością i właścicielem. Sygnał: dane są regularnie konsumowane przez decydentów — nie tylko generowane przez IT.',
      suggestedTechnologies: [
        'BI Platform',
        'Cohort Analysis',
        'Customer Analytics',
        'Predictive Analytics',
      ],
    },

    '3E#3': {
      questions: [
        'Jak personalizujecie ofertę na podstawie zebranych danych — co konkretnie zmienia się dla klienta A vs klienta B na stronie/w komunikacji?',
        'Pokaż algorytm lub regułę personalizacji, która działa produkcyjnie — skąd pochodzi „sygnał" i co on wyzwala po stronie oferty?',
        'Jak mierzycie skuteczność personalizacji — jaki jest uplift konwersji lub lojalności grupy spersonalizowanej vs grupy kontrolnej?',
      ],
      example:
        'Dowód: raport A/B testu personalizacji z grupą kontrolną i wynikami (konwersja, CLV, NPS); opis reguły lub modelu personalizacji z wejściami i wyjściami; log personalizacji dla 3 konkretnych klientów z ostatnich 7 dni. Sygnał: personalizacja ma udowodniony efekt biznesowy — nie jest tylko „intuicją marketera".',
      suggestedTechnologies: [
        'Personalization Engine',
        'Recommendation System',
        'A/B Testing Platform',
        'Real-time Decisioning',
      ],
    },

    '3E#4': {
      questions: [
        'Czy sprzedajecie dane lub insighty z danych jako odrębny produkt/usługę dla partnerów lub rynku — pokaż przykład oferty i kontrakt.',
        'Jak zapewniacie prywatność i bezpieczeństwo danych klientów przy ich komercjalizacji — jakie technologie (anonimizacja, aggregation, differential privacy) stosujecie?',
        'Jaki przychód generuje monetyzacja danych jako osobna linia biznesowa w ostatnich 12 miesiącach — i jak rośnie?',
      ],
      example:
        'Dowód: przykładowy produkt danych lub raport analityczny sprzedany zewnętrznemu klientowi; mechanizm anonimizacji danych z dokumentacją techniczną; raport przychodów z monetyzacji danych z trendem 12M. Sygnał: dane są aktywem generującym przychód, a nie tylko zasobem operacyjnym — i ten przychód jest widoczny w P&L.',
      suggestedTechnologies: [
        'Data Marketplace',
        'Data Anonymization',
        'API Monetization',
        'Differential Privacy',
      ],
    },

    '3E#5': {
      questions: [
        'Jakie produkty, usługi lub modele biznesowe powstały w całości dzięki posiadanym danym — co nie byłoby możliwe bez tych danych?',
        'Jak dane zasilają pętle uczenia maszynowego, które automatycznie poprawiają wasze produkty lub usługi — pokaż closed-loop w działaniu.',
        'Jak wyceniacie i zarządzacie danymi jako aktywem firmowym — czy dane mają właściciela, budżet i rachunek wartości?',
      ],
      example:
        'Dowód: opis produktu lub usługi data-native z architekturą data flywheel; raport poprawy modelu ML w czasie (drift monitoring, retraining schedule); wycena zasobów danych w bilansie lub wewnętrznym rachunku (data P&L). Sygnał: firma wie ile są warte jej dane i zarządza nimi jak kapitałem — nie jak odpadem produkcyjnym.',
      suggestedTechnologies: [
        'Data Mesh',
        'ML Platform',
        'Data Catalog',
        'Data Valuation Framework',
        'AI Product Suite',
      ],
    },

    // ================================================================
    // OŚ 4A — ZBIERANIE DANYCH (7 poziomów)
    // ================================================================

    '4A#1': {
      questions: [
        'Jak pracownicy rejestrują dane o swojej pracy — papierowy formularz, karta obiegowa, arkusz Excel czy aplikacja mobilna? Pokaż przykład formularza z ostatniego tygodnia.',
        'Ile % danych operacyjnych (zamówienia, produkcja, serwis) jest wprowadzanych ręcznie przez człowieka vs zbieranych automatycznie?',
        'Co się stało z raportem tygodniowym, gdy pracownik zapomniał wypełnić formularz — czy mamy lukę w danych, czy system ją wykrył?',
      ],
      example:
        'Dowód: przykładowy formularz lub karta rejestracji danych z ostatniego tygodnia; % danych z ręcznego vs automatycznego źródła per proces (sprzedaż, produkcja, logistyka); raport luk w danych (missing records) z ostatnich 30 dni. Sygnał: dane o kluczowych procesach istnieją cyfrowo — nawet jeśli wpisywane przez człowieka.',
      suggestedTechnologies: [
        'Digital Forms',
        'Mobile Data Entry',
        'Basic ERP/CRM',
        'Spreadsheet Automation',
      ],
    },

    '4A#2': {
      questions: [
        'Gdzie w procesach produkcji, magazynowania lub sprzedaży używacie kodów kreskowych lub QR do identyfikacji i śledzenia obiektów — pokaż skanery w użyciu.',
        'Co system rejestruje w momencie skanowania kodu i jak szybko ta informacja jest widoczna dla innych użytkowników?',
        'Ile % pozycji magazynowych lub produktów ma przypisany kod kreskowy/QR i co dzieje się z tymi bez kodu?',
      ],
      example:
        'Dowód: zrzut systemu z historią skanowań z ostatnich 24h; % pozycji z kodem w systemie; czas od skanowania do widoczności w systemie (SLA: <30 sek). Sygnał: kod kreskowy lub QR jest standardem — wyjątek wymaga uzasadnienia, nie odwrotnie.',
      suggestedTechnologies: [
        'Barcode Scanners',
        'QR Code System',
        'Label Printers',
        'Inventory Tracking',
      ],
    },

    '4A#3': {
      questions: [
        'Gdzie stosujecie RFID do automatycznej identyfikacji i śledzenia — pokaż zasięg pokrycia (magazyn, produkcja, aktywa) i co jest tagowane.',
        'Co RFID robi automatycznie czego nie mógł barcode — pokaż konkretny przypadek: jakie dane zbiera i co wyzwala w systemie bez udziału człowieka?',
        'Jak często zdarzają się błędy odczytu RFID i jak są obsługiwane (fallback, alert, ręczna korekta)?',
      ],
      example:
        'Dowód: mapa rozmieszczenia czytników RFID na planie obiektu; raport zdarzeń RFID z ostatnich 24h (count, error rate); przykład automatycznej akcji systemu wyzwalonej przez odczyt RFID. Sygnał: RFID zbiera dane bez udziału operatora — człowiek widzi wyniki, nie generuje ich.',
      suggestedTechnologies: [
        'RFID Readers',
        'RFID Tags',
        'RFID Middleware',
        'Asset Tracking System',
      ],
    },

    '4A#4': {
      questions: [
        'Które maszyny lub urządzenia zbierają dane automatycznie przez sensory (temperatura, ciśnienie, prędkość, wibracje) — ile ich jest i co mierzą?',
        'Jak dane z maszyn trafiają do systemu IT — bezpośrednia integracja, PLC-to-SCADA-to-MES, czy ręczna przepisywanie z wyświetlacza?',
        'Kiedy ostatnio dane z czujnika maszyny wykryły odchylenie parametru przed wystąpieniem awarii lub defektu — opisz przypadek.',
      ],
      example:
        'Dowód: lista maszyn z sensorami i mierzonymi parametrami (OT inventory); architektura przepływu danych (sensor → PLC → SCADA → MES); log odchylenia parametru z ostatnich 30 dni z podjętym działaniem. Sygnał: co najmniej jedna maszyna krytyczna przesyła dane automatycznie do systemu analizy bez ręcznego odczytu.',
      suggestedTechnologies: [
        'Industrial IoT Sensors',
        'PLC',
        'SCADA',
        'Machine Data Integration',
        'MES',
      ],
    },

    '4A#5': {
      questions: [
        'Jakie dane zbieracie z aplikacji mobilnych używanych przez pracowników w terenie lub na hali — co rejestrują, jak często i kto ma do nich dostęp?',
        'Jak dane lokalizacyjne lub behawioralne z urządzeń mobilnych są integrowane z procesami zarządzania — co decyzje zarząd może podjąć dzięki tym danym?',
        'Jak zapewniacie offline capability — co dzieje się z danymi mobilnymi, gdy pracownik traci zasięg lub połączenie z siecią?',
      ],
      example:
        'Dowód: lista aplikacji mobilnych w użyciu z typami zbieranych danych; raport aktywności użytkowników mobilnych z ostatnich 7 dni; test offline mode — jak aplikacja zachowuje się bez internetu i co się dzieje z danymi po odzyskaniu połączenia. Sygnał: dane z terenu trafiają do systemu w trybie near-real-time, nie przez e-mail raz w tygodniu.',
      suggestedTechnologies: [
        'Mobile Data Collection',
        'Field Service App',
        'Offline Sync',
        'GPS Tracking',
      ],
    },

    '4A#6': {
      questions: [
        'Jakie sensory środowiskowe zbieracie dane z budynków, maszyn lub procesów produkcyjnych (temperatura, wilgotność, CO2, ruch, oświetlenie) — pokaż sieć sensorów.',
        'Jak dane środowiskowe z sensorów fizycznych są zintegrowane z systemem zarządzania lub raportowania — kto je ogląda i jak często?',
        'Kiedy ostatnio sensor środowiskowy wykrył warunek wymagający działania i co system zrobił automatycznie?',
      ],
      example:
        'Dowód: mapa sieci sensorów z typami i lokalizacją; dashboard danych środowiskowych w czasie rzeczywistym; log alertu sensorowego z ostatnich 30 dni z podjętym działaniem. Sygnał: dane środowiskowe są monitorowane ciągle — nie tylko sprawdzane raz w roku przez inspekcję.',
      suggestedTechnologies: [
        'Environmental Sensors',
        'IoT Gateway',
        'Building Management System',
        'Edge Computing',
      ],
    },

    '4A#7': {
      questions: [
        'Gdzie stosujecie systemy optycznej kontroli (kamery, wizja maszynowa) do zbierania danych o jakości lub stanie obiektów — co konkretnie jest analizowane?',
        'Jak szybko system wizyjny analizuje obraz i jaką podejmuje decyzję — co wyzwala „defekt wykryty" i co się dzieje w ciągu następnych 10 sekund?',
        'Pokaż dane o skuteczności systemu wizyjnego: ile defektów wykrył w ostatnim miesiącu, jaki był false positive rate i jak porównuje się z kontrolą manualną?',
      ],
      example:
        'Dowód: raport detekcji defektów z systemu wizyjnego za ostatni miesiąc (liczba, typy, TP/FP); diagram przepływu od detekcji do akcji (zatrzymanie linii, rejestracja, segregacja); porównanie skuteczności wykrywania: kamera vs inspektor. Sygnał: system wizyjny jest w produkcji i zastępuje lub wspiera kontrolę manualną na co najmniej jednej linii.',
      suggestedTechnologies: [
        'Machine Vision',
        'Industrial Cameras',
        'Computer Vision AI',
        'Defect Detection System',
      ],
    },

    // ================================================================
    // OŚ 4B — METODOLOGIA PRZECHOWYWANIA DANYCH (7 poziomów)
    // ================================================================

    '4B#1': {
      questions: [
        'Gdzie przechowujecie dokumenty i dane finansowe, produkcyjne lub kadrowe — papierowe archiwum, segregatory, czy jest też wersja elektroniczna?',
        'Jak wyszukujecie starą fakturę lub protokół z sprzed 2 lat — ile czasu to zajmuje i ile wymaga zaangażowania ludzi?',
        'Co się dzieje z danymi historycznymi gdy pracownik odejdzie — czy wiedza jest w systemie, czy w jego szufladzie?',
      ],
      example:
        'Dowód: opis (lub zdjęcie) aktualnego archiwum papierowego z podaniem zakresu i okresu; czas wyszukania losowego dokumentu z sprzed roku (benchmark test); polityka retencji danych na papierze. Sygnał: nawet przy tradycyjnych metodach — dokumenty mają systematyzację i można je znaleźć w < 15 minut.',
      suggestedTechnologies: [
        'Document Scanning',
        'Physical Archive Management',
        'Basic DMS',
        'Retention Policy',
      ],
    },

    '4B#2': {
      questions: [
        'Które systemy lub maszyny przechowują dane wyłącznie lokalnie na jednym urządzeniu bez synchronizacji — co się stanie jeśli to urządzenie ulegnie awarii?',
        'Jak backup lokalnych danych jest realizowany — ręcznie na pendrive, automatycznie na NAS, czy nie ma backupu?',
        'Kiedy ostatnio straciliście dane przez awarię lokalnego urządzenia — co to kosztowało i jak się zabezpieczyliście po zdarzeniu?',
      ],
      example:
        'Dowód: lista systemów z lokalnym (single-device) przechowywaniem danych; polityka backupu z datą ostatniego testu odtworzenia; raport incydentów utraty danych z historii. Sygnał: nawet dane na jednym urządzeniu mają backup — i ktoś regularnie testuje odtworzenie.',
      suggestedTechnologies: [
        'Local Backup',
        'NAS Storage',
        'Automated Backup',
        'Recovery Testing',
      ],
    },

    '4B#3': {
      questions: [
        'Jak wygląda „mapa" danych w firmie — gdzie są serwery, dyski sieciowe, lokalne dyski pracownicze? Kto zna tę mapę i czy jest aktualna?',
        'Co dzieje się gdy dwóch pracowników edytuje ten sam plik jednocześnie z różnych komputerów — konflikt wersji, nadpisanie, czy system zapobiega?',
        'Jak pracownik zdalny lub w drugiej lokalizacji dostaje dostęp do plików — VPN, dysk sieciowy, chmura, czy musi fizycznie przyjechać po pendrive?',
      ],
      example:
        'Dowód: mapa przechowywania danych z lokalizacją i typem (papier/lokalne/sieciowe); polityka nazewnictwa plików i struktura folderów; raport zdarzeń konfliktu wersji z ostatnich 30 dni (lub jego brak). Sygnał: firma wie gdzie są jej dane — i może je znaleźć bez pytania konkretnego pracownika.',
      suggestedTechnologies: [
        'Network File Server',
        'Version Control',
        'File Sharing',
        'Remote Access VPN',
      ],
    },

    '4B#4': {
      questions: [
        'Jaka jest wasza prywatna infrastruktura chmurowa (on-premise cloud) — hardware, software, kto ją zarządza i jakie jest SLA dostępności?',
        'Jak zarządzacie pojemnością lokalnej chmury — co się dzieje, gdy storage jest pełny? Kto to monitoruje i jak automatycznie?',
        'Jak zabezpieczona jest lokalna chmura przed fizyczną katastrofą (pożar, zalanie, kradzież) i przed cyberatakiem?',
      ],
      example:
        'Dowód: dokumentacja architektury lokalnej chmury (hardware, hypervisor, storage tiers); raport dostępności z ostatnich 90 dni (uptime %); polityka DR/BCP z datą ostatniego testu. Sygnał: lokalna chmura ma SLA i monitoring — nie tylko serwer w szafce bez UPS.',
      suggestedTechnologies: [
        'VMware / Hyper-V',
        'On-premise Cloud',
        'Storage Management',
        'Disaster Recovery',
      ],
    },

    '4B#5': {
      questions: [
        'Z jakich usług chmurowych (AWS, Azure, GCP, inne) korzystacie i do czego — lista usług z wolumenem danych i kosztem miesięcznym.',
        'Jak zarządzacie kosztami chmury publicznej — czy macie FinOps / cost monitoring i czy ktoś regularnie optymalizuje zużycie?',
        'Jak dane w chmurze publicznej są zabezpieczone — encryption at rest and in transit, access management, compliance certyfikaty dostawcy?',
      ],
      example:
        'Dowód: lista aktywnych usług cloud (provider, usługa, region, koszt/mies.); raport zużycia i kosztów cloud z FinOps tool za ostatnie 90 dni; polityka bezpieczeństwa danych w chmurze publicznej. Sygnał: cloud jest zarządzany — znane są koszty, zasoby i kto odpowiada za każdy serwis.',
      suggestedTechnologies: [
        'AWS / Azure / GCP',
        'Cloud Cost Management',
        'FinOps',
        'Cloud Security',
      ],
    },

    '4B#6': {
      questions: [
        'Jakie dane przechowujecie w prywatnej chmurze (dedykowanej), a jakie w publicznej — co decyduje o wyborze i jak jest to zarządzane?',
        'Jak chmura prywatna zapewnia izolację danych wrażliwych — co dostaje zewnętrzny dostawca, a czego absolutnie nie dostaje?',
        'Jak zarządzacie configuacją i provisioningiem zasobów w prywatnej chmurze — ręcznie przez admina, czy Infrastructure as Code?',
      ],
      example:
        'Dowód: polityka klasyfikacji danych z mapowaniem typów danych → środowisk przechowywania; dokumentacja architektury private cloud (topology, isolation); konfiguracja IaC z repozytorium git z datą ostatniej zmiany. Sygnał: decyzja co idzie do chmury prywatnej vs publicznej jest udokumentowana i egzekwowana — nie opiera się na intuicji admina.',
      suggestedTechnologies: [
        'Private Cloud',
        'IaC (Terraform/Ansible)',
        'Data Classification',
        'Secure Enclave',
      ],
    },

    '4B#7': {
      questions: [
        'Pokaż strategię przechowywania danych obejmującą jednocześnie edge, chmurę prywatną i publiczną — co gdzie trafia i dlaczego?',
        'Jak optymalizujecie koszty i wydajność przechowywania: które dane są hot (dostęp <ms), warm (minuty), cold (godziny-dni)?',
        'Kiedy ostatnio architektura przechowywania była przeglądana i kto podjął decyzję o zmianie tieru lub środowiska dla konkretnego zestawu danych?',
      ],
      example:
        'Dowód: diagram architektury hybrydowej (edge/on-prem/private cloud/public cloud) z uzasadnieniem dla każdego tieru; polityka tiering z regułami automatycznego przenoszenia danych; raport kosztów i wydajności per tier z ostatnich 90 dni. Sygnał: architektura hybrydowa jest aktywnie zarządzana — nie jest przypadkową sumą historycznych decyzji.',
      suggestedTechnologies: [
        'Hybrid Cloud',
        'Edge Computing',
        'Data Tiering',
        'Storage Orchestration',
        'FinOps',
      ],
    },

    // ================================================================
    // OŚ 4C — KOMUNIKACJA DANYCH (7 poziomów)
    // ================================================================

    '4C#1': {
      questions: [
        'Pokaż przykładowy raport papierowy lub wydruk używany do przekazywania danych między działami — co zawiera, kto go drukuje i jak często?',
        'Co się dzieje z raportem papierowym po jego użyciu — trafia do archiwum, niszczarki czy szuflady? Jak długo jest przechowywany?',
        'Kiedy ostatnio brak raportu papierowego spowodował decyzję opartą na nieaktualnych danych — opisz przypadek.',
      ],
      example:
        'Dowód: przykładowy drukowany raport z datą i polami danych; czas od wydruku do użycia przez decydenta (SLA: < 24h); lista raportów papierowych z częstotliwością i odbiorcami. Sygnał: nawet przy raportach papierowych — istnieje regularny rytm i zdefiniowani odbiorcy, dane nie są przypadkowe.',
      suggestedTechnologies: [
        'Print Management',
        'Document Distribution',
        'Basic Reporting',
        'Archive System',
      ],
    },

    '4C#2': {
      questions: [
        'Jakie dane przesyłacie e-mailem regularnie jako raporty lub informacje operacyjne — pokaż ostatni przykład, kto wysłał i co zawierał załącznik.',
        'Jak zarządzacie wersjami raportów przesyłanych e-mailem — skąd odbiorca wie, że dostał najaktualniejszą wersję?',
        'Co się dzieje, gdy e-mail z ważnym raportem trafi do spamu lub nie dotrze — jak to wykrywacie i jak reagujeecie?',
      ],
      example:
        'Dowód: przykładowy e-mail z raportem operacyjnym (treść i załącznik); historia wysyłek cyklicznych z ostatnich 30 dni (częstotliwość, odbiorcy); liczba reklamacji „nie dostałem raportu" z ostatniego kwartału. Sygnał: raporty e-mailowe mają zdefiniowany rytm i listę odbiorców — nie są wysyłane „gdy ktoś poprosi".',
      suggestedTechnologies: [
        'Email',
        'Report Distribution',
        'File Sharing',
        'Automated Reporting',
      ],
    },

    '4C#3': {
      questions: [
        'Pokaż fizyczną topologię sieci LAN w głównej lokalizacji — gdzie są switche, jak są podzielone segmenty i jaka jest przepustowość łączy krytycznych?',
        'Jak monitorujecie dostępność sieci LAN — czy macie narzędzie do monitoringu i kto dostaje alert gdy coś padnie?',
        'Kiedy ostatnio awaria sieci Ethernet wpłynęła na dostęp do systemów biznesowych — jak długo trwało i jak reagowaliście?',
      ],
      example:
        'Dowód: diagram topologii sieci LAN z datą aktualizacji; zrzut narzędzia do monitoringu sieci (uptime, latency, bandwidth) z ostatnich 24h; raport incydentów sieciowych z ostatnich 6 miesięcy z czasem przywrócenia. Sygnał: sieć ma inwentaryzację, monitoring i historię incydentów — ktoś jest za nią odpowiedzialny.',
      suggestedTechnologies: [
        'Network Management',
        'Ethernet Switch',
        'Network Monitoring',
        'LAN Documentation',
      ],
    },

    '4C#4': {
      questions: [
        'Gdzie stosujecie sieć Industrial Ethernet (PROFINET, EtherNet/IP, MODBUS TCP) i co ona łączy — maszyny, PLC, SCADA, systemy IT?',
        'Jak sieć przemysłowa jest odseparowana od sieci biurowej — co przechodzi przez DMZ, co jest całkowicie izolowane?',
        'Jakie jest SLA dostępności sieci przemysłowej i co się dzieje z produkcją przy jej awarii — macie fallback?',
      ],
      example:
        'Dowód: mapa sieci OT z protokołami i urządzeniami; dokumentacja segmentacji OT/IT (DMZ, firewall reguły); SLA dostępności sieci przemysłowej z historią przestojów. Sygnał: sieć przemysłowa jest zarządzana oddzielnie od biurowej — nie jest „tym samym kablem co do drukarki".',
      suggestedTechnologies: [
        'Industrial Ethernet',
        'PROFINET / EtherNet/IP',
        'OT/IT Segmentation',
        'Industrial Firewall',
      ],
    },

    '4C#5': {
      questions: [
        'Gdzie i jak wykorzystujecie sieci bezprzewodowe (WiFi, WLAN przemysłowe, 5G) do zbierania lub przesyłania danych operacyjnych?',
        'Jak zapewniacie niezawodność połączeń bezprzewodowych w środowiskach trudnych (hala produkcyjna, magazyn, zewnętrze) — pokrycie, handover, interference?',
        'Co się dzieje z urządzeniami mobilnymi lub IoT gdy tracą sygnał WiFi — jak są obsługiwane dane z tego okresu?',
      ],
      example:
        'Dowód: mapa pokrycia WiFi/WLAN z zaznaczeniem dead spots; raport jakości sygnału i retransmisji z ostatnich 7 dni; polityka obsługi offline devices (buforowanie i synchronizacja). Sygnał: urządzenia bezprzewodowe mają zapewnioną niezawodność przez redundancję lub offline buffering — nie po prostu „nie działają jak brak WiFi".',
      suggestedTechnologies: [
        'Industrial WLAN',
        'WiFi 6',
        '5G Private Network',
        'Wireless Site Survey',
      ],
    },

    '4C#6': {
      questions: [
        'Jak połączone są ze sobą różne lokalizacje firmy (oddziały, magazyny, fabryki) — VPN, MPLS, SD-WAN, chmura? Pokaż topologię WAN.',
        'Jaka jest gwarantowana przepustowość i SLA łączy WAN między lokalizacjami i jak reagujecie przy ich awarii?',
        'Jak pracownicy zdalni dostają dostęp do systemów wewnętrznych — VPN, zero-trust, czy jest różnica per system lub grupę użytkowników?',
      ],
      example:
        'Dowód: diagram topologii WAN z łączami, providerami i przepustowościami; SLA od dostawcy z historią realizacji; polityka dostępu zdalnego z uwierzytelnianiem MFA. Sygnał: firma ma SLA na łącza WAN i procedurę działania przy awarii łącza głównego — nie czeka bezczynnie aż naprawią.',
      suggestedTechnologies: [
        'SD-WAN',
        'MPLS',
        'VPN',
        'Zero Trust Network Access',
        'WAN Monitoring',
      ],
    },

    '4C#7': {
      questions: [
        'Jak aplikacje, dane i zasoby obliczeniowe są dostarczane z chmury — jakie usługi PaaS/IaaS/SaaS są centralnym kanałem komunikacji danych w firmie?',
        'Jak zarządzacie API między systemami i usługami chmurowymi — czy macie API gateway lub event bus, czy systemy gadają bezpośrednio?',
        'Jak skalujecie przepustowość komunikacji danych gdy rośnie obciążenie — automatyczne skalowanie chmury, czy trzeba ręcznie dokupować capacity?',
      ],
      example:
        'Dowód: diagram architektury cloud communication (API gateway, event streaming, CDN); raport dostępności i latency usług cloud za ostatnie 90 dni; przykład automatycznego skalowania (auto-scaling event) z logu. Sygnał: architektura komunikacji jest cloud-native — skalowanie jest automatyczne i użytkownicy nie odczuwają zmian obciążenia.',
      suggestedTechnologies: [
        'API Gateway',
        'Event Streaming (Kafka)',
        'CDN',
        'Cloud Architecture',
        'Service Mesh',
      ],
    },

    // ================================================================
    // OŚ 4D — ANALIZA BIG DATA (7 poziomów)
    // ================================================================

    '4D#1': {
      questions: [
        'Jakie systemy zarządzania bazami danych (DBMS) macie w firmie — MySQL, PostgreSQL, Oracle, SQL Server — i do czego każdy służy?',
        'Jak zarządzacie schematem bazy danych — kto może go zmieniać, jak są dokumentowane zmiany i jak testowane są migracje?',
        'Pokaż przykładowe zapytanie SQL, które odpowiada na pytanie biznesowe (np. sprzedaż per klient za ostatni kwartał) — czy menedżer może to zrobić sam, czy czeka na IT?',
      ],
      example:
        'Dowód: lista aktywnych baz danych z dokumentacją schematu i właścicielem; przykład zapytania analitycznego z wynikiem; czas od pytania biznesowego do raportu z danych (SLA: <1 dzień roboczy). Sygnał: dane są w relacyjnej bazie — nie tylko w arkuszach Excel menedżerów.',
      suggestedTechnologies: [
        'RDBMS (PostgreSQL/MySQL)',
        'SQL',
        'Database Documentation',
        'Query Tools',
      ],
    },

    '4D#2': {
      questions: [
        'Jakie systemy ETL lub ELT macie do przenoszenia i transformacji danych między systemami źródłowymi a analitycznymi?',
        'Pokaż pipeline ETL, który działa regularnie — skąd, dokąd, jak często, co transformuje i jak monitorujecie czy zadziałał?',
        'Kiedy ostatnio pipeline ETL zawiódł — co się stało z raportem analitycznym, kto to wykrył i jak szybko naprawiono?',
      ],
      example:
        'Dowód: diagram pipeline ETL z systemami źródłowymi i docelowymi; log uruchomień ETL z ostatnich 7 dni (sukces/błąd, czas trwania); alert po awarii ETL z historią. Sygnał: ETL działa regularnie i jest monitorowane — awaria jest wykrywana automatycznie, nie przez przypadek.',
      suggestedTechnologies: [
        'ETL/ELT Platform',
        'Data Pipeline',
        'Apache Airflow',
        'dbt',
        'Pipeline Monitoring',
      ],
    },

    '4D#3': {
      questions: [
        'Pokaż aktywny dashboard BI używany przez menedżerów do codziennych decyzji — skąd pochodzi, kto go używa i jak często?',
        'Jak pracownicy (nie analitycy) sami tworzą wykresy lub raporty ad-hoc — czy mają do tego narzędzie self-service BI, czy muszą prosić IT?',
        'Kiedy ostatnio wizualizacja danych ujawniła trend lub anomalię, która nie byłaby widoczna w tabeli liczb — opisz przypadek.',
      ],
      example:
        'Dowód: zrzut dashboardu BI z datą ostatniego odświeżenia i liczbą aktywnych użytkowników (30 dni); raport ad-hoc stworzony przez użytkownika biznesowego (nie IT) w ciągu ostatniego tygodnia; anomalia wykryta przez wizualizację z decyzją podjętą w jej wyniku. Sygnał: BI jest używane przez ludzi biznesu, nie tylko przez analityków z IT.',
      suggestedTechnologies: [
        'BI Platform (Power BI/Tableau)',
        'Self-service Analytics',
        'Data Visualization',
        'Embedded Analytics',
      ],
    },

    '4D#4': {
      questions: [
        'Jakie platformy big data (Hadoop, Spark, Databricks, Snowflake) lub ich odpowiedniki stosujecie do przetwarzania dużych wolumenów danych?',
        'Pokaż pipeline analizy big data — jak duże dane (> 100GB) są przetwarzane, ile trwa i jak skalujecie obliczenia przy większym obciążeniu?',
        'Do jakich decyzji biznesowych używacie wyników analiz big data — pokaż ostatni przypadek decyzji opartej na analizie dużego zbioru.',
      ],
      example:
        'Dowód: architektura platformy big data z technologiami i wolumenami danych; raport z analizy big data z decyzją biznesową i datą; czas przetwarzania 1TB danych w danym pipeline (benchmark). Sygnał: firma analizuje dane, których objętości nie pomieści Excel — i robi to regularnie w procesach decyzyjnych.',
      suggestedTechnologies: [
        'Apache Spark',
        'Databricks',
        'Snowflake',
        'BigQuery',
        'Distributed Computing',
      ],
    },

    '4D#5': {
      questions: [
        'Jak sprawdzacie i zapewniacie jakość danych w swoich systemach — procesy, narzędzia, reguły walidacji, komu raportowane?',
        'Pokaż raport jakości danych z ostatnich 30 dni — jakie problemy znaleziono (duplikaty, braki, niespójności) i jak zostały naprawione?',
        'Kto jest właścicielem jakości danych per obszar (sprzedaż, produkcja, HR) i jak egzekwowane są standardy?',
      ],
      example:
        'Dowód: raport data quality z narzędzia (Great Expectations, dbt tests, Informatica) za ostatnie 30 dni; lista właścicieli danych z odpowiedzialnościami; czas od wykrycia problemu jakościowego do naprawy (SLA). Sygnał: jakość danych jest mierzona i zarządzana — nie tylko znana jako problem z nikim odpowiedzialnym za poprawę.',
      suggestedTechnologies: [
        'Data Quality Platform',
        'dbt Tests',
        'Data Profiling',
        'Data Governance',
        'Master Data Management',
      ],
    },

    '4D#6': {
      questions: [
        'Gdzie stosujecie symulacje danych do testowania scenariuszy biznesowych lub operacyjnych — pokaż ostatnią symulację i decyzję, która z niej wynikła.',
        'Jak generujecie dane syntetyczne do testowania systemów lub modeli ML — jakie narzędzia i jak weryfikujecie realistyczność danych syntetycznych?',
        'Kiedy symulacja danych pomogła uniknąć kosztownego błędu lub zmniejszyć ryzyko decyzji — opisz przypadek.',
      ],
      example:
        'Dowód: raport z ostatniej symulacji danych (parametry, scenariusze, wyniki); porównanie danych syntetycznych z prawdziwymi (statistical tests); decyzja podjęta na podstawie symulacji z datą i mierzalnym efektem. Sygnał: firma używa symulacji zanim wdroży zmianę w produkcji — nie tylko post-factum analizuje co poszło nie tak.',
      suggestedTechnologies: [
        'Data Simulation Tools',
        'Synthetic Data Generation',
        'Monte Carlo Simulation',
        'Digital Twin',
      ],
    },

    '4D#7': {
      questions: [
        'Jakie modele uczenia maszynowego działają produkcyjnie w firmie — co przewidują, na jakich danych są trenowane i jak często reruns?',
        'Jak monitorujecie jakość modeli ML w produkcji — czy śledzicie drift, degradację jakości predykcji, i kto reaguje gdy model się pogarsza?',
        'Pokaż przypadek gdy model ML zmienił decyzję biznesową na lepszą — jaki był baseline (bez modelu) i jaki wynik z modelem?',
      ],
      example:
        'Dowód: rejestr modeli ML w produkcji (model, cel, metryki, data deployu); raport monitoringu modelu (accuracy/F1 trend za ostatnie 90 dni); A/B test lub before/after analiza efektu modelu na metrykę biznesową. Sygnał: ML jest w produkcji i mierzalnie poprawia wynik — nie jest tylko eksperymentem w notebooku analityka.',
      suggestedTechnologies: [
        'MLOps Platform',
        'Model Registry',
        'Model Monitoring',
        'ML Pipeline',
        'Feature Store',
      ],
    },

    // ================================================================
    // OŚ 4E — PRZETWARZANIE DANYCH / MOCA OBLICZENIOWA (7 poziomów)
    // ================================================================

    '4E#1': {
      questions: [
        'Na jakich komputerach stacjonarnych lub laptopach odbywa się przetwarzanie danych analitycznych i operacyjnych — jak stary jest sprzęt i jakie ma ograniczenia?',
        'Co się dzieje gdy pracownik musi przetworzyć duży plik lub raport — komputer zwalnia, zawiesza się, czy radzi sobie bez problemu?',
        'Ile czasu zajmuje wygenerowanie raportu miesięcznego na lokalnym komputerze i czy jest to akceptowalne dla użytkownika?',
      ],
      example:
        'Dowód: inwentaryzacja sprzętu komputerowego z wiekiem, RAM, CPU (IT asset inventory); czas generowania standardowego raportu miesięcznego (benchmark); liczba zgłoszeń do helpdesk „komputer za wolny" z ostatnich 90 dni. Sygnał: sprzęt jest wystarczający do aktualnych potrzeb — użytkownicy nie czekają na komputer.',
      suggestedTechnologies: [
        'PC Hardware',
        'IT Asset Management',
        'Performance Monitoring',
        'Desktop Virtualization',
      ],
    },

    '4E#2': {
      questions: [
        'Jakie serwery fizyczne lub wirtualne przetwarzają dane firmowe — gdzie są, kto je zarządza i jakie obciążenie obsługują?',
        'Jak monitorujecie wykorzystanie zasobów serwerów (CPU, RAM, storage) i jak reagujecie gdy zbliżają się do limitu?',
        'Kiedy ostatnio serwer był przeciążony lub padł — co to wpłynęło na działanie firmy i jak szybko zostało naprawione?',
      ],
      example:
        'Dowód: inwentaryzacja serwerów z konfiguracją i rolami; raport utilization CPU/RAM/storage z ostatnich 30 dni; SLA utrzymania serwerów i historia incydentów. Sygnał: serwery są monitorowane i mają jasno zdefiniowanego właściciela i procedurę przy awarii.',
      suggestedTechnologies: [
        'Server Infrastructure',
        'Virtualization (VMware)',
        'Server Monitoring',
        'Capacity Planning',
      ],
    },

    '4E#3': {
      questions: [
        'Czy macie klaster serwerowy (load balancing, failover, shared storage) — pokaż architekturę i co chronicie przed awarią.',
        'Jak klaster obsługuje awarię jednego węzła — co dzieje się z aplikacjami, jak długo trwa failover i czy użytkownicy to odczuwają?',
        'Pokaż ostatni test failover klastra — kiedy był, jak wyglądał scenariusz i jaki był czas przywrócenia (RTO)?',
      ],
      example:
        'Dowód: diagram klastra z węzłami, siecią i storage; raport z ostatniego testu failover (data, scenariusz, RTO); monitoring klastra z alertami dostępności. Sygnał: klaster ma przetestowany failover — firma wie ile czasu zajmuje przywrócenie, bo to zmierzyła.',
      suggestedTechnologies: [
        'Clustering',
        'Load Balancing',
        'High Availability',
        'Shared Storage',
      ],
    },

    '4E#4': {
      questions: [
        'Czy uczestniczycie w grid computing lub zdolności obliczeniowej współdzielonej z innymi organizacjami — po co i jak?',
        'Jak zarządzacie dostępem do zasobów obliczeniowych w modelu grid — priorytety, limity, rozliczenia kosztów?',
        'Jakie zadania obliczeniowe korzystają z zasobów zewnętrznych lub współdzielonych — co nie zmieściłoby się na waszej własnej infrastrukturze?',
      ],
      example:
        'Dowód: dokumentacja uczestnictwa w grid computing (provider, scope, SLA); raport zadań obliczeniowych uruchomionych na zewnętrznej infrastrukturze z ostatnich 90 dni; kalkulacja kosztów grid vs własna infrastruktura. Sygnał: grid computing jest używany do konkretnych zadań obliczeniowych — nie jako teorytyczna opcja.',
      suggestedTechnologies: [
        'Grid Computing',
        'HPC Clusters',
        'Distributed Workloads',
        'Research Computing',
      ],
    },

    '4E#5': {
      questions: [
        'Jakie usługi obliczeniowe w chmurze publicznej (EC2, Azure VM, GCP Compute) uruchamiacie i na jak długo typowo działają — on-demand, reserved, czy spot?',
        'Jak optymalizujecie koszty cloud compute — auto-scaling, spot instances, reserved capacity — pokaż raport oszczędności z ostatnich 3 miesięcy.',
        'Co nie działałoby bez cloud compute — co by się musiało zmienić jeśli cloud stałby się niedostępny?',
      ],
      example:
        'Dowód: raport zużycia cloud compute z breakdown po usługach i kosztach; konfiguracja auto-scaling z logu ostatnich 7 dni; savings report z reserved vs on-demand. Sygnał: cloud compute jest zarządzany kosztowo — firma wie co płaci i za co.',
      suggestedTechnologies: [
        'Cloud Compute (EC2/Azure VM)',
        'Auto-scaling',
        'Spot Instances',
        'Cloud Cost Management',
      ],
    },

    '4E#6': {
      questions: [
        'Gdzie stosujecie edge computing — przetwarzanie danych blisko źródła (przy maszynie, w pojeździe, w punkcie sprzedaży) — co tam przetwarzacie i dlaczego nie w chmurze?',
        'Jak zarządzacie flotą urządzeń edge — aktualizacje oprogramowania, monitoring, bezpieczeństwo — pokaż panel zarządzania flotą.',
        'Co się dzieje gdy urządzenie edge traci połączenie z chmurą — jak długo może działać autonomicznie i co buforuje?',
      ],
      example:
        'Dowód: mapa rozmieszczenia urządzeń edge z zadaniami obliczeniowymi; panel zarządzania flotą edge z wersją oprogramowania i stanem urządzeń; polityka offline mode z max. czasem autonomii i zakresem buforowania. Sygnał: edge computing rozwiązuje konkretny problem latency lub offline — nie jest tylko „bo modne".',
      suggestedTechnologies: [
        'Edge Computing Devices',
        'Fleet Management',
        'Edge AI',
        'Offline First Architecture',
      ],
    },

    '4E#7': {
      questions: [
        'Czy badacie lub planujecie zastosowania quantum computing w swojej branży — do jakich problemów i z jakimi partnerami lub dostawcami?',
        'Jakie algorytmy kwantowe lub symulatory kwantowe testowaliście — co próbowaliście rozwiązać i jakie były wstępne wyniki?',
        'Jak oceniacie horyzont czasu, w którym quantum computing stanie się istotne dla waszej branży — i co robicie już dziś, żeby być gotowi?',
      ],
      example:
        'Dowód: dokumentacja eksperymentu z quantum simulator lub QPU (AWS Braket, Azure Quantum, IBM Quantum) z wynikami; analiza use case quantum dla branży z oceną dojrzałości technologii; partnerstwo lub program badawczy quantum computing. Sygnał: firma śledzi quantum computing aktywnie — ma ludzi, którzy to rozumieją i eksperymentują, nie tylko czytają artykuły.',
      suggestedTechnologies: [
        'Quantum Computing (IBM Q / AWS Braket)',
        'Quantum Simulation',
        'Post-quantum Cryptography',
        'Quantum Research Programs',
      ],
    },
  };
