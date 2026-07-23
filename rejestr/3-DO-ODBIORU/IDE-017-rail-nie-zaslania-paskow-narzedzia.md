---
id: IDE-017
tytul: NAPRAWA — lewy pasek zjadał początek własnych pasków narzędzia
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P1-8"
utworzone: 2026-07-23
ekran: processflow-canvas
wysokosc: 900
klik: "Popatrz na pasek nad płótnem: „Klasyczny przepływ”, „Start”, „Koniec”, „Akcja”, „Decyzja” mają być w całości widoczne. Nazwy torów po lewej („Utrzymanie ruchu”, „System AI”) też."
---

## 1. PROBLEM

Pływający pasek narzędzi leżał NAD płótnem przy lewej krawędzi i zasłaniał początek pasków należących do samej reprezentacji. Widać to było jako ucięte napisy: „Klasyczny przepływ" renderowało się jako „…czny przepływ", „Start" jako „…rt", w Tabeli „Framework" jako „mework".

To inny defekt niż IDE-014 (tam pasek wychodził w GÓRĘ na menu). Tutaj wychodzi w BOK na treść.

## 2. ROZWIĄZANIE

Powłoka rezerwuje rynnę o szerokości paska — treść zaczyna się tam, gdzie pasek się kończy. Szerokość jest mierzona, nie zaszyta na sztywno, bo pasek rośnie przy rozwiniętych popoverach.

Dwie pułapki po drodze, obie warte zapisania, bo łatwo w nie wpaść ponownie:
- Marginesu **nie wolno** dać na kontener płótna — pasek jest pozycjonowany absolutnie i przesunąłby się razem z treścią, czyli zasłaniałby dalej.
- Paska **nie da się** zmierzyć po drzewie dokumentu, bo renderuje się przez portal poza swoim miejscem w strukturze. Stąd jawny znacznik na jego powierzchni, po którym powłoka go znajduje.

## 3. JAK ODEBRAĆ

Popatrz na pasek nad płótnem w Przepływie i w Tabeli — żaden napis nie może być ucięty od lewej. Sprawdź też nazwy torów po lewej stronie płótna.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Pomiar: pasek kończy się na 122 px, napis „Klasyczny przepływ" zaczyna się na 148 px — poza paskiem. Przed naprawą napis wpadał pod pasek.
- Zrzut wykonany przeze mnie przed pokazaniem właścicielowi (reguła #7); cały pasek Przepływu odsłonięty.
- Zasięg zmiany mały: pływający pasek jest dziś używany wyłącznie przez ekran Idei.
