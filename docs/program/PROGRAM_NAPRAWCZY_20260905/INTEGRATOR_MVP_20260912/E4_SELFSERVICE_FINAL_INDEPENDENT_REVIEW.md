# E4 self-service — bounded independent acceptance

ACCEPT for the frozen six-file WIP over fbe8d8feb31cb77198fb72cbec7e41fcd2dc34d0, identified by RC2_SELFSERVICE_SOURCE_MANIFEST.json and independently revalidated before/after in E4_SELFSERVICE_INDEPENDENT_HASHES.json. No source edits, DB or API operations by reviewer.

Independent rerun: E4_SELFSERVICE_INDEPENDENT_FINAL.json/log, exit0,81/81 PASS, zero failures/skips:17 panel (2 existing+15 new),59 parent routing,5 API helper. Full names retained in JSON. These are mounted component/client tests, not built browser or real HTTP/authorization evidence.

The parent memo finding is fixed by dependencies on currentUser.id and currentUser.role. Parent test explicitly unmocks the global router mock and rerenders real MemoryRouter with actor then role change in the same organization. Author actual-router missing-dependencies attempt1FAIL/58PASS inspected; restored parent59PASS and independent59PASS. Earlier PARENT_RED59PASS is explicitly an unqualified/masked attempt, not RED evidence.

Author epoch mutation6FAIL/11PASS inspected: organization/actor/role/route/unmount completion and old-A rejection while B pending. Restored17PASS and independent17PASS. Current tests verify no late file/status, no stale failure, B remains busy, and exactly one eventual download. The duplicate test uses a connected disabled second control and proves UI suppression; it is not a separate proof of the synchronous ref against two events before React commits.

Source review finds no remaining blocker in this bounded change. Existing retention-export location alone enables the control; identity comes from currentUser, no user-entered target org. OWNER/ADMIN UI role hiding does not replace backend authority. New helper uses encoded tenant route with auth and static error messages; audit CSV/GDPR paths unchanged. Audit load failure does not hide organization export. Layout-effect epoch observes all supplied identity/visibility dimensions; post-blob-read check prevents old completion downloading, and guarded catch/finally preserve new operation state. Original blob and shared completeness disclosure are retained.

Remaining gates: final commit/build, real built-shell navigation and file download, actual persisted authorization/legal hold, light/dark visual evidence, combined tasks-v8 compatibility and full export/privacy coverage. This acceptance does not close full E4 or establish complete export. Frozen six files are released back to root for integration; no reviewer process remains.
