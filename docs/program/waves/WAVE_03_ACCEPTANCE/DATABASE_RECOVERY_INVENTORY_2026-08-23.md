# Database recovery inventory — 2026-08-23

Status: `SOURCE_DUMPS_PRESERVED / PROD_AND_DEMO_RESTORE_PASS / FIXTURE_CATALOG_DRIFT`

## Safety boundary

All checks were local. Railway databases and services were not queried or
mutated during this pass. Dump files were mounted read-only. Restore targets
were disposable PostgreSQL 18 databases in an isolated container; the
container and its anonymous volume were removed afterward.

## Incident dump inventory

| Archive | Bytes | Modified (Europe/Warsaw) | SHA-256 | PG18 TOC entries |
|---|---:|---|---|---:|
| `demo-pgvector.dump` | 245395290 | `2026-08-22T21:45:20+0200` | `0cab9124715f1065968d9a4100ec253467348f9ad2fd39f355f88226511595cf` | 11280 |
| `dev-postgres.dump` | 4370793 | `2026-08-22T21:46:03+0200` | `22882dfeabe8daa6924c1305093cf5755198cd5293b57babe12c742143e34d60` | 5484 |
| `production-postgres.dump` | 38417169 | `2026-08-22T21:40:32+0200` | `8b25f3405e7cb3cb3bb048fc1dcee1d7f2339302c348620774b51bab4e0d2901` | 7492 |
| `staging-postgres.dump` | 4656230 | `2026-08-22T21:41:27+0200` | `3dbcf1bc9b7875a811e5b769ad4ecf055b66a05b74d98d5ab77e052fee1514af` | 6045 |
| `staging-rehearsal.dump` | 7959017 | `2026-08-22T21:43:10+0200` | `ad7ccd9caf1d888225ec048c9903daa44e4f5f2d65ca7dccf6f65ed86858d476` | 11444 |

PostgreSQL 16 reported archive-header version `1.16` as unsupported. PostgreSQL
18 listed all five archives successfully; that compatibility error is not
evidence of corruption.

## Qualified restore evidence

`production-postgres.dump` restored with `--exit-on-error --no-owner --no-acl`:

- database size: `255121087` bytes;
- public base tables: `1131`;
- organizations/users/projects: `97 / 1294 / 352`;
- schema migration rows: `499`, including two historical `skipped` and one
  historical `failed` row;
- orphan users/projects relative to organizations: `0 / 0`.

`demo-pgvector.dump` restored with the same fail-closed command:

- database size: `794416831` bytes;
- public base tables: `1623`;
- organizations/users/projects: `331 / 1434 / 30`;
- schema migration rows: `782`, including seven historical `skipped` and one
  historical `failed` row;
- orphan users/projects relative to organizations: `0 / 0`.

The historical non-success ledger rows mean these snapshots are recoverable
data sources, not automatically release-ready schemas.

## Unqualified restore attempts

The dev and staging restore commands returned success before the Docker VM
exhausted its internal disk during the subsequent staging-rehearsal restore.
PostgreSQL then could not write even a query init file, so dev/staging readback
was not obtainable and is not counted. `staging-rehearsal` failed under
`--exit-on-error` with `No space left on device`. The entire disposable
container/volume was removed immediately. Source dumps remain unchanged and
hash-addressed above.

## Retained Wave 3 fixture discrepancy

The 2026-08-22 fixture inventory says 16 selected databases existed on
`127.0.0.1:34940`. The only stopped container exposing that port was
`consultify-uig4-pg`. After starting that exact container, its catalog contained
only `consultinity` and `postgres`; none of the 16 named owner databases was
present. The container was returned to its stopped state without writes.

The FINAL `0600` fixture manifests, marker tuples, seed scripts, runtime logs
and browser evidence remain on disk, but they do not substitute for the absent
database catalogs. Therefore the previous `16/16 storage readiness` claim is
currently stale and must be downgraded to
`DATABASE_ABSENT_AT_REVALIDATION / RECONSTRUCTION_FROM_GUARDED_SEEDS_REQUIRED`.
No fixture was silently recreated during this audit.

## Next recovery gates

1. preserve a second copy of the five dump archives and checksum manifest on a
   separate volume/object store;
