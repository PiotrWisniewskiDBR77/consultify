/**
 * DRD Knowledge Overrides — Oś 5, 6 i 7
 *
 * Partia 3 q-banku DRD: pytania behawioralne z artefaktem-dowodem.
 *
 * Metodologia (wg DRD_CANON.md §9.2):
 * - 3 pytania PL per obszar × poziom, behawioralne (artefakt, nie samoocena)
 * - example: konkretny dowód-artefakt oczekiwany przy odpowiedzi "tak"
 * - suggestedTechnologies: per klucz, kontekstowe
 *
 * Uwaga strukturalna (kanoniczna SSOT = src/services/drdStructure.ts Mapa A / Londyn):
 * - Oś 5 (Kultura): 5 obszarów × 6 poziomów (drabiny behawioralne wg książki DRD)
 * - Oś 6 (Cyber): 5 obszarów × 6 poziomów (kumulatywna skala techniczna)
 * - Oś 7 (AI Maturity): 5 obszarów × 5 poziomów
 *
 * Klucz: `{obszar}#{poziom}`, np. "5A#3"
 */

import type { DRDAreaLevelKey, DRDLevelKnowledge } from './drdKnowledge';

// ============================================================
// OŚ 5: KULTURA TRANSFORMACJI (5A–5E, 6 poziomów)
// ============================================================

// 5A — Styl Przywództwa / Leadership Attitudes
// Uwaga: 5A opisuje TYPY przywódcze (nie rosnącą dojrzałość).
// Pytania koncentrują się na obserwowalnych decyzjach i zachowaniach lidera.

const axis5A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5A#1': {
    questions: [
      'Czy zarząd/kierownictwo jawnie komunikuje swój brak zaangażowania w inicjatywy cyfrowe — lub po prostu ich nie blokuje i nie wspiera?',
      'Czy w ostatnich 12 miesiącach kadra zarządzająca odmówiła budżetu lub zasobów na co najmniej 2 inicjatywy transformacyjne bez uzasadnienia merytorycznego?',
      'Czy na spotkaniach zarządu temat cyfryzacji pojawia się rzadziej niż raz na kwartał?',
    ],
    example:
      'Dowód: lista agend spotkań zarządu z ostatnich 4 kwartałów — brak punktu "transformacja cyfrowa / innowacje". Lub zestawienie odrzuconych wniosków projektowych bez uzasadnienia strategicznego.',
    suggestedTechnologies: ['Protokoły posiedzeń zarządu', 'Rejestr decyzji budżetowych'],
  },
  '5A#2': {
    questions: [
      'Czy decyzje o wdrożeniu technologii są podejmowane wyłącznie przez jedną osobę bez konsultacji z innymi działami lub specjalistami?',
      'Czy zespoły projektowe otrzymują szczegółowe instrukcje "jak to zrobić", a nie cele do osiągnięcia?',
      'Czy w ostatnim roku co najmniej jeden kierownik odszedł lub zaraportował frustrację brakiem decyzyjności?',
    ],
    example:
      'Dowód: schemat organizacyjny z jednym ośrodkiem decyzyjnym plus dokumentacja projektu pokazująca szczegółowe polecenia zamiast celów. Ewentualnie wynik exit interview.',
    suggestedTechnologies: ['HRIS (exit interviews)', 'Systemy zarządzania projektami', 'Dokumentacja projektowa'],
  },
  '5A#3': {
    questions: [
      'Czy kierownictwo wyznacza mierzalne cele cyfrowe z terminem i przekazuje team-leaderom uprawnienia do ich realizacji?',
      'Czy istnieje dokumentacja wskazująca zasoby (budżet, czas, narzędzia) przypisane do konkretnych projektów transformacyjnych?',
      'Czy przełożony sam korzysta z narzędzi cyfrowych (CRM, BI, platforma projektowa) i wymaga tego od swoich zespołów?',
    ],
    example:
      'Dowód: karta projektu lub OKR/KPI z przypisanym właścicielem, terminem i budżetem. Screenshot dashboardu BI używanego przez menedżera na codziennej bazie.',
    suggestedTechnologies: ['OKR/KPI Tool', 'BI Dashboard', 'Project Management (Jira/Asana)'],
  },
  '5A#4': {
    questions: [
      'Czy lider aktywnie buduje psychologiczne bezpieczeństwo w zespole — np. publicznie uznaje własne błędy lub nagradza próby innowacji bez względu na wynik?',
      'Czy w ciągu ostatnich 6 miesięcy lider uczestniczył w szkoleniu lub konferencji dotyczącej transformacji cyfrowej i wdrożył konkretną zmianę w oparciu o tę wiedzę?',
      'Czy zespoły zgłaszają, że mogą eksperymentować bez ryzyka kary za porażkę (potwierdzone np. w badaniu pulsu organizacji)?',
    ],
    example:
      'Dowód: wyniki badania zaangażowania/bezpieczeństwa psychologicznego (np. Gallup Q12) z wynikiem ≥ 4/5 w pytaniach o eksperymentowanie. Lub udokumentowana sesja retrospekcji, gdzie lider omawia własne błędy.',
    suggestedTechnologies: ['Pulse Survey Tool (Officevibe, Leapsome)', 'HR Analytics', 'Learning Management System (LMS)'],
  },
  '5A#5': {
    questions: [
      'Czy lider aktywnie testuje nowe technologie (np. AI tools, nowe metody pracy) i zachęca zespół do eksperymentów z prawem do porażki?',
      'Czy lider uczestniczy w zewnętrznych ekosystemach innowacyjnych (hackathony, startupy, uczelnie) i wnosi wyniki z powrotem do organizacji?',
      'Czy inicjatywy generowane przez lidera wychodzą poza optymalizację — tzn. tworzą nowe modele biznesowe lub kategorie wartości?',
    ],
    example:
      'Dowód: lista inicjatyw innowacyjnych z ostatnich 2 lat z potwierdzonym wpływem biznesowym (ROI, nowi klienci, nowy produkt). Lub dokumentacja udziału w programie inkubacji / partnerstwie ze startupem.',
    suggestedTechnologies: ['Innovation Pipeline Tool', 'Venture Builder Platform', 'R&D Portfolio Management'],
  },
  '5A#6': {
    questions: [
      'Czy zarząd buduje i publicznie artykułuje wizję cyfrową na 3–5 lat, powiązaną ze strategią biznesową i mierzoną kwartalnie?',
      'Czy lider poświęca co najmniej 20% czasu na działania transformacyjne (szkolenia, mentoring, ekosystem zewnętrzny) — mierzalne przez kalendarz lub OKR?',
      'Czy organizacja ma formalny program sukcesji przywódczej, który uwzględnia kompetencje cyfrowe i zmianowy styl zarządzania?',
    ],
    example:
      'Dowód: "Digital Vision 2026–2030" — dokument zatwierdzony przez zarząd z KPI i właścicielami. Program sukcesji z jawnym kryterium "kompetencje AI/cyfrowe". Raport kwartalny z przeglądem postępów transformacji prezentowany akcjonariuszom.',
    suggestedTechnologies: ['Strategic Planning Tool (Cascade, Monday)', 'Succession Planning (SAP SuccessFactors)', 'Executive Reporting Dashboard'],
  },
};

// 5B — Gotowość na Zmianę / Readiness for Change (model Kottera)
const axis5B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5B#1': {
    questions: [
      'Czy organizacja formalnie zidentyfikowała konkretne problemy lub zagrożenia, które wymuszają zmianę (np. utrata udziału rynkowego, rosnące koszty, presja regulacyjna)?',
      'Czy zarząd/kierownictwo jest świadome, że bez zmiany firma znajdzie się w trudnej sytuacji — czy zostało to udokumentowane (raport, analiza, prezentacja)?',
      'Czy istnieje co najmniej jedna osoba lub komitet formalnie odpowiedzialny za monitorowanie sygnałów zmiany w otoczeniu firmy?',
    ],
    example:
      'Dowód: raport diagnostyczny lub analiza SWOT z 2024/2025 roku wskazujący konkretne powody pilności zmiany. Lub protokół zarządu z omówieniem zagrożeń konkurencyjnych.',
    suggestedTechnologies: ['Business Intelligence', 'Market Monitoring Tool', 'SWOT/Diagnostic Framework'],
  },
  '5B#2': {
    questions: [
      'Czy istnieje identyfikowalny "sponsor zmiany" z uprawnieniami i budżetem, a nie tylko nieformalny entuzjasta?',
      'Czy skład "koalicji zmiany" jest udokumentowany (imiennie) i obejmuje co najmniej 3 obszary funkcjonalne firmy?',
      'Czy liderzy z różnych działów zaobserwowali lub publicznie potwierdzili pilność zmiany?',
    ],
    example:
      'Dowód: zarządzenie wewnętrzne powołujące "komitet ds. transformacji cyfrowej" z imienną listą i mandatem. Lub dokumentacja kick-off spotkania z udziałem przedstawicieli sprzedaży, IT, operacji i HR.',
    suggestedTechnologies: ['HRIS / Org Chart Tool', 'Collaboration Platform (Teams/Slack)', 'Governance Framework'],
  },
  '5B#3': {
    questions: [
      'Czy organizacja ma udokumentowaną wizję docelowego stanu ("To Be") z perspektywą min. 2–3 lat, zaakceptowaną przez zarząd?',
      'Czy istnieje strategia komunikacji wizji — plan działań, kanały, harmonogram — a nie tylko jednorazowa prezentacja?',
      'Czy wizja zmiany jest powiązana z konkretnymi miernikami biznesowymi (np. redukcja kosztów o 15%, wzrost NPS o 10 pkt)?',
    ],
    example:
      'Dowód: dokument "Wizja transformacji 2025–2027" zatwierdzony przez zarząd z KPI i timeline\'em. Lub plan komunikacyjny z harmonogramem townhallów i komunikatami dla poszczególnych grup.',
    suggestedTechnologies: ['Strategic Planning Tool', 'Internal Communication Platform (Intranet)', 'OKR Software'],
  },
  '5B#4': {
    questions: [
      'Czy wizja zmiany jest regularnie komunikowana pracownikom przez przełożonych — co najmniej raz na kwartał, w różnych formatach (townhall, wideo, newsletter)?',
      'Czy pracownicy mogą aktywnie zgłaszać pytania, wątpliwości lub pomysły dotyczące zmiany (np. przez forum, Q&A, ankietę)?',
      'Czy wyniki badania zrozumienia wizji wśród pracowników wynoszą ≥ 70% (pytanie: "Czy wiesz, dokąd zmierza firma")?',
    ],
    example:
      'Dowód: zapis townhalla lub newslettera z ostatnich 3 miesięcy potwierdzający dwukierunkową komunikację. Wyniki ankiety pracowniczej z pytaniem o zrozumienie kierunku transformacji.',
    suggestedTechnologies: ['Internal Communication Platform', 'Employee Survey Tool', 'Intranet / Digital Workplace'],
  },
  '5B#5': {
    questions: [
      'Czy organizacja wdraża planowane inicjatywy zmiany z udokumentowanymi krokami, właścicielami i datami ukończenia?',
      'Czy co kwartał mierzone są wskaźniki postępu wdrożenia i raportowane zarządowi?',
      'Czy istnieje mechanizm usuwania przeszkód wdrożeniowych (escalation path, backlog blokerów)?',
    ],
    example:
      'Dowód: roadmapa transformacji z statusem "zielony/żółty/czerwony" per inicjatywa, aktualizowana co miesiąc. Protokół komitetu sterującego omawiającego usunięte bariery.',
    suggestedTechnologies: ['Project Portfolio Management (PPM)', 'OKR/KPI Platform', 'Risk & Issue Register'],
  },
  '5B#6': {
    questions: [
      'Czy zmiana jest wpisana w stałe elementy kultury firmy — np. w kryteria ocen pracowniczych, programy onboardingowe, wartości organizacyjne?',
      'Czy mechanizmy zmiany działają bez "sponsora-superbohatera" — tzn. instytucje (procesy, role, KPI) napędzają zmianę samodzielnie?',
      'Czy organizacja odnotowała co najmniej dwa pełne cykle zmiany zakończone sukcesem, z których wyciągnięto wnioski wdrożone w kolejnych inicjatywach?',
    ],
    example:
      'Dowód: karta wartości organizacyjnych z jawnym elementem "ciągła transformacja". Formularz oceny rocznej z pytaniem o wkład pracownika w zmianę. Lessons learned z 2 zakończonych projektów transformacyjnych wdrożone w kolejnych.',
    suggestedTechnologies: ['Performance Management System', 'Knowledge Management (Confluence)', 'HR Onboarding Platform'],
  },
};

