# MVP_USABLE_100 staging rehearsal — exact execution runbook

**Authority:** `D7=B` staging only. Production remains `NOT_AUTHORIZED`.  
**Candidate:** `71316e4125ba3f912cbcd0612639bb463b41dae7`  
**Immutable ref:** `refs/recovery/mvp-usable-100-release-candidate-20260820`  
**Railway target:** project `consultify`, environment `staging`, service `consultify`  
**Deploy operator:** Codex `/root`; accountable owner: Piotr  
**Rollback operator:** Codex `/root`; accountable owner: Piotr

This runbook is executable only after the D2 provider-side rotation/revocation
receipts are recorded. It must stop before every mutation if the target, SHA,
ledger or authority differs.

## 1. Pre-mutation identity gate

1. Require a clean canonical worktree and exact immutable ref:

   ```bash
   git status --porcelain
   git rev-parse refs/recovery/mvp-usable-100-release-candidate-20260820
   ```

2. Require Railway project `a6d59e88-263d-45f3-96bc-861f66bf467b`, environment
   `487a33ba-84b0-4e2e-b18b-7f981ae5334d`, service
   `8f65b820-3d55-4dd9-8076-929d01cc4157`.
3. Require D2 receipts for OpenAI, GCP and LinkedIn. A Railway hash comparison
   is necessary but not equivalent to provider-side revocation.
4. Record current staging service IDs, variable-key inventory, deployment ID,
   domain and database volume state. Never print secret values.
5. Preserve the existing staging Postgres. Its historical migration ledger is
   fail-closed and must not be edited, normalized or reused for this rehearsal.

## 2. Fresh staging-only database

After the gate above is green:

1. Create exactly one managed database named
   `Postgres-Rehearsal-20260820-71316e` in `staging`:

   ```bash
   railway add --database postgres --service Postgres-Rehearsal-20260820-71316e --json
   ```

2. Run the strict migration chain from the detached candidate worktree using
   that service's public URL only for the operator process. Do not use the stale
   application `DATABASE_PUBLIC_URL` and do not set a production override.
3. Require:

   - fresh apply: every candidate migration succeeds;
   - immediate replay: `Applying migrations: 0`;
   - dry run: zero pending migrations;
   - migration checksums and count captured;
   - no failed or NULL-checksum row unless explicitly classified by current code.

4. If any step fails, retain both databases, do not rewire the application and
   record `STOP_MIGRATION_LEDGER`.

## 3. One atomic staging configuration cutover

Do not edit variables one at a time because each edit can redeploy the stale
image. Prepare one reviewed environment JSON patch and apply it once immediately
before the exact candidate upload.

Required state:

- `APP_BUILD_SHA=71316e4125ba3f912cbcd0612639bb463b41dae7`;
- `DATABASE_URL=${{Postgres-Rehearsal-20260820-71316e.DATABASE_URL}}`;
- remove or replace the stale application-level `DATABASE_PUBLIC_URL`; runtime
  must use private database networking;
- `FRONTEND_URL=https://staging.consultify.ai`;
- `APP_ENV=staging`, `RAILWAY_ENVIRONMENT=staging`, `NODE_ENV=production`;
- `DB_MANAGED_SCHEMA=off`; migrations remain an explicit operator step;
- schedulers and background mutation loops disabled for the rehearsal unless a
  specific flow requires and separately authorizes them;
- Meeting recording/transcription OFF;
- Settings OAuth OFF;
- destructive account deletion worker OFF;
- Partner economics/accrual/payout OFF;
- Results visibility OWNER/ADMIN-only;
- Materials external providers unavailable without governed provenance/rights;
- test gateway disabled for final production-shaped flows; signed fixtures must
  be prepared before disabling it;
- build-time Vite flags explicitly inventoried; no missing flag may be inferred
  from a runtime value.

Read the config back after the patch and compare the non-secret manifest before
uploading code.

## 4. Exact-SHA deployment and identity readback

1. Create a detached, clean worktree at the immutable ref. Reuse dependencies
   only through read-only symlinks; do not copy or regenerate lockfiles.
2. Link that worktree explicitly to `consultify / staging / consultify`.
3. Upload with a pinned message:

   ```bash
   railway up --detach --service consultify --environment staging \
     -m "MVP_USABLE_100 staging rehearsal 71316e4125"
   ```

