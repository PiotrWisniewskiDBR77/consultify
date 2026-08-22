const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error('DATABASE_URL is required');

const templates = [
  {
    id: 'lib-tpl-ops-001__vts',
    name: 'Audyt Doskonałości Operacyjnej',
    description: 'Strukturalna diagnostyka dojrzałości procesowej, produktywności, systemów jakości i zdolności do ciągłego doskonalenia. Oparta na ramach stosowanych przez wiodące firmy doradcze do identyfikacji możliwości poprawy operacyjnej na poziomie 15-30% kosztów operacyjnych.',
    category: 'OPERATIONAL',
    questions: [
      {
        text: 'Przeprowadź mnie przez swój strumień wartości od zamówienia klienta do dostawy. Gdzie tworzy się wartość, a gdzie się blokuje?',
        desc: 'To pytanie mapuje łańcuch wartości. Dobrzy operatorzy potrafią wskazać nie tylko etapy, ale też gdzie wartość jest tworzona vs. gdzie czas i zasoby są konsumowane bez dodawania wartości. Słuchaj świadomości różnicy między czasem cyklu a czasem przejścia.',
        evidence: 'Poproś o mapę strumienia wartości (VSM), jeśli istnieje, lub diagram przepływu produkcji/usługi. Zanotuj takt time, czasy cyklu na stanowiskach i poziomy WIP między etapami.',
        shape: 'Spójna narracja 5-10 kroków procesu z uczciwą identyfikacją 2-3 punktów marnotrawstwa. Słabe odpowiedzi to generyczna lista działów. Dobre odpowiedzi kwantyfikują opóźnienia ("części czekają 3 dni w buforze") i znają takt time.'
      },
      {
        text: 'Jakie są 3 najważniejsze ograniczenia limitujące Waszą przepustowość? Jak je zidentyfikowaliście i co próbowaliście zrobić?',
        desc: 'Myślenie Teorii Ograniczeń (TOC). Oceniasz, czy organizacja systematycznie identyfikuje i zarządza wąskimi gardłami, czy po prostu gasi pożary. Metoda identyfikacji jest tak samo ważna jak sama odpowiedź.',
        evidence: 'Poproś o dane z analizy wąskich gardeł, raporty wykorzystania mocy na stanowiskach/liniach. Zapytaj o metodę — czy była oparta na danych (badania czasu, analiza zdolności) czy na opiniach?',
        shape: 'Konkretne ograniczenia z danymi (np. "frezarka CNC pracuje przy 94% wykorzystaniu, reszta linii średnio 72%"). Słabe: "potrzebujemy więcej ludzi". Dobre: systematyczne podejście do identyfikacji i eksploatacji ograniczeń przed inwestowaniem.'
      },
      {
        text: 'Podaj mi rozkład OEE — Dostępność, Wydajność, Jakość — dla Waszych 3 głównych linii produkcyjnych. Jak się zmieniał w ostatnich 12 miesiącach i co wpłynęło na zmiany?',
        desc: 'OEE to złoty standard mierzenia efektywności produkcji. Rozkład na składowe jest ważniejszy niż zagregowana liczba. Organizacje śledzące wszystkie trzy składowe osobno operują na wyższym poziomie dojrzałości. Klasa światowa: 85%+; większość zakładów: 55-65%.',
        evidence: 'Poproś o dashboard OEE lub miesięczne raporty. Zapytaj konkretnie o rozkład na składowe. Jeśli mają tylko zagregowany OEE, to samo w sobie jest ustaleniem diagnostycznym. Zapytaj też o metodę pomiaru — ręczna vs. automatyczna.',
        shape: 'Trzyskładnikowy OEE z trendem i analizą przyczynową zmian. Doskonałe: "Linia A: 78% (Dost. 92%, Wyd. 89%, Jak. 95%), wzrost z 71% po wdrożeniu SMED." Niepokojące: "Nasze OEE to około 60%" bez rozkładu i świadomości trendu.'
      },
      {
        text: 'Opisz Wasz system zarządzania jakością. Jak zapobiegacie defektom vs. jak je wykrywacie? Jaki jest Wasz aktualny koszt złej jakości (COPQ)?',
        desc: 'Proporcja prewencji do detekcji ujawnia dojrzałość jakościową. Dojrzałe organizacje wydają 70%+ wysiłku na prewencję (przeglądy projektów, FMEA, poka-yoke) vs. detekcję (inspekcja, testy). COPQ w niedojrzałych organizacjach sięga 15-25% przychodów.',
        evidence: 'Poproś o: raporty COPQ (koszty wewnętrznych awarii + zewnętrznych + oceny + prewencji), wykresy Pareto defektów, trendy reklamacji klientów, koszty gwarancji. Zapytaj o konkretne narzędzia prewencji: FMEA, poka-yoke, SPC.',
        shape: 'Szczegółowy opis systemu z konkretną wartością COPQ. Dobre: "COPQ to 4,2% przychodów, spadek z 6,8% — zainwestowaliśmy w poka-yoke na 12 stanowiskach i SPC na 8 parametrach krytycznych." Słabe: "Mamy ISO 9001" bez znajomości COPQ.'
      },
      {
        text: 'Jak zarządzacie nieplanowanymi przestojami? Jaki jest stosunek planowanych do reaktywnych napraw i jak wygląda Wasz backlog utrzymania ruchu?',
        desc: 'Strategia utrzymania ruchu to kluczowa dźwignia operacyjna. Klasa światowa: 80%+ planowanego utrzymania. Większość organizacji: 50-60% reaktywnych napraw, które kosztują 3-5x więcej na zdarzenie. Wielkość i trend backlogu wskazują, czy organizacja nadrabia zaległości.',
        evidence: 'Poproś o: stosunek planowanych/nieplanowanych napraw, MTBF i MTTR dla kluczowego sprzętu, backlog w godzinach/tygodniach, wskaźnik zgodności przeglądów. Zapytaj o system CMMS.',
        shape: 'Konkretny stosunek z trendem i kwantyfikacją backlogu. Dobre: "72% planowanych, wzrost z 55%. Backlog 340 godzin, stabilny. Zgodność PM na 91%." Słabe: "Robimy przeglądy prewencyjne" bez metryk.'
      },
      {
        text: 'Jak wygląda Wasz proces planowania i harmonogramowania produkcji? Na ile do przodu jest zamrożony harmonogram i jak często się zmienia?',
        desc: 'Stabilność planowania bezpośrednio wpływa na efektywność. Częste zmiany harmonogramu kaskadują w nadgodziny, koszty ekspedycji i marnotrawstwo zapasów. Długość okna zamrożenia i częstość zmian to kluczowe wskaźniki.',
        evidence: 'Poproś o: wskaźnik dotrzymania harmonogramu, liczbę zmian/tydzień, horyzont zamrożonego harmonogramu, OTD do harmonogramu. Zapytaj o narzędzia — ERP, APS, czy Excel?',
        shape: 'Klarowny proces z horyzontem zamrożenia i metrykami adherencji. Dobre: "2-tygodniowy zamrożony harmonogram, 93% adherencji, zmiany średnio 4/tydzień, malejący trend." Słabe: "Planujemy tygodniowo, ale ciągle się zmienia" bez kwantyfikacji.'
      },
      {
        text: 'Zmapuj mi Wasze zapasy — surowce, WIP i wyroby gotowe. Jakie macie rotacje zapasów i gdzie kapitał się blokuje?',
        desc: 'Zapasy to fizyczna manifestacja problemów procesowych. Nadmiar ukrywa problemy jakościowe, błędy planowania i niestabilność łańcucha dostaw. Większość organizacji ma 20-40% więcej zapasów niż potrzeba.',
        evidence: 'Poproś o: rotacje wg kategorii, dni zapasu, % dead/slow-moving stock, szacunkowy koszt utrzymania. Zapytaj konkretnie o WIP między stanowiskami — tam ukrywa się marnotrawstwo.',
        shape: 'Metryki zapasów wg kategorii ze świadomością przyczyn. Dobre: "Surowce 12x, WIP 24x, WG 8x. WG niskie z powodu zmienności popytu — trzymamy 2,5 tyg. zapasu bezpieczeństwa dla A-pozycji. 1,2M PLN w slow-movers, redukujemy." Słabe: "Musiałbym sprawdzić z finansami."'
      },
      {
        text: 'Opowiedz o Waszym programie ciągłego doskonalenia. Ile wydarzeń kaizen / projektów CI odbyło się w ciągu 12 miesięcy? Jaki był łączny wpływ finansowy i jak go weryfikowaliście?',
        desc: 'Papierek lakmusowy dojrzałości CI — czy doskonalenie jest wbudowane w codzienną pracę, czy to okresowa inicjatywa zarządu? Zrównoważone programy CI dostarczają 3-5% rocznej poprawy produktywności. Weryfikacja finansowa świadczy o rzetelności.',
        evidence: 'Poproś o: rejestr projektów CI, dziennik Kaizen ze śledzonymi oszczędnościami, wskaźniki uczestnictwa w systemie sugestii. Zapytaj o metodologię (Lean, Six Sigma, TPM) i dedykowane zasoby CI.',
        shape: 'Konkretne metryki programu z zweryfikowanymi oszczędnościami. Dobre: "43 eventy Kaizen, 180 drobnych usprawnień z systemu sugestii. Zweryfikowane oszczędności 1,8M PLN. 2 inżynierów CI na pełen etat, 12 certyfikowanych Green Beltów." Słabe: "Mieliśmy warsztat Lean rok temu."'
      },
      {
        text: 'Jak zorganizowane są Wasze zespoły operacyjne? Jaki jest span of control brygadzistów i ile czasu poświęcają na bezpośrednie przywództwo vs. administrację?',
        desc: 'Design organizacyjny wpływa na wyniki operacyjne. Optymalny span of control: 8-15 bezpośrednich podwładnych. Leader Standard Work pokazuje, czy przełożeni coachują zespoły czy gaszą pożary. Obciążenie administracyjne powyżej 30% sygnalizuje problemy systemowe.',
        evidence: 'Poproś o: schemat organizacyjny z headcount, stosunek przełożony-operator, dokumentację Leader Standard Work. Zapytaj o codzienne rutyny zarządzania (spotkania tier, gemba walks).',
        shape: 'Klarowna struktura z rozpiętością kierowania i alokacją czasu. Dobre: "Brygadziści mają 10-12 podwładnych, 60% na hali, 15% coaching, 25% admin. Robimy codzienne tier 1 i tygodniowe tier 2." Słabe: "Brygadziści zarządzają zespołami" bez szczegółów.'
      },
      {
        text: 'Jaki jest trend produktywności pracy? Jak mierzycie i co powoduje zmienność?',
        desc: 'Produktywność pracy (jednostki na roboczogodzinę, przychód na FTE itp.) to integrująca metryka operacyjna. Trend ważniejszy od wartości bezwzględnej. Zrozumienie czynników zmienności pokazuje dojrzałość analityczną.',
        evidence: 'Poproś o: definicję metryki i 12-miesięczny trend, absencję, nadgodziny, godziny szkoleń. Zapytaj co napędza dobre tygodnie vs. złe tygodnie.',
        shape: 'Zdefiniowana metryka z trendem i analizą zmienności. Dobre: "Jednostki/roboczogodzinę poprawiły się 8% r/r. Główne czynniki zmienności: mix produktów (40%), absencja (25%), dostępność materiałów (20%). Śledzimy tygodniowo per linia." Słabe: "Produktywność jest OK."'
      },
      {
        text: 'Jak dojrzała jest Wasza współpraca z łańcuchem dostaw? Jaki OTIF mają Wasi top 10 dostawcy i jak zarządzacie ich wynikami?',
        desc: 'Niezawodność łańcucha dostaw bezpośrednio wpływa na operacje wewnętrzne. OTIF poniżej 95% od kluczowych dostawców powoduje ekspedycję, zmiany harmonogramu i nadmiarowe bufory.',
        evidence: 'Poproś o: scorecard OTIF dostawców, wskaźniki odrzutów jakościowych, program rozwoju dostawców. Zapytaj o dual-sourcing dla komponentów krytycznych.',
        shape: 'Dane OTIF z procesem zarządzania. Dobre: "Top 10 średnio 96,2% OTIF. Kwartalne przeglądy biznesowe, formalny program rozwoju dolnego kwartyla, dual-sourcing wszystkich komponentów kategorii A." Słabe: "Dostawcy generalnie OK, czasem mamy problemy."'
      },
      {
        text: 'Gdybym dał Ci nieograniczony budżet na jedno usprawnienie operacyjne, w co byś zainwestował i dlaczego? Jakiego ROI byś oczekiwał?',
        desc: 'Ujawnia, co operator naprawdę uważa za ograniczenie, bez polityki budżetowej. Testuje też zdolność budowania business case i myślenia w kategorii ROI zamiast wydatków.',
        evidence: 'Nie potrzeba dokumentów — to pytanie o osąd i wizję. Słuchaj jakości logiki business case i czy inwestycja adresuje przyczyny źródłowe czy objawy.',
        shape: 'Konkretna inwestycja z logiką ROI. Dobre: "Automatyczna linia pakowania — 2,4M PLN, zwrot w 18 miesięcy. To nasze ograniczenie, 97% wykorzystania, tracimy 200K/miesiąc na nadgodziny i utracone dostawy." Słabe: "Więcej ludzi" bez analizy ROI.'
      }
    ]
  },
  {
    id: 'lib-tpl-digital-001__vts',
    name: 'Ocena Dojrzałości Cyfrowej',
    description: 'Strukturalna ocena dojrzałości transformacji cyfrowej w pięciu wymiarach: dopasowanie strategiczne, krajobraz technologiczny, cyfryzacja procesów, zdolności analityczne i gotowość ludzi. Kalibrowana wobec benchmarków branżowych dla identyfikacji dźwigni transformacyjnych o najwyższym wpływie.',
    category: 'DIGITAL',
    questions: [
      {
        text: 'Gdzie transformacja cyfrowa znajduje się w Waszej strategii korporacyjnej? Czy jest enablerem strategii biznesowej, osobną inicjatywą IT, czy czymś pomiędzy? Kto ją sponsoruje na poziomie zarządu?',
        desc: 'Dopasowanie strategiczne jest najsilniejszym predyktorem sukcesu transformacji cyfrowej. Organizacje, gdzie cyfryzacja jest inicjatywą IT, ponoszą porażkę 3x częściej niż te, gdzie biznes jest właścicielem agendy.',
        evidence: 'Poproś o: dokument strategii cyfrowej, prezentację zarządu o priorytetach cyfrowych, charter komitetu sterującego. Sprawdź, czy CDO/CTO raportuje do CEO czy CFO.',
        shape: 'Jasna artykulacja powiązania cyfrowo-biznesowego z nazwanym sponsorem. Dobre: "Cyfryzacja jest wbudowana w 5-letnią strategię biznesową, sponsorowana przez CEO, z dedykowanym biurem transformacji." Słabe: "IT prowadzi kilka projektów cyfryzacji."'
      },
      {
        text: 'Jak wygląda Wasz krajobraz technologiczny? Wymień główne systemy, ich wiek, jak się ze sobą komunikują i gdzie nosicie znaczący dług technologiczny.',
        desc: 'Złożoność krajobrazu i dług technologiczny to ukryte podatki na transformację. Większość organizacji nie doszacowuje swojego długu o 40-60%. Architektura integracji determinuje, jak szybko można wdrażać nowe zdolności.',
        evidence: 'Poproś o: diagram architektury, inwentarz aplikacji z wiekiem, mapę integracji. Zapytaj o wydatki IT jako % przychodów (benchmark: 3-6% przemysł, 5-10% usługi).',
        shape: 'Uczciwy inwentarz z wiekiem i oceną integracji. Dobre: nazwy systemów z wiekiem, znane obszary długu, metoda integracji. Słabe: ogólnikowa lista systemów bez świadomości długu.'
      },
      {
        text: 'Jaki procent Waszych procesów biznesowych jest scyfryzowany end-to-end vs. częściowo vs. nadal papierowo/ręcznie? Podaj konkretne przykłady każdego.',
        desc: '"End-to-end" oznacza, że dane przepływają bez ręcznego przepisywania od inicjacji do zakończenia. Częściowa cyfryzacja często tworzy więcej problemów niż pełna ręczna obsługa.',
        evidence: 'Poproś o: inwentarz procesów ze statusem cyfryzacji. Poproś o 3 przykłady: jeden w pełni scyfryzowany, jeden częściowo, jeden nadal ręczny. Dla każdego zapytaj o punkty ręcznego wprowadzania danych.',
        shape: 'Uczciwy procentowy rozkład z konkretnymi przykładami. Dobre: procenty z nazwanymi procesami i znanymi lukami. Słabe: "Większość jest cyfrowa" bez szczegółów.'
      },
      {
        text: 'Jak dane przepływają z miejsca generowania do miejsca podejmowania decyzji? Przeprowadź mnie przez konkretną decyzję — kto zbiera dane, jak się przemieszczają, ile to trwa i jak bardzo im ufasz.',
        desc: 'Pipeline danych-do-decyzji to miejsce, gdzie dojrzałość cyfrowa ujawnia się w praktyce. Długie opóźnienia, ręczne transformacje i brak zaufania wskazują na fundamentalne problemy architektury danych.',
        evidence: 'Zmapuj konkretny przykład end-to-end. Zanotuj: liczbę ręcznych handoffów, opóźnienia, zmiany formatu (PDF → Excel → mail → dashboard). Zapytaj ile osób dotyka danych.',
        shape: 'Konkretny przykład z osią czasu i oceną zaufania. Dobre: nazwany pipeline z timingiem i poziomem zaufania. Słabe: "Mamy dashboardy" bez wiedzy o pipeline.'
      },
      {
        text: 'Oceń organizację w skali 1-5 dla każdego: self-service analytics, alfabetyzm danych w działach, i gotowość do działania na podstawie danych sprzecznych z intuicją. Uzasadnij.',
        desc: 'Trzy wymiary kultury danych. Self-service (czy biznes może uzyskać odpowiedzi bez IT?), alfabetyzm (czy interpretują poprawnie?), podejmowanie decyzji na danych (czy używają danych, gdy jest niewygodnie?).',
        evidence: 'Self-service: ilu może tworzyć własne raporty vs. zlecać IT. Alfabetyzm: kiedy ostatnio insight danych zmienił decyzję. Działanie: przykład, gdy dane były sprzeczne z intuicją kierownictwa — co się stało?',
        shape: 'Trzy oddzielne oceny z uczciwym uzasadnieniem i przykładami. Dobre: zróżnicowane oceny ze wspierającymi przykładami. Słabe: "Jesteśmy na 4" bez dowodów.'
      },
      {
        text: 'Jakich kompetencji cyfrowych Wasza kadra potrzebuje za 3 lata, których nie ma dziś? Jak zamykacie tę lukę i czy to działa?',
        desc: 'Zdolności ludzi to ograniczenie, w które organizacje inwestują na końcu, a powinny na początku. Większość programów szkoleniowych ma mniej niż 20% wskaźnik zmiany zachowań.',
        evidence: 'Poproś o: matrycę kompetencji cyfrowych, katalog programów szkoleniowych i uczestnictwo, plan rekrutacji na stanowiska cyfrowe.',
        shape: 'Konkretna luka kompetencyjna z planowaną strategią zamykania: liczba zapisanych, wskaźnik ukończenia, pipeline rekrutacji. Słabe: "Potrzebujemy więcej kompetencji cyfrowych" bez planu.'
      },
      {
        text: 'Jak zarządzacie ryzykiem cyberbezpieczeństwa w kontekście transformacji? Czy bezpieczeństwo kiedykolwiek spowolniło lub zablokowało inicjatywę cyfrową?',
        desc: 'Security-by-design vs. security-as-blocker to kluczowy wskaźnik dojrzałości. Niedojrzałe organizacje albo ignorują bezpieczeństwo, albo pozwalają mu blokować postęp.',
        evidence: 'Zapytaj o: ostatni pentest, historię incydentów. Poproś o przykład, gdzie wymagania bezpieczeństwa wpłynęły na timeline projektu cyfrowego.',
        shape: 'Zbalansowana postawa bezpieczeństwa z governance. Dobre: wbudowany przegląd security z znanymi kompromisami. Słabe: "IT zajmuje się bezpieczeństwem."'
      },
      {
        text: 'Jakie jest Wasze podejście do innowacji i eksperymentowania? Ile pilotaży cyfrowych przeprowadziliście w ostatnich 12 miesiącach i co się z nimi stało?',
        desc: 'Przepustowość pipeline innowacji i wskaźnik skalowania. Zdrowe organizacje: 60-70% pilotaży prowadzi do decyzji (skaluj lub zabij). "Czyściec pilotażowy" oznacza, że nigdy nie dostają budżetu na skalowanie ani nie są formalnie zamykane.',
        evidence: 'Poproś o: portfolio innowacji, dziennik wyników pilotaży. Zapytaj: ile rozpoczęto, ile skalowano, ile zamknięto, ile tkwi w pilotażu po 12+ miesiącach.',
        shape: 'Skwantyfikowany pipeline z wynikami: rozpoczęte/skalowane/zamknięte/utknięte. Słabe: "Mamy lab innowacji" bez danych o przepustowości.'
      },
      {
        text: 'Jakie zdolności AI/ML macie wdrożone produkcyjnie — nie piloty, ale systemy wspierające realne decyzje biznesowe każdego dnia?',
        desc: 'Rozróżnienie między AI w produkcji a AI w pilocie jest kluczowe. Większość organizacji utknęła na etapie pilotażu. Produkcyjne AI wymaga MLOps, monitoringu, retrainingu — to znaki zaawansowanej dojrzałości.',
        evidence: 'Dla każdego produkcyjnego AI: jaką decyzję wspiera, jak długo działa, jak jest monitorowane, kiedy ostatni retraining, co się dzieje, gdy podaje złą odpowiedź.',
        shape: 'Konkretne produkcyjne AI z detalami operacyjnymi i wpływem biznesowym. Słabe: "Eksplorujemy AI" lub listowanie pilotów jako produkcji.'
      },
      {
        text: 'Co jest największą barierą w przyspieszeniu transformacji cyfrowej? Gdybyś mógł zmienić jedną rzecz z dnia na dzień, co by to było?',
        desc: 'Pytanie o nieograniczone życzenie ujawnia postrzegane główne ograniczenie. Porównaj z dowodami z innych pytań. Typowe bariery: legacy systemy (40%), kultura (25%), talent (20%), budżet (15%).',
        evidence: 'Słuchaj spójności między tą odpowiedzią a dowodami z poprzednich pytań. Jeśli mówią "budżet" ale wcześniej opisali niedoobsadzone zatwierdzone programy, prawdziwą barierą jest talent.',
        shape: 'Konkretna bariera z uzasadnieniem połączonym z dowodami. Słabe: "Potrzebujemy więcej budżetu" lub ogólnikowy "management musi zrozumieć cyfryzację."'
      }
    ]
  },
  {
    id: 'lib-tpl-data-001__vts',
    name: 'Ocena Gotowości Danych i Analityki',
    description: 'Diagnostyka dojrzałości danych organizacji w zakresie governance, architektury, jakości, zdolności analitycznych i gotowości do AI. Mapuje stan obecny na 5-poziomowy model dojrzałości dla identyfikacji ścieżki krytycznej od zbierania danych do podejmowania decyzji opartych na danych.',
    category: 'DATA',
    questions: [
      {
        text: 'Narysuj mi mapę Waszego krajobrazu danych. Jakie są główne źródła, gdzie żyją, kto jest właścicielem? Bądź szczery o szarych strefach, gdzie dane żyją w Excelach lub w głowach ludzi.',
        desc: 'Mapowanie krajobrazu danych ujawnia rzeczywistość vs. oficjalną architekturę. Najważniejsze ustalenie to zwykle "shadow IT" — arkusze i osobiste bazy danych obsługujące krytyczne procesy. W większości organizacji 30-40% danych krytycznych żyje poza zarządzanymi systemami.',
        evidence: 'Poproś o: diagram architektury danych, inwentarz systemów, katalog danych jeśli istnieje. Potem zapytaj: "Jakie krytyczne dane żyją w Excelach, a powinny być w systemie?" — to konsekwentnie surfacuje najważniejsze luki.',
        shape: 'Uczciwy krajobraz włączając shadow data. Dobre: nazwane systemy plus uznane shadow data z konkretnymi przykładami. Słabe: czysta lista systemów bez przyznania się do niezarządzanych danych.'
      },
      {
        text: 'Opowiedz o Waszym governance danych. Kto decyduje, co dane oznaczają (własność semantyczna), kto odpowiada za jakość, i co się dzieje, gdy dwa systemy nie zgadzają się co do tej samej metryki?',
        desc: 'Dojrzałość governance to najlepszy predyktor sukcesu analityki. Pytanie "co gdy systemy się nie zgadzają" jest ujawniające — większość organizacji odkrywa sprzeczne definicje podczas raportowania, nie governance.',
        evidence: 'Poproś o: charter governance danych, słownik danych, rejestr stewardów. Poproś o konkretny ostatni przykład konfliktu definicji — jak odkryty i rozwiązany?',
        shape: 'Framework governance z przykładem rozwiązania konfliktu. Dobre: nazwani stewardzi, opublikowany słownik, udokumentowane rozwiązanie konfliktu. Słabe: "IT zarządza jakością danych."'
      },
      {
        text: 'Oceń jakość danych 1-5 dla każdego: kompletność, dokładność, terminowość i spójność między systemami. Podaj konkretny przykład wpływu biznesowego dla każdego problemu.',
        desc: 'Czterowymiarowa ocena jakości. Większość organizacji ocenia się 3-4 początkowo, ale spada do 2-3, gdy poprosimy o przykłady. Przykłady ujawniają, które wymiary faktycznie wpływają na decyzje biznesowe.',
        evidence: 'Dla każdego wymiaru poproś o wpływ biznesowy. Kompletność: "Ile rekordów klientów ma brakujące pola?" Dokładność: "Kiedy ostatnio raport miał złe liczby?" Terminowość: "Jak stare są Wasze dane o zapasach?" Spójność: "Ten sam klient, różne przychody w CRM vs. ERP?"',
        shape: 'Cztery oddzielne oceny z przykładami wpływu i szacowanymi kosztami. Dobre odpowiedzi zawierają kwantyfikację wpływu biznesowego.'
      },
      {
        text: 'Jaki jest Wasz stos analityczny? Przeprowadź mnie od surowych danych do insightów — ETL/ELT, hurtownia, narzędzia BI — i ilu ludzi może z tego korzystać bez pomocy IT.',
        desc: 'Stos technologiczny analityki determinuje sufit możliwości. Kluczowy wskaźnik: adopcja self-service (% użytkowników biznesowych mogących samodzielnie tworzyć analizy).',
        evidence: 'Poproś o: diagram architektury analitycznej, inwentarz narzędzi z liczbą licencji i aktywnych użytkowników. Zapytaj: "Ilu ludzi może odpowiedzieć na nowe pytanie biznesowe z danych bez zgłaszania ticketu?"',
        shape: 'Pełny opis pipeline z metryką self-service. Dobre: nazwane narzędzia w sekwencji z liczbą użytkowników i świadomością bottlenecka. Słabe: "Używamy Power BI" bez wiedzy o pipeline.'
      },
      {
        text: 'Jaki talent analityczny macie — bądź szczery co do luki. Ilu ludzi potrafi robić analizę eksploracyjną, budować modele statystyczne i wdrażać ML produkcyjnie?',
        desc: 'Rozróżnij trzy poziomy: analitycy (eksploracja danych, raporty), data scientists (budowanie modeli), ML engineers (wdrażanie do produkcji). Większość średnich organizacji ma dość analityków, ale zero lub 1-2 data scientists.',
        evidence: 'Poproś o: strukturę zespołu analitycznego, opisy stanowisk, otwarte rekrutacje. Zapytaj: "Gdybym dał problem predykcyjny dziś, kto by nad nim pracował i ile by to trwało?"',
        shape: 'Uczciwa ocena luki wg poziomu umiejętności z kwantyfikowaną potrzebą. Dobre: rozkład na analityk/DS/MLE z obecną vs. potrzebną liczbą. Słabe: "Mamy zespół danych" bez różnicowania umiejętności.'
      },
      {
        text: 'Podaj 3 decyzje podejmowane dziś na danych i 3, które powinny być, ale nie są. Dla tych opartych na danych — jak ufasz danym pod spodem?',
        desc: 'Ujawnia rzeczywistą dojrzałość podejmowania decyzji na danych vs. aspiracje. Kategoria "powinny, ale nie są" ujawnia luki danych lub bariery kulturowe.',
        evidence: 'Dla decyzji na danych: jak często, kto decyduje, jakie źródło. Dla tych bez danych: jakie dane byłyby potrzebne, co blokuje (brak danych, brak zaufania, brak narzędzi, preferencja kulturowa dla intuicji).',
        shape: 'Sześć konkretnych przykładów. Dobre: nazwane decyzje z częstotliwością, poziomem zaufania i konkretnymi blockerami. Słabe: ogólnikowe stwierdzenia.'
      },
      {
        text: 'Jaki był najbardziej wartościowy projekt lub insight analityczny z ostatnich 12 miesięcy? Skwantyfikuj wpływ biznesowy i powiedz, jak go zweryfikowaliście.',
        desc: 'Udowodnione ROI z analityki to najsilniejszy wskaźnik kultury data-driven. Rygor kwantyfikacji ma znaczenie — czy wpływ był zmierzony czy oszacowany? Zweryfikowany przez finanse czy samo-raportowany?',
        evidence: 'Poproś o: dokumentację projektu, metodologię pomiaru wpływu, metryki before/after. Czy wpływ zweryfikowano z finansami?',
        shape: 'Konkretny projekt z zweryfikowanym wpływem. Dobre: nazwany projekt z kwotą, metodą pomiaru i walidacją finansową. Słabe: "Stworzyliśmy lepsze dashboardy" bez mierzalnego wpływu.'
      },
      {
        text: 'Jakie use case AI/ML macie w pipeline? Dla każdego: problem biznesowy, potrzebne dane, czy te dane istnieją dziś, i realistyczny timeline.',
        desc: 'Ocena pipeline AI. Luka między ambicją a gotowością danych to kluczowe ustalenie. Większość organizacji ma aspiracje AI 12-24 miesiące przed infrastrukturą danych.',
        evidence: 'Dla każdego use case stwórz scorecard gotowości: dostępność danych (%), jakość danych (1-5), gotowość talentowa, gotowość infrastrukturalna, sponsoring biznesowy.',
        shape: 'Pipeline z uczciwą oceną gotowości per use case. Dobre: nazwane use case z oceną gotowości danych i realistycznym timeline. Słabe: ogólnikowa lista życzeń AI.'
      },
      {
        text: 'Gdybyś miał naprawić jeden problem z jakością danych przed czymkolwiek innym, jaki by to był i jak byś go naprawił?',
        desc: 'Priorytetyzacja problemów jakości ujawnia, co naprawdę blokuje postęp. Proponowana naprawa pokazuje, czy organizacja myśli o jakości jako jednorazowym sprzątaniu (niedojrzałe) czy systemowej zmianie procesu (dojrzałe).',
        evidence: 'Słuchaj: analizy przyczyn źródłowych, systemowa vs. jednorazowa naprawa, szacowany wysiłek i wpływ. Jednorazowe czyszczenie bez zmiany procesu = luka dojrzałości.',
        shape: 'Konkretny problem z naprawą przyczyny źródłowej. Dobre: nazwany problem, przyczyna źródłowa, systemowe rozwiązanie, szacowany wysiłek. Słabe: "Musimy posprzątać dane" bez szczegółów.'
      },
      {
        text: 'Ile łącznie inwestujecie w dane i analitykę — ludzie, narzędzia, infrastruktura? Jak to się ma do branży i jak mierzycie ROI?',
        desc: 'Benchmarking inwestycji. Liderzy analityki inwestują 0,5-1,5% przychodów; średnia to 0,2-0,5%. Pomiar ROI pokazuje, czy analityka to inwestycja strategiczna czy centrum kosztów.',
        evidence: 'Poproś o: budżet zespołu analitycznego (headcount, narzędzia, infra, consulting). Zapytaj o benchmarking branżowy i raportowanie ROI do kierownictwa.',
        shape: 'Skwantyfikowana inwestycja z frameworkiem ROI. Dobre: kwoty, porównanie z branżą, udokumentowane ROI. Słabe: "Nie znam całkowitego budżetu" lub brak pomiaru ROI.'
      }
    ]
  },
  {
    id: 'lib-tpl-cost-001__vts',
    name: 'Przegląd Optymalizacji Kosztów',
    description: 'Systematyczna diagnostyka identyfikacji możliwości redukcji kosztów i poprawy efektywności w kosztach bezpośrednich, ogólnych, zamówieniach i marnotrawstwie procesowym. Typowe oszczędności: 8-15% adresowalnych wydatków w ciągu 12-18 miesięcy.',
    category: 'COST',
    questions: [
      {
        text: 'Rozłóż mi swoją całkowitą strukturę kosztów. Top 5 kategorii, procent całości i trend 3-letni dla każdej. Gdzie koszty rosną szybciej niż przychody?',
        desc: 'Mapowanie struktury kosztów z analizą trendów identyfikuje, gdzie koszty rosną najszybciej — tam są zwykle największe możliwości. Każda kategoria rosnąca szybciej niż przychody konsumuje marżę.',
        evidence: 'Poproś o: P&L z 3-letnim trendem wg kategorii kosztów, wskaźniki koszt/przychód. Jeśli możliwe, rozbij każdą kategorię dalej (np. praca = bezpośrednia + pośrednia + tymczasowa + nadgodziny).',
        shape: 'Szczegółowy rozkład z trendem. Dobre: nazwane kategorie z procentami, stopami wzrostu i porównaniem do przychodów. Słabe: "Materiały i praca to nasze największe koszty" bez danych.'
      },
      {
        text: 'Przeprowadź mnie przez proces zakupowy dla 3 największych kategorii wydatków. Jak negocjujecie, jak często robicie rebidding i jaki jest wskaźnik pokrycia kontraktami?',
        desc: 'Dojrzałość zamówień napędza 3-7% oszczędności w większości organizacji. Kluczowe wskaźniki: pokrycie kontraktami (best-in-class >85%), częstość rebiddingu, liczba dostawców per kategoria, TCO vs. cena jednostkowa.',
        evidence: 'Poproś o: analizę wydatków wg kategorii, liczbę dostawców, kalendarz wygasania kontraktów. Zapytaj o maverick spend (zakupy poza kontraktami) — typowy wyciek 10-25%.',
        shape: 'Szczegóły procesu z metrykami per kategoria. Dobre: nazwane kategorie z wydatkami, liczbą dostawców, pokryciem kontraktów, wskaźnikiem maverick. Słabe: "Dział zakupów się tym zajmuje."'
      },
      {
        text: 'Gdzie koszty pracy są konsumowane nieproduktywnie? Jaki jest procent nadgodzin, wskaźnik absencji i ile czasu ludzie spędzają na czynnościach niedodających wartości?',
        desc: 'Trzy dźwignie kosztów pracy: nadgodziny (objaw planowania/zdolności), absencja (objaw zaangażowania/obciążenia), czas bez wartości dodanej (spotkania, poprawki, czekanie, szukanie). 20-30% czasu pracy jest bez wartości dodanej w większości organizacji.',
        evidence: 'Poproś o: nadgodziny i koszty wg działów, trend absencji, wyniki badań czasu. Zapytaj: "Gdybyś śledził pracownika przez całą zmianę, jaki procent czasu byłby bezpośrednio produktywny?"',
        shape: 'Skwantyfikowane marnotrawstwo pracy z przyczynami źródłowymi. Dobre: wskaźnik nadgodzin z przyczyną, rozkład NVA wg typu aktywności. Słabe: "Nadgodziny są trochę za wysokie" bez danych.'
      },
      {
        text: 'Jak wygląda marnotrawstwo w Waszej operacji? Przeprowadź mnie przez: materiałowe, energetyczne, procesowe (poprawki, brak, zwroty) i informacyjne (podwójne wprowadzanie, raporty których nikt nie czyta).',
        desc: 'Kategorie marnotrawstwa Lean zastosowane do całego biznesu. Marnotrawstwo informacyjne (raporty których nikt nie czyta, podwójne wprowadzanie danych, ręczne uzgadnianie) to 5-10% kosztów ogólnych, ale rzadko mierzone.',
        evidence: 'Poproś o: raporty odpadów/braków, koszty poprawek, zużycie energii na jednostkę, listę regularnych raportów. Marnotrawstwo informacyjne: "Ile regularnych raportów produkuje Wasz zespół i kto czyta każdy z nich?"',
        shape: 'Marnotrawstwo skwantyfikowane wg kategorii z przykładami. Dobre: procenty i kwoty per typ marnotrawstwa. Słabe: "Mamy trochę odpadów" bez kwantyfikacji.'
      },
      {
        text: 'Które koszty ogólne rosły najbardziej w ciągu 3 lat? Czy możesz uzasadnić ten wzrost względem wzrostu biznesu?',
        desc: 'Pełzanie kosztów ogólnych to najczęstszy ukryty problem. Typowi winowajcy: koszty IT, compliance, warstwy middle managementu, subskrypcje software z <30% wykorzystaniem.',
        evidence: 'Poproś o: rozkład overheadów z 3-letnim trendem, wzrost headcount w funkcjach wspierających vs. operacjach. Zapytaj o subskrypcje software — większość organizacji płaci za narzędzia ledwo używane.',
        shape: 'Kategorie overheadów z uzasadnionym vs. nieuzasadnionym wzrostem. Dobre: nazwane kategorie ze stopami wzrostu i uczciwą oceną uzasadnienia. Słabe: "Koszty ogólne są pod kontrolą."'
      },
      {
        text: 'Jak śledzicie i zarządzacie kosztami energii? Jaki jest koszt na jednostkę produktu i jak się ma do Waszego najlepszego wyniku i benchmarków branżowych?',
        desc: 'Energia to 5-15% kosztu produkcyjnego. Szybkie wygrane (wycieki sprężonego powietrza, oświetlenie, HVAC) dają 10-15% oszczędności ze zwrotem poniżej 18 miesięcy.',
        evidence: 'Poproś o: rachunki za energię (12 mies.), wolumeny produkcji (ten sam okres). Zapytaj o sub-metering i najlepszy miesiąc efektywności. Zapytaj o znane źródła marnotrawstwa.',
        shape: 'Koszt na jednostkę z porównaniem benchmark. Dobre: metryka per-unit vs. benchmark i best-ever, ze znanymi źródłami marnotrawstwa i szacowanym payback. Słabe: "Koszty energii rosną."'
      },
      {
        text: 'Jakie inicjatywy oszczędnościowe były próbowane w ciągu 2 lat? Dla każdej: co obiecano, co dowieziono i czy oszczędności trafiły na P&L czy znikły?',
        desc: 'Diagnostyka trwałości oszczędności. Większość organizacji deklaruje znaczące oszczędności, które nigdy nie materializują się w P&L. Typowe awarie: oszczędności konsumowane przez wzrost wolumenów, budżety nie zredukowane, oszczędności skompensowane wzrostami gdzie indziej.',
        evidence: 'Poproś o: tracker oszczędności z obiecanymi vs. dowiezionymi kwotami. Zapytaj: "Czy możesz prześledzić te oszczędności do konkretnej linii P&L?" i "Czy budżety faktycznie zredukowano?"',
        shape: 'Uczciwa ocena przeszłości. Dobre: nazwane inicjatywy z kwotami obiecane vs. dowiezione vs. P&L-verified. Słabe: "Zaoszczędziliśmy 2M rok temu" bez weryfikacji.'
      },
      {
        text: 'Które procesy można zautomatyzować, żeby obniżyć koszty, i co Was blokuje? Podaj top 3 kandydatów z grubym business case.',
        desc: 'Analiza ROI automatyzacji. Bariera jest często bardziej interesująca niż możliwość — techniczna, finansowa czy opór organizacyjny? Każda wymaga innego podejścia.',
        evidence: 'Per kandydat: obecne roboczogodziny, wskaźnik błędów/poprawek, zidentyfikowane rozwiązanie?, szacowana inwestycja, roczne oszczędności, payback. Co zablokowało dotychczas?',
        shape: 'Trzy konkretne możliwości z business case. Dobre: nazwane procesy z godzinami, kosztem, rozwiązaniem, payback i konkretnym blockerem. Słabe: "Dużo rzeczy można zautomatyzować."'
      },
      {
        text: 'Jak działa Wasz proces decyzji make-vs-buy? Kiedy ostatnio poważnie rozważaliście outsourcing funkcji wewnętrznej lub insourcing czegoś kupowanego?',
        desc: 'Decyzje make-vs-buy są rzadko rewizytowane, zwykle oparte na nieaktualnych założeniach. Większość organizacji odkrywa, że 10-20% aktywności jest w złej kolumnie, gdy dokonają rzetelnej analizy.',
        evidence: 'Zapytaj o: ostatnią analizę make-vs-buy, zakres outsourcingu i koszty, insourcowane aktywności do ewentualnego outsourcingu. Czy TCO jest używane vs. porównanie cen jednostkowych?',
        shape: 'Ostatnia analiza z wynikiem. Dobre: konkretna analiza z kwantyfikowaną decyzją. Słabe: "Zawsze tak robiliśmy."'
      },
      {
        text: 'Gdybyś musiał obciąć koszty o 15% w 12 miesięcy bez istotnego wpływu na jakość lub zdolności, skąd wziąłbyś pieniądze? Bądź konkretny i podsumuj.',
        desc: 'Pytanie o wymuszone ograniczenie ujawnia rzeczywisty potencjał oszczędności. Ludzie wewnątrz struktury kosztów wiedzą, gdzie jest marnotrawstwo — potrzebują pozwolenia, żeby to powiedzieć.',
        evidence: 'Zmapuj każde źródło do linii P&L. Challenge redukcji ludzi: "Gdzie pójdzie praca?" Challenge oszczędności zakupowych: "Próbowaliście już?" To separuje nowe pomysły od recyklowanych.',
        shape: 'Konkretny plan oszczędności, który się sumuje. Dobre: nazwane źródła z kwotami sumującymi się do ~15%. Słabe: "Musielibyśmy przyjrzeć się wszystkiemu."'
      }
    ]
  },
  {
    id: 'lib-tpl-quick-001__vts',
    name: 'Szybka Diagnostyka Stakeholdera',
    description: 'Strukturalny 20-minutowy wywiad do szybkiego uchwycenia perspektywy interesariusza, odkrycia ukrytych dynamik i identyfikacji krytycznych ryzyk i decyzji. Zaprojektowany dla wczesnoetapowej diagnostyki projektów, gdy trzeba szybko zmapować krajobraz polityczny i strategiczny.',
    category: 'QUICK',
    questions: [
      {
        text: 'Pomóż mi zrozumieć Twoją rolę. Za co odpowiadasz, jakie decyzje możesz podejmować samodzielnie, a gdzie potrzebujesz uzgodnień z innymi?',
        desc: 'Wykracza poza tytuł do rzeczywistej władzy i wpływu. Luka między formalną odpowiedzialnością a faktyczną mocą decyzyjną ujawnia dynamiki organizacyjne.',
        evidence: 'Zanotuj formalną rolę vs. opisaną władzę. Sonda: "Jaką ostatnią znaczącą decyzję podjąłeś bez pytania kogokolwiek?" Jeśli nie mogą wymienić, mogą mieć mniej władzy niż sugeruje tytuł.',
        shape: 'Jasna odpowiedzialność z uczciwą oceną władzy. Dobre: nazwany zakres, konkretne limity decyzyjne, znane zależności. Słabe: "Zarządzam zakładem" bez jasności co do władzy.'
      },
      {
        text: 'W jednym zdaniu — co ta inicjatywa ma osiągnąć? A teraz powiedz, co Ty osobiście myślisz, że będzie realny wynik, i oceń pewność siebie 1-10.',
        desc: 'Luka między oficjalnym celem a osobistą prognozą jest niezwykle ujawniająca. Pewność poniżej 6 z dyplomatycznym oficjalnym oświadczeniem sygnalizuje ukryte obawy.',
        evidence: 'Zanotuj lukę między oficjalnym a osobistym poglądem. Jeśli znacząco się różnią, zbadaj dlaczego. Zapytaj: "Co musiałoby się zmienić, żeby Twoja pewność wzrosła z X do 8?"',
        shape: 'Oficjalne + szczery osobisty pogląd z pewnością. Dobre: zróżnicowane odpowiedzi z konkretnym wyjaśnieniem luki. Słabe: ta sama odpowiedź na obie lub wysoka pewność bez dowodów.'
      },
      {
        text: 'Wymień 3 osoby, których wsparcie jest absolutnie krytyczne dla sukcesu. I kto jest jedną osobą, która najprawdopodobniej będzie opierać się lub spowalniać — i dlaczego?',
        desc: 'Mapowanie władzy stakeholderów oczami insidera. Pytanie o "opierającego się" surfacuje dynamiki polityczne, których żaden dokument nie pokaże. "Dlaczego" za oporem często ujawnia uzasadnione obawy.',
        evidence: 'Zbuduj mentalną mapę stakeholderów: wspierający, blokujący, niezdecydowani. Dla opierającego: czy opór jest polityczny (ochrona terytorium), racjonalny (prawdziwe obawy) czy emocjonalny (strach przed zmianą)?',
        shape: 'Nazwane osoby z uzasadnieniem. Dobre: konkretne nazwiska z prognozami zachowań i uzasadnieniem. Słabe: "Wszyscy wspierają" lub odmowa wskazania potencjalnych opierających.'
      },
      {
        text: 'Co było próbowane wcześniej, co jest podobne? Co się stało i czego powinniśmy się nauczyć?',
        desc: 'Organizacyjna "blizna" po przeszłych porażkach dramatycznie wpływa na obecną inicjatywę. Jeśli podobna inicjatywa nie powiodła się 2 lata temu, wielu ludzi spodziewa się porażki niezależnie od różnic.',
        evidence: 'Zbadaj głęboko przeszłe porażki: co konkretnie poszło nie tak, kto był zaangażowany, jaka narracja się uformowała. Zapytaj: "Czy te same osoby są zaangażowane tym razem?" i "Czy ta inicjatywa ma już reputację?"',
        shape: 'Uczciwa historia z lekcjami. Dobre: konkretna przeszła inicjatywa z analizą porażki i implikacjami. Słabe: "Nic takiego nie było próbowane" (mało prawdopodobne w jakiejkolwiek organizacji).'
      },
      {
        text: 'Top 3 ryzyka, które mogą wykoleić tę inicjatywę. Dla każdego: prawdopodobieństwo (1-10), kiedy uderzy, i co byś zrobił.',
        desc: 'Ocena jakości ryzyk. Dojrzali operatorzy identyfikują konkretne, actionable ryzyka z timingiem. Niedojrzali dają generyczne. Jakość mitygacji pokazuje głębokość myślenia o egzekucji.',
        evidence: 'Nalegaj na konkretność: "Jakie konkretnie zasoby? Kiedy ograniczenie uderzy?" Zmapuj ryzyka na timeline, żeby zrozumieć kiedy inicjatywa jest najbardziej wrażliwa.',
        shape: 'Konkretne ryzyka z timingiem i mitygacją. Dobre: nazwane ryzyka z prawdopodobieństwem, timeline i actionable mitygacją. Słabe: "Za mało budżetu, czasu, ludzi."'
      },
      {
        text: 'Do jakich informacji masz dostęp, których zespół projektowy prawdopodobnie nie ma? Jaki kontekst zmieniłby ich podejście?',
        desc: 'Pytanie o najwyższej wartości. Stakeholderzy mają kontekst — dynamiki polityczne, nadchodzące zmiany, osobiste agendy — które nigdy nie trafiają do dokumentacji projektowej.',
        evidence: 'Stwórz przestrzeń dla szczerości. Słuchaj: nadchodzące zmiany organizacyjne, presje budżetowe, konflikty interpersonalne, konkurujące inicjatywy.',
        shape: 'Insiderski kontekst zmieniający obraz. Dobre: konkretne nieudokumentowane czynniki (oczekujące decyzje, dynamiki polityczne, konflikty o zasoby). Słabe: "Myślę, że macie wszystko."'
      },
      {
        text: 'Jeśli to się uda — co zmienia się dla Ciebie osobiście? A jeśli nie uda — jakie są konsekwencje dla Ciebie?',
        desc: 'Osobiste stawki ujawniają motywację i dopasowanie. Rozbieżność między osobistymi incentywami a celami inicjatywy to krytyczny czynnik ryzyka.',
        evidence: 'Słuchaj dopasowania między incentywami a celami. Rozbieżność (np. "mój bonus jest od wolumenu, ale inicjatywa tymczasowo obniży produkcję") wymaga adresowania.',
        shape: 'Uczciwa ocena własnego interesu. Dobre: konkretne osobiste stawki z uczciwą oceną konsekwencji. Słabe: "Po prostu chcę, żeby firmie się udało" (zbyt dyplomatyczne).'
      },
      {
        text: 'Zostało 30 sekund. Co jest jedną rzeczą, którą chciałeś mi dziś powiedzieć, ale nie stworzyłem do tego otwarcia?',
        desc: 'Presja czasu plus pozwolenie tworzy szczerość. To pytanie konsekwentnie surfacuje najważniejszy insight z całego wywiadu. Sztuczne ograniczenie ("30 sekund") daje pozwolenie na pominięcie dyplomatycznych ram.',
        evidence: 'Cokolwiek powiedzą tutaj, to prawie zawsze najważniejsza rzecz z wywiadu. Zapisz dosłownie.',
        shape: 'Niefiltrowany insight. Nawet "Nie, chyba wszystko omówiliśmy" mówi coś o poziomie zaangażowania lub zaufania do procesu.'
      }
    ]
  }
];

