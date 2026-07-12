/**
 * SPEC-Q content fixture — DRD Axis 5 "Kultura Transformacji" (5A–5E).
 *
 * ONE StandardQuestionModel per obszar (inputType: 'level'), sourced from:
 *   - src/services/drdStructure.ts            → AXIS_5_CULTURE (level.title / level.description)
 *   - src/services/assessmentKnowledge/drdKnowledgeOverridesAxis5To7.ts
 *       → per-key `{obszar}#{poziom}` (questions[] behavioralne, example-dowód,
 *         suggestedTechnologies)
 *
 * NEW field vs. the two source files: `boundaryVsPrev` on every rung — one
 * sentence articulating what changes vs. the rung below (scope / durability /
 * ownership / systematicness), derived STRICTLY from contrasting the two
 * `description` strings in drdStructure — no new concepts introduced.
 *
 * Special case — 5A "Postawy przywódcze": drdStructure explicitly documents
 * this as a TYPOLOGY of leadership styles, not an increasing maturity scale
 * ("to skala typów, nie rosnąca dojrzałość — oceniaj typ dominujący i 1–2
 * wspierające"). `boundaryVsPrev` for 5A therefore describes what changes
 * BETWEEN types (not "better"), consistent with that source note.
 *
 * `hint` / `exampleAnswer` (top-level, one per obszar) are synthesized from
 * the common thread across the 6 rungs' `questions[]` in the overrides file:
 * every rung's behavioral questions ask for a documented ARTIFACT, not a
 * self-assessment — so the hint pushes toward evidence, and exampleAnswer
 * gives one concrete contrast (worked micro-example) in that same spirit.
 *
 * `evidencePrompt` is a generic pointer to "the artifact type documented at
 * the chosen rung" — grounded in the fact every rung's `example` in the
 * overrides file is itself an artifact description (protocol, budget line,
 * registry, dashboard screenshot, contract...), not invented per-client detail.
 */
import type { StandardQuestionModel } from '../../src/components/standard/StandardQuestion';

