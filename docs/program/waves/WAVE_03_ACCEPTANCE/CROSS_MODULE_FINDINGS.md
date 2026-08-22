# Wave 3 — cross-module findings register

Use this file only when one root cause affects two or more modules. The first
observing module still owns the detailed original record and Piotr wording.

| Cross ID | Source finding | Affected modules | Shared surface | Observation | Expected behavior | Severity | Decision | Fix SHA | Retest modules | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `XMOD-SEC-001` | pre-freeze credential scan | all modules using the shared Railway database boundary | five tracked maintenance scripts | A plaintext credentialed Railway PostgreSQL URL was committed in repository history. The current candidate removed the literal from all five scripts and now requires `DATABASE_URL`, but repository exposure means the credential must be treated as compromised until the environment owner confirms rotation. | No live credential is stored in source or evidence; the affected Railway credential is rotated and the old value is rejected before final acceptance. | `P0_SECURITY` | `REMOVE_FROM_CURRENT_CANDIDATE / ROTATION_REQUIRED` | `96fe8ddc10` | Current tracked-tree scan: `25,801` files enumerated, `23,762` text files inspected, zero high-entropy credentialed Railway PostgreSQL URLs; fixture runtime dotenv isolation also passed. After authorized rotation: final scan plus non-secret connectivity and old-value rejection check. | `CODE_FIXED_AND_CURRENT_TREE_SCAN_PASS / EXTERNAL_ROTATION_UNVERIFIED` |

Settings `SET-PF-005..007` closed through module-local fixture/presenter work and exact browser proof; no shared cross-module root cause was established.

## Rule

A shared fix marks every affected previously accepted module
`REGRESSION_REQUIRED`. No module inherits another module's retest result.
