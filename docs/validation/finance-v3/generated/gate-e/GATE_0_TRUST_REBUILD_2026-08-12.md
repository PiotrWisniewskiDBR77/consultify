# Gate 0 — Odbudowa zaufania do Git (2026-08-12)

**Wynik: `PASS` (VERIFIED)**

Poprzednia sesja raportowała, że centralne `.git` zwraca `Operation not permitted` (iCloud).
Ten stan **ustąpił** — repozytorium jest dziś w pełni dostępne i spójne.

Repozytorium: `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/.git`
(git-common-dir potwierdzony).

---

## 1. Tabela dziesięciu drzew roboczych

Branch → oczekiwany tip → rzeczywisty tip → czystość → osiągalność.
**Wszystkie dziesięć: CLEAN (zero niescommitowanych zmian), wszystkie SHA osiągalne.**

| Gałąź | Oczekiwany tip | Rzeczywisty tip | Czystość | Osiągalność |
|---|---|---|---|---|
| `codex/finance-v3-complete-product-integration` | `49071c3e2d` | `49071c3e2d157258e69d991b67c77e85f372306c` | CLEAN | osiągalny |
| `codex/fv3p-b3-valuationapi` | `9604652e27` | `9604652e27378eda475ef097154ed1909e555607` | CLEAN | osiągalny |
| `codex/fv3p-d-statements` | `53c2a6e382` | `53c2a6e3829c5e8e567a71e7d41d9eb2d77c80dd` | CLEAN | osiągalny |
| `codex/fv3p-e-analysis` | `1aa63c0385` | `1aa63c0385233683892f14d3a3d9d17cd06c2006` | CLEAN | osiągalny |
| `codex/fv3p-f-baseline` | `2057e0c888` | `2057e0c888f0470c1ceb246b13995497566b8591` | CLEAN | osiągalny |
| `codex/fv3p-a-determinism` | `1ac575a661` | `1ac575a6614052d2daa1acc3b0aa0aabd077d5b5` | CLEAN | osiągalny |
| `codex/fv3p-b-api` | `40ff98a94e` | `40ff98a94ec294ce4bdf15628271cf4f56d0a731` | CLEAN | osiągalny |
| `codex/fv3p-b2-domainapi` | `d0a9f13acb` | `d0a9f13acb756d9735027c418402d30b5401833e` | CLEAN | osiągalny |
| `codex/fv3p-c-uiplatform` | `ffc4c168ad` | `ffc4c168ad5354afaa5a0aae312727288c34a6fe` | CLEAN | osiągalny |
| `codex/fv3p-m-inventory` | `1a6c507f0d` | `1a6c507f0d7996268f9896b029e6466da91d84d8` | CLEAN | osiągalny |

---

## 2. Stan zamrożony

`codex/finance-v3-closeout-fanin` @ `19b4b06934` (ROI-E007 Round 1) — **POTWIERDZONY OSIĄGALNY
i NIETKNIĘTY**. Jest przodkiem tipa `36ae9b3665`. Zero modyfikacji.

---

## 3. Integralność repozytorium

`git fsck --no-progress`: **exit 0**. Wyłącznie obiekty `dangling` (30 pozycji: blob/tree/commit).
**Zero** uszkodzeń, **zero** brakujących obiektów, **zero** zerwanych referencji. Dangling to
normalna pozostałość po operacjach gita, nie uszkodzenie.

---

## 4. Porównanie z kopią ratunkową

Kopia: `/Users/piotrwisniewski/finance-v3-rescue-20260811-122123`.

`rsync -rcn` (porównanie po **sumie kontrolnej**, nie po dacie) dla wszystkich pięciu drzew:
**0 różnic**. Jedyny komunikat to pominięty dowiązanie symboliczne
`scripts/git-tools/hooks/post-commit` (celowo wykluczone przy tworzeniu kopii).

Manifest kopii deklaruje tipy: B3 `9604652e27`, D `53c2a6e382`, E `1aa63c0385`, F `2057e0c888`
— wszystkie **zgodne** z rzeczywistym stanem Git.

---

## 5. Niezależna kopia obiektów Git poza iCloud

Utworzona. `git bundle create --all` → `/Users/piotrwisniewski/fv3-git-backup/fv3-all-20260812.bundle`,
**2.0 GB**, exit 0. Nie pushowano niczego.

---

## 6. Kanoniczny SHA dalszej pracy

**`49071c3e2d`** (gałąź `codex/finance-v3-complete-product-integration`).

---

## 7. Korekta sprzeczności w kanonie (rozstrzygnięta odczytem Git)