// ── 5A — Postawy przywódcze / Leadership Attitudes (TYPOLOGIA, nie drabinka) ──
export const Q_5A: StandardQuestionModel = {
  id: 'drd_axis5_5a',
  text: 'Jaki styl przywództwa dominuje dziś w decyzjach o transformacji cyfrowej?',
  context:
    'Ten obszar ocenia TYP przywództwa, nie rosnącą dojrzałość — styl dominującego lidera (i 1–2 wspierające) wyznacza tempo, ryzyko i jakość całego programu zmiany.',
  hint: 'Wybierz typ, który najlepiej opisuje DOMINUJĄCE, udokumentowane zachowanie lidera w ostatnich 12 miesiącach (protokoły, budżety, agendy) — nie deklarowaną wartość ani intencję.',
  exampleAnswer:
    'Jeśli lider deklaruje otwartość na zmianę, ale w ostatnim roku odrzucił co najmniej 2 wnioski budżetowe bez uzasadnienia merytorycznego — to Autokratyczny (2), nie Wspierający (4).',
  evidencePrompt:
    'Podłącz dokument potwierdzający wybrany typ — protokół posiedzeń zarządu, rejestr decyzji budżetowych, wynik badania bezpieczeństwa psychologicznego lub listę inicjatyw innowacyjnych z ROI.',
  inputType: 'level',
  aiDeepDiveEnabled: true,
  levels: [
    {
      n: 1,
      label: 'Pasywny',
      definition:
        'Typ przywództwa (nie „lepszy/gorszy") wg książki: lider pasywny, brak wsparcia dla innowacji i zmiany.',
      example:
        'Dowód: lista agend spotkań zarządu z ostatnich 4 kwartałów — brak punktu „transformacja cyfrowa / innowacje". Lub zestawienie odrzuconych wniosków projektowych bez uzasadnienia strategicznego.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Autokratyczny',
      definition:
        'Typ przywództwa wg książki: decyzje podejmowane centralnie, niski udział zespołu w procesie decyzyjnym.',
      example:
        'Dowód: schemat organizacyjny z jednym ośrodkiem decyzyjnym plus dokumentacja projektu pokazująca szczegółowe polecenia zamiast celów. Ewentualnie wynik exit interview.',
      boundaryVsPrev:
        'W przeciwieństwie do stylu Pasywnego (brak zaangażowania), lider Autokratyczny AKTYWNIE decyduje — lecz centralnie, bez udziału zespołu.',
    },
    {
      n: 3,
      label: 'Dyrektywny',
      definition:
        'Typ przywództwa wg książki: wysokie wymagania połączone z zapewnieniem narzędzi i zasobów do ich realizacji.',
      example:
        'Dowód: karta projektu lub OKR/KPI z przypisanym właścicielem, terminem i budżetem. Screenshot dashboardu BI używanego przez menedżera na codziennej bazie.',
      boundaryVsPrev:
        'W przeciwieństwie do Autokratycznego (decyzje bez wsparcia zasobowego), Dyrektywny łączy wysokie wymagania z REALNYM zapewnieniem narzędzi i zasobów do ich realizacji.',
    },
    {
      n: 4,
      label: 'Wspierający',
      definition:
        'Typ przywództwa wg książki: budowanie bezpieczeństwa psychologicznego i motywowanie zespołu.',
      example:
        'Dowód: wyniki badania zaangażowania/bezpieczeństwa psychologicznego (np. Gallup Q12) z wynikiem ≥ 4/5 w pytaniach o eksperymentowanie. Lub udokumentowana sesja retrospekcji, gdzie lider omawia własne błędy.',
      boundaryVsPrev:
        'W przeciwieństwie do Dyrektywnego (wymagania + narzędzia), Wspierający przesuwa środek ciężkości na BEZPIECZEŃSTWO PSYCHOLOGICZNE i motywację, nie tylko egzekwowanie.',
    },
    {
      n: 5,
      label: 'Innowator',
      definition:
        'Typ przywództwa wg książki: podejmowanie ryzyka, eksperymentowanie i napędzanie zmiany.',
      example:
        'Dowód: lista inicjatyw innowacyjnych z ostatnich 2 lat z potwierdzonym wpływem biznesowym (ROI, nowi klienci, nowy produkt). Lub dokumentacja udziału w programie inkubacji / partnerstwie ze startupem.',
      boundaryVsPrev:
        'W przeciwieństwie do Wspierającego (bezpieczeństwo i motywacja zespołu), Innowator sam PODEJMUJE RYZYKO i eksperymentuje, aktywnie napędzając zmianę, nie tylko ją umożliwiając.',
    },
    {
      n: 6,
      label: 'Transformacyjny',
      definition:
        'Typ przywództwa wg książki: wizja, etyka, odrzucenie status quo i rozwój ludzi. To skala typów, nie rosnąca dojrzałość — oceniaj typ dominujący i 1–2 wspierające.',
      example:
        'Dowód: „Digital Vision 2026–2030" — dokument zatwierdzony przez zarząd z KPI i właścicielami. Program sukcesji z jawnym kryterium „kompetencje AI/cyfrowe". Raport kwartalny z przeglądem postępów transformacji prezentowany akcjonariuszom.',
      boundaryVsPrev:
        'W przeciwieństwie do Innowatora (ryzyko i eksperymenty), Transformacyjny dodaje WIZJĘ, ETYKĘ i systemowy rozwój ludzi — nie kolejny szczebel, lecz najszerszy, integrujący typ.',
    },
  ],
};

