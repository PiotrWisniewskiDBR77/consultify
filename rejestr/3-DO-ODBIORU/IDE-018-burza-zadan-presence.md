---
id: IDE-018
tytul: NAPRAWA — ekran Idei wysyłał ~55 żądań na sekundę w tle
typ: zadanie
waga: krytyczna
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Znalezione przy repro P0-3 (przełączenie reprezentacji)"
utworzone: 2026-07-23
---

## 1. PROBLEM

Otwarty ekran Idei bombardował serwer żądaniami obecności użytkowników. Pomiar: **880 żądań w ~16 sekund** na jednym ekranie, przy zamierzonym tempie jednego na pięć sekund.

Przyczyna to sprzężenie zwrotne, nie zły interwał. Komponent nadrzędny przekazywał funkcję zwrotną tworzoną od nowa przy każdym renderze. To restartowało cały mechanizm: kasowało odliczanie i **natychmiast** wysyłało żądanie, którego odpowiedź zmieniała stan, co powodowało kolejny render — i tak w kółko. Odliczanie pięciosekundowe nigdy nie zdążyło wystrzelić ani razu.

## 2. ROZWIĄZANIE

Mechanizm zależy teraz wyłącznie od tożsamości Idei i przełącznika włącz/wyłącz, a nie od tożsamości funkcji przekazanych z góry.

Po naprawie: **8 żądań** zamiast 880 — czyli dwie instancje komponentu razy jeden start plus trzy tyknięcia co pięć sekund. Zgodnie z zamierzeniem.

## 3. JAK ODEBRAĆ

Ta pozycja nie ma czego oglądać — to zachowanie sieciowe. Odbiór = przyjęcie liczby: 880 → 8 na tym samym ekranie i w tym samym czasie.

Warto wiedzieć, że to obciążało również demo, nie tylko środowisko lokalne.

## 4. POZOSTAJE OTWARTE

Komponent obecności montuje się **dwa razy** na tym samym ekranie, co podwaja ruch (stąd 8 zamiast 4). To już nie burza, tylko drobiazg do posprzątania — zgłaszam, nie ukrywam.
