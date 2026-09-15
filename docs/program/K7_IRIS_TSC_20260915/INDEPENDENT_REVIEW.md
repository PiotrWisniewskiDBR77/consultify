# K7 package 1 — independent review

Verdict: **HOLD** at exact candidate `7938e6e2c2279e4da7d3ddb05a2c6131349112bc`.

Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.

## Blocking finding

### P1 — two Interview mocks evade the real API contract

`InterviewHub.jedenPanel.test.tsx` and `InterviewHub.smoke.test.tsx` declare
`getMyAssignments` as returning `Promise<unknown>`. The production API contract is
`Promise<{ assignments: V8InterviewAssignment[] }>`. The smoke default still returns the
invalid value `[]`, while another test later returns `{ assignments: [...] }`.

This removes three TypeScript errors by disabling return-shape checking instead of typing
the mock correctly. It violates K7's requirement that test mock contracts are not weakened.
Use a mock typed from `V8InterviewApi.getMyAssignments` (as the existing
`InterviewHub.assignmentReview.behavior.test.tsx` does) and make every fixture conform to
`{ assignments: [...] }`. Re-run candidate and exact-base runtime comparison and refresh the
freeze after that correction.

## Verified scope and measurements

- The delta contains exactly 17 modified leaf test files plus K7 documentation/evidence.
- Product code, workflow files, migrations and named forbidden files are unchanged.
- No new `as any`, `@ts-ignore` or `@ts-expect-error` was added.
- Independent frontend TSC: 153 errors in 37 files. Candidate evidence baseline: 177 in
  54 files. The reduction is exactly 24 errors and 17 files.
- Independent candidate runtime: 15/17 files pass, 117/124 assertions pass, 7 fail and two
  async errors.
- Fresh detached exact-base runtime at `f2628a0d36`: the same 15/17 files, 117/124
  assertions, seven failures and two async errors. Normalized failing test identities are
  identical.
- Independent server TSC/build completed without diagnostics; frontend build completed
  successfully in 36.05 seconds.
- Independent list-canon: 349/baseline 349; artifact: 8/0/117; language ratchet green.
- `.github/workflows/test-suite.yml` is byte-identical to exact base and still runs the hard
  `npm run type-check`. The threshold/ratchet change remains a separate STOP decision and
  does not itself block package 1.
- The stated content tree is correct:
  `5d0dae612c522abc4451a0bfbf6af334af10f57f^{tree}` =
  `8ed15f04c9e63d4fc5622af3a2f56ffb0448a222`.

## Non-blocking evidence defect

`git diff --check f2628a0d36..7938e6e2c2` is red from trailing whitespace in the K7 Markdown
receipts and captured build log. Clean or explicitly normalize those evidence artifacts in
the corrected freeze so the full gate is reproducible.
