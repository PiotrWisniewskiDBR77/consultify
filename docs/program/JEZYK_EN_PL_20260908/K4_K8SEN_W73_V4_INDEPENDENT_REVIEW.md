# K4 v4 — independent skeptical review

Verdict: **HOLD** at exact freeze `e08273b06a562221f4b5d7ae279d1a5509fd645e`
(content `611fd20727e7952a56f7a4a06e17100139007b9a`).

Comparison base: `775947993ef96b1fcbd4e96fa725a48bae9dc7b3`.

## Blocking finding — dynamic English survives a claimed full translation

The last-35 row `runDcfFcffValuation: ${claimResult.message}` is classified as a real
user-visible sink, but its Polish catalog value is byte-identical to English. The catalog
matcher substitutes captured placeholders without recursively localizing them. The submitted
test removes placeholders before its English-prose scan, so it cannot detect this defect.

Independent runtime probe:

```text
input:  runDcfFcffValuation: Compute job failed because lease expired
output: runDcfFcffValuation: Compute job failed because lease expired
```

This is a false green for `1577/1577 full Polish`, `mixed=0` and `known-English=0`.
Localize the nested `claimResult.message` before composition or define stable claim outcomes
with complete EN/PL messages, then add a runtime test with real English dynamic prose.

## Catalog integrity findings

- The executable catalog has 2,122 rows but only 2,115 unique English keys: seven duplicate
  keys. One duplicated residual is the blocker above; the set also includes truncated parser
  fragments such as `${alert.message}${alert.checks?.length ? ` and an `Invalid code` fragment.
- The working table itself has 1,317/1,317 unique keys, so its uniqueness does not prove the
  assembled runtime catalog is duplicate-free.
- Forty-seven class-B entries have Polish identical to English. Most are stable machine codes,
  but they are counted as real user-visible sinks and therefore make the label “full Polish”
  broader than the behavior actually proved. Reclassify true machine codes as technical or
  provide a localized user message alongside the stable code.

## Verified denominator and gates

- K8sen meter report: 1,584 before v4 and 0 after v4; independent current report says K8sen 0.
- Classification: 1,577 class-B rows, 1,317 unique. The catalog test passes those exact
  denominators, subject to the false-negative mechanism above.
- Last 35 reviewed individually: 29 class B, six class A, unknown zero. The six class-A rows
  are credible internal provider/outbox/schema/worker diagnostics.
- Batches 14–34 contain 60 entries each, batch 35 has 58 and batch 36 has 35.
- Placeholders are preserved by the catalog mechanism; the review found no URL or email entry
  in the 1,317-row working table. Snake-case identifiers remain stable.
- Owner meter: 72/72. Expanded owned locale suite: 45/45 across eight files, which includes
  the required 43/43 seven-file subset.
- Email sender suite: three passed, two failed; the two failure identities match the declared
  base debt and concern display-name envelopes, outside localization behavior.
- Superadmin service → controller → locale test passes with HTTP 500 and
  `PLAYBOOK_PUBLISHED`, returning `Szablon został już opublikowany` without English prose.
- Server TypeScript: 0. Frontend TypeScript: 177. Production build: green in 42.24 seconds.
- Language ratchet: green; list canon 349/349; artifact 8/0/117; `git diff --check`: green.
- Freeze inventory: all 79/79 byte counts and SHA-256 hashes verified.
- Migrations and forbidden paths: zero. The two textual `as any` additions occur inside
  preserved message-template strings, not executable type escapes.
