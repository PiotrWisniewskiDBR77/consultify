# Claude Next E — Legacy Cutover and Single-Writer Closure (15 tasks)

## Prompt do uruchomienia od zera

Jesteś szefem autonomicznego toru **Claude E / Legacy Cutover**. Opus zarządza, rozstrzyga architekturę i recenzuje, Sonnety wykonują bounded pakiety. Celem jest realne ograniczenie split-brain i legacy writerów, nie samo sporządzenie inwentarza. Pracujesz do pełnego DoD wszystkich technicznie wykonalnych elementów.

### Start i izolacja

- Repo: `/Users/piotrwisniewski/Developer/consultify-recovery-canonical-20260816`
- Baseline: `7d9c8d7de3200cce4314c88da4c5e20a578ddab3`
- Branch/worktree: `codex/closure-claude-e-legacy-cutover-20260817`, czysto z baseline.
- Zakres: backend Finance, Results, Partner, Settings aliases, route/owner registries, forward-only migracje, realDB/contract tests i evidence.
- Bezwzględny denylist: Initiative, Execution, Agent/MyWork, Assessment, Audits, Tools oraz wspólny frontend. Nie dotykaj ich bez change requestu.
- Nie merge/push/deploy. Nie usuwaj legacy na podstawie grep; każdy cutover wymaga parity, backfill, telemetry, rollback i cold readback.

### 15 tasków

1. Zinwentaryzuj wszystkie Finance write routes i przypisz każdemu dokładnie jednego canonical ownera oraz successor contract.
2. Zamknij następny bezpieczny tranche Finance legacy writers po istniejącym `/models/:id/approve`; minimum pięć writerów z realną parity.
3. Uczyń Finance legacy telemetry kompletną, tenantową, idempotentną i odporną na failure; zero silent success.
4. Udowodnij/backfilluj mapowanie legacy ID → artifactId → businessVersionId → workingRevisionId dla każdego zamykanego writer surface.
5. Skonsoliduj Finance read compatibility tak, aby legacy i v8 czytały ten sam governed owner albo fail-closed.
6. Domknij `FIN-MVP-CUTOVER-001` na możliwie największym technicznie bezpiecznym zakresie, pozostawiając owner rollout jawnie oddzielony.
7. Zinwentaryzuj Results legacy write/mount surfaces oraz default-OFF flag truth bez uznawania niewidocznego modułu za aktywny.
8. Wyłącz lub przekieruj Results writers mające udowodnioną canonical parity; dodaj 410/successor i bounded rollback.
9. Domknij durable Results cutover telemetry, backfill denominator, tenant isolation i restart-safe readback.
10. Udowodnij, że Execution→Results ingress i Results→Finance projection są exactly-once, versioned i nie nadpisują Actual.
11. Zinwentaryzuj wszystkie 16 Partner legacy mutations oraz ich canonical V8 successorów.
12. Zamknij pozostałe technicznie równoważne Partner writers; te bez parity zostaw aktywne i jawnie sklasyfikowane, nigdy pozornie wyłączone.
13. Domknij Partner referral/connection/certification/attribution read parity i backfill identity na świeżej bazie.
14. Sprawdź Settings/GDPR alias writers: jeden tenant-bound export owner, brak alternatywnego writer bypassu, immutable receipt i canonical response.
15. Zbuduj wspólny `LEGACY_CUTOVER_REGISTER`: route, verb, owner table/service, successor, status, telemetry, backfill, rollback, last observed usage i exact proof.

### DoD każdego tranche

- Fresh PostgreSQL od zera, strict migration, repeat=0, dry-run=0 i ledger bez failure.
- Mounted real router z real JWT + aktywnym membership, drugi tenant i stale JWT negative.
- Parity old→new na realnych danych, deterministic backfill, idempotency, concurrency, cold new-process/client readback.
- Disabled writer zwraca jawny 410/409 z successor contract przed leaf mutation; telemetry failure nie może ponownie włączyć writera.
- Emergency rollback jest jawny, default OFF, audytowany i nie usuwa danych.
- Nie wolno oznaczyć route jako retired bez zero-writer proof. Brak owner rollout/observation window = `BLOCKED_OWNER`/`PARTIAL`, nie DONE.
- Focused tests + type-check + backend build + diff-check. Dowody exact SHA w TASK_EVIDENCE i rejestrze cutover.

### Handoff

Małe commity per domain/tranche. Końcowy czysty worktree, `HANDOFF.md`, lista wszystkich 15 tasków, licznik writerów before/after, niewyłączone surfaces z powodem, migracje, test denominators i integrator requests. Bez merge/push/deploy.