2. free or enlarge Docker VM storage, then complete isolated dev, staging and
   staging-rehearsal restores;
3. reconstruct each missing owner fixture only through its guarded seed and
   FINAL marker contract, then cold-read back before browser replay;
4. do not use any restored snapshot as a deployment source until its migration
   ledger is reconciled against the frozen candidate.

## Fixture reconstruction progress

Initiatives was reconstructed first into named persistent Docker volume
`consultify_w3_recovered_fixtures_20260823` and database
`consultify_w3_initiatives_owner_recovered_20260823`. Guarded seed and a
separate cold readback proved:

- FINAL `0600` manifest and matching durable ownership marker;
- `831` successful migrations;
- six personas, two candidates, exactly one accepted DRAFT initiative, one
  system portfolio, one profile receipt and one Execution link/relation;
- zero negative-boundary receipts or links;
- exact-SHA `6695f4d8a42144a6f0ca1827548463a1f789ad29` adopted runtime with
  health / ready / frontend `200 / 200 / 200` and migration states `ok / ok`;
- authenticated API list `1`, candidates `2`, owner detail `200`, foreign
  detail `404 INITIATIVE_NOT_FOUND`, inactive login `403`;
- anonymous browser navigation redirected to the exact local login surface
  with no console error; credentialed visual replay remains pending;
- runtime stopped with database/catalog preserved, and the fixture container
  returned to stopped state.

After this first step, reconstructed storage readiness was `1/16` — Initiatives
only. Historical browser evidence for the other modules remains evidence, but
their databases must be reconstructed and requalified on the current exact
candidate.

Execution was reconstructed next in the same named persistent volume as
`consultify_w3_execution_owner_recovered_20260823`. The guarded seed initially
failed closed when invoked with plain `node`, because its canonical service
imports require the TypeScript loader; it made no fixture manifest and was
rerun successfully with `npx tsx`. The script entrypoint now documents and
encodes that loader requirement. Qualification proved:

- `831/831` successful migrations before seed;
- a new FINAL `0600` manifest and matching durable ownership marker with nonce
  `17b786f13458b0ade3270d465cc87dc7db5a687c624b4e446428e279d7be3473`;
- PostgreSQL restart followed by independent cold readback of six personas,
  closed Execution `v3`, ACTIVE canonical Case `v1`, approved evidence,
  PLN `40000` actual budget and exactly-once delivered Results lineage;
- exact clean SHA `df885a12eb352c2c417739c363ca5d1ec714d2c3` adopted runtime on
  server/client `4333/4334`, with health / ready / frontend `200 / 200 / 200`,
  migration states `ok / ok`, verified client marker and SQL marker;
- active OWNER login `200`; canonical Execution list, Case, work and Initiative
  API reads `200`; missing Case `404`; anonymous Case read `401`; inactive login
  `403`; foreign OWNER login `200` followed by same-tenant Case denial `404`;
- identity-safe runtime stop freed both ports and preserved the database; the
  persistent fixture container was then returned to stopped state.

Credentialed browser replay and Piotr's owner acceptance remain pending. Current
reconstructed storage readiness: `2/16` — Initiatives and Execution.

Meetings was reconstructed third as
`consultify_w3_meetings_owner_recovered_20260823` in the same retained volume.
Qualification proved `831/831` successful migrations, a new FINAL `0600`
manifest and matching marker nonce
`ad47f3e021fab66903c1582b2b61173aab49085891e32f913a1bbd3299941882`.
After a PostgreSQL restart, independent readback preserved five personas and
the three provider-free manual-note governance states: pending, rejected and
approved/materialized, with receipt counts `0/0/1`. Exact clean SHA
`fe1ee2449a53d0caf27135c206045d1772d2d5a7` adopted the database on server/client
`4335/4336`; runtime and marker gates passed, all four canonical owner reads
returned `200`, anonymous list returned `401`, inactive login `403`, and foreign
note access `404`. Runtime and container were identity-safely stopped while the
database remained in the named volume.

Credentialed browser replay, recording/transcription/provider capability and
Piotr acceptance remain pending. Current reconstructed storage readiness:
`3/16` — Initiatives, Execution and Meetings.

