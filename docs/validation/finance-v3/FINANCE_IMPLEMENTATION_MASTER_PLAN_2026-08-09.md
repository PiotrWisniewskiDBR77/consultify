# Finance — Implementation Master Plan

Data: 2026-08-09  
Status: `IMPLEMENTATION PLAN / READY FOR GATE A / NO-GO`  
Baseline: `9c23e3d80e` na `codex/sync-demo-20260729`  
Zakres: profesjonalny system Statements, Analysis, Baseline Models, Prediction, Enterprise Valuation, Advisor, eksporty, governance i stanowisko analityka.

Dokumenty wejściowe:

- `OWNER_REVIEW_REGISTER_2026-08-09.md`
- `FINANCE_COMPLETION_RECOMMENDATIONS_2026-08-09.md`
- `FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`

## 1. Zasady wykonania

1. Pełny zakres ekspercki nie jest redukowany. Etapy są kolejnością bezpiecznej dostawy, nie okrojonym MVP.
2. Standardowe decyzje finansowe, audytowe, model-risk, techniczne i UX rozstrzyga zespół zgodnie z `DEC-FIN-012`.
3. Każdy pakiet ma ownera kompetencyjnego, zależności, Definition of Done i wymagane dowody.
4. Żaden status UI nie zastępuje dowodu SQL/HTTP/runtime ani niezależnego known-answer workbooka.
5. Migracje są addytywne: expand → backfill → shadow → cutover per moduł → rollback. Brak big-bang i brak destrukcyjnego contract phase w tym programie.
6. Approved jest immutable; Working Revisions są oddzielone od Business Versions.
7. System nie blokuje pracy z powodu błędów danych: prowadzi exception ledger i oznacza rezultat Clean/Conditional/Provisional. Blokuje tylko security/tenant breach oraz matematycznie nieokreśloną operację.
8. Repozytorium jest współdzielone i brudne. Każdy pakiet wymaga allowlisty plików, baseline checksum oraz czystego candidate SHA przed integracją.

## 2. Docelowa architektura

### 2.1 Artefakty i wersje

Wspólne identyfikatory:

- `artifact_id`
- immutable `business_version_id`
- mutable Draft `working_revision_id`
- immutable `compute_snapshot_id`
- `compute_run_id`
- `engine_manifest_id`
- `content_semantic_hash`
- `organization_id`

Business lifecycle:

`DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED / ARCHIVED / INVALIDATED`

`NEEDS_CHANGES` wraca do Draft. Reopen tworzy vN+1. Approved nie ma zwykłego hard-delete.

Freshness jest niezależne:

`NEVER_COMPUTED / CURRENT / STALE_SOURCE / STALE_ASSUMPTIONS / COMPUTE_FAILED`

### 2.2 Lineage

Kontrolowany DAG na poziomie wersji:

- Statement → Analysis
- Statement + Analysis → Baseline Model
- Baseline → Prediction Scenario
- Baseline lub Scenario → Valuation
- dowolne jawne wersje → Report/Export/TRS context

Relacje są org-scoped, typed, append-only i odporne na rename/archive. Cykle oraz cross-tenant edges są zakazane.

### 2.3 Compute jobs

Pierwsza implementacja: persisted PostgreSQL queue z `FOR UPDATE SKIP LOCKED`, leases/heartbeat, at-least-once execution i idempotentnym commitem. Globalny timeout HTTP nie steruje jobem.

Każdy job:

- wskazuje immutable input revision hash,
- posiada org scope, idempotency key i engine manifest,
- raportuje queued/running/succeeded/failed/cancelled,
- commituję najwyżej jeden output version,
- nie traci draftu przy timeout/crash,
- po edycji w trakcie run zwraca wynik oznaczony jako stale wobec nowej rewizji.

### 2.4 Wartości finansowe

Wspólny typ wartości rozróżnia:

`PRESENT_ZERO / PRESENT_NONZERO / MISSING / NA / NOT_APPLICABLE`

