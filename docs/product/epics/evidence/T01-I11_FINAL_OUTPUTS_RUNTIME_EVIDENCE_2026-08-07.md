# T01-I11 — Final Outputs runtime evidence

Date: 2026-08-08
Verdict: `IMPLEMENTED / V3_FORMAT_QA_GREEN / REALDB_GREEN / BROWSER_PENDING`

## Implemented boundary

- Runtime POST endpoint generates a Word report and PowerPoint steering deck only for a Case in `final_outputs` with an approved plan, linked Initiative and sustained benefit evidence.
- Both formats are built from one deterministic v3 facts object and share its SHA-256 digest. The contract includes execution, sustained benefits, Finance actual-vs-plan and the KPI card.
- A durable `transformation_final_output_runs` manifest stores facts, file paths, file hashes, actor and generation time.
- Repeating generation for unchanged facts is idempotent.
- The run and both outputs are linked to the Transformation Case and an audit event is recorded.
- A visibility-guarded GET endpoint reads back the latest manifest.

## Artifact fixture proof

Hash sets below belong to distinct immutable generations (format fixture,
runtime generation, A05/A10 replay and A06 publication). Different hashes
between labelled runs are expected; replay equality is asserted within each
generation and no manifest is claimed to mutate in place.

- Common facts: `final-output/t01-final-output-facts.json`
- Canonical facts SHA-256: `569181e0987d6adb22c90ff4c4221ece38887d7194022e7ac8f9861526f98ac1`
- Facts JSON file SHA-256: `a00eaf25b05c9da8299af9ab38abe10c3d35f836ee52a2d68aa192acdbd4764a`
- Word: `final-output/T01_TRANSFORMATION_FINAL_REPORT.docx`
- PowerPoint: `final-output/T01_TRANSFORMATION_STEERING_DECK.pptx`
- Word file SHA-256: `478093ce206323f195ea01be264dbe5fa30578cd8856b259e217fca4cc40eb5e`
- PowerPoint file SHA-256: `ad86c290605b3868748eac2c3d6e6b9cb8c92192c28d47fe6c14eb58f45ad1c8`
- Word was rendered and visually checked across all 3 pages after the 2026-08-08 evidence refresh.
- PowerPoint was rendered and visually checked across all 8 slides after the refresh and passed overflow testing.

These fixture artifacts prove formatting and shared-facts consistency. They do not prove a production database run, HTTP/RBAC behavior, download behavior, browser rendering or tenant isolation.

## Automated evidence

- Final-output builder test verifies deterministic shared facts, digest presence and both output schemas.
- Scoped suite on 2026-08-07: `22 passed`, `1 skipped`.
- Scoped ESLint: green.
- Full repository `npm run type-check` completed successfully with an 8 GB Node heap after the v3 changes.

## RealDB and generated-file evidence

- Fresh isolated database: `consultify_agent_t01_v3_20260807`.
- The entire Teresa transformation proof was replayed from a clean schema through Case v24 / `final_outputs` before output generation.
- Runtime run ID: `15132299-5538-46b3-9a49-1aa74394b958`.
- Canonical v3 facts digest: `1e5b4d478ff3d862bfec2c302b702c17a3c657cfd4aa5b589a57e1d728044a93`.
- First generation created one manifest; identical replay returned the same run with `idempotentReplay=true`.
- Readback: 1 manifest, 3 final-output lineage links and 1 generation audit.
- Runtime DOCX SHA-256: `378808bc50ab2b9812da461db154f1808dcc8e394410c79f72f82addd48f2e34`.
- Runtime PPTX SHA-256: `09bcea5dfdf47f69e2fc93c6594890c19ed21f33715aed53bb9d6096cf0ea89a`.
- File readback hashes matched the persisted manifest.
- Cross-tenant manifest read returned `null`; cross-tenant generation returned `TRANSFORMATION_CASE_NOT_FOUND`.
- Runtime Word was rendered and visually checked across all 3 pages. It now contains six business sections, including Finance, KPI and lineage.
- Runtime PowerPoint was rendered and visually checked across all 8 slides. It now contains the 14-stage roadmap, labelled delivery results, Finance actual-vs-plan, KPI durability and a proof manifest.
- PowerPoint passed automated overflow testing.
- The proof caught and fixed an idempotency defect: generation audit events are excluded from the immutable business-facts snapshot.

## Acceptance still required

- Generate and read back the manifest through authenticated HTTP.
- Download both outputs through the authenticated routes and compare their hashes with the manifest.
- Demonstrate allowed access, denied cross-tenant access and denied unauthorized access.
- Capture browser evidence from Teresa command through final output controls.

## Latest governed end-to-end replay

After seven proposal stages moved under common A05 and A10 was bound to canonical live readbacks, a fresh full-flow database replay generated and read back both outputs again:

- database: `consultify_agent_t01_a05a10_root_20260808`;
- run: `0bfe2e32-30d1-41d9-8818-fbb6341f5dfe`;
- facts digest: `55697a90e624be1f9c2af81e7be02df016084a9162cec0e2cbf4dcdab1872181`;
- DOCX SHA-256: `66d3161888217d34fea77f732b37e978d5345471179ca7b81d138401769c83fe`;
- PPTX SHA-256: `4c9151af7ea0a45ce4d96823faa06ca44d44d45232d0e7ebb3a441e49652aa90`;
- identical replay returned the same run; manifest count `1`, links `3`, audits `1`;
- cross-tenant generation failed closed and file hash readback was verified;
- the subsequent canonical A10 evaluation passed `5/5` with score `1.0`.

## Latest A06-governed publication replay

A fresh chained replay on `consultify_agent_t01_a06_owner_20260808_0045` ran the complete T01/A05/A06 flow before publication. It proved seven proposal materializations, nine result/checkpoint gates and the final publication adapter, then reran A10.

- A05 approved the exact Case v24, plan, context and facts digest before A06 authorization.
- Central denial for `transformation.final_outputs.publish` produced zero manifests, final-output links, generation audits and adapter invocations; therefore no render or file/manifest write occurred.
- The ratified path created exactly one A06 ledger row with `attempt_count=1`, status `succeeded`, canonical artifact type `transformation_final_output_manifest` and compensation policy `delete_created`.
- The identical replay returned the same run ID and produced no duplicate file, manifest, link or audit writes: totals remained one manifest, three links and one generation audit.
- Canonical readback matched tenant, Case, run, Case version and facts digest, plus both persisted DOCX/PPTX hashes.
- Both physical files were read and rehashed; the byte hashes matched the manifest.
- Cross-tenant latest-run readback returned `null`; cross-tenant generation failed closed with `TRANSFORMATION_CASE_NOT_FOUND`.
- A10 passed `5/5`, score `1.0`, with no failed or critical cases and cross-tenant readback `null`.

This is local RealDB/runtime evidence, not same-SHA deployed HTTP/UI/production evidence. The overall T01 final-output acceptance therefore remains `PARTIAL` / browser pending.

## Browser attempt

The local Consultify shell and Agent Hub route rendered in the in-app browser. The production-like full backend could not become ready on the intentionally minimal T01 schema because unrelated global migrations require the rest of the Consultify database. A browser fixture server was therefore prepared for visual-only proof, but the fresh localhost origin correctly stopped at the sign-in screen and requires the user's local four-digit quick-access PIN. No credential was guessed and browser acceptance remains pending.