// 5C — Ciągły Rozwój Kompetencji / Continuous Competency Development
const axis5C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5C#1': {
    questions: [
      'Czy pracownicy uczestniczą w zewnętrznych wydarzeniach branżowych (targi, konferencje, webinary) co najmniej raz w roku, a wnioski są formalnie przekazywane do organizacji?',
      'Czy istnieje lista osób, które uczestniczyły w takich wydarzeniach w ostatnich 12 miesiącach, z potwierdzeniem tematu i formy raportowania wyników?',
      'Czy organizacja pokrywa koszty uczestnictwa i traktuje go jako inwestycję, nie jako nagrodę?',
    ],
    example:
      'Dowód: lista uczestnictwa pracowników w konferencjach 2024–2025 z tematami i formą zwrotu wiedzy (prezentacja wewnętrzna, raport, warsztaty). Dowód refundacji kosztów.',
    suggestedTechnologies: ['Learning Management System (LMS)', 'HR Training Register', 'Event Management Tool'],
  },
  '5C#2': {
    questions: [
      'Czy organizacja prowadzi regularne (co najmniej kwartalne) szkolenia wewnętrzne dotyczące narzędzi cyfrowych lub kompetencji miękkich transformacji?',
      'Czy istnieje rejestr szkoleń wewnętrznych z listą uczestników, tematami i datami z ostatnich 12 miesięcy?',
      'Czy trenerzy wewnętrzni mają wyznaczony czas na przygotowanie i prowadzenie szkoleń (nie jest to "po godzinach")?',
    ],
    example:
      'Dowód: plan szkoleń wewnętrznych 2025 z kalendarzem, listą uczestników i potwierdzeniem obecności (podpisane listy lub wydruki z LMS). Rola "trener wewnętrzny" w opisach stanowisk.',
    suggestedTechnologies: ['LMS (Moodle, Docebo)', 'HR Training Register', 'Calendar / Scheduling Tool'],
  },
  '5C#3': {
    questions: [
      'Czy pracownicy uczestniczą w certyfikowanych szkoleniach zewnętrznych min. raz w roku, a organizacja pokrywa koszty?',
      'Czy budżet na szkolenia zewnętrzne jest ujęty w planie finansowym jako odrębna pozycja, nie "jak zostanie"?',
      'Czy istnieje polityka szkoleniowa definiująca kto, jak często i na jakie szkolenia może się zapisać?',
    ],
    example:
      'Dowód: wyciąg z budżetu z pozycją "szkolenia zewnętrzne 2025" z kwotą. Lista certyfikatów uzyskanych przez pracowników w ostatnich 2 latach. Polityka szkoleniowa zatwierdzana przez HR.',
    suggestedTechnologies: ['LMS', 'HR Policy Management', 'Finance/ERP (budget tracking)'],
  },
  '5C#4': {
    questions: [
      'Czy organizacja zapewnia pracownikom dostęp do platform e-learningowych (Udemy, Coursera, LinkedIn Learning) z przypisanym budżetem lub licencją zbiorową?',
      'Czy pracownicy mają formalne "godziny nauki" wpisane w harmonogram tygodniowy (np. "learning Friday" lub 2h/tydzień)?',
      'Czy korzystanie z platform self-learningowych jest mierzone i raportowane (np. completion rate per dział)?',
    ],
    example:
      'Dowód: umowa z platformą e-learningową (Udemy Business, Coursera for Business) z datą i liczbą licencji. Raport completion rate za ostatni kwartał. Polityka "learning time" potwierdzona przez przełożonych.',
    suggestedTechnologies: ['Udemy Business / Coursera for Teams', 'LinkedIn Learning', 'LMS Analytics'],
  },
  '5C#5': {
    questions: [
      'Czy pracownicy zdobywają kompetencje poprzez pracę w interdyscyplinarnych zespołach projektowych, a nie tylko na szkoleniach?',
      'Czy rotacja między projektami i działami jest oficjalną praktyką rozwojową z planem i mentorem?',
      'Czy co najmniej 20% inicjatyw transformacyjnych ma w składzie pracowników spoza "domyślnego" działu (np. operacje w projekcie IT)?',
    ],
    example:
      'Dowód: karty projektów z składem interdyscyplinarnym, potwierdzające uczestnictwo pracowników z różnych działów. Plan rotacji projektowej zatwierdzony przez HR.',
    suggestedTechnologies: ['Project Management Tool (Jira/Asana)', 'HRIS (rotation tracking)', 'Skills Matrix'],
  },
  '5C#6': {
    questions: [
      'Czy działa formalny program mentoringowy — z udokumentowanymi parami mentor/mentee, celami i rytmem spotkań?',
      'Czy organizacja mierzy efekty mentoringu (np. awanse, completion rate, wyniki ocen kompetencyjnych mentees)?',
      'Czy mentorzy mają czas wyznaczony w planach pracy (nie "po godzinach") i są nagradzani za tę rolę?',
    ],
    example:
      'Dowód: lista par mentor/mentee z ostatnich 12 miesięcy, plan spotkań i potwierdzenia odbycia (checkiny). Raport efektów: X awansów wśród mentees, Y% completion rate. Ocena roczna mentora uwzględniająca wkład w mentoring.',
    suggestedTechnologies: ['Mentoring Platform (Together, MentorcliQ)', 'HRIS', 'Performance Management System'],
  },
};

// 5D — Kultura Innowacji / Innovation Culture
const axis5D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5D#1': {
    questions: [
      'Czy organizacja ma kanał lub mechanizm zbierania pomysłów od pracowników (platforma, skrzynka, hackathon) — nie tylko "drzwi otwarte u szefa"?',
      'Czy w ciągu ostatnich 12 miesięcy co najmniej jeden pomysł pracowniczy przeszedł do etapu realizacji lub pilotażu?',
      'Czy liczba zgłoszonych pomysłów i ich statusy są regularnie raportowane (np. kwartalnie)?',
    ],
    example:
      'Dowód: platforma pomysłów z liczbą zgłoszeń, statusami i datami z ostatnich 12 miesięcy. Lub protokół hackathonu z listą uczestników i wynikiem.',
    suggestedTechnologies: ['Idea Management Platform (Brightidea, IdeaScale)', 'Collaboration Tool (Teams/Slack)', 'Innovation Tracker'],
  },
  '5D#2': {
    questions: [
      'Czy organizacja przeprowadza regularnie (co najmniej raz w roku) testy koncepcji lub prototypy — z udokumentowanym wynikiem, nie tylko "rozmowy o pomysłach"?',
      'Czy istnieje dedykowany budżet na prototypy/pilotaże (choćby niewielki, ale formalny)?',
      'Czy wyniki prototypów (nawet nieudanych) są dokumentowane i przekazywane zainteresowanym?',
    ],
    example:
      'Dowód: lista pilotażów z ostatnich 2 lat z opisem hipotezy, wyniku i decyzji (kontynuuj/zamknij). Pozycja "budżet innowacje" w planie finansowym z kwotą.',
    suggestedTechnologies: ['Prototype/MVP Tools (Figma, Notion)', 'Project Tracking', 'Budget Management (ERP)'],
  },
  '5D#3': {
    questions: [
      'Czy organizacja formalnie monitoruje trendy rynkowe i technologiczne — np. przez subskrypcje raportów, dedykowanego analityka lub comiesięczne przeglądy trendów?',
      'Czy wyniki analizy trendów trafiają na agenda spotkań zarządu lub kadry kierowniczej co najmniej raz na kwartał?',
      'Czy trendy są powiązane z konkretnymi decyzjami lub inicjatywami (nie tylko "ciekawe, szkoda że nie u nas")?',
    ],
    example:
      'Dowód: raport trendów z datą i podpisem właściciela. Agenda spotkania zarządu z punktem "trendy/innowacje". Lista inicjatyw uruchomionych na podstawie analizy trendów.',
    suggestedTechnologies: ['Market Intelligence (Crayon, Klue)', 'Research Platform (Gartner, Forrester)', 'BI Dashboard'],
  },
  '5D#4': {
    questions: [
      'Czy organizacja ma udokumentowaną politykę "prawa do błędu" — tzn. jasno mówi, że porażka w eksperymencie nie oznacza kary?',
      'Czy w ostatnim roku co najmniej jeden projekt zakończył się niepowodzeniem, a zamiast kary przeprowadzono retrospekcję z wyciągnięciem wniosków?',
      'Czy wyniki retrospekcji po nieudanych projektach są udostępniane szerszej organizacji (knowledge sharing)?',
    ],
    example:
      'Dowód: polityka "fail fast, learn fast" lub analogiczny dokument zatwierdzony przez zarząd. Protokół retrospekcji po zamkniętym projekcie z listą wniosków i kolejnymi działaniami.',
    suggestedTechnologies: ['Knowledge Management (Confluence)', 'Retrospective Tools (Miro, EasyRetro)', 'HR Policy Platform'],
  },
  '5D#5': {
    questions: [
      'Czy organizacja ma dedykowane stanowisko lub zespół R&D z własnym budżetem i celami rocznym, niezależnym od bieżących projektów?',
      'Czy R&D jest ujęte w strategii firmy jako stały element (nie "projekt roku"), z wieloletnim planem i miernikami (np. % przychodów z nowych produktów)?',
      'Czy wyniki R&D w ciągu ostatnich 3 lat przełożyły się na co najmniej jeden nowy produkt, usługę lub patent?',
    ],
    example:
      'Dowód: struktura organizacyjna z działem R&D. Budżet R&D jako % przychodów z ostatnich 3 lat. Lista patentów lub nowych produktów z powiązaniem z działem R&D.',
    suggestedTechnologies: ['R&D Management Platform', 'Patent & IP Management', 'Project Portfolio (PPM)'],
  },
  '5D#6': {
    questions: [
      'Czy organizacja ma formalne programy współpracy zewnętrznej z uczelniami, startupami lub partnerami technologicznymi — z umowami, budżetem i harmonogramem?',
      'Czy w ciągu ostatnich 2 lat firma uruchomiła co najmniej jeden produkt lub usługę wynikający z takiej współpracy zewnętrznej?',
      'Czy ekosystem zewnętrzny (partnerzy, startupy, uczelnie) jest zarządzany przez dedykowaną rolę lub dział?',
    ],
    example:
      'Dowód: umowy partnerskie z uczelniami / startupami podpisane w ostatnich 2 latach. Produkt/usługa z udokumentowanym związkiem z tą współpracą. Rola "Innovation Partnership Manager" lub analogiczna w strukturze.',
    suggestedTechnologies: ['CRM (partner management)', 'Partnership Platform', 'Innovation Ecosystem Tool (Plug and Play)'],
  },
};

