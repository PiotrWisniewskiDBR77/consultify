# Constraint Control — doktryna narzędzia

**Rodzina metodyczna:** Theory of Constraints (Goldratt) — Drum-Buffer-Rope (DBR), Pięć Kroków Fokusujących (5FS), Throughput Accounting (TA), Critical Chain Project Management (CCPM) dla wariantu projektowego.
**Status:** doktryna źródłowa dla narzędzia `constraint-control` w Consultify.
**Data:** 2026-07-08.

---

## 1. Cel

Theory of Constraints (TOC) opiera się na jednym zdaniu, które trzeba wbić w głowę zanim
cokolwiek innego: **przepustowość CAŁEGO systemu jest równa przepustowości jego NAJSŁABSZEGO
ogniwa — nie sumie ani średniej możliwości wszystkich ogniw.** Łańcuch jest tak silny, jak jego
najsłabsze ogniwo (Goldratt, *The Goal*, 1984). System — fabryka, dział sprzedaży, proces
doradczy, zespół projektowy — to nie zbiór niezależnych zasobów, tylko sekwencja zależnych
kroków. Wzmacnianie dowolnego ogniwa poza wąskim gardłem (constraint) nie zwiększa wydajności
całości — to strata czasu, budżetu i uwagi zarządu.

Cel narzędzia: **zidentyfikować, gdzie faktycznie znajduje się ograniczenie systemu** (nie tam,
gdzie "wygląda na zajęte"), i zbudować wokół niego dyscyplinę zarządczą (5 kroków + DBR), która
podnosi przepustowość całości bez kosztownej rozbudowy wszystkiego naraz. TOC nie optymalizuje
kosztów lokalnych — optymalizuje **Throughput** (T) systemu jako całości, bo to on generuje
pieniądze; koszty i efektywność lokalna są wtórne.

## 2. Kiedy używać

Sygnały, że system ma aktywny, nie w pełni zarządzany constraint:

- **Opóźnienia dostaw / terminów rosną**, mimo że poszczególne zespoły raportują wysokie
  wykorzystanie i "nie mają zapasu mocy".
- **WIP (work-in-progress) puchnie** — coraz więcej zadań "w toku", coraz mniej "zamkniętych";
  kolejka przed jednym konkretnym etapem/osobą/maszyną rośnie miesiąc do miesiąca.
- **Moce ogólne rosną, lead time też rośnie** — firma zatrudnia, kupuje sprzęt, a mimo to czas
  realizacji się wydłuża. To klasyczny sygnał, że inwestuje się w NIE-ograniczenie.
  Zgodnie z regułą lokalnych optimów: dodawanie mocy przed lub po wąskim gardle nie tylko nie
  pomaga, ale POGARSZA sytuację (rośnie WIP przed constraintem, rośnie chaos priorytetów).
- **Chroniczny expediting** wokół jednego zasobu — kierownicy stale "przepychają" pilne sprawy
  przez ten sam etap/osobę.
- **Konflikt priorytetów bez końca** — każdy dział twierdzi, że to on jest "najważniejszy" i
  potrzebuje najwięcej zasobów; brak jednego wspólnego rytmu pracy (drum).
- W doradztwie/usługach profesjonalnych: **jeden ekspert/etap recenzji/jedna brama jakości**
  systematycznie opóźnia wszystkie projekty, niezależnie od tego, ile innych zasobów dołożono.

NIE używać, gdy problem to brak popytu (wtedy constraint jest na rynku, nie w systemie
wewnętrznym) — TOC to najpierw rozpoznaje i przekierowuje wysiłek na sprzedaż/marketing, nie na
usprawnianie operacji.

## 3. Inputy

Do prowadzenia analizy TOC/DBR potrzeba:

1. **Mapa kroków procesu** (sekwencja, nie organigram) — od "popytu" (zamówienie/brief klienta)
   do "dostawy" (produkt/rezultat u klienta).
2. **Przepustowość per krok** — ile jednostek pracy krok potrafi przetworzyć w jednostce czasu
   (capacity rate), niezależnie od tego, ile mu się aktualnie zleca.
