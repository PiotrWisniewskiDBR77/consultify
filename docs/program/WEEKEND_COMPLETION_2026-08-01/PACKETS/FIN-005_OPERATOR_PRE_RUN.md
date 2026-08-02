---
doc_id: FIN-005-operator-pre-run
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-005
depends_on: FIN-005-implementation-handoff
last_reviewed: 2026-08-01
---

# FIN-005 — pre-run operatora przed pierwszym `--write`

Produkt: Consultify. Target: Railway project `consultify`, environment `demo`,
`https://demo.consultify.ai`, PostgreSQL tego environmentu. **Localhost nie jest
evidence odbiorowym.**

Ten dokument opisuje, co Codex musi wykonać i potwierdzić **zanim** kwarantanna
zostanie uruchomiona z `--write`. Gałąź `fix/fin-005-atelier-coherence` nie
wykonała żadnego zapisu, żadnej migracji i żadnej mutacji stagingu — cały ten
krok jest przed Codexem.

Kolejność jest obowiązkowa. Krok, który nie przeszedł, zatrzymuje procedurę;
nie ma obejścia (`--force-org` został celowo usunięty i jego użycie jest twardym
błędem — sprawa poza allowlistą dostaje własny pakiet, review i narzędzia).

---

## 0. Warunek wstępny — seed przed kwarantanną

**Kanoniczny seed Atelier MUSI wejść przed kwarantanną.** Kwarantanna przenosi
obce rekordy poza tenant demo; uruchomiona wcześniej zostawiłaby Finance puste.
Skrypt sam tego pilnuje: `--write` czyta z bazy dokładny kanoniczny fixture
i odmawia, gdy czegokolwiek brakuje — ale kolejność i tak należy do operatora.

Komenda tego kroku jest w **§2**. **Nie jest nią** `npm run db:seed:atelier`:
to pełna przebudowa datasetu demo (użytkownicy, projekty, inicjatywy, zadania,
decyzje, raporty, dokumenty, wywiady, KPI, powiadomienia…), bez allowlisty
fingerprintu i bez zapisu stanu sprzed uruchomienia. Do FIN-005 służy wyłącznie
`server/scripts/fin005-seed-atelier-finance.ts`.

---

## 1. Potwierdź żywy cel Railway (read-only)

**Oba** skrypty operatora — seed z §2 i kwarantanna z §3/§7 — czytają TĘ SAMĄ
allowlistę i tę samą bramkę `assertApprovedDemoTarget`: twardy fingerprint,
**bez wartości domyślnych**, każde pole zadeklarowane jawnie. Wartości w
`FIN005_APPROVED_DEMO_TARGETS` (`server/src/services/demo/financeDemoCoherencePolicy.ts`)
są przepisane z dokumentacji i **nie były potwierdzone na żywym połączeniu**,
bo ta gałąź nie może dotykać Railway.

Potwierdź w dashboardzie/CLI Railway i zapisz jako evidence:

| Pole | Wartość do potwierdzenia |
| --- | --- |
| project | `consultify` |
| environment | `demo` |
| service (Postgres) | ⚠ do potwierdzenia — allowlista zakłada `Postgres` |
| host | `trolley.proxy.rlwy.net` |
| port | `28146` |
| database | ⚠ do potwierdzenia — allowlista zakłada `railway` |
| organization id | `demo-org` (wartość `DEMO_ORG_ID` w tym environmencie) |

Jeżeli którakolwiek wartość różni się od allowlisty — **popraw allowlistę w
osobnym commicie**, nie obchodź bramki. Tryb awarii jest bezpieczny w obie
strony: zła wartość powoduje ODMOWĘ, nigdy uruchomienie w niezatwierdzonym
miejscu.

Bramka odmawia także wtedy, gdy zadeklarowany environment albo host wygląda na
produkcyjny (`centerbeam`, `prod`, `production`, `live`) — **niezależnie od
tego, jakie organizacje tam istnieją**. Organizacja typu `DEMO` w produkcji nie
odblokowuje niczego.

---

## 2. Seed kanonicznego fixture'u Atelier Finance

Dedykowana komenda, nie przebudowa datasetu. Zasiewa **wyłącznie** złoty
przepływ Finance FIN-005: pakiet FY2014 → 3 sprawozdania → 27 wartości →
zatwierdzona analiza → kanoniczny model ROI związany z tym pakietem → 3
zdarzenia prognozy tego modelu (**36 wierszy**, dokładnie zbiór ID z
`getAtelierFinanceCanonicalIds` plus trzy ID zdarzeń). **Niczego nie usuwa,
nie tworzy ani nie kasuje organizacji, nie wykonuje DDL.**

Bramki, w kolejności odpalania: brak furtek (`--force*` nie istnieje,
`--database-url` też nie) → jawnie zadeklarowany cel (ta sama allowlista i ten
sam `assertApprovedDemoTarget`, co kwarantanna) → baza raportowana przez SERWER
= baza zatwierdzona → **TOŻSAMOŚĆ POŁĄCZENIA** (§2.1a) → `organization_type`
**dokładnie** `DEMO` → **przypięty PostgreSQL** → preflight → token
potwierdzenia → manifest odtworzenia → weryfikacja READY + weryfikacja ekonomii
modelu.

### 2.1. Zmienne środowiskowe

| Zmienna | Dry-run | `--write` | Uwaga |
| --- | --- | --- | --- |
| `DATABASE_URL` | wymagana | wymagana | **jedyny cel** — czytają ją i bramki, i zapisy. **Musi zawierać port** — brak portu = ODMOWA, nigdy „domyślne 5432" |
| `DB_TYPE=postgres` | wymagana | wymagana | bez tego seed pisze przez inny sterownik |
| `FIN005_SEED_CONFIRM` | — | `SEED_ATELIER_FINANCE_GOLDEN_FLOW` | **własny token**, celowo INNY niż `QUARANTINE_FOREIGN_FINANCE` z §7 |

`FIN005_MANIFEST_HMAC_KEY` **nie jest** tu potrzebny — to klucz kwarantanny
(§5). Manifest tej komendy jest nieszyfrowanym zapisem stanu „przed", nie
wykonywalnym planem cofnięcia; szczegół w §2.5.

