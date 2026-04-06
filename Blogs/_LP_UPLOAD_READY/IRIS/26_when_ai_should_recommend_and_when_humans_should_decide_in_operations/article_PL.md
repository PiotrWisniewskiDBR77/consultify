# Kiedy AI powinno rekomendowac, a kiedy ludzie powinni decydowac w operacjach

Target persona: Dyrektor jakosci / Dyrektor operacji / Menedzer inzynierii  
Funnel stage: Decision  
Core problem: zaklady albo nadmiernie ufaja modelom, albo calkowicie banuja AI, bo brakuje prostej mapy praw decyzyjnych powiazanej z ryzykiem, identyfikowalnoscia i odpowiedzialnoscia  
Main promise: jasny framework praw decyzyjnych oparty na klasie ryzyku, odwracalnosci i narazeniu regulacyjnym, plus sposob wdrozenia jako progi akceptacji w workflow

**Bezposrednia odpowiedz:** AI powinno domyslnie rekomendowac przy decyzjach operacyjnych z dwuznacznym kontekstem, miedzyfunkcyjnymi kompromisami lub narazeniem BHP i jakoscia. Ludzie powinni decydowac, gdy dzialanie jest trudne do cofniecia, wymaga rejestracji regulacyjnej lub przekracza uzgodniony prog ryzyka, nawet jesli model wyglada na pewnosc.

To nie kwestia braku zaufania do AI.

To dopasowanie praw decyzyjnych do odpowiedzialnosci w prawdziwych zakladach.

## Regula fabryki: rekomendacja jest domyslem, nie wyjatkiem

W zdrowych programach przemyslowych AI zachowuje sie jak starszy sztab:

- przygotowuje opcje
- podswietla ograniczenia
- pokazuje historie

Ludzie zachowuja wladze tam, gdzie organizacja ponosi odpowiedzialnosc prawna.

## Praktyczny model klasy ryzyka

Przypisz kazdemu typowi decyzji klase. Trzymaj to proste.

| Klasa ryzyku | Przyklady | Typowa rola AI |
|---|---|---|
| Niskie | kategoryzacja szumu, projekty not wewnetrznych | wspieraj swobodnie |
| Srednie | propozycja pasma priorytetu, projekt routingu | rekomenduj, potwierdzenie czlowieka |
| Wysokie | zwolnienie blokady jakosci, intencja ominiecia blokady | decyzja czlowieka, AI wspiera dowody |
| Krytyczne | nadrzad BHP, podpis wysylki do klienta | decyzja czlowieka z formalnym zapisem |

To framework, nie dokument prawny.

Twoj zespol compliance i tak powinien zwalidowac.

## Uzyj odwracalnosci jako drugiej osi

Nawet przy tej samej klasie ryzyku odwracalnosc ma znaczenie.

**Latwo odwracalne**  
Zmiana kolejnosci zadan, przypisanie niewrazliwej pozycji pracy, sugestia niewiazacego harmonogramu.

**Wolno lub drogo odwracalne**  
Dyspozycja zlomu, wysylka do klienta, duze zmiany predkosci linii, dzialania wyzwalajace CAPEX.

Gdy cofniecie jest kosztowne, zaciskaj bramki ludzkie.

## Progi zamieniaja filozofie w workflow

Uczyn reguly operacyjnymi:

- kazda sugestia powyzej wyniku ciezkosci wymaga potwierdzenia nadzorcy
- kazda rekomendacja zmieniajaca chronione pole wymaga akceptacji roli
- kazde dzialanie dotykajace obiektu regulowanego wymaga audytowalnego kroku czlowieka

Progi powinny byc widoczne dla operatorow, nie ukryte w kodzie modelu.

## Przekazania: gdzie padaja modele mieszane

Modele mieszane padaja, gdy:

- AI rekomenduje w jednym narzedziu
- ludzie decyduja w drugim
- audyt jest podzielony

Zapis decyzji powinien zyc z pozycja pracy.

## Notatka szkoleniowa: ucz odmowy, nie tylko akceptacji

Zespoly powinny cwiczyc:

- szybka akceptacje dobrej rekomendacji
- odrzucenie rekomendacji z kodem przyczyny
- eskalacje, gdy brakuje kontekstu

Kody przyczyn to sposob, w jaki zaklad sie uczy.

## Dlaczego IRIS wspiera dyscypline praw decyzyjnych

DBR77 IRIS to AI-native system operacyjny zakladu z ujednolicona warstwa wykonania dla produkcji, magazynu, jakosci, utrzymania i zadan.

Ujednolicone wykonanie to to, co robi z rekomendacji, akceptacji i audytu jedna narracje zamiast trzech narzedzi.

## Podsumowanie

Wlasciwy podzial to nie "AI kontra ludzie".

To "rekomendacja kontra decyzja" zmapowane na ryzyko, odwracalnosc i rzadzenie.

Zrob te mape jawnie, albo zaklad zrobi ja nieformalnie na korytarzu.
