# Karta na 10.09.2026 — start paczki 2

Stan na wieczór 09.09, po pełnym dniu prac. Wszystko poniżej jest zmierzone, nie założone.

## Środowiska

| | staging | demo |
|---|---|---|
| kod | `ac3354f3ff` | `ac3354f3ff` |
| organizacje | 4 docelowe + 4 konta testerów | 4 docelowe |
| konfiguracja produktu | komplet (319 wierszy) | komplet |
| dane pokazowe Northwind | pełne po dosiewie | pełne po dosiewie |

Konta: plik `northwind-konta-STAGING.txt` (hasło zrotowane 09.09 o 18:23, stare nie działa).
Tomek i Kasia mają na stagingu własne konta z dzisiaj i limity czatu podniesione do poziomu klienta płacącego.

## Co zrobiliśmy dziś

Wersja angielska: 16 modułów bez polskiego w interfejsie, 665 napisów bez ogonków wyłapanych osobnym przyrządem,
18 bezpieczników pilnuje, żeby nie wróciły. Baza: trzy cykle czystki plus sieroty, razem ponad 90 tysięcy wierszy śmieci.
Demo jest kopią stagingu. Dane pokazowe uzupełnione w pięciu miejscach, których brakowało do pełnego testu.
Dziesięć defektów z testu naprawionych, dwa uznane za nieistniejące po pomiarze.

## Jedna rzecz, którą trzeba znać

Rano czystka sierot skasowała 319 wierszy konfiguracji produktu, bo nie należą do żadnej organizacji.
Przez to nie dało się utworzyć inicjatywy w ogóle. Wykryte, przywrócone, zabezpieczone testem.
Wieczorna kontrola potwierdziła ruchem, że zapis działa: inicjatywa, zadanie, edycja, usunięcie.

## Trzy decyzje na jutro (masz zrzuty)

1. Przycisk tworzenia inicjatywy otwiera menu z wyborem ręcznie albo kreatorem. Zostaje?
2. Plakietka „Attention Required" jest czerwona przy statusie gotowym. Czerwona czy bursztynowa?
3. Zapis daty „IX 2026" rzymską cyfrą. Zostaje czy „Sep 2026"?

## Kolejka do paczki 2

- Twoje przejście po systemie na stagingu, bez asysty. To jedyna pozycja, której nie da się zrobić bez Ciebie.
- Klony sesji demo: każde użycie tworzy organizację, sprzątacz chodzi raz na dobę o 2:30. Skrócić czas życia,
  sprzątać częściej albo wyłączyć sesje demo na stagingu.
- Dług językowy: daty i liczby w panelu administratora i na serwerze, zdania budowane po stronie serwera,
  maile i pliki PDF, wersja polska (Ustawienia i panel mają sporo angielskiego na sztywno).
- Wskaźnik zwrotu w kokpicie Realizacji czyta starą tabelę zamiast kanonicznej.
- Spotkania to zaślepka, Finanse bez pozycji w menu głównym.

Wejście dla kolejnej sesji: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/PRZEKAZANIE_20260909_POPOLUDNIE.md`.
Raporty dnia: `docs/program/TEST_JEZYK_I_DANE_20260909/` (kryteria, język, dane, kontrola).
