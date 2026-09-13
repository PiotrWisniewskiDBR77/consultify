# Independent review — F2-1 E1 Slice 3 V2

Date: 2026-09-13
Reviewer: Codex integrator (independent from the slice author)

**Verdict: ACCEPT for the scoped Slice 3 commit. Full F2-1 E1 remains HOLD.**

- Freeze manifest SHA-256: `569cd392bafd7b8ab0c4d815491d52cf18c5ce9258da35f175337808ef2ee852`.
- Manifest verification: 39/39 files present with exact SHA-256, drift 0.
- Independent focused rerun: 24/24 tests passed across the three named files.
- Corrected findings verified: synchronous A to B and scope invalidation; new analysis and client request identities; stable preview; EN/PL governed labels; frozen name/title with non-UUID fallback; non-empty Initiative relations; unknown confidence omitted from preview meta.
- Exact locale delta: one 59-line hunk per locale.
- Authored real Gateway/JWT/PostgreSQL 18 evidence remains exact: 5/5 on staging schema `bf580f...`, public 1809; cleanup and owned-resource disposal are zero.
- Default-OFF flag, StandardTable/StandardPreview, tenant/capability checks, frozen inputs and selective mutations remain in scope.

Preserved qualifications: strict migration 919 is BLOCKED; real configured model evidence is EVIDENCE_MISSING; PMO authority discovery is PARTIAL; full E1 remains HOLD.