3. **Popyt** — ile jednostek pracy system musi przetworzyć w tej samej jednostce czasu (demand
   rate). Constraint = krok, gdzie capacity < demand (lub jest najbliżej tej granicy).
4. **Bufory** — aktualne zapasy/kolejki przed każdym krokiem (czasowe lub ilościowe); ich
   zachowanie w czasie (rosną/maleją/stabilne) to najtańszy sygnał diagnostyczny.
5. **Polityki** — reguły, harmonogramy, SLA, kolejność priorytetyzacji, systemy premiowe.
   Polityki są NAJCZĘSTSZYM ukrytym ograniczeniem (policy constraint) — częściej niż brak
   maszyny czy osoby.
6. **Dane finansowe do Throughput Accounting**: cena sprzedaży, całkowicie zmienny koszt (TVC),
   koszty operacyjne stałe (OE), kapitał związany w systemie (I) — inwentarz, WIP, narzędzia.

## 4. Metoda

### 4.1 Pięć Kroków Fokusujących (Five Focusing Steps / POOGI)

1. **IDENTIFY (Zidentyfikuj)** — znajdź ograniczenie systemu. Nie zgaduj po "kto wygląda na
   zajętego" — szukaj najdłuższej kolejki oczekiwania PRZED krokiem, chronicznego "gaszenia
   pożarów" wokół jednego zasobu, etapu o najwyższym wykorzystaniu połączonym z długim czasem
   oczekiwania. Potwierdź dowodem: penetracja bufora, % "na czas do constraintu".
2. **EXPLOIT (Wykorzystaj)** — wyciśnij maksimum z ograniczenia BEZ inwestycji kapitałowej.
   Usuń przestoje, przezbrojenia, przerwy, błędy/poprawki na tym etapie, pracę niskiej wartości.
   Typowe dźwignie: kontrola jakości TUŻ PRZED constraintem (żeby nie marnował czasu na wadliwy
   input), zmiana kolejności zadań na constraincie wg reguły najkrótszy-najpierw lub
   najbardziej-krytyczny-najpierw, eliminacja przerw/spotkań w godzinach pracy constraintu.
   Reguła praktyków: większość ograniczeń jest wykorzystywana poniżej 50% swojego realnego
   potencjału, zanim ktokolwiek zajmie się Exploit.
3. **SUBORDINATE (Podporządkuj)** — WSZYSTKO inne w systemie dostosuj do rytmu ograniczenia.
   Reszta procesu (bufory materiałowe/informacyjne przed constraintem, harmonogramy innych
   zespołów, systemy premiowe) ma służyć temu, by constraint nigdy nie stał bezczynnie i nigdy
   nie był zalewany więcej niż potrafi przetworzyć. To krok najtrudniejszy politycznie — wymaga,
   by "wydajne" zespoły ZWOLNIŁY tempo albo czekały, bo produkowanie więcej niż constraint
   przyjmie tylko puchnie WIP i nie zwiększa przepustowości całości.
4. **ELEVATE (Podnieś)** — dopiero gdy kroki 1-3 wyczerpane, inwestuj: dodatkowy etat, maszyna,
   nadgodziny, outsourcing fragmentu pracy constraintu. Klasyczny błąd praktyków: przeskakiwanie
   od razu do Elevate (najbardziej kosztowne i najwolniejsze) z pominięciem darmowego zysku
   ukrytego w krokach 1-3 — analizy pokazują często 20-30% ukrytej wydajności możliwej do
   odzyskania bez wydawania złotówki.
