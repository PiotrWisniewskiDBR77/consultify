# K4 v6 — independent skeptical review

Verdict: **HOLD (evidence-only)** at exact freeze
`68393974c97960f73f863b2fb54156c92e32bceb` (content
`b3dabff67dc773a87777d4d1e9d255c0e99cce4a`).

Comparison base: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`.

## Blocking evidence defect

The W73 full diff-check is red. `git diff --check 775947993e..b3dabff67d`
reports trailing whitespace only in the committed production-build log
`K4_K8SEN_W73_BUILD_V6.log`, across the captured Vite/CSS diagnostic output.
No product source file is implicated. Clean the whitespace in that evidence
file, regenerate its SHA-256 inventory entry and refreeze; no product repair is
required by this review finding.

## Product behavior verified green

- Independent ephemeral behavior probes passed **3/3**. Create persisted the
  legacy `__schema_version_at_creation:17` marker in JSONB while returning only
  the human English warning and numeric `schema_version_at_creation=17`.
  Get and list, including two list rows, retained version 17 and exposed zero
  raw markers. `executeProposal` refetched the persisted row, extracted 17,
  compared it with current version 18 and rejected before `BEGIN` or mutation.
- Central payload localization produced the full Polish warning while
  preserving version 17. `SchemaProposalCard` rendered the human warning and
  contained zero raw marker text. The product has no second marker consumer;
  the remaining occurrences are the message catalog and tests.
- The submitted focused suite reproduced **74/74**. The owner meter reproduced
  **72/72**. Language ratchet passed with K8sen 0.
- Classification is internally complete: **1585** rows, class B
  **1529/1529** with **1271/1271** unique full-Polish templates, mixed 0,
  known-English 0 and unknown 0. Review of class A found 48 technical-code
  rows, two parser fragments, four diagnostics/storage-marker rows and two
  internal worker messages; their stated exclusions match their source shapes.
- Executable catalog: **2119 rows / 2119 unique / 0 duplicates**. Freeze
  inventory: **85/85** byte counts and SHA-256 hashes reproduced.
- Server TypeScript: 0. Frontend TypeScript: 177. List canon: 349. Artifact:
  8 / 0 / 117. Migrations and forbidden paths: 0.
- Sender suite reproduced 3/5 with the same two display-name-envelope
  assertion failures already proven on exact base; K4 v6 does not touch sender
  code or those tests after the prior independent comparison.

The saved build log records a successful sequential 8 GB build with 10,754
modules in 46.34 seconds. A new build was not needed to establish this
evidence-only HOLD.
