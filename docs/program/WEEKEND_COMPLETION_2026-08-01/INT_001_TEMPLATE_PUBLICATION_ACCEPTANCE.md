# INT-01 — Interview Template Library publish/version lifecycle

Status: `CODE_GO_FROZEN`

Date: 2026-08-02

Acceptance scope: local integration, no push and no deploy

## Accepted contract

- A newly created Interview template starts as editable draft version `0`.
- Publish is one pinned PostgreSQL transaction: metadata, the complete ordered
  question set, live version and immutable publication snapshot succeed or roll
  back together.
- Publication versions increase only on publish. Draft metadata and question
  edits do not impersonate immutable published versions.
- Optimistic concurrency rejects a stale publisher with
  `TEMPLATE_VERSION_CONFLICT` (`409`).
- Publishing is limited to organization-owned templates; a private template can
  be published only by its creator. Foreign and system templates are not exposed.
- Template scope and default-template changes participate in the same publish
  transaction. Selecting a default clears the previous organization default.
- Creating a session uses the exact published snapshot referenced by the live
  template version. A session created from v1 remains unchanged after v2 is
  published; a later session receives v2.
- Session and copied questions are created atomically. A failed question copy
  cannot leave an empty or partial session reported as successful.
- Legacy approved templates receive a snapshot of their current shape before
  their first governed publication.

## Evidence

- Real PostgreSQL acceptance: `6/6 PASS`
  - draft starts at version `0`;
  - v1 publish and session copy read-back;
  - v2 publish while the existing v1 session remains unchanged;
  - concurrent stale publication returns one success and one `409`;
  - foreign tenant receives `404`;
  - injected mid-transaction failure rolls live changes and snapshot back.
- Template Builder UI regression: `5/5 PASS`.
- Full repository TypeScript check: `PASS`.
- Production Vite build: `PASS` (existing chunk-size warnings only).
- `git diff --check`: `PASS`.

## Files

- `server/migrations/20260802_int001_template_publication_versions.sql`
- `server/src/services/interview/interviewTemplatePublicationService.ts`
- `server/src/controllers/InterviewController.ts`
- `server/src/routes/interview.routes.ts`
- `src/components/Interview/TemplateBuilder.tsx`
- `tests/integration/int-001-template-publication.realdb.test.ts`

## Remaining external gates

- Railway migration/deployment and authenticated browser smoke after deployment.
- No claim is made for other Interview lifecycle rows; this acceptance closes
  only `INT-01`.
