---
id: IDE-014
tytul: NAPRAWA — lewy pasek narzędzi zasłaniał paski menu
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
klik: "Popatrz na górne paski: „← Idee › …” i „+ Dodaj węzeł” mają być w całości widoczne, nie ucięte od lewej."
---

## 1. PROBLEM

Pływający pasek narzędzi ucinał pierwsze litery pasków menu — „Idee” renderowało się jako „ldee”, „Dodaj węzeł” jako „odaj węzeł”. Pasek centrował się względem **okna przeglądarki**, nie obszaru płótna, i przy 686 px wysokości wylewał się w górę na menu. Defekt był żywy na demo — odsłonięty w momencie przestawienia flagi `ff_melsCanvas` na domyślnie włączoną.

## 2. ROZWIĄZANIE

Pasek mierzy teraz pas płótna (`[data-testid="mels-canvas"]`) i kotwiczy się do jego górnej krawędzi; nadmiar wysokości się przewija zamiast wylewać na menu. Wzorzec 1:1 z istniejącym mechanizmem dla osi poziomej (ta pilnowała już, żeby pasek nie wchodził na sidebar — brakowało odpowiednika dla pionu). Zweryfikowane pomiarem: pasek 270–828 wewnątrz płótna 258–840, mapa i tablica, jasny i ciemny.

## 3. JAK ODEBRAĆ

Popatrz na górne paski: „← Idee › …” i „+ Dodaj węzeł” mają być w całości widoczne, nie ucięte od lewej.

Ekran jest podpięty na żywo w panelu — dane przykładowe, bez logowania i bez bazy. Oceniamy wygląd i zachowanie.

## 4. WERYFIKACJA WYKONANA PRZED ODDANIEM

- esbuild zmienionych plików — czysty
- `check-artefakt.sh` / `check-list-canon.sh` / `check-triada.sh` — zielone
- render własny (harness Playwright, jasny i ciemny) — zrzuty wykonane przed pokazaniem właścicielowi (reguła #7)
