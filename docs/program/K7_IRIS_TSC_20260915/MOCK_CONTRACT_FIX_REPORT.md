# K7 package 1 — mock contract correction

Status: **E1 / STOP for independent re-review**.

The correction replaces the two `Promise<unknown>` Interview assignment mocks with
`vi.fn<typeof V8InterviewApi.getMyAssignments>()`. Every `getMyAssignments` fixture now
uses the canonical `{ assignments: V8InterviewAssignment[] }` response. No assertion,
product module or workflow file changed.

## Re-run

- Front TSC: 153 errors in 37 files; no error in either corrected Interview test.
- Delta from exact base: 177/54 to 153/37, exactly -24 errors.
- Candidate runtime across all 17 K7 test files: 117 passed, 7 failed, two async errors.
- Fresh exact-base fingerprint from the independent review: 117 passed, 7 failed, two
  async errors. Normalized failing test identities compare byte-for-byte equal.
- Focused Interview runtime: 17 passed, 1 failed, two async errors; the retained failure is
  the same `InterviewHub.smoke` line debt present at exact base.
- Evidence hashes: `evidence/k7-iris-tsc-20260915/SHA256SUMS-v2.txt`, independently checked
  with `shasum -a 256 -c` at RC 0.

The IRIS workflow remains byte-identical to exact base and continues to run the hard
`npm run type-check`. Numeric ratchet behavior remains a separate STOP decision.
