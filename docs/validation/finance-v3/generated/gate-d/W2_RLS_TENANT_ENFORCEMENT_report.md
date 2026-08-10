# W2 — Wymuszanie granicy najemcy na poziomie bazy (RLS) — EM-9

**Status: `PARTIAL_PILOT` — polityki wdrożone i zweryfikowane empirycznie na własnym klastrze, ale
DZIŚ INERTNE dla ruchu produkcyjnego. Blocker realnej ochrony: `EVIDENCE_MISSING` / `BLOCKED` —
brak roli least-privileged do bazy (zaległość Gate A, poza zakresem repo).**

Gałąź: `codex/finance-v3-w2-rls`. Baza (przed pracą): `cecc7975c1` (merge
`codex/finance-v3-p0tenant` → `codex/finance-v3-wave2-fanin`). Klaster: efemeryczny,
`postgresql@15`, port `57681`, `PGDATA=/private/tmp/fv3-rls-pgdata` — nigdy demo/staging/prod.

Kontekst źródłowy: `docs/validation/finance-v3/generated/gate-d/W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md`
§4/§4.2/§7 (EM-9), `docs/validation/finance-v3/generated/gate-d/P0_TENANT_ISOLATION_FIX_report.md`,
`docs/validation/finance-v3/generated/gate-a/WP-A04_security_closure.md` §7 (least-privileged rola —
OPEN, poza zakresem repo).

---

## 1. Diagnoza (Etap 1) — zmierzona zapytaniami, nie założona

### 1.1 Kto jest właścicielem połączenia?

Na własnym, świeżo zainicjowanym klastrze (`initdb -U postgres`, migracje `migrate.postgres.ts`
uruchomione jako `postgres`):

```
current_user | session_user
--------------+--------------
 postgres     | postgres

rolname  | rolsuper | rolbypassrls
----------+----------+--------------
 postgres | t        | t
```

Cały klaster ma **dokładnie jedną rolę** poza wbudowanymi `pg_*`: `postgres`, superuser,
`rolbypassrls=true`. Ta sama rola jest **właścicielem każdej tabeli** `finance*`/`compute*`
(sprawdzone dla pierwszych 15 — `tableowner = postgres` bez wyjątku).

To nie jest artefakt tylko efemerycznego klastra — to jest dokładnie to, co
`WP-A04_security_closure.md` §7 już ustalił dla repo jako całości: **„Osobna, least-privileged
rola DB dla local/staging: nie znaleziono żadnego `CREATE ROLE`/`GRANT`… To pozostaje OPEN (poza
zakresem repo)."** `server/scripts/migrate.postgres.ts` i `PostgresDatabase.ts::getPool()` łączą
się przez cokolwiek jest w `DATABASE_URL` — nic w kodzie nie tworzy ani nie wymusza roli
ograniczonej. Railway-owy Postgres (prod=`centerbeam`, demo=`trolley`, dev=`thomas` — patrz pamięć
`db-hosts-prod-demo`) domyślnie prowizjonuje jedną rolę `postgres` jako właściciela/superusera; bez
osobnej, udokumentowanej roli aplikacyjnej nie mam podstaw sądzić, że produkcja/demo łączą się
inaczej niż migracje na tym klastrze.

**Konsekwencja wprost z dokumentacji Postgresa (§ Row Security Policies):** superuser i role z
`BYPASSRLS` **zawsze** omijają RLS, **niezależnie od `FORCE ROW LEVEL SECURITY`** — `FORCE` odnosi
się wyłącznie do obejścia przez *właściciela tabeli*, nie przez superusera. Zweryfikowane
empirycznie w Etapie 3 (STATE 3 poniżej): z aktywną polityką, bez żadnego `SET LOCAL`, connection
jako `postgres` widzi wiersz obcej organizacji bez przeszkód.

**Wniosek:** jeśli aplikacja/migracje łączą się jako `postgres` (co jest zmierzonym stanem tu i
jedynym udokumentowanym stanem gdziekolwiek indziej w repo) — **RLS wdrożone dziś nie chroni
niczego w realnym ruchu.** To dokładnie ten fantom, przed którym ostrzega zadanie.

### 1.2 Skąd polityka ma wziąć tożsamość najemcy? Ryzyko puli połączeń.

