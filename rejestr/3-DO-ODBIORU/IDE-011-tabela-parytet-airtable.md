---
id: IDE-011
tytul: Tabela — parytet Airtable (sort · filtr · grupowanie · wklejanie · resize · gęstość)
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Program IDEE — Fala 6-10 (gałąź integ-idee9-fala6)"
utworzone: 2026-07-23
ekran: idea-table-tool-grouping
wysokosc: 820
klik: "Kliknij nagłówek (sortowanie), wpisz coś w „Filtruj…”, użyj „Grupuj”, zwiń grupę, przełącz gęstość wierszy."
---

## 1. PROBLEM

Tabela miała silnik sortowania/filtrowania/grupowania w pełni gotowy, ale nigdy nie wystawiony w interfejsie — kod działał, użytkownik nie miał jak go uruchomić. Grupowanie dało się włączyć tylko po kolumnie „status” (zaszyte na sztywno).

## 2. ROZWIĄZANIE

Wystawione w UI: sortowanie klikiem w nagłówek (cykl rosnąco/malejąco/brak, puste zawsze na końcu), filtr per kolumna, grupowanie po **dowolnej** kolumnie ze zwijaniem i licznikiem, wklejanie Ctrl/Cmd+V z Excela (TSV), przeciąganie szerokości kolumn, przełącznik gęstości wierszy. Dodatkowo poprawny stan „Brak wyników dla filtra” zamiast mylącego „Dodaj pierwszy rekord”.

## 3. JAK ODEBRAĆ

Kliknij nagłówek (sortowanie), wpisz coś w „Filtruj…”, użyj „Grupuj”, zwiń grupę, przełącz gęstość wierszy.

Ekran jest podpięty na żywo w panelu — dane przykładowe, bez logowania i bez bazy. Oceniamy wygląd i zachowanie.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- esbuild zmienionych plików — czysty
- `check-artefakt.sh` / `check-list-canon.sh` / `check-triada.sh` — zielone
- render własny (harness Playwright, jasny i ciemny) — zrzuty wykonane przed pokazaniem właścicielowi (reguła #7)
