# Documents / Templates runtime evidence — 2026-08-07

This register records deployed runtime checks. A local test or build is not a
substitute for an entry here.

## PowerPoint — manual edit, autosave and cold reopen

- Railway deployment: `479e0f24-d165-4f5d-8c45-2c9773652e87` (`SUCCESS`)
- Commit: `44d66f5409` (`fix(presentations): persist manual deck rename`)
- Deck: `cf77e2d0a502413593765c1ea9e2b248`
- URL: `https://demo.consultify.ai/presentations/builder/cf77e2d0a502413593765c1ea9e2b248`
- Entry mode: **Clean / manual**, no Teresa generation.
- Steps: create blank deck; rename it to `Board Transformation Update — Manual QA`;
  insert a Heading and Paragraph block; enter the executive message; wait for
  `Saved`; reload the exact URL.
- Cold reopen: **PASS**. The title, `Transformation at a decision point`, full
  paragraph content, deck ID and `Saved` state all returned.
- Defect found and fixed: slide content persisted but the deck title reverted
  because autosave updated `deck_json` without updating `presentation_decks.title`.

### Native PPTX export and independent visual readback

- Final Railway deployment: `307a013d-9fe6-48ee-9a25-f4d6c9f62f2c` (`SUCCESS`).
- Export fixes included in HEAD history: `f12e630148` (manual traceability is a
  P2 warning), `1af5661c15` (edited headings and semantic message labels),
  `92bae66ca0` (refresh exporter output after a renderer deployment),
  `7da6574738`, `fafec7fe41`, and `746f3d39da` (legacy/manual cover title and
  multiple-heading handling).
- Final deck content: 2 slides. Slide 1 title is
  `Transformation at a decision point`; slide 2 title is
  `Three decisions unlock EUR 2.2m annual benefit`.
- Autosave/cold reopen: **PASS** immediately before export on the exact deck URL;
  both edited titles and `Saved` returned.
- Native browser download: **PASS**. Final file:
  `/Users/piotrwisniewski/Downloads/Board Transformation Update — Manual QA (4).pptx`.
- Independent XML readback: **PASS**. `ppt/slides/slide1.xml` contains the edited
  cover title and no longer contains `Nowa prezentacja` as the rendered title.
- Independent render: **PASS**. Both slides were rendered to PNG and inspected
  individually; the cover has a clean two-line hierarchy, slide 2 has two
  readable message cards, no literal `paragraph` labels, and no clipped header.
- Structural verifier: **PASS** (`Test passed. No overflow detected.`).
- Defects found in deployed output and fixed: stale starter cover title,
  `New Slide`, literal block-type labels, clipped long message headings, and
  persisted exports surviving renderer deployments.

## PowerPoint — template to grounded artifact

- Initial grounding deployment: `fba38bd8-3d83-417c-8e77-081bfd120ba6`
  (`SUCCESS`).
- Final Railway demo deployment: `fa38eac6-b52f-45ce-a998-0ad9e162251d`
  (`SUCCESS`).
- Final deployed commit: `9fcc075bdd`
  (`fix(presentations): canonicalize autosaved deck text`). The deployed history
  also includes `c3fd0dca76`, `5d9165e5aa`, `66e02287d6` and `401df6c467` for
  manual metric-strip editing and legacy title/thesis synchronization.
- Template Library artifact: `d59b4cee-9f75-4584-a59b-66bc2431819e`
- Template: `Steering Committee Update`
- Result deck: `5baa656fc9b3467fb6c5f1aafae55322`
- URL: `https://demo.consultify.ai/presentations/builder/5baa656fc9b3467fb6c5f1aafae55322`
- Result: **PASS**, 8 slides, independent deck ID and title
  `Steering Committee Update — Grounded QA`.
- Grounding assertions visible in the editor and retained after cold reopen:
  `EUR 2.2m`, `EUR 1.08m`, `data migration delay`, `parallel reconciliation`,
  `lock phase-two scope by 15 August`, and `confirm Operations owner`.
