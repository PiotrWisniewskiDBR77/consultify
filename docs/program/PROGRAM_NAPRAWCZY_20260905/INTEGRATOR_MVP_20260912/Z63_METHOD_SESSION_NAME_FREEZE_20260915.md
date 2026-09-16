# Z-63 / DEC-513 freeze — durable Method session names

Status: **READY FOR CTO REVIEW**

- Base: `df3428e7e027124a60dfdc0b7ae1ba3a76c4facc`
- Product evidence HEAD: `97a60e96bcc179fd6a24be00d176727ba692c4da`
- Branch: `codex/a-z63-session-name-dec513-v2-20260915`
- Scope: additive `method_sessions.name`, mirrored contracts, create/list/get/PATCH API, owner and organization OWNER/ADMIN authorization, organization-scoped not-found behavior, version CAS, and Assessment UI create/list name flow.
- Migration: `server/migrations/20262230_method_sessions_name.sql`
- Rollback: additive no-op; it intentionally retains the nullable column and stored names.
- K8 removal of unsupported Method Core columns remains intact.

## Evidence

- Fresh PostgreSQL strict migration: `921` migrations applied; Z-63 migration included; exit `0`.
- Immediate second strict migration: `0` migrations applied; exit `0`.
- Schema readback: `method_sessions.name` is `text`, nullable, with no default.
- Additive rollback executed successfully; schema readback still found exactly one `name` column.
- Real PostgreSQL create -> list -> PATCH -> get plus authorization, organization scope, and CAS: `16/16 PASS` in `httpSessionsListing.integration.test.ts` with `--retry=0`.
- Service unit suite: `55/55 PASS` in `MethodSessionService.test.ts`.
- Targeted Assessment UI: `2` files and `10/10 PASS` in `NewAssessmentModal.method-core-cutover.test.tsx` and `AssessmentHub.method-core-cutover.test.tsx`.
- Canonical frontend type-check: `193` diagnostics on base and candidate, delta `0`. Candidate first three: `ChatV9FlagsIndicator.test.tsx:137 TS2345`, `day374-canvasTooLong.i18n.test.tsx:38 TS2322`, `UnifiedChatPanel.przewodyChat.test.tsx:206 TS2493`.
- Canonical server type-check: `22` diagnostics on base and candidate, delta `0`. Candidate first three: `server/src/index.ts:1579 TS2769`, `assessment-reports.routes.ts:3170 TS2345`, `benefits.routes.ts:941 TS2345`.
- `contractMirrorDrift.test.ts`: `3 PASS`, `4` inherited baseline failures for `session.ts`, `methodPack.ts`, `index.ts`, and the no-code-before-contract check. This is the separately queued DEC-515 baseline debt; Z-63 adds the same optional `name` field to both MethodSession mirrors.
- `git diff --check`: clean after removing trailing blank lines.
- Disk safety checkpoint: `30 GiB` free, above the `20 GiB` stop threshold.

## Open evidence

- EN/PL browser screenshots: **NOT_PROVEN**. They were skipped to avoid adding disk pressure after behavior-level UI tests passed.
- Staging, deployment, and production readback: out of scope and not performed.

No protected ref, staging, deployment, or `OD_CODEXA.md` change was made.
