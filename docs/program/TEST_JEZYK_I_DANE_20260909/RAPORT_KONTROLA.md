# Kontrola po naprawach — 09.09.2026, 21:30

Wykonana ręcznie przez nadzorcę. Paczka robotnicza padła na starcie (13 minut ciszy, zero commitów,
urwany zrzut 59 MB zamiast 240 MB) — przejąłem zadanie.

## 1. Przepływy zapisu (sedno kontroli)

Środowisko: świeży zrzut stagingu z 21:05 odtworzony lokalnie (240 MB, 1938 tabel, 0 błędów odtwarzania),
API na kopii, konto właściciela Northwind.

| przepływ | wynik | potwierdzenie w bazie |
|---|---|---|
| Inicjatywa, ścieżka ręczna (dziś podłączona) | utworzenie **201 APPLIED** | wiersz obecny |
| Zadanie: utwórz | **201** | wiersz obecny |
| Zadanie: edytuj | **200** | nowy tytuł zapisany |
| Zadanie: usuń | **200** | wiersza nie ma |
| Listy: inicjatywy, zadania, profil organizacji | **200** | — |
| Spotkania | **404** | moduł to zaślepka „planned for Wave 2" — N/A, nie defekt |

To jest odpowiedź na incydent z rana: zapis działa, sprawdzony ruchem, nie liczeniem rekordów.

## 2. Konfiguracja produktu po naprawie incydentu (odczyt z żywych baz)

| pozycja | staging | demo |
|---|--:|--:|
| bazowa polityka inicjatyw (`*`) | 1 | 1 |
| szablony systemowe Studia | 44 | 44 |
| artefakty systemowe (dwie tabele) | 24 + 24 | 24 + 24 |
| polityki globalne | 4 | 4 |
| wersje dokumentów bez organizacji | 222 | 222 |

Komplet 319 wierszy wrócił na oba środowiska i zgadza się co do sztuki.

## 3. Dosiew danych (odczyt z żywych baz)

| pozycja | staging | demo |
|---|--:|--:|
| kompletność profilu organizacji | 100 % | 100 % |
| przydziały wywiadu | 115 | 115 |
| opublikowana migawka przeglądu wyników | 1 | 1 |

## 4. Higiena organizacji — i dlaczego liczba rosła

Po porannej czystce zostały 4 organizacje. Wieczorem staging miał 30. Rozbicie:

| źródło | ile | decyzja |
|---|--:|---|
| klony sesji demo (0 członków, `<org>-session-<hash>`) | 22 | **usunięte** (staging i demo, manifest do cofnięcia) |
| rejestracje testerów z dzisiaj rano | 4 | **zostawione** — konta Tomka (9:39) i Kasi (10:01) |

Mechanizm: każde użycie sesji demo tworzy osobną organizację. Wbudowany sprzątacz istnieje
(`demoService.cleanupExpiredDemos`, doba życia, cron codziennie o 2:30 przez `TrialCron`), więc
klony znikają same, ale dopiero po dobie — między przebiegami narastają. Do rozstrzygnięcia w paczce 2:
skrócić czas życia, sprzątać częściej, albo wyłączyć sesje demo na stagingu.

Stan końcowy: **demo — 4 organizacje docelowe; staging — te same 4 plus 4 konta testerów.**

## 5. Werdykt

Właściciel może przejść system. Zapis działa we wszystkich sprawdzonych ścieżkach, konfiguracja produktu
jest kompletna, dane po dosiewie są na miejscu, obie bazy mają ten sam kod `ac3354f3ff`.

Świadome braki, które zobaczy: Spotkania to zaślepka; Finanse nie mają pozycji w menu głównym;
w Partnerach konto właściciela widzi tylko ekran połączenia. Trzy drobiazgi czekają na jego decyzję:
menu przy tworzeniu inicjatywy, kolor plakietki „Attention Required", zapis „IX 2026".
