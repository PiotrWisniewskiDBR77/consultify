# Automation Pipeline — doktryna narzędzia
## Ocena i priorytetyzacja pipeline'u automatyzacji procesów (Intelligent Automation / Hyperautomation)

> Rodowód metodyczny: McKinsey (Intelligent Process Automation — the engine at the core of the
> next-generation operating model), Deloitte (Global Intelligent Automation Survey/Report;
> Automation Continuum), BCG (Automation przy transformacji operacyjnej — komplementarnie do
> Lean/VSM), Gartner (Hyperautomation — coined term, RPA/iBPM/IDP/AI market guide), UiPath/Celonis/
> Automation Anywhere (praktyka wdrożeniowa: process/task mining, feasibility scoring).

---

## 1. Cel

Automation Pipeline odpowiada na pytanie sponsora: **„Które z naszych 40+ zgłoszonych pomysłów na
automatyzację naprawdę zasługują na budżet i w jakiej kolejności — a które to automatyzacja
chaosu, którą lepiej najpierw naprawić, nie zautomatyzować?"**

Problem, który rozwiązuje:
- Organizacje po pierwszym roku RPA/AI mają **listę życzeń, nie pipeline** — dziesiątki zgłoszonych
  „pomysłów na automatyzację" bez wspólnej miary, więc wygrywa najgłośniejszy sponsor, nie
  najwyższa wartość.
- Automatyzacja jest dziś **kontinuum technologii**, nie jednym narzędziem: prosty makro-bot (RPA)
  nie rozwiąże procesu z odręcznymi fakturami (potrzeba IDP), a proces z niedeterministycznym
  wnioskowaniem (ocena reklamacji, klasyfikacja intencji) nie nadaje się do RPA/IDP w ogóle —
  potrzebuje modelu AI/agenta. Błąd doboru technologii do natury procesu jest najdroższą pomyłką
  programu automatyzacji.
- Najkosztowniejszy błąd branży (McKinsey, Lean Enterprise Institute, Deloitte zgodnie) to
  **automatyzacja złego procesu** — cyfryzacja marnotrawstwa zamiast jego eliminacji. Bot, który
  wiernie odtwarza wadliwy proces, tylko przyspiesza generowanie błędów.
- Bez wspólnej macierzy effort×impact program automatyzacji **nie skaluje się poza pilotaż** —
  utyka na 5-10 botach, bo każdy kolejny kandydat wymaga osobnej politycznej bitwy o priorytet.

Decyzja, którą wspiera narzędzie: **co wchodzi do pipeline'u automatyzacji, w jakiej kolejności,
jaką technologią (RPA/IDP/AI/agent) i z jakim uzasadnionym ROI** — zanim ktokolwiek napisze
pierwszą linię configu bota. To narzędzie **diagnostyczno-priorytetyzujące**, nie wykonawcze —
wynikiem jest zasilony, uszeregowany pipeline z uzasadnieniem, a wdrożenie (dev, testy, hypercare)
to kolejny, osobny krok programu.

---

## 2. Kiedy używać

Sygnały wyzwalające:
- **Program automatyzacji bez rankingu** — organizacja ma listę zgłoszeń (od biznesu, od IT, od
  konsultantów) bez wspólnej miary priorytetu; decyzje „co robimy najpierw" zapadają politycznie,
  nie analitycznie.
