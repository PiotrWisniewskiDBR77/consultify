# PMO-1a v4d — W242

Result: code READY for CTO review; final identity is in OD_CODEXA.md.

Base: 854d3a7e635c58f3ee7e281a126d2f57946369ad. Existing candidate: 51340f06a6.

Recovered three v4b/v4c dependencies omitted by the previous cherry-pick: server transition-case preflight, its tests, and the frontend API type. The old candidate could never expose a ready case against its own backend.

The request preflight and proposal writer now call the same read-only validation for reviewer/proposer membership, active reviewer membership, reviewer project authority, source lifecycle stage, schedule milestones/baseline and canonical execution identity. The writer still revalidates inside its transaction. Self-review is disabled in the actual card with EN/PL reason.

## Evidence

- Fresh pgvector PostgreSQL 17 copy of staging-pre-zasiew-demo-20260918T0129.dump; restore exit 0 (restore-final.log). Container cto-a-pmo1a-w242-pg, loopback port 6458. API 4214, DOTENV_DISABLED=1, ENABLE_V8_GLOBAL=true, DB_MANAGED_SCHEMA=off. This is not a deployment or migration-readiness proof.
- Two existing Northwind users received a local-copy password hash read at runtime from irina-20260914/DOSTEP.md; no secret is stored in artifacts.
- Actual Gateway/auth/PG responses: docs/program/PMO_1A_V4_W224_20260917/measure-v4d-realpg.json. Four scans each have 22 records. Final seeded James view: zero enabled, 20 disabled with reasons, two without transition. Actual component and actual lifecycle hook replay: 24/24 PASS (22 records + authorized distinct reviewer + unauthorized reviewer).
- Seeded Sarah -> James: preflight proposalAllowed=true; proposal POST 201, review POST 200, execute POST 201; history 3 -> 4, exact inserted history id 70c24be6-e18d-4434-bf68-0d8c2a174255, APPROVED -> IN_EXECUTION. The create endpoints correctly return 201, not literal 200; no response code was changed to fit the wording of the order.
- Self-review POST 409; unauthorized reviewer POST 403 and preflight proposalAllowed=false with initiative_lifecycle_authority_required. Real component disables both with nonempty reason.
- Self-review mutation removing the readiness condition: RED, 1 failed / 8 passed. Restored code: green. Importers: 56 PASS, 19 PG tests skipped; those skips are not counted as proof. Local HTTP proof is separate.
- Full foreground frontend tsc: 156, baseline cache 156, no errors in changed files.
- Language and Dockerfile flag guards PASS (204 flags, zero missing).
- Screenshots reserved to CTO by W242/W236; none taken.

## Reproduction

Use a fresh disposable copy: the governance receipt is immutable, so rerunning cleanup after a completed positive flow is intentionally not the supported reset path. Recreate only the owned local database from the dump. Run seed-auth.mjs and start-api.mjs from this worktree; run the proof with PMO1A_REALPG_DATABASE_URL=postgresql://postgres@127.0.0.1:6458/pmo_w242. Script enforces a loopback database. The default access file is the path mandated in CTO rules.

No migrations, production/staging/demo writes, protected-branch pushes, or external messages.

Final guards: server tsc exit 0 from lock-ci toolchain against candidate source (candidate dependency symlink temporarily used lock-ci node_modules, restored afterward); canon 345 vs baseline 346 PASS; artifact 8/0/117 PASS; diff-check PASS.
