# WP-B07 — Observability i Runbooks dla Finance Compute Jobs (ADR)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` (sekcja „WP-B07 Observability i runbooks”, Gate B)
**Work package:** WP-B07 — Owner: SRE — P0
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`
**Branch:** `codex/finance-v3-gate-a-20260809`
**Status dokumentu:** `ADR — DECYZJA PROJEKTOWA, NIE IMPLEMENTACJA`. Zero migracji, zero kodu runtime, zero połączenia z bazą danych powstało przy pisaniu tego dokumentu, zgodnie z twardym zakazem z briefu.

Wejście:
- `generated/gate-b/GATE_B_INTEGRATION_RECONCILIATION.md` — kanoniczny scalony kształt schematu B01–B04.
- `generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md` — **fundament tego dokumentu**. `compute_jobs`/`compute_job_runs`/`compute_job_outputs`, lease/heartbeat, retry/DLQ, cancel/kill switch, per-org concurrency nie są tu projektowane od nowa — WP-B07 dobudowuje na tym warstwę obserwowalności i operacji.
- `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`, sekcja „WP-B07”.
- Stan worktree na 2026-08-09, sprawdzony wielokrotnie (przed pisaniem i ponownie przed commitem, bo praca w Gate B jest równoległa w tym samym worktree — kilka WP pisanych jednocześnie przez osobne sesje): w momencie rozpoczęcia pisania `ls docs/validation/finance-v3/generated/gate-b/` zwracało wyłącznie `WP-B01…WP-B04`. **W trakcie pisania tego ADR pojawiły się `WP-B05_exception_ledger_ADR.md` i `WP-B06_reproducibility_retention_export_ADR.md`** (napisane równolegle w tym samym worktree) — zgodnie z briefem („jeśli WP-B05 już istnieje, sprawdź i użyj spójnych kodów”) oba dokumenty są przeczytane i **§2.4/§3/§5.3/§6/§7 poniżej są z nimi uzgodnione**, nie zaprojektowane w oderwaniu ani zostawione jako czysto hipotetyczny kontrakt.

Weryfikacja statyczna (bez bazy, zgodnie z zakazem z briefu) wykazała, że w repo **już istnieje** mechanizm correlation ID i szkielet metryk Prometheus-style, więc ten ADR w dużej mierze **rozszerza istniejące wzorce**, nie projektuje warstwy observability od zera:

- `server/src/utils/RequestStore.ts` — `correlationMiddleware`, `AsyncLocalStorage`, generuje `uuidv4()` gdy brak nagłówka, honoruje istniejący `X-Correlation-ID`.
- `server/src/middleware/apiLogging.middleware.ts` — `resolveCorrelationId`, zapis do `api_logs.correlation_id`.
- `server/src/middleware/metrics.middleware.ts` + `server/src/routes/metrics.routes.ts` — ręczny eksport Prometheus-style (`http_requests_total`, `http_request_duration_ms_bucket`, …) bez namespace’u.
- `server/src/types/prom-client.d.ts` + `server/src/routes/performance.routes.ts:139` (`register.metrics()`) — `prom-client` jest już znaną zależnością typową w repo.

---

## 1. Zakres i nieprojektowane od nowa granice

Ten dokument **nie zmienia** DDL z B04 (§3 tamtego ADR). Wszędzie, gdzie WP-B07 wymaga dodatkowej kolumny/tabeli, jest to jawnie oznaczone jako **addytywna propozycja dla Gate C** (§7), analogicznie do tego, jak `GATE_B_INTEGRATION_RECONCILIATION.md` §2 dodało kolumny do `finance_business_versions` bez przepisywania B01. Nazewnictwo trzyma się kanonu z tamtego dokumentu (`finance_business_versions`/`business_version_id`, nie `business_versions`/`id`).

Zakres (z briefu):
1. Correlation ID: `request_id → job_id → run_id → output_id → export_id`.
2. Reason codes: taksonomia, nie wolna forma.
3. Metryki (Prometheus-style, konkretne nazwy).
4. Dashboards/alerts z progami i rozróżnieniem validation vs infrastructure.
5. Runbooki: replay, quarantine, drain, rebuild, rollback (koordynacja z WP-C06).

---

## 2. Correlation ID: propagacja `request_id → job_id → run_id → output_id → export_id`

### 2.1 Nie wynajdujemy nowego mechanizmu na warstwie HTTP

`X-Correlation-ID` już działa end-to-end w repo: `correlationMiddleware` (zamontowany globalnie, `server/src/index.ts:993`) czyta nagłówek `X-Correlation-ID`/`x-correlation-id`, sanitizuje, generuje `uuidv4()` gdy brak, trzyma w `AsyncLocalStorage` i odbija w nagłówku odpowiedzi. WP-B07 **reużywa to 1:1** dla compute jobs — nie ma osobnego „job correlation id” różnego od tego, co już płynie przez cały request.

### 2.2 Gdzie w łańcuchu żyje `request_id` — join key, nie duplikacja w każdej tabeli

B04 §3.1 **już zarezerwowało** pole na to (`compute_jobs.request_id text — correlation id z warstwy HTTP (WP-B07)`, linia 111 ADR-u B04) — autor B04 zostawił to podpięcie dla mnie explicite. Handler `POST /compute` (adapter WP-C02, B04 §9.1) przy `INSERT INTO compute_jobs` zapisuje `req.correlationId` (z `AsyncLocalStorage`, §2.1) do tej kolumny **raz, w momencie enqueue** — immutable od tego momentu, tak samo jak `input_revision_hash`.

`compute_job_runs` i `compute_job_outputs` (B04 §3.2/§3.3) **nie mają** i celowo **nie powinny dostać** własnej kolumny `request_id`:

- Obie mają twardy FK `job_id → compute_jobs(id)`. `request_id` jest więc rekonstruowalny deterministycznie przez `JOIN` po `job_id` — nie ma dwóch źródeł prawdy, które mogłyby się rozjechać.
- Duplikowanie `request_id` na każdym poziomie byłoby ryzykiem driftu bez korzyści: `compute_job_runs`/`compute_job_outputs` nigdy nie istnieją bez rodzica `compute_jobs`, więc denormalizacja nie przyspiesza żadnego realnego zapytania (zawsze i tak trzeba dotknąć `compute_jobs`, żeby dostać `organization_id`/`job_type`).

**Warstwa DB = propagacja przez klucz obcy `job_id`. Warstwa observability (logi strukturalne, metryki, trace) = jawne, redundantne tagowanie `request_id` na każdym zdarzeniu**, bo to tam realnie następuje debugging po incydencie, nie przez ad-hoc JOIN w środku alertu:

| Poziom | Zdarzenie | Pola w structured logu (worker/API) |
|---|---|---|
| HTTP enqueue | `POST /compute` przyjęty | `request_id`, `organization_id`, `job_type`, `job_id` (po INSERT) |
| Claim | worker bierze joba (§5.1 B04) | `request_id` (odczytane z `compute_jobs.request_id` przy claimie), `job_id`, `run_id` (=nowy wiersz `compute_job_runs.id`), `attempt_number`, `worker_id` (=`lease_owner`) |
| Heartbeat | co ~15s (§5.2 B04) | `request_id`, `job_id`, `run_id`, `worker_id`, `seconds_since_claim` |
| Commit / fail | koniec attempt (§6/§10 B04) | `request_id`, `job_id`, `run_id`, `output_id` (jeśli succeeded), `outcome`, `reason_code` (§3) |
| Reaper reclaim | lease expired (§5.3 B04) | `request_id`, `job_id`, `run_id`, `dead_worker`, `attempt_count` |

Efekt: operator wpisuje jeden `request_id` (z nagłówka odpowiedzi `202`, albo z `api_logs`) w log search i dostaje **cały łańcuch** — enqueue → claim → heartbeaty → commit — nawet mimo że tylko jedna tabela (`compute_jobs`) trzyma to pole trwale.

### 2.3 `output_id`

`compute_job_outputs.id` (B04 §3.3), `UNIQUE(job_id)` — jeden na job. Łańcuch do tego punktu jest kompletny i w pełni w zakresie B04+B07: `request_id → job_id (1:1) → run_id (1:N przez attempty, ale dokładnie jeden ma `outcome='succeeded'`) → output_id (0..1)`.

### 2.4 `export_id` — WP-B06 pojawiło się w trakcie pisania tego ADR; łańcuch zweryfikowany względem realnego DDL, nie hipotezy

Eksporty (raporty/TRS/manifest) należą do WP-B06 „Reproducibility, restatement, retention i export” (master plan). **`WP-B06_reproducibility_retention_export_ADR.md` powstało równolegle, w trakcie pisania tego dokumentu** (podobnie jak B05, §3) — poniżej jest zweryfikowane względem jego realnego DDL, nie hipotetycznego kontraktu sprzed jego istnienia.

Rzeczywisty łańcuch, jaki B06 faktycznie zbudowało (§6.1 tamtego ADR, DDL `finance_export_manifests`), jest **inny i lepszy** niż mój wstępny pomysł „`source_output_id` FK wprost do `compute_job_outputs`” — B06 **nie** linkuje eksportu bezpośrednio do `compute_job_outputs`. Zamiast tego:

- `finance_export_manifests.primary_business_version_id` wskazuje **zawsze zatwierdzoną** `finance_business_versions` (wymuszone triggerem w B06 §6.2 — eksport nigdy nie dotyczy Draftu). `finance_business_versions` **już ma** `compute_snapshot_id`/`compute_run_id` (kolumny z oryginalnego DDL B01, wymienione literalnie w `GATE_B_INTEGRATION_RECONCILIATION.md` §2) — to jest istniejący, nie nowo proponowany, punkt zaczepienia do compute lineage.
- B06 dokłada własną tabelę `finance_compute_snapshots` (B06, sekcja o snapshotach) z `compute_run_id` jako **miękkim forward-referencem bez FK** do `compute_job_outputs`/`compute_job_runs` z B04 — tym samym wzorcem „forward reference bez FK między ADR-ami różnych autorów”, którego B05 już użyło dla `compute_run_id` w `finance_exceptions.evidence` (§3.2 wyżej). To potwierdza, że wzorzec z §2.2/§2.3 tego ADR (join key, nie duplikowana kolumna; miękki cross-domain ref, nie wymuszony FK) jest teraz **trzykrotnie** niezależnie odtworzony (B04↔B07, B05↔B04, B06↔B04) — spójny konsensus architektoniczny tego Gate B, nie jednorazowa decyzja tego dokumentu.
- Efekt: `export_manifest_id → primary_business_version_id → compute_run_id (B01, istniejące) → compute_job_outputs/compute_job_runs (B04) → job_id → request_id oryginalnego compute` — łańcuch domyka się przez **istniejące** kolumny B01+B06, bez potrzeby nowej kolumny na `finance_export_manifests` do samego lineage.

**Znaleziona luka (własność tego ADR, nie B06 — B06 poprawnie nie projektowało observability):** `finance_export_manifests` (B06 §6.1 DDL) **nie ma żadnej kolumny `request_id`/correlation** dla **samego requestu eksportu**. Ma `generated_by` (kto), ale nie ma „przez jaki HTTP request” — więc *`export_id`* jako ostatnie ogniwo łańcucha `request_id → … → export_id` z briefu jest dziś rekonstruowalne wstecz (do compute), ale sam moment „ktoś kliknął Export” nie zostawia własnego correlation id do zestawienia z `api_logs`/structured logami warstwy HTTP (§2.2). **Propozycja addytywna tego ADR** (§7): `finance_export_manifests.request_id text NULL` — analogicznie do tego, jak B04 §3.1 zarezerwowało `compute_jobs.request_id` dla WP-B07; ten ADR robi teraz to samo dla B06, symetrycznie, zamiast czekać aż ktoś inny to zauważy.

To jest zaktualizowana, zweryfikowana wobec realnego kodu wersja otwartej zależności wobec WP-B06 — patrz §7.

---

## 3. Reason codes — taksonomia (nie wolna forma), połączenie z B04 i B05

### 3.1 Problem z dzisiejszym stanem

B04 DDL ma `compute_jobs.error text` i `compute_job_runs.error text` — wolny tekst, dobry dla człowieka, bezużyteczny dla alertingu/agregacji (`GROUP BY error` na wolnym tekście się nie skaluje, a `LIKE '%timeout%'` jest kruche). Repo ma już precedens tego dokładnego problemu: `finance_statement_pack` używa `pack_quality_reason_codes` jako JSON-string z **wolnymi** stringami (`server/src/services/finance/financeStatementPackCandidateHandoff.ts:72,106`) — dokładnie ten antywzorzec, którego brief każe uniknąć tutaj.

### 3.2 Decyzja: rejestr kodów jako osobna tabela słownikowa, namespace’owana — uzgodniona z realnym WP-B05

`WP-B05_exception_ledger_ADR.md` §1.3 **już zdefiniowało i scommitowało** (jako szkic DDL, nie migrację) skalę severity dla `finance_exceptions`:

```sql
severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','MATERIAL','CRITICAL_DATA','SECURITY'))
```

— UPPER_SNAKE_CASE, nie `Info/Warning/Material/CriticalData/Security` z prozy master planu. Rejestr kodów poniżej **przyjmuje literalnie tę samą pisownię**, żeby `default_severity` w `finance_reason_codes` i `severity` w `finance_exceptions` nigdy nie wymagały mapowania/tłumaczenia między dwoma konwencjami:

```sql
CREATE TABLE finance_reason_codes (
  code                text PRIMARY KEY,          -- 'COMPUTE.ENGINE.CIRCULAR_UNRESOLVED'
  namespace           text NOT NULL,             -- 'COMPUTE' | 'DATA' | 'SECURITY' | ...
  category            text NOT NULL,             -- 'ENGINE' | 'INFRA' | 'LEASE' | 'LIFECYCLE' | 'CAPACITY' | ...
  default_severity    text NOT NULL
                        CHECK (default_severity IN ('INFO','WARNING','MATERIAL','CRITICAL_DATA','SECURITY')),
  default_retryable   boolean NOT NULL,
  default_alert       boolean NOT NULL,          -- czy SAM fakt wystąpienia jest incydentem SRE (§5.3)
  owner_team          text NOT NULL,              -- 'SRE' | 'Finance Controls' | 'Platform'
  description         text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE compute_jobs
  ADD COLUMN reason_code text REFERENCES finance_reason_codes(code);
ALTER TABLE compute_job_runs
  ADD COLUMN reason_code text REFERENCES finance_reason_codes(code);
```

`error` (wolny tekst) zostaje — jako szczegół czytelny dla człowieka obok skodyfikowanego `reason_code` (np. `reason_code='COMPUTE.ENGINE.CIRCULAR_UNRESOLVED'`, `error='circular reference in schedule X unresolved after deterministic solver limit'`, dokładnie ten przykład jest już w B04 §9.2). Worker klasyfikuje `reason_code` w tym samym miejscu, gdzie dziś klasyfikuje retryable/non-retryable (B04 §10) — to nie jest nowy krok procesu, tylko nazwanie decyzji, którą worker już musi podjąć.

**Ważne — FK jest jednostronny, celowo.** `compute_jobs.reason_code`/`compute_job_runs.reason_code` FK-ują do `finance_reason_codes(code)` (te tabele należą do B04/B07, więc to jest decyzja wewnątrz własnej domeny). `finance_exceptions.reason_code` **NIE dostaje** tego FK w tym ADR — B05 §1.2 już zdefiniowało tę kolumnę jako wolny TEXT z własną, nienamespace'owaną listą przykładów (`ROUNDING`, `MISSING_SOURCE`, `DUPLICATE_ROW`, `RECLASS`, `ELIMINATION`, `SIGN_CONVENTION`, `LEGACY_SHADOW_PARITY_DRIFT`), i sam ten ADR mówi wprost, że nie zmienia treści B04 — symetrycznie, ten ADR nie zmienia treści B05. `finance_reason_codes` jest więc **rejestrem doradczym (advisory)** dla `finance_exceptions.reason_code`, obowiązkowym (FK) tylko dla `compute_jobs`/`compute_job_runs`, które są własnymi tabelami tego ADR. Dokładnie ten sam wzorzec „miękkiego odniesienia między domenami, bez FK” B05 już stosuje w drugą stronę: `finance_exceptions.evidence` (JSONB) niesie `compute_run_id` jako **forward ref bez FK** do `compute_job_runs.id` (B05 §5.4, przykład payloadu, i §Załącznik A linia z komentarzem „forward ref do WP-B04 compute_job_runs — bez FK, ten sam powód co B01 §2.2”) — dwie domeny odwołują się do siebie nawzajem miękko, żaden ADR nie wymusza schematu na drugim.

### 3.3 Namespace’y — jak B05 faktycznie się podłącza (nie hipotetycznie — reason_code w B05 już istnieje)

`code` jest PK całej tabeli, więc kolizja nazw jest niemożliwa z definicji (drugi INSERT tego samego `code` po prostu nie przejdzie). Rezerwacja przestrzeni namespace’ów (konwencja, nie constraint SQL — CHECK na prefiksie byłby kruchy przy przyszłych namespace’ach):

| Namespace | Właściciel | Zakres | Projektowane w tym ADR? |
|---|---|---|---|
| `COMPUTE.INFRA.*` | SRE (ten ADR) | Retryable infrastructure failures — utrata połączenia z DB, OOM, timeout sieciowy do zależności silnika | Tak |
| `COMPUTE.ENGINE.*` | SRE/Modeling (ten ADR) | Non-retryable, deterministyczne błędy silnika — cykl bez zbieżnego solvera, dzielenie przez zero, ujemny mianownik nieokreślony (master plan §1.7) | Tak |
| `COMPUTE.LEASE.*` | SRE (ten ADR) | `EXPIRED` (reaper reclaim), zdarzenie infra-adjacent, nie błąd silnika | Tak |
| `COMPUTE.LIFECYCLE.*` | SRE (ten ADR) | `CANCELLED_BY_USER`, `KILLED_BY_KILL_SWITCH_ORG`, `KILLED_BY_KILL_SWITCH_GLOBAL`, `QUARANTINED` (§6.2) | Tak |
| `COMPUTE.CAPACITY.*` | Platform (ten ADR) | `CONCURRENCY_LIMIT_REACHED`, `QUEUE_BACKLOG_SLO_BREACH` | Tak |
| *(bez prefiksu)* `ROUNDING`, `MISSING_SOURCE`, `DUPLICATE_ROW`, `RECLASS`, `ELIMINATION`, `SIGN_CONVENTION`, `LEGACY_SHADOW_PARITY_DRIFT`, … | **Finance Controls (WP-B05, już zaprojektowane)** | Data-quality/reconciliation reason codes, `finance_exceptions.reason_code` §1.2 B05 | **Nie** — już zaprojektowane w B05, tylko cytowane tutaj |
| `SECURITY.*` (ten ADR) vs `blocking_category IN ('TENANT_BREACH','UNDEFINED_MATH')` (B05 §1.3/§3) | Security/SRE + Finance Controls | Tenant/security breach — jedyna kategoria, którą master plan §1 reguła 7 pozwala **blokować** bezwarunkowo | Częściowo — patrz rozbieżność niżej |

**Rozbieżność znaleziona i nazwana jawnie (nie cicho zignorowana):** B05 §1.3 modeluje „Security/UndefinedMath” jako **jedną** severity (`SECURITY`) z sub-klasyfikacją `blocking_category`, nie jako namespace `reason_code`. To jest bardziej precyzyjne niż mój wstępny `SECURITY.*` (namespace kodu), bo B05 wiąże twardą blokadę bezpośrednio z `severity='SECURITY'` w middleware-level gate (B05 §3), nie z konkretnym `reason_code`. **Rekonsyliacja (ten ADR przyjmuje kierunek B05, jako nowszy i bardziej precyzyjny w tym punkcie):** dla zdarzeń wykrytych przez compute engine, które kwalifikują się jako `SECURITY` (matematycznie nieokreślona operacja — jedyny przypadek, który compute engine może w ogóle wykryć samodzielnie; `TENANT_BREACH` wykrywa inna warstwa, nie silnik obliczeniowy), worker ustawia `compute_jobs.reason_code='COMPUTE.ENGINE.UNDEFINED_MATH'` **oraz** (WP-C02, poza zakresem tego ADR) powinien podnieść odpowiadający wiersz `finance_exceptions` z `severity='SECURITY'`, `blocking_category='UNDEFINED_MATH'` — `reason_code` compute i `blocking_category` B05 współistnieją na dwóch różnych rekordach tego samego zdarzenia, nie jako jedna kolumna. `SECURITY.*` jako namespace w `finance_reason_codes` zostaje zawężony wyłącznie do kodów **compute-side** (`COMPUTE.ENGINE.UNDEFINED_MATH` już jest w praktyce pod `COMPUTE.ENGINE.*`, nie potrzebuje osobnego `SECURITY.*` namespace'u) — usuwam z tego ADR pretensję do definiowania ogólnego `SECURITY.*` namespace'u, bo B05 już to własnościowo pokrywa przez `blocking_category`.

**Otwarta zależność wobec B05 (nadal jawna, mimo że B05 już istnieje):** to powyższe jest **propozycją rekoncyliacji tego ADR**, nie potwierdzoną decyzją dwustronną — analogicznie do tego, jak `GATE_B_INTEGRATION_RECONCILIATION.md` rozstrzygało B01 vs B02/B03 — „ktokolwiek pisał pierwszy nie jest automatycznie kanoniczny, rozstrzyga orkiestrator”. Wymaga potwierdzenia orkiestratora Gate B, że (a) `finance_reason_codes` jako rejestr doradczy dla B05 i obowiązkowy dla B04/B07 jest akceptowalne, (b) mapowanie `COMPUTE.ENGINE.UNDEFINED_MATH ↔ severity='SECURITY'/blocking_category='UNDEFINED_MATH'` jest tym, co WP-C02 ma faktycznie zaimplementować przy podpinaniu compute worker do exception ledger.

### 3.4 Kody startowe (seed, do doprecyzowania w Gate C, ilustracyjne tutaj)

`COMPUTE.INFRA.DB_CONNECTION_LOST`, `COMPUTE.INFRA.OOM`, `COMPUTE.INFRA.UPSTREAM_TIMEOUT`, `COMPUTE.ENGINE.CIRCULAR_UNRESOLVED`, `COMPUTE.ENGINE.DIVISION_UNDEFINED`, `COMPUTE.ENGINE.UNDEFINED_MATH` (`default_severity='SECURITY'`, mapuje na B05 `blocking_category='UNDEFINED_MATH'`, §3.3), `COMPUTE.LEASE.EXPIRED`, `COMPUTE.LIFECYCLE.CANCELLED_BY_USER`, `COMPUTE.LIFECYCLE.KILLED_BY_KILL_SWITCH_ORG`, `COMPUTE.LIFECYCLE.KILLED_BY_KILL_SWITCH_GLOBAL`, `COMPUTE.LIFECYCLE.QUARANTINED`, `COMPUTE.CAPACITY.CONCURRENCY_LIMIT_REACHED`, `COMPUTE.CAPACITY.QUEUE_BACKLOG_SLO_BREACH`, `COMPUTE.INPUT.ENGINE_MANIFEST_NOT_FOUND`.

---

## 4. Metryki (Prometheus-style)

### 4.1 Namespace i topologia zbierania

Istniejący `metrics.middleware.ts` eksportuje bez namespace (`http_requests_total`). Dla Finance compute przyjmuję prefiks **`finance_compute_`** (spójny z przykładem z briefu, `finance_compute_job_duration_seconds`) — osobny namespace, bo te metryki mają inny właściciel (SRE Finance, nie platform-wide HTTP) i inny cykl życia.

**Ważna decyzja topologii, bo compute jobs żyją w Postgresie, nie w pamięci jednego procesu:**

- Liczniki/histogramy **zdarzeniowe** (enqueue, claim, commit, cancel) są emitowane **in-process przez worker** w momencie zdarzenia — standardowy wzorzec `prom-client` (`Counter.inc()`, `Histogram.observe()`), eksponowane przez `/metrics` workera. **Otwarte pytanie dla Gate C** (§7): czy worker jest osobnym procesem od API (najprawdopodobniej, biorąc pod uwagę, że dziś compute jest w handlerze HTTP i WP-C02 ma to odseparować) — jeśli tak, worker potrzebuje **własnego** endpointu `/metrics` do scrape'owania (Railway musi umieć go scrape'ować albo trzeba push-gateway; dzisiejszy `server/src/routes/metrics.routes.ts` żyje w API procesie i nie widzi workera).
- Gauge'e **stanowe** (queue depth, concurrency utilization) nie mają jednego właściciela-procesu — kolejka to stan w Postgresie, nie w pamięci. Są aktualizowane przez **periodyczny SQL exporter**: naturalne miejsce to sam reaper (§5.3 B04), który już biegnie na timerze (~30s) i już dotyka `compute_jobs` — dokłada `SELECT status, job_type, count(*) FROM compute_jobs GROUP BY 1,2` przy okazji swojego cyklu i ustawia Gauge'e, zamiast osobnego procesu.

### 4.2 Lista metryk

| Metryka | Typ | Labele | Znaczenie |
|---|---|---|---|
| `finance_compute_job_enqueued_total` | Counter | `job_type` | Liczba przyjętych (`202`) requestów compute, włącznie z trafieniami w idempotency dedup |
| `finance_compute_job_claimed_total` | Counter | `job_type` | Liczba udanych claimów (`FOR UPDATE SKIP LOCKED`, B04 §5.1) |
| `finance_compute_job_queue_wait_seconds` | Histogram | `job_type` | `started_at - created_at` — czas oczekiwania na claim. Źródło p50/p95/p99 „jak długo klient czeka, zanim ktokolwiek zacznie liczyć” |
| `finance_compute_job_run_duration_seconds` | Histogram | `job_type` | `finished_at - claimed_at` **per attempt** (jeden wiersz `compute_job_runs`) — realny czas silnika, bez czekania w kolejce |
| `finance_compute_job_total_duration_seconds` | Histogram | `job_type` | `finished_at - created_at` na poziomie `compute_jobs` (obejmuje wszystkie retry) — „ile klient realnie czekał do wyniku” |
| `finance_compute_job_completed_total` | Counter | `job_type`, `outcome` (`succeeded\|failed\|cancelled\|lease_expired\|killed`) | Rozkład terminalnych wyników per attempt (z `compute_job_runs.outcome`) |
| `finance_compute_job_attempt_count` | Histogram (buckets 1,2,3,4,5+) | `job_type` | Ile prób potrzeba było do stanu terminalnego — wykrywa „retry storm” |
| `finance_compute_job_dlq_total` | Counter | `job_type`, `reason_code` | Job wszedł do DLQ (`status='failed' AND deadLetter`, B04 §10) |
| `finance_compute_lease_expiry_total` | Counter | `job_type` | Reaper odzyskał joba po wygasłej lease (B04 §5.3) |
| `finance_compute_cancel_total` | Counter | `job_type`, `source` (`user\|kill_switch_org\|kill_switch_global\|quarantine`) | Rozróżnia dobrowolne anulowanie od operacyjnej interwencji |
| `finance_compute_queue_depth` | Gauge | `job_type` | `COUNT(*) WHERE status='queued' AND next_attempt_at<=now()` — realny, claimable backlog, aktualizowany przez reaper-exporter (§4.1) |
| `finance_compute_org_running_count` | Gauge | `job_type` | `COUNT(*) WHERE status='running'` globalnie per typ — surowy sygnał nasycenia workerów |
| `finance_compute_concurrency_saturated_orgs` | Gauge | `job_type` | Liczba **odrębnych organizacji** aktualnie na 100% swojego `org_concurrency_limit` (B04 §8) — **celowo bez labela `organization_id`** (§4.3) |

### 4.3 Decyzja o kardynalności: brak `organization_id` jako label na surowych metrykach Prometheus

Setki/tysiące organizacji jako wartości labela eksplodowałyby liczbę time series (`finance_compute_*{organization_id=...}` × `job_type` × buckety histogramu). Zamiast tego:

- Metryki Prometheus zostają **niskiej kardynalności** (`job_type`, `outcome`, `source`, `reason_code` — te mają skończony, mały, znany z góry zbiór wartości).
- „Per-org concurrency utilization” (wymagane w brief punkt 3) jest realizowane jako **panel SQL w dashboardzie** (Grafana Postgres datasource albo wewnętrzny endpoint agregujący), nie jako oś Prometheusa: `SELECT organization_id, job_type, count(*) FILTER (WHERE status='running')::float / org_concurrency_limit(organization_id, job_type) AS utilization FROM compute_jobs GROUP BY 1,2 ORDER BY utilization DESC LIMIT 50` — top-N per zapytanie, nie per-org time series. `finance_compute_concurrency_saturated_orgs` (Gauge, §4.2) jest sygnałem alarmowym niskiej kardynalności („ile orgów jest na limicie”, nie „które”); „które” odpowiada dashboard SQL, dociekany ręcznie/w runbooku, nie w progu alertu.

### 4.4 Przykładowe PromQL dla p50/p95/p99

```
histogram_quantile(0.95,
  sum(rate(finance_compute_job_run_duration_seconds_bucket[5m])) by (le, job_type))

histogram_quantile(0.99,
  sum(rate(finance_compute_job_queue_wait_seconds_bucket[5m])) by (le, job_type))
```

---

## 5. Dashboards i alerty

### 5.1 Dashboard „Finance Compute Health” — panele

1. Queue depth per `job_type` (Gauge, time series).
2. p50/p95/p99 `job_run_duration_seconds` per `job_type` (z §4.4).
3. p50/p95/p99 `job_queue_wait_seconds` per `job_type`.
4. DLQ rate per `job_type` (derived, §5.2).
5. Lease-expiry rate per `job_type` (derived, §5.2).
6. Cancel rate by `source`.
7. Reason code breakdown, top N w oknie 24h (Counter `finance_compute_job_dlq_total` by `reason_code`, plus surowy `outcome!=succeeded` breakdown niezależnie od DLQ).
8. Panel SQL: top 50 organizacji wg concurrency utilization (§4.3) — drill-down, nie alarm.
9. `finance_compute_concurrency_saturated_orgs` — sygnał capacity planning.

### 5.2 Progi alarmowe

Wszystkie progi poniżej są **prowizoryczne / tunable po realnym ruchu produkcyjnym** — ta sama zasada, którą B04 samo zastosowało do czasu trwania lease (B04 §12 pkt 1: „do zmierzenia na runtime, nie zgadywane tu”). Nie jest to `PROVISIONAL_PENDING_OWNER_DECISION` w sensie apetytu na ryzyko biznesowe (jak próg materialności w `GATE_B_INTEGRATION_RECONCILIATION.md` §7) — to decyzja techniczna SRE, DEC-FIN-012 rutynowa, właściwa do tego ADR.

| # | Warunek (PromQL, koncepcyjnie) | Okno | Severity | Kto reaguje |
|---|---|---|---|---|
| A1 | DLQ rate `sum(rate(finance_compute_job_dlq_total[15m])) by (job_type) / sum(rate(finance_compute_job_completed_total[15m])) by (job_type) > 0.05` | 10 min sustained | Warning | SRE (najpierw sprawdź `reason_code` breakdown — jeśli to prawie wyłącznie `COMPUTE.ENGINE.*` poza `UNDEFINED_MATH`, patrz §5.3 dyskryminator, nie budzi nikogo) |
| A2 | To samo, próg `> 0.15` | 10 min | Critical | SRE, page |
| A3 | Lease-expiry rate `rate(finance_compute_lease_expiry_total[15m]) by (job_type) / rate(finance_compute_job_claimed_total[15m]) by (job_type) > 0.10` | 10 min | Warning | SRE — worker crashuje/OOM-uje albo lease za krótka względem realnego czasu liczenia |
| A4 | Queue depth `finance_compute_queue_depth{job_type} > threshold[job_type]` (próg per `job_type`, ciężkie joby typu valuation naturalnie mają niższy normalny poziom niż lekkie model_compute) | 5 min sustained | Warning | SRE/Platform — głodzenie workerów albo skok ruchu |
| A5 | Queue wait p95 SLO breach `histogram_quantile(0.95, ...queue_wait...) > slo_seconds[job_type]` | 10 min | Warning | SRE |
| A6 | **Canary — zero sukcesów mimo aktywnego ruchu**: `sum(rate(finance_compute_job_completed_total{outcome="succeeded"}[30m])) by (job_type) == 0 AND sum(rate(finance_compute_job_claimed_total[30m])) by (job_type) > 0` | 30 min | **Critical, page natychmiast** | SRE — systemowy błąd silnika/złego deploya (wszystko failuje deterministycznie), różne od A1/A2 bo tu wskaźnik procentowy myli — 100% failure przy niskim wolumenie nie zawsze przebija próg rate, ten alert łapie to wprost |
| A7 | `finance_compute_concurrency_saturated_orgs{job_type} > N` | 30 min sustained | Warning (capacity planning, nie incydent) | Platform |
| A8 | Global kill switch aktywny bez otwartego okna drain/maintenance (§6.3) | > 5 min | Warning | SRE — sprawdź czy to zaplanowany drain czy zapomniany kill switch po incydencie |

### 5.3 Rozróżnienie validation errors (oczekiwane) vs infrastructure failures (alarmować)

To jest bezpośrednia konsekwencja namespace'ów z §3.3 i kolumn `default_alert`/`owner_team` w `finance_reason_codes`:

| Namespace `reason_code` | Oczekiwane? | Alertować jako incydent SRE? | Gdzie ląduje |
|---|---|---|---|
| `COMPUTE.ENGINE.*` (poza `UNDEFINED_MATH`) — deterministyczny błąd matematyczny/edge case danych | Tak — normalny wynik pracy na realnych, brudnych danych | **Nie** pojedynczo. Widoczne w DLQ dashboardzie (§5.1 panel 7), nie budzi nikogo | DLQ + przyszły wiersz `finance_exceptions` (B05, przez adapter WP-C02), severity `MATERIAL` (lub wyższa wg oceny Finance Controls) |
| `COMPUTE.ENGINE.UNDEFINED_MATH` | Nie — to jest dokładnie przypadek B05 §1.3 `severity='SECURITY'`/`blocking_category='UNDEFINED_MATH'` | **Tak, natychmiast** — jedyny wyjątek w rzędzie „ENGINE”, bo master plan §1 reguła 7 blokuje wprost tylko to i security/tenant breach | `finance_exceptions` `SECURITY`, middleware gate B05 §3 zwraca `423 SECURITY_EXCEPTION_BLOCK` na kolejnych `POST /compute` dla tego artefaktu, dopóki ktoś (operator platformy) nie wstawi `RESOLVED` |
| kody bez prefiksu z B05 (`ROUNDING`, `MISSING_SOURCE`, …) | Tak | Nie | B05 exception ledger, poza zakresem tego ADR |
| `COMPUTE.INFRA.*` | Nie | **Tak** | SRE, alert A1–A3 |
| `COMPUTE.LEASE.EXPIRED` — pojedyncze wystąpienie | Częściowo (normalny churn workerów przy deployu) | Tylko jeśli **rate** przekracza próg (A3), nie na pojedynczy occurrence | SRE |
| `COMPUTE.CAPACITY.*` | Nie pilne, chyba że sustained | Tak, jeśli sustained (A4/A7) | Platform |
| `COMPUTE.LIFECYCLE.CANCELLED_BY_USER` | Tak | Nie | n/a |
| `COMPUTE.LIFECYCLE.KILLED_BY_KILL_SWITCH_*` | Tak, jeśli w oknie zaplanowanego drain (§6.3) | Tak, jeśli **poza** takim oknem (A8) | SRE |
| `finance_exceptions.severity='SECURITY'`, `blocking_category='TENANT_BREACH'` | Nie — zawsze incydent | **Tak, natychmiast, Critical/page** | Security + SRE. Nie jest `reason_code` compute w ogóle — silnik compute nie wykrywa naruszeń tenanta, to inna warstwa (B05 §3) |

**Ważne rozróżnienie operacyjne dla runbooków §6:** `423 SECURITY_EXCEPTION_BLOCK` (B05 §3) i globalny/org kill switch (B04 §7.2, używany w drain §6.3) to **dwa różne, niezależne mechanizmy blokujące `POST /compute`**. Kill switch OFF nie odblokowuje `423` — ten wymaga jawnego `RESOLVED` w `finance_exceptions` (B05 §3 pkt 5). Operator, który widzi `423` po wyłączeniu kill switcha po drainie, nie ma bugu — to dwie osobne bramki, sprawdź `finance_exceptions_current` po `SECURITY`/`OPEN`, nie tylko flagę kill switch.

Ta tabela jest bezpośrednim wdrożeniem wymagania z master planu §1 reguła 7: „System nie blokuje pracy z powodu błędów danych… Blokuje tylko security/tenant breach oraz matematycznie nieokreśloną operację” — `COMPUTE.ENGINE.*` (poza `UNDEFINED_MATH`) i kody B05 bez prefiksu nigdy nie są traktowane jak incydent infrastrukturalny; `SECURITY`/`UNDEFINED_MATH`/`TENANT_BREACH` zawsze są.

---

## 6. Runbooki

### 6.1 Replay — ponowienie failed joba z zachowaniem idempotency

**Kiedy używać:** job w `status='failed'` (DLQ, B04 §10) i root cause został naprawiony (rollback złego deploya, patch silnika) — retry automatyczny (backoff, B04 §10) już się wyczerpał (`attempt_count >= max_attempts`) albo `reason_code` był non-retryable od razu.

**Kluczowe ograniczenie do uszanowania:** B04 §4 explicite zabrania mutacji terminalnego wiersza (`Nie ma przejścia succeeded→* ani cancelled→* ani failed→*… re-enqueue jako NOWY job, nigdy mutacją istniejącego wiersza`). Replay = **nowy wiersz `compute_jobs`**, nigdy `UPDATE` na starym.

**Problem do rozwiązania:** `compute_jobs_idempotency_uq UNIQUE(organization_id, job_type, idempotency_key)` (B04 §3.1) blokuje wstawienie nowego wiersza z tym samym `idempotency_key` co stary, terminalny job. Trzeba świadomie wygenerować **nowy** klucz dla joba replay — to jest operatorska, jawna akcja z intencją, nie samoobsługowy retry klienta, więc nie potrzebuje ochrony idempotencji typu "double-click" (B04 §6), tylko czytelnego audytu.

**Kroki:**

1. Zidentyfikuj `job_id` (z alertu §5.2 A1/A2/A6, albo z `request_id` zgłoszonego przez użytkownika/support — §2.2 log search).
2. `SELECT` (read-only) `compute_jobs` + wszystkie `compute_job_runs` dla tego `job_id` — ustal `reason_code`/`error` ostatniej próby. Zgodnie z regułą zespołu „nie zgaduj przyczyny, zapytaj SELECT-em” (`menu-kanon-race-condition-2026-07-26`).
3. Zdecyduj tryb replay:
   - **„Replay jak oryginalnie”** — nowy job z **oryginalnym** `input_revision_hash`/`engine_manifest_id` przypiętym w starym wierszu. Używane do potwierdzenia, że fix faktycznie naprawia dokładnie ten input (regresyjna weryfikacja przed zamknięciem incydentu).
   - **„Replay na bieżącym drafcie”** — nowy job z aktualnie rozwiązanym `input_revision_hash` (jeśli użytkownik edytował draft od czasu awarii). Używane, żeby odblokować użytkownika.
4. `INSERT INTO compute_jobs (organization_id, job_type, input_artifact_id, input_revision_hash, engine_manifest_id, idempotency_key, requested_by_user_id, request_id, replayed_from_job_id) VALUES (…, 'replay:' || <original_job_id> || ':' || now()::text, <operator_user_id>, <nowy correlation id akcji replay>, <original_job_id>) RETURNING id;` — `replayed_from_job_id` to nowa, addytywna kolumna proponowana w §7 (audyt: który job jest replayem którego; B04 DDL jej nie ma, bo replay nie był w zakresie B04).
5. Monitoruj nowy `job_id` przez normalny state machine (§4 B04). Zweryfikuj `compute_job_outputs` i pole `freshness`.
6. Zamknij alert/ticket z referencją do nowego `job_id` w notatce — stary `job_id` pozostaje w DLQ na zawsze jako historyczny rekord (nigdy nie usuwany, spójne z master plan „brak destrukcyjnego contract phase”).

**Guardrail:** nigdy nie replayuj joba, którego `reason_code='COMPUTE.ENGINE.UNDEFINED_MATH'` (odpowiednik `finance_exceptions.severity='SECURITY'`, B05 §3) przez ten runbook — idzie przez proces incydentu bezpieczeństwa, odblokowanie wymaga `RESOLVED` w `finance_exceptions` (B05 §3 pkt 5), nie zwykłego replay. Nigdy nie replayuj joba w kwarantannie (§6.2) bez jawnego zdjęcia kwarantanny — kwarantanna ma pierwszeństwo nad replay.

### 6.2 Quarantine — oznaczenie joba jako „nie ponawiaj automatycznie”

**Problem:** B04 §10 celowo trzyma dokładnie 5 stanów w enumie i nie ma stanu „quarantine”. Quarantine to decyzja **człowieka** („zatrzymaj mimo że system by retry’ował”), różna od DLQ (decyzja **systemu** po wyczerpaniu prób/non-retryable klasyfikacji). Nie dodaję szóstego stanu — to złamałoby świadomą decyzję projektową B04.

**Mechanizm — reużycie istniejącego `cancel` (B04 §7.1), nie nowy prymityw:**

```sql
UPDATE compute_jobs
SET cancel_requested_at = now(),
    cancel_reason = 'QUARANTINE: ' || $2   -- $2 = '<ticket-ref> <operator> <powód>'
WHERE id = $1 AND status IN ('queued','running');
```

Dla `queued` job nigdy nie zostanie claimnięty (claim-query filtruje `cancel_requested_at IS NULL`, per B04 §7.1). Dla `running` job to cooperative cancellation przy najbliższym checkpoincie silnika (B04 §7.1/§7.2), tak jak zwykły cancel — quarantine różni się od zwykłego cancela wyłącznie **konwencją w `cancel_reason`** (prefiks `QUARANTINE:`, filtrowalny w dashboardzie: `WHERE cancel_reason LIKE 'QUARANTINE:%'`) i **operacyjną intencją** („nie replayuj tego automatycznie / dopóki ktoś nie zdejmie flagi”), nie nowym stanem SQL.

**Znaleziona luka, którą ten runbook musi adresować (flagowana do Gate C, nie do redesignu B04):** `cancel`/quarantine chroni przed **systemowym** ponownym uruchomieniem (reaper/claim nigdy nie dotkną `cancelled` joba). **Nie chronią** przed **nowym** requestem użytkownika z tym samym, niezmienionym `input_revision_hash` — B04 §9.1 domyślnie generuje deterministyczny `idempotency_key` z `(organizationId, modelId, inputRevisionHash)`. `UNIQUE(organization_id, job_type, idempotency_key)` nie wyklucza wierszy terminalnych ze swojego zakresu unikalności, więc kolejny `POST /compute` na tym samym niezmienionym drafcie trafi w ten sam klucz, `ON CONFLICT DO NOTHING` + `SELECT` znajdzie **quarantinowany, martwy wiersz** i zwróci go klientowi jako `202` — użytkownik dostaje `jobId` wskazujący na job, który nigdy nie ruszy, bez żadnego sygnału że to celowe. To nie jest błąd w B04 (B04 nie projektował quarantine), ale jest luką integracyjną, którą ten runbook musi zamknąć operacyjnie:

- Dla joba w `queued`/`running` w momencie quarantine: OK, cancel path działa jak wyżej.
- Dla trwałej blokady „nie licz tego artefaktu, dopóki nie zdejmę flagi” (np. podejrzenie skorumpowanych danych wejściowych): rekomendacja — rozszerzyć mechanizm kill switch z B04 §7.2 (`is_org_compute_killed`, dziś keyed po `organization_id`) o wariant keyed po `input_artifact_id` (`is_artifact_compute_quarantined(artifact_id)`), sprawdzany w tym samym miejscu claim-query co dzisiejszy kill switch. To reużywa dokładnie ten sam, już zaprojektowany mechanizm (ta sama tabela flag, ten sam punkt weryfikacji przed claimem — B04 §5.1) zamiast wynajdywać równoległy. Zamyka lukę: nawet gdyby klient dostał z powrotem stary quarantinowany `job_id` przez idempotency match, ten job i tak nigdy nie zostanie claimnięty, dopóki flaga na artefakcie stoi.

**Kroki:**
1. Zidentyfikuj `job_id` i/lub `input_artifact_id`.
2. Jeśli job jest `queued`/`running`: wykonaj `UPDATE` z §6.2 powyżej.
3. Jeśli wymagana jest trwała blokada na poziomie artefaktu (nie tylko tego jednego joba): ustaw flagę `is_artifact_compute_quarantined` (§7, addytywne dla Gate C).
4. Zapisz w tickecie/rejestrze — dashboard „QUARANTINE” to filtrowany widok `cancel_reason LIKE 'QUARANTINE:%'` (§5.1), nie osobne UI.
5. Zdjęcie kwarantanny: ten sam poziom autoryzacji co kill switch — `operator platformy`, nie `finance_admin` organizacji (spójne z B02-Q5/SoD, już rozstrzygniętym w `GATE_B_INTEGRATION_RECONCILIATION.md` §6). Zdjęcie flagi ≠ automatyczny replay — replay (§6.1) jest osobnym, jawnym krokiem po zdjęciu kwarantanny.

### 6.3 Drain — bezpieczne zatrzymanie przyjmowania nowych jobów przed maintenance

1. Włącz **globalny** kill switch (B04 §7.2, `organization_id IS NULL`). Claim-query wyklucza to **przed** claimem — żaden nowy job nie zaczyna się wykonywać; joby już `queued` **zostają w `queued`**, nic nie jest tracone.
2. Endpoint `POST /compute` (B04 §9.1) zaczyna zwracać `409` z nową wartością `reason` — rozszerzenie istniejącego enuma odpowiedzi (`org_kill_switch | concurrency_limit_reached | maintenance_drain`), bez nowego endpointu ani zmiany kształtu kontraktu.
3. Czekaj, aż `finance_compute_org_running_count` (§4.2) spadnie do zera — ograniczone czasowo przez długość lease (dziś placeholder 90s, B04 §5.1/§12) plus jeden cykl reapera (~30s), czyli w typowym przypadku poniżej ~2 minut, zakładając że silnik honoruje checkpointy (B04 §7.1).
4. Jeśli `running` count nie spadnie do zera w rozsądnym SLA (np. 5 minut) — potraktuj jako zawieszonego workera. Jedyna autoryzowana „twarda” akcja w tym runbooku: administracyjne wygaszenie lease (`UPDATE compute_jobs SET lease_expires_at = now() WHERE id=$1 AND status='running'`) — legalne użycie istniejącego mechanizmu reapera (B04 §5.3), NIE ręczne `DELETE`/force-kill procesu na poziomie OS. Reaper przy najbliższym cyklu oddaje joba do `queued`, gdzie kill switch (już włączony w kroku 1) blokuje ponowny claim.
5. Wykonaj maintenance.
6. Wyłącz kill switch. Wszystkie joby czekające w `queued` (oryginalne + te odzyskane w kroku 4) są natychmiast claimable przy następnym cyklu pollingu workera — bez re-enqueue, bez utraty pracy. To jest właściwość, którą daje „drain nigdy nie usuwa wierszy `queued`”.
7. Zweryfikuj powrót do normy: `finance_compute_queue_depth` wraca do baseline, DLQ rate (A1/A2) nie skacze (skok wskazywałby, że maintenance coś popsuło).

### 6.4 Rebuild — odtworzenie stanu z eventów po utracie danych

Uczciwe ustalenie na start: **`compute_jobs`/`compute_job_runs`/`compute_job_outputs` nie są zbudowane na osobnym, nadrzędnym event logu** — same SĄ najbardziej granularnym zapisem tego, co się wydarzyło (B04 nie projektuje event sourcing/outbox dla compute jobs specyficznie; outbox pojawia się w master planie dopiero przy WP-C04 shadow writes, inny kontekst). „Rebuild z eventów” dla tej domeny rozbija się na trzy różne scenariusze utraty danych, z różną odpowiedzią:

**(a) Utrata całych tabel `compute_jobs`/`compute_job_runs`/`compute_job_outputs`** (katastrofa — zła migracja, uszkodzenie dysku): nie ma niezależnego źródła, z którego by je odtworzyć na poziomie aplikacji — to jest **point-in-time restore Postgresa** (poziom infrastruktury, Railway/backup), nie runbook aplikacyjny. Skoordynuj z §6.5 (rollback/WP-C06), bo PITR na poziomie bazy dotyka całego schematu, nie tylko tabel compute.

**(b) Utrata wyłącznie `compute_job_outputs` (+ ewentualnie working revision, którą zapisał) przy zachowanej historii `compute_jobs`/`compute_job_runs`:** to jest **realnie odtwarzalne**, bo compute z definicji jest deterministyczne względem `(input_artifact_id, input_revision_hash, engine_manifest_id)` — dokładnie to założenie, na którym B04 §6 opiera cały mechanizm idempotency-na-treści (`UNIQUE(organization_id, output_artifact_id, content_semantic_hash)`). Runbook: odpal replay (§6.1, tryb „jak oryginalnie” — oryginalny `input_revision_hash`/`engine_manifest_id` wciąż jest w ocalałym wierszu `compute_jobs`) i porównaj nowo wyliczony `content_semantic_hash` z jedynym ocalałym źródłem prawdy o starym hashu: jeśli output był już promowany do `finance_business_versions` (WP-B01, i ta tabela przetrwała), `content_semantic_hash` tam jest punktem odniesienia. Jeśli utrata objęła też niepromowany output bez żadnego zewnętrznego zapisu hashu — rekonstrukcja jest możliwa (silnik jest deterministyczny), ale **niepotwierdzalna** względem starego stanu (nie ma z czym porównać) — traktuj to jako świeże policzenie, nie „dowiedzioną” rekonstrukcję, i zanotuj to ograniczenie w incydencie.

**(c) Utrata wyłącznie `compute_job_runs`** (append-only log prób): najniższa dotkliwość — `compute_jobs.status` i `compute_job_outputs` pozostają autorytatywne dla „co się stało”, to tylko degraduje możliwość śledztwa co do przebiegu przeszłych prób (ile razy, przez kogo, jak długo). Nie ma z czego tego odtworzyć — zaakceptuj lukę, opisz w post-mortem, tak jak utratę starych logów aplikacyjnych.

### 6.5 Rollback — koordynacja z Gate C WP-C06

Master plan definiuje WP-C06 jako: „Rollback przez flagi; nowe canonical data zachowane. Worker drain, queue pause, lease expiry, reverse adapter/outbox, backup restore i próby przy 25/50/99% backfill.” Ten runbook **nie projektuje WP-C06 od nowa** — opisuje wyłącznie, jak compute jobs konkretnie uczestniczą w takim rollbacku, bo B04/B07 dostarczają dokładnie mechanizmy, których WP-C06 wymaga („worker drain”, „queue pause”, „lease expiry”).

1. **Trigger:** feature flag WP-C02 przełącza `/compute` z powrotem na legacy, synchroniczny handler (`finance.routes.ts:718-747`, zachowany jako adapter w compat window per B04 §11). Rollback = przełączenie flagi routingu, **nie** reverse migracji — trzy tabele compute są czysto addytywne (B04 §11, WP-C01: „nowe, sekwencyjne migracje, bez dotykania istniejących”), więc nic ich nie usuwa.
2. **Precondition — użyj §6.3 (drain) najpierw:** globalny kill switch ON, poczekaj aż `running` spadnie do zera, **zanim** flaga routingu się przełączy — inaczej requesty w locie mogłyby trafić w oba tory na raz.
3. **Queue pause** (język WP-C06) = dokładnie drain z §6.3 kroki 1–2: kill switch + `409 maintenance_drain`/rollback-specific reason na nowych enqueue.
4. **Lease expiry** (język WP-C06) = §6.3 krok 4 — administracyjne wygaszenie lease jako fallback dla zawieszonych workerów, nie ręczny kill procesu.
5. Po przełączeniu flagi: joby, które zdążyły dokończyć się przed flip (worker proces nie jest zależny od flagi routingu HTTP, może dalej pracować, dopóki go nie zatrzymasz) commitują normalnie do `compute_job_outputs` + working revision — bez kolizji z legacy pathem, bo legacy pisze przez `persistComputeResult` bezpośrednio, job-based pisze przez B04 §6 do innych tabel; WP-C02 gwarantuje, że dla danego requesta trafia dokładnie jedna z dwóch ścieżek, nigdy obie.
6. **Rollback danych wyjściowych NIE jest w zakresie tego runbooka.** Zgodnie z master plan regułą 5 (brak destrukcyjnego contract phase) i regułą 6 (Approved immutable): `compute_job_outputs` i working revisions, które już powstały, zostają. Jeśli konkretny zły output został już promowany do zatwierdzonej `finance_business_versions`, cofnięcie TEGO należy do cyklu życia WP-B02 (invalidate/supersede), nie do rollbacku compute jobs — cross-referencja, nie redesign.
7. **Próby przy 25/50/99% backfill** (język WP-C06): na każdym checkpoincie procentowym, drain (§6.3) jest gotowym mechanizmem do uzyskania czystego „joby wyciszone” stanu przed pomiarem rehearsal — WP-C06 może to reużyć wprost zamiast projektować własny mechanizm pauzy.

---

## 7. Otwarte zależności (jawnie, zgodnie z briefem)

1. **WP-B05 (Exception/reconciliation ledger) już istnieje w tym worktree** (`WP-B05_exception_ledger_ADR.md`, napisane równolegle z tym dokumentem) — §3/§5.3 powyżej są z nim uzgodnione: severity `INFO/WARNING/MATERIAL/CRITICAL_DATA/SECURITY` cytowane literalnie z B05 §1.3, `finance_reason_codes` (§3.2) jest rejestrem **doradczym** dla `finance_exceptions.reason_code` (bez FK, symetrycznie do tego, jak B05 sam trzyma `compute_run_id` jako forward ref bez FK) i **obowiązkowym** (FK) tylko dla własnych tabel B04/B07 (`compute_jobs`/`compute_job_runs`). Mapowanie `COMPUTE.ENGINE.UNDEFINED_MATH ↔ severity='SECURITY'/blocking_category='UNDEFINED_MATH'` (§3.3) jest **propozycją rekoncyliacji tego ADR**, niepotwierdzoną jeszcze dwustronnie — wymaga potwierdzenia orkiestratora Gate B analogicznie do rekoncyliacji B01 vs B02/B03 w `GATE_B_INTEGRATION_RECONCILIATION.md`, zanim WP-C02 to zaimplementuje. Dodatkowo: B05 §5.4 (linia dot. „koszt operacyjny… trzeba będzie zaadresować w WP-B06/WP-B07”) i B05 §3 (WAIVED→OPEN po `expiry`, „WP-B07 MOŻE dodatkowo wstawiać jawny wiersz `EXPIRED` dla alertingu/SLA”) zostawiły dla tego ADR dwa konkretne, otwarte haki integracyjne, które **nie są tu jeszcze zaprojektowane** (poza zakresem „compute jobs” per se, dotyczą ogólnego exception ledgera) — do doprecyzowania przy pierwszej wspólnej rewizji B05/B07, nie blokują zatwierdzenia tego ADR.
2. **WP-B06 (Reproducibility/export manifest) już istnieje w tym worktree** (napisane równolegle z tym dokumentem). §2.4 zweryfikowało realny DDL: łańcuch do `export_id` domyka się przez istniejące `finance_business_versions.compute_run_id`/`compute_snapshot_id` (B01) + nową `finance_compute_snapshots.compute_run_id` (B06), bez potrzeby FK wprost z `finance_export_manifests` do `compute_job_outputs`. Jedyny brakujący element (propozycja tego ADR, nie B06): `finance_export_manifests.request_id text NULL` dla correlation id samego requestu eksportu — patrz §2.4 i pkt 3 niżej.
3. **Addytywne propozycje schematu dla Gate C** (nie modyfikują istniejącego DDL B04, dokładają kolumny/tabele — wzorzec identyczny do tego, jak `GATE_B_INTEGRATION_RECONCILIATION.md` §2 dodało kolumny do `finance_business_versions`):
   - `compute_jobs.replayed_from_job_id uuid NULL REFERENCES compute_jobs(id)` — audyt replay (§6.1).
   - `compute_jobs.reason_code text NULL REFERENCES finance_reason_codes(code)`, to samo na `compute_job_runs` — taksonomia (§3.2).
   - Nowa tabela `finance_reason_codes` (§3.2).
   - Rozszerzenie mechanizmu kill switch (B04 §7.2) o wariant keyed po `input_artifact_id` dla trwałej kwarantanny artefaktu (§6.2).
   - Nowa wartość `reason: "maintenance_drain"` w istniejącym kontrakcie `409` z B04 §9.1 — brak nowego endpointu.
   - `finance_export_manifests.request_id text NULL` (B06 §6.1 DDL) — correlation id requestu eksportu, symetryczne do `compute_jobs.request_id` z B04 (§2.4).
4. **Topologia procesu workera** (osobny proces vs. w procesie API, jak eksponuje `/metrics` na Railway — push gateway vs. własny scrape target) jest nierozstrzygnięta — ta sama klasa decyzji operacyjnej co otwarte pytania B04 §12 (czas lease, limity concurrency). Bez tego `finance_compute_*` (poza Gauge'ami aktualizowanymi przez reaper-exporter, §4.1) nie ma z czego być scrape'owane.
5. **Progi alarmowe (§5.2)** są startowe/tunable — do potwierdzenia po realnym ruchu, ta sama zasada co B04 §12.1.

---

## 8. Definition of Done dla WP-B07

- [x] Correlation ID: propagacja `request_id → job_id → run_id → output_id → export_id` w pełni zaprojektowana, zgodna z istniejącym mechanizmem repo (`RequestStore.ts`/`apiLogging.middleware.ts`) i zweryfikowana wobec realnego DDL WP-B06 (nie hipotetycznego kontraktu) — jedna addytywna luka znaleziona i zgłoszona (`finance_export_manifests.request_id`).
- [x] Taksonomia `reason_code` (rejestr `finance_reason_codes`, namespace'y, mapowanie na severity B05) — nie wolna forma; jawna, nazwana otwarta zależność wobec WP-B05.
- [x] Konkretne nazwy metryk Prometheus-style (`finance_compute_*`), decyzje o kardynalności labeli, topologia zbierania (in-process worker vs. reaper-exporter dla stanu z Postgresa).
- [x] Lista paneli dashboardu, 8 progów alarmowych z konkretnymi wartościami (prowizoryczne), jawna tabela validation-vs-infrastructure per namespace `reason_code`.
- [x] Pięć runbooków: replay, quarantine, drain, rebuild (trzy scenariusze utraty danych), rollback (skoordynowany z WP-C06, nie zaprojektowany od nowa).
- [ ] Realne pliki konfiguracji Grafana/Alertmanager — implementacja Gate C, nie ten ADR.
- [ ] Seed danych `finance_reason_codes` — treść migracji Gate C, nie ten ADR.

Status realizacji WP-B07: **ADR gotowy do review; implementacja (migracje addytywne z §7, instrumentacja metryk, dashboardy, reguły alertów) czeka na Gate C, zgodnie z kolejnością fal master planu §7.**