oraz przechowuje native/presentation currency, unit, multiplier, period identity, entity, source/evidence, adjustment flags i decimal value. Rounding odbywa się wyłącznie na granicy prezentacji.

## 3. Program wykonawczy

## Gate A — Inventory, API freeze i bezpieczeństwo

### WP-A01 Canonical inventory manifest — Owner: Data/DB — P0

Zakres: wszystkie aktywne i historyczne tabele statement/analysis/model/event/output/scenario/valuation/snapshot/v8, constraints, indexes, counts per org/status, NULL period/unit, orphan refs, Approved bez snapshotu i duplikaty wersji.

Wyjście:

- deterministyczny JSON + raport MD,
- query pack,
- klasyfikacja `AUTO_MIGRATE / MIGRATE_WITH_WARNING / QUARANTINE / EXCLUDE_WITH_REASON`,
- equation: input = candidate + quarantine + excluded.

DoD: dwa uruchomienia dają ten sam hash; 100% rekordów sklasyfikowane; brak inferowania brakującego source/unit/period.

### WP-A02 API and consumer freeze — Owner: API Architecture — P0

Inventory legacy `/api/economics`, finance routes i v8, payload/status/auth/idempotency, FE consumers, skrypty, deep links i eksporty. Powstają zamrożone fixtures/contract tests oraz klasy `SUPPORTED_FROZEN / ADAPTER_TARGET / INTERNAL_ONLY`.

DoD: każdy endpoint ma ownera i konsumenta; CI wykrywa breaking shape; split-brain jest w całości zmapowany.

### WP-A03 Legacy classification — Owner: Data Migration + Finance — P0

Legacy row staje się v1 tylko przy jednoznacznym tenant/status/source/payload. Approved bez snapshotu, NULL period/unit, event-only model i duplicate valuation version trafiają do quarantine/conditional. Historyczne wyniki nie są po cichu przeliczane.

DoD: 100% klasyfikacji; reason code, severity, owner queue i checksum; inspekcja wszystkich critical oraz losowych 50 przypadków.

### WP-A04 Security incident closure — Owner: Security/Platform — P0

Zamknąć incydent lokalnej produkcyjnej bazy. Dedykowany staging read-only DB role, osobne least-privileged połączenie auth, fail-closed production fingerprint, DDL disabled, jedna instancja backendu, audit mutacji i rotacja sekretów, jeśli dowody tego wymagają.

DoD: business DML/DDL blokuje sama rola DB; login/refresh/logout działa; lokalny proces nie używa prod writer credentials; incident ledger podpisany.

### Exit Gate A

A01–A04 Accepted; API fixtures zamrożone; security CLOSED albo Gate C staging pozostaje zablokowany.

## Gate B — Canonical contracts

### WP-B01 Artifact/version/revision schema — Owner: Architecture/Data — P0

Nowe addytywne struktury: artifacts, business_versions, working_revisions, aliases i engine_manifests. UNIQUE artifact/version, same-org parent oraz immutable Approved.

### WP-B02 Lifecycle, concurrency i SoD — Owner: Domain/Platform Security — P0

Wspólny state machine, `expectedVersion/ETag`, atomowy approval, race rules oraz role preparer/reviewer/approver/finance_admin/viewer. Maker–checker dla material/high-risk.

### WP-B03 Lineage i staleness — Owner: Data Architecture — P0

Typed version edges, ancestors/descendants/siblings, cycle prevention, stale propagation bez autorecompute i archive-safe history.

### WP-B04 Jobs/runs/outputs — Owner: Platform/SRE — P0

Persisted jobs, runs, output versions, leases, retry/DLQ, cancel, kill switch i per-org concurrency.

### WP-B05 Exception/reconciliation ledger — Owner: Finance Controls — P0

Info/Warning/Material/CriticalData/Security, owner, impact, reason, waiver/expiry, cell/value reference i immutable events/comments. CriticalData pozwala na Provisional; security/math undefined blokuje.

### WP-B06 Reproducibility, restatement, retention i export — Owner: Model Risk/Legal/Data — P0/P1

