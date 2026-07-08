# Legacy Analyzer — doktryna narzędzia

> Analiza systemów legacy i racjonalizacja portfela aplikacji: co utrzymać, w co inwestować, co migrować, co wygasić — oraz ile dług technologiczny faktycznie kosztuje firmę. Metodyka: **Gartner TIME** (Tolerate/Invest/Migrate/Eliminate), **McKinsey tech-debt quantification**, **AWS 6R** (migracja chmurowa), mapa zależności.

---

## 1. Cel

Ocenić **cały portfel systemów IT** (nie pojedynczą aplikację) wzdłuż dwóch osi — wartość biznesowa i kondycja techniczna — i przypisać każdej aplikacji jedną z czterech decyzji: **Tolerate / Invest / Migrate / Eliminate**. Dla aplikacji przeznaczonych do migracji: dobrać jedną z sześciu strategii **6R**. Skwantyfikować dług technologiczny portfela (% budżetu IT, % wartości estate) i ryzyko (bezpieczeństwo, wygasające wsparcie, key-person dependency), żeby uzasadnić — liczbami, nie odczuciem — które modernizacje wchodzą do roadmapy w tym roku, a które czekają.

Narzędzie nie ocenia kodu linia po linii. Ocenia **portfel jako całość**, żeby zarząd mógł zdecydować, gdzie idzie ograniczony budżet modernizacji: 10 aplikacji nie da się naprawić naraz.

## 2. Kiedy używać

- Firma planuje modernizację IT lub transformację cyfrową i musi ustalić kolejność (nie da się zrobić wszystkiego naraz).
- Koszty utrzymania rosną z roku na rok bez wzrostu funkcjonalności — sygnał, że portfel się zestarzał.
- Rośnie ryzyko: system bez wsparcia dostawcy, licencje wygasające, brak osób znających kod (bus factor), luki bezpieczeństwa w przestarzałym stacku.
- Przed dużą inwestycją (nowy ERP, migracja do chmury, fuzja/przejęcie) — trzeba wiedzieć, co jest w portfelu i co się z tym stanie.
- Roczne planowanie budżetu IT — ile idzie w utrzymanie „status quo" (tech debt), ile w nowe możliwości.
- Audyt due diligence (M&A) — kupujący/sprzedający musi znać realną kondycję stosu technologicznego.
- Konflikt priorytetów między biznesem a IT o to, co wejdzie do rocznego planu — macierz daje wspólny, niearbitralny język zamiast przeciągania liny na argumentach „bo tak czuję".
- Po incydencie bezpieczeństwa lub poważnej awarii — moment, w którym organizacja jest gotowa sfinansować to, co wcześniej odkładała; narzędzie porządkuje reakcję w systemową ocenę zamiast gaszenia pojedynczego pożaru.

## 3. Inputy

- **Inwentarz aplikacji**: pełna lista systemów (nazwa, właściciel biznesowy, właściciel techniczny, data wdrożenia, liczba użytkowników).
- **Wartość biznesowa per aplikacja**: krytyczność dla procesów, przychód/koszt powiązany, liczba użytkowników, unikalność funkcji (czy da się kupić gotowe zamiast utrzymywać).
- **Kondycja techniczna per aplikacja**: wiek stosu, wsparcie dostawcy (aktywne/wygasające/brak), znane luki bezpieczeństwa, liczba incydentów/rok, dostępność dokumentacji, liczba osób zdolnych do utrzymania (bus factor), koszt utrzymania rocznie (licencje + infrastruktura + FTE).
- **Ryzyko**: compliance (RODO, branżowe regulacje), data residency, wygasające certyfikaty/licencje, dostawca wychodzący z rynku.
- **Zależności międzysystemowe**: co z czym się integruje, jakie dane przepływają, czy integracja jest udokumentowana czy „nikt nie wie jak to działa".
- **Koszt całkowity posiadania (TCO)**: licencje, infrastruktura, FTE utrzymania, koszt incydentów, koszt szkoleń nowych pracowników na starym stosie.
- **Sygnały organizacyjne**: liczba osób zdolnych utrzymać system (i ich wiek/plany emerytalne/rotacja), czy dostawca/integrator wciąż istnieje na rynku, czy istnieje aktywna społeczność/ekosystem wokół technologii.
- **Kontekst strategiczny**: plany biznesowe na 2-3 lata (wejście na nowy rynek, fuzja, zmiana modelu operacyjnego) — bo wartość biznesowa aplikacji jest oceniana względem przyszłości, nie tylko dzisiejszego stanu.

