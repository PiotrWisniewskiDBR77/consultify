# CODEX DAY 288 — bramka modułu Finance

## Werdykt

**PARTIAL / NIE WOLNO PROMOWAĆ JAKO PEŁNE R2/R4.** Naprawa mountów i bezpiecznik są zaimplementowane oraz mają reprezentatywny dowód real-Postgres przez prawdziwy `ApiGateway`, ale nie wykonałem wymaganej pary USER/OWNER dla każdej z 270 tras ani osobnego procesu HTTP na porcie 5254. Nie oznaczam dyżuru jako `VERIFIED` ani `ZROBIONE_WG_DoD`.

## Stan wejściowy

```text
MARKER OK
17dfbc0c8ad28d27a2daeb1ac417aa26d00e7991
git status --short: pusto
```

Marker jest przodkiem tipa `github-backup/grafika/m03-20260902`; tip uciekł do przodu. Praca pozostała dokładnie na markerze zgodnie z DEC-2026-08-26-95. Przy starcie było 49 GiB wolnego, przed kontenerem 36 GiB; porty 5254, 5255 i 6292 były wolne, liczba kontenerów `cx-day288`: 0.

## Korekty wobec instrukcji

1. Instrukcja odwołuje się do „tabeli licencji” (`Z12`, `§0.5`), ale dokument nie zawiera tabeli licencji. Zastosowałem bezpieczniejszą interpretację: zmieniłem wyłącznie pliki nazwane wprost w R3/R5; zastanego `financeStatementMountedSurface.test.ts` nie edytowałem mimo dwóch czerwonych przypadków po uszczelnieniu.
2. Plik `G20_BLOKERY_P0P1_20260903.md` nie istnieje na markerze `17dfbc0c8a`; jest dopiero na nowszym tipie. Mianownik zmierzyłem sam z plików produkcyjnych na markerze.
3. Bezpośredni regex przekazany do `Router.use` nie egzekwował bramki w realnym Gateway: USER dostał 200/200/400. Zastąpiłem go jednym jawnym middleware testującym ten sam wzorzec na `req.path`; po zmianie USER dostał 403 `BETA_LOCKED`, OWNER 200/200/400.

## R1 — własny mianownik

Pomiar znalazł dokładnie **270 tras: 91 GET i 179 zapisowych**. Pełne nazwy, metody, plik:linia, klasyfikacja auth oraz kolumny PRZED/PO są w `REJESTR_TRAS_FINANSE_BRAMKA_20260903.md`. Wołacze produkcyjne są pod `src/components/Economics`, `src/components/Finance` i klientami Finance; nie znalazłem produkcyjnego wołacza należącego do otwartego modułu. `MODULE_ECONOMICS` ma status `closed` w plikowym SSOT `server/src/sharedRuntime/utils/betaMenuStatus.ts:52` (mirror klienta: `src/utils/betaMenuStatus.ts:51`).

## R2/R4 — realny Postgres i HTTP

Kontener: `cx-day288-pg`, obraz `pgvector/pgvector:pg16`, baza `cx288`, port hosta 6292. Pełne migracje: pierwszy przebieg **886**, drugi przebieg **0**, oba zakończone `Postgres migrations complete`.

Reprezentatywna tabela z pełnego `ApiGateway.getInstance().initializeRoutes(app)`, podpisanych JWT i realnej bazy:

| Trasa | USER PRZED | OWNER PRZED | USER PO | OWNER PO |
|---|---:|---:|---:|---:|
| GET `/api/v8/finance/settings` | 200 | nie zmierzono | 403 `BETA_LOCKED` | 200 z `data` |
| GET `/api/v8/finance/models` | 200 | nie zmierzono | 403 `BETA_LOCKED` | 200 z `data` |
| POST `/api/v8/finance/models` z `{}` | 400 | nie zmierzono | 403 `BETA_LOCKED` | 400 z walidacji handlera |
| GET `/api/v8/finance/statements` | nie zmierzono przed | nie zmierzono przed | 403 `BETA_LOCKED` | 200 z `data` |

Test po zmianie: 4/4 PASS. Mutacja usuwająca bramkę rodziny v8: 1/4 PASS, 3/4 FAIL. Po przywróceniu: 4/4 PASS. Mutacja nie usuwała niezależnej bramki `financeStatementMountedSurface`, dlatego ten jeden przypadek pozostał zielony.

