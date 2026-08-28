# DYŻUR 67 — TEST DEBT P2 — RAPORT

## Status

`PARTIAL`. Naprawiono i udowodniono trzy niezależne przyczyny w pięciu plikach P2. Końcowy izolowany mianownik: 49 istniejących, unikalnych plików; 8 zielonych i 41 czerwonych. Nie ma podstaw do wpisania `FIXED` dla całego P2.

## Rodowód i korekta instrukcji

- marker i baza: `6868d57ebcb346e7d4bf142eb89229bc6bcd3e98`;
- tip wydanej instrukcji: `654ae1daf966e0fbc597faf103dd563b038d9eaa`;
- gałąź: `codex/day67-test-debt-p2-20260828`;
- vault/remote: `consultify-recovery-vault-20260820.git` / wyłącznie `github-backup`;
- instrukcja zawiera sprzeczne wpisy `p6` w §1, §2 i §6 oraz `p2` w nazwie, raporcie i bloku PG. Zastosowano jawnie wydaną przez nadzorcę tożsamość P2. To korekta autora instrukcji, nie rozszerzenie licencji.

`git merge-base --is-ancestor 6868d57... github-backup/codex/m03-admin-20260824` → exit 0. Tip bazy był równy markerowi. Przed pracą `git status --short` był pusty. Wolne miejsce: 66.5 GB.

## Ponowny mianownik P2

Parser zakresu między nagłówkami P2/P3 w `TEST_DEBT_DAY59_MAPA.md`, następnie `sort -u`, kontrola `-f` i dopisanie obowiązkowego pinu Harvard:

| liczba | znaczenie | wynik |
| ---: | --- | --- |
| 48 | ścieżki z listy P2 | 48 unikalnych, 0 brakujących |
| 49 | kontrakt po dodaniu `harvardCrossModuleFlows.test.ts` | 49 unikalnych, 0 brakujących |
| 8 | zielone pliki w końcowym rerunie izolowanym | exit 0 |
| 41 | czerwone pliki w końcowym rerunie izolowanym | exit 1 |
| 162 | unikalne nazwane czerwone rekordy (`FAIL`) | wynik parsera logów per plik |

Każdy plik uruchomiono osobnym procesem z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5939/cx_day67_testdebt JWT_SECRET=test-debt-day67-local-only` i `--retry=0`. Zbiorczy równoległy przebieg odrzucono jako diagnozę, ponieważ suite'y wzajemnie usuwały fixture z jednej bazy.

Zielone końcowo: `harvardCrossModuleFlows`, `aiSettingsService`, `rateLimiting.middleware`, `taskService`, `userService`, `utils/queryHelpers`, `v4-smoke/r1-context-pack`, `whatsappService`.

## Przyczyny i dowody mutacyjne

| pozycja / przyczyna | cofnięcie | przywrócenie | wynik |
| --- | --- | --- | --- |
| P2-MOCK-CONTRACT — niepełny mock `Logger` | 17/17 czerwonych, `default.info is not a function` | 17/17 zielonych | ZROBIONE |
| P2-MOCK-CONTRACT — brak `getCurrentPgTransactionClient` | 1/4 czerwony, `No getCurrentPgTransactionClient export` | 4/4 zielone | ZROBIONE |
| P2-PG-NORMALIZATION — SQLite-shape kontra realny PG | 4 czerwone: `expected null to be undefined`, `expected '2' to be 2` | 23/23 zielone | ZROBIONE |
| P2-RATE-LIMIT-CLOCK — globalny zegar psuty przed importem | 1 czerwony, `clock failure` z `moment/file-stream-rotator` | 36/36 zielonych | ZROBIONE |

Wspólny regres sześciu plików po naprawach, wraz z Harvard: 6 plików / 102 testy zielone, `--retry=0`.

## Zmiany istniejących testów i werdykt pin-buga

| plik / asercja | było | jest | werdykt |
| --- | --- | --- | --- |
| `queryHelpers.test.ts` mock loggera | `error`, `warn` | plus `info`, `debug` | zamierzone zachowanie; pełny kontrakt zależności |
| `r1-context-pack.test.ts` mock queryHelpers | brak eksportu | `getCurrentPgTransactionClient → undefined` | zamierzone zachowanie; brak aktywnej transakcji w teście |
| `taskService.test.js` / brak wiersza | `undefined` | `null` | zamierzone zachowanie realnego PG |
| `taskService.test.js` / `COUNT(*)` | ścisłe `2` | `Number(count) === 2` | zamierzone zachowanie parsera `int8` PG; wartość nadal ścisła |
| `userService.test.js` / brak wiersza (2 asercje) | `undefined` | `null` | zamierzone zachowanie realnego PG |
| `rateLimiting.middleware.test.ts` | spy `Date.now` przed importem | spy po imporcie, przed wywołaniem limitera | zamierzone zachowanie; fault injection mierzy limiter, nie logger |

### Obowiązkowy pin Harvard B9

Werdykt: **KANONIZACJA DZIURY**. Asercja `expect(stubs).toEqual(expect.arrayContaining(['B9']))` wymusza pozostanie B9 w stanie `stub`. Aktualny kanon `server/scripts/harvard-cross-module-flows.js` mówi: zapis tylko metadanych do `tp_module_sync_results`, zero czytelników. Izolowany test ma 22/22 zielone, ale nie jest dowodem realnego handoffu/read-back. Implementacja produktu i czytelnicy są poza zamkniętą licencją P2, więc nie osłabiono ani nie usunięto asercji. Status: `NOT_AUTHORIZED` do naprawy produktu; pin został rozstrzygnięty, nie naprawiony.

## Zastane czerwone przyczyny

Końcowy pomiar zawiera 162 nazwane rekordy. Dominujące, potwierdzone przykłady:

- build/release drift: `Agent production build boundary > uses the fail-hard production project...` i `...runs the packaged strict Postgres migrator...`; źródła P6/Railway są tylko do odczytu;
- transakcyjne API/mock drift: `InitiativeController > updateInitiativeStatus > should update initiative status`, `InterviewController assignments > sendBackAssignment...` i inne lokalne mocki bez `withPgTransaction`;
- cleanup real-PG: pełna nazwana macierz `orgContext.middleware (L1)` (FK `users_organization_id_fkey`);
- font środowiskowy: `UnifiedExportService > exportPdf...`, oba `partnerCertificatePdf`, oba `partnerToolkitResources` (`Not a supported font format or standard PDF font`);
- brak źródła poza P2: `subscriptionAnalyticsService.test.ts` nie rozwiązuje importu nieistniejącego `server/src/services/subscriptionAnalyticsService.js`;
- schema/runtime poza testem: siedem nazwanych testów `Wave 8 agent runtime` (`wave8_schema_write_failed`);
- pozostałe nazwane klastry: AuthController MFA, DecisionController, Organization audit, apiKeyAuth, notification/organization/permission services, routes PMO/tools/metrics/partner payouts, presentation generator, system alert i Slack dedupe.

Nie zmieniono tych asercji „pod zieleń”. Pełne nazwy znajdują się w zachowanych lokalnych logach `/private/tmp/consultify-day67-test-debt-p2-artifacts/final-isolated-*.log`; nie są one artefaktem repo ani podstawą deklaracji `FIXED`.

## Migracje, PG, kompilacje i osiągalność

- własny kontener: `cx-day67-pg`, `127.0.0.1:5939`, baza `cx_day67_testdebt`;
- pierwszy przebieg istniejących migracji: 862, exit 0; drugi: `Applying migrations: 0`, exit 0;
- utworzone migracje: 0; rezerwacja `20261670-20261679` nieużyta;
- serwer: `NODE_OPTIONS=--max-old-space-size=3072 ../node_modules/.bin/tsc --build tsconfig.build.json --force` → exit 0. Zamiast kasować `dist` przeniesiono zastany katalog do scratch; kompilacja była wymuszona `--force`;
- frontend: `NODE_OPTIONS=--max-old-space-size=6144 npm run build` → exit 0;
- HTTP: `NIE DOTYCZY` dla pięciu naprawionych plików — zmiany dotyczą wyłącznie kontraktów testowych, kształtów sterownika PG i kolejności fault injection, bez zmiany trasy runtime.

## Commity i push

| commit | przyczyna | push github-backup |
| --- | --- | --- |
| `4cf4d9a2b4` | P2-MOCK-CONTRACT | TAK, natychmiast po pierwszym commicie |
| `b6e1e91c2c` | P2-PG-NORMALIZATION | TAK |
| `5f391085c9` | P2-RATE-LIMIT-CLOCK | TAK |

## Kontrola diffu

Przed każdym commitem wykonano trzy listy diffu. Zapisano wyłącznie pięć istniejących plików P2 oraz ten raport. `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, migracje i produkt pozostały bez zmian. Nie użyto `.skip`, `.todo`, wyciszeń TS/ESLint, zmian progów, exclude ani stash.