// 5E — Dostępność Zasobów / Resource Availability
const axis5E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '5E#1': {
    questions: [
      'Czy organizacja ma zatwierdzony plan finansowania inicjatyw transformacyjnych na co najmniej 12 miesięcy naprzód?',
      'Czy budżet na cyfryzację jest odrębną pozycją w planie finansowym (nie "ukryty w IT" ani "jak będzie ze sprzedaży")?',
      'Czy właściciel budżetu i decydent co do jego wydatkowania są wskazani imiennie?',
    ],
    example:
      'Dowód: wyciąg z planu finansowego z pozycją "transformacja cyfrowa / innowacje" na rok 2025, z kwotą i właścicielem. Lub protokół zarządu z zatwierdzoną alokacją.',
    suggestedTechnologies: ['ERP (Finance module)', 'Budget Planning Tool', 'Project Portfolio Management'],
  },
  '5E#2': {
    questions: [
      'Czy organizacja ma zdefiniowane ścieżki rozwoju kompetencji cyfrowych per rola, z budżetem szkoleń na pracownika?',
      'Czy budżet szkoleniowy w ostatnich 12 miesiącach został faktycznie wydany w > 80% (nie tylko "zaplanowany")?',
      'Czy pracownicy mają dostęp do informacji o dostępnych szkoleniach i mogą je zamawiać samodzielnie (nawet z akceptacją)?',
    ],
    example:
      'Dowód: katalog ścieżek szkoleniowych per rola + raport wydatków szkoleniowych Q1–Q4 2024 z podziałem per dział. Screen z portalu szkoleniowego lub LMS.',
    suggestedTechnologies: ['LMS', 'HR Training Budget Module', 'Employee Self-Service Portal'],
  },
  '5E#3': {
    questions: [
      'Czy organizacja ma zidentyfikowanych ekspertów wewnętrznych lub zewnętrznych gotowych do wsparcia projektów cyfrowych, z procedurą ich angażowania?',
      'Czy w ciągu ostatnich 12 miesięcy skorzystano z co najmniej jednego zewnętrznego eksperta / konsultanta w projekcie transformacyjnym — z udokumentowanym efektem?',
      'Czy lista ekspertów (wewnętrznych i partnerów zewnętrznych) jest aktualizowana i dostępna dla menedżerów projektów?',
    ],
    example:
      'Dowód: rejestr ekspertów wewnętrznych i preferowanych dostawców zewnętrznych z datą ostatniej aktualizacji. Faktura lub umowa z konsultantem z 2024/2025 + opis rezultatu zaangażowania.',
    suggestedTechnologies: ['CRM (vendor/expert management)', 'Procurement System', 'Skills Directory (intranet)'],
  },
  '5E#4': {
    questions: [
      'Czy pracownicy mają zdefiniowane zasady dostępu do danych firmowych potrzebnych do wykonania pracy — z określonymi rolami i ograniczeniami?',
      'Czy w ciągu ostatnich 6 miesięcy nie było zgłoszeń blokad "brak dostępu do danych" opóźniających projekt cyfrowy?',
      'Czy polityka dostępu do danych jest przeglądana co najmniej raz w roku i dostosowywana do nowych ról?',
    ],
    example:
      'Dowód: macierz dostępu do danych z podziałem na role, zatwierdzona i opublikowana na intranecie. Raport z systemu IAM/AD pokazujący zero nieuzasadnionych blokad w ostatnich 6 miesiącach.',
    suggestedTechnologies: ['IAM (Identity & Access Management)', 'Data Governance Platform', 'Active Directory / Azure AD'],
  },
  '5E#5': {
    questions: [
      'Czy pracownicy mają dostęp do aktualnych technologii cyfrowych niezbędnych na ich stanowisku — z kontraktem wsparcia i procedurą aktualizacji?',
      'Czy czas oczekiwania na przydzielenie dostępu do technologii / licencji dla nowego pracownika wynosi ≤ 5 dni roboczych?',
      'Czy organizacja ma katalog technologii i narzędzi cyfrowych (software asset management) z liczbami licencji i właścicielami?',
    ],
    example:
      'Dowód: katalog oprogramowania/SAM Tool z listą narzędzi, liczbami licencji i właścicielami. Metryka onboarding IT: średni czas przydzielenia dostępów = X dni (dane z helpdesk). ',
    suggestedTechnologies: ['SAM Tool (Snow Software, Flexera)', 'ITSM Helpdesk (ServiceNow, Jira)', 'MDM (Mobile Device Management)'],
  },
  '5E#6': {
    questions: [
      'Czy organizacja ma aktywne partnerstwa biznesowe (technologiczne, badawcze lub rynkowe) zarządzane przez dedykowaną rolę z KPI?',
      'Czy w ciągu ostatnich 2 lat co najmniej jeden projekt transformacyjny był realizowany wspólnie z zewnętrznym partnerem (startup, dostawca, uczelnia) — z umową i podziałem korzyści?',
      'Czy ekosystem partnerski jest oceniany pod kątem efektywności co najmniej raz w roku?',
    ],
    example:
      'Dowód: lista aktywnych umów partnerskich z datą ważności i KPI rezultatu. Protokół rocznego przeglądu ekosystemu partnerskiego przez zarząd. Projekt zrealizowany wspólnie z partnerem zewnętrznym z opisem podziału nakładów i korzyści.',
    suggestedTechnologies: ['CRM (partner management)', 'Contract Management System', 'Partnership Portal'],
  },
};

// ============================================================
// OŚ 6: CYBERBEZPIECZEŃSTWO (6A–6E, 6 poziomów kumulatywnych)
// ============================================================

