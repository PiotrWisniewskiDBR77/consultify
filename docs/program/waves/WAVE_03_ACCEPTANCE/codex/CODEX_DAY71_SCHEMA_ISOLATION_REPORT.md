# CODEX DAY 71 — IZOLACJA SCHEMATU TESTOWEGO

Status: **PARTIAL / BRAMKA C.1 NIE DAJE BEZPIECZNEGO GO / K4 FAIL**  
Marker: `5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb`  
Gałąź: `codex/day71-schema-isolation-20260829`

## §0.1 — baza pracy i marker

`df -h /` pokazał `14Gi` wolnego, więc próg 5 GB został spełniony. Porty `5943`
i `4650` nie miały listenera; `docker ps` pokazał wyłącznie równoległy
`cx-day69-pg 127.0.0.1:5941->5432/tcp`.

Wynik §0.1 (2), dosłownie:

```text
e85371d110 docs(instrukcje): dyzur 71 izolacja schematu testowego (48 plikow, bramka dowodowa)
5aca498cfd docs(ledger): DEC-259..261 odbior dlugu integracyjnego + przyczyna zrodlowa w infrastrukturze testowej
[23 starsze wpisy — pełny wynik był wyświetlony w terminalu dyżuru]
MARKER OK
```

Tip uciekł o jeden commit. Wynik reguły rozejścia:

```text
e85371d110 docs(instrukcje): dyzur 71 izolacja schematu testowego (48 plikow, bramka dowodowa)
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_71_IZOLACJA_SCHEMATU.md
```

Wynik §0.1 (7), dosłownie:

```text
5aca498cfdf1b36d59812a7e3e4df6c8d0043aeb
```

`git status --short | head -3` nie wypisał żadnej linii.

## W1–W4

```text
W1:       52
W2:       14
W3:       48
W4:
async function reset() {
  // Own the entire fixture namespace. The previous version dropped and
  // recreated public core tables, corrupting every test that shared the DB.
  await sql.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  await sql.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  await sql.query(`SET search_path TO ${TEST_SCHEMA}, public`);

afterAll(async () => {
  await sql?.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  await sql?.end();
});
```

W1 i W3 zgadzają się z tezą autora. W2 daje 14 globalnych trafień `CREATE SCHEMA`;
komenda W2 nie liczy przecięcia T1∩T2, mimo że opis T2 mówi o przecięciu.

## Bezpieczeństwo środowiska i Z30

```text
BRAK ZMIENNYCH POCZTY
```

Grep drenaży w `server/src/Gateway.ts` dał 0 trafień. Po pełnych migracjach:

```text
 key | left
-----+------
(0 rows)
```

Pierwszy migrator zakończył się `✅ Postgres migrations complete`; drugi:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## C.1 — pakiet i próbka

Pakiet 163 plików odtworzyłem mechanicznie z 163 unikalnych ścieżek kategorii
A/C w `INTEGRATION_DEBT_RAPORT_20260829.md`, w kolejności pierwszego wystąpienia.
Oba wiążące przebiegi miały identyczną listę i env w tej samej linii:
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test`,
`ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, URL portu `5943`,
`JWT_SECRET`, dodatkowo wymagane przez zastane pliki `M13_PG_URL` i
`RES10_PG_URL`, oraz `--retry=0` i reporter JSON.

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) wyłączona przez
tryb `enforce`; (c) wyłączona jawnym `MOCK_DB=false DB_TYPE=postgres`; (d)
wyłączona przez `ENABLE_TEST_AUTH_BYPASS=false`; (e) oba pomiary miały tę samą
listę/kolejność i każdy dostał nowy kontener po pełnym migratorze. Mimo tego
pakiet nadal jest niedeterministyczny przez współdzielony stan między plikami.

Próbka pięciu:

1. `tests/integration/m13-organization-profile-persistence.test.ts` — obowiązkowy, niszczy `organizations`;
2. `tests/integration/routes/helpRoutes.test.ts` — obowiązkowy, niszczy `help`;
3. `tests/integration/kpiScorecardService.tenant.pg.test.ts` — trwały klient PG i kilka tabel Results;
4. `tests/integration/initiativeGovernance.goalRollup.tenant.pg.test.ts` — trwały klient PG i tabele Goals/Initiatives;
5. `tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts` — trwały klient PG i tabele inicjatyw.

W czterech plikach PG dodałem wyłącznie unikalny schemat, `search_path` oraz
sprzątanie schematu. `helpRoutes` nie dostał nieobsługiwanego przez SQLite
`CREATE SCHEMA`; patrz korekta niżej.

### Wynik po nazwach

Baseline: `1226 total / 443 passed / 440 failed / 343 pending`.  
Po próbce: `1226 total / 418 passed / 434 failed / 374 pending`.

Czerwone → zielone w innych plikach:

- `Auth Integration Login Flow should fail with invalid credentials`;
- `Day 55 ... language and theme: both stores survive fresh Gateway GETs`;
- `Day 55 ... profile: write, independent SQL readback, and a fresh Gateway GET`.

Zielone → czerwone (K4 FAIL), wszystkie w innym pliku:

- `Stabilization routes integration (L3) GET /health-history returns [] when no rows exist`;
- `... GET /health-history returns [] when system_health_history table is missing (DbPromise fallback)`;
- `... GET /status counts recent errors from last hour`;
- `... GET /status returns 200 stable payload for superadmin token`;
- `... GET /status returns recentErrors=0 when error_logs table is missing (DbPromise fallback)`.

Wiele dalszych przypadków zmieniło `passed/failed` na `skipped` albo odwrotnie.
Wymóg C.1 „zapala testy w innych plikach” jest literalnie spełniony, lecz wynik
nie daje bezpiecznego GO: K4 jest czerwone, a ruchy do `skipped` dowodzą, że
porównanie nadal mierzy zatrucie/kolejność, nie wyłącznie cztery diffy.

## Korekty wobec instrukcji

1. §A/T2 opisuje „przecięcie”, ale W2 liczy wszystkie pliki z `CREATE SCHEMA`.
   Wynik własny W2 to 14; W3 mimo tego daje 48.
2. §B/T3 kwalifikuje `helpRoutes.test.ts` jako sprawcę publicznego schematu.
   Źródło ustawia SQLite i osobny plik per worker, ale w szerokim pakiecie jego
   `DROP TABLE help_*` wykonał się przez `PostgresDatabase.ts`, co obala
   założenie hermetyczności i pokazuje wyciek stanu modułu. Dodanie literalnego
   `CREATE SCHEMA` do testu deklarującego SQLite byłoby zmianą nieprzenośną.
3. K3 zamawia `rm -rf dist`; wykonanie zostało odrzucone przez bezpiecznik
   narzędzia. Istniejący `dist` przeniosłem odzyskiwalnie poza repo, po czym
   uruchomiłem dokładny `tsc --build`; exit 0.
4. Szeroki test zmodyfikował cztery śledzone pliki DOCX. Były to skutki tego
   przebiegu; zostały odtworzone z HEAD przed commitem. Diff końcowy ich nie zawiera.

## STOP — C.2

Rodzaj: MERYTORYCZNY  
Powód: próbka daje jednocześnie testy czerwone→zielone oraz 5 nowych czerwonych,
więc K4 FAIL i masowe rozszerzenie wzorca nie ma wiarygodnej podstawy.  
Licencja, którą sprawdziłem: §F zezwala wyłącznie na 48 nazwanych plików testowych
i raport; wszystkie bieżące zmiany mieszczą się w tej licencji.  
Dowód: `baseline-163-corrected.json` kontra `after-sample-163-v2.json`, lista
pięciu `green_to_red` powyżej.  
Co dostarczyłem ZAMIAST zmiany: pełny baseline/after po nazwach, próbkę z czterema
izolacjami, wykrycie wycieku SQLite→PG oraz brief przyczyny.  
Co zrobiłbym, gdyby zapadła decyzja X: najpierw rozdzieliłbym runner na procesy
lub wymusił izolację modułów i ponowił identyczny baseline/after. Dopiero po
pustym `green_to_red` rozszerzyłbym schematy partiami 5–8.  
Rekomendacja dla nadzorcy: nie przyjmować masowej zmiany 43 plików; najpierw
usunąć niedeterministyczne współdzielenie Database.js/DB_TYPE między workerami
bez modyfikacji globalnych plików objętych Z18 w tym dyżurze.  
Stan: zacommitowano częściowo w commicie tej gałęzi.  
Czy kontynuowałem pozostałe pozycje: NIE — rozszerzenie przy K4 FAIL zwiększałoby
promień regresji i zacierało dowód C.1.

## Kryteria K1–K6

- K1: **PARTIAL** — literalne czerwone→zielone w innych plikach, ale równocześnie nowe czerwone i ruchy do SKIP;
- K2: **NOT_PROVEN** — brak uczciwego dowodu mutacyjnego zielony→czerwony→zielony;
- K3: **PASS** — produkcyjny build serwera, exit 0;
- K4: **FAIL** — 5 nowych czerwonych wymienionych po nazwach;
- K5: **PASS dla granicy diffu** — tylko 4 pliki z §B i ten raport;
- K6: **PASS** — 44 z 48 bez zaakceptowanej naprawy pozostają NIEZWERYFIKOWANE;
  cztery zmienione także nie dostają etykiety `FIXED` bez K2.

## Artefakty

- `/private/tmp/cx-day71-artefakty/baseline-163-corrected.json` — `90b20daf4963d9f850d2984821f91faf2d75e27c5a340c6bff610a886c3e40a0`;
- `/private/tmp/cx-day71-artefakty/after-sample-163-v2.json` — `b540d011ca56aad23313dc40456555e9b5d360c878ed6714e8cd4dda610735c9`;
- `/private/tmp/cx-day71-artefakty/sample-five-targeted.json` — `82bbc01650102c28385ea5a0c86431b46dee69e4557b6dfd7215c94d8c91bb1d`;
- `/private/tmp/cx-day71-artefakty/m13-alone.json` — `1f3458b3eae68c17e1b56ec1d94e9a32a8553fbaf3b1b1de057f14fc38dbbc79`.

## Podsumowanie

**Naprawiono 0 z 48** w znaczeniu `FIXED/VERIFIED` wymagającym K2; przygotowano
izolację w 4 z 48, lecz bramka wykazała 5 nowych czerwonych i nie autoryzuje C.2.