**Nie ustawiaj `DATABASE_PUBLIC_URL`, `DB_HOST`/`DB_PORT`/`DB_NAME` ani
`DB_READ_URL`/`DB_READ_HOST` na czas tego kroku.** Każda z nich potrafi przesunąć
połączenie zapisujące pod spodem zadeklarowanego celu; bramka z §2.1a to wykryje
i ODMÓWI, ale prościej ich po prostu nie mieć w środowisku.

### 2.1a. Tożsamość połączenia — bramka, która musi przejść pierwsza

**Problem, który ta bramka zamyka.** Bramki tej komendy pracują na własnej puli
połączeń zbudowanej z `DATABASE_URL`. Zapisy — nie: `upsertAtelierFinanceGoldenFlow`
idzie przez `DbPromise` → `PostgresDatabase` → `databaseConfig`, które rozwiązuje
`DATABASE_URL` (a także `DB_HOST`/`DB_PORT`/`DB_NAME` i `DB_READ_*`) **niezależnie**.
Wcześniejsza kontrola porównywała `current_database()`, czyli **nazwę** — a na
Railway baza demo (`trolley…:28146/railway`) i baza produkcyjna
(`centerbeam…:37823/railway`) nazywają się **tak samo**: `railway`. Uruchomienie
zabezpieczone na demo mogło więc zapisać do produkcji, przechodząc denylistę
produkcji, allowlistę, znacznik `DEMO` i postwarunek — wszystkie odczytane na demo.

**Co jest teraz.** `--database-url` **nie istnieje** (jego użycie to twardy błąd,
nie ciche zignorowanie), a komenda dowodzi TOŻSAMOŚCI, nie nazwy: pyta oba
połączenia o `pg_control_system().system_identifier` (64-bitowy identyfikator
klastra generowany przez `initdb`), `current_database()`, OID bazy,
`inet_server_addr()`, `inet_server_port()` i `pg_postmaster_start_time()`.

- **ścieżka zapisu** (`PostgresDatabase.getPool()` — dokładnie to połączenie,
  na którym promuje przypięta transakcja) musi zgadzać się na **wszystkich**
  polach;
- **ścieżka odczytu** (`DbPromise.all`, czyli pula repliki, jeśli jest
  skonfigurowana) musi zgadzać się na `system_identifier`, nazwie bazy i OID —
  fizyczna replika dzieli je z primary, obcy klaster nie.

Różnica = ODMOWA, **również w dry-runie** (preflight policzony na jednym serwerze,
gdy zapis poszedłby na inny, nie jest preflightem, tylko mylącym raportem).

**Wymaganie uprawnień.** `pg_control_system()` jest domyślnie tylko dla
superusera. Rola z `DATABASE_URL` musi móc je wykonać (na Railway domyślny
`postgres` może). Jeśli nie może na **obu** połączeniach — komenda ODMAWIA
zamiast zejść do słabszych pól: dwa świeżo utworzone klastry potrafią mieć tę
samą nazwę bazy **i** ten sam OID (`16384` dla pierwszej bazy użytkownika), więc
bez `system_identifier` to nie jest dowód. Naprawa:
`GRANT EXECUTE ON FUNCTION pg_control_system() TO <rola>;` albo połącz się rolą,
która to ma.

Linia w logu (dry-run i `--write`, przed czymkolwiek innym):

```
[fin005-atelier-finance-seed] connection identity: PROVEN — the authorised pool, the write pool and the read pool are all cluster 7610146894575327780, database "railway" (oid 16384) at 10.0.0.1:28146
```

**Zapisz `system_identifier` i OID jako evidence.** Trafiają też do manifestu
(`target.systemIdentifier`, `target.databaseOid`) — to jedyny trwały dowód, że
zapis poszedł tam, gdzie autoryzacja.

Komunikat odmowy (przykład — zadeklarowane demo, `DbPromise` na innym klastrze;
zwróć uwagę, że nazwa bazy się **zgadza**):

```
[fin005-atelier-finance-seed] Refusing to run: the write-path (DbPromise → PostgresDatabase.getPool) connection is NOT the authorised connection. …
  - systemIdentifier: authorised="7610146894575327780" write-path…="7669010021664630220"
  - serverPort: authorised="28146" write-path…="37823"
There is no --database-url to reconcile: set DATABASE_URL to the one approved target and re-run.
```

### 2.1b. Odczyty decydujące — dowód, że idą na primary (runda 7)

**Problem, który ta bramka zamyka.** §2.1a dowodzi, że pula odczytu skonfigurowana
w `DATABASE_URL`/`DB_READ_*` wskazuje na ten sam klaster co pula zapisu. To
**nie** dowodzi, że w danym momencie ta pula odpowiada z primary, a nie z
opóźnionej repliki. Weryfikacja promocji (postwarunek, rekoncyliacja, decyzja
compensate/complete) czyta przez `DbPromise.all/get`, czyli przez pulę odczytu —
gdyby ta pula w danej chwili trafiła na replikę w tyle, promocja mogłaby uznać
świeżo zapisane wiersze za nieobecne i **cofnąć poprawny zapis** (albo odwrotnie:
uznać stary stan repliki za powód do kompensacji).

**Co jest teraz.** Każdy odczyt decydujący (ten, od którego zależy werdykt
`complete`/`compensate`, nie diagnostyka) jest związany albo z **przypiętym
klientem** transakcji promocji (`PoolClient` z §2.1a — `BEGIN`…`COMMIT` na
jednym połączeniu), albo — poza transakcją — ze **świeżym klientem z
autoryzowanej puli zapisu**, nigdy z puli odczytu. Przed pierwszym zapisem seed
dowodzi to explicite: pyta połączenie, na którym te odczyty będą się odbywać, o
`pg_is_in_recovery()`. To jedyne pole, którego replika nie może podrobić —
`system_identifier`, nazwa bazy i OID są identyczne na obu.

Linia w logu (dry-run i `--write`):

