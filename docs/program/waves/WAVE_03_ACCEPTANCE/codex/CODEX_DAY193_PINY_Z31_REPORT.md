# CODEX DAY 193 — piny Z31

## Werdykt

`ZROBIONE_WG_DoD` dla zakresu R1–R3: sweep znalazł 7 testów w 7 plikach i 9 twardych pinów. Wszystkie zostały odpięte wyłącznie w licencjonowanych asercjach. Na wspólnym obcym PostgreSQL `127.0.0.1:6113/cx193` stan PRZED to 7/7 czerwonych suit dokładnie na pinach; stan PO to 7/7 zielonych suit, 14/14 testów, 0 FAIL, 0 SKIP, `success=true` w każdym JSON-ie, `--retry=0`.

## Wejście, marker i rozjazd tipa

Pierwsza instrukcja została pobrana z bare-vaulta i przeczytana w całości (779 linii). Stan dokumentu: `WYDANY`.

```text
$ df -h /
/dev/disk3s1s1   1.8Ti    12Gi   9.9Gi    55% ... /

$ git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
ce127952b5 partia 3 wydana (188-193: partner backend+i18n, drugi kasownik z LLM, stopka PDF, sygnaly params, piny Z31 — sweep znalazl 7 nie 3) + D-9 zaakceptowana + odbior 183 SCALONO
e758db0c44 merge: dyzur 183 + FIX-183 (kalendarz V2 domyslnie ON — D-6; wlasne wydarzenia przezywaja reload, zrzuty x4 potwierdzone wzrokiem)
cd9c545dc1 fix(day183): dedupe calendar sources so own events survive reload; full screenshot set
9e86cf531c odbior 180: SCALONO po FIX-180 — mechanika K6 DOMKNIETA; do wlaczenia agenta zostala decyzja wlasciciela o fail-open polityk + env przy deployu
d998ff21ae merge: dyzur 180 + FIX-180 (plany z czatu pod limitami; odmowa nie-trwala opt-in, klucz per proba z dedupem redelivery, krok terminalny po cancel, NaN-guard, happy-path, licznik odmow)
a3a70b2878 docs(day180): errata FIX-180 — cztery wady z sond, mutacje, stan sasiadow
84cadd53fc fix(agent/F1+F2): a refusal must not outlive its peak, a retry must retry
96e2714d36 odbior 181: SCALONO po FIX-181 (D-1 end-to-end, errata karty); strona obiektu -> dyzur 194
707ee1334d merge: dyzur 181 + FIX-181 (beta Spotkan otwarta D-1, /meetings w prefiksach pilota — MEMBER wchodzi, mutacja routera; errata karty uczciwa) — strona obiektu do 181-bis
4a6f6487b8 fix(day181): allow /meetings for pilot roles, honest card errata, object-page 403 surfaced
77fef4f11e test(agent/180): governed chat-plan happy path + one greppable denial counter
ed2e6fc17f fix(agent/F4): malformed timing envs fall back to the default, not to NaN
fa38aaf298 fix(agent/F3): close the in-flight step terminally when a plan is cancelled
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
fc9d7410bc merge: dyzur 186 (brief -> tresc slajdow w trasie szablonowej PPT; plik dowodowy REALNY — odtworzony niezaleznie bit-w-bit) — odbior B+/A-
846f9eaf34 odbior 180: NIE SCALAC — F1 trwala odmowa wspolbieznosci (krok martwy na zawsze), F2 retry polyka blad, F3 'W toku' po cancel, F4 NaN na env; FIX-180 Opus wydany
14ce6dc6bf odbior 187: FIX-187 wykonany — przycisk PDF w obu miejscach UI, D-3 zamkniete klientowo
1548ef5c7b Merge branch 'codex/m03-admin-20260824' ...
53ebbf2088 fix(day187): PDF download button beside DOCX in audit report UI
67c819d9f8 odbior 183: flip wstrzymany do FIX-183 — includeOwnEvents gubi wlasne wydarzenia ...
809c5b8aff odbior 184: SCALONY po FIX-184 — plan migracji kompletny ...
e15eefec56 merge: dyzur 184 + FIX-184 ...
48e034c207 marzenie wlasciciela: prezentacje jakosci Gammy ...
4913eb6404 odbiory: 185 SCALONO po FIX; 182 SCALONO (A) ...
503d259f75 merge: dyzur 182 ...

$ git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
MARKER OK

$ git -C "$WT" rev-parse HEAD
b4651675f6ba0cc880c07fee94d2667a952d92f4
$ git -C "$WT" status --short | head -3
<pusto>
```