// ── 5B — Gotowość na zmianę / Readiness for Change (model Kottera) ──────────
export const Q_5B: StandardQuestionModel = {
  id: 'drd_axis5_5b',
  text: 'Na ile organizacja jest gotowa i konsekwentna w prowadzeniu zmiany?',
  context:
    'Oceniamy przebieg procesu zmiany wg modelu Kottera — od rozpoznania potrzeby po zakorzenienie jej w kulturze — żeby wiedzieć, na którym etapie program realnie utknął.',
  hint: 'Oceń etap na podstawie DOKUMENTÓW (raportów, protokołów, roadmap postępu), nie deklaracji kierownictwa typu „jesteśmy w trakcie zmiany".',
  exampleAnswer:
    'Jeśli powołano komitet ds. zmiany z imienną listą, ale nie ma jeszcze spisanej i zatwierdzonej wizji docelowego stanu — to poziom 2 (Koalicja zmiany), nie poziom 4 (Komunikowanie wizji).',
  evidencePrompt:
    'Podłącz raport diagnostyczny, zarządzenie powołujące komitet, dokument wizji, zapis townhalla, roadmapę wdrożenia lub kartę wartości organizacyjnych — zależnie od wybranego poziomu.',
  inputType: 'level',
  aiDeepDiveEnabled: true,
  levels: [
    {
      n: 1,
      label: 'Rozpoznanie potrzeby',
      definition: 'Organizacja rozpoznaje potrzebę zmiany.',
      example:
        'Dowód: raport diagnostyczny lub analiza SWOT z 2024/2025 roku wskazujący konkretne powody pilności zmiany. Lub protokół zarządu z omówieniem zagrożeń konkurencyjnych.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Koalicja zmiany',
      definition: 'Budowana jest koalicja zmiany — zespół i sponsorzy.',
      example:
        'Dowód: zarządzenie wewnętrzne powołujące „komitet ds. transformacji cyfrowej" z imienną listą i mandatem. Lub dokumentacja kick-off spotkania z udziałem przedstawicieli sprzedaży, IT, operacji i HR.',
      boundaryVsPrev:
        'W przeciwieństwie do samego ROZPOZNANIA potrzeby (świadomość problemu), na tym poziomie powstaje KOALICJA — konkretni ludzie z mandatem i budżetem.',
    },
    {
      n: 3,
      label: 'Poszukiwanie wizji',
      definition: 'Trwa poszukiwanie wizji i strategii zmiany.',
      example:
        'Dowód: dokument „Wizja transformacji 2025–2027" zatwierdzony przez zarząd z KPI i timeline\'em. Lub plan komunikacyjny z harmonogramem townhallów i komunikatami dla poszczególnych grup.',
      boundaryVsPrev:
        'W przeciwieństwie do budowania koalicji (KTO prowadzi zmianę), poziom 3 definiuje DOKĄD — wizję i strategię, wciąż wewnątrz koalicji, jeszcze nie skomunikowaną szerzej.',
    },
    {
      n: 4,
      label: 'Komunikowanie wizji',
      definition: 'Wizja jest komunikowana w organizacji, dwukierunkowo.',
      example:
        'Dowód: zapis townhalla lub newslettera z ostatnich 3 miesięcy potwierdzający dwukierunkową komunikację. Wyniki ankiety pracowniczej z pytaniem o zrozumienie kierunku transformacji.',
      boundaryVsPrev:
        'W przeciwieństwie do poszukiwania wizji (praca wewnątrz koalicji), poziom 4 wychodzi NA ZEWNĄTRZ koalicji — wizja komunikowana dwukierunkowo w całej organizacji.',
    },
    {
      n: 5,
      label: 'Wdrażanie zmiany',
      definition: 'Zmiana jest wdrażana poprzez inicjatywy i kryteria postępu.',
      example:
        'Dowód: roadmapa transformacji ze statusem „zielony/żółty/czerwony" per inicjatywa, aktualizowana co miesiąc. Protokół komitetu sterującego omawiającego usunięte bariery.',
      boundaryVsPrev:
        'W przeciwieństwie do komunikowania wizji (słowa i zrozumienie), poziom 5 to WYKONANIE — inicjatywy z właścicielami, datami i mierzonym postępem.',
    },
    {
      n: 6,
      label: 'Instytucjonalizacja',
      definition: 'Zmiana jest zinstytucjonalizowana — zakorzeniona w kulturze i sposobie pracy.',
      example:
        'Dowód: karta wartości organizacyjnych z jawnym elementem „ciągła transformacja". Formularz oceny rocznej z pytaniem o wkład pracownika w zmianę. Lessons learned z 2 zakończonych projektów transformacyjnych wdrożone w kolejnych.',
      boundaryVsPrev:
        'W przeciwieństwie do wdrażania (aktywne, prowadzone inicjatywy), poziom 6 oznacza, że zmiana jest ZAKORZENIONA — działa jako część kultury i procesów, niezależnie od pojedynczego sponsora czy programu.',
    },
  ],
};