## 4. Metoda

**4.1 Macierz TIME (Gartner)** — dwie osie:
- **Oś X — kondycja techniczna** (technical fit): jakość kodu, aktualność stosu, wsparcie dostawcy, bezpieczeństwo, koszt utrzymania względem wartości.
- **Oś Y — wartość biznesowa** (business/functional fit): jak dobrze aplikacja wspiera dzisiejsze potrzeby biznesu, krytyczność, unikalność.

Każda oś to nie pojedyncza liczba „na oko", tylko suma ważona podkryteriów ocenianych 1-5, żeby macierz nie była jedną subiektywną decyzją:

*Kondycja techniczna — podkryteria:*
1. Aktualność stosu technologicznego (czy wersje/framework mają aktywne wsparcie).
2. Bezpieczeństwo (znane CVE, ostatni pentest, zgodność z politykami).
3. Utrzymywalność (jakość kodu, pokrycie testami, dokumentacja, dług architektoniczny).
4. Dostępność kompetencji (bus factor, czy rynek dostarcza ludzi do tego stosu).
5. Koszt utrzymania względem wielkości systemu (TCO/użytkownika, TCO/transakcję).

*Wartość biznesowa — podkryteria:*
1. Krytyczność procesowa (co się stanie, jeśli system padnie na dzień/tydzień).
2. Zasięg (liczba użytkowników, liczba procesów które obsługuje).
3. Unikalność (czy funkcję da się kupić gotową, czy jest przewagą konkurencyjną).
4. Wkład w przychód/redukcję kosztu (bezpośredni lub pośredni).
5. Zgodność ze strategią (czy wspiera kierunek, w którym firma faktycznie idzie za 2-3 lata).

Wagi podkryteriów ustala się per organizacja (branża regulowana waży bezpieczeństwo/compliance wyżej; firma produktowa waży unikalność/przewagę konkurencyjną wyżej) — sam framework TIME jest neutralny, ale wagi nie powinny być domyślne bez refleksji nad kontekstem.

Cztery ćwiartki:
| | Wysoka kondycja techniczna | Niska kondycja techniczna |
|---|---|---|
| **Wysoka wartość biznesowa** | **INVEST** — rozwijaj, to koń pociągowy portfela | **MIGRATE** — biznes potrzebuje tej funkcji, ale platforma ją ogranicza; pilna modernizacja |
| **Niska wartość biznesowa** | **TOLERATE** — działa tanio, nie inwestuj, nie ruszaj bez powodu | **ELIMINATE** — podwójnie złe: kosztuje i nie daje wartości; wygaś |

**4.2 6R — strategia migracji** (stosowane do aplikacji w MIGRATE, czasem INVEST):
1. **Retain** — zostaw jak jest (jeszcze nie czas, zależności zbyt ryzykowne, ROI migracji ujemny w tym roku).
2. **Retire** — wyłącz (funkcja zduplikowana gdzie indziej albo już niepotrzebna).
3. **Rehost** ("lift-and-shift") — przenieś bez zmian (najszybsze, najmniej ryzykowne, nie redukuje długu technicznego, tylko lokalizacji).
4. **Replatform** ("lift-tinker-and-shift") — przenieś z punktowymi usprawnieniami (np. baza danych → usługa zarządzana), bez zmiany architektury.
5. **Repurchase** ("drop-and-shop") — zastąp gotowym SaaS; typowe gdy funkcja jest komodytyzowana (CRM, HR, księgowość).
6. **Refactor/Rearchitect** — przebuduj pod chmurę/mikroserwisy; najdroższe i najwolniejsze, ale jedyne, które faktycznie usuwa dług i odblokowuje skalowanie.

