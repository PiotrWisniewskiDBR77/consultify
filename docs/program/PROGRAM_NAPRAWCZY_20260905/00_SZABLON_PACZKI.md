# Szablon paczki programu naprawczego (obowiązkowy dla każdego pliku P*.md)

1. **Cel dla użytkownika** — jedno zdanie po polsku, co zmienia się na ekranie.
2. **Zakres** — lista ekranów/modułów (id z `evidence/audyt-award-20260905/*` i `docs/program/grafika/status.json`), liczba dotkniętych ekranów.
3. **Przyczyna źródłowa** — plik:linia (zweryfikowane `rg` na HEAD m03), dlaczego dziś jest źle.
4. **Projekt rozwiązania** — decyzja architektoniczna (jeden wzorzec, gdzie żyje), co się zmienia w komponentach wspólnych, co per moduł; zakazy (kanon: StandardTable/StandardModuleBar/StandardPreview/ArtifactRightPanel, tokeny `c-*`, zero `primary-*`, kebab pionowy, i18n pl+en).
5. **Kroki wykonania** — ponumerowane, każdy z plikami i szacunkiem (S/M/L), kolejność wymuszona zależnościami; które kroki dotykają modułów ZAMROŻONYCH (`docs/program/MVP_FINAL_ZAMROZONE.json`) i wymagają markera `[ODMROZENIE <MODUL> DEC-<nr>]` w commicie.
6. **Testy** — jednostkowe (co asertują, dowód mutacyjny), wizualne (jakie zrzuty, jaki viewport 1280/1440/1920, jasny+ciemny), przepływ klikany (skrypt Playwright: kroki).
7. **Kryterium odbioru właściciela** — co zobaczy na 3000, jednym zdaniem, bez pytań.
8. **Ryzyka i cofanie** — co może pęknąć, jak wrócić (tag, revert).
9. **Nakład** — osobodni Opus/Sonnet, co można zrównoleglić.

10. **Cel osiągnięty = samokontrola Codexa (praca do celu)** — obowiązkowe, mechaniczne, bez oceny „na oko”:
    - lista komend do uruchomienia po zmianie (esbuild per plik, `npx vitest run <pliki>`, `bash scripts/check-list-canon.sh`, `bash scripts/check-artefakt.sh`, `cd server && tsc --build tsconfig.build.json` jeśli serwer) z OCZEKIWANYM wynikiem (exit 0, N/N testów, „dług nie rośnie”);
    - pomiar na żywo: własny vite na wolnym porcie (`cp /private/tmp/m03/.env.local .`), `node scripts/dev/odbior-zywo/zrzut.mjs --url=… --port=… --host=127.0.0.1 --dom=<selektor>` — jakie zrzuty, jakie liczby w `.json` (np. `aside` = 1, `przepelnieniaPoziome` = 0, zero wpisów ≥400, zero błędów konsoli);
    - progi liczbowe (np. „0 nagłówków z `scrollWidth > clientWidth` na 5 tabelach przy 1440 px”, „0 tokenów ze stop-listy EN w tekstach 16 modułów”);
    - porównanie z obrazem odniesienia (ścieżka „złotego” zrzutu) — co ma być identyczne;
    - **warunek STOP**: gdy wszystkie progi spełnione → commit + raport; gdy próg niespełnialny bez decyzji właściciela → zatrzymać się i opisać (nie obchodzić);
    - zakazy: `--no-verify`, `git stash`, edycja plików modułów zamrożonych bez markera `[ODMROZENIE <MODUL> DEC-<nr>]`, tworzenie flag.
11. **Wklejka dla Codexa** — gotowy blok instrukcji (Markdown, jeden blok kodu do skopiowania) zawierający §1, §4, §5, §6, §10 tej paczki + ścieżkę katalogu roboczego (worktree z `origin/staging`) i zasadę commit-per-krok bez push.
