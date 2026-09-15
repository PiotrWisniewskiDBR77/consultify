# K4 v5 — independent skeptical review

Verdict: **HOLD** at exact freeze `1d927829f485abfb96984abc4c0b185a87a7fead`
(content `9cc378cacecf05455e7638af283afa69a67c6fba`).

Comparison base: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`.

## Blocking finding — an excluded technical diagnostic is rendered to the user

The classification marks
`server/src/services/tablePlatform/ChatToSchemaService.ts:446`
(`__schema_version_at_creation:${schemaVersionAtCreation}`) as
`a:technical-diagnostic`, with the explicit reason that it is not an HTTP or prose sink.
That reason is false for the current product path:

1. `ChatToSchemaService.generateProposal` appends the marker to
   `proposal.warnings`, persists it and returns the unfiltered proposal row.
2. `POST /schema/propose` returns that proposal directly with HTTP 201. The proposal GET and
   list routes also return unfiltered service results.
3. `SchemaProposalCard` classifies every warning without `operationId` as a global warning and
   renders `w.message` in the amber warning panel. The version marker has no `operationId`.

This is a real UI sink hidden behind a class-A exclusion. It invalidates the claimed complete
real-sink denominator and `realSinksRemaining=0`. Keep schema-version bookkeeping in a dedicated
field and remove/filter the internal marker from API warning payloads, then add a route-to-render
test proving that the marker cannot appear in the proposal warning panel.

## Verified repairs and denominator

- The v4 DCF blocker is fixed. Three real nested `claimForCompute` payloads produce full Polish
  outer and inner text without the generic fallback prefix, while preserving HTTP status, code
  and job/idempotency identifiers.
- The denominator test does not erase placeholders before checking them. It first compares the
  source/output placeholder multisets; only a later prose scan substitutes them with a neutral
  sentinel.
- Executable catalog: `2118/2118` unique English keys, duplicate keys `0`.
- Class B: `1528` rows, `1270` unique messages, catalog PL equal to EN `0`.
- Class A: `56` rows = `48` technical codes, `2` parser fragments and `6` other entries. Literal
  source review found the blocker above. The two parser fragments have both expanded OTP outcomes
  localized. The remaining exact exclusions are anchored source shapes rather than path-wide
  wildcards.
- Semantic probes preserve a complete URL and e-mail address while translating the surrounding
  validation prose.
- Freeze inventory: all `81/81` listed files reproduce their byte counts and SHA-256 hashes.

## Regression gates

- Owner meter `72/72`; focused owned suite `49/49` across eight files; localizer `12/12`.
- Superadmin service/controller/locale chain passes with the preserved HTTP/code contract.
- Sender suite on candidate is `3/5`; the same two display-name assertion failures reproduce on
  exact base (base has four tests, candidate adds the green locale-subject test).
- Server TypeScript `0`; frontend TypeScript `177`; language ratchet green with K8sen `0`;
  list canon `349`; artifact `8/0/117`; migrations and forbidden paths `0`.
- An independent production build attempt ended in a local V8 abort (`Abort trap: 6`) after the
  shared package build, so build reproduction in this review is `NOT_PROVEN`. The product blocker
  above is sufficient for HOLD regardless of this environment failure.

