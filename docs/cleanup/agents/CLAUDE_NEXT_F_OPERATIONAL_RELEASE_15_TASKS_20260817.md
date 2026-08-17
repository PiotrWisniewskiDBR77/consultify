# Claude Next F — Operational and Release Readiness (15 tasks)

## Prompt do uruchomienia od zera

Jesteś szefem toru **Claude F / Operational Release Readiness**. Opus prowadzi i recenzuje, Sonnety realizują bounded zadania. Twoim celem jest zamknąć owner-free NFR i release engineering na dowodach, a nie ogłosić produkcyjne GO. Pracujesz do skutku; zewnętrzne credentials, produkcja i decyzje właścicieli pozostają literalnymi blockerami.

### Start i izolacja

- Repo: `/Users/piotrwisniewski/Developer/consultify-recovery-canonical-20260816`
- Baseline: `7d9c8d7de3200cce4314c88da4c5e20a578ddab3`
- Branch/worktree: `codex/closure-claude-f-operational-release-20260817`, czysto z baseline.
- Zakres: `scripts/**`, test harnesses, monitoring/metrics, cron/workers, backup/recovery, security dependencies, runbooks, CI/release gates i bounded backend seams wymagane przez te taski.
- Nie dotykaj logiki domenowej Initiative/Execution/Assessment/Audits/Tools/Materials/Finance/Results/Partner poza minimalnym adapterem sygnału uzgodnionym w rejestrze; większy defekt eskaluj jako integrator request.
- Bez merge/push/deploy/release i bez dostępu do produkcyjnych sekretów.

### 15 tasków

1. `OPS-OBS-001` — podłącz realne write failures, outbox age, DB saturation i auth denials do istniejącego alert service.
2. Dodaj durable alert transport abstraction z fail-closed retry/dead-letter i lokalnym positive-control receiverem.
3. Udowodnij alert lifecycle: fire, dedupe, sustain, recovery, acknowledge-after-recovery i cold restart.
4. `DATA-DR-001` — zintegruj encrypted backup artifact z rzeczywistym BackupCron/BackupService, bez plaintext fallback.
5. Udowodnij harmonogram RPO 15 min, missed-run alert, retention i key-missing fail-closed na lokalnym środowisku.
6. Wykonaj pełny source→encrypted artifact→isolated restore→migration replay→previous-SHA reader compatibility drill.
7. `ADM-MVP-OPS-001` — uruchom trwały worker jobs, lease recovery, retry/exhaustion, metrics i alert positive control przez dłuższe okno lokalne.
8. `NFR-PERF-001` — napraw createCase p99 tail i czerwone/błędne benchmark harnesses zamiast je wyłączać.
9. Uruchom minimum 30 min / 50 authenticated users / drugi tenant negative stream; policz p50/p95/p99/error/heap trend.
10. Zmierz browser LCP/CLS/interaction dla reprezentatywnych powierzchni desktop/mobile i zapisz surowe artefakty.
11. `SEC-PRIV-001` — zamknij wszystkie bezpiecznie naprawialne prod vulnerabilities i przygotuj izolację dla dwóch upstream-only chains.
12. Napraw contract-test discovery: denominator nie może wynosić zero; rozdziel real mounted-server contracts od syntetycznych harnessów.
13. Napraw siedem znanych provider-contract failures lub sklasyfikuj rzeczywisty produktowy kontrakt z testem negatywnym; żadnego SPA-200 false success.
14. Zbuduj deterministyczny global gate runner: discovery, fresh/repeat/dry migrations, typecheck, builds, contract, realDB, evidence schema i cleanup.
15. `REL-001-T01` — przygotuj release-candidate manifest exact SHA, migration ledger, rollback drill, known blockers i literalny `NOT_AUTHORIZED`; nie wykonuj wdrożenia.

### DoD

- Każdy pomiar ma denominator, czas, exact SHA, fixture, negative/positive control i raw artifact.
- Fresh PostgreSQL i real Redis tam, gdzie komponent tego wymaga; brak mock success dla systemów operacyjnych.
- Testy nie mogą niszczyć współdzielonych baz ani używać stałych nazw; każdy zasób disposable ma unikalną nazwę i jest sprzątany tylko przez właściciela.
- Nie maskuj timeoutów/retry ani OOM. Napraw harness lub zachowaj czerwony literalny status.
- Type-check, frontend/backend build, discovery denominator, diff-check i evidence reporter muszą przejść na końcowym SHA.
- Produkcyjne SLO, deployment, KMS, provider availability i release authorization pozostają `BLOCKED_OWNER`/`NOT_AUTHORIZED` bez realnych dowodów.

### Handoff

Logiczne commity, czysty worktree, `HANDOFF.md`, tabela 15/15, before/after metrics, wszystkie czerwone bramki i ich atrybucja, lista zasobów utworzonych/usuniętych, release manifest. Bez merge/push/deploy/release.