Tip uciekł do przodu. `git log b4651675f6..github-backup/codex/m03-admin-20260824` pokazuje 20 commitów (od `892c0833b1` do `ce127952b5`); `git diff --name-only` pokazuje 35 ścieżek. Żadna z siedmiu zmienianych tu ścieżek testowych nie występuje w tym diffie. Start zgodnie z instrukcją dokładnie z markera; scalenie tipa pozostaje nadzorcy.

Porty 6113, 5058 i 5059 przed startem: brak listenerów i brak kontenera z tymi mapowaniami.

## Migracje i Z30

Kontener: `cx-day193-pg`, obraz `pgvector/pgvector:pg16`, baza `cx193`, mapowanie `127.0.0.1:6113:5432`.

- pierwszy przebieg migracji: 870 pozycji, `✅ Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`;
- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"`: `BRAK ZMIENNYCH POCZTY`;
- `SELECT ... FROM settings WHERE key LIKE 'smtp%'`: `(0 rows)`;
- grep drenaży w `server/src/Gateway.ts`: 0 trafień.

Deklaracja Z30: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## R1/R2 — pełny sweep i decyzje

Komendy obowiązkowe:

```bash
grep -rn "toEqual({ database:" server/src tests
grep -rn "toBe('cx" server/src tests
grep -rn "DATABASE_URL).toBe('postgresql:" server/src tests
```

| Plik:linia PRZED | Wzorzec | Decyzja |
|---|---|---|
| `day160.task-write-gate.pg.test.ts:68` | a | obiekt zastąpiony długością nazwy i dodatnim portem |
| `presentations.templatePptx.day83.pg.test.ts:33-35` | b | database/host/port zastąpione niepustymi wartościami i dodatnim portem |
| `presentations.templateContent.day186.pg.test.ts:49-51` | b | database/host/port zastąpione niepustymi wartościami i dodatnim portem |
| `day168.kpi-bootstrap.pg.test.ts:38` | a | obiekt zastąpiony długością nazwy i dodatnim portem |
| `day139.projectTextGovernance.pg.test.ts:34` | c | pełny URL zastąpiony literalnym wzorcem FIX-174 |
| `day139.projectTextGovernance.pg.test.ts:35` | a | obiekt zastąpiony długością nazwy i dodatnim portem |
| `day159.chunkOrgBackfill.pg.test.ts:41` | c | pełny URL zastąpiony literalnym wzorcem FIX-174 |
| `day159.chunkOrgBackfill.pg.test.ts:42` | a | obiekt zastąpiony długością nazwy i dodatnim portem |
| `day169.checkin-windows.pg.test.ts:46` | a | obiekt zastąpiony długością nazwy i dodatnim portem |

Fałszywych trafień: 0. Po zmianie wszystkie trzy grepy: 0 trafień.

Dowód programu T6: `ODBIOR_186_GEN4_TRESC.md:29` zawiera `Licznik pinów Z31 w programie: 6`; świeży sweep potwierdza korektę instrukcji: realnie 7 nieodpiętych testów i 9 pinów, nie 3 testy.

## R3 — PRZED/PO na obcym kontenerze

Każda komenda miała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6113/cx193 JWT_SECRET=...`, config `server/vitest.config.ts` wywołany z katalogu `server` jako `--config vitest.config.ts`, `--retry=0`. Pierwsza próba z roota i ścieżkami `server/src/...` dała 0 testów i została jawnie odrzucona jako brak pomiaru.

| Test | PRZED — cytat | PO JSON |
|---|---|---|
| day160 | expected `{ database: 'cx160' }`, received `{ database: 'cx193' }` | 3/3 PASS, 0 FAIL/SKIP, success=true |
| day83 | expected `cx_day83`, received `cx193` | 1/1 PASS, 0 FAIL/SKIP, success=true |
| day186 | expected `cx186`, received `cx193` | 1/1 PASS, 0 FAIL/SKIP, success=true |
| day168 | expected `{ database: 'cx168' }`, received `{ database: 'cx193' }` | 2/2 PASS, 0 FAIL/SKIP, success=true |
| day139 | expected URL `6023/cx139`, received `6113/cx193` | 1/1 PASS, 0 FAIL/SKIP, success=true |
| day159 | expected URL `6046/cx159`, received `6113/cx193` | 4/4 PASS, 0 FAIL/SKIP, success=true |
| day169 | expected `{ database: 'cx169' }`, received `{ database: 'cx193' }` | 2/2 PASS, 0 FAIL/SKIP, success=true |

Pełne nazwy 14 przypadków są zapisane w JSON-ach `after-1.json`…`after-7.json`; porównanie nie opiera się wyłącznie na liczbie.

### Pułapki (a)–(e) per pakiet

- day160/day83/day186/day168/day169: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) przez `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) przez `MOCK_DB=false DB_TYPE=postgres` i log `DB_IDENTITY ... 127.0.0.1:6113/cx193`; (d) przez `ENABLE_TEST_AUTH_BYPASS=false`; (e) przez pełny sweep i zmianę licencjonowanej asercji. Dowód wejścia produkcyjnego: pliki importują `ApiGateway` i wywołują `ApiGateway.getInstance().initializeRoutes(app)`.
- day139/day159: (c) i (e) dotyczą bezpośrednio i zostały wyłączone jak wyżej. (a), (b), (d) nie leżą na ścieżce tych usługowych testów: `rg -n "ApiGateway|ENABLE_V8_GLOBAL|RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE|ENABLE_TEST_AUTH_BYPASS" <oba pliki>` daje 0 trafień.