// 6A — Strategia i Zarządzanie Ryzykiem
const axis6A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6A#1': {
    questions: [
      'Czy organizacja NIE posiada żadnej formalnej strategii lub polityki cyberbezpieczeństwa — tzn. reakcja na incydenty jest wyłącznie improwizowana?',
      'Czy decyzje dotyczące bezpieczeństwa IT podejmowane są doraźnie, bez jakiegokolwiek planu rocznego lub zatwierdzonego frameworku?',
      'Czy budżet na cyberbezpieczeństwo w ostatnich 12 miesiącach był wydawany "reaktywnie" (tylko po incydencie), a nie planowo?',
    ],
    example:
      'Dowód negatywny (potwierdzenie braku): brak dokumentu strategii bezpieczeństwa w rejestrze polityk firmy. Lub raport audytu IT wskazujący "brak polityki bezpieczeństwa" jako znalezisko.',
    suggestedTechnologies: ['(Brak — poziom wyjściowy)', 'Podstawowy antywirus', 'Firewall z pudełka'],
  },
  '6A#2': {
    questions: [
      'Czy organizacja przeprowadziła formalną analizę ryzyka cyberbezpieczeństwa w ciągu ostatnich 12 miesięcy, z udokumentowanym rejestrem ryzyk?',
      'Czy rejestr ryzyk zawiera opis zagrożenia, prawdopodobieństwo, wpływ i właściciela ryzyka — a nie tylko listę "na wszelki wypadek"?',
      'Czy wyniki analizy ryzyka były omawiane przez zarząd lub komitet ds. bezpieczeństwa?',
    ],
    example:
      'Dowód: rejestr ryzyk cyberbezpieczeństwa z datą przeprowadzenia, właścicielami ryzyk i statusem mitygacji. Protokół spotkania z omówieniem wyników analizy ryzyka.',
    suggestedTechnologies: ['Risk Management Platform (RSA Archer)', 'GRC Tool (ServiceNow GRC)', 'Spreadsheet + formalny framework (ISO 27005)'],
  },
  '6A#3': {
    questions: [
      'Czy organizacja ma udokumentowany plan działań w obszarze cyberbezpieczeństwa na co najmniej 12 miesięcy, wynikający z analizy ryzyka?',
      'Czy plan zawiera konkretne inicjatywy, właścicieli, terminy i budżety — a nie tylko "poprawić bezpieczeństwo"?',
      'Czy postęp realizacji planu jest raportowany co kwartał?',
    ],
    example:
      'Dowód: "Cyber Security Action Plan 2025" zatwierdzony przez zarząd z listą zadań, terminarzu i właścicielami. Raport kwartalny z statusem realizacji.',
    suggestedTechnologies: ['Project Portfolio Management', 'GRC Platform', 'ITSM (task tracking)'],
  },
  '6A#4': {
    questions: [
      'Czy organizacja ma wdrożone i zatwierdzone polityki bezpieczeństwa (co najmniej: polityka haseł, polityka dostępu, polityka BYOD, polityka kopii zapasowych)?',
      'Czy polityki są dostępne dla pracowników, a pracownicy potwierdzają zapoznanie się z nimi (np. podpis lub kliknięcie w systemie)?',
      'Czy polityki są przeglądane i aktualizowane co najmniej raz w roku?',
    ],
    example:
      'Dowód: zestaw polityk bezpieczeństwa z datą zatwierdzenia, datą ostatniego przeglądu i listą pracowników, którzy je zaakceptowali (raport z systemu). Dowód aktualizacji polityk w 2024 lub 2025.',
    suggestedTechnologies: ['Policy Management Platform (ConvergePoint)', 'ITSM', 'GRC Tool'],
  },
  '6A#5': {
    questions: [
      'Czy HR jest formalnie włączony w strategię cyberbezpieczeństwa — tzn. procesy onboardingu/offboardingu zawierają checklistę bezpieczeństwa, a szkolenia cyber są obowiązkowe?',
      'Czy istnieje procedura natychmiastowego odbierania dostępów rozstającemu się pracownikowi (max 24h od decyzji o rozwiązaniu)?',
      'Czy wyniki szkoleń bezpieczeństwa per pracownik są raportowane przez HR do działu IT/Security?',
    ],
    example:
      'Dowód: procedura offboardingu z checklistą i podpisem IT potwierdzającym odebranie dostępów. Raport ze szkoleń cyberbezpieczeństwa per pracownik (% ukończenia). SLA offboarding: X godzin do deaktywacji konta.',
    suggestedTechnologies: ['HRIS (offboarding module)', 'IAM (automated deprovisioning)', 'LMS (training completion tracking)'],
  },
  '6A#6': {
    questions: [
      'Czy organizacja przeprowadza regularne audyty cyberbezpieczeństwa (wewnętrzne lub zewnętrzne) co najmniej raz w roku, z udokumentowanymi wynikami i planem naprawczym?',
      'Czy wyniki audytów i testy (pentesty, phishing) są raportowane zarządowi jako metryka bezpieczeństwa?',
      'Czy analiza logów i zdarzeń bezpieczeństwa jest realizowana systematycznie, a nie tylko "po incydencie"?',
    ],
    example:
      'Dowód: raport z pentesta z datą, zakresem i planem naprawczym podpisanym przez CISO/CTO. Raport kwartalny dla zarządu z metrykami cyberbezpieczeństwa (liczba incydentów, MTTR, coverage szkoleń).',
    suggestedTechnologies: ['SIEM (Splunk, QRadar, Microsoft Sentinel)', 'Pentest Tools / External Audit', 'Security Dashboard (GRC)'],
  },
};

// 6B — Ochrona Sieci i Systemów
const axis6B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6B#1': {
    questions: [
      'Czy na obwodzie sieci firmowej działają zarządzane firewalle — nie tylko te "z routera ISP"?',
      'Czy reguły firewalla są udokumentowane i przeglądane co najmniej raz w roku?',
      'Czy firewall generuje logi, które są przechowywane i dostępne do analizy?',
    ],
    example:
      'Dowód: konfiguracja (dump) reguł firewalla z datą ostatniego przeglądu. Potwierdzenie aktywnego logowania z retencją ≥ 90 dni.',
    suggestedTechnologies: ['Next-Gen Firewall (Palo Alto, Fortinet, Cisco)', 'Firewall Log Management', 'Network Monitoring'],
  },
  '6B#2': {
    questions: [
      'Czy na wszystkich stacjach roboczych i serwerach zainstalowane jest centralne rozwiązanie antywirusowe/EDR zarządzane z jednej konsoli?',
      'Czy aktualizacje sygnatur/bazy antywirusowej są automatyczne i weryfikowane co najmniej codziennie?',
      'Czy konsola zarządzająca pokazuje w czasie rzeczywistym stan ochrony (ile urządzeń chronionych, ile alertów)?',
    ],
    example:
      'Dowód: raport z konsoli antywirusa / EDR pokazujący % coverage (cel: 100% urządzeń), ostatnią datę aktualizacji sygnatur i liczbę aktywnych alertów.',
    suggestedTechnologies: ['EDR/Antivirus (CrowdStrike, Microsoft Defender, SentinelOne)', 'Central Management Console', 'Endpoint Inventory'],
  },
  '6B#3': {
    questions: [
      'Czy w sieci działa system IDS (Intrusion Detection System) lub IPS wykrywający anomalie ruchu i zagrożenia wewnątrz sieci?',
      'Czy alerty z IDS/IPS są analizowane przez człowieka (nie tylko ignorowane) co najmniej raz dziennie?',
      'Czy w ostatnich 12 miesiącach IDS/IPS wykrył co najmniej jedno zdarzenie, które zostało udokumentowane i obsłużone?',
    ],
    example:
      'Dowód: raport z systemu IDS z ostatnich 30 dni: liczba alertów, kategorie, status obsługi. Przykładowy incident ticket z IDS → obsługa → zamknięcie.',
    suggestedTechnologies: ['IDS/IPS (Snort, Suricata, Cisco IPS)', 'Network Detection & Response (NDR)', 'SIEM (alert aggregation)'],
  },
  '6B#4': {
    questions: [
      'Czy organizacja wdrożyła SIEM korelujący zdarzenia z co najmniej 5 różnych źródeł (firewall, AD, endpoint, serwery, aplikacje)?',
      'Czy SIEM ma zdefiniowane reguły korelacji i alerty dla kluczowych scenariuszy ataku (np. brute force, lateral movement, data exfiltration)?',
      'Czy SIEM generuje raporty tygodniowe/miesięczne, które są przeglądane przez Security Analyst?',
    ],
    example:
      'Dowód: lista źródeł zasilających SIEM (connector list) + przykładowy raport tygodniowy z SIEM z alertami i ich statusem. Reguła korelacji dla scenariusza brute force w konfiguracji SIEM.',
    suggestedTechnologies: ['SIEM (Splunk, QRadar, Microsoft Sentinel, Elastic SIEM)', 'SOAR', 'Threat Intelligence Platform'],
  },
  '6B#5': {
    questions: [
      'Czy organizacja stosuje MFA (uwierzytelnianie wieloskładnikowe) dla co najmniej: dostępu do VPN, poczty, aplikacji krytycznych i konsol admin?',
      'Czy zarządzanie dostępami jest scentralizowane (np. Azure AD, Okta) z automatycznym provisioningiem/deprovisioningiem?',
      'Czy konta uprzywilejowane (admin) mają zasadę "least privilege" potwierdzoną przeglądem uprawnień co kwartał?',
    ],
    example:
      'Dowód: polityka MFA z listą systemów objętych wymogiem + raport z IdP (Azure AD/Okta) potwierdzający % użytkowników z MFA = 100% dla ról uprzywilejowanych. Protokół kwartalnego przeglądu uprawnień admin.',
    suggestedTechnologies: ['MFA (Microsoft Authenticator, Duo)', 'IAM (Azure AD, Okta, CyberArk)', 'PAM (Privileged Access Management)'],
  },
  '6B#6': {
    questions: [
      'Czy sieć jest segmentowana (co najmniej: strefa DMZ, sieć produkcyjna/OT oddzielona od biurowej, sieć gości izolowana)?',
      'Czy połączenia zdalne (pracownicy zdalni, partnerzy) przechodzą przez VPN z wymuszonym MFA i rejestrowaniem sesji?',
      'Czy w ciągu ostatnich 12 miesięcy przeprowadzono test segmentacji sieci (np. pentest) potwierdzający brak nieautoryzowanego ruchu między segmentami?',
    ],
    example:
      'Dowód: schemat sieci z zaznaczeniem stref/segmentów i reguł przepływu. Raport pentesta z testem segmentacji z datą i wynikiem. Logi VPN z ostatnich 30 dni z potwierdzeniem wymagania MFA dla każdej sesji.',
    suggestedTechnologies: ['Next-Gen Firewall (segmentation)', 'VPN (Cisco AnyConnect, Palo Alto GlobalProtect)', 'Network Access Control (NAC)', 'Pentest Tools'],
  },
};

