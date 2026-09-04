# CODEX DAY 349 — CZERWIENIE UI I NIESTABILNOŚĆ BLOKU 3

## Wynik

UI: **ZROBIONE lokalnie** — 4/4 czerwienie sklasyfikowane jako `PRODUKT`, naprawione bez zmiany asercji, pakiet `62/62/0`, pełne nazwy bez zmian, dowody mutacyjne RED-GREEN.

Blok 3: **PARTIAL / NOT PROVEN** — objaw `18/12/6` odtworzony raz; wykonano wymagane 10 kolejnych przebiegów `18/18`, ale konkretnej przyczyny nie udowodniono i nie zacommitowano placebo.

## Wejście

Marker:

```text
MARKER OK
6a4919f72db338e7f49a2cacb3787d20cc649883
```

Tip uciekł o 14 commitów; zgodnie z instrukcją baza pozostała dokładnie na markerze. Worktree przy sanity był czysty. Dysk po materializacji: 8.4 GiB, porty 6396/5536 wolne, brak kontenera.

Przeczytałem R0: nie wyciszam testów; nie zmieniam asercji bez dowodu świadomej zmiany kontraktu; pojedynczy zielony przebieg nie dowodzi stabilności. Kontrole rozłączności i wyciszeń przed każdym commitem: `rozlacznosc OK`, `brak wyciszen OK`.

## R1–R2 — cztery czerwienie

Pełne cztery rozstrzygnięcia, komunikaty, asercje, produkt, wiek i rodzina: `evidence/day349/R1_ROZSTRZYGNIECIA.md`. Wynik: `4× PRODUKT`, `0× ASERCJA`; dwie czerwienie Relations mają jedną przyczynę.

Diff i mutacje: `evidence/day349/R2_NAPRAWA_UI.md`. Zmieniono tylko `FilterableTable.tsx`, `StandardPreview.tsx`, `TableWithPreviewLayout.tsx`. Przed `62/58/4`, po `62/62/0`; hash list nazw identyczny. `focus=0`, `list=0`, `artefakt=0`.

Testy UI były jednostkowe (`RUN_DB_TESTS=0 MOCK_DB=true`); jawne `--retry=0` wyłączyło maskowanie. Pułapki JWT/RealPG nie leżą na tej ścieżce.

## R3 — reprodukcja i hipotezy

Migracje RealPG: `894`, następnie `0`; oba przebiegi exit 0. Własna reprodukcja: `18/12/6`, czerwone day274, day275, 2×deck, 2×workbook. Surowy JSON 335 `18/11/7` dowodzi zielonego day275 w tamtym przebiegu; opisowe `18/12/6` oraz `12/18` dotyczą innego przebiegu/skrótu.

- H1 równoległość: **POTWIERDZONA jako warunek pierwszej reprodukcji** — osobno i sekwencyjnie 18/18.
- H2 pozostawiony stan: **OBALONA dla zmierzonego objawu** — unikalne ID i zielone uruchomienia na tej samej użytej bazie.
- H3 kolejność: **OBALONA** — alfabetyczna i odwrotna sekwencyjna 18/18.
- H4 zegar: **OBALONA** — brak użyć czasu/TZ w sześciu plikach.

Szczegóły i komendy: `evidence/day349/R3_REPRODUKCJA.md`.

Każdy pakiet DB biegł z pełnym env RealPG/JWT i `--retry=0`; `numTotalTests=18`. `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`, `DB_TYPE=postgres`, lokalny `DATABASE_URL` były w tej samej linii.

## R4–R5 — STOP merytoryczny

Kandydat „zimna równoległa inicjalizacja bram i pul” nie przeszedł dowodu mutacyjnego: po usunięciu advisory locka dziesięć kolejnych przebiegów pozostało `18/18`, `statusDrift=0`, także po restarcie kontenera. Dlatego nie ma uczciwego zdania „przyczyna leży w plik:linia” i nie ma dowiedzionej naprawy. Format STOP i 10 hashy: `evidence/day349/R4_R5_WERDYKT.md`.

Bezpiecznika R5 nie dodano, bo bez przyczyny byłby atrapą.

## `retry&#58; CI ? 3 &#58; 1` — ZNALEZISKO, KTÓREGO NIE NAPRAWIAM

Teza instrukcji jest nieaktualna na markerze: `vitest.config.ts:320` zawiera wyłącznie komentarz historyczny „Było”, a `vitest.config.ts:339` ustawia ponowienia na `0`. Szacunek testów przechodzących dziś dzięki ponowieniom: **0 według bieżącej konfiguracji**. Diff nienałożony: brak — rekomendowane ustawienie już obowiązuje. `server/vitest.config.ts` nie ustawia ponowień; każdy pomiar i tak miał jawne `--retry=0`.

## Z30 i Z30 deklaracja

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawierała wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Z30: nie wykonano żadnej realnej wysyłki, połączenia z Railway/demo/staging/produkcją ani działania poza lokalnym kontenerem.

## Korekty wobec instrukcji

- Tip gałęzi był 14 commitów przed markerem; praca poprawnie została na markerze.
- Instrukcja twierdzi, że ponowienia zależne od CI są aktywne; pomiar markera wykazał wartość `0`.
- `blok3-po.json` nie wyparował i hash zgadza się z cytowanym.
- Początkowe `18/12/6` odtworzono, ale nie udało się powtórzyć po pierwszym przebiegu mimo wielu prób; nie nazywam tego naprawionym.

## TWIERDZENIA NIEZWERYFIKOWANE

- Konkretna przyczyna pierwszego czerwonego przebiegu Bloku 3 pozostaje `NOT PROVEN`.
- Nie wykonano wariantu pełny drop/recreate + 894 migracje osobno przed każdym plikiem.
- Nie wykonano dowodu urządzeniowego ani produkcyjnego UI; zakres dowodu to jsdom i bramki kanonu.
- Nie wykonano pełnego korpusu repo ani CI.

## PYTANIA DO WŁAŚCICIELA

Nie mam pytania produktowego o cztery czerwienie — wszystkie broniły istniejącego kontraktu. Pytanie operacyjne do nadzorcy: czy wydać osobny dyżur telemetryczny dla pierwszego przebiegu Bloku 3 (z zapisem body/logu każdego 403/500 i próbą kontrolowanego obciążenia), zamiast scalać nieudowodniony lock?

## Commity i stan

- `5c04d4deb6` — R1.
- `58d391d65b` — R2.
- `494d0d5601` — R3.
- R4/R5/R6: dokumentacja końcowa w kolejnym commicie.

Gałąź: `codex/day349-czerwien-ui-20260904`, push wyłącznie `github-backup`. Kontener `cx-day349-pg` usunięty z `-v`; dysk przed/po 8.7 GiB.
