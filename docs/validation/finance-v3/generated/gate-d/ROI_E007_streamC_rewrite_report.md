# ROI-E007 Stream C (rewrite) — Finance-side reconciliation adapter + `PUT /benefits` repair

**Gałąź:** `codex/finance-v3-roi-e007-streamC-rewrite`
**Baza:** `c2ff92ac8b` (`Merge branch 'codex/results-vnext-g0-20260809' into codex/finance-v3-roi-e007-integration`)
**Data:** 2026-08-10
**Status testów:** 16/16 PASS na **realnym PostgreSQL** (efemeryczny klaster, patrz §5)

---

## 1. Co powstało

| Plik | Rola |
|---|---|
| `server/src/services/finance/canonical/roiFinanceReconciliationAdapter.ts` | NOWY — Finance-side adapter nad **kanonicznym** seamem ROI/Finance |
| `server/src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts` | NOWY — dowód na realnym Postgresie (16 testów, w tym kontrola negatywna) |
| `server/src/routes/economics.routes.ts` | ZMIANA **wyłącznie** w handlerze `PUT /api/economics/analyses/:id/benefits` + jeden import |
| `docs/validation/finance-v3/generated/gate-d/ROI_E007_streamC_rewrite_report.md` | ten raport |

Zakres diffu w `economics.routes.ts` potwierdzony nagłówkami hunków: blok importów
(linie 26–42) oraz wnętrze `router.put('/analyses/:id/benefits', …)` (1564–1802).
Żadnego innego handlera nie ruszono.

---

## 2. Eksportowane funkcje adaptera

```ts
export const PROVISIONAL_MATERIALITY_THRESHOLD_PCT = 5;      // Gate B §7 / B02-Q4 placeholder

export function assessMateriality(roiValue, financeValue, thresholdPercent?): MaterialityVerdict;
export async function detectAndReconcile(params: DetectAndReconcileParams): Promise<DetectAndReconcileResult>;
export async function resolveReconciliationDecision(
  reconciliationId, resolvedBy, notes, resolution: 'resolved' | 'accepted_divergence', options?
): Promise<RoiFinanceReconciliation>;
export async function findReconciliationTargetForInitiative(params): Promise<ResolveReconciliationTargetResult>;
export async function findActiveRoiCaseIdForInitiative(organizationId, initiativeId): Promise<string | null>;

export class RoiFinanceReconciliationAdapterError extends Error;   // code
export class ReconciliationNotFoundError extends RoiFinanceReconciliationAdapterError;
export type RoiFinanceReconciliationResolution = 'resolved' | 'accepted_divergence';
export interface MaterialityVerdict, DetectAndReconcileParams, DetectAndReconcileResult,
                 ResolveReconciliationOptions, ReconciliationTarget,
                 ResolveReconciliationTargetResult, FindReconciliationTargetParams;
```