Trzy pliki (day160/day168/day169) mają zastane twarde ścieżki artefaktów. Pierwszy przebieg PO miał wszystkie przypadki PASS, lecz suite `success=false` w `afterAll` z `ENOENT`. Licencja i Z40 pozwalają zmienić wyłącznie asercje bazy, więc nie edytowano ścieżek. Potwierdzono brak trzech katalogów, po czym utworzono symlinki kierujące fizyczny zapis do `/private/tmp/cx-day193-piny-artefakty`; ponowienie dało `success=true`. To korekta środowiska dowodowego, nie zmiana repo.

## Korekty wobec instrukcji

1. Instrukcja odwołuje się w Z24 do obowiązkowego `§0.4a`, lecz plik nie zawiera sekcji `0.3` ani `0.4a` (nagłówki przechodzą z `0.2d` do `0.5`). Bezpieczna interpretacja: zmierzono pełny zakres trzech wymaganych grepów w `server/src` i `tests`, pełne nazwy testów przed/po oraz `git diff --name-only b4651675f6..HEAD`; nie wymyślano brakującej procedury.
2. Literalna komenda z rootem i `--config server/vitest.config.ts` plus ścieżką `server/src/...` dała `numTotalTests=0`, ponieważ config ustawia root na `server`. Poprawny pomiar wykonano z `/private/tmp/cx-day193-piny/server`, ścieżką `src/...` i `--config vitest.config.ts`.
3. Instrukcja mówi, by naprawić pin ścieżki artefaktów wzorcem FIX-170, ale tabela licencji dla wskazanych plików oraz Z40 zezwalają wyłącznie na asercje bazy/portu. Wybrano bezpieczniejszą interpretację: brak zmiany kodu poza asercjami; symlinki tylko w efemerycznym środowisku.

## Artefakty i SHA-256

```text
ca9e37cedd0f1b5b78baf143c569c4d37fb50cf5a94e97051324b7bef124a660  migrate-1.log
824d225994c98d1f1696586416caf517a6fce1e85626d29c7f68e4621df15065  migrate-2.log
9993999710d963f942277cc1973e31f0327542427e82903a62963f42ac414764  before-verbose.log
a08ddfe1edf99e16aa3a82f3d178df00998de342fd34210eea0e1c3c0900c0e8  after-1.json
0f5b5ff71df9bd7a2858d63b169cef21f6d5af4df93eba67fa21256085753bdd  after-2.json
4ce0f7214e2dc0b6ef399958ede177f34845de757a266157eca2a8c2655d3bf9  after-3.json
f1c300b2f07812a4336dbdb47824ca0a29be543dbfa99116ae564faa3e583239  after-4.json
21ba487d4459d523f2896dec24fa025429be4963b436720ed05147193a992fdc  after-5.json
c2b2176bcb059091ac4e3a66b329a186a795889daf47ea8cb3dce00566543a65  after-6.json
cf270b66e382db20811be33b4d0c017f478be9f5c1309cfd954970de050c8c9d  after-7.json
```

Wszystkie pliki leżą fizycznie w `/private/tmp/cx-day193-piny-artefakty`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie uruchomiono całego repozytoryjnego korpusu Vitesta; uruchomiono wszystkie 7 testów znalezionych pełnym, obowiązkowym sweepem R2.
- Nie wykonano dodatkowego sweepu dowolnych możliwych semantycznych wariantów pinu poza trzema wzorcami literalnie zamówionymi w R2; te trzy objęły całe `server/src` i `tests`.
- Nie zweryfikowano działania tych testów na hoście PostgreSQL innym niż `127.0.0.1|localhost`, ponieważ wzorzec FIX-174 celowo dopuszcza tylko lokalny realny Postgres.

