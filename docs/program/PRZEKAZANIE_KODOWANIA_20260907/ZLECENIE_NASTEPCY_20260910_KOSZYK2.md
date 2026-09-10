# ZLECENIE DLA NASTĘPCY — koszyk 2 MVP, część inżynierska, jeden dzień (10.09.2026)

Ten plik jest treścią zlecenia do wklejenia następnemu agentowi nadzorczemu.
Powstał 10.09 rano, na stanie `dc510f9f25`, po zmierzeniu środowisk.

---

Jesteś nadzorcą sesji w projekcie Consultify. Właściciel: Piotr, komunikacja PO POLSKU, krótko.
Twoja rola to zarządzanie, nie kodowanie: rozdzielasz pracę robotnikom (Agent), scalasz, prowadzisz
bramkę i wdrożenia, pilnujesz dowodów. Sam piszesz kod tylko wtedy, gdy to poprawka na jedną–dwie linie
albo naprawa po robotniku.

## KROK 0 — przeczytaj, zanim cokolwiek zrobisz (15 minut, bez pomijania)

1. `docs/program/PRZEKAZANIE_KODOWANIA_20260907/RAPORT_KONCOWY_20260910.md` — stan zmierzony, dorobek
   poprzedniego dnia, trzy incydenty z lekcjami, lista otwartych pozycji.
2. `docs/program/PRZEKAZANIE_KODOWANIA_20260907/PRZEKAZANIE_20260909_KONIEC_DNIA.md` — jak się tu pracuje:
   dwie komendy wdrożenia, procedura scalania paczki, siedem pułapek stanowiska, lista zakazów.
3. `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`, sekcja **Pojemnik 2** (linie 74–118) — definicja celu,
   15 kryteriów „gotowe", kolejność pozycji 2.0–2.11 i lista kontrolna S2.1–S2.14.
4. `CLAUDE.md` w katalogu głównym — prawo nadrzędne UI i zasady wykonania.

Potem zmierz stan sam, nie ufaj tym liczbom na słowo:
```
curl -s https://staging.consultify.ai/api/health   # ma dać gitSha = HEAD gałęzi
curl -s https://demo.consultify.ai/api/health
cd ~/Developer/wt/fable-inicjatywy && git status --short && git log --oneline -3
```

## CEL DNIA — i uczciwa granica

**Koszyka 2 nie da się zamknąć w jeden dzień** i nie udawaj, że się da: pozycja 2.10 to dwutygodniowy
pilotaż czterech nazwanych osób (Tomek, Kasia, Irina, Justyna), a pozycje 2.6, 2.9, 2.11 i większość
listy szampana wymagają potwierdzenia właściciela.

**Twój cel na dziś: zamknąć CAŁĄ część inżynierską koszyka 2 (pozycje 2.0–2.8), tak żeby pilotaż mógł
ruszyć jutro rano.** Miarą sukcesu jest jedno zdanie: „czworo ludzi może jutro założyć organizację na
demo i dojść od wywiadu do wyniku bez pytania, gdzie to jest, a my zobaczymy, gdy coś pęknie".

## STAN WYJŚCIOWY (zmierzony 10.09 06:20)

| | staging (thomas) | demo (trolley) |
|---|---|---|
| kod | `f53f9fbdf9` (health) | `f53f9fbdf9` |
| gałąź integracyjna | `mvp/inicjatywy-lancuch-20260907` = `dc510f9f25` | — |
| organizacje | 8 (4 docelowe + 4 konta testerów) | 4 docelowe |
| dane Northwind | pełne po dosiewie D9 | pełne |
| konfiguracja produktu | komplet | komplet |

Nic nie biegnie w tle. Jeden worktree: `~/Developer/wt/fable-inicjatywy`.

## PACZKI DO WYDANIA — kolejność ma znaczenie

Wydaj równolegle P1, P2, P3 (nie kolidują plikami). P4 i P5 dopiero po P1.
Każdemu robotnikowi twórz worktree SAM, dawaj własne porty i własną kopię bazy, żądaj commitu po
każdym etapie i meldunku w układzie: STANOWISKO · POMIAR PRZED→PO · CO ZMIENIŁEM · DOWÓD · SHA per etap · STOP-y.

