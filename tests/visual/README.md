# REJESTR V7-8 — wizualny smoke-suite regresji (dev-render)

Automatyczna wersja harnessu z CLAUDE.md #7: startuje `dev-render`, renderuje KAŻDY
ekran z `dev-render/main.tsx` (SCREENS) w light+dark, porównuje z baseline. Po każdej
fali Vegas uruchom to ZANIM Piotr zobaczy cokolwiek — łapie przypadkowy dryf koloru/układu.

## Jak używać po fali
1. `node tests/visual/run.mjs` — gate: robi zrzuty `current/` i porównuje z `baseline/`. EXIT=0 = czysto (current==baseline), EXIT=1 = regresja/nowy ekran/błąd renderu.
2. FAIL? Obejrzyj `tests/visual/__shots__/current/<ekran>--<motyw>.png` vs `baseline/…` (i `diff/…` gdy jest pixelmatch). Regresja niezamierzona → napraw. Zmiana zamierzona i zaakceptowana → przejdź do kroku 3.
3. `node tests/visual/run.mjs --update` — re-seed baseline z bieżącego stanu (po AKCEPCIE Piotra). Potem `git add -f tests/visual/__shots__/baseline && git commit`.
4. Nowy ekran w `dev-render/main.tsx` jest wykrywany automatycznie — pierwszy run pokaże go jako `new` (FAIL); `--update` go dodaje do baseline.
5. Flagi: `--only=a,b,c` (podzbiór ekranów), `--port=3231` (gdy 3230 zajęty), `--threshold=0.003` (luźniejszy próg).

## Bramki (co znaczy PASS/FAIL)
- PASS: wszystkie zrzuty `match` (diff poniżej progu 0.0015). EXIT=0.
- FAIL (EXIT=1): `diff` (regresja), `size-mismatch` (zmiana wymiarów = twardy FAIL), `new`/`missing-current`, `render-error`.

## Kalibracja progu (2026-07-19, komparator grid-hash fallback, GRID=24, zrzut 1440×900)
- identyczny re-render: diffRatio ≈ 0.0000
- artefakt klatki animacji canvasa (melscanvas-workspace): ≈ 0.0001
- celowa regresja koloru całego panelu (`bg-c-surface`→`bg-c-danger-solid` na ev-football-field): 0.0078 (light) / 0.0120 (dark)
- Próg domyślny **0.0015** ≈ 15× nad podłogą szumu, ≈ 5× pod najmniejszą testowaną realną regresją.
- Jeśli w `node_modules` pojawi się `pixelmatch`, komparator automatycznie go użyje (per-pixel diff + zapis diff-PNG); próg 0.0015 pozostaje bezpieczny (pixelmatch daje niższy szum niż grid-hash).

## Pliki
- `run.mjs` — runner (start dev-render → zrzuty → porównanie → raport `__shots__/report.json`).
- `lib/screens.mjs` — parser SCREENS z `dev-render/main.tsx` (bez osobnej listy do dryfu).
- `lib/devserver.mjs` — start/stop Vite (`dev-render/vite.config.ts`, retry na 504 cold-start).
- `lib/compare.mjs` — dwuwarstwowe porównanie: pixelmatch (jeśli jest) → fallback grid-hash+rozmiar.
- `__shots__/baseline/` — zaakceptowany stan (w gicie, `git add -f`). `current/`,`diff/` — efemeryczne (gitignore).