- Final decision content visible in the editor and retained after cold reopen:
  delivery is three points behind plan; contingency is conditional on migration
  reconciliation; Operations owns data reconciliation; business-unit leaders
  own adoption; the decision deadline is 15 August.
- Autosave/cold reopen: **PASS** on the exact result URL. The four final slide
  theses, risk table, named owners and actions all returned. No `Data required`
  or `Owner required` content returned.
- Runtime Quality Gates: **90/100**, `P0=0`, `P1=0`, `P2=2`, no errors. The
  exact `DeckQualityGates` result is recorded in the logs of deployment
  `fa38eac6-b52f-45ce-a998-0ad9e162251d` at `2026-08-07T16:10:24Z`. Native PPTX
  export proceeded without an override.
- Final native download:
  `/Users/piotrwisniewski/Downloads/Steering Committee Update — Grounded QA (1).pptx`.
  `unzip -t` reported no compressed-data errors. Independent XML/text inspection
  found no unresolved-data/owner placeholders or mojibake.
- Independent render: **PASS**. All 8 slides rendered to
  `/Users/piotrwisniewski/Downloads/Steering Committee Update — Grounded QA final-1810`.
  The full contact sheet and slides 4, 6, 7 and 8 were inspected at original
  resolution. The deck has a consistent executive hierarchy, explicit metrics,
  roadmap, named risk owners and a dated decision request.
- Structural verifier: **PASS** (`Test passed. No overflow detected.`).
- Defect found and fixed: prose briefs were split only on semicolons/newlines;
  risk and decision slides also used canned rows. Sentence-aware parsing and
  deterministic risk/mitigation/decision materialization now preserve the brief.
  Follow-up fixes removed sparse placeholder cards, made metric strips editable,
  synchronized duplicate legacy headings/theses and recursively decoded HTML
  entities before persistence.

## Verification

- Final autosave canonicalizer, route-source contract and manual-editing suites:
  12/12 PASS.
- Template runtime and route wiring suites: 21/21 PASS.
- Frontend production build: PASS.
- Backend production build: PASS.

These entries close the tested PowerPoint slices only. They do not by themselves
constitute acceptance of the complete Documents / Templates DoD.

## Materials libraries — authenticated collection runtime

- Railway deployment: `307a013d-9fe6-48ee-9a25-f4d6c9f62f2c` (`SUCCESS`).
- URL: `https://demo.consultify.ai/presentations`.
- Authenticated UI checks: **PASS** for `All`, `Documents`, `Presentations`,
  `Sheets`, and `Template Library`; no 404, failed-load, or fallback message was
  present in any checked view.
- `Documents`: 5 runtime rows including the clean, grounded, template, and final
  Program Atlas reports.
- `Presentations`: 3 runtime rows including the 2-slide manual deck and both
  8-slide template-derived decks.
- `Sheets`: 2 runtime rows, including `Dashboard KPI` and `Pusty arkusz`, with
  XLSX export capability visible.
- `All`: one collection contained Sheet, Document, and Presentation rows
  together.
- `Template Library`: 100 table rows (header plus 99 templates), with 53
  `Approved` and 46 `Published` shown by the runtime filters.

This closes the original authenticated `/api/artifacts` collection 404 symptom
at the deployed UI level; it does not substitute for the remaining template
quality and builder acceptance work.

## Word — clean/manual authoring, autosave and cold reopen

- Artifact: `artifact-6f56477e-fde6-4321-b1c9-0f9ec71d4445`
- URL: `https://demo.consultify.ai/document-studio/artifact-6f56477e-fde6-4321-b1c9-0f9ec71d4445`
- Entry mode: **Clean / manual**, without Teresa.
- Steps: create blank document; rename to
  `Board Transformation Decision Brief — Manual QA`; enter a substantive Program
  Atlas board brief; insert a quote attributed to `Transformation Office`; insert
  chart `Program delivery versus plan` with Plan 75 and Wykonanie 72; wait for
  autosave; reopen the exact artifact URL.
- Autosave/cold reopen: **PASS**. Title, prose, quote, attribution, chart and saved
  state all returned.

## Word — approved template to grounded artifact and native DOCX export

