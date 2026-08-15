# Recovered tip disposition ledger

Generated mechanically from the protected patch-equivalence evidence.

- Source SHA-256: `52fc2fcb1825c0ce995d6e403c70ef91ce20e0b7d68b62414d9bee2505cb270a`
- Canonical evidence SHA: `257a1393f8f2340efe045677a74f7d9f452e8b64`
- Total recovered divergent tips: **421**
- `REPRESENTED_PATCH_EQUIVALENT`: **124**
- `SEMANTIC_REVIEW_REQUIRED`: **297**
- Deletion authorized: **0**

`REPRESENTED_PATCH_EQUIVALENT` means every commit unique to the recovered tip
has an equivalent patch in the evidence canonical SHA. It does not delete the
recovery ref and does not claim runtime acceptance. `SEMANTIC_REVIEW_REQUIRED`
means the tip contains at least one patch not represented at the evidence SHA;
it remains preserved until it has a module owner, task ID and explicit verdict.

The exact 421-row machine ledger is
`docs/cleanup/generated/recovered-tip-disposition.json`.
