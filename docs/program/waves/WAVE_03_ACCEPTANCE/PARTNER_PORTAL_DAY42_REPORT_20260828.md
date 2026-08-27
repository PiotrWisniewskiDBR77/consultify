# Partner dzień 42 — odblokowanie portalu, inwentarz tras, izolacja tenantowa — raport dyżuru 2026-08-28

Gałąź: `codex/partner-day42c-20260828` · baza: `23652ec80a` · poziom ukończenia: W TOKU  
Kontener: `cx-day42-pg`, host `127.0.0.1`, port hosta `5697`, baza `cx_day42`

## Oświadczenia bezpieczeństwa

- Chroniony checkout `/Users/piotrwisniewski/Developer/Consultify` nie był
  czytany ani modyfikowany; użyto wyłącznie dozwolonego symlinka `node_modules`.
- `git stash list` był pusty. Nie wykonano `git stash`, push ani żadnej
  interakcji z Railway, demo, stagingiem lub produkcją.
- Każda komenda DB miała jawny
  `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5697/cx_day42` oraz, dla
  testów, `RUN_DB_TESTS=1 MOCK_DB=false`.

## Marker i korekty BLOKU 0

- `git merge-base --is-ancestor 23652ec80a codex/m03-admin-20260824` → exit 0,
  `MARKER OK`.
- `git fetch --all --prune` częściowo odmówił przez zastany remote
  `icloud-source` wskazujący nieistniejący
  `/private/tmp/consultify-staging-deploy-e6ca`; `origin` i `github-backup`
  zostały pobrane. Marker zweryfikowano niezależną komendą, bez łańcucha `&&`.
- Pierwszy przebieg runnera bez `NODE_ENV=test` odmówił lokalnego hosta przed
  połączeniem. Z udokumentowanym trybem `NODE_ENV=test` zastosowano 855
  migracji; drugi przebieg: `Applying migrations: 0`.
- Lokalny binarny `psql` nie istnieje. Niezależny klient `pg` potwierdził cel
  `127.0.0.1:5697/cx_day42`; PostgreSQL wewnątrz kontenera raportował własny
  adres `172.17.0.8:5432`. Kolumna `owner_organization_id` i pięć wymaganych
  tabel Partner były obecne.

## D.1 — werdykt przyczyny 404

**PRZYCZYNA 404 = (a) KONFIGURACJA.** Bez `ENABLE_V8_GLOBAL` pięć
reprezentatywnych żądań zwróciło `404 V8_DISABLED`; z
`ENABLE_V8_GLOBAL=true` niepowiązany członek dostał `200 connected:false` na
`/connection` oraz `403 PARTNER_ORG_REQUIRED` na `/clients`, a dokładnie
powiązany tenant i użytkownik osiągnęli realny handler `/clients` z `200`.

| Hipoteza               | Wynik                                                                                     | Werdykt                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| (a) flaga środowiskowa | ta sama baza i Gateway: brak env → `404 V8_DISABLED`; env `true` → handler                | POTWIERDZONA                                               |
| (b) brak mountu        | log realnego Gateway: `[ApiGateway] Mounting /api/v8`; handler osiągnięty                 | OBALONA                                                    |
| (c) `mountStub`        | realny `ApiGateway`; partner nie występuje w `mountStub`; handler osiągnięty              | OBALONA                                                    |
| (d) schemat            | pełny runner tworzy wiązanie; autorun statycznie pomija `955_` przez wzorzec `7xx`/8 cyfr | NIEZALEŻNA LUKA AUTORUNU, nie przyczyna po pełnym runnerze |

Czy portal ożywa w kanonicznym env: **TAK, po pełnym runnerze migracji**.
Dowód: `8b78c335cc`, test
`partner-portal-gate-diagnosis.day42.realpg.test.ts`, `6 PASS / 0 FAIL / 0 SKIPPED`.

## D.2 — wariant

Wybrano wariant 1: portal pozostaje za globalną bramką. Nie istnieje decyzja
właściciela zezwalająca na przeniesienie mountu przed `v8FeatureGate`.

Wymaganie dla dyżuru 38: `ENABLE_V8_GLOBAL=true jest WYMAGANE w każdym
środowisku, w którym ma działać moduł Partner, Interview, Execution, Results i
Finance; jego brak daje 404 na ~połowie produktu i NIE jest odróżnialny od
awarii po stronie klienta.`

## D.7 — teza „orgId z URL-a”

**TEZA OBALONA.** Kotwiczony pomiar wykazał 35 tras. `user-tiers/:orgId/:userId`
na linii 270 jest cytatem w JSDoc; realna trasa żyje w
`server/src/routes/admin-data.routes.ts:107`. Router Partner nie czyta
`req.params.orgId`, `req.params.organizationId`, `req.body.orgId` ani
`req.body.organizationId`. Pomyłkę spowodował grep bez kotwicy `^`, który
policzył komentarz jako 36. Parametry istniejące w Partner identyfikują zasoby,
nie tenantów; ich ownership podlega osobnej macierzy D.6.

## Pomiar bazowy Z24

Pełny zakres przed pierwszym commitem: **548 PASS / 15 FAIL / 92 SKIPPED** w
78 plikach (`54 passed / 22 failed / 2 skipped`). Czerwień jest zastana.
Wspólny przebieg jest destrukcyjny dla jednej bazy: zastane testy kasowały
tabele i kolidowały na `CREATE TABLE`; po pomiarze kontener został usunięty z
wolumenem, odtworzony i ponownie zmigrowany przed testami Day 42.

## Pozycje — stan

| Pozycja | Status          | Commit                  | Dowód                                       |
| ------- | --------------- | ----------------------- | ------------------------------------------- |
| D.1     | ZROBIONE_WG_DoD | `8b78c335cc`            | realny Gateway + realny PG, 6/6             |
| D.7     | ZROBIONE_WG_DoD | commit bieżącej pozycji | kotwiczony grep + lokalizacja realnej trasy |

## Twierdzenia jeszcze niezweryfikowane

Na tym etapie nie zakończono pełnych łańcuchów D.2, macierzy finansowej D.6,
inwentarza 35 tras, inwentarza konsumentów ani końcowego pomiaru Z24. Nie są
raportowane jako ukończone.