Wybór 6R zależy od: krytyczności biznesowej, rozmiaru długu technicznego, budżetu/czasu, wymagań wydajności/skali, compliance.

**4.3 Mapa zależności** — graf: które systemy z którymi rozmawiają, jakie dane przepływają, czy integracja jest udokumentowana. Krytyczne dla sekwencjonowania: nie da się wygasić/zmigrować systemu, od którego zależą trzy inne, bez planu przejściowego.

**4.4 Scoring długu technicznego** — per aplikacja i zagregowany dla portfela:
- **Dług % wartości estate**: koszt doprowadzenia do stanu „aktualny" / wartość odtworzeniowa aplikacji.
- **Dług % budżetu IT**: ile z rocznego budżetu idzie na „utrzymanie przy życiu" (patching, obejścia, ręczne workaroundy) zamiast na nowe możliwości.
- **Indeks ryzyka**: waga za brak wsparcia dostawcy, znane CVE, bus factor =1, wygasające licencje/compliance.

**4.5 Granulacja — kiedy oceniać cały system, kiedy jego część.** Duże aplikacje (ERP, core banking, platformy e-commerce) rzadko są jednorodnie dobre lub złe — moduł finansowy ERP może być stabilny i krytyczny (INVEST), a moduł raportowy tego samego ERP przestarzały i zastępowalny przez BI (MIGRATE/Replace). Ocena na poziomie zbyt wysokim (cały ERP = jedna kropka na macierzy) maskuje te różnice i prowadzi do decyzji „wszystko albo nic". Zasada: jeśli moduł ma osobnego właściciela biznesowego, osobny cykl release'ów lub wyraźnie inny profil ryzyka — ocenić osobno.

**4.6 Benchmark zewnętrzny.** Same wyniki portfela nabierają znaczenia dopiero w zestawieniu z punktem odniesienia: benchmark branżowy długu technicznego (McKinsey: 20-40% wartości estate to typowy zakres), mediana wieku stosu w branży, udział budżetu IT idący w „run" vs „change" (utrzymanie status quo vs nowe możliwości — zdrowy portfel celuje w odwrócenie proporcji im bliżej strategii transformacji).

## 5. Jak się WNIOSKUJE