- Railway code deployment: `ad126b80-b517-4c7e-906b-0e9922d1593b` (`SUCCESS`)
- Railway export-entitlement deployment:
  `c837c379-7444-42c7-ad5c-222ca2561a6a` (`SUCCESS`)
- Commit: `2f2e2f3b52` (`fix(documents): align executive QA with decision lists`)
- Template Library artifact: `46301065-b8eb-4147-800e-4f3895643066`
- Template: `[System] board report (EN)`
- Result artifact: `artifact-930ca3f2-e9bd-4070-b4aa-df2b9ee9f012`
- URL: `https://demo.consultify.ai/document-studio/artifact-930ca3f2-e9bd-4070-b4aa-df2b9ee9f012`
- Source pack: period KPIs, decisions required and risks. Exact retained facts
  include `72% vs 75%`, `EUR 2.2m`, `EUR 1.08m`, phase-two scope by 15 August,
  Operations ownership, data-migration risk and parallel reconciliation.
- Autosave/cold reopen: **PASS** on the exact result URL; title, recommendation,
  KPIs, decisions and risks all returned.
- Runtime QA: **All clear**; Executive QA **100/100**, completeness **100/100**,
  sources **100/100**, risk **100/100**, data **100/100**, format **100/100**.
  Low-severity density, manual-source pinning and absent-appendix-style findings
  remain advisory and did not block export.
- Native DOCX export without QA override: **PASS**. Runtime displayed
  `DOCX exported — the download has started.`
- Download readback:
  `/Users/piotrwisniewski/Downloads/program_atlas_board_decision_report_qa_clean.docx`.
  `unzip -t` reported no compressed-data errors. Independent extraction of
  `word/document.xml` confirmed the recommendation, all KPIs, decisions, risks
  and mitigations.
- Defects found and fixed: source bodies were previously encoded only in a
  `sourceId` and not supplied to prose grounding; structured decision/risk blocks
  remained placeholders; Executive QA counted a three-item numbered list as one
  action. The trial export policy itself was preserved; the existing
  `TRIAL_EXPORT_ENABLED=true` capability was enabled only in the Railway demo
  environment, while DEMO/TRIAL_ENTRY/UNKNOWN scopes remain deny-by-default.

These entries close the tested Word manual, template-to-artifact and native DOCX
export slices. They do not by themselves constitute acceptance of the complete
Documents / Templates DoD.

## Excel — deployed merge/unmerge regression and cold reopen

- Railway deployment: `ad126b80-b517-4c7e-906b-0e9922d1593b` (`SUCCESS`)
- Fix commit included in branch history: `cd4e17db73` (rowspan/colspan rendering
  and full-range unmerge).
- Workbook: `0b44c3cc-bcca-480c-a252-a117d64bf5ad`
- URL: `https://demo.consultify.ai/excele?artifactId=0b44c3cc-bcca-480c-a252-a117d64bf5ad`
- Steps: restore an earlier merge; select `A4:B5`; merge the 2x2 range; wait for
  autosave; reopen the exact URL; select merged anchor `A4`; unmerge; wait for
  autosave; reopen again.
- Merge cold reopen: **PASS**. Only anchor `A4` rendered; covered cells `B4`,
  `A5`, `B5` did not render, proving both row and column span were applied.
- Unmerge cold reopen: **PASS**. `A4`, `B4`, `A5`, and `B5` all returned as
  independent grid cells; pre-existing `A3 Plan` and `B3 -100` data remained.

This entry closes only the deployed merge/unmerge regression. The broader Excel
manual and template-to-workbook acceptance matrix remains open.

## Excel — clean/manual workbook, formulas, chart and native XLSX export

- Railway deployments:
  - `71778455-c5da-4f52-a800-b77a27e91d1a` (`SUCCESS`) — decision-ready chart
    generation (`0b373826c6`)
  - `369a40c4-f5df-4bfe-a855-bb5ac87d4203` (`SUCCESS`) — reopened-workbook
    native Download (`fe7da32025`)
  - `8db9fd72-ca69-40b2-8b3e-9c9bfd89eb0f` (`SUCCESS`) — renamed-workbook
    download filename (`6c95a3b013`)
