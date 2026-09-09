# PRZEKAZANIE — 09.09.2026, koniec dnia (jedyny punkt wejścia)

Ten plik zastępuje `PRZEKAZANIE_20260909_POPOLUDNIE.md`. Przeczytaj go w całości, zanim cokolwiek zrobisz.
Zasada dnia: **PASS tylko po pomiarze; „nie sprawdziłem" to N/A z powodem, nie PASS.**

## 0. Stan na teraz (zmierzony 09.09 ~22:00)

| | staging (thomas) | demo (trolley) |
|---|---|---|
| kod (health `gitSha`) | `f24e4065d7` | `f24e4065d7` |
| gałąź integracyjna | `mvp/inicjatywy-lancuch-20260907` = `f24e4065d7` (wypchnięta na `staging`) | — |
| organizacje | 4 docelowe + 4 konta testerów z 09.09 | 4 docelowe |
| konfiguracja produktu | 319 wierszy, komplet | 319 wierszy, komplet |
| dane Northwind | pełne po dosiewie D9 | pełne po dosiewie D9 |

Nic nie biegnie w tle: zero procesów robotników, zero zajętych portów, zero baz roboczych,
jeden worktree (`~/Developer/wt/fable-inicjatywy`). Produkcja (centerbeam) nietknięta przez cały dzień.

## 1. Gdzie co jest

- Worktree integracyjny: `~/Developer/wt/fable-inicjatywy` (`node_modules` = symlink do `~/Developer/Consultify/node_modules`).
- Sekrety poza repo: `~/Developer/consultify-secrets/` — `server.env`, `railway-staging.json`,
  `northwind-konta-STAGING.txt` (**hasło zrotowane 09.09 18:23**, stare nie działa), `ops/demo-kopia-stagingu.sh`.
- Zrzuty i manifesty: `~/Developer/consultify-dumps/` oraz `.../manifesty/` (każda operacja na danych ma punkt cofnięcia).
- Rejestr prac: `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (wiersze FALA, DANE, TEST, DEMO, INCYDENT).
- Raporty dnia: `docs/program/TEST_JEZYK_I_DANE_20260909/` — `KRYTERIA.md`, `RAPORT.md` (zbiorczy),
  `RAPORT_JEZYK.md`, `RAPORT_DANE.md`, `RAPORT_KONTROLA.md`.
- Karta dla właściciela na jutro: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/KARTA_20260910_PACZKA_2.md`.

## 2. Jak się wdraża (dwie komendy, nie zgaduj)

Staging: `git push origin HEAD:staging` (musi być fast-forward), potem
`gh workflow run railway-deploy.yml --ref staging -f environment=staging`, na końcu odczyt `/api/health`.

Demo: `gh workflow run railway-deploy.yml --ref staging -f environment=demo -f confirm_demo=yes`.
Job promuje commit z tagu `staging-deployed`, który pisze job stagingu. **Push na gałąź `demo` nic nie wdraża**,
a domyślne środowisko w workflow to produkcja — zawsze podawaj `-f environment=`.

## 3. Jak się scala paczkę robotnika (sprawdzone ~25 razy dziś)

`git merge --no-ff --no-commit <gałąź>` → konflikty wyłącznie w `baseline.json` i `translation.json` →
helper `scratchpad/scal-json.py` (baseline: minimum per klucz; słowniki: scalanie trójstronne, pomija klucze
skasowane po naszej stronie) → `git commit -m "probe"` wypisuje wymagane znaczniki odmrożenia →
commit właściwy z `[ODMROZENIE <MODUL> DEC-453]` → sprawdzenie, że scalenie nie zmieniło plików gałęzi
(`git diff --stat HEAD^2 HEAD -- $(git diff --name-only $(git merge-base HEAD^1 HEAD^2) HEAD^2)` ma pokazać
tylko pliki JSON) → bezpieczniki `jezyk*.source.test.ts` → bramka → push → wiersz rejestru → `git worktree remove`.
Nie kasuj gałęzi przed commitem scalającym.

Bramka czterokrokowa: `node_modules/.bin/tsc -p server/tsconfig.json --noEmit` = 0;
`NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc -p tsconfig.json --noEmit` ≤ **192**;
`node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json` bez wzrostu;
`NODE_OPTIONS=--max-old-space-size=6144 node_modules/.bin/vite build`.

## 4. Pułapki stanowiska (każda kosztowała dziś czas)

1. `server.env` ma `DB_HOST` i resztę `DB_*` wskazujące na Railway — API kończy się po cichu.
   Uruchamiając lokalnie: `unset DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT DB_SSL DB_SSLMODE DISABLE_RATE_LIMIT NODE_ENV`.
2. Ten sam plik ma `NODE_ENV=development` — build po `source` fałszywie potwierdza defekty widoczne tylko w trybie deweloperskim.
3. Bez `ENABLE_V8_GLOBAL=true` część tras oddaje 404 przed autoryzacją (robotnik wziął to za 22 defekty produktu).
4. Hasło czytaj z linii „Wspólne hasło…", nie z linii „Rotacja hasła" (ta niesie datę).
5. Kopie baz robocze twórz z szablonu `consultify_staging_czysta` (zrzut stagingu po czystce) i kasuj po pracy.
6. Połączenie do baz zdalnych przez proxy Railway zrywa się przy długich skanach — pula ma `keepAlive`, ale i tak powtarzaj operację przy `EADDRNOTAVAIL`/`ETIMEDOUT`.
7. Polskie cudzysłowy i apostrofy rozwalają literały Pythona w heredoc — pisz skrypt do pliku.

