# Global Teresa -> Document Studio: bounded evidence

Status: `READY_FOR_CODEX_REVIEW / PROGRAM_NO_GO`

## Scope delivered

- The global Teresa canon exposes an explicit `documents` handoff contract.
- Screen context is converted into stable artifact, version, section and block identifiers.
- Execution fails closed without an opened artifact, instruction or required stable selection.
- An approved Teresa envelope delegates the write to Document Studio proposal APIs.
- The Document Studio proposal is approved only after the user-approved Teresa envelope is executed.
- Unknown target payload contracts fail closed.

This package does not expose Presentation Studio as a Teresa handoff target. The presentation writer still requires a module-owned, version-checked execution contract. Declaring PPT before that contract exists would create a phantom capability.

## Exact package allowlist

1. `server/src/services/v8/teresaCopilotCanon.ts`
2. `server/src/services/v8/teresaCopilotService.ts`
3. `server/src/routes/v8/__tests__/p08-artifact-studio-teresa-bridge.test.ts`
4. `docs/ui-standards/01-shell-layout/artifact-studio/13_GLOBAL_TERESA_DOCUMENT_BRIDGE_EVIDENCE.md`

## Required gates

- Targeted bridge test passes.
- Scoped `git diff --check` passes.
- Cached allowlist equals the four paths above before commit.
- No root-worktree cleanup, stash, reset, broad staging, push or deploy.

## Remaining program work

- PPT: extract/reuse a Presentation Studio owned proposal/apply service with base-version conflict protection, version history, audit and locked-slide evidence.
- XLSX: complete the batch mutation, revision, anchor and governance foundations recorded in the canonical Spreadsheet Studio specification.
- Runtime: prove the shared shell, single-line Menu 2, contextual Menu 3, one left panel and global Teresa on current SHA and real data.
- Legacy: retain legacy routes and shells until the recorded parity and rollback gates pass.

The root worktree contains unrelated and historical changes. They are not evidence for this package and must not be included in its commit.