- Workbook: `59ef4ce7-01c3-492d-8787-69866887c00e`
- URL: `https://demo.consultify.ai/excele?artifactId=59ef4ce7-01c3-492d-8787-69866887c00e`
- Entry mode: **Clean / manual**, without Teresa.
- Final title: `Program Atlas Performance Model — Board QA`.
- Manual content: Plan/Actual/Variance table for delivery, annual benefit, spend
  and contingency; formulas in `D3:D6`; percentage and EUR formats; negative
  variance conditional formatting; styled header; header filters and freeze;
  chart sourced from `A2:C6`.
- Autosave/cold reopen: **PASS**. Title, values, all formula results and chart
  `Plan vs Actual by Metric` returned on the exact URL.
- Native Download button: **PASS**. Browser emitted a download event and the
  deployed endpoint returned HTTP 200 on deployment
  `8db9fd72-ca69-40b2-8b3e-9c9bfd89eb0f`.
- Download readback:
  `/Users/piotrwisniewski/Downloads/Program_Atlas_Performance_Model_Board_QA.xlsx`.
  Independent workbook inspection found 2 sheets (`Arkusz1`, `Info`), four
  formulas (`D3:D6`), no formula-error matches, and the chart image anchored at
  row 8 rather than far below the working table. The Info sheet retained the
  final workbook title.
- Visual verification: the extracted 720x420 chart renders two distinct Plan
  and Actual series, a business-readable title, legend and full category labels.
- Defects found and fixed: the original chart treated generic column letters as
  business headers, emitted only one series, clipped labels and anchored at row
  34; reopened Download used a popup/no-op path; rename did not update the XLSX
  `Content-Disposition` filename.

This entry closes the tested Excel clean/manual and native XLSX export slice.
The Excel template-to-workbook slice remains open.

## Excel — approved template to independent workbook and native XLSX export

- Railway deployment: `04c695d4-1ec3-4232-800d-e5a811cff7a3` (`SUCCESS`)
- Chart-title fix commit: `c1c0810771`.
- Approved template: `Dashboard KPI`
- Template ID: `f5da6891-de3e-431d-8bc8-10e97b01609a`
- Builder URL:
  `https://demo.consultify.ai/presentations?tab=workbook_templates&workbookTemplateId=f5da6891-de3e-431d-8bc8-10e97b01609a`
- Independent result workbook: `f6d4613c-f018-4ed1-8baa-1a9e60c0cdf6`
- Result URL:
  `https://demo.consultify.ai/excele?artifactId=f6d4613c-f018-4ed1-8baa-1a9e60c0cdf6`
- Builder result: `Model verified ✓ (0 notes)`; the result uses a different ID
  and editor route from the reusable template.
- Final title: `Program Atlas KPI Dashboard — Template QA`.
- Grounded content: target, actual, calculated variance and decision-oriented
  trend for delivery (`75%`/`72%`), annual benefit (`EUR 2.0m`/`EUR 2.2m`),
  spend (`EUR 1.40m`/`EUR 1.08m`) and decision readiness (`100%`/`67%`).
  Variances are formulas in `D2:D5`; percentage and EUR formats were applied.
- Chart: `Cel vs Wynik by Wskaźnik`, sourced from `A2:C5`. The deployed export
  reads schema-backed column names rather than using the first data row as its
  title.
- Autosave/cold reopen: **PASS**. Final title, exact data, formulas, trends and
  chart returned on the result URL.
- Native Download button: **PASS**. A real browser download event produced
  `/Users/piotrwisniewski/Downloads/Program_Atlas_KPI_Dashboard_Template_QA (1).xlsx`.
- Independent artifact-tool readback: **PASS**. The XLSX contains 2 sheets
  (`Sheet1`, `Info`), exact `A1:E5` data, formulas `D2:D5`, no formula-error
  matches, and a 720x420 chart image anchored at row 7.
- Visual verification: **PASS**. The rendered table shows 75.0%, 72.0%, -3.0%,
  100.0%, 67.0%, -33.0% and two-decimal EUR values without raw floating-point
  noise. The chart shows distinct `Cel` and `Wynik` series, all four complete
  category labels, legend and the correct business title. The Info sheet retains
  the final workbook title and template description.

