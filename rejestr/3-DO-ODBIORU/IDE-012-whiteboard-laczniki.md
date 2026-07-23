---
id: IDE-012
tytul: Whiteboard — łączniki między elementami (4-stronne uchwyty magnetyczne)
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Program IDEE — Fala 6-10 (gałąź integ-idee9-fala6)"
utworzone: 2026-07-23
ekran: whiteboard-canvas
wysokosc: 860
klik: "Najedź na karteczkę lub kształt — mają pojawić się uchwyty z czterech stron. Przeciągnij z uchwytu na uchwyt."
---

## 1. PROBLEM

Elementy tablicy stały luzem — dało się je łączyć wyłącznie pionowo (góra→dół), bo węzły miały tylko 2 uchwyty. Osobno: zaznaczenie samej krawędzi i Delete nie robiło nic.

## 2. ROZWIĄZANIE

Każdy typ węzła (karteczka, kształt, tekst, obraz, link) ma po 8 uchwytów — źródło i cel z czterech stron, pojawiają się przy najechaniu. Dodany `connectionRadius` (magnetyczne domykanie). Naprawiony błąd usuwania samej krawędzi. Stare krawędzie renderują się bez zmian.

## 3. JAK ODEBRAĆ

Najedź na karteczkę lub kształt — mają pojawić się uchwyty z czterech stron. Przeciągnij z uchwytu na uchwyt.

Ekran jest podpięty na żywo w panelu — dane przykładowe, bez logowania i bez bazy. Oceniamy wygląd i zachowanie.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- esbuild zmienionych plików — czysty
- `check-artefakt.sh` / `check-list-canon.sh` / `check-triada.sh` — zielone
- render własny (harness Playwright, jasny i ciemny) — zrzuty wykonane przed pokazaniem właścicielowi (reguła #7)
