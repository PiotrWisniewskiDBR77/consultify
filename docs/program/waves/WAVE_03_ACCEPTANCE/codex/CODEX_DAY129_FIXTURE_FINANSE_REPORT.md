# CODEX DAY 129 — FIXTURE FINANSE — RAPORT

Data: 2026-08-29  
Stan: **PARTIAL — LUKA TOŻSAMOŚCI FIXTURE USUNIĘTA; TEZA B.3 OBALONA**

## Tożsamość i wznowienie

- instrukcja: `INSTRUKCJA_DYZUR_129_FIXTURE_FINANSE.md`, marker `714faf5f8b0d9cda8204fec9495893c9fe97bed7`;
- branch/worktree: `codex/day129-fixture-finanse-20260829` / `/private/tmp/cx-day129-fixture-finanse`;
- pierwszy STOP na `6012` był prawidłowy: port trzymał obcy `ssh` PID `41475`; procesu nie zatrzymano;
- nadzorca zmienił jedynie port DB na `6013`. Przed wznowieniem `6013`, `4924` i `4925` były wolne (`0 z 3` zajętych).

Wynik kontroli markera (§0.1 krok 2):

```text
6144dae333 docs(day125-129): FALA PRZEKROJOWA — jedna wada, wszystkie moduly naraz
714faf5f8b merge: dyzur 121 — karta zbudowana za flaga OFF; endpoint nie propaguje checklisty
69506a79c5 docs(day121): record task card v2 evidence and runtime gaps
fc9e0b7eb2 feat(my-work): add owner-approved task card v2 behind off flag
24944a0499 merge: dyzur 122 — komunikat wdrozony, ale runtime blokuje WCZESNIEJ innym 409
4f776a62fe docs(day122): record owned database cleanup
df587a9271 docs(day122): record valuation message evidence
9f120b32a0 merge: day124-ustawienia-odbior
2471bc256e merge: day123-proto-dwa
47bb495b4a docs(day124): record settings visual acceptance evidence
f1efb98a3a fix(finance): read canonical API error payload
a3c0729f4d docs(day124): record settings visual acceptance evidence
b2b1ee9a06 docs(day123): add decision and insight prototypes evidence
32050f31ee fix(finance): explain immutable valuation recompute
63e7c979df merge: dyzur 119 — kontrakt trzech stanow w 3 komponentach
aa564ad4f0 docs(day121-124): pierwsza budowa PO akcepcie + trzy rownolegle
13c33a84f9 docs(day119): record three-state acceptance evidence
70c68154f8 fix(interview): render template uncertainty banner
a1265154b7 merge: day120-fixture-insight
9ed715a779 merge: day118-propagacja
4ba5900ca0 docs(ledger): DEC-337..339 — wlasciciel zaakceptowal wzorzec karty Zadania
1736e861e3 fix(interview): surface template load uncertainty
91acd26e6e docs(interview): record day120 fixture evidence
1a31bedb26 docs(day118): record owned cleanup
71f6c5198b docs(day118): record propagation evidence
MARKER OK
```

Wynik sanity (§0.1 krok 7):

```text
714faf5f8b0d9cda8204fec9495893c9fe97bed7
```

## Środowisko i fixture

- `cx-day129-pg`, `pgvector/pgvector:pg16`, `127.0.0.1:6013`, DB `consultify_w3_finance_owner_day129`;
- pełne migracje: `863` pierwszy przebieg, `0` drugi;
- PDF: `/Users/piotrwisniewski/Developer/consultify-fixtures/finance-owner-source.pdf`, SHA-256 `e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`;
- wybrano `server/scripts/run-wave3-finance-owner-review.ts`, bo BLOK 0 już tworzy i migruje DB; wrapper odmawia pracy na istniejącej bazie;
- manifest: `/private/tmp/cx-day129-fixture-finanse-artefakty/day129-fixture-final2.json`; kopia `0600`: `/private/tmp/consultify-wave3-fixture-day129.json`;
- valuation artifact: `20a293e8-a367-467a-8a64-f3a13612005e`;
- runtime kanoniczny: health/ready/frontend `200/200/200`, API/UI `4924/4925`, auth bypass `false`, migracje `863`, dotenv isolation `true`, zakazane klucze nieobecne.

