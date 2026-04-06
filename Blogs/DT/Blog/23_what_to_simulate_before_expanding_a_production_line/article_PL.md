# Co symulować przed rozbudową linii produkcyjnej

Docelowa persona: dyrektor zakładu / lider inżynierii przemysłowej / sponsor programu  
Etap lejka: Decision
Główny problem: rozbudowa linii często jest wymiarowana ze statycznej matematyki zdolności i ofert dostawców, podczas gdy prawdziwe ryzyko siedzi w sprzężeniu, zachowaniu rampy i tym, jak nowy odcinek zachowuje się przy mixie i zmienności  
Główna obietnica: zwięzły zakres symulacji testujący decyzję o rozbudowie, zanim beton, staffing i zobowiązania u dostawców staną się twarde

Przed rozbudową linii symuluj wydajność baseline przy realistycznej zmienności, najmniejszy wiarygodny zestaw wariantów rozbudowy, krzywe rampy i uczenia się, konflikt o zasoby współdzielone oraz intralogistykę zasilającą nowy odcinek. Pomiń głęboką symulację tylko wtedy, gdy rozbudowa to trywialny duplikat istniejącej komórki przy identycznym mixie i bez wspólnych ograniczeń. Rozbudowa linii rzadko brzmi „więcej maszyn w tej samej hali”; to zmiana w tym, jak praca przychodzi, kolejkuje się i wraca do równowagi.

**Granica tematu:** ten artykuł skupia się na rozbudowie zdolności w istniejącym śladzie, gdy konkurują kilka fizycznych ścieżek. O rozbudowie linii „przed popytem” w szerszym sensie — inne opracowania w serii; o programach brownfield — planowanie zmian brownfield; o teście zdolności przy przesunięciu popytu — artykuł o testowaniu zdolności.

## Dlaczego mocne memo CAPEX nadal omija halę

Dopieszczony pakiet rozbudowy wciąż może pominąć, jak WIP i kolejki się rozłożą, gdy nowy odcinek startuje, czy wąskie gardło migruje w górę czy w dół strumienia, jak przezbrojenia współgrają, gdy rośnie throughput, oraz czy dostawa materiału, staging czy kitting nie staje się ukrytym ograniczeniem. Te luki robią się drogie po wlaniu stali i podpisaniu umów.

## Minimalny zestaw scenariuszy

Odpal dzisiejszy baseline z „złymi” tygodniami, nie tylko średnimi; pasmo docelowego throughputu jako zakres, który kierownictwo chce utrzymać; stres mixu dla rodzin, które najbardziej bolą cykl i przezbrojenia; przypadek rampy z uczciwymi założeniami szkolenia, scrapu i stabilności; sprzężone zasoby — wspólne narzędzia, testery, żurawie, pętle AGV, zastępczy staffing, którego dotykają obie linie. Porównujesz, jak system się psuje, a nie ozdabiasz historię sukcesu.

## Oceniaj poważne warianty na tych samych faktach

Sądź opcje po throughput przy prawdziwym wąskim gardle pod stresem, WIP i czasie kolejki u głównych ograniczeń, ekspozycji na nadgodziny i pracę tymczasową, czasie do stabilnego outputu po starcie oraz wrażliwości na opóźnienie inbound, gdy tempo narzuca logistyka. Jeśli dwa warianty są bliskie na średniej, a rozjeżdżają się pod stresem — stres to prawda, której potrzebujesz przed wydatkiem.

## Wejścia, co do których kierownictwo powinno się zgodzić przed startem modelu

Uzgadnijcie zdanie decyzyjne (co dokładnie wybieracie), kształt popytu własny sprzedaży i planowania, listę ograniczeń, które nie mogą się ugiąć w pierwszych dziewięćdziesięciu dniach po starcie, oraz definicję porażki — jakie naruszenie KPI dyskwalifikuje opcję. Bez tych ustaleń model staje się testem Rorschacha.

## Odizolowany model linii kłamie grzecznie

Modelowanie samej nowej linii jest czyste i często myli. Jeśli rozbudowa zabiera czas pośredni, okna konserwacji lub zdolność transportu reszcie site’u, zakład uczy się tego w rampie — nie na spotkaniu zatwierdzającym. Trzymaj granicę modelu uczciwie.


## Governance pasujące do tempa fabryki

Dobre governance dopasowuje się do zegara zakładu. Comiesięczne przeglądy operacyjne powinny traktować ryzyko do przodu jako pełnoprawnego obywatela agendy, nie jako dodatek, gdy skończą się slajdy. Fora kapitałowe powinny traktować ID scenariuszy i stopnie założeń jako część artefaktu akceptacji, nie jako przypis modelarza. Przeglądy po inwestycji powinny odnaleźć baseline historii, którą sfinansowano, i sprawdzić, czy rzeczywistość odbiegła w sposób zmieniający następną transzę.

Gdy własność jest jasna – kto utrzymuje strukturę, kto certyfikuje prawdę hali, kto podpisuje pakiety scenariuszy – zdarzenia odświeżenia przestają być osobistymi przysługami i stają się przewidywalnym utrzymaniem. Tak digital twin przetrwa rotację: następny steward dziedziczy szablony, pakiety i rejestry zamiast dziedziczyć ustne mity. Jeśli program nie przetrwa zmiany kierownictwa, to wciąż projekt, nie infrastruktura.

## Co dodaje DBR77 Digital Twin

DBR77 Digital Twin centruje decyzje o rozbudowie: throughput, elastyczność, zapasy i ryzyko rampy w jednej porównywalnej ramce przed zamknięciem wydatku. Testy obok siebie wiarygodnych wariantów przy zmienności; kompromisy między throughputem, elastycznością, zapasami i ryzykiem rampy; zapisy decyzji, które finanse i operacje mogą uzgodnić bez optymizmu slajdów.

## Podsumowanie

Symuluj przed rozbudową, gdy wspólne zasoby, mix lub ryzyko rampy mogą obalić case CAPEX, który jako statyczny wygląda dobrze. Jeśli rozbudowa to prawdziwy zduplikowany komórka z odizolowaną logistyką i stabilnym mixem, piloty oparte na pomiarze mogą iść szybciej. Chodzi o mniej niespodzianek, gdy wydatki zamieniają się w beton.

---

*DBR77 Digital Twin pomaga porównywać warianty rozbudowy przy zmienności i sprzężeniu wspólnych zasobów, zanim stwardnieją fizyczne zobowiązania i dostawcy. [Umów demo](https://dbr77.com/digital-twin) lub [Poznaj Digital Twin](https://dbr77.com/demo).*
