# Recovered independent-head disposition ledger

- Source SHA-256: `c24084dc7889e77dbaea6603683d4788ce5b3ae352597ed07c5338d6968c3893`
- Canonical evidence SHA: `257a1393f8f2340efe045677a74f7d9f452e8b64`
- Independent heads: **224**
- `REFERENCE_HARNESS_ONLY`: **18**
- `REPRESENTED_SUPERSEDED`: **10**
- `REPRESENTED_CANONICAL`: **3**
- `REJECTED_DESTRUCTIVE_SNAPSHOT`: **1**
- `INTEGRATED_CANONICAL`: **7**
- `SEMANTIC_REVIEW_REQUIRED`: **185**
- Deletion authorized: **0**

The first closed semantic rule is deliberately narrow: a head receives
`REFERENCE_HARNESS_ONLY` only when every unique path is confined to
`dev-render/`. Such work is preserved as visual/UX reference evidence but is
never merged as product code. Any behavior worth shipping must be represented
by a module gap and implemented on the canonical product surface.

The exact machine ledger is
`docs/cleanup/generated/recovered-head-disposition.json`.