- **Kondycja techniczna vs wartość biznesowa nie idą w parze** — to jest cała siła macierzy. Intuicja mówi „stary system = zły system", ale stary system o wysokiej wartości i przyzwoitej kondycji (stabilny, tani w utrzymaniu, robi swoje) to kandydat do TOLERATE, nie do drogiej wymiany. Odwrotnie: nowy system o niskiej wartości (kupiony pod jednorazowy projekt, teraz nieużywany) to kandydat do ELIMINATE mimo że „technicznie jest OK".
- **Sygnał „migruj"**: wysoka wartość biznesowa + pogarszająca się kondycja techniczna (rosnące koszty utrzymania rok do roku, rosnąca liczba incydentów, malejący bus factor, wygasające wsparcie w ciągu 12-24 mies.). Im bliżej daty końca wsparcia, tym wyższy priorytet — to twardy deadline, nie sugestia.
- **Sygnał „wygaś"**: niska wartość + niska kondycja + istnieje alternatywa gdzie indziej w portfelu (duplikacja funkcji). Czerwona flaga do ELIMINATE: aplikacja z <5 aktywnych użytkowników, brak właściciela biznesowego, funkcja pokrywana przez inny system.
- **Ukryta zależność jako blokada transformacji**: aplikacja oceniona jako ELIMINATE, ale będąca węzłem integracyjnym dla 4 innych systemów (np. legacy middleware przez które przechodzą wszystkie zamówienia), nie może zniknąć bez planu zastąpienia integracji. Mapa zależności musi wyprzedzać decyzję TIME — inaczej plan wygaszenia wybucha w fazie wdrożenia (migracja kończy się na warstwie bazy danych i psuje się na warstwie integracji, bo zależność nie była znana).
- **Pułapka „utrzymuj, bo działa"**: brak incydentu ≠ brak ryzyka. System bez wsparcia dostawcy i bez udokumentowanej wiedzy (bus factor 1, autor odszedł 3 lata temu) jest w grupie wysokiego ryzyka, nawet jeśli od lat „nic się nie psuje" — ryzyko materializuje się skokowo (odejście jedynej osoby, luka bezpieczeństwa, awaria sprzętu bez części zamiennych), nie liniowo. Ta pułapka jest głównym powodem, dla którego portfele legacy rosną bez kontroli: każda pojedyncza decyzja „zostawmy to jeszcze rok" wygląda racjonalnie, suma tych decyzji tworzy dług.
- **Koncentracja długu**: jeśli 20-30% budżetu IT idzie w garstkę aplikacji ELIMINATE/MIGRATE o niskiej wartości, to jest jawny sygnał złej alokacji — pieniądze idą w utrzymanie przeszłości zamiast w rozwój tego, co napędza wartość (kwadrant INVEST).
- **Sekwencja 6R nie jest wyborem jednorazowym per system** — TOLERATE dziś może stać się MIGRATE za 2 lata (kondycja techniczna degraduje się z czasem, wartość biznesowa rzadziej). Reocena portfela to proces cykliczny (rocznie/półrocznie), nie jednorazowy raport.
- **Repurchase jako domyślne pytanie, nie ostatnia opcja.** Zanim wybierze się drogi Refactor, warto sprawdzić, czy funkcja jest już skomodytyzowana (HR, księgowość, CRM, helpdesk) — jeśli tak, koszt utrzymania własnego rozwiązania rzadko wygrywa z dobrym SaaS. Sygnał do Repurchase: funkcja nie jest źródłem przewagi konkurencyjnej i rynek oferuje dojrzałe produkty kategorii.
- **Refactor bez uzasadnienia biznesowego to najdroższa pułapka odwrotna.** Presja inżynierska „przepiszmy to od nowa, bo kod jest brzydki" bez powiązania z wartością biznesową (system w kwadrancie TOLERATE) to najczęstsza przyczyna przepalonych budżetów modernizacji — piękny kod systemu, który i tak nikt nie planuje rozwijać, nie zwraca inwestycji. Refactor uzasadniony jest tylko w kwadrancie MIGRATE/INVEST przy realnej barierze skalowania.
- **Malejący bus factor jest wskaźnikiem wyprzedzającym (leading indicator), nie opisowym.** Spadek liczby osób znających system z 3 do 1 w ciągu roku przewiduje przyszły wzrost kosztu i czasu utrzymania szybciej, niż to widać w samym TCO — warto traktować trend bus factor jako wczesne ostrzeżenie wyprzedzające pogorszenie kondycji technicznej o 1-2 lata.

## 6. INSIGHTY (rdzeń narzędzia)

To jest **główny produkt narzędzia** — nie tabela klasyfikacji, tylko zdania, które prowadzą wprost do decyzji i inicjatyw:

- *„System X: wysoka wartość biznesowa (obsługuje 80% zamówień), niska kondycja techniczna (ostatnia aktualizacja bezpieczeństwa 4 lata temu, wsparcie dostawcy kończy się za 8 miesięcy) → pilna migracja, kwadrant MIGRATE, strategia Replatform, budżet ~X, deadline twardy przed wygaśnięciem wsparcia."*
- *„30% budżetu utrzymania IT idzie w 4 aplikacje sklasyfikowane ELIMINATE/TOLERATE o łącznej wartości biznesowej <5% — realokacja tego budżetu do kwadrantu INVEST to największa pojedyncza dźwignia oszczędności w tym roku."*
- *„Ukryta zależność: middleware Y (kandydat do wygaszenia) jest jedynym punktem integracji między systemem zamówień a magazynem — bez planu zastąpienia integracji, wygaszenie zablokuje sprzedaż. To podnosi Y z ELIMINATE do MIGRATE (Refactor) z sekwencją: najpierw zbuduj nową integrację, potem wygaś."*
- *„Bus factor 1 w systemie finansowym Z: jedyna osoba znająca kod odchodzi za 2 miesiące — ryzyko operacyjne wyższe niż wynika z samej kondycji technicznej; podnieś priorytet niezależnie od pozycji w macierzy TIME."*
- *„Dług technologiczny portfela = X% wartości estate, powyżej benchmarku branżowego (McKinsey: 20-40% typowe) → uzasadnienie dla dedykowanego budżetu modernizacji, nie tylko projektów punktowych."*
- *„3 systemy HR/kadrowe robią to samo (duplikacja funkcji) — konsolidacja do jednego (Repurchase/SaaS) redukuje TCO o X i eliminuje rozjazd danych pracowniczych między systemami."*
- *„Moduł raportowy ERP jest oceniany osobno od rdzenia finansowego: rdzeń=INVEST (stabilny, krytyczny), moduł raportowy=MIGRATE (przestarzały, blokuje self-service analitykę) — nie migruj całego ERP, wymień punktowo warstwę raportową na BI."*
- *„Trend bus factor w systemie zamówień: 3→2→1 w ciągu 18 miesięcy — ryzyko rośnie szybciej niż wynika z TCO; rekomendacja: dokumentacja awaryjna i przeszkolenie zastępcy w tym kwartale, niezależnie od tego czy migracja jest budżetowana w tym roku."*
- *„Portfel przeznacza tylko 15% budżetu IT na 'change' (nowe możliwości) wobec 85% na 'run' (utrzymanie) — odwrotność zdrowej proporcji dla firmy w fazie wzrostu; to samo w sobie jest insightem niezależnym od pojedynczych systemów."*
- Każdy taki insight → **inicjatywa modernizacji** z właścicielem, budżetem szacunkowym, sekwencją zależności i deadline'em wynikającym z twardych faktów (koniec wsparcia, wygasająca licencja), nie z ogólnego „powinniśmy kiedyś".

## 7. Worked example

**Kontekst**: firma produkcyjna średniej wielkości, portfel 12 kluczowych systemów, roczny budżet IT utrzymania ~4 mln PLN.

**Krok 1 — inwentarz + ocena** (wycinek):
| System | Wartość biznesowa | Kondycja techniczna | TCO/rok |
|---|---|---|---|
| ERP (SAP, wdrożony 2012) | Wysoka (rdzeń operacji) | Niska (on-prem, koniec mainstream support za 14 mies., 2 osoby znające customizacje) | 900k |
| CRM własny (2016, PHP) | Średnia | Niska (brak dokumentacji, autor odszedł, 1 incydent/mies.) | 250k |
| System zgłoszeń serwisowych (SaaS, 2022) | Wysoka | Wysoka | 120k |
| Portal dostawców (2010, .NET Framework 3.5) | Niska (12 aktywnych użytkowników) | Bardzo niska (framework EOL, brak wsparcia) | 80k |
| Middleware integracyjny (2008) | Wysoka (węzeł dla 5 systemów) | Bardzo niska (brak dokumentacji, bus factor 1) | 150k |

**Krok 2 — macierz TIME**:
- ERP → **MIGRATE** (wysoka wartość, pogarszająca się kondycja, twardy deadline wsparcia).
- CRM własny → **MIGRATE lub ELIMINATE** w zależności od pokrycia funkcji przez system zgłoszeń — dalsza analiza pokazuje 70% nakładania się funkcji → **ELIMINATE** (konsolidacja do systemu zgłoszeń).
- System zgłoszeń SaaS → **INVEST** (rozwijaj, dobra baza).
- Portal dostawców → **ELIMINATE** (niska wartość, krytycznie niska kondycja, mała baza użytkowników — kandydat do wygaszenia albo zastąpienia prostym formularzem w portalu klienta).
- Middleware → pozornie ELIMINATE po samej kondycji, ale mapa zależności pokazuje węzeł krytyczny dla 5 systemów → przesunięcie do **MIGRATE, strategia Refactor**, sekwencja: najpierw zbudować nowe API integracyjne, potem wygasić stary middleware.

