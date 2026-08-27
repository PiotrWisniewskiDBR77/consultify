export const METALPOL_IDS = Object.freeze({
  organization: 'demo-metalpol-org',
  user: 'demo-metalpol-user-akowalczyk',
  project: 'demo-metalpol-project',
  session: 'demo-metalpol-session',
  snapshot: 'demo-metalpol-snapshot',
  output: 'demo-metalpol-output-v1',
});

export const METALPOL_CLIENT = Object.freeze({
  name: 'Metalpol Sp. z o.o.',
  site: 'Zakład Ostrów Wielkopolski',
  headcount: 214,
  industry: 'Obróbka i przetwórstwo metali · komponenty dla motoryzacji',
  assessor: 'Anna Kowalczyk',
  sponsor: 'Marek Zieliński, Dyrektor Operacyjny',
  period: '4–21 sierpnia 2026',
  issued: '26 sierpnia 2026',
  methodVersion: 'Digital Pathfinder · pakiet metodyczny 2026.2',
  sessionRef: 'DRD-2026-0817-MTP',
});

export type EvidenceClass = 'evidenced' | 'incomplete' | 'declared';

export type MetalpolDrdArea = Readonly<{
  axisId: number;
  unitId: string;
  namePL: string;
  currentLevel: number;
  targetLevel: number;
  evidenceClass: EvidenceClass;
  businessMeaning: string;
  recommendation: string;
  rootCauseHypothesis: string;
  riskOrOpportunity: string;
  prerequisite: string;
  expectedOutcome: string;
  priorityRationale: string;
}>;

type Narrative = Pick<
  MetalpolDrdArea,
  | 'businessMeaning'
  | 'recommendation'
  | 'rootCauseHypothesis'
  | 'riskOrOpportunity'
  | 'prerequisite'
  | 'expectedOutcome'
  | 'priorityRationale'
>;