```
[fin005-atelier-finance-seed] decisive reads: PRIMARY PROVEN — primary PROVED: write-pool connection to database "<db>" (oid <oid>) at <addr>:<port>, backend pid <pid>, pg_is_in_recovery()=false, system_identifier <id>
```

**To jest twardy refusal wyłącznie na celu HOSTED** (`isHostedTarget()` — każdy
host poza `localhost`/`127.0.0.1`/`::1`/`0.0.0.0`/`host.docker.internal`; na
lokalnej bazie testowej nie ma repliki, więc dowód się wykonuje, ale nie
blokuje). Na demo/produkcji (zawsze hosted) `--write` **odmawia** bez tego
dowodu:

```
⛔ --write would REFUSE: the seed's decisive reads were not proved to reach the PRIMARY (…). A lagging replica turns a successful write into a compensation.
```

W dry-runie jest to ostrzeżenie o tym, co `--write` by zrobił — dry-run sam
niczego nie odmawia, bo nic nie pisze. Nigdy nie kompensuj (nie cofaj, nie
oznaczaj `NEEDS_OPERATOR`) na podstawie stanu odczytanego z repliki — jeśli
zobaczysz taką decyzję w logu bez linii „PRIMARY PROVEN" powyżej, to jest defekt,
nie normalna praca.

### 2.1c. Trwały magazyn na blokadę operatora — `STORAGE_DIR` (runda 7)

**Problem, który ta bramka zamyka.** `NEEDS_OPERATOR` (hold z komitem w
niepewności, §4a) i znacznik `PROMOTION_IN_PROGRESS` (§4a) muszą przetrwać
redeploy — to właśnie wtedy proces, który był w środku promocji, ginie i
znacznik zostaje jedynym śladem. Kontener na Railway ma **efemeryczny** system
plików: bez zamontowanego wolumenu każdy plik zapisany pod `process.cwd()`
znika przy następnym deployu, razem z dowodem, że coś wymaga decyzji operatora.

**Co jest teraz.** Na celu HOSTED `--write` **odmawia zanim wykona pierwszy
zapis SQL**, jeśli nie potrafi **dowieść** (nie: odczytać zmienną) trwałego
magazynu. Sama obecność `STORAGE_DIR` albo `RAILWAY_VOLUME_MOUNT_PATH` w
środowisku **nie wystarcza** — komenda:

1. odrzuca `STORAGE_DIR` wskazujący na `process.cwd()` (to ten sam efemeryczny
   system plików pod inną nazwą);
2. sprawdza, że zadeklarowana ścieżka faktycznie jest osobnym punktem montowania
   (`st_dev` różni się od `st_dev` katalogu głównego — coś tam jest
   zamontowane, a nie tylko zadeklarowane);
3. wykonuje **cały** cykl trwałości na docelowym katalogu i go wycofuje:
   `mkdir -p` → otwórz plik tymczasowy → zapisz → `fsync` na PLIKU → atomowy
   `rename` na miejsce → `fsync` na KATALOGU (krok, który najczęściej się
   pomija — bez niego wpis katalogowy z rename'a nie jest trwały) → odczytaj z
   powrotem i porównaj bajt po bajcie → posprzątaj.

Dopiero po tym `--write` przechodzi dalej. Linia w logu:

```
[fin005-atelier-finance-seed] durable operator hold: OK — STORAGE_DIR=/data (/data is on its own filesystem (st_dev …, root …)); durability PROVED on /data/fin005-operator-holds: mkdir -p … -> write temp file -> fsync the FILE -> atomic rename into place -> fsync the DIRECTORY -> read the bytes back and compare -> clean the probe file up
```

Komunikaty odmowy (przykłady — dowolny z nich zatrzymuje `--write` **przed**
pierwszym zapisem):

- `neither STORAGE_DIR nor RAILWAY_VOLUME_MOUNT_PATH is set, so the operator hold would be written under process.cwd() (…)`
- `STORAGE_DIR=… points at the process working directory (…). That is the ephemeral container filesystem under another name`
- `STORAGE_DIR=… does not look like a mounted volume: … is on the SAME filesystem as … — nothing is mounted there`
- `STORAGE_DIR=… is a mount, but the durability probe on … <krok> failed: <błąd>`
- `ATELIER_FINANCE_HOLD_DIR is set (…). It is a TEST relocation and is refused for a hosted write`
  (ta zmienna istnieje wyłącznie dla testów PG; jeśli jest ustawiona na
  hoście operatora — usuń ją, to nie jest sposób na obejście bramki)

**Weryfikacja przed pierwszym uruchomieniem na demo:** ustaw `STORAGE_DIR` na
zamontowany wolumen Railway i sprawdź samą bramkę bez seedowania czegokolwiek:

```bash
STORAGE_DIR=/data npx tsx -e "
import { requireDurableOperatorHoldStorage } from './server/src/services/demo/atelierFinanceOperatorHold.js';
console.log(requireDurableOperatorHoldStorage());
"
```

(moduł jest ESM/TS — `require('./server/dist/…')` **nie zadziała**; zawsze
`npx tsx`, tak jak sam seed jest uruchamiany)

Oczekiwane: `{ ok: true, source: 'STORAGE_DIR', dir: '/data/fin005-operator-holds', … }`.
`ok: false` — napraw magazyn **zanim** uruchomisz §2.3, nie próbuj obejść tego
zmienną testową.

### 2.2. Dry-run (domyślny, wyłącznie do odczytu)

```bash
DB_TYPE=postgres DATABASE_URL="<demo>" \
npx tsx server/scripts/fin005-seed-atelier-finance.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --locale en \
  --railway-project consultify \
  --railway-environment demo \
  --railway-service "<POTWIERDZONY_SERVICE>" \
  --expect-host trolley.proxy.rlwy.net \
  --expect-port 28146 \
  --expect-database "<POTWIERDZONA_BAZA>"
```

`--locale` jest **obowiązkowy i bez wartości domyślnej** — decyduje o tytułach
widocznych dla klienta (model i analiza). Dla odbioru z §8 to `en`.

**Nie dopisuj `--database-url`.** Ta flaga została usunięta i jej użycie jest
twardym błędem (`--database-url does not exist`) — powód w §2.1a. Jeżeli masz
gdzieś alias powłoki albo skopiowaną wcześniejszą wersję komendy z tą flagą,
usuń ją, zamiast obchodzić błąd.

Oczekiwane wyjście na tenancie bez fixture'u (dosłownie, poza znacznikiem czasu,
pid-em i identyfikatorem klastra):

