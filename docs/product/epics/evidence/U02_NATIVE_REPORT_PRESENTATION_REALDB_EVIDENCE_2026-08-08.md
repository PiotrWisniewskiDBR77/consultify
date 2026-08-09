# U02-A native Report Builder and Presentation — realDB evidence

> Date: 2026-08-08
> Candidate: local `codex/agent-t01-i01` (no commit, no push, no deployment)
> Database: isolated native PostgreSQL 16 `consultify_agent_root_visualfix2_20260808_0909`

## Canonical contract

The approved Transformation facts snapshot remains the single numeric truth. After exact A05
approval of that digest and A06 authorization of `transformation.final_outputs.publish`, the
publication creates **native owner artifacts first**:

- one Report Builder artifact (`report_builder_reports` + `report_builder_sections`) and one
  immutable version (`report_builder_versions`);
- one Presentation artifact (`presentation_decks`, carrying both the native `deck_json` and the
  render `unified_json`) and one immutable version (`presentation_deck_versions`);
- one artifact-registry receipt per artifact (`v8_output_artifacts` + `v8_artifact_origin_links`).

DOCX is rendered from the persisted report rows and PPTX from the persisted deck model. The files
are exports, not the truth store. The manifest records the native IDs, both immutable version IDs,
both registry receipts, the export hashes and the physical paths.

## Transaction boundary

One `withPgTransaction` owns the entire publication. The three owner modules previously issued
independent autocommit statements on the pooled handle; they now accept a donated
`PgTransactionClient` through an AsyncLocalStorage context
(`server/src/utils/pinnedTransactionClient.ts`), mirroring `withProposalGovernanceClient`:

- `withReportBuilderClient`
- `withPresentationOwnerClient`
- `withArtifactRegistryClient`

Outside a donated client every owner module keeps its previous pooled behaviour verbatim. Inside
one, a failed statement rejects instead of resolving `{success:false}` — the pooled
`DbPromise.run(fallback: true)` default would otherwise let a caller COMMIT a write that never
happened. Owner rows, registry rows, links, audit event and manifest therefore share one
COMMIT/ROLLBACK; created files use the existing `delete_created` compensation.

## Native PostgreSQL proof

```json
{
  "proof": "U02_NATIVE_REPORT_PRESENTATION_REALDB_GREEN",
  "transformationCaseId": "tc-t01-i03",
  "organizationId": "org-t01-i03",
  "caseVersion": 24,
  "runId": "68453421-f23f-4f61-b3bf-d4de103b5020",
  "sharedFactsDigest": "a65bbccf3fac372619601c3084937538dce7e546d89a3441e5feb2730462d75c",
  "nativeReportId": "5fc2f71f-4f11-43ea-8ff9-b4d9b50f2566",
  "nativeReportVersionId": "4ff5cda4-c8ea-406f-81b3-990eb0e54154",
  "nativeReportVersionNumber": 1,
  "reportRegistryArtifactId": "14b307c2-2ac4-48e1-a7df-97a3db5cba2b",
  "nativeDeckId": "d8bba014e43f45f88bdff9e30fc455da",
  "nativeDeckVersionId": "c17292ce-3082-411a-aded-9ba759e754f3",
  "nativeDeckVersionNumber": 1,
  "deckRegistryArtifactId": "22ef24f9-fa50-4e31-83e9-03060212608f",
  "idempotentReplayRuns": 4,
  "idempotentReplayCounts": {
    "manifests": 1, "reports": 1, "report_versions": 1,
    "decks": 1, "deck_versions": 1, "registry_artifacts": 2, "invocations": 1
  },
  "changedDigestRequiresNewApproval": true,
  "tenantDenial": {
    "latestRun": null,
    "generateCode": "TRANSFORMATION_CASE_NOT_FOUND",
    "nativeRows": { "reports": 0, "decks": 0, "registry": 0 }
  },
  "docxSha256": "f6f5cfdb310572243677ec78fdfa3d31b86d8920e65f7e569ab7ed845c5cb4b7",
  "pptxSha256": "c553e09422d7ac5ebfc9381057b9525da2b61e39b789e45091f50e1bf5d72433",
  "fileHashesVerified": true,
  "nativeEditIsolated": true,
  "links": 7
}
```

What the proof asserts, beyond the pre-existing T01-I11 gates:

- both native artifacts and both registry receipts carry the **same** facts digest, Case, lineage,
  canonical run and plan version; the agent identity is `consultify:teresa:transformation-agent`
  and the actor is the accountable human;
- one sequential replay plus three **concurrent** same-key requests returned the same run, the same
  native version IDs and the same export hashes, leaving exactly one manifest, one report, one
  report version, one deck, one deck version, two registry artifacts and one A06 invocation;
- a changed facts digest requires a new A05 approval and creates no native artifacts; the same holds
  for revision-requested, expired and context-invalidated proposals;
- cross-tenant manifest read is `null`, cross-tenant generation fails closed, and cross-tenant reads
  of the native owner and registry rows return zero rows;
- editing a section narrative changed neither the facts snapshot and its digest, nor the immutable
  report version snapshot, nor the deck.

A10 canonical live evaluator on the same database: `5/5`, score `1.0`, no failed or critical cases,
cross-tenant readback `null`.

## Rendered artifacts

Rendered with LibreOffice and inspected page by page and slide by slide.

- DOCX — 3 pages: title, table of contents, and all seven business sections
  (Podsumowanie zarządcze · Realizacja · Korzyści i trwałość · Analiza finansowa · Karta KPI ·
  Otwarte działania naprawcze · Lineage i dowody) plus the sources block. No clipping or overflow.
  The rendered digest matches the manifest digest.