- **Po pierwszym audycie/VSM procesu** — value stream mapping albo audyt operacyjny ujawnił kroki
  o niskim PCE, wysokim wolumenie, powtarzalne — trzeba ocenić, czy to faktycznie kandydaci do
  automatyzacji, czy najpierw wymagają redesignu (patrz sekcja 5, pułapka „automatyzacja złego
  procesu").
- **Skalowanie poza pilotaż RPA** — firma ma 3-10 wdrożonych botów punktowych, chce przejść do
  **programu** (Center of Excellence) — potrzebuje systematycznego lejka zasilania, nie kolejnych
  ad-hoc próśb.
- **Wybór technologii dla konkretnego procesu jest sporny** — zespół nie wie, czy proces kwalifikuje
  się do prostego RPA, wymaga IDP (dokumenty nieustrukturyzowane/odręczne), czy wymaga modelu AI
  (decyzje niedeterministyczne, język naturalny, ocena/klasyfikacja).
- **Budżet na automatyzację jest ograniczony** — trzeba obronić przed zarządem, dlaczego proces A
  idzie przed procesem B (macierz effort×impact jako dowód, nie opinia).
- **Przegląd istniejącego portfela botów** — część wdrożonych automatyzacji ma niski ROI/wysoki
  koszt utrzymania (kruche boty na niestabilnym UI) — potrzeba oceny „co utrzymać, co przebudować
  w AI-native, co wyłączyć".

Kiedy NIE używać: gdy organizacja nie ma jeszcze zmapowanego procesu bazowego (brak danych o
wolumenie, czasie, regułach) — wtedy najpierw VSM/process discovery, dopiero potem ocena
automatyzowalności (to narzędzie konsumuje wyjście z mapowania procesu, nie zastępuje go). Nie
używać też do oceny pojedynczego, jednorazowego zadania — pipeline ma sens przy portfelu
kandydatów (od kilku do kilkudziesięciu procesów).

---

## 3. Inputy

**3.1. Rejestr procesów-kandydatów** (jeden wiersz = jeden proces/subproces)
- Nazwa procesu i krótki opis (trigger → wynik).
- Właściciel biznesowy i dział.
- Źródło zgłoszenia (business case, process mining, warsztat, audyt VSM).

**3.2. Dane wolumenu i częstotliwości**
- Liczba transakcji/wykonań w okresie (dziennie/miesięcznie/rocznie).
- Czas trwania jednej transakcji (manualnie) — FTE-minuty per transakcja.
- Sezonowość/szczyty wolumenu (automatyzacja daje największy zwrot tam, gdzie skaluje się bez
  dodawania ludzi w szczycie).

**3.3. Charakterystyka regułowości i danych**
- **Regułowość decyzji**: czy krok wykonuje się wg jawnych, skończonych reguł (if-then), czy
  wymaga osądu/interpretacji kontekstu.
- **Ustrukturyzowanie danych wejściowych**: dane systemowe/API (najprostsze), dokumenty
  ustrukturyzowane (formularz, faktura wzorcowa), dokumenty nieustrukturyzowane (skan, odręczny
  tekst, e-mail swobodny), mowa/obraz.
- **Stabilność procesu i interfejsów**: jak często zmienia się UI systemów źródłowych, reguły
  biznesowe, format dokumentów — niestabilność jest głównym źródłem kruchości botów RPA.
- **Liczba wyjątków/wariantów** (exception rate): % przypadków niepasujących do głównej ścieżki —
  wysoki % wyjątków oznacza, że sam proces jest niedojrzały do automatyzacji „z marszu".

**3.4. Dane systemowe (readiness IT)**
- Dostępność API/integracji vs. konieczność automatyzacji przez warstwę UI (screen scraping —
  droższe w utrzymaniu, bardziej kruche).
- Liczba systemów, przez które proces przechodzi (im więcej przełączeń, tym wyższa złożoność
  techniczna wdrożenia).
- Środowisko docelowe: on-prem/legacy (starsze API, częściej screen-based) vs. cloud/SaaS
  nowoczesne (bogatsze API, łatwiejsza integracja).

**3.5. Dane wpływu biznesowego**
- Koszt FTE-godzin obecnie pochłanianych przez proces (baseline do liczenia oszczędności).
- Wpływ na klienta/SLA (czy opóźnienie/błąd w tym procesie dotyka klienta zewnętrznego).
- Ryzyko błędu ludzkiego i jego konsekwencje (compliance, finanse, reputacja) — procesy o wysokim
  ryzyku błędu zyskują dodatkowo na **jakości**, nie tylko koszcie.
- Powiązanie ze strategicznym priorytetem (czy automatyzacja tego procesu odblokowuje coś więcej,
  np. skalowanie linii biznesowej).

**Pułapka na starcie:** zbieranie danych wolumenu z szacunków właściciela procesu („robimy to
jakieś 200 razy dziennie") zamiast z logów systemowych/process miningu. Szacunki są systematycznie
zniekształcone (recency bias, chęć pokazania procesu jako ważniejszego) — tam gdzie dostępne są
logi transakcyjne, użyj process/task miningu do faktycznego wolumenu i wariantów ścieżek.

---

## 4. Metoda

### 4.1 Proces discovery / mining — od czego bierze się rejestr kandydatów

Zanim cokolwiek się oceni, trzeba mieć z czego wybierać. Trzy tryby zasilania pipeline'u
(McKinsey/UiPath/Celonis, komplementarne, nie wykluczające się):

- **Top-down (workshop-based discovery)** — warsztaty z właścicielami procesów, mapowanie
  ręczne/VSM, zgłoszenia biznesowe. Szybkie uruchomienie, ale subiektywne — zależne od tego, kto
  głośno się zgłosi, nie od faktycznego wolumenu/bólu.
- **Bottom-up (process mining)** — analiza logów systemowych (ERP, CRM, ticketing) rekonstruuje
  faktyczny przebieg procesu z danych, nie z opisu. Ujawnia warianty i wyjątki, których nikt nie
  zgłosił, bo są „niewidoczne z fotela menedżera" (analogicznie do VSM: system pokazuje status,
  nie prawdziwy czas i przyczyny — tu chodzi o rzeczywisty przebieg, nie deklarowaną procedurę).
- **Task mining** — obserwacja na poziomie stanowiska pracy (co robi pracownik na pulpicie: kliki,
  kopiuj-wklej, przełączanie okien) — uzupełnia process mining tam, gdzie logi systemowe nie
  pokazują pracy „między systemami" (np. ręczne przepisywanie z e-maila do ERP).

**Insight metodyczny:** organizacje polegające wyłącznie na top-down systematycznie pomijają
najlepszych kandydatów — najbardziej bolesne, wysokowolumenowe marnotrawstwo często nie jest
zgłaszane, bo stało się „normalne" dla wykonawców (analogia do VSM: opór „ale zwykle robimy to
inaczej" jest sygnałem diagnostycznym).

### 4.2 Ocena automatyzowalności — kontinuum technologii (nie jeden wybór)

Automatyzacja nie jest binarna (automatyzować/nie automatyzować) — jest **doborem właściwej
technologii do natury procesu**, rosnąco wg złożoności poznawczej:

| Poziom | Technologia | Kiedy pasuje | Przykład |
|---|---|---|---|
| **1 — RPA klasyczne** | Rule-based bot na UI/API | Dane w pełni ustrukturyzowane, reguły w 100% jawne, proces stabilny (rzadkie zmiany UI/reguł), niska wariancja ścieżek | Przepisanie danych z jednego systemu do drugiego wg stałego mapowania pól |
| **2 — IDP (Intelligent Document Processing)** | OCR + NLP + ML klasyfikacja | Dane wejściowe to dokumenty częściowo/nie-ustrukturyzowane (faktury różnych dostawców, umowy, formularze skanowane), ale wynikowa decyzja po ekstrakcji jest regułowa | Ekstrakcja pozycji z faktury PDF różnych formatów → automatyczne księgowanie wg reguł |
| **3 — IPA (Intelligent Process Automation = RPA+AI/ML)** | Bot + modele predykcyjne/klasyfikacyjne wbudowane w przepływ | Proces ma kroki regułowe I kroki wymagające osądu ograniczonego zakresu (klasyfikacja, scoring, routing) — łączy komponenty 1+2+ML | Obsługa zgłoszenia serwisowego: ekstrakcja (IDP) → klasyfikacja pilności (ML) → routing (RPA) → tylko przypadki brzegowe do człowieka |
| **4 — Agentic / AI-native** | Agent LLM z narzędziami, wnioskowanie kontekstowe | Proces wymaga interpretacji języka naturalnego, wieloetapowego rozumowania, decyzji niedeterministycznych o szerokim zakresie, komunikacji z klientem | Analiza reklamacji swobodnym tekstem → decyzja o zasadności → spersonalizowana odpowiedź |
| **(nie automatyzuj jeszcze)** | — | Wysoka wariancja + niska regułowość + niska stabilność jednocześnie | Proces w trakcie redesignu, ad-hoc, unikalny za każdym razem |

**Reguła doboru:** im wyżej w tabeli (w stronę 4), tym wyższy koszt wdrożenia i utrzymania, ale
tym szerszy zasięg tego, co da się objąć. Klasyczny błąd wdrożeniowy to próba wymuszenia poziomu 1
(RPA) na procesie, który faktycznie wymaga poziomu 3-4 — bot staje się coraz bardziej złożonym
stosem wyjątków (if-else na if-else), aż jest droższy w utrzymaniu niż człowiek, którego zastąpił.
Odwrotny błąd — użycie ciężkiego agenta AI tam, gdzie wystarczy prosty RPA — to niepotrzebny koszt
i ryzyko (halucynacja tam, gdzie potrzebna jest 100% deterministyczna reguła, np. przelew bankowy).

### 4.3 Kryteria automatyzowalności (scoring per proces)

Dla każdego kandydata ocenia się (typowo skala 1-5 per kryterium):

- **Regułowość** — czy decyzję da się w pełni opisać skończonym zbiorem reguł (5 = w pełni
  regułowe, 1 = wymaga eksperckiego osądu case-by-case).
- **Ustrukturyzowanie danych** — 5 = czyste dane systemowe/API, 1 = swobodny tekst/obraz/mowa bez
  wzorca.
- **Stabilność** — 5 = proces i systemy źródłowe zmieniają się rzadko (kwartały+), 1 = zmiana
  co tydzień (UI, reguły, format dokumentów).
- **Wolumen** — 5 = wysoki, powtarzalny wolumen (setki-tysiące/miesiąc), 1 = sporadyczny.
- **Standaryzacja ścieżki** — 5 = jedna dominująca ścieżka (>90% przypadków), 1 = wiele
  równoważnych wariantów bez dominującego wzorca.
- **Dostępność integracji** — 5 = API dostępne, 1 = wyłącznie interfejs graficzny legacy.

**Automatyzowalność ≠ jedna liczba średnia** — profil odpowiedzi wskazuje TYP technologii (patrz
4.2), nie tylko „tak/nie". Proces z wysoką regułowością, ale niskim ustrukturyzowaniem danych, to
kandydat IDP, nie RPA. Uśrednienie tych wymiarów gubi tę informację i prowadzi do złego doboru
narzędzia.

### 4.4 Priorytetyzacja — macierz effort × impact

Rdzeń priorytetyzacji pipeline'u (Bizagi/branża, spójne z McKinsey „framework oparty na celach"):

**Oś Impact (wartość biznesowa):**
- Oszczędność FTE-godzin rocznie (wolumen × czas manualny × stawka).
- Redukcja błędów/ryzyka (compliance, finanse) — przeliczona na koszt unikniętego ryzyka tam,
  gdzie to możliwe.
- Wpływ na SLA/doświadczenie klienta.
- Efekt skalowania — czy automatyzacja odblokowuje wzrost wolumenu bez wzrostu zespołu.

**Oś Effort (koszt/złożoność wdrożenia):**
- Złożoność techniczna (liczba systemów, dostępność API vs. UI scraping, poziom technologii wg 4.2).
- Czas wdrożenia i koszt (dev + test + hypercare).
- Ryzyko projektowe (zależności, zgoda compliance/bezpieczeństwa, zmiana organizacyjna wymagana
  równolegle).
- Koszt utrzymania (boty na niestabilnym UI mają wysoki effort **ciągły**, nie tylko wdrożeniowy —
  to trzeba liczyć jako TCO, nie tylko koszt startowy).

**Cztery ćwiartki (standard konsultingowy — quick win / big bet / fill-in / question mark):**

| | Effort niski | Effort wysoki |
|---|---|---|
| **Impact wysoki** | **Quick win** — pierwsza fala pipeline'u, buduje wiarygodność programu | **Strategic bet** — wymaga sponsora na poziomie zarządu, wieloetapowy roadmap |
| **Impact niski** | **Fill-in** — robić między dużymi projektami, niski priorytet, dobre dla zespołu w trakcie nauki | **Question mark** — odrzucić albo przeformułować (zwykle zły kandydat, nie brak zasobów) |

**Insight metodyczny:** program, który zaczyna od strategic bets (bo są „najważniejsze"), traci
wiarygodność, zanim dowiezie pierwszy efekt — sekwencja **zawsze** zaczyna się od 2-3 quick winów,
które finansują (budżetowo i politycznie) przejście do strategic bets.

### 4.5 Roadmap — sekwencjonowanie pipeline'u

1. **Fala 0 (dowód koncepcji):** 1-2 najsilniejsze quick winy — cel: pierwszy żywy efekt w <90 dni,
   zbudowanie zaufania sponsora i zespołu.
2. **Fala 1 (skalowanie quick winów):** pozostałe quick winy + budowa Center of Excellence
   (standardy, zarządzanie zmianą, governance botów).
3. **Fala 2 (strategic bets):** duże, wieloetapowe wdrożenia z jasnym sponsorem, rozbite na
   kamienie milowe (nie „big bang").
4. **Ciągłe zasilanie:** pipeline nie jest jednorazową listą — process/task mining działa
   w tle, nowe kandydaty wpadają do rankingu w regularnym rytmie (kwartalnym), stare pozycje są
   re-ocenianie (proces mógł się zmienić, priorytet mógł spaść).

---

## 5. Jak się WNIOSKUJE — czytanie sygnałów

To jest właściwa praca analityczna narzędzia:

- **Pułapka „automatyzacja złego procesu"** — najdroższy błąd branży. Jeśli proces ma wysoki %
  wyjątków, niską standaryzację ścieżki lub wysoki wskaźnik przeróbek (rework/rework loops), to
  **objaw procesu niedojrzałego**, nie kandydata do automatyzacji — automatyzacja tylko przyspiesza
  produkowanie błędów w skali. Kolejność musi być: **najpierw uprość/ustabilizuj proces (redesign,
  patrz VSM), potem automatyzuj** — automatyzacja marnotrawstwa to marnotrawstwo w nowym ubraniu.
  Sygnał do wychwycenia: proces z wysokim wolumenem, ale niskim wynikiem standaryzacji ścieżki —
  wygląda kusząco (duży impact), ale bez redesignu effort okaże się dużo wyższy niż szacowany
  (bo bot musi obsłużyć dziesiątki wariantów, których nikt nie widział na starcie).
- **Makro vs mikro (poziom analizy)** — priorytetyzacja na poziomie **całego procesu end-to-end**
  (np. „obsługa zamówienia") może przesłonić, że tylko **jeden krok** w środku jest właściwym
  kandydatem, a reszta wymaga innego podejścia. Rozbijaj proces na kroki/subprocesy przed
  scoringiem — ocena na zbyt wysokim poziomie agregacji daje fałszywie niski (rozmyty) albo
  fałszywie wysoki (jeden dobry krok ciągnie średnią) wynik.
  Odwrotnie: nadmierna mikro-fragmentacja (automatyzacja pojedynczego kliknięcia w oderwaniu od
  całości) generuje mnóstwo małych botów bez łącznego efektu end-to-end — patrz insight VSM:
  liczy się lead time całego strumienia, nie punktowe usprawnienie.
- **Koncentracja wolumenu** — jeśli mała liczba wariantów/typów transakcji odpowiada za większość
  wolumenu (zasada 80/20), priorytet idzie tam — automatyzacja głównej ścieżki + eskalacja
  wyjątków do człowieka daje większość wartości przy ułamku effortu potrzebnego na pokrycie 100%
  przypadków.
- **Stabilność jako ukryty koszt** — niska stabilność procesu/UI nie dyskwalifikuje automatyzacji
  od razu, ale radykalnie zmienia wybór technologii (API zamiast UI scraping, gdzie to możliwe)
  i budżet utrzymania — pomiń ten wymiar, a program automatyzacji „umiera z tysiąca cięć"
  (boty psują się przy każdej aktualizacji systemu źródłowego, zespół utrzymania rośnie szybciej
  niż zespół rozwoju).
- **Dopasowanie technologii do profilu, nie do mody** — trend rynkowy (agentic AI) kusi do
  stosowania najcięższej technologii wszędzie; profil kryteriów (4.3) ma dyscyplinować wybór —
  proces w 100% regułowy z czystymi danymi API to zmarnowany budżet na agenta LLM, nie postęp.
- **TCO, nie tylko koszt wdrożenia** — proces z niskim effortem wdrożeniowym, ale wysokim kosztem
  utrzymania (kruchy bot na niestabilnym legacy UI) systematycznie zaniża się w macierzy effort,
  jeśli liczy się tylko dev-time. Trzeba doliczyć koszt utrzymania w horyzoncie 2-3 lat, inaczej
  „quick win" okazuje się długoterminową pułapką kosztową.
- **Braki w danych jako sam w sobie insight** — jeśli rejestr kandydatów pochodzi wyłącznie
  z top-down zgłoszeń (brak process miningu), to sam fakt jest insightem: organizacja **nie widzi**
  swojego prawdziwego pipeline'u, tylko to, co zostało zgłoszone głośno — priorytet inwestycyjny
  może być „zbuduj widoczność (process mining/logi)", zanim zbuduje się kolejnego bota.

---

## 6. INSIGHTY — rdzeń narzędzia

To jest właściwy produkt Automation Pipeline jako narzędzia transformacji — **co WYNIKA** z oceny,
nie tylko ranking:

1. **„Proces X = wysoki wolumen + w pełni regułowy + dane ustrukturyzowane = kandydat #1
   (quick win, RPA klasyczne)."** — jednoznaczna rekomendacja gotowa do wpięcia w inicjatywę
   z właścicielem i celem liczbowym (FTE-godziny do odzyskania).
2. **„50% zgłoszonego wolumenu siedzi w procesach nieautomatyzowalnych BEZ zmiany reguł
   biznesowych najpierw."** — insight, który zatrzymuje pipeline przed marnowaniem budżetu i
   przekierowuje na inicjatywę redesignu procesu (nie technologii).
3. **„Automatyzujemy chaos, nie proces."** — gdy % wyjątków/wariantów jest wysoki, a mimo to
   organizacja naciska na automatyzację — sygnał do zarządu, że kolejność jest odwrócona: najpierw
   standaryzacja, potem bot; automatyzacja niestandaryzowanej ścieżki tylko zabetonuje obecny
   bałagan w kodzie bota.
4. **„80% wolumenu w tym procesie to 3 z 15 wariantów — reszta to długi ogon niewart osobnej
   automatyzacji."** — konkretna rekomendacja zakresu: automatyzuj główną ścieżkę + eskalacja
   wyjątków do człowieka, nie „pokryj 100% przypadków od razu".
5. **„Ten proces wygląda na kandydata RPA, ale profil danych (nieustrukturyzowane dokumenty)
   wymaga najpierw warstwy IDP — inaczej wdrożenie utknie na etapie ekstrakcji danych."** —
   koryguje błędny dobór technologii, zanim padnie na to budżet.
6. **„Portfel X botów ma rosnący koszt utrzymania — Y% wdrożeń kruchych na niestabilnym UI
   przekracza już koszt oryginalnego procesu manualnego."** — insight z przeglądu istniejącego
   pipeline'u, uzasadnia inicjatywę przebudowy (migracja na API/AI-native) albo wygaszenia.
7. **„Braku widoczności: rejestr kandydatów pochodzi w 90% z top-down zgłoszeń — brak process
   miningu oznacza, że nie widzimy prawdziwego pipeline'u."** — insight strukturalny, priorytet
   inwestycyjny to narzędzie odkrywania procesu, nie kolejny bot.
8. **„Ograniczenie wartości leży nie w technologii, tylko w organizacji: proces X kwalifikuje się
   technicznie od 2 kwartałów, ale nie ma właściciela biznesowego gotowego przejąć governance bota."**
   — insight o barierze wdrożeniowej pozatechnicznej, częsty powód, dla którego „gotowe technicznie"
   pipeline'y stoją w miejscu.

Każdy insight z tej sekcji ma kończyć się **konkretną pozycją w pipeline** (proces + technologia +
priorytet + właściciel + szacunek FTE-godzin) albo **inicjatywą poprzedzającą automatyzację**
(redesign procesu, budowa integracji API, wdrożenie process miningu) — ocena, która tylko rankinguje
listę bez wskazania, co dokładnie robić dalej i dlaczego coś odpada, nie spełniła swojej funkcji.

---

## 7. Worked example

**Kontekst:** firma usługowa B2B (~1200 pracowników), dział operacji zgłosił 22 pomysły na
automatyzację po pierwszym roku pilotażu RPA (3 wdrożone boty punktowe, bez wspólnego rankingu).
Zarząd wstrzymał dalsze zgłoszenia do czasu uporządkowania pipeline'u.

**Zbieranie danych:** dla każdego z 22 kandydatów zebrano wolumen (z logów ERP/ticketing, nie
z deklaracji właścicieli), czas manualny (task mining na próbie 2 tygodni), ustrukturyzowanie
danych i stabilność systemów źródłowych.

**Wynik scoringu (wybrane 4 z 22, ilustracyjnie):**

| Proces | Wolumen/mies. | Regułowość | Dane | Stabilność | Effort | Impact | Ćwiartka | Technologia |
|---|---|---|---|---|---|---|---|---|
| A. Uzgadnianie faktur dostawców | 3 400 | Wysoka | Nieustrukturyzowane (PDF różnych dostawców) | Wysoka | Średni | Wysoki | Quick win | IDP + RPA |
| B. Onboarding nowego klienta | 180 | Niska (18% wyjątków, brak dominującej ścieżki) | Mieszane | Niska (proces w trakcie redesignu) | Wysoki | Wysoki (pozornie) | Question mark → redesign najpierw | — |
| C. Raport miesięczny statusu SLA | 12 | Wysoka | Ustrukturyzowane (API) | Wysoka | Niski | Niski | Fill-in | RPA |
| D. Klasyfikacja i routing zgłoszeń serwisowych | 5 600 | Średnia (klasyfikacja treści swobodnej) | Nieustrukturyzowane (e-mail/tekst) | Wysoka | Wysoki | Bardzo wysoki | Strategic bet | IPA (ML klasyfikacja + RPA routing) |

**Co wyszło z danych (INSIGHTY, nie tylko ranking):**
- Proces B (onboarding) był **najgłośniej zgłaszanym** pomysłem (sponsor na poziomie dyrektora
  sprzedaży) i wyglądał na wysoki impact — ale 18% wyjątków i brak dominującej ścieżki (proces był
  w trakcie nieformalnego redesignu od 6 miesięcy) oznaczało, że każdy bot musiałby być
  przebudowywany co kwartał. Insight: **to kandydat do redesignu procesu, nie automatyzacji** —
  odesłany do osobnej inicjatywy standaryzacji, re-ocena za 2 kwartały.
- Proces A (uzgadnianie faktur) był nisko na liście zgłoszeń top-down (nikt się nie skarżył
  głośno), ale process mining ujawnił **3 400 transakcji/miesiąc** i 40 min manualnej pracy każda
  — największy pojedynczy blok FTE-godzin w całym rejestrze, wcześniej niewidoczny, bo „tak już
  zawsze było".
- Proces D wymagał ML do klasyfikacji treści (nie da się w pełni regułowo rozstrzygnąć pilności
  zgłoszenia z tekstu swobodnego) — zespół pierwotnie planował to jako proste RPA (routing wg
  słów kluczowych), co dawałoby ~40% trafności. Insight skorygował dobór technologii przed
  rozpoczęciem wdrożenia, oszczędzając przebudowę w połowie projektu.
- **50% zgłoszonego wolumenu** (mierzonego w FTE-godzinach z 22 kandydatów) leżało w procesach
  ocenionych jako niegotowe technicznie (niska standaryzacja/stabilność) — wymagały redesignu,
  zanim jakakolwiek technologia miała sens.

**Pipeline końcowy (rekomendacja):**
- Fala 0 (0-3 mies.): proces A (quick win, IDP+RPA) — dowód koncepcji, ~2 270 FTE-godzin/rok
  do odzyskania.
- Fala 1 (3-9 mies.): pozostałe quick winy z rankingu (5 procesów) + budowa Center of Excellence.
- Fala 2 (9-18 mies.): proces D jako strategic bet, z dedykowanym sponsorem i etapami (najpierw
  klasyfikacja z człowiekiem w pętli, potem pełna automatyzacja routingu po walidacji trafności).
- Równolegle, osobna inicjatywa: redesign procesu B (onboarding) — automatyzacja odłożona do
  czasu ustabilizowania ścieżki.

**Wynik:** zarząd odblokował budżet na Falę 0-1 (uzasadnienie liczbowe, nie polityczne), proces B
zdjęty z listy sporów (przestał być punktem tarcia między sponsorem a zespołem automatyzacji),
pipeline stał się żywym rejestrem z kwartalnym odświeżaniem zamiast jednorazowej listy 22 pozycji.

---

## 8. Źródła

- [Intelligent process automation: The engine at the core of the next-generation operating model — McKinsey](https://www.mckinsey.com/capabilities/tech-and-ai/our-insights/intelligent-process-automation-the-engine-at-the-core-of-the-next-generation-operating-model)
- [Global Intelligent Automation Survey Results — Deloitte Insights](https://www.deloitte.com/us/en/insights/topics/talent/intelligent-automation-2022-survey-results.html)
- [AI agents and business process automation — Deloitte](https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/articles/ai-agents-in-collaborative-automation.html)
- [Deloitte drives internal efficiencies using UiPath business automation platform — UiPath case study](https://www.uipath.com/resources/automation-case-studies/deloitte-scales)
- [What is intelligent process automation? A complete guide — Appian](https://appian.com/learn/topics/process-automation/intelligent-process-automation)
- [RPA vs. Hyperautomation: What's the Difference? — Appian](https://appian.com/blog/acp/process-automation/rpa-vs-hyperautomation)
- [Gartner IT Automation Trends: What Is Intelligent Automation — summary of Gartner hyperautomation coverage](https://www.advsyscon.com/blog/gartner-it-automation/)
- [How to Prioritize Processes for Automation — Bizagi (effort/impact/readiness matrix)](https://www.bizagi.com/en/blog/how-to-prioritize-processes-for-automation)
- [Process Mining to Prioritization: A Practical Playbook for High-ROI Automation Pipelines — gNxtSystems](https://gnxtsystems.com/process-mining-to-prioritization-a-practical-playbook-for-high-roi-automation-pipelines/)
- [How to Idenitfy RPA Opportunities — MuleSoft](https://www.mulesoft.com/automation/identify-rpa-opportunities)
- [RPA Lifecycle Management: Stages of the RPA Lifecycle — Blueprint](https://www.blueprintsys.com/blog/rpa/rpa-lifecycle-management)
- [Robotic Process Automation (RPA): Process prioritization using Cognitive Complexity matrix — Psychology and Education Journal](http://psychologyandeducation.net/pae/index.php/pae/article/view/2688)
- [How to Assess Automation Feasibility — Growth Process Automation](https://www.growthprocessautomation.com/post/how-to-assess-automation-feasibility)
- [Feasibility Assessment: The Backbone of Automation Success — Accelirate](https://www.accelirate.com/feasibility-assessment-the-backbone-of-automation-success/)
- [Celonis vs UiPath: Process Mining Compared — Scribe](https://scribe.com/library/celonis-vs-uipath)
- [UiPath vs. Celonis vs. Kyp.ai: Get to Know the Leading Task Mining Tools — Flobotics](https://flobotics.io/blog/task-mining-tools)

---

*Doktryna sporządzona 2026-07-08 na potrzeby narzędzia `automation-pipeline` w Consultify. Zasada
nadrzędna: narzędzie istnieje po to, by wyprodukować sekcję 6 (insighty) — reszta dokumentu to
rusztowanie metodologiczne, które ma tę sekcję uwiarygodnić i sparametryzować.*
