---
id: IDE-013
tytul: Process Flow — strzałki kierunku domyślnie widoczne
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Program IDEE — Fala 6-10 (gałąź integ-idee9-fala6)"
utworzone: 2026-07-23
ekran: processflow-canvas
wysokosc: 860
klik: "Popatrz na krawędzie — mają mieć strzałkę pokazującą kierunek przepływu. Kliknij dwukrotnie etykietę, żeby ją edytować."
---

## 1. PROBLEM

Krawędzie miały gotowy mechanizm strzałek, ale domyślnie ustawiony na „brak” — kierunek przepływu był niewidoczny, dopóki użytkownik nie ustawił strzałki ręcznie na każdej krawędzi osobno.

## 2. ROZWIĄZANIE

Domyślna wartość zmieniona na „strzałka na końcu”, z zachowaniem zgodności wstecz (stare zapisy bez tego pola też dostają strzałkę). Jawne wyłączenie przez użytkownika nadal respektowane. Trasa smoothstep i edytowalne etykiety już istniały.

## 3. JAK ODEBRAĆ

Popatrz na krawędzie — mają mieć strzałkę pokazującą kierunek przepływu. Kliknij dwukrotnie etykietę, żeby ją edytować.

Ekran jest podpięty na żywo w panelu — dane przykładowe, bez logowania i bez bazy. Oceniamy wygląd i zachowanie.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- esbuild zmienionych plików — czysty
- `check-artefakt.sh` / `check-list-canon.sh` / `check-triada.sh` — zielone
- render własny (harness Playwright, jasny i ciemny) — zrzuty wykonane przed pokazaniem właścicielowi (reguła #7)