(async () => {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('=== Rewriting Polish system templates ===\n');

  for (const t of templates) {
    await client.query(
      `UPDATE interview_library_templates SET name = $1, description = $2, updated_at = NOW() WHERE id = $3`,
      [t.name, t.description, t.id]
    );

    await client.query(`DELETE FROM interview_library_template_questions WHERE template_id = $1`, [t.id]);

    for (let i = 0; i < t.questions.length; i++) {
      const q = t.questions[i];
      const qId = `${t.id}__q${String(i + 1).padStart(2, '0')}`;
      await client.query(
        `INSERT INTO interview_library_template_questions
          (id, template_id, question_text, description, evidence_prompt, expected_answer_shape, sort_order, is_required, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())`,
        [qId, t.id, q.text, q.desc, q.evidence, q.shape, i + 1]
      );
    }
    console.log(`✓ ${t.name}: ${t.questions.length} questions`);
  }

  const stats = await client.query(`
    SELECT t.id, t.name, t.language, COUNT(q.id) as qc
    FROM interview_library_templates t
    LEFT JOIN interview_library_template_questions q ON q.template_id = t.id
    WHERE t.template_scope = 'system'
    GROUP BY t.id, t.name, t.language
    ORDER BY t.language, t.name
  `);
  console.log('\n=== System templates summary ===');
  stats.rows.forEach(r => console.log(`  [${r.language}] ${r.name}: ${r.qc} questions`));

  await client.end();
  console.log('\n✓ Done!');
})();
