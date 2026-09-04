# Raport dyżuru 335 — G19 regresja

Stan: **CZĘŚCIOWE / OWNER_RETEST_PENDING**. Rdzeń R1–R6 wykonany, lecz bramka G19 nie jest zamknięta. Żaden wiersz nie dostał `PASS` ani `TECHNICAL_REGRESSION_PASS`.

## R0 — zasada i baza

Przeczytałem zasadę R0: wiersz macierzy zmienia stan wyłącznie z dowodem w tym samym commicie. W tym dyżurze nie zmieniono żadnego `MODULE_ACCEPTANCE.md`.

Dosłowny wynik markera:

```text
MARKER OK
```

Dosłowny wynik sanity:

```text
1c4b5a5635bafd38ef375227824ada9b62be186e
```

`git status --short | head -3` nie zwrócił wiersza. Worktree: `/private/tmp/cx-day335-g19-regresja`, gałąź `codex/day335-g19-regresja-20260904`, vault i tylko remote `github-backup`. Tip źródłowy był 7 commitów dalej; log i lista są w artefaktach `tip-log.txt` i `tip-files.txt`.

## Stan 16 wierszy PRZED i PO

Każdy z modułów 01–16: PRZED `NOT_PROVEN / OWNER_RETEST_PENDING`; PO `NOT_PROVEN / OWNER_RETEST_PENDING`. Gotowy tekst dla wszystkich 16 brzmi: **pozostawić bieżący status; dowód historyczny nie zachowuje ważności wobec 104 plików dryfu, kubełek maszynowy ma dowody częściowe, a przelot właściciela na realnym rekordzie pozostaje wymagany.** Nie proponuję mocniejszego stanu.

## R1 — dryf

- `fee24bddb0` jest przodkiem HEAD;
- 543 commity;
- 104 pliki razem;
- 89 bez testów;
- 10 UI (`shared=7`, `ui=2`, `index.css=1`);
- 77 serwerowych bez testów;
- 2 słowniki; middleware 2 pliki, routes 90 plików łącznie z testami.

Pełna lista kategorii i każda nazwa: `evidence/g19/day335-dryf.md`. Werdykt: dowód na `fee24bddb0` **nie zachowuje ważności** wobec HEAD. Inwentarz dostał dopisek obok, bez nadpisania G19-Z3; generatora tego pliku w `scripts/` nie znaleziono.

## R2 — trzy mianowniki i kubełki

Bieżące zbiory: 141 (`316bce9dd9`, moduły 01/08), 125 (`08775ced65`, moduły 02/03/04/05/07/12/13/14/15), 123 (cztery późne SHA, moduły 06/09/10/11/16). Cztery listy 123 są identyczne; `comm -23` potwierdził, że są podzbiorem 141. Historyczne 49/30/28 nie są aktualne.

Kubełki: A=7 (01,04,05,06,08,11,13), B=0, C=9 (02,03,07,09,10,12,14,15,16). Uzasadnienie każdego wiersza: `evidence/g19/day335-kubelki.md`.

## R3 — wykonanie maszynowe

Blok 1: 131 wykonanych, 127 PASS, 4 FAIL. Blok 2: 218/218. Blok 3 PRZED: 18 wykonanych, 12 PASS, 6 FAIL; po korekcie payloadu i czystym ponowieniu: 18/18. Pierwsza próba Bloku 3 z niewłaściwego cwd wykonała 0 i została odrzucona jako błąd komendy.

Day307 zamyka jedną granicę D-a2: `GET /api/pmo/tasks/workload/:userId`, obcy 404 `TASK_WORKLOAD_USER_NOT_FOUND`, właściciel 200 z tym samym `userId`, `total=1`, projektem `day307-project-owner`. Mutacja filtra `organization_id`: obcy 200 i pełna nazwa testu czerwieni się `expected 200 to be 404`; przywrócenie przez `cp`: GREEN; diff produktu pusty. Pełne komendy, sumy i §0.2e: `evidence/g19/day335-r3-maszynowy.md`.

## R4 — czerwienie i dług

`ReplaceDecisionEnhancementsSchema` leży w `server/src/validators/decision.validators.ts:210-220`; `escalation` jest nullable, lecz wymagane. Payload day277 dostał `escalation: null`: 2/2 GREEN. Usunięcie pola: 0/2 z błędem walidatora `expected record, received undefined`; przywrócono przez `cp`. Schemat i asercje nietknięte.