Engine manifest, semantic hash, original/restated/management-adjusted lineage, retention/legal hold oraz immutable export manifest. Konkretne okresy retencji i jurysdykcja wymagają osobnej decyzji prawnej/kosztowej.

### WP-B07 Observability i runbooks — Owner: SRE — P0

Correlation request→job→run→output→export, reason codes, metrics, dashboards, alerts i runbooks replay/quarantine/drain/rebuild/rollback.

### Exit Gate B

Zatwierdzone ADR, ERD/DDL, API, lifecycle, permissions, job state machine, exception policy, retention/export contracts i wykonywalne test vectors.

## Gate C — Expand, backfill, shadow, cutover i rollback

### WP-C01 Additive migrations — Owner: DB Migration — P0

Nowe sekwencyjne migracje bez drop/rename legacy. NOT VALID tam, gdzie potrzebne; real Postgres fresh replay i production-like upgrade; lock-time zmierzony.

### WP-C02 Compatibility services i `/api/v8/finance-v2` — Owner: Backend/API — P0

Canonical services: artifactVersion, lifecycle, lineage, computeJob i exceptionLedger. Legacy handlers korzystają z adapterów i zwracają zamrożony payload.

### WP-C03 Deterministic backfill — Owner: Data Migration — P0

Kolejność: Statements → Analysis → Models → Prediction candidates/events → Valuation → Exports. Chunking per org+PK, dry-run, resume token, checksums, quarantine; brak syntetyzowania braków.

### WP-C04 Shadow writes/reads i parity — Owner: Platform/Data QA — P0

Canary tenant; atomic legacy+canonical/outbox; read legacy, compare canonical. Feature kill switch. Minimum uzgodniony wolumen/okres bez niewyjaśnionych critical mismatch.

### WP-C05 Cutover rehearsal — Owner: Release/SRE — P0

Per moduł: Statements → Analysis → Models → Prediction → Valuation. Exact SHA/config/flags, HTTP+SQL readback, performance i tenant security.

### WP-C06 Rollback/forward-fix rehearsal — Owner: SRE/DB — P0

Rollback przez flagi; nowe canonical data zachowane. Worker drain, queue pause, lease expiry, reverse adapter/outbox, backup restore i próby przy 25/50/99% backfill.

### Exit Gate C

Deterministyczna migracja, fixture diff zero, aliases działają, shadow parity bez critical mismatch, jeden output per job, security/SoD/tenant tests, cutover i rollback bez utraty acknowledged writes.

## 4. Pakiety domenowe

### WP-D01 Statements — Owner: Financial Data/CFO — P0

Profesjonalny ingestion i Statement Pack Versions: P&L/BS/CF, fiscal calendars, flow/stock, YTD/LTM/stub, restatement, IFRS/GAAP, multi-currency/FX/CTA, consolidation, eliminacje, NCI, accounting adjustments i source reconciliation ledger.

DoD:

- source = mapped + excluded + unmapped + residual,
- zero unexplained critical residual,
- Assets=L+E i cash tie-out w source-rounding tolerance,
- subtotals i roll-forward niezależnie przeliczone,
- original/restated zachowane,
- no missing→zero.

### WP-D02 Historical Analysis — Owner: Financial Analysis — P0

Trójwarstwowy KPI catalog, quick create/customize, formula/convention registry, normalized earnings, actual/prior/budget/forecast, segments i price-volume-mix, benchmark governance, variance owners/actions.

DoD: każdy KPI odtwarzalny input→formula→result; average-balance/interim/LTM/negative denominator known answers; benchmark snapshot/licensing; review comments i Conditional/Provisional policy.

### WP-D03 Baseline Models — Owner: FP&A/Modeling — P0

Neutralny no-decision model z exact Statement+Analysis versions. Pełne schedules: revenue, headcount, COGS/opex, DSO/DIO/DPO, CAPEX/depreciation, leases, contractual debt/interest, tax/NOL/deferred tax, retained earnings. Brak cash/debt plug i nowych decyzji finansowych; ujemna kasa pozostaje jako funding-gap alarm.

