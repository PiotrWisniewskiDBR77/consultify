# logistics-automation — DOKTRYNA NARZĘDZIA (Warehouse & Logistics Automation Assessment)

> Rodowód metodyczny: McKinsey (Getting warehouse automation right; Navigating dynamic labor;
> Automation has reached its tipping point for omnichannel warehouses), Gartner (Build a Supply
> Chain Automation Strategy to Compete and Avoid Costly Mistakes; prognoza „human-optional
> warehouses" do 2030), MHI (Annual Industry Report — payback benchmarks; Identifying What to
> Automate in the Warehouse), Lean/TOC (slotting, bottleneck). W Consultify narzędzie NIE jest
> „katalogiem robotów" — jest strukturą, która **mapuje przepływ magazynowy na 5 obszarów,
> mierzy gdzie praca jest rzeczywiście pracochłonna, i policzalnie odpowiada, czy i gdzie
> automatyzacja się zwraca** — zanim ktokolwiek podpisze zamówienie na sprzęt.

---

## 1. CEL

Narzędzie odpowiada na jedno pytanie sponsora: **„Gdzie w naszej logistyce/magazynie automatyzacja
faktycznie tworzy wartość — i czy to się nam opłaca, w tym miejscu, w tej skali, teraz?"**

Problem, który rozwiązuje:
- Decyzje o automatyzacji magazynu zapadają dziś najczęściej **odwrotnie niż powinny** — od
  technologii do problemu („zobaczyliśmy AMR-y u konkurenta, chcemy też"), zamiast od problemu do
  technologii. Efekt: sprzęt kupiony pod złe miejsce w przepływie, ROI poniżej obietnicy dostawcy.
- **Praca w magazynie jest nierównomiernie pracochłonna** — 50-70% kosztów operacyjnych magazynu
  to praca ludzka, a w typowym magazynie **do 70% czasu pickera to chodzenie i szukanie**, nie
  kompletacja. Ta jedna liczba, dobrze zlokalizowana, jest zwykle największym pojedynczym
  argumentem biznesowym w całej ocenie.
- Największy błąd rynku to **automatyzacja chaosu**: jeśli ścieżki kompletacji są przypadkowe,
  slotting jest losowy, a dokładność zapasu poniżej ~95% — automatyzacja tylko **przewozi bałagan
  szybciej i drożej**. Sama optymalizacja procesu (przeprojektowanie ścieżek, poprawiony slotting,
  standaryzacja) potrafi dać **10-20% poprawy przepustowości bez jednego zakupionego robota** —
  i to jest zawsze punkt odniesienia (baseline), z którym porównuje się każdą inwestycję sprzętową.
- Rynek dojrzał technologicznie (Gartner: do 2028 r. 80% magazynów wdroży jakąś formę
  automatyzacji; do 2030 r. połowa nowych magazynów w rynkach rozwiniętych będzie projektowana
  jako „human-optional"), ale **bariera nie jest technologiczna — jest decyzyjna**: wg MHI
  Annual Industry Report głównymi barierami są budżet (41%) i brak jasnego uzasadnienia
  biznesowego / ROI (40%), nie brak dostępnej technologii.

Decyzja, którą wspiera: **czy automatyzować, co konkretnie (który obszar/proces), jaką
technologią, w jakiej kolejności i z jakim zwrotem** — z policzalnym business case, nie z
entuzjazmu dla nowego sprzętu. Narzędzie jest **diagnostyczno-decyzyjne**: kończy się roadmapą
i liczbą do obrony przed zarządem, nie specyfikacją techniczną (to zadanie integratora, kolejny krok).

---

## 2. KIEDY UŻYWAĆ

Sygnały wyzwalające:
- **Koszt pracy rośnie szybciej niż wolumen** — presja płacowa, rotacja pracowników magazynowych,
  trudność w rekrutacji na sezon — a organizacja nie wie, czy odpowiedzią jest automatyzacja, czy
  lepsza organizacja pracy.
- **Skarga na przepustowość/dokładność, ale nikt nie wie, w którym z 5 obszarów magazynu
  (przyjęcie/składowanie/kompletacja/pakowanie/wysyłka) siedzi problem** — klasyczny sygnał:
  „SLA się sypie" bez wskazania konkretnego wąskiego gardła.
- **Presja wzrostu wolumenu** (nowy klient, nowy kanał e-commerce, konsolidacja magazynów po
  M&A) grozi przekroczeniem zdolności obecnego układu — trzeba wiedzieć, który obszar pęknie
  pierwszy, zanim się zainwestuje.
- **Silna sezonowość** (peak x2-x5 baseline — retail/e-commerce Q4, spożywka przed świętami,
  rolnictwo) i pytanie „stała automatyzacja czy elastyczna siła robocza/technologia" nie ma
  jeszcze policzalnej odpowiedzi.
- **Presja konkurencyjna/dostawca już zaproponował konkretne rozwiązanie** (integrator sprzedaje
  ASRS/AMR) i zarząd potrzebuje **niezależnej** oceny przed podpisaniem — czy to właściwe miejsce
  w przepływie, czy słuszna technologia, czy uzasadniona skala.
- **Nowy magazyn/relokacja/rozbudowa** — okno projektowe, w którym decyzje o automatyzacji są
  nieporównanie tańsze niż retrofit istniejącego obiektu.
- **Audyt operacyjny szerszego programu transformacji** (np. redukcja kosztów łańcucha dostaw),
  gdzie magazyn/logistyka to jeden z obszarów do oceny obok produkcji, zakupów, dystrybucji.

Kiedy NIE używać: wolumen zbyt mały/niestabilny, by uzasadnić jakąkolwiek inwestycję kapitałową
(automatyzacja ma sens ekonomiczny przy pewnym progu powtarzalności i skali — poniżej niego
odpowiedzią jest reorganizacja pracy, nie sprzęt); magazyn działa na wynajmowanej, krótkoterminowej
powierzchni bez pewności kontraktu (payback nie zdąży się zwrócić); problem jest czysto jakościowy/
kompetencyjny (szkolenie, nie przepływ) — wtedy VSM/analiza procesu, nie ocena automatyzacji.

---

## 3. INPUTY

**3.1. Przepływy magazynowe (mapa fizyczna i procesowa)**
- Układ magazynu (layout) — strefy przyjęcia, składowania, kompletacji, pakowania, wysyłki;
  odległości, wysokości składowania, liczba doków.
- Typy przepływu: pojedyncze SKU vs multi-SKU zamówienia, cross-docking vs składowanie,
  FIFO/FEFO wymagania (żywność, farmacja).
- Obecny poziom mechanizacji per obszar (ręczne wózki, wózki widłowe, przenośniki, istniejące
  WMS/WES/WCS).

**3.2. Wolumeny i profil zamówień**
- Liczba linii zamówień/dzień, sztuk/dzień, palet/dzień — per obszar i **w czasie** (nie punktowo).
- Liczba aktywnych SKU, rozkład ABC (ilu SKU generuje 80% ruchu — klasyczna analiza Pareto pod
  slotting), wielkość zamówienia (średnia liczba linii/zamówienie).
- **Sezonowość**: stosunek peak/baseline (np. x3 w Q4 dla e-commerce), częstotliwość i
  przewidywalność szczytów, długość okna szczytowego.
- Charakter zapasu: waga/gabaryt SKU, wymogi temperaturowe, niebezpieczne materiały, data
  ważności — determinują dostępne technologie.

**3.3. Koszt pracy i struktura zatrudnienia**
- Koszt FTE per obszar (stawka godzinowa + narzuty), liczba FTE per zmiana/obszar.
- Rotacja pracowników, koszt rekrutacji/szkolenia sezonowego, absencja.
- Rozkład czasu pracy pickera: ile % to **chodzenie/szukanie** vs faktyczna kompletacja
  (benchmark rynkowy: nawet do 70% to ruch, nie praca dodająca wartość — analogiczne do VSM
  Value-Added Time).

**3.4. Powierzchnia i wykorzystanie przestrzeni**
- m² per obszar, wysokość użytkowa (czy wykorzystana pionowo, czy tylko poziomo — sygnał pod
  ASRS/pionowe systemy składowania), gęstość składowania obecna vs teoretyczna.
- Koszt m²/miesiąc (własność vs najem) — wpływa na to, czy odzysk przestrzeni jest realną
  linią w business case.

**3.5. Dokładność i jakość**
- Dokładność zapasu (inventory accuracy) — próg krytyczny ~95%: poniżej tego automatyzacja
  „przewozi błędy szybciej", nie je eliminuje.
- Wskaźnik błędów kompletacji (mispick rate), reklamacje z przyczyny logistycznej, zwroty.

**3.6. Dane ramujące decyzję**
- Horyzont planowania (czy wolumen/model biznesowy będzie ten sam za 3-5 lat — ASRS ma
  15-25 lat życia operacyjnego, decyzja musi to udźwignąć).
- Dostępny kapitał vs apetyt na OPEX (leasing/RaaS — Robotics-as-a-Service — jako alternatywa
  dla CAPEX).
- Ograniczenia budynku (wysokość, nośność podłogi, zasilanie) — twarde ograniczenia technologii.

**Pułapka na starcie:** zbieranie danych z WMS/raportów zarządczych zamiast z obserwacji na hali
(analogicznie do VSM — gemba). Raport WMS pokaże throughput na wyjściu, nie pokaże **dlaczego**
picker chodzi 3x dłużej niż potrzeba, ani gdzie kolejka narasta przed konkretną strefą. Partner
idzie na halę, chodzi trasą pickera ze stoperem, obserwuje zmianę szczytową i baseline osobno —
uśrednienie tych dwóch reżimów maskuje prawdziwy wzorzec pracy.

---

## 4. METODA KROK PO KROKU

**Krok 0 — Zakres i granice.** Jeden magazyn/DC na raz (nie „cała sieć logistyczna” jednym
zamachem — każdy obiekt ma inny layout, wolumen, ograniczenia budynku). Partner ustala z
klientem: który obszar biznesu ten magazyn obsługuje, jaki jest horyzont decyzji (czy planowana
jest relokacja/rozbudowa, która zmienia ramy oceny).

**Krok 1 — Mapowanie przepływu end-to-end.** Zespół (operatorzy hali + kierownik zmiany +
partner) idzie fizycznie trasą towaru: **przyjęcie → składowanie → kompletacja → pakowanie →
wysyłka**. Dla każdego z 5 obszarów zbiera: wolumen (jednostki/dzień), FTE przypisane, czas
cyklu, % czasu chodzenia vs pracy właściwej, poziom mechanizacji obecny, wąskie gardła zgłaszane
przez operatorów. To krok analogiczny do current-state mapy w VSM, ale z naciskiem na
**pracochłonność fizyczną i przestrzenną**, nie tylko lead time.

**Krok 2 — Ocena obszarów: technologia vs proces.** Dla każdego z 5 obszarów, zespół zadaje
DWA pytania w tej kolejności (kolejność jest kluczowa — proces zawsze przed technologią):
1. *Czy problem w tym obszarze da się usunąć reorganizacją procesu bez CAPEX?*
   (re-slotting wg ABC/rotacji, konsolidacja tras kompletacji, standaryzacja opakowań,
   eliminacja zbędnych kroków kontrolnych). Zbadaj potencjał — rynkowy benchmark 10-20%
   poprawy przepustowości z samej reorganizacji.
2. *Co zostaje jako pracochłonne/kosztowne/błędogenne PO uporządkowaniu procesu — i czy to
   jest kandydat na automatyzację?* Dopiero na tym, oczyszczonym z bałaganu procesie, ocenia się
   dopasowanie technologii:
   - **Receiving (przyjęcie):** automatyczne rozładunki, skanowanie/OCR, wstępna
     kwalifikacja — kandydat gdy wysoki wolumen jednorodnych jednostek (palety), niski gdy
     mix nieregularny.
   - **Storage (składowanie):** ASRS (Automated Storage & Retrieval Systems), systemy
     pionowe (VLM/karuzele) — kandydat gdy wysoka gęstość SKU, ograniczona powierzchnia
     pozioma, wysoki budynek niewykorzystany pionowo.
   - **Picking (kompletacja):** AMR (Autonomous Mobile Robots), goods-to-person, sortery —
     największy kandydat, gdy dominuje czas chodzenia/szukania (patrz 3.3); goods-to-person
     eliminuje podróż pickera, systemy AI do rozmieszczenia towaru potrafią skrócić ścieżki
     kompletacji nawet o ~60%.
   - **Packing (pakowanie):** automatyczne stacje pakujące, robotyczne pakowanie — kandydat
     przy wysokiej standaryzacji opakowań i wolumenie.
   - **Shipping (wysyłka):** sortery, automatyczne ładowanie — kandydat przy wysokim
     wolumenie przesyłek i presji na okno czasowe wysyłki (cut-off).

**Krok 3 — Business case per kandydat.** Dla każdego zidentyfikowanego kandydata na
automatyzację: koszt inwestycji (CAPEX lub OPEX przy RaaS), redukcja FTE/godzin, redukcja
błędów (i ich kosztu), odzysk powierzchni (jeśli monetyzowalny), wpływ na przepustowość
(czy usuwa ograniczenie całego przepływu, czy tylko lokalnie przyspiesza obszar z nadmiarową
zdolnością — analogia do teorii ograniczeń z VSM). Payback period i 5-letni ROI liczone
per kandydat, nie zbiorczo — to pozwala uszeregować, nie tylko zsumować.

**Krok 4 — Test sezonowości.** Dla każdego kandydata: czy inwestycja rozwiązuje problem
baseline, peak, czy oba? Systemy sztywne (fixed automation — konwejery, sortery) są
zaprojektowane pod stały przepływ i słabo radzą sobie z x3-x5 szczytem; systemy elastyczne
(AMR — można doskalować flotę na czas szczytu, RaaS) absorbują zmienność bez przewymiarowania
inwestycji pod 2 miesiące w roku. Partner explicite testuje: „czy ta technologia rozwiązuje
270 dni w roku, czy 30 dni peak — i czy to jest ten sam problem?"

**Krok 5 — Sekwencja i roadmapa.** Uszeregowanie kandydatów wg: (a) czy usuwają rzeczywiste
ograniczenie przepływu (priorytet), (b) payback, (c) ryzyko wdrożeniowe/zależności (np. WMS
musi być gotowy zanim ASRS ma sens), (d) okno operacyjne (przed szczytem sezonowym, nie w
trakcie). Roadmapa dzieli się na: **quick wins procesowe** (0 CAPEX, 4-12 tygodni),
**automatyzacja punktowa** (jeden obszar, 3-12 miesięcy), **transformacja całego przepływu**
(multi-obszar, 12-36 miesięcy, zwykle wymaga nowego/przebudowanego obiektu).

**Jak partner to prowadzi (mechanika warsztatu):**
- Wizyta na hali obowiązkowa — ocena „zza biurka" z samych raportów WMS jest z definicji
  niepełna (nie widać chodzenia, kolejek fizycznych, obejść procedur przez operatorów).
- Obserwacja **dwóch reżimów osobno**: dzień typowy (baseline) i — jeśli to możliwe w
  horyzoncie projektu — dzień szczytowy albo dane historyczne z ostatniego peak. Uśrednienie
  bez rozbicia maskuje prawdziwy wzorzec i zaniża/zawyża business case.
- Rozmowa z operatorami hali, nie tylko kierownictwem — operator wie, gdzie faktycznie traci
  czas; kierownik zna SLA, nie zawsze przyczynę źródłową.
- Walidacja liczby dokładności zapasu PRZED oceną technologii — jeśli <95%, pierwszy insight
  to „napraw dane, zanim automatyzujesz", nie lista sprzętu.

---

## 5. JAK SIĘ WNIOSKUJE (reguły interpretacji)

**5.1. Test kolejności: proces przed technologią.**
Jeśli obszar ma wysoką pracochłonność ORAZ niski poziom uporządkowania procesu (losowy slotting,
niestandaryzowane ścieżki, dokładność zapasu <95%) — **automatyzacja tego obszaru w obecnym
stanie jest przedwczesna**. Sygnał: „automatyzacja bez uporządkowania slottingu = utrwalenie
nieefektywności, tylko drożej i szybciej". Kolejność zawsze: (1) uporządkuj proces, (2) zmierz
co zostaje, (3) dopiero to automatyzuj.

**5.2. Lokalizacja kandydata: gdzie praca jest naprawdę pracochłonna.**
Obszar z najwyższym % czasu nieprodukcyjnego (chodzenie/szukanie/oczekiwanie) względem FTE
przypisanych jest pierwszym kandydatem — nie obszar „najbardziej widoczny" czy najgłośniej
zgłaszany. Reguła analogiczna do lokalizacji ograniczenia w VSM: zysk z automatyzacji obszaru,
który NIE jest źródłem pracochłonności/ograniczenia całego przepływu, jest w dużej mierze
iluzoryczny — przyspiesza jeden krok, przepustowość całości i tak wyznacza wąskie gardło
gdzie indziej.

**5.3. Próg opłacalności: skala i powtarzalność.**
Automatyzacja ma sens ekonomiczny, gdy iloczyn (wolumen × powtarzalność × horyzont) przekracza
próg zwrotu inwestycji w rozsądnym czasie (rynkowy punkt odniesienia: AMR/goods-to-person —
payback ~18-24 miesiące; ASRS — payback ~36-60 miesięcy, ale znacznie dłuższe życie
operacyjne 15-25 lat, więc wyższy zwrot całkowity). Poniżej progu wolumenu/powtarzalności —
odpowiedzią jest reorganizacja pracy, elastyczna siła robocza albo RaaS (OPEX zamiast CAPEX),
nie zakup sprzętu.

**5.4. Sezonowość jako oddzielny test, nie dodatek.**
Jeśli szczyt sezonowy to x2-x5 baseline, ocena musi rozdzielić dwa różne problemy: (a) czy mamy
za mało zdolności na 270 dni w roku (baseline) — rozwiązanie: automatyzacja stała; (b) czy mamy
za mało zdolności na 30-60 dni w roku (peak) — rozwiązanie: elastyczna technologia (AMR
doskalowywane, RaaS) lub elastyczna praca, NIE stała automatyzacja przewymiarowana pod
rzadki szczyt (koszt stoi bezczynny 300+ dni w roku). Mylenie tych dwóch prowadzi do
przeinwestowania w sztywny sprzęt pod zjawisko, które zdarza się 2 miesiące w roku.

**5.5. Test ograniczeń budynku i horyzontu.**
Technologia dopasowana teoretycznie do przepływu może być niewykonalna fizycznie (wysokość,
nośność, zasilanie) albo ekonomicznie nieuzasadniona przy niepewnym horyzoncie najmu/wolumenu
(inwestycja 15-25 lat życia w obiekcie z umową najmu na 3 lata to zła decyzja niezależnie od
ROI na papierze).

**5.6. Progi i pułapki.**
- **Automatyzacja „bo konkurencja ma"** — decyzja od technologii, nie od zmierzonego problemu;
  najczęstsza przyczyna ROI poniżej obietnicy dostawcy.
- **Ocena zza biurka** (tylko raporty WMS) — nie widać chodzenia/kolejek/obejść, zaniża albo
  zawyża skalę problemu w sposób nieprzewidywalny.
- **Uśrednianie baseline i peak** — maskuje prawdziwy wzorzec, prowadzi albo do
  przeinwestowania (sztywny sprzęt pod rzadki szczyt), albo niedoinwestowania (system nie
  udźwignie sezonu).
- **Automatyzacja obszaru z nadmiarową zdolnością** — analogia do „optymalizacji
  nie-ograniczenia" w VSM/TOC: kosztowna, widoczna, ale nie zmienia wyniku end-to-end.
- **Pomijanie dokładności zapasu jako warunku wstępnego** — <95% dokładności = automatyzacja
  przewozi błędy szybciej, nie wyklucza tego, że w krótkim terminie zwiększa liczbę błędów
  widocznych klientowi (bo szybciej wysyła złe zamówienie).
- **Ignorowanie kosztu zmiany** — wdrożenie automatyzacji zwykle wymaga przestoju/spowolnienia
  operacji na czas instalacji; brak tego w business case zaniża rzeczywisty koszt.

---

## 6. INSIGHTY JAKIE PRODUKUJE (rdzeń narzędzia)

To jest **cel istnienia** narzędzia w Consultify — nie katalog technologii, tylko te zdania,
gotowe do wpięcia w inicjatywę/kartę insightu:

1. **„N% czasu pickerów w [obszar] to chodzenie/szukanie, nie kompletacja."** — twardy,
   policzalny dowód pracochłonności, punkt otwarcia dla sponsora, który widzi tylko zbiorczy
   koszt pracy, nie jego strukturę.
2. **„60% pracy w pickingu = kandydat na AMR/goods-to-person; pozostałe obszary — NIE jeszcze."**
   — lokalizacja, nie ogólnik; kieruje budżet w jedno miejsce zamiast rozproszonego programu
   „zautomatyzujmy wszystko naraz".
3. **„Automatyzacja bez uporządkowania slottingu = utrwalenie nieefektywności — droższej i
   szybszej."** — koryguje odruch „kupmy sprzęt, on to naprawi"; wymusza sekwencję proces→
   technologia.
4. **„Sama reorganizacja procesu (slotting, ścieżki) daje N% poprawy przepustowości — zanim
   wydamy złotówkę na sprzęt."** — pokazuje tanią dźwignię pierwszą, buduje wiarygodność przed
   proponowaniem CAPEX.
5. **„Kandydat w [obszar X] wygląda atrakcyjnie, ale to NIE jest ograniczenie całego
   przepływu — realne ograniczenie to [obszar Y]."** — koryguje błędną intuicję (najgłośniej
   zgłaszany obszar rzadko jest prawdziwym wąskim gardłem).
6. **„Sezonowość x3 → potrzebna automatyzacja stała pod baseline + elastyczna
   praca/technologia pod peak — nie jedno rozwiązanie na oba reżimy."** — rozdziela dwa różne
   problemy ukryte pod jednym wskaźnikiem „mamy za mało zdolności".
7. **„Dokładność zapasu [X]% poniżej progu 95% — pierwsza inwestycja to dane, nie roboty."**
   — twardy warunek wstępny, chroni klienta przed kosztowną porażką wdrożeniową.
8. **„Payback [technologia] w tym wolumenie to N miesięcy — poniżej/powyżej progu
   opłacalności rynkowej."** — konkretna, obronialna liczba do decyzji zarządu, nie ocena
   jakościowa „automatyzacja się opłaca".
9. **„Odzysk M² z [technologia pionowa] = realna wartość tylko jeśli powierzchnia jest
   monetyzowalna (podnajem, unikniecie ekspansji) — w tym przypadku [tak/nie]."** — dyscyplinuje
   business case, nie liczy powierzchni jako wartości sama w sobie.

**Przełożenie na transformację organizacji:** każdy insight powyżej ma naturalne przełożenie na
**inicjatywę** w Consultify (obszar/kandydat → właściciel + cel liczbowy + termin + CAPEX/OPEX),
a suma insightów z jednej oceny zwykle definiuje **roadmapę wielofazową** (quick wins procesowe
→ automatyzacja punktowa → transformacja całego przepływu) z wbudowanym uzasadnieniem
finansowym per faza. To odróżnia narzędzie od „katalogu technologii" — ocena zawsze kończy się
sekwencją decyzji i liczbą do obrony, nie listą możliwych zakupów.

---

## 7. WORKED EXAMPLE

**Kontekst:** dystrybutor B2B/e-commerce hybrydowy, jeden magazyn 15 000 m², 8 000 linii
zamówień/dzień baseline, peak Q4 (listopad-grudzień) ~x3,2 baseline. 140 FTE w szczycie, 70 FTE
baseline. Koszt pracy = 62% kosztów operacyjnych magazynu.

**Krok 1 — mapowanie 5 obszarów (dzień typowy, obserwacja + rozmowa z operatorami):**

| Obszar | FTE (baseline) | % czasu nieprodukcyjnego (chodzenie/szukanie/czekanie) | Dokładność/jakość | Poziom mechanizacji |
|---|---|---|---|---|
| Receiving | 6 | 25% | — | ręczne skanowanie |
| Storage | 4 | 15% | dokładność zapasu 91% | wózki, regały statyczne, 40% wysokości budynku niewykorzystane |
| Picking | 38 | 58% (chodzenie po całej hali, losowy slotting wg daty przyjęcia, nie rotacji) | mispick 3,1% | w pełni ręczne |
| Packing | 12 | 20% | — | ręczne stacje |
| Shipping | 10 | 18% | — | ręczne sortowanie na doki |

**Insight #1 (pracochłonność):** 58% czasu 38 FTE w pickingu to chodzenie/szukanie — przy
koszcie pracy ~180 PLN/godz. w pełni obciążonym, to ok. **3,3 mln PLN/rok** czystego kosztu
nieprodukcyjnego ruchu w jednym obszarze.

**Krok 2 — proces przed technologią.** Analiza ABC pokazuje: 18% SKU generuje 79% ruchu
kompletacji, ale są rozrzucone losowo po całej hali (slotting historycznie wg daty przyjęcia
towaru, nie rotacji). Reorganizacja slottingu (najszybciej rotujące SKU najbliżej strefy
pakowania) — symulacja na próbie tras — daje **17% redukcji dystansu kompletacji bez
jednego zakupionego urządzenia**, wdrożenie 6 tygodni, koszt: czas 1 analityka + reorganizacja
fizyczna w weekend.

**Insight #4 (dźwignia procesowa):** 17% poprawy przepustowości pickingu z samego re-slottingu,
0 PLN CAPEX — pierwsza rekomendacja, zanim jakikolwiek sprzęt.

**Krok 3 — kandydat na automatyzację po oczyszczeniu procesu.** Po re-slottingu, pozostały
czas nieprodukcyjny w pickingu (~41% zamiast 58%) nadal dominuje FTE-koszt obszaru — kandydat
na goods-to-person (AMR + stacje kompletacji) dla top 18% SKU wysokiej rotacji. Storage:
dokładność zapasu 91% (<próg 95%) — **insight #7: pierwsza inwestycja to cykliczne liczenie
zapasu i dyscyplina WMS, nie ASRS** — mimo że 40% wysokości budynku niewykorzystane wygląda
atrakcyjnie dla systemu pionowego.

**Insight #2/#5:** Picking jest realnym kandydatem (58%→41% czasu nieprodukcyjnego, 38 FTE,
największy wolumen) — receiving i shipping mają wysoki % nieprodukcyjny, ale niski FTE (6 i 10),
więc absolutna dźwignia finansowa jest tam nieporównanie mniejsza; automatyzacja receiving
„bo też ma 25% marnotrawstwa" byłaby optymalizacją obszaru, który nie jest ograniczeniem
kosztowym całości.