Przed tą pracą: **zero miejsc** w `server/src` ustawiały `app.organization_id` ani jakikolwiek
GUC tożsamości najemcy (`grep -rn "app\.organization_id\|current_setting" server/src` → 0
trafień). `withPinnedPostgresTransaction` (`server/src/database/PostgresDatabase.ts`) otwierało
`BEGIN`/pracę/`COMMIT` na jednej fizycznej pinowanej konekcji, ale nigdy nie ustawiało żadnego GUC
sesji/transakcji poza `search_path` (ustawianym raz, na `pool.on('connect')`, per fizyczne
połączenie — nie per request).

To druga, niezależna od superusera przyczyna, dla której RLS nie mógł zadziałać wcześniej: nawet
gdyby połączenie NIE było superuserem, `current_setting('app.organization_id', true)` zwracałoby
zawsze `NULL`, a `organization_id = NULL` nigdy nie jest `TRUE` — czyli polityka blokowałaby
**wszystkich, zawsze** (fail-closed, ale bezużytecznie).

Dodatkowe ryzyko architektoniczne (komentarz w kodzie, `PostgresDatabase.ts` ok. linii 564–587,
autorstwa FIN-005): **`DbPromise`, jedyne API bazodanowe używane przez warstwę serwisów, kieruje
każdy statement przez `pool.query()`, który dobiera DOWOLNE wolne połączenie z puli per wywołanie.**
Znaczna część zapytań w tym kodzie **nie jest w ogóle spięta transakcją/pinowaną konekcją** — nie
ma więc nawet miejsca, w którym dzisiejszy kod mógłby wykonać `SET LOCAL` przed takim zapytaniem.
Pełne okablowanie RLS na całą warstwę danych wymagałoby albo (a) przejścia każdego callera na
`withPinnedPostgresTransaction` z `organizationId`, albo (b) analogicznego mechanizmu w `DbPromise`
— żadne z tych nie jest w zakresie tego zadania (dotyka dziesiątek plików serwisowych, część
własność innych agentów).

**Co dostarczyłem (Etap 2, patrz niżej):** `withPinnedPostgresTransaction` dostał **opcjonalny**
parametr `organizationId`, który — jeśli podany — wykonuje
`SELECT set_config('app.organization_id', $1, true)` zaraz po `BEGIN`. Trzeci argument `true`
(`is_local`) czyni to **dokładnie** odpowiednikiem `SET LOCAL` — ustawienie umiera przy
`COMMIT`/`ROLLBACK` i nigdy nie przecieka na inny request, który pula odda tej samej fizycznej
konekcji później. Parametr jest **opt-in i domyślnie `undefined`** — zero callerów wymaga zmiany,
zero ryzyka regresji dla istniejących wywołań. To **plumbing**, nie „RLS działa teraz
end-to-end" — żaden istniejący serwis (poza nowym testem pilotażowym) go jeszcze nie wywołuje.

### 1.3 Ile tabel `finance*`/`compute*` ma `organization_id`?

Na świeżo zmigrowanym klastrze:

| | liczba |
|---|---|
| Tabele `finance*`/`compute*` razem | **66** |
| …z kolumną `organization_id` | **61** |
| …BEZ kolumny `organization_id` | **6** |

Tabele bez `organization_id` (świadomie poza zakresem jakiejkolwiek polityki tenant-scoped — nie
mają czego filtrować):
`compute_job_runs`, `finance_engine_manifests`, `finance_export_evidence_items`,
`finance_export_manifest_sources`, `finance_prediction_driver_line_map`, `finance_reason_codes`.

Wszystkie 61 kolumn `organization_id` w rodzinie `finance*`/`compute*` są typu **`text`** (nie
`uuid`) — polityki poniżej nie potrzebują rzutowania.

**Wyjątek wymagający uwagi, świadomie POMINIĘTY w pilotażu:** `finance_analysis_kpi_catalog` MA
kolumnę `organization_id`, ale jest ona **nullable**, a wszystkie 18 wierszy po świeżych migracjach
mają `organization_id IS NULL` — to katalog globalny (kanoniczne definicje KPI współdzielone przez
wszystkich najemców), nie per-org dane. Naiwna polityka
`organization_id = current_setting(...)` ukryłaby te wiersze przed KAŻDYM najemcą — regresja, nie
naprawa. Objęcie takich tabel RLS wymaga innego kształtu polityki
(`organization_id = current_setting(...) OR organization_id IS NULL`) i jest poza zakresem tego
pilotażu.

---

## 2. Decyzja wdrożeniowa

**Pilotaż WDROŻONY** (Etap 2), na wąskim, reprezentatywnym zestawie trzech tabel, które W9 fault
matrix realnie złapał na wycieku przed naprawą aplikacyjną P0:

- `compute_jobs` (P0: organizacja A czytała i **anulowała zadanie** organizacji B)
- `finance_valuation_sensitivity_grids`
- `finance_valuation_sensitivity_cells` (P0: organizacja A **kasowała 25 komórek siatki**
  organizacji B)

**Uzasadnienie wdrożenia MIMO inertności dla dzisiejszego ruchu:** polityki `ENABLE`+`FORCE ROW
LEVEL SECURITY` na tabeli, której jedyny łączący się dziś użytkownik jest superuserem, są
**bezpieczne do wdrożenia already now** — nie zmieniają zachowania aplikacji ani o jotę (superuser
i tak wszystko widzi/zmienia), więc migracja nie niesie ryzyka regresji na dzisiejszej
infrastrukturze. Jednocześnie dają: (a) dowód, że mechanizm jest poprawny, gdy tylko rola
połączenia się zmieni — bez czekania na kolejną migrację w krytycznym momencie, (b) formalny,
widoczny w `pg_policies` zapis granicy najemcy jako intencji, (c) test negatywnej kontroli, który
udowadnia to empirycznie, nie deklaratywnie.

**Nie rozszerzyłem pilotażu na pozostałe 58 tabel z `organization_id`** — zadanie explicite prosi o
wąski zestaw, a każda kolejna tabela to osobna weryfikacja kształtu FK/trygerów (np. tabele-katalogi
z `organization_id IS NULL`, tabele bez PK na `(id, organization_id)` itd.) — rozszerzenie
najlepiej robić falami, tabela po tabeli, z tym samym trzy-stanowym dowodem, nie hurtem.

### 2.1 Co wdrożone

Nowa, ADDYTYWNA migracja:
`server/migrations/20260826_finance_v3_w2_rls_pilot_policies.sql` (+ rollback:
`server/migrations/rollback/20260826_finance_v3_w2_rls_pilot_policies.down.sql`).

Dla każdej z 3 tabel:
```sql
ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_<tabela> ON <tabela>
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
```

- `USING` **i** `WITH CHECK` — samo `USING` nie zatrzymałoby zapisów (INSERT/UPDATE).
- `current_setting(..., true)` — `missing_ok=true`: brak ustawionego GUC daje `NULL`, więc
  domyślnie **fail-closed** (zero wierszy), nie fail-open.
- `FORCE` na wszystkich trzech — domyka lukę „właściciel tabeli też bypassuje RLS domyślnie"; **nie
  domyka** luki superusera (nic tego nie potrafi, patrz §1.1).

Warstwa dostępu do bazy: `withPinnedPostgresTransaction()` w
`server/src/database/PostgresDatabase.ts` — nowy opcjonalny drugi parametr
`options?: PinnedTransactionOptions` z polem `organizationId`, ustawiany przez `SELECT
set_config('app.organization_id', $1, true)` zaraz po `BEGIN`. Backward-compatible, opt-in, zero
zmian w istniejących callerach.

### 2.2 Świadomie pominięte

- **58 pozostałych tabel `finance*`/`compute*` z `organization_id`** — poza zakresem tego
  pilotażu (patrz uzasadnienie w §2 wyżej).
- **`finance_analysis_kpi_catalog`** — katalog globalny (`organization_id IS NULL` dla wszystkich
  wierszy po świeżych migracjach), NIE dostaje polityki tenant-scoped bez zmiany jej kształtu.
- **6 tabel bez `organization_id`** (`compute_job_runs`, `finance_engine_manifests`,
  `finance_export_evidence_items`, `finance_export_manifest_sources`,
  `finance_prediction_driver_line_map`, `finance_reason_codes`) — nie mają czego filtrować.
- **Rola least-privileged** — NIE utworzona przez migrację. Utworzenie roli w migracji, która
  kiedyś dotrze na Railway, bez jednoczesnej zmiany `DATABASE_URL` aplikacji na tę rolę (zmiana
  środowiskowa na Railway, poza dostępem tej sesji), tworzyłaby martwą, nieużywaną rolę i fałszywe
  wrażenie postępu. Rola testowa (`fv3_rls_pilot_<random>`) istnieje WYŁĄCZNIE w
  `rlsPilotEnforcement.pg.test.ts`, tworzona i usuwana per uruchomienie testu, na własnym
  efemerycznym klastrze — nigdy jako trwały obiekt migracji.

---

## 3. Kontrola negatywna — TRZY STANY (Etap 3)

