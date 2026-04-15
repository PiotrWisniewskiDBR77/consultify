/**
 * VTS Questions Rewrite — adds description (hint) + evidence_prompt to all 70 VTS questions
 * and refines question_text where needed for richer, more diagnostic responses.
 *
 * Run: DOTENV_CONFIG_PATH=.env.local npx tsx server/scripts/rewrite-vts-questions.ts
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

interface QuestionUpdate {
  id: string;
  question_text: string;
  description: string;
  evidence_prompt: string;
  expected_answer_shape: string;
}

// ─── VTS HQ - wspólne (vts_hq_core_v1) ─────────────────────────────────
const hqCoreQuestions: QuestionUpdate[] = [
  {
    id: 'vts_hq_core_v1_q01',
    question_text: 'Jakie są 3 najważniejsze priorytety biznesowe VTS na najbliższe 12-24 miesiące i dlaczego właśnie teraz są kluczowe? Proszę opisać, co się zmieniło w otoczeniu rynkowym lub wewnątrz organizacji, że te priorytety wyszły na pierwszy plan.',
    description: 'Zależy nam na zrozumieniu, czy priorytety są jasno zdefiniowane i czy istnieje wspólne rozumienie kierunku w całym leadership teamie. Odpowiedź pomaga ocenić, na ile digitalizacja jest powiązana ze strategią, a nie jest osobnym projektem.',
    evidence_prompt: 'Podaj konkretne priorytety (np. wzrost eksportu o X%, redukcja lead time, wejście w nowy segment). Wskaż, czy istnieje dokument strategiczny, OKR, BSC lub inna forma formalizacji tych priorytetów.',
    expected_answer_shape: 'Lista 3 priorytetów z uzasadnieniem + informacja o formalizacji',
  },
  {
    id: 'vts_hq_core_v1_q02',
    question_text: 'Które procesy end-to-end pomiędzy funkcjami tworzą dziś największe tarcie dla wzrostu, marży lub szybkości działania organizacji? Proszę opisać konkretny przykład sytuacji, w której współpraca między działami nie działała tak, jak powinna.',
    description: 'Szukamy „szwów organizacyjnych" — miejsc, gdzie praca przechodzi z jednego zespołu do drugiego i traci tempo, jakość lub informację. To są najczęstsze kandydatury do digitalizacji i automatyzacji.',
    evidence_prompt: 'Opisz 1-2 konkretne procesy (np. order-to-delivery, complaint handling, new product introduction) i wskaż, co dokładnie nie działa: opóźnienia, błędy, brak danych, ręczne przekazywanie informacji.',
    expected_answer_shape: 'Opis 1-2 procesów z konkretnym opisem problemu na styku funkcji',
  },
  {
    id: 'vts_hq_core_v1_q03',
    question_text: 'W których miejscach decyzje lub ścieżki akceptacyjne najczęściej spowalniają organizację? Proszę podać przykład decyzji, która zajęła znacząco więcej czasu niż powinna, i opisać, co ją opóźniło.',
    description: 'Interesuje nas, czy wąskie gardła decyzyjne wynikają ze struktury (zbyt wiele poziomów akceptacji), kultury (unikanie ryzyka), braku danych, czy może z niejasnych kompetencji decyzyjnych.',
    evidence_prompt: 'Podaj konkretny przykład (np. akceptacja oferty specjalnej, zatwierdzenie inwestycji, zmiana w procesie). Ile trwała decyzja vs ile powinna trwać? Kto był zaangażowany? Co by przyspieszyło?',
    expected_answer_shape: 'Konkretny przykład z opisem ścieżki decyzyjnej i identyfikacją wąskiego gardła',
  },
  {
    id: 'vts_hq_core_v1_q04',
    question_text: 'Jakie działania w centrali nadal pochłaniają najwięcej pracy manualnej, mimo że powinny być prostsze albo bardziej standaryzowane? Proszę oszacować, ile czasu tygodniowo Twój zespół traci na takie zadania.',
    description: 'Szukamy „ukrytych fabryk" — powtarzalnych czynności, które ludzie wykonują ręcznie, bo brakuje narzędzia, integracji lub standardu. To są szybkie wygrane dla digitalizacji.',
    evidence_prompt: 'Wymień 2-3 konkretne czynności (np. ręczne tworzenie raportów z kilku źródeł, przepisywanie danych między systemami, ręczne śledzenie statusów). Oszacuj czas w godzinach/tydzień.',
    expected_answer_shape: 'Lista 2-3 czynności z szacunkiem czasu i opisem dlaczego są ręczne',
  },
  {
    id: 'vts_hq_core_v1_q05',
    question_text: 'Gdzie informacje są dziś duplikowane, przepisywane lub uzgadniane pomiędzy systemami, plikami i zespołami? Proszę opisać typową sytuację, w której ta sama informacja musi być wprowadzona lub sprawdzona w więcej niż jednym miejscu.',
    description: 'Duplikacja danych to symptom braku integracji systemów. Każde miejsce, gdzie dane są przepisywane ręcznie, to ryzyko błędu, opóźnienia i frustracji pracowników.',
    evidence_prompt: 'Podaj konkretne przykłady: jakie dane, między jakimi systemami/plikami, jak często, kto to robi. Np. „dane klienta z CRM przepisywane ręcznie do ERP przy każdym zamówieniu".',
    expected_answer_shape: 'Mapa duplikacji: jakie dane → skąd → dokąd → jak często → kto',
  },
  {
    id: 'vts_hq_core_v1_q06',
    question_text: 'Które decyzje biznesowe są dziś ograniczane przez brak danych, opóźnione dane albo niski poziom zaufania do danych? Proszę opisać sytuację, w której podjąłeś decyzję „na wyczucie" zamiast na podstawie twardych danych.',
    description: 'Celem jest zmapowanie luki między danymi, które organizacja ma, a danymi, które naprawdę potrzebuje do podejmowania lepszych decyzji. To jest fundament strategii data-driven.',
    evidence_prompt: 'Opisz 1-2 konkretne decyzje (np. prognoza sprzedaży, alokacja zasobów, priorytetyzacja inwestycji). Jakich danych brakowało? Skąd się brały dane zastępcze? Jak to wpłynęło na jakość decyzji?',
    expected_answer_shape: 'Opis 1-2 decyzji z identyfikacją brakujących danych i ich wpływu',
  },
  {
    id: 'vts_hq_core_v1_q07',
    question_text: 'Które 2-3 obszary biznesowe mają obecnie największy potencjał do automatyzacji lub wykorzystania AI? Proszę wyjaśnić, co sprawia, że akurat te obszary są najlepszymi kandydatami — czy to wolumen, powtarzalność, koszt błędu, czy coś innego?',
    description: 'Chcemy zrozumieć, gdzie liderzy widzą największą wartość z technologii — i czy ich intuicja pokrywa się z tym, co faktycznie wynika z analizy procesów.',
    evidence_prompt: 'Dla każdego obszaru podaj: jaki problem rozwiązałaby automatyzacja/AI, jaki jest obecny koszt (czas, ludzie, błędy), i dlaczego dotąd tego nie zrobiono.',
    expected_answer_shape: 'Lista 2-3 obszarów z uzasadnieniem i oceną gotowości',
  },
  {
    id: 'vts_hq_core_v1_q08',
    question_text: 'Jakie ograniczenia budżetowe, ryzyka, wymogi compliance lub cyberbezpieczeństwa musi uwzględniać każdy projekt digitalizacyjny w VTS? Proszę wskazać, które z tych ograniczeń w przeszłości zablokowały lub opóźniły konkretne inicjatywy.',
    description: 'Digitalizacja nie dzieje się w próżni. Musimy zrozumieć realne ograniczenia, żeby zaproponować rozwiązania, które mają szansę na wdrożenie, a nie tylko na prezentację.',
    evidence_prompt: 'Podaj przykłady: budżet roczny na IT/digitalizację (jeśli znany), regulacje branżowe (ISO, RODO), polityki bezpieczeństwa, wcześniej zablokowane projekty i powody blokady.',
    expected_answer_shape: 'Mapa ograniczeń + konkretne przykłady zablokowanych/opóźnionych inicjatyw',
  },
  {
    id: 'vts_hq_core_v1_q09',
    question_text: 'Jakie KPI powinny służyć do oceny, czy program digitalizacji VTS rzeczywiście przynosi wartość? Proszę wskazać, które wskaźniki już istnieją i są mierzone, a które trzeba by dopiero stworzyć.',
    description: 'Bez jasnych mierników sukcesu, digitalizacja staje się „projektem wiecznym". Szukamy zarówno wskaźników operacyjnych (czas, koszt, błędy), jak i strategicznych (revenue impact, time-to-market).',
    evidence_prompt: 'Wymień 3-5 KPI, które Twoim zdaniem najlepiej pokażą wartość digitalizacji. Dla każdego: czy jest dziś mierzony, jaka jest baseline, jaki byłby target? Np. „OTD z 87% do 95%".',
    expected_answer_shape: 'Lista 3-5 KPI z informacją o mierzalności, baseline i target',
  },
  {
    id: 'vts_hq_core_v1_q10',
    question_text: 'Które decyzje lub interakcje powinny pozostać przede wszystkim po stronie człowieka, nawet jeśli wdrożymy AI lub automatyzację? Proszę wyjaśnić, dlaczego w tych obszarach ludzki osąd jest niezastąpiony.',
    description: 'To pytanie pomaga nam zrozumieć kulturę organizacji i granice akceptacji dla technologii. Każda organizacja ma obszary, gdzie automatyzacja byłaby technicznie możliwa, ale kulturowo lub strategicznie niewskazana.',
    evidence_prompt: 'Podaj 2-3 konkretne przykłady decyzji/interakcji (np. relacje z kluczowymi klientami, decyzje o zwolnieniach, negocjacje strategiczne). Wyjaśnij, co sprawia, że czynnik ludzki jest tu kluczowy.',
    expected_answer_shape: 'Lista 2-3 obszarów z uzasadnieniem roli czynnika ludzkiego',
  },
];

// ─── VTS Sprzedaż (vts_sales_v1) ────────────────────────────────────────
const salesQuestions: QuestionUpdate[] = [
  {
    id: 'vts_sales_v1_q01',
    question_text: 'Proszę opisać główne etapy procesu od leada do zamówienia w VTS. Na których etapach szanse sprzedażowe najczęściej zwalniają lub zatrzymują się? Co się wtedy dzieje — kto interweniuje, jak długo trwa odblokowanie?',
    description: 'Mapujemy cały cykl sprzedażowy, żeby znaleźć miejsca, gdzie cyfrowe narzędzia mogą skrócić czas, poprawić konwersję lub zmniejszyć wysiłek handlowca.',
    evidence_prompt: 'Opisz etapy procesu (np. lead → kwalifikacja → oferta → negocjacja → zamówienie). Dla każdego etapu: szacunkowy czas trwania, kto odpowiada, jakie narzędzie jest używane. Wskaż 1-2 etapy, gdzie „grzęzną" szanse.',
    expected_answer_shape: 'Mapa procesu sprzedaży z czasami, rolami i identyfikacją wąskich gardeł',
  },
  {
    id: 'vts_sales_v1_q02',
    question_text: 'Które elementy ofertowania, kalkulacji ceny, akceptacji rabatów lub przygotowania przetargów są dziś najbardziej czasochłonne? Proszę opisać typowy przebieg od zapytania klienta do wysłania oferty — ile to trwa i co zajmuje najwięcej czasu.',
    description: 'Ofertowanie to często najdłuższy etap cyklu sprzedaży w B2B. Szukamy konkretnych miejsc, gdzie automatyzacja kalkulacji, szablony ofert lub workflow akceptacji mogą dać szybkie rezultaty.',
    evidence_prompt: 'Podaj średni czas od zapytania do oferty. Ile osób jest zaangażowanych? Czy ceny są w systemie czy w Excelu? Ile razy średnio oferta wraca na korektę? Jaki % ofert wymaga niestandardowej akceptacji rabatu?',
    expected_answer_shape: 'Opis procesu ofertowania z czasami, narzędziami i częstotliwością korekt',
  },
  {
    id: 'vts_sales_v1_q03',
    question_text: 'Na ile dobrze współpracują dziś CRM, ERP, pliki pricingowe i pozostałe narzędzia komercyjne? Proszę opisać, jak wygląda typowy dzień handlowca pod kątem przełączania się między systemami i szukania informacji.',
    description: 'Fragmentacja narzędzi to jedna z głównych przyczyn niskiej produktywności w sprzedaży. Chcemy zrozumieć, ile czasu handlowiec traci na „administrację" vs faktyczną sprzedaż.',
    evidence_prompt: 'Wymień systemy/narzędzia używane w sprzedaży (CRM, ERP, Excel, e-mail, SharePoint itp.). Które dane trzeba ręcznie przenosić? Gdzie handlowiec musi logować się do kilku systemów, żeby odpowiedzieć na pytanie klienta?',
    expected_answer_shape: 'Lista narzędzi + mapa integracji (co jest połączone, co nie) + szacunek czasu na administrację',
  },
  {
    id: 'vts_sales_v1_q04',
    question_text: 'Jak dokładna jest obecna prognoza sprzedaży (forecast) i co najczęściej powoduje największe odchylenia względem wyniku rzeczywistego? Proszę podać przykład kwartału, w którym prognoza mocno się rozminęła z realizacją.',
    description: 'Dokładność forecastu to kluczowy wskaźnik dojrzałości procesu sprzedaży. Niska dokładność często wynika z braku danych w pipeline, subiektywnych ocen szans lub braku dyscypliny aktualizacji.',
    evidence_prompt: 'Podaj typowe odchylenie forecastu (np. ±20%). Jak jest tworzony — w CRM, w Excelu, w głowach handlowców? Jak często jest aktualizowany? Co najczęściej powoduje „niespodzianki" — utracone szanse, przesunięcia, nowi klienci?',
    expected_answer_shape: 'Dokładność forecastu + metoda tworzenia + główne źródła odchyleń',
  },
  {
    id: 'vts_sales_v1_q05',
    question_text: 'Które powtarzalne zadania handlowe lub zapytania klientów są na tyle standardowe, że można je zautomatyzować albo mocno uprościć? Proszę opisać czynności, które handlowcy wykonują rutynowo i które zabierają czas od faktycznej sprzedaży.',
    description: 'W każdym zespole sprzedaży istnieje „ukryty overhead" — czynności, które nie generują wartości, ale pochłaniają czas. To idealni kandydaci do automatyzacji.',
    evidence_prompt: 'Wymień 3-5 powtarzalnych czynności (np. statusy zamówień dla klientów, przygotowanie raportów, uzupełnianie CRM, odpowiadanie na FAQ klientów). Ile czasu zajmują tygodniowo?',
    expected_answer_shape: 'Lista powtarzalnych zadań z szacunkiem czasochłonności i oceną potencjału automatyzacji',
  },
  {
    id: 'vts_sales_v1_q06',
    question_text: 'Gdzie zespoły sprzedaży tracą dziś najwięcej czasu na szukanie informacji o produktach, cenach, terminach dostaw lub historii klienta zamiast na faktyczną sprzedaż? Proszę opisać typową sytuację „polowania na informację".',
    description: 'Czas spędzony na szukaniu informacji to bezpośrednia strata produktywności sprzedaży. Chcemy zmapować, jakich danych brakuje „pod ręką" i gdzie trzeba ich szukać.',
    evidence_prompt: 'Opisz typowe pytanie klienta, na które handlowiec nie może szybko odpowiedzieć. Gdzie szuka odpowiedzi (dzwoni, pisze maile, szuka w systemach)? Ile to trwa? Jak często to się powtarza?',
    expected_answer_shape: 'Opis 2-3 typowych sytuacji z identyfikacją brakujących informacji i źródeł opóźnień',
  },
  {
    id: 'vts_sales_v1_q07',
    question_text: 'Które przekazania (handoffy) pomiędzy sprzedażą a innymi zespołami — marketingiem, logistyką, finansami, jakością lub R&D — powodują najwięcej tarcia, poprawek lub nieporozumień? Proszę podać konkretny przykład.',
    description: 'Handoffy między funkcjami to miejsca, gdzie informacja się gubi, powstają opóźnienia i rodzi się frustracja. Każdy taki punkt to potencjalny obszar do usprawnienia cyfrowego.',
    evidence_prompt: 'Opisz 1-2 konkretne sytuacje (np. lead z marketingu bez kwalifikacji, zamówienie z błędnymi danymi logistycznymi, reklamacja bez informacji od jakości). Co poszło nie tak? Jak to wpłynęło na klienta?',
    expected_answer_shape: 'Opis 1-2 handoffów z analizą przyczyn i skutków',
  },
  {
    id: 'vts_sales_v1_q08',
    question_text: 'Które zastosowania AI mogłyby najbardziej poprawić skuteczność sprzedaży (win rate), szybkość działania, dyscyplinę cenową lub pokrycie klientów? Proszę wskazać, gdzie dziś „inteligencja ludzka" nie wystarczy lub jest zbyt wolna.',
    description: 'Pytamy nie o technologię, ale o problemy, które technologia mogłaby rozwiązać. Chcemy zrozumieć, gdzie dane i analityka mogą dać przewagę, której dziś nie ma.',
    evidence_prompt: 'Podaj 2-3 sytuacje, gdzie lepsze dane lub predykcje poprawiłyby wynik (np. scoring leadów, rekomendacja next-best-action, automatyczne alerty o ryzyku utraty klienta, dynamiczny pricing).',
    expected_answer_shape: 'Lista 2-3 use case\'ów AI z opisem problemu i oczekiwanego wpływu',
  },
  {
    id: 'vts_sales_v1_q09',
    question_text: 'Gdzie dziś ucieka marża komercyjna? Proszę wskazać konkretne źródła erozji marży — czy to przez rabaty, poprawki, ekspresowe realizacje, reklamacje, błędy w zamówieniach, czy inne czynniki.',
    description: 'Erozja marży to często problem rozproszony — każdy pojedynczy przypadek wydaje się mały, ale suma jest znacząca. Mapujemy te źródła, żeby znaleźć systemowe rozwiązania.',
    evidence_prompt: 'Oszacuj, jaki % marży „ucieka" i przez jakie kanały. Podaj przykłady: średni dodatkowy rabat, koszt ekspresowych dostaw, koszt reklamacji, koszt poprawek zamówień. Czy te dane są dziś mierzone?',
    expected_answer_shape: 'Mapa erozji marży z szacunkami procentowymi/kwotowymi i informacją o mierzalności',
  },
  {
    id: 'vts_sales_v1_q10',
    question_text: 'Gdyby można było przebudować tylko jeden fragment procesu sprzedaży, który obszar wybralibyście jako pierwszy i jaki efekt biznesowy powinien z tego wyniknąć? Proszę uzasadnić wybór.',
    description: 'To pytanie zmusza do priorytetyzacji. Odpowiedź pokazuje, co liderzy sprzedaży uważają za najważniejszy problem — i czy jest to zgodne z tym, co wynika z pozostałych odpowiedzi.',
    evidence_prompt: 'Podaj konkretny obszar (np. ofertowanie, forecast, onboarding klienta, zarządzanie pipeline). Opisz oczekiwany efekt (np. „skrócenie czasu ofertowania z 5 dni do 1 dnia", „poprawa win rate o 10pp"). Dlaczego właśnie ten obszar?',
    expected_answer_shape: 'Jeden wybrany obszar z uzasadnieniem i mierzalnym oczekiwanym efektem',
  },
];

// ─── VTS Logistyka i Łańcuch Dostaw (vts_logistics_v1) ────────────────
const logisticsQuestions: QuestionUpdate[] = [
  {
    id: 'vts_logistics_v1_q01',
    question_text: 'Proszę opisać główne etapy procesu od planu produkcji do dostawy do klienta. W których miejscach najczęściej pojawiają się opóźnienia i co je powoduje — wewnętrzne problemy, dostawcy, transport, dokumentacja?',
    description: 'Mapujemy cały łańcuch dostaw, żeby zidentyfikować „wąskie gardła przepływu" — miejsca, gdzie towar, informacja lub decyzja się zatrzymuje. To fundament dla optymalizacji logistycznej.',
    evidence_prompt: 'Opisz główne etapy z szacunkowymi czasami (np. planowanie → magazynowanie → kompletacja → załadunek → transport → dostawa). Wskaż etapy z największymi opóźnieniami i ich typowe przyczyny. Podaj przykładowy lead time end-to-end.',
    expected_answer_shape: 'Mapa procesu z czasami etapów + identyfikacja 2-3 głównych opóźnień',
  },
  {
    id: 'vts_logistics_v1_q02',
    question_text: 'Na ile wiarygodna jest dziś widoczność zapasów, dostępności, statusu wysyłek i priorytetów zamówień na poziomie centrali? Proszę opisać, jak często informacje w systemie odbiegają od rzeczywistości i jakie to ma konsekwencje.',
    description: 'Widoczność danych (visibility) to fundament efektywnej logistyki. Bez wiarygodnych danych w czasie rzeczywistym, decyzje są reaktywne zamiast proaktywnych.',
    evidence_prompt: 'Podaj przykłady rozbieżności (np. stan magazynowy w systemie vs fizyczny, status wysyłki vs rzeczywista lokalizacja). Jak często się to zdarza? Jakie decyzje są przez to utrudnione? Czy jest jeden „single source of truth"?',
    expected_answer_shape: 'Ocena wiarygodności danych z konkretnymi przykładami rozbieżności i ich wpływu',
  },
  {
    id: 'vts_logistics_v1_q03',
    question_text: 'Które wyjątki powodują dziś najwięcej „gaszenia pożarów" w logistyce — braki materiałowe, zmiany transportowe, problemy celne, brak dokumentów, pilne zamówienia? Proszę opisać typowy „dzień kryzysowy" i co go wywołuje.',
    description: 'Wyjątki (exceptions) pochłaniają nieproporcjonalnie dużo czasu i zasobów. Chcemy zrozumieć, które z nich są systemowe (powtarzają się regularnie) vs losowe.',
    evidence_prompt: 'Wymień 3-5 najczęstszych typów wyjątków. Jak często się zdarzają (dziennie, tygodniowo)? Ile czasu zajmuje ich obsługa? Kto jest zaangażowany? Czy istnieją procedury, czy to ad-hoc?',
    expected_answer_shape: 'Katalog wyjątków z częstotliwością, czasem obsługi i oceną systemowości',
  },
  {
    id: 'vts_logistics_v1_q04',
    question_text: 'Które działania związane z planowaniem, przeplanowaniem lub koordynacją logistyczną są nadal obsługiwane głównie przez Excel, e-mail lub telefon? Proszę opisać, dlaczego te narzędzia przetrwały mimo istnienia systemów.',
    description: 'Excel i e-mail w logistyce to sygnał, że formalne systemy nie pokrywają rzeczywistych potrzeb. Chcemy zrozumieć lukę między tym, co systemy oferują, a tym, czego ludzie naprawdę potrzebują.',
    evidence_prompt: 'Wymień konkretne procesy/czynności prowadzone w Excel/e-mail (np. planowanie transportu, koordynacja z przewoźnikami, śledzenie wyjątków). Dlaczego system ERP/WMS nie wystarczył? Ile osób korzysta z tych „cieni IT"?',
    expected_answer_shape: 'Lista procesów na Excel/e-mail z wyjaśnieniem dlaczego i oceną ryzyka',
  },
  {
    id: 'vts_logistics_v1_q05',
    question_text: 'W których miejscach koszty logistyczne rosną najbardziej — premium freight, niskie wykorzystanie transportu, nadmierne zapasy buforowe, ekspresowe działania? Proszę oszacować skalę problemu.',
    description: 'Identyfikujemy główne drivery kosztów logistycznych, żeby wskazać, gdzie digitalizacja może dać mierzalny efekt finansowy.',
    evidence_prompt: 'Podaj szacunkowe wartości lub proporcje (np. „30% wysyłek to premium freight", „zapas buforowy = X tygodni vs target Y tygodni"). Wskaż trend — czy koszty rosną? Jakie są główne przyczyny?',
    expected_answer_shape: 'Identyfikacja 2-3 głównych driverów kosztów z szacunkami i trendami',
  },
  {
    id: 'vts_logistics_v1_q06',
    question_text: 'Na ile dobrze łączą się dziś ERP, WMS, narzędzia transportowe (TMS) i dane od przewoźników? Gdzie występują największe przerwy w przepływie danych i jakie to ma praktyczne konsekwencje?',
    description: 'Integracja systemów logistycznych to warunek automatyzacji i widoczności. Każda „przerwa" w danych wymusza ręczną interwencję i rodzi ryzyko błędu.',
    evidence_prompt: 'Opisz architekturę systemów logistycznych (jakie systemy, jak połączone, co ręczne). Wskaż 2-3 miejsca, gdzie dane nie przepływają automatycznie. Jakie to rodzi problemy (np. ręczne wpisy, opóźniona informacja, błędy)?',
    expected_answer_shape: 'Mapa integracji systemów logistycznych + lista „przerw" z konsekwencjami',
  },
  {
    id: 'vts_logistics_v1_q07',
    question_text: 'Które przekazania (handoffy) pomiędzy logistyką a sprzedażą, zakupami, jakością lub obsługą klienta powodują najwięcej poprawek albo niejasności? Proszę podać konkretny, ostatni przykład takiej sytuacji.',
    description: 'Handoffy między logistyką a innymi funkcjami to częste źródło błędów — niepełne informacje o zamówieniu, zmienione priorytety, brak komunikacji o problemach jakościowych.',
    evidence_prompt: 'Opisz 1-2 konkretne sytuacje z ostatnich miesięcy (np. zamówienie z błędnymi danymi od sprzedaży, problem z jakością wykryty dopiero przy pakowaniu, zmiana priorytetu bez powiadomienia logistyki). Jaki był skutek?',
    expected_answer_shape: 'Opis 1-2 handoffów z analizą przyczyny i skutku + sugestia usprawnienia',
  },
  {
    id: 'vts_logistics_v1_q08',
    question_text: 'Które procesy logistyczne najlepiej nadają się dziś do automatyzacji workflow, planowania wspieranego AI lub inteligentnego zarządzania wyjątkami? Proszę wskazać, gdzie zysk byłby największy.',
    description: 'Szukamy „quick wins" — procesów, które są powtarzalne, oparte na regułach i mają wystarczające dane, żeby automatyzacja lub AI mogły szybko przynieść wartość.',
    evidence_prompt: 'Podaj 2-3 procesy (np. automatyczny rerouting przy opóźnieniu, predykcja zapotrzebowania na transport, automatyczne alerty o ryzyku braku materiału). Dla każdego: jakie dane są dostępne, jaki byłby efekt.',
    expected_answer_shape: 'Lista 2-3 procesów do automatyzacji z oceną danych, gotowości i oczekiwanego efektu',
  },
  {
    id: 'vts_logistics_v1_q09',
    question_text: 'Które KPI najlepiej opisują dziś efektywność logistyki w VTS i gdzie luki względem celu są największe? Proszę podać konkretne wartości i targety.',
    description: 'KPI logistyczne to „kompas" dla optymalizacji. Chcemy zrozumieć, co jest mierzone, co nie jest mierzone (a powinno), i gdzie wyniki odbiegają od oczekiwań.',
    evidence_prompt: 'Wymień 3-5 głównych KPI (np. OTD, inventory turnover, fill rate, cost per shipment, warehouse utilization). Podaj aktualne wartości i targety. Wskaż, które KPI nie są dziś mierzone, a powinny.',
    expected_answer_shape: 'Tabela KPI: wskaźnik → aktualna wartość → target → trend → czy mierzony automatycznie',
  },
  {
    id: 'vts_logistics_v1_q10',
    question_text: 'Jaka jedna zdolność cyfrowa dałaby dziś największą poprawę szybkości reakcji i przewidywalności w logistyce VTS? Proszę opisać, jak wyglądałoby „życie po zmianie" w porównaniu z obecnym stanem.',
    description: 'To pytanie wymusza priorytetyzację i wizję przyszłości. Odpowiedź pomaga zrozumieć, co jest dla logistyki najważniejsze — i jak ambitna jest wizja.',
    evidence_prompt: 'Opisz jedną zdolność (np. real-time visibility, predictive planning, automated exception management). Porównaj „dziś" vs „docelowo" w kategoriach: czas reakcji, ilość ręcznej pracy, jakość decyzji, wpływ na klienta.',
    expected_answer_shape: 'Opis jednej zdolności z porównaniem before/after i mierzalnym efektem',
  },
];

// ─── VTS Produkcja i Jakość - centrala (vts_production_quality_v1) ─────
const productionQualityQuestions: QuestionUpdate[] = [
  {
    id: 'vts_production_quality_v1_q01',
    question_text: 'Które problemy produkcyjne lub jakościowe najczęściej wracają między zakładami i mają największy wpływ na terminowość, koszty lub jakość końcową? Proszę podać 2-3 konkretne przykłady z ostatnich miesięcy.',
    description: 'Szukamy problemów „systemowych" — takich, które pojawiają się w wielu lokalizacjach jednocześnie. To sygnał, że przyczyna leży w procesie, standardzie lub systemie, a nie w konkretnym zakładzie.',
    evidence_prompt: 'Opisz 2-3 powtarzające się problemy (np. odchylenia wymiarowe, problemy z surowcem, awaryjność maszyn). Ile zakładów dotyczy? Jaki jest szacunkowy koszt (finansowy, czasowy)? Czy są wspólne root cause?',
    expected_answer_shape: 'Lista 2-3 problemów z częstotliwością, zasięgiem (ile zakładów), kosztem i statusem root cause',
  },
  {
    id: 'vts_production_quality_v1_q02',
    question_text: 'W których obszarach standardy operacyjne lub jakościowe są dziś niespójne pomiędzy lokalizacjami VTS? Proszę opisać, jak wygląda proces standaryzacji — czy istnieją wspólne procedury, czy każdy zakład pracuje po swojemu?',
    description: 'Niespójność standardów między zakładami to częsty problem w grupach wielozakładowych. Utrudnia benchmarking, transfer dobrych praktyk i zarządzanie jakością na poziomie grupy.',
    evidence_prompt: 'Podaj konkretne przykłady niespójności (np. różne definicje KPI, różne kryteria akceptacji, różne systemy raportowania). Czy istnieją globalne SOPy? Jak są wdrażane? Kto jest odpowiedzialny za standaryzację?',
    expected_answer_shape: 'Mapa niespójności z przykładami + opis procesu standaryzacji (lub jego braku)',
  },
  {
    id: 'vts_production_quality_v1_q03',
    question_text: 'Jakich danych produkcyjnych lub jakościowych na poziomie grupy dziś brakuje, są opóźnione albo są zbierane w zbyt manualny sposób? Proszę opisać, jak dziś wygląda raportowanie z zakładów do centrali.',
    description: 'Dane to fundament zarządzania grupą wielozakładową. Jeśli dane spływają z opóźnieniem, w różnych formatach lub wymagają ręcznej konsolidacji — zarządzanie operacyjne jest reaktywne zamiast proaktywnego.',
    evidence_prompt: 'Opisz proces raportowania: jakie dane, jak często, w jakim formacie (system/Excel/e-mail), ile czasu zajmuje konsolidacja. Wskaż dane, których w ogóle nie macie na poziomie grupy, a chcielibyście mieć.',
    expected_answer_shape: 'Opis procesu raportowania + lista brakujących/opóźnionych danych + szacunek czasu konsolidacji',
  },
  {
    id: 'vts_production_quality_v1_q04',
    question_text: 'Gdzie koszty złej jakości (CoQ), poprawek (rework), reklamacji lub niestabilności operacyjnej są dziś największe z perspektywy centrali? Proszę podać konkretne szacunki, jeśli są dostępne.',
    description: 'Cost of Quality to jeden z najlepszych wskaźników potencjału poprawy. Obejmuje koszty wewnętrzne (scrap, rework, przestoje) i zewnętrzne (reklamacje, zwroty, kary). Chcemy zmapować główne składniki.',
    evidence_prompt: 'Podaj szacunkowe dane: scrap rate (%), rework rate (%), liczba/koszt reklamacji miesięcznie, koszt nieplanowanych przestojów. Czy te koszty są dziś mierzone i raportowane systematycznie?',
    expected_answer_shape: 'Mapa CoQ z szacunkami + informacja o mierzalności i systemie raportowania',
  },
  {
    id: 'vts_production_quality_v1_q05',
    question_text: 'Jak wygląda dziś proces identyfikacji i zamykania root cause dla problemów jakościowych lub operacyjnych na poziomie międzyfunkcyjnym i międzyzakładowym? Proszę opisać krok po kroku, co się dzieje, gdy problem jest wykryty.',
    description: 'Skuteczna analiza przyczyn źródłowych wymaga danych, metodyki i współpracy międzyfunkcyjnej. Chcemy zrozumieć, czy organizacja ma dojrzały proces RCA, czy polega na ad-hoc analizach.',
    evidence_prompt: 'Opisz typowy przebieg RCA (Root Cause Analysis): kto inicjuje, jakie narzędzia/metody (8D, Ishikawa, 5Why), ile trwa zamknięcie, jak jest monitorowana skuteczność działań korygujących. Podaj przykład ostatniego dużego problemu.',
    expected_answer_shape: 'Opis procesu RCA krok po kroku + konkretny przykład + ocena skuteczności',
  },
  {
    id: 'vts_production_quality_v1_q06',
    question_text: 'Gdzie najczęściej pojawiają się luki w transferze wiedzy, wdrażaniu standardów lub odpowiedzialności między centralą a zakładami? Proszę opisać sytuację, w której standard centralny nie zadziałał na poziomie zakładu.',
    description: 'Transfer wiedzy w grupie wielozakładowej to jedno z najtrudniejszych wyzwań organizacyjnych. Chcemy zrozumieć bariery — techniczne, kulturowe, językowe, kompetencyjne.',
    evidence_prompt: 'Podaj 1-2 przykłady (np. standard wdrożony w jednym zakładzie, ale nie przyjęty w innym; lessons learned z jednego zakładu nieznane w pozostałych). Co było barierą? Jak próbowaliście to rozwiązać?',
    expected_answer_shape: 'Przykłady luk z analizą barier i dotychczasowych prób rozwiązania',
  },
  {
    id: 'vts_production_quality_v1_q07',
    question_text: 'Na ile silna jest dziś traceability produktowa oraz spójność definicji KPI produkcyjnych i jakościowych między lokalizacjami? Proszę opisać, czy możliwe jest szybkie porównanie wyników dwóch zakładów.',
    description: 'Traceability i spójne KPI to warunek efektywnego zarządzania grupą. Bez nich benchmarking jest niemożliwy, a „dobre praktyki" nie mają miernika, który potwierdza, że rzeczywiście są dobre.',
    evidence_prompt: 'Opisz: jak daleko sięga traceability (surowiec → produkt końcowy → klient?), w jakim systemie, ile jest ręczne. Czy KPI są zdefiniowane jednakowo we wszystkich zakładach? Czy istnieje wspólny dashboard?',
    expected_answer_shape: 'Opis traceability end-to-end + ocena spójności KPI + informacja o dashboardach',
  },
  {
    id: 'vts_production_quality_v1_q08',
    question_text: 'Które procesy w obszarze produkcji i jakości z perspektywy centrali najlepiej nadają się do automatyzacji, analityki predykcyjnej lub wsparcia AI? Proszę wskazać, gdzie dane już istnieją i gdzie zysk byłby najszybszy.',
    description: 'Szukamy procesów, które łączą trzy elementy: duży wolumen danych, powtarzalność decyzji i mierzalny koszt obecnego stanu. To są najlepsi kandydaci do szybkiej digitalizacji.',
    evidence_prompt: 'Podaj 2-3 procesy (np. predykcja jakości na podstawie parametrów procesu, automatyczne raportowanie KPI, wczesne ostrzeganie o ryzyku awarii). Jakie dane są dostępne? Jaki byłby efekt finansowy/operacyjny?',
    expected_answer_shape: 'Lista 2-3 procesów do AI/automatyzacji z oceną danych, gotowości i ROI',
  },
  {
    id: 'vts_production_quality_v1_q09',
    question_text: 'Które KPI najlepiej powinny odzwierciedlać skuteczność funkcji produkcji i jakości na poziomie grupy i gdzie dziś są największe luki między wynikiem a celem? Proszę podać konkretne wartości.',
    description: 'KPI grupy to narzędzie zarządzania strategicznego. Chcemy zrozumieć, czy obecne KPI rzeczywiście „mówią prawdę" o kondycji produkcji i jakości — i gdzie są ślepe punkty.',
    evidence_prompt: 'Wymień 3-5 KPI grupowych (np. OEE, scrap rate, OTD, CoQ, MTBF). Podaj aktualny poziom i target. Wskaż KPI, gdzie luka jest największa i dlaczego. Czy wszystkie zakłady raportują te same KPI w ten sam sposób?',
    expected_answer_shape: 'Tabela KPI grupowych: wskaźnik → wartość → target → luka → spójność raportowania',
  },
  {
    id: 'vts_production_quality_v1_q10',
    question_text: 'Jaka jedna zdolność cyfrowa najbardziej poprawiłaby stabilność operacyjną lub zarządzanie jakością na poziomie centrali w najbliższych 12 miesiącach? Proszę opisać, jak wyglądałby „świat po zmianie".',
    description: 'To pytanie wymusza wybór najważniejszej zmiany. Odpowiedź pokazuje, co centrala uważa za swoje najsłabsze ogniwo — i jak ambitna jest wizja poprawy.',
    evidence_prompt: 'Opisz jedną zdolność (np. real-time quality dashboard, automated root cause analysis, predictive maintenance). Porównaj „dziś" vs „docelowo": jaki problem rozwiązuje, ile czasu/kosztów oszczędza, jaki wpływ na klienta.',
    expected_answer_shape: 'Opis jednej zdolności z porównaniem before/after i mierzalnym efektem',
  },
];

// ─── VTS B+R (vts_rnd_v1) ──────────────────────────────────────────────
const rndQuestions: QuestionUpdate[] = [
  {
    id: 'vts_rnd_v1_q01',
    question_text: 'Jakie są najważniejsze priorytety R&D na najbliższe 12-24 miesiące i w jaki sposób wspierają strategię biznesową VTS? Proszę opisać, jak te priorytety są komunikowane zespołowi i jak mierzony jest postęp.',
    description: 'Chcemy zrozumieć, na ile R&D jest strategicznie ukierunkowane — czy priorytety wynikają z potrzeb rynku i strategii firmy, czy raczej z bieżących zleceń. To fundament oceny dojrzałości funkcji R&D.',
    evidence_prompt: 'Podaj 3-5 kluczowych priorytetów R&D. Dla każdego: jak powiązany jest ze strategią VTS, kto jest sponsorem biznesowym, jakie są milestone i KPI postępu. Czy istnieje road map produktowa?',
    expected_answer_shape: 'Lista priorytetów R&D z powiązaniem do strategii + informacja o road mapie i KPI',
  },
  {
    id: 'vts_rnd_v1_q02',
    question_text: 'Na którym etapie ścieżki od pomysłu, wymagania lub requestu do wdrożonego rozwiązania pojawia się dziś największe opóźnienie? Proszę opisać konkretny, ostatni przykład projektu, który utknął — co go zatrzymało i ile czasu stracono.',
    description: 'Mapujemy „flow R&D" — od inicjacji do deliverable. Każde opóźnienie to koszt (time-to-market, zaangażowane zasoby, utracone przychody). Szukamy systemowych przyczyn opóźnień.',
    evidence_prompt: 'Opisz etapy procesu R&D (np. request → feasibility → design → prototyp → walidacja → release). Wskaż etap z największym opóźnieniem. Podaj przykład projektu z ostatnich 6 miesięcy — planowany vs rzeczywisty czas, przyczyna opóźnienia.',
    expected_answer_shape: 'Mapa procesu R&D z etapami + identyfikacja wąskich gardeł + konkretny przykład',
  },
  {
    id: 'vts_rnd_v1_q03',
    question_text: 'Jakie typy reworku pojawiają się w R&D najczęściej — zmiany wymagań, niepełne wejścia, redesign, nieudana walidacja? Proszę oszacować, jaki procent czasu inżynierów idzie na rework vs nowa praca.',
    description: 'Rework w R&D to nie tylko strata czasu — to demotywacja zespołu i opóźnienie time-to-market. Chcemy zrozumieć główne źródła reworku, żeby zaproponować systemowe rozwiązania.',
    evidence_prompt: 'Wymień 3-4 główne źródła reworku z szacunkową częstotliwością. Oszacuj % czasu inżynierów na rework (np. 20-30%). Podaj przykład projektu, który wymagał znaczącego reworku — co poszło nie tak?',
    expected_answer_shape: 'Katalog źródeł reworku z szacunkami częstotliwości + % czasu na rework + przykład',
  },
  {
    id: 'vts_rnd_v1_q04',
    question_text: 'Na ile dobrze współpracują dziś PLM, CAD, ERP, dane testowe, narzędzia projektowe i repozytoria dokumentacji? Proszę opisać, jak wygląda typowe „szukanie informacji" przez inżyniera w trakcie projektu.',
    description: 'Fragmentacja narzędzi w R&D to typowy problem — inżynierowie tracą czas na przełączanie się między systemami, kopiowanie danych i szukanie aktualnych wersji. To bezpośrednio wpływa na produktywność.',
    evidence_prompt: 'Wymień systemy/narzędzia używane w R&D. Opisz typowy workflow inżyniera (np. szukanie specyfikacji → sprawdzenie historii zmian → dostęp do wyników testów). Które systemy nie są połączone? Ile czasu traci inżynier na szukanie informacji dziennie?',
    expected_answer_shape: 'Lista narzędzi R&D + mapa integracji + szacunek czasu straconego na szukanie informacji',
  },
  {
    id: 'vts_rnd_v1_q05',
    question_text: 'Gdzie inżynierowie tracą dziś za dużo czasu na szukanie wymagań, rysunków, norm, lessons learned lub wcześniejszych rozwiązań? Proszę opisać, jak jest dziś zorganizowana baza wiedzy R&D — czy istnieje jedno miejsce, czy informacje są rozproszone.',
    description: 'Wiedza w R&D to najcenniejszy zasób. Jeśli jest rozproszona w e-mailach, dyskach sieciowych i głowach ludzi — organizacja traci ją przy rotacji i nie jest w stanie jej reużytkować.',
    evidence_prompt: 'Opisz, gdzie przechowywane są kluczowe zasoby wiedzy (normy, rysunki, lessons learned, specyfikacje). Czy jest katalog/baza wiedzy? Jak inżynier szuka wcześniejszego rozwiązania podobnego problemu? Podaj przykład „zgubionej" wiedzy.',
    expected_answer_shape: 'Mapa źródeł wiedzy R&D + ocena dostępności + przykład problemu z dostępem do wiedzy',
  },
  {
    id: 'vts_rnd_v1_q06',
    question_text: 'Które przekazania (handoffy) pomiędzy R&D a sprzedażą, jakością, produkcją lub product managementem powodują najwięcej tarcia albo nieporozumień? Proszę podać konkretny przykład sytuacji, w której handoff zawiódł.',
    description: 'Handoffy z R&D to krytyczne punkty — niepełne specyfikacje, zmienione wymagania, brak informacji zwrotnej z produkcji. Każdy taki punkt to potencjalny obszar do usprawnienia procesu i narzędzi.',
    evidence_prompt: 'Opisz 1-2 sytuacje (np. projekt przekazany do produkcji z niekompletnymi specyfikacjami, zmiana wymagań od klienta niedostarczona do R&D, problem jakościowy bez feedback do designu). Co było skutkiem? Jak długo trwało rozwiązanie?',
    expected_answer_shape: 'Opis 1-2 handoffów z analizą przyczyn, skutków i pomysłem na poprawę',
  },
  {
    id: 'vts_rnd_v1_q07',
    question_text: 'Które działania związane z testami, walidacją, akceptacjami lub dokumentacją są dziś największym wąskim gardłem cyklu rozwoju produktu? Proszę opisać, ile czasu te etapy dodają do projektu i dlaczego są tak czasochłonne.',
    description: 'Testy i walidacja to często „ukryte" wąskie gardła — są niezbędne, ale ich czas trwania i zasobochłonność bywają nieproporcjonalne. Szukamy miejsc, gdzie automatyzacja lub lepsze planowanie mogą pomóc.',
    evidence_prompt: 'Wskaż najdłuższe etapy (testy fizyczne, walidacja kliencka, certyfikacja, dokumentacja). Ile trwają vs ile powinny? Co powoduje opóźnienia (sprzęt, zasoby, procedury, oczekiwanie na materiał)? Ile % czasu projektu to testy/walidacja?',
    expected_answer_shape: 'Identyfikacja wąskich gardeł z szacunkami czasowymi + analiza przyczyn opóźnień',
  },
  {
    id: 'vts_rnd_v1_q08',
    question_text: 'Jakich danych produktowych, klienckich, fieldowych lub regulacyjnych najbardziej dziś brakuje albo z których trudno korzystać przy podejmowaniu decyzji R&D? Proszę opisać decyzję, którą musieliście podjąć bez wystarczających danych.',
    description: 'R&D podejmuje decyzje z długoterminowymi konsekwencjami. Jeśli te decyzje opierają się na niepełnych danych — ryzyko reworku, chybionych produktów i marnowania zasobów jest wysokie.',
    evidence_prompt: 'Podaj 2-3 rodzaje brakujących danych (np. dane fieldowe z eksploatacji, feedback od końcowego użytkownika, dane o kosztach materiałów, wyniki benchmarków konkurencji). Opisz decyzję podjętą „w ciemno" i jej konsekwencje.',
    expected_answer_shape: 'Lista brakujących danych + konkretny przykład decyzji bez danych i jej skutku',
  },
  {
    id: 'vts_rnd_v1_q09',
    question_text: 'Które zastosowania AI mogłyby najbardziej poprawić produktywność inżynierów, reuse wiedzy, jakość projektu lub speed-to-market w VTS? Proszę wskazać, gdzie dziś jest największy „ból" — i czy macie dane, żeby AI mogło pomóc.',
    description: 'AI w R&D to nie science fiction — generatywne projektowanie, wyszukiwanie semantyczne w bazie wiedzy, predykcja wyników testów czy automatyzacja dokumentacji to realne zastosowania. Pytamy, gdzie są najlepsi kandydaci.',
    evidence_prompt: 'Podaj 2-3 use case\'y (np. automatyczne wyszukiwanie wcześniejszych rozwiązań, predykcja wyników walidacji, generowanie dokumentacji, optymalizacja parametrów procesu). Czy macie dane historyczne, które mogłyby „nakarmić" AI?',
    expected_answer_shape: 'Lista 2-3 use case\'ów AI z oceną dostępności danych i oczekiwanego wpływu',
  },
  {
    id: 'vts_rnd_v1_q10',
    question_text: 'Które mierniki powinny pokazywać, że digitalizacja w R&D rzeczywiście dostarcza wartość dla VTS? Proszę wskazać, które z nich są dziś mierzone, a które trzeba by dopiero zbudować.',
    description: 'Bez KPI dla digitalizacji R&D, trudno uzasadnić inwestycje i pokazać postęp. Szukamy zarówno wskaźników efektywności (czas, koszt), jak i innowacyjności (nowe produkty, reuse, time-to-market).',
    evidence_prompt: 'Zaproponuj 3-5 KPI (np. time-to-market, % reuse komponentów, koszt prototypowania, liczba iteracji do akceptacji, czas walidacji). Dla każdego: czy jest dziś mierzony, jaka jest wartość bazowa, jaki byłby rozsądny target?',
    expected_answer_shape: 'Lista 3-5 KPI z informacją o mierzalności, baseline i proponowanym target',
  },
];

// ─── VTS Marketing (vts_marketing_v1) ──────────────────────────────────
const marketingQuestions: QuestionUpdate[] = [
  {
    id: 'vts_marketing_v1_q01',
    question_text: 'Jakie najważniejsze rezultaty biznesowe marketing ma dostarczyć dla VTS w najbliższych 12 miesiącach? Proszę opisać, jak te cele są mierzone i jak powiązane są ze strategią firmy.',
    description: 'Chcemy zrozumieć, czy marketing ma jasno zdefiniowane, mierzalne cele — i czy są one powiązane z wynikami biznesowymi VTS (przychody, leady, brand awareness, retencja klientów).',
    evidence_prompt: 'Podaj 3-5 kluczowych celów marketingu (np. X leadów/kwartał, wzrost brand awareness o Y%, wejście na nowy rynek). Jak są mierzone? Kto jest odpowiedzialny? Jaki jest aktualny status realizacji?',
    expected_answer_shape: 'Lista 3-5 celów z KPI, statusem realizacji i powiązaniem ze strategią',
  },
  {
    id: 'vts_marketing_v1_q02',
    question_text: 'Które etapy planowania kampanii, uruchamiania działań lub raportowania powodują dziś najwięcej opóźnień i zbędnej koordynacji? Proszę opisać typowy cykl kampanii od pomysłu do pomiaru wyników.',
    description: 'Mapujemy „fabrykę kampanii" — od briefu do raportu. Szukamy wąskich gardeł, które opóźniają działania i zmniejszają responsywność marketingu na potrzeby biznesu.',
    evidence_prompt: 'Opisz etapy typowej kampanii z czasami (brief → kreacja → akceptacja → uruchomienie → monitoring → raport). Ile trwa cały cykl? Które etapy są najdłuższe i dlaczego? Ile osób wymaga akceptacji?',
    expected_answer_shape: 'Mapa cyklu kampanii z czasami etapów + identyfikacja wąskich gardeł',
  },
  {
    id: 'vts_marketing_v1_q03',
    question_text: 'Na ile dobrze połączone są dziś narzędzia marketingowe, CRM, analityka webowa i regionalne źródła danych? Proszę opisać, jak wygląda typowy proces tworzenia raportu marketingowego — ile źródeł danych trzeba połączyć ręcznie.',
    description: 'Fragmentacja narzędzi marketingowych to problem #1 w wielu organizacjach B2B. Chcemy zrozumieć, jak wygląda „stack technologiczny" marketingu i gdzie brakuje integracji.',
    evidence_prompt: 'Wymień narzędzia marketingowe (CRM, MA, analytics, social, CMS, e-mail). Które są zintegrowane, a które działają osobno? Jak tworzony jest raport — ręczne scalanie z kilku źródeł? Ile czasu to zajmuje?',
    expected_answer_shape: 'Lista narzędzi + mapa integracji + opis procesu raportowania z szacunkiem czasu',
  },
  {
    id: 'vts_marketing_v1_q04',
    question_text: 'Które zadania związane z tworzeniem treści, adaptacją materiałów lub lokalizacją są najbardziej powtarzalne, manualne albo trudne do skalowania między rynkami? Proszę podać konkretne przykłady.',
    description: 'Content w B2B to często wąskie gardło — materiały techniczne, case studies, materiały produktowe wymagają ekspertów, a lokalizacja dodaje kolejną warstwę złożoności.',
    evidence_prompt: 'Opisz typowy workflow content creation (kto pisze, kto akceptuje, jak tłumaczycie, jak adaptujecie). Ile czasu zajmuje stworzenie jednego materiału od zera? Ile jest re-use vs tworzenie od zera? Podaj przykład materiału, który był trudny do skalowania.',
    expected_answer_shape: 'Opis workflow content + szacunki czasowe + przykład problemu ze skalowaniem',
  },
  {
    id: 'vts_marketing_v1_q05',
    question_text: 'Gdzie akceptacje brandowe, produktowe lub prawne najbardziej spowalniają wykonanie działań marketingowych? Proszę podać przykład materiału, który utknął w procesie akceptacji — ile trwał i co go opóźniło.',
    description: 'Akceptacje to niezbędny element kontroli jakości, ale gdy trwają za długo — marketing traci responsywność. Szukamy możliwości przyspieszenia bez kompromisów na jakości.',
    evidence_prompt: 'Opisz proces akceptacji (kto akceptuje, ile poziomów, ile trwa). Podaj przykład materiału, który utknął (np. kampania, oferta, materiał na targi). Ile dni zajęła akceptacja vs ile powinna? Co by przyspieszyło?',
    expected_answer_shape: 'Opis procesu akceptacji + przykład opóźnienia + sugestia usprawnienia',
  },
  {
    id: 'vts_marketing_v1_q06',
    question_text: 'Jak dobra jest obecna widoczność jakości leadów, ROI kampanii oraz konwersji w lejku sprzedażowym według segmentu lub regionu? Proszę opisać, czy jesteście w stanie powiedzieć „ta kampania przyniosła X zamówień o wartości Y".',
    description: 'Atrybucja marketingowa to „święty Graal" B2B marketingu. Chcemy zrozumieć, na ile marketing potrafi dziś udowodnić swoją wartość w kategoriach biznesowych, a nie tylko w „metrykach vanity".',
    evidence_prompt: 'Opisz: czy śledzicie leady end-to-end (od źródła do zamówienia)? Jakie narzędzia do tego służą? Jaka jest typowa konwersja (lead → MQL → SQL → zamówienie)? Czy potraficie zmierzyć ROI kampanii? Podaj przykład.',
    expected_answer_shape: 'Opis zdolności atrybucyjnych + konwersja lejka + przykład pomiaru ROI (lub brak)',
  },
  {
    id: 'vts_marketing_v1_q07',
    question_text: 'Które przekazania (handoffy) pomiędzy marketingiem a sprzedażą powodują najwięcej tarcia, brak follow-upu albo sporów o jakość leadów? Proszę opisać, jak wygląda współpraca marketing-sales na co dzień.',
    description: 'Handoff marketing → sales to jeden z najkrytyczniejszych momentów w B2B. Jeśli sprzedaż nie ufa leadom z marketingu — cały wysiłek marketingowy idzie na marne.',
    evidence_prompt: 'Opisz: jak leady są przekazywane (system, e-mail, ręcznie)? Jaka jest definicja MQL vs SQL? Czy sprzedaż daje feedback do marketingu o jakości leadów? Ile % leadów marketingowych jest kontaktowanych przez sprzedaż? Podaj przykład konfliktu.',
    expected_answer_shape: 'Opis procesu handoffu + definicje MQL/SQL + statystyki follow-up + przykład konfliktu',
  },
  {
    id: 'vts_marketing_v1_q08',
    question_text: 'Które zastosowania AI mogłyby najbardziej poprawić szybkość kampanii, throughput contentu, personalizację lub generowanie insightów marketingowych? Proszę wskazać, gdzie dziś jest największe „wąskie gardło kreatywności".',
    description: 'AI w marketingu B2B to nie tylko generowanie treści — to scoring leadów, predykcja churn, personalizacja ofert, automatyzacja raportów. Szukamy najwyższego ROI.',
    evidence_prompt: 'Podaj 2-3 use case\'y (np. AI-generated content drafts, lead scoring, predictive analytics, automated reporting, personalized nurturing). Dla każdego: jaki problem rozwiązuje, jakie dane potrzebne, jaki efekt oczekiwany.',
    expected_answer_shape: 'Lista 2-3 use case\'ów AI z opisem problemu, wymagań i oczekiwanego ROI',
  },
  {
    id: 'vts_marketing_v1_q09',
    question_text: 'Które działania marketingowe wydają się dziś kosztowne względem tworzonej wartości? Proszę wskazać, gdzie budżet marketingowy mógłby być lepiej ulokowany, gdyby mieli Państwo lepsze dane.',
    description: 'Pytamy nie o cięcie budżetu, ale o realokację — gdzie każda złotówka mogłaby pracować ciężej. To wymaga jednak danych, których marketing często nie ma.',
    evidence_prompt: 'Podaj 2-3 działania, które uważasz za nieefektywne lub trudne do uzasadnienia (np. targi bez mierzalnego ROI, kampanie wizerunkowe bez konwersji, drukowane materiały). Ile kosztują? Jakie byłyby alternatywy?',
    expected_answer_shape: 'Lista 2-3 działań z kosztami, oceną efektywności i alternatywami',
  },
  {
    id: 'vts_marketing_v1_q10',
    question_text: 'Jakiej jednej zdolności w obszarze danych, systemów lub workflow najbardziej dziś brakuje, aby marketing VTS był skuteczniejszy? Proszę opisać, jak zmieni się praca zespołu marketingowego po wdrożeniu tej zdolności.',
    description: 'To pytanie wymusza priorytetyzację i wizję. Odpowiedź pomaga zrozumieć, co marketing uważa za swoje najsłabsze ogniwo — i czy ta ocena pokrywa się z obiektywną analizą.',
    evidence_prompt: 'Opisz jedną zdolność (np. marketing automation, real-time dashboarding, content management platform, integrated lead management). Porównaj „dziś" vs „docelowo" w kategoriach: czas, efektywność, mierzalność, skalowanie.',
    expected_answer_shape: 'Opis jednej zdolności z porównaniem before/after i mierzalnym efektem',
  },
];

// ─── VTS HR i Finanse (vts_hr_finance_v1) ──────────────────────────────
const hrFinanceQuestions: QuestionUpdate[] = [
  {
    id: 'vts_hr_finance_v1_q01',
    question_text: 'Które procesy HR lub finansowe pochłaniają dziś najwięcej pracy administracyjnej wykonywanej ręcznie? Proszę opisać typowy dzień osoby odpowiedzialnej za te procesy — ile czasu idzie na czynności powtarzalne vs strategiczne.',
    description: 'Szukamy „ukrytych fabryk" w HR i finansach — procesów, które mogłyby być zautomatyzowane, ale wymagają dziś ręcznej pracy, często z powodu braku integracji systemów lub przestarzałych procedur.',
    evidence_prompt: 'Wymień 3-5 najbardziej czasochłonnych czynności ręcznych (np. wprowadzanie danych kadrowych, ręczne uzgadnianie faktur, manualne raportowanie absencji). Oszacuj czas w godzinach/miesiąc. Ile osób jest zaangażowanych?',
    expected_answer_shape: 'Lista 3-5 procesów ręcznych z szacunkami czasu i liczby osób',
  },
  {
    id: 'vts_hr_finance_v1_q02',
    question_text: 'W których miejscach onboarding, rekrutacja, administracja szkoleniami, payroll albo employee service najbardziej zwalniają lub frustrują użytkowników? Proszę opisać doświadczenie z perspektywy pracownika — co jest trudne, wolne lub nieprzyjazne.',
    description: 'Employee experience to coraz ważniejszy czynnik konkurencyjności. Procesy HR, które frustrują pracowników, wpływają na zaangażowanie, retencję i employer brand.',
    evidence_prompt: 'Opisz 2-3 „pain points" z perspektywy pracownika (np. skomplikowany onboarding, brak self-service, długi czas odpowiedzi na pytania HR). Ile trwa onboarding nowego pracownika? Jak pracownik zgłasza sprawę do HR? Ile trwa odpowiedź?',
    expected_answer_shape: 'Opis 2-3 pain points z perspektywy pracownika + szacunki czasu + obecny kanał komunikacji',
  },
  {
    id: 'vts_hr_finance_v1_q03',
    question_text: 'Które elementy month-end close, raportowania, budżetowania lub forecastingu są dziś najbardziej czasochłonne? Proszę opisać, ile dni trwa zamknięcie miesiąca i co jest głównym „wąskim gardłem" tego procesu.',
    description: 'Czas zamknięcia miesiąca to bezpośredni wskaźnik dojrzałości procesów finansowych. Długi close oznacza, że management dostaje dane z opóźnieniem i podejmuje decyzje na podstawie przestarzałych informacji.',
    evidence_prompt: 'Podaj: ile dni trwa month-end close (od zamknięcia ksiąg do gotowego raportu)? Które elementy trwają najdłużej (uzgadnianie, konsolidacja, korekty)? Ile osób jest zaangażowanych? Czy budżetowanie jest w systemie czy w Excelu?',
    expected_answer_shape: 'Opis procesu close z czasami + identyfikacja wąskich gardeł + narzędzia',
  },
  {
    id: 'vts_hr_finance_v1_q04',
    question_text: 'Na ile dobrze współpracują dziś systemy HR, systemy finansowe, arkusze i lokalne pliki? Proszę opisać, jakie dane trzeba ręcznie przenosić między systemami i jak często to powoduje błędy.',
    description: 'Integracja systemów HR i finansów to warunek automatyzacji i wiarygodności danych. Każdy „ręczny most" między systemami to ryzyko błędu i strata czasu.',
    evidence_prompt: 'Wymień systemy HR i finansowe (ERP, HRM, payroll, budgeting tool itp.). Które są zintegrowane? Gdzie dane przepływają ręcznie (np. Excel → system, system A → system B ręcznie)? Ile razy w miesiącu? Jaki % danych wymaga ręcznej korekty?',
    expected_answer_shape: 'Mapa systemów HR/finansowych + identyfikacja ręcznych transferów + szacunek błędowości',
  },
  {
    id: 'vts_hr_finance_v1_q05',
    question_text: 'Które workflow akceptacyjne dla wydatków, rekrutacji, podróży lub umów są dziś zbyt wolne albo zbyt nieprzejrzyste? Proszę podać przykład procesu, który trwał dłużej niż powinien — i co go opóźniło.',
    description: 'Workflow akceptacyjne to „system nerwowy" organizacji. Gdy są zbyt wolne — frustrują ludzi i opóźniają biznes. Gdy są nieprzejrzyste — ludzie nie wiedzą, na jakim etapie jest ich sprawa.',
    evidence_prompt: 'Opisz 2-3 workflow akceptacyjne (np. zatwierdzenie faktury, approval rekrutacji, delegacja). Ile trwają? Ile poziomów akceptacji? Jak wygląda śledzenie statusu? Podaj przykład opóźnienia i jego konsekwencji biznesowych.',
    expected_answer_shape: 'Opis 2-3 workflow z czasami, poziomami akceptacji i przykładem opóźnienia',
  },
  {
    id: 'vts_hr_finance_v1_q06',
    question_text: 'Gdzie praca na dokumentach jest nadal mocno manualna — faktury, umowy, polityki, CV, zgłoszenia pracowników? Proszę opisać typowy cykl życia dokumentu od powstania do archiwizacji.',
    description: 'Zarządzanie dokumentami to jeden z najczęściej niedocenianych obszarów digitalizacji. Ręczne obieg dokumentów to strata czasu, ryzyko zgubienia i problem z compliance.',
    evidence_prompt: 'Opisz workflow dla 2-3 typów dokumentów (np. faktura zakupowa, umowa z pracownikiem, wniosek urlopowy). Jak powstaje, kto akceptuje, gdzie jest przechowywany, jak szybko można go znaleźć? Ile dokumentów miesięcznie? Czy jest OCR/digitalizacja?',
    expected_answer_shape: 'Workflow dokumentów z wolumenami + ocena manualności + informacja o digitalizacji',
  },
  {
    id: 'vts_hr_finance_v1_q07',
    question_text: 'Jakich danych o ludziach, kompetencjach lub strukturze organizacyjnej najbardziej brakuje albo którym danym trudno zaufać przy podejmowaniu decyzji HR? Proszę opisać sytuację, w której brak danych utrudnił ważną decyzję.',
    description: 'Dane HR to fundament strategicznego zarządzania ludźmi. Jeśli nie wiesz dokładnie, jakie kompetencje masz w organizacji — nie możesz planować succession, szkoleń ani transformacji.',
    evidence_prompt: 'Wymień 2-3 rodzaje brakujących danych (np. matryca kompetencji, ścieżki kariery, dane o engagement, predictive attrition). Opisz decyzję, którą trudno było podjąć bez danych (np. planowanie sukcesji, identyfikacja high potentials, planowanie szkoleń).',
    expected_answer_shape: 'Lista brakujących danych + przykład decyzji utrudnionej brakiem danych',
  },
  {
    id: 'vts_hr_finance_v1_q08',
    question_text: 'Które wskaźniki finansowe lub HR są najważniejsze dla zarządu i gdzie raportowanie jest nadal zbyt wolne, zbyt manualne albo niewystarczająco wiarygodne? Proszę opisać, jak dziś powstaje raport dla zarządu.',
    description: 'Raportowanie dla zarządu to „produkt końcowy" funkcji HR i finansów. Jeśli jest wolne lub niewiarygodne — zarząd podejmuje decyzje na przeczuciach zamiast na danych.',
    evidence_prompt: 'Wymień 3-5 kluczowych wskaźników (np. FTE, headcount cost, turnover, absencja, EBITDA, cash flow). Jak są dziś raportowane (system/Excel/ręcznie)? Ile czasu zajmuje przygotowanie raportu? Jakie są główne problemy z wiarygodnością?',
    expected_answer_shape: 'Lista KPI + opis procesu raportowania + szacunek czasu + ocena wiarygodności',
  },
  {
    id: 'vts_hr_finance_v1_q09',
    question_text: 'Które zastosowania AI lub automatyzacji mogłyby najbardziej poprawić szybkość działania, compliance, employee experience albo widoczność dla managementu w HR i finansach? Proszę wskazać, gdzie zysk byłby najszybszy.',
    description: 'AI i automatyzacja w HR/finansach to np. chatboty HR, automatyczne procesowanie faktur, predykcja attrition, automatyzacja raportów, intelligent document processing. Szukamy najwyższego ROI.',
    evidence_prompt: 'Podaj 2-3 use case\'y (np. automatyczne procesowanie faktur/OCR, chatbot HR, predictive analytics dla retention, automated compliance checks). Dla każdego: jaki problem rozwiązuje, ile czasu/kosztów oszczędza, czy dane są dostępne.',
    expected_answer_shape: 'Lista 2-3 use case\'ów z opisem problemu, oczekiwanego efektu i gotowości danych',
  },
  {
    id: 'vts_hr_finance_v1_q10',
    question_text: 'Jeden proces w HR lub finansach, który jako pierwszy powinien zostać przeprojektowany pod cele digitalizacji VTS — który to jest i dlaczego? Proszę opisać, jak wyglądałby ten proces po zmianie.',
    description: 'To pytanie wymusza priorytetyzację. Odpowiedź pokazuje, co liderzy HR/finansów uważają za swój „najsłabszy punkt" — i na ile ambitna jest ich wizja zmiany.',
    evidence_prompt: 'Opisz jeden proces (np. month-end close, onboarding, rekrutacja, expense management). Porównaj „dziś" vs „docelowo" w kategoriach: czas, koszt, doświadczenie użytkownika, wiarygodność danych. Dlaczego właśnie ten proces jest najważniejszy?',
    expected_answer_shape: 'Jeden wybrany proces z porównaniem before/after i uzasadnieniem priorytetu',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// All questions combined
// ═══════════════════════════════════════════════════════════════════════════
const allQuestions: QuestionUpdate[] = [
  ...hqCoreQuestions,
  ...salesQuestions,
  ...logisticsQuestions,
  ...productionQualityQuestions,
  ...rndQuestions,
  ...marketingQuestions,
  ...hrFinanceQuestions,
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Connected. Updating ${allQuestions.length} VTS questions...\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of allQuestions) {
    try {
      const res = await client.query(
        `UPDATE interview_library_template_questions
         SET question_text = $1,
             description = $2,
             evidence_prompt = $3,
             expected_answer_shape = $4
         WHERE id = $5`,
        [q.question_text, q.description, q.evidence_prompt, q.expected_answer_shape, q.id]
      );
      if (res.rowCount === 1) {
        updated++;
        console.log(`  ✓ ${q.id}`);
      } else {
        skipped++;
        console.log(`  ⚠ ${q.id} — not found (rowCount=${res.rowCount})`);
      }
    } catch (err: any) {
      errors++;
      console.error(`  ✗ ${q.id} — ${err.message}`);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  await client.end();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
