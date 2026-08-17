# MYW-AGT-UI-CANON technical findings

- Candidate and reconciliation SHA: `b962d7c6bcfa1fe42c03d025f9ff76cc6decc9b3`
- Authentication: real signed JWT, `E2E_MODE=false`, ACTIVE tenant membership.
- Personas: USER (Member) and signed MANAGER (canonical active membership bucket ADMIN because the database membership enum has no MANAGER value).
- Visual denominator: 32/32 cells — four surfaces × two personas × four PL/EN, light/dark, desktop/mobile combinations.
- Automated accessibility: 0 critical/serious axe violations; settled, on-screen focus 32/32.
- Deep-link and reload: 32/32.
- Real failure: PostgreSQL pause caused the Decisions request to abort after the bounded 20-second client deadline, render an announced error instead of empty success, and recover through one explicit retry after database recovery.
- Mounted mutation: personal-task create/replay returned 201/200 with one stable ID; unsigned access returned 401 and a foreign tenant could not read the resource.
- Cleanup: exact fixture query returned organizations=0, test-support runs=0, named tasks=0. Dedicated container and ports were removed/released.

Verdict remains `PARTIAL / BLOCKED_HUMAN`. The packet does not manufacture a stale-version contract where the current personal-task API has none. Current-SHA mounted outage/retry and task auth/idempotency/tenant gates pass; VoiceOver, persona and visual-owner/brand acceptance remain open.
