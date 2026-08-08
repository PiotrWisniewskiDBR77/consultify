# U02-A — same-SHA browser and deployment acceptance checklist

> Status: **NOT EXECUTED.** No browser or production acceptance is claimed.
> This is the executable checklist to run *after* the candidate SHA is deployed.
> Every step below must be performed against the deployed SHA, not a local tree.

Substitute throughout:

| Placeholder | Meaning |
| --- | --- |
| `$BASE` | deployed origin (e.g. `https://demo.consultify.ai`) |
| `$CASE` | Transformation Case id |
| `$ORG` | tenant of `$CASE` |
| `$TOKEN` | bearer token for the accountable actor (member of `$ORG`) |
| `$OTHER_TOKEN` | bearer token for a user in a **different** tenant |
| `$VIEWER_TOKEN` | bearer token for a read-only role inside `$ORG` |

## 0. Record the expected values first

Capture these from the manifest **before** any UI step, and treat them as the
expected values for every later assertion:

`REPORT_ID`, `REPORT_VERSION_ID`, `REPORT_VERSION_NUMBER`,
`REPORT_REGISTRY_ARTIFACT_ID`, `DECK_ID`, `DECK_VERSION_ID`,
`DECK_VERSION_NUMBER`, `DECK_REGISTRY_ARTIFACT_ID`, `FACTS_DIGEST`,
`DOCX_SHA256`, `PPTX_SHA256`, `RUN_ID`, `CASE_VERSION`.

## 1. Authenticated manifest and native lineage readback

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v8/transformation-cases/$CASE/final-outputs/latest" | tee manifest.json
```

Assert the response carries a `native` block whose eight fields equal the values
from §0, that `factsDigest` equals `FACTS_DIGEST`, and that `caseVersion` equals
`CASE_VERSION`. **The route intentionally omits `docxPath`/`pptxPath`** — absence
of filesystem paths in the HTTP payload is itself part of the contract.

Then confirm both native artifacts resolve through their owning modules for the
same tenant, and that both registry receipts exist and point back at them.

## 2. Open the native report in Report Builder

Route: `$BASE/reports/builder/$REPORT_ID`
(legacy alias `/reports-builder/$REPORT_ID` must redirect to it.)

- The report opens with title `Raport końcowy transformacji — $CASE`.
- Status is `APPROVED`; source is the Transformation Case, not an upload.
- All seven sections are present and readable, in order.
- The immutable version list shows exactly one version, number
  `REPORT_VERSION_NUMBER`, id `REPORT_VERSION_ID`.

## 3. Open the native deck in Presentations

Route: `$BASE/presentations/builder/$DECK_ID`

- The deck opens with the same title, status `ready`, 8 slides.
- The version history shows exactly one version, number `DECK_VERSION_NUMBER`,
  id `DECK_VERSION_ID`.

## 4. Editing isolation (the core U02-A claim)

1. Edit one narrative section in the report and save.
2. Re-read the manifest (§1): `factsDigest` **unchanged**.
3. Re-open the report version `REPORT_VERSION_ID`: its snapshot still contains
   the **pre-edit** narrative.
4. Re-open the deck: content **unchanged**, still version `DECK_VERSION_NUMBER`.
5. Repeat symmetrically — edit a slide, confirm the report and the facts digest
   are untouched.

## 5. Download and hash validation

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v8/transformation-cases/$CASE/final-outputs/docx/download" -o report.docx
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/v8/transformation-cases/$CASE/final-outputs/pptx/download" -o deck.pptx
shasum -a 256 report.docx deck.pptx
```

Both hashes must equal `DOCX_SHA256` / `PPTX_SHA256` from the manifest.

## 6. Tenant and role matrix

| Actor | Manifest GET | Report route | Deck route | Downloads | Expected |
| --- | --- | --- | --- | --- | --- |
| Accountable actor in `$ORG` | ✅ | ✅ | ✅ | ✅ | full access |
| Read-only role in `$ORG` (`$VIEWER_TOKEN`) | ✅ | ✅ read-only | ✅ read-only | ✅ | no edit affordances, save rejected |
| User in another tenant (`$OTHER_TOKEN`) | ❌ | ❌ | ❌ | ❌ | 403/404, never 200 |
| Unauthenticated | ❌ | ❌ | ❌ | ❌ | 401 |

Negative cross-tenant checks — every one must fail closed and leak no ids:

```bash
curl -si -H "Authorization: Bearer $OTHER_TOKEN" \
  "$BASE/api/v8/transformation-cases/$CASE/final-outputs/latest"
curl -si -H "Authorization: Bearer $OTHER_TOKEN" \
  "$BASE/api/v8/transformation-cases/$CASE/final-outputs/docx/download"
curl -si -H "Authorization: Bearer $OTHER_TOKEN" "$BASE/reports/builder/$REPORT_ID"
curl -si -H "Authorization: Bearer $OTHER_TOKEN" "$BASE/presentations/builder/$DECK_ID"
```

A `401` is not sufficient evidence of tenant scoping — confirm a *member of a
different tenant* is refused, not merely an anonymous caller.

## 7. Visual checks

- DOCX: open all 3 pages. Confirm the seven sections, the sources block, and
  that Polish figures keep their non-breaking thousands separators
  (`800 000 PLN`, not `800000 PLN`). No clipping, no overflow.
- PPTX: open all 8 slides — cover, executive summary, roadmap, delivery results,
  Finance actual-vs-plan, KPI durability, evidence manifest, closing. No
  clipping, no text overflow, no empty placeholder.

## 8. Evidence to capture after deployment

1. Deployed SHA and the exact deploy timestamp.
2. `manifest.json` as returned over HTTP, with the `native` block.
3. Screenshots: report open in Report Builder, deck open in Presentations, both
   version lists.
4. Before/after screenshots for the §4 editing-isolation steps, plus the
   re-read manifest showing an unchanged `factsDigest`.
5. Terminal output of the §5 hash comparison.
6. Full response status lines for every §6 negative check.
7. All 3 DOCX page images and all 8 PPTX slide images.
8. Any deviation from the expected ids in §0 — a mismatch invalidates the run.