// 6C — Ochrona Danych
const axis6C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6C#1': {
    questions: [
      'Czy organizacja stosuje szyfrowanie danych "at rest" dla co najmniej: dysków laptopów/stacji roboczych i baz danych z danymi wrażliwymi?',
      'Czy stosowane algorytmy szyfrowania są zgodne z aktualnym standardem (min. AES-256 lub odpowiednik)?',
      'Czy wdrożenie szyfrowania jest udokumentowane (jakie urządzenia, jaki algorytm, kto zarządza kluczami)?',
    ],
    example:
      'Dowód: polityka szyfrowania z listą objętych systemów i zastosowanymi algorytmami. Raport z narzędzia MDM/BitLocker potwierdzający % urządzeń z szyfrowaniem dysku = 100% dla laptopów.',
    suggestedTechnologies: ['Disk Encryption (BitLocker, FileVault)', 'Database Encryption (TDE)', 'Key Management Service (AWS KMS, HashiCorp Vault)'],
  },
  '6C#2': {
    questions: [
      'Czy organizacja ma formalną politykę haseł z wymaganiami minimalnej długości, złożoności i rotacji — i jest ona technicznie wymuszana?',
      'Czy hasła do systemów firmowych są przechowywane wyłącznie w postaci hash (nie plaintext) — potwierdzone przez audyt techniczny?',
      'Czy organizacja stosuje menedżer haseł lub vault dla haseł współdzielonych (serwerów, kont serwisowych)?',
    ],
    example:
      'Dowód: polityka haseł wbudowana w Active Directory (screen z ustawieniami: min 12 znaków, złożoność ON, wygaśnięcie 90 dni). Udokumentowany vault haseł dla kont serwisowych (np. CyberArk, 1Password Teams).',
    suggestedTechnologies: ['Active Directory / Azure AD (password policy)', 'Password Manager (CyberArk, 1Password Teams, Bitwarden)', 'PAM Tool'],
  },
  '6C#3': {
    questions: [
      'Czy dostęp do danych jest zarządzany przez role (RBAC) z zasadą minimalnych uprawnień, a każda rola jest udokumentowana?',
      'Czy przegląd uprawnień (access review) jest przeprowadzany co kwartał z udokumentowanym wynikiem i listą odebranych uprawnień?',
      'Czy logi dostępu do danych wrażliwych są zbierane i przechowywane przez co najmniej 90 dni?',
    ],
    example:
      'Dowód: macierz ról i uprawnień (RBAC matrix) z datą ostatniego przeglądu. Protokół access review Q1 2025 z listą zmian uprawnień. Potwierdzenie retencji logów dostępu = 90 dni (konfiguracja lub raport SIEM).',
    suggestedTechnologies: ['IAM (Role-Based Access Control)', 'Data Access Governance (Varonis, Netwrix)', 'SIEM (audit logging)'],
  },
  '6C#4': {
    questions: [
      'Czy organizacja ma wdrożone regularne kopie zapasowe kluczowych systemów z automatycznym harmonogramem i testami odtworzenia (co najmniej co kwartał)?',
      'Czy ostatni test odtworzenia backupu jest udokumentowany (data, czas odtworzenia, wynik)?',
      'Czy plan disaster recovery (DR) definiuje RTO (Recovery Time Objective) i RPO (Recovery Point Objective) per system i zostały one zweryfikowane testem?',
    ],
    example:
      'Dowód: polityka backupu z harmonogramem i listą objętych systemów. Protokół ostatniego testu DR: data, RTO osiągnięte X godzin (cel Y), RPO osiągnięte. Zrzut z systemu backup potwierdzający ostatnie wykonanie i wynik weryfikacji.',
    suggestedTechnologies: ['Backup Solution (Veeam, Commvault, Azure Backup)', 'DR Platform', 'Backup Monitoring Dashboard'],
  },
  '6C#5': {
    questions: [
      'Czy organizacja wdrożyła ciągłe monitorowanie anomalii w dostępie do danych (np. DLP, UEBA) z alertami w czasie rzeczywistym?',
      'Czy w ostatnich 6 miesiącach system detekcji wykrył co najmniej jedno podejrzane zdarzenie, które zostało obsłużone i udokumentowane?',
      'Czy alerty z systemu monitoringu danych trafiają do jednego centrum operacyjnego (SOC lub Security Analyst) z SLA na czas odpowiedzi?',
    ],
    example:
      'Dowód: konfiguracja DLP/UEBA z regułami wykrywającymi eksfiltrację i anomalie. Przykładowy incident ticket z wykryciem + obsługą. SLA dla alertów bezpieczeństwa: P1 = 30 min, P2 = 4h.',
    suggestedTechnologies: ['DLP (Data Loss Prevention — Microsoft Purview, Symantec)', 'UEBA (Splunk, Securonix)', 'SOC Platform'],
  },
  '6C#6': {
    questions: [
      'Czy organizacja stosuje wieloczynnikowe uwierzytelnianie tożsamości dla dostępu do danych krytycznych — np. certyfikaty klienckie, tokeny sprzętowe lub biometrię?',
      'Czy procesy weryfikacji tożsamości (np. dla kont uprzywilejowanych lub dostępu do danych PII) są udokumentowane i audytowane co kwartał?',
      'Czy organizacja wdrożyła "Zero Trust" dla dostępu do danych — tzn. każde żądanie dostępu jest weryfikowane niezależnie od lokalizacji sieci?',
    ],
    example:
      'Dowód: konfiguracja certyfikatów klienckich lub FIDO2/YubiKey dla ról admin. Polityka Zero Trust z listą systemów objętych. Raport z PAM Tool pokazujący 100% sesji uprzywilejowanych z nagraniem i weryfikacją tożsamości.',
    suggestedTechnologies: ['PKI / Certificate Management', 'FIDO2 / YubiKey', 'Zero Trust Network Access (Zscaler, Cloudflare Access)', 'PAM (CyberArk)'],
  },
};

// 6D — Edukacja i Jakość Systemów / Security Education and System Quality
const axis6D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6D#1': {
    questions: [
      'Czy organizacja ma udokumentowany opis systemu szkoleń z bezpieczeństwa — tzn. kto szkoli, jak często, z jakiego materiału i w jakiej formie?',
      'Czy szkolenie z bezpieczeństwa jest obowiązkowe dla nowych pracowników w ramach onboardingu?',
      'Czy istnieje rejestr przeszkoleń z bezpieczeństwa — lista pracowników i dat ukończenia?',
    ],
    example:
      'Dowód: polityka szkolenia z bezpieczeństwa informacji z opisem zakresu, formy i periodowności. Raport z LMS: lista pracowników i status ukończenia szkolenia onboardingowego (cel: 100% nowych pracowników).',
    suggestedTechnologies: ['LMS (szkolenia z bezpieczeństwa)', 'Onboarding Platform', 'HR Policy System'],
  },
  '6D#2': {
    questions: [
      'Czy plan wdrożenia szkoleń jest zróżnicowany formatowo (e-learning, szkolenie stacjonarne, symulacje phishingowe) i dostosowany do różnych grup pracowniczych?',
      'Czy harmonogram szkoleń z bezpieczeństwa na bieżący rok jest zatwierdzony i dostępny dla kierowników?',
      'Czy organizacja mierzy efektywność szkoleń (np. test wiedzy po szkoleniu z wynikiem min. 80%)?',
    ],
    example:
      'Dowód: plan szkoleń cyberbezpieczeństwa 2025 z harmonogramem, formatami i grupami docelowymi. Raport wyników testów wiedzy po szkoleniu (% pracowników z wynikiem ≥ 80%).',
    suggestedTechnologies: ['Security Awareness Platform (KnowBe4, Proofpoint Security Awareness)', 'LMS', 'Phishing Simulation Tool'],
  },
  '6D#3': {
    questions: [
      'Czy organizacja przeprowadza regularne testy bezpieczeństwa — np. symulacje phishingowe co najmniej 4× rocznie z mierzonym wskaźnikiem kliknięć?',
      'Czy wyniki testów bezpieczeństwa (phishing click rate, test wiedzy) są raportowane kierownictwu co kwartał?',
      'Czy pracownicy "oblani" testem phishingowym muszą przejść dodatkowe szkolenie uzupełniające?',
    ],
    example:
      'Dowód: raport z kampanii phishingowej (KnowBe4 lub Proofpoint): data, liczba odbiorców, % kliknięć (trend kwartalny). Polityka "failed phishing → mandatory retraining" z dowodem jej zastosowania.',
    suggestedTechnologies: ['Phishing Simulation (KnowBe4, Proofpoint SA)', 'Security Awareness Analytics', 'LMS (remedial training)'],
  },
  '6D#4': {
    questions: [
      'Czy organizacja ma wyznaczonych audytorów wewnętrznych ds. cyberbezpieczeństwa (nie tylko IT admini) z udokumentowanym zakresem odpowiedzialności?',
      'Czy audytorzy wewnętrzni przeprowadzili co najmniej jeden audyt w ciągu ostatnich 12 miesięcy z pisemnym raportem i planem naprawczym?',
      'Czy audytorzy wewnętrzni są niezależni od jednostek, które audytują (brak konfliktu interesów)?',
    ],
    example:
      'Dowód: opis stanowisk lub zakres obowiązków audytora wewnętrznego ds. cyberbezpieczeństwa. Raport z audytu wewnętrznego 2024/2025 z wykazem znalezisk i planem naprawczym. Schemat org potwierdzający niezależność raportowania.',
    suggestedTechnologies: ['GRC / Audit Management Tool', 'Internal Audit Platform (TeamMate, Auditboard)', 'Risk Register'],
  },
  '6D#5': {
    questions: [
      'Czy organizacja ma zatwierdzony roczny plan audytów cyberbezpieczeństwa (wewnętrznych i zewnętrznych) z terminami i zakresami?',
      'Czy plan audytów cyber jest powiązany z rejestrem ryzyk (audytuje się obszary wysokiego ryzyka priorytetowo)?',
      'Czy wyniki poprzednich audytów są śledzone w systemie, a status wdrożenia planów naprawczych jest raportowany zarządowi?',
    ],
    example:
      'Dowód: "Cyber Audit Plan 2025" z harmonogramem, zakresem i nazwiskiem osoby odpowiedzialnej za każdy audyt. Tracker wdrożenia recommendations z poprzednich audytów — % zamkniętych w terminie.',
    suggestedTechnologies: ['Audit Management Tool', 'GRC Platform', 'Risk-Based Audit Scheduling'],
  },
  '6D#6': {
    questions: [
      'Czy organizacja posiada certyfikację ISO 27001 lub jest w trakcie jej uzyskiwania z udokumentowanym planem osiągnięcia certyfikatu?',
      'Czy system ISMS (Information Security Management System) jest utrzymywany i doskonalony w trybie ciągłym (cykl PDCA) z dowodem przeglądu zarządczego co 12 miesięcy?',
      'Czy zewnętrzny audytor potwierdził zgodność z ISO 27001 lub równoważnym standardem w ostatnich 3 latach?',
    ],
    example:
      'Dowód: certyfikat ISO 27001 z datą wydania i zakresem. Lub harmonogram wdrożenia ISO 27001 z etapami i datami. Protokół zarządczego przeglądu ISMS (Management Review) z ostatnich 12 miesięcy.',
    suggestedTechnologies: ['ISMS Platform (Vanta, Drata, Tugboat Logic)', 'ISO 27001 Gap Assessment Tool', 'GRC (continuous compliance monitoring)'],
  },
};

