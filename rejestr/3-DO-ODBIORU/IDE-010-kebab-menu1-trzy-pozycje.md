---
id: IDE-010
tytul: Kebab Menu 1 — Usuń · Duplikuj · Historia (3 pozycje ożywione)
typ: zadanie
waga: wysoka
obszar: IDE
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Program IDEE — Fala 6-10 (gałąź integ-idee9-fala6)"
utworzone: 2026-07-23
ekran: mindmap-canvas
wysokosc: 900
klik: "Otwórz kebab (⋯) w prawym górnym rogu. Trzy pozycje mają być żywe, czerwień tylko na „Usuń”."
---

## 1. PROBLEM

Wszystkie trzy pozycje kebaba były wyszarzone z dopiskiem „wkrótce” — użytkownik widział martwe menu.

## 2. ROZWIĄZANIE

**Usuń** wpięty w istniejący `Api.deleteMyIdea` (ten sam endpoint co lista pomysłów) z dialogiem potwierdzenia i powrotem do listy. **Duplikuj** — nowy endpoint `POST /my-ideas/:id/duplicate` klonujący pomysł wraz z mapą (test kontraktowy 5/5). **Historia** — panel wersji z przywracaniem, na wszystkich 4 narzędziach.

## 3. JAK ODEBRAĆ

Otwórz kebab (⋯) w prawym górnym rogu. Trzy pozycje mają być żywe, czerwień tylko na „Usuń”.

Ekran jest podpięty na żywo w panelu — dane przykładowe, bez logowania i bez bazy. Oceniamy wygląd i zachowanie.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- esbuild zmienionych plików — czysty
- `check-artefakt.sh` / `check-list-canon.sh` / `check-triada.sh` — zielone
- render własny (harness Playwright, jasny i ciemny) — zrzuty wykonane przed pokazaniem właścicielowi (reguła #7)