```
[fin005-atelier-finance-seed] Target: source=DATABASE_URL host=trolley.proxy.rlwy.net database=railway
[fin005-atelier-finance-seed] connection identity: PROVEN — the authorised pool, the write pool and the read pool are all cluster 7610146894575327780, database "railway" (oid 16384) at 10.0.0.1:28146
[fin005-atelier-finance-seed] pinned PostgreSQL: AVAILABLE — PostgreSQL database "railway"; BEGIN/ROLLBACK proved on a pinned connection to "railway" (backend pid 79032)
[fin005-atelier-finance-seed] preflight for "demo-org": create=36 promote=0 relink=0 restate=0 unchanged=0
- report: .../server/exports/fin005-atelier-seed-dry-run-<stamp>.md
✅ Dry run complete. Nothing was written.
   Re-run with --write and FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW.
```

Na tenancie już zasianym ostatnie dwie linie brzmią:

```
✅ Dry run complete. Nothing was written.
   The canonical fixture is already materialized and READY, and the ROI model carries its canonical economics — --write would change nothing.
```

Raport `server/exports/fin005-atelier-seed-dry-run-*.md` wymienia **wiersz po
wierszu**, co zmieniłby zapis, w pięciu kategoriach: `create` (nie istnieje),
`promote` (istnieje, ale nie jest w stanie terminalnym READY), `relink`
(istnieje i jest READY, ale wisi na złym rodzicu), `restate` (istnieje, ale ma
niekanoniczne wartości — dotyczy zdarzeń modelu ROI, które nie mają stanu
gotowości do promowania), `unchanged`. Raport ma też własną sekcję
**„ROI model economics (before)"** — `CANONICAL` albo `NOT CANONICAL`.

**Bramki zatrzymujące dry-run** (żadna nie tworzy stanu pośredniego):

- `--database-url does not exist. It selected the target for this command's GUARDS only …`
- `Refusing to run: the target must be declared explicitly, no defaults. Missing: …`
- `declared host "…" but the connection resolves to "…"` / analogicznie dla bazy i portu
- `carries no port, so the approved port … cannot be confirmed`
- `matches a forbidden production database host (centerbeam)` — także dla `prod`/`production`/`live`
- `is not on the FIN-005 allowlist`
- `Refusing to run: the write-path … connection is NOT the authorised connection` — §2.1a
- `Refusing to run: the read-path … connection is NOT the authorised connection` — §2.1a
- `systemIdentifier: unreadable on BOTH connections` — brak uprawnień do `pg_control_system()`, §2.1a
- `organization_type is "…", expected exactly "DEMO"`
- `Organization "…" does not exist in the target database. This command never creates a tenant`

Jeżeli przypięte połączenie nie działa, dry-run kończy się dodatkową linią:

```
⛔ --write would REFUSE: the pinned PostgreSQL promotion path is unavailable (…). Fix the connection; there is no non-atomic fallback.
```

**Nie przechodź wtedy dalej.** `--write` odmówi, a fallback na ścieżkę
nieatomową nie istnieje ani w tej komendzie, ani (docelowo) w samym seedzie.

### 2.3. `--write`

```bash
DB_TYPE=postgres DATABASE_URL="<demo>" \
FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW \
npx tsx server/scripts/fin005-seed-atelier-finance.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --locale en \
  --railway-project consultify \
  --railway-environment demo \
  --railway-service "<SERVICE>" \
  --expect-host trolley.proxy.rlwy.net \
  --expect-port 28146 \
  --expect-database "<BAZA>" \
  --write
```

Oczekiwane wyjście:

```
[fin005-atelier-finance-seed] Target: source=DATABASE_URL host=trolley.proxy.rlwy.net database=railway
[fin005-atelier-finance-seed] connection identity: PROVEN — the authorised pool, the write pool and the read pool are all cluster 7610146894575327780, database "railway" (oid 16384) at 10.0.0.1:28146
[fin005-atelier-finance-seed] pinned PostgreSQL: AVAILABLE — PostgreSQL database "railway"; BEGIN/ROLLBACK proved on a pinned connection to "railway" (backend pid …)
[fin005-atelier-finance-seed] preflight for "demo-org": create=36 promote=0 relink=0 restate=0 unchanged=0
- report: .../server/exports/fin005-atelier-seed-write-<stamp>.md
[fin005-atelier-finance-seed] Write mode (run <stamp>). This will:
  - upsert the canonical Atelier Toys FY2014 pack, 3 statements, 27 statement values, the approved analysis, the canonical ROI model and its 3 forecast events in "demo-org";
  - promote them to READY inside ONE pinned PostgreSQL transaction;
  - touch no other organization and no row outside the canonical id set;
  - remove nothing, drop nothing, run no DDL.
- recovery manifest (prior state, written BEFORE the first write): .../server/exports/fin005-atelier-seed-manifest-<stamp>.json
✅ Seed complete — the canonical Atelier Finance fixture is materialized and READY in "demo-org".
- fixture digest (after): <64 znaki hex>
- ROI model economics: 3 canonical forecast events present (compute has not been run — see the runbook's Models check).
- manifest: .../server/exports/fin005-atelier-seed-manifest-<stamp>.json
- nothing was deleted, no organization was created or removed.
```

Powtórne uruchomienie `--write` na gotowym fixture jest **bezoperacyjne**:
`create=0 promote=0 relink=0 restate=0 unchanged=36`, ten sam `fixture digest`,
zero zmian w wierszach (łącznie z `updated_at` — sprawdzane testem na realnym
PostgreSQL przez porównanie pełnych snapshotów `SELECT *`).

**Bramki zatrzymujące zapis:**

- `Confirmation required. Set FIN005_SEED_CONFIRM=SEED_ATELIER_FINANCE_GOLDEN_FLOW`
  — token kwarantanny tu **nie działa**;
