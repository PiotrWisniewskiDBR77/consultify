---
id: IDE-015
tytul: NAPRAWA — prawy panel pokazywał tę samą treść pod każdą z pięciu ikon
typ: zadanie
waga: krytyczna
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Standard docelowy Idea Workspace — P0-4 (docs/standards/idea-workspace/12_BACKLOG_I_ODBIOR.md)"
utworzone: 2026-07-23
ekran: mindmap-canvas
wysokosc: 900
klik: "Klikaj kolejno pięć ikon na prawej krawędzi (Problem · Status · Inspektor · Konwersja · Kondycja). Za każdym razem panel ma pokazać INNĄ treść, od razu rozwiniętą."
---

## 1. PROBLEM

Prawa krawędź ma pięć ikon — Problem, Status, Inspektor, Konwersja, Kondycja. Każda z nich otwierała **dokładnie ten sam** panel z wszystkimi sekcjami naraz. Pięć zakładek, jedna treść: kliknięcie w „Kondycję" nie prowadziło do kondycji, tylko przewijało to samo.

Powłoka od początku podawała identyfikator klikniętej zakładki, ale ekran Idei go ignorował.

## 2. ROZWIĄZANIE

Zakładka renderuje teraz wyłącznie swoją sekcję. Dwie rzeczy przy okazji:

- **Sekcja jest treścią zakładki, nie pozycją akordeonu.** Konwersja i Kondycja nie miały ustawionego „rozwiń domyślnie", więc po samej naprawie otwierałyby się zwinięte — czyli zakładka nadal wyglądałaby na pustą. W trybie zakładki nagłówek przestaje być przyciskiem, a treść jest zawsze widoczna.
- **Zakładka bez treści nie jest klikalna.** Inspektor nie istnieje w Tabeli, Kondycja nie istnieje w Tablicy ani w Tabeli. Zamiast otwierać pusty panel, ikona jest wyszarzona i mówi dlaczego — „Kondycja — liczona dla Mapy myśli i Przepływu".

## 3. JAK ODEBRAĆ

Klikaj kolejno pięć ikon na prawej krawędzi. Za każdym razem panel ma pokazać inną treść, od razu rozwiniętą — bez konieczności klikania w nagłówek.

W Tabeli i Tablicy część ikon jest celowo wyszarzona: najedź na nie, tooltip ma powiedzieć, dlaczego są niedostępne i gdzie szukać odpowiednika.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- Pomiar w działającej aplikacji (Playwright, 4 obiekty testowe): treść każdej aktywnej zakładki ma **unikalny odcisk** — Mapa 5/5 różnych, Tablica 4/4, Przepływ 5/5, Tabela 3/3. Przed naprawą wszystkie odciski były identyczne.
- Zrzuty w czterech szerokościach (1280 · 1440 · 1600 · 1920) oraz w motywie jasnym i ciemnym — wykonane przeze mnie przed pokazaniem właścicielowi (reguła #7).
- Geometria: zero nakładania na menu, zero poziomego przewijania, zero uciętej treści w panelu.
- esbuild zmienionych plików — czysty; `tsc` bez błędów w tych plikach.