Nowy plik:
`server/src/services/finance/canonical/__tests__/rlsPilotEnforcement.pg.test.ts` (6 testów, wszystkie
zielone na realnym Postgresie, `--no-file-parallelism`).

Metoda: throwaway rola `fv3_rls_pilot_<random>` — `NOSUPERUSER NOBYPASSRLS`, **nie** właściciel
żadnej z trzech tabel (zweryfikowane wprost testem `sanity:`), z jawnym `GRANT SELECT, INSERT,
UPDATE, DELETE`. Dwie organizacje zaseedowane przez REALNĄ warstwę serwisów
(`artifactVersionService.createArtifact`, `computeJobService.enqueue`,
`valuationComputeService.findOrCreateMethod`, `valuationSensitivityService.writeSensitivityGrid` —
25 komórek dla org B), nie syntetyczne wiersze. Atak wykonywany **raw SQL-em, z pominięciem
warstwy serwisowej** — bo to serwisowa warstwa już jest naprawiona (P0/FIXED W9-C-3/W9-C-4);
RLS ma bronić wtedy, gdy WARSTWA APLIKACJI zawiedzie, więc test świadomie ją omija.

| Stan | Rola | `SET LOCAL app.organization_id` | Polityka | Wynik cross-tenant SELECT/UPDATE/DELETE na wierszu org B |
|---|---|---|---|---|
| **1 — Z polityką** | `fv3_rls_pilot_*` (non-superuser, non-owner) | `= orgA` (błędny — próbuje dostać się do wiersza org B) | ENABLED+FORCE | **0 wierszy / 0 zmian** na `compute_jobs` i na `finance_valuation_sensitivity_grids`/`_cells` (wszystkie 25 komórek B przeżywają) |
| **1b — kontrola pozytywna** | jw. | `= orgB` (poprawny) | ENABLED+FORCE | własny wiersz **widoczny** — polityka nie blokuje właściciela |
| **2 — BEZ polityki** | jw. (ta sama rola!) | `= orgA` (ten sam błędny kontekst) | `DISABLE ROW LEVEL SECURITY` | wiersz org B **widoczny i modyfikowalny** (`SELECT`→1 wiersz, `UPDATE`→`rowCount=1`) — dowodzi, że w Stanie 1 blokowała POLITYKA, nie brakujący `GRANT` ani FK |
| **3 — Z polityką, jako superuser** | `postgres` (rola łącząca dziś migracje/realnie prawdopodobnie i aplikację) | brak (nie ustawiane w ogóle) | ENABLED+FORCE | wiersz org B **widoczny bez przeszkód** — bo superuser zawsze omija RLS, z `FORCE` czy bez. To jest **dzisiejszy, rzeczywisty stan produkcyjnego ryzyka**, nie błąd testu. |

Rozstrzygnięcie „która warstwa broni": kontrast Stan 1 vs Stan 2 na TEJ SAMEJ roli, TYM SAMYM
błędnym kontekście, jedyna zmienna to `ENABLE`/`DISABLE ROW LEVEL SECURITY` — jednoznacznie
pokazuje, że blokadę w Stanie 1 daje polityka RLS, a nie np. złożony FK `(grid_id,
organization_id)` z migracji W9-C-7 (ten FK chroniłby tylko przed WPISANIEM złej kombinacji, nie
przed SELECT/UPDATE/DELETE cudzego wiersza z poprawną kombinacją klucza).

Bramka DB potwierdzona: uruchomienie pliku bez `RUN_DB_TESTS=1`/`MOCK_DB=false`/realnego
`DATABASE_URL` daje `skipIf` → `skipped`, ten sam mechanizm co reszta repo (zero nowego wzorca).

---

## 4. Wpływ na istniejące testy

**Punkt odniesienia PRZED zmianami** (ten sam efemeryczny klaster, ta sama migracja bazowa,
`src/services/finance/canonical`, `--no-file-parallelism`):

```
Test Files  1 failed | 30 passed (31)
     Tests  417 passed | 4 skipped (421)
```

Jedyny czerwony plik: `coldReopen.pg.test.ts` — **przedistniejący defekt, niezwiązany z RLS**,
zdiagnozowany przez orkiestratora na gałęzi fan-in: `findOrCreateMethod()` zmienił się z gołego
wiersza na typowaną unię `{ok:true, method} | {ok:false, code}` w ramach naprawy P0, a
`coldReopen.pg.test.ts` (żyjący wcześniej na innej gałęzi) wciąż czyta `.id` prosto z unii →
`method_id: undefined` → nowy strażnik własności w `writeSensitivityGrid` słusznie odrzuca. Ten sam
błąd występuje identycznie PRZED i PO tej pracy — potwierdzone, licz go jako pre-existing, nie jako
regresję RLS.