- `Refusing to write: the write-path … connection is NOT the authorised connection` — §2.1a;
- `Refusing to write: … an unproven identity is not a proof.` — §2.1a, gdy tożsamości
  w ogóle nie dało się odczytać (np. brak uprawnień do `pg_control_system()`);
- `Refusing to write: the pinned PostgreSQL promotion path is unavailable (…)`;
- `The Atelier Finance golden flow did not complete: …. Nothing was promoted to READY; the quarantine must NOT be run.`
- `The canonical fixture is READY, but the ROI model's economics are not: …`
  — postwarunek ekonomii; model byłby „zatwierdzony", ale bez zdarzeń prognozy,
  a więc bez NPV / ROI / okresu zwrotu;
- `Refusing to quarantine: the canonical Atelier Finance fixture is not fully materialized and READY …`
  — postwarunek; oznacza, że mimo zapisu fixture nie jest gotowy. **Nie
  uruchamiaj kwarantanny.**

### 2.3a. Ekonomia modelu ROI — co ta komenda zasiewa, a czego nie

**Zasiewa: trzy kanoniczne zdarzenia prognozy** (`financial_model_events`),
przepisane co do wartości z `demoSeedService.upsertAtelierRoiFinancialModel`
(test strukturalny czyta źródło tamtej funkcji i porównuje pole po polu, więc
rozjazd między dwoma pisarzami tych wierszy jest niemożliwy do przeoczenia):

| zdarzenie | typ | kwota | start | powtarzalność | CF |
| --- | --- | --- | --- | --- | --- |
| Revenue uplift (digitized lines) | `revenue` | `2 400 000` EUR | 2015-01-01 | roczna | operating |
| Digital transformation capex | `capex_purchase` | `800 000` EUR | 2015-01-01 | jednorazowa | investing |
| OpEx reduction (automation) | `opex` | `−400 000` EUR | 2016-01-01 | roczna | operating |

Bez nich model wchodził na demo jako `approved`, ale **bez żadnej ekonomii i już
na zawsze**: `FinancialModelWorkspace` pokazywał „no forecast events yet",
`POST /models/:id/compute` blokuje bramka read-only demo, a
`reseedModelFromSource` odmawia modelowi w stanie `approved`. Poprzednia wersja
§8 tego nie widziała, bo sprawdzała tylko NAZWĘ i ŹRÓDŁO modelu.

**Nie zasiewa: `assumptions_json`.** To nie jest przeoczenie — pełny dataset też
go nie ustawia (`upsertAtelierRoiFinancialModel` wypisuje dwanaście kolumn i
`assumptions_json` nie ma wśród nich), więc dopisanie go tutaj byłoby wymyśleniem
ekonomii, której kanoniczny fixture nie ma. Model i tak raportuje się jako
GROUNDED — `getModelAssumptionsStatus` liczy to z `source_statement_pack_id`,
które ta komenda ustawia.

**Nie zasiewa: `financial_model_outputs` / `financial_model_validations`.**
Jedynym pisarzem tych tabel jest `persistComputeResult`, który zaczyna od
skasowania istniejących wierszy wyjścia. Zaimportowanie go wstawiłoby instrukcję
niszczącą do komendy, której cały kontrakt polega na tym, że żadnej nie ma
(pilnuje tego test strukturalny — patrz §9). **Policzony WYNIK jest więc krokiem
operatora, nie krokiem seeda** — patrz punkt „Models" w §8.

**Nie zasiewa: `analysis_financials` / `digitization_analyses`.** Pełny dataset
zapisuje je tylko wtedy, gdy istnieje inicjatywa `line-3-digital-twin` — obiekt
kręgosłupa spoza zakresu tej komendy. Na tenancie bez tej inicjatywy pełny
dataset też ich nie zapisuje.

### 2.4. Kolejność wobec kwarantanny

Seed (§2) → weryfikacja READY (§4) → preflight kwarantanny (§3, do odczytu,
kolejność §3/§4 dowolna) → klucz HMAC (§5) → manifest (§6) → `--write`
kwarantanny (§7). Kwarantanna uruchomiona przed seedem zostawiłaby Finance puste.

### 2.5. Manifest odtworzenia tej komendy — czym jest, a czym nie

`server/exports/fin005-atelier-seed-manifest-<stamp>.json` powstaje **przed
pierwszą mutacją** (plik tymczasowy → `fsync` → atomowy `rename` → `fsync`
katalogu, ta sama dyscyplina co manifest kwarantanny) i zawiera pełny stan
„przed" każdego kanonicznego wiersza (**łącznie ze zdarzeniami modelu ROI**),
listę ID, których jeszcze nie było, plan zmian oraz — w `target.systemIdentifier`
i `target.databaseOid` — dowód tożsamości serwera, na którym zapis się odbył
(§2.1a). Po udanym przebiegu jest atomowo nadpisany ze statusem `COMPLETED`
i skrótem fixture'u „po".

**Nie jest** podpisany HMAC i **nie ma** dla niego `--rollback`. Powód jest
jawny: ta komenda nigdy nie przenosi ani nie usuwa cudzych danych — wstawia
kanoniczne wiersze i promuje je. Manifest jest **materiałem dowodowym** do
ręcznego przywrócenia wiersza, który istniał wcześniej, a nie wykonywalnym
cofnięciem. Skopiuj go poza laptop operatora razem z manifestem z §6.

---

## 3. Preflight kwarantanny — wyłącznie do odczytu

Uruchom dry-run. Jest domyślny, nie przyjmuje żadnego zapisu i nie wymaga klucza
HMAC (dry-run nie produkuje manifestu).

```bash
DATABASE_URL="<demo>" npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --railway-project consultify \
  --railway-environment demo \
  --railway-service "<POTWIERDZONY_SERVICE>" \
  --expect-host trolley.proxy.rlwy.net \
  --expect-port 28146 \
  --expect-database "<POTWIERDZONA_BAZA>"
```