// 6E — Plany Awaryjne / Contingency Plans (Reagowanie na Incydenty)
const axis6E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '6E#1': {
    questions: [
      'Czy organizacja przeprowadziła identyfikację zagrożeń i scenariuszy incydentów (np. ransomware, DDoS, wyciek danych, awaria systemu krytycznego)?',
      'Czy lista zagrożeń jest udokumentowana i powiązana z konkretnymi systemami/procesami organizacji?',
      'Czy identyfikacja zagrożeń była aktualizowana w ciągu ostatnich 12 miesięcy?',
    ],
    example:
      'Dowód: dokument "Threat Landscape" lub rozdział BIA (Business Impact Analysis) z listą zagrożeń, datą przeglądu i podpisem właściciela. Rejestr zagrożeń w narzędziu GRC.',
    suggestedTechnologies: ['Threat Modeling Tool (STRIDE, MITRE ATT&CK)', 'GRC / Risk Register', 'BIA Tool'],
  },
  '6E#2': {
    questions: [
      'Czy organizacja ma zdefiniowane priorytety reakcji na incydent — tzn. jasno określone, które systemy/dane muszą być przywrócone jako pierwsze?',
      'Czy priorytety są powiązane z krytycznością systemów dla biznesu (BIA) i mają przypisane RTO i RPO?',
      'Czy właściciele systemów krytycznych znają swoje RTO/RPO i potwierdzili to pisemnie?',
    ],
    example:
      'Dowód: dokument BIA (Business Impact Analysis) z macierzą krytyczności systemów i RTO/RPO per system, zatwierdzony przez właścicieli biznesowych. Przykład: "ERP — RTO 4h, RPO 1h; e-mail — RTO 8h, RPO 24h". Data zatwierdzenia.',
    suggestedTechnologies: ['BIA Tool', 'DR Planning Platform (Fusion Risk Management)', 'CMDB (ServiceNow)'],
  },
  '6E#3': {
    questions: [
      'Czy organizacja posiada udokumentowane procedury postępowania z incydentami — co najmniej dla scenariuszy: ransomware, phishing z ofiarą, awaria krytycznego systemu?',
      'Czy procedury definiują: kto powiadamia (eskalacja), kto decyduje (RACI), w jakim czasie, jakim kanałem?',
      'Czy procedury są dostępne offline (wydrukowane lub na nośniku lokalnym) — na wypadek ataku paraliżującego sieć?',
    ],
    example:
      'Dowód: dokument "Incident Response Playbook" z procedurami per scenariusz (ransomware, phishing, awaria systemu), datą zatwierdzenia i potwierdzeniem dostępności offline (wydruk lub USB). RACI dla co najmniej scenariusza ransomware.',
    suggestedTechnologies: ['SOAR (playbooks — Palo Alto XSOAR, Splunk SOAR)', 'Incident Management (PagerDuty, Jira)', 'Offline dokumentacja (PDF/USB)'],
  },
  '6E#4': {
    questions: [
      'Czy organizacja przeprowadza regularne szkolenia z reagowania na incydenty — co najmniej tablicowe (tabletop exercise) raz w roku?',
      'Czy w szkoleniach uczestniczy nie tylko IT, ale też przedstawiciele biznesu, prawny i komunikacji/PR?',
      'Czy szkolenia są udokumentowane (lista uczestników, scenariusz, wyniki, wnioski)?',
    ],
    example:
      'Dowód: protokół tabletop exercise z 2024/2025: scenariusz (np. "ransomware na ERP"), lista uczestników (IT + Prezes + Prawnik + PR), wnioski i action items. Dowód wdrożenia co najmniej jednego wniosku po szkoleniu.',
    suggestedTechnologies: ['Tabletop Exercise Platform (Cybereason, AttackIQ)', 'SOAR (simulation)', 'Learning Management System'],
  },
  '6E#5': {
    questions: [
      'Czy organizacja przeprowadziła co najmniej jeden pełny test planu awaryjnego (full DR drill lub red team exercise) w ciągu ostatnich 12 miesięcy — z udokumentowanym wynikiem?',
      'Czy test obejmował faktyczne odtworzenie systemów z backupu (nie tylko ćwiczenie na kartce) z pomiarem czasu odtworzenia vs. RTO?',
      'Czy wyniki testu pokazały, że RTO/RPO zostały osiągnięte — jeśli nie, czy jest plan naprawczy?',
    ],
    example:
      'Dowód: raport z DR drill 2024/2025 z: scenariuszem, datą, czasem odtworzenia systemu X = Y godzin (cel: Z godzin), listą uczestników i planem naprawczym dla nieosiągniętych RTO.',
    suggestedTechnologies: ['DR Testing Platform (Zerto, Veeam DR Orchestrator)', 'Red Team / Pentest Tools', 'Backup & Recovery Monitoring'],
  },
  '6E#6': {
    questions: [
      'Czy po każdym incydencie (lub teście) przeprowadzana jest formalna retrospekcja (post-mortem) z udokumentowanymi wnioskami i terminowymi action items?',
      'Czy procedury reagowania na incydenty są aktualizowane na podstawie wniosków z real incydentów i testów — co najmniej raz w roku?',
      'Czy metryki jakości reagowania (MTTR, MTTD, closure rate) są raportowane zarządowi jako stały KPI bezpieczeństwa?',
    ],
    example:
      'Dowód: rejestr post-mortem incydentów z ostatnich 12 miesięcy (co najmniej 3 wpisy) z wykazem wniosków i statusem wdrożenia action items. Raport kwartalny dla zarządu z metrykami MTTR/MTTD per kategoria incydentu.',
    suggestedTechnologies: ['Incident Management Platform (PagerDuty, Jira)', 'Post-Mortem Tool (Blameless, Rootly)', 'Security Metrics Dashboard (SIEM/GRC)'],
  },
};

// ============================================================
// OŚ 7: DOJRZAŁOŚĆ AI (7A–7E, 5 poziomów)
// ============================================================

// 7A — Dane i Fundamenty AI
const axis7A: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7A#1': {
    questions: [
      'Czy dane niezbędne do planowanego przypadku użycia AI istnieją wyłącznie w arkuszach Excela lub lokalnych plikach pracowników, bez jednolitego źródła prawdy?',
      'Czy przygotowanie danych do analizy wymaga ręcznego zbierania z co najmniej 3 różnych systemów/osób i zajmuje > 1 dzień pracy?',
      'Czy organizacja jest świadoma, że brak ujednoliconych danych jest główną barierą wdrożenia AI — i zostało to udokumentowane (np. w diagnozie, raporcie IT)?',
    ],
    example:
      'Dowód negatywny (potwierdzenie poziomu 1): wyniki ankiety wewnętrznej lub wywiadu z działem danych wskazujące, że brak zunifikowanych danych blokuje projekty AI. Lub raport IT z listą rozproszonych źródeł danych.',
    suggestedTechnologies: ['(Punkt startowy)', 'Data Inventory / Data Map', 'Master Data Management (MDM) — plan wdrożenia'],
  },
  '7A#2': {
    questions: [
      'Czy dane w kluczowych systemach (ERP, CRM, MES lub analogicznych) są ustrukturyzowane i spójne wewnętrznie — tzn. te same kody, taksonomia, formaty dat?',
      'Czy transfer danych między systemami odbywa się przez zdefiniowany export/import (choćby manualny), a nie wyłącznie telefonicznie lub e-mailem?',
      'Czy organizacja zidentyfikowała, które systemy zawierają dane o najwyższej wartości dla potencjalnych projektów AI?',
    ],
    example:
      'Dowód: lista kluczowych systemów z opisem struktury danych (schematy tabel lub ERD). Potwierdzenie, że dane ERP używają spójnych kodów klientów i produktów. Mapa systemów z zaznaczonymi przepływami danych (nawet ręcznymi).',
    suggestedTechnologies: ['ERP / CRM / MES (z modułem eksportu danych)', 'Data Dictionary', 'ETL Tool (nawet podstawowy — Talend Open Studio)'],
  },
  '7A#3': {
    questions: [
      'Czy organizacja ma centralne repozytorium danych (data warehouse, data lake lub platforma chmurowa) zasilane automatycznie z co najmniej 3 systemów źródłowych?',
      'Czy pierwsze modele ML lub projekty predykcyjne działają na danych z tego repozytorium (nawet jako pilot)?',
      'Czy dane w repozytorium są aktualizowane co najmniej raz dziennie bez ręcznej interwencji?',
    ],
    example:
      'Dowód: opis architektury data warehouse/lake z listą źródeł, częstotliwością zasilania i datą uruchomienia. Raport z pierwszego projektu ML / pilotażu predykcji z opisem danych wejściowych i wyników.',
    suggestedTechnologies: ['Data Warehouse (Snowflake, BigQuery, Azure Synapse)', 'ETL/ELT (dbt, Airbyte, Azure Data Factory)', 'ML Platform (Azure ML, Databricks)'],
  },
  '7A#4': {
    questions: [
      'Czy organizacja ma wdrożone procesy zarządzania jakością danych (data quality checks) z automatycznym alertowaniem przy odchyleniach?',
      'Czy dane są dostępne dla modeli AI w czasie zbliżonym do rzeczywistego (latencja < 1 godzina dla kluczowych strumieni)?',
      'Czy katalog danych (data catalog) dokumentuje dostępne zestawy danych, właścicieli i definicje — i jest aktywnie używany przez data scientistów?',
    ],
    example:
      'Dowód: konfiguracja DQ checks w narzędziu (Great Expectations, dbt tests) z raportem z ostatnich 30 dni — liczba sprawdzeń, % passed, alerty. Data catalog (Alation, DataHub) z liczbą wpisów i datą ostatniej aktualizacji.',
    suggestedTechnologies: ['Data Quality Tool (Great Expectations, Monte Carlo)', 'Data Catalog (Alation, DataHub, Apache Atlas)', 'Real-time Streaming (Kafka, Kinesis)'],
  },
  '7A#5': {
    questions: [
      'Czy przygotowanie danych dla nowego modelu AI (od surowych danych do gotowego datasetu treningowego) jest w pełni zautomatyzowane i zajmuje < 1 dzień?',
      'Czy organizacja stosuje podejście "data as a product" — tzn. zestawy danych mają właścicieli, SLA dostępności, dokumentację i wersjonowanie?',
      'Czy systemy danych samodzielnie wykrywają anomalie, uzupełniają luki i optymalizują przepływy bez ręcznej interwencji?',
    ],
    example:
      'Dowód: pipeline ML z automatycznym feature engineering, udokumentowany w MLflow lub analogicznym narzędziu, z metrykami: czas od danych do gotowego modelu = X godzin. Przykład "data product" z SLA i właścicielem w katalogu danych.',
    suggestedTechnologies: ['MLOps Platform (MLflow, Kubeflow, SageMaker)', 'Feature Store (Feast, Tecton)', 'DataOps Automation (Monte Carlo, Atlan)', 'Data Product Framework'],
  },
};

