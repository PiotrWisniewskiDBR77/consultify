# Jak ustawic kryteria akceptacji zanim rozpocznie sie dostawa automatyzacji

Target persona: inzynieria i jakosc / nabywca techniczny  
Funnel stage: Consideration do Evaluation (specyfikacja i wejscia do przyznania)  
Core problem: akceptacja jest traktowana jak pozny argument przy uruchomieniu zamiast pisanego kontraktu, wobec ktorego planuje sie dostawe  
Main promise: ograniczona metoda definiowania obiektow akceptacji, dowodow i sekwencji przed mobilizacja

Akceptacja to nie nastroj przy go-live.

To operacyjna definicja ukonczenia.

Jesli nie mozesz tego przetestowac, nie mozesz tego czysto przyznac.

## Bezposrednia odpowiedz

Ustal kryteria akceptacji przed rozpoczeciem dostawy, publikujac ponumerowana liste obiektow akceptacji, kazdy z obiektywnym dowodem, odpowiedzialnym weryfikatorem i zaleznosciami sekwencji, a nastepnie wyrownaj kamienie milowe i platnosci do tych obiektow.

Odkladanie definicji akceptacji zamienia commissioning w negocjacje i niszczy odpowiedzialnosc za harmonogram.

## Krok 1: rozdziel obiekty od aktywnosci

Obiekt akceptacji to rezultat, ktory mozesz zweryfikowac.

Przyklady (ilustracyjne):

- pasmo czasu cyklu pod nazwanym zestawem SKU i warunkami stanowiska
- wskaznik bledow lub zachowanie obslugi odrzutow pod zdefiniowanymi wejsciami
- funkcje bezpieczenstwa zwalidowane pod nazwanymi scenariuszami
- zachowanie handshake danych przy nazwanych punktach interfejsu

Aktywnosci jak "szkolenie zakonczone" naleza do planu, ale nadal powinny mapowac na obserwowalne rezultaty, jesli to mozliwe.

## Krok 2: zdefiniuj dowod dla kazdego obiektu

Dla kazdego obiektu okresl:

- metode pomiaru
- warunki srodowiska
- regule wielkosci proby lub czasu trwania
- regule zaliczenia lub niezaliczenia

| slaby jezyk dowodu | mocny jezyk dowodu |
| --- | --- |
| "wydajnosc akceptowalna" | "przepustowosc X do Y jednostek na godzine ze zlomem ponizej Z pod warunkami A" |
| "zintegrowane z MES" | "zdarzenia E1 do E3 pojawiaja sie w systemie S w ciagu T sekund w przypadkach testowych TC1 do TC5" |

## Krok 3: szczerze ustaw zaleznosci sekwencji

Niektore obiekty nie da sie udowodnic, dopoki inne nie sa stabilne.

Zbuduj prosta liste zaleznosci (ilustracyjnie):

1. akceptacja mechanicznego bezpieczenstwa i ogrodzenia
2. podstawowy ruch i sterowanie w trybie recznym
3. cykl automatyczny przy ograniczonym zestawie SKU
4. handshake MES lub systemu jakosci pod obciazeniami testowymi
5. probna produkcja przy warunkach zblizonych do produkcji

Jesli zakupy chca wczesnych faktur, mapuj kamienie milowe na prawdziwe obiekty posrednie, a nie teatr kalendarzowy.

## Krok 4: wyrownaj wewnetrzne akceptacje do rol akceptacji

Wskaz, kto moze podpisac kazda klase obiektu:

- operacje dla wplywu na przepustowosc i obsade
- jakosc dla wplywu na defekty i identyfikowalnosc
- IT dla tozsamosci i sieci
- utrzymanie dla serwisowalnosci

Brak akceptujacych przy definicji staje sie brakiem akceptujacych przy podpisie.

## Co to znaczy dla DBR77 Marketplace

DBR77 Marketplace to workflow decyzji automatyzacji i system porownywania ofert ze strukturalna inspektowalnoscia.

Kryteria akceptacji naleza do tej struktury wczesnie: to sposob, w jaki rozne sciezki integratora staja sie porownywalne przez rezultaty, a nie hasla.

Marketplace to nie katalog robotow.

To warstwa zaufania przy wyborze integratora oparta na tym, co zaklad moze zweryfikowac.

## Podsumowanie

Zapisz akceptacje jako testowalne obiekty z dowodem przed mobilizacja.

Pozna akceptacja jest droga, bo to pozna porownywalnosc.
