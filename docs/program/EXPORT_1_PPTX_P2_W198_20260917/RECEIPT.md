# PPTX P2 v2 — RECEIPT W198

Data: 2026-09-17
Tor: B / Codex-2
Baza: `1b662df8cd2cac255f008d40a6dd13d3718d879d`
Zakres: W166 + P1 z W178, kolejka W198

## Wynik

READY FOR CTO REVIEW. Slajd tabelaryczny zachowuje heading, headline, natywną
edytowalną tabelę i pas `SO WHAT`; karta `decision|recommend` zachowuje kicker.
Pozostałe mechaniki P2 obejmują ograniczone nagłówki ostrzeżeń, poprawne CORS,
rozdzielone etykiety PPTX, alias flagi serwerowej oraz fail-closed realnego
renderera. Ósmy punkt W166 (`artifactStudioMode`) pozostaje poza mechanicznym
zakresem bez ekranów zgodnie z wcześniejszym rozgraniczeniem.

## Dowody

- `npm ci --ignore-scripts`: PASS; `npm ls @types/node --depth=0` = `22.19.3`.
- Focused Vitest: 5 plików / 35 PASS; opcjonalny plik RealPG pominięty bez
  `RUN_DB_TESTS=1` i nie jest liczony do wyniku.
- Po mutacji usuwającej pas `SO WHAT`: 1/1 RED, RC=1; po przywróceniu 1/1 PASS.
- Serwer `tsc --build server/tsconfig.build.json --pretty false`: RC=0.
- Front, identyczna komenda i te same zależności: linia 152, kandydat 152;
  logi są byte-identical (`sha256 71400c072420...`), delta własnych plików 0.
- Scoped ESLint: 0 błędów; `git diff --check`: PASS.
- LibreOffice otworzył i wyrenderował bieżący PPTX; slajd 2 pokazuje pełną
  narrację, tabelę i `SO WHAT` bez kolizji. PPTX sha256:
  `04b0dd54aa3f49d8566dcfa0fa16c939d8ccd952fe8039fe549f82464a9b651d`.
- A/B sprzed poprawki: `~/Developer/cto-codex/odbior-pptx-p2-20260917/zrzuty/`;
  bieżący GREEN: `dowody/rendered/risk-management-slide2.png`.

## Granice

Nie zmieniono ekranowego warunku `artifactStudioMode`, zmiennych środowiska,
deployu ani plików toru A. Znalezisk poza zakresem nie naprawiano.