Results was reconstructed fourth as
`consultify_w3_results_owner_recovered_20260823`. It passed `831/831` successful
migrations and wrote a new FINAL `0600` manifest with marker nonce
`76ed9e370f2f07cef395999f03f839f29684ae110bc6438431cb69827923dce2`.
Seed readback proved two KPI measurements, one deviation, one Execution receipt,
one ROI Actual/reconciliation/PIR/approval snapshot/current pointer, one OKR key
result/check-in/review, three visibility rows, one ROI governance publication,
one complete Execution graph and zero graph orphans. After PostgreSQL restart,
independent SQL rechecked `831/831`, marker `1`, KPI points `2`, receipt `1`, ROI
Actual `1` and OKR check-in `1`. Exact clean SHA
`62e4b71ad7e3ec3e7100ee2086342a013f62a091` adopted the database on
server/client `4337/4338`; runtime and marker gates passed. Five canonical OWNER
lists returned `200`; MEMBER ROI was governed `403`, foreign KPI list was empty
`200`, and anonymous KPI access was `401`. Runtime and container were stopped
while preserving the database.

Credentialed browser replay and Piotr acceptance remain pending. Current
reconstructed storage readiness: `4/16` — Initiatives, Execution, Meetings and
Results.

Finance was reconstructed fifth as
`consultify_w3_finance_owner_recovered_20260823`. Before any seed, the authorized
desktop CD PROJEKT FY2025 PDF was re-hashed to the exact allowlisted SHA-256
`e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e`.
The guarded full-chain seed then passed `831/831` migrations and created a FINAL
`0600` marker-bound receipt with nonce
`db4812d57e81648c27de0f94647856d22b429032a36a903fc4fb242266367dbf`.
Initial and post-PostgreSQL-restart readbacks both proved five APPROVED business
versions, six Statements, six source receipts matching the exact PDF, one
Baseline context and matching lifecycle semantic hashes/compute runs. Exact
clean SHA `c8c9b22532691506945107299f857753a535a05d` adopted the database on
server/client `4339/4340`; runtime and marker gates passed. OWNER list plus all
five Statement/Analysis/Baseline/Prediction/Valuation details returned `200`,
foreign Statement access returned `404`, and anonymous list `401`. Runtime and
container were stopped while preserving the database.

Credentialed browser replay and Piotr acceptance remain pending. Current
reconstructed storage readiness: `5/16` — Initiatives, Execution, Meetings,
Results and Finance.

Materials was reconstructed sixth as
`consultify_w3_materials_owner_recovered_20260823`. It passed `831/831`
successful migrations and wrote a new FINAL `0600` marker-bound receipt with
nonce `adf53b59fc1a4d18a5691e28d40172ca863310fcf819e61d3ad070a518b0d4c4`.
Seed readback proved two document versions, one four-slide deck/version with
notes and alt text, one formula workbook/revision, one approved template and one
separate `UNKNOWN_RIGHTS_QUARANTINED` template. After PostgreSQL restart,
independent SQL rechecked `831/831`, marker `1`, document versions `2`, deck
version `1` and workbook revision `1`. Exact clean SHA
`54987e405a5cdf13d7c24d5bb5178529a5d55bac` adopted the database on
server/client `4341/4342`; runtime and marker gates passed. OWNER document, deck
and workbook reads returned `200`; each anonymous read returned `401`. Runtime
and container were stopped while preserving the database.

Credentialed browser replay, export/share/provider and rights-policy approval,
and Piotr acceptance remain pending. Current reconstructed storage readiness:
`6/16` — Initiatives, Execution, Meetings, Results, Finance and Materials.

Audits was reconstructed seventh as
`consultify_w3_audits_owner_recovered_20260823`. It passed `831/831` migrations
and wrote a new FINAL `0600` marker-bound receipt with nonce
`951e96e70444ac55473da54b43f9d058c26ca1fea43f303045dd3d685627f47b`.
After PostgreSQL restart, independent readback preserved the internal-owned
source and pack, five program roles, verified evidence, independently confirmed
finding, separately approved corrective action, draft report and draft
initiative proposal. The separation-of-duties contract passed; named external
standards, citations and live provider calls remained zero. Exact clean SHA
`ac2c0d1e997d590523e5b887463cbcc292c94ae3` adopted the database on
server/client `4343/4344`; runtime and marker gates passed. OWNER pack, program,
report and proposal lists returned `200`; inactive login returned `403`, foreign
program list empty `200`, and anonymous pack access `401`. Runtime and container
were stopped while preserving the database.