To jest dowód reprezentatywny, a nie tabela wszystkich 270 tras. Nie uruchomiłem osobnego procesu na 5254; Supertest wykonał realne HTTP in-process przez produkcyjny Gateway. Pozostałe 266 trasy mają `N/Z` i nie są runtime-zweryfikowane.

## R3/R5 — zmiana i bezpiecznik

- `server/src/routes/v8/index.ts`: jeden middleware z `FINANCE_MODULE_PATH`, po wspólnym `verifyToken`, przed pierwszym mountem finansów.
- `server/src/routes/v8/financeStatementMountedSurface.ts`: `verifyToken` bezpośrednio przed `createModuleGate('MODULE_ECONOMICS')` na powierzchni omijającej `v8FeatureGate`.
- `tests/unit/backend/security/betaGateMountRegistry.test.ts`: dwa nowe wpisy mountów oraz test pozytywnych i negatywnych prefiksów.
- `server/src/routes/v8/__tests__/financeRoutes.moduleGate.pg.test.ts`: realny Gateway/PG, USER/OWNER, dwa GET, zapis i drugi mount.

Rejestr mountów: PRZED 43/43, PO 50/50. Diff nazw: 7 dodanych, 0 znikniętych. Połączony przebieg z zastanym `financeStatementMountedSurface.test.ts`: 71/73; dwa stare przypadki oczekują 200 lub `FINANCE_EDIT_FORBIDDEN` dla stubu bez roli, a po nowej bramce prawidłowo dostają 403 `BETA_LOCKED`. Nie osłabiłem asercji.

Pułapki: `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny lokalny `DATABASE_URL` i `JWT_SECRET`, zawsze `--retry=0`. Asercje sprawdzają status i ciało, nie `fetch.ok`. Test montuje produkcyjny Gateway, nie goły router.

## Z30 — poczta

`BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera startu drenaży. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Artefakty i SHA-256

- `przed-registry.json`: `10647e5728151b4196e02e1b3814c2ed2d34ff24409205dcabc3101b0a59ffc9`
- `po-registry.json`: `afed73a0eca177f2eb0d5be07519a66182390898bdc27994c2e666a5fdb092c5`
- `przed-nazwy.txt`: `39d07f1c282167136c34a8ff82248da1153c69ed73d44125a18bb2b85186ed53`
- `po-nazwy.txt`: `6160230b9787f852ff436d6307674755fa8717a09eaae6ef42d0c3daa5e7a34f`
- `green-realpg.json`: `65d292ed552d9459bc75d04328a9678918a87a181f639fddb97f5efbe9289e71`
- `mutation-red-realpg.json`: `e992a7d8c84e85f2d2bf548ae15f734ac731ae123ff63a73b571c92e28752ac4`
- `restored-green-realpg.json`: `6123147bb2ab23cc31bd4e10d384085ecaeb3a1e12d88917bd852fe254aad9e9`
- `po-unit.json`: `6431dc075a23c0b370b88650a9b167e201ba54cfd22e200f0d5406fd7bde5d13`

Wszystkie artefakty: `/private/tmp/cx-day288-finanse-bramka-artefakty`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Para USER/OWNER dla każdej z 270 tras: **NIEZWERYFIKOWANA** (266 tras bez indywidualnego runtime).
- Serwer jako osobny proces na porcie 5254 oraz niezależny harness na 5255: **NIEZWERYFIKOWANE**.
- Liczba 64 zapisów bez ponownego odczytu członkostwa: **NIEZWERYFIKOWANA w tym dyżurze**.
- Brak regresji całego repo/CI/produkcji: **NIEZWERYFIKOWANY**.

## Zdanie dla D7

„Day288 PARTIAL: 270 tras `/api/v8/finance*` objęto wspólną bramką `MODULE_ECONOMICS`, a przedglobalną powierzchnię sprawozdań osobną bramką po auth; reprezentatywny real-PG/Gateway USER→403 i OWNER→handler oraz RED→GREEN potwierdzone, lecz pełna para 270/270 i osobny runtime 5254 pozostają EVIDENCE_MISSING — nie zamykać D7.”