4. Wait for a terminal successful deployment. Require:

   - `/ping` healthy;
   - `/api/health.gitSha` or the canonical health identity equals the full
     candidate SHA;
   - frontend and backend report the same identity;
   - migration ledger count/checksums equal the preflight receipt;
   - no startup migration attempt under `DB_MANAGED_SCHEMA=off`;
   - no production URL, production database host or production traffic.

Any mismatch is an immediate rollback trigger.

## 5. Sixteen mounted flows

Run signed desktop and mobile, hard reload and cold readback for each inventory
module. Record exact persona, tenant, route, command identity, terminal state and
forbidden/cross-tenant result.

| Module | Required mounted route(s) | Minimum rehearsal journey |
|---|---|---|
| CHAT | `/chat` | governed proposal, approval/materialization, cold receipt, denied/revoked state |
| MYW | `/my-work` | selected agent plan to governed Task/Decision/Notebook receipt |
| INT | `/interview`, respondent token route | publish, pinned assignment, answer/complete, revoked token |
| TLS | `/discovery-tools` | Dynamic SWOT save/freeze, approved output candidate receipt |
| ASM | `/assessment` | DRD create/open, exact pack/version, role read-only and cold reopen |
| INI | `/initiatives` and deep links | candidate to cards, definition, analysis, schedule and Execution link |
| EXE | `/execution` and case route | nine governed controls, busy/error/conflict/success and receipt readback |
| RES | `/results` | KPI definition/measurement/recovery children, cold state and tenant denial |
| FIN | `/finance` | canonical valuation inputs, compute/result, reconciliation and retry identity |
| MAT | document/presentation/workbook routes | edit/version/approve/native receipt/share-revoke cold lifecycle |
| AUD | `/audit-programs` | criterion to evidence/finding/action/verification/report/initiative |
| MTG | `/meeting` | proposal, independent decision, exactly-one material receipt, stale 409 |
| ORG | `/organization` | governed context sources/conflicts/publish/exact latest reopen |
| ADM | `/admin` | invitation lifecycle, role stale reconciliation and revoked member denial |
| SET | `/settings` | MFA challenge/trusted-device lifecycle, export receipt, deletion request/cancel |
| PRT | `/partner` | connect/certification/non-economic immutable ledger; economics remains OFF |

For all modules: 1440x900 and 390x844, PL/EN, light/dark, keyboard, axe
critical/serious zero, no horizontal loss and no false success. The manual
VoiceOver/persona/brand receipt follows the owner UAT runbook and records this
deployed SHA.

## 6. Two consecutive telemetry windows

Each window lasts a full 60 minutes. The second starts only after the first
passes. A reset, redeploy or rollback invalidates both.

Require per window:

- availability at least 99.5%;
- application error rate strictly below 1%;
- read p95 at most 1500 ms and write p95 at most 2500 ms;
- command loss `0`, duplicate terminal identities `0`, tenant false-success `0`;
- cross-module writes contain correlation ID, tenant, actor, source/task ID and
  terminal result without secret payloads;
- queue/outbox oldest age below 5 minutes;
- DB saturation below 80%;
- no unacknowledged repeated-auth-denial incident;
- provider latency reported separately with bounded timeout/cancel/retry and no
  blocked local mutation.

Capture an alert positive control and recovery acknowledgment. Exercise a
non-destructive staging condition that crosses one configured threshold; never
inject or expose secrets and never exercise against production.

## 7. Rollback rehearsal

The code rollback target is previous verified product SHA
`a97750b5d3c9f821f1b2f44b21611734b2876964`. The candidate adds release tooling
but no destructive schema change relative to that product state.

1. Record candidate deployment ID and config manifest.
2. Deploy the previous verified product SHA against the fresh rehearsal database;
   do not reconnect the corrupted historical staging database.
3. Require health identity, login, one governed write/readback, one forbidden
   tenant path and additive-schema readability.
4. Record measured RTO and observed RPO. Targets: RTO <= 60 minutes, RPO <= 15
   minutes.
5. Redeploy candidate SHA and rerun health, migration replay-zero and the changed
   smoke paths.

Rollback failure leaves staging stopped and production unauthorized.

## 8. Completion receipt

Record deployment IDs, domains, exact SHA readbacks, migration hashes/counts,
16-flow results, both telemetry windows, alert exercise, rollback timings,
operator, accountable owner and all defects. Staging success keeps production
`NOT_AUTHORIZED`; a separate explicit `D7=A` owner decision is required.