This entry closes the tested Excel approved-template-to-independent-workbook and
native XLSX export slice. It does not by itself constitute acceptance of the
complete Documents / Templates DoD.

## Materials — presentation-template lifecycle projection

- Commit: `5dcc6cf518` (`fix(templates): project deck lifecycle in materials`)
- Railway deployment: `4d1b56ed-d978-47bd-85c9-569a99b34371` (`SUCCESS`)
- Image digest: `sha256:cc09cb4fc83a8f6317a4fa110260ab38ea4e16cf0d201d64b84862f1a6bd201b`
- URL: `https://demo.consultify.ai/presentations?tab=templates`
- Root cause: read-time enrichment for `presentation_template` ignored
  `presentation_templates.lifecycle_state` and classified every row with
  `is_active=true` as `published`. That overwrote the correct draft snapshot on
  every authenticated collection read.
- Contract fix: lifecycle state is now authoritative for Draft/Deprecated;
  Architect `approved` remains the unified-library `published` terminal state.
  The fix is server-side; no frontend fallback was introduced.
- Automated evidence: the focused registry/route suites pass **19/19**, including
  explicit Draft/Approved/Deprecated projection; backend and frontend builds pass.
- Default-view cold reload: **PASS** — 91 templates, Approved 53, Published 38,
  Draft 0; system drafts are absent.
- `Show drafts`: **PASS** — 99 templates, Approved 53, Published 38, Draft 8.
  `Deck rekomendacji Minto (Recommendation Deck)` and `Investor pitch` both
  render as Draft.

This closes the false-Published lifecycle defect end-to-end. It does not waive
the remaining create/edit/save/reopen acceptance of the three template builders.

## Three template builders — governed authoring round trips

- Railway deployment: `2be6062b-be32-457a-a0d9-3df951e926a8` (`SUCCESS`)
- Image digest: `sha256:a8b895a929d2157710c8a9e9a5dd668b89734b9a0083b8ca0e1033a714db8ddc`
- UI-fix commit: `9d7505a5a4` (`fix(templates): use governed deprecation dialog`)
- Word builder: created `QA Board Decision Memo — Builder Roundtrip 2026-08-07`,
  edited identity, Graphite branding, header/footer, required sources and section
  guidance/data/evidence; saved, cold-reopened, validated, approved and
  deprecated. Approved state removed draft deletion. Deployment
  `2be6062b-be32-457a-a0d9-3df951e926a8` also cold-reloaded the registry with the
  final `Deprecated` label instead of the raw `statusChip.deprecated` key.
- Excel builder: created `QA Board Risk Tracker — Excel Builder Roundtrip
  2026-08-07` (`b271c041-5d06-4d63-bf62-0d87c9d9634d`) with six typed columns,
  list validation and exposure formula `=B2*C2`; saved, cold-reopened, updated,
  approved as `1.0.0`, cold-reopened again and deprecated. Formula, values,
  description and Navy Executive theme persisted. Approved state exposed
  deprecation and did not expose draft deletion.
- PowerPoint builder: created `QA Board Decision Deck — Builder Roundtrip
  2026-08-07` with six governed slides, Graphite theme, decision guidance,
  evidence requirements and required typed date variable `decision_deadline`;
  saved, cold-reopened, validated and approved. The approved cold reopen retained
  all content, disabled authoring and exposed deprecation without draft deletion.
- PowerPoint deprecation on deployment `2be6062b-be32-457a-a0d9-3df951e926a8`:
  **PASS**. A Consultify modal opened, explained preservation semantics, required
  a reason, kept confirmation disabled while empty and accepted the reason
  `Runtime QA completed after approved lifecycle verification on deployment
  2be6062b.`. The registry then rendered the template as `Deprecated`; no native
  browser prompt was used.

This proves the full draft/edit/save/cold-reopen/validate/approve/deprecate
lifecycle in all three builders. Qualification of the nine board-ready reusable
templates remains a separate content and visual acceptance gate.
