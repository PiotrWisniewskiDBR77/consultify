# CODEX DAY178 OCENA REPORT

Dyżur: 178 — ocena / sourceType
Data: 2026-08-30
Marker wejściowy: `d3d36cd5f5`
Gałąź: `codex/day178-ocena-20260830`
Worktree: `/private/tmp/cx-day178-ocena`
Zasoby: DB `6078`, runtime `5026-5027`

## Wynik

Zmieniono mapowanie listy inicjatyw z assessment tak, aby `sourceType` nadal oznaczał źródło rekordu (`assessment`), a framework assessment był wystawiany osobno jako `sourceFramework`.

Usunięto też fałszywy komunikat pustego katalogu metodyk oceny: statyczny pusty katalog nie jest teraz opisywany jako błąd ładowania.

Commity dyżuru:

- `44f4163a84` — `fix(assessment): preserve initiative source type`
- `696c73e9e5` — `test(assessment): render empty library state`

## Zmienione pliki

- `server/src/controllers/InitiativeController.ts`
- `src/components/assessment/library/AssessmentLibraryTab.tsx`
- `tests/integration/initiatives/day178.assessment-source-type.realdb.test.ts`
- `src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts`

Nie modyfikowałem `MODULE_ACCEPTANCE` ani plików licencji innych dyżurów.

## Odczyt i zakres

Instrukcja została odczytana z vaulta, z gałęzi `github-backup/codex/m03-admin-20260824`, przed pracą w worktree.

Marker:

```text
d3d36cd5f5 sciezka wyjscia K1-K6 (kotwica: plan 4-fazowy 24.08, Faza 2 -> 3) + odbior 170 zaktualizowany: SCALONO po FIX-170, mechanika A
```

Gałąź bazowa była 7 commitów przed markerem według instrukcji; pracowałem od wskazanego markera w osobnym worktree.

Proceduralna niespójność instrukcji: Z24 odwołuje się do `§0.4a`, ale odczytana instrukcja przechodziła z `§0.2d` do `§0.5`. Zastosowałem mierzenie rzeczywistego zakresu zamiast kopiowania liczby z nieistniejącego paragrafu.

## Pomiar konsumentów

Szeroki grep `sourceType/source_type/sourceFramework/source_framework` dał 2517 linii:

- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-source-consumers.txt`
- SHA256: `33f8e51eef3b159beaa47c709c52f726b7492350dded9fc03678e106745d3315`

Skupiony pomiar ścieżki endpointu inicjatyw dał 389 linii:

- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-initiative-endpoint-usage.txt`
- SHA256: `2dcfdf49ae8241e16ff492233fcd5da3ebc3193e9624403e812f3400e3ffc2df`

Rzeczywisty łańcuch:

`AssessmentHub` -> `Api.get('/initiatives?source=assessment')` -> `GET /api/initiatives` -> `InitiativeController.getInitiatives`.

Normalizer frontendu nie zmienia `sourceType`. Nie znalazłem konsumenta tej ścieżki, który intencjonalnie oczekuje `DRD` w `sourceType`; framework jest już osobnym polem `sourceFramework`.

## Baza i runtime

Użyto lokalnego kontenera `cx-day178-pg` na porcie `6078`, DB `cx178`.

Migracje:

- pierwsze uruchomienie: `Applying migrations: 869`
- drugie uruchomienie: `Applying migrations: 0`

Artefakty:

- `/private/tmp/cx-day178-ocena-artefakty/day178-migrate-1.log`, SHA256 `334aeb105ca43f04352a7ccee6511b877545e2724628bb75f32f1950863cd40d`
- `/private/tmp/cx-day178-ocena-artefakty/day178-migrate-2.log`, SHA256 `a8c9ebca9a83a5b4e822f923f6cfb20e5f4ce38cd271ca1a6e0446d9f9ab7fd9`

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Testy

R1 — real PG, ApiGateway, signed JWT, HTTP endpoint:

```bash
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6078/cx178 JWT_SECRET=cx178-test-secret-do-not-reuse-40chars-long npx vitest run tests/integration/initiatives/day178.assessment-source-type.realdb.test.ts --config server/vitest.config.ts --retry=0
```

Wynik: 2/2 pass.
Artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r1-green.json`, SHA256 `a435b88d00d481572832bf244b5efc6059f2b218d1d0b44ec523d3ceb90fe718`

R2 — render test pustego stanu biblioteki:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts --retry=0
```

Wynik: 1/1 pass.
Artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r2-green.json`, SHA256 `0b65de8fff02b69b86e4314a4c942a1602b5bc87cee7e3d13db519970f4e04f2`

Pełny frontend assessment:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/assessment/__tests__ --retry=0
```

Wynik: 12/12 pass.
Artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-assessment-full.json`, SHA256 `7f80adb94e2c5feeaec949d640a04f9545703e7e905c92f009a9634cffb8c8df`

Uwaga o konfiguracji: root vitest config wymuszał SQLite i dawał niepoprawną ścieżkę dla real-PG. R1 uruchomiłem z `--config server/vitest.config.ts`, aby faktycznie użyć Postgresa.

## Mutacje

R1 mutacja: przywrócenie starego mapowania `sourceType: i.source_framework || i.source_type` powoduje red:

- wynik: 1/2 pass, exit 1
- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r1-mutation-red.json`, SHA256 `2aad5b639448d124566fede7f5d16c368606c8b4cff3aee0e9eac519092a37bc`

R1 po restore:

- wynik: 2/2 pass
- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r1-restored-green.json`, SHA256 `2abeba1c68abf6f3a786c58a95a0663c6594b62a149f265d8a8710ebf921a64c`

R2 mutacja: powrót do fałszywej frazy `The methodology catalog could not be loaded.` powoduje red:

- wynik: 0/1 pass, exit 1
- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r2-mutation-red.json`, SHA256 `e4fa0e7710833d57f92a9ffbd7de9cc875523c93be2a7091473bab8f1c1c1ce3`

R2 po restore:

- wynik: 1/1 pass
- artefakt: `/private/tmp/cx-day178-ocena-artefakty/day178-r2-restored-green.json`, SHA256 `922f7de7a30fa8792735794008be1c346488c08c913a243ab89b8443a8b4f4ae`

Diff po restore do zielonych kopii był pusty.

## Twierdzenia niezweryfikowane

- Nie twierdzę, że owner checkout albo cały moduł acceptance jest zaakceptowany.
- Nie twierdzę, że ręcznie prześledziłem każdy z 2517 szerokich hitów; ręcznie prześledzona została licencjonowana ścieżka endpointu i jej konsumenci.
- Nie twierdzę, że wykonano browser screenshot dla 178; instrukcja 178 wymagała testów i raportu, nie screenshotu UI.
- Nie twierdzę, że poprawka rozwiązuje inne historyczne problemy assessment poza licencją tego dyżuru.