// 7B — Procesy Wspierane przez AI
const axis7B: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7B#1': {
    questions: [
      'Czy przypadki użycia AI w organizacji są izolowane i eksperymentalne — tzn. nie są wbudowane w żaden kluczowy proces biznesowy?',
      'Czy pracownicy korzystają z narzędzi AI (np. ChatGPT, Copilot, narzędzia OCR) prywatnie lub bez wiedzy organizacji?',
      'Czy organizacja nie ma żadnego rejestru projektów AI ani przypadków użycia AI?',
    ],
    example:
      'Dowód negatywny lub ankieta pracownicza z pytaniem "Czy używasz narzędzi AI w pracy?" — odpowiedź "tak, ale nie oficjalnie" u > 30% wskazuje na poziom 1. Brak rejestru projektów AI w systemie zarządzania projektami.',
    suggestedTechnologies: ['(Punkt startowy — brak formalnych wdrożeń)', 'Shadow IT Discovery Tool', 'AI Use Case Registry (plan)'],
  },
  '7B#2': {
    questions: [
      'Czy AI jest oficjalnie wdrożone w co najmniej jednym procesie wspomagającym (np. automatyczne streszczanie dokumentów, planowanie spotkań, generowanie raportów)?',
      'Czy pracownicy korzystający z AI-assisted tools zostali przeszkoleni i mają dostęp do licencjonowanych narzędzi firmowych?',
      'Czy efektywność AI-assisted procesów jest mierzona (np. czas oszczędzony per tydzień per pracownik)?',
    ],
    example:
      'Dowód: wdrożenie Microsoft Copilot lub analogicznego narzędzia z liczbą użytkowników, datą uruchomienia i mierzonym efektem (np. "X minut/tydzień zaoszczędzonych na sporządzaniu notatek ze spotkań" — raport z analytics).',
    suggestedTechnologies: ['Microsoft Copilot / Google Duet AI', 'Document AI (AWS Textract)', 'Meeting Summary AI (Otter.ai, Fireflies)', 'No-code Automation (Zapier + AI)'],
  },
  '7B#3': {
    questions: [
      'Czy AI dostarcza rekomendacje operacyjne (np. prognoza popytu, scoring ryzyka kredytowego, rekomendacja akcji konserwacyjnej) wbudowane w co najmniej jeden kluczowy proces?',
      'Czy pracownicy podejmują decyzje na podstawie rekomendacji AI i jest to udokumentowane (nie "wiedzą, że model istnieje")?',
      'Czy modele AI dostarczające rekomendacje są walidowane i monitorowane (wiadomo, z jaką dokładnością działają)?',
    ],
    example:
      'Dowód: screen z narzędzia biznesowego pokazujący rekomendację AI (np. "Model predykcji popytu: zalecana ilość zamówienia X szt.") + raport z historią decyzji podjętych na podstawie tej rekomendacji. Metryka dokładności modelu (accuracy/MAE).',
    suggestedTechnologies: ['ML Models in Production (Azure ML, SageMaker)', 'Decision Intelligence Platform', 'Demand Forecasting (Anaplan, O9)', 'Predictive Maintenance (Uptake, SparkCognition)'],
  },
  '7B#4': {
    questions: [
      'Czy AI wykonuje autonomicznie co najmniej jeden element procesu biznesowego bez udziału człowieka — a człowiek jedynie zatwierdza wynik lub nadzoruje wyjątki?',
      'Czy "human in the loop" jest zdefiniowany: wiadomo kiedy człowiek musi interweniować i jaki jest czas reakcji na exception?',
      'Czy poziom automatyzacji jest mierzony (% przypadków obsłużonych automatycznie vs. przekazanych do człowieka)?',
    ],
    example:
      'Dowód: opis procesu z zaznaczonym krokiem AI-autonomicznym i punktem escalacji do człowieka. Raport: 85% zamówień zakupowych generowanych automatycznie, 15% przekazanych do zatwierdzenia (z powodów: X, Y, Z). RPA/AI workflow configuration.',
    suggestedTechnologies: ['RPA + AI (UiPath, Blue Prism, Automation Anywhere)', 'Process Orchestration Platform', 'Human-in-the-Loop Platform (Scale AI, Labelbox)', 'BPM with AI Decision Nodes'],
  },
  '7B#5': {
    questions: [
      'Czy procesy kluczowe dla biznesu działają w trybie w pełni autonomicznym — AI zarządza, optymalizuje i eskaluje wyjątki bez rutynowego udziału człowieka?',
      'Czy organizacja mierzy efektywność autonomicznych procesów AI w kategoriach biznesowych (koszt/szt., czas cyklu, wskaźnik błędów)?',
      'Czy architektura systemów jest zaprojektowana tak, żeby AI mogła autonomicznie reagować na zmiany w środowisku (np. zmiana popytu → automatyczna aktualizacja planu)?',
    ],
    example:
      'Dowód: opis architektury procesu end-to-end z AI orchestration (np. planowanie produkcji w pełni AI-driven). Raport biznesowy: "koszt obsługi procesu X przed AI: Y PLN/szt.; po AI: Z PLN/szt." z datą. Diagram systemu z closed-loop feedback.',
    suggestedTechnologies: ['Autonomous Process Orchestration (Celonis)', 'Agentic AI Frameworks (LangGraph, AutoGen)', 'MLOps + Real-time Decision Engine', 'Digital Twin (Siemens, ANSYS)'],
  },
};

// 7C — AI w Produktach i Usługach
const axis7C: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7C#1': {
    questions: [
      'Czy produkty lub usługi organizacji nie zawierają żadnych komponentów AI ani predykcji — wartość pochodzi wyłącznie z tradycyjnych funkcji?',
      'Czy roadmapa produktu na najbliższe 12 miesięcy nie uwzględnia wdrożenia żadnej funkcji AI?',
      'Czy klienci nie zgłaszają oczekiwań dotyczących AI w produktach (lub organizacja nie monitoruje takich sygnałów)?',
    ],
    example:
      'Dowód negatywny: roadmapa produktu 2025 bez pozycji "AI feature". Wyniki badania potrzeb klientów bez pytania o AI. Potwierdzenie braku komponentu AI w architekturze technicznej produktu.',
    suggestedTechnologies: ['(Punkt startowy)', 'Product Roadmap Tool (Productboard)', 'Customer Feedback Platform'],
  },
  '7C#2': {
    questions: [
      'Czy produkt/usługa zawiera co najmniej jeden komponent AI (rekomendacja, wyszukiwanie semantyczne, analiza sentymentu, chatbot) wdrożony produkcyjnie dla klientów?',
      'Czy funkcja AI jest używana przez > 20% aktywnych klientów co najmniej raz w miesiącu?',
      'Czy efekt biznesowy funkcji AI jest mierzony (np. wzrost konwersji, wzrost NPS, redukcja zgłoszeń do supportu)?',
    ],
    example:
      'Dowód: screen z interfejsu produktu pokazujący funkcję AI (np. "Polecane dla Ciebie"). Analytics: 35% użytkowników korzysta z rekomendacji, wpływ na konwersję +8%. A/B test z datą i wynikami.',
    suggestedTechnologies: ['Recommendation Engine (Recombee, AWS Personalize)', 'Semantic Search (Elastic, Pinecone)', 'Chatbot Platform (Dialogflow, Microsoft Bot Framework)', 'Product Analytics (Mixpanel, Amplitude)'],
  },
  '7C#3': {
    questions: [
      'Czy AI jest kluczowym elementem architektury produktu — tzn. usunięcie AI uniemożliwiłoby działanie głównych funkcji?',
      'Czy produkt personalizuje się dla każdego użytkownika na podstawie danych w czasie rzeczywistym?',
      'Czy AI jest źródłem różnicowania od konkurencji — tzn. klienci wybierają produkt między innymi ze względu na AI?',
    ],
    example:
      'Dowód: dokument architektury technicznej z zaznaczonym komponentem AI jako centralnym. Badanie klientów: "Dlaczego wybrałeś nasz produkt?" z AI wymienianym w top 3 powodów. Mapa personalizacji: które elementy UI/UX zmieniają się per użytkownik.',
    suggestedTechnologies: ['Real-time ML Inference (Redis AI, TensorFlow Serving)', 'Personalization Engine (Dynamic Yield, Braze)', 'Feature Flags + ML (LaunchDarkly)', 'Vector Database (Pinecone, Weaviate)'],
  },
  '7C#4': {
    questions: [
      'Czy AI napędza główną logikę produktu i dynamicznie adaptuje zachowanie produktu na podstawie danych użytkownika i rynkowych?',
      'Czy produkt uczy się ciągle i poprawia się bez ręcznych aktualizacji modeli przez człowieka (continuous learning)?',
      'Czy klienci indywidualnie odczuwają, że produkt "rozumie" ich potrzeby i działa inaczej niż dla innych użytkowników?',
    ],
    example:
      'Dowód: opis architektury continuous learning pipeline z datami retrenowania modelu i metrykami (np. "model retrenowany co 7 dni, accuracy wzrosła z 78% do 84% w 6 miesięcy"). Case study klienta opisujące personalizację w akcji.',
    suggestedTechnologies: ['Online Learning / Continuous ML (River, Vowpal Wabbit)', 'MLOps (Kubeflow, MLflow)', 'Real-time Feature Store (Tecton)', 'A/B Testing for ML (Optimizely)'],
  },
  '7C#5': {
    questions: [
      'Czy organizacja oferuje produkt lub usługę, która nie mogłaby istnieć bez AI — tzn. AI definiuje cały model wartości?',
      'Czy w portfoliu firmy istnieje co najmniej jeden produkt AI-native wygenerowany przychód lub oszczędności mierzone w skali roku?',
      'Czy firma ma roadmapę produktów AI-native na 3–5 lat, powiązaną ze strategią i zasobami?',
    ],
    example:
      'Dowód: opis produktu AI-native (np. autonomiczny agent analityczny, platforma predykcyjna) z przychodem za 2024/2025 i opisem wartości biznesowej dla klientów. Roadmapa 2025–2028 zatwierdzona przez zarząd z milestones AI.',
    suggestedTechnologies: ['Agentic AI Products (LLM-based Agents)', 'Digital Twin Platform', 'Autonomous Analytics (ThoughtSpot, Tableau Pulse)', 'AI Platform as a Product (custom LLM fine-tuning)'],
  },
};

