# F2-E E1 — NON_MIGRATION_REMEDIATION scoped review

Verdict: READY_FOR_INDEPENDENT_SCOPED_REVIEW; FULL E1 REMAINS HOLD.

Review only the non-migration remediation checkpoint frozen by `FREEZE_MANIFEST.json`:

- exact 1930-table classification with 148 reviewed public business dispositions, zero `UNRESOLVED`, zero `ACTIVE_SEMANTIC_POLICY_MISSING`, and mutation guards;
- page-bounded archive and DEC-493 privacy projection, including the 20,001-row RealPG/RSS probe;
- enterprise synchronous JSON/CSV/ZIP routes fail closed with `ORG_EXPORT_ASYNC_REQUIRED`;
- C6 R2 organization budget authority through the production settings route, JWT, PostgreSQL readback, and real usage gate;
- OWNER and SUPERADMIN production routers, JWT authorization, opaque resume token, ZIP download, and requested/completed/downloaded audit readback;
- terminal-job expiry removes both metadata and the ZIP;
- failed UI removes contradictory Preparing/progress state, offers localized retry, and recovers;
- production build and canonical `/superadmin/customers/organizations` browser behavior in Polish and German.

Do not interpret this checkpoint as full E1 acceptance. Restart-safe, multi-replica durable resume still requires an approved additive persistence design and migration. No migration was written. The current in-process registry is deliberately not represented as restart-safe.

Reviewer: verify `SHA256SUMS`, rerun the commands listed in the manifest, inspect the exact diff, and write the independent verdict next to this request without modifying the frozen inputs.
