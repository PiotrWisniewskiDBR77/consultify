# CODEX DAY 351 — licznik kompletności

## Wynik

`ZROBIONE_WG_DoD` dla R1–R4; R5 domyka raport. Jedna definicja odpowiedzi istnieje per drzewo, 9 miejsc sklasyfikowanych jako KOMPLETNOŚĆ jej używa, a każde z 9 ma osobną mutację RED (6 w R2, 3 w R3). Żywa trasa `/api/assessments` ma dowód ApiGateway → JWT → handler → realny PostgreSQL → HTTP/readback dla 7/39 i 39/39.

## Stan wejściowy

```text
MARKER OK
c0f690bae36a386de27f1a349fbb9674ec03c693
status --short: pusty
```

Tip był do przodu o 8 commitów; praca zaczęła się dokładnie z markera. Przed startem: 46 GiB wolne; po pracy: 20 GiB wolne. Porty 6410 i 5550 były puste, kontenerów `cx-day351` było 0.

## R1 — inwentarz

Pełna tabela, fragmenty, znaczenia, werdykty i osiągalność: `evidence/licznik-kompletnosci-20260904/R1-inwentarz.md`.

Własny pomiar: 12 trafień tekstowych w 8 plikach; 9 KOMPLETNOŚĆ, 3 INNE. ŻYWE: trzy gałęzie zamontowanej trasy oraz `DRDForm`. MINY: dwa wywołania frontowego adaptera (konsumenci `unreachable`) i `SIRIForm` (`unreachable`). Serwerowy adapter nie cofa naprawy 346, bo oba modele używają wyłącznie `viz.dimensions`.

## R2 — jedna definicja per drzewo

Definicje: `server/src/services/report/assessmentCompleteness.ts` i `src/services/assessmentCompleteness.ts`; modele raportu 346, oba adaptery oraz formularze SIRI/DRD wołają helper właściwego drzewa.

Wyniki per miejsce: serwer/front obszary 7/39 → 18%, 39/39 → 100%; serwer/front osie target-only → 0%, pełne → 100%; SIRI i DRD target-only nie zwiększają postępu, odpowiedź zwiększa. Pełny pakiet: 609/609 GREEN, 7 pełnych nazw dodanych względem 602, 0 znikniętych. Artefakt JSON: `/private/tmp/cx-day351-licznik-kompletnosci-artefakty/r2-front-final.json`, SHA-256 `d5b88ef74c18127b9584485ba7fef390cec55995766ec6a96efe6d3f75f0a9c4`.

Mutacje wykonywano poleceniem o kształcie:

```bash
cp PLIK SCRATCH/KOPIA
perl -0pi -e 's/WSPOLNY_HELPER/ALTERNATYWA_Z_TARGET/' PLIK
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/assessment/day351.assessmentCompleteness.test.ts --retry=0 -t 'PELNA NAZWA'
cp SCRATCH/KOPIA PLIK
diff -u SCRATCH/KOPIA PLIK
```

Dosłowne wyniki siedmiu mutacji: adapter serwer obszary RED `[100,100] != [18,100]`; adapter serwer osie RED `100 != 0`; adapter front obszary RED `[100,100] != [18,100]`; adapter front osie RED `100 != 0`; SIRIForm RED brak wspólnego wywołania; DRDForm RED brak wspólnego wywołania; parytet po zmianie tylko frontowego helpera RED — tablice wyników różne. Każdy exit 1, każde przywrócenie `diff` exit 0. Pełny zapis: `evidence/licznik-kompletnosci-20260904/R2-mutacje.md`.

## R3 — realny PostgreSQL i żywa trasa

Kontener `cx-day351-pg`, obraz `pgvector/pgvector:pg16`, `127.0.0.1:6410/cx351`. Pierwszy przebieg migracji: 894; drugi: 0; oba zakończone powodzeniem. Ziarno miało jawnie `completion_percent='0'`, więc nie zmierzono zwierającej kolumny. Identyfikatory DRD: `day351-drd-7-of-39` i `day351-drd-39-of-39`.

```bash
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6410/cx351 JWT_SECRET=... npx vitest run src/routes/__tests__/day351.assessment-progress.gateway.pg.test.ts --config vitest.config.ts --retry=0 --reporter=json
```

GREEN 1/1. DRD 7/39: `completedAxes > 0 && < 7`, `progress < 100`; DRD 39/39: 7/7, 100%. SIRI target-only: 0/8, pełne 8/8; ADMA target-only: 0/12, pełne 12/12. Mutacje osobno: DRD RED `7 !< 7`; SIRI RED target-only nie pasuje do `0/8`; ADMA RED target-only nie pasuje do `0/12`; każdy exit 1, po `cp` diff exit 0, końcowy GREEN. Artefakt: `/private/tmp/cx-day351-licznik-kompletnosci-artefakty/r3-final-green.json`, SHA-256 `ca555c997565e56e71ce092b554b49f2b02ad19c1073f733333e9af8d120908e`. Pełny ślad: `evidence/licznik-kompletnosci-20260904/R3-realpg.md`.

## R4 — mina

`DRDReportTemplate.tsx` i `ReportEditor.tsx` pozostały `unreachable`; baseline reachability exit 0. Kafel `Completion` i etykieta `Assessment completion` zostały. Po przyszłym podłączeniu pokażą 18% dla 7/39 zamiast 100%, bez zmiany osiągalności. Dowód: `evidence/licznik-kompletnosci-20260904/R4-mina.md`; JSON reach SHA-256 `4b722ab644c57a56f8cc7bc0d268d2c9e2a882b0be369ffb48cdb21e746638ae`.

## Korekty wobec instrukcji

| Teza instrukcji | Pomiar |
| --- | --- |
| 11 trafień wzorca | 12 trafień; sama lista autora także wymienia 12 pozycji |
| 7 miejsc KOMPLETNOŚĆ w 3 plikach | 9 miejsc w 5 plikach; dodatkowo `SIRIForm.tsx:143` i `DRDForm.tsx:107` |
| zbiorczy pakiet serwerowy z roota i `server/vitest.config.ts` | `No test files found`/0 testów; prawidłowy test trasy biegł z cwd `server/`, ścieżką `src/...` i `vitest.config.ts` |
| wolny dysk oczekiwany >5 GB | potwierdzone: 46 GiB przed, 20 GiB po |

## §0.2e — pułapki pakietów

Pakiet jednostkowy: (a)–(d) nie są dowodem trasy, bo `RUN_DB_TESTS=0 MOCK_DB=true`; (e)(1) wyłączony kontraktem parytetu, (e)(2) osobnym grepem, (e)(5) testem funkcji/kontraktem bez podłączania komponentów. Pakiet PG: (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) asercja `DB_TYPE=postgres`, jawny URL i cold readback; (d) `ENABLE_TEST_AUTH_BYPASS=false` plus podpisany JWT; (e)(3) kolumna 0, (e)(4) HTTP/PG zamiast tsc, (e)(1) helper serwera.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane. Kontener usunięto przez `docker rm -fv cx-day351-pg`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Zachowanie ekranu Oceny po włączeniu `isDrdReportEnabled`; flaga pozostała OFF.
- Zachowanie wizualne `DRDReportTemplate.tsx` po podłączeniu; komponentu nie podłączono.
- Czy `completion_percent` w bazie demo jest zerowe dla realnych ocen; bazy demo nie dotknięto.
- Produkcyjny runtime i urządzenia; nie uruchamiano ani nie wdrażano produkcji.