Credentialed browser replay, methodology-rights/provider approval and Piotr
acceptance remain pending. Current reconstructed storage readiness: `7/16` —
Initiatives, Execution, Meetings, Results, Finance, Materials and Audits.

Partner was reconstructed eighth as
`consultify_w3_partner_owner_recovered_20260823`. It passed `831/831` migrations
and wrote a new FINAL `0600` marker-bound receipt with nonce
`1aaccb5c627b1a69a4f59343de3d7b40fe7845ef427eb9c00764f6a2cbcdb3f7`.
After PostgreSQL restart, independent SQL rechecked the bound partner, two
certification states and one non-economic participant-ledger fact. Commission
and payout counts remained zero. Exact clean SHA
`f5dca6a89540a9faf9f8545789d3489dd6d31a74` adopted the database on
server/client `4345/4346`; runtime and marker gates passed. OWNER program status,
participant ledger, referral tools and certifications returned `200`; revoked
login returned `403`, unbound partner access governed `403`, and anonymous
program access `401`. Runtime and container were stopped while preserving the
database.

Credentialed browser replay, economics policy and Piotr acceptance remain
pending. Current reconstructed storage readiness: `8/16` — Initiatives,
Execution, Meetings, Results, Finance, Materials, Audits and Partner.

Organization was reconstructed ninth as
`consultify_w3_organization_owner_recovered_20260823`. It passed `831/831`
migrations and wrote a new FINAL `0600` marker-bound receipt with nonce
`e63db7e4c3b72c8d8f36d6c38292e0215a856e64f3fdd9e2a98e2a7518e0621c`.
The fixture contains four access personas, 27 approved organization-context
claims, one governed snapshot and two deliberate conflict records. After a
PostgreSQL restart, independent SQL rechecked `831/831` migrations, all 27
claims and the single marker. Exact clean SHA
`e17f4e58f72e3e58aab8666d70563215d71e7c9a` adopted the database on
server/client `4347/4348`; health, readiness, frontend, runtime SHA and marker
gates passed. The OWNER organization and context endpoints returned `200`;
foreign-tenant organization access returned `403`, revoked login returned
`403`, and anonymous organization and context access returned `401`. Runtime
and container were stopped while preserving the database.

Credentialed browser replay, remaining owner decisions and Piotr acceptance
remain pending. Current reconstructed storage readiness: `9/16` — Organization,
Initiatives, Execution, Meetings, Results, Finance, Materials, Audits and
Partner.

Assessment was reconstructed tenth as
`consultify_w3_assessment_owner_recovered_20260823`. The guarded owned fixture
created a fresh database, passed `831/831` migrations and wrote a FINAL `0600`
marker-bound receipt with nonce
`17e1618e2c7d0a84d449478d6ef5bae569e6d9d26b4bd0fb067758b7c8b1a9f0`.
Readback proved five personas, one active guided session with six events, one
frozen session/output/snapshot, one distinct approval and one governed
Initiative Draft. After PostgreSQL restart, the SQL readback remained complete.
Exact clean SHA `95e04e46aae84e65d4be4ce8060ffb97ebffb5e2` adopted the database on
server/client `4349/4350`; health, readiness, frontend, migration chain, SHA and
marker gates passed. OWNER and same-tenant reader login plus assessment-hub
reads returned `200`; inactive login returned `403`, and anonymous hub access
returned `401`. Runtime and container were stopped while preserving the
database.

Interview and Tools data were also seeded into separate retained databases,
but their legacy seeders do not yet emit the required FINAL receipt and durable
module marker. They therefore remain excluded from the readiness numerator
until that preservation contract and exact-SHA runtime replay are complete.

Credentialed browser replay, owner decisions and Piotr acceptance remain
pending. Current reconstructed storage readiness: `10/16` — Organization,
Assessment, Initiatives, Execution, Meetings, Results, Finance, Materials,
Audits and Partner.
