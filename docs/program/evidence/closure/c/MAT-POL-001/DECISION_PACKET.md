# MAT-POL-001 — owner decision packet (Materials export provider, rights, provenance)

Status: `BLOCKED_OWNER` — technically executable sub-gates are closed; the
remaining decision is not an engineering one.

Lane: Claude C · Branch: `codex/closure-claude-c-ideas-documents`
Baseline: `64f507859c717494ffa5e83fae550173c9382230`
Lease SHA-256: `7e9a27454b28907a1a5879fcb45051c3de4b0cb5be8092c3a8ed0c55b2fd756c`
Accountable owner (per `OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md`):
Product + Legal/Privacy + Procurement.

## 1. The finding that changes the question

The decision register frames this task as choosing "one provider per
DOCX/PPTX/XLSX" with "DPA, residency, SLA/cost". Measured against the runtime,
that framing does not match what the product actually does.

**No external document provider exists in the runtime.** Every exported byte is
produced in-process, inside the tenant's own boundary:

| Format | Engine | Version installed | Licence | Real call site |
| --- | --- | --- | --- | --- |
| PPTX | `pptxgenjs` | 4.0.1 | MIT | `server/src/services/report/pptx/PptxPipelineService.ts:33` |
| XLSX | `exceljs` | 4.4.0 | MIT | `server/src/services/workbook/WorkbookBuilder.ts:8` |
| DOCX | `docx` | 9.5.1 | MIT | Document Studio export path |
| PDF | `pdfkit` | 0.17.2 | MIT | `server/src/routes/presentations.routes.ts:2691-2745` |

Consequence: for the MVP export path there is **no third party to sign a DPA
with, no data residency exposure, and no vendor SLA to negotiate**, because no
document content is transmitted to any external service in order to be
rendered. The DPA/residency/SLA/cost limbs of this decision are, on the current
runtime, answering a question the system does not ask.

`puppeteer` 24.39.0 (Apache-2.0) is declared in `package.json` but has **zero
imports anywhere in `server/src`** — a dead dependency for this domain. It
matters here only because it is the obvious engine for the one real fidelity
gap in §3, so its presence looks like an intended-but-unbuilt path rather than
an approved one.

## 2. What is therefore actually being decided

**D1 — Ratify the in-process rendering path as the approved provider.**
Recommended: YES. All four engines are MIT, permissive for commercial
distribution, and keep content inside the tenant boundary. This is the
lowest-risk option and it is already what ships.

**D2 — Is an external provider wanted at all?**
Recommended: NO for MVP. Nothing in the closure scope requires one. Adopting
one would newly create the DPA/residency/SLA exposure that does not exist
today. Revisit only if D4 fidelity is rejected.

**D3 — Template and asset rights/provenance.**
NOT resolvable by engineering and NOT closed by this packet. The engines are
licensed; the *content* rendered through them is not covered by that. Required
from the owner: for every shipped presentation/document template, the origin,
licence and redistribution right of its layout, fonts, imagery and any
embedded brand assets. Until recorded, templates of unknown provenance should
not be presented as customer-deliverable output.

**D4 — Accept or reject current PDF fidelity.** See §3.

## 3. Known fidelity limitation (engineering fact, owner's call)

PDF export of a presentation is **not** a visual render of the deck. PPTX/PNG/
HTML share the real render pipeline; PDF is a separate `pdfkit` text/bullet
dump (`presentations.routes.ts:2691-2745`). A customer exporting the same deck
to PPTX and to PDF gets materially different artifacts.

Options: (a) accept and label PDF as a text summary export; (b) build true
visual PDF via the already-declared `puppeteer`; (c) mark PDF `UNAVAILABLE`
until (b) lands. Engineering recommends (a) short-term with honest labelling,
(b) as the real fix. This is a product-quality decision, not a technical
blocker.

## 4. Provider-independent work completed under the fail-closed default

Per the standing instruction that an agent does not idle waiting for a
decision, all provider-independent work proceeded, and the fail-closed default
("external export `UNAVAILABLE` until approved") is now enforceable rather than
merely documented:

`server/migrations/20260912_claude_c_handoff_spine.sql` adds
`artifact_export_receipts`, which binds an export to its immutable source
(`source_record_id`, `source_version`, `source_content_hash`) and to its output
(`output_content_hash`, `output_byte_size`, `provider_key`, `provider_job_id`).

Two invariants are enforced by the database, not by application convention:

- `artifact_export_receipts_status_check` admits the literal status
  `'unavailable'`, so an unapproved provider has a first-class, explicit
  representation.
- `artifact_export_receipts_success_check` makes `status = 'succeeded'`
  **impossible** unless `output_content_hash` and `output_byte_size` are both
  present.

That second constraint is what makes frozen MVP decision #2 ("an unavailable or
unapproved provider returns explicit `UNAVAILABLE`, never a mock or silent
downgrade") unfalsifiable at the storage layer: a degraded or mocked export
physically cannot be recorded as a success. Verified by negative control —
inserting a `'succeeded'` row without a hash is rejected by PostgreSQL:

```
ERROR:  new row for relation "artifact_export_receipts"
        violates check constraint "artifact_export_receipts_success_check"
```

while the same row as `'unavailable'` is accepted.

## 5. What the owner must record to unblock

Decision ID, selected option per D1–D4, owner, timestamp, rationale, affected
tasks, effective SHA, and evidence invalidation. Per the decision register,
silence does not change a fail-closed default: until D1 and D3 are recorded,
external export stays `UNAVAILABLE` and no production claim may be made for
customer-facing template output.

Blocked by this decision: `MAT-POL-001` release status, and the
production-claim limb of `MAT-BVP-001` / `MAT-MVP-EXPORT-001`. Not blocked:
provider-independent editing, versioning, hashing and receipts, which continue
under the default above.