const NARRATIVES: Readonly<Record<string, Narrative>> = Object.freeze({
  '1A': {
    businessMeaning:
      'Oferty są rejestrowane w CRM, lecz kalkulacja wykonalności i terminu nadal wymaga uzgodnień z planistą poza systemem. Handlowiec nie widzi aktualnego obciążenia pras i gniazd obróbczych, dlatego termin dla klienta jest potwierdzany dopiero po ręcznym sprawdzeniu.',
    recommendation:
      'Połączyć kwalifikację szansy w CRM z kontrolą zdolności produkcyjnej dla rodzin wyrobów i zapisywać potwierdzony termin jako część oferty.',
    rootCauseHypothesis:
      'Hipoteza: CRM i planowanie produkcji mają różne słowniki wyrobów oraz klientów.',
    riskOrOpportunity:
      'Ryzykiem są obietnice terminów bez potwierdzonej przepustowości; szansą jest szybsza odpowiedź na zapytania motoryzacyjne.',
    prerequisite: 'Uzgodniony słownik rodzin wyrobów i właściciel danych o dostępnej zdolności.',
    expectedOutcome:
      'Oferta zawiera termin zweryfikowany na aktualnym planie, a wyjątki trafiają do jawnej akceptacji planisty.',
    priorityRationale:
      'Zmiana bezpośrednio łączy popyt z ograniczeniami produkcji i ogranicza koszt późnych korekt.',
  },
  '1E': {
    businessMeaning:
      'Przyjęcia materiału, lokalizacja partii i wydania na produkcję są potwierdzane w kilku rejestrach. Identyfikacja partii działa, ale odtworzenie jej drogi przez magazyn wymaga zestawienia danych z etykiet, arkusza i systemu ERP.',
    recommendation:
      'Wprowadzić jeden skanowany identyfikator partii od przyjęcia do wydania oraz rejestrować lokalizację i status materiału w ERP.',
    rootCauseHypothesis:
      'Hipoteza: proces etykietowania rozwijał się niezależnie od ewidencji magazynowej ERP.',
    riskOrOpportunity:
      'Ryzykiem jest wydłużone wyszukiwanie materiału i niepełna traceability w reklamacji.',
    prerequisite:
      'Jednolita struktura etykiet, punkty skanowania i odpowiedzialność magazynu za korekty.',
    expectedOutcome:
      'Każda partia ma jedną bieżącą lokalizację i możliwą do odtworzenia historię ruchów.',
    priorityRationale:
      'Logistyka zasila każdą zmianę produkcyjną, więc błąd lokalizacji wpływa na cały plan.',
  },
  '1F': {
    businessMeaning:
      'Zlecenia są planowane w ERP, a kluczowe stanowiska przekazują dane o wykonaniu, lecz harmonogram krótkoterminowy jest korygowany ręcznie. Operatorzy widzą priorytet zlecenia, ale przestoje i odchylenia cyklu nie wracają automatycznie do planu.',
    recommendation:
      'Domknąć sprzężenie ERP–MES dla wykonania, przestojów i braków oraz wdrożyć codzienny przegląd wyjątków planu.',
    rootCauseHypothesis:
      'Hipoteza: integracja została uruchomiona dla raportowania produkcji, bez odpowiedzialności za korektę harmonogramu.',
    riskOrOpportunity:
      'Szansą jest stabilniejszy plan zmianowy; ryzykiem pozostaje lokalna optymalizacja stanowisk kosztem terminu zlecenia.',
    prerequisite:
      'Uzgodnione kody przestojów, standard meldowania i właściciel reguł przeplanowania.',
    expectedOutcome:
      'Planista widzi odchylenia w tej samej zmianie i przeplanowuje wyłącznie nazwane wyjątki.',
    priorityRationale:
      'Istniejące ERP i MES dają bazę do domknięcia przepływu bez wymiany systemów.',
  },
  '1G': {
    businessMeaning:
      'Kontrole jakości są wykonywane przy stanowiskach, lecz część wyników pozostaje w kartach papierowych. Dane o brakach są agregowane po zmianie, a powiązanie wady z parametrem procesu i partią materiału nie jest kompletne.',
    recommendation:
      'Wybrać jedną rodzinę wyrobów i zapisywać wyniki kontroli oraz kody wad cyfrowo wraz z partią i operacją.',
    rootCauseHypothesis:
      'Hipoteza: formularze jakości nie zostały powiązane z identyfikatorami zlecenia i partii.',
    riskOrOpportunity:
      'Ryzykiem jest spóźniona reakcja na serię wad; ocena wymaga uzupełnienia dowodów z kart kontroli.',
    prerequisite:
      'Słownik wad, identyfikatory operacji i akceptacja jakości dla cyfrowego formularza.',
    expectedOutcome:
      'Inżynier jakości widzi trend wad dla partii i może zatrzymać serię przed kolejną operacją.',
    priorityRationale:
      'Niepełny materiał dowodowy ogranicza pewność oceny, dlatego najpierw potrzebny jest kontrolowany pilotaż.',
  },
  '2A': {
    businessMeaning:
      'Klienci otrzymują dokumentację produktu drogą elektroniczną, lecz firma nie oferuje jeszcze funkcji cyfrowej będącej częścią sprzedawanego komponentu. Pomysły dotyczą portalu jakości i identyfikowalności, ale nie zostały potwierdzone z klientami.',
    recommendation:
      'Przeprowadzić wywiady z dwoma klientami o wartości portalu partii i dokumentacji oraz opisać minimalny zakres usługi.',
    rootCauseHypothesis:
      'Hipoteza: cyfrowe dodatki są rozpatrywane technicznie, bez właściciela propozycji wartości.',
    riskOrOpportunity:
      'Szansą jest wyróżnienie obsługi klienta; ryzykiem budowa portalu bez potwierdzonego zastosowania.',
    prerequisite:
      'Zgoda klientów na rozmowę i wskazanie właściciela biznesowego produktu cyfrowego.',
    expectedOutcome:
      'Powstaje potwierdzona lub odrzucona hipoteza usługi z listą potrzebnych danych.',
    priorityRationale:
      'Stan jest deklarowany, więc inwestycja powinna rozpocząć się od walidacji potrzeby, nie od developmentu.',
  },
  '2D': {
    businessMeaning:
      'Wymagania techniczne klienta są przenoszone do dokumentacji wyrobu, ale zmiany w specyfikacji nie mają jednego rejestru wpływu. Produkcja, jakość i sprzedaż potwierdzają zmianę w różnych kanałach, co utrudnia wskazanie obowiązującej wersji.',
    recommendation:
      'Wprowadzić wspólny rejestr zmian wymagań klienta z oceną wpływu na wyrób, proces i plan kontroli.',
    rootCauseHypothesis:
      'Hipoteza: odpowiedzialność kończy się na przyjęciu wymagania, bez właściciela przejścia między działami.',
    riskOrOpportunity:
      'Ryzykiem jest realizacja nieaktualnej wersji wymagania i kosztowna korekta po uruchomieniu partii.',
    prerequisite: 'Jedna numeracja wersji i role zatwierdzające wpływ zmiany.',
    expectedOutcome:
      'Każda zmiana ma status, właściciela i dowód wdrożenia we właściwych dokumentach procesu.',
    priorityRationale: 'Wymagania klienta sterują jakością oraz zgodnością całego cyklu wyrobu.',
  },
  '2E': {
    businessMeaning:
      'Nowe warianty wyrobów są tworzone przez kopiowanie istniejących struktur i ręczną korektę parametrów. Podejście skraca start projektu, ale utrwala różnice w nazewnictwie i zwiększa liczbę wyjątków w technologii.',
    recommendation:
      'Zdefiniować moduły produktu i reguły wariantowania dla jednej rodziny komponentów przed kolejnym uruchomieniem.',
    rootCauseHypothesis:
      'Hipoteza: brak właściciela architektury produktu utrzymuje projektowanie wariantów per zlecenie.',
    riskOrOpportunity:
      'Szansą jest szybsze wdrażanie wariantów; ryzykiem dalszy wzrost wyjątków technologicznych.',
    prerequisite: 'Wybór rodziny pilotażowej i dostęp do aktualnych BOM oraz marszrut.',
    expectedOutcome:
      'Nowy wariant powstaje z zatwierdzonych modułów, a odstępstwa są jawnie rejestrowane.',
    priorityRationale:
      'Ocena jest deklarowana; pilotaż ma najpierw potwierdzić rzeczywistą powtarzalność.',
  },
  '3A': {
    businessMeaning:
      'Zapytania i zamówienia są obsługiwane cyfrowo, ale kanał klienta nie prowadzi samodzielnie od konfiguracji do potwierdzenia terminu. Dane z wiadomości są nadal przepisywane do ERP, co ogranicza skalę obsługi mniejszych zamówień.',
    recommendation:
      'Uruchomić dla wybranych części portal zapytania z walidacją numeru detalu, ilości i oczekiwanego terminu.',
    rootCauseHypothesis:
      'Hipoteza: rozwiązania cyfrowe wspierają komunikację, ale nie mają pełnego kontraktu transakcyjnego z ERP.',
    riskOrOpportunity:
      'Szansą jest tańsza obsługa powtarzalnych zamówień; ryzykiem błędna obietnica bez danych o zdolności.',
    prerequisite: 'Stabilny katalog detali i reguła potwierdzania terminu przez planowanie.',
    expectedOutcome:
      'Kompletne zapytanie trafia do ERP bez ponownego przepisywania i z jawnym statusem terminu.',
    priorityRationale:
      'Kanał powinien najpierw obsłużyć powtarzalny, kontrolowany zakres zamiast całego portfolio.',
  },
  '3C': {
    businessMeaning:
      'Firma sprzedaje komponenty i usługi narzędziowe jako pojedyncze zlecenia. Nie ma potwierdzonego modelu abonamentowego; rozważane są cykliczne pakiety dokumentacji i monitoringu jakości.',
    recommendation:
      'Policzyć koszt obsługi cyklicznej i zweryfikować z jednym klientem gotowość do stałego pakietu raportowego.',
    rootCauseHypothesis:
      'Hipoteza: brak mierzonego kosztu obsługi uniemożliwia wycenę usługi cyklicznej.',
    riskOrOpportunity:
      'Szansą jest powtarzalny przychód; ryzykiem abonament bez pokrycia kosztu danych i wsparcia.',
    prerequisite: 'Zakres usługi, koszt przygotowania danych i zgoda klienta pilotażowego.',
    expectedOutcome: 'Firma ma decyzję go/no-go opartą na koszcie i informacji od klienta.',
    priorityRationale:
      'Przy deklarowanym stanie nie ma podstaw do budowy platformy przed walidacją ekonomiki.',
  },
  '3E': {
    businessMeaning:
      'Dane procesu i jakości służą głównie do realizacji kontraktów i analiz wewnętrznych. Nie potwierdzono, które zbiory mogą mieć odrębną wartość dla klienta ani jakie ograniczenia umowne dotyczą ich wykorzystania.',
    recommendation:
      'Sklasyfikować zbiory danych dla jednej linii oraz sprawdzić prawa, jakość i możliwy przypadek użycia z klientem.',
    rootCauseHypothesis:
      'Hipoteza: dane są traktowane jako produkt uboczny procesu, bez właściciela wartości i zgodności.',
    riskOrOpportunity:
      'Szansą jest usługa analityczna; ryzykiem naruszenie poufności lub sprzedaż danych o niskiej jakości.',
    prerequisite: 'Przegląd umów, właściciel danych i karta jakości zbioru.',
    expectedOutcome:
      'Powstaje lista danych dopuszczonych, niedopuszczonych i wymagających uzupełnienia.',
    priorityRationale:
      'Niepełne dowody prawne i jakościowe wymagają kwalifikacji przed eksperymentem rynkowym.',
  },
  '4A': {
    businessMeaning:
      'Maszyny i systemy zbierają istotne dane produkcyjne, lecz zakres oraz częstotliwość różnią się między liniami. Dane z kluczowych stanowisk są dostępne, ale nie wszystkie mają wspólny identyfikator zlecenia, operacji i partii.',
    recommendation:
      'Ustalić minimalny kontrakt danych maszyny i uzupełnić identyfikatory zlecenia, operacji oraz partii na linii pilotażowej.',
    rootCauseHypothesis:
      'Hipoteza: kolejne źródła uruchamiano projektowo bez wspólnego modelu zdarzeń produkcyjnych.',
    riskOrOpportunity:
      'Szansą jest analiza przyczyn odchyleń; ryzykiem porównywanie rekordów bez pewnej tożsamości procesu.',
    prerequisite: 'Inwentarz źródeł OT, właściciele sygnałów i uzgodnione identyfikatory.',
    expectedOutcome:
      'Dane z linii można połączyć w historię zlecenia bez ręcznego dopasowywania czasu.',
    priorityRationale: 'Istniejące źródła dają szybki efekt po ujednoliceniu ich kontekstu.',
  },
  '4B': {
    businessMeaning:
      'Dane operacyjne są rozproszone między ERP, MES, plikami i bazami stanowiskowymi. Kopie służą różnym raportom, a odpowiedzialność za retencję, korektę i wersję referencyjną nie jest jednoznaczna.',
    recommendation:
      'Zbudować katalog najważniejszych zbiorów z właścicielem, miejscem referencyjnym, retencją i regułą korekty.',
    rootCauseHypothesis:
      'Hipoteza: przechowywanie rozwijało się wokół raportów działowych, nie wspólnego cyklu życia danych.',
    riskOrOpportunity:
      'Ryzykiem są sprzeczne wyniki analiz i brak możliwości odtworzenia wersji użytej w decyzji.',
    prerequisite: 'Lista raportów krytycznych i wskazani właściciele biznesowi danych.',
    expectedOutcome:
      'Dla każdego krytycznego zbioru wiadomo, gdzie jest źródło i kto zatwierdza korektę.',
    priorityRationale:
      'Luka trzech poziomów blokuje wiarygodną analitykę oraz wykorzystanie danych w AI.',
  },
  '4C': {
    businessMeaning:
      'Raporty produkcyjne i jakościowe są dystrybuowane cyfrowo, ale odbiorcy korzystają z odmiennych wersji oraz częstotliwości. Eskalacja odchylenia zależy od ręcznego przekazania informacji przez lidera zmiany.',
    recommendation:
      'Zdefiniować wspólny zestaw zdarzeń i progów, które automatycznie kierują alert do nazwanej roli.',
    rootCauseHypothesis:
      'Hipoteza: kanały raportowe nie mają uzgodnionego kontraktu odbiorcy i czasu reakcji.',
    riskOrOpportunity:
      'Ryzykiem jest opóźniona reakcja; szansą ograniczenie raportów bez decyzji lub właściciela.',
    prerequisite: 'Progi operacyjne, role odbiorców i ścieżka potwierdzenia alertu.',
    expectedOutcome:
      'Odchylenie trafia do właściwej roli z terminem reakcji i statusem zamknięcia.',
    priorityRationale:
      'Dane już istnieją, lecz ich wartość zależy od terminowego dotarcia do decydenta.',
  },
  '4D': {
    businessMeaning:
      'Analizy przyczynowe są wykonywane dla wybranych problemów jakościowych, lecz przygotowanie danych jest ręczne. Nie ma kompletnego dowodu, że modele i zapytania są powtarzalne między liniami.',
    recommendation:
      'Odtworzyć jedną analizę jakościową z wersjonowanym zbiorem, zapytaniem i wynikiem oraz zmierzyć nakład przygotowania.',
    rootCauseHypothesis:
      'Hipoteza: praca analityczna nie ma standardu publikacji i ponownego użycia.',
    riskOrOpportunity:
      'Szansą jest skrócenie analiz; ryzykiem decyzja na wyniku, którego nie można odtworzyć.',
    prerequisite: 'Właściciel przypadku, dostęp do danych źródłowych i kryterium poprawności.',
    expectedOutcome:
      'Druga osoba odtwarza wynik z tego samego pakietu danych bez ręcznych uzgodnień.',
    priorityRationale:
      'Niepełne dowody wymagają najpierw potwierdzenia powtarzalności, nie rozbudowy narzędzi.',
  },
  '5A': {
    businessMeaning:
      'Kadra kierownicza sponsoruje usprawnienia cyfrowe i uczestniczy w przeglądach, ale decyzje projektowe nie zawsze wskazują oczekiwany efekt biznesowy. Wsparcie jest widoczne, natomiast portfel zmian nie ma jednolitego rytmu priorytetyzacji.',
    recommendation:
      'Wprowadzić miesięczny przegląd inicjatyw z właścicielem, efektem, zależnościami i decyzją kontynuuj/zatrzymaj.',
    rootCauseHypothesis:
      'Hipoteza: sponsoring koncentruje się na starcie projektu, a nie na kolejnych decyzjach portfelowych.',
    riskOrOpportunity:
      'Szansą jest szybsze usuwanie blokad; ryzykiem utrzymywanie projektów bez potwierdzonego efektu.',
    prerequisite: 'Jedna lista inicjatyw i wspólne kryteria decyzji zarządczej.',
    expectedOutcome:
      'Każda inicjatywa ma aktualną decyzję, właściciela i nazwany efekt do sprawdzenia.',
    priorityRationale:
      'Dojrzała postawa liderów pozwala szybko wzmocnić dyscyplinę bez tworzenia nowej struktury.',
  },
  '5B': {
    businessMeaning:
      'Pracownicy uczestniczą w zmianach i zgłaszają usprawnienia, lecz komunikacja wpływu na role jest nieregularna. Liderzy zmian rozwiązują opór lokalnie, bez wspólnego rejestru ryzyk adopcji.',
    recommendation:
      'Dla każdej inicjatywy opisać grupy dotknięte zmianą, oczekiwane zachowania i właściciela wsparcia adopcji.',
    rootCauseHypothesis:
      'Hipoteza: zarządzanie zmianą jest traktowane jako komunikacja projektu, nie osobny strumień rezultatów.',
    riskOrOpportunity:
      'Ryzykiem jest techniczne wdrożenie bez trwałej zmiany pracy; szansą wykorzystanie aktywnych liderów zmianowych.',
    prerequisite: 'Mapa interesariuszy i mierzalne zachowania po wdrożeniu.',
    expectedOutcome:
      'Zespół wie, co zmienia się w jego pracy, a problemy adopcji mają właściciela.',
    priorityRationale:
      'Luka dwóch poziomów wpływa na skuteczność wszystkich inicjatyw technologicznych.',
  },
  '5C': {
    businessMeaning:
      'Szkolenia odbywają się przy wdrożeniach systemów i maszyn, lecz nie ma wspólnej mapy kompetencji cyfrowych dla ról. Potrzeby rozwojowe są deklarowane przez kierowników i nie zawsze wynikają z obserwacji pracy.',
    recommendation:
      'Zbudować mapę kompetencji dla planisty, lidera zmiany i inżyniera jakości oraz ocenić luki na realnych zadaniach.',
    rootCauseHypothesis:
      'Hipoteza: plan szkoleń jest powiązany z zakupami, nie z docelowym sposobem pracy.',
    riskOrOpportunity:
      'Ryzykiem jest niewykorzystanie funkcji systemów; szansą skierowanie rozwoju na trzy role krytyczne.',
    prerequisite: 'Opis zadań docelowych i udział przełożonych w ocenie.',
    expectedOutcome: 'Każda rola ma nazwane luki i plan ćwiczeń powiązany z zadaniami.',
    priorityRationale:
      'Stan deklarowany wymaga praktycznej weryfikacji przed szerokim programem szkoleniowym.',
  },
  '6A': {
    businessMeaning:
      'Ryzyka IT są omawiane, lecz środowisko OT nie ma jednolitego rejestru aktywów, właścicieli i scenariuszy zagrożeń. Decyzje ochronne są podejmowane przy projektach lub incydentach, a nie według wspólnego priorytetu.',
    recommendation:
      'Utworzyć rejestr krytycznych aktywów IT/OT z właścicielem, wpływem na produkcję i planem postępowania z ryzykiem.',
    rootCauseHypothesis:
      'Hipoteza: odpowiedzialność IT i utrzymania ruchu nie łączy się w jednym procesie ryzyka.',
    riskOrOpportunity:
      'Ryzykiem jest zatrzymanie produkcji bez uzgodnionego priorytetu odtworzenia.',
    prerequisite: 'Inwentarz sieci i urządzeń, udział IT, automatyki oraz właścicieli procesów.',
    expectedOutcome:
      'Najważniejsze aktywa mają właściciela, ocenę wpływu i zatwierdzone działanie ograniczające.',
    priorityRationale:
      'Luka trzech poziomów dotyczy podstawowej zdolności zarządzania ryzykiem OT.',
  },
  '6C': {
    businessMeaning:
      'Dostęp do systemów jest nadawany według ról, ale przegląd uprawnień i klasyfikacja danych nie obejmują wszystkich repozytoriów technicznych. Kopie dokumentacji trafiają do współdzielonych katalogów o różnych zasadach dostępu.',
    recommendation:
      'Sklasyfikować dane produkcyjne i techniczne oraz przeprowadzić przegląd dostępów do repozytoriów krytycznych.',
    rootCauseHypothesis:
      'Hipoteza: zasady ochrony są silniejsze w systemach centralnych niż w katalogach roboczych.',
    riskOrOpportunity:
      'Ryzykiem jest niekontrolowane ujawnienie dokumentacji klienta lub technologii.',
    prerequisite: 'Właściciele repozytoriów, klasy danych i lista aktywnych użytkowników.',
    expectedOutcome: 'Dostęp do danych krytycznych wynika z roli i jest okresowo potwierdzany.',
    priorityRationale:
      'Istniejące mechanizmy dostępowe pozwalają skupić się na lukach w pokryciu i przeglądzie.',
  },
  '6E': {
    businessMeaning:
      'Kopie zapasowe są wykonywane, lecz odtworzenie procesów produkcyjnych po awarii OT nie zostało potwierdzone pełnym ćwiczeniem. Zależności między ERP, MES, etykietami i instrukcjami stanowiskowymi nie mają wspólnej kolejności powrotu.',
    recommendation:
      'Przeprowadzić ćwiczenie odtworzenia jednej linii z mierzeniem czasu i listą zależności systemów oraz danych.',
    rootCauseHypothesis:
      'Hipoteza: plany ciągłości opisują systemy oddzielnie, bez scenariusza produkcyjnego end-to-end.',
    riskOrOpportunity:
      'Ryzykiem jest dłuższy niż zakładany przestój i brak danych do bezpiecznego wznowienia produkcji.',
    prerequisite:
      'Zatwierdzony scenariusz, kopie testowe i udział IT, utrzymania ruchu, jakości oraz produkcji.',
    expectedOutcome:
      'Firma zna rzeczywisty czas odtworzenia, kolejność działań i luki wymagające inwestycji.',
    priorityRationale:
      'Luka trzech poziomów i bezpośredni wpływ na ciągłość czynią ćwiczenie priorytetem.',
  },
  '7A': {
    businessMeaning:
      'Dane potrzebne do analiz istnieją, ale ich jakość, właścicielstwo i historia zmian nie są zarządzane jako fundament rozwiązań AI. Łączenie danych z produkcji i jakości nadal wymaga ręcznej pracy ekspertów.',
    recommendation:
      'Wybrać jeden przypadek AI i przygotować kartę danych z właścicielem, definicjami, jakością oraz ograniczeniami użycia.',
    rootCauseHypothesis:
      'Hipoteza: inicjatywy AI są rozważane przed ustanowieniem produktu danych.',
    riskOrOpportunity:
      'Ryzykiem są modele oparte na nieporównywalnych rekordach; szansą uporządkowanie danych wokół konkretnej decyzji.',
    prerequisite: 'Nazwany przypadek użycia, właściciel procesu i dostęp do historii danych.',
    expectedOutcome:
      'Zespół ma zweryfikowany zbiór treningowy lub świadomą decyzję, że danych brakuje.',
    priorityRationale:
      'Bez fundamentu danych kolejne przypadki AI powielą ten sam koszt przygotowania.',
  },
  '7B': {
    businessMeaning:
      'Zespoły wskazują możliwości użycia AI w jakości i planowaniu, lecz nie ma wdrożonego procesu wspieranego przez model. Pomysły nie mają jeszcze miernika decyzji, właściciela ryzyka ani zasad nadzoru człowieka.',
    recommendation:
      'Wybrać jeden proces decyzyjny i opisać wejście, rekomendację modelu, decyzję człowieka oraz miarę skuteczności.',
    rootCauseHypothesis:
      'Hipoteza: dyskusja o AI zaczyna się od technologii zamiast od decyzji operacyjnej.',
    riskOrOpportunity:
      'Szansą jest ograniczenie ręcznej analizy; ryzykiem automatyzacja niejasnej lub niekontrolowanej decyzji.',
    prerequisite: 'Właściciel procesu, miara bazowa i zasady eskalacji błędnej rekomendacji.',
    expectedOutcome:
      'Przypadek pilotażowy ma kontrakt odpowiedzialności i może zostać rzetelnie oceniony.',
    priorityRationale: 'Stan deklarowany wymaga najpierw doprecyzowania procesu i dowodu wartości.',
  },
  '7E': {
    businessMeaning:
      'W organizacji są osoby eksperymentujące z narzędziami AI, ale kompetencje, zasady bezpiecznego użycia i odpowiedzialność za wynik nie są ujednolicone. Wiedza pozostaje indywidualna i nie jest powiązana z rolami operacyjnymi.',
    recommendation:
      'Ustalić zasady użycia AI i przeprowadzić warsztat na jednym zadaniu dla jakości, planowania oraz IT.',
    rootCauseHypothesis:
      'Hipoteza: eksperymenty rozwijają się szybciej niż wspólne zasady i praktyka weryfikacji.',
    riskOrOpportunity:
      'Ryzykiem jest ujawnienie danych lub przyjęcie błędnego wyniku; szansą szybkie zbudowanie świadomej praktyki.',
    prerequisite:
      'Zatwierdzone zasady danych, lista dopuszczonych narzędzi i właściciel szkolenia.',
    expectedOutcome:
      'Uczestnicy potrafią wykonać zadanie, zweryfikować wynik i wskazać przypadek wymagający eskalacji.',
    priorityRationale:
      'Kultura i kompetencje muszą rosnąć razem z pierwszymi kontrolowanymi przypadkami AI.',
  },
});

