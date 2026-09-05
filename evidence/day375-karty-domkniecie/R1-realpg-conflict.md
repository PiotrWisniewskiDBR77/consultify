# R1 — odtworzony dowód konfliktu wykonania propozycji

- Środowisko: lokalny `pgvector/pgvector:pg16`, kontener `cx-day375-pg`, baza `cx375`, port hosta `6446`.
- Migracje: pierwszy przebieg `Applying migrations: 897`, drugi przebieg `Applying migrations: 0`.
- Test (pełna nazwa): `Day371 schema proposal execute conflict through real ApiGateway and PostgreSQL returns 200 once, then typed 409 without changing resolved_at again`.
- GREEN: `r1-green.json` — `numPassedTests: 1`, `numFailedTests: 0`, status asercji `passed`; SHA-256 `993f1d645ca784a53fc06a9a53418de52241dba4caa58cb3a3e001d56fff639b`.
- Mutacja odwrotna: `TablePlatformError(..., 409)` zastąpiony czasowo przez `Error`, a `handleRouteError` przez jawne `res.status(500)`; `r1-mutation-red.json` — `numPassedTests: 0`, `numFailedTests: 1`, status asercji `failed`; SHA-256 `b3f2ba9040a2fd36ec0278c1b8f7add95b7a233b91e9efdfa7235b7086814d3e`.
- Dosłowna przyczyna RED: `expected 500 to be 409` w `day371.chatToSchema.executeConflict.pg.test.ts:132`.
- Po przywróceniu obu plików produktu przez `cp`: diff produktu pusty.
- RESTORED GREEN: `r1-restored-green.json` — `numPassedTests: 1`, `numFailedTests: 0`, status asercji `passed`; SHA-256 `a588e1e6688d50cf53f358b7668ffec416f1e1264822e178cff4ac7637132755`.
- Korekta harnessu: dwa kolejne czyste przebiegi po mutacji kończyły się `numPendingTests: 1`, status asercji `skipped` po limicie `beforeAll(..., 60_000)`. Zgodnie z wąską licencją timeout inicjalizacji `ApiGateway` zwiększono do `120_000`; asercje zachowania pozostały bez zmian.
- Surowe JSON-y i logi pozostają poza repo w `/private/tmp/cx-day375-karty-domkniecie-artefakty/`, zgodnie z Z13.