- PPTX — 8 slides: cover, executive summary, 14-stage roadmap, delivery results, Finance
  actual-vs-plan, KPI durability, evidence manifest, closing. No clipping or overflow. The pipeline
  ran with validation enabled (`skipValidation` unset), so the automated overflow/validation gate
  passed as a precondition of producing the file.

The final visual pass inspected all 11 rendered images at original resolution. It rejected two
earlier immutable generations after finding defects that the canvas-overflow check could not see:
an English cover classification / Word page label and a KPI comparison row whose text visually
overlapped despite valid OOXML coordinates. The accepted generation localizes `POUFNE` and
`Strona`, renders KPI rows as independent bounded values, uses the human label
`Mniej znaczy lepiej`, and passes a fresh full T01 → U02 → A10 chain (`A10 5/5`, score `1.0`).

The DOCX bytes come from the persisted `report_builder_sections` rows and the PPTX bytes from the
persisted deck model, so both are genuine exports of the native artifacts.

## Defects found and fixed while proving this

1. **Polish thousands separators were being destroyed.** The first section projection collapsed
   `\s+`, which rewrote every `toLocaleString('pl-PL')` figure because that formatter emits
   non-breaking spaces. Only line breaks and tabs are flattened now. Caught by a round-trip unit
   contract, not by any runtime check.
2. **`normalizeDeckDocument` consumes the deck ROW, not a pre-parsed body.** Passing the parsed
   `deck_json` returned `null` and failed the publication closed — correct fail-closed behaviour,
   wrong call.
3. **Canvas-valid text could still overlap visually.** The comparison layout previously used one
   rich-text bullet box per column; LibreOffice could apply hanging-indent/autofit behaviour that
   obscured the start of the right KPI value without placing any shape outside the slide. Each
   comparison value is now an independent bounded row, and the final 8-slide render was inspected
   slide by slide.
4. **System labels were only partly localized.** The cover classification and default Word page
   label are now language-aware (`POUFNE`, `Strona`), with OOXML regression contracts.

## Out-of-scope repairs required to run the chain at all

The shared T01 proof chain was red before this work and could not reach `final_outputs`. These
repairs belong to U03/U04 and their owners should confirm them:

1. `transformationCaseService.ts` — the U04 recovery-card block sat **inside** the KPI-actuals guard,
   after its `throw`. It was unreachable, and `openRecoveryCardIds` was block-scoped there while the
   audit detail below read it: a hard `ReferenceError` on every accepted delivery handoff. The block
   now follows the guard.
2. `transformationCaseService.ts` — `String(last_measured_at).slice(0,10)` produced `"Tue Sep 01"`
   because node-postgres returns timestamptz as a `Date`; Postgres rejected it as a DATE (22007).
3. `transformationMobilizationOwnerAdapterService.ts` — the same class of defect built
   `` `${row.event_date}T00:00:00.000Z` `` from a `Date`, producing an invalid timestamp.
4. `a10TransformationCaseLiveReadbackRealDbProof.ts` — it reached for the process-wide DB proxy,
   which is only wired by the server bootstrap. Standalone it resolved to an unconnected stub, and
   `DbPromise.all(fallback: true)` turned that into an **empty result rather than an error**, so the
   proof reported "no completed Case" against a database that contained one. It now installs the
   same pool-backed shim as the other RealDB proofs.
5. `t01InterviewRealDbProof.ts` — the minimal schema lacked the U03/U04 owner tables and the U03/U04
   migrations, so the chain could not pass mobilization or the delivery handoff.

## Migrations

`server/migrations/20260810_t01_u02_native_final_outputs.sql` — forward-only and additive:

- eight `ADD COLUMN IF NOT EXISTS` on `transformation_final_output_runs` for the native report/deck
  IDs, their version IDs and numbers, and both registry receipts, plus two lookup indexes;
- unique indexes on `report_builder_versions(report_id, version_number)` and
  `presentation_deck_versions(deck_id, version)`. Neither table had one, although both version
  numbers are computed from a prior read — two writers could claim the same "immutable" version.

Rollback is simply not applying it: existing manifests keep working with NULL native references,
which readback treats as legacy.

**Duplicate-version contract — fail closed.** An earlier revision skipped the unique indexes with a
`NOTICE` when legacy duplicates existed. That was wrong: the release would proceed believing a
constraint existed that did not. The migration now ABORTS with `U02_DUPLICATE_REPORT_VERSIONS` /
`U02_DUPLICATE_DECK_VERSIONS`, naming the affected owner ids and version numbers and carrying a
reconciliation `HINT`. Nothing is deleted or renumbered automatically — only the owner can decide
which of two rows claiming version N is real.

Proven on disposable PostgreSQL by `server/src/scripts/u02MigrationSafetyRealDbProof.ts`
(`U02_MIGRATION_SAFETY_REALDB_GREEN`):

- **clean path** — applied twice, idempotent, both unique indexes present, 8 manifest columns added,
  and a subsequent duplicate insert is rejected with SQLSTATE `23505` (the constraint really bites);
- **duplicate path** — aborts with SQLSTATE `P0001`, message
  `U02_DUPLICATE_REPORT_VERSIONS: 1 duplicate (report_id, version_number) group(s) ... Affected:
  report_id=rep-9 version_number=1 rows=2`, creates **zero** indexes, and leaves every row byte-for-byte
  in place (row fingerprint identical before and after; counts 3 and 2 unchanged);
- **post-reconciliation** — after the operator renumbers, re-running creates both indexes with no row loss.

## Acceptance still required

- Generate and read back the manifest and both native artifacts through authenticated HTTP.
- Open the native report in Report Builder and the native deck in Presentations in the browser, and
  demonstrate that editing one changes only its own next export.
- Same-SHA deployed evidence. This is local RealDB/runtime evidence only.