Produkuje raport w `server/exports/` z podziałem na wiersze kanoniczne
(zostają) i obce (kandydaci do kwarantanny), z flagami nazw jako materiałem
pomocniczym dla człowieka — **flagi nie decydują**, decyduje dokładny zbiór
kanonicznych ID.

Zapytania walidacyjne (read-only) są w
`FIN-005_IMPLEMENTATION_HANDOFF.md` §8. Uruchom je i zachowaj wynik jako stan
„przed".

**Nie przechodź dalej, dopóki lista obcych rekordów nie zostanie przejrzana
i zaakceptowana przez człowieka.** Prowieniencja tych rekordów nie jest
odtwarzalna z kodu (żaden skrypt w repo ich nie produkuje — patrz handoff §2.5),
więc skrypt niczego nie zakłada.

---

## 4. Potwierdź, że fixture jest READY

`--write` kwarantanny wymaga fixture'u **READY**, nie tylko kompletnego: „kompletny, ale
`pending`" to sygnatura przerwanego seeda, a kontrakt pakietu mówi „najpierw
seed, potem kwarantanna".

Read-only sprawdzenie — musi zwrócić dokładnie jeden wiersz:

```sql
SELECT p.entity_name, p.period_label, p.currency,
       p.pack_status, p.pack_readiness_status,
       a.status  AS analysis_status,
       m.name    AS model_name, m.currency AS model_currency, m.status AS model_status
  FROM financial_statement_packs p
  JOIN financial_analyses a ON a.source_statement_pack_id = p.id
  JOIN financial_models   m ON m.source_statement_pack_id = p.id
 WHERE p.organization_id = '<DEMO_ORG_ID>';
```

Oczekiwane: `Atelier Toys` · `FY2014` · `EUR` · `confirmed` · `ready` ·
`APPROVED` · `Atelier Toys — Transformation 2015 ROI` · `EUR` · `approved`.

Oraz trzy sprawozdania, każde `confirmed` / `pass` / `ready`, z zerem
niezmapowanych wartości:

```sql
SELECT s.statement_type, s.status, s.validation_status, s.readiness_status,
       COUNT(v.id)::int AS values,
       COUNT(*) FILTER (WHERE v.canonical_line_id IS NULL)::int AS unmapped
  FROM financial_statements s
  LEFT JOIN financial_statement_values v ON v.statement_id = s.id
 WHERE s.organization_id = '<DEMO_ORG_ID>'
 GROUP BY s.id, s.statement_type, s.status, s.validation_status, s.readiness_status
 ORDER BY s.statement_type;
```

Oraz — to jest **nowa pozycja**, bez której model przechodził dawne §8 mimo braku
jakiejkolwiek ekonomii — trzy zdarzenia prognozy modelu ROI:

```sql
SELECT e.event_type, e.name, e.amount, e.currency, e.recurrence,
       e.cf_classification, e.is_active
  FROM financial_model_events e
  JOIN financial_models m ON m.id = e.model_id
 WHERE m.organization_id = '<DEMO_ORG_ID>'
   AND m.id = '<DEMO_ORG_ID>--financial-model--transformation-2015-roi'
 ORDER BY e.sort_order;
```

Oczekiwane: dokładnie trzy wiersze, wszystkie `EUR`, wszystkie `is_active = true`,
kwoty `2400000` / `800000` / `-400000` (suma `2800000`). Zero wierszy = model bez
ekonomii — **nie uruchamiaj kwarantanny, uruchom ponownie §2.3**.

Jeżeli stan jest **mieszany** (część `ready`, część `pending`) — to ślad po
przerwanym seedzie. Uruchom **ponownie komendę z §2.3** (`--write`): faza 0
seeda demotuje mieszany stan i odbudowuje spójny fixture (zweryfikowane na
realnym PostgreSQL, handoff §13.3). Dry-run z §2.2 pokaże ten stan jako wiersze
`promote` — to jest właśnie sygnatura przerwanego seeda.
Nie uruchamiaj kwarantanny na mieszanym fixture.

---

## 4a. Jeśli seed odmawia z `NEEDS_OPERATOR` (runda 7)

Dwa **oddzielne** zapisy trwałe mogą zablokować kolejne uruchomienie tego
samego tenanta. Oba fail-closed: plik nieczytelny albo uszkodzony liczy się
jako blokada, nie jako „brak blokady". Żaden kolejny seed **nie czyści** żadnego
z nich sam — to zrobiłoby dokładnie to, przed czym mają chronić (zgubienie
dowodu przed decyzją człowieka).

**1. Hold „commit w niepewności"** (istniał przed rundą 7, format bez zmian) —
`fin005-operator-holds/atelier-finance-commit-indeterminate--<slug>--<hash>.json`.
Zapisywany, gdy transakcja zwróciła `commit-indeterminate` (round-6): backend
zerwał połączenie między `COMMIT` a potwierdzeniem, więc nie wiadomo, czy zapis
wszedł.

**2. Znacznik `PROMOTION_IN_PROGRESS`** (nowy w rundzie 7) —
`fin005-operator-holds/atelier-finance-promotion-marker--<slug>--<hash>.json`.
Zapisywany **przed `BEGIN`**, z `runId`, `organizationId`, dokładnie pięcioma
id wierszy w zakresie promocji (pakiet, 3 sprawozdania, analiza), sha256 stanu
„przed" i sha256 zamierzonego stanu „po", tożsamością celu i znacznikiem czasu.
Aktualizowany na wynik (`COMMITTED` / `ROLLED_BACK` / `NEEDS_OPERATOR`). Jeśli
proces padnie między zapisaniem znacznika a aktualizacją wyniku, plik **zostaje
w stanie `PROMOTION_IN_PROGRESS`** — to jest właśnie sygnatura procesu, który
umarł w środku, i to ona blokuje.

Komunikat odmowy (przykład dla obu przypadków — treść identyczna co do struktury):