Cztery czerwienie UI są `ZASTANA_WZGLĘDEM_DYŻURU_335`; trzy pliki testowe kompilują się przez esbuild. Jest to wąska klasyfikacja, nie twierdzenie o wieku wobec G18. Pełne nazwy są w `evidence/g19/day335-r4-czerwienie.md`.

Cztery inne czerwienie pierwszego Bloku 3 (274/275/276) nie odtworzyły się w czystym pełnym ponowieniu bez zmian ich kodu: 18/18. Nie zostały nazwane naprawionymi; pozostają sygnałem niestabilności stanu/kolejności.

Imienny otwarty dług: `evidence/g19/day335-dlug.md` oraz pełna lista 104 nazw w `day335-dryf.md`.

## R5 — pakiet właścicielski

`evidence/g19/day335-pakiet-przelotu.md` zawiera 16 modułów, realny rekord do rozpoznania, kroki, PL/EN, light/dark, wspólne komponenty, sygnał porażki TAK/NIE i granicę. Bez realnego rekordu i dokładnego SHA runtime wynik nie liczy się.

## Pomiar nazw testów (§0.4a)

`diff` pełnych nazw PRZED/PO jest pusty dla Bloku 1, Bloku 2 i Bloku 3. Nic nie dodano ani nie zniknęło. Pliki: `/private/tmp/cx-day335-g19-regresja-artefakty/{blok1,blok2,blok3}-{przed,po}-nazwy.txt`.

## §0.2e per pakiet

- Blok 1: `RUN_DB_TESTS=0 MOCK_DB=true`; dowód wyłącznie UI, nie PG. 131 wykonanych, więc nie zaszła pułapka zero-testów.
- Blok 2: jednostkowy middleware, bez twierdzenia o zapisie. 218 wykonanych.
- Blok 3/day277/day307: pełny env RealPG w tej samej linii, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, podpisany JWT, `--retry=0`, rzeczywisty ApiGateway; właścicielski readback wyklucza symetryczne 404/404.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Warunki wspólne PO

- słowniki: PL 35198, EN 33065 — bez spadku;
- `focus-canon=0`, `list-canon=0`, `artefakt=0`;
- Blok 1 127/131, Blok 2 218/218, Blok 3 18/18;
- diff nazw testów pusty.

## Commity i R0

- R1 `90939ed090` — inwentarz + `day335-dryf.md`;
- R2 `9cdfe74d21` — `day335-kubelki.md`;
- R3 `484247ce2b` — `day335-r3-maszynowy.md`;
- R4 `10b6b2baad` — test day277 + dwa pliki dowodowe;
- R5 `857ceacad1` — pakiet właścicielski.

Żaden commit nie dotknął macierzy modułów, więc nie istnieje commit wymagający pary `MODULE_ACCEPTANCE.md` + evidence. `git show --stat` powyższych commitów potwierdza opisane pary.

## Korekty wobec instrukcji

1. 543 commity zamiast 544.
2. Bieżące mianowniki 141/125/123 zamiast historycznych 49/30/28.
3. `server/src/schemas/` nie istnieje; schema leży w `server/src/validators/decision.validators.ts`.
4. Blok 2 ma 218, nie historyczne 225 przypadków.
5. Pierwszy ważny Blok 3 miał 6, nie 2 czerwienie; cztery dodatkowe nie odtworzyły się na czystym ponowieniu.
6. Seeder 307 jest fail-closed na 6314/cx307; wykorzystano kopię poza repo z guardem 6371/cx335, bez zmiany źródła.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano stagingu, produkcji ani żadnego zdalnego środowiska (zakaz Z28).
- Nie wykonano właścicielskiego przelotu 16 modułów na realnych rekordach.
- Nie udowodniono pokrycia każdego z 104 plików przez konkretny test lub kadr.
- Nie odtworzono pełnych 1904 par tras day307; zmierzono celowaną parę workload.
- Nie rozstrzygnięto przyczyny niestabilnych pierwszych czerwieni 274/275/276.
- Klasyfikacja czterech czerwieni UI nie dowodzi ich wieku względem kotwic G18.

## Werdykt końcowy

G19 pozostaje `NOT_PROVEN / OWNER_RETEST_PENDING` we wszystkich 16 modułach. Wartością dyżuru jest aktualizacja mianownika, wykonana para izolacyjna z mutacją, naprawiony kontrakt testowy day277, imienny dług i wykonalny pakiet właścicielski — nie sztuczna zieleń.