**Punkt odniesienia PO zmianach** (migracja RLS zastosowana + `withPinnedPostgresTransaction`
rozszerzone + nowy plik testowy + poprawka jednego istniejącego testu):

```
Test Files  1 failed | 31 passed (32)
     Tests  423 passed | 4 skipped (427)
```

Delta: **+1 plik / +6 testów — dokładnie `rlsPilotEnforcement.pg.test.ts`, wszystkie zielone.**
Zero nowych czerwonych plików. Jedyny czerwony plik to wciąż `coldReopen.pg.test.ts`, ten sam
przedistniejący defekt.

**Jedna istniejąca asercja musiała zostać ZAKTUALIZOWANA** (nie usunięta —
`tenantMatrix.pg.test.ts`, test `cross-cutting`): wcześniej pinowała „zero polityk RLS gdziekolwiek
w finance*/compute*" — to od tej migracji nieprawda. Przepisana zgodnie z dyscypliną „nie może
zniknąć" już stosowaną w tym pliku (wzorzec `FIXED W9-C-n`): teraz pinuje **dokładnie te trzy
tabele i żadnej więcej** — każde przyszłe rozszerzenie LUB regresja zakresu RLS zaczerwieni ten
test. Diff jest w commicie tego etapu.

`tsc -p server`: **exit 0** (przed i po). Migracje STRICT (`npx tsx server/scripts/migrate.postgres.ts`,
bez `--safe`, świeży klaster): **exit 0**, potwierdzone dwukrotnie (przyrostowo na klastrze
roboczym i od zera na dodatkowym, jednorazowym `fv3_rls_fresh`).

---

## 5. Rekomendacja dla bramki FC-01

**NIE zamykać FC-01 na podstawie tego pilotażu.** Powód: „polityka istnieje" ≠ „granica najemcy
istnieje w bazie" dopóki rola połączenia to superuser — a to jest dziś zmierzony, jedyny znany
stan. FC-01 powinien pozostać oparty o to, co faktycznie broni ruchu produkcyjnego: warstwę
aplikacyjną (P0_TENANT_ISOLATION_FIX + testy `tenantMatrix.pg.test.ts` FIXED W9-C-1..C-7), z RLS
jako **udokumentowanym, zweryfikowanym, ale jeszcze nieaktywnym** drugim pierścieniem obrony.

Rekomendowany dalszy krok (poza zakresem tej sesji, wymaga infrastruktury): utworzyć na Railway
(prod/demo/dev) dedykowaną rolę aplikacyjną `NOSUPERUSER NOBYPASSRLS`, będącą właścicielem lub co
najmniej grantee tabel `finance*`/`compute*` (z `FORCE ROW LEVEL SECURITY` już wdrożonym tutaj to
wystarczy — nie trzeba czekać na zmianę właściciela), zaktualizować `DATABASE_URL`, i DOPIERO WTEDY
zamknąć EM-9/FC-01 na tych trzech tabelach z nowym, potwierdzonym na żywej infrastrukturze
przebiegiem STATE 1/STATE 2 (STATE 3 przestanie być osiągalne, co samo w sobie jest dowodem
zamknięcia). Rozszerzenie na pozostałe 58 tabel z `organization_id` — kolejnymi falami, tym samym
wzorcem migracja+test.

## 6. Co wymaga dostępu do infrastruktury, którego nie mam

- **Least-privileged rola DB na Railway** (prod `centerbeam`/demo `trolley`/dev `thomas`) —
  `CREATE ROLE` + `GRANT` + zmiana `DATABASE_URL` środowiskowego. To jedyny brakujący element
  między „polityki istnieją i są poprawne" (dowiedzione tu) a „granica najemcy istnieje naprawdę".
- Potwierdzenie, jaką rolą **faktycznie** łączy się dziś produkcja/demo — nie mam dostępu do tych
  baz (zakaz z tego zadania i tak by go wykluczył); wniosek w §1.1 jest oparty o (a) zmierzony stan
  na identycznie zbudowanym efemerycznym klastrze, (b) brak jakiegokolwiek `CREATE ROLE`
  aplikacyjnej w migracjach/skryptach repo, (c) domyślne prowizjonowanie Railway Postgres. To
  wnioskowanie, nie bezpośredni pomiar produkcji — flagowane jako taki.