**Krok 3 — 6R dla kandydatów migracji**:
- ERP → **Replatform** (migracja do S/4HANA Cloud lub równoważnego, zachowanie procesów, redukcja on-prem).
- Middleware → **Refactor** (nowa warstwa integracyjna event-driven, bo stary model point-to-point jest źródłem kruchości).

**Krok 4 — kwantyfikacja długu**:
- Dług portfela: suma TCO systemów w MIGRATE/ELIMINATE (900k+250k+80k+150k=1,38 mln) / całkowity budżet IT (4 mln) = **~35% budżetu w utrzymanie przeszłości** — zgodne z górną granicą benchmarku McKinsey (20-40%), sygnał alarmowy.
- Ryzyko skoncentrowane: 3 z 5 ocenianych systemów mają bus factor ≤2 lub wygasające wsparcie w <18 mies.

**Insighty → inicjatywy**:
1. *„ERP: migracja pilna przed końcem wsparcia (14 mies.) — inicjatywa 'ERP Replatform', budżet szacunkowy 1,2-1,8 mln, sponsor CFO, deadline twardy."*
2. *„CRM: konsolidacja z systemem zgłoszeń zamiast osobnej migracji — oszczędność 250k/rok, redukcja duplikacji danych klienta."*
3. *„Middleware: sekwencja dwuetapowa (najpierw nowa integracja, potem wygaszenie) — nie da się wygasić przed zbudowaniem zastępstwa; bus factor 1 podnosi pilność niezależnie od budżetu."*
4. *„Portal dostawców: wygaszenie + migracja 12 użytkowników do istniejącego portalu klienta — najniższe ryzyko, najszybszy zwrot, zrób w tym kwartale jako 'quick win' finansujący część migracji ERP."*
5. *„35% budżetu IT w długu technicznym — rekomendacja: wydzielony budżet modernizacji na przyszły rok, nie finansowanie z projektów bieżących."*

**Krok 5 — sekwencjonowanie roadmapy** (mapa zależności determinuje kolejność, nie tylko priorytet wartości):
| Kwartał | Inicjatywa | Warunek wejścia |
|---|---|---|
| Q1 | Wygaszenie portalu dostawców | Brak zależności — może ruszyć od razu |
| Q1-Q2 | Konsolidacja CRM → system zgłoszeń | Brak twardych zależności zewnętrznych |
| Q2-Q3 | Nowa warstwa integracyjna (zastępstwo middleware) | Musi poprzedzić wygaszenie middleware |
| Q3-Q5 | ERP Replatform | Największy zakres — start po ustabilizowaniu integracji, żeby nie migrować na ruchomym gruncie |
| Q5+ | Wygaszenie starego middleware | Dopiero po pełnym cutover na nową integrację |

Efekt: roadmapa nie jest listą „co ważniejsze", tylko grafem zależności przełożonym na oś czasu — ERP idzie później niż jego pozycja w macierzy TIME by sugerowała, bo bezpieczne wykonanie wymaga wcześniej ustabilizowanej warstwy integracyjnej.

**Kontrast branżowy — instytucja finansowa regulowana.** W środowisku regulowanym (bank, ubezpieczyciel) waga podkryterium „compliance/bezpieczeństwo" w ocenie kondycji technicznej jest znacząco wyższa niż w firmie produkcyjnej — system spełniający funkcję biznesową świetnie, ale niezgodny z aktualnymi wymogami audytowymi (np. brak szyfrowania danych w spoczynku, brak pełnego audit-trail), ląduje w MIGRATE nawet przy niskim koszcie utrzymania i braku widocznych awarii. Regulator nie akceptuje argumentu „działa od 15 lat bez incydentu" jako uzasadnienia dalszego tolerowania luki compliance — co w tym kontekście odwraca typowe rozumowanie „nie psuj czegoś, co działa" z sekcji 5. To pokazuje, że wagi osi nie są uniwersalne: to samo TCO i ta sama liczba incydentów prowadzą do innej decyzji TIME w zależności od profilu regulacyjnego organizacji.

