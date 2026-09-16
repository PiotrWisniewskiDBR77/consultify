# OPEN-1 / U-28 — CNC program → pack → criteria receipt

**Verdict:** the local RealPG contract keeps a program snapshot scoped to the program's selected pack; the actual CNC dataset is **DATA_NOT_PROVEN** because it is not present in the isolated local database. No CNC data was corrected or retained.

- Database identity: `127.0.0.1:6454/consultify_open1`, container `cx-open1-pg`, image `pgvector/pgvector:pg16`.
- Schema: `db:migrate:strict`, 922 migrations, RC 0.
- Test: `server/src/services/audits/__tests__/programService.test.ts`, `--retry=0`, 4/4 PASS.
- Measured SQL joins `audit_program_criteria.program_id` to `audit_programs.pack_id` and each `pack_criterion_id` to `audit_pack_criteria.pack_id`.
- Selected pack: `u3progpk_31802ce6-889c-4127-a383-71985735bb90`.
- Program: `aprog_e609a23e-a0e6-49b9-8310-1cdfbdee9a4b`.
- Snapshot criteria: `u3progpkc_38a08b25-988c-4ddc-84e0-9acc8e45bda7`, `u3progpkc_2a7e10e0-abb7-4f45-907e-3fa0eca6599c`; both resolved to the selected pack.
- Foreign control pack: `u3foreignpk_154cc1bb-d761-4537-9365-002b617e4cce` with criterion `u3foreignpkc_66031fca-cfba-460f-82c0-fc625d78f918`; it did not appear in the snapshot.
- Cleanup: the test deleted the ephemeral program, packs, criteria, and memberships in `afterAll`/`finally`.

The result proves the service and SQL scoping contract against real PostgreSQL. It does not prove whether the specific CNC record on staging was originally created with the correct pack. Checking or correcting that record requires authorized staging read access; this package made no staging request and performed no migration.