**Krok 4 — test sezonowości.** Peak x3,2 wymaga dziś 70 dodatkowych FTE sezonowych na 8 tygodni
— koszt rekrutacji/szkolenia/rotacji sezonowej ~410 PLN/FTE/tydzień dodatkowo ponad stawkę.
AMR flota skalowalna (leasing dodatkowych jednostek na okres peak, RaaS) pokrywa ~60% wzrostu
wolumenu w pickingu bez dodatkowych FTE sezonowych — **insight #6: potrzebna kombinacja: AMR
stałe pod baseline (18% SKU) + AMR doskalowywane na 8 tygodni peak, NIE jeden system sztywny
zaprojektowany pod szczyt**, który stałby bezczynny 44 tygodnie w roku.

**Business case (krok 3, insight #8):** inwestycja AMR + stacje goods-to-person dla top-18% SKU:
CAPEX ~3,8 mln PLN, redukcja FTE pickingu baseline o 14 (z 38 do 24, dzięki eliminacji
chodzenia), redukcja mispick z 3,1% do ~0,8% (mniej zwrotów/reklamacji), redukcja kosztu
sezonowego przez elastyczne doskalowanie floty. **Payback ~22 miesiące** — w paśmie rynkowego
benchmarku dla AMR (18-24 mies.), poniżej progu ASRS (36-60 mies.), uzasadnia priorytet.

**Roadmapa:** Faza 0 (0-6 tyg., 0 CAPEX): re-slotting + korekta dokładności zapasu do >95%.
Faza 1 (3-9 mies.): AMR + goods-to-person dla top-18% SKU w pickingu, model RaaS z opcją
doskalowania floty na peak. Faza 2 (odroczona, warunkowa): ocena ASRS dla storage — dopiero
gdy dokładność zapasu ustabilizowana >97% przez min. 2 kwartały i wolumen uzasadni 15-25-letni
horyzont inwestycji.

---

## 8. ŹRÓDŁA

- McKinsey & Company — *Getting warehouse automation right* (framework doboru technologii,
  bariery wdrożenia, dopasowanie do profilu operacji).
  [mckinsey.com — getting-warehouse-automation-right](https://www.mckinsey.com/capabilities/operations/our-insights/getting-warehouse-automation-right)
- McKinsey & Company — *Optimizing warehouse automation for retailers: Automation has reached
  its tipping point for omnichannel warehouses* (goods-to-person, redukcja ścieżek kompletacji
  ~60%, labor 50-70% kosztów operacyjnych).
  [mckinsey.com — automation-tipping-point-omnichannel](https://www.mckinsey.com/industries/retail/our-insights/automation-has-reached-its-tipping-point-for-omnichannel-warehouses)
- McKinsey & Company — *Navigating dynamic labor: Building strong warehousing operations*
  (koszt pracy, presja rekrutacyjna, sezonowość siły roboczej).
  [mckinsey.com — navigating-dynamic-labor](https://www.mckinsey.com/capabilities/operations/our-insights/navigating-dynamic-labor-building-strong-warehousing-operations)
- McKinsey & Company — *Navigating warehouse automation strategy for the distributor market*
  (sekwencja decyzji, dopasowanie skali/wolumenu do technologii).
  [mckinsey.com — distributor-market-automation-strategy](https://www.mckinsey.com/industries/industrials/our-insights/distribution-blog/navigating-warehouse-automation-strategy-for-the-distributor-market)
- Gartner — *Build a Supply Chain Automation Strategy to Compete and Avoid Costly Mistakes*
  (bariery decyzyjne, unikanie kosztownych błędów strategii automatyzacji).
  [gartner.com — supply-chain-automation-strategy](https://www.gartner.com/en/articles/supply-chain-automation-strategy)
- Gartner — *Gartner Predicts Half of New Warehouses Built in Developed Markets Will be
  Human-Optional Facilities by 2030* (trend projektowania nowych obiektów, kontekst rynkowy
  skali adopcji do 2028/2030).
  [gartner.com — human-optional-facilities-2030](https://www.gartner.com/en/newsroom/2026-04-13-gartner-predicts-half-of-new-warehouses-built-in-developed-markets-will-be-human-optional-facilities-by-2030)
- MHI — *2025/2026 Annual Industry Report* oraz *Identifying What to Automate in the Warehouse*
  (payback benchmarks: AMR 18-24 mies., ASRS 36-60 mies. z życiem operacyjnym 15-25 lat;
  bariery adopcji: budżet 41%, brak jasnego ROI 40%).
  [mhisolutionsmag.com — identifying-what-to-automate](https://www.mhisolutionsmag.com/index.php/2025/03/06/identifying-what-to-automate-in-the-warehouse/) ·
  [mhisolutionsmag.com — the-smart-warehouse](https://www.mhisolutionsmag.com/index.php/2025/12/11/the-smart-warehouse/)
- ModernMaterialsHandling / MHI Top Supply Chain Trends 2026 — kontekst rynkowy: talent gap,
  AI i automatyzacja jako wiodące trendy.
  [mmh.com — mhis-top-supply-chain-trends-2026](https://www.mmh.com/article/mhis_top_supply_chain_trends_for_2026_ai_automation_uptake_and_the_talent_gap_challenge_lead_the_mix)
- Warehouseautomation.org — *Things to Consider Before You Automate* / *5 Automation Pitfalls
  to Avoid* (proces przed technologią — chaotyczne ścieżki + losowy slotting + dokładność
  zapasu <95% = automatyzacja skaluje bałagan; 10-20% poprawy przepustowości z samej
  reorganizacji procesu przed CAPEX).
  [warehouseautomation.org — things-to-consider-before-you-automate](https://www.warehouseautomation.org/2025/12/09/things-to-consider-before-you-automate/) ·
  [provisionwms.com — 5-automation-pitfalls](https://provisionwms.com/5-automation-pitfalls-to-avoid-how-to-prepare-your-warehouse-for-automation-implementation/)
- SupplyChainBrain — *Flexible vs. Fixed Warehouse Automation: The Evolution of Logistics*
  (sztywna automatyzacja pod stały przepływ vs elastyczna flota AMR/RaaS pod sezonowość peak).
  [supplychainbrain.com — flexible-vs-fixed-warehouse-automation](https://www.supplychainbrain.com/articles/41100-flexible-vs-fixed-warehouse-automation-the-evolution-of-logistics)
- Hy-Tek Intralogistics / ASC Software / Optioryx — *Warehouse Slotting Guide* (ABC analiza,
  rotacja SKU jako podstawa slottingu, sygnały potrzeby re-slottingu).
  [hy-tek.com — why-warehouse-slotting-is-a-smart-move](https://hy-tek.com/resources/why-warehouse-slotting-is-a-smart-move/) ·
  [ascsoftware.com — warehouse-slotting-optimization-guide](https://ascsoftware.com/blog/warehouse-slotting-optimization-guide/)
- Mordor Intelligence — *Warehouse Automation Market* (wielkość rynku, tempo wzrostu jako
  kontekst skali inwestycji branżowych 2025-2031).
  [mordorintelligence.com — warehouse-automation-market](https://www.mordorintelligence.com/industry-reports/warehouse-automation-market)

---

*Doktryna sporządzona 2026-07-08 na potrzeby narzędzia `logistics-automation` w Consultify.
Zasada nadrzędna: narzędzie istnieje po to, by wyprodukować sekcję 6 (insighty) — reszta
dokumentu to rusztowanie metodologiczne, które ma tę sekcję uwiarygodnić i sparametryzować.*