DoD: monthly engine, purpose-driven horizon, P&L→CF→BS, no unexplained plug, deterministic circular solver/fail, holdout backtest, known-answer workbook i exact cold reopen.

### WP-D04 Prediction — Owner: Strategy/Scenario Modeling — P0

Base/Upside/Downside, manual driver overrides i fundamental initiatives. Finansowanie, debt repayment, dividend i surplus allocation należą tutaj. Dwuetapowy Compute: preflight konfliktów z rekomendowanymi resolution, potem calculation. Reverse stress, liquidity/covenant headroom i realized-benefit feedback.

DoD: Base semantically = baseline; konflikty nie sumują się po cichu; financing respektuje facility; statements/schedules reconcile; scenario→actual benefits i cold reopen.

### WP-D05 Enterprise Valuation — Owner: Valuation/Corporate Finance — P0/P1

Valuation Cases z nazwanymi/opisanymi wariantami. DCF/FCFF, trading comps, precedents tam, gdzie właściwe, WACC, terminal economics, EV→Equity bridge, weighted recommendation basket + unweighted cross-checks, sensitivity i Advisor przed approval z TRS context.

DoD: niezależny workbook inputs/intermediates; 25 monotonic cells; nominal/real/currency/as-of consistency; reproducible peer table; atomic approval; Apator unit proof; Advisor evidence/confidence; export manifest i brak global crash.

## 5. Analyst Productivity i UX

### AP-00 Shared productivity contracts — Owner: Product Architecture — P0

ArtifactRef, CellRef, Operation, WorkspaceState, common missing/value/freshness semantics, capability endpoint, batch mutations i idempotency.

### AP-01 Finance Data Grid — Owner: Frontend Platform — P0

Virtualized shared grid: ranges, paste/fill, bulk changes, find/replace, freeze/group, formula bar, status/validation i stable canonical keys. Target 10k×120 logical cells; scroll ≥45 FPS; input p95<100 ms; 1000-cell paste atomowe.

### AP-02 Excel/CSV round-trip — Owner: Artifacts/Finance UX — P0/P1

Values/formulas/template/export/import update; manifest, async jobs, diff preview, transactional apply, no macros/external execution i zero silent coercion.

### AP-03 Keyboard command layer — Owner: Frontend/A11y — P0/P1

Pełny workflow bez myszy, command registry/palette i keyboard benchmark ≤90 s.

### AP-04 Undo, autosave i conflicts — Owner: Collaboration/Data — P0

Operation stack + Working Revisions, atomic bulk undo, ≤5 s crash recovery, mine/theirs/base conflict i compute pinned to revision hash.

### AP-05 Compare — Owner: Analytics UX — P0/P1

Period, actual/forecast, version, entity, scenario i method; absolute/Δ/%, materiality, synchronized scroll i export diff.

### AP-06 Comments/review — Owner: Workflow UX — P0/P1

Cell/range anchors, mentions, assignments, blocking comments, checklist i changed-only review. Approval respektuje maker–checker.

### AP-07 Filters/saved views — Owner: Table Platform — P1

Personal/team views, server filters, column schema migration i shareable URLs.

### AP-08 Exception inbox — Owner: Finance Operations UX — P1

Deduplicated root causes, owner/SLA/deep link, triage i resolve; nie toast stream.

### AP-09 Workspace Bar/focus — Owner: Design System — P1

Odchudzony pasek: identity, main views, 1 primary + max 1 secondary + lifecycle + More + fullscreen. Context w popover. Focus zostawia Menu 1. Mobile mutacje fail-closed disabled.

### AP-10 Module adapters — Owner: Module FE Leads — P1

Statements, Analysis, dokładnie dwa widoki Models, dwa widoki Prediction i Valuation flow używają wspólnych primitives bez lokalnych bypassów.

### AP-11 Lineage navigator — Owner: Information Architecture — P1