SMTP: środowisko procesu `0` zmiennych, tabela settings `0` rekordów, grep Gateway `0` trafień. Zewnętrznego wysłania ani połączenia do Railway/demo/staging/produkcji nie wykonano.

## B.1 — stan przed

SQL zwrócił `0` aliasów dla `legacy_table='valuations'`, `legacy_id=<artifactId>`, `legacy_version=''`. Realny `ApiGateway`, podpisany OWNER JWT i realny PostgreSQL zwróciły `409 FINANCE_LEGACY_IDENTITY_UNMAPPED`.

UI przekazuje kanoniczny `artifactId` jako ID legacy (`src/components/Finance/useFinanceData.ts:56`) i wywołuje endpoint compute (`src/components/Finance/useFinanceRowActions.ts:617`). Kernel (`server/src/services/legacyCutover/legacyCutoverKernel.ts:450`) wymaga wpisu w `finance_artifact_aliases`: brak mapowania kończy się `409`, a mapowanie przy wyłączonym ECO-W26 kończy się `410`.

## B.2 — naprawa fixture

Runner seedera dopisuje idempotentnie (`ON CONFLICT DO NOTHING`) alias `valuations/<artifactId>/''` do tego samego artefaktu, organizacji i business version, po czym wykonuje ścisły readback. Nie zmieniono rejestru, migracji ani bramki. Runner wymusza `--retry=0` i JSON poza repo.

Commit/push `github-backup`: `8beaaca30f` (`fix(finance): map owner fixture valuation identity`).

## B.3 — realny wynik i korekta tezy

```text
DAY129_LEGACY_COMPUTE {"status":410,"body":{"success":false,"code":"FINANCE_LEGACY_WRITER_DISABLED","writerId":"ECO-W26","message":"This legacy writer has been cut over to its canonical successor.","successor":"/api/v8/finance-v2/valuation/legacy/:legacyId/compute","canonicalArtifactId":"20a293e8-a367-467a-8a64-f3a13612005e","canonicalBusinessVersionId":"c675b058-6915-4ecd-bc36-a36cb10ea27f","canonicalWorkingRevisionId":"d44fae96-948d-4726-925c-6d170cc33dc7","idBridge":"/api/v8/finance-v2/artifacts/resolve-legacy/:legacyTable/:legacyId","rollbackEnv":"FINANCE_LEGACY_WRITER_ROLLBACK_ENABLED","rollbackWritersEnv":"FINANCE_LEGACY_ROLLBACK_WRITERS"}}
```

B.3 jest **PARTIAL**: luka fixture zniknęła, lecz teza „zacznie zwracać `409 APPROVED_VERSION_IMMUTABLE` po polsku” jest obalona. Następną bramką jest wyłączony writer ECO-W26. Trzy naprawy 116/118/122 nadal nie są widoczne. To sukces pomiarowy zgodnie z instrukcją, bez improwizacji w produkcie.

## Dowód mutacyjny RED → GREEN

Mutacja poza commitem: wyłącznie `legacy_table` zmieniono na `valuations_day129_mutation`, odtworzono własną DB i uruchomiono ten sam test z `--retry=0`.

```text
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6013/consultify_w3_finance_owner_day129 JWT_SECRET=... vitest run server/src/services/legacyCutover/__tests__/day129FinanceFixtureIdentity.pg.test.ts --maxWorkers=1 --retry=0 --testTimeout=180000 --reporter=json --outputFile=/private/tmp/cx-day129-fixture-finanse-artefakty/day129-mutation-red.json
RED: 1/1 failed
Dyżur 129 — fixture Finansów ma zmapowaną tożsamość wyceny wiąże artifactId używany przez UI i usuwa stan FINANCE_LEGACY_IDENTITY_UNMAPPED — failed
AssertionError: expected +0 to be 1
```

Po przywróceniu pliku, ponownym odtworzeniu DB i seedzie:

```text
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6013/consultify_w3_finance_owner_day129 JWT_SECRET=... vitest run server/src/services/legacyCutover/__tests__/day129FinanceFixtureIdentity.pg.test.ts --maxWorkers=1 --retry=0 --testTimeout=180000 --reporter=json --outputFile=/private/tmp/cx-day129-fixture-finanse-artefakty/day129-mutation-green-final.json
GREEN: 1/1 passed
Dyżur 129 — fixture Finansów ma zmapowaną tożsamość wyceny wiąże artifactId używany przez UI i usuwa stan FINANCE_LEGACY_IDENTITY_UNMAPPED — passed
```

Pełna nazwa identyczna; delta nazw RED→GREEN: `0`. Mutacja nie pozostała w diffie.

## Regresja po nazwach

- nowy real-PG Gateway: `1/1` PASS;
- `Day 118 valuation 409 propagation boundary > does not replace APPROVED_VERSION_IMMUTABLE guidance with the generic DCF failure toast`: `1/1` PASS;
- delta nazw: `0`;
- `npm run build:backend`: PASS;
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: PASS. Pierwsza próba z limitem domyślnym zakończyła się OOM; ponowienie nie zmieniło kodu.

## Zrzuty 4/4

Ten sam panel zatwierdzonej wyceny, przed/po mapowaniu, light/dark. UI nie utrwala kodu odpowiedzi na ekranie, więc `409/410` dowodzi osobno Gateway.

```text
42a00efbb6a9d4c9bcf49c3e8b969f456240fa2ded14fdedbe20e4e8be7568e7  /private/tmp/cx-day129-fixture-finanse-artefakty/day129-after-mapped-dark.jpg
de2176d4411b7c36997867af3544d1efe98abfca45acdf08611c97977fd39658  /private/tmp/cx-day129-fixture-finanse-artefakty/day129-after-mapped-light.jpg
26b7a86fa59bc08f751dd5e80a835f0dce75edac15ab454b4c373eb287a3fc53  /private/tmp/cx-day129-fixture-finanse-artefakty/day129-before-unmapped-dark.jpg
614068ae3244e4c61063524516058aed7f500e1e3221e42b6cffe4ac80a358c4  /private/tmp/cx-day129-fixture-finanse-artefakty/day129-before-unmapped-light.jpg
```

## Kryteria, korekty i rozłączność

- K1–K7: PASS; zrzuty `4/4`; kart N, migracji i rejestru: `0` zmian.
- Zapis: jeden runner seedera, jeden nowy test, ten raport i `MODULE_ACCEPTANCE.md`.
- Korekta 1: port `6012` zastąpiony przez nadzorcę `6013`.
- Korekta 2: po mapowaniu wynik to `410 FINANCE_LEGACY_WRITER_DISABLED`, nie instruowane `409 APPROVED_VERSION_IMMUTABLE`.
- Runner miał dwa niestabilne starty (timeout/HPE parse error), potem przeszedł na świeżej własnej DB.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano osiągalności `APPROVED_VERSION_IMMUTABLE` z obecnego legacy endpointu bez osobnej, autoryzowanej decyzji o ECO-W26.
- Nie zweryfikowano polskiego komunikatu w UI, bo Gateway kończy żądanie wcześniej kodem `410`.
- Nie udowodniono absolutnego Z15: globalny setup Vitest wprowadza testowy klucz/mock i logi `llm_*`; runtime wykazał brak rzeczywistych kluczy, ale sam log nie rozstrzyga absolutnie braku próby inicjalizacji.
- Nie wykonano owner acceptance; zrzuty są dowodem technicznym, nie decyzją właściciela.

## Cleanup

Kanoniczny stop po commicie odmówił działania, bo zapisany stan runtime był związany z SHA sprzed commita (`state candidate identity differs`). Po niezależnym sprawdzeniu komend i PGID zatrzymano wyłącznie własne grupy `85280` (server) i `85326` (client) sygnałem TERM. Porty `4924/4925` są wolne. Własny kontener `cx-day129-pg` usunięto przez `docker rm -fv`; port `6013` jest wolny. Obcego procesu na `6012` nie dotknięto.
