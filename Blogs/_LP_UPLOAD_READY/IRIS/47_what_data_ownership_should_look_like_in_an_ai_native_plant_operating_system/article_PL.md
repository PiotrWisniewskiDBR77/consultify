# Jak powinna wygladac wlasnosc danych w AI-native plant operating system

Target persona: CIO / Architekt IT-OT / Lider zarzadzania danymi  
Funnel stage: Consideration  
Core problem: "wszyscy posiadaja dane" znaczy, ze nikt nie naprawia definicji, awarii odswiezania ani luk w pochodzeniu, gdy przybywa modeli i regul  
Main promise: praktyczna mapa wlasnosci dla systemow zrodlowych, kuratowanych definicji operacyjnych, wynikow asysty i sladow audytu z jawnym RACI

**Direct answer:** Wlasnosc danych w AI-native plant operating system powinna wskazywac jednego odpowiedzialnego za rodzine definicji operacyjnych (np. zakres OEE, drzewo przyczyn przestojow, master lokalizacji), stewarda odpowiedzialnego za jakosc dziennia oraz strony konsultowane dla kazdego konsumujacego workflow. Wyniki asysty dziedzicza wlasnosc workflow, ktorego dotykaja, nie dostawcy modelu. SLA odswiezania, obsluga wyjatkow dla przestarzalych zasilen i prawa publikacji wersji musza byc zapisane. Jesli dwa zespoly moga edytowac ten sam prog bez wpisu w changelog, nie masz wlasnosci, masz wspolna wine.

AI nie tworzy nowych danych.

Ujawnia, kto zaniedbal stary kontrakt danych.

## Mapa 1: trzy warstwy wlasnosci

| Warstwa | Odpowiedzialny akceptujacy | Odpowiedzialny wykonawczy | Typowa porazka |
|---|---|---|---|
| zasilenia zrodlowe | lider rady danych zakladu | admin systemu per zrodlo | cichy dryft schematu |
| definicje operacyjne | wlasciciel funkcji (prod, jakosc, WH) | analityk CI | spory o KPI |
| konfiguracja asysty | kierownik zakladu | zespol konfiguracji miedzyfunkcyjnej | cien edycji progow |

Akceptujacy zatwierdza publikacje.

Wykonawczy naprawia codzienne awarie.

## Checklist: pakiet definicji (publikuj zanim modele sie dostroja)

- definicja w prostym jezyku i wykluczenia  
- mapowanie pol na tabele lub tagi zrodla  
- kadencja odswiezania i maksymalny akceptowalny lag  
- znane znieksztalcenia i kompensacje  
- okno zmiany i regula komunikacji dla operatorow  

Pakiety zapobiegaja debatom "model jest zly", ktore sa walka o definicje.

## Framework: dane dostawcy kontra dane zakladu

| Typ danych | Zaklad musi posiadac | Dostawca moze prowadzic |
|---|---|---|
| progi i klasy akceptacji | tak | tylko pod kontraktem i logowaniem |
| notatki i przejecia operatora | tak | nigdy |
| wagi modelu i prompty | polityka i ewaluacja | hosting wykonania opcjonalnie |
| surowy strumien maszyny | reguly dostepu i retencji | urzadzenie zbierajace |

Jesli kontrakt milczy o logach, zakladaj najgorsze i napraw.

## Sekwencja krokow: warsztat resetu wlasnosci (pol dnia)

1. lista top 10 KPI uzywanych we workflow wspieranych  
2. przypisz po jednym akceptujacym wlascicielu, bez wspolnych tytulow  
3. mapuj zasilenia i lag dla kazdego KPI  
4. uzgodnij jedna sciezke publikacji zmian definicji  
5. ustaw miesieczny przeglad zdrowia danych z czerwonymi flagami powiazanymi z dzialaniami  

## Kiedy sama centralna wlasnosc IT nie dziala

- operacje nie poczeka na zgloszenia podczas postoju  
- definicje wymagaja tygodniowego osadu hali  
- utrzymanie i jakosc spieraja sie o te same etykiety zdarzen  

Polacz odpowiedzialnosc IT ze stewardami funkcji na hali.

## Dlaczego IRIS czyni wlasnosc widoczna w wykonaniu

DBR77 IRIS to AI-native plant operating system z ujednolicona warstwa wykonania dla produkcji, magazynu, jakosci, utrzymania i zlecania.

Gdy definicje, zadania i konfiguracja asysty dziela pochodzenie w jednej warztwie, spory o wlasnosc maleja, a zgloszenia naprawcze przyspieszaja.

## Podsumowanie

Wlasnosc to kto publikuje, kto naprawia lag i kto odpowiada audytorom.

Zapisz to w RACI, nie w sloganach.
