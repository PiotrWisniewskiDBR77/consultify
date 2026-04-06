# Co FAT i SAT powinny naprawde udowodnic przed startem produkcyjnym

Target persona: menedzer jakosci / inzynierii (wlasciciel po stronie producenta)  
Funnel stage: Decision do przekazania dostawy (zapewnienie przed go-live)  
Core problem: FAT i SAT wplywaja w ceremonialne przejscia, ktore podpisuje papier, ale nie redukuja ryzyka operacyjnego  
Main promise: ramy akceptacji nastawione na producenta, ktore wiaza dowody z tym, co musi byc prawda w pierwszym prawdziwym tygodniu produkcji

FAT i SAT nie sa eventami motywacyjnymi.

To kontrole ryzyka.

Zawodza, gdy zespoly traktuja je jak:

- demo ze swiadkami
- okazje do zdjec
- checkbox wymagany przez szablon sciagniety w 2014

Dzialaja, gdy odpowiadaja na jedno pytanie:

co sprawi, ze odmowimy uruchomienia w produkcji i jak to testujemy zanim oddamy linie?

## Bezposrednia odpowiedz

FAT powinien udowodnic, ze zintegrowany system spelnia kryteria akceptacji zdefiniowane w kontrakcie w warunkach kontrolowanych przez dostawce, z mozliwym do sledzenia zapisem.

SAT powinien udowodnic, ze te same kryteria obowiazuja w kontekscie Twojej fabryki, z prawdziwymi interfejsami, prawdziwymi materialami tam gdzie to stosowne i prawdziwa operacyjna odpowiedzialnoscia.

Jesli FAT udowadnia "ze sie rusza", a SAT "ze mamy nadzieje", kupiles teatr.

## Zdefiniuj obiekty akceptacji zanim zaplanujesz daty

Zacznij od obiektow, nie od ceremonii.

Minimalne obiekty akceptacji (dostosuj do kategorii):

| Obiekt | intencja FAT | intencja SAT |
| --- | --- | --- |
| funkcje bezpieczenstwa | zachowanie zweryfikowane u dostawcy | zachowanie z realnym ogrodzeniem i LOTO w zakladzie |
| cykl i pasmo przepustowosci | pokazane przy uzgodnionym modelu obciazenia | pokazane przy ograniczeniach zasilania w zakladzie |
| wyniki jakosci | zmierzone wg uzgodnionego planu probkowania | zmierzone wg metrologii i norm zakladu |
| obsluga bledow i powrot | scenariusze usterek przechodza | realistyczne dla operatora usterki przechodza |
| dane i polaczenie MES | interfejsy przechodza uzgodnione komunikaty | interfejsy przechodza w sieci zakladu |
| dokumentacja i szkolenie | kompletnosc pakietu O&M | operatorzy wykonuja standard pracy |

Jesli obiektu nie ma na liscie, nie zostanie przetestowany.

Zostanie spierany pozniej za wyzszy koszt.

## FAT: co powinno znaczyc "pass"

Uzyteczny FAT daje:

- liste punch z wlascicielami i terminami przed wysylka
- mozliwe do sledzenia zapisy testow powiazane z ID wymagan
- jawne wykluczenia (co bylo symulowane versus co bylo realne)

Slaby FAT daje:

- subiektywne opinie ("wyglada dobrze")
- ruchome cele ("dostrajamy na miejscu")
- ukryte podmiany (inne narzedzie, inny SKU, inna wersja oprogramowania)

Producenci powinni nalegac na zamrozone identyfikatory buildu oprogramowania i firmware przy FAT.

## SAT: co powinno znaczyc "pass"

Uzyteczny SAT daje:

- potwierdzenie, ze zalozenia specyficzne dla zakladu sie sprawdzily
- ograniczone okno stabilizacji z mierzalnymi kryteriami wyjscia
- podpisane przekazanie, co jest wspierane od dnia pierwszego versus co jest usprawnieniem fazy dwa

Slaby SAT daje:

- "zoptymalizujemy po starcie"
- akceptacja podpisana przy obejsciach blokad "tymczasowo"
- szkolenia odlozone, bo presja produkcji wygrywa

## Reality check: akceptacja zwykle psuje sie tam, gdzie zaklad traktuje nierozwiazane kwestie jak mozliwy do opanowania szum rozruchowy

Wlasnie dlatego slabe SAT-y moga nadal wydawac sie operacyjnie normalne.

Ludzie sa zmeczeni.

Linia jest prawie gotowa.

Brakujacy element brzmi jak drobiazg.

Ale jesli znana luka dotyczy bezpieczenstwa, wlascicielstwa, powtarzalnosci albo zachowania przy odzysku, to nie jest szum rozruchowy.

To niezamkniete ryzyko czekajace na pierwszy prawdziwy tydzien produkcji.

## Prosta brama pass lub fail (trzy pytania)

Uzyj tych samych trzech pytan przy FAT i SAT:

1. czy spelnia zapisane kryteria akceptacji z uzgodnionym dowodem?
2. czy znane luki sa udokumentowane z wlascicielami, datami i akceptacja ryzyka tam gdzie wymagane?
3. czy operacje moga prowadzic standard pracy bez heroicznej interwencji?

Jesli pytanie trzecie brzmi "nie", go-live to zaklad, nie decyzja.

## Kiedy wstrzymac FAT lub SAT

Wstrzymaj, gdy:

- zmiany zakresu przychodza jako "male poprawki" bez kontroli zmian
- materialy testowe nie sa reprezentatywne i nikt nie dokumentuje podmiany
- obsada integratora na miejscu nie zgadza sie z planem i pomijane sa krytyczne testy
- brakuje wlascicieli wewnetrznych (utrzymanie, IT, jakosc) a defekty zostana osierocone

Wstrzymanie to nie dramat.

To taniej niz przerobki na zywej linii.

## Co to znaczy dla DBR77 Marketplace

DBR77 Marketplace ma sprawic, ze zakupy automatyzacji sa mozliwe do inspekcji: jasniejsze oferty, jasniejsze porownanie, jasniejsza odpowiedzialnosc.

Dyscyplina akceptacji to moment, w ktorym jasne oferty staja sie jasna rzeczywistoscia.

Gdy modele komercyjne i zakres sa wczesnie porownywalne, kryteria akceptacji trudniej ukryc w przypisach.

Marketplace to nie katalog robotow.

To workflow i warstwa zaufania, ktora wspiera decyzje producenta przez wybor, porownanie i rzeczywistosc dostawy.

## Podsumowanie

FAT udowadnia zintegrowany system wzgledem kryteriow kontraktu z mozliwym do sledzenia zapisem.

SAT udowadnia te same kryteria w kontekscie Twojej fabryki z operacyjnym wlascicielem.

Jesli akceptacja jest definiowana pozno, zaplacisz za niejasnosc w pierwszym tygodniu produkcji.
