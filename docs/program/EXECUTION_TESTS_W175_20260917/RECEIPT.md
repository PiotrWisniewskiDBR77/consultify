# W175 — Execution tests after 1e v2

Status: **READY FOR CTO REVIEW** after independent **ACCEPT** (`P0=0`, `P1=0`, `P2=0`).

## Scope

This is a test-only packet. It changes three files under `src/components/Execution/__tests__` and changes no product code, migration, flag, locale, or runtime configuration.

- `ExecutionRuntimeSpine.contract.test.ts` no longer reads `ExecutionHub.tsx` as source text. It mounts the real `ExecutionWorkSurface`; a spy wrapper delegates to the real `StandardTable`, then asserts its row payload and the rendered canonical table DOM.
- The work deep-link proof uses the canonical typed identity `documentKind=work&documentId=work:<case>:<work>`. It verifies the parser identity, the same two-segment extraction locked by `ExecutionHub.workDeepLink.source.test.ts`, a real `ExecutionWorkSurface`, `readExecutionWork(caseId)`, and the visible workspace for the requested record.
- `ExecutionWorkSurface.edycjaWierszem.test.tsx` and `ExecutionWorkSurface.ownerNames.test.tsx` provide `currentUser.role='OWNER'` in their app-store fixtures. This exercises the existing role gate instead of changing `useOrganizationMemberNames` while the MEMBER product decision remains suspended.

## Evidence

- Original RED measured on the current line: `ExecutionRuntimeSpine.contract` **2/4 failed**; the two WorkSurface files **7 failed / 9 passed**.
- Final focused family: **4 files / 21 tests PASS**, `--retry=0`, including the sibling Hub work-route contract.
- Mutation 1: changing `documentKind=work` to `documentKind=initiative` makes the deep-link test RED (**1 failed**).
- Mutation 2: changing the owner fixture from `OWNER` to `MEMBER` makes the owner-name test RED (**1 failed**).
- A direct full `ExecutionHub` mount was attempted and honestly rejected as evidence after the Vitest worker reached its 4 GB heap before executing tests. The final proof uses real surfaces and the existing Hub route contract without copying business behavior.
- Independent review sequence: first HOLD (direct surface and parser alone were insufficient), second HOLD (wrong initiative-shaped openId), final **ACCEPT P0=0/P1=0/P2=0** after the typed-work chain.
- Clean `npm ci`; installed `@types/node` **22.19.3**, matching lock.
- Server TypeScript: **RC=0 / 0 diagnostics**.
- Full frontend TypeScript: **152 diagnostics**, with **0** diagnostics in the three changed test files. No claim of a clean repository-wide frontend TSC.
- `git diff --check`: PASS.
