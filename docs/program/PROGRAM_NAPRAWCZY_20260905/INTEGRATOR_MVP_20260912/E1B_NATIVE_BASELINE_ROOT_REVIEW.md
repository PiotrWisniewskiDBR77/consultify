# Native accepted baseline — independent root review

Candidate worktree: codex-execution-native-baseline-20260913. Root reviewed the four product-file delta and actual integration test, and ran the unit/model denominator independently. Final author commit/hash and integrated runtime proof remain pending.

The read projection exposes the existing accepted Case snapshot with handoff version and acceptance timestamp, without changing scheduling policy, handoff validators, flags, schemas or legacy writes. Exact accepted dates are distinct from a wider Plan window. Missing/invalid/future native evidence remains unknown. Existing legacy values retain per-field compatibility. A missing module field can use valid native evidence; differing known values for the same field produce SOURCE_CONFLICT.

Root raised partial-module shadowing of valid native evidence. Author corrected per-field reconciliation. First root run 17/18 failed because the legacy-only fixture also contained a complete native baseline; that fixture was corrected separately from the combined-source case. Second root run 18/18 passed, raw E1B_NATIVE_BASELINE_ROOT_REVIEW_V2.json. This is no waiver of the missing-data contract.

Root inspected E1B_NATIVE_BASELINE_REAL_GATEWAY_PG_CANDIDATE_V3_20260913.json: SHA256 42ecee0b166cabc8179d956501df227b5bcd2b9672c179c29933777a3e8ffcbe, five executed tests passed. They cover real signed-JWT Gateway handoff request/ACCEPT, Case read projection/provenance, as-of boundary, foreign tenant omission and anonymous/invalid-token denial. Prerequisites are SQL-seeded SCHEDULED initiative and handoff snapshot, so this is not proof of full onboarding or source-to-initiative creation. Test cleanup asserts ten categories empty for its unique test organizations. This isolated fixture is separate from the retained operational-forecast browser record.

Server typecheck V2 exit0 was read from its recorded exit file. Frontend type delta, final freeze and integration still require completion before final acceptance. No deployed/full-MVP gate is promoted.
