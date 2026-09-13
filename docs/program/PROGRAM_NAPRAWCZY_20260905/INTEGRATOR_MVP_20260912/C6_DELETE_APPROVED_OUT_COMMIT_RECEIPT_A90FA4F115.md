# C6-DEL-OFF normal-hook commit receipt

- Commit: `a90fa4f115c78541c5bd7c06dcbbc63d871f1b32`
- Parent/base: `427d0d6280f45173f8261036941e11e3d0031516`
- Branch: `codex/c6-delete-approved-out-20260913`
- Message: `fix(superadmin): keep deletion approved out [ODMROZENIE WSPOLNE DEC-468] [ODMROZENIE 14_ADMIN DEC-468]`
- Normal hooks: PASS, including frozen-module commit-msg guard; no bypass.
- Source/test content matches `C6_DELETE_APPROVED_OUT_FINAL_SOURCE_MANIFEST_V2.json`; staged diff before commit SHA256 `f03bfe364f8e9c3bdc0578d94b01bc82549d6cc8357eb2da84995dedd656875d`.
- Worktree after commit: clean.
- Behavioral artifacts: focused RED V1, focused GREEN V2 3/3, actual Gateway/JWT/PostgreSQL GREEN V2 2/2 and cleanup 0/0/0, all enumerated in `C6_DELETE_APPROVED_OUT_FINAL_CHECKPOINT_V2_20260913.md`.
- Scope remains a bounded executor-off correction. It does not close full E4, request/status/cancel, immutable-governance preservation, or built-browser acceptance.
- History incident retained in the V2 checkpoint: incorrect local DEC-457 commit `6c858c9823adce3aaa0e4381a278f72c87871552` was never pushed/shared and was removed before this authorized normal-hook commit.