// ── 5C — Ciągły rozwój kompetencji / Continuous Competency Development ──────
export const Q_5C: StandardQuestionModel = {
  id: 'drd_axis5_5c',
  text: 'Jak organizacja systematycznie rozwija kompetencje cyfrowe pracowników?',
  context:
    'Sprawdzamy, czy rozwój kompetencji jest systematyczny i wbudowany w codzienną pracę, czy tylko sporadyczny i zależny od zdarzeń zewnętrznych.',
  hint: 'Sprawdź, jak pracownicy FAKTYCZNIE zdobywają kompetencje — na podstawie rejestrów szkoleń, budżetów i list uczestnictwa, nie deklaracji „stawiamy na rozwój".',
  exampleAnswer:
    'Jeśli firma raz w roku pokrywa udział w konferencji branżowej, ale nie prowadzi żadnych szkoleń wewnętrznych — to poziom 1 (Kontakt zewnętrzny), nie poziom 2 (Szkolenia wewnętrzne).',
  evidencePrompt:
    'Podłącz rejestr uczestnictwa w wydarzeniach/szkoleniach, plan szkoleń wewnętrznych, wyciąg z budżetu, umowę z platformą e-learningową, kartę projektu interdyscyplinarnego lub listę par mentor/mentee — zależnie od wybranego poziomu.',
  inputType: 'level',
  aiDeepDiveEnabled: true,
  levels: [
    {
      n: 1,
      label: 'Kontakt zewnętrzny',
      definition: 'Rozwój przez kontakt zewnętrzny — udział w targach i konferencjach.',
      example:
        'Dowód: lista uczestnictwa pracowników w konferencjach 2024–2025 z tematami i formą zwrotu wiedzy (prezentacja wewnętrzna, raport, warsztaty). Dowód refundacji kosztów.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Szkolenia wewnętrzne',
      definition: 'Prowadzone są szkolenia wewnętrzne.',
      example:
        'Dowód: plan szkoleń wewnętrznych 2025 z kalendarzem, listą uczestników i potwierdzeniem obecności (podpisane listy lub wydruki z LMS). Rola „trener wewnętrzny" w opisach stanowisk.',
      boundaryVsPrev:
        'W przeciwieństwie do biernego kontaktu zewnętrznego (udział w cudzych wydarzeniach), na tym poziomie organizacja sama PROWADZI szkolenia wewnętrzne.',
    },
    {
      n: 3,
      label: 'Szkolenia zewnętrzne',
      definition: 'Organizacja korzysta ze szkoleń zewnętrznych.',
      example:
        'Dowód: wyciąg z budżetu z pozycją „szkolenia zewnętrzne 2025" z kwotą. Lista certyfikatów uzyskanych przez pracowników w ostatnich 2 latach. Polityka szkoleniowa zatwierdzana przez HR.',
      boundaryVsPrev:
        'W przeciwieństwie do szkoleń wewnętrznych (zasoby własne), poziom 3 to formalna, budżetowana INWESTYCJA w szkolenia zewnętrzne z jasną polityką.',
    },
    {
      n: 4,
      label: 'Self-learning',
      definition: 'Wspierany jest self-learning — platformy, książki, kursy.',
      example:
        'Dowód: umowa z platformą e-learningową (Udemy Business, Coursera for Business) z datą i liczbą licencji. Raport completion rate za ostatni kwartał. Polityka „learning time" potwierdzona przez przełożonych.',
      boundaryVsPrev:
        'W przeciwieństwie do szkoleń zewnętrznych (organizowanych odgórnie, z terminem), self-learning przenosi WŁASNOŚĆ rozwoju na pracownika — platformy i tempo do jego wyboru.',
    },
    {
      n: 5,
      label: 'Zespoły projektowe',
      definition: 'Rozwój przez pracę w zespołach projektowych (learning-by-doing).',
      example:
        'Dowód: karty projektów ze składem interdyscyplinarnym, potwierdzające uczestnictwo pracowników z różnych działów. Plan rotacji projektowej zatwierdzony przez HR.',
      boundaryVsPrev:
        'W przeciwieństwie do self-learningu (indywidualna nauka poza codzienną pracą), poziom 5 to nauka PRZEZ DZIAŁANIE — kompetencje budowane wewnątrz realnych zespołów projektowych.',
    },
    {
      n: 6,
      label: 'Mentoring',
      definition: 'Działa mentoring — systemowe rozwijanie juniorów.',
      example:
        'Dowód: lista par mentor/mentee z ostatnich 12 miesięcy, plan spotkań i potwierdzenia odbycia (checkiny). Raport efektów: X awansów wśród mentees, Y% completion rate. Ocena roczna mentora uwzględniająca wkład w mentoring.',
      boundaryVsPrev:
        'W przeciwieństwie do zespołów projektowych (nauka przy okazji konkretnego projektu), mentoring to SYSTEMOWY, ciągły mechanizm rozwijania juniorów — niezależny od pojedynczego projektu czy jego zakończenia.',
    },
  ],
};