`SESSION_HANDOFF_2026-08-11` §6 zawiera sprzeczność. Tabela w §6 mówi, że commit WIP pakietu B3
zawiera 2 pliki testów. Prozą kilka linijek niżej ten sam dokument twierdzi, że testy są
„napisane, ale niezacommitowane i nieuruchomione".

**Rozstrzygnięcie:** Git potwierdza, że commit `9604652e27` zawiera oba pliki testów, łącznie
**911 linii** (`valuation.routes.pg.test.ts` 655 linii + `valuation-cross-tenant.routes.pg.test.ts`
256 linii). Drzewo robocze jest czyste.

Poprawny opis stanu to: **ZACOMMITOWANE, ale NIGDY NIEURUCHOMIONE I NIEZWERYFIKOWANE.**
Sformułowanie „niezacommitowane" jest błędne i ma zniknąć z dokumentacji.

---

## 8. Rzeczywisty zakres czterech gałęzi WIP

Zmierzony przez `git diff --stat 45c39d68d0..HEAD`, nie deklarowany:

| Gałąź | Pliki | Linie | Uwagi |
|---|---|---|---|
| B3 — Valuation API | 11 | 2269 | `valuation.routes.ts` (771 linii, 21 endpointów), `index.ts` (+6, montaż), 7 serwisów `canonical/valuation*.ts`, 2 pliki testów (911 linii) |
| D — Statements | 13 | 1905 | modyfikuje `src/services/api/financeV2.api.ts` (+143) i `financeV2.types.ts` (+161) |
| E — Analysis | 14 | 2380 | modyfikuje `financeV2.api.ts` (+51) i `financeV2.types.ts` (+96) |
| F — Baseline | 11 | 2330 | modyfikuje `financeV2.api.ts` (+95) i `financeV2.types.ts` (+206) |

**Potwierdzona kolizja fan-in:** D, E i F modyfikują **równolegle** te same dwa pliki klienta API.
Przy fan-inie konflikt należy rozwiązać **zachowując wszystkie kompatybilne rozszerzenia** —
nie wybierać jednej wersji kosztem pozostałych domen.

---

## 9. Infrastruktura testowa (zbudowana 2026-08-12, poza repo)

Efemeryczny PostgreSQL 15, `PGDATA` `/Users/piotrwisniewski/fv3-pg/data`, port `54330`
(54329 był zajęty przez niepowiązaną sesję), nasłuch wyłącznie `127.0.0.1`, pgvector 0.8.6.

Baza szablonowa `fv3_template`: migracje **STRICT** (bez `--safe`) przez
`npx tsx server/scripts/migrate.postgres.ts` → **637/637 migracji, exit 0**, potwierdzone przez
`schema_migrations`.

Tabele: public **1451**, v8 **121**, razem **1572**. Referencja z poprzedniej sesji (mierzona na
`4489fdcab8`) mówiła public 1459 / razem 1580.

**Rozbieżność -8 tabel w schemacie public pozostaje `EVIDENCE_MISSING`, w toku diagnozy.**
Nie zaokrąglaj tego w górę i nie pomijaj.

Trzy kluczowe tabele Finance v3 **potwierdzone** przez `information_schema`:
`finance_analysis_kpi_values`, `finance_working_revisions`, `compute_job_outputs`.

Klonowanie bazy z szablonu: `/Users/piotrwisniewski/fv3-pg/newdb.sh <nazwa>`, ~25-28 s.

### ★ Trzynasta pułapka środowiskowa (nowa)

`server/src/config/databaseTargetResolver.ts` (funkcja `assertResolvedDatabaseUrlIsReachable`)
**odrzuca adresy localhost**, chyba że `allowLocalDatabaseForTests()` jest prawdziwe — czyli
wymaga `NODE_ENV=test` albo `CI=true` albo zmiennych `VITEST*`/`JEST_WORKER_ID`. Bez tego
migracje STRICT na lokalnej bazie padają z komunikatem
„Selected DATABASE_URL points to local host 127.0.0.1".

**Ta pułapka zazębia się z pułapką nr 1 i trzeba je czytać razem:** `NODE_ENV=test` jest
**konieczne**, żeby w ogóle połączyć się z lokalną bazą — ale `NODE_ENV=test` **bez**
`RUN_DB_TESTS=1` daje **cichy mock** (zielono, zero wartości dowodowej). Komplet wymaganych
zmiennych to **cztery naraz**: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `NODE_ENV=test` oraz jawny
`DATABASE_URL`.