### `detectAndReconcile`
Próg istotności **5%** (`PROVISIONAL_PENDING_OWNER_DECISION`, Gate B
`GATE_B_INTEGRATION_RECONCILIATION.md` §7 / B02-Q4 — decyzja właścicielska #8).
Baza procentu = `|roiValue|`, a gdy strona ROI = 0, to `|financeValue|`
(„5% wartości linii **jak zaksięgowana**”, nie 5% tego, co Finance dopiero proponuje).
Rozbieżność **dokładnie na progu** jest celowo NIEistotna (próg = domykająca krawędź
pasma tolerancji). Powyżej progu adapter woła **kanoniczną** komendę
`openRoiFinanceReconciliation` z jawnymi skalarami `roi_value`/`finance_value`
(kolumny NUMERIC seamu, nie jsonb). Poniżej progu **nie pisze nic** — ani wiersza,
ani zdarzenia, ani wpisu do outboxa (zweryfikowane licznikami przed/po, §5).
`thresholdPercent` jest parametrem, nie stałą w call-site — próg per-organizacja da
się przeciągnąć bez zmiany logiki, gdy właściciel zdecyduje.

### `resolveReconciliationDecision`
Cienki wrapper nad kanoniczną `updateRoiFinanceReconciliationStatus`. Jedyna realna
praca: zamiana gołego `reconciliationId` na trójkę `{caseId, organizationId,
expectedVersion}`, której komenda wymaga. CAS respektowany: `expectedVersion` z
`options` idzie prosto do komendy (stała wartość → `AtomicWriteConflictError` /
`STALE_VERSION`); bez niego czytany jest bieżący `row_version` tuż przed zapisem
(nadal CAS na poziomie bazy, ale to wygoda „last-writer-wins”, nie optimistic
concurrency — udokumentowane przy typie). `resolved_by`/`resolved_at` ustawia
komenda kanoniczna, nie adapter. Podany `organizationId` jest **egzekwowany** —
rekord z innej organizacji zwraca `RECONCILIATION_NOT_FOUND`, nie 403.

### Czego adapter NIE robi
Zero `INSERT`/`UPDATE`/`DELETE` na `roi_realized_values`,
`v8_roi_realization_entries`, `benefit_tracking` — potwierdzone grepem, w repo
pozostaje jako weryfikowalne twierdzenie. Zero własnego SQL-a piszącego do
`rvn_roi_finance_*`. Dwa surowe **odczyty** (case po `initiative_id`,
reconciliation po PK) są udokumentowanymi wyjątkami przy call-site — kanoniczne
czytniki wymagają trójki `{userId, organizationId, caseId}` do złączenia ABAC,
a te wejścia dopiero mają tę trójkę ustalić.

---

## 3. Jak naprawiono `PUT /api/economics/analyses/:id/benefits`

Stan przed: gałąź UPDATE ustawiała `actual_cost_savings = ?` bezwarunkowo. Przed
migracją `20260809_finance_v3_e007_03_legacy_actual_protection.sql` **cicho
nadpisywała** wcześniej zarejestrowaną wartość rzeczywistą; po migracji trigger
`trg_benefit_tracking_deny_actual_overwrite` podnosi wyjątek, którego `try/catch`
handlera nie rozpoznawał (obsługiwał tylko `FinanceStorageUnavailableError`) — więc
endpoint zwracał gołe **500**. Oba zachowania były nieakceptowalne; ta niezgodność
była wprost zapowiedziana w nagłówku migracji jako zadanie dla Streamów B/C/D.

Nowy przebieg (kolejność jest istotna — decyzja zapada **przed** jakąkolwiek mutacją):

1. `SELECT id, actual_cost_savings …` dla `(organization_id, initiative_id, tracking_period)`.
2. Porównanie z żądaną wartością **w kodzie**, tą samą semantyką co trigger
   (`IS DISTINCT FROM`) — dzięki temu chroniona kolumna nigdy nie trafia do UPDATE-a,
   który by trigger uruchomił.
3. Gdy wartości są **różne**:
   - szukamy celu uzgodnienia: `findReconciliationTargetForInitiative`
     (aktywny `rvn_roi_cases` dla inicjatywy + widoczny link z
     `listRoiFinanceLinks`);
   - **jest cel** → `detectAndReconcile(roiValue = wartość zapisana,
     financeValue = wartość żądana)` → **200** z `reconciliationId`,
     `storedActualBenefits`, `requestedActualBenefits`,
     `actualBenefitsWriteRejected: true`;
   - **brak celu** → **409** `ROI_RECONCILIATION_TARGET_MISSING` z `reason`
     (`NO_ACTIVE_ROI_CASE` / `NO_FINANCE_LINK`) i komunikatem
     „Brak powiązanego ROI Case — wartość niezmieniona…”. **Nic** nie jest wtedy
     zapisywane, także kolumny, których trigger by przepuścił;
   - awaria samego seamu (np. brak tabel `rvn_*`) → **503**
     `ROI_RECONCILIATION_STORAGE_UNAVAILABLE` / `ROI_RECONCILIATION_WRITE_FAILED`,
     nigdy `success: true`.
4. UPDATE buduje listę kolumn warunkowo: `actual_cost_savings` pojawia się w SQL
   **tylko** gdy jest niezmieniona. Na ścieżce rozbieżności zapisują się
   `planned_cost_savings`, `overall_variance_percent`, `updated_at` — zwykły
   przepływ „zweryfikuj okres” działa dalej.
5. `overall_variance_percent` liczona jest od wartości **zapisanej**, nie od
   odrzuconej — zapis wariancji policzonej wobec liczby, której wiersz nie zawiera,
   byłby cichszą wersją tego samego kłamstwa.
6. Obrona w głębi: lokalny `isBenefitTrackingActualProtectionError` rozpoznaje
   komunikat triggera i zwraca **409** `BENEFIT_ACTUAL_APPEND_ONLY`, gdyby zapis
   równoległy zmienił wartość między naszym SELECT a UPDATE. Ścieżki do 500 nie ma.
7. Ścieżka INSERT (nowy okres) bez zmian — trigger pilnuje tylko UPDATE/DELETE.
8. Gdy rozbieżność jest **poniżej progu**: uzgodnienia się nie otwiera, ale
   odpowiedź NIE udaje zwykłego sukcesu — niesie `actualBenefitsWriteRejected: true`,
   `reconciliationOpened: false` i `storedActualBenefits`. Cicha NIE-zapisana wartość
   byłaby lustrzanym odbiciem tego samego defektu, który zamykamy.

---

## 4. Środowisko testowe (realny Postgres, nie atrapa)

```
initdb  : /opt/homebrew/opt/postgresql@15/bin (PostgreSQL 15) --locale=C --encoding=UTF8
PGDATA  : /private/tmp/roi-e007-streamC-pg/data     (usunięte po sesji)
socket  : /private/tmp/roiC-sock                    (krótka ścieżka gniazda)
port    : 56317   (sprawdzony `lsof -i:56317` = FREE; zakres 55000-59999)
baza    : consultify_roi_c
```

Dwie pułapki napotkane i rozwiązane, warte zapamiętania dla następnych sesji:

- **`LC_ALL=C` trzeba mieć także przy `pg_ctl start`, nie tylko przy `initdb`.**
  Bez tego macOS/Homebrew daje `FATAL: postmaster became multithreaded during startup`
  i `pg_ctl` kończy się „could not start server” bez żadnej wskazówki w stdout.
- **`postgresql@16` w tym środowisku NIE MA pgvector** (`vector.dylib` jest tylko dla
  `postgresql@15`; formuła `pgvector` zbudowana dla 17/18 nie jest podlinkowana).
  Migracja `20260719_baseline_gap.sql` wywala się na `extension "vector" is not
  available`. Klaster musi stać na **`postgresql@15`**.

Migracje: `DB_TYPE=postgres NODE_ENV=test DATABASE_URL=… npx tsx
server/scripts/migrate.postgres.ts` (tryb **strict**, bez `--safe`) → `EXIT=0`,
`✅ Postgres migrations complete`, 1448 tabel w `public`.

**Znana luka schematu, potwierdzona na żywo (nie defekt tej pracy):** świeża,
ściśle zmigrowana baza **nie ma `benefit_tracking`** — migracje 067/068 są odcinane
przez `isSqliteOnlyMigration()` w `migrate.postgres.ts`, więc blok
`benefit_tracking` w migracji ochronnej wchodzi w gałąź `ELSE to_regclass(...)`
i **pomija triggery bez błędu**. Dokładnie to, co przewiduje nagłówek tej migracji.
Suite radzi sobie z tym jawnie w `beforeAll`: tworzy tabelę w kształcie
postgresowym, gdy jej nie ma, a następnie wykonuje **realny plik migracji
ochronnej z dysku, dosłownie**, i twardo sprawdza obecność
`trg_benefit_tracking_deny_actual_overwrite` — trigger pod testem jest artefaktem
produkcyjnym, nie przepisaną atrapą.

---

## 5. REALNE wyniki testów

Komenda (cwd = `server/`, bo `vitest.config.ts` bierze root z cwd, nie z lokalizacji configu):

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:56317/consultify_roi_c \
npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts \
  --no-file-parallelism
```

```
Test Files  1 passed (1)
     Tests  16 passed (16)
```

| # | Test | Wynik |
|---|---|---|
| 1 | powyżej progu → uzgodnienie z jawnymi `roi_value=100` / `finance_value=120`, `status='open'` | PASS |
| 2 | poniżej progu (4%) → **zero** wierszy i **zero** zdarzeń (liczniki przed/po) | PASS |
| 3 | dokładnie na progu (5%) → nieistotne | PASS |
| 4 | własny próg (1%) honorowany | PASS |
| 5 | link spoza case'a → `FINANCE_LINK_NOT_FOUND` (walidacja kanoniczna) | PASS |
| 6 | `roi_realized_values` nietknięte | PASS |
| 7 | `resolved` → `resolved_by`/notatki, `row_version` +1, skalary nienaruszone | PASS |
| 8 | `accepted_divergence` → `resolved_at` ustawione | PASS |
| 9 | CAS: `expectedVersion: 99` → `STALE_VERSION`, wiersz dalej `open` | PASS |
| 10 | inna organizacja → `RECONCILIATION_NOT_FOUND` | PASS |
| 11 | `investigating` przez `resolveReconciliationDecision` → `INVALID_RECONCILIATION_RESOLUTION` | PASS |
| 12 | **REGRESJA A**: 900→1500 z Case+linkiem → **200**, `reconciliationId`, `benefit_tracking.actual_cost_savings` dalej **900**, `planned` zapisane na 1200, wariancja liczona od 900 | PASS |
| 13 | **REGRESJA B**: 400→999 bez Case → **409** `NO_ACTIVE_ROI_CASE`, wartość dalej **400**, `planned` dalej 500, **nie 500** | PASS |
| 14 | niezmieniona wartość → zwykły 200, `planned` zapisane (przepływ weryfikacji nietknięty) | PASS |
| 15 | rozbieżność podprogowa → 200 z `actualBenefitsWriteRejected`, bez uzgodnienia | PASS |
| 16 | **kontrola negatywna**: surowy, stary UPDATE odrzucony przez trigger (`/append-only/`) | PASS |

Wszystkie odczyty weryfikujące idą **osobnym klientem `pg`**, nie tą samą ścieżką,
która pisała — asercja przez własny kod zapisu niczego by nie dowiodła.

### Kontrola negatywna na samej NAPRAWIE (czy harness w ogóle łapie regresję)

Testowo zamieniłem w handlerze `const updateSql = actualWriteRejected ? …`
na `const updateSql = false ? …` (czyli przywróciłem bezwarunkowy zapis
`actual_cost_savings`) i uruchomiłem tę samą suitę:

```
Tests  2 failed | 14 passed (16)
  ✗ REGRESSION A …  AssertionError: expected 409 to be 200
  ✗ sub-threshold … AssertionError: expected 409 to be 200
```

Harness **łapie** regresję. Przy okazji wyszło, że warstwa 6 (obrona w głębi)
działa: nawet z rozbitą naprawą endpoint oddał **409**, nie 500. Plik przywrócono
z kopii i suita wróciła do 16/16.

### Testy sąsiadujące (brak regresji)

- `src/services/finance/canonical/__tests__/` (cały katalog, realny PG):
  **16 plików / 204 testy PASS**.
- `tests/unit/backend/economicsBusinessCaseStub.test.ts` (ten sam router, atrapa
  `DbPromise`): **3/3 PASS** — nowy statyczny import nie rozwalił istniejącej suity.
- `tsc --noEmit -p server/tsconfig.json`: 19 błędów w repo, **0 w plikach tej
  pracy** (wszystkie w `lineageService.ts` i `roi/engine/roiCalculationEngine.ts`,
  nietkniętych — preegzystujące).
- `eslint`: 0 błędów w trzech zmienionych plikach (po `--fix`; pozostały wyłącznie
  preegzystujące ostrzeżenia `no-explicit-any` w `economics.routes.ts`).

Sprzątanie: klaster zatrzymany (`pg_ctl stop`), `/private/tmp/roi-e007-streamC-pg`
i `/private/tmp/roiC-sock` usunięte. Suita sama czyści swoje wiersze
`benefit_tracking` / `rvn_roi_finance_*` (guard DELETE zdejmowany tylko na czas
własnego czyszczenia i natychmiast przywracany); `rvn_roi_cases` i
`rvn_platform_events` są append-only i zostają, tak jak dokumentuje
`canonicalServices.pg.test.ts`.

---

## 6. Odchylenie od zlecenia — do wiadomości orkiestratora

Zlecenie kazało użyć `server/src/services/finance/canonical/roiFinanceLinkAdapter.ts`
ze Streamu B (commit `59c165c364`). **Tego pliku nie ma w drzewie tej gałęzi**:

```
git merge-base --is-ancestor 59c165c364 HEAD   → NOT ANCESTOR
git branch -a --contains 59c165c364            → codex/finance-v3-roi-e007-streamB-rewrite
```

Stream B żyje na własnej, jeszcze nie scalonej gałęzi. Import z niego nie skompilowałby
się tutaj, a wciągnięcie jego plików wykracza poza allowlistę. Adapter woła więc
**bezpośrednio kanoniczne `roiFinanceLinkRepository.listRoiFinanceLinks`** — czyli
dokładnie to, co `listFinanceLinksForCase` ze Streamu B opakowuje („thin wrapper over
the canonical `listRoiFinanceLinks` repository”, jego własny komunikat commita).
Reguła „adapter woła kanon, nie duplikuje SQL” jest zachowana; po scaleniu Streamu B
podmiana na jego wrapper to zmiana jednej linii importu, bez zmiany logiki.

Testy z tego samego powodu tworzą link przez kanoniczną komendę
`roiFinanceLinkCommands.createRoiFinanceLink`, nie przez adapter Streamu B.

## 7. Otwarte / do decyzji

1. **Próg 5% jest placeholderem.** `PROVISIONAL_MATERIALITY_THRESHOLD_PCT` nie może
   wejść do żadnej bramki GO jako liczba finalna bez decyzji właścicielskiej #8.
2. **`benefit_tracking` nie powstaje na świeżej, ściśle zmigrowanej bazie** (§4).
   Dopóki 067/068 nie trafią do manifestu `migrate.postgres.ts`, migracja ochronna
   po cichu pomija triggery na takim środowisku — endpoint zachowa się wtedy jak
   przed ROI-E007 (nadpisze actual bez oporu bazy; kod handlera i tak go nie
   nadpisze, ale fizycznej gwarancji nie będzie). To decyzja platformowa poza
   zakresem Streamu C, ta sama, którą flaguje nagłówek migracji Streamu A.
3. **`NO_FINANCE_LINK` a widoczność.** Case bez widocznego dla wołającego linku
   zwraca ten sam 409 co case bez linku w ogóle. To poprawna odpowiedź dla tego
   wołającego (ABAC), ale w UI może wyglądać jak „nie ma linku”, gdy link jest —
   tylko nie dla tego użytkownika. Warte rozróżnienia, gdy powstanie ekran.
