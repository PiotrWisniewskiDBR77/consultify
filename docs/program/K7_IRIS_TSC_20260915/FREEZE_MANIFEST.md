# K7 package 1 — freeze manifest

Status: **E1 / STOP for independent re-review**
Exact base: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`
Content commit: `5d0dae612c522abc4451a0bfbf6af334af10f57f`
Content tree: `8ed15f04c9e63d4fc5622af3a2f56ffb0448a222`
Branch: `codex/b-k7-iris-tsc-20260915`

The content commit contains the complete code, inventory, gate logs and exact-base runtime comparison. This receipt is a later docs-only commit, so its own SHA is deliberately not self-referenced. The exact backup ref must resolve to the receipt commit reported with the delivery.

Measured result: front TSC 177/54 files → 153/37 files; server RC0; build green with 8 GB; canon 349; artifact 8/0/117; language ratchet green; zero product/workflow/forbidden changes; zero new `as any`. Runtime result is identical to exact base: 117 passed, 7 failed, two async errors. Screenshots are not applicable because UI/product bytes are identical.

Open decision: IRIS executes `npm run type-check` directly and has no numeric ratchet. W73 requires STOP before adding threshold behavior, therefore the workflow remains unchanged pending CTO decision.

Correction after HOLD: the Interview assignment mocks now retain the exact canonical API
function type and all fixtures use `{ assignments: V8InterviewAssignment[] }`. The package
keeps the measured 153/37 TSC result and the exact-base runtime fingerprint. The final
receipt SHA is reported separately because this manifest cannot self-reference its commit.
