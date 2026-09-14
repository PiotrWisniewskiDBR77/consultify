# Independent review — F2-E E1 classification v4

**Verdict: scoped ACCEPT for the F2-E E1 classification checkpoint on exact freeze `f809b877d8a71181ac1e890df7e6c2ed1c2cd0e339a15bf30d127dbafbe3ec41`; full E1 remains HOLD.**

## Frozen scope and denominator

- Freeze integrity: `55/55` listed files matched their recorded byte sizes and SHA-256 digests.
- Live-schema denominator: `1930` physical relations (`public=1809`, `v8=121`).
- Exact classification: `EXPORT=1379`, `EXCLUDE_SECURITY=550`, `DERIVED=1`, `UNRESOLVED=0`.
- The frozen classification verifier independently returned `ORGANIZATION_EXPORT_CLASSIFICATION_GREEN 1930/1930`.

## Independent checks

- Semantic-index unit tests: `2/2 PASS`.
- Classification verifier tests: `12/12 PASS`.
- Materializer tests: `3/3 PASS`.
- Actual writer, lifecycle, and cross-schema mutations: `16/16` expected RED and `16/16` observed RED.
- The exact `public.ownership_transfers` writer reference at line `449` passed; the stale line `440` mutation failed closed.
- Runtime contract parity: `1930/1930`, including all `13/13` exportable business lifecycle `state` columns.
- Runtime unit suite: `93/93 PASS` on the frozen source.
- Server TypeScript check: `TSC_RC=0` in the frozen evidence.
- Real PostgreSQL: `3/3 PASS` in the frozen evidence, including a non-empty dual-schema test that kept `public.v8_feature_flags` and `v8.v8_feature_flags` separate and tenant scoped.

## Schema-aware authority

Unqualified application SQL grants evidence only to `public`. It cannot authorize a same-named physical relation in `v8`. The collision audit found `119` public/v8 name collisions and zero unqualified SQL evidence accepted for a `v8` relation.

Only these two `v8` relations have exact, schema-qualified writer/read evidence and are classified `EXPORT`:

- `v8.v8_feature_flags`
- `v8.v8_shadow_comparisons`

The remaining `119` physical `v8` relations are explicitly fail-closed: `118` have `ACTIVE_SEMANTIC_POLICY_MISSING`, and `1` has `NO_PROVABLE_TENANT_BOUNDARY`. They are not represented as exported or complete. This is an honest exclusion boundary for this checkpoint and an explicit completeness gap for subsequent E1 work.

## Acceptance boundary

This ACCEPT covers the exact table classification, ownership paths, schema-aware semantic evidence, explicit column decisions, required credential/person-identity exclusions, and frozen runtime parity for the classification contract.

Full E1 remains **HOLD**. The `119` excluded `v8` relations still require deliberate product disposition where historical business data must be preserved. Archive delivery, complete populated-tenant coverage across product families, streaming/progress/resume, remaining writers, browser acceptance, and the rest of the enterprise trust pack are outside this scoped classification acceptance.