Compact trail, Related drawer, Create from source i stale badges. Pełny graf pozostaje pomocniczy.

## 6. Gold vertical slice

Pierwszy oracle: syntetyczny `GoldCo Manufacturing Group`:

- parent PLN + subsidiary EUR,
- FY2023–2025 i miesięczny detal,
- 2024 restatement,
- konsolidacja, jedna eliminacja i NCI,
- analysis universal + manufacturing, normalized EBITDA i PVM,
- baseline 2026–2028 z pełnymi schedules, bez plug, z ujemną kasą/funding-gap,
- Prediction: Base, efficiency initiative i downside; konflikt cost override vs initiative rozwiązany w preflight; finansowanie wyłącznie w scenario,
- Valuation: baseline/downside, FCFF DCF + trading comps, exit multiple cross-check, 5×5, Advisor, maker–checker i Export.

Każdy wynik posiada niezależny workbook z wartościami pośrednimi. Następnie real-data proof: CD Projekt, Apator, Tesco i Tesla.

## 7. Fale realizacji

1. **Fala 0:** Gate A — inventory, API freeze, legacy i security.
2. **Fala 1:** Gate B — canonical contracts.
3. **Fala 2:** Gate C — schema, adapters, backfill, shadow i rollback.
4. **Fala 3:** GoldCo Statements + AP-00/AP-01/AP-04.
5. **Fala 4:** Analysis + AP-03/AP-06/AP-07.
6. **Fala 5:** Baseline Models + AP-05/AP-02.
7. **Fala 6:** Prediction + conflict/preflight/financing.
8. **Fala 7:** Valuation + market data + Advisor + Export.
9. **Fala 8:** AP-09/AP-10/AP-11/AP-08 i spójny workspace rollout.
10. **Fala 9:** pełny GoldCo E2E, cztery real companies, load/fault/concurrency/tenant matrix.
11. **Fala 10:** independent CFO pilot i progressive tenant rollout.

Po zamrożeniu Gate B można równoleglić grid/review UX, market-data adapters i golden workbook. Nie wolno równolegle tworzyć konkurencyjnych wersji formula/value/version engines.

## 8. Globalne bramki GO

- Clean candidate SHA i kompletna allowlista zmian.
- Disposable real Postgres fresh+upgrade migrations, deterministic backfill i rollback rehearsal.
- Exact HTTP + SQL readback; legacy fixture diff zero podczas compatibility window.
- Cross-org, role/SoD, concurrency, fault-injection i job idempotency tests.
- Golden cases: annual/interim/YTD/stub/restated, multi-currency/consolidated, negative, sparse, leveraged i seasonal.
- Known-answer workbooks obejmują inputs, conventions, schedules, formulas i outputs.
- Analyst benchmarks: 100×10 paste <60 s z atomic Undo; standard analysis ≤45 s; keyboard task ≤90 s; Excel 5k×60 round-trip bez silent coercion; Why this number ≤3 kliknięcia.
- Playwright: grid, Excel, concurrency/draft, compare/review, saved views, focus, mobile-disabled i lineage/exceptions na exact SHA.
- 1280/1440/1920, 200% zoom, keyboard-only i WCAG AA. Tablet/mobile zgodnie z capability policy, bez mutacji.
- Create/edit/import/compute/preflight/resolve/review/approve/reopen/compare/export/cold reopen dla pełnego DAG.
- Independent CFO pilot kończy cały przepływ bez nieudokumentowanych workaroundów.

Do czasu przejścia wszystkich właściwych bramek status programu pozostaje `NO-GO / EVIDENCE_MISSING`.

## 9. Pierwsze autoryzowane działanie wykonawcze

Rozpocząć wyłącznie Falę 0 / Gate A w nowej, kontrolowanej gałęzi/worktree lub po ustaleniu allowlisty w obecnym współdzielonym repo. Nie uruchamiać migracji zapisujących ani backfillu przed odbiorem A01–A04 i nie stagingować niezwiązanych zmian.