const METALPOL_DRD_AREA_CORE = [
  {
    axisId: 1,
    unitId: '1A',
    namePL: 'Procesy Sprzedaży',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1E',
    namePL: 'Procesy Logistyczne',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1F',
    namePL: 'Procesy Produkcyjne',
    currentLevel: 4,
    targetLevel: 6,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 1,
    unitId: '1G',
    namePL: 'Procesy Jakości',
    currentLevel: 2,
    targetLevel: 3,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 2,
    unitId: '2A',
    namePL: 'Produkty Cyfrowe',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 2,
    unitId: '2D',
    namePL: 'Dopasowanie Produktu do Oczekiwań Klienta',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 2,
    unitId: '2E',
    namePL: 'Skalowalność Produktu',
    currentLevel: 2,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 3,
    unitId: '3A',
    namePL: 'Modele E-commerce',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 3,
    unitId: '3C',
    namePL: 'Model As-a-Service',
    currentLevel: 1,
    targetLevel: 2,
    evidenceClass: 'declared',
  },
  {
    axisId: 3,
    unitId: '3E',
    namePL: 'Modele Monetyzacji Danych',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 4,
    unitId: '4A',
    namePL: 'Zbieranie Danych',
    currentLevel: 4,
    targetLevel: 6,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4B',
    namePL: 'Metodologia Przechowywania Danych',
    currentLevel: 2,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4C',
    namePL: 'Komunikacja Danych',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 4,
    unitId: '4D',
    namePL: 'Analiza Big Data',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'incomplete',
  },
  {
    axisId: 5,
    unitId: '5A',
    namePL: 'Postawy przywódcze',
    currentLevel: 4,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 5,
    unitId: '5B',
    namePL: 'Gotowość na zmianę',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 5,
    unitId: '5C',
    namePL: 'Ciągły rozwój kompetencji',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'declared',
  },
  {
    axisId: 6,
    unitId: '6A',
    namePL: 'Strategia i zarządzanie ryzykiem',
    currentLevel: 2,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 6,
    unitId: '6C',
    namePL: 'Ochrona danych',
    currentLevel: 3,
    targetLevel: 5,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 6,
    unitId: '6E',
    namePL: 'Plany awaryjne',
    currentLevel: 1,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 7,
    unitId: '7A',
    namePL: 'Dane i Fundamenty AI',
    currentLevel: 2,
    targetLevel: 4,
    evidenceClass: 'evidenced',
  },
  {
    axisId: 7,
    unitId: '7B',
    namePL: 'Procesy Wspierane przez AI',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
  {
    axisId: 7,
    unitId: '7E',
    namePL: 'Kompetencje i Kultura AI',
    currentLevel: 1,
    targetLevel: 3,
    evidenceClass: 'declared',
  },
] as const;

export const METALPOL_DRD_AREAS: readonly MetalpolDrdArea[] = Object.freeze(
  METALPOL_DRD_AREA_CORE.map((area) => ({ ...area, ...NARRATIVES[area.unitId] }))
);

export const EXPECTED_RADAR = Object.freeze({
  1: { currentLevel: 39, targetLevel: 64 },
  2: { currentLevel: 33, targetLevel: 67 },
  3: { currentLevel: 27, targetLevel: 60 },
  4: { currentLevel: 39, targetLevel: 71 },
  5: { currentLevel: 50, targetLevel: 78 },
  6: { currentLevel: 33, targetLevel: 78 },
  7: { currentLevel: 27, targetLevel: 67 },
} as const);

export type SkipCode =
  | 'poza_modelem_operacyjnym'
  | 'poza_zakresem_zlecenia'
  | 'odroczone_do_kolejnej_rewizji'
  | 'zastapione_innym_rozwiazaniem';

export type MetalpolSkipDecision = Readonly<{
  unitId: string;
  level: number;
  questionId: string;
  skipCode: SkipCode;
}>;

function levels(unitId: string, count: number, skipCode: SkipCode): MetalpolSkipDecision[] {
  return Array.from({ length: count }, (_, index) => ({
    unitId,
    level: index + 1,
    questionId: `${unitId}-L${index + 1}`,
    skipCode,
  }));
}

export const METALPOL_SKIP_DECISIONS: readonly MetalpolSkipDecision[] = Object.freeze([
  ...levels('1B', 7, 'poza_zakresem_zlecenia'),
  ...levels('3B', 5, 'poza_modelem_operacyjnym'),
  ...levels('6B', 6, 'zastapione_innym_rozwiazaniem'),
  ...levels('4E', 2, 'odroczone_do_kolejnej_rewizji'),
  { unitId: '7C', level: 1, questionId: '7C-L1', skipCode: 'odroczone_do_kolejnej_rewizji' },
  { unitId: '5D', level: 1, questionId: '5D-L1', skipCode: 'poza_zakresem_zlecenia' },
  { unitId: '5D', level: 2, questionId: '5D-L2', skipCode: 'poza_modelem_operacyjnym' },
]);
