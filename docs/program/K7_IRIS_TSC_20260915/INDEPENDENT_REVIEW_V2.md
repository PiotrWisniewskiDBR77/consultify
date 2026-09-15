# K7 IRIS TSC — independent skeptical re-review v2

**Verdict: ACCEPT.** Candidate `ee6b39882655b1f50c752e71a4d4cba448988de3` closes the previous review blocker without weakening the hard type-check workflow or changing product code.

## Reviewed identity

- Exact candidate: `ee6b39882655b1f50c752e71a4d4cba448988de3`
- Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`
- Review performed from one linked worktree, switching the same worktree between candidate and detached exact base.

## Previous blocker

- Both affected InterviewHub tests now use `vi.fn<typeof V8InterviewApi.getMyAssignments>()`.
- Assignment fixtures and helpers use `V8InterviewAssignment`; mocked responses retain the API shape `{ assignments: V8InterviewAssignment[] }`.
- Neither affected test contains `Promise<unknown>`.

## Independently reproduced gates

- Frontend TypeScript on exact base: **177 errors in 54 files**.
- Frontend TypeScript on candidate: **153 errors in 37 files**.
- Runtime over the exact 17 changed test files on base: **117 passed, 7 failed, 2 asynchronous errors**.
- Runtime over the same 17 files on candidate: **117 passed, 7 failed, 2 asynchronous errors**.
- Extracted failure identities are byte-for-byte identical (`diff` exit code 0). The package therefore does not manufacture runtime green by removing or redirecting assertions.
- `.github/workflows/test-suite.yml` is byte-identical between base and candidate, SHA-256 `e844520a562793bcc96260bc161aedcb8fe3a56e`, and retains the hard `npm run type-check` gate.
- `evidence/k7-iris-tsc-20260915/SHA256SUMS-v2.txt` validates all 16 listed artifacts.

## Delta review

- Product delta is empty.
- The source delta is limited to 17 test files; the remaining changes are reports and evidence.
- The test edits were inspected as contract/type corrections. The canonical field and fixture changes preserve the exercised scenarios; the unchanged runtime failure fingerprint is supporting behavioral evidence.

## Residual state

IRIS remains red at 153 errors in 37 files, so this review does not authorize integration or relax the threshold. It accepts K7 as an honest, test-only reduction from the exact base with the prior typed-mock blocker corrected.