5. **REPEAT / PREVENT INERTIA (Powtórz, nie daj się bezwładności)** — gdy ograniczenie się
   przesunie (a po Elevate zawsze się przesunie — do innego kroku albo z powrotem na rynek),
   wróć do kroku 1. Pułapka: polityki i nawyki zbudowane wokół starego constraintu ("zawsze
   priorytetyzujemy dział X") zostają, mimo że dział X przestał być ograniczeniem — to sama
   polityka staje się nowym, ukrytym ograniczeniem (inertia jako constraint).

### 4.2 Drum-Buffer-Rope (DBR)

Mechanizm operacyjny wdrażający Subordinate w praktyce:

- **Drum (bęben)** — harmonogram constraintu wyznacza rytm CAŁEGO systemu. To constraint mówi,
  ile pracy i w jakim tempie wchodzi do procesu — nie odwrotnie.
- **Buffer (bufor)** — zapas czasu/materiału/informacji przed constraintem, chroniący go przed
  przestojem z powodu zmienności wcześniejszych etapów. Wielkość bufora = ubezpieczenie, nie
  marnotrawstwo; monitorowana penetracja bufora (zielona/żółta/czerwona strefa) to główny
  wskaźnik sterowania, zastępujący klasyczny "procent ukończenia zadania".
- **Rope (lina)** — mechanizm uwalniania nowej pracy do systemu zsynchronizowany z tempem
  constraintu (a nie z tempem "ile chcielibyśmy zacząć"). Rope zapobiega narastaniu WIP przed
  constraintem — nic nie wchodzi do systemu szybciej, niż constraint jest w stanie to wchłonąć.

Wariant projektowy: **Critical Chain Project Management (CCPM)** — bufor nie jest doklejany do
każdego zadania z osobna (co i tak ginie w Studenckim Syndromie/Prawie Parkinsona), tylko
zbierany w jeden wspólny bufor projektowy na końcu łańcucha krytycznego + bufory zasilające
(feeding buffers) przy zależnościach. Zarządzanie odbywa się przez penetrację bufora, nie przez
tradycyjny Earned Value. Odnotowane efekty w publikacjach branżowych: projekty 10-50% szybsze
i/lub tańsze niż klasyczny CPM/Gantt.

### 4.3 Throughput Accounting (T, I, OE)

TOC odrzuca alokację kosztów pośrednich per produkt/projekt (źródło błędnych decyzji w
rachunkowości kosztowej) na rzecz trzech miar systemowych:

- **T (Throughput)** = Sprzedaż − Całkowicie Zmienny Koszt (materiał/podwykonawstwo bezpośrednio
  związane z daną jednostką pracy). Tempo, w jakim system generuje pieniądze poprzez sprzedaż.
- **I (Investment/Inventory)** = kapitał uwięziony w systemie — zapasy, WIP, narzędzia, licencje,
  nieukończona praca klienta.
- **OE (Operating Expense)** = wszystkie pieniądze, które system wydaje, by zamienić I w T —
  pensje, czynsz, koszty stałe.

Wzory decyzyjne: **Zysk netto = T − OE**; **ROI = (T − OE) / I**; **Produktywność = T/OE**;
**Rotacja inwestycji = T/I**. Każda decyzja lokalna (przyjąć zlecenie, dodać etat, kupić
narzędzie) oceniana jest przez pytanie: *jak to zmienia T, I i OE CAŁEGO systemu* — nie przez
"czy ten dział/projekt jest tani/drogi" w oderwaniu od reszty.

## 5. Jak się WNIOSKUJE

- **Lokalizacja constraintu = czytanie kolejki, nie czytanie zajętości.** Zasób, który wygląda
  na "100% zajęty", może wcale nie być ograniczeniem — może po prostu pracować nad rzeczami bez
  znaczenia dla przepustowości. Sygnał prawdziwego ograniczenia to KOLEJKA PRZED nim, która
  systematycznie rośnie lub nie znika, oraz to, że reszta systemu czeka NA NIEGO, a nie odwrotnie.
- **Reguły subordynacji wynikają z pytania "czy to karmi constraint, czy tylko wygląda
  produktywnie".** Zespół, który pracuje szybciej niż constraint potrafi wchłonąć, nie pomaga —
  tworzy WIP i chaos priorytetów. Wniosek operacyjny: zwolnij zespoły niebędące ograniczeniem
  do tempa Rope, nawet jeśli to wygląda na "marnowanie ich potencjału" — ich potencjał i tak nie
  przekłada się na przepustowość systemu.
- **Kiedy Elevate, a kiedy nie jeszcze.** Elevate jest uzasadniony dopiero, gdy Exploit +
  Subordinate wyczerpane, a mimo to constraint pozostaje ograniczeniem i różnica capacity-demand
  jest realna (nie efekt złej sekwencji/priorytetyzacji). Elevate przed wyczerpaniem 1-3 to
  najdroższy sposób na kupienie wyniku, który można było dostać za darmo.
- **Pułapka "lokalnych optimów"**: suma lokalnych usprawnień (każdy dział szybszy, tańszy,
  bardziej "efektywny" osobno) NIE SUMUJE SIĘ do usprawnienia systemu — w systemie zależnym
  (sekwencja kroków) lokalne optima w interakcji ROBIĄ RZECZY GORSZYMI (więcej WIP przed
  constraintem, więcej presji na priorytety, dłuższy lead time mimo wyższej "efektywności"
  raportowanej per dział). Praktyczny test: jeśli usprawnienie nie dotyczy constraintu i nie
  zmienia T/I/OE całości, to jest kosmetyka, nie postęp.
- **Inercja jako niewidzialny constraint.** Po Elevate, gdy ograniczenie się przesuwa, stare
  polityki (priorytety, SLA, systemy premiowe, "zawsze najpierw dział X") zostają z przyzwyczajenia
  i same stają się nowym ograniczeniem — teraz niematerialnym, trudniejszym do zdiagnozowania niż
  brakująca maszyna, bo "przecież nic się nie zmieniło w strukturze". Diagnostyka: pytaj nie
  tylko "gdzie jest kolejka fizyczna", ale "jaka reguła/polityka zmusza system do zachowania,
  które nie ma już uzasadnienia".
- **Policy constraint jako domyślna hipoteza pierwsza.** Zanim uzna się ograniczenie za fizyczne
  (brakuje ludzi/maszyn/budżetu), sprawdź, czy to nie polityka (kolejność zatwierdzeń, reguła
  zakupowa, sposób premiowania, sztywny harmonogram spotkań) sztucznie zawęża przepustowość.
  Technika Evaporating Cloud (Chmura Konfliktu) służy do wydobycia ukrytego, błędnego założenia
  leżącego u podstaw pozornego konfliktu ("musimy X, ale też musimy Y, więc utknęliśmy") —
  usunięcie tego jednego złego założenia często rozwiązuje konflikt bez kompromisu.

## 6. INSIGHTY (rdzeń narzędzia — to jest wartość dla klienta)

To jest sekcja, dla której narzędzie istnieje. Insighty, które TOC ma generować w realnym
zaangażowaniu doradczym:

1. **"Ograniczeniem systemu jest X. Każda godzina stracona na X jest godziną straconą dla
   CAŁEJ organizacji — bez odzysku."** To zdanie zmienia rozmowę zarządu z "gdzie oszczędzić"
   na "gdzie każda minuta ma 10x wagę". Jeśli constraint traci godzinę na czekanie, spotkanie
   bez znaczenia, błąd do poprawki — cały system traci godzinę przepustowości, niezależnie od
   tego, jak "zajęte" i "produktywne" są wszystkie inne zasoby w tym czasie.
2. **"Każda godzina zaoszczędzona GDZIE INDZIEJ niż na X jest iluzją — nie zwiększa
   przepustowości, tylko przenosi koszt gdzie indziej albo tworzy zapas przed X."** To najbardziej
   kontrintuicyjny i najcenniejszy insight dla zarządu przyzwyczajonego do myślenia "efektywność
   wszędzie = dobrze". Trzeba umieć pokazać liczbami (T/I/OE), że inwestycja w nie-constraint nie
   zmienia wyniku finansowego systemu — tylko zmienia wygląd raportów działowych.
3. **Polityki jako ukryte ograniczenie → materiał na inicjatywy transformacyjne.** Najbardziej
   wartościowe odkrycie w projekcie TOC to nie "brakuje nam ludzi na etapie Y", tylko "reguła
   zatwierdzania Z sztucznie tworzy kolejkę, której fizycznie nie musi być". To przechodzi wprost
   do rejestru inicjatyw: zmiana polityki jest tańsza i szybsza niż Elevate (zatrudnienie/CAPEX),
   a często daje większy efekt na przepustowość.
4. **Test lokalnego optimum jako filtr priorytetyzacji inicjatyw.** Każdą propozycję usprawnienia
   zgłoszoną przez dział należy przepuścić przez pytanie: "czy to podnosi Exploit/Subordinate/
   Elevate na faktycznym constraincie, czy poprawia metrykę lokalną, która nie zmienia T systemu?".
   To natychmiast oddziela inicjatywy wysokiej dźwigni od kosmetyki organizacyjnej — i jest
   twardym, obronialnym kryterium do prezentacji zarządowi (nie opinia, tylko logika systemu).
5. **Sygnał inercji = najdroższy do zdiagnozowania, bo nie boli namacalnie.** Gdy ograniczenie
   już się przesunęło (po Elevate albo po zmianie popytu), a organizacja wciąż działa według
   starych priorytetów — koszt nie jest widoczny w żadnym raporcie wprost, tylko w rosnącym
   rozjeździe między tym "co się mierzy" a tym "co faktycznie ogranicza wynik". To insight, który
   uzasadnia CYKLICZNY przegląd (nie jednorazowy audyt) — TOC jest procesem ciągłym (POOGI:
   Process Of OnGoing Improvement), nie jednorazowym projektem.

## 7. Worked example

**Kontekst:** butik doradczy (analogiczny do Consultify) realizuje projekty transformacyjne dla
klientów korporacyjnych. Proces: (1) Discovery z klientem → (2) Analiza danych/model → (3) Draft
rekomendacji przez konsultanta → (4) **Review przez Partnera** → (5) Prezentacja klientowi.

**Objaw:** projekty systematycznie ślizgają się o 1-2 tygodnie względem planu. Zespół Discovery
i Analizy raportują 90%+ obłożenia i proszą o dodatkowych analityków. Partner mówi "jestem
zawalony, ale to normalne w tym biznesie".

**Krok 1 — Identify.** Mapa kolejek pokazuje: przed etapem (3) Draft — kolejka 0.5 dnia; przed
etapem (4) Review Partnera — kolejka rosnąca, obecnie 4-6 dni robić na projekt i systematycznie
się wydłuża w miarę wzrostu liczby projektów w portfelu. Wniosek: **constraintem jest czas
Partnera na Review**, nie zespół analityczny (który akurat jest zajęty, ale nie jest wąskim
gardłem — jego kolejka nie rośnie).

**Krok 2 — Exploit.** Audyt czasu Partnera pokazuje: 40% czasu przeznaczonego na Review idzie na
poprawki formatu i luki w danych, które powinny być złapane wcześniej, oraz na spotkania
wewnętrzne niezwiązane z Review. Działania bez CAPEX: (a) checklist jakości przed przekazaniem
draftu do Partnera (łapie braki formatu/danych PRZED, nie NA etapie Partnera), (b) zablokowane
2 bloki po 2h dziennie wyłącznie na Review, bez przerywania spotkaniami, (c) kolejność Review wg
reguły "najbliższy deadline klienta pierwszy", nie "kto pierwszy przyszedł".

**Krok 3 — Subordinate.** Zespół Analizy/Draftu ma jasną instrukcję: NIE przyśpieszać produkcji
draftów ponad tempo, jakie Partner może realnie zrecenzować — nadprodukcja draftów tylko puchnie
kolejkę przed Review i pogarsza widoczność priorytetów. Harmonogram Discovery dla nowych
projektów jest synchronizowany (Rope) z realną przepustowością Review, nie z chęcią zespołu
sprzedaży, by "wciągnąć więcej projektów na raz".

**Krok 4 — Elevate (dopiero teraz, jeśli nadal potrzebne).** Jeśli po krokach 1-3 kolejka wciąż
rośnie: opcje to (a) drugi Partner/Principal uprawniony do Review części typów projektów, (b)
ustrukturyzowany template Review skracający czas per projekt, (c) delegacja pierwszego przebiegu
Review do Senior Managera z finalnym sign-off Partnera tylko na wyjątkach.

**Krok 5 — Repeat.** Po wdrożeniu, ograniczenie może przesunąć się z powrotem na Discovery/Sales
(bo teraz portfel projektów przepływa szybciej i sprzedaż musi dostarczać więcej leadów) — wraca
się do kroku 1 z nowym constraintem. Pułapka do pilnowania: reguła "Partner recenzuje wszystko
osobiście" może zostać z przyzwyczajenia jako polityka, nawet gdy przestanie być potrzebna —
trzeba ją świadomie zweryfikować przy każdym Repeat.

**Throughput Accounting w tym przykładzie:** T = liczba zamkniętych projektów × wartość
kontraktu (nie liczba "godzin przepracowanych" per dział). Dodanie analityka w Discovery
zwiększa OE i I bez zwiększenia T (bo constraint pozostaje przy Partnerze) — czysta strata ROI.
Skrócenie kolejki Review o 3 dni na projekt, bez dodatkowego zatrudnienia, zwiększa T przy
niezmienionym OE — to jest dźwignia, którą TOC każe szukać najpierw.

## 8. Źródła

- Eliyahu M. Goldratt, *The Goal: A Process of Ongoing Improvement* (1984) — źródłowa książka TOC.
- Eliyahu M. Goldratt, *Critical Chain* (1997) — CCPM, buforowanie projektowe.
- [Theory of Constraints Institute — Five Focusing Steps](https://www.tocinstitute.org/five-focusing-steps.html)
- [Theory of Constraints Institute — Examples of Constraints](https://www.tocinstitute.org/examples-of-constraints.html)
- [Theory of constraints — Wikipedia](https://en.wikipedia.org/wiki/Theory_of_constraints)
- [Throughput accounting — Wikipedia](https://en.wikipedia.org/wiki/Throughput_accounting)
- [TOCICO — Back to Basics: Throughput Accounting (PDF)](https://cdn.ymaws.com/www.tocico.org/resource/resmgr/portal_fm/Throughput_Accounting_Basics.pdf)
- [Goldratt Marketing — Throughput Accounting](https://www.toc-goldratt.com/en/product/throughput-accounting)
- [Forte Labs — Theory of Constraints 102: The Illusion of Local Optima](https://fortelabs.com/blog/theory-of-constraints-102-local-optima/)
- [Forte Labs — Theory of Constraints 105: Drum-Buffer-Rope](https://fortelabs.com/blog/theory-of-constraints-105-drum-buffer-rope/)
- [Forte Labs — Theory of Constraints 108: Identifying the Constraint](https://fortelabs.com/blog/theory-of-constraints-108-optimizing-the-constraint/)
- [Synchronix — Theory of Constraints: Policy Constraints, 5 Steps](https://www.synchronix.com/toc_exploit_subordinate_elevate.htm)
- [BDC — Implementing Drum-Buffer-Rope in your production planning](https://www.bdc.ca/en/articles-tools/operations/operational-efficiency/production-planning-drum-buffer-rope)
- [PMI — Critical Chain Project Management: Theory](https://www.pmi.org/learning/library/critical-chain-project-management-theory-7118)
- [PMI — Analysis of Resource Buffer Management in Critical Chain Scheduling](https://www.pmi.org/learning/library/resource-buffer-management-critical-chain-scheduling-8027)
- [Lean Enterprise Institute — What is the Theory of Constraints, vs Lean Thinking](https://www.lean.org/the-lean-post/articles/what-is-the-theory-of-constraints-and-how-does-it-compare-to-lean-thinking/)
- [Umbrex — Theory of Constraints Five Focusing Steps](https://umbrex.com/resources/frameworks/organization-frameworks/theory-of-constraints-five-focusing-steps/)
