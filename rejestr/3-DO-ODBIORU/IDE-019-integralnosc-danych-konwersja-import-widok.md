---
id: IDE-019
tytul: NAPRAWA — trzy defekty integralności danych: konwersja, import, wspólny stan widoku
typ: zadanie
waga: krytyczna
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P0-1, P0-2, P0-5"
utworzone: 2026-07-23
---

## 1. PROBLEM

Trzy osobne sposoby na ciche zepsucie danych.

**Konwersja (P0-1).** Konwersja Idei zapisywała wynik w jednym polu, nadpisując je bezwarunkowo. Druga konwersja kasowała ślad pierwszej. Gorzej: konwersja **fragmentu** (zaznaczenia, gałęzi) po cichu przestawiała etap CAŁEJ Idei na „promowana", mimo że reszta pracy trwała.

**Import (P0-2).** Import draw.io/BPMN zastępował cały graf jednym kliknięciem — bez potwierdzenia, bez podglądu, bez drogi powrotnej.

**Stan widoku (P0-5).** Wybór reprezentacji był zapisywany w jednym wierszu współdzielonym przez całą organizację. Czyj zapis ostatni, taki ekran u wszystkich — kolega przełączał się na Tabelę i przełączał ją tobie.

## 2. ROZWIĄZANIE

**Konwersja** — nowa historia konwersji: każda konwersja to dopisek, nigdy nadpisanie. Etap całej Idei zmienia się wyłącznie przy konwersji całości.

**Import** — podgląd z konkretnymi liczbami („usunie N węzłów, wstawi X"), potwierdzenie, migawka **przed** zmianą, podsumowanie, cofnięcie.

**Stan widoku** — preferencja przeniesiona do pamięci przeglądarki, per użytkownik. Link `/workspace/<narzędzie>` zawsze wygrywa.

## 3. STAN — WYKONANE, NIC NIE CZEKA

| Co | Stan |
|---|---|
| Historia konwersji | migracja **uruchomiona na staging**; ścieżka sprawdzona realną konwersją przez API |
| Import z potwierdzeniem | **włączone domyślnie** — render zweryfikowany przed pokazaniem właścicielowi |
| Stan widoku lokalny | działa, bez flagi |

Konwersję sprawdziłem obiema ścieżkami na obiekcie testowym: konwersja **fragmentu** dopisała wpis historii i **nie ruszyła** etapu całej Idei; konwersja **całości** dopisała drugi wpis i przestawiła etap. Oba wpisy współistnieją — przed naprawą drugi kasował ślad pierwszego. Rekordy próbne posprzątane, staging czysty.

Zabezpieczenie importu włączyłem domyślnie, bo wyłączone znaczyło, że jedno kliknięcie nadal kasuje cały graf bez ostrzeżenia. Komunikat podaje konkretne liczby, np. „usunie 9 węzłów i 9 połączeń, a wstawi 2 węzły i 1 połączenie".

## 4. OGRANICZENIA, KTÓRE ZGŁASZAM ZAMIAST PRZEMILCZEĆ

- Frontend nie wysyła jawnego zakresu konwersji; backend **wnioskuje** go z obecności listy zaznaczonych węzłów. To ten sam sygnał, którego frontend faktycznie używa, ale nie jest to jawny kontrakt.
- Mechanizm migawek ma szerszy defekt: przy zwykłym zapisie robi migawkę stanu **po** zmianie, nie przed. Na ścieżce importu to obeszliśmy; źródło problemu zostaje otwarte.