### P1 — Poczta i onboarding (kryteria 3, S2.8) — Opus, priorytet najwyższy
Bez działającej poczty pilotaż nie ruszy: cztery osoby dostają zaproszenia i resetują hasła.
Zmierzone dziś: staging ma `SMTP_HOST=smtp.hostinger.com`, port 587, `SMTP_FROM=hello@consultinity.com`;
**demo nie ma ani `SMTP_FROM`, ani portu spójnego ze stagingiem (465 vs 587)**.
Zadanie: (a) zmierz, czy wysyłka realnie działa na obu środowiskach — wyślij zaproszenie i reset hasła na
adres właściciela, potwierdź dostarczenie; (b) wyrównaj zmienne demo do stagingu; (c) przejdź kreator
„Krok 1 z 3" na świeżej organizacji i sprawdź, czy kończy się bez ściany oraz czy konto TRIAL nie blokuje
po trzech pytaniach bez czytelnego komunikatu (mechanizm limitów opisany w pamięci „Limity czatu AI —
trzy warstwy"); (d) zrzuty przed/po.

### P2 — Przepływ „pusty stan → pierwsza wartość" (kryterium 1, S2.2) — Sonnet ×2, podziel moduły
Na ŚWIEŻEJ organizacji (rejestracja od zera, nie Northwind) przejdź każdy moduł i sprawdź, czy pusty ekran
mówi po polsku, co zrobić, i ma jedną akcję. Zero ekranów z samym „—". Robotnik A: czat, moja praca,
wywiad, ocena, organizacja, ustawienia. Robotnik B: inicjatywy, realizacja, wyniki, materiały, audyty, admin.
Wynik: lista braków z lokalizacją w kodzie + naprawy tam, gdzie to tekst i jedna akcja; reszta jako STOP.
Na koniec test Playwright „pusty stan → pierwsza wartość" w CI.

### P3 — Obserwowalność i limiter AI (kryteria 10, 11, S2.5, S2.6) — Sonnet
Zmierzone dziś: `DISABLE_RATE_LIMIT=true` na stagingu (limiter wyłączony od 05.09 = rachunek bez sufitu),
`ALERT_EMAIL_RECIPIENTS` ustawione tylko na stagingu.
Zadanie: (a) włącz limiter z budżetem per organizacja i czytelnym polskim komunikatem po wyczerpaniu —
uważaj, żeby nie zablokować kont pilotażu (Northwind i DBR77 mają podniesione limity, patrz pamięć);
(b) sprawdź alert na 5xx i na padnięcie health, wywołując sztuczny błąd, i pokaż zrzut alertu;
(c) wyrównaj zmienne alertowe na demo.

### P4 — Bezpieczeństwo (kryterium 2, S2.3) — Opus, po P1
`CSRF_MODE=report` na stagingu, na demo brak. Zadanie: przełącz na `enforce` na stagingu, przejdź pełny
przepływ zapisu (tworzenie inicjatywy, zadania, decyzji, materiału) i potwierdź brak regresji; potem to samo
na demo. Osobno: macierz cross-org — zmierz, czy konto z organizacji A widzi cokolwiek z organizacji B.

### P5 — Eksport i usunięcie danych (kryterium 12, S2.7) — Sonnet, po P1
Eksport organizacji do pliku i usunięcie na żądanie, oba z interfejsu, oba sprawdzone na kopii.

## CZEGO NIE ROBIĆ DZIŚ
Pozycja 2.6 (Finanse) czeka na decyzję właściciela „minimum czy wkrótce". Pozycja 2.0 (ćwiczenie promocji
na produkcję) to osobna sesja z właścicielem. Pozycji 2.3 (dwa magazyny danych → jedna projekcja) nie
zaczynaj, dopóki P1–P5 nie są zamknięte; to trzy sesje Opusa, nie jeden dzień.

## TRZY DECYZJE, KTÓRE CZEKAJĄ NA WŁAŚCICIELA
Zrzuty zostały wysłane wczoraj. Przypomnij o nich w pierwszej wiadomości i nie blokuj na nich pracy:
1. Przycisk tworzenia inicjatywy otwiera menu z wyborem (ręcznie albo kreator AI) zamiast wchodzić wprost w kreator.
2. Plakietka „Attention Required" jest czerwona przy statusie gotowym — czerwona czy bursztynowa.
3. Zapis daty rzymską cyfrą („IX 2026") — zostaje czy „Sep 2026".

## OTWARTE DEFEKTY Z WCZORAJ (wchodzą do P2, jeśli dotkniesz tych ekranów)
Brak przycisków edycji i usuwania w menu kontekstowych realizacji i mojej pracy (na API cykl przechodzi —
brakuje przewodu w interfejsie). Kreator materiałów nie otworzył się w jednym przebiegu. Kolumna SOURCE
wypełniona w 2 z 7 wierszy. Nowa inicjatywa żyje w `runtime-v1`, nie ma jej w `GET /api/initiatives`.
Klony sesji demo wracają przy każdym użyciu funkcji; sprzątacz chodzi raz na dobę o 2:30.

## RYTM DNIA
Rano wydaj P1, P2, P3. Po każdym meldunku: scal wg procedury z przekazania, przepuść przez bramkę
czterokrokową, wypchnij na staging, potwierdź health, promuj na demo, dopisz wiersz do rejestru
`docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`, usuń worktree robotnika.
Po południu wydaj P4 i P5. Wieczorem: raport zbiorczy, karta dla właściciela na jutro z jedną ścieżką
pilotażu do przejścia, przekazanie dla następcy.

## ZASADY, KTÓRE KOSZTOWAŁY NAJWIĘCEJ
PASS tylko po pomiarze; „nie sprawdziłem" to N/A z powodem, nie PASS. Po każdej operacji na danych przejdź
jeden pełny przepływ zapisu, nie licz rekordów. Cisza robotnika nie jest dowodem śmierci — mierz commity,
czas zmiany plików i obecność procesu, a cudzego stanowiska nie kasuj nigdy. Po wdrożeniu czytaj wynik
przebiegu, nie zakładaj sukcesu po wysłaniu. Produkcja (centerbeam) bez jawnej zgody właściciela — nigdy.