// ── 5D — Kultura innowacji / Innovation Culture ──────────────────────────────
export const Q_5D: StandardQuestionModel = {
  id: 'drd_axis5_5d',
  text: 'Jak systemowo organizacja generuje, testuje i skaluje innowacje?',
  context:
    'Oceniamy dojrzałość kultury innowacji — od pojedynczych zgłoszonych pomysłów po strategiczną, formalną współpracę z zewnętrznym ekosystemem.',
  hint: 'Zweryfikuj, czy innowacja ma udokumentowany ślad (pilotaż, budżet, umowa partnerska), a nie tylko atmosferę „jesteśmy otwarci na nowe pomysły".',
  exampleAnswer:
    'Jeśli organizacja zbiera pomysły na platformie, ale żaden nie przeszedł do etapu pilotażu w ostatnim roku — to poziom 1 (Promowanie pomysłów), nie poziom 2 (Eksperymentowanie).',
  evidencePrompt:
    'Podłącz platformę/rejestr pomysłów, listę pilotaży z wynikiem, raport trendów, politykę „prawa do błędu", strukturę R&D z budżetem lub umowę partnerską zewnętrzną — zależnie od wybranego poziomu.',
  inputType: 'level',
  aiDeepDiveEnabled: true,
  levels: [
    {
      n: 1,
      label: 'Promowanie pomysłów',
      definition: 'Promowanie pomysłów — hackathony, platformy idei.',
      example:
        'Dowód: platforma pomysłów z liczbą zgłoszeń, statusami i datami z ostatnich 12 miesięcy. Lub protokół hackathonu z listą uczestników i wynikiem.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Eksperymentowanie',
      definition: 'Eksperymentowanie — prototypy i pilotaże.',
      example:
        'Dowód: lista pilotaży z ostatnich 2 lat z opisem hipotezy, wyniku i decyzji (kontynuuj/zamknij). Pozycja „budżet innowacje" w planie finansowym z kwotą.',
      boundaryVsPrev:
        'W przeciwieństwie do samego ZBIERANIA pomysłów, poziom 2 to ich TESTOWANIE — prototypy i pilotaże z udokumentowanym, realnym wynikiem.',
    },
    {
      n: 3,
      label: 'Analiza trendów',
      definition: 'Aktywna analiza trendów rynkowych.',
      example:
        'Dowód: raport trendów z datą i podpisem właściciela. Agenda spotkania zarządu z punktem „trendy/innowacje". Lista inicjatyw uruchomionych na podstawie analizy trendów.',
      boundaryVsPrev:
        'W przeciwieństwie do eksperymentowania (testowanie własnych pomysłów), poziom 3 dodaje systematyczne PATRZENIE NA ZEWNĄTRZ — analizę trendów rynkowych i technologicznych zasilającą decyzje.',
    },
    {
      n: 4,
      label: 'Akceptacja błędów',
      definition: 'Akceptacja błędów jako element uczenia się.',
      example:
        'Dowód: polityka „fail fast, learn fast" lub analogiczny dokument zatwierdzony przez zarząd. Protokół retrospekcji po zamkniętym projekcie z listą wniosków i kolejnymi działaniami.',
      boundaryVsPrev:
        'W przeciwieństwie do analizy trendów (obserwacja otoczenia), poziom 4 zmienia postawę WEWNĄTRZ organizacji — błąd staje się formalnie akceptowanym elementem uczenia się, nie powodem kary.',
    },
    {
      n: 5,
      label: 'R&D w strategii',
      definition: 'R&D wpisane w strategię firmy — ciągłe, nie „ad hoc".',
      example:
        'Dowód: struktura organizacyjna z działem R&D. Budżet R&D jako % przychodów z ostatnich 3 lat. Lista patentów lub nowych produktów z powiązaniem z działem R&D.',
      boundaryVsPrev:
        'W przeciwieństwie do akceptacji błędów (postawa wobec porażki), poziom 5 to TRWAŁA STRUKTURA — R&D jako stały, budżetowany element strategii, nie jednorazowy „projekt roku".',
    },
    {
      n: 6,
      label: 'Współpraca zewnętrzna',
      definition: 'Współpraca zewnętrzna w strategii — startupy, uczelnie, partnerzy.',
      example:
        'Dowód: umowy partnerskie z uczelniami / startupami podpisane w ostatnich 2 latach. Produkt/usługa z udokumentowanym związkiem z tą współpracą. Rola „Innovation Partnership Manager" lub analogiczna w strukturze.',
      boundaryVsPrev:
        'W przeciwieństwie do R&D w strategii (zasoby i struktura wewnętrzna), poziom 6 otwiera innowację NA ZEWNĄTRZ — formalna, umowna współpraca ze startupami, uczelniami i partnerami.',
    },
  ],
};

