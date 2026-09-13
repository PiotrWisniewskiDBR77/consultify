# Independent real PostgreSQL policy cleanup — bounded PASS

Frozen RC2 WIP over5e7db466f5741839f7186cd9cab33fa6fad8fa2b; exact product/test hashes in RC2_POLICY_CLEANUP_INDEPENDENT_HASHES.json. Only new reviewer test added to source; no product edits. PostgreSQL host127.0.0.1:6457/database cx6_export_contract identity guard passed. Single-worker/retry0, real pool max1.

Independent3/3 PASS,0fail,0skip (RC2_POLICY_CLEANUP_INDEPENDENT.json/log). Real readback in RC2_POLICY_CLEANUP_INDEPENDENT_READBACK.json:

- BEGIN executed then acknowledgement rejected; rollback deliberately not sent and rejected. Original error preserved, backend5533 destroyed; next5535, lock obtainable, committed policy row unchanged.
- UPDATE actually executed within canonical transaction after advisory lock, then acknowledgement rejected; rollback deliberately not sent and rejected. Backend5535 destroyed; next5536, lock obtainable, full committed policy row unchanged. This proves destruction rolls back the actual pending update and releases its transaction lock.
- Canonical patch first changes hold only, preserving30/EU; explicit null/null/false persists; later omitted patch retains null/null/0; SQL equals returned row.

Product fix inspected: static discardReason on unconfirmed rollback, release(discardReason), original operation error rethrown. Root unit baseline2RED→2GREEN remains separate author evidence; these three tests are fresh independent real execution, not a real baseline mutation. BEGIN case takes no organization lock before failure; UPDATE case proves actual advisory lock/write rollback.

Three fresh synthetic organizations/policies retained for audit; no existing records reset and no organization deletion performed. All test pools closed, no listener created, runtime/database ownership returned to root. Test left at server/src/services/__tests__/OrgPoliciesService.transactionCleanup.realpg.test.ts for integration.

The identified rollback-discard blocker is closed for this bounded writer. HTTP policy route/auth/privacy combined integration remains pending and is not replaced by these service-level proofs. COMMIT acknowledgement ambiguity was not exercised and no outcome guarantee is claimed for it.
