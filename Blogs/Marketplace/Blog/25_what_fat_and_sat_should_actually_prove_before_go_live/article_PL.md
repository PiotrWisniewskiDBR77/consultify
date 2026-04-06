# Co FAT i SAT powinny naprawdę udowodnić przed startem produkcyjnym

Docelowa persona: Kierownik jakości / Kierownik inżynierii (właściciel po stronie producenta)  
Etap lejka: Przekazanie od decyzji do realizacji (zapewnienie przed startem produkcyjnym)  
Główny problem: FAT i SAT dryfują w ceremonie, które podpisują papier, ale nie redukują ryzyka operacyjnego  
Główna obietnica: ramy akceptacji nastawione na producenta, które wiążą dowód z tym, co musi być prawdą w pierwszym realnym tygodniu produkcji

Factory Acceptance Testing i Site Acceptance Testing to nie eventy morale. To kontrole. Zawodzą, gdy zespoły traktują je jak demo ze świadkami, okazje do zdjęć lub ćwiczenia z checkboxami oderwane od produkcyjnej rzeczywistości. Działają, gdy odpowiadają na jedno pytanie dowodem: co sprawiłoby, że odmówimy uruchomienia w produkcji i jak to testujemy, zanim zobowiążemy linię?

FAT powinien pokazać, że zintegrowany system spełnia kryteria akceptacji zdefiniowane w kontrakcie w warunkach kontrolowanych przez dostawcę, ze śledzalnymi zapisami powiązanymi z wymaganiami — nie optymizmem typu „ruszyło się”.

SAT powinien pokazać, że te same kryteria trzymają się w waszym zakładzie: realne interfejsy, realne materiały tam, gdzie ma to zastosowanie, realne zabezpieczenia i praktyka lockoutu oraz realny odpowiedzialność operacyjny. Jeśli FAT dowodzi ruchu, a SAT nadziei, kupiliście teatr.

## Zacznij od obiektów akceptacji, nie od dat ceremonii

Zanim zaplanujesz sale i loty, wypisz, co musi być prawdą: funkcje bezpieczeństwa zachowują się jak w specyfikacji; cykl i przepustowość mieszczą się w uzgodnionym paśmie pod zdefiniowanym modelem obciążenia; wyjścia jakościowe spełniają plan próbkowania; obsługa błędów i powrót do ruchu działają przy realistycznych usterkach; dane i wymiana komunikatów z MES realizują uzgodnione przepływy; dokumentacja i szkolenie pozwalają operatorom prowadzić standardową pracę. Czego nie wypiszesz, tego nie przetestujesz — o tym będziecie się spierać później wyższym kosztem.

## Co daje poważny FAT

Powinieneś wyjść z FAT ze śledzialnymi zapisami testów zmapowanymi na ID wymagań, listą otwartych punktów z właścicielami i datami przed wysyłką, jawnymi notatkami, co było symulowane, a co wykonane realnie, oraz zamrożonymi identyfikatorami buildów oprogramowania i firmware. Słabe FAT-y handlują subiektywnym „wygląda dobrze”, ruchomymi celami („dostroimy na miejscu”) i cichymi podmianami w oprzyrządowaniu, częściach lub buildach. Producenci powinni odmawiać tej niejasności.

## Co daje poważny SAT

SAT potwierdza założenia specyficzne dla zakładu, zamyka luki z ograniczonym oknem stabilizacji i mierzalnymi kryteriami wyjścia oraz produkuje przekazanie, które mówi, co jest wspierane pierwszego dnia, a co jest usprawnieniem późniejszej fazy. Słabe SAT-y podpisują akceptację, gdy blokady są „tymczasowo” ominięte, optymalizacja jest w nieskończoność odkładana lub szkolenie poświęcone presji produkcyjnej.

## Rzeczywistość po stronie zakładu: „małe luki” nie są małe

Pod zmęczeniem i presją harmonogramu nierozwiązane kwestie dostają etykietę szumu rozruchowego. Jeśli luka dotyka bezpieczeństwa, odpowiedzialności, powtarzalności lub zachowania przy powrocie do ruchu, to nie szum — to niezamknięte ryzyko czekające na pierwszy realny tydzień produkcji.

## Bramka trzech pytań (użyj przy FAT i SAT)

Zanim podpiszesz krok akceptacji, zapytaj: czy spełnia pisane kryteria uzgodnionym dowodem; czy znane luki są udokumentowane z właścicielami, datami i jawną akceptacją ryzyka tam, gdzie wymagane; czy operacje mogą wykonać standardową pracę bez bohaterskiej interwencji? Jeśli trzecia odpowiedź brzmi nie, go-live to zakład, nie decyzja.

## Kiedy zawieś

Zawieś, gdy zmiany zakresu przychodzą jako luźne poprawki bez kontroli zmian, materiały testowe są niereprezentatywne i niedokumentowane, obsada w zakładzie nie odpowiada planowi testów lub wewnętrzni właściciele (utrzymanie, IT, jakość) są nieobecni, więc wady nie mają domu. Zawieszenie jest tańsze niż przeróbka na działającej linii.

## Jak wiąże się DBR77 Marketplace

Dyscyplina akceptacji powinna śledzić to, co porównano, skontraktowano i obiecano przed wyborem dostawcy. To utrzymuje FAT i SAT przy logice zakupów zamiast unosić je jako oderwane rytuały.

Ciągłość między kontraktem a przekazaniem realizacji: [Co sprawdzić przed podpisaniem kontraktu automatyzacyjnego](../20_what_to_check_before_signing_an_automation_contract/article_PL.md) oraz [Jak powinno wyglądać czyste przekazanie od wyboru do realizacji](../30_what_a_clean_handoff_from_selection_to_delivery_should_look_like/article_PL.md).

## Akceptacja jako kontrakt z halą

FAT i SAT to miejsce, w którym abstrakcyjny zakres staje się żytą rzeczywistością. Operatorzy powinni rozpoznawać testy jako swój świat: realne zabezpieczenia, realne materiały tam, gdzie ma to zastosowanie, realne scenariusze powrotu, realne ścieżki danych. Jeśli testy są „wystarczająco blisko”, nie walidujecie produkcji — walidujecie opowieść. Ta różnica pokazuje się przy pierwszym uruchomieniu pod presją klienta.

Dobra dyscyplina akceptacji chroni też dostawców, którzy wykonali robotę poprawnie. Gdy kryteria są jawne, silni wykonawcy mogą udowodnić domknięcie bez wiecznych bitów o opinię. Słabe kryteria karzą wszystkich, zamieniając domknięcie w negocjację.

## Podsumowanie

FAT dowodzi zintegrowanej wydajności wobec kryteriów kontraktu z zapisami. SAT dowodzi tego samego w waszym kontekście z operacyjnym odpowiedzialnością. Zdefiniuj akceptację wcześnie — albo zapłać za niejasność w pierwszym realnym tygodniu produkcji.

---

*DBR77 Marketplace pomaga producentom utrzymać zakres, interfejsy i odpowiedzialność widoczne wcześnie, by kryteria akceptacji trudniej było odkładać na tydzień go-live. [Opisz swoje wyzwanie](https://dbr77.com/marketplace) lub [Porównaj oferty](https://dbr77.com/demo).*