// ── 5E — Dostępność zasobów / Resource Availability ─────────────────────────
export const Q_5E: StandardQuestionModel = {
  id: 'drd_axis5_5e',
  text: 'Jakie zasoby dla inicjatyw transformacyjnych są realnie dostępne — nie tylko zadeklarowane?',
  context:
    'Nawet dobra strategia utyka bez zasobów. Ten obszar sprawdza, czy kapitał, kompetencje, eksperci, dane, technologia i partnerzy są faktycznie dostępne, z dowodem, nie tylko obiecane.',
  hint: 'Potwierdź dostępność zasobu KONKRETNYM dowodem (budżet, umowa, licencja, rejestr, SLA), nie ogólną deklaracją „mamy to zabezpieczone".',
  exampleAnswer:
    'Jeśli budżet na transformację istnieje w planie finansowym jako odrębna pozycja, ale nie ma jeszcze zdefiniowanych ścieżek szkoleniowych per rola — to poziom 1 (Kapitał), nie poziom 2 (Szkolenia).',
  evidencePrompt:
    'Podłącz wyciąg z planu finansowego, katalog ścieżek szkoleniowych, rejestr ekspertów, macierz dostępu do danych, katalog technologii (SAM) lub listę umów partnerskich — zależnie od wybranego poziomu.',
  inputType: 'level',
  aiDeepDiveEnabled: true,
  levels: [
    {
      n: 1,
      label: 'Kapitał',
      definition: 'Dostęp do kapitału — plan finansowania inicjatyw.',
      example:
        'Dowód: wyciąg z planu finansowego z pozycją „transformacja cyfrowa / innowacje" na rok 2025, z kwotą i właścicielem. Lub protokół zarządu z zatwierdzoną alokacją.',
      boundaryVsPrev: 'Poziom bazowy — brak niższego.',
    },
    {
      n: 2,
      label: 'Szkolenia',
      definition: 'Dostęp do szkoleń — ścieżki rozwoju.',
      example:
        'Dowód: katalog ścieżek szkoleniowych per rola + raport wydatków szkoleniowych Q1–Q4 2024 z podziałem per dział. Screen z portalu szkoleniowego lub LMS.',
      boundaryVsPrev:
        'W przeciwieństwie do samego KAPITAŁU (finansowanie zaplanowane), poziom 2 dodaje realny dostęp do ROZWOJU KOMPETENCJI — konkretne ścieżki i wydany budżet szkoleniowy.',
    },
    {
      n: 3,
      label: 'Eksperci',
      definition: 'Dostęp do ekspertów — wewnętrznych i zewnętrznych.',
      example:
        'Dowód: rejestr ekspertów wewnętrznych i preferowanych dostawców zewnętrznych z datą ostatniej aktualizacji. Faktura lub umowa z konsultantem z 2024/2025 + opis rezultatu zaangażowania.',
      boundaryVsPrev:
        'W przeciwieństwie do szkoleń (rozwój ogólnych kompetencji), poziom 3 zapewnia dostęp do EKSPERTÓW — specjalistycznej wiedzy wewnętrznej i zewnętrznej na żądanie, z procedurą angażowania.',
    },
    {
      n: 4,
      label: 'Dane',
      definition: 'Dostęp do danych — systemy, bezpieczeństwo, sposób użycia.',
      example:
        'Dowód: macierz dostępu do danych z podziałem na role, zatwierdzona i opublikowana na intranecie. Raport z systemu IAM/AD pokazujący zero nieuzasadnionych blokad w ostatnich 6 miesiącach.',
      boundaryVsPrev:
        'W przeciwieństwie do ekspertów (wiedza ludzi), poziom 4 to zarządzany dostęp do DANYCH — systemy, role i zasady bezpieczeństwa użycia informacji.',
    },
    {
      n: 5,
      label: 'Technologia',
      definition: 'Dostęp do technologii — narzędzia wraz ze wsparciem.',
      example:
        'Dowód: katalog oprogramowania/SAM Tool z listą narzędzi, liczbami licencji i właścicielami. Metryka onboarding IT: średni czas przydzielenia dostępów = X dni (dane z helpdesk).',
      boundaryVsPrev:
        'W przeciwieństwie do danych (dostęp do informacji), poziom 5 dodaje same NARZĘDZIA — technologię wraz ze wsparciem i procedurą aktualizacji.',
    },
    {
      n: 6,
      label: 'Partnerzy',
      definition: 'Dostęp do partnerów — ekosystem i współpraca.',
      example:
        'Dowód: lista aktywnych umów partnerskich z datą ważności i KPI rezultatu. Protokół rocznego przeglądu ekosystemu partnerskiego przez zarząd. Projekt zrealizowany wspólnie z partnerem zewnętrznym z opisem podziału nakładów i korzyści.',
      boundaryVsPrev:
        'W przeciwieństwie do technologii (zasoby i narzędzia wewnętrzne), poziom 6 otwiera dostęp do PARTNERÓW — zewnętrznego ekosystemu, umów i dzielonych korzyści.',
    },
  ],
};

export const DRD_AXIS5_QUESTIONS: StandardQuestionModel[] = [Q_5A, Q_5B, Q_5C, Q_5D, Q_5E];