// 7D — Governance, Bezpieczeństwo i Etyka AI
const axis7D: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7D#1': {
    questions: [
      'Czy pracownicy korzystają z narzędzi AI (ChatGPT, Copilot, Midjourney itp.) bez żadnej firmowej polityki definiującej co wolno, na jakich danych i z jakimi ograniczeniami?',
      'Czy organizacja jest nieświadoma, jakie narzędzia AI są używane przez pracowników i jakie dane do nich trafiają?',
      'Czy brak polityki AI był wskazany jako ryzyko przez dział prawny lub IT w ostatnich 12 miesiącach?',
    ],
    example:
      'Dowód negatywny: brak dokumentu "AI Usage Policy" w rejestrze polityk. Lub wynik Shadow IT Discovery wskazujący na nieautoryzowane narzędzia AI. Notatka prawna z flagą "brak polityki AI = ryzyko RODO/tajemnicy handlowej".',
    suggestedTechnologies: ['Shadow IT Discovery (Netskope, Zscaler CASB)', 'AI Policy Template', 'Legal Risk Assessment Tool'],
  },
  '7D#2': {
    questions: [
      'Czy organizacja ma udokumentowaną politykę użycia AI — co wolno, na jakich danych, jakie narzędzia są dopuszczone?',
      'Czy polityka AI jest dostępna dla pracowników i zostali o niej poinformowani (dowód komunikacji)?',
      'Czy polityka rozróżnia kategorie danych i poziomy ryzyka — tzn. dane klientów nie mogą trafiać do zewnętrznych LLM bez kontroli?',
    ],
    example:
      'Dowód: dokument "AI Usage Policy" z datą zatwierdzenia, listą dopuszczonych narzędzi i zakazem przetwarzania danych wrażliwych w nieautoryzowanych narzędziach. Potwierdzenie komunikacji do pracowników (e-mail, LMS).',
    suggestedTechnologies: ['Policy Management Platform', 'LMS (szkolenie z polityki AI)', 'CASB (Cloud Access Security Broker — kontrola narzędzi AI)', 'AI Governance Framework (NIST AI RMF)'],
  },
  '7D#3': {
    questions: [
      'Czy organizacja ma formalne procesy zatwierdzania projektów AI — z rejestrem przypadków użycia, oceną ryzyka i wymaganym approvalem przed wdrożeniem?',
      'Czy istnieje dedykowana rola lub komitet (AI Officer, AI Committee) odpowiedzialny za governance AI w firmie?',
      'Czy modele AI są wersjonowane i audytowane — tzn. wiadomo, która wersja modelu działa na produkcji i kiedy była ostatnio sprawdzona?',
    ],
    example:
      'Dowód: rejestr projektów AI z kolumnami: opis, ocena ryzyka, decydent, data approvalem, status. Karta powołania AI Committee lub opis roli AI Officer. Repozytorium modeli (MLflow) z historią wersji dla modeli produkcyjnych.',
    suggestedTechnologies: ['AI Governance Platform (IBM OpenScale, Fiddler AI)', 'MLflow Model Registry', 'GRC Tool (ryzyko AI)', 'AI Committee Charter Template'],
  },
  '7D#4': {
    questions: [
      'Czy modele AI w produkcji są monitorowane pod kątem dryfu (data drift, concept drift) z automatycznym alertem przy przekroczeniu progu?',
      'Czy organizacja przeprowadza regularne testy bezpieczeństwa modeli AI (adversarial testing, prompt injection dla LLM)?',
      'Czy modele AI są traktowane jak systemy krytyczne — tzn. mają SLA dostępności, plany rollback i monitoring 24/7?',
    ],
    example:
      'Dowód: konfiguracja monitoringu modelu w narzędziu (Evidently AI, Fiddler) z przykładowym alertem driftu i akcją podjętą przez zespół. Raport testu bezpieczeństwa LLM (prompt injection test) z datą. SLA dla modelu predykcyjnego w produkcji.',
    suggestedTechnologies: ['ML Monitoring (Evidently AI, Whylogs, Fiddler AI)', 'LLM Security Testing (Garak, Promptfoo)', 'MLOps with Auto-Retrain Pipelines', 'Model SLA & On-call Setup'],
  },
  '7D#5': {
    questions: [
      'Czy governance AI jest zautomatyzowane i wbudowane w systemy — tzn. nie wymaga ręcznych checklistów, bo narzędzia egzekwują polityki automatycznie?',
      'Czy organizacja może zademonstrować audytorom zewnętrznym transparentność modeli AI (wyjaśnialność decyzji, dokumentacja biasów, rejestr incydentów AI)?',
      'Czy firma ma formalną radę etyki AI lub udokumentowane zasady etycznego AI z mierzalnymi zobowiązaniami i corocznym raportem?',
    ],
    example:
      'Dowód: raport transparentności AI (AI Transparency Report) za 2024/2025 z sekcjami: wyjaśnialność, biasy, incydenty, governance. Automatyczne guardrails w pipeline\'ach modelowania (np. automatyczne sprawdzenie fairness przed deploym). Skład i mandat Rady Etyki AI.',
    suggestedTechnologies: ['Responsible AI Platform (Azure AI Fairness, IBM AI Fairness 360)', 'LLM Guardrails (Guardrails.ai, NVIDIA NeMo Guardrails)', 'Explainability Tool (SHAP, LIME)', 'AI Ethics Board Governance Framework'],
  },
};

// 7E — Kompetencje i Kultura AI
const axis7E: Partial<Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>> = {
  '7E#1': {
    questions: [
      'Czy większość pracowników (> 70%) nigdy nie korzystała z narzędzi AI w pracy i nie jest świadoma możliwości AI w swoim obszarze?',
      'Czy organizacja nie prowadzi żadnych szkoleń z AI ani nie ma planu budowania kompetencji AI?',
      'Czy słowo "AI" na spotkaniach wywołuje głównie skeptycyzm lub obawę — nie ciekawość?',
    ],
    example:
      'Dowód: wyniki ankiety pracowniczej z pytaniem "Czy używasz AI w pracy?" — < 20% odpowiedzi "tak". Brak pozycji "szkolenia AI" w planie HR 2025. Wynik badania nastrojów: AI kojarzone z "zagrożeniem dla pracy" przez > 50% respondentów.',
    suggestedTechnologies: ['Employee Survey Tool', 'Skills Assessment Platform', '(plan budowy kompetencji)'],
  },
  '7E#2': {
    questions: [
      'Czy co najmniej 10–20% pracowników używa narzędzi AI samodzielnie (niekoniecznie oficjalnie) i eksperymentuje z nimi?',
      'Czy w firmie jest co najmniej jedna osoba (nieformalny "AI enthusiast") znana jako osoba do pytania o AI — nawet bez oficjalnej roli?',
      'Czy organizacja zaczęła dokumentować przypadki użycia AI znalezione przez pracowników, nawet nieformalnie?',
    ],
    example:
      'Dowód: lista "AI champions" lub entuzjastów AI zidentyfikowanych przez HR w ostatnich 6 miesiącach. Lub wyniki ankiety: 15% pracowników deklaruje regularne korzystanie z AI bez firmowego szkolenia. Wewnętrzny post/prezentacja o zastosowaniu AI przez pracownika.',
    suggestedTechnologies: ['Microsoft Copilot (pilotaż)', 'ChatGPT / Claude (personal use)', 'AI Community Platform (Slack channel, Teams)'],
  },
  '7E#3': {
    questions: [
      'Czy organizacja prowadzi ustrukturyzowany program szkoleń z AI dla pracowników — z curriculum, harmonogramem i wyznaczoną rolą "AI Champion" na każdy dział?',
      'Czy pierwsze projekty AI zakończone sukcesem są udokumentowane i komunikowane wewnętrznie jako dowód realnych korzyści?',
      'Czy co najmniej 40% pracowników ukończyło podstawowe szkolenie z AI w ciągu ostatnich 12 miesięcy (potwierdzone raportem z LMS)?',
    ],
    example:
      'Dowód: program szkoleń AI 2025 (curriculum: AI Basics → Prompt Engineering → AI w mojej roli) z harmonogramem i completion rate = 45% po 6 miesiącach (raport LMS). Case study: "Jak dział sprzedaży zaoszczędził 3h/tydzień dzięki AI".',
    suggestedTechnologies: ['AI Training Platform (Coursera for Business, DataCamp)', 'LMS (training tracking)', 'AI Champions Program Framework', 'Microsoft Copilot Adoption Kit'],
  },
  '7E#4': {
    questions: [
      'Czy pracownicy samodzielnie budują proste automacje i przepływy AI (np. w Microsoft Power Automate + Copilot, Zapier + GPT) bez wsparcia IT?',
      'Czy podnoszenie kwalifikacji AI jest wbudowane w rutynę pracy (np. "learning sprint" raz w miesiącu, wewnętrzne webinary AI)?',
      'Czy co najmniej 60% pracowników deklaruje, że AI pomaga im pracować szybciej lub lepiej (badanie pulsu)?',
    ],
    example:
      'Dowód: galeria wewnętrznych automacji AI stworzonych przez pracowników (liczba, typy procesów). Raport z badania "AI Adoption Survey": 65% pracowników używa AI codziennie, 60% deklaruje pozytywny wpływ na efektywność. Agenda "AI Day" lub miesięczny webinar AI z attendance.',
    suggestedTechnologies: ['Microsoft Power Automate + Copilot', 'Zapier + AI Actions', 'Low-code AI Tools (Bubble AI, Glide)', 'AI Adoption Analytics (Microsoft Viva Insights)'],
  },
  '7E#5': {
    questions: [
      'Czy pracownicy zarządzają agentami AI wykonującymi zadania operacyjne — tzn. zadania delegowane do AI, a pracownik nadzoruje wyniki i obsługuje wyjątki?',
      'Czy organizacja mierzy "AI ROI" per rola lub dział (czas zaoszczędzony, błędy wyeliminowane, przychód wygenerowany przez AI)?',
      'Czy nowi pracownicy są od razu onboardowani do pracy z AI jako standardu — nie jako opcji?',
    ],
    example:
      'Dowód: przykład agenta AI zarządzającego procesem (np. agent obsługi zamówień) z opisem roli pracownika = supervisor, nie executor. Raport "AI ROI 2025": dział X zaoszczędził Y PLN dzięki AI. Onboarding checklist nowego pracownika z pozycją "konfiguracja agentów AI".',
    suggestedTechnologies: ['Agentic AI Platforms (Microsoft Copilot Studio, Salesforce Agentforce)', 'AI ROI Measurement (Viva Insights, custom analytics)', 'AI-first Onboarding Program', 'Multi-agent Orchestration (LangGraph, AutoGen)'],
  },
};

// ============================================================
// EKSPORT — KOMPLET OVERRIDES DLA OSI 5–7
// ============================================================

export const DRD_KNOWLEDGE_OVERRIDES_AXIS_5_TO_7: Partial<
  Record<DRDAreaLevelKey, Partial<DRDLevelKnowledge>>
> = {
  ...axis5A,
  ...axis5B,
  ...axis5C,
  ...axis5D,
  ...axis5E,
  ...axis6A,
  ...axis6B,
  ...axis6C,
  ...axis6D,
  ...axis6E,
  ...axis7A,
  ...axis7B,
  ...axis7C,
  ...axis7D,
  ...axis7E,
};