```
NEEDS_OPERATOR — refusing to run: a PROMOTION_IN_PROGRESS promotion marker stands for this tenant. Run "<runId>" recorded the marker at <ts> and NEVER recorded an outcome, which means the process died between BEGIN and the confirmed result — the promotion transaction MAY HAVE COMMITTED and nothing observed it. Rows in scope: [<5 id-ków>]. Pre-state digest <sha>, intended post-state digest <sha>, target <host>:<port>/<db> (oid <oid>, system_identifier <id>). Marker file: <ścieżka>. This run will NOT clear it. INVESTIGATE FIRST, THEN ACKNOWLEDGE. …
```

**Procedura operatora — dosłownie, w tej kolejności:**

1. **Nie usuwaj pliku ręcznie.** Usunięcie pliku odblokowuje seed, ale nie
   zostawia śladu decyzji — to jest dokładnie ten defekt, który znacznik miał
   zamknąć.
2. Przeczytaj plik blokady (hold albo znacznik) i porównaj `rowIds`/
   `statementIds` z pięcioma kanonicznymi wierszami Finance dla tego tenanta
   (§4 — te same zapytania SQL). Ustal, czy `preStateDigest` czy
   `intendedPostStateDigest` odpowiada temu, co faktycznie jest w bazie.
3. Zdecyduj: `commit-landed` (zapis wszedł — stan bazy zgadza się z
   zamierzonym), `commit-did-not-land` (zapis nie wszedł — stan bazy zgadza się
   ze stanem „przed"), `residue-reseeded-by-hand` (naprawiłeś ręcznie), albo
   `other` (z notatką co faktycznie zaszło).
4. Potwierdź programowo — to jedyna droga, która jest jednocześnie
   odblokowaniem i audytem:

```bash
npx tsx -e "
import { acknowledgeAtelierFinanceCommitIndeterminate } from './server/src/services/demo/atelierFinanceSeed.js';
console.log(acknowledgeAtelierFinanceCommitIndeterminate('<DEMO_ORG_ID>', {
  operator: '<imię i nazwisko albo konto — nigdy puste>',
  decision: 'commit-landed', // | 'commit-did-not-land' | 'residue-reseeded-by-hand' | 'other'
  note: '<co dokładnie sprawdziłeś i dlaczego bezpiecznie kontynuować — trafia do trwałego, podpisanego czasem audytu>',
}));
"
```

(funkcja jest zdefiniowana w `atelierFinanceOperatorHold.ts` i re-eksportowana
z `atelierFinanceSeed.ts` — importuj z tego drugiego, tak jak sam seed woła
tę funkcję wewnętrznie).

To zapisuje trwały rekord audytu w `fin005-operator-holds/acknowledged/` (z
pełną treścią oczyszczanego holdu/znacznika w środku) **przed** usunięciem
blokady — w tej kolejności, żeby awaria zapisu audytu nigdy nie skończyła się
odblokowanym tenantem bez śladu decyzji. Puste `operator` albo `note` rzuca
wyjątek zamiast ciche odblokować.
5. Dopiero po potwierdzeniu uruchom ponownie §2.3 — kolejny seed zdemotuje
   pozostałość i odbuduje spójny fixture (faza 0, jak przy mieszanym stanie w
   §4).

---

## 5. Przygotuj i zabezpiecz klucz HMAC

Manifest rollbacku jest uwierzytelniony **HMAC-SHA256**. Klucz jest **wymagany**
dla `--write` i dla `--rollback` (dry-run go nie potrzebuje).

```bash
# wygeneruj poza repo, nigdy nie commituj
openssl rand -base64 48 > ~/.fin005-manifest-key
chmod 600 ~/.fin005-manifest-key
```

- `FIN005_MANIFEST_HMAC_KEY` — sekret, **minimum 32 znaki**;
- `FIN005_MANIFEST_HMAC_KEY_ID` — publiczny identyfikator wersji klucza
  (np. `fin005-2026-08-a`), zapisywany w manifeście, żeby rotacja była wykrywalna.

Wymagania:

1. **Ten sam klucz musi być dostępny przy rollbacku.** Utrata klucza czyni
   istniejący manifest nieużywalnym przez skrypt — wiersze trzeba by wtedy
   przywrócić ręcznie z zapisanego prior state. To jest realne ryzyko
   operacyjne, nie formalność.
2. Przechowaj sekret w menedżerze sekretów zespołu, **nie** w repo, nie w
   `.env` commitowanym, nie w historii powłoki (użyj `$(cat ~/.fin005-...)`).
3. Sekret nigdy nie trafia do logu, do raportu ani do manifestu — potwierdzone
   testem i grepem po repo. Do manifestu trafia wyłącznie `keyId`.
4. **Brak procedury rotacji** — to świadomie otwarta pozycja (handoff §13.8).
   Ustal ją przed pierwszym `--write`, nie po.

---

## 6. Zachowaj manifest kwarantanny poza maszyną operatora

Dotyczy manifestu **kwarantanny** (manifest seeda z §2.5 jest osobnym plikiem
i nie ma klucza HMAC). Manifest kwarantanny jest **jedynym** trwałym planem
cofnięcia: nie ma tabeli audit/outbox w bazie (wymagałaby migracji, poza granicą pakietu — propozycja DDL leży w
skrypcie jako `DURABLE_AUDIT_TABLE_PROPOSAL`).

Skrypt zapisuje go do pliku tymczasowego, robi `fsync` i atomowy `rename`
**przed `COMMIT`**, więc awaria między `COMMIT` a finalnym zapisem nadal
pozostawia odtwarzalny manifest `PREPARED`.

Natychmiast po `--write`:

1. skopiuj `server/exports/fin005-finance-demo-manifest-*.json` do trwałego
   magazynu poza laptopem operatora (bucket zespołowy / sejf);
2. zanotuj `keyId` obok kopii;
3. zweryfikuj kopię (`--rollback` odmówi, jeśli suma HMAC się nie zgadza —
   sprawdź to na kopii, zanim uznasz ją za dobrą);
4. `server/exports/` jest w `.gitignore` — manifest **nie może** trafić do repo.

Rollback dodatkowo odmawia, gdy rekord zmienił się po kwarantannie (fingerprint
per wiersz), gdy manifest był podpisany innym kluczem, oraz gdy manifest
pochodzi z innego hosta/bazy niż podłączony cel.

---

## 7. Dopiero teraz `--write` kwarantanny

```bash
DATABASE_URL="<demo>" \
FIN005_MANIFEST_HMAC_KEY="$(cat ~/.fin005-manifest-key)" \
FIN005_MANIFEST_HMAC_KEY_ID=fin005-2026-08-a \
FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --railway-project consultify --railway-environment demo \
  --railway-service "<SERVICE>" \
  --expect-host trolley.proxy.rlwy.net --expect-port 28146 \
  --expect-database "<BAZA>" \
  --write
```

Skrypt powie przed zapisem, co zrobi: utworzy nieaktywną organizację kwarantanny
(typ `DEMO`, bez użytkowników i bez członkostw), przeniesie N wierszy, wyczyści
`statement_pack_id` na przenoszonych sprawozdaniach (zapisane do rollbacku) i
**nie usunie niczego**.

Po zapisie: powtórz zapytania walidacyjne z §3 i porównaj ze stanem „przed".

---

## 8. Odbiór wzrokiem (Finance na `demo.consultify.ai`)

- PERIOD pokazuje `FY2014`, nigdzie `Thu Dec 31 …`;
- Statements: jeden pakiet `Atelier Toys`, READY, komplet P&L / BS / CF;
- Analysis: `Atelier Toys — FY2014 Baseline Financial Analysis`, APPROVED;
- Models: `Atelier Toys — Transformation 2015 ROI`, źródło = pakiet FY2014,
  zero `(kopia)`, zero DBR77/Apator;
- **Models → ekonomia modelu (nowa pozycja odbioru, patrz §2.3a):**
  - lista zdarzeń prognozy pokazuje **trzy** pozycje, nie „no forecast events yet":
    `Revenue uplift (digitized lines)` `2 400 000 EUR`,
    `Digital transformation capex` `800 000 EUR`,
    `OpEx reduction (automation)` `−400 000 EUR` — wszystkie EUR, wszystkie aktywne;
  - model jest oznaczony jako **grounded** (źródłem jest pakiet FY2014), a nie
    „bez źródła";
  - **wynik (NPV / ROI / okres zwrotu) będzie pusty — „compute not run yet" — i to
    jest stan oczekiwany po samym seedzie**, nie usterka. Ta komenda nie liczy
    modelu, bo jedyny pisarz wyjść zaczyna od kasowania (§2.3a). Jeżeli demo ma
    pokazać liczby, policzenie modelu jest **osobnym, świadomym krokiem
    operatora** (`POST /models/:id/compute` jest w demie zablokowany przez bramkę
    read-only — decyzja o jej otwarciu należy do `FIN-006`). **Zapisz w
    werdykcie, czy demo idzie z wynikiem, czy bez** — nie zostawiaj tego do
    odkrycia na pokazie;
- Value Office: jawny komunikat „not available in demo mode" — silnik jest
  zdrowy, blokuje go bramka read-only (allowlista to osobna decyzja, `FIN-006`);
- próba zapisu nadal daje `Demo mode is read-only`.

Werdykt: `GO / FIX / NO-GO`.

---

## 9. Czego ta gałąź NIE zrobiła

Deployu · migracji · `--write` · `--rollback` · żadnej mutacji `demo` ·
żadnego kontaktu z `production` ani `consultify.ai` · pusha ani merge'a.

Dodatkowo, o komendzie seeda z §2:

- była uruchomiona **wyłącznie na lokalnym, jednorazowym PostgreSQL** (pełny
  zestaw migracji), nigdy na demo ani na Railway. Wyjścia zacytowane w §2.2
  i §2.3 pochodzą z tamtego przebiegu, z podmienionymi nazwami hosta, bazy,
  OID i identyfikatora klastra;
- **zasiewa** trzy kanoniczne zdarzenia prognozy modelu ROI (§2.3a) i weryfikuje
  je postwarunkiem. Na tenancie, który ma już pełny dataset, wartości są
  identyczne, więc zapis nie zachodzi w ogóle (`ON CONFLICT … WHERE … IS DISTINCT
  FROM`); pozostałe kolumny modelu (`project_id`, `initiative_id`, `description`
  i pochodne) są tylko-do-wstawienia i nigdy nie są nadpisywane;
- **nie zasiewa** `financial_model_outputs`, `financial_model_validations`,
  `assumptions_json` ani `analysis_financials` — powody i konsekwencje w §2.3a,
  pozycja odbioru w §8. **Runda 8:** to już nie znaczy „NPV/ROI/payback nie
  istnieją" — `GET /api/v8/finance/models/:modelId/appraisal` liczy je na
  żywo z kanonicznych `financial_model_events` (przez `computeModel()` +
  `investmentAppraisalService.appraise()`, bez drugiego silnika), za każdym
  razem od nowa — tylko nigdy nic z tego nie trafia do
  `financial_model_outputs`. To odróżnia `financeFixtureComplete` (dane
  wejściowe istnieją i mają lineage) od `financeGoldenFlowComplete` (policzono
  realny NPV) — pełna specyfikacja w raporcie rundy 8 handoffu
  (`FIN-005_IMPLEMENTATION_HANDOFF.md` §17);
- **nie widzi**, którą ścieżką seed promował fixture. Komenda odmawia zapisu,
  gdy przypięte połączenie nie działa, i odmawia, gdy seed nie zwróci
  `complete` — ale samo „nigdy nie schodź na ścieżkę nieatomową" jest
  odpowiedzialnością `atelierFinanceSeed.ts`, nie tej komendy;
- **dowodzi tożsamości połączenia zapisującego** (§2.1a). Bramka jest
  przetestowana na realnym PostgreSQL w trzech układach: dwie różne bazy w tym
  samym klastrze, dwa **różne klastry serwujące bazę o TEJ SAMEJ NAZWIE** (to
  jest dokładnie układ Railway `railway`/`railway` — test jawnie potwierdza, że
  dawne porównanie nazwy by go przepuściło) oraz przypadek nieczytelnego
  `pg_control_system()`. Czego bramka **nie** dowodzi: że zadeklarowany
  fingerprint Railway odpowiada właściwemu środowisku — to jest §1, oczami
  operatora.
