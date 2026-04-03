# Jak utrzymac program IoT przy zyciu, gdy odchodzi pierwszy champion

Docelowa persona: Kierownik zakladu / Sponsor IT-OT / Wlasciciel programu  
Etap lejka: Adoption  

Glowny problem: pierwszy champion niosl nieformalne decyzje, relacje z vendorami i zaufanie operatorow, wiec program wyglada osobiscie, a nie instytucjonalnie Glowna obietnica: zestaw ciaglosci: udokumentowane decyzje, wspoldzielona odpowiedzialnosc, zwalidowane przez operatorow reguly sygnalow i pozycje budzetowe, ktore przetrwaja zmiane osoby Championy przyspieszaja start. Instytucje przetrwaja przekazania.

Jesli program IoT ginie, gdy jedna osoba zmienia role, nigdy nie zostal zoperacjonalizowany.

## Bezposrednia odpowiedz

Utrzymaj program przy zyciu przez **przeniesienie wiedzy z pamieci do artefaktow** zanim champion wyjdzie: log decyzji dla progow, eskalacji i override; nazwani wspolwlasciciele dla lacznosci OT, jakosci danych i szkolenia na hali; kalendarz przegladu kwartalnego powiazany z planowaniem, nie z heroizmem; mapa budzetu i kontraktow vendora z triggerami odnowien. Celem jest nudna ciaglosc, a nie zastepczy heros.

## Trzy podzialy odpowiedzialnosci

Unikaj wlasciciela na jednym watku.

| Tor | Posiada |
|---|---|
| Operacje | co sygnaly znacza dla decyzji o pracy i przekazania |
| Maintenance | interpretacja kondycji aktywa i powiazanie z CMMS |
| Engineering / IT-OT | standardy lacznosci, patch security, granice integracji |

Championy czesto rozmywaly te tory. Instytucjonalne IoT potrzebuje wyraznych szwow.

## Sekwencja krokow: sprint ciaglosci 30 dni

Wyeksportuj robocze notatki championa do logu decyzji z datami i uzasadnieniem; Pol dnia warsztatu z operatorami: ktore sygnaly nadal czuc jako prawdziwe; Przypisz wspolwlascicieli z nazwiskami zapasowymi, nie tylko primary; Zamroz miesiac "bez nowych alarmow", stabilizujac ownership; Prezentuj jednostronicowa charter programu dla leadership zakladu z kosztami i kadencja przegladu.

## Checklista: instytucjonalne sygnaly

- [ ] progi maja nazwanych reviewerow i date ostatniego przegladu
- [ ] override maja wygasanie i audit trail dostepny dla supervisorow
- [ ] materialy szkoleniowe zyja w LMS zakladu albo rownowazniku, nie na prywatnych dyskach
- [ ] odniesienia do standardow sa jawne dla bramek safety i jakosci
- [ ] zakres pilota i kryteria skali sa zapisane, by nastepny wlasciciel mogl je obronic

## Kiedy dziala i kiedy nie

**Dziala**, gdy leadership finansuje program jako infrastrukture, a nie projekt poboczny.

**Nie dziala**, gdy wyjscie staje sie cyklem winy, a operatorzy ucza sie, ze IoT znow jest opcjonalne.

## Co to znaczy dla DBR77 IoT

DBR77 IoT jest pod **szybki pilot** i **lacznosc retrofit-ready**, co zmniejsza zaleznosc od plemiennej wiedzy jednego integratora.

**Widocznosc maszyny w czasie rzeczywistym** i **wsparcie decyzji edge-first** zostaja wartosciowe przy rotacji ownership, jesli reguly sa udokumentowane.

## Bottom line

Przetrwaj odejscie championa przez **artefakty, wspolwlascicieli i kalendarz**.

IoT staje sie realne, gdy zaklad moze je prowadzic bez jednego nazwanego magika.
