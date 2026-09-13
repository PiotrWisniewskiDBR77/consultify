# C6 receipt-aware export: root PostgreSQL integration

The actual export service, private receipt reader, resolver and production receipt hash helper were executed against the original cx6 PostgreSQL container. Both test cases passed. The first preserves actual generation completion/failure CAS behavior. The second verifies timestamp-compatible content is denied without a receipt, explicitly seeded matching receipt permits the copied Decision body, and a permanent invalidation denies it again, in both UTC and America/Chicago.

This is an explicit persisted receipt fixture, not a production Finding writer acceptance claim. Export uses the existing bounded eight-table contract; it does not prove the full export endpoint, ApiGateway/JWT or all contract tables. The actual catalog remains queried and the audit table is not promoted into the export contract. Fresh UUID fixtures were cleaned with SQL readback asserting zero organizations, insights, Findings, decisions, handoffs, pointers, questions, sessions and receipt audit rows. Tested production source hashes were unchanged across the run.

Raw result: C6_ROOT_RECEIPT_EXPORT_REALPG_V2.json/log. Runner: codex6-scratch/c6-run-cas-receipt-v2.pg.test.ts and c6-run-cas-receipt-v2.vitest.config.ts. Original V1 runner and evidence preserved.

The separately implemented read-side suite remains46/46 PASS, and the narrower reader SQL proof validates foreign organization exclusion, unrelated Finding exclusion, audit action filtering, UTC projection, schema-drift denial without query, and rollback cleanup. Writer V2 independent review, final typecheck and combined integration remain open. No deployment.

## Evidence integrity

- C6_ROOT_RECEIPT_EXPORT_REALPG_V2.json: SHA256 `c2c2942ff8cd6be0fe151926b4526df179f75291c09662dd6afbcbe044ed265d`
- C6_ROOT_RUNTIME_RECEIPT_READSIDE_FINAL.json: SHA256 `5246b0af5efb09b5bd73af7869691b5cb73a36c2abbdbf2410bf29b6b2f53407`
- C6_ROOT_RECEIPT_SOURCE_REALPG.json: SHA256 `610b03693b8f64a6b531ae71b92d52cfe78a429bccb664ffa89bc704b7ce3c29`
