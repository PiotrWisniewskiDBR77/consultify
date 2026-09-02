# Meetings owner-review fixture — reproduction record (2026-09-02)

Manifest in this directory: `manifest.json`
SHA-256: `67a5a479408d569d2df03125f405c37abd8d82f0db793f47d101f74145768b6c`

Producing script: `server/scripts/seed-wave3-meetings-owner-review.ts`
(committed to repo — this manifest is not the only copy; anyone with a
local PostgreSQL can regenerate an equivalent one from the same script.)

## Why this file is committed here, not left in `/tmp`

Gate `G01` failed for all sixteen Wave 3 modules on 2026-09-02 because every
prior owner-review manifest lived only in `/tmp` and evaporated before this
session started. This manifest is committed directly into the repo
(secret-free — `persistManifest()` in the script strips fixture passwords
and verifies none leaked before writing) specifically so that does not
happen again for `G03`/`G04` of this module.

## How this was produced (exact commands)

```bash
docker run -d --name cx-w3-seedy-pg -p 127.0.0.1:6280:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres pgvector/pgvector:pg16

export MEETINGS_OWNER_FIXTURE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:6280/consultify_w3_meetings_owner_20260902"
export MEETINGS_OWNER_FIXTURE_CONFIRM=YES
export MEETINGS_OWNER_FIXTURE_MANIFEST="/absolute/path/meetings-owner-review.json"

npx tsx server/scripts/seed-wave3-meetings-owner-review.ts seed
# -> creates the database, migrates once, seeds five named personas and one
#    meeting, proposes three manual-transcript notes (service layer, no AI
#    call), decides one REJECT and one APPROVE (immutable receipt), leaves
#    the third pending; then proves the HTTP-layer role/membership/token
#    boundaries via a minimal Express app mounting the real middleware chain
#    + meeting.routes.ts and supertest; cold-SQL readback-verifies every
#    counter, writes this manifest at mode 0600.

DB_TYPE=postgres DATABASE_URL="$MEETINGS_OWNER_FIXTURE_DATABASE_URL" \
  NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts   # idempotency: 0 applied

npx tsx server/scripts/seed-wave3-meetings-owner-review.ts readback   # cold, separate process

npx tsx server/scripts/seed-wave3-meetings-owner-review.ts seed   # -> BLOCKED, no duplication

npx tsx server/scripts/seed-wave3-meetings-owner-review.ts reset
docker rm -f cx-w3-seedy-pg
```

## What was measured (summary; full detail in `manifest.json`)

- 5 named personas: owner (OWNER), admin (ADMIN, distinct reviewer),
  member (MEMBER, allowed to propose, denied to decide),
  inactive (REVOKED), foreignOwner (foreign tenant).
- One meeting; three manual-transcript notes proposed via
  `proposeMeetingNote` directly (service layer — recording/automatic
  transcription stay OFF per `MEETING_CAPTURE_POLICY`, and this fixture
  never calls the AI-backed `/generate-notes` route, matching the family's
  `aiGenerationInvoked:false` convention).
- Note 1: `decideMeetingNote` REJECT by owner -> `rejected`, zero
  materialization.
- Note 2: `decideMeetingNote` APPROVE by owner -> `materialized`, exactly
  one immutable receipt; a second APPROVE call converges on the SAME
  receipt id (replay).
- Note 3: left undecided (`proposed`/pending) to carry the pending
  owner-review state.
- HTTP layer (`verifyToken -> isAuthenticated -> closedBetaModuleGate ->
  requireActiveMeetingMembership -> meeting.routes.ts`, mounted exactly as
  `server/src/Gateway.ts` wires `/api/meeting`): MEMBER denied the decision
  endpoint (403 "Admin or owner role required"); the revoked member denied
  (403 `ORG_MEMBERSHIP_REVOKED`); the foreign-tenant OWNER denied (404,
  cross-org meeting invisible — no existence oracle); an anonymous request
  denied (401); a JWT forged with the wrong secret denied (401); a
  legitimate ADMIN decision on the already-approved note succeeds (200,
  idempotent replay of the same receipt).
- Final counters: `notes=3` (`pending=1, rejected=1, approved=1`),
  `receipts=1` — matching the module's own "receipt counts 0/0/1" language.
- 883 successful migrations recorded on this exact fresh database.