## 5. Lekcja dnia, która musi przetrwać

Czystka sierot skasowała 319 wierszy konfiguracji produktu, bo one z definicji nie należą do żadnej organizacji
(`*`, `__system__`, `__global__`, pusty ciąg). Skutek: nie dało się utworzyć żadnej inicjatywy, a serwer oddawał
500 bez śladu w logu. Weryfikacja po czystce była zielona, bo liczyła zera.
**Po każdej operacji na danych przejdź jeden pełny przepływ zapisu, nie tylko policz rekordy.**
Zabezpieczenie: `predykatSieroty` wyklucza wartości wzorcowe, test `server/tests/dane-sieroty/wzorcowe.test.ts`,
przywracanie punktowe `scripts/dane/przywroc-wzorcowe.mjs <manifest> --apply`.


## 5b. Dwa defekty znalezione PO moim raporcie kontrolnym (naprawione 09.09 22:40)

Robotnik kontrolny, którego omyłkowo uznałem za martwego, dokończył pomiar i znalazł to, czego mój
szybszy pomiar nie objął. Oba naprawione i wdrożone.

1. **Pętla autozapisu inicjatywy (blokujący).** Ekran-artefakt zapisuje sam `summary`/`description` co 1,5 s.
   Schemat edycji dziedziczył `status … .default('DRAFT')`, a `validateBody` podmienia `req.body` na obiekt
   PO parsowaniu — do kontrolera trafiał status, którego przeglądarka nie wysłała. Bramka M13 odrzucała to
   jako przejście statusu: **400 dla 12 z 13 inicjatyw i stała plakietka „Unsaved"**. Naprawa: `status`
   w `UpdateInitiativeSchema` jest opcjonalny BEZ wartości domyślnej (`server/src/validators/initiative.validators.ts`),
   bezpiecznik `server/tests/initiatives/updateStatusDefault.test.ts` (4/4).
2. **Surowy zapis techniczny w skrzynce Mojej Pracy.** Opisy zadań niosły JSON zamiast zdania — to były DANE,
   nie kod. Poprawione na stagingu (99 wierszy) i demo (98). Producent, który wpisuje JSON do pola opisu,
   zostaje do paczki 2.

**Moja pomyłka do zapamiętania:** uznałem żywego robotnika za martwego po 13 minutach ciszy i skasowałem mu
worktree wraz z bazą. Jego commit etapu leżał w repo od kwadransa, a „urwany" zrzut 59 MB był licznikiem
w połowie kopiowania (skończył na 236 MB). Żywotność mierz commitami etapów, `mtime` plików i obecnością
procesu — nie zegarkiem. Cudzego stanowiska nie kasuj nigdy; załóż własne obok.

Nierozstrzygnięte z jego raportu (paczka 2): brak przycisków edycji i usuwania w menu kontekstowych
Realizacji i Mojej Pracy (na API cykl przechodzi — brakuje przewodu w UI); kreator materiałów nie otworzył się
w jednym przebiegu; kolumna SOURCE wypełniona w 2 z 7 wierszy mimo deklaracji 7/7; nowa inicjatywa żyje
w `runtime-v1`, nie ma jej w `GET /api/initiatives` ani w tabeli `initiatives`.

## 6. Kolejka na jutro (paczka 2), wg wartości

1. **Przejście właściciela po stagingu, bez asysty.** Jedyna pozycja niewykonalna beze mnie i bez niego.
2. **Trzy decyzje wizualne** (zrzuty wysłane): menu przy tworzeniu inicjatywy, kolor plakietki „Attention Required", zapis „IX 2026".
3. **Klony sesji demo**: każde użycie tworzy organizację, sprzątacz `demoService.cleanupExpiredDemos`
   chodzi raz na dobę o 2:30 przez `TrialCron` (doba życia). Skrócić czas życia, sprzątać częściej albo wyłączyć sesje demo na stagingu.
4. **Wskaźnik zwrotu w kokpicie Realizacji** czyta zastaną `roi_assumptions` (pustą) zamiast kanonicznej `rvn_roi_cases`;
   przepięcie przechodzi przez niedomkniętą bramkę `resolveRoiGovernedVisibility`.
5. **Dług językowy**: daty i liczby w panelu administratora (174 miejsca) i na serwerze (87), zdania budowane
   po stronie serwera, maile i PDF, wersja polska (Ustawienia około 330 napisów, panel administratora 543).
6. **Znane braki produktu**: Spotkania to zaślepka, Finanse bez pozycji w menu głównym, Partnerzy dla właściciela
   pokazują tylko ekran połączenia.

## 7. Czego nie wolno

Produkcja (centerbeam) bez jawnej zgody właściciela — nigdy. Kasowanie bez zrzutu i manifestu.
`git push --force` na `staging` i `demo`. `--no-verify`. Bare `git stash` (stos jest wspólny).
`pkill`/`killall` (zabijaj wyłącznie własne numery procesów). Wypisywanie haseł w logach, meldunkach i repo.
