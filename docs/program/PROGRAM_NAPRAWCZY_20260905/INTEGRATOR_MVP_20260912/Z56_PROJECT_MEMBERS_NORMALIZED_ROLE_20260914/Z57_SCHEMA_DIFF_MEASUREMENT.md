# Z-57 schema diff measurement — 2026-09-14

Read-only comparison of `information_schema.columns` between staging and a fresh PostgreSQL 18 + pgvector database after the strict 918-migration chain.

- Staging columns: **23621**
- Fresh strict columns: **23416**
- Staging-only columns: **234**
- Fresh-only columns: **29**
- Shared columns with type/default/nullability/precision differences: **455**

This is measurement only. No schema or staging data was changed. The detailed machine-readable diff is in `evidence/z56/z57-schema-diff.json`.
