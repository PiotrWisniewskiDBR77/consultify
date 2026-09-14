# F2-E E1 — NON_MIGRATION_REMEDIATION V3 scoped review

Verdict: READY_FOR_INDEPENDENT_SCOPED_REREVIEW; FULL E1 REMAINS HOLD.

This checkpoint fixes the sole P1 from the V2 scoped review with a controlled, isolated scaling gate instead of an order-sensitive single-process ceiling:

1. Each measurement runs the production PostgreSQL-to-JSON/CSV-to-receipt-to-ZIP pipeline in a fresh `node --expose-gc` child with a 2 ms RSS sampler. Three repetitions cover 2,000, 8,000, and 20,001 rows at a 4,096-byte payload, for nine production processes.
2. The gate uses medians while retaining every raw measurement and twelve distinct process IDs. Production's median RSS deltas are 140.69, 163.66, and 232.22 MiB while the archive payload scales to 164.68 MiB. Its measured marginal slope is 0.6937 byte of retained RSS per additional artifact byte and stays within the unchanged 0.90 slope envelope plus 16 MiB of cold-process jitter.
3. Three further cold processes deliberately mutate `createReadStream` into `Readable.from([readFileSync(path)])` before dynamically importing the production archive module. The 20,001-row mutant has a 375.05 MiB median RSS delta and fails the identical 268.60 MiB envelope. Production passes; deliberate whole-file buffering is RED.
4. The receipt unit test still spies on `fs.readFile` and rejects any whole-file receipt read. The archive service hashes and counts JSON/CSV incrementally through streams.

Fresh supporting gates are GREEN: exact verifier 1930/1930, 14/14 classification mutations, 4 files/10 targeted tests, 4 files/9 RealPG/JWT/audit tests, server TypeScript, diff check, production build (10,712 modules), and the production-router PL/DE browser behavior including clean failed state and retry.

Review only the V3 non-migration remediation. Do not accept full E1: restart-safe, multi-replica durable job/checkpoint/resume persistence remains `MIGRATION_REQUIRED`. No migration was written. No E2 work was started.