## KARTA DOWODOWA — DYŻUR 67 (TEST DEBT P2)

Gałąź: `codex/day67-test-debt-p2-20260828`  Marker: `6868d57...`  Data: `2026-08-28`

1. Rodowód: marker przodkiem tipa TAK; kopia po pierwszym commicie TAK (`4cf4d9a2b4`); commity ponad marker przed raportem 3.
2. Rozłączność: pliki spoza licencji ŻADNE; migracje 0; PG/harness 5939/3997 (harness nieużyty).
3. Osiągalność: NIE DOTYCZY — brak zmian runtime.
4. Mutacje: cztery wiersze w tabeli powyżej, każda czerwony→zielony.
4b. Kompilacja: serwer exit 0; frontend exit 0.
5. Regres: 49 plików izolowanych, `--retry=0`; końcowo 41 czerwonych plików i 8 zielonych według pliku statusowego; naprawiony podzbiór 102/102 zielony.
6. Zmiany testów: sześć zmian asercji/mocków, wszystkie „zamierzone zachowanie”; Harvard B9 = kanonizacja dziury, bez osłabienia.
7. Mianowniki: tabela w sekcji „Ponowny mianownik P2”.
8. Wygląd: NIE DOTYCZY; brak zmian widocznych.
9. Status: trzy przyczyny ZROBIONE; cały P2 CZĘŚCIOWO; B9 `NOT_AUTHORIZED` do implementacji produktu.
10. Twierdzenia niezweryfikowane: pełna przyczyna każdego z 162 czerwonych rekordów; realna osiągalność B9; wpływ integracji P1/P3-P6; globalny regres repo; aktualność skryptów release jako decyzji właściciela.
11. STOP-y: brak licencji na źródła przekrojowe/produktowe potrzebne dla B9, build/release, fontów i części schema runtime. Potrzebna osobna licencja właściciela, nie rozszerzono P2.

## TWIERDZENIA NIEZWERYFIKOWANE

- `NOT_PROVEN`: globalna zieleń P1/P3-P6.
- `NOT_PROVEN`: B9 ma realnego konsumenta lub read-back — aktualne dowody mówią przeciwnie.
- `PARTIAL`: 162 czerwone rekordy mają nazwy, ale nie każdy ma zakończoną klasyfikację przyczyny.
- `EVIDENCE_MISSING`: decyzja właściciela, czy obecne komendy build/release są kanonem, czy regresją.
- `NOT_AUTHORIZED`: implementacja źródeł produktu poza P2.