## 8. Antywzorce przy stosowaniu narzędzia

- **Ocena bez właściciela biznesowego w rozmowie.** Kondycję techniczną łatwo ocenić z samego IT; wartość biznesową — nie. Ocena TIME zrobiona wyłącznie przez zespół techniczny systematycznie zaniża wartość biznesową systemów, które „są nielubiane", i przecenia wartość nowych/błyszczących narzędzi. Zawsze dwie strony przy ocenie osi Y.
- **Jednorazowy raport zamiast rytmu.** Macierz TIME zrobiona raz i odłożona na półkę starzeje się w kilka miesięcy — kondycja techniczna degraduje się w czasie ciągłym. Właściwy rytm to przegląd roczny/półroczny, nie projekt jednorazowy.
- **Mylenie 'taniego' z 'zdrowym'.** Niski koszt utrzymania nie oznacza dobrej kondycji technicznej — czasem oznacza, że nikt już nie inwestuje w utrzymanie (zero patchowania = zero kosztu, ale rosnące ryzyko). Kondycja techniczna musi uwzględniać ryzyko, nie tylko wydatek.
- **Traktowanie ELIMINATE jako wyroku natychmiastowego.** Wygaszenie bez planu migracji danych, bez okresu przejściowego i bez sprawdzenia zależności to najczęstsza przyczyna incydentów przy „sprzątaniu portfela". ELIMINATE to kierunek decyzji, nie data w kalendarzu jutro.
- **Pomijanie kosztu zaniechania.** Koszt „nic nie robimy" (rosnące ryzyko, malejący bus factor, kumulujący się dług) rzadko jest liczony explicite obok kosztu migracji — bez tego porównania każda migracja wygląda drożej niż jest, bo koszt bazowy (status quo) jest niewidoczny.

## 9. Źródła

- Gartner — TIME model: [LeanIX — Gartner TIME Model](https://www.leanix.net/en/wiki/apm/gartner-time-model), [LeanIX — Gartner TIME: Tolerate](https://www.leanix.net/en/blog/gartner-time-tolerate), [Sparx Systems — Gartner's T.I.M.E Chart](https://prolaborate.sparxsystems.com/resources/articles/gartners-t-i-m-e-chart-one-of-the-most-influential-charts-in-application-portfolio-management)
- AWS — 6R migration strategies: [AWS Prescriptive Guidance — About the migration strategies](https://docs.aws.amazon.com/prescriptive-guidance/latest/large-migration-guide/migration-strategies.html), [Mission Cloud — Migrating to AWS: the 6 Rs](https://www.missioncloud.com/blog/migrating-to-aws-the-6-rs), [LeanIX — 6Rs of Cloud Migration](https://www.leanix.net/en/wiki/tech-transformation/6rs-of-cloud-migration)
- McKinsey — kwantyfikacja długu technicznego: [Tech debt: Reclaiming tech equity](https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/tech-debt-reclaiming-tech-equity), [Breaking technical debt's vicious cycle to modernize your business](https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/breaking-technical-debts-vicious-cycle-to-modernize-your-business), [Demystifying digital dark matter](https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/demystifying-digital-dark-matter-a-new-standard-to-tame-technical-debt) — CIO survey (VII 2020, 50 CIO finans/tech, >1 mld USD przychodu): dług technologiczny = 20-40% wartości estate przed amortyzacją; 10-20% budżetu nowych produktów pochłania obsługa długu; 60% CIO widzi wzrost długu w ostatnich 3 latach.
- Zależności i pułapki racjonalizacji: [BETSOL — Application Dependency Mapping](https://www.betsol.com/blog/what-is-application-dependency-mapping/), [Hollinford — How to Map Legacy System Dependencies Before Migration](https://hollinford.com/blog/map-legacy-system-dependencies), [Samu.io — Application Dependency Mapping](https://samu.io/application-dependency-mapping-reduce-risk-gain-control/)
